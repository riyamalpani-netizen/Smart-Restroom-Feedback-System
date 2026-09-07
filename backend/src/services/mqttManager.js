/**
 * mqttManager.js
 *
 * Manages one MQTT connection per vendor organisation.
 * Each org's TTN credentials are stored in the `settings` table.
 * Falls back to the global env-var credentials for the super-admin / any org
 * that has not configured its own TTN application.
 *
 * Public API:
 *   connectAll(io)          – called once at server startup
 *   connectOrg(orgId, io)   – (re)connect a single org; called after settings save
 *   disconnectOrg(orgId)    – tear down an org's connection
 *   reloadOrg(orgId, io)    – disconnectOrg + connectOrg (hot-reload on settings change)
 *   getClients()            – returns the full map { orgId: mqttClient }
 */

const mqtt = require("mqtt");
const prisma = require("../config/database");
const { processFeedback } = require("./mqttService");
const { getIO } = require("../utils/socket");
const logger = require("../middleware/logger");
const {
  TTN_MQTT_BROKER,
  TTN_MQTT_PORT,
  TTN_MQTT_USERNAME,
  TTN_MQTT_PASSWORD,
  TTN_MQTT_TOPIC,
} = require("../config/env");

// orgId → mqtt.Client
const clients = new Map();

// ── helpers ───────────────────────────────────────────────────────────────────

function buildCredentials(settings) {
  const broker   = settings?.ttnMqttBroker   || TTN_MQTT_BROKER  || "eu1.cloud.thethings.network";
  const port     = TTN_MQTT_PORT             || 8883;
  const username = settings?.ttnMqttUsername || TTN_MQTT_USERNAME;
  const password = settings?.ttnMqttPassword || TTN_MQTT_PASSWORD;
  const appId    = settings?.ttnAppId        || (TTN_MQTT_USERNAME?.split("@")[0]);
  const topic    = settings?.ttnMqttTopic
    || (appId ? `v3/${appId}@ttn/devices/+/up` : TTN_MQTT_TOPIC)
    || "v3/+/devices/+/up";

  return { broker, port, username, password, topic };
}

function isConfigured(creds) {
  return !!(creds.broker && creds.username && creds.password);
}

// ── core: connect one org ─────────────────────────────────────────────────────

function connectOrg(orgId, io, creds) {
  // Tear down existing connection for this org first
  if (clients.has(orgId)) {
    try { clients.get(orgId).end(true); } catch (_) {}
    clients.delete(orgId);
  }

  if (!isConfigured(creds)) {
    logger.warn(`[MQTTManager] Org ${orgId}: TTN credentials not configured — skipping`);
    return null;
  }

  const url      = `mqtts://${creds.broker}:${creds.port}`;
  const clientId = `srfs-${orgId}-${Date.now()}`;

  logger.info(`[MQTTManager] Org ${orgId}: connecting to ${url} as ${creds.username}`);

  const client = mqtt.connect(url, {
    clientId,
    username: creds.username,
    password: creds.password,
    reconnectPeriod: 5000,
  });

  // Track consecutive failures to suppress log spam and stop retrying on auth errors
  let authFailed = false;

  client.on("connect", () => {
    authFailed = false;
    logger.info(`[MQTTManager] Org ${orgId}: connected`);
    // Update connection status in DB (non-blocking)
    prisma.vendorTTNConfig.updateMany({
      where: { organizationId: orgId },
      data: { connectionStatus: "connected", lastStatusAt: new Date() },
    }).catch(() => {});
    client.subscribe(creds.topic, { qos: 0 }, (err) => {
      if (err) logger.error(`[MQTTManager] Org ${orgId}: subscribe failed — ${err.message}`);
      else     logger.info(`[MQTTManager] Org ${orgId}: subscribed to ${creds.topic}`);
    });
  });

  client.on("message", async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.simulated) return;

      const devEui = payload.data?.end_device_ids?.dev_eui
        || payload.end_device_ids?.dev_eui
        || payload.uplink_message?.ids?.dev_eui
        || "unknown";
      logger.info(`[MQTTManager] Org ${orgId} | topic: ${topic} | dev_eui: ${devEui}`);

      const result = await processFeedback(payload);
      const socket = io || getIO();

      if (result.success && socket) {
        socket.emit("new-feedback", result.data);
        if (result.alert) socket.emit("new-alert", result.alert);
      } else if (!result.success) {
        logger.warn(`[MQTTManager] Org ${orgId}: processFeedback failed — ${result.error}`);
      }
    } catch (err) {
      logger.error(`[MQTTManager] Org ${orgId}: message handler error`, err);
    }
  });

  client.on("error", (err) => {
    const msg = err.message || "";
    // "Not authorized" = wrong credentials — stop reconnecting immediately
    if (msg.includes("Not authorized") || msg.includes("Connection refused")) {
      if (!authFailed) {
        logger.error(`[MQTTManager] Org ${orgId}: authentication failed — stopping reconnects. Check MQTT credentials in Vendor TTN config.`);
        authFailed = true;
      }
      // Disable reconnect and close cleanly
      try { client.end(true); } catch (_) {}
      clients.delete(orgId);
      return;
    }
    // Other errors (ECONNRESET etc.) — log once then let reconnect handle it
    if (!authFailed) {
      logger.error(`[MQTTManager] Org ${orgId}: error — ${msg}`);
    }
  });

  client.on("offline", () => {
    if (!authFailed) {
      logger.warn(`[MQTTManager] Org ${orgId}: went offline`);
      prisma.vendorTTNConfig.updateMany({
        where: { organizationId: orgId },
        data: { connectionStatus: "disconnected", lastStatusAt: new Date() },
      }).catch(() => {});
    }
  });

  client.on("reconnect", () => {
    if (!authFailed) logger.info(`[MQTTManager] Org ${orgId}: reconnecting…`);
  });

  clients.set(orgId, client);
  return client;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Load all Settings records that have TTN credentials configured and
 * open one MQTT connection per org. Also opens the global env-var connection
 * under the key "global" as a catch-all for orgs without their own credentials.
 */
