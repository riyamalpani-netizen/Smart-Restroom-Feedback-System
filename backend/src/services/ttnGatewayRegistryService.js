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

function getConfiguration() {
  const apiBaseUrl = TTN_API_BASE_URL || (TTN_MQTT_BROKER ? `https://${TTN_MQTT_BROKER}` : null);
  const apiKey = TTN_GATEWAY_API_KEY || TTN_API_KEY || TTN_MQTT_PASSWORD;
  const ownerType = TTN_GATEWAY_OWNER_TYPE;
  const ownerId = TTN_GATEWAY_OWNER_ID;

  if (!apiBaseUrl || !apiKey || !TTN_FREQUENCY_PLAN_ID || !ownerType || !ownerId) {
    throw new Error(
      "TTN gateway registration is not configured. Set TTN_API_BASE_URL, TTN_GATEWAY_API_KEY, TTN_FREQUENCY_PLAN_ID, TTN_GATEWAY_OWNER_TYPE, and TTN_GATEWAY_OWNER_ID."
    );
  }
  if (!["user", "organization"].includes(ownerType)) {
    throw new Error('TTN_GATEWAY_OWNER_TYPE must be "user" or "organization"');
  }

  const clusterHost = apiBaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), apiKey, clusterHost, ownerType, ownerId };
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

async function registerGatewayInTTN({ gatewayEui, gatewayId, frequencyPlanId, latitude, longitude, description }) {
  const { apiBaseUrl, apiKey, clusterHost, ownerType, ownerId } = getConfiguration();
  const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
  const resolvedGatewayId = makeGatewayId(gEui, gatewayId);
  const resolvedFrequencyPlan = frequencyPlanId || TTN_FREQUENCY_PLAN_ID;

  const gatewayBody = {
    ids: { gateway_id: resolvedGatewayId, eui: gEui },
    gateway_server_address: clusterHost,
    frequency_plan_id: resolvedFrequencyPlan,
    ...(description ? { description } : {}),
    ...(latitude !== undefined && longitude !== undefined
      ? { antenna: { location: { latitude, longitude } } }
      : {}),
  };

  const ownerSegment = ownerType === "organization" ? "organizations" : "users";
  const createUrl = `${apiBaseUrl}/api/v3/${ownerSegment}/${encodeURIComponent(ownerId)}/gateways`;
  const updateUrl = `${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(resolvedGatewayId)}`;

  try {
    await ttnRequest(createUrl, apiKey, "POST", { gateway: gatewayBody });
  } catch (error) {
    if (error.message.includes("409") || error.message.includes("already exists")) {
      await ttnRequest(updateUrl, apiKey, "PUT", {
        gateway: gatewayBody,
        field_mask: {
          paths: [
            "gateway_server_address",
            "frequency_plan_id",
            ...(description ? ["description"] : []),
            ...(latitude !== undefined && longitude !== undefined
              ? ["antenna.location.latitude", "antenna.location.longitude"]
              : []),
          ],
        },
      });
    } else {
      throw new Error(`TTN gateway registration failed: ${error.message}`);
    }
  }

  return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan };
}

async function deleteGatewayFromTTN({ gatewayEui, gatewayId }) {
  const { apiBaseUrl, apiKey } = getConfiguration();
  const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
  const resolvedGatewayId = makeGatewayId(gEui, gatewayId);
  await ttnRequest(`${apiBaseUrl}/api/v3/gateways/${encodeURIComponent(resolvedGatewayId)}`, apiKey, "DELETE");
  return { gatewayId: resolvedGatewayId, gatewayEui: gEui };
}

module.exports = { registerGatewayInTTN, deleteGatewayFromTTN };
