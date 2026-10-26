require("dotenv").config();
const prisma = require("../src/config/database");

async function main() {
  const apiKey = process.env.TTN_GATEWAY_API_KEY || process.env.TTN_API_KEY;
  const baseUrl = (process.env.TTN_API_BASE_URL || "https://eu1.cloud.thethings.network").replace(/\/$/, "");

  const gateways = await prisma.gateway.findMany({
    select: { id: true, name: true, gatewayId: true, ttnStatus: true, lnsKey: true },
    orderBy: { createdAt: "desc" },
  });

  let fixed = 0;
  for (const gw of gateways) {
    if (!gw.gatewayId) continue;

    const res = await fetch(`${baseUrl}/api/v3/gateways/${encodeURIComponent(gw.gatewayId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const ttnExists = res.ok;

    // Fix: DB says not_registered but TTN has it → mark as registered
    if (ttnExists && gw.ttnStatus !== "registered") {
      await prisma.gateway.update({
        where: { id: gw.id },
        data: { ttnStatus: "registered" },
      });
      console.log(`✓ Synced "${gw.name}" (${gw.gatewayId}): not_registered → registered`);
      fixed++;
    }
    // Fix: DB says registered but TTN doesn't have it → mark as not_registered
    else if (!ttnExists && gw.ttnStatus === "registered") {
      await prisma.gateway.update({
        where: { id: gw.id },
        data: { ttnStatus: "not_registered", lnsKey: null },
      });
      console.log(`✓ Reset "${gw.name}" (${gw.gatewayId}): registered → not_registered (TTN ${res.status})`);
      fixed++;
    }
  }

  console.log(`\nDone — fixed ${fixed} gateway(s).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
