const prisma = require("../config/database");
const { sendTeamsWebhook } = require("./teamsWebhookService");
const { sendEmailAlert } = require("./emailAlertService");

/**
 * Notifies the vendor-admin team when an unhappy/emergency complaint fires.
 *
 * Notification channels (both run in parallel):
 *   1. Email  — always fires if SMTP_USER + SMTP_PASS are set in .env
 *   2. Teams  — fires if a Teams Incoming Webhook URL is configured in DB or TEAMS_WEBHOOK_URL env var
 *
 * Gate: only orgs with at least one active vendor_admin user are notified.
 */
async function notifyTeamsForAlert({ alert, feedback, restroom }) {
  // ── Vendor-admin org gate ──────────────────────────────────────────────────
  const vendorAdmin = await prisma.user.findFirst({
    where: { organizationId: restroom.organizationId, role: "vendor_admin", active: true },
    select: { id: true },
  });

  if (!vendorAdmin) {
    return { sent: false, reason: "Teams notifications are only available for vendor admin organisations" };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const settings = await prisma.settings.findUnique({
    where: { organizationId: restroom.organizationId },
    select: { teamsWebhook: true, teamsRecipient: true },
  });

  const webhookUrl = settings?.teamsWebhook?.trim() || process.env.TEAMS_WEBHOOK_URL?.trim() || null;
  const recipient  = settings?.teamsRecipient || "anshu.puri@atlasied.com";

  const alertPayload = {
    restroomName: restroom.name,
    feedbackType: feedback.feedbackType,
    priority:     alert.priority,
    battery:      feedback.battery,
    timestamp:    feedback.timestamp,
    alertId:      alert.id,
    recipient,
    location:     restroom.name,
  };

  // ── Run both channels concurrently ─────────────────────────────────────────
  const [emailResult, teamsResult] = await Promise.allSettled([
    // 1. Email — direct to anshu.puri@atlasied.com via Office 365 SMTP
    sendEmailAlert(alertPayload),

    // 2. Teams webhook — only if a URL is configured
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

  const email = emailResult.status === "fulfilled" ? emailResult.value : { sent: false, error: emailResult.reason };
  const teams = teamsResult.status === "fulfilled" ? teamsResult.value : { sent: false, error: teamsResult.reason };

  if (!webhookUrl) {
    // Record a skipped notification so the audit trail is complete
    await prisma.notification.create({
      data: { alertId: alert.id, type: "teams", recipient, status: "skipped" },
    }).catch(() => {});
  }

  return { email, teams };
}

module.exports = { notifyTeamsForAlert };
