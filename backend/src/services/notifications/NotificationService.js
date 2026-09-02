const prisma = require("../../config/database");
const { getProvider } = require("./providers");
const { parseAndDecryptConfig, redactConfig } = require("./configEncryption");

/**
 * NotificationService — central orchestrator for all notification delivery.
 *
 * Flow:
 *   trigger(eventType, organizationId, variables)
 *     → load enabled channels for the org + event
 *     → for each channel: resolve provider → render template → send
 *     → log every attempt (success or failure) to NotificationLog
 *     → failures in one channel never block other channels
 *
 * This service is the ONLY place that knows about providers.
 * Alert controllers, feedback pipeline, and cron jobs all call this service —
 * they never call Gmail, Teams, etc. directly.
 */

// ── Default templates per event ────────────────────────────────────────────────
const DEFAULT_TEMPLATES = {
  unhappy_feedback: {
    subject: "Unhappy Feedback Alert — {{siteName}}",
    body:
      "An unhappy feedback has been received.\n\nSite: {{siteName}}\nFloor: {{floorName}}\nRestroom: {{restroomName}}\nDevice: {{deviceId}}\nFeedback: {{feedbackType}}\nTime: {{timestamp}}\n\nPlease check the restroom immediately.",
  },
  emergency_feedback: {
    subject: "🚨 EMERGENCY ALERT — {{siteName}}",
    body:
      "An emergency complaint has been raised.\n\nSite: {{siteName}}\nFloor: {{floorName}}\nRestroom: {{restroomName}}\nDevice: {{deviceId}}\nTime: {{timestamp}}\n\nImmediate action required.",
  },
  device_offline: {
    subject: "Device Offline Alert — {{siteName}}",
    body:
      "A device has gone offline.\n\nSite: {{siteName}}\nFloor: {{floorName}}\nRestroom: {{restroomName}}\nDevice: {{deviceId}}\nLast Seen: {{lastSeen}}\n\nPlease investigate.",
  },
  low_battery: {
    subject: "Low Battery Alert — {{siteName}}",
    body:
      "A device has a low battery level.\n\nSite: {{siteName}}\nDevice: {{deviceId}}\nBattery: {{batteryLevel}}%\nRestroom: {{restroomName}}\n\nPlease replace the battery.",
  },
  gateway_offline: {
    subject: "Gateway Offline Alert — {{siteName}}",
    body:
      "A gateway has gone offline.\n\nSite: {{siteName}}\nGateway: {{gatewayName}}\nLast Seen: {{lastSeen}}\n\nThis may affect multiple devices.",
  },
  system_alert: {
    subject: "System Alert — {{siteName}}",
    body: "A system alert has been triggered.\n\nSite: {{siteName}}\nDetails: {{details}}\nTime: {{timestamp}}",
  },
};

// ── Recipient filtering ────────────────────────────────────────────────────────

/**
 * Filter recipients for a specific event type.
 * A recipient with null/empty eventTypes receives all events.
 */
function filterRecipientsForEvent(recipients, eventType) {
  return recipients.filter((r) => {
    if (!r.enabled) return false;
    if (!r.eventTypes) return true; // subscribed to all events
    try {
      const events = JSON.parse(r.eventTypes);
      return Array.isArray(events) ? events.includes(eventType) : true;
    } catch {
      return true;
    }
  });
}

// ── Template resolution ────────────────────────────────────────────────────────

/**
 * Render a template string replacing {{variable}} with values from the vars map.
 */
