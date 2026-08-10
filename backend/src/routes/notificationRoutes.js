const express = require("express");
const { getNotifications } = require("../controllers/notificationController");
const { authenticate } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getNotifications);

module.exports = router;
