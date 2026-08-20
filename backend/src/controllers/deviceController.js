// const prisma = require("../config/database");
// const { registerOtaaDevice } = require("../services/ttnDeviceRegistryService");
// const { deleteDeviceFromTTN } = require("../services/ttnDeviceRegistryService");
// const crypto = require("crypto");

// function getOrgFilter(req) {
//   const role = req.user?.role;
//   const orgId = req.user?.organizationId;
//   if (role === "super_admin") return {};
//   return { organizationId: orgId };
// }

// async function getDevices(req, res) {
//   try {
//     const { restroomId, healthStatus, floorId, zoneId, status } = req.query;
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;
//     const where = {};

//     if (role !== "super_admin") {
//       where.OR = [
//         { restroom: { organizationId: orgId } },
//         { restroomId: null },
//       ];
//     }

//     if (restroomId) where.restroomId = restroomId;
//     if (healthStatus) where.healthStatus = healthStatus;
//     if (floorId) where.floorId = floorId;
//     if (zoneId) where.zoneId = zoneId;

//     if (status === "online") {
//       const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//       where.healthStatus = "healthy";
//       where.lastSeen = { gt: fiveMinutesAgo };
//     } else if (status === "offline") {
//       const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//       where.OR = [
//         ...(where.OR || []),
//         { lastSeen: { lte: fiveMinutesAgo } },
//         { healthStatus: { not: "healthy" } },
//       ];
//     }

//     const devices = await prisma.device.findMany({
//       where,
//       include: {
//         restroom: { include: { floor: { include: { location: true } } } },
//         floor: { include: { location: true } },
//         zone: true,
//         gateway: true,
//         deviceHealth: { orderBy: { recordedAt: "desc" }, take: 1 },
//       },
//       orderBy: { createdAt: "desc" },
//     });

//     const mapped = devices.map((device) => {
//       const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//       const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
//       const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

//       return {
//         id: device.id,
//         name: device.name,
//         badgeId: device.badgeId,
//         deviceEui: device.deviceEui,
//         restroomId: device.restroomId,
//         restroomName: device.restroom?.name || "Unassigned",
//         floorName: device.floor?.floorName || device.restroom?.floor?.floorName || null,
//         locationName: device.floor?.location?.officeName || device.restroom?.floor?.location?.officeName || null,
//         battery: device.batteryLevel ?? null,
//         status: isOnline ? "online" : "offline",
//         health: device.healthStatus || "healthy",
//         lastCommunication: device.lastSeen,
//         deviceType: device.deviceType,
//         floorId: device.floorId,
//         zoneId: device.zoneId,
//         zoneName: device.zone?.name || null,
//         gatewayId: device.gatewayId,
//         gatewayName: device.gateway?.name || null,
//         floorPlanPosX: device.floorPlanPosX,
//         floorPlanPosY: device.floorPlanPosY,
//         joinEui: device.joinEui || null,
//         appKey: device.appKey || null,
//         lorawanVersion: device.lorawanVersion || null,
//         lorawanPhyVersion: device.lorawanPhyVersion || null,
//       };
//     });

//     res.status(200).json({
//       message: "Devices fetched successfully",
//       devices: mapped,
//     });
//   } catch (error) {
//     console.error("Get devices error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getDeviceById(req, res) {
//   try {
//     const { id } = req.params;
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;

//     const whereClause = { id };
//     if (role !== "super_admin") {
//       whereClause.OR = [
//         { restroom: { organizationId: orgId } },
//         { restroomId: null },
//       ];
//     }

//     const device = await prisma.device.findFirst({
//       where: whereClause,
//       include: {
//         restroom: { include: { floor: { include: { location: true } } } },
//         floor: { include: { location: true } },
//         zone: true,
//         gateway: true,
//         feedback: { orderBy: { timestamp: "desc" }, take: 20 },
//         deviceHealth: { orderBy: { recordedAt: "desc" }, take: 10 },
//       },
//     });

//     if (!device) {
//       return res.status(404).json({ message: "Device not found" });
//     }

//     const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//     const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
//     const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

//     const mapped = {
//       id: device.id,
//       name: device.name,
//       badgeId: device.badgeId,
//       deviceEui: device.deviceEui,
//       restroomId: device.restroomId,
//       restroomName: device.restroom?.name || "Unassigned",
//       floorName: device.floor?.floorName || device.restroom?.floor?.floorName || null,
//       locationName: device.floor?.location?.officeName || device.restroom?.floor?.location?.officeName || null,
//       battery: device.batteryLevel ?? null,
//       status: isOnline ? "online" : "offline",
//       health: device.healthStatus || "healthy",
//       lastCommunication: device.lastSeen,
//       deviceType: device.deviceType,
//       zoneId: device.zoneId,
//       zoneName: device.zone?.name || null,
//       gatewayId: device.gatewayId,
//       gatewayName: device.gateway?.name || null,
//       joinEui: device.joinEui || null,
//       appKey: device.appKey || null,
//       lorawanVersion: device.lorawanVersion || null,
//       lorawanPhyVersion: device.lorawanPhyVersion || null,
//       feedback: device.feedback,
//       healthRecords: device.deviceHealth,
//     };

