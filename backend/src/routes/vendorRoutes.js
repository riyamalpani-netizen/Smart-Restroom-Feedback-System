/**
 * vendorRoutes.js
 *
 * All routes here are restricted to super_admin only.
 * Vendor Admins have no write access to any of these endpoints.
 */

const express = require("express");
const {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  updateVendorTTNConfig,
  getVendorTTNConfig,
  toggleIntegration,
  getIntegrationStatus,
  assignSubscriptionPlan,
  getResourceUsage,
  testVendorTTNConnection,
  regenerateVendorApiKey,
} = require("../controllers/vendorController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

const superAdminOnly = [authenticate, authorize("super_admin")];

// ── Vendor CRUD ───────────────────────────────────────────────────────────────
router.get("/",    ...superAdminOnly, getVendors);
router.get("/:id", ...superAdminOnly, getVendorById);
router.post("/",   ...superAdminOnly, createVendor);
router.put("/:id", ...superAdminOnly, updateVendor);
router.delete("/:id", ...superAdminOnly, deleteVendor);

// ── TTN / MQTT Configuration (Super Admin assigns to vendor) ──────────────────
router.get("/:id/ttn-config",    ...superAdminOnly, getVendorTTNConfig);
router.put("/:id/ttn-config",    ...superAdminOnly, updateVendorTTNConfig);
router.patch("/:id/toggle-integration", ...superAdminOnly, toggleIntegration);
router.get("/:id/integration-status",   ...superAdminOnly, getIntegrationStatus);
router.post("/:id/test-ttn-connection", ...superAdminOnly, testVendorTTNConnection);

// ── Regenerate TTN API Key ────────────────────────────────────────────────────
router.post("/:id/regenerate-api-key", ...superAdminOnly, regenerateVendorApiKey);

// ── Subscription Plan ─────────────────────────────────────────────────────────
router.put("/:id/assign-plan", ...superAdminOnly, assignSubscriptionPlan);

// ── Resource Usage ────────────────────────────────────────────────────────────
router.get("/:id/resource-usage", ...superAdminOnly, getResourceUsage);

module.exports = router;
