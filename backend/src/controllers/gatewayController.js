const prisma = require("../config/database");
const { sendTeamsWebhook } = require("../services/teamsWebhookService");

async function getGatewayStatus(req, res) {
  try {
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let where = {};

    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      const orgDevices = await prisma.device.findMany({ where: { restroomId: { in: orgRestrooms.map((r) => r.id) } }, select: { deviceEui: true } });
      const orgDeviceEuis = orgDevices.map((d) => d.deviceEui);

      where = {
        OR: [
          { gatewayName: { contains: orgId } },
          { gatewayName: { in: orgDeviceEuis } },
        ],
      };
    }

    const gateways = await prisma.gatewayStatus.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    res.status(200).json({
      message: "Gateway status fetched successfully",
      gateways,
    });
  } catch (error) {
    console.error("Get gateway status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateGatewayStatus(req, res) {
  try {
    const { gatewayName, status } = req.body;

    if (!gatewayName || !status) {
      return res.status(400).json({ message: "Gateway name and status are required" });
    }

    const validStatuses = ["online", "offline", "degraded"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const gateway = await prisma.gatewayStatus.upsert({
      where: { gatewayName },
      update: { status, lastSeen: new Date() },
      create: { gatewayName, status, lastSeen: new Date() },
    });

    res.status(200).json({ message: "Gateway status updated successfully", gateway });
  } catch (error) {
    console.error("Update gateway status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getNetworkStatus(req, res) {
  try {
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let deviceWhere = {};
    let gatewayWhere = {};

    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      const orgDevices = await prisma.device.findMany({ where: { restroomId: { in: orgRestrooms.map((r) => r.id) } }, select: { deviceEui: true } });
      const orgDeviceEuis = orgDevices.map((d) => d.deviceEui);

      deviceWhere = {
        OR: [
          { restroomId: { in: orgRestrooms.map((r) => r.id) } },
          { restroomId: null },
        ],
      };
      gatewayWhere = {
        OR: [
          { gatewayName: { contains: orgId } },
          { gatewayName: { in: orgDeviceEuis } },
        ],
      };
    }

    const onlineGateways = await prisma.gatewayStatus.count({ where: { ...gatewayWhere, status: "online" } });
    const degradedGateways = await prisma.gatewayStatus.count({ where: { ...gatewayWhere, status: "degraded" } });
    const offlineGateways = await prisma.gatewayStatus.count({ where: { ...gatewayWhere, status: "offline" } });

    const totalDevices = await prisma.device.count({ where: deviceWhere });
    const onlineDevices = await prisma.device.count({
      where: {
        ...deviceWhere,
        healthStatus: "healthy",
        lastSeen: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    const offlineDevices = totalDevices - onlineDevices;

    res.status(200).json({
      message: "Network status fetched successfully",
      gateways: { online: onlineGateways, degraded: degradedGateways, offline: offlineGateways, total: onlineGateways + degradedGateways + offlineGateways },
      devices: { online: onlineDevices, offline: offlineDevices, total: totalDevices },
    });
  } catch (error) {
    console.error("Get network status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getOfflineDevices(req, res) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let deviceWhere = {
      OR: [
        { lastSeen: { lt: fiveMinutesAgo } },
        { healthStatus: { not: "healthy" } },
      ],
    };

    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      deviceWhere = {
        ...deviceWhere,
        OR: [
          { restroomId: { in: orgRestrooms.map((r) => r.id) } },
          { restroomId: null },
        ],
      };
    }

    const devices = await prisma.device.findMany({
      where: deviceWhere,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
      },
      orderBy: { lastSeen: "asc" },
    });

    res.status(200).json({
      message: "Offline devices fetched successfully",
      devices,
      count: devices.length,
    });
  } catch (error) {
    console.error("Get offline devices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getIncidentLog(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      where.restroomId = { in: orgRestrooms.map((r) => r.id) };
    }

    const incidents = await prisma.alert.findMany({
      where,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        feedback: true,
        notifications: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Incident log fetched successfully",
      incidents,
    });
  } catch (error) {
    console.error("Get incident log error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getRecoveryStatus(req, res) {
  try {
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    let deviceWhere = {};
    let gatewayWhere = {};

    if (role !== "super_admin") {
      const orgLocations = await prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true } });
      const orgFloors = await prisma.floor.findMany({ where: { locationId: { in: orgLocations.map((l) => l.id) } }, select: { id: true } });
      const orgRestrooms = await prisma.restroom.findMany({ where: { floorId: { in: orgFloors.map((f) => f.id) } }, select: { id: true } });
      const orgDevices = await prisma.device.findMany({ where: { restroomId: { in: orgRestrooms.map((r) => r.id) } }, select: { deviceEui: true } });
      const orgDeviceEuis = orgDevices.map((d) => d.deviceEui);

      deviceWhere = {
        OR: [
          { restroomId: { in: orgRestrooms.map((r) => r.id) } },
          { restroomId: null },
        ],
      };
      gatewayWhere = {
        OR: [
          { gatewayName: { contains: orgId } },
          { gatewayName: { in: orgDeviceEuis } },
        ],
      };
    }

    const totalDevices = await prisma.device.count({ where: deviceWhere });
    const healthyDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "healthy" } });
    const recoveringDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "warning" } });
    const criticalDevices = await prisma.device.count({ where: { ...deviceWhere, healthStatus: "critical" } });

    const totalGateways = await prisma.gatewayStatus.count({ where: gatewayWhere });
    const onlineGateways = await prisma.gatewayStatus.count({ where: { ...gatewayWhere, status: "online" } });

    const totalAlerts = await prisma.alert.count({
      where: {
        ...(Object.keys(where).length > 0 ? where : {}),
        status: { not: "closed" },
      },
    });

    res.status(200).json({
      message: "Recovery status fetched successfully",
      devices: { total: totalDevices, healthy: healthyDevices, recovering: recoveringDevices, critical: criticalDevices },
      gateways: { total: totalGateways, online: onlineGateways, offline: totalGateways - onlineGateways },
      alerts: { total: totalAlerts },
    });
  } catch (error) {
    console.error("Get recovery status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function manualCloseIncident(req, res) {
  try {
    const { alertId } = req.params;
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const alert = await prisma.alert.findFirst({
      where: { id: alertId },
      include: { restroom: { include: { floor: { include: { location: true } } } } },
    });

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    if (userRole !== "super_admin" && alert.restroom?.floor?.location?.organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only close incidents in your organization" });
    }

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: "closed",
        resolvedAt: new Date(),
        acknowledgedById: userId,
      },
      include: {
        restroom: true,
        feedback: true,
        acknowledgedBy: { select: { id: true, name: true } },
      },
    });

    const settings = await prisma.settings.findFirst();
    if (settings?.teamsWebhook) {
      sendTeamsWebhook(settings.teamsWebhook, {
        restroom: alert.restroom?.name || "Unknown",
        feedbackType: alert.feedback?.feedbackType || "unknown",
        priority: alert.priority,
        timestamp: new Date().toISOString(),
        alertId: alert.id,
      });
    }

    res.status(200).json({ message: "Incident closed successfully", alert: updated });
  } catch (error) {
    console.error("Manual close incident error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getAuditLog(req, res) {
  try {
    const { module, action, startDate, endDate, page = 1, limit = 20 } = req.query;
    const role = req.user?.role;
    const orgId = req.user?.organizationId;
    const where = {};

    if (module) where.module = module;
    if (action) where.action = action;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (role !== "super_admin") {
      where.user = { organizationId: orgId };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      message: "Audit log fetched successfully",
      logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getServerStatus(req, res) {
  try {
    const serverStatus = {
      status: "operational",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      message: "Server status fetched successfully",
      server: serverStatus,
    });
  } catch (error) {
    console.error("Get server status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getGatewayStatus,
  updateGatewayStatus,
  getNetworkStatus,
  getOfflineDevices,
  getIncidentLog,
  getRecoveryStatus,
  manualCloseIncident,
  getAuditLog,
  getServerStatus,
};
