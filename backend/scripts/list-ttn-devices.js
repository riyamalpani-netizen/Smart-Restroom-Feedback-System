require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const Module = require('module');
const orig = Module._load;
Module._load = function(req, parent, isMain) {
  if (req.endsWith('/config/database') || req.endsWith('\\config\\database')) return prisma;
  return orig.apply(this, arguments);
};

const { listTtnDevices } = require('../src/services/ttnDeviceRegistryService');

async function main() {
  const cfg = await prisma.vendorTTNConfig.findUnique({
    where: { organizationId: 'cmts8l2e00000d8uut6d81erc' },
    select: { ttnAppId: true, ttnApiKey: true, ttnApiBaseUrl: true, ttnMqttBroker: true },
  });

  const apiBaseUrl = cfg.ttnApiBaseUrl || `https://${cfg.ttnMqttBroker}`;
  console.log(`Listing devices in TTN app: ${cfg.ttnAppId} @ ${apiBaseUrl}\n`);

  const devices = await listTtnDevices(apiBaseUrl, cfg.ttnAppId, cfg.ttnApiKey);
  if (!devices.length) {
    console.log('No devices found in this TTN application.');
  } else {
    devices.forEach(d => console.log(`  deviceId: ${d.deviceId} | devEui: ${d.devEui}`));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
