const express = require("express");
const { getLocations, getLocationById, createLocation, updateLocation, deleteLocation } = require("../controllers/locationController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getLocations);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getLocationById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createLocation);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateLocation);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin"), deleteLocation);

module.exports = router;
