const express = require("express");
const { authenticate, authorize } = require("../auth/authMiddleware");
const { login, logout, refreshToken, getProfile, updateProfile, getTutorialStatus, updateTutorialStatus } = require("./authController");

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.get("/tutorial", authenticate, getTutorialStatus);
router.put("/tutorial", authenticate, updateTutorialStatus);

module.exports = router;
