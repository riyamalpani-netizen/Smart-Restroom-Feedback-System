const prisma = require("../config/database");
const { getIO } = require("../utils/socket");
const { sendTeamsWebhook } = require("../services/teamsWebhookService");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function createAlertForFeedback(feedback, device) {
  try {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentNeedsCleaning = await prisma.feedback.count({
      where: {
        restroomId: feedback.restroomId,
        feedbackType: "needs_cleaning",
        timestamp: { gte: oneHourAgo },
      },
    });

    const recentEmergencies = await prisma.feedback.count({
      where: {
        restroomId: feedback.restroomId,
        feedbackType: "emergency",
        timestamp: { gte: oneHourAgo },
      },
    });

    let priority = "low";

    if (feedback.feedbackType === "emergency" || recentEmergencies > 0) {
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

    await prisma.notification.create({
      data: {
        alertId: alert.id,
        type: "teams",
        recipient: "",
        status: "pending",
      },
    });

    const settings = await prisma.settings.findFirst();
    if (settings?.teamsWebhook) {
      sendTeamsWebhook(settings.teamsWebhook, {
        restroom: feedback.restroom.name,
        feedbackType: feedback.feedbackType,
        priority: alert.priority,
        battery: feedback.battery,
        timestamp: feedback.timestamp,
        alertId: alert.id,
      });
    }

    return alert;
  } catch (error) {
    console.error("Error creating alert:", error);
    return null;
  }
}

async function getFeedback(req, res) {
  try {
    const { restroomId, deviceId, feedbackType, startDate, endDate, page = 1, limit = 20, locationId } = req.query;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    const where = {};

    if (role !== "super_admin") {
      where.restroom = { organizationId: orgId };
    }

    if (restroomId) where.restroomId = restroomId;
    if (deviceId) where.deviceId = deviceId;
    if (feedbackType) where.feedbackType = feedbackType;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (locationId) {
      const locationFloors = await prisma.floor.findMany({
        where: { locationId },
        select: { id: true },
      });
      const locationRestrooms = await prisma.restroom.findMany({
        where: { floorId: { in: locationFloors.map((f) => f.id) } },
        select: { id: true },
      });
      where.restroomId = { in: locationRestrooms.map((r) => r.id) };
    }

    const { floorId, zoneId } = req.query;

    if (floorId) {
      const floorRestrooms = await prisma.restroom.findMany({
        where: { floorId },
        select: { id: true },
      });
      const floorRestroomIds = floorRestrooms.map((r) => r.id);
      // Intersect with any existing restroomId filter
      if (where.restroomId?.in) {
        const existing = new Set(where.restroomId.in);
        where.restroomId = { in: floorRestroomIds.filter((id) => existing.has(id)) };
      } else if (!where.restroomId) {
        where.restroomId = { in: floorRestroomIds };
      }
    }

    if (zoneId) {
      // A zone has devices assigned to it — filter by those devices
      const zoneDevices = await prisma.device.findMany({
        where: { zoneId },
        select: { id: true },
      });
      const zoneDeviceIds = zoneDevices.map((d) => d.id);
      if (where.deviceId) {
        // keep existing single-device filter only if it belongs to the zone
        if (!zoneDeviceIds.includes(where.deviceId)) {
          where.deviceId = { in: [] }; // effectively no results
        }
      } else {
        where.deviceId = { in: zoneDeviceIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbackEntries, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          device: true,
          restroom: { include: { floor: { include: { location: true } } } },
          alert: true,
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.feedback.count({ where }),
    ]);

    res.status(200).json({
      message: "Feedback fetched successfully",
      feedback: feedbackEntries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getFeedbackById(req, res) {
  try {
    const { id } = req.params;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;

    const where = { id };
    if (role !== "super_admin") {
      where.restroom = { organizationId: orgId };
    }

    const feedback = await prisma.feedback.findFirst({
      where,
      include: {
        device: true,
        restroom: { include: { floor: { include: { location: true } } } },
        alert: { include: { notifications: true } },
      },
    });

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.status(200).json({ message: "Feedback fetched successfully", feedback });
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createFeedback(req, res) {
  try {
    const { deviceId, restroomId, feedbackType, battery, signalStrength } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!deviceId || !restroomId || !feedbackType) {
      return res.status(400).json({ message: "Device ID, restroom ID, and feedback type are required" });
    }

    const validTypes = ["happy", "average", "needs_cleaning", "emergency"];
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ message: "Invalid feedback type" });
    }

    const restroom = await prisma.restroom.findUnique({
      where: { id: restroomId },
      include: { floor: true },
    });
    if (!restroom) {
      return res.status(404).json({ message: "Restroom not found" });
    }

    if (userRole === "vendor_admin" && restroom.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create feedback for restrooms in your organization" });
    }

    const feedback = await prisma.feedback.create({
      data: { deviceId, restroomId, feedbackType, battery, signalStrength },
      include: { device: true, restroom: { include: { floor: true } } },
    });

    await prisma.device.update({
      where: { id: deviceId },
      data: {
        batteryLevel: battery ?? feedback.device.batteryLevel,
        lastSeen: new Date(),
        healthStatus: (battery ?? 100) < 20 ? "critical" : battery < 50 ? "warning" : "healthy",
      },
    });

    await prisma.deviceHealthRecord.create({
      data: {
        deviceId,
        battery: battery ?? 0,
        signal: signalStrength ?? 0,
        online: true,
      },
    });

    const alert = await createAlertForFeedback(feedback, feedback.device);

    const io = getIO();
    if (io) {
      io.emit("new-feedback", {
        id: feedback.id,
        deviceId: feedback.deviceId,
        restroomId: feedback.restroomId,
        feedbackType: feedback.feedbackType,
        timestamp: feedback.timestamp,
        battery: feedback.battery,
        signalStrength: feedback.signalStrength,
        restroomName: feedback.restroom.name,
        locationId: feedback.restroom.floor?.locationId || null,
        badgeId: feedback.device.badgeId,
        deviceStatus: feedback.device.healthStatus,
      });

      if (alert) {
        io.emit("new-alert", {
          id: alert.id,
          feedbackId: alert.feedbackId,
          restroomId: alert.restroomId,
          status: alert.status,
          priority: alert.priority,
        });
      }
    }

    res.status(201).json({ message: "Feedback created successfully", feedback });
  } catch (error) {
    console.error("Create feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteFeedback(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.feedback.findFirst({
      where: { id, restroom: { ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    await prisma.feedback.delete({ where: { id } });

    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Delete feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getFeedback,
  getFeedbackById,
  createFeedback,
  deleteFeedback,
};
