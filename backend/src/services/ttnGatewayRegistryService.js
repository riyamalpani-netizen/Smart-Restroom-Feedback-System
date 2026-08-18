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
      console.log(`[TTN] Gateway updated: ${resolvedGatewayId}`);
      return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan };
    }

    const updateStatus = updateResponse.status;
    const updateText = await updateResponse.text();

    if (updateStatus === 403) {
      console.warn(`[TTN] Gateway ${resolvedGatewayId} already exists but cannot be updated (403). Treating as already registered.`);
      return { gatewayId: resolvedGatewayId, gatewayEui: gEui, clusterHost, frequencyPlanId: resolvedFrequencyPlan };
    }

    throw new Error(`TTN gateway registration failed: PUT ${updateUrl} failed (${updateStatus}): ${updateText}`);
  }

  throw new Error(`TTN gateway registration failed: POST ${createUrl} failed (${createResponse.status}): ${createText}`);
}

async function deleteGatewayFromTTN({ gatewayEui, gatewayId }) {
  const { apiBaseUrl, apiKey } = getConfiguration();
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

module.exports = { registerGatewayInTTN, deleteGatewayFromTTN };