const express = require("express");
const { getRestrooms, getRestroomById, createRestroom, updateRestroom, deleteRestroom } = require("../controllers/restroomController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getRestrooms);
router.get("/:id", authenticate, getRestroomById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), createRestroom);
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin", "facility_manager"), updateRestroom);
router.delete("/:id", authenticate, authorize("super_admin"), deleteRestroom);

module.exports = router;
