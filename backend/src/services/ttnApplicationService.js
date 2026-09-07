const {
  TTN_API_BASE_URL,
  TTN_APPLICATION_ID,
  TTN_API_KEY,
  TTN_USER_API_KEY,
  TTN_GATEWAY_OWNER_TYPE,
  TTN_GATEWAY_OWNER_ID,
} = require("../config/env");
const prisma = require("../config/database");

async function ttnRequest(url, apiKey, method, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TTN API ${method} ${url} failed (${response.status}): ${text}`);
  }

  return response.status === 204 ? null : response.json();
}

/**
 * Resolve TTN API credentials for an org.
 * Checks VendorTTNConfig first, then global env vars.
 */
async function resolveApiCreds(organizationId) {
  if (organizationId) {
    try {
      const cfg = await prisma.vendorTTNConfig.findUnique({
        where: { organizationId },
        select: { ttnApiKey: true, ttnApiBaseUrl: true, ttnMqttBroker: true },
      });
      if (cfg?.ttnApiKey) {
        const base = cfg.ttnApiBaseUrl || (cfg.ttnMqttBroker ? `https://${cfg.ttnMqttBroker}` : null) || TTN_API_BASE_URL;
        return { apiKey: cfg.ttnApiKey, apiBaseUrl: base?.replace(/\/$/, "") };
      }
    } catch { /* fall through */ }
  }
  return {
    apiKey: TTN_API_KEY,
    apiBaseUrl: (TTN_API_BASE_URL || "").replace(/\/$/, ""),
  };
}

/**
 * Create a new TTN Application under a user or organization.
 *
 * TTN v3 API:
 *   POST /api/v3/users/{user_id}/applications
 *   POST /api/v3/organizations/{org_id}/applications
 *
 * @param {object} opts
 * @param {string} opts.applicationId  - TTN app ID (lowercase, letters/numbers/hyphens)
 * @param {string} opts.name           - Human-readable name shown in TTN Console
 * @param {string} [opts.description]  - Optional description
 * @param {string} [opts.ownerId]      - TTN user/org ID that will own the app (falls back to env)
 * @param {string} [opts.ownerType]    - "user" | "organization" (falls back to env)
 * @param {string} [opts.apiKey]       - TTN API key with CreateApplications right
 * @param {string} [opts.apiBaseUrl]   - TTN cluster base URL
 */
async function createApplication({ applicationId, name, description, ownerId, ownerType, apiKey, apiBaseUrl }) {
  // Use user-level API key (RIGHT_APPLICATION_CREATE) — NOT an app-level key
  const resolvedApiKey = apiKey || TTN_USER_API_KEY || TTN_API_KEY;
  const resolvedBase   = (apiBaseUrl || TTN_API_BASE_URL || "").replace(/\/$/, "");
  const resolvedOwnerType = ownerType || TTN_GATEWAY_OWNER_TYPE || "user";
  const resolvedOwnerId   = ownerId   || TTN_GATEWAY_OWNER_ID;

  if (!resolvedApiKey) {
    throw new Error(
      "No TTN API key configured. Set TTN_USER_API_KEY in .env with RIGHT_APPLICATION_CREATE right " +
      "(go to TTN Console → your profile → Personal API Keys)."
    );
  }
  if (!resolvedBase) {
    throw new Error("TTN API base URL is required. Set TTN_API_BASE_URL in .env (e.g. https://eu1.cloud.thethings.network).");
  }
  if (!resolvedOwnerId) {
    throw new Error(
      "TTN owner ID is required. Set TTN_GATEWAY_OWNER_ID in .env to your TTN username or organisation ID."
    );
  }

  // Validate app ID format — TTN requires lowercase letters, numbers, hyphens, 3-36 chars
  const cleanId = String(applicationId).trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,34}[a-z0-9])?$/.test(cleanId)) {
    throw new Error(`TTN application ID "${cleanId}" is invalid. Use lowercase letters, numbers, and hyphens (3-36 characters).`);
  }

  const ownerSegment = resolvedOwnerType === "organization" ? "organizations" : "users";
  const url = `${resolvedBase}/api/v3/${ownerSegment}/${encodeURIComponent(resolvedOwnerId)}/applications`;

  const body = {
    application: {
      ids: { application_id: cleanId },
      name: name || cleanId,
      ...(description ? { description } : {}),
    },
  };

  const result = await ttnRequest(url, resolvedApiKey, "POST", body);
  console.log(`[TTN] Application created: ${cleanId} under ${ownerSegment}/${resolvedOwnerId}`);
  return {
    applicationId: result?.ids?.application_id || cleanId,
    name: result?.name || name,
    clusterHost: resolvedBase.replace(/^https?:\/\//, ""),
  };
}

