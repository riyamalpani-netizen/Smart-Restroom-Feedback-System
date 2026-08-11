const express = require("express");

const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require("./userController");

const {
  authenticate,
  authorize,
} = require("../auth/authMiddleware");

const router = express.Router();

// Super Admin can access all users
// Vendor Admin can only access users in their own organization
router.get(
  "/",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  getUsers
);

router.get(
  "/:id",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  getUserById
);

router.post(
  "/",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  createUser
);

router.put(
  "/:id",
  authenticate,
  authorize("super_admin", "vendor_admin"),
  updateUser
);

router.delete(
  "/:id",
  authenticate,
  authorize("super_admin"),
  deleteUser
);

module.exports = router;