const express = require("express");
const { getDevices, getDeviceById, createDevice, updateDevice, getDeviceHealth, getOfflineDevices } = require("../controllers/deviceController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getDevices);
router.get("/:id", authenticate, getDeviceById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createDevice);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateDevice);
router.get("/health/:deviceId", authenticate, getDeviceHealth);
router.get("/offline", authenticate, getOfflineDevices);

module.exports = router;
