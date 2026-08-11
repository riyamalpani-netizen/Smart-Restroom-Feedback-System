const express = require("express");
const { getDevices, getDeviceById, createDevice, updateDevice, getDeviceHealth, getOfflineDevices } = require("../controllers/deviceController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getDevices);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getDeviceById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createDevice);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateDevice);
router.get("/health/:deviceId", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getDeviceHealth);
router.get("/offline", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getOfflineDevices);

module.exports = router;
