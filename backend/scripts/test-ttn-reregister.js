require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Monkey-patch the prisma import used by the TTN service
// The service uses require('../config/database') which returns the shared instance
// We need to override it for this script
const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request.endsWith('/config/database') || request.endsWith('\\config\\database')) {
    return prisma;
  }
  return originalLoad.apply(this, arguments);
};

const { registerOtaaDevice } = require('../src/services/ttnDeviceRegistryService');

const ATLASIED_ORG_ID = 'cmts8l2e00000d8uut6d81erc';
const DEVICE_EUI = 'AA00000000000019';

async function main() {
  console.log('Attempting TTN registration for', DEVICE_EUI, 'under org', ATLASIED_ORG_ID);
  try {
    const result = await registerOtaaDevice({
      deviceEui: DEVICE_EUI,
      deviceId: `device-${DEVICE_EUI.toLowerCase()}`,
      joinEui: '0000000000000000',
      appKey: 'A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1', // placeholder
      lorawanVersion: 'MAC_V1_0_3',
      organizationId: ATLASIED_ORG_ID,
    });
    console.log('SUCCESS:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
