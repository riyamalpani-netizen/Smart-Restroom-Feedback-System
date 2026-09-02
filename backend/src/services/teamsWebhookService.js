const axios = require("axios");

/**
 * Posts an Adaptive Card alert to a Microsoft Teams channel via:
 *   - Teams Workflows webhook  (powerplatform.com / logic.azure.com)
 *   - Classic Incoming Webhook (webhook.office.com)
 *
 * Both URL types receive the same Adaptive Card payload.
 * Teams Workflows explicitly requires an Adaptive Card or Message Card format.
 *
 * Required .env:
 *   TEAMS_WEBHOOK_URL   URL copied from Teams channel → ··· → Workflows
 *   APP_URL             http://localhost:5173  (used in the "View in Portal" button)
 */

async function sendTeamsWebhook(webhookUrl, data) {
  try {
    if (!webhookUrl) {
      return { success: false, error: "Webhook URL not configured" };
    }

    // Patch Power Platform URLs that have api-version=1 placeholder
    let fixedUrl = webhookUrl;
    try {
      const u = new URL(webhookUrl);
      const v = u.searchParams.get("api-version");
      if (!v || v === "1" || v === "1.0") {
        u.searchParams.set("api-version", "2024-10-01");
        fixedUrl = u.toString();
      }
    } catch { /* keep original if URL parse fails */ }

    const restroomLabel = data.restroom || data.restroomName || "Unknown Restroom";
    const feedbackType  = data.feedbackType || "unknown";
    const statusLabel   = feedbackType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const priorityLabel = data.priority
      ? data.priority.charAt(0).toUpperCase() + data.priority.slice(1)
      : "Medium";
    const batteryText = data.battery != null ? `${data.battery}%` : "N/A";
    const timeText    = new Date(data.timestamp || Date.now()).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "medium",
    });

    const isEmergency   = feedbackType === "emergency";
    const priorityColor = { critical: "attention", high: "warning", medium: "warning", low: "good" }[data.priority] || "warning";
    const priorityEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[data.priority] || "🟡";
    const headerEmoji   = isEmergency ? "🚨" : "⚠️";
    const portalUrl     = `${process.env.APP_URL || "http://localhost:5173"}/alerts`;

    // Adaptive Card v1.4 — required by Teams Workflows webhook
    // Also works with classic webhook.office.com Incoming Webhooks
    const payload = {
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
              // ── Header banner ──────────────────────────────────────────────
              {
                type: "Container",
                style: isEmergency ? "attention" : "warning",
                bleed: true,
                items: [
                  {
                    type: "TextBlock",
                    text: `${headerEmoji} Restroom Alert — ${restroomLabel}`,
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

              // ── Alert details ──────────────────────────────────────────────
              {
                type: "FactSet",
                spacing: "Medium",
                facts: [
                  { title: "Priority", value: `${priorityEmoji} **${priorityLabel}**` },
                  { title: "Status",   value: statusLabel },
                  { title: "Location", value: data.location || restroomLabel },
                  { title: "Battery",  value: batteryText },
                  { title: "Time",     value: timeText },
                  ...(data.alertId ? [{ title: "Alert ID", value: String(data.alertId) }] : []),
                ],
              },
            ],

            // ── Action button ──────────────────────────────────────────────
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

    const response = await axios.post(fixedUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    return { success: true, status: response.status };
  } catch (error) {
    const msg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.response?.data ||
      error.message;
    return { success: false, error: String(msg) };
  }
}

module.exports = { sendTeamsWebhook };
