const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

async function getReports(req, res) {
  try {
    const { type, startDate, endDate, organizationId, restroomId, deviceId } = req.query;
    const where = {};
    const orgFilter = getOrgFilter(req);

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (restroomId) {
      where.restroomId = restroomId;
      const restroom = await prisma.restroom.findUnique({ where: { id: restroomId }, select: { organizationId: true } });
      if (restroom) where.organizationId = restroom.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    } else {
      where.organizationId = orgFilter.organizationId;
    }

    if (deviceId) where.deviceId = deviceId;

    const feedback = await prisma.feedback.findMany({
      where,
      include: {
        restroom: { include: { floor: { include: { location: true } } } },
        device: true,
        alert: true,
      },
      orderBy: { timestamp: "desc" },
    });

    const summary = {
      total: feedback.length,
      byType: {
        happy: feedback.filter((f) => f.feedbackType === "happy").length,
        average: feedback.filter((f) => f.feedbackType === "average").length,
        needs_cleaning: feedback.filter((f) => f.feedbackType === "needs_cleaning").length,
        emergency: feedback.filter((f) => f.feedbackType === "emergency").length,
      },
      period: type || "custom",
      dateRange: { startDate, endDate },
    };

    res.status(200).json({
      message: "Report fetched successfully",
      summary,
      data: feedback,
    });
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function exportPdf(req, res) {
  try {
    const { startDate, endDate } = req.query;

    res.status(200).json({
      message: "PDF export endpoint - integrate with PDF library",
      data: { startDate, endDate },
    });
  } catch (error) {
    console.error("Export PDF error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function exportExcel(req, res) {
  try {
    const { startDate, endDate } = req.query;

    res.status(200).json({
      message: "Excel export endpoint - integrate with ExcelJS",
      data: { startDate, endDate },
    });
  } catch (error) {
    console.error("Export Excel error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function exportCsv(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const orgFilter = getOrgFilter(req);
    const where = { ...orgFilter };
    if (startDate) where.timestamp = { ...where.timestamp, gte: new Date(startDate) };
    if (endDate) where.timestamp = { ...where.timestamp, lte: new Date(endDate) };

    const feedback = await prisma.feedback.findMany({
      where,
      include: { restroom: true, device: true },
      orderBy: { timestamp: "desc" },
    });

    const headers = ["ID", "Restroom", "Badge", "Feedback Type", "Timestamp", "Battery", "Signal"];
    const rows = feedback.map((f) => [
      f.id,
      f.restroom.name,
      f.device.badgeId,
      f.feedbackType,
      f.timestamp.toISOString(),
      f.battery ?? "",
      f.signalStrength ?? "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=report.csv");
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getReports,
  exportPdf,
  exportExcel,
  exportCsv,
};
