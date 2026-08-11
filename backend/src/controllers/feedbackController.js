const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getFeedback(req, res) {
  try {
    const { restroomId, deviceId, feedbackType, startDate, endDate, page = 1, limit = 20 } = req.query;
    const orgFilter = getOrgFilter(req);
    const where = { ...orgFilter };
    if (restroomId) where.restroomId = restroomId;
    if (deviceId) where.deviceId = deviceId;
    if (feedbackType) where.feedbackType = feedbackType;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbackEntries, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          device: true,
          restroom: { include: { floor: { include: { location: true } } } },
          alert: true,
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.feedback.count({ where }),
    ]);

    res.status(200).json({
      message: "Feedback fetched successfully",
      feedback: feedbackEntries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getFeedbackById(req, res) {
  try {
    const { id } = req.params;
    const orgFilter = getOrgFilter(req);

    const feedback = await prisma.feedback.findFirst({
      where: { id, restroom: { ...orgFilter } },
      include: {
        device: true,
        restroom: { include: { floor: { include: { location: true } } } },
        alert: { include: { notifications: true } },
      },
    });

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.status(200).json({ message: "Feedback fetched successfully", feedback });
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createFeedback(req, res) {
  try {
    const { deviceId, restroomId, feedbackType, battery, signalStrength } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!deviceId || !restroomId || !feedbackType) {
      return res.status(400).json({ message: "Device ID, restroom ID, and feedback type are required" });
    }

    const validTypes = ["happy", "average", "needs_cleaning", "emergency"];
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ message: "Invalid feedback type" });
    }

    const restroom = await prisma.restroom.findUnique({ where: { id: restroomId } });
    if (!restroom) {
      return res.status(404).json({ message: "Restroom not found" });
    }

    if (userRole === "vendor_admin" && restroom.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create feedback for restrooms in your organization" });
    }

    const feedback = await prisma.feedback.create({
      data: { deviceId, restroomId, feedbackType, battery, signalStrength },
      include: { device: true, restroom: true },
    });

    res.status(201).json({ message: "Feedback created successfully", feedback });
  } catch (error) {
    console.error("Create feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteFeedback(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.feedback.findFirst({
      where: { id, restroom: { ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    await prisma.feedback.delete({ where: { id } });

    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Delete feedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getFeedback,
  getFeedbackById,
  createFeedback,
  deleteFeedback,
};
