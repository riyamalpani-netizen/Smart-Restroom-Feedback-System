const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

const ZONE_TYPES = ["restroom", "corridor", "lobby", "maintenance", "other"];

async function getZones(req, res) {
  try {
    const { floorId, organizationId } = req.query;
    const orgFilter = getOrgFilter(req);
    const where = {};

    if (floorId) {
      const floorWhere = { id: floorId };
      if (req.user?.role !== "super_admin") {
        floorWhere.location = { organizationId: req.user.organizationId };
      }
      const floor = await prisma.floor.findFirst({
        where: floorWhere,
        select: { id: true },
      });
      if (!floor) {
        return res.status(404).json({ message: "Floor not found" });
      }
      where.floorId = floorId;
    }

    if (organizationId && req.user?.role === "super_admin") {
      const orgFilterWithOrg = { organizationId: organizationId };
      where.floor = { location: orgFilterWithOrg };
    } else if (orgFilter.organizationId) {
      where.floor = { location: orgFilter };
    }

    const zones = await prisma.zone.findMany({
      where,
      include: {
        floor: { include: { location: true } },
        restroom: true,
        _count: { select: { devices: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Zones fetched successfully",
      zones,
    });
  } catch (error) {
    console.error("Get zones error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getZoneById(req, res) {
  try {
    const { id } = req.params;
    const orgFilter = getOrgFilter(req);

    const zone = await prisma.zone.findFirst({
      where: { id, floor: { location: { ...orgFilter } } },
      include: {
        floor: { include: { location: true } },
        restroom: true,
        devices: { include: { restroom: true } },
      },
    });

    if (!zone) {
      return res.status(404).json({ message: "Zone not found" });
    }

    res.status(200).json({
      message: "Zone fetched successfully",
      zone,
    });
  } catch (error) {
    console.error("Get zone error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createZone(req, res) {
  try {
    const { floorId, name, type, coordinates, restroomId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!floorId || !name) {
      return res.status(400).json({ message: "Floor ID and name are required" });
    }

    const floor = await prisma.floor.findFirst({
      where: { id: floorId },
      include: { location: true },
    });

    if (!floor) {
      return res.status(404).json({ message: "Floor not found" });
    }

    if (userRole === "vendor_admin" && floor.location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create zones for floors in your organization" });
    }

    if (restroomId) {
      const restroom = await prisma.restroom.findFirst({
        where: { id: restroomId, floorId: floorId },
      });
      if (!restroom) {
        return res.status(404).json({ message: "Restroom not found on this floor" });
      }
    }

    const zoneType = type || "other";
    if (!ZONE_TYPES.includes(zoneType)) {
      return res.status(400).json({ message: `Invalid zone type. Must be one of: ${ZONE_TYPES.join(", ")}` });
    }

    const zone = await prisma.zone.create({
      data: {
        floorId,
        name,
        type: zoneType,
        coordinates,
        restroomId,
      },
      include: {
        floor: { include: { location: true } },
        restroom: true,
      },
    });

    res.status(201).json({
      message: "Zone created successfully",
      zone,
    });
  } catch (error) {
    console.error("Create zone error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateZone(req, res) {
  try {
    const { id } = req.params;
    const { name, type, coordinates, restroomId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.zone.findFirst({
      where: { id },
      include: { floor: { include: { location: true } } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Zone not found" });
    }

    if (userRole === "vendor_admin" && existing.floor.location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only update zones in your organization" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      if (!ZONE_TYPES.includes(type)) {
        return res.status(400).json({ message: `Invalid zone type. Must be one of: ${ZONE_TYPES.join(", ")}` });
      }
      updateData.type = type;
    }
    if (coordinates !== undefined) updateData.coordinates = coordinates;
    if (restroomId !== undefined) updateData.restroomId = restroomId || null;

    const zone = await prisma.zone.update({
      where: { id },
      data: updateData,
      include: {
        floor: { include: { location: true } },
        restroom: true,
      },
    });

    res.status(200).json({
      message: "Zone updated successfully",
      zone,
    });
  } catch (error) {
    console.error("Update zone error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteZone(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.zone.findFirst({
      where: { id },
      include: { floor: { include: { location: true } } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Zone not found" });
    }

    if (userRole === "vendor_admin" && existing.floor.location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only delete zones in your organization" });
    }

    await prisma.zone.delete({
      where: { id },
    });

    res.status(200).json({
      message: "Zone deleted successfully",
    });
  } catch (error) {
    console.error("Delete zone error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function importGeoJson(req, res) {
  try {
    const { floorId, geoJson } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!floorId || !geoJson) {
      return res.status(400).json({ message: "Floor ID and GeoJSON data are required" });
    }

    const floor = await prisma.floor.findFirst({
      where: { id: floorId },
      include: { location: true },
    });

    if (!floor) {
      return res.status(404).json({ message: "Floor not found" });
    }

    if (userRole === "vendor_admin" && floor.location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only import zones for floors in your organization" });
    }

    const features = geoJson.features || [];
    const createdZones = [];

    for (const feature of features) {
      const geomType = feature.geometry?.type;
      const coords = feature.geometry?.coordinates;
      const props = feature.properties || {};

      if (!geomType || !coords) continue;

      const zoneType = props.zoneType || props.type || "other";
      const zoneName = props.name || props.zoneName || props.title || `Zone ${createdZones.length + 1}`;

      const coordinates = {
        type: geomType,
        coordinates: coords,
      };

      const zone = await prisma.zone.create({
        data: {
          floorId,
          name: zoneName,
          type: ZONE_TYPES.includes(zoneType) ? zoneType : "other",
          coordinates,
        },
      });

      createdZones.push(zone);
    }

    res.status(201).json({
      message: `Imported ${createdZones.length} zones from GeoJSON`,
      zones: createdZones,
    });
  } catch (error) {
    console.error("Import GeoJSON error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  importGeoJson,
};
