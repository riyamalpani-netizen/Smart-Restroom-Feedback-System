const express = require("express");
const { getFeedback, getFeedbackById, createFeedback, deleteFeedback } = require("../controllers/feedbackController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getFeedback);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"), getFeedbackById);
router.post("/", authenticate, authorize("super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager"), createFeedback);
router.delete("/:id", authenticate, authorize("super_admin"), deleteFeedback);

module.exports = router;
