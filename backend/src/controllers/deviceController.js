const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getDevices(req, res) {
  try {
    const { restroomId, healthStatus, floorId, zoneId } = req.query;
    const orgFilter = getOrgFilter(req);
    const where = { ...orgFilter };
    if (restroomId) where.restroomId = restroomId;
    if (healthStatus) where.healthStatus = healthStatus;
    if (floorId) where.floorId = floorId;
    if (zoneId) where.zoneId = zoneId;

    const devices = await prisma.device.findMany({
      where,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        floor: { include: { location: true } },
        zone: true,
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
    const orgFilter = getOrgFilter(req);

    const device = await prisma.device.findFirst({
      where: { id, ...orgFilter },
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        floor: { include: { location: true } },
        zone: true,
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
    const { deviceEui, badgeId, restroomId, batteryLevel, floorId, zoneId, deviceType, floorPlanPosX, floorPlanPosY } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!deviceEui || !badgeId) {
      return res.status(400).json({ message: "Device EUI and badge ID are required" });
    }

    let finalRestroomId = restroomId;
    let organizationId = null;

    if (finalRestroomId) {
      const restroom = await prisma.restroom.findUnique({ where: { id: finalRestroomId } });
      if (!restroom) {
        return res.status(404).json({ message: "Restroom not found" });
      }
      if (userRole === "vendor_admin" && restroom.organizationId !== userOrgId) {
        return res.status(403).json({ message: "You can only create devices for restrooms in your organization" });
      }
      organizationId = restroom.organizationId;
    }

    if (zoneId) {
      const zone = await prisma.zone.findFirst({
        where: { id: zoneId },
        include: { floor: { include: { location: true } } },
      });
      if (!zone) {
        return res.status(404).json({ message: "Zone not found" });
      }
      if (userRole === "vendor_admin" && zone.floor.location.organizationId !== userOrgId) {
        return res.status(403).json({ message: "You can only create devices for zones in your organization" });
      }
      organizationId = organizationId || zone.floor.location.organizationId;
    }

    const device = await prisma.device.create({
      data: {
        deviceEui,
        badgeId,
        restroomId: finalRestroomId || null,
        floorId: floorId || null,
        zoneId: zoneId || null,
        deviceType: deviceType || "sensor",
        batteryLevel: batteryLevel ?? 100,
        floorPlanPosX: floorPlanPosX ?? null,
        floorPlanPosY: floorPlanPosY ?? null,
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
    const { badgeId, restroomId, batteryLevel, healthStatus, floorPlanPosX, floorPlanPosY, floorId, zoneId, deviceType } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const whereClause = { id }
    if (userRole !== "super_admin") {
      whereClause.OR = [
        { restroom: { organizationId: userOrgId } },
        { restroomId: null }
      ]
    }

    const existing = await prisma.device.findFirst({
      where: whereClause,
      include: { restroom: true, floor: { include: { location: true } }, zone: { include: { floor: { include: { location: true } } } } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (userRole === "vendor_admin" && restroomId) {
      const newRestroom = await prisma.restroom.findUnique({ where: { id: restroomId } });
      if (!newRestroom || newRestroom.organizationId !== userOrgId) {
        return res.status(403).json({ message: "You can only assign devices to restrooms in your organization" });
      }
    }

    if (userRole === "vendor_admin" && zoneId) {
      const newZone = await prisma.zone.findFirst({
        where: { id: zoneId },
        include: { floor: { include: { location: true } } },
      });
      if (!newZone || newZone.floor.location.organizationId !== userOrgId) {
        return res.status(403).json({ message: "You can only assign devices to zones in your organization" });
      }
    }

    const updateData = {}
    if (badgeId !== undefined) updateData.badgeId = badgeId
    if (restroomId !== undefined) updateData.restroomId = restroomId
    if (batteryLevel !== undefined) updateData.batteryLevel = batteryLevel
    if (healthStatus !== undefined) updateData.healthStatus = healthStatus
    if (floorPlanPosX !== undefined) updateData.floorPlanPosX = floorPlanPosX
    if (floorPlanPosY !== undefined) updateData.floorPlanPosY = floorPlanPosY
    if (floorId !== undefined) updateData.floorId = floorId
    if (zoneId !== undefined) updateData.zoneId = zoneId || null
    if (deviceType !== undefined) updateData.deviceType = deviceType

    const device = await prisma.device.update({
      where: { id },
      data: updateData,
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
    const orgFilter = getOrgFilter(req);

    const device = await prisma.device.findFirst({
      where: { id: deviceId, ...orgFilter },
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
    const orgFilter = getOrgFilter(req);

    const offlineDevices = await prisma.device.findMany({
      where: {
        ...orgFilter,
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