/**
 * Create a TTN API key for an application with specific rights.
 * Used after createApplication to generate a traffic-read key for MQTT
 * and a write-devices key for device registration.
 *
 * @param {string} applicationId  - TTN application ID
 * @param {string} keyName        - Display name for the key
 * @param {string[]} rights       - Array of TTN right strings
 * @param {string} apiKey         - Admin TTN API key
 * @param {string} apiBaseUrl     - TTN cluster base URL
 */
async function createApplicationApiKey({ applicationId, keyName, rights, apiKey, apiBaseUrl }) {
  const resolvedApiKey = apiKey || TTN_API_KEY;
  const resolvedBase   = (apiBaseUrl || TTN_API_BASE_URL || "").replace(/\/$/, "");

  const url = `${resolvedBase}/api/v3/applications/${encodeURIComponent(applicationId)}/api-keys`;

  const result = await ttnRequest(url, resolvedApiKey, "POST", {
    name: keyName,
    rights,
  });

  // TTN returns the key value only once
  return result?.key || null;
}

/**
 * Delete a TTN application.
 */
async function deleteApplication({ applicationId, apiKey, apiBaseUrl }) {
  const resolvedApiKey = apiKey || TTN_API_KEY;
  const resolvedBase   = (apiBaseUrl || TTN_API_BASE_URL || "").replace(/\/$/, "");
  const url = `${resolvedBase}/api/v3/applications/${encodeURIComponent(applicationId)}`;
  await ttnRequest(url, resolvedApiKey, "DELETE");
  console.log(`[TTN] Application deleted: ${applicationId}`);
}

/**
 * Must exactly match the device_id convention used at registration time,
 * in deviceController.js createDevice():
 *   const resolvedTtnDeviceId = `device-${resolvedDeviceEui.toLowerCase()}`;
 * That value isn't stored in the DB, so it's re-derived here the same way
 * on every call. If that registration line ever changes, update this too.
 */
function toTtnDeviceId(deviceEui) {
  return `device-${deviceEui.toLowerCase()}`;
}

async function simulateUplink({ deviceEui, feedbackType, battery, signalStrength, applicationId, apiKey, apiBaseUrl }) {
  const resolvedApiBaseUrl = apiBaseUrl || TTN_API_BASE_URL;
  const resolvedAppId = applicationId || TTN_APPLICATION_ID;
  const resolvedApiKey = apiKey || TTN_API_KEY;

  if (!resolvedApiBaseUrl || !resolvedAppId || !resolvedApiKey) {
    throw new Error("TTN Application API is not configured. Set TTN_API_BASE_URL, TTN_APPLICATION_ID, and TTN_API_KEY.");
  }

  const normalizedEui = String(deviceEui || "").trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (normalizedEui.length !== 16) {
    throw new Error(`Device EUI must be exactly 16 hexadecimal characters, got: ${deviceEui}`);
  }

  const ttnDeviceId = toTtnDeviceId(normalizedEui);
  const url = `${resolvedApiBaseUrl.replace(/\/$/, "")}/api/v3/as/applications/${encodeURIComponent(resolvedAppId)}/devices/${encodeURIComponent(ttnDeviceId)}/up/simulate`;

  const payload = {
    uplink_message: {
      decoded_payload: {
        badge_id: normalizedEui,
        feedback_type: feedbackType,
        battery: battery ?? 100,
        signal_strength: signalStrength ?? -60,
      },
      f_port: 1,
      settings: {
        data_rate: {
          lora: {
            bandwidth: 125000,
            spreading_factor: 7,
          },
        },
        frequency: "868000000",
      },
    },
  };

  console.log(`[TTN] Simulating uplink -> ${url}`);
  const result = await ttnRequest(url, resolvedApiKey, "POST", payload);
  console.log(`[TTN] Simulate uplink accepted for device_id=${ttnDeviceId}`);
  return result;
}

module.exports = {
  simulateUplink,
  toTtnDeviceId,
  createApplication,
  createApplicationApiKey,
  deleteApplication,
  resolveApiCreds,
};
