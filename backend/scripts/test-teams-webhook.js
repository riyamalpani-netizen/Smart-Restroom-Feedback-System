/**
 * Quick test — fires a sample alert to your Teams webhook URL.
 * Run: node backend/scripts/test-teams-webhook.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { sendTeamsWebhook } = require("../src/services/teamsWebhookService");

const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

if (!webhookUrl) {
  console.error("❌  TEAMS_WEBHOOK_URL is not set in .env");
  process.exit(1);
}

console.log("📡  Sending test alert to Teams...");
console.log("    URL:", webhookUrl.substring(0, 80) + "...");

const testPayload = {
  restroomName: "Level 2 - Men's Restroom",
  feedbackType: "emergency",
  priority:     "critical",
  battery:      23,
  timestamp:    new Date().toISOString(),
  alertId:      9999,
  location:     "Level 2 - Men's Restroom",
};

sendTeamsWebhook(webhookUrl, testPayload).then((result) => {
  if (result.success) {
    console.log("✅  Alert sent successfully! Check your restroom-alerts channel.");
    console.log("    HTTP status:", result.status);
  } else {
    console.error("❌  Failed to send alert:");
    console.error("   ", result.error);
  }
});
