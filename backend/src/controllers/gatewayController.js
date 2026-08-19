// const prisma = require("../config/database");
// const { registerGatewayInTTN: registerGatewayInTTNService, deleteGatewayFromTTN } = require("../services/ttnGatewayRegistryService");

// function getOrgFilter(req) {
//   const role = req.user?.role;
//   const orgId = req.user?.organizationId;
//   if (role === "super_admin") return {};
//   return { organizationId: orgId };
// }

// async function getGateways(req, res) {
//   try {
//     const { status, locationId, floorId, zoneId, search } = req.query;
//     const where = { ...getOrgFilter(req) };
//     if (status) where.status = status;
//     if (locationId) where.locationId = locationId;
//     if (floorId) where.floorId = floorId;
//     if (zoneId) where.zoneId = zoneId;
//     if (search) {
//       where.OR = [
//         { name: { contains: search, mode: "insensitive" } },
//         { gatewayEui: { contains: search, mode: "insensitive" } },
//       ];
//     }
//     const gateways = await prisma.gateway.findMany({
//       where,
//       include: {
//         location: { select: { id: true, city: true, officeName: true } },
//         floor: { select: { id: true, floorName: true } },
//         zone: { select: { id: true, name: true } },
//       },
//       orderBy: { updatedAt: "desc" },
//     });
//     const mapped = gateways.map((g) => ({
//       id: g.id, name: g.name, gatewayEui: g.gatewayEui, status: g.status, lastSeen: g.lastSeen,
//       site: g.location?.officeName || g.location?.city || null, floor: g.floor?.floorName || null, zone: g.zone?.name || null,
//       locationId: g.locationId, floorId: g.floorId, zoneId: g.zoneId,
//       ttnStatus: g.ttnStatus, gatewayId: g.gatewayId, ttnDeviceId: g.ttnDeviceId, frequencyPlanId: g.frequencyPlanId,
//       latitude: g.latitude, longitude: g.longitude, connectedDevices: g.connectedDevices,
//       createdAt: g.createdAt, updatedAt: g.updatedAt,
//     }));
//     res.status(200).json({ message: "Gateways fetched successfully", gateways: mapped });
//   } catch (error) {
//     console.error("Get gateways error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getGatewayById(req, res) {
//   try {
//     const { id } = req.params;
//     const whereClause = { id };
//     if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
//     const gateway = await prisma.gateway.findFirst({
//       where: whereClause,
//       include: {
//         location: true,
//         floor: { include: { location: true } },
//         zone: { include: { floor: { include: { location: true } } } },
//         devices: {
//           include: {
//             restroom: { include: { floor: { include: { location: true } } } },
//             zone: true,
//           },
//           orderBy: { lastSeen: "desc" },
//         },
//       },
//     });
//     if (!gateway) return res.status(404).json({ message: "Gateway not found" });
//     const mappedDevices = gateway.devices.map((d) => ({
//       id: d.id, name: d.name, deviceEui: d.deviceEui, badgeId: d.badgeId, deviceType: d.deviceType,
//       restroomName: d.restroom?.name || "Unassigned",
//       floorName: d.floor?.floorName || d.restroom?.floor?.floorName || null,
//       battery: d.batteryLevel,
//       status: d.lastSeen && d.lastSeen > new Date(Date.now() - 5 * 60 * 1000) && d.healthStatus === "healthy" ? "online" : "offline",
//       health: d.healthStatus, lastSeen: d.lastSeen,
//     }));
//     res.status(200).json({
//       message: "Gateway fetched successfully",
//       gateway: {
//         id: gateway.id, name: gateway.name, gatewayEui: gateway.gatewayEui, status: gateway.status, lastSeen: gateway.lastSeen,
//         site: gateway.location?.officeName || gateway.location?.city || null, floor: gateway.floor?.floorName || null, zone: gateway.zone?.name || null,
//         locationId: gateway.locationId, floorId: gateway.floorId, zoneId: gateway.zoneId,
//         ttnStatus: gateway.ttnStatus, gatewayId: gateway.gatewayId, ttnDeviceId: gateway.ttnDeviceId, frequencyPlanId: gateway.frequencyPlanId,
//         latitude: gateway.latitude, longitude: gateway.longitude, connectedDevices: gateway.connectedDevices,
//         organizationId: gateway.organizationId, createdAt: gateway.createdAt, updatedAt: gateway.updatedAt,
//         devices: mappedDevices,
//       },
//     });
//   } catch (error) {
//     console.error("Get gateway error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function createGateway(req, res) {
//   try {
//     const { name, gatewayEui, locationId, floorId, zoneId, frequencyPlanId, latitude, longitude, gatewayId } = req.body;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;
//     if (!name || !gatewayEui) return res.status(400).json({ message: "Gateway name and EUI are required" });
//     const normalizedEui = gatewayEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//     if (normalizedEui.length !== 16) return res.status(400).json({ message: "Gateway EUI must be exactly 16 hexadecimal characters" });
//     const resolvedGatewayId = gatewayId ? String(gatewayId).trim().toLowerCase() : `gateway-${normalizedEui.toLowerCase()}`;
//     if (!/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(resolvedGatewayId)) {
//       return res.status(400).json({ message: "Gateway ID must use lowercase letters, numbers, and hyphens (3-36 characters)" });
//     }
//     let organizationId = userOrgId;
//     if (locationId) {
//       const location = await prisma.location.findUnique({ where: { id: locationId } });
//       if (!location) return res.status(404).json({ message: "Location not found" });
//       if (userRole === "vendor_admin" && location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only create gateways for locations in your organization" });
//       organizationId = location.organizationId;
//     }
//     if (floorId) {
//       const floor = await prisma.floor.findFirst({ where: { id: floorId }, include: { location: true } });
//       if (!floor) return res.status(404).json({ message: "Floor not found" });
//       if (userRole === "vendor_admin" && floor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only create gateways for floors in your organization" });
//       organizationId = organizationId || floor.location.organizationId;
//     }
//     if (zoneId) {
//       const zone = await prisma.zone.findFirst({ where: { id: zoneId }, include: { floor: { include: { location: true } } } });
//       if (!zone) return res.status(404).json({ message: "Zone not found" });
//       if (userRole === "vendor_admin" && zone.floor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only create gateways for zones in your organization" });
//       organizationId = organizationId || zone.floor.location.organizationId;
//     }
//     const existing = await prisma.gateway.findFirst({ where: { OR: [{ gatewayEui: normalizedEui }, { name }] }, select: { id: true } });
//     if (existing) return res.status(409).json({ message: "Gateway EUI or name already exists" });
//     const gateway = await prisma.gateway.create({
//       data: {
//         name, gatewayEui: normalizedEui, organizationId, gatewayId: resolvedGatewayId,
//         locationId: locationId || null, floorId: floorId || null, zoneId: zoneId || null,
//         frequencyPlanId: frequencyPlanId || null,
//         latitude: latitude ? parseFloat(latitude) : null, longitude: longitude ? parseFloat(longitude) : null, status: "offline",
//       },
//       include: {
//         location: { select: { id: true, city: true, officeName: true } },
//         floor: { select: { id: true, floorName: true } },
//         zone: { select: { id: true, name: true } },
//       },
//     });

//     let ttnRegistration = null;
//     let ttnStatus = "not_registered";
//     if (registerGatewayInTTNService) {
//       try {
//         ttnRegistration = await registerGatewayInTTNService({
//           gatewayEui: gateway.gatewayEui,
//           gatewayId: resolvedGatewayId,
//           frequencyPlanId: gateway.frequencyPlanId || undefined,
//           latitude: gateway.latitude || undefined,
//           longitude: gateway.longitude || undefined,
//           description: gateway.name,
//         });
//         ttnStatus = "registered";
//       } catch (ttnError) {
//         console.error("TTN gateway registration failed:", ttnError.message);
//         ttnStatus = "not_registered";
//       }
//     }

//     const updatedGateway = await prisma.gateway.update({
//       where: { id: gateway.id },
//       data: {
//         ttnStatus,
//         gatewayId: ttnRegistration?.gatewayId || gateway.gatewayId,
//         ttnDeviceId: ttnRegistration?.gatewayId || gateway.gatewayId,
//         frequencyPlanId: ttnRegistration?.frequencyPlanId || gateway.frequencyPlanId,
//       },
//     });

