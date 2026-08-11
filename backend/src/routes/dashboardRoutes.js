const express = require("express");
const { getDashboard, getDashboardSummary, getDashboardCharts, getDashboardLive, getHeatMapData } = require("../controllers/dashboardController");
const { authenticate, authorize } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getDashboard);
router.get("/summary", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getDashboardSummary);
router.get("/charts", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getDashboardCharts);
router.get("/live", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getDashboardLive);
router.get("/heatmap", authenticate, authorize("super_admin", "vendor_admin", "facility_manager", "viewer"), getHeatMapData);

module.exports = router;
