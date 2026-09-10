// const {
//   TTN_API_BASE_URL,
//   TTN_GATEWAY_API_KEY,
//   TTN_API_KEY,
//   TTN_MQTT_PASSWORD,
//   TTN_MQTT_BROKER,
//   TTN_FREQUENCY_PLAN_ID,
//   TTN_GATEWAY_OWNER_TYPE,
//   TTN_GATEWAY_OWNER_ID,
// } = require("../config/env");

// function normalizeHex(value, length, label) {
//   const normalized = String(value || "").trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//   if (normalized.length !== length) {
//     throw new Error(`${label} must be exactly ${length} hexadecimal characters`);
//   }
//   return normalized;
// }

// function makeGatewayId(gatewayEui, requestedId) {
//   const value = String(requestedId || `gateway-${gatewayEui.toLowerCase()}`).trim().toLowerCase();
//   if (!/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(value)) {
//     throw new Error("TTN gateway ID must use lowercase letters, numbers, and hyphens (3-36 characters)");
//   }
//   return value;
// }

// function getConfiguration() {
//   const apiBaseUrl = TTN_API_BASE_URL || (TTN_MQTT_BROKER ? `https://${TTN_MQTT_BROKER}` : null);
//   const apiKey = TTN_GATEWAY_API_KEY || TTN_API_KEY || TTN_MQTT_PASSWORD;
//   const ownerType = TTN_GATEWAY_OWNER_TYPE;
//   const ownerId = TTN_GATEWAY_OWNER_ID;

//   if (!apiBaseUrl || !apiKey || !TTN_FREQUENCY_PLAN_ID || !ownerType || !ownerId) {
//     throw new Error(
//       "TTN gateway registration is not configured. Set TTN_API_BASE_URL, TTN_GATEWAY_API_KEY, TTN_FREQUENCY_PLAN_ID, TTN_GATEWAY_OWNER_TYPE, and TTN_GATEWAY_OWNER_ID."
//     );
//   }
//   if (!["user", "organization"].includes(ownerType)) {
//     throw new Error('TTN_GATEWAY_OWNER_TYPE must be "user" or "organization"');
//   }

//   const clusterHost = apiBaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
//   return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), apiKey, clusterHost, ownerType, ownerId };
// }

// async function ttnRequest(url, apiKey, method, body) {
//   const response = await fetch(url, {
//     method,
//     headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//     body: body ? JSON.stringify(body) : undefined,
//   });
//   if (!response.ok) {
//     const text = await response.text();
//     throw new Error(`${method} ${url} failed (${response.status}): ${text}`);
//   }
//   return response.status === 204 ? null : response.json();
// }

// async function registerGatewayInTTN({ gatewayEui, gatewayId, frequencyPlanId, latitude, longitude, description }) {
//   const { apiBaseUrl, apiKey, clusterHost, ownerType, ownerId } = getConfiguration();
//   const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
//   const resolvedGatewayId = makeGatewayId(gEui, gatewayId);
//   const resolvedFrequencyPlan = frequencyPlanId || TTN_FREQUENCY_PLAN_ID;

//   const gatewayBody = {
//     ids: { gateway_id: resolvedGatewayId, eui: gEui },
//     gateway_server_address: clusterHost,
//     frequency_plan_id: resolvedFrequencyPlan,
//     ...(description ? { description } : {}),
//     ...(latitude !== undefined && longitude !== undefined
//       ? { antenna: { location: { latitude, longitude } } }
//       : {}),
//   };

//   const ownerSegment = ownerType === "organization" ? "organizations" : "users";
//   const createUrl = `${apiBaseUrl}/api/v3/${ownerSegment}/${encodeURIComponent(ownerId)}/gateways`;
//   const updateUrl = `${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(resolvedGatewayId)}`;

//   const createResponse = await fetch(createUrl, {
//     method: "POST",
//     headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//     body: JSON.stringify({ gateway: gatewayBody }),
//   });

//   if (createResponse.ok) {
//     console.log(`[TTN] Gateway created: ${resolvedGatewayId} under ${ownerSegment}/${ownerId}`);
//     return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan };
//   }

