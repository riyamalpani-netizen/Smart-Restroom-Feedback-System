const express = require("express");
const { getGatewayStatus, updateGatewayStatus, getNetworkStatus, getOfflineDevices, getIncidentLog, getRecoveryStatus } = require("../controllers/gatewayController");
const { authenticate } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/gateway-status", authenticate, getGatewayStatus);
router.post("/gateway-status", authenticate, updateGatewayStatus);
router.get("/network-status", authenticate, getNetworkStatus);
router.get("/offline-devices", authenticate, getOfflineDevices);
router.get("/incident-log", authenticate, getIncidentLog);
router.get("/recovery-status", authenticate, getRecoveryStatus);

module.exports = router;
