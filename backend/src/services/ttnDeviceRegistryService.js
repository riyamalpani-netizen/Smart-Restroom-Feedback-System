// const {
//   TTN_API_BASE_URL,
//   TTN_APPLICATION_ID,
//   TTN_API_KEY,
//   TTN_DEFAULT_JOIN_EUI,
//   TTN_FREQUENCY_PLAN_ID,
//   TTN_LORAWAN_VERSION,
//   TTN_MQTT_BROKER,
//   TTN_MQTT_USERNAME,
//   TTN_MQTT_PASSWORD,
// } = require("../config/env");

// function normalizeHex(value, length, label) {
//   const normalized = String(value || "").trim().replace(/[^a-fA-F0-9]/g, "").toUpperCase();
//   if (normalized.length !== length) {
//     throw new Error(`${label} must be exactly ${length} hexadecimal characters`);
//   }
//   return normalized;
// }

// function makeDeviceId(deviceEui, requestedId) {
//   const value = String(requestedId || `restroom-${deviceEui.toLowerCase()}`).trim().toLowerCase();
//   if (!/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(value)) {
//     throw new Error("TTN device ID must use lowercase letters, numbers, and hyphens (3-36 characters)");
//   }
//   return value;
// }

// function getConfiguration() {
//   const apiBaseUrl = TTN_API_BASE_URL || (TTN_MQTT_BROKER ? `https://${TTN_MQTT_BROKER}` : null);
//   const applicationId = TTN_APPLICATION_ID || String(TTN_MQTT_USERNAME || "").split("@")[0];
//   const apiKey = TTN_API_KEY || TTN_MQTT_PASSWORD;

//   if (!apiBaseUrl || !applicationId || !apiKey || !TTN_FREQUENCY_PLAN_ID) {
//     throw new Error("TTN device registration is not configured. Set TTN_FREQUENCY_PLAN_ID and, if they cannot be derived from your MQTT settings, TTN_API_BASE_URL, TTN_APPLICATION_ID, and TTN_API_KEY.");
//   }

//   return { apiBaseUrl, applicationId, apiKey };
// }

// async function registerOtaaDevice({ deviceEui, deviceId, joinEui, appKey, lorawanVersion, lorawanPhyVersion }) {
//   const { apiBaseUrl, applicationId, apiKey } = getConfiguration();

//   const devEui = normalizeHex(deviceEui, 16, "Device EUI");
//   const resolvedJoinEui = normalizeHex(joinEui || TTN_DEFAULT_JOIN_EUI, 16, "Join EUI");
//   const resolvedAppKey = normalizeHex(appKey, 32, "App Key");
//   const resolvedDeviceId = makeDeviceId(devEui, deviceId);
//   const resolvedLorawanVersion = lorawanVersion || TTN_LORAWAN_VERSION || "MAC_V1_0_3";

//   const response = await fetch(
//     `${apiBaseUrl.replace(/\/$/, "")}/api/v3/applications/${encodeURIComponent(applicationId)}/devices`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${apiKey}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         end_device: {
//           ids: {
//             device_id: resolvedDeviceId,
//             dev_eui: devEui,
//             join_eui: resolvedJoinEui,
//           },
//           supports_join: true,
//           lorawan_version: resolvedLorawanVersion,
//           ...(lorawanPhyVersion ? { lorawan_phy_version: lorawanPhyVersion } : {}),
//           frequency_plan_id: TTN_FREQUENCY_PLAN_ID,
//           root_keys: { app_key: { key: resolvedAppKey } },
//         },
//       }),
//     },
//   );

//   if (!response.ok) {
//     const body = await response.text();
//     const message = body ? `TTN registration failed (${response.status}): ${body}` : `TTN registration failed (${response.status})`;
//     throw new Error(message);
//   }

//   return { applicationId, deviceId: resolvedDeviceId, deviceEui: devEui };
// }

// module.exports = { registerOtaaDevice };
const {
  TTN_API_BASE_URL,
  TTN_APPLICATION_ID,
  TTN_API_KEY,
  TTN_DEFAULT_JOIN_EUI,
  TTN_FREQUENCY_PLAN_ID,
  TTN_LORAWAN_VERSION,
  TTN_LORAWAN_PHY_VERSION,
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

function makeDeviceId(deviceEui, requestedId) {
  const value = String(requestedId || `restroom-${deviceEui.toLowerCase()}`).trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,34}[a-z0-9])?$/.test(value)) {
    throw new Error("TTN device ID must use lowercase letters, numbers, and hyphens (3-36 characters)");
  }
  return value;
}

