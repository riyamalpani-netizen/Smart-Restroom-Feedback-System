const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

function authenticate(req, res, next) {
  return authenticateToken(req, res, next);
}

function authorize(...requiredRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const role = req.user.role;
    const allowedRoles = [
      "super_admin",
      "vendor_admin",
      "facility_manager",
      "viewer",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource" });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authenticateToken,
  authorize,
};