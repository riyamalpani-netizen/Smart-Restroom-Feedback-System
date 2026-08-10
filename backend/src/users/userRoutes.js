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

// Get all users
router.get(
  "/",
  authenticate,
  authorize("super_admin"),
  getUsers
);

// Get user by ID
router.get(
  "/:id",
  authenticate,
  authorize("super_admin"),
  getUserById
);

// Create user
router.post(
  "/",
  authenticate,
  authorize("super_admin"),
  createUser
);

// Update user
router.put(
  "/:id",
  authenticate,
  authorize("super_admin"),
  updateUser
);

// Deactivate user
router.delete(
  "/:id",
  authenticate,
  authorize("super_admin"),
  deleteUser
);

module.exports = router;