//     res.status(200).json({ message: "Device fetched successfully", device: mapped });
//   } catch (error) {
//     console.error("Get device error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function createDevice(req, res) {
//   try {
//     let { name, deviceType, restroomId, batteryLevel, floorId, zoneId, floorPlanPosX, floorPlanPosY, deviceEui: providedDeviceEui, ttnDeviceId, joinEui, appKey, lorawanVersion, lorawanPhyVersion, isLayoutAsset = false } = req.body;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;

//     if (!isLayoutAsset) {
//       if (!providedDeviceEui) {
//         return res.status(400).json({ message: "Device EUI is required" });
//       }

//       if (!appKey) {
//         return res.status(400).json({ message: "App Key is required" });
//       }

//       const normalizedDeviceEui = providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//       if (normalizedDeviceEui.length !== 16) {
//         return res.status(400).json({ message: "Device EUI must be exactly 16 hexadecimal characters" });
//       }

//       const normalizedAppKey = appKey.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//       if (normalizedAppKey.length !== 32) {
//         return res.status(400).json({ message: "App Key must be exactly 32 hexadecimal characters" });
//       }
//     }

//     const resolvedDeviceEui = isLayoutAsset
//       ? (providedDeviceEui || crypto.randomBytes(8).toString("hex").toUpperCase())
//       : providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//     const normalizedAppKey = isLayoutAsset
//       ? (appKey || crypto.randomBytes(16).toString("hex"))
//       : appKey.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//     const generatedBadgeId = name ? `BADGE-${name.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase()}` : `BADGE-${resolvedDeviceEui.slice(0, 8)}`;
//     const resolvedBadgeId = generatedBadgeId;
//     const resolvedJoinEui = joinEui || "0000000000000000";
//     const resolvedAppKey = normalizedAppKey;
//     const resolvedLorawanVersion = lorawanVersion || "MAC_V1_0_3";

//     const existingDevice = await prisma.device.findFirst({
//       where: { OR: [{ deviceEui: resolvedDeviceEui }, { badgeId: resolvedBadgeId }] },
//       select: { id: true },
//     });

//     let finalRestroomId = restroomId;
//     let organizationId = null;

//     if (finalRestroomId) {
//       const restroom = await prisma.restroom.findUnique({ where: { id: finalRestroomId } });
//       if (!restroom) {
//         return res.status(404).json({ message: "Restroom not found" });
//       }
//       if (userRole === "vendor_admin" && restroom.organizationId !== userOrgId) {
//         return res.status(403).json({ message: "You can only create devices for restrooms in your organization" });
//       }
//       organizationId = restroom.organizationId;
//     }

//     if (zoneId) {
//       const zone = await prisma.zone.findFirst({
//         where: { id: zoneId },
//         include: { floor: { include: { location: true } } },
//       });
//       if (!zone) {
//         return res.status(404).json({ message: "Zone not found" });
//       }
//       if (userRole === "vendor_admin" && zone.floor.location.organizationId !== userOrgId) {
//         return res.status(403).json({ message: "You can only create devices for zones in your organization" });
//       }
//       organizationId = organizationId || zone.floor.location.organizationId;
//     }

//     let ttnRegistration = null;
//     try {
//       const resolvedTtnDeviceId = `device-${resolvedDeviceEui.toLowerCase()}`;
//       const ttnPayload = {
//         deviceEui: resolvedDeviceEui,
//         deviceId: resolvedTtnDeviceId,
//         joinEui: resolvedJoinEui,
//         appKey: resolvedAppKey,
//         lorawanVersion: resolvedLorawanVersion,
//       };

//       if (lorawanPhyVersion) {
//         ttnPayload.lorawanPhyVersion = lorawanPhyVersion;
//       }

//       ttnRegistration = await registerOtaaDevice(ttnPayload);

//       joinEui = resolvedJoinEui;
//       appKey = resolvedAppKey;
//       ttnDeviceId = resolvedTtnDeviceId;
//       lorawanVersion = resolvedLorawanVersion;
//       lorawanPhyVersion = lorawanPhyVersion || null;
//       console.log(`[Device] Device ${resolvedBadgeId} (${resolvedDeviceEui}) registered in TTN as ${resolvedTtnDeviceId}`);
//     } catch (error) {
//       if (error.message.includes("409")) {
//         return res.status(409).json({
//           message: `Device EUI ${resolvedDeviceEui} is already registered on TTN. Use a different DevEUI or remove the existing device from the TTN Console.`,
//         });
//       }
//       return res.status(502).json({ message: error.message });
//     }

//     const deviceData = {
//       name: name || null,
//       deviceEui: resolvedDeviceEui,
//       badgeId: resolvedBadgeId,
//       restroomId: finalRestroomId || null,
//       floorId: floorId || null,
//       zoneId: zoneId || null,
//       deviceType: deviceType || "sensor",
//       batteryLevel: batteryLevel ?? 100,
//       floorPlanPosX: floorPlanPosX ?? null,
//       floorPlanPosY: floorPlanPosY ?? null,
//       joinEui: resolvedJoinEui,
//       appKey: resolvedAppKey,
//       lorawanVersion: lorawanVersion || null,
//       lorawanPhyVersion: lorawanPhyVersion || null,
//       healthStatus: "healthy",
//     };

