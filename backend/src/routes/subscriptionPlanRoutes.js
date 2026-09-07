const express = require("express");
const { getPlans, getPlanById, createPlan, updatePlan, deletePlan } = require("../controllers/subscriptionPlanController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();
const superAdminOnly = [authenticate, authorize("super_admin")];

router.get("/",    ...superAdminOnly, getPlans);
router.get("/:id", ...superAdminOnly, getPlanById);
router.post("/",   ...superAdminOnly, createPlan);
router.put("/:id", ...superAdminOnly, updatePlan);
router.delete("/:id", ...superAdminOnly, deletePlan);

module.exports = router;
