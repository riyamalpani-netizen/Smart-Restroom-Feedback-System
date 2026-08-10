const express = require("express");
const { getReports, exportPdf, exportExcel, exportCsv } = require("../controllers/reportController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/daily", authenticate, getReports);
router.get("/weekly", authenticate, getReports);
router.get("/monthly", authenticate, getReports);
router.get("/export/pdf", authenticate, authorize("super_admin", "vendor_admin"), exportPdf);
router.get("/export/excel", authenticate, authorize("super_admin", "vendor_admin"), exportExcel);
router.get("/export/csv", authenticate, authorize("super_admin", "vendor_admin"), exportCsv);

module.exports = router;
