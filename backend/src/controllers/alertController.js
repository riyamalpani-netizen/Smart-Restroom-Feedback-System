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

const PENDING = 'open';
const ACKNOWLEDGED = 'assigned';
const RESOLVED = 'closed';

const STATUS_DISPLAY = {
  [PENDING]: 'Pending',
  [ACKNOWLEDGED]: 'Acknowledged',
  [RESOLVED]: 'Resolved',
};

const PRIORITY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 };

async function getUnhappyAggregated(req, res) {
  try {
    const role = req.user?.role;
    const orgId = req.user?.organizationId;

    const conditions = ['a.status != \'closed\''];
    const params = [];
    let paramIndex = 1;

    if (role !== 'super_admin') {
      conditions.push(`r."organizationId" = $${paramIndex}`);
      params.push(orgId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        l.id as "locationId",
        l.city,
        l."officeName",
        COALESCE(z.id, 'unassigned') as "zoneId",
        COALESCE(z."name", 'Unassigned Zone') as "zoneName",
        COUNT(a.id) as "unhappyCount",
        CASE
          WHEN COUNT(CASE WHEN a.status = 'open' THEN 1 END) > 0 THEN 'open'
          WHEN COUNT(CASE WHEN a.status IN ('assigned', 'in_progress') THEN 1 END) > 0 THEN 'assigned'
          ELSE 'closed'
        END as "status",
        MAX(
          CASE a.priority
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
          END
        ) as "priorityScore",
        MAX(a."createdAt") as "lastReported"
      FROM alerts a
      JOIN restrooms r ON a."restroomId" = r.id
      JOIN floors f ON r."floorId" = f.id
      JOIN locations l ON f."locationId" = l.id
      JOIN feedback fb ON a."feedbackId" = fb.id
      JOIN devices d ON fb."deviceId" = d.id
      LEFT JOIN zones z ON d."zoneId" = z.id
      WHERE ${whereClause}
        AND fb."feedbackType" IN ('needs_cleaning', 'emergency')
      GROUP BY l.id, l."officeName", z.id, z."name"
      ORDER BY "unhappyCount" DESC
    `;

    const results = await prisma.$queryRawUnsafe(sql, ...params);

    const aggregated = results.map((row) => ({
      locationId: row.locationId,
      locationName: `${row.city} - ${row.officeName}`,
      zoneId: row.zoneId,
      zoneName: row.zoneName,
      unhappyCount: parseInt(row.unhappyCount, 10),
      status: row.status,
      statusDisplay: STATUS_DISPLAY[row.status] || row.status,
      priority: PRIORITY_SCORE[row.priorityScore] === 4 ? 'critical' : PRIORITY_SCORE[row.priorityScore] === 3 ? 'high' : PRIORITY_SCORE[row.priorityScore] === 2 ? 'medium' : 'low',
      lastReported: row.lastReported ? new Date(row.lastReported).getTime() : null,
    }));

    res.status(200).json({
      message: "Aggregated unhappy alerts fetched successfully",
      aggregated,
    });
  } catch (error) {
    console.error("Get unhappy aggregated error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function acknowledgeGroup(req, res) {
  try {
    const { locationId, zoneId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;
    const userId = req.user?.sub;

    if (!locationId || zoneId === undefined) {
      return res.status(400).json({ message: "Location ID and Zone ID are required" });
    }

    const deviceFilter = zoneId === 'unassigned' ? { zoneId: null } : { zoneId: zoneId };

    const where = {
      status: 'open',
      restroom: {
        floor: {
          locationId: locationId,
        },
        ...(userRole !== 'super_admin' ? { organizationId: userOrgId } : {}),
      },
      feedback: {
        device: deviceFilter,
      },
    };

    const matchingAlerts = await prisma.alert.findMany({
      where,
      select: { id: true },
    });

    if (matchingAlerts.length === 0) {
      return res.status(404).json({ message: "No matching open alerts found" });
    }

    const updated = await prisma.alert.updateMany({
      where: {
        id: { in: matchingAlerts.map(a => a.id) },
      },
      data: {
        status: 'assigned',
        acknowledgedById: userId,
      },
    });

    res.status(200).json({
      message: `${updated.count} alerts acknowledged successfully`,
      count: updated.count,
    });
  } catch (error) {
    console.error("Acknowledge group error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function resolveGroup(req, res) {
  try {
    const { locationId, zoneId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!locationId || zoneId === undefined) {
      return res.status(400).json({ message: "Location ID and Zone ID are required" });
    }

    const deviceFilter = zoneId === 'unassigned' ? { zoneId: null } : { zoneId: zoneId };

    const where = {
      status: { not: 'closed' },
      restroom: {
        floor: {
          locationId: locationId,
        },
        ...(userRole !== 'super_admin' ? { organizationId: userOrgId } : {}),
      },
      feedback: {
        device: deviceFilter,
      },
    };

    const matchingAlerts = await prisma.alert.findMany({
      where,
      select: { id: true },
    });

    if (matchingAlerts.length === 0) {
      return res.status(404).json({ message: "No matching open alerts found" });
    }

    const updated = await prisma.alert.updateMany({
      where: {
        id: { in: matchingAlerts.map(a => a.id) },
      },
      data: {
        status: 'closed',
        resolvedAt: new Date(),
      },
    });

    res.status(200).json({
      message: `${updated.count} alerts resolved successfully`,
      count: updated.count,
    });
  } catch (error) {
    console.error("Resolve group error:", error);
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
  getUnhappyAggregated,
  acknowledgeGroup,
  resolveGroup,
};
