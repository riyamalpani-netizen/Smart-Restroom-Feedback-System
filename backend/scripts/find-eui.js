require("dotenv").config();
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const EUI = "AC233F0000000496";

  // Check devices table
  const device = await prisma.device.findUnique({
    where: { deviceEui: EUI },
    include: {
      restroom: { include: { floor: { include: { location: true } } } },
      gateway: true,
    },
  });

  // Check gateways table
  const gateway = await prisma.gateway.findUnique({
    where: { gatewayEui: EUI },
    include: { location: true, floor: true },
  });

  console.log("\n=== DEVICE ===");
  if (device) {
    console.log(`  id          : ${device.id}`);
    console.log(`  name        : ${device.name}`);
    console.log(`  badgeId     : ${device.badgeId}`);
    console.log(`  deviceEui   : ${device.deviceEui}`);
    console.log(`  restroomId  : ${device.restroomId ?? "UNASSIGNED"}`);
    console.log(`  restroom    : ${device.restroom?.name ?? "—"}`);
    console.log(`  floor       : ${device.restroom?.floor?.floorName ?? "—"}`);
    console.log(`  location    : ${device.restroom?.floor?.location?.officeName ?? "—"}`);
    console.log(`  battery     : ${device.batteryLevel}%`);
    console.log(`  health      : ${device.healthStatus}`);
    console.log(`  lastSeen    : ${device.lastSeen}`);
    console.log(`  gateway     : ${device.gateway?.name ?? "—"}`);
  } else {
    console.log("  Not found in devices table.");
  }

  console.log("\n=== GATEWAY ===");
  if (gateway) {
    console.log(`  id          : ${gateway.id}`);
    console.log(`  name        : ${gateway.name}`);
    console.log(`  gatewayEui  : ${gateway.gatewayEui}`);
    console.log(`  gatewayId   : ${gateway.gatewayId}`);
    console.log(`  ttnStatus   : ${gateway.ttnStatus}`);
    console.log(`  status      : ${gateway.status}`);
    console.log(`  lastSeen    : ${gateway.lastSeen}`);
    console.log(`  location    : ${gateway.location?.officeName ?? "—"}`);
    console.log(`  floor       : ${gateway.floor?.floorName ?? "—"}`);
  } else {
    console.log("  Not found in gateways table.");
  }

  if (!device && !gateway) {
    console.log("\n  EUI AC233F0000000496 does not exist in the database.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
