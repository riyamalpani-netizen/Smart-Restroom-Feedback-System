const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getRestrooms(req, res) {
  try {
    const { floorId, organizationId } = req.query;
    const orgFilter = getOrgFilter(req);
    const where = { ...orgFilter };
    if (floorId) where.floorId = floorId;
    if (organizationId && req.user?.role === "super_admin") where.organizationId = organizationId;

    const restrooms = await prisma.restroom.findMany({
      where,
      include: {
        floor: { include: { location: true } },
        devices: true,
        _count: { select: { feedback: true, alerts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Restrooms fetched successfully",
      restrooms,
    });
  } catch (error) {
    console.error("Get restrooms error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getRestroomById(req, res) {
  try {
    const { id } = req.params;
    const orgFilter = getOrgFilter(req);

    const restroom = await prisma.restroom.findFirst({
      where: { id, ...orgFilter },
      include: {
        floor: { include: { location: true } },
        devices: true,
        feedback: { orderBy: { timestamp: "desc" }, take: 10 },
        alerts: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!restroom) {
      return res.status(404).json({ message: "Restroom not found" });
    }

    res.status(200).json({ message: "Restroom fetched successfully", restroom });
  } catch (error) {
    console.error("Get restroom error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createRestroom(req, res) {
  try {
    const { floorId, organizationId, name, gender, status } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!floorId || !organizationId || !name) {
      return res.status(400).json({ message: "Floor ID, organization ID, and name are required" });
    }

    if (userRole === "vendor_admin" && organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create restrooms in your own organization" });
    }

    const restroom = await prisma.restroom.create({
      data: { floorId, organizationId, name, gender, status: status || "good" },
    });

    res.status(201).json({ message: "Restroom created successfully", restroom });
  } catch (error) {
    console.error("Create restroom error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateRestroom(req, res) {
  try {
    const { id } = req.params;
    const { name, gender, status } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.restroom.findFirst({
      where: { id, ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) },
    });

    if (!existing) {
      return res.status(404).json({ message: "Restroom not found" });
    }

    const restroom = await prisma.restroom.update({
      where: { id },
      data: { name, gender, status },
    });

    res.status(200).json({ message: "Restroom updated successfully", restroom });
  } catch (error) {
    console.error("Update restroom error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteRestroom(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.restroom.findFirst({
      where: { id, ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) },
    });

    if (!existing) {
      return res.status(404).json({ message: "Restroom not found" });
    }

    await prisma.restroom.delete({ where: { id } });

    res.status(200).json({ message: "Restroom deleted successfully" });
  } catch (error) {
    console.error("Delete restroom error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getRestrooms,
  getRestroomById,
  createRestroom,
  updateRestroom,
  deleteRestroom,
};
