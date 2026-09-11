/**
 * ttnWebhookController.js
 *
 * Handles TTN HTTP Webhook integration.
 * TTN sends POST requests with event name "as.up.data.forward" when a device
 * transmits an uplink.  The body is the full ApplicationUp envelope — the same
 * Shape A format that decodePayload() already understands.
 *
 * Configure in TTN Console → Applications → Integrations → Webhooks:
 *   Base URL : https://<your-backend>/api/ttn
 *   Uplink   : /uplink   (POST)
 *   Header   : X-TTN-Webhook-Key: <secret>   (optional but recommended)
 *
 * The optional shared-secret check uses env var TTN_WEBHOOK_SECRET.
 * If the variable is not set the header check is skipped (open endpoint).
 */

const { processFeedback } = require("../services/mqttService");
const { getIO } = require("../utils/socket");
const logger = require("../middleware/logger");

// Optional shared-secret guard ──────────────────────────────────────────────
const TTN_WEBHOOK_SECRET = process.env.TTN_WEBHOOK_SECRET || null;

async function handleUplink(req, res) {
  // ── 1. Optional secret verification ──────────────────────────────────────
  if (TTN_WEBHOOK_SECRET) {
    const incoming = req.headers["x-ttn-webhook-key"] || req.headers["authorization"];
    if (!incoming || incoming.replace(/^Bearer\s+/i, "") !== TTN_WEBHOOK_SECRET) {
      logger.warn("[TTN Webhook] Rejected: invalid or missing X-TTN-Webhook-Key");
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  // ── 2. Validate payload shape ─────────────────────────────────────────────
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ message: "Empty or non-JSON body" });
  }

  // Acknowledge immediately — TTN expects a fast 200 response
  res.status(200).json({ message: "ok" });

  // ── 3. Log the raw uplink for debugging ───────────────────────────────────
  const devEui =
    payload.data?.end_device_ids?.dev_eui ||
    payload.identifiers?.[0]?.device_ids?.dev_eui ||
    payload.end_device_ids?.dev_eui ||
    "unknown";
  const eventName = payload.name || "unknown";

  logger.info(`[TTN Webhook] event=${eventName} | dev_eui=${devEui}`);
  logger.info(`[TTN Webhook] RAW PAYLOAD: ${JSON.stringify(payload, null, 2)}`);

  // Only process uplink data events; ignore join, downlink-ack, etc.
  if (eventName && eventName !== "as.up.data.forward") {
    logger.info(`[TTN Webhook] Skipping non-uplink event: ${eventName}`);
    return;
  }

  // ── 4. Process feedback (same pipeline as MQTT) ───────────────────────────
  try {
    const result = await processFeedback(payload);
    const io = getIO();

    if (result.success && io) {
        io.emit("new-feedback", result.data);
        if (result.alert) {
          io.emit("new-alert", result.alert);
        }
    } else if (!result.success) {
      logger.warn(`[TTN Webhook] processFeedback failed: ${result.error}`);
    }
  } catch (err) {
    logger.error("[TTN Webhook] Unhandled error in processFeedback:", err);
  }
}

module.exports = { handleUplink };
