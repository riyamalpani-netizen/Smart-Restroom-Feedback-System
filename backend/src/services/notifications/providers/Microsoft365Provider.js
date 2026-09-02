const nodemailer = require("nodemailer");
const BaseProvider = require("./BaseProvider");

/**
 * Microsoft365Provider — sends email via Microsoft 365 / Exchange Online.
 *
 * Authentication model:
 *   Microsoft 365 supports two auth modes:
 *   1. Modern Auth / OAuth2 (recommended) — uses Azure AD App Registration
 *      (client credentials or delegated flow). No password stored.
 *   2. SMTP AUTH with App Password — for accounts with SMTP AUTH enabled in
 *      Microsoft 365 Admin Center and per-mailbox SMTP AUTH permission.
 *
 *   NOTE: Basic Auth (plain username + password) is DISABLED by Microsoft for
 *   Exchange Online as of October 2022. Only OAuth2 or App Passwords work.
 *
 * authMode: 'smtp_auth'  — uses smtp.office365.com:587 with app password
 * authMode: 'oauth2'     — uses XOAUTH2 via smtp.office365.com:587
 *
 * Required config fields (smtp_auth):
 *   smtpUser (email address), smtpPassword (app password or OAuth token), fromName?
 *
 * Required config fields (oauth2):
 *   tenantId, clientId, clientSecret, smtpUser (sender mailbox), fromName?
 */
class Microsoft365Provider extends BaseProvider {
  constructor() {
    super("email", "microsoft365");
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.smtpUser) errors.push("Microsoft 365 email address (SMTP user) is required");
    if (config.smtpUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.smtpUser)) {
      errors.push("Email address is not valid");
    }

    if (config.authMode === "oauth2") {
      if (!config.tenantId) errors.push("Azure Tenant ID is required for OAuth2");
      if (!config.clientId) errors.push("Azure App Client ID is required for OAuth2");
      if (!config.clientSecret) errors.push("Azure App Client Secret is required for OAuth2");
    } else {
      // smtp_auth (default)
      if (!config.smtpPassword) errors.push("SMTP Password / App Password is required");
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  async _getOAuthAccessToken(config) {
    // Exchange client credentials for an access token from Microsoft Identity Platform.
    // Uses the SMTP.Send permission scope.
    const axios = require("axios");
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "https://outlook.office365.com/.default",
    });
    const response = await axios.post(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return response.data.access_token;
  }

  async _createTransport(config) {
    if (config.authMode === "oauth2") {
      const accessToken = await this._getOAuthAccessToken(config);
      return nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: {
          type: "OAuth2",
          user: config.smtpUser,
          accessToken,
        },
        tls: { ciphers: "SSLv3" },
      });
    }

    // smtp_auth mode
    return nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
      tls: { ciphers: "SSLv3" },
    });
  }

  async sendNotification(config, recipients, payload) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const enabledRecipients = recipients.filter((r) => r.enabled && r.recipientType === "email");
    if (enabledRecipients.length === 0) {
      return { success: false, error: "No enabled email recipients configured" };
    }

    const toAddresses = enabledRecipients.map((r) => r.recipientValue);
    const fromName = config.fromName || "Smart Restroom Alerts";
    const subject = this.renderTemplate(payload.subject || "Notification — Smart Restroom System", payload.variables);
    const body = this.renderTemplate(payload.body, payload.variables);
    const html = payload.format === "html" ? body : this._buildHtmlWrapper(subject, body);

    try {
      const transporter = await this._createTransport(config);
      await transporter.sendMail({
        from: `"${fromName}" <${config.smtpUser}>`,
        to: toAddresses.join(", "),
        subject,
        html,
        text: body,
      });
      return { success: true, recipients: toAddresses };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendTestNotification(config, recipients) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const testRecipients = recipients.filter((r) => r.enabled);
    if (testRecipients.length === 0) {
      testRecipients.push({ recipientType: "email", recipientValue: config.smtpUser, enabled: true });
    }

    return this.sendNotification(config, testRecipients, {
      subject: "✅ Test Email — Smart Restroom Feedback System",
      body: "This is a test email from your Smart Restroom Feedback System Microsoft 365 notification channel. Your configuration is working correctly.",
      format: "text",
      eventType: "system_alert",
      variables: { siteName: "Test Site", timestamp: new Date().toLocaleString() },
    });
  }

  _buildHtmlWrapper(subject, body) {
    const lines = body.split("\n").filter(Boolean)
      .map((l) => `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">${l}</p>`)
      .join("");
    return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;padding:32px 0;">
      <table width="560" align="center" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0078d4;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${subject}</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px;">Smart Restroom Feedback System</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">${lines}</td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Automated alert — Microsoft 365</p>
        </td></tr>
      </table>
    </body></html>`;
  }
}

module.exports = Microsoft365Provider;
