const express = require("express");
const { getFeedback, getFeedbackById, createFeedback, deleteFeedback } = require("../controllers/feedbackController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getFeedback);
router.get("/:id", authenticate, getFeedbackById);
router.post("/", authenticate, createFeedback);
router.delete("/:id", authenticate, authorize("super_admin"), deleteFeedback);

module.exports = router;
