const axios = require("axios");
const BaseProvider = require("./BaseProvider");

/**
 * SlackProvider — sends notifications to Slack via Incoming Webhooks.
 *
 * Integration model:
 *   Uses Slack Incoming Webhooks (the simplest and most widely available method).
 *   Supports Block Kit message formatting for rich notifications.
 *
 *   How to create a webhook:
 *   1. Go to https://api.slack.com/apps → Create New App → From scratch
 *   2. Select workspace → Add feature: Incoming Webhooks → Activate
 *   3. Add New Webhook to Workspace → select channel → Copy Webhook URL
 *   4. URL format: https://hooks.slack.com/services/T.../B.../...
 *
 * Required config fields:
 *   webhookUrl — Slack Incoming Webhook URL
 *
 * Optional:
 *   channel    — override channel (e.g. #alerts) — only works if webhook allows override
 *   username   — override bot display name
 *   iconEmoji  — override bot icon (e.g. :bell:)
 */
class SlackProvider extends BaseProvider {
  constructor() {
    super("slack", "slack_webhook");
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.webhookUrl) {
      errors.push("Slack Webhook URL is required");
    } else if (!config.webhookUrl.startsWith("https://hooks.slack.com/")) {
      errors.push("URL must be a Slack Incoming Webhook URL (https://hooks.slack.com/services/...)");
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  async sendNotification(config, recipients, payload) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const vars = payload.variables || {};
    const eventType = payload.eventType || "system_alert";
    const priority = vars.priority || "medium";
    const restroomName = vars.restroomName || "Unknown Restroom";
    const siteName = vars.siteName || "Unknown Site";

    const priorityEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[priority] || "🟡";
    const isEmergency = eventType === "emergency_feedback" || vars.feedbackType === "emergency";
    const headerEmoji = isEmergency ? "🚨" : "⚠️";

    const eventLabels = {
      unhappy_feedback: "Unhappy Feedback",
      emergency_feedback: "Emergency Alert",
      device_offline: "Device Offline",
      low_battery: "Low Battery",
      gateway_offline: "Gateway Offline",
      system_alert: "System Alert",
    };
    const eventLabel = eventLabels[eventType] || eventType.replace(/_/g, " ");

    const fieldLines = [
      vars.siteName && `*Site:* ${vars.siteName}`,
      vars.floorName && `*Floor:* ${vars.floorName}`,
      vars.restroomName && `*Restroom:* ${vars.restroomName}`,
      vars.deviceId && `*Device:* ${vars.deviceId}`,
      priority && `*Priority:* ${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
      vars.batteryLevel && `*Battery:* ${vars.batteryLevel}%`,
      vars.timestamp && `*Time:* ${new Date(vars.timestamp).toLocaleString("en-GB")}`,
    ].filter(Boolean).join("\n");

    const body = this.renderTemplate(payload.body, vars);
    const portalUrl = `${process.env.APP_URL || "http://localhost:5173"}/alerts`;

    // Slack Block Kit message
    const message = {
      ...(config.channel ? { channel: config.channel } : {}),
      ...(config.username ? { username: config.username } : { username: "Smart Restroom Alerts" }),
      ...(config.iconEmoji ? { icon_emoji: config.iconEmoji } : { icon_emoji: ":bell:" }),
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${headerEmoji} ${eventLabel} — ${restroomName}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: body || `An alert has been triggered for *${restroomName}* at *${siteName}*.`,
          },
        },
        ...(fieldLines
          ? [{ type: "section", text: { type: "mrkdwn", text: fieldLines } }]
          : []),
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View in Portal →", emoji: true },
              url: portalUrl,
              style: "primary",
            },
          ],
        },
        { type: "divider" },
      ],
    };

    try {
      await axios.post(config.webhookUrl, message, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      const notifiedRecipients = recipients.length > 0
        ? recipients.filter((r) => r.enabled).map((r) => r.recipientValue)
        : [config.webhookUrl];

      return { success: true, recipients: notifiedRecipients };
    } catch (error) {
      const msg = error.response?.data || error.message;
      return { success: false, error: String(msg) };
    }
  }

  async sendTestNotification(config, recipients) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    return this.sendNotification(config, recipients, {
      subject: "Test Notification",
      body: "This is a test notification from Smart Restroom Feedback System. Your Slack integration is working correctly.",
      eventType: "system_alert",
      variables: {
        siteName: "Test Site",
        floorName: "Test Floor",
        restroomName: "Test Restroom",
        deviceId: "TEST-001",
        priority: "medium",
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = SlackProvider;
