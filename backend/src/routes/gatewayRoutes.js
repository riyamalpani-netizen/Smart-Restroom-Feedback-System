const express = require("express");
const {
  getGateways, getGatewayById, createGateway, updateGateway, deleteGateway, registerGatewayInTTN,
  getGatewayDevices, getGatewayUplinks, getGatewayEvents,
  getGatewayStatus, updateGatewayStatus, getNetworkStatus, getOfflineDevices, getIncidentLog,
  getRecoveryStatus, manualCloseIncident, getAuditLog, getServerStatus, createAuditLog,
} = require("../controllers/gatewayController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGateways);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createGateway);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateGateway);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin"), deleteGateway);
router.post("/:id/register-ttn", authenticate, authorize("super_admin", "vendor_admin"), registerGatewayInTTN);
router.get("/:id/devices", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayDevices);
router.get("/:id/uplinks", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayUplinks);
router.get("/:id/events", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayEvents);
router.get("/gateway-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayStatus);
router.post("/gateway-status", authenticate, authorize("super_admin", "vendor_admin"), updateGatewayStatus);
router.get("/network-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getNetworkStatus);
router.get("/offline-devices", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getOfflineDevices);
router.get("/incident-log", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getIncidentLog);
router.get("/recovery-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getRecoveryStatus);
router.post("/incidents/:alertId/close", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), manualCloseIncident);
router.get("/audit-log", authenticate, authorize("super_admin", "vendor_admin"), getAuditLog);
router.get("/server-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getServerStatus);
router.post("/audit-log", authenticate, authorize("super_admin", "vendor_admin"), createAuditLog);

module.exports = router;
