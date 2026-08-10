const prisma = require("../config/database");

async function getRestrooms(req, res) {
  try {
    const { floorId, organizationId } = req.query;
    const where = {};
    if (floorId) where.floorId = floorId;
    if (organizationId) where.organizationId = organizationId;

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

    const restroom = await prisma.restroom.findUnique({
      where: { id },
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

    if (!floorId || !organizationId || !name) {
      return res.status(400).json({ message: "Floor ID, organization ID, and name are required" });
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

    const existing = await prisma.restroom.findUnique({ where: { id } });
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

    const existing = await prisma.restroom.findUnique({ where: { id } });
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
