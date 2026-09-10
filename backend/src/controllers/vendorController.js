/**
 * vendorController.js
 *
 * Super Admin only. Manages vendor (Organisation) provisioning:
 *   - CRUD for vendor organisations
 *   - Assign / unassign subscription plan
 *   - Assign TTN Application + MQTT/LNS/CUPS configuration
 *   - Toggle integration enabled/disabled
 *   - View integration status
 *   - Change linked TTN application
 */

const bcrypt = require("bcryptjs");
const prisma = require("../config/database");
const { logAudit } = require("../utils/auditLogger");
const { reloadOrg, disconnectOrg } = require("../services/mqttManager");
const {
  createApplication,
  createApplicationApiKey,
  resolveApiCreds,
} = require("../services/ttnApplicationService");
const {
  TTN_API_BASE_URL,
  TTN_USER_API_KEY,
  TTN_API_KEY,
  TTN_GATEWAY_OWNER_TYPE,
  TTN_GATEWAY_OWNER_ID,
  TTN_MQTT_BROKER,
  TTN_FREQUENCY_PLAN_ID,
} = require("../config/env");

// ── helpers ───────────────────────────────────────────────────────────────────

const VENDOR_SELECT = {
  id: true,
  name: true,
  address: true,
  timezone: true,
  logo: true,
  vendorStatus: true,
  createdAt: true,
  updatedAt: true,
  subscriptionPlanId: true,
  subscriptionPlan: {
    select: {
      id: true,
      name: true,
      maxSites: true,
      maxGateways: true,
      maxDevices: true,
      maxUsers: true,
      features: true,
    },
  },
  vendorTTNConfig: {
    select: {
      id: true,
      ttnAppId: true,
      ttnApiBaseUrl: true,
      ttnMqttBroker: true,
      ttnMqttUsername: true,
      ttnFrequencyPlanId: true,
      ttnGatewayOwnerType: true,
      ttnGatewayOwnerId: true,
      lnsAddress: true,
      cupsAddress: true,
      integrationEnabled: true,
      connectionStatus: true,
      lastStatusAt: true,
      // Secrets (ttnApiKey, ttnGatewayApiKey, ttnMqttPassword, lnsKey, cupsKey)
      // are intentionally omitted from list views
    },
  },
  _count: {
    select: {
      users: true,
      devices: true,
      locations: true,
    },
  },
};

// Full select for single-vendor detail (includes masked secrets)
const VENDOR_DETAIL_SELECT = {
  ...VENDOR_SELECT,
  vendorTTNConfig: {
    select: {
      id: true,
      ttnAppId: true,
      ttnApiKey: true,
      ttnGatewayApiKey: true,
      ttnApiBaseUrl: true,
      ttnMqttBroker: true,
      ttnMqttUsername: true,
      ttnMqttPassword: true,
      ttnMqttTopic: true,
      ttnFrequencyPlanId: true,
      ttnGatewayOwnerType: true,
      ttnGatewayOwnerId: true,
      lnsAddress: true,
      lnsKey: true,
      cupsAddress: true,
      cupsKey: true,
      integrationEnabled: true,
      connectionStatus: true,
      lastStatusAt: true,
    },
  },
};

function maskSecret(val) {
  if (!val) return null;
  if (val.length <= 8) return "••••••••";
  return val.slice(0, 4) + "••••••••" + val.slice(-4);
}

function maskConfigSecrets(config) {
  if (!config) return config;
  return {
    ...config,
    ttnApiKey: maskSecret(config.ttnApiKey),
    ttnGatewayApiKey: maskSecret(config.ttnGatewayApiKey),
    ttnMqttPassword: maskSecret(config.ttnMqttPassword),
    lnsKey: maskSecret(config.lnsKey),
    cupsKey: maskSecret(config.cupsKey),
  };
}

// ── GET /api/vendors ──────────────────────────────────────────────────────────

