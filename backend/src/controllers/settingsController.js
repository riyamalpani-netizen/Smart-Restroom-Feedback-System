const prisma = require("../config/database");
const { sendTeamsWebhook } = require("../services/teamsWebhookService");
const { logAudit } = require("../utils/auditLogger");

// TTN fields that are now owned exclusively by Super Admin (via VendorTTNConfig).
// Vendor Admin can no longer write these through the Settings endpoint.
const TTN_FIELDS = [
  "ttnAppId",
  "ttnApiKey",
  "ttnGatewayApiKey",
  "ttnMqttBroker",
  "ttnMqttUsername",
  "ttnMqttPassword",
  "ttnMqttTopic",
  "ttnFrequencyPlanId",
  "ttnGatewayOwnerType",
  "ttnGatewayOwnerId",
];

/**
 * Strips Teams-webhook fields for super_admin (vendor-portal-only feature).
 */
function stripTeamsFields(settings) {
  const { teamsWebhook, teamsRecipient, ...rest } = settings;
  return rest;
}

/**
 * Strips TTN credential secrets for non-owners.
 */
function stripTtnFields(settings) {
  const out = { ...settings };
  for (const f of TTN_FIELDS) delete out[f];
  return out;
}

/**
 * Build the read-only TTN status object from VendorTTNConfig for Vendor Admin view.
 * Checks the live MQTT client map so the status is always current.
 */
async function buildTtnStatusForVendor(organizationId) {
  const cfg = await prisma.vendorTTNConfig.findUnique({
    where: { organizationId },
    select: {
      ttnAppId: true,
      ttnMqttBroker: true,
      ttnMqttUsername: true,
      ttnFrequencyPlanId: true,
      integrationEnabled: true,
      connectionStatus: true,
      lastStatusAt: true,
    },
  });

  if (!cfg) return null;

  // Check live MQTT client for real-time status
  try {
    const { getClients } = require("../services/mqttManager");
    const clients = getClients();
    const liveConnected = clients.has(organizationId) && clients.get(organizationId).connected;
    const currentStatus = liveConnected
      ? "connected"
      : cfg.integrationEnabled
      ? "disconnected"
      : "disabled";

    // Update DB if status changed (non-blocking)
    if (cfg.connectionStatus !== currentStatus) {
      prisma.vendorTTNConfig.update({
        where: { organizationId },
        data: { connectionStatus: currentStatus, lastStatusAt: new Date() },
      }).catch(() => {});
    }

    return { ...cfg, connectionStatus: currentStatus };
  } catch {
    return cfg;
  }
}

/**
 * GET /api/settings
 *
 * - super_admin : can query any org via ?organizationId=; sees general settings (no TTN secrets)
 * - vendor_admin: always their own org; gets general settings + read-only TTN integration status
 */
