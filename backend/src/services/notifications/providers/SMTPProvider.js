const nodemailer = require("nodemailer");
const BaseProvider = require("./BaseProvider");

/**
 * SMTPProvider — sends email via any SMTP server.
 * Covers: Office 365, Gmail SMTP, custom SMTP, SendGrid SMTP relay, etc.
 *
 * Required config fields:
 *   host, port, secure (bool), username, password, fromEmail, fromName
 *
 * Optional:
 *   requireTLS (bool)
 */
class SMTPProvider extends BaseProvider {
  constructor() {
    super("email", "smtp");
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.host) errors.push("SMTP Host is required");
    if (!config.port) errors.push("SMTP Port is required");
    if (!config.username) errors.push("SMTP Username is required");
    if (!config.password) errors.push("SMTP Password is required");
    if (!config.fromEmail) errors.push("From Email is required");
    if (config.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.fromEmail)) {
      errors.push("From Email is not a valid email address");
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  _createTransport(config) {
    return nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port, 10),
      secure: config.secure === true || config.secure === "true",
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
        ...(config.requireTLS ? { requireTLS: true } : {}),
      },
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
    const subject = this.renderTemplate(payload.subject || "Notification from Smart Restroom System", payload.variables);
    const body = this.renderTemplate(payload.body, payload.variables);

    // Build HTML if body looks like plain text
    const html = payload.format === "html" ? body : this._buildHtmlWrapper(subject, body, payload.variables);

    try {
      const transporter = this._createTransport(config);
      await transporter.sendMail({
        from: `"${fromName}" <${config.fromEmail}>`,
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

    // If no recipients configured, send to the from address as a self-test
    const testRecipients = recipients.length > 0
      ? recipients.filter((r) => r.enabled)
      : [{ recipientType: "email", recipientValue: config.fromEmail, enabled: true }];

    if (testRecipients.length === 0) {
      testRecipients.push({ recipientType: "email", recipientValue: config.fromEmail, enabled: true });
    }

    const testPayload = {
      subject: "✅ Test Email — Smart Restroom Feedback System",
      body: "This is a test email from your Smart Restroom Feedback System notification channel. Your SMTP configuration is working correctly.",
      format: "text",
      eventType: "system_alert",
      variables: {
        siteName: "Test Site",
        restroomName: "Test Restroom",
        timestamp: new Date().toLocaleString(),
      },
    };

    return this.sendNotification(config, testRecipients, testPayload);
  }

  _buildHtmlWrapper(subject, body, variables = {}) {
    const siteName = variables.siteName || "Smart Restroom";
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">${l}</p>`)
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
        <tr>
          <td style="background:#0891b2;padding:24px 32px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.08em;">Smart Restroom Feedback System</p>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${subject}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            ${lines}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from ${siteName}. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}

module.exports = SMTPProvider;
