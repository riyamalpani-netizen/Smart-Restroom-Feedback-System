/**
 * Resets ttnStatus to 'not_registered' for a gateway by EUI,
 * assigning a clean new gatewayId derived from the EUI.
 * Usage: node scripts/fix-gateway-by-eui.js <EUI>
 */
require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const EUI = (process.argv[2] || '').toUpperCase();
if (!EUI) { console.error('Usage: node fix-gateway-by-eui.js <EUI>'); process.exit(1); }

async function main() {
  const gw = await prisma.gateway.findFirst({
    where: { gatewayEui: EUI },
    select: { id: true, name: true, gatewayEui: true, gatewayId: true, ttnStatus: true },
  });

  if (!gw) { console.error(`No gateway found with EUI = "${EUI}"`); process.exit(1); }

  console.log(`Found: ${gw.name} | gatewayId: ${gw.gatewayId} | ttnStatus: ${gw.ttnStatus}`);

  const newGatewayId = `gateway-${gw.gatewayEui.toLowerCase()}`;
  await prisma.gateway.update({
    where: { id: gw.id },
    data: { ttnStatus: 'not_registered', gatewayId: newGatewayId, ttnDeviceId: newGatewayId },
  });

  console.log(`✓ Reset to not_registered`);
  console.log(`✓ New gatewayId: ${newGatewayId}`);
  console.log(`\nNow click "Register in TTN" in Gateway Management to register it fresh.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
