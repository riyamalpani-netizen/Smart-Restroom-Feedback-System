/**
 * subscriptionPlanController.js
 *
 * Super Admin only. Full CRUD for subscription plans and their resource limits.
 */

const prisma = require("../config/database");
const { logAudit } = require("../utils/auditLogger");

const PLAN_SELECT = {
  id: true,
  name: true,
  description: true,
  maxSites: true,
  maxGateways: true,
  maxDevices: true,
  maxUsers: true,
  features: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { organizations: true } },
};

// ── GET /api/subscription-plans ──────────────────────────────────────────────

async function getPlans(req, res) {
  try {
    const { activeOnly } = req.query;
    const where = {};
    if (activeOnly === "true") where.isActive = true;

    const plans = await prisma.subscriptionPlan.findMany({
      where,
      select: PLAN_SELECT,
      orderBy: { name: "asc" },
    });

    res.status(200).json({ message: "Plans fetched successfully", plans });
  } catch (error) {
    console.error("getPlans error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/subscription-plans/:id ──────────────────────────────────────────

async function getPlanById(req, res) {
  try {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      select: {
        ...PLAN_SELECT,
        organizations: {
          select: {
            id: true,
            name: true,
            vendorStatus: true,
          },
        },
      },
    });

    if (!plan) return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ message: "Plan fetched successfully", plan });
  } catch (error) {
    console.error("getPlanById error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── POST /api/subscription-plans ─────────────────────────────────────────────

async function createPlan(req, res) {
  try {
    const {
      name,
      description,
      maxSites = 1,
      maxGateways = 5,
      maxDevices = 20,
      maxUsers = 10,
      features = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Plan name is required" });
    }

    // Validate limits are positive integers
    for (const [field, val] of [["maxSites", maxSites], ["maxGateways", maxGateways], ["maxDevices", maxDevices], ["maxUsers", maxUsers]]) {
      if (!Number.isInteger(Number(val)) || Number(val) < 0) {
        return res.status(400).json({ message: `${field} must be a non-negative integer` });
      }
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        maxSites: parseInt(maxSites),
        maxGateways: parseInt(maxGateways),
        maxDevices: parseInt(maxDevices),
        maxUsers: parseInt(maxUsers),
        features: JSON.stringify(Array.isArray(features) ? features : []),
        isActive: true,
      },
      select: PLAN_SELECT,
    });

    await logAudit(req, {
      module: "SubscriptionPlan",
      action: "CREATE",
      description: `Created subscription plan "${plan.name}" (${plan.id})`,
    });

    res.status(201).json({ message: "Plan created successfully", plan });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "A plan with that name already exists" });
    }
    console.error("createPlan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PUT /api/subscription-plans/:id ──────────────────────────────────────────

async function updatePlan(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      maxSites,
      maxGateways,
      maxDevices,
      maxUsers,
      features,
      isActive,
    } = req.body;

    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Plan not found" });

    const data = {};
    if (name !== undefined)         data.name = name.trim();
    if (description !== undefined)  data.description = description?.trim() || null;
    if (maxSites !== undefined)     data.maxSites = parseInt(maxSites);
    if (maxGateways !== undefined)  data.maxGateways = parseInt(maxGateways);
    if (maxDevices !== undefined)   data.maxDevices = parseInt(maxDevices);
    if (maxUsers !== undefined)     data.maxUsers = parseInt(maxUsers);
    if (features !== undefined)     data.features = JSON.stringify(Array.isArray(features) ? features : []);
    if (isActive !== undefined)     data.isActive = Boolean(isActive);

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data,
      select: PLAN_SELECT,
    });

    await logAudit(req, {
      module: "SubscriptionPlan",
      action: "UPDATE",
      description: `Updated subscription plan "${plan.name}" (${id})`,
    });

    res.status(200).json({ message: "Plan updated successfully", plan });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "A plan with that name already exists" });
    }
    console.error("updatePlan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── DELETE /api/subscription-plans/:id ───────────────────────────────────────

async function deletePlan(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { organizations: true } } },
    });
    if (!existing) return res.status(404).json({ message: "Plan not found" });

    // Cannot delete a plan that has vendors assigned
    if (existing._count.organizations > 0) {
      return res.status(400).json({
        message: `Cannot delete plan "${existing.name}" — it is assigned to ${existing._count.organizations} vendor(s). Reassign or deactivate the plan instead.`,
      });
    }

    await prisma.subscriptionPlan.delete({ where: { id } });

    await logAudit(req, {
      module: "SubscriptionPlan",
      action: "DELETE",
      description: `Deleted subscription plan "${existing.name}" (${id})`,
    });

    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    console.error("deletePlan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { getPlans, getPlanById, createPlan, updatePlan, deletePlan };
