const {
  TTN_API_BASE_URL,
  TTN_APPLICATION_ID,
  TTN_API_KEY,
} = require("../config/env");

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
};