function getConfiguration() {
  const apiBaseUrl = TTN_API_BASE_URL || (TTN_MQTT_BROKER ? `https://${TTN_MQTT_BROKER}` : null);
  const applicationId = TTN_APPLICATION_ID || String(TTN_MQTT_USERNAME || "").split("@")[0];
  const apiKey = TTN_API_KEY || TTN_MQTT_PASSWORD;

  if (!apiBaseUrl || !applicationId || !apiKey || !TTN_FREQUENCY_PLAN_ID) {
    throw new Error("TTN device registration is not configured. Set TTN_FREQUENCY_PLAN_ID and, if they cannot be derived from your MQTT settings, TTN_API_BASE_URL, TTN_APPLICATION_ID, and TTN_API_KEY.");
  }

  // The host (e.g. "eu1.cloud.thethings.network") that owns the NS/AS/JS for
  // this application. All four registrations below MUST point at this same
  // host, or the console/API will report the device as being on "a different
  // cluster" and it will never be able to join.
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

async function listTtnDevices(apiBaseUrl, applicationId, apiKey) {
  const devices = [];
  let url = `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/devices`;

  while (url) {
    const data = await ttnRequest(url, apiKey, "GET");
    const page = data?.end_devices || [];
    devices.push(...page);

    const next = data?.next;
    url = next || null;
  }

  return devices.map((item) => ({
    deviceId: item.ids?.device_id || null,
    devEui: (item.ids?.dev_eui || "").toUpperCase(),
    joinEui: (item.ids?.join_eui || "").toUpperCase(),
  }));
}

/**
 * A TTN v3 end device is stored across FOUR separate registries, each with
 * its own API call, and each call must be made in this order:
 *   1. Identity Server  - device identity + which cluster owns NS/AS/JS
 *   2. Join Server       - root keys (AppKey)
 *   3. Network Server    - LoRaWAN/MAC settings, frequency plan
 *   4. Application Server- payload formatters / app session
 *
 * Registering only step 1 (as the previous version of this function did)
 * creates a device that shows up in the device list but can never join the
 * network, and the Console will report a "different cluster" error because
 * network_server_address / application_server_address / join_server_address
 * were never set.
 */
async function registerOtaaDevice({ deviceEui, deviceId, joinEui, appKey, lorawanVersion, lorawanPhyVersion }) {
  const { apiBaseUrl, applicationId, apiKey, clusterHost } = getConfiguration();

  const devEui = normalizeHex(deviceEui, 16, "Device EUI");
  const resolvedJoinEui = normalizeHex(joinEui || TTN_DEFAULT_JOIN_EUI, 16, "Join EUI");
  const resolvedAppKey = normalizeHex(appKey, 32, "App Key");
  const resolvedDeviceId = makeDeviceId(devEui, deviceId);
  const resolvedLorawanVersion = lorawanVersion || TTN_LORAWAN_VERSION || "MAC_V1_0_3";

  const ids = {
    device_id: resolvedDeviceId,
    dev_eui: devEui,
    join_eui: resolvedJoinEui,
  };

  const createdSteps = [];

  try {
    await ttnRequest(
      `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/devices`,
      apiKey,
      "POST",
      {
        end_device: {
          ids,
          network_server_address: clusterHost,
          application_server_address: clusterHost,
          join_server_address: clusterHost,
        },
        field_mask: {
          paths: [
            "network_server_address",
            "application_server_address",
            "join_server_address",
            "ids.dev_eui",
            "ids.join_eui",
          ],
        },
      },
    );
    createdSteps.push("is");

    await ttnRequest(
      `${apiBaseUrl}/api/v3/js/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceId)}`,
      apiKey,
      "PUT",
      {
        end_device: {
          ids,
          network_server_address: clusterHost,
          application_server_address: clusterHost,
          root_keys: { app_key: { key: resolvedAppKey } },
        },
        field_mask: {
          paths: [
            "network_server_address",
            "application_server_address",
            "ids.device_id",
            "ids.dev_eui",
            "ids.join_eui",
            "root_keys.app_key.key",
          ],
        },
      },
    );
    createdSteps.push("js");

    if (lorawanPhyVersion) {
      const nsPaths = [
        "supports_join",
        "lorawan_version",
        "ids.device_id",
        "ids.dev_eui",
        "ids.join_eui",
        "frequency_plan_id",
        "lorawan_phy_version",
      ];
      const nsEndDevice = {
        supports_join: true,
        lorawan_version: resolvedLorawanVersion,
        ids,
        frequency_plan_id: TTN_FREQUENCY_PLAN_ID,
        lorawan_phy_version: lorawanPhyVersion,
      };
      await ttnRequest(
        `${apiBaseUrl}/api/v3/ns/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceId)}`,
        apiKey,
        "PUT",
        { end_device: nsEndDevice, field_mask: { paths: nsPaths } },
      );
      createdSteps.push("ns");
    }

    await ttnRequest(
      `${apiBaseUrl}/api/v3/as/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceId)}`,
      apiKey,
      "PUT",
      {
        end_device: { ids },
        field_mask: { paths: ["ids.device_id", "ids.dev_eui", "ids.join_eui"] },
      },
    );
    createdSteps.push("as");
  } catch (error) {
    try {
      await ttnRequest(
        `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceId)}`,
        apiKey,
        "DELETE",
      );
    } catch (cleanupError) {
      console.error("TTN cleanup after failed registration also failed:", cleanupError.message);
    }
    throw new Error(`TTN registration failed at step "${createdSteps[createdSteps.length - 1] || "is"}": ${error.message}`);
  }

  return { applicationId, deviceId: resolvedDeviceId, deviceEui: devEui, clusterHost };
}

async function repairExistingDevice({ deviceEui, deviceId, joinEui, appKey, lorawanVersion, lorawanPhyVersion }) {
  const { apiBaseUrl, applicationId, apiKey, clusterHost } = getConfiguration();

  const devEui = normalizeHex(deviceEui, 16, "Device EUI");
  const resolvedJoinEui = normalizeHex(joinEui || TTN_DEFAULT_JOIN_EUI, 16, "Join EUI");
  const resolvedAppKey = normalizeHex(appKey, 32, "App Key");
  const resolvedDeviceId = makeDeviceId(devEui, deviceId);
  const resolvedLorawanVersion = lorawanVersion || TTN_LORAWAN_VERSION || "MAC_V1_0_3";

  const ids = {
    device_id: resolvedDeviceId,
    dev_eui: devEui,
    join_eui: resolvedJoinEui,
  };

  const updatedSteps = [];
  let resolvedDeviceIdForSteps = resolvedDeviceId;

  try {
    try {
      await ttnRequest(
        `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceId)}`,
        apiKey,
        "PUT",
        {
          end_device: {
            ids,
            network_server_address: clusterHost,
            application_server_address: clusterHost,
            join_server_address: clusterHost,
          },
          field_mask: {
            paths: [
              "network_server_address",
              "application_server_address",
              "join_server_address",
            ],
          },
        },
      );
    } catch (isError) {
      if (isError.message.includes("not found")) {
        await ttnRequest(
          `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/devices`,
          apiKey,
          "POST",
          {
            end_device: {
              ids,
              network_server_address: clusterHost,
              application_server_address: clusterHost,
              join_server_address: clusterHost,
            },
            field_mask: {
              paths: [
                "network_server_address",
                "application_server_address",
                "join_server_address",
                "ids.dev_eui",
                "ids.join_eui",
              ],
            },
          },
        );
      } else if (isError.message.includes("already registered as `")) {
        const match = isError.message.match(/already registered as `([^`]+)`/);
        if (match) {
          resolvedDeviceIdForSteps = match[1];
          ids.device_id = resolvedDeviceIdForSteps;
        } else {
          throw isError;
        }
      } else {
        throw isError;
      }
    }
    updatedSteps.push("is");

    await ttnRequest(
      `${apiBaseUrl}/api/v3/js/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceIdForSteps)}`,
      apiKey,
      "PUT",
      {
        end_device: {
          ids,
          network_server_address: clusterHost,
          application_server_address: clusterHost,
          root_keys: { app_key: { key: resolvedAppKey } },
        },
        field_mask: {
          paths: [
            "network_server_address",
            "application_server_address",
            "ids.device_id",
            "ids.dev_eui",
            "ids.join_eui",
            "root_keys.app_key.key",
          ],
        },
      },
    );
    updatedSteps.push("js");

    if (lorawanPhyVersion) {
      const nsPaths = [
        "supports_join",
        "lorawan_version",
        "ids.device_id",
        "ids.dev_eui",
        "ids.join_eui",
        "frequency_plan_id",
        "lorawan_phy_version",
      ];
      const nsEndDevice = {
        supports_join: true,
        lorawan_version: resolvedLorawanVersion,
        ids,
        frequency_plan_id: TTN_FREQUENCY_PLAN_ID,
        lorawan_phy_version: lorawanPhyVersion,
      };
      await ttnRequest(
        `${apiBaseUrl}/api/v3/ns/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceIdForSteps)}`,
        apiKey,
        "PUT",
        { end_device: nsEndDevice, field_mask: { paths: nsPaths } },
      );
      updatedSteps.push("ns");
    }

    await ttnRequest(
      `${apiBaseUrl}/api/v3/as/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceIdForSteps)}`,
      apiKey,
      "PUT",
      {
        end_device: { ids },
        field_mask: { paths: ["ids.device_id", "ids.dev_eui", "ids.join_eui"] },
      },
    );
    updatedSteps.push("as");
  } catch (error) {
    throw new Error(`TTN repair failed at step "${updatedSteps[updatedSteps.length - 1] || "js"}": ${error.message}`);
  }

  return { applicationId, deviceId: resolvedDeviceIdForSteps, deviceEui: devEui, clusterHost, updatedSteps };
}

async function deleteDeviceFromTTN({ deviceEui, deviceId }) {
  const { apiBaseUrl, applicationId, apiKey } = getConfiguration();
  const devEui = normalizeHex(deviceEui, 16, "Device EUI");
  const resolvedDeviceId = makeDeviceId(devEui, deviceId);

  await ttnRequest(
    `${apiBaseUrl}/api/v3/applications/${encodeURIComponent(applicationId)}/devices/${encodeURIComponent(resolvedDeviceId)}`,
    apiKey,
    "DELETE",
  );

  return { applicationId, deviceId: resolvedDeviceId, deviceEui: devEui };
}

module.exports = { registerOtaaDevice, repairExistingDevice, listTtnDevices, getConfiguration, deleteDeviceFromTTN };