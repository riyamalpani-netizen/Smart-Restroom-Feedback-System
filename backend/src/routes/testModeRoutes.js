const express = require("express");
const { simulateFeedback, getTestEvents, clearTestEvents } = require("../controllers/testModeController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.post("/simulate-feedback", authenticate, authorize("super_admin", "vendor_admin"), simulateFeedback);
router.get("/events", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getTestEvents);
router.post("/events/clear", authenticate, authorize("super_admin", "vendor_admin"), clearTestEvents);

module.exports = router;
