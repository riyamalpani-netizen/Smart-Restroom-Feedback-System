const express = require("express");
const {
  getFloorPlans,
  getFloorPlanById,
  createFloorPlan,
  updateFloorPlan,
  deleteFloorPlan,
} = require("../controllers/floorPlanController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getFloorPlans);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getFloorPlanById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), createFloorPlan);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), updateFloorPlan);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), deleteFloorPlan);

module.exports = router;
