const express = require("express");
const { handleUplink } = require("../controllers/ttnWebhookController");

const router = express.Router();

// POST /api/ttn/uplink
// Receives forwarded uplink messages from TTN HTTP Webhook integration.
// No auth middleware — TTN authenticates via optional X-TTN-Webhook-Key header
// (checked inside the controller using TTN_WEBHOOK_SECRET env var).
router.post("/uplink", handleUplink);

module.exports = router;
