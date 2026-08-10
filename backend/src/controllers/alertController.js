const prisma = require("../config/database");

async function getAlerts(req, res) {
  try {
    const { status, priority, restroomId, page = 1, limit = 20 } = req.query;
    const where = {};
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
          notifications: true,
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

async function getAlertById(req, res) {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id },
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

    if (!feedbackId || !restroomId) {
      return res.status(400).json({ message: "Feedback ID and restroom ID are required" });
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
    const { status, priority, assignedToId } = req.body;

    const existing = await prisma.alert.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Alert not found" });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;

    const alert = await prisma.alert.update({
      where: { id },
      data: updateData,
      include: { feedback: true, restroom: true, assignedTo: true },
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

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
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

    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: { status: "closed", resolvedAt: new Date() },
      include: { feedback: true, restroom: true },
    });

    res.status(200).json({ message: "Alert resolved successfully", alert: updated });
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  acknowledgeAlert,
  resolveAlert,
};
