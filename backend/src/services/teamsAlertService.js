const prisma = require("../config/database");
const { sendTeamsWebhook } = require("./teamsWebhookService");
const { sendEmailAlert } = require("./emailAlertService");
const notificationService = require("./notifications/NotificationService");

/**
 * notifyTeamsForAlert — called by the feedback/alert pipeline on every
 * unhappy / emergency feedback event.
 *
 * Dual-track delivery:
 *   Track A — NEW: NotificationService (configured channels in DB)
 *             Delivers via any channel/provider the Vendor Admin has configured
 *             (Gmail, SMTP, Teams Workflow, Slack, Webhook, etc.)
 *
 *   Track B — LEGACY: Direct hardcoded email + Teams webhook
 *             Kept as a fallback so existing .env-based configs keep working
 *             even before the Vendor Admin has set up the new channel system.
 *             Skipped if the org already has NotificationChannels configured.
 *
 * Both tracks run concurrently via Promise.allSettled — a failure in either
 * track never blocks the other.
 */
async function notifyTeamsForAlert({ alert, feedback, restroom }) {
  // Gate: only vendor-admin orgs
  const vendorAdmin = await prisma.user.findFirst({
    where: { organizationId: restroom.organizationId, role: "vendor_admin", active: true },
    select: { id: true },
  });
  if (!vendorAdmin) {
    return { sent: false, reason: "Notifications are only available for vendor admin organisations" };
  }

  // Build the rich variable set for templates
  const floor = restroom.floor || await prisma.floor.findFirst({
    where: { id: restroom.floorId },
    include: { location: true },
  });
  const location = floor?.location || null;

  const variables = {
    siteName:      location?.officeName || location?.city || restroom.name,
    floorName:     floor?.floorName || "—",
    restroomName:  restroom.name,
    deviceId:      feedback.device?.badgeId || feedback.deviceId || "—",
    feedbackType:  feedback.feedbackType,
    priority:      alert.priority,
    batteryLevel:  feedback.battery != null ? String(feedback.battery) : "N/A",
    timestamp:     new Date(feedback.timestamp || Date.now()).toLocaleString("en-GB"),
    alertId:       alert.id,
    locationName:  location?.officeName || "—",
  };

  const eventType = feedback.feedbackType === "emergency" ? "emergency_feedback" : "unhappy_feedback";

  // ── Check whether the org has new-style channels configured ───────────────
  const channelCount = await prisma.notificationChannel.count({
    where: { organizationId: restroom.organizationId, enabled: true },
  });

  const [newTrack, legacyTrack] = await Promise.allSettled([
    // Track A: new NotificationService (always attempted)
    notificationService.trigger(eventType, restroom.organizationId, variables, { alertId: alert.id }),

    // Track B: legacy direct delivery — only if NO new channels are configured
    channelCount === 0
      ? _legacyDeliver({ alert, feedback, restroom, variables })
      : Promise.resolve({ skipped: true, reason: "New channel system active" }),
  ]);

  return {
    newChannels: newTrack.status === "fulfilled" ? newTrack.value : { error: newTrack.reason?.message },
    legacy:      legacyTrack.status === "fulfilled" ? legacyTrack.value : { error: legacyTrack.reason?.message },
  };
}

/** Original delivery logic — preserved intact as legacy fallback */
async function _legacyDeliver({ alert, feedback, restroom, variables }) {
  const settings = await prisma.settings.findUnique({
    where: { organizationId: restroom.organizationId },
    select: { teamsWebhook: true, teamsRecipient: true },
  });

  const webhookUrl = settings?.teamsWebhook?.trim() || process.env.TEAMS_WEBHOOK_URL?.trim() || null;
  const recipient  = settings?.teamsRecipient || "Operations Team";

  const alertPayload = {
    restroomName: restroom.name,
    feedbackType: feedback.feedbackType,
    priority:     alert.priority,
    battery:      feedback.battery,
    timestamp:    feedback.timestamp,
    alertId:      alert.id,
    recipient,
    location:     variables.siteName,
  };

  const [emailResult, teamsResult] = await Promise.allSettled([
    sendEmailAlert(alertPayload),
    webhookUrl
      ? (async () => {
          const notification = await prisma.notification.create({
            data: { alertId: alert.id, type: "teams", recipient, status: "pending" },
          });
          const result = await sendTeamsWebhook(webhookUrl, { ...alertPayload, restroom: restroom.name });
          await prisma.notification.update({
            where: { id: notification.id },
            data: result.success ? { status: "sent", sentAt: new Date() } : { status: "failed" },
          });
          return result;
        })()
      : Promise.resolve({ sent: false, reason: "Teams webhook not configured" }),
  ]);

  if (!webhookUrl) {
    await prisma.notification.create({
      data: { alertId: alert.id, type: "teams", recipient, status: "skipped" },
    }).catch(() => {});
  }

  return {
    email: emailResult.status === "fulfilled" ? emailResult.value : { sent: false, error: emailResult.reason },
    teams: teamsResult.status === "fulfilled" ? teamsResult.value : { sent: false, error: teamsResult.reason },
  };
}

module.exports = { notifyTeamsForAlert };