async function getVendors(req, res) {
  try {
    const { status, planId, search, page = 1, limit = 50 } = req.query;

    const where = {};
    if (status) where.vendorStatus = status;
    if (planId) where.subscriptionPlanId = planId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    const [vendors, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: VENDOR_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.organization.count({ where }),
    ]);

    res.status(200).json({
      message: "Vendors fetched successfully",
      vendors,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("getVendors error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/vendors/:id ──────────────────────────────────────────────────────

async function getVendorById(req, res) {
  try {
    const { id } = req.params;

    const vendor = await prisma.organization.findUnique({
      where: { id },
      select: VENDOR_DETAIL_SELECT,
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // Mask secrets but send full structure
    const response = {
      ...vendor,
      vendorTTNConfig: maskConfigSecrets(vendor.vendorTTNConfig),
    };

    res.status(200).json({ message: "Vendor fetched successfully", vendor: response });
  } catch (error) {
    console.error("getVendorById error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── POST /api/vendors ─────────────────────────────────────────────────────────

async function createVendor(req, res) {
  try {
    const {
      name,
      address,
      timezone = "UTC",
      logo,
      subscriptionPlanId,
      // Initial vendor admin user (optional)
      adminEmail,
      adminName,
      adminPassword,
      // TTN auto-create options
      autoCreateTTNApp = true,   // default: always try to create TTN app
      ttnAppIdOverride,          // optional: custom TTN app ID
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Vendor name is required" });
    }

    // Verify plan exists if provided
    if (subscriptionPlanId) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } });
      if (!plan) return res.status(400).json({ message: "Subscription plan not found" });
    }

    // Create org + optional vendor admin user in a transaction
    const vendor = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: name.trim(),
          address: address?.trim() || null,
          timezone,
          logo: logo || null,
          vendorStatus: "active",
          subscriptionPlanId: subscriptionPlanId || null,
        },
        select: VENDOR_SELECT,
      });

      // Create the vendor admin account if credentials provided
      if (adminEmail && adminPassword) {
        const hashed = await bcrypt.hash(adminPassword, 10);
        await tx.user.create({
          data: {
            name: adminName || "Vendor Admin",
            email: adminEmail.trim().toLowerCase(),
            password: hashed,
            role: "vendor_admin",
            organizationId: org.id,
            active: true,
          },
        });
      }

      // Auto-create the Settings record for the vendor
      await tx.settings.create({
        data: { organizationId: org.id },
      });

      return org;
    });

    // ── Auto-create TTN Application ──────────────────────────────────────────
    let ttnResult = null;
    let ttnError  = null;

    if (autoCreateTTNApp) {
      try {
        // Use TTN_USER_API_KEY (personal API key with RIGHT_APPLICATION_CREATE)
        // Falls back to TTN_API_KEY if not set — but that may lack app-create rights
        const adminApiKey = TTN_USER_API_KEY || TTN_API_KEY;
        const clusterHost = (TTN_API_BASE_URL || `https://${TTN_MQTT_BROKER || "eu1.cloud.thethings.network"}`)
          .replace(/^https?:\/\//, "").replace(/\/$/, "");
        const apiBaseUrl = `https://${clusterHost}`;

        if (!adminApiKey) {
          throw new Error("TTN_USER_API_KEY is not set in .env. Create a Personal API Key in TTN Console with RIGHT_APPLICATION_CREATE right.");
        }
        if (!TTN_GATEWAY_OWNER_ID) {
          throw new Error("TTN_GATEWAY_OWNER_ID is not set in .env. Set it to your TTN username.");
        }

        // Build a safe TTN app ID from the vendor name
        const suffix   = vendor.id.slice(-6).toLowerCase();
        const nameSlug = name.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 25);
        const ttnAppId = ttnAppIdOverride
          ? String(ttnAppIdOverride).trim().toLowerCase()
          : `${nameSlug}-${suffix}`;

        console.log(`[Vendor] Creating TTN app "${ttnAppId}" for vendor "${name}" under user "${TTN_GATEWAY_OWNER_ID}" at ${apiBaseUrl}`);

        // 1. Create the TTN Application
        await createApplication({
          applicationId: ttnAppId,
          name:          name.trim(),
          description:   `Smart Restroom — ${name.trim()}`,
          apiKey:        adminApiKey,
          apiBaseUrl,
          ownerType:     TTN_GATEWAY_OWNER_TYPE || "user",
          ownerId:       TTN_GATEWAY_OWNER_ID,
        });

        // 2. Generate an API key for this new application
        //    Rights: read/write devices + read traffic (for MQTT) + write downlinks
        const appApiKey = await createApplicationApiKey({
          applicationId: ttnAppId,
          keyName:       "SRFS Device & Traffic Key",
          rights: [
            "RIGHT_APPLICATION_DEVICES_WRITE",
            "RIGHT_APPLICATION_DEVICES_WRITE_KEYS",
            "RIGHT_APPLICATION_DEVICES_READ",
            "RIGHT_APPLICATION_TRAFFIC_READ",
            "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
            "RIGHT_APPLICATION_TRAFFIC_UP_WRITE",
            "RIGHT_APPLICATION_SETTINGS_BASIC",
          ],
          apiKey:    adminApiKey,
          apiBaseUrl,
        });

        if (!appApiKey) {
          throw new Error("TTN returned empty API key — check that the admin key has sufficient rights.");
        }

        // 3. Save TTN config to VendorTTNConfig + mirror to Settings
        const mqttUsername = `${ttnAppId}@ttn`;
        const mqttTopic    = `v3/${mqttUsername}/devices/+/up`;

        const configData = {
          ttnAppId,
          ttnApiKey:           appApiKey,
          ttnApiBaseUrl:       apiBaseUrl,
          ttnMqttBroker:       clusterHost,
          ttnMqttUsername:     mqttUsername,
          ttnMqttPassword:     appApiKey,   // API key doubles as MQTT password on TTN v3
          ttnMqttTopic:        mqttTopic,
          ttnFrequencyPlanId:  TTN_FREQUENCY_PLAN_ID || "IN_865_867",
          ttnGatewayOwnerType: TTN_GATEWAY_OWNER_TYPE || "user",
          ttnGatewayOwnerId:   TTN_GATEWAY_OWNER_ID || "",
          integrationEnabled:  true,
        };

        await prisma.vendorTTNConfig.create({
          data: { organizationId: vendor.id, ...configData },
        });

        // Mirror to legacy Settings table so mqttManager can pick it up
        await prisma.settings.update({
          where: { organizationId: vendor.id },
          data: {
            ttnAppId,
            ttnApiKey:           appApiKey,
            ttnMqttBroker:       clusterHost,
            ttnMqttUsername:     mqttUsername,
            ttnMqttPassword:     appApiKey,
            ttnMqttTopic:        mqttTopic,
            ttnFrequencyPlanId:  TTN_FREQUENCY_PLAN_ID || "IN_865_867",
            ttnGatewayOwnerType: TTN_GATEWAY_OWNER_TYPE || "user",
            ttnGatewayOwnerId:   TTN_GATEWAY_OWNER_ID || "",
          },
        });

        // Start MQTT connection for this vendor immediately
        try { await reloadOrg(vendor.id); } catch (_) {}

        ttnResult = { ttnAppId, mqttUsername, mqttTopic, clusterHost };
        console.log(`[Vendor] ✓ TTN app "${ttnAppId}" created and configured for vendor "${name}"`);
      } catch (err) {
        ttnError = err.message;
        console.error(`[Vendor] ✗ TTN auto-create failed for vendor "${name}": ${err.message}`);
      }
    }

    await logAudit(req, {
      module: "Vendor",
      action: "CREATE",
      description: `Created vendor "${vendor.name}" (${vendor.id})${subscriptionPlanId ? ` with plan ${subscriptionPlanId}` : ""}${ttnResult ? ` — TTN app: ${ttnResult.ttnAppId}` : ""}`,
    });

    res.status(201).json({
      message: "Vendor created successfully",
      vendor,
      ttn: ttnResult
        ? { success: true, ...ttnResult }
        : { success: false, error: ttnError || "TTN auto-create skipped" },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "A vendor with that name or admin email already exists" });
    }
    console.error("createVendor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PUT /api/vendors/:id ──────────────────────────────────────────────────────

async function updateVendor(req, res) {
  try {
    const { id } = req.params;
    const { name, address, timezone, logo, vendorStatus, subscriptionPlanId } = req.body;

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Vendor not found" });

    if (subscriptionPlanId !== undefined && subscriptionPlanId !== null) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } });
      if (!plan) return res.status(400).json({ message: "Subscription plan not found" });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (address !== undefined) data.address = address?.trim() || null;
    if (timezone !== undefined) data.timezone = timezone;
    if (logo !== undefined) data.logo = logo;
    if (vendorStatus !== undefined) data.vendorStatus = vendorStatus;
    if (subscriptionPlanId !== undefined) data.subscriptionPlanId = subscriptionPlanId;

    const vendor = await prisma.organization.update({
      where: { id },
      data,
      select: VENDOR_SELECT,
    });

    await logAudit(req, {
      module: "Vendor",
      action: "UPDATE",
      description: `Updated vendor "${vendor.name}" (${id})`,
    });

    res.status(200).json({ message: "Vendor updated successfully", vendor });
  } catch (error) {
    console.error("updateVendor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── DELETE /api/vendors/:id ───────────────────────────────────────────────────

async function deleteVendor(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, vendorStatus: true },
    });
    if (!existing) return res.status(404).json({ message: "Vendor not found" });

    // Soft-delete: set vendorStatus = suspended rather than destroying data
    await prisma.organization.update({
      where: { id },
      data: { vendorStatus: "suspended" },
    });

    // Disconnect MQTT if active
    try { disconnectOrg(id); } catch (_) {}

    await logAudit(req, {
      module: "Vendor",
      action: "SUSPEND",
      description: `Suspended vendor "${existing.name}" (${id})`,
    });

    res.status(200).json({ message: "Vendor suspended successfully" });
  } catch (error) {
    console.error("deleteVendor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PUT /api/vendors/:id/ttn-config ──────────────────────────────────────────
// Assign or update TTN Application + MQTT/LNS/CUPS config for a vendor

async function updateVendorTTNConfig(req, res) {
  try {
    const { id } = req.params;
    const {
      ttnAppId,
      ttnApiKey,
      ttnGatewayApiKey,
      ttnApiBaseUrl,
      ttnMqttBroker,
      ttnMqttUsername,
      ttnMqttPassword,
      ttnMqttTopic,
      ttnFrequencyPlanId,
      ttnGatewayOwnerType,
      ttnGatewayOwnerId,
      lnsAddress,
      lnsKey,
      cupsAddress,
      cupsKey,
      integrationEnabled,
    } = req.body;

    const vendor = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    // Build update payload — only include fields that were actually sent
    const configData = {};
    if (ttnAppId !== undefined)            configData.ttnAppId = ttnAppId;
    if (ttnApiKey !== undefined)           configData.ttnApiKey = ttnApiKey;
    if (ttnGatewayApiKey !== undefined)    configData.ttnGatewayApiKey = ttnGatewayApiKey;
    if (ttnApiBaseUrl !== undefined)       configData.ttnApiBaseUrl = ttnApiBaseUrl;
    if (ttnMqttBroker !== undefined)       configData.ttnMqttBroker = ttnMqttBroker;
    if (ttnMqttUsername !== undefined)     configData.ttnMqttUsername = ttnMqttUsername;
    if (ttnMqttPassword !== undefined)     configData.ttnMqttPassword = ttnMqttPassword;
    if (ttnMqttTopic !== undefined)        configData.ttnMqttTopic = ttnMqttTopic;
    if (ttnFrequencyPlanId !== undefined)  configData.ttnFrequencyPlanId = ttnFrequencyPlanId;
    if (ttnGatewayOwnerType !== undefined) configData.ttnGatewayOwnerType = ttnGatewayOwnerType;
    if (ttnGatewayOwnerId !== undefined)   configData.ttnGatewayOwnerId = ttnGatewayOwnerId;
    if (lnsAddress !== undefined)          configData.lnsAddress = lnsAddress;
    if (lnsKey !== undefined)              configData.lnsKey = lnsKey;
    if (cupsAddress !== undefined)         configData.cupsAddress = cupsAddress;
    if (cupsKey !== undefined)             configData.cupsKey = cupsKey;
    if (integrationEnabled !== undefined)  configData.integrationEnabled = integrationEnabled;

    const ttnConfig = await prisma.vendorTTNConfig.upsert({
      where: { organizationId: id },
      update: configData,
      create: { organizationId: id, ...configData },
    });

    // Also mirror key fields into the legacy Settings table so mqttManager
    // can still discover per-org credentials at startup
    const settingsMirror = {};
    if (ttnAppId !== undefined)        settingsMirror.ttnAppId = ttnAppId;
    if (ttnApiKey !== undefined)       settingsMirror.ttnApiKey = ttnApiKey;
    if (ttnGatewayApiKey !== undefined) settingsMirror.ttnGatewayApiKey = ttnGatewayApiKey;
    if (ttnMqttBroker !== undefined)   settingsMirror.ttnMqttBroker = ttnMqttBroker;
    if (ttnMqttUsername !== undefined) settingsMirror.ttnMqttUsername = ttnMqttUsername;
    if (ttnMqttPassword !== undefined) settingsMirror.ttnMqttPassword = ttnMqttPassword;
    if (ttnMqttTopic !== undefined)    settingsMirror.ttnMqttTopic = ttnMqttTopic;
    if (ttnFrequencyPlanId !== undefined) settingsMirror.ttnFrequencyPlanId = ttnFrequencyPlanId;
    if (ttnGatewayOwnerType !== undefined) settingsMirror.ttnGatewayOwnerType = ttnGatewayOwnerType;
    if (ttnGatewayOwnerId !== undefined) settingsMirror.ttnGatewayOwnerId = ttnGatewayOwnerId;

    if (Object.keys(settingsMirror).length > 0) {
      await prisma.settings.upsert({
        where: { organizationId: id },
        update: settingsMirror,
        create: { organizationId: id, ...settingsMirror },
      });
    }

    // Hot-reload MQTT connection for this vendor
    if (integrationEnabled !== false) {
      try { await reloadOrg(id); } catch (_) {}
    } else if (integrationEnabled === false) {
      try { disconnectOrg(id); } catch (_) {}
    }

    await logAudit(req, {
      module: "VendorTTNConfig",
      action: "UPDATE",
      description: `Updated TTN/MQTT config for vendor "${vendor.name}" (${id}) — appId: ${ttnAppId || "(unchanged)"}`,
    });

    res.status(200).json({
      message: "Vendor TTN configuration updated successfully",
      ttnConfig: maskConfigSecrets(ttnConfig),
    });
  } catch (error) {
    console.error("updateVendorTTNConfig error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/vendors/:id/ttn-config ──────────────────────────────────────────

async function getVendorTTNConfig(req, res) {
  try {
    const { id } = req.params;

    const vendor = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, vendorTTNConfig: true },
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    res.status(200).json({
      message: "TTN config fetched successfully",
      ttnConfig: maskConfigSecrets(vendor.vendorTTNConfig),
    });
  } catch (error) {
    console.error("getVendorTTNConfig error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PATCH /api/vendors/:id/toggle-integration ─────────────────────────────────

async function toggleIntegration(req, res) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: '"enabled" (boolean) is required' });
    }

    const vendor = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const ttnConfig = await prisma.vendorTTNConfig.upsert({
      where: { organizationId: id },
      update: { integrationEnabled: enabled },
      create: { organizationId: id, integrationEnabled: enabled },
    });

    if (enabled) {
      try { await reloadOrg(id); } catch (_) {}
    } else {
      try { disconnectOrg(id); } catch (_) {}
    }

    await logAudit(req, {
      module: "VendorTTNConfig",
      action: enabled ? "ENABLE_INTEGRATION" : "DISABLE_INTEGRATION",
      description: `${enabled ? "Enabled" : "Disabled"} TTN/MQTT integration for vendor "${vendor.name}" (${id})`,
    });

    res.status(200).json({
      message: `Integration ${enabled ? "enabled" : "disabled"} successfully`,
      integrationEnabled: ttnConfig.integrationEnabled,
    });
  } catch (error) {
    console.error("toggleIntegration error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/vendors/:id/integration-status ───────────────────────────────────

async function getIntegrationStatus(req, res) {
  try {
    const { id } = req.params;

    const vendor = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        vendorStatus: true,
        subscriptionPlan: { select: { id: true, name: true } },
        vendorTTNConfig: {
          select: {
            ttnAppId: true,
            ttnMqttBroker: true,
            ttnMqttUsername: true,
            integrationEnabled: true,
            connectionStatus: true,
            lastStatusAt: true,
          },
        },
      },
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    // Check live MQTT client map for real-time status
    const { getClients } = require("../services/mqttManager");
    const clients = getClients();
    const liveConnected = clients.has(id) && clients.get(id).connected;

    // Update connection status in DB if changed
    const currentStatus = liveConnected ? "connected" : (vendor.vendorTTNConfig?.integrationEnabled ? "disconnected" : "disabled");
    if (vendor.vendorTTNConfig && vendor.vendorTTNConfig.connectionStatus !== currentStatus) {
      await prisma.vendorTTNConfig.update({
        where: { organizationId: id },
        data: { connectionStatus: currentStatus, lastStatusAt: new Date() },
      });
    }

    res.status(200).json({
      message: "Integration status fetched successfully",
      status: {
        vendorId: id,
        vendorName: vendor.name,
        vendorStatus: vendor.vendorStatus,
        subscriptionPlan: vendor.subscriptionPlan,
        ttnAppId: vendor.vendorTTNConfig?.ttnAppId || null,
        mqttBroker: vendor.vendorTTNConfig?.ttnMqttBroker || null,
        mqttUsername: vendor.vendorTTNConfig?.ttnMqttUsername || null,
        integrationEnabled: vendor.vendorTTNConfig?.integrationEnabled ?? false,
        connectionStatus: currentStatus,
        lastStatusAt: vendor.vendorTTNConfig?.lastStatusAt || null,
        liveConnected,
      },
    });
  } catch (error) {
    console.error("getIntegrationStatus error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── PUT /api/vendors/:id/assign-plan ─────────────────────────────────────────

async function assignSubscriptionPlan(req, res) {
  try {
    const { id } = req.params;
    const { subscriptionPlanId } = req.body;

    const vendor = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    if (subscriptionPlanId) {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscriptionPlanId } });
      if (!plan) return res.status(400).json({ message: "Subscription plan not found" });
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { subscriptionPlanId: subscriptionPlanId || null },
      select: VENDOR_SELECT,
    });

    await logAudit(req, {
      module: "Vendor",
      action: "ASSIGN_PLAN",
      description: `Assigned plan ${subscriptionPlanId || "(none)"} to vendor "${vendor.name}" (${id})`,
    });

    res.status(200).json({ message: "Subscription plan assigned successfully", vendor: updated });
  } catch (error) {
    console.error("assignSubscriptionPlan error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── GET /api/vendors/:id/resource-usage ──────────────────────────────────────

async function getResourceUsage(req, res) {
  try {
    const { id } = req.params;

    const vendor = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subscriptionPlan: {
          select: { maxSites: true, maxGateways: true, maxDevices: true, maxUsers: true, features: true },
        },
        _count: {
          select: { locations: true, devices: true, users: true },
        },
      },
    });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const [gatewayCount] = await Promise.all([
      prisma.gateway.count({ where: { organizationId: id } }),
    ]);

    const plan = vendor.subscriptionPlan;
    res.status(200).json({
      message: "Resource usage fetched successfully",
      usage: {
        vendorId: id,
        vendorName: vendor.name,
        sites:    { used: vendor._count.locations, limit: plan?.maxSites    ?? null },
        gateways: { used: gatewayCount,             limit: plan?.maxGateways ?? null },
        devices:  { used: vendor._count.devices,    limit: plan?.maxDevices  ?? null },
        users:    { used: vendor._count.users,       limit: plan?.maxUsers    ?? null },
        features: plan?.features ? JSON.parse(plan.features) : [],
      },
    });
  } catch (error) {
    console.error("getResourceUsage error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ── POST /api/vendors/:id/test-ttn-connection ─────────────────────────────────
// Tests MQTT connection using the vendor's saved credentials from DB

async function testVendorTTNConnection(req, res) {
  try {
    const { id } = req.params;

    const cfg = await prisma.vendorTTNConfig.findUnique({
      where: { organizationId: id },
      select: { ttnMqttBroker: true, ttnMqttUsername: true, ttnMqttPassword: true },
    });

    if (!cfg || !cfg.ttnMqttBroker || !cfg.ttnMqttUsername || !cfg.ttnMqttPassword) {
      return res.status(400).json({ message: "Vendor has no saved MQTT credentials. Create the vendor first to auto-generate them." });
    }

    const mqtt = require("mqtt");
    const result = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        try { client.end(true); } catch (_) {}
        resolve({ success: false, error: "Connection timed out (10s)" });
      }, 10000);

      const client = mqtt.connect(`mqtts://${cfg.ttnMqttBroker}:8883`, {
        clientId: `srfs-test-${Date.now()}`,
        username: cfg.ttnMqttUsername,
        password: cfg.ttnMqttPassword,
        reconnectPeriod: 0,
      });

      client.on("connect", () => {
        clearTimeout(timeout);
        try { client.end(true); } catch (_) {}
        resolve({ success: true });
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        try { client.end(true); } catch (_) {}
        resolve({ success: false, error: err.message });
      });
    });

    if (result.success) {
      return res.status(200).json({ message: "TTN connection successful" });
    } else {
      return res.status(400).json({ message: "TTN connection failed", error: result.error });
    }
  } catch (error) {
    console.error("testVendorTTNConnection error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Regenerate the TTN application API key for a vendor with the full set of
 * required rights including RIGHT_APPLICATION_TRAFFIC_UP_WRITE (needed for simulate).
 * Saves the new key to VendorTTNConfig and restarts the org's MQTT connection.
 */
async function regenerateVendorApiKey(req, res) {
  try {
    const { id } = req.params;
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { vendorTTNConfig: true },
    });
    if (!org) return res.status(404).json({ message: "Vendor not found" });

    const cfg = org.vendorTTNConfig;
    if (!cfg?.ttnAppId) {
      return res.status(400).json({ message: "This vendor has no TTN application configured. Create the vendor's TTN app first." });
    }

    // Use the admin key to create a new app-level key
    const adminApiKey = TTN_USER_API_KEY || TTN_API_KEY;
    const apiBaseUrl  = (cfg.ttnApiBaseUrl || TTN_API_BASE_URL || "https://eu1.cloud.thethings.network").replace(/\/$/, "");

    if (!adminApiKey) {
      return res.status(500).json({ message: "TTN_USER_API_KEY is not configured in .env." });
    }

    const newApiKey = await createApplicationApiKey({
      applicationId: cfg.ttnAppId,
      keyName: `SRFS Device & Traffic Key (regenerated ${new Date().toISOString().slice(0, 10)})`,
      rights: [
        "RIGHT_APPLICATION_DEVICES_WRITE",
        "RIGHT_APPLICATION_DEVICES_WRITE_KEYS",
        "RIGHT_APPLICATION_DEVICES_READ",
        "RIGHT_APPLICATION_TRAFFIC_READ",
        "RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE",
        "RIGHT_APPLICATION_TRAFFIC_UP_WRITE",
        "RIGHT_APPLICATION_SETTINGS_BASIC",
      ],
      apiKey: adminApiKey,
      apiBaseUrl,
    });

    if (!newApiKey) {
      return res.status(500).json({ message: "TTN returned an empty API key. Check that TTN_USER_API_KEY has sufficient rights." });
    }

    // Save new key — also update ttnMqttPassword since it doubles as MQTT password on TTN v3
    await prisma.vendorTTNConfig.update({
      where: { organizationId: id },
      data: { ttnApiKey: newApiKey, ttnMqttPassword: newApiKey },
    });
    // Mirror to legacy Settings table
    await prisma.settings.updateMany({
      where: { organizationId: id },
      data: { ttnApiKey: newApiKey, ttnMqttPassword: newApiKey },
    });

    // Reload MQTT connection with the new password
    const { reloadOrg } = require("../services/mqttManager");
    await reloadOrg(id);

    res.status(200).json({ message: "API key regenerated and MQTT connection reloaded successfully." });
  } catch (err) {
    console.error("regenerateVendorApiKey error:", err);
    res.status(500).json({ message: err.message || "Internal server error" });
  }
}

module.exports = {
  getVendors, getVendorById, createVendor, updateVendor, deleteVendor,
  updateVendorTTNConfig, getVendorTTNConfig, toggleIntegration,
  getIntegrationStatus, assignSubscriptionPlan, getResourceUsage,
  testVendorTTNConnection, regenerateVendorApiKey,
};
