const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getAlertOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};

  const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
  const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
  
  return { restroomId: { in: orgRestrooms.map((r) => r.id) } };
}

async function getAlerts(req, res) {
  try {
    const { status, priority, restroomId, page = 1, limit = 20 } = req.query;
    const orgFilter = await getAlertOrgFilter(req);
    const where = { ...orgFilter };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (restroomId) where.restroomId = restroomId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          feedback: true,
          restroom: { include: { floor: { include: { location: true } } } },
          assignedTo: { select: { id: true, name: true, email: true } },
          acknowledgedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.alert.count({ where }),
    ]);

    res.status(200).json({
      message: "Alerts fetched successfully",
      alerts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getAlertStats(req, res) {
  try {
    const orgFilter = await getAlertOrgFilter(req);
    const where = { ...orgFilter };

    const [
      total,
      open,
      assigned,
      inProgress,
      closed,
      low,
      medium,
      high,
      critical,
    ] = await Promise.all([
      prisma.alert.count({ where }),
      prisma.alert.count({ where: { ...where, status: "open" } }),
      prisma.alert.count({ where: { ...where, status: "assigned" } }),
      prisma.alert.count({ where: { ...where, status: "in_progress" } }),
      prisma.alert.count({ where: { ...where, status: "closed" } }),
      prisma.alert.count({ where: { ...where, priority: "low" } }),
      prisma.alert.count({ where: { ...where, priority: "medium" } }),
      prisma.alert.count({ where: { ...where, priority: "high" } }),
      prisma.alert.count({ where: { ...where, priority: "critical" } }),
    ]);

    res.status(200).json({
      message: "Alert stats fetched successfully",
      stats: {
        total,
        byStatus: { open, assigned, in_progress: inProgress, closed },
        byPriority: { low, medium, high, critical },
      },
    });
  } catch (error) {
    console.error("Get alert stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getAlertById(req, res) {
  try {
    const { id } = req.params;
    const orgFilter = await getAlertOrgFilter(req);

    const alert = await prisma.alert.findFirst({
      where: { id, ...orgFilter },
      include: {
        feedback: true,
        restroom: { include: { floor: { include: { location: true } } } },
        assignedTo: { select: { id: true, name: true, email: true } },
        acknowledgedBy: { select: { id: true, name: true, email: true } },
        notifications: true,
      },
    });

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    res.status(200).json({ message: "Alert fetched successfully", alert });
  } catch (error) {
    console.error("Get alert error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createAlert(req, res) {
  try {
    const { feedbackId, restroomId, priority } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!feedbackId || !restroomId) {
      return res.status(400).json({ message: "Feedback ID and restroom ID are required" });
    }

    const restroom = await prisma.restroom.findUnique({ where: { id: restroomId } });
    if (!restroom) {
      return res.status(404).json({ message: "Restroom not found" });
    }

    if (userRole === "vendor_admin" && restroom.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create alerts for restrooms in your organization" });
    }

    const alert = await prisma.alert.create({
      data: { feedbackId, restroomId, priority: priority || "medium", status: "open" },
      include: { feedback: true, restroom: true },
    });

    res.status(201).json({ message: "Alert created successfully", alert });
  } catch (error) {
    console.error("Create alert error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateAlert(req, res) {
  try {
    const { id } = req.params;
    const { status, priority, assignedToId, notes } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const orgFilter = await getAlertOrgFilter(req);
    const existing = await prisma.alert.findFirst({
      where: { id, ...orgFilter },
      include: { restroom: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Alert not found" });
    }

    if (userRole === "vendor_admin" && existing.restroom.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only update alerts in your organization" });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (notes !== undefined) updateData.notes = notes;

    const alert = await prisma.alert.update({
      where: { id },
      data: updateData,
      include: { feedback: true, restroom: true, assignedTo: true, acknowledgedBy: true },
    });

    res.status(200).json({ message: "Alert updated successfully", alert });
  } catch (error) {
    console.error("Update alert error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function acknowledgeAlert(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const orgFilter = await getAlertOrgFilter(req);
    const existing = await prisma.alert.findFirst({
      where: { id, ...orgFilter },
      include: { restroom: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Alert not found" });
    }

    if (userRole === "vendor_admin" && existing.restroom.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only acknowledge alerts in your organization" });
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: { status: "assigned", acknowledgedById: userId },
      include: { feedback: true, restroom: true, acknowledgedBy: { select: { id: true, name: true } } },
    });

    res.status(200).json({ message: "Alert acknowledged successfully", alert: updated });
  } catch (error) {
    console.error("Acknowledge alert error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function resolveAlert(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const orgFilter = await getAlertOrgFilter(req);
    const existing = await prisma.alert.findFirst({
      where: { id, ...orgFilter },
      include: { restroom: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Alert not found" });
    }

    if (userRole === "vendor_admin" && existing.restroom.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only resolve alerts in your organization" });
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: { status: "closed", resolvedAt: new Date() },
      include: { feedback: true, restroom: true, acknowledgedBy: { select: { id: true, name: true } } },
    });

    res.status(200).json({ message: "Alert resolved successfully", alert: updated });
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getAlerts,
  getAlertStats,
  getAlertById,
  createAlert,
  updateAlert,
  acknowledgeAlert,
  resolveAlert,
};
