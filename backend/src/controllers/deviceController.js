const prisma = require("../config/database");

async function getDevices(req, res) {
  try {
    const { restroomId, healthStatus } = req.query;
    const where = {};
    if (restroomId) where.restroomId = restroomId;
    if (healthStatus) where.healthStatus = healthStatus;

    const devices = await prisma.device.findMany({
      where,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        deviceHealth: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Devices fetched successfully",
      devices,
    });
  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getDeviceById(req, res) {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        feedback: { orderBy: { timestamp: "desc" }, take: 20 },
        deviceHealth: { orderBy: { recordedAt: "desc" }, take: 10 },
      },
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.status(200).json({ message: "Device fetched successfully", device });
  } catch (error) {
    console.error("Get device error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createDevice(req, res) {
  try {
    const { deviceEui, badgeId, restroomId, batteryLevel } = req.body;

    if (!deviceEui || !badgeId || !restroomId) {
      return res.status(400).json({ message: "Device EUI, badge ID, and restroom ID are required" });
    }

    const device = await prisma.device.create({
      data: {
        deviceEui,
        badgeId,
        restroomId,
        batteryLevel: batteryLevel ?? 100,
        healthStatus: "healthy",
      },
    });

    res.status(201).json({ message: "Device created successfully", device });
  } catch (error) {
    console.error("Create device error:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Device EUI or badge ID already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateDevice(req, res) {
  try {
    const { id } = req.params;
    const { badgeId, restroomId, batteryLevel, healthStatus } = req.body;

    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Device not found" });
    }

    const device = await prisma.device.update({
      where: { id },
      data: { badgeId, restroomId, batteryLevel, healthStatus },
    });

    res.status(200).json({ message: "Device updated successfully", device });
  } catch (error) {
    console.error("Update device error:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Device EUI or badge ID already exists" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getDeviceHealth(req, res) {
  try {
    const { deviceId } = req.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        deviceHealth: { orderBy: { recordedAt: "desc" }, take: 50 },
      },
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    res.status(200).json({
      message: "Device health fetched successfully",
      device: {
        id: device.id,
        badgeId: device.badgeId,
        batteryLevel: device.batteryLevel,
        healthStatus: device.healthStatus,
        lastSeen: device.lastSeen,
        healthRecords: device.deviceHealth,
      },
    });
  } catch (error) {
    console.error("Get device health error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getOfflineDevices(req, res) {
  try {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const offlineDevices = await prisma.device.findMany({
      where: {
        OR: [
          { lastSeen: { lt: fiveMinutesAgo } },
          { healthStatus: { not: "healthy" } },
        ],
      },
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
      },
      orderBy: { lastSeen: "asc" },
    });

    res.status(200).json({
      message: "Offline devices fetched successfully",
      devices: offlineDevices,
      count: offlineDevices.length,
    });
  } catch (error) {
    console.error("Get offline devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  getDeviceHealth,
  getOfflineDevices,
};
