const express = require("express");
const { getDashboard, getDashboardSummary, getDashboardCharts, getDashboardLive, getHeatMapData } = require("../controllers/dashboardController");
const { authenticate } = require("../auth/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getDashboard);
router.get("/summary", authenticate, getDashboardSummary);
router.get("/charts", authenticate, getDashboardCharts);
router.get("/live", authenticate, getDashboardLive);
router.get("/heatmap", authenticate, getHeatMapData);

module.exports = router;