//     res.status(201).json({
//       message: "Gateway created successfully",
//       gateway: { id: updatedGateway.id, name: updatedGateway.name, gatewayEui: updatedGateway.gatewayEui, status: updatedGateway.status, lastSeen: updatedGateway.lastSeen,
//         site: gateway.location?.officeName || gateway.location?.city || null, floor: gateway.floor?.floorName || null, zone: gateway.zone?.name || null,
//         locationId: updatedGateway.locationId, floorId: updatedGateway.floorId, zoneId: updatedGateway.zoneId,
//         ttnStatus: updatedGateway.ttnStatus, gatewayId: updatedGateway.gatewayId, ttnDeviceId: updatedGateway.ttnDeviceId, frequencyPlanId: updatedGateway.frequencyPlanId,
//         latitude: updatedGateway.latitude, longitude: updatedGateway.longitude, connectedDevices: updatedGateway.connectedDevices,
//         createdAt: updatedGateway.createdAt, updatedAt: updatedGateway.updatedAt },
//     });
//   } catch (error) {
//     console.error("Create gateway error:", error);
//     if (error.code === "P2002") return res.status(409).json({ message: "Gateway EUI or name already exists" });
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function updateGateway(req, res) {
//   try {
//     const { id } = req.params;
//     const { name, gatewayEui, locationId, floorId, zoneId, status, frequencyPlanId, latitude, longitude, gatewayId } = req.body;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;
//     const whereClause = { id };
//     if (userRole !== "super_admin") whereClause.organizationId = userOrgId;
//     const existing = await prisma.gateway.findFirst({
//       where: whereClause,
//       include: { location: true, floor: { include: { location: true } }, zone: { include: { floor: { include: { location: true } } } } },
//     });
//     if (!existing) return res.status(404).json({ message: "Gateway not found" });
//     if (userRole === "vendor_admin" && locationId) {
//       const newLocation = await prisma.location.findUnique({ where: { id: locationId } });
//       if (!newLocation || newLocation.organizationId !== userOrgId) return res.status(403).json({ message: "You can only assign gateways to locations in your organization" });
//     }
//     if (userRole === "vendor_admin" && floorId) {
//       const newFloor = await prisma.floor.findFirst({ where: { id: floorId }, include: { location: true } });
//       if (!newFloor || newFloor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only assign gateways to floors in your organization" });
//     }
//     if (userRole === "vendor_admin" && zoneId) {
//       const newZone = await prisma.zone.findFirst({ where: { id: zoneId }, include: { floor: { include: { location: true } } } });
//       if (!newZone || newZone.floor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only assign gateways to zones in your organization" });
//     }
//     const updateData = {};
//     if (name !== undefined) updateData.name = name;
//     if (locationId !== undefined) updateData.locationId = locationId || null;
//     if (floorId !== undefined) updateData.floorId = floorId || null;
//     if (zoneId !== undefined) updateData.zoneId = zoneId || null;
//     if (status !== undefined) updateData.status = status;
//     if (frequencyPlanId !== undefined) updateData.frequencyPlanId = frequencyPlanId || null;
//     if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
//     if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
//     if (gatewayId !== undefined) {
//       const resolvedGatewayId = gatewayId ? String(gatewayId).trim().toLowerCase() : null;
//       if (resolvedGatewayId && !/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(resolvedGatewayId)) {
//         return res.status(400).json({ message: "Gateway ID must use lowercase letters, numbers, and hyphens (3-36 characters)" });
//       }
//       updateData.gatewayId = resolvedGatewayId;
//     }
//     if (gatewayEui !== undefined) {
//       const normalizedEui = gatewayEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//       if (normalizedEui.length !== 16) return res.status(400).json({ message: "Gateway EUI must be exactly 16 hexadecimal characters" });
//       updateData.gatewayEui = normalizedEui;
//     }

//     const gateway = await prisma.gateway.update({
//       where: { id }, data: updateData,
//       include: {
//         location: { select: { id: true, city: true, officeName: true } },
//         floor: { select: { id: true, floorName: true } },
//         zone: { select: { id: true, name: true } },
//       },
//     });

//     let resolvedGatewayId = gateway.gatewayId;
//     if (registerGatewayInTTNService) {
//       if (gatewayEui !== undefined && existing.gatewayEui !== gateway.gatewayEui) {
//         if (existing.ttnStatus === "registered") {
//           try {
//             await deleteGatewayFromTTN({ gatewayEui: existing.gatewayEui, gatewayId: existing.gatewayId || existing.ttnDeviceId || undefined });
//           } catch (ttnError) {
//             console.error("TTN gateway delete error during update:", ttnError.message);
//           }
//         }
//         try {
//           const ttnRegistration = await registerGatewayInTTNService({
//             gatewayEui: gateway.gatewayEui,
//             gatewayId: gateway.gatewayId || `gateway-${gateway.gatewayEui.toLowerCase()}`,
//             frequencyPlanId: gateway.frequencyPlanId || undefined,
//             latitude: gateway.latitude || undefined,
//             longitude: gateway.longitude || undefined,
//             description: gateway.name,
//           });
//           ttnStatus = "registered";
//           resolvedGatewayId = ttnRegistration.gatewayId;
//           if (!gateway.frequencyPlanId && ttnRegistration.frequencyPlanId) {
//             await prisma.gateway.update({ where: { id: gateway.id }, data: { frequencyPlanId: ttnRegistration.frequencyPlanId } });
//           }
//         } catch (ttnError) {
//           console.error("TTN gateway re-registration failed after EUI change:", ttnError.message);
//           ttnStatus = "not_registered";
//           resolvedGatewayId = null;
//         }
//       } else if (frequencyPlanId !== undefined || latitude !== undefined || longitude !== undefined || name !== undefined) {
//         try {
//           const ttnRegistration = await registerGatewayInTTNService({
//             gatewayEui: gateway.gatewayEui,
//             gatewayId: gateway.gatewayId || gateway.ttnDeviceId || `gateway-${gateway.gatewayEui.toLowerCase()}`,
//             frequencyPlanId: gateway.frequencyPlanId || undefined,
//             latitude: gateway.latitude || undefined,
//             longitude: gateway.longitude || undefined,
//             description: gateway.name,
//           });
//           ttnStatus = "registered";
//           resolvedGatewayId = ttnRegistration.gatewayId;
//           if (!gateway.frequencyPlanId && ttnRegistration.frequencyPlanId) {
//             await prisma.gateway.update({ where: { id: gateway.id }, data: { frequencyPlanId: ttnRegistration.frequencyPlanId } });
//           }
//         } catch (ttnError) {
//           console.error("TTN gateway update failed:", ttnError.message);
//           if (ttnError.message.includes("409") || ttnError.message.includes("already registered")) {
//             ttnStatus = "registered";
//           } else {
//             ttnStatus = "not_registered";
//           }
//         }
//       }
//     }

//     const finalGateway = await prisma.gateway.update({
//       where: { id: gateway.id },
//       data: { ttnStatus, gatewayId: resolvedGatewayId },
//     });

//     res.status(200).json({
//       message: "Gateway updated successfully",
//       gateway: { id: finalGateway.id, name: finalGateway.name, gatewayEui: finalGateway.gatewayEui, status: finalGateway.status, lastSeen: finalGateway.lastSeen,
//         site: gateway.location?.officeName || gateway.location?.city || null, floor: gateway.floor?.floorName || null, zone: gateway.zone?.name || null,
//         locationId: finalGateway.locationId, floorId: finalGateway.floorId, zoneId: finalGateway.zoneId,
//         ttnStatus: finalGateway.ttnStatus, gatewayId: finalGateway.gatewayId, ttnDeviceId: finalGateway.ttnDeviceId, frequencyPlanId: finalGateway.frequencyPlanId,
//         latitude: finalGateway.latitude, longitude: finalGateway.longitude, connectedDevices: finalGateway.connectedDevices,
//         createdAt: finalGateway.createdAt, updatedAt: finalGateway.updatedAt },
//     });
//   } catch (error) {
//     console.error("Update gateway error:", error);
//     if (error.code === "P2002") return res.status(409).json({ message: "Gateway EUI or name already exists" });
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function deleteGateway(req, res) {
//   try {
//     const { id } = req.params;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;
//     const whereClause = { id };
//     if (userRole !== "super_admin") whereClause.organizationId = userOrgId;
//     const existing = await prisma.gateway.findFirst({ where: whereClause, include: { devices: true } });
//     if (!existing) return res.status(404).json({ message: "Gateway not found" });
//     if (existing.devices.length > 0) return res.status(400).json({ message: "Cannot delete gateway with connected devices. Reassign devices first." });
//     try {
//       await deleteGatewayFromTTN({ gatewayEui: existing.gatewayEui, gatewayId: existing.gatewayId || existing.ttnDeviceId || undefined });
//     } catch (ttnError) {
//       console.error("TTN gateway delete error:", ttnError.message);
//     }
//     await prisma.gateway.delete({ where: { id } });
//     res.status(200).json({ message: "Gateway deleted successfully" });
//   } catch (error) {
//     console.error("Delete gateway error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function registerGatewayInTTN(req, res) {
//   try {
//     const { id } = req.params;
//     const { ttnGatewayId, frequencyPlanId, latitude, longitude, description } = req.body;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;
//     const whereClause = { id };
//     if (userRole !== "super_admin") whereClause.organizationId = userOrgId;
//     const existing = await prisma.gateway.findFirst({ where: whereClause });
//     if (!existing) return res.status(404).json({ message: "Gateway not found" });
//     const resolvedGatewayId = ttnGatewayId || `gateway-${existing.gatewayEui.toLowerCase()}`;
//     const resolvedFrequencyPlan = frequencyPlanId || existing.frequencyPlanId || "EU_863_870";
//     let ttnRegistration = null;
//     try {
//       ttnRegistration = await registerGatewayInTTNService({
//         gatewayEui: existing.gatewayEui, gatewayId: resolvedGatewayId, frequencyPlanId: resolvedFrequencyPlan,
//         latitude: latitude || existing.latitude, longitude: longitude || existing.longitude, description: description || existing.name,
//       });
//     } catch (error) {
//       if (error.message.includes("409") || error.message.includes("already registered")) {
//         return res.status(409).json({ message: `Gateway ${existing.gatewayEui} is already registered on TTN.` });
//       }
//       return res.status(502).json({ message: `TTN gateway registration failed: ${error.message}` });
//     }
//     const gateway = await prisma.gateway.update({ where: { id }, data: { ttnStatus: "registered", gatewayId: resolvedGatewayId, ttnDeviceId: resolvedGatewayId, frequencyPlanId: resolvedFrequencyPlan, latitude: latitude ? parseFloat(latitude) : existing.latitude, longitude: longitude ? parseFloat(longitude) : existing.longitude } });
//     res.status(200).json({ message: "Gateway registered in TTN successfully", gateway, ttnRegistration });
//   } catch (error) {
//     console.error("Register gateway in TTN error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getGatewayDevices(req, res) {
//   try {
//     const { id } = req.params;
//     const whereClause = { id };
//     if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
//     const gateway = await prisma.gateway.findFirst({
//       where: whereClause,
//       include: {
//         devices: {
//           include: { restroom: { include: { floor: { include: { location: true } } } }, zone: true, deviceHealth: { orderBy: { recordedAt: "desc" }, take: 1 } },
//           orderBy: { lastSeen: "desc" },
//         },
//       },
//     });
//     if (!gateway) return res.status(404).json({ message: "Gateway not found" });
//     const mappedDevices = gateway.devices.map((d) => {
//       const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//       const lastSeen = d.lastSeen ? new Date(d.lastSeen) : null;
//       const isOnline = lastSeen && lastSeen > fiveMinutesAgo && d.healthStatus === "healthy";
//       return { id: d.id, name: d.name, deviceEui: d.deviceEui, badgeId: d.badgeId, deviceType: d.deviceType,
//         restroomName: d.restroom?.name || "Unassigned", floorName: d.floor?.floorName || d.restroom?.floor?.floorName || null,
//         battery: d.batteryLevel ?? null, status: isOnline ? "online" : "offline", health: d.healthStatus || "healthy", lastSeen: d.lastSeen,
//         zoneName: d.zone?.name || null, healthRecord: d.deviceHealth?.[0] || null };
//     });
//     res.status(200).json({ message: "Gateway devices fetched successfully", devices: mappedDevices, count: mappedDevices.length });
//   } catch (error) {
//     console.error("Get gateway devices error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getGatewayUplinks(req, res) {
//   try {
//     const { id } = req.params;
//     const { limit = 50 } = req.query;
//     const whereClause = { id };
//     if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
//     const gateway = await prisma.gateway.findFirst({ where: whereClause, include: { devices: { select: { id: true } } } });
//     if (!gateway) return res.status(404).json({ message: "Gateway not found" });
//     const deviceIds = gateway.devices.map((d) => d.id);
//     const uplinks = await prisma.feedback.findMany({
//       where: { deviceId: { in: deviceIds } },
//       include: { device: { select: { id: true, name: true, deviceEui: true, badgeId: true } }, restroom: { select: { id: true, name: true } } },
//       orderBy: { timestamp: "desc" }, take: parseInt(limit),
//     });
//     const mapped = uplinks.map((u) => ({ id: u.id, timestamp: u.timestamp, deviceId: u.deviceId, deviceName: u.device?.name || null,
//       deviceEui: u.device?.deviceEui || null, badgeId: u.device?.badgeId || null, restroomName: u.restroom?.name || null,
//       feedbackType: u.feedbackType, battery: u.battery, signalStrength: u.signalStrength, rawPayload: u.rawPayload }));
//     res.status(200).json({ message: "Gateway uplinks fetched successfully", uplinks: mapped });
//   } catch (error) {
//     console.error("Get gateway uplinks error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getGatewayEvents(req, res) {
//   try {
//     const { id } = req.params;
//     const { limit = 50 } = req.query;
//     const whereClause = { id };
//     if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
//     const gateway = await prisma.gateway.findFirst({
//       where: whereClause,
//       include: {
//         devices: {
//           include: { deviceHealth: { orderBy: { recordedAt: "desc" }, take: parseInt(limit) } },
//         },
//       },
//     });
//     if (!gateway) return res.status(404).json({ message: "Gateway not found" });
//     const deviceIds = gateway.devices.map((d) => d.id);
//     const healthRecords = await prisma.deviceHealthRecord.findMany({
//       where: { deviceId: { in: deviceIds } },
//       include: { device: { select: { id: true, name: true, deviceEui: true, badgeId: true } } },
//       orderBy: { recordedAt: "desc" }, take: parseInt(limit),
//     });
//     const mapped = healthRecords.map((h) => ({ id: h.id, timestamp: h.recordedAt, deviceId: h.deviceId,
//       deviceName: h.device?.name || null, deviceEui: h.device?.deviceEui || null, badgeId: h.device?.badgeId || null,
//       battery: h.battery, signal: h.signal, online: h.online, type: "health_update" }));
//     res.status(200).json({ message: "Gateway events fetched successfully", events: mapped });
//   } catch (error) {
//     console.error("Get gateway events error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getGatewayStatus(req, res) {
//   try {
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;
//     let where = {};
//     if (role !== "super_admin") {
//       const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
//       const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
//       const orgZones = await prisma.zone.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
//       const orgGateways = await prisma.gateway.findMany({
//         where: { OR: [
//           { organizationId: orgId }, { locationId: { in: orgLocations.map((l) => l.id) } },
//           { floorId: { in: orgFloors.map((f) => f.id) } }, { zoneId: { in: orgZones.map((z) => z.id) } },
//         ] }, select: { id: true },
//       });
//       where = orgGateways.length > 0 ? { id: { in: orgGateways.map((g) => g.id) } } : { id: { in: [] } };
//     }
//     const gateways = await prisma.gateway.findMany({ where, orderBy: { updatedAt: "desc" } });
//     const mapped = gateways.map((g) => ({ id: g.id, name: g.name, status: g.status, lastSeen: g.lastSeen, gatewayEui: g.gatewayEui, connectedDevices: g.connectedDevices, createdAt: g.createdAt, updatedAt: g.updatedAt }));
//     res.status(200).json({ message: "Gateway status fetched successfully", gateways: mapped });
//   } catch (error) {
//     console.error("Get gateway status error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function updateGatewayStatus(req, res) {
//   try {
//     const { gatewayName, status } = req.body;
//     if (!gatewayName || !status) return res.status(400).json({ message: "Gateway name and status are required" });
//     const validStatuses = ["online", "offline", "degraded"];
//     if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });
//     const gateway = await prisma.gateway.upsert({
//       where: { gatewayEui: gatewayName },
//       update: { status, lastSeen: new Date() },
//       create: { name: gatewayName, gatewayEui: gatewayName, status, lastSeen: new Date() },
//     });
//     res.status(200).json({ message: "Gateway status updated successfully", gateway });
//   } catch (error) {
//     console.error("Update gateway status error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getNetworkStatus(req, res) {
//   try {
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;
//     let gatewayWhere = {}, deviceWhere = {};
//     if (role !== "super_admin") {
//       const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
//       const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
//       const orgZones = await prisma.zone.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
//       const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
//       gatewayWhere = { OR: [
//         { organizationId: orgId }, { locationId: { in: orgLocations.map((l) => l.id) } },
//         { floorId: { in: orgFloors.map((f) => f.id) } }, { zoneId: { in: orgZones.map((z) => z.id) } },
//       ] };
//       deviceWhere = { OR: [{ restroomId: { in: orgRestrooms.map((r) => r.id) } }, { restroomId: null }] };
//     }
//     const onlineGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "online" } });
//     const degradedGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "degraded" } });
//     const offlineGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "offline" } });
//     const totalDevices = await prisma.device.count({ where: deviceWhere });
//     const onlineDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "healthy", lastSeen: { gt: new Date(Date.now() - 5 * 60 * 1000) } } });
//     const offlineDevices = totalDevices - onlineDevices;
//     res.status(200).json({
//       message: "Network status fetched successfully",
//       gateways: { online: onlineGateways, degraded: degradedGateways, offline: offlineGateways, total: onlineGateways + degradedGateways + offlineGateways },
//       devices: { online: onlineDevices, offline: offlineDevices, total: totalDevices },
//     });
//   } catch (error) {
//     console.error("Get network status error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getOfflineDevices(req, res) {
//   try {
//     const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;
//     let deviceWhere = { OR: [{ lastSeen: { lt: fiveMinutesAgo } }, { healthStatus: { not: "healthy" } }] };
//     if (role !== "super_admin") {
//       const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
//       const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
//       const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
//       deviceWhere = { ...deviceWhere, OR: [{ restroomId: { in: orgRestrooms.map((r) => r.id) } }, { restroomId: null }] };
//     }
//     const devices = await prisma.device.findMany({ where: deviceWhere, include: { restroom: { include: { floor: { include: { location: true } } } }, gateway: true }, orderBy: { lastSeen: "asc" } });
//     const mapped = devices.map((device) => {
//       const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
//       const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";
//       return { id: device.id, badgeId: device.badgeId, deviceEui: device.deviceEui, restroomId: device.restroomId,
//         restroomName: device.restroom?.name || "Unassigned", floorName: device.restroom?.floor?.floorName || null,
//         locationName: device.restroom?.floor?.location?.officeName || null, battery: device.batteryLevel ?? null,
//         status: isOnline ? "online" : "offline", health: device.healthStatus || "healthy", lastCommunication: device.lastSeen,
//         deviceType: device.deviceType, zoneId: device.zoneId, zoneName: device.zone?.name || null,
//         gatewayId: device.gatewayId, gatewayName: device.gateway?.name || null };
//     });
//     res.status(200).json({ message: "Offline devices fetched successfully", devices: mapped, count: mapped.length });
//   } catch (error) {
//     console.error("Get offline devices error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getIncidentLog(req, res) {
//   try {
//     const { startDate, endDate } = req.query;
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;
//     let where = {};
//     if (startDate || endDate) { where.createdAt = {}; if (startDate) where.createdAt.gte = new Date(startDate); if (endDate) where.createdAt.lte = new Date(endDate); }
//     if (role !== "super_admin") {
//       const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
//       const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
//       const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
//       where.restroomId = { in: orgRestrooms.map((r) => r.id) };
//     }
//     const incidents = await prisma.alert.findMany({ where, include: { restroom: { include: { floor: { include: { location: true } } } }, feedback: true, notifications: true }, orderBy: { createdAt: "desc" } });
//     res.status(200).json({ message: "Incident log fetched successfully", incidents });
//   } catch (error) {
//     console.error("Get incident log error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getRecoveryStatus(req, res) {
//   try {
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;
//     let deviceWhere = {}, gatewayWhere = {};
//     if (role !== "super_admin") {
//       const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
//       const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
//       const orgZones = await prisma.zone.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
//       const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
//       deviceWhere = { OR: [{ restroomId: { in: orgRestrooms.map((r) => r.id) } }, { restroomId: null }] };
//       gatewayWhere = { OR: [
//         { organizationId: orgId }, { locationId: { in: orgLocations.map((l) => l.id) } },
//         { floorId: { in: orgFloors.map((f) => f.id) } }, { zoneId: { in: orgZones.map((z) => z.id) } },
//       ] };
//     }
//     const totalDevices = await prisma.device.count({ where: deviceWhere });
//     const healthyDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "healthy" } });
//     const recoveringDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "warning" } });
//     const criticalDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "critical" } });
//     const totalGateways = await prisma.gateway.count({ where: gatewayWhere });
//     const onlineGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "online" } });
//     const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
//     const communicationFailures = await prisma.device.count({ where: { ...deviceWhere, OR: [{ lastSeen: { lt: fiveMinutesAgo } }, { healthStatus: { not: "healthy" } }] } });
//     const totalAlerts = await prisma.alert.count({ where: { status: { not: "closed" } } });
//     res.status(200).json({
//       message: "Recovery status fetched successfully",
//       devices: { total: totalDevices, healthy: healthyDevices, recovering: recoveringDevices, critical: criticalDevices },
//       gateways: { total: totalGateways, online: onlineGateways, offline: totalGateways - onlineGateways },
//       alerts: { total: totalAlerts }, communicationFailures,
//     });
//   } catch (error) {
//     console.error("Get recovery status error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function manualCloseIncident(req, res) {
//   try {
//     const { alertId } = req.params;
//     const userId = req.user?.sub;
//     const userRole = req.user?.role;
//     const userOrgId = req.user?.organizationId;
//     if (!userId) return res.status(401).json({ message: "Authentication required" });
//     const alert = await prisma.alert.findFirst({ where: { id: alertId }, include: { restroom: { include: { floor: { include: { location: true } } } } } });
//     if (!alert) return res.status(404).json({ message: "Alert not found" });
//     if (userRole !== "super_admin" && alert.restroom?.floor?.location?.organizationId !== userOrgId) return res.status(403).json({ message: "You can only close incidents in your organization" });
//     const updated = await prisma.alert.update({ where: { id: alertId }, data: { status: "closed", resolvedAt: new Date(), acknowledgedById: userId }, include: { restroom: true, feedback: true, acknowledgedBy: { select: { id: true, name: true } } } });
//     const settings = await prisma.settings.findFirst();
//     if (settings?.teamsWebhook) {
//       const { sendTeamsWebhook } = require("./teamsWebhookService");
//       sendTeamsWebhook(settings.teamsWebhook, { restroom: alert.restroom?.name || "Unknown", feedbackType: alert.feedback?.feedbackType || "unknown", priority: alert.priority, timestamp: new Date().toISOString(), alertId: alert.id });
//     }
//     res.status(200).json({ message: "Incident closed successfully", alert: updated });
//   } catch (error) {
//     console.error("Manual close incident error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getAuditLog(req, res) {
//   try {
//     const { module, action, startDate, endDate, page = 1, limit = 20 } = req.query;
//     const role = req.user?.role;
//     const orgId = req.user?.organizationId;
//     const where = {};
//     if (module) where.module = module;
//     if (action) where.action = action;
//     if (startDate || endDate) { where.createdAt = {}; if (startDate) where.createdAt.gte = new Date(startDate); if (endDate) where.createdAt.lte = new Date(endDate); }
//     if (role !== "super_admin") where.user = { organizationId: orgId };
//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const [logs, total] = await Promise.all([
//       prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "desc" }, skip, take: parseInt(limit) }),
//       prisma.auditLog.count({ where }),
//     ]);
//     res.status(200).json({ message: "Audit log fetched successfully", logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
//   } catch (error) {
//     console.error("Get audit log error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function getServerStatus(req, res) {
//   try {
//     res.status(200).json({ message: "Server status fetched successfully", server: { status: "operational", uptime: process.uptime(), memory: process.memoryUsage(), timestamp: new Date().toISOString() } });
//   } catch (error) {
//     console.error("Get server status error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// async function createAuditLog(req, res) {
//   try {
//     const { userId, module, action, description } = req.body;
//     if (!module || !action) return res.status(400).json({ message: "Module and action are required" });
//     const log = await prisma.auditLog.create({ data: { userId: userId || null, module, action, description: description || null }, include: { user: { select: { id: true, name: true, email: true, role: true } } } });
//     res.status(201).json({ message: "Audit log created successfully", log });
//   } catch (error) {
//     console.error("Create audit log error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// }

// module.exports = {
//   getGateways, getGatewayById, createGateway, updateGateway, deleteGateway, registerGatewayInTTN,
//   getGatewayDevices, getGatewayUplinks, getGatewayEvents,
//   getGatewayStatus, updateGatewayStatus, getNetworkStatus, getOfflineDevices, getIncidentLog,
//   getRecoveryStatus, manualCloseIncident, getAuditLog, getServerStatus, createAuditLog,
// };
const prisma = require("../config/database");
const { registerGatewayInTTN: registerGatewayInTTNService, deleteGatewayFromTTN } = require("../services/ttnGatewayRegistryService");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getGateways(req, res) {
  try {
    const { status, locationId, floorId, zoneId, search } = req.query;
    const where = { ...getOrgFilter(req) };
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;
    if (floorId) where.floorId = floorId;
    if (zoneId) where.zoneId = zoneId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { gatewayEui: { contains: search, mode: "insensitive" } },
      ];
    }
    const gateways = await prisma.gateway.findMany({
      where,
      include: {
        location: { select: { id: true, city: true, officeName: true } },
        floor: { select: { id: true, floorName: true } },
        zone: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const mapped = gateways.map((g) => ({
      id: g.id, name: g.name, gatewayEui: g.gatewayEui, status: g.status, lastSeen: g.lastSeen,
      site: g.location?.officeName || g.location?.city || null, floor: g.floor?.floorName || null, zone: g.zone?.name || null,
      locationId: g.locationId, floorId: g.floorId, zoneId: g.zoneId,
      ttnStatus: g.ttnStatus, gatewayId: g.gatewayId, ttnDeviceId: g.ttnDeviceId, frequencyPlanId: g.frequencyPlanId,
      latitude: g.latitude, longitude: g.longitude, connectedDevices: g.connectedDevices,
      createdAt: g.createdAt, updatedAt: g.updatedAt,
    }));
    res.status(200).json({ message: "Gateways fetched successfully", gateways: mapped });
  } catch (error) {
    console.error("Get gateways error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getGatewayById(req, res) {
  try {
    const { id } = req.params;
    const whereClause = { id };
    if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
    const gateway = await prisma.gateway.findFirst({
      where: whereClause,
      include: {
        location: true,
        floor: { include: { location: true } },
        zone: { include: { floor: { include: { location: true } } } },
        devices: {
          include: {
            restroom: { include: { floor: { include: { location: true } } } },
            zone: true,
          },
          orderBy: { lastSeen: "desc" },
        },
      },
    });
    if (!gateway) return res.status(404).json({ message: "Gateway not found" });
    const mappedDevices = gateway.devices.map((d) => ({
      id: d.id, name: d.name, deviceEui: d.deviceEui, badgeId: d.badgeId, deviceType: d.deviceType,
      restroomName: d.restroom?.name || "Unassigned",
      floorName: d.floor?.floorName || d.restroom?.floor?.floorName || null,
      battery: d.batteryLevel,
      status: d.lastSeen && d.lastSeen > new Date(Date.now() - 5 * 60 * 1000) && d.healthStatus === "healthy" ? "online" : "offline",
      health: d.healthStatus, lastSeen: d.lastSeen,
    }));
    res.status(200).json({
      message: "Gateway fetched successfully",
      gateway: {
        id: gateway.id, name: gateway.name, gatewayEui: gateway.gatewayEui, status: gateway.status, lastSeen: gateway.lastSeen,
        site: gateway.location?.officeName || gateway.location?.city || null, floor: gateway.floor?.floorName || null, zone: gateway.zone?.name || null,
        locationId: gateway.locationId, floorId: gateway.floorId, zoneId: gateway.zoneId,
        ttnStatus: gateway.ttnStatus, gatewayId: gateway.gatewayId, ttnDeviceId: gateway.ttnDeviceId, frequencyPlanId: gateway.frequencyPlanId,
        latitude: gateway.latitude, longitude: gateway.longitude, connectedDevices: gateway.connectedDevices,
        organizationId: gateway.organizationId, createdAt: gateway.createdAt, updatedAt: gateway.updatedAt,
        devices: mappedDevices,
      },
    });
  } catch (error) {
    console.error("Get gateway error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createGateway(req, res) {
  try {
    const { name, gatewayEui, locationId, floorId, zoneId, frequencyPlanId, latitude, longitude, gatewayId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;
    if (!name || !gatewayEui) return res.status(400).json({ message: "Gateway name and EUI are required" });
    const normalizedEui = gatewayEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
    if (normalizedEui.length !== 16) return res.status(400).json({ message: "Gateway EUI must be exactly 16 hexadecimal characters" });
    const resolvedGatewayId = gatewayId ? String(gatewayId).trim().toLowerCase() : `gateway-${normalizedEui.toLowerCase()}`;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(resolvedGatewayId)) {
      return res.status(400).json({ message: "Gateway ID must use lowercase letters, numbers, and hyphens (3-36 characters)" });
    }
    let organizationId = userOrgId;
    if (locationId) {
      const location = await prisma.location.findUnique({ where: { id: locationId } });
      if (!location) return res.status(404).json({ message: "Location not found" });
      if (userRole === "vendor_admin" && location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only create gateways for locations in your organization" });
      organizationId = location.organizationId;
    }
    if (floorId) {
      const floor = await prisma.floor.findFirst({ where: { id: floorId }, include: { location: true } });
      if (!floor) return res.status(404).json({ message: "Floor not found" });
      if (userRole === "vendor_admin" && floor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only create gateways for floors in your organization" });
      organizationId = organizationId || floor.location.organizationId;
    }
    if (zoneId) {
      const zone = await prisma.zone.findFirst({ where: { id: zoneId }, include: { floor: { include: { location: true } } } });
      if (!zone) return res.status(404).json({ message: "Zone not found" });
      if (userRole === "vendor_admin" && zone.floor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only create gateways for zones in your organization" });
      organizationId = organizationId || zone.floor.location.organizationId;
    }
    const existing = await prisma.gateway.findFirst({ where: { OR: [{ gatewayEui: normalizedEui }, { name }] }, select: { id: true } });
    if (existing) return res.status(409).json({ message: "Gateway EUI or name already exists" });
    const gateway = await prisma.gateway.create({
      data: {
        name, gatewayEui: normalizedEui, organizationId, gatewayId: resolvedGatewayId,
        locationId: locationId || null, floorId: floorId || null, zoneId: zoneId || null,
        frequencyPlanId: frequencyPlanId || null,
        latitude: latitude ? parseFloat(latitude) : null, longitude: longitude ? parseFloat(longitude) : null, status: "offline",
      },
      include: {
        location: { select: { id: true, city: true, officeName: true } },
        floor: { select: { id: true, floorName: true } },
        zone: { select: { id: true, name: true } },
      },
    });

    let ttnRegistration = null;
    let ttnStatus = "not_registered";
    let ttnErrorMessage = null;
    if (registerGatewayInTTNService) {
      try {
        ttnRegistration = await registerGatewayInTTNService({
          gatewayEui: gateway.gatewayEui,
          gatewayId: resolvedGatewayId,
          frequencyPlanId: gateway.frequencyPlanId || undefined,
          latitude: gateway.latitude || undefined,
          longitude: gateway.longitude || undefined,
          description: gateway.name,
        });
        ttnStatus = "registered";
      } catch (ttnError) {
        console.error("TTN gateway registration failed:", ttnError.message);
        ttnStatus = "not_registered";
        ttnErrorMessage = ttnError.message;
      }
    }

    const updatedGateway = await prisma.gateway.update({
      where: { id: gateway.id },
      data: {
        ttnStatus,
        gatewayId: ttnRegistration?.gatewayId || gateway.gatewayId,
        ttnDeviceId: ttnRegistration?.gatewayId || gateway.gatewayId,
        frequencyPlanId: ttnRegistration?.frequencyPlanId || gateway.frequencyPlanId,
      },
    });

    res.status(201).json({
      message: ttnStatus === "registered" ? "Gateway created successfully" : "Gateway saved, but TTN registration failed",
      ttnError: ttnErrorMessage,
      gateway: { id: updatedGateway.id, name: updatedGateway.name, gatewayEui: updatedGateway.gatewayEui, status: updatedGateway.status, lastSeen: updatedGateway.lastSeen,
        site: gateway.location?.officeName || gateway.location?.city || null, floor: gateway.floor?.floorName || null, zone: gateway.zone?.name || null,
        locationId: updatedGateway.locationId, floorId: updatedGateway.floorId, zoneId: updatedGateway.zoneId,
        ttnStatus: updatedGateway.ttnStatus, gatewayId: updatedGateway.gatewayId, ttnDeviceId: updatedGateway.ttnDeviceId, frequencyPlanId: updatedGateway.frequencyPlanId,
        latitude: updatedGateway.latitude, longitude: updatedGateway.longitude, connectedDevices: updatedGateway.connectedDevices,
        createdAt: updatedGateway.createdAt, updatedAt: updatedGateway.updatedAt },
    });
  } catch (error) {
    console.error("Create gateway error:", error);
    if (error.code === "P2002") return res.status(409).json({ message: "Gateway EUI or name already exists" });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateGateway(req, res) {
  try {
    const { id } = req.params;
    const { name, gatewayEui, locationId, floorId, zoneId, status, frequencyPlanId, latitude, longitude, gatewayId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;
    const whereClause = { id };
    if (userRole !== "super_admin") whereClause.organizationId = userOrgId;
    const existing = await prisma.gateway.findFirst({
      where: whereClause,
      include: { location: true, floor: { include: { location: true } }, zone: { include: { floor: { include: { location: true } } } } },
    });
    if (!existing) return res.status(404).json({ message: "Gateway not found" });
    if (userRole === "vendor_admin" && locationId) {
      const newLocation = await prisma.location.findUnique({ where: { id: locationId } });
      if (!newLocation || newLocation.organizationId !== userOrgId) return res.status(403).json({ message: "You can only assign gateways to locations in your organization" });
    }
    if (userRole === "vendor_admin" && floorId) {
      const newFloor = await prisma.floor.findFirst({ where: { id: floorId }, include: { location: true } });
      if (!newFloor || newFloor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only assign gateways to floors in your organization" });
    }
    if (userRole === "vendor_admin" && zoneId) {
      const newZone = await prisma.zone.findFirst({ where: { id: zoneId }, include: { floor: { include: { location: true } } } });
      if (!newZone || newZone.floor.location.organizationId !== userOrgId) return res.status(403).json({ message: "You can only assign gateways to zones in your organization" });
    }
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (locationId !== undefined) updateData.locationId = locationId || null;
    if (floorId !== undefined) updateData.floorId = floorId || null;
    if (zoneId !== undefined) updateData.zoneId = zoneId || null;
    if (status !== undefined) updateData.status = status;
    if (frequencyPlanId !== undefined) updateData.frequencyPlanId = frequencyPlanId || null;
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
    if (gatewayId !== undefined) {
      const resolvedGatewayId = gatewayId ? String(gatewayId).trim().toLowerCase() : null;
      if (resolvedGatewayId && !/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(resolvedGatewayId)) {
        return res.status(400).json({ message: "Gateway ID must use lowercase letters, numbers, and hyphens (3-36 characters)" });
      }
      updateData.gatewayId = resolvedGatewayId;
    }
    if (gatewayEui !== undefined) {
      const normalizedEui = gatewayEui.trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
      if (normalizedEui.length !== 16) return res.status(400).json({ message: "Gateway EUI must be exactly 16 hexadecimal characters" });
      updateData.gatewayEui = normalizedEui;
    }

    const gateway = await prisma.gateway.update({
      where: { id }, data: updateData,
      include: {
        location: { select: { id: true, city: true, officeName: true } },
        floor: { select: { id: true, floorName: true } },
        zone: { select: { id: true, name: true } },
      },
    });

    let resolvedGatewayId = gateway.gatewayId;
    let ttnStatus = existing.ttnStatus;
    let ttnErrorMessage = null;
    if (registerGatewayInTTNService) {
      if (gatewayEui !== undefined && existing.gatewayEui !== gateway.gatewayEui) {
        if (existing.ttnStatus === "registered") {
          try {
            await deleteGatewayFromTTN({ gatewayEui: existing.gatewayEui, gatewayId: existing.gatewayId || existing.ttnDeviceId || undefined });
          } catch (ttnError) {
            console.error("TTN gateway delete error during update:", ttnError.message);
          }
        }
        try {
          const ttnRegistration = await registerGatewayInTTNService({
            gatewayEui: gateway.gatewayEui,
            gatewayId: gateway.gatewayId || `gateway-${gateway.gatewayEui.toLowerCase()}`,
            frequencyPlanId: gateway.frequencyPlanId || undefined,
            latitude: gateway.latitude || undefined,
            longitude: gateway.longitude || undefined,
            description: gateway.name,
          });
          ttnStatus = "registered";
          resolvedGatewayId = ttnRegistration.gatewayId;
          if (!gateway.frequencyPlanId && ttnRegistration.frequencyPlanId) {
            await prisma.gateway.update({ where: { id: gateway.id }, data: { frequencyPlanId: ttnRegistration.frequencyPlanId } });
          }
        } catch (ttnError) {
          console.error("TTN gateway re-registration failed after EUI change:", ttnError.message);
          ttnStatus = "not_registered";
          ttnErrorMessage = ttnError.message;
          resolvedGatewayId = null;
        }
      } else if (frequencyPlanId !== undefined || latitude !== undefined || longitude !== undefined || name !== undefined) {
        try {
          const ttnRegistration = await registerGatewayInTTNService({
            gatewayEui: gateway.gatewayEui,
            gatewayId: gateway.gatewayId || gateway.ttnDeviceId || `gateway-${gateway.gatewayEui.toLowerCase()}`,
            frequencyPlanId: gateway.frequencyPlanId || undefined,
            latitude: gateway.latitude || undefined,
            longitude: gateway.longitude || undefined,
            description: gateway.name,
          });
          ttnStatus = "registered";
          resolvedGatewayId = ttnRegistration.gatewayId;
          if (!gateway.frequencyPlanId && ttnRegistration.frequencyPlanId) {
            await prisma.gateway.update({ where: { id: gateway.id }, data: { frequencyPlanId: ttnRegistration.frequencyPlanId } });
          }
        } catch (ttnError) {
          console.error("TTN gateway update failed:", ttnError.message);
          ttnErrorMessage = ttnError.message;
          if (ttnError.message.includes("409") || ttnError.message.includes("already registered")) {
            ttnStatus = "registered";
          } else {
            ttnStatus = "not_registered";
          }
        }
      }
    }

    const finalGateway = await prisma.gateway.update({
      where: { id: gateway.id },
      data: { ttnStatus, gatewayId: resolvedGatewayId },
    });

    res.status(200).json({
      message: ttnErrorMessage ? "Gateway updated, but TTN sync failed" : "Gateway updated successfully",
      ttnError: ttnErrorMessage,
      gateway: { id: finalGateway.id, name: finalGateway.name, gatewayEui: finalGateway.gatewayEui, status: finalGateway.status, lastSeen: finalGateway.lastSeen,
        site: gateway.location?.officeName || gateway.location?.city || null, floor: gateway.floor?.floorName || null, zone: gateway.zone?.name || null,
        locationId: finalGateway.locationId, floorId: finalGateway.floorId, zoneId: finalGateway.zoneId,
        ttnStatus: finalGateway.ttnStatus, gatewayId: finalGateway.gatewayId, ttnDeviceId: finalGateway.ttnDeviceId, frequencyPlanId: finalGateway.frequencyPlanId,
        latitude: finalGateway.latitude, longitude: finalGateway.longitude, connectedDevices: finalGateway.connectedDevices,
        createdAt: finalGateway.createdAt, updatedAt: finalGateway.updatedAt },
    });
  } catch (error) {
    console.error("Update gateway error:", error);
    if (error.code === "P2002") return res.status(409).json({ message: "Gateway EUI or name already exists" });
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteGateway(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;
    const whereClause = { id };
    if (userRole !== "super_admin") whereClause.organizationId = userOrgId;
    const existing = await prisma.gateway.findFirst({ where: whereClause, include: { devices: true } });
    if (!existing) return res.status(404).json({ message: "Gateway not found" });
    if (existing.devices.length > 0) return res.status(400).json({ message: "Cannot delete gateway with connected devices. Reassign devices first." });
    let ttnDeleted = false;
    let ttnDeleteError = null;
    const candidateIds = [
      existing.gatewayId,
      existing.ttnDeviceId,
      `gateway-${existing.gatewayEui.toLowerCase()}`,
      existing.gatewayEui,
    ].filter(Boolean);

    for (const candidate of candidateIds) {
      try {
        await deleteGatewayFromTTN({ gatewayEui: existing.gatewayEui, gatewayId: candidate });
        ttnDeleted = true;
        break;
      } catch (ttnError) {
        ttnDeleteError = ttnError.message;
        console.warn(`[Gateway] TTN delete attempt failed for ${candidate}:`, ttnError.message);
      }
    }

    await prisma.gateway.delete({ where: { id } });
    res.status(200).json({
      message: ttnDeleted ? "Gateway deleted successfully from app and TTN" : "Gateway deleted from app, but could not delete from TTN. Please delete it manually from TTN Console.",
      ttnDeleted,
      ttnDeleteError,
    });
  } catch (error) {
    console.error("Delete gateway error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function registerGatewayInTTN(req, res) {
  try {
    const { id } = req.params;
    const { ttnGatewayId, frequencyPlanId, latitude, longitude, description } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;
    const whereClause = { id };
    if (userRole !== "super_admin") whereClause.organizationId = userOrgId;
    const existing = await prisma.gateway.findFirst({ where: whereClause });
    if (!existing) return res.status(404).json({ message: "Gateway not found" });
    const resolvedGatewayId = ttnGatewayId || `gateway-${existing.gatewayEui.toLowerCase()}`;
    const resolvedFrequencyPlan = frequencyPlanId || existing.frequencyPlanId || "EU_863_870";
    let ttnRegistration = null;
    try {
      ttnRegistration = await registerGatewayInTTNService({
        gatewayEui: existing.gatewayEui, gatewayId: resolvedGatewayId, frequencyPlanId: resolvedFrequencyPlan,
        latitude: latitude || existing.latitude, longitude: longitude || existing.longitude, description: description || existing.name,
      });
    } catch (error) {
      if (error.message.includes("409") || error.message.includes("already registered")) {
        return res.status(409).json({ message: `Gateway ${existing.gatewayEui} is already registered on TTN.` });
      }
      return res.status(502).json({ message: `TTN gateway registration failed: ${error.message}` });
    }
    const gateway = await prisma.gateway.update({ where: { id }, data: { ttnStatus: "registered", gatewayId: resolvedGatewayId, ttnDeviceId: resolvedGatewayId, frequencyPlanId: resolvedFrequencyPlan, latitude: latitude ? parseFloat(latitude) : existing.latitude, longitude: longitude ? parseFloat(longitude) : existing.longitude } });
    res.status(200).json({ message: "Gateway registered in TTN successfully", gateway, ttnRegistration });
  } catch (error) {
    console.error("Register gateway in TTN error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getGatewayDevices(req, res) {
  try {
    const { id } = req.params;
    const whereClause = { id };
    if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
    const gateway = await prisma.gateway.findFirst({
      where: whereClause,
      include: {
        devices: {
          include: { restroom: { include: { floor: { include: { location: true } } } }, zone: true, deviceHealth: { orderBy: { recordedAt: "desc" }, take: 1 } },
          orderBy: { lastSeen: "desc" },
        },
      },
    });
    if (!gateway) return res.status(404).json({ message: "Gateway not found" });
    const mappedDevices = gateway.devices.map((d) => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const lastSeen = d.lastSeen ? new Date(d.lastSeen) : null;
      const isOnline = lastSeen && lastSeen > fiveMinutesAgo && d.healthStatus === "healthy";
      return { id: d.id, name: d.name, deviceEui: d.deviceEui, badgeId: d.badgeId, deviceType: d.deviceType,
        restroomName: d.restroom?.name || "Unassigned", floorName: d.floor?.floorName || d.restroom?.floor?.floorName || null,
        battery: d.batteryLevel ?? null, status: isOnline ? "online" : "offline", health: d.healthStatus || "healthy", lastSeen: d.lastSeen,
        zoneName: d.zone?.name || null, healthRecord: d.deviceHealth?.[0] || null };
    });
    res.status(200).json({ message: "Gateway devices fetched successfully", devices: mappedDevices, count: mappedDevices.length });
  } catch (error) {
    console.error("Get gateway devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getGatewayUplinks(req, res) {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    const whereClause = { id };
    if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
    const gateway = await prisma.gateway.findFirst({ where: whereClause, include: { devices: { select: { id: true } } } });
    if (!gateway) return res.status(404).json({ message: "Gateway not found" });
    const deviceIds = gateway.devices.map((d) => d.id);
    const uplinks = await prisma.feedback.findMany({
      where: { deviceId: { in: deviceIds } },
      include: { device: { select: { id: true, name: true, deviceEui: true, badgeId: true } }, restroom: { select: { id: true, name: true } } },
      orderBy: { timestamp: "desc" }, take: parseInt(limit),
    });
    const mapped = uplinks.map((u) => ({ id: u.id, timestamp: u.timestamp, deviceId: u.deviceId, deviceName: u.device?.name || null,
      deviceEui: u.device?.deviceEui || null, badgeId: u.device?.badgeId || null, restroomName: u.restroom?.name || null,
      feedbackType: u.feedbackType, battery: u.battery, signalStrength: u.signalStrength, rawPayload: u.rawPayload }));
    res.status(200).json({ message: "Gateway uplinks fetched successfully", uplinks: mapped });
  } catch (error) {
    console.error("Get gateway uplinks error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getGatewayEvents(req, res) {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    const whereClause = { id };
    if (req.user?.role !== "super_admin") whereClause.organizationId = req.user?.organizationId;
    const gateway = await prisma.gateway.findFirst({
      where: whereClause,
      include: {
        devices: {
          include: { deviceHealth: { orderBy: { recordedAt: "desc" }, take: parseInt(limit) } },
        },
      },
    });
    if (!gateway) return res.status(404).json({ message: "Gateway not found" });
    const deviceIds = gateway.devices.map((d) => d.id);
    const healthRecords = await prisma.deviceHealthRecord.findMany({
      where: { deviceId: { in: deviceIds } },
      include: { device: { select: { id: true, name: true, deviceEui: true, badgeId: true } } },
      orderBy: { recordedAt: "desc" }, take: parseInt(limit),
    });
    const mapped = healthRecords.map((h) => ({ id: h.id, timestamp: h.recordedAt, deviceId: h.deviceId,
      deviceName: h.device?.name || null, deviceEui: h.device?.deviceEui || null, badgeId: h.device?.badgeId || null,
      battery: h.battery, signal: h.signal, online: h.online, type: "health_update" }));
    res.status(200).json({ message: "Gateway events fetched successfully", events: mapped });
  } catch (error) {
    console.error("Get gateway events error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getGatewayStatus(req, res) {
  try {
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let where = {};
    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgZones = await prisma.zone.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      const orgGateways = await prisma.gateway.findMany({
        where: { OR: [
          { organizationId: orgId }, { locationId: { in: orgLocations.map((l) => l.id) } },
          { floorId: { in: orgFloors.map((f) => f.id) } }, { zoneId: { in: orgZones.map((z) => z.id) } },
        ] }, select: { id: true },
      });
      where = orgGateways.length > 0 ? { id: { in: orgGateways.map((g) => g.id) } } : { id: { in: [] } };
    }
    const gateways = await prisma.gateway.findMany({ where, orderBy: { updatedAt: "desc" } });
    const mapped = gateways.map((g) => ({ id: g.id, name: g.name, status: g.status, lastSeen: g.lastSeen, gatewayEui: g.gatewayEui, connectedDevices: g.connectedDevices, createdAt: g.createdAt, updatedAt: g.updatedAt }));
    res.status(200).json({ message: "Gateway status fetched successfully", gateways: mapped });
  } catch (error) {
    console.error("Get gateway status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateGatewayStatus(req, res) {
  try {
    const { gatewayName, status } = req.body;
    if (!gatewayName || !status) return res.status(400).json({ message: "Gateway name and status are required" });
    const validStatuses = ["online", "offline", "degraded"];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });
    const gateway = await prisma.gateway.upsert({
      where: { gatewayEui: gatewayName },
      update: { status, lastSeen: new Date() },
      create: { name: gatewayName, gatewayEui: gatewayName, status, lastSeen: new Date() },
    });
    res.status(200).json({ message: "Gateway status updated successfully", gateway });
  } catch (error) {
    console.error("Update gateway status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getNetworkStatus(req, res) {
  try {
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let gatewayWhere = {}, deviceWhere = {};
    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgZones = await prisma.zone.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      gatewayWhere = { OR: [
        { organizationId: orgId }, { locationId: { in: orgLocations.map((l) => l.id) } },
        { floorId: { in: orgFloors.map((f) => f.id) } }, { zoneId: { in: orgZones.map((z) => z.id) } },
      ] };
      deviceWhere = { OR: [{ restroomId: { in: orgRestrooms.map((r) => r.id) } }, { restroomId: null }] };
    }
    const onlineGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "online" } });
    const degradedGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "degraded" } });
    const offlineGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "offline" } });
    const totalDevices = await prisma.device.count({ where: deviceWhere });
    const onlineDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "healthy", lastSeen: { gt: new Date(Date.now() - 5 * 60 * 1000) } } });
    const offlineDevices = totalDevices - onlineDevices;
    res.status(200).json({
      message: "Network status fetched successfully",
      gateways: { online: onlineGateways, degraded: degradedGateways, offline: offlineGateways, total: onlineGateways + degradedGateways + offlineGateways },
      devices: { online: onlineDevices, offline: offlineDevices, total: totalDevices },
    });
  } catch (error) {
    console.error("Get network status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getOfflineDevices(req, res) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let deviceWhere = { OR: [{ lastSeen: { lt: fiveMinutesAgo } }, { healthStatus: { not: "healthy" } }] };
    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      deviceWhere = { ...deviceWhere, OR: [{ restroomId: { in: orgRestrooms.map((r) => r.id) } }, { restroomId: null }] };
    }
    const devices = await prisma.device.findMany({ where: deviceWhere, include: { restroom: { include: { floor: { include: { location: true } } } }, gateway: true }, orderBy: { lastSeen: "asc" } });
    const mapped = devices.map((device) => {
      const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
      const isOnline = lastSeen && lastSeen > fiveMinutesAgo && device.healthStatus === "healthy";
      return { id: device.id, badgeId: device.badgeId, deviceEui: device.deviceEui, restroomId: device.restroomId,
        restroomName: device.restroom?.name || "Unassigned", floorName: device.restroom?.floor?.floorName || null,
        locationName: device.restroom?.floor?.location?.officeName || null, battery: device.batteryLevel ?? null,
        status: isOnline ? "online" : "offline", health: device.healthStatus || "healthy", lastCommunication: device.lastSeen,
        deviceType: device.deviceType, zoneId: device.zoneId, zoneName: device.zone?.name || null,
        gatewayId: device.gatewayId, gatewayName: device.gateway?.name || null };
    });
    res.status(200).json({ message: "Offline devices fetched successfully", devices: mapped, count: mapped.length });
  } catch (error) {
    console.error("Get offline devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getIncidentLog(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let where = {};
    if (startDate || endDate) { where.createdAt = {}; if (startDate) where.createdAt.gte = new Date(startDate); if (endDate) where.createdAt.lte = new Date(endDate); }
    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      where.restroomId = { in: orgRestrooms.map((r) => r.id) };
    }
    const incidents = await prisma.alert.findMany({ where, include: { restroom: { include: { floor: { include: { location: true } } } }, feedback: true, notifications: true }, orderBy: { createdAt: "desc" } });
    res.status(200).json({ message: "Incident log fetched successfully", incidents });
  } catch (error) {
    console.error("Get incident log error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getRecoveryStatus(req, res) {
  try {
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let deviceWhere = {}, gatewayWhere = {};
    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgZones = await prisma.zone.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      deviceWhere = { OR: [{ restroomId: { in: orgRestrooms.map((r) => r.id) } }, { restroomId: null }] };
      gatewayWhere = { OR: [
        { organizationId: orgId }, { locationId: { in: orgLocations.map((l) => l.id) } },
        { floorId: { in: orgFloors.map((f) => f.id) } }, { zoneId: { in: orgZones.map((z) => z.id) } },
      ] };
    }
    const totalDevices = await prisma.device.count({ where: deviceWhere });
    const healthyDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "healthy" } });
    const recoveringDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "warning" } });
    const criticalDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "critical" } });
    const totalGateways = await prisma.gateway.count({ where: gatewayWhere });
    const onlineGateways = await prisma.gateway.count({ where: { ...gatewayWhere, status: "online" } });
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const communicationFailures = await prisma.device.count({ where: { ...deviceWhere, OR: [{ lastSeen: { lt: fiveMinutesAgo } }, { healthStatus: { not: "healthy" } }] } });
    const totalAlerts = await prisma.alert.count({ where: { status: { not: "closed" } } });
    res.status(200).json({
      message: "Recovery status fetched successfully",
      devices: { total: totalDevices, healthy: healthyDevices, recovering: recoveringDevices, critical: criticalDevices },
      gateways: { total: totalGateways, online: onlineGateways, offline: totalGateways - onlineGateways },
      alerts: { total: totalAlerts }, communicationFailures,
    });
  } catch (error) {
    console.error("Get recovery status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function manualCloseIncident(req, res) {
  try {
    const { alertId } = req.params;
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    const alert = await prisma.alert.findFirst({ where: { id: alertId }, include: { restroom: { include: { floor: { include: { location: true } } } } } });
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    if (userRole !== "super_admin" && alert.restroom?.floor?.location?.organizationId !== userOrgId) return res.status(403).json({ message: "You can only close incidents in your organization" });
    const updated = await prisma.alert.update({ where: { id: alertId }, data: { status: "closed", resolvedAt: new Date(), acknowledgedById: userId }, include: { restroom: true, feedback: true, acknowledgedBy: { select: { id: true, name: true } } } });
    const settings = await prisma.settings.findFirst();
    if (settings?.teamsWebhook) {
      const { sendTeamsWebhook } = require("./teamsWebhookService");
      sendTeamsWebhook(settings.teamsWebhook, { restroom: alert.restroom?.name || "Unknown", feedbackType: alert.feedback?.feedbackType || "unknown", priority: alert.priority, timestamp: new Date().toISOString(), alertId: alert.id });
    }
    res.status(200).json({ message: "Incident closed successfully", alert: updated });
  } catch (error) {
    console.error("Manual close incident error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getAuditLog(req, res) {
  try {
    const { module, action, startDate, endDate, page = 1, limit = 20 } = req.query;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    const where = {};
    if (module) where.module = module;
    if (action) where.action = action;
    if (startDate || endDate) { where.createdAt = {}; if (startDate) where.createdAt.gte = new Date(startDate); if (endDate) where.createdAt.lte = new Date(endDate); }
    if (role !== "super_admin") where.user = { organizationId: orgId };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "desc" }, skip, take: parseInt(limit) }),
      prisma.auditLog.count({ where }),
    ]);
    res.status(200).json({ message: "Audit log fetched successfully", logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getServerStatus(req, res) {
  try {
    res.status(200).json({ message: "Server status fetched successfully", server: { status: "operational", uptime: process.uptime(), memory: process.memoryUsage(), timestamp: new Date().toISOString() } });
  } catch (error) {
    console.error("Get server status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createAuditLog(req, res) {
  try {
    const { userId, module, action, description } = req.body;
    if (!module || !action) return res.status(400).json({ message: "Module and action are required" });
    const log = await prisma.auditLog.create({ data: { userId: userId || null, module, action, description: description || null }, include: { user: { select: { id: true, name: true, email: true, role: true } } } });
    res.status(201).json({ message: "Audit log created successfully", log });
  } catch (error) {
    console.error("Create audit log error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getGateways, getGatewayById, createGateway, updateGateway, deleteGateway, registerGatewayInTTN,
  getGatewayDevices, getGatewayUplinks, getGatewayEvents,
  getGatewayStatus, updateGatewayStatus, getNetworkStatus, getOfflineDevices, getIncidentLog,
  getRecoveryStatus, manualCloseIncident, getAuditLog, getServerStatus, createAuditLog,
};