async function getSettings(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;

    const organizationId = role === "super_admin"
      ? (req.query.organizationId || callerOrgId)
      : callerOrgId;

    const settings = await prisma.settings.findFirst({
      where: organizationId ? { organizationId } : undefined,
    });

    const defaults = {
      organizationId: organizationId || null,
      teamsWebhook: "",
      teamsRecipient: "Operations Teams channel",
      reportFrequency: "daily",
      sessionTimeout: 28800,
      passwordPolicy: "min 8 chars, 1 uppercase, 1 number",
    };

    let payload = settings ? { ...settings } : defaults;

    // Always strip TTN secret fields from the settings response —
    // TTN config is now managed exclusively via /api/vendors/:id/ttn-config
    payload = stripTtnFields(payload);

    // Super Admin: also strip Teams fields (vendor-only feature)
    if (role === "super_admin") {
      payload = stripTeamsFields(payload);
    }

    // Vendor Admin: attach read-only TTN integration status
    if (role !== "super_admin") {
      const ttnStatus = await buildTtnStatusForVendor(organizationId);
      payload.ttnIntegrationStatus = ttnStatus;
    }

    if (!settings) {
      return res.status(200).json({ message: "Settings not found – defaults returned", settings: payload });
    }

    if (role !== "super_admin" && settings.organizationId !== callerOrgId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json({ message: "Settings fetched successfully", settings: payload });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * PUT /api/settings
 *
 * vendor_admin: teamsWebhook, teamsRecipient, reportFrequency, sessionTimeout
 *               (TTN fields are now Super Admin only — rejected if sent)
 * super_admin : reportFrequency, sessionTimeout, passwordPolicy
 */
async function updateSettings(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;
    const requestedOrgId = req.body.organizationId;

    const targetOrgId = role === "super_admin"
      ? (requestedOrgId || callerOrgId)
      : callerOrgId;

    if (!targetOrgId) {
      return res.status(400).json({ message: "Organization ID is required" });
    }

    if (role !== "super_admin" && requestedOrgId && requestedOrgId !== callerOrgId) {
      return res.status(403).json({ message: "You can only update your own organisation's settings" });
    }

    // Reject any attempt by non-super-admin to write TTN fields
    if (role !== "super_admin") {
      const ttnAttempted = TTN_FIELDS.filter((f) => req.body[f] !== undefined);
      if (ttnAttempted.length > 0) {
        return res.status(403).json({
          message: `TTN/MQTT configuration (${ttnAttempted.join(", ")}) can only be set by a Super Admin`,
        });
      }
    }

    const {
      teamsWebhook, teamsRecipient,
      reportFrequency, sessionTimeout, passwordPolicy,
    } = req.body;

    const updatePayload = {};

    if (reportFrequency !== undefined)  updatePayload.reportFrequency = reportFrequency;
    if (sessionTimeout !== undefined)   updatePayload.sessionTimeout = parseInt(sessionTimeout);

    if (role !== "super_admin") {
      if (teamsWebhook !== undefined)   updatePayload.teamsWebhook = teamsWebhook;
      if (teamsRecipient !== undefined) updatePayload.teamsRecipient = teamsRecipient;
    }

    if (role === "super_admin" && passwordPolicy !== undefined) {
      updatePayload.passwordPolicy = passwordPolicy;
    }

    const settings = await prisma.settings.upsert({
      where:  { organizationId: targetOrgId },
      update: updatePayload,
      create: { organizationId: targetOrgId, ...updatePayload },
    });

    await logAudit(req, {
      module: "Settings",
      action: "UPDATE",
      description: `Updated settings for organisation ${targetOrgId}`,
    });

    res.status(200).json({ message: "Settings updated successfully", settings });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * POST /api/settings/test-ttn-connection
 *
 * Super Admin only (via vendor config panel). Tests a live MQTT connect with
 * the submitted credentials without persisting anything.
 */
async function testTtnConnection(req, res) {
  try {
    const { ttnMqttBroker, ttnMqttUsername, ttnMqttPassword } = req.body;
    if (!ttnMqttBroker || !ttnMqttUsername || !ttnMqttPassword) {
      return res.status(400).json({ message: "Broker, username and password are required" });
    }

    const mqtt = require("mqtt");
    const result = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        client.end(true);
        resolve({ success: false, error: "Connection timed out (10 s)" });
      }, 10000);

      const client = mqtt.connect(`mqtts://${ttnMqttBroker}:8883`, {
        clientId: `srfs-test-${Date.now()}`,
        username: ttnMqttUsername,
        password: ttnMqttPassword,
        reconnectPeriod: 0,
      });

      client.on("connect", () => {
        clearTimeout(timeout);
        client.end(true);
        resolve({ success: true });
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        client.end(true);
        resolve({ success: false, error: err.message });
      });
    });

    if (result.success) {
      return res.status(200).json({ message: "TTN connection successful" });
    } else {
      return res.status(400).json({ message: "TTN connection failed", error: result.error });
    }
  } catch (error) {
    console.error("Test TTN connection error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * POST /api/settings/test-teams-webhook  (unchanged)
 */
async function testTeamsWebhook(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;
    const { teamsWebhook } = req.body;

    if (!teamsWebhook) {
      return res.status(400).json({ message: "Teams webhook URL is required" });
    }
    if (role === "super_admin") {
      return res.status(403).json({ message: "Teams webhook integration is only available for vendor admin organisations" });
    }

    const stored = await prisma.settings.findFirst({
      where: { organizationId: callerOrgId },
      select: { teamsWebhook: true },
    });
    if (stored?.teamsWebhook && stored.teamsWebhook !== teamsWebhook) {
      return res.status(403).json({ message: "You can only test the webhook for your own organisation" });
    }

    const result = await sendTeamsWebhook(teamsWebhook, {
      restroom: "Test Restroom",
      feedbackType: "needs_cleaning",
      priority: "medium",
      battery: 85,
      timestamp: new Date().toISOString(),
      alertId: "TEST-001",
    });

    if (result.success) {
      return res.status(200).json({ message: "Teams webhook test sent successfully" });
    } else {
      return res.status(400).json({ message: "Failed to send Teams webhook", error: result.error });
    }
  } catch (error) {
    console.error("Test Teams webhook error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { getSettings, updateSettings, testTeamsWebhook, testTtnConnection };
