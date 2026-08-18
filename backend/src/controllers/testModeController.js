const prisma = require("../config/database");
const { processFeedback, decodePayload } = require("../services/mqttService");
const { emitToClients } = require("../utils/socket");
const { simulateUplink: simulateUplinkTTN } = require("../services/ttnApplicationService");

function buildTTNUplinkPayload({ deviceEui, badgeId, feedbackType, battery, signalStrength, timestamp }) {
  return {
    received_at: new Date(timestamp).toISOString(),
    end_device_ids: {
      dev_eui: deviceEui,
      join_eui: "0000000000000000",
      dev_addr: "00000000",
    },
    uplink_message: {
      ids: {
        dev_eui: deviceEui,
      },
      decoded_payload: {
        badge_id: badgeId,
        feedback_type: feedbackType,
        battery: battery ?? 100,
        signal_strength: signalStrength ?? -60,
      },
      raw_payload: Buffer.from(JSON.stringify({ badge_id: badgeId, feedback_type: feedbackType, battery: battery ?? 100, signal_strength: signalStrength ?? -60 })).toString("base64"),
    },
  };
}

async function simulateFeedback(req, res) {
  try {
    const { badgeId, gatewayId, feedbackType, deviceEui, battery, signalStrength, count = 1 } = req.body;

    if (!badgeId && !deviceEui) {
      return res.status(400).json({ message: "Badge ID or Device EUI is required" });
    }

    const validTypes = ["happy", "average", "needs_cleaning", "emergency"];
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ message: "Invalid feedback type. Must be one of: happy, average, needs_cleaning, emergency" });
    }

    if (count < 1 || count > 100) {
      return res.status(400).json({ message: "Count must be between 1 and 100" });
    }

    let device = null;

    if (deviceEui) {
      const normalizedEui = deviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      device = await prisma.device.findUnique({
        where: { deviceEui: normalizedEui },
        include: { restroom: { include: { floor: { include: { location: true } } } } },
      });
    }

    if (!device && badgeId) {
      device = await prisma.device.findFirst({
        where: { badgeId: badgeId.trim().toUpperCase() },
        include: { restroom: { include: { floor: { include: { location: true } } } } },
      });
    }

    if (!device) {
      return res.status(404).json({ message: "Device not found with provided badge ID or device EUI" });
    }

    if (gatewayId) {
      const gateway = await prisma.gateway.findUnique({ where: { id: gatewayId } });
      if (!gateway) {
        return res.status(404).json({ message: "Gateway not found" });
      }
      await prisma.device.update({
        where: { id: device.id },
        data: { gatewayId: gateway.id, lastSeen: new Date() },
      });
    }

    let ttnSimulated = false;
    let ttnSimulateError = null;
    try {
      await simulateUplinkTTN({
        deviceEui: device.deviceEui,
        feedbackType,
        battery: battery ?? device.batteryLevel ?? 100,
        signalStrength: signalStrength ?? -60,
      });
      ttnSimulated = true;
      console.log(`[TestMode] TTN simulate uplink triggered for ${device.badgeId} (${device.deviceEui})`);
    } catch (ttnError) {
      ttnSimulateError = ttnError.message;
      console.warn(`[TestMode] TTN simulate failed, falling back to local simulation:`, ttnError.message);
    }

    const results = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(now.getTime() + i * 1000);
      const uplink = buildTTNUplinkPayload({
        deviceEui: device.deviceEui,
        badgeId: device.badgeId,
        feedbackType,
        battery: battery ?? device.batteryLevel ?? 100,
        signalStrength: signalStrength ?? -60,
        timestamp,
      });

      const result = await processFeedback(uplink);

      if (!result.success) {
        console.error(`Test mode processFeedback failed for ${device.badgeId}:`, result.error);
        continue;
      }

      const feedbackId = result.data.feedbackId;
      if (feedbackId) {
        await prisma.feedback.update({
          where: { id: feedbackId },
          data: {
            rawPayload: JSON.stringify({
              _testMode: true,
              simulatedAt: timestamp.toISOString(),
              badgeId: device.badgeId,
              deviceEui: device.deviceEui,
              feedbackType,
              battery: battery ?? device.batteryLevel ?? 100,
              signalStrength: signalStrength ?? -60,
            }),
          },
        });
      }

      try {
        emitToClients("new-feedback", { ...result.data, _testMode: true });
      } catch (emitError) {
        console.error("TestMode emit new-feedback error:", emitError);
      }

      if (result.alert) {
        try {
          emitToClients("new-alert", result.alert);
        } catch (emitError) {
          console.error("TestMode emit new-alert error:", emitError);
        }
      }

      results.push({
        id: feedbackId,
        deviceId: device.id,
        badgeId: device.badgeId,
        deviceEui: device.deviceEui,
        restroomId: result.data.restroomId,
        restroomName: result.data.restroomName || "Unassigned",
        feedbackType,
        timestamp: result.data.timestamp,
        battery: result.data.battery,
        signalStrength: result.data.signalStrength,
        testMode: true,
        alert: result.alert ? { id: result.alert.id, priority: result.alert.priority, status: result.alert.status } : null,
      });
    }

    res.status(201).json({
      message: ttnSimulated
        ? `Test feedback simulated in TTN and locally for ${count} event(s). Check TTN Console Live Data and the Live Feedback page.`
        : `Test feedback simulated successfully for ${count} event(s)`,
      testMode: true,
      ttnSimulated,
      ttnError: ttnSimulateError,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Simulate test feedback error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message, stack: error.stack });
  }
}

