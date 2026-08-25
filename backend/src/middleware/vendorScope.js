/**
 * vendorScope middleware
 *
 * requireVendorScope() — attaches a helper to req so every controller can call
 *   req.vendorWhere(prismaWhere)  → merges orgId constraint into a Prisma where-clause
 *   req.assertOrgOwnership(orgId) → throws 403 if the supplied orgId doesn't match the
 *                                   caller's own org (super_admin bypasses this)
 *
 * requireSuperAdmin() — blocks any non-super_admin caller with 403.
 *
 * These are thin helpers on top of the existing authorize() middleware; they add
 * *data-level* enforcement so a vendor_admin can never touch another org's records
 * even if a route accidentally allows the wrong role through.
 */

/**
 * Attach vendor-scoping helpers to req.
 * Must be used AFTER authenticate() so req.user is populated.
 */
function requireVendorScope(req, res, next) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;

  /**
   * Merge the caller's org constraint into an existing Prisma where-object.
   * Super admins receive no extra filter (sees all data).
   *
   * @param {Record<string, unknown>} where  – existing where clause (may be {})
   * @param {string} [field="organizationId"]  – the field on the target model
   * @returns {Record<string, unknown>}
   */
  req.vendorWhere = function (where = {}, field = "organizationId") {
    if (role === "super_admin") return where;
    return { ...where, [field]: orgId };
  };

  /**
   * Assert that a given organizationId matches the caller's own org.
   * Returns true for super_admin unconditionally.
   * Sends 403 and returns false if the check fails.
   *
   * @param {string} targetOrgId
   * @param {import('express').Response} res
   * @returns {boolean}  – true = allowed, false = blocked (response already sent)
   */
  req.assertOrgOwnership = function (targetOrgId, res) {
    if (role === "super_admin") return true;
    if (!targetOrgId || targetOrgId !== orgId) {
      res.status(403).json({
        message: "Access denied: resource belongs to a different organisation",
      });
      return false;
    }
    return true;
  };

  /**
   * Whether the current caller is a super admin.
   */
  req.isSuperAdmin = role === "super_admin";

  /**
   * The caller's organisationId (undefined for super_admin when not applicable).
   */
  req.callerOrgId = orgId;

  next();
}

/**
 * Hard-block anyone who is not a super_admin.
 * Use this on routes that are purely global-platform-level (e.g. org provisioning).
 */
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({
      message: "This action is restricted to Super Admins",
    });
  }
  return next();
}

/**
 * Block vendor_admin from accessing or mutating another vendor's data when
 * the target organisationId is supplied as a query param or body field.
 *
 * Place this AFTER authenticate() + authorize().
 * The middleware reads req.query.organizationId and req.body.organizationId.
 */
function blockCrossVendorAccess(req, res, next) {
  const role = req.user?.role;
  if (role === "super_admin") return next();

  const callerOrg = req.user?.organizationId;
  const targetOrg = req.query?.organizationId || req.body?.organizationId;

  if (targetOrg && targetOrg !== callerOrg) {
    return res.status(403).json({
      message: "Access denied: you can only access your own organisation's data",
    });
  }

  // Also normalise: if vendor_admin doesn't supply an orgId, inject their own
  // so controllers don't accidentally return everything.
  if (!targetOrg) {
    if (req.query !== undefined) req.query.organizationId = callerOrg;
  }

  return next();
}

module.exports = { requireVendorScope, requireSuperAdmin, blockCrossVendorAccess };
