const mqtt = require("mqtt");
const prisma = require("../config/database");
const { notifyTeamsForAlert } = require("./teamsAlertService");
const logger = require("../middleware/logger");
const { TTN_MQTT_BROKER, TTN_MQTT_PORT, TTN_MQTT_USERNAME, TTN_MQTT_PASSWORD, TTN_MQTT_TOPIC } = require("../config/env");

let mqttClient = null;

function connectMQTT(io) {
  if (!TTN_MQTT_BROKER || !TTN_MQTT_USERNAME || !TTN_MQTT_PASSWORD) {
    logger.warn("TTN MQTT credentials not configured. MQTT service disabled.");
    return null;
  }

  logger.info(`Connecting to TTN MQTT broker at ${TTN_MQTT_BROKER}:${TTN_MQTT_PORT} as ${TTN_MQTT_USERNAME}`);

  const clientId = `smart-restroom-backend-${Date.now()}`;
  const url = `mqtts://${TTN_MQTT_BROKER}:${TTN_MQTT_PORT}`;

  mqttClient = mqtt.connect(url, {
    clientId,
    username: TTN_MQTT_USERNAME,
    password: TTN_MQTT_PASSWORD,
    reconnectPeriod: 5000,
  });

  mqttClient.on("connect", () => {
    logger.info("Connected to TTN MQTT broker");
    logger.info(`MQTT topic: ${TTN_MQTT_TOPIC}`);

    mqttClient.subscribe(TTN_MQTT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to TTN MQTT topic "${TTN_MQTT_TOPIC}": ${err.message}`);
      } else {
        logger.info(`Subscribed to TTN MQTT topic: ${TTN_MQTT_TOPIC}`);
      }
    });
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.simulated) {
        logger.info(`MQTT message received on topic: ${topic} | dev_eui: ${payload.end_device_ids?.dev_eui || "unknown"} | simulated=true - skipping to avoid duplicate test records`);
        return;
      }
      const devEuiFromPayload = payload.end_device_ids?.dev_eui || payload.uplink_message?.ids?.dev_eui;
      logger.info(`MQTT message received on topic: ${topic} | dev_eui: ${devEuiFromPayload || "unknown"}`);
      logger.info(`TTN RAW PAYLOAD: ${JSON.stringify(payload, null, 2)}`);

      const result = await processFeedback(payload);

      if (result.success && io) {
        io.emit("new-feedback", result.data);
        if (result.alert) {
          io.emit("new-alert", result.alert);
        }
      } else if (!result.success) {
        logger.warn(`MQTT message processing failed: ${result.error || "unknown error"}`);
      }
    } catch (error) {
      logger.error("Error processing MQTT message:", error);
    }
  });

  mqttClient.on("error", (error) => {
    logger.error("MQTT error:", error);
  });

  mqttClient.on("offline", () => {
    logger.warn("MQTT client went offline");
  });

  mqttClient.on("reconnect", () => {
    logger.info("MQTT client reconnecting...");
  });

  return mqttClient;
}

function disconnectMQTT() {
  if (mqttClient) {
    mqttClient.end();
    mqttClient = null;
    logger.info("MQTT client disconnected");
  }
}

function getMQTTClient() {
  return mqttClient;
}

async function processFeedback(payload) {
  try {
    const decoded = decodePayload(payload);

    if (!decoded) {
      logger.warn("Could not decode TTN payload:", payload);
      return { success: false, error: "Invalid payload" };
    }

    const { deviceEui, badgeId, feedbackType, battery, signalStrength, gatewayEui, beacons, rawPayload } = decoded;

    const device = await prisma.device.findUnique({
      where: { deviceEui },
      include: { restroom: { include: { floor: true } } },
    });

    if (!device) {
      logger.warn(`Device not found for EUI: ${deviceEui}`);
      return { success: false, error: "Device not found" };
    }

    await prisma.device.update({
      where: { id: device.id },
      data: {
        batteryLevel: battery ?? device.batteryLevel,
        lastSeen: new Date(),
        healthStatus: (battery ?? 100) < 20 ? "critical" : (battery ?? 100) < 50 ? "warning" : "healthy",
      },
    });

    await prisma.deviceHealthRecord.create({
      data: {
        deviceId: device.id,
        battery: battery ?? 0,
        signal: signalStrength ?? 0,
        online: true,
      },
    });

    // Update gateway lastSeen when rx_metadata carries a known gateway EUI
    if (gatewayEui) {
      try {
        const normalizedGwEui = gatewayEui.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
        const gw = await prisma.gateway.findFirst({ where: { gatewayEui: normalizedGwEui } });
        if (gw) {
          await prisma.gateway.update({
            where: { id: gw.id },
            data: { lastSeen: new Date(), status: "online" },
          });
          logger.info(`[MQTT] Gateway ${gw.name} (${normalizedGwEui}) lastSeen updated`);
        }
      } catch (gwErr) {
        logger.warn(`[MQTT] Gateway lastSeen update failed: ${gwErr.message}`);
      }
    }

    let feedback = null;
    let alert = null;
    try {
      feedback = await prisma.feedback.create({
        data: {
          device: { connect: { id: device.id } },
          ...(device.restroomId ? { restroom: { connect: { id: device.restroomId } } } : {}),
          feedbackType,
          battery,
          signalStrength,
          rawPayload: JSON.stringify({ ...rawPayload, _parsed: { beacons, gatewayEui } }),
        },
        include: {
          device: true,
          restroom: true,
        },
      });

      alert = await createAlertForFeedback(feedback, device);
    } catch (e) {
      logger.warn(`Feedback record creation skipped: ${e.message}`);
    }

    return {
      success: true,
      data: {
        id: feedback?.id || `${device.id}-${Date.now()}`,
        deviceId: device.id,
        feedbackId: feedback?.id,
        restroomId: device.restroomId,
        feedbackType,
        battery: battery ?? null,
        signalStrength: signalStrength ?? null,
        timestamp: feedback?.timestamp || new Date(),
        restroomName: device.restroom?.name || '—',
        locationId: device.restroom?.floor?.locationId || null,
        badgeId: device.badgeId,
        deviceStatus: device.healthStatus,
      },
      alert: alert ? {
        id: alert.id,
        feedbackId: alert.feedbackId,
        restroomId: alert.restroomId,
        status: alert.status,
        priority: alert.priority,
      } : null,
    };
  } catch (error) {
    logger.error("Error processing feedback:", error);
    return { success: false, error: error.message };
  }
}

function decodePayload(payload) {
  try {
    // ── Normalise envelope ─────────────────────────────────────────────────
    // Shape A: TTN webhook/event format  → { name, data: { end_device_ids, uplink_message } }
    // Shape B: TTN MQTT format           → { end_device_ids, uplink_message }
    // Shape C: bare decoded map          → { feedback_type, battery, … }
    const envelope = payload.data ?? payload;
    const uplinkMessage = envelope.uplink_message ?? null;

    // ── Device EUI ─────────────────────────────────────────────────────────
    const envelopeDeviceEui =
      envelope.end_device_ids?.dev_eui ||
      payload.identifiers?.[0]?.device_ids?.dev_eui ||
      payload.end_device_ids?.dev_eui ||
      uplinkMessage?.ids?.dev_eui;

    const decodedApp = uplinkMessage?.decoded_payload ?? payload.decoded_payload ?? payload;

    const deviceEui = (
      decodedApp.device_eui || decodedApp.deviceEui || decodedApp.deveui || decodedApp.devEUI ||
      envelopeDeviceEui || ""
    ).replace(/[^a-fA-F0-9]/g, "").toUpperCase();

    if (!deviceEui) {
      logger.warn("Could not extract DevEUI from TTN payload. Top-level keys:", Object.keys(payload));
      return null;
    }

    // ── Badge ID ───────────────────────────────────────────────────────────
    const badgeId = decodedApp.badge_id || decodedApp.badgeId || decodedApp.badge || null;

    // ── Feedback type ──────────────────────────────────────────────────────
    const rawType = decodedApp.feedback_type || decodedApp.feedbackType || decodedApp.type || "average";
    const validTypes = ["happy", "average", "needs_cleaning", "emergency"];
    const feedbackType = validTypes.includes(rawType) ? rawType : "average";

    // ── Battery ────────────────────────────────────────────────────────────
    // T1000/Seeed devices report BatteryPercentage (capital B) in decoded_payload
    const battery =
      decodedApp.BatteryPercentage ??
      decodedApp.battery_percentage ??
      decodedApp.battery ??
      decodedApp.battery_level ??
      null;

    // ── Signal strength ────────────────────────────────────────────────────
    // Prefer real LoRaWAN RSSI from rx_metadata over any app-level field
    const rxMeta = uplinkMessage?.rx_metadata?.[0];
    const signalStrength =
      rxMeta?.rssi ??
      rxMeta?.channel_rssi ??
      decodedApp.signal_strength ??
      decodedApp.rssi ??
      decodedApp.signalStrength ??
      null;

    // ── Gateway EUI from rx_metadata ──────────────────────────────────────
    const gatewayEui = rxMeta?.gateway_ids?.eui ?? null;

    // ── Beacon data (T1000 BLE scan) ──────────────────────────────────────
    const beacons = [];
    const beaconCount = decodedApp.BeaconCount ?? 0;
    for (let i = 1; i <= beaconCount; i++) {
      const mac  = decodedApp[`BeaconID${i}`] ?? null;
      const rssi = decodedApp[`Beacon${i}_BleRSSI`] ?? decodedApp[`Beacon${i}_RSSI`] ?? null;
      if (mac) beacons.push({ mac, rssi });
    }
    // Also parse nested decoded.messages BLE Scan entries (Seeed codec format)
    const codecMessages = decodedApp.decoded?.messages ?? [];
    for (const msgGroup of codecMessages) {
      for (const msg of (Array.isArray(msgGroup) ? msgGroup : [msgGroup])) {
        if (msg.type === "BLE Scan" && Array.isArray(msg.measurementValue)) {
          for (const entry of msg.measurementValue) {
            if (entry.mac && !beacons.find((b) => b.mac === entry.mac)) {
              beacons.push({ mac: entry.mac, rssi: Number(entry.rssi) || null });
            }
          }
        }
      }
    }

    logger.info(
      `[decodePayload] EUI=${deviceEui} | type=${feedbackType} | battery=${battery ?? "?"}% | ` +
      `rssi=${signalStrength} | gateway=${gatewayEui ?? "unknown"} | beacons=${beacons.length}`
    );

    return {
      deviceEui,
      badgeId,
      feedbackType,
      battery,
      signalStrength,
      gatewayEui,
      beacons: beacons.length ? beacons : null,
      rawPayload: payload,
    };
  } catch (error) {
    logger.error("Error decoding payload:", error);
    return null;
  }
}

async function createAlertForFeedback(feedback, device) {
  try {
    if (!device.restroomId) {
      return null;
    }

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentNeedsCleaning = await prisma.feedback.count({
      where: {
        restroomId: feedback.restroomId,
        feedbackType: "needs_cleaning",
        timestamp: { gte: oneHourAgo },
      },
    });

    let priority = "low";

    if (feedback.feedbackType === "emergency") {
      priority = "critical";
    } else if (feedback.feedbackType === "needs_cleaning" && recentNeedsCleaning >= 3) {
      priority = "high";
    } else if (feedback.feedbackType === "needs_cleaning") {
      priority = "medium";
    }

    const shouldCreateAlert = feedback.feedbackType === "emergency" || feedback.feedbackType === "needs_cleaning";

    if (!shouldCreateAlert) {
      return null;
    }

    const alert = await prisma.alert.create({
      data: {
        feedbackId: feedback.id,
        restroomId: feedback.restroomId,
        priority,
        status: "open",
      },
      include: {
        feedback: true,
        restroom: true,
      },
    });

    // The same immediate-notification policy is used for device and API feedback.
    if (feedback.feedbackType === "emergency" || feedback.feedbackType === "needs_cleaning") {
      try {
        await notifyTeamsForAlert({ alert, feedback, restroom: feedback.restroom });
      } catch (notificationError) {
        // A delivery problem must never discard the newly created alert.
        logger.error("Teams notification error:", notificationError);
      }
    }

    logger.info(`Alert created: ${alert.id} for restroom ${feedback.restroom.name} with priority ${priority}`);
    return alert;
  } catch (error) {
    logger.error("Error creating alert:", error);
    return null;
  }
}

module.exports = {
  connectMQTT,
  disconnectMQTT,
  getMQTTClient,
  processFeedback,
  decodePayload,
};
