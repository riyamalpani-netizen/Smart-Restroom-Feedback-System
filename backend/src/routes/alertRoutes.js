const express = require("express");
const { getAlerts, getAlertById, createAlert, updateAlert, acknowledgeAlert, resolveAlert } = require("../controllers/alertController");
const { authenticate } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getAlerts);
router.get("/:id", authenticate, getAlertById);
router.post("/", authenticate, createAlert);
router.put("/:id", authenticate, updateAlert);
router.post("/:id/acknowledge", authenticate, acknowledgeAlert);
router.post("/:id/resolve", authenticate, resolveAlert);

module.exports = router;
