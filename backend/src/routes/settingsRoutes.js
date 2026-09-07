const express = require("express");
const { getSettings, updateSettings, testTeamsWebhook, testTtnConnection } = require("../controllers/settingsController");
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

// PUT — vendor_admin can update their own org general settings (Teams, report frequency);
//       TTN fields are rejected by controller with 403 for vendor_admin
router.put(
  "/",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  blockCrossVendorAccess,
  updateSettings
);

// POST test-webhook — vendor_admin only (Teams is vendor-only feature)
router.post(
  "/test-teams-webhook",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  testTeamsWebhook
);

// POST test-ttn-connection — super_admin only (TTN config owned by super_admin now)
router.post(
  "/test-ttn-connection",
  authenticate,
  authorize("super_admin"),
  testTtnConnection
);

module.exports = router;
