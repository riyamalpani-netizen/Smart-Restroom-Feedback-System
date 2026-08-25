const prisma = require("../config/database");

/**
 * GET /api/audit-logs
 *
 * Returns audit log entries scoped to the caller's organisation.
 * Super admin can query any org by passing ?organizationId=
 *
 * Query params:
 *   organizationId  – (super_admin only) filter to a specific org
 *   module          – e.g. "Device", "Gateway", "User", "Site", "Settings"
 *   action          – e.g. "CREATE", "UPDATE", "DELETE", "DEACTIVATE"
 *   userId          – filter by a specific user
 *   from            – ISO date string (inclusive start)
 *   to              – ISO date string (inclusive end)
 *   page            – page number (default 1)
 *   limit           – records per page (default 25, max 100)
 */
async function getAuditLogs(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;

    const {
      organizationId: queryOrgId,
      module,
      action,
      userId,
      from,
      to,
      page = 1,
      limit = 25,
    } = req.query;

    // Determine which org to scope to
    const targetOrgId = role === "super_admin"
      ? (queryOrgId || undefined)   // super_admin: optional filter
      : callerOrgId;                 // everyone else: own org only

    const where = {};

    if (targetOrgId) where.organizationId = targetOrgId;
    if (module) where.module = { contains: module, mode: "insensitive" };
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (userId) where.userId = userId;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * pageSize;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          organization: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      message: "Audit logs fetched successfully",
      logs,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * GET /api/audit-logs/modules
 * Returns the distinct module names present in the audit log for the caller's org.
 * Useful for populating filter dropdowns in the UI.
 */
async function getAuditLogModules(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;

    const where = role === "super_admin" ? {} : { organizationId: callerOrgId };

    const distinct = await prisma.auditLog.findMany({
      where,
      select: { module: true },
      distinct: ["module"],
      orderBy: { module: "asc" },
    });

    res.status(200).json({
      message: "Audit log modules fetched successfully",
      modules: distinct.map((d) => d.module),
    });
  } catch (error) {
    console.error("Get audit log modules error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { getAuditLogs, getAuditLogModules };
