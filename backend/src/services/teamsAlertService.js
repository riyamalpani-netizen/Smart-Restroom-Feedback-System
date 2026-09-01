const prisma = require("../config/database");
const { sendTeamsWebhook } = require("./teamsWebhookService");

/**
 * Sends a Teams alert only to the organisation that owns the restroom.
 * A Teams incoming webhook delivers to a channel; the channel membership is
 * therefore the recipient list rather than a list of individual app users.
 */
async function notifyTeamsForAlert({ alert, feedback, restroom }) {
  const settings = await prisma.settings.findUnique({
    where: { organizationId: restroom.organizationId },
    select: { teamsWebhook: true, teamsRecipient: true },
  });

  const recipient = settings?.teamsRecipient || "Operations Teams channel";
  const notification = await prisma.notification.create({
    data: {
      alertId: alert.id,
      type: "teams",
      recipient,
      status: "pending",
    },
  });

  if (!settings?.teamsWebhook) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "skipped" },
    });
    return { sent: false, reason: "Teams webhook not configured" };
  }

  const result = await sendTeamsWebhook(settings.teamsWebhook, {
    restroom: restroom.name,
    feedbackType: feedback.feedbackType,
    priority: alert.priority,
    battery: feedback.battery,
    timestamp: feedback.timestamp,
    alertId: alert.id,
    recipient,
  });

  await prisma.notification.update({
    where: { id: notification.id },
    data: result.success
      ? { status: "sent", sentAt: new Date() }
      : { status: "failed" },
  });

  return { sent: result.success, error: result.error };
}

module.exports = { notifyTeamsForAlert };
