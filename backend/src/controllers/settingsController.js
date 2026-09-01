const prisma = require("../config/database");
const { sendTeamsWebhook } = require("../services/teamsWebhookService");
const { logAudit } = require("../utils/auditLogger");

/**
 * GET /api/settings
 *
 * - super_admin: can query any org via ?organizationId=
 * - vendor_admin: always returns their own org's settings (ignores query param)
 * - other roles: blocked at the route level
 */
/**
 * Strips Teams-webhook fields from a settings object for non-vendor-admin callers.
 * Teams integration is a vendor-portal-only feature.
 */
function stripTeamsFields(settings) {
  const { teamsWebhook, teamsRecipient, ...rest } = settings;
  return rest;
}

async function getSettings(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;

    // Vendor admin is always scoped to their own org
    const organizationId = role === "super_admin"
      ? (req.query.organizationId || callerOrgId)
      : callerOrgId;

    const settings = await prisma.settings.findFirst({
      where: organizationId ? { organizationId } : undefined,
    });

    if (!settings) {
      // Return sensible defaults if no record exists yet
      const defaults = {
        organizationId: organizationId || null,
        teamsWebhook: "",
        teamsRecipient: "Operations Teams channel",
        reportFrequency: "daily",
        sessionTimeout: 28800,
        passwordPolicy: "min 8 chars, 1 uppercase, 1 number",
      };
      return res.status(200).json({
        message: "Settings not found – defaults returned",
        settings: role === "super_admin" ? stripTeamsFields(defaults) : defaults,
      });
    }

    // Vendor admin must not see other org's settings
    if (role !== "super_admin" && settings.organizationId !== callerOrgId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Super admin does not use the Teams integration — strip those fields
    const payload = role === "super_admin" ? stripTeamsFields(settings) : settings;
    res.status(200).json({ message: "Settings fetched successfully", settings: payload });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * PUT /api/settings
 *
 * - super_admin: can update any org's settings
 * - vendor_admin: can only update their own org's settings
 *   - cannot change passwordPolicy (global security concern)
 *   - can change teamsWebhook, reportFrequency, sessionTimeout
 */
async function updateSettings(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;

    const requestedOrgId = req.body.organizationId;

    // Determine which org we are updating
    const targetOrgId = role === "super_admin"
      ? (requestedOrgId || callerOrgId)
      : callerOrgId;

    if (!targetOrgId) {
      return res.status(400).json({ message: "Organization ID is required" });
    }

    // Vendor admin cannot update a different org's settings
    if (role !== "super_admin" && requestedOrgId && requestedOrgId !== callerOrgId) {
      return res.status(403).json({
        message: "You can only update your own organisation's settings",
      });
    }

    const { teamsWebhook, teamsRecipient, reportFrequency, sessionTimeout, passwordPolicy } = req.body;

    // Teams webhook is a vendor-portal-only feature.
    // Super admin cannot set or clear the webhook for any org.
    const updatePayload = {
      reportFrequency,
      sessionTimeout,
    };

    if (role !== "super_admin") {
      updatePayload.teamsWebhook = teamsWebhook;
      updatePayload.teamsRecipient = teamsRecipient;
    }

    if (role === "super_admin" && passwordPolicy !== undefined) {
      updatePayload.passwordPolicy = passwordPolicy;
    }

    // Remove undefined keys so Prisma doesn't overwrite with null
    Object.keys(updatePayload).forEach(
      (k) => updatePayload[k] === undefined && delete updatePayload[k]
    );

    const settings = await prisma.settings.upsert({
      where: { organizationId: targetOrgId },
      update: updatePayload,
      create: {
        organizationId: targetOrgId,
        ...updatePayload,
      },
    });

    await logAudit(req, {
      module: "Settings",
      action: "UPDATE",
      description: `Updated settings for organisation ${targetOrgId}`,
    });

    res.status(200).json({ message: "Settings updated successfully", settings });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * POST /api/settings/test-teams-webhook
 *
 * Vendor-portal only — super_admin is blocked (403).
 * vendor_admin can only test the webhook stored for their own org.
 */
async function testTeamsWebhook(req, res) {
  try {
    const role = req.user?.role;
    const callerOrgId = req.user?.organizationId;

    const { teamsWebhook } = req.body;

    if (!teamsWebhook) {
      return res.status(400).json({ message: "Teams webhook URL is required" });
    }

    // Teams webhook is a vendor-portal-only feature — super admin cannot test it.
    if (role === "super_admin") {
      return res.status(403).json({
        message: "Teams webhook integration is only available for vendor admin organisations",
      });
    }
    // Verify the webhook URL matches what is stored for this vendor_admin's org
    // (prevents testing a URL they don't own).
    const stored = await prisma.settings.findFirst({
      where: { organizationId: callerOrgId },
      select: { teamsWebhook: true },
    });
    // Allow if URL matches stored value OR if no stored value (first-time test)
    if (stored?.teamsWebhook && stored.teamsWebhook !== teamsWebhook) {
      return res.status(403).json({
        message: "You can only test the webhook for your own organisation",
      });
    }

    const result = await sendTeamsWebhook(teamsWebhook, {
      restroom: "Test Restroom",
      feedbackType: "needs_cleaning",
      priority: "medium",
      battery: 85,
      timestamp: new Date().toISOString(),
      alertId: "TEST-001",
    });

    if (result.success) {
      return res.status(200).json({ message: "Teams webhook test sent successfully" });
    } else {
      return res.status(400).json({ message: "Failed to send Teams webhook", error: result.error });
    }
  } catch (error) {
    console.error("Test Teams webhook error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  testTeamsWebhook,
};
