const express = require("express");
const {
  getGateways, getGatewayById, createGateway, bulkCreateGateways, updateGateway, deleteGateway, registerGatewayInTTN,
  getGatewayDevices, getGatewayUplinks, getGatewayEvents,
  getGatewayStatus, updateGatewayStatus, getNetworkStatus, getOfflineDevices, getIncidentLog,
  getRecoveryStatus, manualCloseIncident, getAuditLog, getServerStatus, createAuditLog,
} = require("../controllers/gatewayController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGateways);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createGateway);
router.post("/bulk", authenticate, authorize("super_admin", "vendor_admin"), bulkCreateGateways);

router.get("/gateway-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayStatus);
router.post("/gateway-status", authenticate, authorize("super_admin", "vendor_admin"), updateGatewayStatus);
router.get("/network-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getNetworkStatus);
router.get("/offline-devices", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getOfflineDevices);
router.get("/incident-log", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getIncidentLog);
router.get("/recovery-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getRecoveryStatus);
router.get("/audit-log", authenticate, authorize("super_admin", "vendor_admin"), getAuditLog);
router.post("/audit-log", authenticate, authorize("super_admin", "vendor_admin"), createAuditLog);
router.get("/server-status", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getServerStatus);

router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayById);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateGateway);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin"), deleteGateway);
router.post("/:id/register-ttn", authenticate, authorize("super_admin", "vendor_admin"), registerGatewayInTTN);
router.get("/:id/devices", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayDevices);
router.get("/:id/uplinks", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayUplinks);
router.get("/:id/events", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getGatewayEvents);
router.post("/incidents/:alertId/close", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), manualCloseIncident);

module.exports = router;
