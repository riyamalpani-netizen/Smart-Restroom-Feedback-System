const nodemailer = require("nodemailer");

/**
 * Sends an HTML email alert when an unhappy/emergency restroom complaint fires.
 *
 * Uses Office 365 SMTP (smtp.office365.com : 587 with STARTTLS).
 * Credentials are read from environment variables — never hard-coded.
 *
 * Required .env variables:
 *   SMTP_USER     riya.malpani@atlasied.com
 *   SMTP_PASS     <your Office 365 / app password>
 *   ALERT_TO      anshu.puri@atlasied.com,ritesh.tandon@atlasied.com  (comma-separated)
 *   APP_URL       http://localhost:5173  (used for the "View Alert" button)
 */

function createTransport() {
  return nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      ciphers: "SSLv3",
    },
  });
}

function priorityColor(priority) {
  switch (priority) {
    case "critical": return "#dc2626";
    case "high":     return "#ea580c";
    case "medium":   return "#d97706";
    default:         return "#16a34a";
  }
}

function buildHtml({ restroomName, feedbackType, priority, battery, timestamp, alertId, location }) {
  const statusLabel  = feedbackType
    ? feedbackType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unknown";
  const priorityLabel = priority
    ? priority.charAt(0).toUpperCase() + priority.slice(1)
    : "Medium";
  const batteryText  = battery != null ? `${battery}%` : "N/A";
  const timeText     = timestamp
    ? new Date(timestamp).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium" })
    : new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "medium" });
  const isEmergency  = feedbackType === "emergency";
  const headerBg     = isEmergency ? "#dc2626" : "#d97706";
  const emoji        = isEmergency ? "🚨" : "⚠️";
  const pColor       = priorityColor(priority);
  const portalUrl    = `${process.env.APP_URL || "http://localhost:5173"}/alerts`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Restroom Alert</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:${headerBg};padding:28px 32px;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Smart Restroom Feedback System</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;">${emoji} Restroom Alert</h1>
            <p style="margin:6px 0 0;font-size:16px;color:rgba(255,255,255,0.9);font-weight:500;">${restroomName || "Unknown Restroom"}</p>
          </td>
        </tr>

        <!-- Priority banner -->
        <tr>
          <td style="background:${pColor};padding:10px 32px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.06em;text-transform:uppercase;">
              Priority: ${priorityLabel}
            </p>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="padding:28px 32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ["Status",   statusLabel],
                ["Location", location || restroomName || "—"],
                ["Battery",  batteryText],
                ["Time",     timeText],
                ["Alert ID", alertId || "—"],
              ].map(([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;width:140px;">
                  <span style="font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${label}</span>
                </td>
                <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="font-size:15px;font-weight:500;color:#111827;">${value}</span>
                </td>
              </tr>`).join("")}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:16px 32px 32px;">
            <a href="${portalUrl}"
               style="display:inline-block;background:#0891b2;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
              View Alert in Portal →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This is an automated alert from the AtlasIED Smart Restroom Feedback System.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmailAlert({ restroomName, feedbackType, priority, battery, timestamp, alertId, location }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const toRaw    = process.env.ALERT_TO;

  if (!smtpUser || !smtpPass) {
    return { sent: false, reason: "SMTP credentials not configured (set SMTP_USER and SMTP_PASS in .env)" };
  }
  if (!toRaw) {
    return { sent: false, reason: "Recipient not configured (set ALERT_TO in .env)" };
  }

  // Support comma-separated list: "a@x.com,b@x.com"
  const toAddrs = toRaw.split(",").map((e) => e.trim()).filter(Boolean);

  const isEmergency = feedbackType === "emergency";
  const subject = isEmergency
    ? `🚨 EMERGENCY — ${restroomName || "Restroom"} needs immediate attention`
    : `⚠️ Unhappy Complaint — ${restroomName || "Restroom"} needs cleaning`;

  const html = buildHtml({ restroomName, feedbackType, priority, battery, timestamp, alertId, location });

  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from:    `"Smart Restroom Alerts" <${smtpUser}>`,
      to:      toAddrs.join(", "),
      cc:      smtpUser, // sender gets a copy — confirms delivery
      subject,
      html,
    });
    return { sent: true, recipients: toAddrs };
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

module.exports = { sendEmailAlert };
