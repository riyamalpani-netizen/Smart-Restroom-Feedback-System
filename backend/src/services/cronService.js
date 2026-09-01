const cron = require("node-cron");
const prisma = require("../config/database");
const { sendTeamsWebhook } = require("./teamsWebhookService");
const logger = require("../middleware/logger");

let cronJobs = [];

function startCronJobs() {
  if (cronJobs.length > 0) {
    logger.info("Cron jobs already running");
    return;
  }

  const daily = cron.schedule("0 8 * * *", async () => {
    await generateDailyReport();
  }, { timezone: "UTC" });

  const weekly = cron.schedule("0 8 * * 1", async () => {
    await generateWeeklyReport();
  }, { timezone: "UTC" });

  const monthly = cron.schedule("0 8 1 * *", async () => {
    await generateMonthlyReport();
  }, { timezone: "UTC" });

  cronJobs = [daily, weekly, monthly];
  logger.info("Cron jobs started");
}

function stopCronJobs() {
  if (cronJobs.length > 0) {
    cronJobs.forEach((job) => job.stop());
    cronJobs = [];
    logger.info("Cron jobs stopped");
  }
}

/**
 * Returns only Settings rows that belong to a vendor-admin organisation.
 * Digest reports are a vendor-portal feature — super-admin orgs are excluded.
 */
async function getVendorOrgSettings() {
  // Find all orgs that have at least one active vendor_admin
  const vendorOrgs = await prisma.user.findMany({
    where: { role: "vendor_admin", active: true },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });

  if (!vendorOrgs.length) return [];

  const orgIds = vendorOrgs.map((u) => u.organizationId);

  return prisma.settings.findMany({
    where: {
      organizationId: { in: orgIds },
      teamsWebhook: { not: null },
    },
  });
}

async function generateDailyReport() {
  try {
    logger.info("Generating daily report...");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);

    const [feedback, alerts, vendorSettings] = await Promise.all([
      prisma.feedback.findMany({
        where: { timestamp: { gte: yesterday, lt: today } },
        include: { restroom: true },
      }),
      prisma.alert.findMany({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      getVendorOrgSettings(),
    ]);

    const report = {
      period: "daily",
      date: yesterday.toISOString().split("T")[0],
      totalFeedback: feedback.length,
      feedbackByType: {
        happy: feedback.filter((f) => f.feedbackType === "happy").length,
        average: feedback.filter((f) => f.feedbackType === "average").length,
        needs_cleaning: feedback.filter((f) => f.feedbackType === "needs_cleaning").length,
        emergency: feedback.filter((f) => f.feedbackType === "emergency").length,
      },
      alertsCreated: alerts.length,
      alertsResolved: alerts.filter(
        (a) => a.resolvedAt && a.resolvedAt >= yesterday && a.resolvedAt < today
      ).length,
    };

    // Send to every vendor-admin org that has a webhook configured
    for (const settings of vendorSettings) {
      try {
        await sendTeamsWebhook(settings.teamsWebhook, { report });
      } catch (err) {
        logger.error(`Daily report webhook failed for org ${settings.organizationId}:`, err);
      }
    }

    logger.info("Daily report generated", { report });
    return report;
  } catch (error) {
    logger.error("Error generating daily report:", error);
  }
}

async function generateWeeklyReport() {
  try {
    logger.info("Generating weekly report...");
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(endOfWeek);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const [feedback, vendorSettings] = await Promise.all([
      prisma.feedback.findMany({
        where: { timestamp: { gte: startOfWeek, lte: endOfWeek } },
      }),
      getVendorOrgSettings(),
    ]);

    const report = {
      period: "weekly",
      startDate: startOfWeek.toISOString().split("T")[0],
      endDate: endOfWeek.toISOString().split("T")[0],
      totalFeedback: feedback.length,
      feedbackByType: {
        happy: feedback.filter((f) => f.feedbackType === "happy").length,
        average: feedback.filter((f) => f.feedbackType === "average").length,
        needs_cleaning: feedback.filter((f) => f.feedbackType === "needs_cleaning").length,
        emergency: feedback.filter((f) => f.feedbackType === "emergency").length,
      },
    };

    for (const settings of vendorSettings) {
      try {
        await sendTeamsWebhook(settings.teamsWebhook, { report });
      } catch (err) {
        logger.error(`Weekly report webhook failed for org ${settings.organizationId}:`, err);
      }
    }

    logger.info("Weekly report generated", { report });
    return report;
  } catch (error) {
    logger.error("Error generating weekly report:", error);
  }
}

async function generateMonthlyReport() {
  try {
    logger.info("Generating monthly report...");
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [feedback, vendorSettings] = await Promise.all([
      prisma.feedback.findMany({
        where: { timestamp: { gte: startOfMonth, lte: endOfMonth } },
      }),
      getVendorOrgSettings(),
    ]);

    const report = {
      period: "monthly",
      month: now.toISOString().slice(0, 7),
      totalFeedback: feedback.length,
      feedbackByType: {
        happy: feedback.filter((f) => f.feedbackType === "happy").length,
        average: feedback.filter((f) => f.feedbackType === "average").length,
        needs_cleaning: feedback.filter((f) => f.feedbackType === "needs_cleaning").length,
        emergency: feedback.filter((f) => f.feedbackType === "emergency").length,
      },
    };

    for (const settings of vendorSettings) {
      try {
        await sendTeamsWebhook(settings.teamsWebhook, { report });
      } catch (err) {
        logger.error(`Monthly report webhook failed for org ${settings.organizationId}:`, err);
      }
    }

    logger.info("Monthly report generated", { report });
    return report;
  } catch (error) {
    logger.error("Error generating monthly report:", error);
  }
}

module.exports = {
  startCronJobs,
  stopCronJobs,
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
};
