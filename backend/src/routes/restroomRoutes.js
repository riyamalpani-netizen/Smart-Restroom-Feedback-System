const express = require("express");
const { getRestrooms, getRestroomById, createRestroom, updateRestroom, deleteRestroom } = require("../controllers/restroomController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getRestrooms);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getRestroomById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), createRestroom);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), updateRestroom);
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), deleteRestroom);

module.exports = router;
