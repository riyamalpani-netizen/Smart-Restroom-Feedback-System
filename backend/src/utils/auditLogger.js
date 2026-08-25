/**
 * Centralised audit-logging helper.
 *
 * Every mutation that a Vendor Admin (or Super Admin) performs should call
 * logAudit() so there is a complete, org-scoped trail of who did what.
 *
 * Usage:
 *   await logAudit(req, { module: 'Device', action: 'CREATE', description: `Created device ${device.badgeId}` })
 */
const prisma = require("../config/database");

/**
 * @param {import('express').Request} req  – authenticated Express request (req.user must be populated)
 * @param {{ module: string, action: string, description: string }} entry
 */
async function logAudit(req, { module, action, description }) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const organizationId = req.user?.organizationId;

    if (!userId || !organizationId) {
      // Silently skip if auth context is missing (e.g. test/seed scripts)
      return;
    }

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        module,
        action,
        description,
      },
    });
  } catch (err) {
    // Audit logging must never crash the main request
    console.error("[auditLogger] Failed to write audit log:", err?.message || err);
  }
}

module.exports = { logAudit };
