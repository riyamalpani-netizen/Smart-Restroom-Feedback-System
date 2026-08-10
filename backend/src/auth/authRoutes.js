const express = require("express");
const { login, logout, refreshToken, getProfile } = require("./authController");

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.get("/profile", getProfile);

module.exports = router;
