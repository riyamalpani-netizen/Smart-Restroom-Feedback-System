/**
 * Seeds 20 unplaced inventory devices and 20 unplaced inventory gateways
 * under org-demo-1 (the main demo org).  Safe to run multiple times —
 * existing records are skipped via upsert on deviceEui / gatewayEui.
 */
require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Deterministic EUI helpers so re-runs produce the same IDs
function deviceEui(n) {
  return `AA000000000${String(n).padStart(5, "0")}`.toUpperCase();
}
function gatewayEui(n) {
  return `BB000000000${String(n).padStart(5, "0")}`.toUpperCase();
}
function appKey(n) {
  const hex = n.toString(16).toUpperCase().padStart(2, "0");
  return `${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`;
}

const DEVICE_TYPES = ["sensor", "sensor", "sensor", "badge", "badge"];

async function seedInventory() {
  const ORG_ID = "org-demo-1";

  // Verify org exists
  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) {
    throw new Error(
      `Organization "${ORG_ID}" not found. Run seedDashboardData.js first.`
    );
  }

  // ── 20 Devices ──────────────────────────────────────────────────────────────
  const deviceResults = { created: 0, skipped: 0 };
  for (let i = 1; i <= 20; i++) {
    const eui = deviceEui(i);
    const badge = `INV-DEV-${String(i).padStart(3, "0")}`;
    const existing = await prisma.device.findFirst({
      where: { OR: [{ deviceEui: eui }, { badgeId: badge }] },
      select: { id: true },
    });
    if (existing) { deviceResults.skipped++; continue; }
    await prisma.device.create({
      data: {
        deviceEui: eui,
        badgeId: badge,
        name: `Inventory Sensor ${String(i).padStart(2, "0")}`,
        deviceType: DEVICE_TYPES[(i - 1) % DEVICE_TYPES.length],
        batteryLevel: 100,
        healthStatus: "healthy",
        appKey: appKey(i),
        joinEui: "0000000000000000",
        lorawanVersion: "MAC_V1_0_3",
        // No floorId / restroomId / zoneId — unplaced inventory
      },
    });
    deviceResults.created++;
  }

  // ── 20 Gateways ─────────────────────────────────────────────────────────────
  const gatewayResults = { created: 0, skipped: 0 };
  for (let i = 1; i <= 20; i++) {
    const eui = gatewayEui(i);
    const gwId = `inv-gateway-${String(i).padStart(3, "0")}`;
    const existing = await prisma.gateway.findFirst({
      where: { gatewayEui: eui },
      select: { id: true },
    });
    if (existing) { gatewayResults.skipped++; continue; }
    await prisma.gateway.create({
      data: {
        name: `Inventory Gateway ${String(i).padStart(2, "0")}`,
        gatewayEui: eui,
        gatewayId: gwId,
        organizationId: ORG_ID,
        status: "offline",
        connectedDevices: 0,
        // No locationId / floorId / zoneId — unplaced inventory
      },
    });
    gatewayResults.created++;
  }

  console.log("✅ Inventory seed complete");
  console.log(`   Devices  — created: ${deviceResults.created}, skipped: ${deviceResults.skipped}`);
  console.log(`   Gateways — created: ${gatewayResults.created}, skipped: ${gatewayResults.skipped}`);
}

seedInventory()
  .catch((err) => { console.error("Seed error:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
