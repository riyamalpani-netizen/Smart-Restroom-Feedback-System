const axios = require("axios");

async function sendTeamsWebhook(webhookUrl, data) {
  try {
    if (!webhookUrl) {
      return { success: false, error: "Webhook URL not configured" };
    }

    const restroomLabel = data.restroom || "Unknown Restroom";
    const statusLabel = data.feedbackType ? data.feedbackType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown Status";
    const priorityLabel = data.priority ? data.priority.charAt(0).toUpperCase() + data.priority.slice(1) : "Medium";
    const batteryText = data.battery !== null && data.battery !== undefined ? `${data.battery}%` : "N/A";

    const timeText = data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString();

    const card = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "TextBlock",
                text: `🚨 Restroom Alert - ${restroomLabel}`,
                weight: "Bolder",
                size: "Large",
                color: data.feedbackType === "emergency" ? "Attention" : "Warning",
              },
              {
                type: "FactSet",
                facts: [
                  { title: "Status:", value: statusLabel },
                  { title: "Priority:", value: priorityLabel },
                  { title: "Battery:", value: batteryText },
                  { title: "Time:", value: timeText },
                  ...(data.alertId ? [{ title: "Alert ID:", value: data.alertId }] : []),
                ],
              },
            ],
          },
        },
      ],
    };

    const response = await axios.post(webhookUrl, card, {
      headers: { "Content-Type": "application/json" },
    });

    return { success: true, status: response.status };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    return { success: false, error: errorMessage };
  }
}

module.exports = {
  sendTeamsWebhook,
};
