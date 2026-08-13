const express = require("express");
const { getAlerts, getAlertStats, getAlertById, createAlert, updateAlert, acknowledgeAlert, resolveAlert } = require("../controllers/alertController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getAlerts);
router.get("/stats", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getAlertStats);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getAlertById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), createAlert);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), updateAlert);
router.post("/:id/acknowledge", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), acknowledgeAlert);
router.post("/:id/resolve", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), resolveAlert);

module.exports = router;
