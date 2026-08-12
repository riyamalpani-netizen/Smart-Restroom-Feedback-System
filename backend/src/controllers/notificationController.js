const prisma = require("../config/database");

async function getNotifications(req, res) {
  try {
    const { alertId, type, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (alertId) where.alertId = alertId;
    if (type) where.type = type;
    if (status) where.status = status;

    if (req.user?.role !== "super_admin") {
      where.alert = {
        restroom: {
          floor: {
            location: {
              organizationId: req.user.organizationId,
            },
          },
        },
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { alert: { include: { restroom: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.notification.count({ where }),
    ]);

    res.status(200).json({
      message: "Notifications fetched successfully",
      notifications,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getNotifications,
};
