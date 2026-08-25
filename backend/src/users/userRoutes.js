const express = require("express");
const { getUsers, getUserById, createUser, updateUser, deleteUser } = require("./userController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

// Super Admin — sees all users across all orgs
// Vendor Admin — sees only facility_manager and viewer accounts in their own org
router.get("/", authenticate, authorize("super_admin", "vendor_admin"), getUsers);
router.get("/:id", authenticate, authorize("super_admin", "vendor_admin"), getUserById);

// Vendor Admin can create facility_manager / viewer accounts in their own org only
router.post("/", authenticate, authorize("super_admin", "vendor_admin"), createUser);

// Vendor Admin can update facility_manager / viewer in their own org (controller enforces scope)
router.put("/:id", authenticate, authorize("super_admin", "vendor_admin"), updateUser);

// Vendor Admin can deactivate facility_manager / viewer in their own org (soft-delete only)
// Controller prevents deactivating super_admin or cross-org users
router.delete("/:id", authenticate, authorize("super_admin", "vendor_admin"), deleteUser);

module.exports = router;