async function getTestEvents(req, res) {
  try {
    const { badgeId, deviceEui, limit = 50 } = req.query;

    let deviceWhere = {};

    if (deviceEui) {
      const normalizedEui = deviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      deviceWhere.deviceEui = normalizedEui;
    } else if (badgeId) {
      deviceWhere.badgeId = badgeId.trim().toUpperCase();
    }

    const device = await prisma.device.findFirst({
      where: deviceWhere,
      select: { id: true },
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    const testEvents = await prisma.feedback.findMany({
      where: {
        deviceId: device.id,
        rawPayload: { contains: "_testMode" },
      },
      orderBy: { timestamp: "desc" },
      take: parseInt(limit),
      include: {
        device: { select: { id: true, badgeId: true, deviceEui: true, name: true } },
        restroom: { select: { id: true, name: true } },
        alert: true,
      },
    });

    const mapped = testEvents.map((e) => {
      let payload = {};
      try {
        payload = JSON.parse(e.rawPayload || "{}");
      } catch {
        payload = {};
      }
      return {
        id: e.id,
        deviceId: e.deviceId,
        badgeId: e.device?.badgeId,
        deviceEui: e.device?.deviceEui,
        restroomName: e.restroom?.name || "Unassigned",
        feedbackType: e.feedbackType,
        timestamp: e.timestamp,
        battery: e.battery,
        signalStrength: e.signalStrength,
        testMode: true,
        simulatedAt: payload.simulatedAt || null,
        alertId: e.alert?.id || null,
      };
    });

    res.status(200).json({
      message: "Test events fetched successfully",
      testMode: true,
      events: mapped,
      count: mapped.length,
    });
  } catch (error) {
    console.error("Get test events error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function clearTestEvents(req, res) {
  try {
    const { badgeId, deviceEui, olderThanDays } = req.body;

    if (!badgeId && !deviceEui) {
      return res.status(400).json({ message: "Badge ID or Device EUI is required" });
    }

    let deviceWhere = {};
    if (deviceEui) {
      const normalizedEui = deviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      deviceWhere.deviceEui = normalizedEui;
    } else if (badgeId) {
      deviceWhere.badgeId = badgeId.trim().toUpperCase();
    }

    const device = await prisma.device.findFirst({
      where: deviceWhere,
      select: { id: true },
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    const where = {
      deviceId: device.id,
      rawPayload: { contains: "_testMode" },
    };

    if (olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));
      where.timestamp = { lt: cutoffDate };
    }

    const result = await prisma.feedback.deleteMany({ where });

    res.status(200).json({
      message: `Cleared ${result.count} test event(s) successfully`,
      testMode: true,
      clearedCount: result.count,
    });
  } catch (error) {
    console.error("Clear test events error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  simulateFeedback,
  getTestEvents,
  clearTestEvents,
};
