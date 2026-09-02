const axios = require("axios");
const BaseProvider = require("./BaseProvider");

/**
 * TeamsGraphChannelProvider
 *
 * Posts alert messages directly to a Microsoft Teams channel using the
 * Microsoft Graph API — no Power Automate, no expiring webhook URLs.
 *
 * Auth: Azure AD app credentials (client credentials flow / app-only token).
 * Permission required: ChannelMessage.Send (Application) + admin consent.
 *
 * Required config fields:
 *   tenantId    — Azure AD / Entra tenant ID
 *   clientId    — Azure AD app registration client ID
 *   clientSecret— Azure AD app client secret (encrypted at rest)
 *   teamId      — Microsoft Teams group/team ID
 *   channelId   — Teams channel ID (19:xxx@thread.tacv2)
 *
 * How to get these:
 *   tenantId  — Azure Portal → Azure Active Directory → Overview → Tenant ID
 *               OR extract from a Teams channel deep link (?tenantId=...)
 *   clientId  — Azure Portal → App registrations → your app → Application (client) ID
 *   clientSecret — App registrations → Certificates & secrets → New client secret
 *   teamId    — Teams channel deep link (?groupId=...)
 *   channelId — Teams channel deep link (19%3A...%40thread.tacv2 decoded)
 *
 * Azure AD app permissions required (Application, not Delegated):
 *   ChannelMessage.Send   — Post messages to channels
 *   (Grant admin consent after adding)
 */
class TeamsGraphChannelProvider extends BaseProvider {
  constructor() {
    super("teams", "teams_graph_channel");
    this._tokenCache = null; // { token, expiresAt }
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.tenantId)     errors.push("Azure Tenant ID is required");
    if (!config.clientId)     errors.push("Azure App Client ID is required");
    if (!config.clientSecret) errors.push("Azure App Client Secret is required");
    if (!config.teamId)       errors.push("Team ID (Group ID) is required");
    if (!config.channelId)    errors.push("Channel ID is required");

    if (config.channelId && !config.channelId.startsWith("19:")) {
      errors.push("Channel ID must start with '19:' (e.g. 19:xxx@thread.tacv2)");
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  /**
   * Get an access token using client credentials flow.
   * Caches the token until 2 minutes before expiry.
   */
  async _getAccessToken(config) {
    const now = Date.now();
    if (this._tokenCache && this._tokenCache.expiresAt > now + 120_000) {
      return this._tokenCache.token;
    }

    const params = new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     config.clientId,
      client_secret: config.clientSecret,
      scope:         "https://graph.microsoft.com/.default",
    });

    const response = await axios.post(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000 }
    );

    const { access_token, expires_in } = response.data;
    this._tokenCache = {
      token:     access_token,
      expiresAt: now + expires_in * 1000,
    };
    return access_token;
  }

  /**
   * Build the Graph API message body.
   * Uses HTML content (richText) for a clean card-like appearance in Teams.
   */
  _buildMessageBody(payload) {
    const vars = payload.variables || {};
    const eventType    = payload.eventType || "system_alert";
    const restroomName = vars.restroomName || "Unknown Restroom";
    const siteName     = vars.siteName || vars.locationName || "Unknown Site";
    const floorName    = vars.floorName || "—";
    const deviceId     = vars.deviceId || "—";
    const priority     = vars.priority || "medium";
    const feedbackType = vars.feedbackType || eventType;
    const timestamp    = vars.timestamp
      ? new Date(vars.timestamp).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium" })
      : new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium" });

    const isEmergency  = feedbackType === "emergency" || eventType === "emergency_feedback";
    const headerEmoji  = isEmergency ? "🚨" : "⚠️";
    const priorityEmoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[priority] || "🟡";
    const headerColor  = isEmergency ? "#dc2626" : priority === "critical" ? "#dc2626" : priority === "high" ? "#ea580c" : "#d97706";

    const eventLabels = {
      unhappy_feedback:   "Unhappy Feedback",
      emergency_feedback: "Emergency Alert",
      device_offline:     "Device Offline",
      low_battery:        "Low Battery",
      gateway_offline:    "Gateway Offline",
      system_alert:       "System Alert",
    };
    const eventLabel = eventLabels[eventType] || eventType.replace(/_/g, " ");
    const portalUrl  = `${process.env.APP_URL || "http://localhost:5173"}/alerts`;

    const html = `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;">
  <div style="background:${headerColor};padding:16px 20px;border-radius:6px 6px 0 0;">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${headerEmoji} ${eventLabel} — ${restroomName}</p>
    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.8);">Smart Restroom Feedback System</p>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;">
    <tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;width:120px;">Site</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;">${siteName}</td></tr>
    <tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Floor</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;">${floorName}</td></tr>
    <tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Restroom</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;">${restroomName}</td></tr>
    <tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Device</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;">${deviceId}</td></tr>
    <tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Priority</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;">${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}</td></tr>
    <tr><td style="padding:8px 16px;font-size:13px;color:#6b7280;">Time</td><td style="padding:8px 16px;font-size:13px;font-weight:600;color:#111827;">${timestamp}</td></tr>
  </table>
  <p style="margin:12px 0 0;"><a href="${portalUrl}" style="background:#0891b2;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600;">View in Portal →</a></p>
</div>`.trim();

    return {
      body: {
        contentType: "html",
        content: html,
      },
      // Subject shown as the thread title in the channel
      subject: `${headerEmoji} ${eventLabel} — ${restroomName} | ${siteName}`,
    };
  }

  async sendNotification(config, recipients, payload) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    try {
      const token      = await this._getAccessToken(config);
      const msgBody    = this._buildMessageBody(payload);
      const url        = `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(config.teamId)}/channels/${encodeURIComponent(config.channelId)}/messages`;

      const response = await axios.post(url, msgBody, {
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });

      return {
        success:    true,
        recipients: [`${config.teamId}/${config.channelId}`],
        details:    { status: response.status, messageId: response.data?.id },
      };
    } catch (error) {
      const detail = error.response?.data?.error;
      const msg    = detail?.message || detail?.code || error.message;
      return { success: false, error: String(msg) };
    }
  }

  async sendTestNotification(config, recipients) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    return this.sendNotification(config, recipients, {
      subject:   "Test Notification",
      body:      "This is a test notification from Smart Restroom Feedback System.",
      eventType: "system_alert",
      variables: {
        siteName:      "Test Site",
        floorName:     "Ground Floor",
        restroomName:  "Test Restroom",
        deviceId:      "TEST-001",
        priority:      "medium",
        feedbackType:  "needs_cleaning",
        timestamp:     new Date().toISOString(),
      },
    });
  }
}

module.exports = TeamsGraphChannelProvider;
