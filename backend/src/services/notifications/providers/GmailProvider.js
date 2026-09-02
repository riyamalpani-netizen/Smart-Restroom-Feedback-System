const nodemailer = require("nodemailer");
const BaseProvider = require("./BaseProvider");

/**
 * GmailProvider — sends email via Gmail SMTP using an App Password.
 *
 * Works with both @gmail.com and Google Workspace accounts.
 *
 * How to generate an App Password (one-time, 2 minutes):
 *   1. Go to myaccount.google.com → Security
 *   2. Enable 2-Step Verification if not already on
 *   3. Search "App passwords" → click it
 *   4. App name: "Smart Restroom" → Create
 *   5. Copy the 16-character password (spaces are fine)
 *   6. Paste it in the App Password field below
 *
 * Required config fields:
 *   gmailAddress — your Gmail or Google Workspace email
 *   appPassword  — 16-character App Password from Google
 *
 * Optional:
 *   fromName — display name for sent emails
 */
class GmailProvider extends BaseProvider {
  constructor() {
    super("email", "gmail");
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.gmailAddress) {
      errors.push("Gmail / Google Workspace address is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(config.gmailAddress)) {
      errors.push("Email address is not valid");
    }
    if (!config.appPassword) {
      errors.push("App Password is required — generate one at myaccount.google.com → Security → App passwords");
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  _createTransport(config) {
    return nodemailer.createTransport({
      host:   "smtp.gmail.com",
      port:   587,
      secure: false,
      auth: {
        user: config.gmailAddress,
        pass: config.appPassword.replace(/\s/g, ""), // strip spaces from 16-char password
      },
    });
  }

  async sendNotification(config, recipients, payload) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const enabledRecipients = recipients.filter((r) => r.enabled && r.recipientType === "email");
    const toList = enabledRecipients.length > 0
      ? enabledRecipients.map((r) => r.recipientValue)
      : [config.gmailAddress]; // self-test fallback

    const fromName = config.fromName || "Smart Restroom Alerts";
    const subject  = this.renderTemplate(payload.subject || "Notification — Smart Restroom System", payload.variables);
    const body     = this.renderTemplate(payload.body, payload.variables);
    const html     = payload.format === "html" ? body : this._buildHtml(subject, body);

    try {
      const transporter = this._createTransport(config);
      await transporter.sendMail({
        from:    `"${fromName}" <${config.gmailAddress}>`,
        to:      toList.join(", "),
        subject,
        html,
        text:    body,
      });
      return { success: true, recipients: toList };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendTestNotification(config, recipients) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const testRecipients = recipients.filter((r) => r.enabled);
    if (testRecipients.length === 0) {
      testRecipients.push({ recipientType: "email", recipientValue: config.gmailAddress, enabled: true });
    }

    return this.sendNotification(config, testRecipients, {
      subject:   "✅ Test Email — Smart Restroom Feedback System",
      body:      "This is a test email from your Smart Restroom Feedback System Gmail channel. Your configuration is working correctly.",
      format:    "text",
      eventType: "system_alert",
      variables: { siteName: "Test Site", timestamp: new Date().toLocaleString() },
    });
  }

  _buildHtml(subject, body) {
    const lines = body.split("\n").filter(Boolean)
      .map((l) => `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">${l}</p>`)
      .join("");
    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:32px 0;">
      <table width="560" align="center" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#ea4335;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${subject}</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px;">Smart Restroom Feedback System</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">${lines}</td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification via Gmail</p>
        </td></tr>
      </table>
    </body></html>`;
  }
}

module.exports = GmailProvider;
