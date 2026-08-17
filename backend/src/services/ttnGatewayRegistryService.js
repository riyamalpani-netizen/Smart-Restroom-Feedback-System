const {
  TTN_API_BASE_URL,
  TTN_APPLICATION_ID,
  TTN_API_KEY,
  TTN_FREQUENCY_PLAN_ID,
  TTN_MQTT_BROKER,
  TTN_MQTT_USERNAME,
  TTN_MQTT_PASSWORD,
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
  const applicationId = TTN_APPLICATION_ID || String(TTN_MQTT_USERNAME || "").split("@")[0];
  const apiKey = TTN_API_KEY || TTN_MQTT_PASSWORD;

  if (!apiBaseUrl || !applicationId || !apiKey || !TTN_FREQUENCY_PLAN_ID) {
    throw new Error("TTN gateway registration is not configured. Set TTN_FREQUENCY_PLAN_ID and TTN_API_BASE_URL, TTN_APPLICATION_ID, and TTN_API_KEY.");
  }

  const clusterHost = apiBaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), applicationId, apiKey, clusterHost };
}

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
    const message = text ? `${method} ${url} failed (${response.status}): ${text}` : `${method} ${url} failed (${response.status})`;
    throw new Error(message);
  }

  return response.status === 204 ? null : response.json();
}

/**
 * A TTN v3 gateway is registered in two steps:
 *   1. Identity Server - gateway identity + gateway server address
 *   2. Optional update with frequency plan and location
 */
async function registerGatewayInTTN({ gatewayEui, gatewayId, frequencyPlanId, latitude, longitude, description }) {
  const { apiBaseUrl, applicationId, apiKey, clusterHost } = getConfiguration();

  const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
  const resolvedGatewayId = makeGatewayId(gEui, gatewayId);
  const resolvedFrequencyPlan = frequencyPlanId || TTN_FREQUENCY_PLAN_ID || "AS_923";

  const ids = { gateway_id: resolvedGatewayId, eui: gEui };

  const createdSteps = [];

  try {
    await ttnRequest(
      `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/gateways`,
      apiKey,
      "POST",
      {
        gateway: {
          ids,
          gateway_server_address: clusterHost,
          frequency_plan_id: resolvedFrequencyPlan,
          ...(description ? { description } : {}),
          ...(latitude !== undefined && longitude !== undefined ? { location: { latitude, longitude } } : {}),
        },
        field_mask: {
          paths: [
            "gateway_server_address",
            "frequency_plan_id",
            "ids.eui",
            "ids.gateway_id",
            ...(description ? ["description"] : []),
            ...(latitude !== undefined && longitude !== undefined ? ["location.latitude", "location.longitude"] : []),
          ],
        },
      },
    );
    createdSteps.push("is");

    await ttnRequest(
      `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/gateways/${encodeURIComponent(resolvedGatewayId)}`,
      apiKey,
      "PUT",
      {
        gateway: {
          ids,
          gateway_server_address: clusterHost,
          frequency_plan_id: resolvedFrequencyPlan,
          ...(description ? { description } : {}),
          ...(latitude !== undefined && longitude !== undefined ? { location: { latitude, longitude } } : {}),
        },
        field_mask: {
          paths: [
            "gateway_server_address",
            "frequency_plan_id",
            "ids.eui",
            "ids.gateway_id",
            ...(description ? ["description"] : []),
            ...(latitude !== undefined && longitude !== undefined ? ["location.latitude", "location.longitude"] : []),
          ],
        },
      },
    );
    createdSteps.push("update");
  } catch (error) {
    try {
      await ttnRequest(
        `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/gateways/${encodeURIComponent(resolvedGatewayId)}`,
        apiKey,
        "DELETE",
      );
    } catch (cleanupError) {
      console.error("TTN gateway cleanup after failed registration also failed:", cleanupError.message);
    }
    throw new Error(`TTN gateway registration failed at step "${createdSteps[createdSteps.length - 1] || "is"}": ${error.message}`);
  }

  return { applicationId, gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan };
}

async function deleteGatewayFromTTN({ gatewayEui, gatewayId }) {
  const { apiBaseUrl, applicationId, apiKey } = getConfiguration();
  const gEui = normalizeHex(gatewayEui, 16, "Gateway EUI");
  const resolvedGatewayId = makeGatewayId(gEui, gatewayId);

  await ttnRequest(
    `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/gateways/${encodeURIComponent(resolvedGatewayId)}`,
    apiKey,
    "DELETE",
  );

  return { applicationId, gatewayId: resolvedGatewayId, gatewayEui: gEui };
}

module.exports = { registerGatewayInTTN, deleteGatewayFromTTN };
