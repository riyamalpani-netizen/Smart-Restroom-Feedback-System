const axios = require("axios");
const BaseProvider = require("./BaseProvider");

/**
 * WebhookProvider — sends notifications to any HTTP endpoint as a JSON POST.
 *
 * Supports:
 *   - Custom REST APIs (POST JSON payload)
 *   - PagerDuty Events API v2
 *   - Zapier Webhooks
 *   - IFTTT Webhooks
 *   - Any system that accepts HTTP POST with JSON
 *
 * Required config fields:
 *   url — the webhook endpoint URL
 *
 * Optional config fields:
 *   method         — HTTP method (default: POST)
 *   authType       — none | bearer | basic | header
 *   authToken      — Bearer token value (for bearer auth)
 *   authUsername   — Basic auth username
 *   authPassword   — Basic auth password
 *   headerName     — Custom header name (for header auth, e.g. X-API-Key)
 *   headerValue    — Custom header value
 *   customHeaders  — JSON string of additional headers: {"X-Custom": "value"}
 *   payloadTemplate— JSON template string with {{variable}} placeholders.
 *                    If not set, sends a standard Smart Restroom JSON payload.
 *   contentType    — default: application/json
 */
class WebhookProvider extends BaseProvider {
  constructor() {
    super("webhook", "custom_webhook");
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config.url) {
      errors.push("Webhook URL is required");
    } else {
      try {
        const url = new URL(config.url);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push("Webhook URL must use HTTP or HTTPS");
        }
      } catch {
        errors.push("Webhook URL is not a valid URL");
      }
    }

    if (config.authType === "bearer" && !config.authToken) {
      errors.push("Bearer token is required when auth type is Bearer");
    }
    if (config.authType === "basic" && (!config.authUsername || !config.authPassword)) {
      errors.push("Username and password are required when auth type is Basic");
    }
    if (config.authType === "header" && (!config.headerName || !config.headerValue)) {
      errors.push("Header name and value are required when auth type is Header");
    }

    if (config.payloadTemplate) {
      try {
        // Must be valid JSON after stripping template vars
        JSON.parse(config.payloadTemplate.replace(/\{\{[^}]+\}\}/g, '"__placeholder__"'));
      } catch {
        errors.push("Payload template must be valid JSON (with {{variable}} placeholders)");
      }
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  _buildHeaders(config) {
    const headers = {
      "Content-Type": config.contentType || "application/json",
      "User-Agent": "SmartRestroomFeedbackSystem/1.0",
    };

    if (config.authType === "bearer" && config.authToken) {
      headers["Authorization"] = `Bearer ${config.authToken}`;
    } else if (config.authType === "basic" && config.authUsername && config.authPassword) {
      const encoded = Buffer.from(`${config.authUsername}:${config.authPassword}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    } else if (config.authType === "header" && config.headerName && config.headerValue) {
      headers[config.headerName] = config.headerValue;
    }

    if (config.customHeaders) {
      try {
        const extra = typeof config.customHeaders === "string"
          ? JSON.parse(config.customHeaders)
          : config.customHeaders;
        Object.assign(headers, extra);
      } catch {
        // invalid custom headers — skip
      }
    }

    return headers;
  }

  _buildPayload(config, payload) {
    const vars = payload.variables || {};

    if (config.payloadTemplate) {
      const rendered = this.renderTemplate(config.payloadTemplate, {
        ...vars,
        subject: payload.subject || "",
        body: payload.body || "",
        eventType: payload.eventType || "system_alert",
      });
      try {
        return JSON.parse(rendered);
      } catch {
        return { raw: rendered };
      }
    }

    // Default Smart Restroom webhook payload
    return {
      source: "SmartRestroomFeedbackSystem",
      eventType: payload.eventType || "system_alert",
      timestamp: new Date().toISOString(),
      subject: this.renderTemplate(payload.subject || "", vars),
      message: this.renderTemplate(payload.body || "", vars),
      data: {
        siteName: vars.siteName,
        floorName: vars.floorName,
        restroomName: vars.restroomName,
        deviceId: vars.deviceId,
        feedbackType: vars.feedbackType,
        priority: vars.priority,
        batteryLevel: vars.batteryLevel,
        timestamp: vars.timestamp,
        alertId: vars.alertId,
      },
      portalUrl: `${process.env.APP_URL || "http://localhost:5173"}/alerts`,
    };
  }

  async sendNotification(config, recipients, payload) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    const method = (config.method || "POST").toUpperCase();
    const headers = this._buildHeaders(config);
    const body = this._buildPayload(config, payload);

    try {
      const response = await axios.request({
        method,
        url: config.url,
        headers,
        data: body,
        timeout: 15000,
      });

      return {
        success: true,
        recipients: [config.url],
        details: { status: response.status, body: response.data },
      };
    } catch (error) {
      const msg = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      return { success: false, error: msg };
    }
  }

  async sendTestNotification(config, recipients) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid config: ${validation.errors.join(", ")}` };
    }

    return this.sendNotification(config, recipients, {
      subject: "Test Notification — Smart Restroom Feedback System",
      body: "This is a test webhook notification from Smart Restroom Feedback System. Your webhook integration is working correctly.",
      eventType: "system_alert",
      variables: {
        siteName: "Test Site",
        floorName: "Test Floor",
        restroomName: "Test Restroom",
        deviceId: "TEST-001",
        feedbackType: "test",
        priority: "medium",
        timestamp: new Date().toISOString(),
        alertId: "TEST-001",
      },
    });
  }
}

module.exports = WebhookProvider;
