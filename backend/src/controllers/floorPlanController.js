const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

function getFloorPlanOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { floor: { location: { organizationId: orgId } } };
}

async function getFloorPlans(req, res) {
  try {
    const { floorId } = req.query;
    const orgFilter = getOrgFilter(req);
    const planOrgFilter = getFloorPlanOrgFilter(req);

    const where = { ...planOrgFilter };
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

    const floorPlans = await prisma.floorPlan.findMany({
      where,
      include: {
        floor: {
          include: {
            location: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Floor plans fetched successfully",
      floorPlans,
    });
  } catch (error) {
    console.error("Get floor plans error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getFloorPlanById(req, res) {
  try {
    const { id } = req.params;
    const planOrgFilter = getFloorPlanOrgFilter(req);

    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id, ...planOrgFilter },
      include: {
        floor: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!floorPlan) {
      return res.status(404).json({ message: "Floor plan not found" });
    }

    res.status(200).json({
      message: "Floor plan fetched successfully",
      floorPlan,
    });
  } catch (error) {
    console.error("Get floor plan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createFloorPlan(req, res) {
  try {
    const { floorId, name, imageData, width, height, posX, posY, rotation } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!floorId || !name || !imageData) {
      return res.status(400).json({ message: "Floor ID, name, and image data are required" });
    }

    const floor = await prisma.floor.findFirst({
      where: { id: floorId },
      include: { location: true },
    });

    if (!floor) {
      return res.status(404).json({ message: "Floor not found" });
    }

    if (userRole === "vendor_admin" && floor.location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create floor plans for floors in your organization" });
    }

    const floorPlan = await prisma.floorPlan.create({
      data: {
        floorId,
        name,
        imageData,
        width: width ?? 400,
        height: height ?? 300,
        posX: posX ?? 0,
        posY: posY ?? 0,
        rotation: rotation ?? 0,
      },
      include: {
        floor: {
          include: {
            location: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Floor plan created successfully",
      floorPlan,
    });
  } catch (error) {
    console.error("Create floor plan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateFloorPlan(req, res) {
  try {
    const { id } = req.params;
    const { name, imageData, width, height, posX, posY, rotation } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.floorPlan.findFirst({
      where: { id },
      include: {
        floor: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Floor plan not found" });
    }

    if (userRole === "vendor_admin" && existing.floor.location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only update floor plans in your organization" });
    }

    const floorPlan = await prisma.floorPlan.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        imageData: imageData ?? existing.imageData,
        width: width ?? existing.width,
        height: height ?? existing.height,
        posX: posX ?? existing.posX,
        posY: posY ?? existing.posY,
        rotation: rotation ?? existing.rotation,
      },
      include: {
        floor: {
          include: {
            location: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Floor plan updated successfully",
      floorPlan,
    });
  } catch (error) {
    console.error("Update floor plan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteFloorPlan(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.floorPlan.findFirst({
      where: { id },
      include: {
        floor: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Floor plan not found" });
    }

    if (userRole === "vendor_admin" && existing.floor.location.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only delete floor plans in your organization" });
    }

    await prisma.floorPlan.delete({
      where: { id },
    });

    res.status(200).json({
      message: "Floor plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete floor plan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getFloorPlans,
  getFloorPlanById,
  createFloorPlan,
  updateFloorPlan,
  deleteFloorPlan,
};
