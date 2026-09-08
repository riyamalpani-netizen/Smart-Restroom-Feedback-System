require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      vendorTTNConfig: {
        select: {
          ttnAppId: true,
          ttnApiKey: true,
          ttnApiBaseUrl: true,
          ttnMqttBroker: true,
          ttnFrequencyPlanId: true,
          integrationEnabled: true,
        },
      },
    },
  });

  for (const o of orgs) {
    const cfg = o.vendorTTNConfig;
    console.log('\nORG:', o.name, '|', o.id);
    if (!cfg) {
      console.log('  -> NO VendorTTNConfig record');
      continue;
    }
    console.log('  ttnAppId        :', cfg.ttnAppId || '(none)');
    console.log('  ttnApiKey present:', !!(cfg.ttnApiKey));
    console.log('  ttnApiBaseUrl   :', cfg.ttnApiBaseUrl || '(none)');
    console.log('  ttnMqttBroker   :', cfg.ttnMqttBroker || '(none)');
    console.log('  integrationEnabled:', cfg.integrationEnabled);
  }

  // Also show which devices are assigned to which org
  console.log('\n--- DEVICE ORG ASSIGNMENTS ---');
  const devices = await prisma.device.findMany({
    select: { id: true, badgeId: true, deviceEui: true, organizationId: true, appKey: true },
  });
  for (const d of devices) {
    console.log(`  ${d.badgeId} | EUI: ${d.deviceEui} | orgId: ${d.organizationId || 'UNASSIGNED'} | hasAppKey: ${!!(d.appKey)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
