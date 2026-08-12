const prisma = require("../config/database");
const { getIO } = require("../utils/socket");

function formatDayLabel(date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getDashboard(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const orgFilter = getOrgFilter(req);

    const isSuperAdmin = req.user?.role === "super_admin";

    const locationWhere = isSuperAdmin ? {} : { organizationId: orgFilter.organizationId };
    const locations = await prisma.location.findMany({
      where: locationWhere,
      select: { id: true },
    });
    const locationIds = locations.map((l) => l.id);

    const floorWhere = isSuperAdmin ? {} : { locationId: { in: locationIds } };
    const floors = await prisma.floor.findMany({
      where: floorWhere,
      select: { id: true },
    });
    const floorIds = floors.map((f) => f.id);

    const restroomWhere = isSuperAdmin ? {} : { floorId: { in: floorIds } };

    const [
      totalRestrooms,
      totalDevices,
      activeAlerts,
      todayFeedback,
      onlineDevices,
      offlineDevices,
      restrooms,
      devices,
      alerts,
      feedbackEntries,
    ] = await Promise.all([
      prisma.restroom.count({ where: restroomWhere }),
      prisma.device.count({
        where: {
          restroom: restroomWhere,
        },
      }),
      prisma.alert.count({
        where: {
          status: { not: "closed" },
          restroom: restroomWhere,
        },
      }),
      prisma.feedback.count({
        where: {
          timestamp: { gte: startOfToday },
          restroom: restroomWhere,
        },
      }),
      prisma.device.count({
        where: {
          restroom: restroomWhere,
          healthStatus: "healthy",
          lastSeen: { gt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
      prisma.device.count({
        where: {
          restroom: restroomWhere,
          OR: [
            { healthStatus: { not: "healthy" } },
            { lastSeen: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
          ],
        },
      }),
      prisma.restroom.findMany({
        where: restroomWhere,
        orderBy: [{ floor: { createdAt: "asc" } }, { name: "asc" }],
        include: {
          devices: true,
          floor: { include: { location: true } },
          _count: { select: { feedback: true, alerts: true } },
        },
      }),
      prisma.device.findMany({
        where: {
          restroom: restroomWhere,
        },
        orderBy: { batteryLevel: "desc" },
        include: { restroom: { include: { floor: { include: { location: true } } } } },
      }),
      prisma.alert.findMany({
        where: {
          status: { not: "closed" },
          restroom: restroomWhere,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { restroom: { include: { floor: { include: { location: true } } } } },
      }),
      prisma.feedback.findMany({
        where: {
          restroom: restroomWhere,
        },
        orderBy: { timestamp: "desc" },
        take: 30,
        include: { restroom: true, device: true },
      }),
    ]);

    const stats = {
      totalRestrooms,
      totalDevices,
      activeAlerts,
      todayFeedback,
      onlineDevices,
      offlineDevices,
    };

    const feedbackTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const entriesOnDay = feedbackEntries.filter((entry) => {
        const entryDate = new Date(entry.timestamp);
        return entryDate.toDateString() === date.toDateString();
      });

      return {
        day: formatDayLabel(date),
        happy: entriesOnDay.filter((entry) => entry.feedbackType === "happy").length,
        neutral: entriesOnDay.filter((entry) => entry.feedbackType === "average").length,
        unhappy: entriesOnDay.filter((entry) => entry.feedbackType === "needs_cleaning" || entry.feedbackType === "emergency").length,
      };
    });

    const recentActivity = alerts.slice(0, 4).map((alert) => ({
      id: alert.id,
      message: `${alert.feedback?.feedbackType?.replace(/_/g, " ") || "Alert"} for ${alert.restroom?.name || "Unknown restroom"}`,
      time: new Date(alert.createdAt).getTime(),
      type: alert.status === "closed" ? "success" : alert.status === "assigned" ? "info" : "alert",
    }));

    return res.status(200).json({
      stats,
      restrooms: restrooms.map((room) => ({
        ...room,
        status: room.status || "good",
        latitude: room.floor?.location?.latitude ?? null,
        longitude: room.floor?.location?.longitude ?? null,
        locationName: room.floor?.location ? `${room.floor.location.city} - ${room.floor.location.officeName}` : null,
      })),
      devices: devices.map((device) => ({
        id: device.id,
        badgeId: device.badgeId,
        restroomId: device.restroomId,
        battery: device.batteryLevel,
        status: device.healthStatus,
        lastCommunication: device.lastSeen ? new Date(device.lastSeen).getTime() : null,
        health: device.healthStatus,
        restroomName: device.restroom?.name || "Unknown restroom",
      })),
      alerts: alerts.map((alert) => ({
        id: alert.id,
        time: new Date(alert.createdAt).getTime(),
        restroomId: alert.restroomId,
        restroomName: alert.restroom?.name || "Unknown restroom",
        type: alert.feedback?.feedbackType || "unknown",
        status: alert.status,
        priority: alert.priority,
        assignedTo: alert.assignedToId || "Unassigned",
        acknowledgedBy: alert.acknowledgedById || null,
        resolvedTime: alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : null,
      })),
      feedbackTrend,
      recentActivity,
    });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    return res.status(500).json({
      message: "Failed to fetch dashboard data",
    });
  }
}

async function getDashboardSummary(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const orgFilter = getOrgFilter(req);
    const isSuperAdmin = req.user?.role === "super_admin";

    const locationWhere = isSuperAdmin ? {} : { organizationId: orgFilter.organizationId };
    const locations = await prisma.location.findMany({
      where: locationWhere,
      select: { id: true },
    });
    const locationIds = locations.map((l) => l.id);

    const floorWhere = isSuperAdmin ? {} : { locationId: { in: locationIds } };
    const floors = await prisma.floor.findMany({
      where: floorWhere,
      select: { id: true },
    });
    const floorIds = floors.map((f) => f.id);

    const restroomWhere = isSuperAdmin ? {} : { floorId: { in: floorIds } };

    const [
      totalRestrooms,
      totalDevices,
      activeAlerts,
      todayFeedback,
      onlineDevices,
      batterySummary,
    ] = await Promise.all([
      prisma.restroom.count({ where: restroomWhere }),
      prisma.device.count({
        where: {
          restroom: restroomWhere,
        },
      }),
      prisma.alert.count({
        where: {
          status: { not: "closed" },
          restroom: restroomWhere,
        },
      }),
      prisma.feedback.count({
        where: {
          timestamp: { gte: startOfToday },
          restroom: restroomWhere,
        },
      }),
      prisma.device.count({
        where: {
          restroom: restroomWhere,
          healthStatus: "healthy",
          lastSeen: { gt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
      prisma.device.aggregate({
        where: {
          restroom: restroomWhere,
        },
        _avg: { batteryLevel: true },
        _min: { batteryLevel: true },
        _max: { batteryLevel: true },
      }),
    ]);

    res.status(200).json({
      message: "Dashboard summary fetched successfully",
      summary: {
        totalRestrooms,
        totalDevices,
        onlineDevices,
        offlineDevices: totalDevices - onlineDevices,
        activeAlerts,
        todayFeedback,
        battery: {
          average: Math.round(batterySummary._avg.batteryLevel || 0),
          min: batterySummary._min.batteryLevel || 0,
          max: batterySummary._max.batteryLevel || 0,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard summary" });
  }
}

async function getDashboardCharts(req, res) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const orgFilter = getOrgFilter(req);
    const isSuperAdmin = req.user?.role === "super_admin";

    const locationWhere = isSuperAdmin ? {} : { organizationId: orgFilter.organizationId };
    const locations = await prisma.location.findMany({
      where: locationWhere,
      select: { id: true },
    });
    const locationIds = locations.map((l) => l.id);

    const floorWhere = isSuperAdmin ? {} : { locationId: { in: locationIds } };
    const floors = await prisma.floor.findMany({
      where: floorWhere,
      select: { id: true },
    });
    const floorIds = floors.map((f) => f.id);

    const restroomWhere = isSuperAdmin ? {} : { floorId: { in: floorIds } };

    const feedback = await prisma.feedback.findMany({
      where: {
        restroom: restroomWhere,
        timestamp: { gte: sevenDaysAgo },
      },
      orderBy: { timestamp: "asc" },
    });

    const labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d.toLocaleDateString("en-US", { weekday: "short" });
    });

    const chartData = labels.map((label, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayFeedback = feedback.filter((f) => {
        const ft = new Date(f.timestamp);
        return ft >= date && ft < nextDate;
      });

      return {
        label,
        happy: dayFeedback.filter((f) => f.feedbackType === "happy").length,
        neutral: dayFeedback.filter((f) => f.feedbackType === "average").length,
        unhappy: dayFeedback.filter((f) => f.feedbackType === "needs_cleaning" || f.feedbackType === "emergency").length,
      };
    });

    res.status(200).json({
      message: "Dashboard charts fetched successfully",
      charts: chartData,
    });
  } catch (error) {
    console.error("Dashboard charts error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard charts" });
  }
}

async function getDashboardLive(req, res) {
  try {
    const io = getIO();
    const orgFilter = getOrgFilter(req);
    const isSuperAdmin = req.user?.role === "super_admin";

    const locationWhere = isSuperAdmin ? {} : { organizationId: orgFilter.organizationId };
    const locations = await prisma.location.findMany({
      where: locationWhere,
      select: { id: true },
    });
    const locationIds = locations.map((l) => l.id);

    const floorWhere = isSuperAdmin ? {} : { locationId: { in: locationIds } };
    const floors = await prisma.floor.findMany({
      where: floorWhere,
      select: { id: true },
    });
    const floorIds = floors.map((f) => f.id);

    const restroomWhere = isSuperAdmin ? {} : { floorId: { in: floorIds } };

    const [
      onlineDevices,
      offlineDevices,
      activeAlerts,
      todayFeedback,
    ] = await Promise.all([
      prisma.device.count({
        where: {
          restroom: restroomWhere,
          healthStatus: "healthy",
          lastSeen: { gt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
      prisma.device.count({
        where: {
          restroom: restroomWhere,
          OR: [
            { healthStatus: { not: "healthy" } },
            { lastSeen: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
          ],
        },
      }),
      prisma.alert.count({
        where: {
          status: { not: "closed" },
          restroom: restroomWhere,
        },
      }),
      prisma.feedback.count({
        where: {
          timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          restroom: restroomWhere,
        },
      }),
    ]);

    return res.status(200).json({
      message: "Live dashboard endpoint",
      connectedClients: io ? io.engine.clientsCount : 0,
      liveStats: {
        onlineDevices,
        offlineDevices,
        activeAlerts,
        todayFeedback,
      },
    });
  } catch (error) {
    console.error("Dashboard live error:", error);
    res.status(500).json({ message: "Failed to fetch live dashboard data" });
  }
}

async function getHeatMapData(req, res) {
  try {
    const { period, floorId, locationId } = req.query;
    const now = new Date();
    const orgFilter = getOrgFilter(req);
    const isSuperAdmin = req.user?.role === "super_admin";

    const locationWhere = isSuperAdmin ? {} : { organizationId: orgFilter.organizationId };
    const locations = await prisma.location.findMany({
      where: locationWhere,
      select: { id: true },
    });
    const locationIds = locations.map((l) => l.id);

    const floorWhere = isSuperAdmin ? {} : { locationId: { in: locationIds } };
    const floors = await prisma.floor.findMany({
      where: floorWhere,
      select: { id: true },
    });
    const floorIds = floors.map((f) => f.id);

    let dateFilter = {};
    if (period === "today") {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      dateFilter = { timestamp: { gte: startOfToday } };
    } else if (period === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { timestamp: { gte: weekAgo } };
    } else if (period === "month") {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { timestamp: { gte: monthAgo } };
    }

    const whereRestroom = isSuperAdmin ? {} : { floorId: { in: floorIds } };
    if (floorId) whereRestroom.id = floorId;
    if (locationId) {
      const locFloors = await prisma.floor.findMany({ where: { locationId }, select: { id: true } });
      whereRestroom.floorId = { in: locFloors.map((f) => f.id) };
    }

    const restrooms = await prisma.restroom.findMany({
      where: whereRestroom,
      include: {
        floor: { include: { location: true } },
        devices: true,
        feedback: { where: dateFilter },
        alerts: { where: { status: { not: "closed" } } },
      },
    });

    const heatMapData = restrooms.map((room, index) => {
      const totalFeedback = room.feedback.length;
      const negativeFeedback = room.feedback.filter(
        (f) => f.feedbackType === "needs_cleaning" || f.feedbackType === "emergency"
      ).length;
      const score = totalFeedback > 0 ? Math.round((negativeFeedback / totalFeedback) * 100) : 0;

      const cols = 3
      const cellWidth = 220
      const cellHeight = 110
      const gapX = 30
      const gapY = 30
      const startX = 90
      const startY = 90

      const col = index % cols
      const row = Math.floor(index / cols)
      const x = startX + col * (cellWidth + gapX) + cellWidth / 2
      const y = startY + row * (cellHeight + gapY) + cellHeight / 2

      const latitude = room.floor.location.latitude || null
      const longitude = room.floor.location.longitude || null

      return {
        id: room.id,
        name: room.name,
        floorId: room.floorId,
        floor: room.floor.floorName,
        location: room.floor.location.city,
        site: `${room.floor.location.city} - ${room.floor.location.officeName}`,
        x,
        y,
        latitude,
        longitude,
        score,
        total: totalFeedback,
        status: room.status,
        deviceId: room.devices?.[0]?.id || null,
        badgeId: room.devices?.[0]?.badgeId || null,
        battery: room.devices?.[0]?.batteryLevel || null,
        alerts: room.alerts.length,
        devices: room.devices?.map((d) => ({
          id: d.id,
          badgeId: d.badgeId,
          restroomId: d.restroomId,
          batteryLevel: d.batteryLevel,
          healthStatus: d.healthStatus,
          floorPlanPosX: d.floorPlanPosX,
          floorPlanPosY: d.floorPlanPosY,
        })) || [],
      }
    })

    const maxScore = Math.max(...heatMapData.map((item) => item.score || 0), 1)

    const sitesWhere = orgFilter.organizationId ? { organizationId: orgFilter.organizationId } : {};
    const sites = await prisma.location.findMany({
      where: sitesWhere,
      include: {
        floors: { include: { restrooms: true } },
      },
    })

    const siteData = sites.map((site) => ({
      id: site.id,
      name: `${site.city} - ${site.officeName}`,
      lat: site.latitude || 18.5204,
      lng: site.longitude || 73.8567,
      status: "operational",
      restrooms: site.floors.reduce((acc, floor) => acc + floor.restrooms.length, 0),
    }))

    res.status(200).json({
      message: "Heat map data fetched successfully",
      restrooms: heatMapData,
      maxScore,
      sites: siteData,
      period: period || "today",
    })
  } catch (error) {
    console.error("Heat map data error:", error)
    res.status(500).json({ message: "Failed to fetch heat map data" })
  }
}

module.exports = {
  getDashboard,
  getDashboardSummary,
  getDashboardCharts,
  getDashboardLive,
  getHeatMapData,
};
