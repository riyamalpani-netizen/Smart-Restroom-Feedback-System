const express = require("express");
const { getSettings, updateSettings, testTeamsWebhook } = require("../controllers/settingsController");
const { authenticate, authorize } = require("../auth/authMiddleware");
const { blockCrossVendorAccess } = require("../middleware/vendorScope");

const router = express.Router();

// GET — both super_admin and vendor_admin can fetch settings (scoped by controller)
router.get(
  "/",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  blockCrossVendorAccess,
  getSettings
);

// PUT — vendor_admin can update their own org settings; super_admin can update any
router.put(
  "/",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  blockCrossVendorAccess,
  updateSettings
);

// POST test-webhook — vendor_admin can test their own webhook; super_admin unrestricted
router.post(
  "/test-teams-webhook",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  testTeamsWebhook
);

module.exports = router;
