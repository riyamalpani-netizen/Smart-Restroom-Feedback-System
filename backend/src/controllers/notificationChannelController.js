const prisma = require("../config/database");
const notificationService = require("../services/notifications/NotificationService");
const { encryptAndSerializeConfig, redactConfig, parseAndDecryptConfig } = require("../services/notifications/configEncryption");
const { getSupportedChannelTypes, getSupportedProviders } = require("../services/notifications/providers");
const { logAudit } = require("../utils/auditLogger");

// ── Helpers ───────────────────────────────────────────────────────────────────

function orgId(req) {
  return req.user?.organizationId;
}

function assertVendorAdmin(req, res) {
  if (req.user?.role !== "vendor_admin" && req.user?.role !== "super_admin") {
    res.status(403).json({ message: "Only Vendor Admins can manage notification channels" });
    return false;
  }
  return true;
}

/** Strip secrets from a channel before sending to client */
function sanitizeChannel(channel) {
  if (!channel) return null;
  const config = parseAndDecryptConfig(channel.configuration);
  return {
    ...channel,
    configuration: redactConfig(config),
  };
}

// ── GET /api/notifications/channels ──────────────────────────────────────────
async function getChannels(req, res) {
  try {
    const oid = req.user?.role === "super_admin"
      ? (req.query.organizationId || orgId(req))
      : orgId(req);

    const channels = await prisma.notificationChannel.findMany({
      where: { organizationId: oid },
      include: {
        recipients: { orderBy: { createdAt: "asc" } },
        templates: { orderBy: { eventType: "asc" } },
        _count: { select: { recipients: true, logs: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ channels: channels.map(sanitizeChannel) });
  } catch (err) {
    console.error("getChannels:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── POST /api/notifications/channels ─────────────────────────────────────────
async function createChannel(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const { channelType, provider, name, configuration, enabled = true } = req.body;

    if (!channelType || !provider || !name) {
      return res.status(400).json({ message: "channelType, provider, and name are required" });
    }

    // Validate channelType/provider exists in registry
    const supportedTypes = getSupportedChannelTypes();
    if (!supportedTypes.includes(channelType)) {
      return res.status(400).json({ message: `Unsupported channelType: ${channelType}` });
    }
    const supportedProviders = getSupportedProviders(channelType);
    if (!supportedProviders.includes(provider)) {
      return res.status(400).json({ message: `Unsupported provider "${provider}" for channelType "${channelType}"` });
    }

    const configStr = encryptAndSerializeConfig(configuration || {});

    const channel = await prisma.notificationChannel.create({
      data: { organizationId: oid, channelType, provider, name, configuration: configStr, enabled },
      include: { recipients: true, templates: true },
    });

    await logAudit(req, { module: "NotificationChannels", action: "CREATE", description: `Created ${channelType}/${provider} channel: ${name}` });
    res.status(201).json({ channel: sanitizeChannel(channel) });
  } catch (err) {
    console.error("createChannel:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/notifications/channels/:id ──────────────────────────────────────
async function getChannelById(req, res) {
  try {
    const oid = req.user?.role === "super_admin" ? undefined : orgId(req);
    const where = { id: req.params.id, ...(oid ? { organizationId: oid } : {}) };

    const channel = await prisma.notificationChannel.findFirst({
      where,
      include: {
        recipients: { orderBy: { createdAt: "asc" } },
        templates: { orderBy: { eventType: "asc" } },
        _count: { select: { logs: true } },
      },
    });

    if (!channel) return res.status(404).json({ message: "Channel not found" });
    res.json({ channel: sanitizeChannel(channel) });
  } catch (err) {
    console.error("getChannelById:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PUT /api/notifications/channels/:id ──────────────────────────────────────
async function updateChannel(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const existing = await prisma.notificationChannel.findFirst({ where: { id: req.params.id, organizationId: oid } });
    if (!existing) return res.status(404).json({ message: "Channel not found" });

    const { name, configuration, enabled } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);

    if (configuration !== undefined) {
      // Merge: keep existing encrypted secrets if sentinel "••••••••" is passed
      const existingConfig = parseAndDecryptConfig(existing.configuration);
      const incomingConfig = configuration;
      const merged = { ...existingConfig };
      for (const [k, v] of Object.entries(incomingConfig)) {
        if (v !== "••••••••") merged[k] = v; // only overwrite if not sentinel
      }
      updateData.configuration = encryptAndSerializeConfig(merged);
    }

    const updated = await prisma.notificationChannel.update({
      where: { id: req.params.id },
      data: updateData,
      include: { recipients: true, templates: true },
    });

    await logAudit(req, { module: "NotificationChannels", action: "UPDATE", description: `Updated channel: ${updated.name}` });
    res.json({ channel: sanitizeChannel(updated) });
  } catch (err) {
    console.error("updateChannel:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── DELETE /api/notifications/channels/:id ────────────────────────────────────
async function deleteChannel(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const existing = await prisma.notificationChannel.findFirst({ where: { id: req.params.id, organizationId: oid } });
    if (!existing) return res.status(404).json({ message: "Channel not found" });

    await prisma.notificationChannel.delete({ where: { id: req.params.id } });
    await logAudit(req, { module: "NotificationChannels", action: "DELETE", description: `Deleted channel: ${existing.name}` });
    res.json({ message: "Channel deleted" });
  } catch (err) {
    console.error("deleteChannel:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PATCH /api/notifications/channels/:id/status ─────────────────────────────
async function toggleChannelStatus(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const existing = await prisma.notificationChannel.findFirst({ where: { id: req.params.id, organizationId: oid } });
    if (!existing) return res.status(404).json({ message: "Channel not found" });

    const { enabled } = req.body;
    const updated = await prisma.notificationChannel.update({
      where: { id: req.params.id },
      data: { enabled: Boolean(enabled) },
    });
    await logAudit(req, { module: "NotificationChannels", action: "TOGGLE", description: `Channel ${updated.name} set to ${updated.enabled ? "enabled" : "disabled"}` });
    res.json({ channel: sanitizeChannel(updated) });
  } catch (err) {
    console.error("toggleChannelStatus:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── POST /api/notifications/channels/:id/test ─────────────────────────────────
async function testChannel(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const result = await notificationService.sendTestNotification(req.params.id, oid);
    // Always return 200 — success/failure is indicated in the result body.
    // A 400 here is reserved for invalid request shape, not provider errors.
    res.json({
      success: result.success,
      message: result.success
        ? "Test notification sent successfully"
        : `Test notification failed: ${result.error || "Unknown error"}`,
      result,
    });
  } catch (err) {
    console.error("testChannel:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── POST /api/notifications/channels/:id/recipients ──────────────────────────
async function addRecipient(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const channel = await prisma.notificationChannel.findFirst({ where: { id: req.params.id, organizationId: oid } });
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const { recipientType, recipientValue, label, enabled = true, eventTypes } = req.body;
    if (!recipientType || !recipientValue) {
      return res.status(400).json({ message: "recipientType and recipientValue are required" });
    }

    const recipient = await prisma.notificationRecipient.create({
      data: {
        notificationChannelId: req.params.id,
        recipientType,
        recipientValue,
        label: label || null,
        enabled: Boolean(enabled),
        eventTypes: eventTypes ? JSON.stringify(eventTypes) : null,
      },
    });
    res.status(201).json({ recipient });
  } catch (err) {
    console.error("addRecipient:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PUT /api/notifications/recipients/:id ────────────────────────────────────
async function updateRecipient(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    // Verify ownership through channel
    const recipient = await prisma.notificationRecipient.findFirst({
      where: { id: req.params.id },
      include: { channel: true },
    });
    if (!recipient || recipient.channel.organizationId !== oid) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const { recipientValue, label, enabled, eventTypes } = req.body;
    const updated = await prisma.notificationRecipient.update({
      where: { id: req.params.id },
      data: {
        ...(recipientValue !== undefined && { recipientValue }),
        ...(label !== undefined && { label }),
        ...(enabled !== undefined && { enabled: Boolean(enabled) }),
        ...(eventTypes !== undefined && { eventTypes: JSON.stringify(eventTypes) }),
      },
    });
    res.json({ recipient: updated });
  } catch (err) {
    console.error("updateRecipient:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── DELETE /api/notifications/recipients/:id ──────────────────────────────────
async function deleteRecipient(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const recipient = await prisma.notificationRecipient.findFirst({
      where: { id: req.params.id },
      include: { channel: true },
    });
    if (!recipient || recipient.channel.organizationId !== oid) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    await prisma.notificationRecipient.delete({ where: { id: req.params.id } });
    res.json({ message: "Recipient deleted" });
  } catch (err) {
    console.error("deleteRecipient:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/notifications/templates ─────────────────────────────────────────
async function getTemplates(req, res) {
  try {
    const oid = req.user?.role === "super_admin" ? (req.query.organizationId || orgId(req)) : orgId(req);
    const templates = await prisma.notificationTemplate.findMany({
      where: { channel: { organizationId: oid } },
      include: { channel: { select: { id: true, name: true, channelType: true, provider: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ templates });
  } catch (err) {
    console.error("getTemplates:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── POST /api/notifications/templates ────────────────────────────────────────
async function createTemplate(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const { notificationChannelId, eventType, subject, body, format = "text", enabled = true } = req.body;
    if (!notificationChannelId || !eventType || !body) {
      return res.status(400).json({ message: "notificationChannelId, eventType, and body are required" });
    }

    const channel = await prisma.notificationChannel.findFirst({ where: { id: notificationChannelId, organizationId: oid } });
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const template = await prisma.notificationTemplate.upsert({
      where: { notificationChannelId_eventType: { notificationChannelId, eventType } },
      update: { subject, body, format, enabled },
      create: { notificationChannelId, eventType, subject, body, format, enabled },
    });
    res.status(201).json({ template });
  } catch (err) {
    console.error("createTemplate:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PUT /api/notifications/templates/:id ─────────────────────────────────────
async function updateTemplate(req, res) {
  if (!assertVendorAdmin(req, res)) return;
  try {
    const oid = orgId(req);
    const tmpl = await prisma.notificationTemplate.findFirst({
      where: { id: req.params.id },
      include: { channel: true },
    });
    if (!tmpl || tmpl.channel.organizationId !== oid) {
      return res.status(404).json({ message: "Template not found" });
    }
    const { subject, body, format, enabled } = req.body;
    const updated = await prisma.notificationTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(subject !== undefined && { subject }),
        ...(body !== undefined && { body }),
        ...(format !== undefined && { format }),
        ...(enabled !== undefined && { enabled: Boolean(enabled) }),
      },
    });
    res.json({ template: updated });
  } catch (err) {
    console.error("updateTemplate:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/notifications/history ───────────────────────────────────────────
async function getHistory(req, res) {
  try {
    const oid = req.user?.role === "super_admin" ? (req.query.organizationId || orgId(req)) : orgId(req);
    const { page, limit, eventType, channelType, status, from, to } = req.query;
    const result = await notificationService.getHistory(oid, { page, limit, eventType, channelType, status, from, to });
    res.json(result);
  } catch (err) {
    console.error("getHistory:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/notifications/metadata ──────────────────────────────────────────
async function getMetadata(req, res) {
  try {
    res.json({ metadata: notificationService.getProviderMetadata() });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getChannels, createChannel, getChannelById, updateChannel, deleteChannel,
  toggleChannelStatus, testChannel,
  addRecipient, updateRecipient, deleteRecipient,
  getTemplates, createTemplate, updateTemplate,
  getHistory, getMetadata,
};
