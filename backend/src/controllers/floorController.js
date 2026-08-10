const prisma = require("../config/database");

async function getFloors(req, res) {
  try {
    const { locationId } = req.query;
    const where = locationId ? { locationId } : {};

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

    const floor = await prisma.floor.findUnique({
      where: { id },
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
    const { locationId, floorName } = req.body;

    if (!locationId || !floorName) {
      return res.status(400).json({ message: "Location ID and floor name are required" });
    }

    const floor = await prisma.floor.create({
      data: { locationId, floorName },
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
    const { floorName } = req.body;

    const existing = await prisma.floor.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Floor not found" });
    }

    const floor = await prisma.floor.update({
      where: { id },
      data: { floorName },
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

    const existing = await prisma.floor.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Floor not found" });
    }

    await prisma.floor.delete({ where: { id } });

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
