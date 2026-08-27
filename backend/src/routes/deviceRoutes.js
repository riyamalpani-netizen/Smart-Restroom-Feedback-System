const express = require("express");
const { getDevices, getDeviceById, createDevice, bulkCreateDevices, updateDevice, getDeviceHealth, getOfflineDevices, registerDeviceInTTN, deleteDevice } = require("../controllers/deviceController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

// Read — all authenticated roles (scoped by org in controller)
router.get("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getDevices);
router.get("/offline", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getOfflineDevices);
router.get("/health/:deviceId", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getDeviceHealth);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getDeviceById);

// Create / Bulk — Super Admin ONLY (vendor_admin receives devices via assignment, not creation)
router.post("/", authenticate, authorize("super_admin"), createDevice);
router.post("/bulk", authenticate, authorize("super_admin"), bulkCreateDevices);

// Update — vendor_admin can edit devices assigned to their org (rename, assign to site/floor/zone, activate)
// Super Admin can also reassign organizationId via PUT
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateDevice);

// Delete / TTN — Super Admin ONLY
router.delete("/:id", authenticate, authorize("super_admin"), deleteDevice);
router.post("/:id/register-ttn", authenticate, authorize("super_admin"), registerDeviceInTTN);

module.exports = router;
