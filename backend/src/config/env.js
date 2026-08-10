require("dotenv").config();

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || "smart-restroom-secret-key",
  PORT: process.env.PORT || 5000,
  TTN_MQTT_BROKER: process.env.TTN_MQTT_BROKER || "eu1.cloud.thethings.network",
  TTN_MQTT_PORT: process.env.TTN_MQTT_PORT || 8883,
  TTN_MQTT_USERNAME: process.env.TTN_MQTT_USERNAME,
  TTN_MQTT_PASSWORD: process.env.TTN_MQTT_PASSWORD,
  TTN_MQTT_TOPIC: process.env.TTN_MQTT_TOPIC || "v3/smart-restroom-app@ttn/devices/+/up",
  TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_URL,
  REPORT_FREQUENCY: process.env.REPORT_FREQUENCY || "daily",
  NODE_ENV: process.env.NODE_ENV || "development",
};
