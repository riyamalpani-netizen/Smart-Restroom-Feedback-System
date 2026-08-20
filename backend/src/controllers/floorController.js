const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getFloors(req, res) {
  try {
    const { locationId } = req.query;
    const orgFilter = getOrgFilter(req);
    const where = locationId ? { locationId } : {};

    const location = locationId ? await prisma.location.findUnique({ where: { id: locationId } }) : null;
    if (location && req.user?.role !== "super_admin" && location.organizationId !== req.user?.organizationId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const floors = await prisma.floor.findMany({
      where,
      include: {
        restrooms: { include: { devices: true } },
        location: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Floors fetched successfully",
      floors,
    });
  } catch (error) {
    console.error("Get floors error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getFloorById(req, res) {
  try {
    const { id } = req.params;
    const orgFilter = getOrgFilter(req);

    const floor = await prisma.floor.findFirst({
      where: { id, location: { ...orgFilter } },
      include: {
        restrooms: { include: { devices: true } },
        location: true,
      },
    });

    if (!floor) {
      return res.status(404).json({ message: "Floor not found" });
    }

    res.status(200).json({ message: "Floor fetched successfully", floor });
  } catch (error) {
    console.error("Get floor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createFloor(req, res) {
  try {
    const { locationId, floorName, floorNumber } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!locationId || !floorName) {
      return res.status(400).json({ message: "Location ID and floor name are required" });
    }

    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    if (userRole === "vendor_admin" && location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create floors in your own organization" });
    }

    const floor = await prisma.floor.create({
      data: { locationId, floorName, floorNumber: floorNumber ?? null },
    });

    res.status(201).json({ message: "Floor created successfully", floor });
  } catch (error) {
    console.error("Create floor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateFloor(req, res) {
  try {
    const { id } = req.params;
    const { floorName, floorNumber } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.floor.findFirst({
      where: { id, location: { ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) } },
      include: { location: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Floor not found" });
    }

    const floor = await prisma.floor.update({
      where: { id },
      data: { floorName, ...(floorNumber !== undefined ? { floorNumber } : {}) },
    });

    res.status(200).json({ message: "Floor updated successfully", floor });
  } catch (error) {
    console.error("Update floor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteFloor(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.floor.findFirst({
      where: { id, location: { ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Floor not found" });
    }

    const [restrooms, zones] = await Promise.all([
      prisma.restroom.findMany({ where: { floorId: id }, select: { id: true } }),
      prisma.zone.findMany({ where: { floorId: id }, select: { id: true } }),
    ]);
    const restroomIds = restrooms.map((item) => item.id);
    const zoneIds = zones.map((item) => item.id);
    // Deleting a floor removes its layout, not its physical inventory.  Clear
    // assignments first so devices and gateways can be placed elsewhere.
    await prisma.$transaction([
      prisma.device.updateMany({ where: { OR: [{ floorId: id }, { restroomId: { in: restroomIds } }, { zoneId: { in: zoneIds } }] }, data: { restroomId: null, zoneId: null, floorId: null, floorPlanPosX: null, floorPlanPosY: null, latitude: null, longitude: null } }),
      prisma.gateway.updateMany({ where: { OR: [{ floorId: id }, { zoneId: { in: zoneIds } }] }, data: { locationId: null, floorId: null, zoneId: null, latitude: null, longitude: null } }),
      prisma.notification.deleteMany({ where: { alert: { restroomId: { in: restroomIds } } } }),
      prisma.alert.deleteMany({ where: { restroomId: { in: restroomIds } } }),
      prisma.feedback.deleteMany({ where: { restroomId: { in: restroomIds } } }),
      prisma.zone.deleteMany({ where: { floorId: id } }),
      prisma.restroom.deleteMany({ where: { floorId: id } }),
      prisma.floorPlan.deleteMany({ where: { floorId: id } }),
      prisma.floor.delete({ where: { id } }),
    ]);

    res.status(200).json({ message: "Floor deleted successfully" });
  } catch (error) {
    console.error("Delete floor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getFloors,
  getFloorById,
  createFloor,
  updateFloor,
  deleteFloor,
};