function renderTemplate(template, vars = {}) {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

/**
 * Resolve the best template for a channel + event.
 * Priority: DB template → default template → bare body.
 */
function resolveTemplate(dbTemplate, eventType) {
  if (dbTemplate && dbTemplate.enabled) {
    return { subject: dbTemplate.subject, body: dbTemplate.body, format: dbTemplate.format };
  }
  const def = DEFAULT_TEMPLATES[eventType];
  if (def) return { subject: def.subject, body: def.body, format: "text" };
  return {
    subject: `Smart Restroom Alert — {{siteName}}`,
    body: "An event has been triggered: {{eventType}}",
    format: "text",
  };
}

// ── Core notification functions ────────────────────────────────────────────────

/**
 * Trigger notifications for an event across all matching channels of an org.
 *
 * @param {string} eventType       - e.g. 'unhappy_feedback'
 * @param {string} organizationId
 * @param {Record<string, string>} variables - template variables
 * @param {object} [options]
 * @param {string} [options.alertId] - associate log entries with an alert
 * @returns {Promise<NotificationResult[]>}
 */
async function trigger(eventType, organizationId, variables, options = {}) {
  if (!organizationId) return [];

  // Load all enabled channels for this org
  const channels = await prisma.notificationChannel.findMany({
    where: { organizationId, enabled: true },
    include: {
      recipients: true,
      templates: { where: { eventType, enabled: true } },
    },
  });

  if (channels.length === 0) return [];

  // Run all channels concurrently; failures in one don't affect others
  const results = await Promise.allSettled(
    channels.map((channel) => _deliverToChannel(channel, eventType, variables, options))
  );

  return results.map((r, i) => ({
    channelId: channels[i].id,
    channelType: channels[i].channelType,
    provider: channels[i].provider,
    ...(r.status === "fulfilled" ? r.value : { success: false, error: r.reason?.message }),
  }));
}

/**
 * Send a test notification for a specific channel.
 *
 * @param {string} channelId
 * @param {string} organizationId  - used to assert ownership
 * @returns {Promise<ProviderResult>}
 */
async function sendTestNotification(channelId, organizationId) {
  const channel = await prisma.notificationChannel.findFirst({
    where: { id: channelId, organizationId },
    include: { recipients: true },
  });

  if (!channel) {
    return { success: false, error: "Channel not found or access denied" };
  }

  const config = parseAndDecryptConfig(channel.configuration);
  let provider;
  try {
    provider = getProvider(channel.channelType, channel.provider);
  } catch (err) {
    return { success: false, error: err.message };
  }

  // For test, use enabled recipients. If none exist yet, pass an empty array —
  // each provider's sendTestNotification handles the no-recipient case gracefully
  // (e.g. SMTP/Gmail fall back to sending to the fromEmail/gmailAddress itself).
  const recipients = channel.recipients.filter((r) => r.enabled);

  const result = await provider.sendTestNotification(config, recipients);

  // Log the test attempt
  await _createLog({
    organizationId,
    channelId: channel.id,
    eventType: "system_alert",
    channelType: channel.channelType,
    provider: channel.provider,
    recipient: recipients.map((r) => r.recipientValue).join(", ") || config.fromEmail || config.gmailAddress || config.smtpUser || config.webhookUrl || config.url || channel.provider,
    status: result.success ? "sent" : "failed",
    errorMessage: result.error || null,
  });

  return result;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function _deliverToChannel(channel, eventType, variables, options = {}) {
  const config = parseAndDecryptConfig(channel.configuration);
  const filteredRecipients = filterRecipientsForEvent(channel.recipients, eventType);

  // Resolve template
  const dbTemplate = channel.templates?.[0] || null;
  const { subject: rawSubject, body: rawBody, format } = resolveTemplate(dbTemplate, eventType);

  const payload = {
    subject: renderTemplate(rawSubject, variables),
    body: renderTemplate(rawBody, variables),
    format: format || "text",
    eventType,
    variables,
    raw: options.raw || null,
  };

  let provider;
  try {
    provider = getProvider(channel.channelType, channel.provider);
  } catch (err) {
    await _createLog({
      organizationId: channel.organizationId,
      channelId: channel.id,
      eventType,
      channelType: channel.channelType,
      provider: channel.provider,
      recipient: "N/A",
      status: "failed",
      errorMessage: `Provider not found: ${err.message}`,
      alertId: options.alertId,
    });
    return { success: false, error: err.message };
  }

  const result = await provider.sendNotification(config, filteredRecipients, payload);

  // Log every attempt
  const recipientStr = (result.recipients || filteredRecipients.map((r) => r.recipientValue)).join(", ") || channel.provider;

  await _createLog({
    organizationId: channel.organizationId,
    channelId: channel.id,
    eventType,
    channelType: channel.channelType,
    provider: channel.provider,
    recipient: recipientStr,
    status: result.success ? "sent" : "failed",
    errorMessage: result.error || null,
    metadata: result.details ? JSON.stringify(result.details) : null,
    alertId: options.alertId,
  });

  return result;
}

async function _createLog({ organizationId, channelId, eventType, channelType, provider, recipient, status, errorMessage, metadata, alertId }) {
  try {
    await prisma.notificationLog.create({
      data: {
        organizationId,
        notificationChannelId: channelId || null,
        eventType,
        channelType,
        provider,
        recipient: recipient || "",
        status,
        errorMessage: errorMessage || null,
        sentAt: status === "sent" ? new Date() : null,
        metadata: metadata || null,
      },
    });

    // If this is linked to a legacy Alert record, also create the legacy Notification entry
    if (alertId) {
      const notifType = _mapChannelTypeToNotificationType(channelType);
      if (notifType) {
        await prisma.notification.create({
          data: {
            alertId,
            type: notifType,
            recipient: recipient || provider,
            status,
            sentAt: status === "sent" ? new Date() : null,
          },
        }).catch(() => {}); // non-critical — don't fail the whole delivery
      }
    }
  } catch (logErr) {
    console.error("[NotificationService] Failed to write notification log:", logErr.message);
  }
}

function _mapChannelTypeToNotificationType(channelType) {
  const map = { email: "email", teams: "teams", slack: "push", webhook: "push", sms: "push" };
  return map[channelType] || null;
}

// ── History / log queries ──────────────────────────────────────────────────────

/**
 * Fetch notification history for an org with pagination and filters.
 */
async function getHistory(organizationId, { page = 1, limit = 20, eventType, channelType, status, from, to } = {}) {
  const where = { organizationId };
  if (eventType) where.eventType = eventType;
  if (channelType) where.channelType = channelType;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [logs, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: parseInt(limit),
    }),
    prisma.notificationLog.count({ where }),
  ]);

  return { logs, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) };
}

