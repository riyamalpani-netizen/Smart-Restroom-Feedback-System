const express = require("express");
const {
  getZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  importGeoJson,
} = require("../controllers/zoneController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getZones);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getZoneById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), createZone);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), updateZone);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), deleteZone);
router.post("/import", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), importGeoJson);

module.exports = router;