//   const createText = await createResponse.text();
//   if (createResponse.status === 409 || createText.includes("already exists")) {
//     const updateResponse = await fetch(updateUrl, {
//       method: "PUT",
//       headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
//       body: JSON.stringify({
//         gateway: gatewayBody,
//         field_mask: {
//           paths: [
//             "gateway_server_address",
//             "frequency_plan_id",
//             ...(description ? ["description"] : []),
//             ...(latitude !== undefined && longitude !== undefined ? ["antenna.location.latitude", "antenna.location.longitude"] : []),
//           ],
//         },
//       }),
//     });

//     if (!updateResponse.ok) {
//       const updateText = await updateResponse.text();
//       throw new Error(`TTN gateway registration failed: PUT ${updateUrl} failed (${updateResponse.status}): ${updateText}`);
//     }

//     console.log(`[TTN] Gateway updated: ${resolvedGatewayId}`);
//     return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan };
//   }

//   throw new Error(`TTN gateway registration failed: POST ${createUrl} failed (${createResponse.status}): ${createText}`);
// }

// async function deleteGatewayFromTTN({ gatewayEui, gatewayId }) {
//   const { apiBaseUrl, apiKey } = getConfiguration();
//   const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
//   const resolvedGatewayId = makeGatewayId(gEui, gatewayId);
  
//   try {
//     await ttnRequest(`${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(resolvedGatewayId)}`, apiKey, "DELETE");
//   } catch (error) {
//     if (error.message.includes("403") || error.message.includes("no_gateway_rights") || error.message.includes("404")) {
//       console.warn(`TTN gateway ${resolvedGatewayId} delete skipped: ${error.message}`);
//     } else {
//       throw new Error(`TTN gateway delete failed: ${error.message}`);
//     }
//   }
  
//   return { gatewayId: resolvedGatewayId, gatewayEui: gEui };
// }

// module.exports = { registerGatewayInTTN, deleteGatewayFromTTN };
const {
  TTN_API_BASE_URL,
  TTN_GATEWAY_API_KEY,
  TTN_API_KEY,
  TTN_MQTT_PASSWORD,
  TTN_MQTT_BROKER,
  TTN_FREQUENCY_PLAN_ID,
  TTN_GATEWAY_OWNER_TYPE,
  TTN_GATEWAY_OWNER_ID,
} = require("../config/env");
const prisma = require("../config/database");

function normalizeHex(value, length, label) {
  const normalized = String(value || "").trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (normalized.length !== length) {
    throw new Error(`${label} must be exactly ${length} hexadecimal characters`);
  }
  return normalized;
}

function makeGatewayId(gatewayEui, requestedId) {
  const value = String(requestedId || `gateway-${gatewayEui.toLowerCase()}`).trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(value)) {
    throw new Error("TTN gateway ID must use lowercase letters, numbers, and hyphens (3-36 characters)");
  }
  return value;
}

/**
 * Resolve TTN configuration from:
 *  1. Org-level settings (from DB) — takes priority when present
 *  2. Global env-var fallback
 *
 * @param {object|null} orgSettings  — a Settings DB row for the gateway's org, or null
 */
function getConfiguration(orgSettings) {
  // Org-level values override env vars when set
  const apiBaseUrl =
    orgSettings?.ttnApiBaseUrl ||
    (orgSettings?.ttnMqttBroker ? `https://${orgSettings.ttnMqttBroker}` : null) ||
    TTN_API_BASE_URL ||
    (TTN_MQTT_BROKER ? `https://${TTN_MQTT_BROKER}` : null);

  const apiKey =
    orgSettings?.ttnGatewayApiKey ||
    orgSettings?.ttnApiKey ||
    TTN_GATEWAY_API_KEY ||
    TTN_API_KEY ||
    TTN_MQTT_PASSWORD;

  const frequencyPlanId =
    orgSettings?.ttnFrequencyPlanId || TTN_FREQUENCY_PLAN_ID;

  const ownerType =
    orgSettings?.ttnGatewayOwnerType || TTN_GATEWAY_OWNER_TYPE;

  const ownerId =
    orgSettings?.ttnGatewayOwnerId || TTN_GATEWAY_OWNER_ID;

  if (!apiBaseUrl || !apiKey || !frequencyPlanId || !ownerType || !ownerId) {
    throw new Error(
      "TTN gateway registration is not configured. " +
      "Set TTN credentials in the Organisation Settings page (vendor admin) " +
      "or in the global .env file."
    );
  }
  if (!["user", "organization"].includes(ownerType)) {
    throw new Error('TTN_GATEWAY_OWNER_TYPE must be "user" or "organization"');
  }

  const clusterHost = apiBaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    apiKey,
    clusterHost,
    ownerType,
    ownerId,
    frequencyPlanId,
  };
}

