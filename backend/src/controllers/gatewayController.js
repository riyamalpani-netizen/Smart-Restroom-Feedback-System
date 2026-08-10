const prisma = require("../config/database");

async function getGatewayStatus(req, res) {
  try {
    const gateways = await prisma.gatewayStatus.findMany({
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
    const onlineGateways = await prisma.gatewayStatus.count({ where: { status: "online" } });
    const degradedGateways = await prisma.gatewayStatus.count({ where: { status: "degraded" } });
    const offlineGateways = await prisma.gatewayStatus.count({ where: { status: "offline" } });

    const totalDevices = await prisma.device.count();
    const onlineDevices = await prisma.device.count({
      where: { healthStatus: "healthy", lastSeen: { gt: new Date(Date.now() - 5 * 60 * 1000) } },
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

    const devices = await prisma.device.findMany({
      where: {
        OR: [
          { lastSeen: { lt: fiveMinutesAgo } },
          { healthStatus: { not: "healthy" } },
        ],
      },
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
    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const incidents = await prisma.alert.findMany({
      where,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        feedback: true,
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
    const totalDevices = await prisma.device.count();
    const healthyDevices = await prisma.device.count({ where: { healthStatus: "healthy" } });
    const recoveringDevices = await prisma.device.count({ where: { healthStatus: "warning" } });
    const criticalDevices = await prisma.device.count({ where: { healthStatus: "critical" } });

    const totalGateways = await prisma.gatewayStatus.count();
    const onlineGateways = await prisma.gatewayStatus.count({ where: { status: "online" } });

    res.status(200).json({
      message: "Recovery status fetched successfully",
      devices: { total: totalDevices, healthy: healthyDevices, recovering: recoveringDevices, critical: criticalDevices },
      gateways: { total: totalGateways, online: onlineGateways, offline: totalGateways - onlineGateways },
    });
  } catch (error) {
    console.error("Get recovery status error:", error);
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
};
