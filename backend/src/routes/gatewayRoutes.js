const express = require("express");
const { getGatewayStatus, updateGatewayStatus, getNetworkStatus, getOfflineDevices, getIncidentLog, getRecoveryStatus } = require("../controllers/gatewayController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/gateway-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayStatus);
router.post("/gateway-status", authenticate, authorize("super_admin", "vendor_admin"), updateGatewayStatus);
router.get("/network-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getNetworkStatus);
router.get("/offline-devices", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getOfflineDevices);
router.get("/incident-log", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getIncidentLog);
router.get("/recovery-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getRecoveryStatus);

module.exports = router;
