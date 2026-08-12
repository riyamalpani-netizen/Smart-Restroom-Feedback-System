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

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getZones);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getZoneById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createZone);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateZone);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin"), deleteZone);
router.post("/import", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), importGeoJson);

module.exports = router;
