/**
 * planLimits.js
 *
 * Shared helper to check subscription plan limits before allowing resource creation.
 * Returns { allowed: true } if within limits or no plan assigned.
 * Returns { allowed: false, message: string } if limit exceeded.
 */

const prisma = require("../config/database");

/**
 * Get the subscription plan for an organisation.
 * Returns null if no plan is assigned.
 */
async function getOrgPlan(organizationId) {
  if (!organizationId) return null;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      subscriptionPlan: {
        select: { maxSites: true, maxGateways: true, maxDevices: true, maxUsers: true, name: true },
      },
    },
  });
  return org?.subscriptionPlan || null;
}

/**
 * Check if adding one more resource would exceed the plan limit.
 *
 * @param {string} organizationId
 * @param {'devices'|'gateways'|'sites'|'users'} resource
 * @returns {{ allowed: boolean, message?: string }}
 */
async function checkPlanLimit(organizationId, resource) {
  if (!organizationId) return { allowed: true }; // unassigned inventory — no limit

  const plan = await getOrgPlan(organizationId);
  if (!plan) return { allowed: true }; // no plan = no limit

  let current = 0;
  let limit = 0;
  let label = "";

  switch (resource) {
    case "devices":
      current = await prisma.device.count({ where: { organizationId } });
      limit = plan.maxDevices;
      label = "device";
      break;
    case "gateways":
      current = await prisma.gateway.count({ where: { organizationId } });
      limit = plan.maxGateways;
      label = "gateway";
      break;
    case "sites":
      current = await prisma.location.count({ where: { organizationId } });
      limit = plan.maxSites;
      label = "site";
      break;
    case "users":
      current = await prisma.user.count({ where: { organizationId } });
      limit = plan.maxUsers;
      label = "user";
      break;
    default:
      return { allowed: true };
  }

  if (limit > 0 && current >= limit) {
    return {
      allowed: false,
      message: `${label.charAt(0).toUpperCase() + label.slice(1)} limit reached. Your "${plan.name}" plan allows a maximum of ${limit} ${label}${limit !== 1 ? "s" : ""} (currently ${current}).`,
    };
  }

  return { allowed: true };
}

module.exports = { checkPlanLimit, getOrgPlan };
