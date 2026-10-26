require("dotenv").config();

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:NewPassword123@localhost:5432/smart_restroom?schema=public",
  JWT_SECRET: process.env.JWT_SECRET || "smart-restroom-secret-key",
  PORT: process.env.PORT || 5000,
  TTN_MQTT_BROKER: process.env.TTN_MQTT_BROKER || "eu1.cloud.thethings.network",
  TTN_MQTT_PORT: process.env.TTN_MQTT_PORT || 8883,
  TTN_MQTT_USERNAME: process.env.TTN_MQTT_USERNAME,
  TTN_MQTT_PASSWORD: process.env.TTN_MQTT_PASSWORD,
  TTN_MQTT_TOPIC: process.env.TTN_MQTT_TOPIC || "v3/smart-restroom-app@ttn/devices/+/up",
  TTN_API_BASE_URL: process.env.TTN_API_BASE_URL,
  TTN_APPLICATION_ID: process.env.TTN_APPLICATION_ID,
  TTN_API_KEY: process.env.TTN_API_KEY,
  // User-level API key with RIGHT_APPLICATION_CREATE — used for auto-creating
  // TTN applications when a new vendor is provisioned.
  TTN_USER_API_KEY: process.env.TTN_USER_API_KEY || process.env.TTN_API_KEY,
  TTN_GATEWAY_API_KEY: process.env.TTN_GATEWAY_API_KEY,
  TTN_GATEWAY_OWNER_TYPE: process.env.TTN_GATEWAY_OWNER_TYPE,
  TTN_GATEWAY_OWNER_ID: process.env.TTN_GATEWAY_OWNER_ID,
  TTN_DEFAULT_JOIN_EUI: process.env.TTN_DEFAULT_JOIN_EUI,
  TTN_FREQUENCY_PLAN_ID: process.env.TTN_FREQUENCY_PLAN_ID,
  TTN_LORAWAN_VERSION: process.env.TTN_LORAWAN_VERSION,
  TTN_LORAWAN_PHY_VERSION: process.env.TTN_LORAWAN_PHY_VERSION,
  TTN_WEBHOOK_SECRET: process.env.TTN_WEBHOOK_SECRET,
  TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_URL,
  REPORT_FREQUENCY: process.env.REPORT_FREQUENCY || "daily",
  NODE_ENV: process.env.NODE_ENV || "development",
};