//     let device;
//     if (existingDevice) {
//       device = await prisma.device.update({
//         where: { id: existingDevice.id },
//         data: deviceData,
//       });
//     } else {
//       device = await prisma.device.create({
//         data: deviceData,
//       });
//     }

//     res.status(existingDevice ? 200 : 201).json({
//       message: existingDevice
//         ? "Device identity already existed; inventory record updated"
//         : isLayoutAsset
//         ? "Layout device placed successfully"
//         : "Device registered in TTN and added to inventory successfully",
//       device,
//       ttnRegistration,
//     });
//   } catch (error) {
//     console.error("Create device error:", error);
//     if (error.code === "P2002") {
//       return res.status(409).json({ message: "Device EUI or badge ID already exists" });
//     }
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function updateDevice(req, res) {
//   try {
//     const { id } = req.params;
//     const { badgeId, restroomId, batteryLevel, healthStatus, floorPlanPosX, floorPlanPosY, floorId, zoneId, deviceType, joinEui, appKey, gatewayId, name, deviceEui } = req.body;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;

//     const whereClause = { id }
//     if (userRole !== "super_admin") {
//       whereClause.OR = [
//         { restroom: { organizationId: userOrgId } },
//         { restroomId: null },
//         { floor: { location: { organizationId: userOrgId } } },
//         { floorId: null },
//       ]
//     }

//     const existing = await prisma.device.findFirst({
//       where: whereClause,
//       include: { restroom: true, floor: { include: { location: true } }, zone: { include: { floor: { include: { location: true } } } } },
//     });

//     if (!existing) {
//       return res.status(404).json({ message: "Device not found" });
//     }

//     if (userRole === "vendor_admin" && restroomId) {
//       const newRestroom = await prisma.restroom.findUnique({ where: { id: restroomId } });
//       if (!newRestroom || newRestroom.organizationId !== userOrgId) {
//         return res.status(403).json({ message: "You can only assign devices to restrooms in your organization" });
//       }
//     }

//     if (userRole === "vendor_admin" && zoneId) {
//       const newZone = await prisma.zone.findFirst({
//         where: { id: zoneId },
//         include: { floor: { include: { location: true } } },
//       });
//       if (!newZone || newZone.floor.location.organizationId !== userOrgId) {
//         return res.status(403).json({ message: "You can only assign devices to zones in your organization" });
//       }
//     }

//     const updateData = {}
//     if (badgeId !== undefined) updateData.badgeId = badgeId
//     if (restroomId !== undefined) updateData.restroomId = restroomId
//     if (batteryLevel !== undefined) updateData.batteryLevel = batteryLevel
//     if (healthStatus !== undefined) updateData.healthStatus = healthStatus
//     if (floorPlanPosX !== undefined) updateData.floorPlanPosX = floorPlanPosX
//     if (floorPlanPosY !== undefined) updateData.floorPlanPosY = floorPlanPosY
//     if (floorId !== undefined) updateData.floorId = floorId
//     if (zoneId !== undefined) updateData.zoneId = zoneId || null
//     if (deviceType !== undefined) updateData.deviceType = deviceType
//     if (joinEui !== undefined) updateData.joinEui = joinEui || null
//     if (appKey !== undefined) updateData.appKey = appKey || null
//     if (gatewayId !== undefined) updateData.gatewayId = gatewayId || null
//     if (name !== undefined) updateData.name = name || null
//     if (deviceEui) updateData.deviceEui = deviceEui

//     const oldGatewayId = existing.gatewayId;

//     const device = await prisma.device.update({
//       where: { id },
//       data: updateData,
//       include: {
//         restroom: { include: { floor: { include: { location: true } } } },
//         floor: { include: { location: true } },
//         zone: true,
//         gateway: true,
//       },
//     });

//     if (gatewayId !== undefined) {
//       const newGatewayId = gatewayId || null;

//       if (oldGatewayId && oldGatewayId !== newGatewayId) {
//         const oldCount = await prisma.device.count({ where: { gatewayId: oldGatewayId } });
//         await prisma.gateway.update({
//           where: { id: oldGatewayId },
//           data: { connectedDevices: oldCount },
//         });
//       }

//       if (newGatewayId) {
//         const newCount = await prisma.device.count({ where: { gatewayId: newGatewayId } });
//         await prisma.gateway.update({
//           where: { id: newGatewayId },
//           data: { connectedDevices: newCount },
//         });
//       }
//     }

//     const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//     const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
//     const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

//     const mappedDevice = {
//       id: device.id,
//       name: device.name,
//       badgeId: device.badgeId,
//       deviceEui: device.deviceEui,
//       restroomId: device.restroomId,
//       restroomName: device.restroom?.name || "Unassigned",
//       floorName: device.floor?.floorName || device.restroom?.floor?.floorName || null,
//       locationName: device.floor?.location?.officeName || device.restroom?.floor?.location?.officeName || null,
//       battery: device.batteryLevel ?? null,
//       status: isOnline ? "online" : "offline",
//       health: device.healthStatus || "healthy",
//       lastCommunication: device.lastSeen,
//       deviceType: device.deviceType,
//       floorId: device.floorId,
//       zoneId: device.zoneId,
//       zoneName: device.zone?.name || null,
//       gatewayId: device.gatewayId,
//       gatewayName: device.gateway?.name || null,
//       floorPlanPosX: device.floorPlanPosX,
//       floorPlanPosY: device.floorPlanPosY,
//       joinEui: device.joinEui || null,
//       appKey: device.appKey || null,
//       lorawanVersion: device.lorawanVersion || null,
//       lorawanPhyVersion: device.lorawanPhyVersion || null,
//     };

//     res.status(200).json({ message: "Device updated successfully", device: mappedDevice });
//   } catch (error) {
//     console.error("Update device error:", error);
//     if (error.code === "P2002") {
//       return res.status(409).json({ message: "Device EUI or badge ID already exists" });
//     }
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getDeviceHealth(req, res) {
//   try {
//     const { deviceId } = req.params;
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;

//     const whereClause = { id: deviceId };
//     if (role !== "super_admin") {
//       whereClause.OR = [
//         { restroom: { organizationId: orgId } },
//         { restroomId: null },
//       ];
//     }

//     const device = await prisma.device.findFirst({
//       where: whereClause,
//       include: {
//         deviceHealth: { orderBy: { recordedAt: "desc" }, take: 50 },
//       },
//     });

//     if (!device) {
//       return res.status(404).json({ message: "Device not found" });
//     }

//     res.status(200).json({
//       message: "Device health fetched successfully",
//       device: {
//         id: device.id,
//         badgeId: device.badgeId,
//         batteryLevel: device.batteryLevel,
//         healthStatus: device.healthStatus,
//         lastSeen: device.lastSeen,
//         healthRecords: device.deviceHealth,
//       },
//     });
//   } catch (error) {
//     console.error("Get device health error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getOfflineDevices(req, res) {
//   try {
//     const fiveMinutesAgo = new Date();
//     fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;

//     const where = {
//       OR: [
//         { lastSeen: { lt: fiveMinutesAgo } },
//         { healthStatus: { not: "healthy" } },
//       ],
//     };

//     if (role !== "super_admin") {
//       where.OR = [
//         { restroom: { organizationId: orgId } },
//         { restroomId: null },
//       ];
//     }

//     const offlineDevices = await prisma.device.findMany({
//       where,
//       include: {
//         restroom: { include: { floor: { include: { location: true } } } },
//       },
//       orderBy: { lastSeen: "asc" },
//     });

//     const mapped = offlineDevices.map((device) => {
//       const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
//       const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

//       return {
//         id: device.id,
//         badgeId: device.badgeId,
//         deviceEui: device.deviceEui,
//         restroomId: device.restroomId,
//         restroomName: device.restroom?.name || "Unassigned",
//         floorName: device.restroom?.floor?.floorName || null,
//         locationName: device.restroom?.floor?.location?.officeName || null,
//         battery: device.batteryLevel ?? null,
//         status: isOnline ? "online" : "offline",
//         health: device.healthStatus || "healthy",
//         lastCommunication: device.lastSeen,
//         deviceType: device.deviceType,
//         zoneId: device.zoneId,
//         zoneName: device.zone?.name || null,
//       };
//     });

//     res.status(200).json({
//       message: "Offline devices fetched successfully",
//       devices: mapped,
//       count: mapped.length,
//     });
//   } catch (error) {
//     console.error("Get offline devices error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function registerDeviceInTTN(req, res) {
//   try {
//     const { id } = req.params;
//     const { ttnDeviceId, joinEui, appKey, deviceEui: providedDeviceEui } = req.body;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;

//     const whereClause = { id };
//     if (userRole !== "super_admin") {
//       whereClause.OR = [
//         { restroom: { organizationId: userOrgId } },
//         { restroomId: null }
//       ];
//     }

//     const existing = await prisma.device.findFirst({
//       where: whereClause,
//       include: { restroom: true },
//     });

//     if (!existing) {
//       return res.status(404).json({ message: "Device not found" });
//     }

//     if (!appKey) {
//       return res.status(400).json({ message: "App Key is required" });
//     }

//     if (providedDeviceEui) {
//       const normalizedEui = providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//       if (normalizedEui.length !== 16) {
//         return res.status(400).json({ message: "Device EUI must be exactly 16 hexadecimal characters" });
//       }
//     }

//     let ttnRegistration = null;
//     try {
//       ttnRegistration = await registerOtaaDevice({
//         deviceEui: providedDeviceEui ? providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase() : existing.deviceEui,
//         deviceId: ttnDeviceId || existing.deviceEui,
//         joinEui: joinEui || "0000000000000000",
//         appKey,
//       });
//     } catch (error) {
//       if (error.message.includes("409")) {
//         return res.status(409).json({
//           message: `Device is already registered on TTN as another device. Use the repair endpoint or remove the conflicting device from the TTN Console.`,
//         });
//       }
//       return res.status(502).json({ message: `TTN registration failed: ${error.message}` });
//     }

//     const updateData = {
//       joinEui: joinEui || existing.joinEui || "0000000000000000",
//       appKey,
//     };
//     if (providedDeviceEui) {
//       updateData.deviceEui = providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//     }

//     const device = await prisma.device.update({
//       where: { id },
//       data: updateData,
//     });

//     res.status(200).json({
//       message: "Device registered in TTN successfully",
//       device,
//       ttnRegistration,
//     });
//   } catch (error) {
//     console.error("Register device in TTN error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function deleteDevice(req, res) {
//   try {
//     const { id } = req.params;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;

//     const whereClause = { id };
//     if (userRole !== "super_admin") {
//       whereClause.OR = [
//         { restroom: { organizationId: userOrgId } },
//         { restroomId: null }
//       ];
//     }

//     const existing = await prisma.device.findFirst({
//       where: whereClause,
//       include: { restroom: true },
//     });

//     if (!existing) {
//       return res.status(404).json({ message: "Device not found" });
//     }

//     let ttnDeleted = false;
//     let ttnDeleteError = null;
//     try {
//       await deleteDeviceFromTTN({
//         deviceEui: existing.deviceEui,
//         deviceId: `device-${existing.deviceEui.toLowerCase()}`,
//       });
//       ttnDeleted = true;
//       console.log(`[Device] Device ${existing.deviceEui} deleted from TTN successfully`);
//     } catch (ttnError) {
//       ttnDeleteError = ttnError.message;
//       console.warn(`[Device] TTN delete failed for ${existing.deviceEui}: ${ttnError.message}`);
//     }

//     const feedbackIds = await prisma.feedback.findMany({ where: { deviceId: id }, select: { id: true } }).then(f => f.map(x => x.id));
//     const alertIds = await prisma.alert.findMany({ where: { feedbackId: { in: feedbackIds } }, select: { id: true } }).then(a => a.map(x => x.id));

//     await prisma.notification.deleteMany({ where: { alertId: { in: alertIds } } });
//     await prisma.alert.deleteMany({ where: { feedbackId: { in: feedbackIds } } });
//     await prisma.feedback.deleteMany({ where: { deviceId: id } });
//     await prisma.deviceHealthRecord.deleteMany({ where: { deviceId: id } });

//     if (existing.gatewayId) {
//       await prisma.gateway.update({
//         where: { id: existing.gatewayId },
//         data: {
//           connectedDevices: {
//             decrement: 1,
//           },
//         },
//       });
//     }

//     await prisma.device.delete({ where: { id } });

//     res.status(200).json({
//       message: ttnDeleted ? "Device deleted successfully from app and TTN" : "Device deleted from app, but could not delete from TTN. Please delete it manually from TTN Console.",
//       ttnDeleted,
//       ttnDeleteError,
//     });
//   } catch (error) {
//     console.error("Delete device error:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message, stack: error.stack });
//   }
// }

// module.exports = {
//   getDevices,
//   getDeviceById,
//   createDevice,
//   updateDevice,
//   getDeviceHealth,
//   getOfflineDevices,
//   registerDeviceInTTN,
//   deleteDevice,
// };
const prisma = require("../config/database");
const { registerOtaaDevice } = require("../services/ttnDeviceRegistryService");
const { deleteDeviceFromTTN } = require("../services/ttnDeviceRegistryService");
const crypto = require("crypto");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

// A device is inventory until it is assigned to a floor.  The floor is the
// source of truth for its site; never trust a client supplied site id.
async function resolveDevicePlacement(input, existing, userOrgId) {
  const hasPlacementChange = ["floorId", "zoneId", "restroomId"].some((key) => input[key] !== undefined);
  if (!hasPlacementChange) return null;

  let floorId = input.floorId !== undefined ? input.floorId || null : existing.floorId;
  let zoneId = input.zoneId !== undefined ? input.zoneId || null : existing.zoneId;
  let restroomId = input.restroomId !== undefined ? input.restroomId || null : existing.restroomId;
  if (!floorId && (zoneId || restroomId)) floorId = zoneId ? null : existing.floorId;

  const [zone, restroom] = await Promise.all([
    zoneId ? prisma.zone.findUnique({ where: { id: zoneId }, include: { floor: { include: { location: true } } } }) : null,
    restroomId ? prisma.restroom.findUnique({ where: { id: restroomId }, include: { floor: { include: { location: true } } } }) : null,
  ]);
  if (zoneId && !zone) throw Object.assign(new Error("Zone not found"), { status: 404 });
  if (restroomId && !restroom) throw Object.assign(new Error("Restroom not found"), { status: 404 });
  // Use zone's floorId as authoritative source; fall back to restroom's floorId or the provided floorId
  if (!floorId) floorId = zone?.floorId || restroom?.floorId || null;
  const floor = floorId ? await prisma.floor.findUnique({ where: { id: floorId }, include: { location: true } }) : null;
  if (floorId && !floor) throw Object.assign(new Error("Floor not found"), { status: 404 });
  if (zone && zone.floorId !== floorId) throw Object.assign(new Error("Zone must belong to the selected floor"), { status: 400 });
  // If restroom belongs to a different floor than the zone/floor, drop the restroomId silently rather
  // than blocking placement — zone is the spatial truth; restroomId is advisory.
  if (restroom && restroom.floorId !== floorId) restroomId = null;
  if (userOrgId && floor && floor.location.organizationId !== userOrgId) throw Object.assign(new Error("You can only assign devices within your organization"), { status: 403 });

  const oldSiteId = existing.floor?.locationId || existing.restroom?.floor?.locationId;
  // Allow cross-site reassignment — placing on a new site simply overwrites the old placement.
  return { floorId, zoneId, restroomId, floor, changed: oldSiteId !== floor?.locationId || existing.floorId !== floorId || existing.zoneId !== zoneId || existing.restroomId !== restroomId };
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
        { restroomId: null, floor: { location: { organizationId: orgId } } },
        { restroomId: null, floorId: null },
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
        gateway: true,
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
        floorId: device.floorId,
        locationId: device.floor?.locationId || device.restroom?.floor?.locationId || null,
        zoneId: device.zoneId,
        zoneName: device.zone?.name || null,
        gatewayId: device.gatewayId,
        gatewayName: device.gateway?.name || null,
        floorPlanPosX: device.floorPlanPosX,
        floorPlanPosY: device.floorPlanPosY,
        latitude: device.latitude,   // ← added
        longitude: device.longitude, // ← added
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
        gateway: true,
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
      floorId: device.floorId,
      locationId: device.floor?.locationId || device.restroom?.floor?.locationId || null,
      zoneId: device.zoneId,
      zoneName: device.zone?.name || null,
      gatewayId: device.gatewayId,
      gatewayName: device.gateway?.name || null,
      floorPlanPosX: device.floorPlanPosX,
      floorPlanPosY: device.floorPlanPosY,
      latitude: device.latitude,   // ← added
      longitude: device.longitude, // ← added
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
    let {
      name, deviceType, restroomId, batteryLevel, floorId, zoneId,
      floorPlanPosX, floorPlanPosY, latitude, longitude, // ← latitude/longitude added
      deviceEui: providedDeviceEui, ttnDeviceId, joinEui, appKey,
      lorawanVersion, lorawanPhyVersion, isLayoutAsset = false,
    } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!isLayoutAsset) {
      if (!providedDeviceEui) {
        return res.status(400).json({ message: "Device EUI is required" });
      }

      if (!appKey) {
        return res.status(400).json({ message: "App Key is required" });
      }

      const normalizedDeviceEui = providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      if (normalizedDeviceEui.length !== 16) {
        return res.status(400).json({ message: "Device EUI must be exactly 16 hexadecimal characters" });
      }

      const normalizedAppKey = appKey.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      if (normalizedAppKey.length !== 32) {
        return res.status(400).json({ message: "App Key must be exactly 32 hexadecimal characters" });
      }
    }

    const resolvedDeviceEui = isLayoutAsset
      ? (providedDeviceEui || crypto.randomBytes(8).toString("hex").toUpperCase())
      : providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
    const normalizedAppKey = isLayoutAsset
      ? (appKey || crypto.randomBytes(16).toString("hex"))
      : appKey.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
    const generatedBadgeId = name ? `BADGE-${name.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase()}` : `BADGE-${resolvedDeviceEui.slice(0, 8)}`;
    const resolvedBadgeId = generatedBadgeId;
    const resolvedJoinEui = joinEui || "0000000000000000";
    const resolvedAppKey = normalizedAppKey;
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

    let placement;
    try {
      placement = await resolveDevicePlacement({ floorId, zoneId, restroomId: finalRestroomId }, { floorId: null, restroomId: null, zoneId: null }, userRole === "super_admin" ? null : userOrgId);
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }
    if (placement?.floor && ([latitude, longitude].some((value) => value === null || value === "" || value === undefined || !Number.isFinite(Number(value))))) {
      return res.status(400).json({ message: "Latitude and longitude are required when assigning a device" });
    }
    if (existingDevice) {
      return res.status(409).json({ message: "A device with this Device EUI or badge ID already exists" });
    }

    let ttnRegistration = null;
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
      console.log(`[Device] Device ${resolvedBadgeId} (${resolvedDeviceEui}) registered in TTN as ${resolvedTtnDeviceId}`);
    } catch (error) {
      if (error.message.includes("409")) {
        return res.status(409).json({
          message: `Device EUI ${resolvedDeviceEui} is already registered on TTN. Use a different DevEUI or remove the existing device from the TTN Console.`,
        });
      }
      return res.status(502).json({ message: error.message });
    }

    const deviceData = {
      name: name || null,
      deviceEui: resolvedDeviceEui,
      badgeId: resolvedBadgeId,
      restroomId: placement ? placement.restroomId : finalRestroomId || null,
      floorId: placement ? placement.floorId : floorId || null,
      zoneId: placement ? placement.zoneId : zoneId || null,
      deviceType: deviceType || "sensor",
      batteryLevel: batteryLevel ?? 100,
      floorPlanPosX: floorPlanPosX ?? null,
      floorPlanPosY: floorPlanPosY ?? null,
      latitude: latitude ?? null,   // ← added
      longitude: longitude ?? null, // ← added
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

async function bulkCreateDevices(req, res) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: "Upload at least one device row" });
    if (items.length > 500) return res.status(400).json({ message: "A bulk upload can contain at most 500 devices" });
    const normalized = [];
    const errors = [];
    const seen = new Set();
    items.forEach((item, index) => {
      const deviceEui = String(item.deviceEui || item.devEui || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      if (deviceEui.length !== 16) return errors.push({ row: index + 1, message: "Device EUI must be 16 hexadecimal characters" });
      if (seen.has(deviceEui)) return errors.push({ row: index + 1, message: "Duplicate Device EUI in upload" });
      seen.add(deviceEui);
      normalized.push({
        deviceEui,
        badgeId: String(item.badgeId || `BADGE-${deviceEui}`).trim(),
        name: item.name ? String(item.name).trim() : null,
        deviceType: item.deviceType ? String(item.deviceType).trim() : "sensor",
        appKey: item.appKey ? String(item.appKey).replace(/[^a-fA-F0-9]/g, "").toUpperCase() : null,
        joinEui: item.joinEui ? String(item.joinEui).replace(/[^a-fA-F0-9]/g, "").toUpperCase() : null,
        batteryLevel: Number.isFinite(Number(item.batteryLevel)) ? Number(item.batteryLevel) : 100,
      });
    });
    if (errors.length) return res.status(400).json({ message: "Fix the invalid upload rows", errors });
    const existing = await prisma.device.findMany({ where: { OR: [{ deviceEui: { in: normalized.map((item) => item.deviceEui) } }, { badgeId: { in: normalized.map((item) => item.badgeId) } }] }, select: { deviceEui: true, badgeId: true } });
    const existingKeys = new Set(existing.flatMap((item) => [item.deviceEui, item.badgeId]));
    const toCreate = normalized.filter((item) => !existingKeys.has(item.deviceEui) && !existingKeys.has(item.badgeId));
    if (toCreate.length) await prisma.device.createMany({ data: toCreate });
    res.status(201).json({ message: `${toCreate.length} device(s) added to inventory`, created: toCreate.length, skipped: normalized.length - toCreate.length, errors: [] });
  } catch (error) {
    console.error("Bulk device upload error:", error);
    res.status(500).json({ message: "Unable to import devices" });
  }
}

