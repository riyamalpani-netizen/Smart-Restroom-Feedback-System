const prisma = require("../config/database");

async function getLocations(req, res) {
  try {
    const { organizationId } = req.query;
    const where = organizationId ? { organizationId } : {};

    const locations = await prisma.location.findMany({
      where,
      include: {
        floors: true,
        _count: { select: { floors: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Locations fetched successfully",
      locations,
    });
  } catch (error) {
    console.error("Get locations error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getLocationById(req, res) {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        floors: { include: { restrooms: true } },
      },
    });

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({ message: "Location fetched successfully", location });
  } catch (error) {
    console.error("Get location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createLocation(req, res) {
  try {
    const { organizationId, city, officeName, address } = req.body;

    if (!organizationId || !city || !officeName) {
      return res.status(400).json({ message: "Organization ID, city, and office name are required" });
    }

    const location = await prisma.location.create({
      data: { organizationId, city, officeName, address },
    });

    res.status(201).json({ message: "Location created successfully", location });
  } catch (error) {
    console.error("Create location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateLocation(req, res) {
  try {
    const { id } = req.params;
    const { city, officeName, address } = req.body;

    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Location not found" });
    }

    const location = await prisma.location.update({
      where: { id },
      data: { city, officeName, address },
    });

    res.status(200).json({ message: "Location updated successfully", location });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteLocation(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Location not found" });
    }

    await prisma.location.delete({ where: { id } });

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Delete location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
};