/**
 * Load the vendor's TTN config from VendorTTNConfig (authoritative) then
 * fall back to the legacy Settings record.
 * Returns null if the org has no config record yet.
 */
async function getOrgSettings(organizationId) {
  if (!organizationId) return null;
  try {
    // VendorTTNConfig is the authoritative source (Super Admin managed)
    const vendorCfg = await prisma.vendorTTNConfig.findUnique({
      where: { organizationId },
      select: {
        ttnAppId: true, ttnApiKey: true, ttnGatewayApiKey: true, ttnApiBaseUrl: true,
        ttnMqttBroker: true, ttnFrequencyPlanId: true,
        ttnGatewayOwnerType: true, ttnGatewayOwnerId: true,
      },
    });
    if (vendorCfg?.ttnGatewayApiKey || vendorCfg?.ttnApiKey) {
      return {
        ttnApiBaseUrl: vendorCfg.ttnApiBaseUrl || (vendorCfg.ttnMqttBroker ? `https://${vendorCfg.ttnMqttBroker}` : null),
        ttnGatewayApiKey: vendorCfg.ttnGatewayApiKey,
        ttnApiKey: vendorCfg.ttnApiKey,
        ttnFrequencyPlanId: vendorCfg.ttnFrequencyPlanId,
        ttnGatewayOwnerType: vendorCfg.ttnGatewayOwnerType,
        ttnGatewayOwnerId: vendorCfg.ttnGatewayOwnerId,
        // expose broker for getConfiguration compat
        ttnMqttBroker: vendorCfg.ttnMqttBroker,
      };
    }
    // Fallback: legacy Settings table
    return await prisma.settings.findFirst({
      where: { organizationId },
      select: {
        ttnAppId: true, ttnApiKey: true, ttnGatewayApiKey: true,
        ttnMqttBroker: true, ttnFrequencyPlanId: true,
        ttnGatewayOwnerType: true, ttnGatewayOwnerId: true,
      },
    });
  } catch {
    return null;
  }
}

