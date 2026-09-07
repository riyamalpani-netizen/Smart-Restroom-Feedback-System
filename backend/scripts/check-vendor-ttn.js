const prisma = require('../src/config/database');
async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'vendor@smartrestroom.com' },
    select: { organizationId: true, name: true }
  });
  console.log('Vendor user:', user);

  if (!user) { console.log('User not found'); return; }

  const cfg = await prisma.vendorTTNConfig.findUnique({
    where: { organizationId: user.organizationId },
    select: { organizationId: true, integrationEnabled: true, connectionStatus: true, ttnMqttUsername: true, ttnMqttBroker: true }
  });
  console.log('VendorTTNConfig:', cfg);

  const settings = await prisma.settings.findFirst({
    where: { organizationId: user.organizationId },
    select: { organizationId: true, ttnMqttUsername: true, ttnMqttBroker: true }
  });
  console.log('Settings (legacy):', settings);

  // Show all VendorTTNConfigs
  const all = await prisma.vendorTTNConfig.findMany({
    select: { organizationId: true, integrationEnabled: true, connectionStatus: true, ttnMqttUsername: true }
  });
  console.log('All VendorTTNConfigs:', all);
}
main().catch(console.error).finally(() => prisma.$disconnect());
