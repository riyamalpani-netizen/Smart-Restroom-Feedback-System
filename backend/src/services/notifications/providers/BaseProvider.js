/**
 * BaseProvider — abstract contract every notification provider must satisfy.
 *
 * Providers receive a `config` object (already decrypted by the time it arrives here)
 * and an array of `recipients` from NotificationRecipient rows.
 *
 * Subclasses MUST override:
 *   - validateConfiguration(config)
 *   - sendNotification(config, recipients, payload)
 *
 * Subclasses MAY override:
 *   - sendTestNotification(config, recipients)
 *   - disconnect(config)
 *   - formatPayload(payload, template)
 */
class BaseProvider {
  /**
   * @param {string} channelType  - e.g. 'email', 'teams', 'slack', 'webhook'
   * @param {string} providerName - e.g. 'gmail', 'smtp', 'teams_workflow'
   */
  constructor(channelType, providerName) {
    if (new.target === BaseProvider) {
      throw new Error("BaseProvider is abstract and cannot be instantiated directly.");
    }
    this.channelType = channelType;
    this.providerName = providerName;
  }

  /**
   * Validate the provider-specific configuration object.
   * Must return { valid: true } or { valid: false, errors: string[] }.
   *
   * @param {Record<string, unknown>} config
   * @returns {{ valid: boolean; errors?: string[] }}
   */
  // eslint-disable-next-line no-unused-vars
  validateConfiguration(config) {
    throw new Error(`${this.providerName}.validateConfiguration() not implemented`);
  }

  /**
   * Send a notification to all enabled recipients.
   *
   * @param {Record<string, unknown>} config      - Decrypted provider config
   * @param {import('@prisma/client').NotificationRecipient[]} recipients
   * @param {NotificationPayload} payload         - Rendered message payload
   * @returns {Promise<ProviderResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async sendNotification(config, recipients, payload) {
    throw new Error(`${this.providerName}.sendNotification() not implemented`);
  }

  /**
   * Send a test notification (default: delegates to sendNotification with a canned payload).
   * Providers can override for a more targeted test.
   *
   * @param {Record<string, unknown>} config
   * @param {import('@prisma/client').NotificationRecipient[]} recipients
   * @returns {Promise<ProviderResult>}
   */
  async sendTestNotification(config, recipients) {
    const testPayload = {
      subject: "Test Notification — Smart Restroom Feedback System",
      body: "This is a test notification from the Smart Restroom Feedback System. If you received this, your channel is configured correctly.",
      eventType: "system_alert",
      variables: {
        siteName: "Test Site",
        floorName: "Test Floor",
        restroomName: "Test Restroom",
        deviceId: "TEST-001",
        feedbackType: "Test",
        timestamp: new Date().toISOString(),
      },
    };
    return this.sendNotification(config, recipients, testPayload);
  }

  /**
   * Gracefully disconnect / revoke tokens if applicable.
   * Default is a no-op.
   *
   * @param {Record<string, unknown>} config
   */
  // eslint-disable-next-line no-unused-vars
  async disconnect(config) {
    // no-op by default
  }

  /**
   * Apply {{variable}} substitution to a template string.
   *
   * @param {string} template
   * @param {Record<string, string>} variables
   * @returns {string}
   */
  renderTemplate(template, variables = {}) {
    if (!template) return "";
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }
}

/**
 * @typedef {Object} NotificationPayload
 * @property {string}                    subject    - Subject line (email only, optional)
 * @property {string}                    body       - Rendered message body
 * @property {string}                    eventType  - e.g. 'unhappy_feedback'
 * @property {Record<string, string>}    variables  - Template variables already resolved
 * @property {Record<string, unknown>}   [raw]      - Optional original event data
 */

/**
 * @typedef {Object} ProviderResult
 * @property {boolean}   success
 * @property {string[]}  [recipients]   - Successfully notified addresses
 * @property {string}    [error]        - Error message if success === false
 * @property {unknown}   [details]      - Provider-specific response detail
 */

module.exports = BaseProvider;
