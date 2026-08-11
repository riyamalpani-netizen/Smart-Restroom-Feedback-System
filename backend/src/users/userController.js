const bcrypt = require("bcryptjs");

const prisma = require("../config/database");

// Get all users
const getUsers = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const where = {};
    if (userRole === "vendor_admin") {
      where.organizationId = userOrgId;
      where.role = { not: "super_admin" };
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const where = { id };
    if (userRole === "vendor_admin") {
      where.organizationId = userOrgId;
      where.role = { not: "super_admin" };
    }

    const user = await prisma.user.findUnique({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Create user
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, organizationId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!name || !email || !password || !role || !organizationId) {
      return res.status(400).json({
        message: "Name, email, password, role, and organization ID are required",
      });
    }

    const validRoles = [
      "super_admin",
      "vendor_admin",
      "facility_manager",
      "viewer",
    ];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid user role",
      });
    }

    // Vendor Admin cannot create super_admin or vendor_admin users
    if (userRole === "vendor_admin") {
      if (role === "super_admin" || role === "vendor_admin") {
        return res.status(403).json({
          message: "You do not have permission to create this role",
        });
      }
      // Vendor Admin can only create users in their own organization
      if (organizationId !== userOrgId) {
        return res.status(403).json({
          message: "You can only create users in your own organization",
        });
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        organizationId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Create user error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, active, organizationId } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Vendor Admin cannot modify super_admin users
    if (userRole === "vendor_admin" && existingUser.role === "super_admin") {
      return res.status(403).json({
        message: "You do not have permission to modify this user",
      });
    }

    // Vendor Admin can only modify users in their own organization
    if (userRole === "vendor_admin" && existingUser.organizationId !== userOrgId) {
      return res.status(403).json({
        message: "You can only modify users in your own organization",
      });
    }

    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (email !== undefined) {
      updateData.email = email;
    }

    if (role !== undefined) {
      const validRoles = [
        "super_admin",
        "vendor_admin",
        "facility_manager",
        "viewer",
      ];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: "Invalid user role",
        });
      }

      // Vendor Admin cannot promote users to super_admin or vendor_admin
      if (userRole === "vendor_admin" && (role === "super_admin" || role === "vendor_admin")) {
        return res.status(403).json({
          message: "You do not have permission to assign this role",
        });
      }

      updateData.role = role;
    }

    if (active !== undefined) {
      updateData.active = active;
    }

    if (organizationId !== undefined) {
      // Vendor Admin cannot move users to another organization
      if (userRole === "vendor_admin" && organizationId !== userOrgId) {
        return res.status(403).json({
          message: "You can only assign users to your own organization",
        });
      }
      updateData.organizationId = organizationId;
    }

    if (password !== undefined && password !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: {
        id,
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update user error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Deactivate user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Vendor Admin cannot deactivate super_admin users
    if (userRole === "vendor_admin" && existingUser.role === "super_admin") {
      return res.status(403).json({
        message: "You do not have permission to deactivate this user",
      });
    }

    // Vendor Admin can only deactivate users in their own organization
    if (userRole === "vendor_admin" && existingUser.organizationId !== userOrgId) {
      return res.status(403).json({
        message: "You can only deactivate users in your own organization",
      });
    }

    // Soft delete instead of permanently deleting the user
    const user = await prisma.user.update({
      where: {
        id,
      },
      data: {
        active: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    res.status(200).json({
      message: "User deactivated successfully",
      user,
    });
  } catch (error) {
    console.error("Delete user error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};