const express = require("express");
const { getAuditLogs, getAuditLogModules } = require("../controllers/auditLogController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

// Both super_admin and vendor_admin can view audit logs (scoped by controller)
router.get("/", authenticate, authorize("super_admin", "vendor_admin"), getAuditLogs);
router.get("/modules", authenticate, authorize("super_admin", "vendor_admin"), getAuditLogModules);

module.exports = router;
