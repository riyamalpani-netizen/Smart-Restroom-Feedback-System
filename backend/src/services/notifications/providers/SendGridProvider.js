const sgMail = require("@sendgrid/mail");
const BaseProvider = require("./BaseProvider");

/**
 * SendGridProvider — sends email via SendGrid API.
 *
 * No SMTP, no OAuth, no app passwords. Just a SendGrid API key.
 *
 * Free tier: 100 emails/day forever. No credit card required.
 *
 * How to get an API key (2 minutes):
 *   1. Go to https://app.sendgrid.com → sign up free
 *   2. Settings → API Keys → Create API Key
 *   3. Permission: "Restricted Access" → Mail Send → Full Access
 *   4. Copy the key (starts with SG.)
 *   5. Paste it in the channel config
 *
 * Required config fields:
 *   apiKey    — SendGrid API key (starts with SG.)
 *   fromEmail — verified sender email address
 *
 * Optional:
 *   fromName  — display name for the sender
 *
 * NOTE: fromEmail must be a verified sender in SendGrid.
 *   Either verify a single sender address OR verify a whole domain.
 *   Single sender: app.sendgrid.com → Settings → Sender Authentication → Single Sender
 */
class SendGridProvider extends BaseProvider {
  constructor() {
    super("email", "sendgrid");
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.apiKey) {
      errors.push("SendGrid API key is required (starts with SG.)");
    } else if (!config.apiKey.startsWith("SG.")) {
      errors.push("SendGrid API key must start with 'SG.'");
    }
    if (!config.fromEmail) {
      errors.push("From Email is required (must be verified in SendGrid)");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.fromEmail)) {
      errors.push("From Email is not a valid email address");
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  async sendNotification(config, recipients, payload) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const enabledRecipients = recipients.filter((r) => r.enabled && r.recipientType === "email");
    const toList = enabledRecipients.length > 0
      ? enabledRecipients.map((r) => r.recipientValue)
      : [config.fromEmail]; // self-test fallback

    const fromName  = config.fromName || "Smart Restroom Alerts";
    const subject   = this.renderTemplate(payload.subject || "Notification — Smart Restroom System", payload.variables);
    const body      = this.renderTemplate(payload.body, payload.variables);
    const html      = payload.format === "html" ? body : this._buildHtml(subject, body, payload.variables);

    try {
      sgMail.setApiKey(config.apiKey);

      // SendGrid supports personalizations for multiple recipients
      await sgMail.send({
        to:      toList,
        from:    { email: config.fromEmail, name: fromName },
        subject,
        html,
        text:    body,
      });

      return { success: true, recipients: toList };
    } catch (err) {
      const msg = err.response?.body?.errors?.[0]?.message || err.message;
      return { success: false, error: String(msg) };
    }
  }

  async sendTestNotification(config, recipients) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const testRecipients = recipients.filter((r) => r.enabled);
    if (testRecipients.length === 0) {
      testRecipients.push({ recipientType: "email", recipientValue: config.fromEmail, enabled: true });
    }

    return this.sendNotification(config, testRecipients, {
      subject:   "✅ Test Email — Smart Restroom Feedback System",
      body:      "This is a test email from your Smart Restroom Feedback System SendGrid channel. Your configuration is working correctly.",
      format:    "text",
      eventType: "system_alert",
      variables: { siteName: "Test Site", timestamp: new Date().toLocaleString() },
    });
  }

  _buildHtml(subject, body, variables = {}) {
    const lines = body.split("\n").filter(Boolean)
      .map((l) => `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">${l}</p>`)
      .join("");
    return `<!DOCTYPE html><html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;padding:32px 0;">
      <table width="560" align="center" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
        <tr><td style="background:#1a82e2;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${subject}</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px;">Smart Restroom Feedback System</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">${lines}</td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification via SendGrid</p>
        </td></tr>
      </table>
    </body></html>`;
  }
}

module.exports = SendGridProvider;
