const express = require("express");
const { getSettings, updateSettings, testTeamsWebhook } = require("../controllers/settingsController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin"), getSettings);
router.put("/", authenticate, authorize("super_admin"), updateSettings);
router.post("/test-teams-webhook", authenticate, authorize("super_admin"), testTeamsWebhook);

module.exports = router;