async function updateDevice(req, res) {
  try {
    const { id } = req.params;
    const {
      badgeId, restroomId, batteryLevel, healthStatus, floorPlanPosX, floorPlanPosY,
      floorId, zoneId, deviceType, joinEui, appKey, gatewayId, name, deviceEui,
      latitude, longitude, // ← added
    } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const whereClause = { id }
    if (userRole !== "super_admin") {
      whereClause.OR = [
        { restroom: { organizationId: userOrgId } },
        { restroomId: null },
        { floor: { location: { organizationId: userOrgId } } },
        { floorId: null },
      ]
    }

    const existing = await prisma.device.findFirst({
      where: whereClause,
      include: { restroom: true, floor: { include: { location: true } }, zone: { include: { floor: { include: { location: true } } } } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Device not found" });
    }

    let placement;
    try {
      placement = await resolveDevicePlacement({ floorId, zoneId, restroomId }, existing, userRole === "super_admin" ? null : userOrgId);
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }
    if (placement?.floor && placement.changed && ([latitude, longitude].some((value) => value === null || value === "" || value === undefined || !Number.isFinite(Number(value))))) {
      return res.status(400).json({ message: "Latitude and longitude are required when assigning a device" });
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
    if (restroomId !== undefined || placement) updateData.restroomId = placement ? placement.restroomId : restroomId
    if (batteryLevel !== undefined) updateData.batteryLevel = batteryLevel
    if (healthStatus !== undefined) updateData.healthStatus = healthStatus
    if (floorPlanPosX !== undefined) updateData.floorPlanPosX = floorPlanPosX
    if (floorPlanPosY !== undefined) updateData.floorPlanPosY = floorPlanPosY
    if (floorId !== undefined || placement) updateData.floorId = placement ? placement.floorId : floorId
    if (zoneId !== undefined || placement) updateData.zoneId = placement ? placement.zoneId : zoneId || null
    if (deviceType !== undefined) updateData.deviceType = deviceType
    if (joinEui !== undefined) updateData.joinEui = joinEui || null
    if (appKey !== undefined) updateData.appKey = appKey || null
    if (gatewayId !== undefined) updateData.gatewayId = gatewayId || null
    if (name !== undefined) updateData.name = name || null
    if (deviceEui) updateData.deviceEui = deviceEui
    if (latitude !== undefined) updateData.latitude = latitude     // ← added
    if (longitude !== undefined) updateData.longitude = longitude  // ← added

    const oldGatewayId = existing.gatewayId;

    const device = await prisma.device.update({
      where: { id },
      data: updateData,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        floor: { include: { location: true } },
        zone: true,
        gateway: true,
      },
    });

    if (gatewayId !== undefined) {
      const newGatewayId = gatewayId || null;

      if (oldGatewayId && oldGatewayId !== newGatewayId) {
        const oldCount = await prisma.device.count({ where: { gatewayId: oldGatewayId } });
        await prisma.gateway.update({
          where: { id: oldGatewayId },
          data: { connectedDevices: oldCount },
        });
      }

      if (newGatewayId) {
        const newCount = await prisma.device.count({ where: { gatewayId: newGatewayId } });
        await prisma.gateway.update({
          where: { id: newGatewayId },
          data: { connectedDevices: newCount },
        });
      }
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
    const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";

    const mappedDevice = {
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
      floorId: device.floorId,
      locationId: device.floor?.locationId || device.restroom?.floor?.locationId || null,
      zoneId: device.zoneId,
      zoneName: device.zone?.name || null,
      gatewayId: device.gatewayId,
      gatewayName: device.gateway?.name || null,
      floorPlanPosX: device.floorPlanPosX,
      floorPlanPosY: device.floorPlanPosY,
      latitude: device.latitude,   // ← added
      longitude: device.longitude, // ← added
      joinEui: device.joinEui || null,
      appKey: device.appKey || null,
      lorawanVersion: device.lorawanVersion || null,
      lorawanPhyVersion: device.lorawanPhyVersion || null,
    };

    res.status(200).json({ message: "Device updated successfully", device: mappedDevice });
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
        latitude: device.latitude,   // ← added
        longitude: device.longitude, // ← added
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
    const { ttnDeviceId, joinEui, appKey, deviceEui: providedDeviceEui } = req.body;
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

    if (providedDeviceEui) {
      const normalizedEui = providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      if (normalizedEui.length !== 16) {
        return res.status(400).json({ message: "Device EUI must be exactly 16 hexadecimal characters" });
      }
    }

    let ttnRegistration = null;
    try {
      ttnRegistration = await registerOtaaDevice({
        deviceEui: providedDeviceEui ? providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase() : existing.deviceEui,
        deviceId: ttnDeviceId || existing.deviceEui,
        joinEui: joinEui || "0000000000000000",
        appKey,
      });
    } catch (error) {
      if (error.message.includes("409")) {
        return res.status(409).json({
          message: `Device is already registered on TTN as another device. Use the repair endpoint or remove the conflicting device from the TTN Console.`,
        });
      }
      return res.status(502).json({ message: `TTN registration failed: ${error.message}` });
    }

    const updateData = {
      joinEui: joinEui || existing.joinEui || "0000000000000000",
      appKey,
    };
    if (providedDeviceEui) {
      updateData.deviceEui = providedDeviceEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
    }

    const device = await prisma.device.update({
      where: { id },
      data: updateData,
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

async function deleteDevice(req, res) {
  try {
    const { id } = req.params;
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

    let ttnDeleted = false;
    let ttnDeleteError = null;
    try {
      await deleteDeviceFromTTN({
        deviceEui: existing.deviceEui,
        deviceId: `device-${existing.deviceEui.toLowerCase()}`,
      });
      ttnDeleted = true;
      console.log(`[Device] Device ${existing.deviceEui} deleted from TTN successfully`);
    } catch (ttnError) {
      ttnDeleteError = ttnError.message;
      console.warn(`[Device] TTN delete failed for ${existing.deviceEui}: ${ttnError.message}`);
    }

    const feedbackIds = await prisma.feedback.findMany({ where: { deviceId: id }, select: { id: true } }).then(f => f.map(x => x.id));
    const alertIds = await prisma.alert.findMany({ where: { feedbackId: { in: feedbackIds } }, select: { id: true } }).then(a => a.map(x => x.id));

    await prisma.notification.deleteMany({ where: { alertId: { in: alertIds } } });
    await prisma.alert.deleteMany({ where: { feedbackId: { in: feedbackIds } } });
    await prisma.feedback.deleteMany({ where: { deviceId: id } });
    await prisma.deviceHealthRecord.deleteMany({ where: { deviceId: id } });

    if (existing.gatewayId) {
      await prisma.gateway.update({
        where: { id: existing.gatewayId },
        data: {
          connectedDevices: {
            decrement: 1,
          },
        },
      });
    }

    await prisma.device.delete({ where: { id } });

    res.status(200).json({
      message: ttnDeleted ? "Device deleted successfully from app and TTN" : "Device deleted from app, but could not delete from TTN. Please delete it manually from TTN Console.",
      ttnDeleted,
      ttnDeleteError,
    });
  } catch (error) {
    console.error("Delete device error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message, stack: error.stack });
  }
}

module.exports = {
  getDevices,
  getDeviceById,
  createDevice,
  bulkCreateDevices,
  updateDevice,
  getDeviceHealth,
  getOfflineDevices,
  registerDeviceInTTN,
  deleteDevice,
};
