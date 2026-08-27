const bcrypt = require("bcryptjs");
const prisma = require("../config/database");
const { logAudit } = require("../utils/auditLogger");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Roles that a vendor_admin is allowed to assign to the users they manage.
 * They can create / update users to these roles only.
 */
const VENDOR_MANAGEABLE_ROLES = ["regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"];

/**
 * Check whether the caller (vendor_admin) is allowed to act on the target user.
 * Returns an error message string if denied, or null if allowed.
 */
function checkVendorAdminAccess(callerOrgId, targetUser) {
  if (!targetUser) return "User not found";
  if (targetUser.role === "super_admin") {
    return "You do not have permission to manage Super Admin accounts";
  }
  if (targetUser.role === "vendor_admin") {
    return "You do not have permission to manage other Vendor Admin accounts";
  }
  if (targetUser.organizationId !== callerOrgId) {
    return "You can only manage users within your own organisation";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Get all users
// ---------------------------------------------------------------------------
const getUsers = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const where = {};
    if (userRole === "vendor_admin") {
      // Vendor admin sees only their org's facility_manager and viewer accounts
      where.organizationId = userOrgId;
      where.role = { in: VENDOR_MANAGEABLE_ROLES };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ message: "Users fetched successfully", users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Get user by ID
// ---------------------------------------------------------------------------
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    // Use findFirst so we can apply composite filters safely
    const user = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Vendor admin access check
    if (userRole === "vendor_admin") {
      const denied = checkVendorAdminAccess(userOrgId, user);
      if (denied) return res.status(403).json({ message: denied });
    }

    res.status(200).json({ message: "User fetched successfully", user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Create user
// ---------------------------------------------------------------------------
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, organizationId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password, and role are required",
      });
    }

    const allValidRoles = ["super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"];
    if (!allValidRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid user role" });
    }

    if (userRole === "vendor_admin") {
      // Vendor admin can only create facility_manager or viewer accounts
      if (!VENDOR_MANAGEABLE_ROLES.includes(role)) {
        return res.status(403).json({
          message: `Vendor Admins can only create users with roles: ${VENDOR_MANAGEABLE_ROLES.join(", ")}`,
        });
      }
      // Vendor admin can only create users inside their own org
      const targetOrgId = organizationId || userOrgId;
      if (targetOrgId !== userOrgId) {
        return res.status(403).json({
          message: "You can only create users within your own organisation",
        });
      }
    }

    // Determine the org for the new user
    const newUserOrgId = userRole === "vendor_admin" ? userOrgId : (organizationId || userOrgId);
    if (!newUserOrgId) {
      return res.status(400).json({ message: "Organization ID is required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        organizationId: newUserOrgId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        organizationId: true,
      },
    });

    await logAudit(req, {
      module: "User",
      action: "CREATE",
      description: `Created user ${user.email} with role ${user.role} in org ${user.organizationId}`,
    });

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Update user
// ---------------------------------------------------------------------------
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, active, organizationId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userRole === "vendor_admin") {
      const denied = checkVendorAdminAccess(userOrgId, existingUser);
      if (denied) return res.status(403).json({ message: denied });
    }

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    if (role !== undefined) {
      const allValidRoles = ["super_admin", "vendor_admin", "regional_manager", "vendor_manager", "site_incharge", "facility_manager", "viewer"];
      if (!allValidRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid user role" });
      }
      // Vendor admin cannot promote to super_admin or vendor_admin
      if (userRole === "vendor_admin" && !VENDOR_MANAGEABLE_ROLES.includes(role)) {
        return res.status(403).json({
          message: `Vendor Admins can only assign roles: ${VENDOR_MANAGEABLE_ROLES.join(", ")}`,
        });
      }
      updateData.role = role;
    }

    if (active !== undefined) updateData.active = active;

    if (organizationId !== undefined) {
      // Vendor admin cannot move users to a different org
      if (userRole === "vendor_admin" && organizationId !== userOrgId) {
        return res.status(403).json({
          message: "You can only assign users to your own organisation",
        });
      }
      updateData.organizationId = organizationId;
    }

    if (password !== undefined && password !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
    });

    await logAudit(req, {
      module: "User",
      action: "UPDATE",
      description: `Updated user ${user.email} (id: ${user.id})`,
    });

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Deactivate / delete user
// ---------------------------------------------------------------------------
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userRole === "vendor_admin") {
      const denied = checkVendorAdminAccess(userOrgId, existingUser);
      if (denied) return res.status(403).json({ message: denied });
    }

    // Soft-delete (deactivate) instead of permanent deletion
    const user = await prisma.user.update({
      where: { id },
      data: { active: false },
      select: { id: true, name: true, email: true, role: true, active: true },
    });

    await logAudit(req, {
      module: "User",
      action: "DEACTIVATE",
      description: `Deactivated user ${user.email} (id: ${user.id})`,
    });

    res.status(200).json({ message: "User deactivated successfully", user });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
