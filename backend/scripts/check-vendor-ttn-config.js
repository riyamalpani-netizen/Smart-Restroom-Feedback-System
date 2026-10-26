require("dotenv").config();
const prisma = require("../src/config/database");

async function main() {
  const orgId = "cmts8l2e00000d8uut6d81erc";

  const cfg = await prisma.vendorTTNConfig.findUnique({
    where: { organizationId: orgId },
    select: {
      ttnApiKey: true, ttnGatewayApiKey: true,
      ttnApiBaseUrl: true, ttnMqttBroker: true,
      ttnFrequencyPlanId: true,
      ttnGatewayOwnerType: true, ttnGatewayOwnerId: true,
    },
  });

  console.log("VendorTTNConfig:");
  console.log("  ttnApiKey:          ", cfg?.ttnApiKey ? "SET" : "null");
  console.log("  ttnGatewayApiKey:   ", cfg?.ttnGatewayApiKey ? "SET" : "null");
  console.log("  ttnApiBaseUrl:      ", cfg?.ttnApiBaseUrl || "null");
  console.log("  ttnMqttBroker:      ", cfg?.ttnMqttBroker || "null");
  console.log("  ttnFrequencyPlanId: ", cfg?.ttnFrequencyPlanId || "null");
  console.log("  ttnGatewayOwnerType:", cfg?.ttnGatewayOwnerType || "null");
  console.log("  ttnGatewayOwnerId:  ", cfg?.ttnGatewayOwnerId || "null");

  // Now simulate what getConfiguration() resolves to
  const apiKey = cfg?.ttnGatewayApiKey || cfg?.ttnApiKey ||
    process.env.TTN_GATEWAY_API_KEY || process.env.TTN_API_KEY;
  const apiBaseUrl = cfg?.ttnApiBaseUrl ||
    (cfg?.ttnMqttBroker ? `https://${cfg.ttnMqttBroker}` : null) ||
    process.env.TTN_API_BASE_URL;
  const ownerType = cfg?.ttnGatewayOwnerType || process.env.TTN_GATEWAY_OWNER_TYPE;
  const ownerId = cfg?.ttnGatewayOwnerId || process.env.TTN_GATEWAY_OWNER_ID;
  const freqPlan = cfg?.ttnFrequencyPlanId || process.env.TTN_FREQUENCY_PLAN_ID;

  console.log("\nResolved config for gateway registration:");
  console.log("  apiKey:     ", apiKey ? "SET" : "MISSING ❌");
  console.log("  apiBaseUrl: ", apiBaseUrl || "MISSING ❌");
  console.log("  ownerType:  ", ownerType || "MISSING ❌");
  console.log("  ownerId:    ", ownerId || "MISSING ❌");
  console.log("  freqPlan:   ", freqPlan || "MISSING ❌");

  // Try the actual TTN API call
  if (apiKey && apiBaseUrl && ownerType && ownerId && freqPlan) {
    const base = apiBaseUrl.replace(/\/$/, "");
    const ownerSegment = ownerType === "organization" ? "organizations" : "users";
    const url = `${base}/api/v3/${ownerSegment}/${encodeURIComponent(ownerId)}/gateways`;
    console.log(`\nTesting POST to: ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        gateway: {
          ids: { gateway_id: "test-gw-diag-delete-me", eui: "AC233FFFFEC1F81F" },
          gateway_server_address: base.replace(/^https?:\/\//, ""),
          frequency_plan_id: freqPlan,
          frequency_plan_ids: [freqPlan],
        },
      }),
    });
    const text = await res.text();
    console.log(`  Response: ${res.status}`);
    console.log(`  Body: ${text.slice(0, 300)}`);

    // Clean up test gateway if created
    if (res.ok) {
      await fetch(`${base}/api/v3/gateways/test-gw-diag-delete-me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      console.log("  Cleaned up test gateway");
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
