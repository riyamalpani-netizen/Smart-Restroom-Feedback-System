const axios = require("axios");
const BaseProvider = require("./BaseProvider");

/**
 * TeamsProvider — sends notifications to Microsoft Teams via Power Automate Workflow.
 *
 * Supports:
 *   - Power Platform URLs  (environment.api.powerplatform.com)
 *   - Logic App URLs       (prod-xx.westus.logic.azure.com)
 *   - Classic webhooks     (webhook.office.com — retired May 2026, kept for compatibility)
 *
 * Required config fields:
 *   webhookUrl — Power Automate Workflow URL
 *
 * Optional config fields:
 *   recipientLabel — friendly label shown in the card
 */
class TeamsProvider extends BaseProvider {
  constructor() {
    super("teams", "teams_workflow");
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.webhookUrl) {
      errors.push("Teams Webhook URL is required");
    } else {
      try {
        const url = new URL(config.webhookUrl);
        if (url.protocol !== "https:") {
          errors.push("Teams Webhook URL must use HTTPS");
        }
      } catch {
        errors.push("Teams Webhook URL is not a valid URL");
      }
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  /**
   * Power Platform URLs ship with api-version=1 in the template.
   * The actual endpoint requires a real API version like 2024-10-01.
   * This method patches that automatically so the user doesn't have to fix the URL manually.
   */
  _fixApiVersion(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const current = url.searchParams.get("api-version");
      // Only patch if the version is missing, empty, or set to the placeholder "1"
      if (!current || current === "1" || current === "1.0") {
        url.searchParams.set("api-version", "2024-10-01");
      }
      return url.toString();
    } catch {
      return rawUrl;
    }
  }

  _buildCard(payload) {
    const vars = payload.variables || {};
    const restroomName = vars.restroomName || "Unknown Restroom";
    const siteName = vars.siteName || vars.locationName || "Unknown Site";
    const eventType = payload.eventType || "system_alert";
    const priority = vars.priority || "medium";
    const feedbackType = vars.feedbackType || eventType;
    const recipientLabel = vars.recipientLabel || "Operations Team";

    const isEmergency = feedbackType === "emergency" || eventType === "emergency_feedback";
    const priorityColor = { critical: "attention", high: "warning", medium: "warning", low: "good" }[priority] || "warning";
    const priorityEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[priority] || "🟡";
    const headerEmoji = isEmergency ? "🚨" : "⚠️";
    const portalUrl = `${process.env.APP_URL || "http://localhost:5173"}/alerts`;

    const eventLabels = {
      unhappy_feedback: "Unhappy Feedback",
      emergency_feedback: "Emergency Alert",
      device_offline: "Device Offline",
      low_battery: "Low Battery",
      gateway_offline: "Gateway Offline",
      system_alert: "System Alert",
    };
    const eventLabel = eventLabels[eventType] || eventType.replace(/_/g, " ");

    const facts = [
      { title: "Event",    value: `**${eventLabel}**` },
      siteName            && { title: "Site",      value: siteName },
      vars.floorName      && { title: "Floor",     value: vars.floorName },
      restroomName        && { title: "Restroom",  value: restroomName },
      vars.deviceId       && { title: "Device",    value: vars.deviceId },
      priority            && { title: "Priority",  value: `${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}` },
      vars.batteryLevel   && { title: "Battery",   value: `${vars.batteryLevel}%` },
      vars.timestamp      && { title: "Time",      value: new Date(vars.timestamp).toLocaleString("en-GB") },
      recipientLabel      && { title: "Recipient", value: recipientLabel },
    ].filter(Boolean);

    return {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "Container",
                style: isEmergency ? "attention" : priorityColor,
                bleed: true,
                items: [
                  {
                    type: "TextBlock",
                    text: `${headerEmoji} ${eventLabel} — ${restroomName}`,
                    weight: "Bolder",
                    size: "Large",
                    color: "Light",
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: "Smart Restroom Feedback System",
                    size: "Small",
                    color: "Light",
                    isSubtle: true,
                    spacing: "None",
                  },
                ],
              },
              {
                type: "FactSet",
                spacing: "Medium",
                facts,
              },
            ],
            actions: [
              {
                type: "Action.OpenUrl",
                title: "View in Portal →",
                url: portalUrl,
                style: "positive",
              },
            ],
          },
        },
      ],
    };
  }

  async sendNotification(config, recipients, payload) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    // Patch api-version in Power Platform URLs automatically
    const webhookUrl = this._fixApiVersion(config.webhookUrl);
    const card = this._buildCard(payload);

    try {
      const response = await axios.post(webhookUrl, card, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      const notifiedRecipients = recipients.length > 0
        ? recipients.filter((r) => r.enabled).map((r) => r.recipientValue)
        : [webhookUrl];

      return { success: true, recipients: notifiedRecipients, details: { status: response.status } };
    } catch (error) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        (typeof error.response?.data === "string" ? error.response.data : null) ||
        error.message;
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
      body: "This is a test Teams notification from Smart Restroom Feedback System.",
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

module.exports = TeamsProvider;
