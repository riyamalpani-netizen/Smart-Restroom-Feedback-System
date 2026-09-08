/**
 * Resets ttnStatus to 'not_registered' for a gateway whose TTN record
 * no longer exists, so it can be re-registered cleanly.
 * Usage: node scripts/fix-gateway-ttn-status.js ritesh-mineuw-gateway-002
 */
require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const OLD_GATEWAY_ID = process.argv[2];
if (!OLD_GATEWAY_ID) {
  console.error('Usage: node fix-gateway-ttn-status.js <current-ttn-gateway-id>');
  process.exit(1);
}

async function main() {
  const gw = await prisma.gateway.findFirst({
    where: { gatewayId: OLD_GATEWAY_ID },
    select: { id: true, name: true, gatewayEui: true, gatewayId: true, ttnStatus: true },
  });

  if (!gw) {
    console.error(`No gateway found with gatewayId = "${OLD_GATEWAY_ID}"`);
    process.exit(1);
  }

  console.log(`Found: ${gw.name} | EUI: ${gw.gatewayEui} | current ttnStatus: ${gw.ttnStatus}`);

  // Build a new clean gateway ID from the EUI
  const newGatewayId = `gateway-${gw.gatewayEui.toLowerCase()}`;

  await prisma.gateway.update({
    where: { id: gw.id },
    data: {
      ttnStatus: 'not_registered',
      gatewayId: newGatewayId,
      ttnDeviceId: newGatewayId,
    },
  });

  console.log(`✓ Reset to not_registered`);
  console.log(`✓ New gatewayId: ${newGatewayId}`);
  console.log(`\nNow use "Register in TTN" in the SRFS Gateway Management page to register it fresh.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
