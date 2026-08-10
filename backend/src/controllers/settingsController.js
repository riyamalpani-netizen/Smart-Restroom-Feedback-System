const prisma = require("../config/database");
const { sendTeamsWebhook } = require("../services/teamsWebhookService");

async function getSettings(req, res) {
  try {
    const { organizationId } = req.query;

    const settings = await prisma.settings.findFirst({
      where: organizationId ? { organizationId } : undefined,
    });

    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    res.status(200).json({ message: "Settings fetched successfully", settings });
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateSettings(req, res) {
  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({ message: "Organization ID is required" });
    }

    const { teamsWebhook, reportFrequency, sessionTimeout, passwordPolicy } = req.body;

    const settings = await prisma.settings.upsert({
      where: { organizationId },
      update: { teamsWebhook, reportFrequency, sessionTimeout, passwordPolicy },
      create: { organizationId, teamsWebhook, reportFrequency, sessionTimeout, passwordPolicy },
    });

    res.status(200).json({ message: "Settings updated successfully", settings });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function testTeamsWebhook(req, res) {
  try {
    const { teamsWebhook } = req.body;

    const result = await sendTeamsWebhook(teamsWebhook, {
      restroom: "Test Restroom",
      feedbackType: "needs_cleaning",
      priority: "medium",
      battery: 85,
      timestamp: new Date().toISOString(),
      alertId: "TEST-001",
    });

    if (result.success) {
      return res.status(200).json({ message: "Teams webhook test sent successfully" });
    } else {
      return res.status(400).json({ message: "Failed to send Teams webhook", error: result.error });
    }
  } catch (error) {
    console.error("Test Teams webhook error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  testTeamsWebhook,
};