// ── Metadata ───────────────────────────────────────────────────────────────────

/**
 * Return metadata about all supported channel types, providers, and their required config fields.
 * Used by the frontend to dynamically render configuration forms.
 */
function getProviderMetadata() {
  return {
    email: {
      label: "Email",
      icon: "mail",
      providers: {
        sendgrid: {
          label: "SendGrid (recommended — free, no OAuth needed)",
          fields: [
            { key: "apiKey",     label: "SendGrid API Key", type: "password", required: true,  placeholder: "SG.xxxxxxxxxxxxxxxxxxxxxxxx", hint: "app.sendgrid.com → Settings → API Keys → Create API Key → Mail Send permission. Free tier: 100 emails/day." },
            { key: "fromEmail",  label: "From Email",       type: "email",    required: true,  placeholder: "alerts@yourdomain.com",       hint: "Must be verified in SendGrid: Settings → Sender Authentication → Verify a Single Sender" },
            { key: "fromName",   label: "From Name",        type: "text",     required: false, placeholder: "Smart Restroom Alerts" },
          ],
        },
        gmail: {
          label: "Gmail",
          authModes: {
            app_password: {
              label: "App Password",
              fields: [
                { key: "gmailAddress", label: "Gmail / Google Workspace Address", type: "email",    required: true,  placeholder: "you@gmail.com or you@yourdomain.com" },
                { key: "appPassword",  label: "App Password",                     type: "password", required: true,  placeholder: "xxxx xxxx xxxx xxxx", hint: "Google Account → Security → 2-Step Verification → App passwords → Create. Use this instead of your normal password." },
                { key: "fromName",     label: "From Name",                        type: "text",     required: false, placeholder: "Smart Restroom Alerts" },
              ],
            },
          },
        },
        microsoft365: {
          label: "Microsoft 365 / Outlook",
          authModes: {
            smtp_auth: {
              label: "SMTP Auth with App Password",
              fields: [
                { key: "smtpUser", label: "Sender Email", type: "email", required: true, placeholder: "you@yourdomain.com" },
                { key: "smtpPassword", label: "App Password", type: "password", required: true, hint: "Microsoft 365 Admin Center → Users → Active users → Manage email apps → Enable SMTP AUTH" },
                { key: "fromName", label: "From Name", type: "text", required: false, placeholder: "Smart Restroom Alerts" },
              ],
            },
            oauth2: {
              label: "OAuth2 / Azure AD (recommended for production)",
              fields: [
                { key: "smtpUser", label: "Sender Email (Mailbox)", type: "email", required: true },
                { key: "tenantId", label: "Azure Tenant ID", type: "text", required: true },
                { key: "clientId", label: "Azure App Client ID", type: "text", required: true },
                { key: "clientSecret", label: "Azure App Client Secret", type: "password", required: true },
                { key: "fromName", label: "From Name", type: "text", required: false },
              ],
            },
          },
        },
        smtp: {
          label: "Custom SMTP",
          fields: [
            { key: "host", label: "SMTP Host", type: "text", required: true, placeholder: "smtp.example.com" },
            { key: "port", label: "SMTP Port", type: "number", required: true, placeholder: "587" },
            { key: "secure", label: "Use SSL/TLS", type: "boolean", required: false, hint: "Enable for port 465; leave off for port 587 (STARTTLS)" },
            { key: "username", label: "SMTP Username", type: "text", required: true },
            { key: "password", label: "SMTP Password / App Password", type: "password", required: true },
            { key: "fromEmail", label: "From Email", type: "email", required: true },
            { key: "fromName", label: "From Name", type: "text", required: false, placeholder: "Smart Restroom Alerts" },
          ],
        },
      },
    },
    teams: {
      label: "Microsoft Teams",
      icon: "teams",
      providers: {
        teams_workflow: {
          label: "Power Automate Workflow",
          fields: [
            { key: "webhookUrl", label: "Power Automate Workflow URL", type: "url", required: true, placeholder: "https://...powerplatform.com/... or https://prod-xx.logic.azure.com/...", hint: "Teams → Workflows → New flow → 'When a Teams webhook request is received' → Save → Copy URL. Accepts any Power Platform or Power Automate URL." },
            { key: "recipientLabel", label: "Recipient Label", type: "text", required: false, placeholder: "Operations Team", hint: "Shown inside the Teams card so recipients know who the alert is for" },
          ],
        },
        teams_graph_channel: {
          label: "Teams Channel (Microsoft Graph — no Power Automate)",
          fields: [
            { key: "tenantId",     label: "Azure Tenant ID",       type: "text",     required: true,  placeholder: "44514350-ceba-4299-a1e4-469365fb5278", hint: "Azure Portal → Azure Active Directory → Overview → Tenant ID" },
            { key: "clientId",     label: "Azure App Client ID",   type: "text",     required: true,  placeholder: "From App registrations → your app → Application (client) ID" },
            { key: "clientSecret", label: "Azure App Client Secret", type: "password", required: true, hint: "App registrations → Certificates & secrets → New client secret" },
            { key: "teamId",       label: "Team ID (Group ID)",    type: "text",     required: true,  placeholder: "f8d1b0f8-42af-4c6f-932b-bb5215ba05be", hint: "From the Teams channel deep link: ?groupId=..." },
            { key: "channelId",    label: "Channel ID",            type: "text",     required: true,  placeholder: "19:xxx@thread.tacv2", hint: "From the Teams channel deep link — the 19:...@thread.tacv2 part (URL-decode %3A → : and %40 → @)" },
          ],
        },
      },
    },
    slack: {
      label: "Slack",
      icon: "slack",
      providers: {
        slack_webhook: {
          label: "Incoming Webhook",
          fields: [
            { key: "webhookUrl", label: "Slack Webhook URL", type: "url", required: true, placeholder: "https://hooks.slack.com/services/T.../B.../...", hint: "api.slack.com/apps → Create App → Incoming Webhooks → Add New Webhook" },
            { key: "channel", label: "Channel Override", type: "text", required: false, placeholder: "#alerts" },
            { key: "username", label: "Bot Name", type: "text", required: false, placeholder: "Smart Restroom Alerts" },
            { key: "iconEmoji", label: "Bot Icon Emoji", type: "text", required: false, placeholder: ":bell:" },
          ],
        },
      },
    },
    webhook: {
      label: "Custom Webhook",
      icon: "webhook",
      providers: {
        custom_webhook: {
          label: "HTTP Webhook (POST JSON)",
          fields: [
            { key: "url", label: "Webhook URL", type: "url", required: true, placeholder: "https://your-api.example.com/webhook" },
            { key: "method", label: "HTTP Method", type: "select", required: false, options: ["POST", "PUT", "PATCH"], default: "POST" },
            { key: "authType", label: "Authentication", type: "select", required: false, options: ["none", "bearer", "basic", "header"], default: "none" },
            { key: "authToken", label: "Bearer Token", type: "password", required: false, showWhen: { field: "authType", value: "bearer" } },
            { key: "authUsername", label: "Basic Auth Username", type: "text", required: false, showWhen: { field: "authType", value: "basic" } },
            { key: "authPassword", label: "Basic Auth Password", type: "password", required: false, showWhen: { field: "authType", value: "basic" } },
            { key: "headerName", label: "Header Name", type: "text", required: false, placeholder: "X-API-Key", showWhen: { field: "authType", value: "header" } },
            { key: "headerValue", label: "Header Value", type: "password", required: false, showWhen: { field: "authType", value: "header" } },
            { key: "payloadTemplate", label: "Custom Payload Template (JSON with {{variables}})", type: "textarea", required: false, hint: "Leave empty to use the default Smart Restroom payload" },
          ],
        },
      },
    },
  };
}

module.exports = {
  trigger,
  sendTestNotification,
  getHistory,
  getProviderMetadata,
  DEFAULT_TEMPLATES,
};
