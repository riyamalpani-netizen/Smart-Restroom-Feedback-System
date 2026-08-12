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
    const orgFilter = getOrgFilter(req);
    const where = { ...orgFilter };
    if (startDate) where.timestamp = { ...where.timestamp, gte: new Date(startDate) };
    if (endDate) where.timestamp = { ...where.timestamp, lte: new Date(endDate) };

    const feedback = await prisma.feedback.findMany({
      where,
      include: { restroom: true, device: true },
      orderBy: { timestamp: "desc" },
    });

    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=report.pdf");

    doc.pipe(res);

    doc.fontSize(18).text("Smart Restroom Feedback System - Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${startDate || "N/A"} to ${endDate || "N/A"}`, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown();

    const tableTop = doc.y;
    const colWidths = [60, 140, 80, 100, 140, 70, 70];
    const headers = ["ID", "Restroom", "Badge", "Feedback Type", "Timestamp", "Battery", "Signal"];

    doc.fontSize(10).font("Helvetica-Bold");
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i] });
      x += colWidths[i];
    });

    doc.font("Helvetica");
    let y = tableTop + 20;
    feedback.forEach((f) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const row = [
        String(f.id).slice(0, 8),
        (f.restroom?.name || "").slice(0, 20),
        f.device?.badgeId || "",
        f.feedbackType,
        f.timestamp ? new Date(f.timestamp).toLocaleString() : "",
        f.battery != null ? `${f.battery}%` : "",
        f.signalStrength != null ? `${f.signalStrength}` : "",
      ];

      x = 50;
      row.forEach((cell, i) => {
        doc.text(String(cell), x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 18;
    });

    doc.end();
  } catch (error) {
    console.error("Export PDF error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function exportExcel(req, res) {
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

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    worksheet.columns = [
      { header: "ID", key: "id", width: 20 },
      { header: "Restroom", key: "restroom", width: 30 },
      { header: "Badge", key: "badge", width: 20 },
      { header: "Feedback Type", key: "feedbackType", width: 20 },
      { header: "Timestamp", key: "timestamp", width: 25 },
      { header: "Battery", key: "battery", width: 15 },
      { header: "Signal", key: "signal", width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

    feedback.forEach((f) => {
      worksheet.addRow({
        id: f.id,
        restroom: f.restroom?.name || "",
        badge: f.device?.badgeId || "",
        feedbackType: f.feedbackType,
        timestamp: f.timestamp ? new Date(f.timestamp).toLocaleString() : "",
        battery: f.battery != null ? `${f.battery}%` : "",
        signal: f.signalStrength != null ? `${f.signalStrength}` : "",
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=report.xlsx");

    await workbook.xlsx.write(res);
    res.status(200).end();
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
