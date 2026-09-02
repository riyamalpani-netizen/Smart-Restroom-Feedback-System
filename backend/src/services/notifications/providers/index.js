const SMTPProvider = require("./SMTPProvider");
const GmailProvider = require("./GmailProvider");
const Microsoft365Provider = require("./Microsoft365Provider");
const SendGridProvider = require("./SendGridProvider");
const TeamsProvider = require("./TeamsProvider");
const TeamsGraphChannelProvider = require("./TeamsGraphChannelProvider");
const SlackProvider = require("./SlackProvider");
const WebhookProvider = require("./WebhookProvider");

/**
 * Provider Registry
 *
 * Maps { channelType: { providerKey: ProviderClass } }
 *
 * To add a new provider:
 *   1. Create MyNewProvider.js extending BaseProvider
 *   2. Register it here: PROVIDER_REGISTRY.my_channel.my_provider = MyNewProvider
 *   3. No other changes needed — the NotificationService discovers it automatically.
 */
const PROVIDER_REGISTRY = {
  email: {
    sendgrid:      SendGridProvider,
    smtp:          SMTPProvider,
    gmail:         GmailProvider,
    microsoft365:  Microsoft365Provider,
  },
  teams: {
    teams_workflow:       TeamsProvider,
    teams_graph_channel:  TeamsGraphChannelProvider,
  },
  slack: {
    slack_webhook: SlackProvider,
    // Future: slack_app, slack_bot, etc.
  },
  webhook: {
    custom_webhook: WebhookProvider,
    // Future: pagerduty, zapier, ifttt, etc.
  },
  // Future channel types: sms, push, google_chat, whatsapp, etc.
};

/**
 * Resolve and instantiate a provider.
 *
 * @param {string} channelType  - e.g. 'email'
 * @param {string} providerKey  - e.g. 'gmail'
 * @returns {import('./BaseProvider')} provider instance
 * @throws {Error} if channelType or providerKey is not registered
 */
function getProvider(channelType, providerKey) {
  const channelProviders = PROVIDER_REGISTRY[channelType];
  if (!channelProviders) {
    throw new Error(`Unknown channel type: "${channelType}". Supported: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`);
  }

  const ProviderClass = channelProviders[providerKey];
  if (!ProviderClass) {
    const available = Object.keys(channelProviders).join(", ");
    throw new Error(`Unknown provider "${providerKey}" for channel "${channelType}". Available: ${available}`);
  }

  return new ProviderClass();
}

/**
 * Returns the list of supported channel types.
 */
function getSupportedChannelTypes() {
  return Object.keys(PROVIDER_REGISTRY);
}

/**
 * Returns supported providers for a given channel type.
 * @param {string} channelType
 */
function getSupportedProviders(channelType) {
  return Object.keys(PROVIDER_REGISTRY[channelType] || {});
}

module.exports = { getProvider, getSupportedChannelTypes, getSupportedProviders, PROVIDER_REGISTRY };