async function ttnRequest(url, apiKey, method, body) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${url} failed (${response.status}): ${text}`);
  }
  return response.status === 204 ? null : response.json();
}

async function registerGatewayInTTN({ gatewayEui, gatewayId, frequencyPlanId, latitude, longitude, description, organizationId }) {
  const orgSettings = await getOrgSettings(organizationId);
  const { apiBaseUrl, apiKey, clusterHost, ownerType, ownerId, frequencyPlanId: defaultFreqPlan } = getConfiguration(orgSettings);
  const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
  const resolvedGatewayId = makeGatewayId(gEui, gatewayId);
  const resolvedFrequencyPlan = frequencyPlanId || orgSettings?.ttnFrequencyPlanId || defaultFreqPlan;

  const gatewayBody = {
    ids: { gateway_id: resolvedGatewayId, eui: gEui },
    gateway_server_address: clusterHost,
    // Kept for older TTN clusters that still expect the singular field.
    frequency_plan_id: resolvedFrequencyPlan,
    // Current TTN v3 API expects an array here — sending both is harmless,
    // whichever field the server doesn't recognize is simply ignored.
    frequency_plan_ids: [resolvedFrequencyPlan],
    ...(description ? { description } : {}),
    ...(latitude !== undefined && longitude !== undefined
      ? { antennas: [{ location: { latitude, longitude, source: "SOURCE_REGISTRY" } }] }
      : {}),
  };

  const ownerSegment = ownerType === "organization" ? "organizations" : "users";
  const createUrl = `${apiBaseUrl}/api/v3/${ownerSegment}/${encodeURIComponent(ownerId)}/gateways`;
  const updateUrl = `${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(resolvedGatewayId)}`;

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ gateway: gatewayBody }),
  });

  if (createResponse.ok) {
    console.log(`[TTN] Gateway created: ${resolvedGatewayId} under ${ownerSegment}/${ownerId}`);
    return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan };
  }

  const createText = await createResponse.text();

  // 403 means the API key lacks gateway rights
  if (createResponse.status === 403) {
    throw new Error(
      `TTN API key does not have Gateway rights (403). ` +
      `Go to TTN Console → your account → API Keys → create a new key with "Write gateways" right, ` +
      `then set TTN_GATEWAY_API_KEY in your .env file.`
    );
  }

  if (createResponse.status === 409 || createText.includes("already exists")) {
    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        gateway: gatewayBody,
        field_mask: {
          paths: [
            "gateway_server_address",
            "frequency_plan_id",
            "frequency_plan_ids",
            ...(description ? ["description"] : []),
            ...(latitude !== undefined && longitude !== undefined ? ["antennas"] : []),
          ],
        },
      }),
    });

    if (updateResponse.ok) {
      console.log(`[TTN] Gateway updated: ${resolvedGatewayId}`)
      return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan }
    }

    const updateStatus = updateResponse.status
    const updateText = await updateResponse.text()

    // 403 on update means the gateway exists on TTN but belongs to someone else
    // or the key lacks update rights — still treat as registered since it exists
    if (updateStatus === 403) {
      console.warn(`[TTN] Gateway ${resolvedGatewayId} exists on TTN but cannot be updated (403) — treating as registered.`)
      return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan, ownedByUs: false }
    }

    throw new Error(`TTN gateway registration failed: PUT ${updateUrl} failed (${updateStatus}): ${updateText}`)
  }

  throw new Error(`TTN gateway registration failed: POST ${createUrl} failed (${createResponse.status}): ${createText}`);
}

async function deleteGatewayFromTTN({ gatewayEui, gatewayId, organizationId }) {
  const orgSettings = await getOrgSettings(organizationId);
  const { apiBaseUrl, apiKey } = getConfiguration(orgSettings);
  const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
  const resolvedGatewayId = makeGatewayId(gEui, gatewayId);

  try {
    await ttnRequest(`${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(resolvedGatewayId)}`, apiKey, "DELETE");
  } catch (error) {
    if (error.message.includes("403") || error.message.includes("no_gateway_rights") || error.message.includes("404")) {
      console.warn(`TTN gateway ${resolvedGatewayId} delete skipped: ${error.message}`);
    } else {
      throw new Error(`TTN gateway delete failed: ${error.message}`);
    }
  }

  return { gatewayId: resolvedGatewayId, gatewayEui: gEui };
}

async function createGatewayLnsKey(gatewayId, organizationId) {
  const orgSettings = await getOrgSettings(organizationId);
  const { apiBaseUrl, apiKey } = getConfiguration(orgSettings);
  const url = `${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(gatewayId)}/api-keys`;

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "LNS key",
      rights: ["RIGHT_GATEWAY_LINK"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TTN LNS key creation failed for gateway ${gatewayId} (${response.status}): ${text}`);
  }

  const data = await response.json();
  // data.key is the full NNSXS.… value — TTN only returns it once
  return data.key;
}

async function createGatewayCupsKey(gatewayId, organizationId) {
  const orgSettings = await getOrgSettings(organizationId);
  const { apiBaseUrl, apiKey } = getConfiguration(orgSettings);
  const url = `${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(gatewayId)}/api-keys`;

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "CUPS key",
      rights: ["RIGHT_GATEWAY_SETTINGS_BASIC", "RIGHT_GATEWAY_INFO"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TTN CUPS key creation failed for gateway ${gatewayId} (${response.status}): ${text}`);
  }

  const data = await response.json();
  // data.key is the full NNSXS.… value — TTN only returns it once
  return data.key;
}

module.exports = { registerGatewayInTTN, deleteGatewayFromTTN, createGatewayLnsKey, createGatewayCupsKey };