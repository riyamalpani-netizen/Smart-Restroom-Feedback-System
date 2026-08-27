const express = require("express");
const {
  getGateways, getGatewayById, createGateway, bulkCreateGateways, updateGateway, deleteGateway, registerGatewayInTTN,
  getGatewayDevices, getGatewayUplinks, getGatewayEvents,
  getGatewayStatus, updateGatewayStatus, getNetworkStatus, getOfflineDevices, getIncidentLog,
  getRecoveryStatus, manualCloseIncident, getAuditLog, getServerStatus, createAuditLog,
} = require("../controllers/gatewayController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

// Read — all authenticated roles (scoped by org in controller)
router.get("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getGateways);
router.get("/gateway-status", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getGatewayStatus);
router.get("/network-status", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getNetworkStatus);
router.get("/offline-devices", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getOfflineDevices);
router.get("/incident-log", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getIncidentLog);
router.get("/recovery-status", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getRecoveryStatus);
router.get("/audit-log", authenticate, authorize("super_admin", "vendor_admin"), getAuditLog);
router.get("/server-status", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getServerStatus);

// Create / Bulk / Register-TTN — Super Admin ONLY
router.post("/", authenticate, authorize("super_admin"), createGateway);
router.post("/bulk", authenticate, authorize("super_admin"), bulkCreateGateways);
router.post("/gateway-status", authenticate, authorize("super_admin", "vendor_admin"), updateGatewayStatus);
router.post("/audit-log", authenticate, authorize("super_admin", "vendor_admin"), createAuditLog);

// Update — vendor_admin can edit gateways assigned to their org (rename, place, activate/deactivate)
// Super Admin can also reassign organizationId
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateGateway);

// Delete / TTN Registration — Super Admin ONLY
router.delete("/:id", authenticate, authorize("super_admin"), deleteGateway);
router.post("/:id/register-ttn", authenticate, authorize("super_admin"), registerGatewayInTTN);

// Detail views — all roles
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getGatewayById);
router.get("/:id/devices", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getGatewayDevices);
router.get("/:id/uplinks", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getGatewayUplinks);
router.get("/:id/events", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getGatewayEvents);
router.post("/incidents/:alertId/close", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager"), manualCloseIncident);

module.exports = router;
