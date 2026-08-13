const prisma = require("../config/database");
const { registerOtaaDevice } = require("../services/ttnDeviceRegistryService");
const crypto = require("crypto");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getDevices(req, res) {
  try {
    const { restroomId, healthStatus, floorId, zoneId, status } = req.query;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    const where = {};

    if (role !== "super_admin") {
      where.OR = [
        { restroom: { organizationId: orgId } },
        { restroomId: null },
      ];
    }

    if (restroomId) where.restroomId = restroomId;
    if (healthStatus) where.healthStatus = healthStatus;
    if (floorId) where.floorId = floorId;
    if (zoneId) where.zoneId = zoneId;

    if (status === "online") {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      where.healthStatus = "healthy";
      where.lastSeen = { gt: fiveMinutesAgo };
    } else if (status === "offline") {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      where.OR = [
        ...(where.OR || []),
        { lastSeen: { lte: fiveMinutesAgo } },
        { healthStatus: { not: "healthy" } },
      ];
    }

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

    const mapped = devices.map((device) => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
      const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

      return {
        id: device.id,
        name: device.name,
        badgeId: device.badgeId,
        deviceEui: device.deviceEui,
        restroomId: device.restroomId,
        restroomName: device.restroom?.name || "Unassigned",
        floorName: device.floor?.floorName || device.restroom?.floor?.floorName || null,
        locationName: device.floor?.location?.officeName || device.restroom?.floor?.location?.officeName || null,
        battery: device.batteryLevel ?? null,
        status: isOnline ? "online" : "offline",
        health: device.healthStatus || "healthy",
        lastCommunication: device.lastSeen,
        deviceType: device.deviceType,
        zoneId: device.zoneId,
        zoneName: device.zone?.name || null,
        joinEui: device.joinEui || null,
        appKey: device.appKey || null,
        lorawanVersion: device.lorawanVersion || null,
        lorawanPhyVersion: device.lorawanPhyVersion || null,
      };
    });

    res.status(200).json({
      message: "Devices fetched successfully",
      devices: mapped,
    });
  } catch (error) {
    console.error("Get devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getDeviceById(req, res) {
  try {
    const { id } = req.params;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;

    const whereClause = { id };
    if (role !== "super_admin") {
      whereClause.OR = [
        { restroom: { organizationId: orgId } },
        { restroomId: null },
      ];
    }

    const device = await prisma.device.findFirst({
      where: whereClause,
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

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
    const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

    const mapped = {
      id: device.id,
      name: device.name,
      badgeId: device.badgeId,
      deviceEui: device.deviceEui,
      restroomId: device.restroomId,
      restroomName: device.restroom?.name || "Unassigned",
      floorName: device.floor?.floorName || device.restroom?.floor?.floorName || null,
      locationName: device.floor?.location?.officeName || device.restroom?.floor?.location?.officeName || null,
      battery: device.batteryLevel ?? null,
      status: isOnline ? "online" : "offline",
      health: device.healthStatus || "healthy",
      lastCommunication: device.lastSeen,
      deviceType: device.deviceType,
      zoneId: device.zoneId,
      zoneName: device.zone?.name || null,
      joinEui: device.joinEui || null,
      appKey: device.appKey || null,
      lorawanVersion: device.lorawanVersion || null,
      lorawanPhyVersion: device.lorawanPhyVersion || null,
      feedback: device.feedback,
      healthRecords: device.deviceHealth,
    };

    res.status(200).json({ message: "Device fetched successfully", device: mapped });
  } catch (error) {
    console.error("Get device error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createDevice(req, res) {
  try {
    let { name, deviceType, restroomId, batteryLevel, floorId, zoneId, floorPlanPosX, floorPlanPosY, ttnDeviceId, joinEui, appKey, lorawanVersion, lorawanPhyVersion, isLayoutAsset = false } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const generatedDeviceEui = crypto.randomBytes(8).toString("hex").toUpperCase();
    const generatedBadgeId = name ? `BADGE-${name.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase()}` : `BADGE-${generatedDeviceEui.slice(0, 8)}`;
    const resolvedDeviceEui = generatedDeviceEui;
    const resolvedBadgeId = generatedBadgeId;
    const resolvedJoinEui = joinEui || "0000000000000000";
    const resolvedAppKey = appKey || crypto.randomBytes(16).toString("hex");
    const resolvedLorawanVersion = lorawanVersion || "MAC_V1_0_3";

    const existingDevice = await prisma.device.findFirst({
      where: { OR: [{ deviceEui: resolvedDeviceEui }, { badgeId: resolvedBadgeId }] },
      select: { id: true },
    });

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

    let ttnRegistration = null;
    if (!isLayoutAsset) {
      try {
        const resolvedTtnDeviceId = `device-${resolvedDeviceEui.toLowerCase()}`;
        const ttnPayload = {
          deviceEui: resolvedDeviceEui,
          deviceId: resolvedTtnDeviceId,
          joinEui: resolvedJoinEui,
          appKey: resolvedAppKey,
          lorawanVersion: resolvedLorawanVersion,
        };

        if (lorawanPhyVersion) {
          ttnPayload.lorawanPhyVersion = lorawanPhyVersion;
        }

        ttnRegistration = await registerOtaaDevice(ttnPayload);

        joinEui = resolvedJoinEui;
        appKey = resolvedAppKey;
        ttnDeviceId = resolvedTtnDeviceId;
        lorawanVersion = resolvedLorawanVersion;
        lorawanPhyVersion = lorawanPhyVersion || null;
      } catch (error) {
        return res.status(502).json({ message: error.message });
      }
    }

    const deviceData = {
      name: name || null,
      deviceEui: resolvedDeviceEui,
      badgeId: resolvedBadgeId,
      restroomId: finalRestroomId || null,
      floorId: floorId || null,
      zoneId: zoneId || null,
      deviceType: deviceType || "sensor",
      batteryLevel: batteryLevel ?? 100,
      floorPlanPosX: floorPlanPosX ?? null,
      floorPlanPosY: floorPlanPosY ?? null,
      joinEui: resolvedJoinEui,
      appKey: resolvedAppKey,
      lorawanVersion: lorawanVersion || null,
      lorawanPhyVersion: lorawanPhyVersion || null,
      healthStatus: "healthy",
    };

    let device;
    if (existingDevice) {
      device = await prisma.device.update({
        where: { id: existingDevice.id },
        data: deviceData,
      });
    } else {
      device = await prisma.device.create({
        data: deviceData,
      });
    }

    res.status(existingDevice ? 200 : 201).json({
      message: existingDevice
        ? "Device identity already existed; inventory record updated"
        : isLayoutAsset
        ? "Layout device placed successfully"
        : "Device registered in TTN and added to inventory successfully",
      device,
      ttnRegistration,
    });
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
    const { badgeId, restroomId, batteryLevel, healthStatus, floorPlanPosX, floorPlanPosY, floorId, zoneId, deviceType, joinEui, appKey } = req.body;
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
    if (joinEui !== undefined) updateData.joinEui = joinEui || null
    if (appKey !== undefined) updateData.appKey = appKey || null

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
    const role = req.user?.role;
    const orgId = req.user?.organizationId;

    const whereClause = { id: deviceId };
    if (role !== "super_admin") {
      whereClause.OR = [
        { restroom: { organizationId: orgId } },
        { restroomId: null },
      ];
    }

    const device = await prisma.device.findFirst({
      where: whereClause,
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
    const role = req.user?.role;
    const orgId = req.user?.organizationId;

    const where = {
      OR: [
        { lastSeen: { lt: fiveMinutesAgo } },
        { healthStatus: { not: "healthy" } },
      ],
    };

    if (role !== "super_admin") {
      where.OR = [
        { restroom: { organizationId: orgId } },
        { restroomId: null },
      ];
    }

    const offlineDevices = await prisma.device.findMany({
      where,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
      },
      orderBy: { lastSeen: "asc" },
    });

    const mapped = offlineDevices.map((device) => {
      const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
      const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

      return {
        id: device.id,
        badgeId: device.badgeId,
        deviceEui: device.deviceEui,
        restroomId: device.restroomId,
        restroomName: device.restroom?.name || "Unassigned",
        floorName: device.restroom?.floor?.floorName || null,
        locationName: device.restroom?.floor?.location?.officeName || null,
        battery: device.batteryLevel ?? null,
        status: isOnline ? "online" : "offline",
        health: device.healthStatus || "healthy",
        lastCommunication: device.lastSeen,
        deviceType: device.deviceType,
        zoneId: device.zoneId,
        zoneName: device.zone?.name || null,
      };
    });

    res.status(200).json({
      message: "Offline devices fetched successfully",
      devices: mapped,
      count: mapped.length,
    });
  } catch (error) {
    console.error("Get offline devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function registerDeviceInTTN(req, res) {
  try {
    const { id } = req.params;
    const { ttnDeviceId, joinEui, appKey } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const whereClause = { id };
    if (userRole !== "super_admin") {
      whereClause.OR = [
        { restroom: { organizationId: userOrgId } },
        { restroomId: null }
      ];
    }

    const existing = await prisma.device.findFirst({
      where: whereClause,
      include: { restroom: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (!appKey) {
      return res.status(400).json({ message: "App Key is required" });
    }

    let ttnRegistration = null;
    try {
      ttnRegistration = await registerOtaaDevice({
        deviceEui: existing.deviceEui,
        deviceId: ttnDeviceId || existing.deviceEui,
        joinEui: joinEui || "0000000000000000",
        appKey,
      });
    } catch (error) {
      return res.status(502).json({ message: `TTN registration failed: ${error.message}` });
    }

    const device = await prisma.device.update({
      where: { id },
      data: {
        joinEui: joinEui || existing.joinEui || "0000000000000000",
        appKey,
      },
    });

    res.status(200).json({
      message: "Device registered in TTN successfully",
      device,
      ttnRegistration,
    });
  } catch (error) {
    console.error("Register device in TTN error:", error);
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
  registerDeviceInTTN,
};
