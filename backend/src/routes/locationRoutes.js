const express = require("express");
const { getLocations, getLocationById, createLocation, updateLocation, deleteLocation, searchLocations } = require("../controllers/locationController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getLocations);
router.get("/search", searchLocations);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getLocationById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createLocation);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateLocation);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin"), deleteLocation);

module.exports = router;