async function connectAll(io) {
  // 1. Global fallback (env-var credentials) — key = "global"
  const globalCreds = buildCredentials(null);
  if (isConfigured(globalCreds)) {
    logger.info("[MQTTManager] Starting global (env-var) MQTT connection");
    connectOrg("global", io, globalCreds);
  } else {
    logger.warn("[MQTTManager] No global TTN MQTT credentials in .env — global connection skipped");
  }

  // 2. Per-org connections from the DB — check VendorTTNConfig first (authoritative),
  //    fall back to legacy Settings table for orgs that predate VendorTTNConfig.
  try {
    // Orgs with VendorTTNConfig — only connect if integrationEnabled = true
    const vendorConfigs = await prisma.vendorTTNConfig.findMany({
      where: {
        integrationEnabled: true,
        ttnMqttUsername: { not: null },
        ttnMqttPassword: { not: null },
      },
      select: {
        organizationId: true,
        ttnAppId: true,
        ttnMqttBroker: true,
        ttnMqttUsername: true,
        ttnMqttPassword: true,
        ttnMqttTopic: true,
      },
    });

    // Legacy Settings-based orgs (no VendorTTNConfig row yet)
    const vendorOrgIds = new Set(vendorConfigs.map(v => v.organizationId));
    const legacySettings = await prisma.settings.findMany({
      where: {
        ttnMqttUsername: { not: null },
        ttnMqttPassword: { not: null },
        organizationId: { notIn: [...vendorOrgIds] },
      },
      select: {
        organizationId: true,
        ttnAppId: true,
        ttnMqttBroker: true,
        ttnMqttUsername: true,
        ttnMqttPassword: true,
        ttnMqttTopic: true,
      },
    });

    const allOrgs = [...vendorConfigs, ...legacySettings];
    logger.info(`[MQTTManager] Found ${allOrgs.length} org(s) with TTN credentials to connect`);

    for (const s of allOrgs) {
      const creds = buildCredentials(s);
      connectOrg(s.organizationId, io, creds);
    }
  } catch (err) {
    logger.error("[MQTTManager] Failed to load org TTN settings from DB:", err);
  }
}

/**
 * (Re)connect a single org using its current VendorTTNConfig (authoritative)
 * or legacy Settings record. Called after TTN config is saved via vendor controller.
 */
async function reloadOrg(orgId, io) {
  try {
    // Check VendorTTNConfig first
    const vendorCfg = await prisma.vendorTTNConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (vendorCfg) {
      if (!vendorCfg.integrationEnabled) {
        logger.info(`[MQTTManager] Org ${orgId}: integration disabled — disconnecting`);
        disconnectOrg(orgId);
        return;
      }
      const creds = buildCredentials(vendorCfg);
      if (isConfigured(creds)) {
        logger.info(`[MQTTManager] Reloading MQTT connection for org ${orgId}`);
        connectOrg(orgId, io || getIO(), creds);
        return;
      }
    }

    // Fallback: legacy Settings table
    const s = await prisma.settings.findFirst({ where: { organizationId: orgId } });
    const creds = buildCredentials(s);
    if (isConfigured(creds)) {
      logger.info(`[MQTTManager] Reloading MQTT connection for org ${orgId} (legacy settings)`);
      connectOrg(orgId, io || getIO(), creds);
    } else {
      logger.info(`[MQTTManager] Org ${orgId} has no TTN credentials — disconnecting`);
      disconnectOrg(orgId);
    }
  } catch (err) {
    logger.error(`[MQTTManager] reloadOrg(${orgId}) error:`, err);
  }
}

function disconnectOrg(orgId) {
  if (clients.has(orgId)) {
    try { clients.get(orgId).end(true); } catch (_) {}
    clients.delete(orgId);
    logger.info(`[MQTTManager] Org ${orgId}: disconnected`);
  }
}

function disconnectAll() {
  for (const [orgId] of clients) disconnectOrg(orgId);
  logger.info("[MQTTManager] All MQTT connections closed");
}

function getClients() {
  return clients;
}

module.exports = { connectAll, connectOrg, reloadOrg, disconnectOrg, disconnectAll, getClients };
