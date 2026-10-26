require("dotenv").config();
const prisma = require("../src/config/database");

async function main() {
  const device = await prisma.device.findFirst({
    where: { deviceEui: "AC233F000000048D" },
    select: {
      id: true, name: true, badgeId: true, deviceEui: true,
      organizationId: true, joinEui: true, appKey: true,
      lorawanVersion: true, lorawanPhyVersion: true,
      organization: { select: { id: true, name: true } },
    },
  });

  if (!device) { console.log("Device not found"); process.exit(0); }

  console.log("\n=== Device in DB ===");
  console.log(`  badgeId:      ${device.badgeId}`);
  console.log(`  deviceEui:    ${device.deviceEui}`);
  console.log(`  organizationId: ${device.organizationId}`);
  console.log(`  org name:     ${device.organization?.name || "null"}`);
  console.log(`  appKey:       ${device.appKey ? "SET" : "null"}`);
  console.log(`  joinEui:      ${device.joinEui}`);
  console.log(`  lorawanVersion: ${device.lorawanVersion}`);

  if (!device.organizationId) {
    console.log("\n❌ Device has no organizationId — it was never assigned to a vendor in DB");
    await prisma.$disconnect(); return;
  }

  // Get vendor TTN config
  const cfg = await prisma.vendorTTNConfig.findUnique({
    where: { organizationId: device.organizationId },
    select: { ttnAppId: true, ttnApiBaseUrl: true, ttnApiKey: true, ttnMqttBroker: true },
  });

  console.log("\n=== Vendor TTN Config ===");
  if (!cfg) {
    console.log("  ❌ No VendorTTNConfig found for this org — vendor has no TTN app");
    await prisma.$disconnect(); return;
  }
  console.log(`  ttnAppId:    ${cfg.ttnAppId}`);
  console.log(`  apiBaseUrl:  ${cfg.ttnApiBaseUrl || "https://" + cfg.ttnMqttBroker}`);
  console.log(`  apiKey:      ${cfg.ttnApiKey ? "SET" : "null"}`);

  // Check if device exists in vendor TTN app
  const baseUrl = (cfg.ttnApiBaseUrl || `https://${cfg.ttnMqttBroker}`).replace(/\/$/, "");
  const appId = cfg.ttnAppId;
  const apiKey = cfg.ttnApiKey;

  const nameSlug = device.name
    ? device.name.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20)
    : null;
  const euiSuffix = device.deviceEui.toLowerCase().slice(-8);
  const primaryId = nameSlug ? `device-${nameSlug}-${euiSuffix}` : `device-${device.deviceEui.toLowerCase()}`;
  const fallbackId = `device-${device.deviceEui.toLowerCase()}`;

  console.log(`\n=== TTN Check (app: ${appId}) ===`);
  console.log(`  Checking device IDs: "${primaryId}", "${fallbackId}"`);

  for (const devId of [...new Set([primaryId, fallbackId])]) {
    const res = await fetch(`${baseUrl}/api/v3/applications/${encodeURIComponent(appId)}/devices/${encodeURIComponent(devId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    console.log(`  ${devId}: TTN → ${res.status} ${res.ok ? "✓ EXISTS" : "✗ NOT FOUND"}`);
  }

  // Also check global TTN app
  const globalApiKey = process.env.TTN_API_KEY;
  const globalAppId = process.env.TTN_APPLICATION_ID;
  const globalBase = process.env.TTN_API_BASE_URL;
  if (globalAppId && globalApiKey) {
    const res = await fetch(`${globalBase}/api/v3/applications/${encodeURIComponent(globalAppId)}/devices/${encodeURIComponent(fallbackId)}`, {
      headers: { Authorization: `Bearer ${globalApiKey}` },
    });
    console.log(`\n  Global TTN app (${globalAppId}): ${fallbackId} → ${res.status} ${res.ok ? "✓ EXISTS" : "✗ NOT FOUND"}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
