const express = require("express");
const { getFloors, getFloorById, createFloor, updateFloor, deleteFloor } = require("../controllers/floorController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getFloors);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getFloorById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createFloor);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateFloor);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin"), deleteFloor);

module.exports = router;
