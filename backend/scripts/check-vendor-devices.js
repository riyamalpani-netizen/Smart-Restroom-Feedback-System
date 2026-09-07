const prisma = require('../src/config/database');
async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'vendor_admin' },
    select: { email: true, organizationId: true, name: true, active: true },
  });
  
  for (const admin of admins) {
    const devices = await prisma.device.count({ where: { organizationId: admin.organizationId } });
    const gateways = await prisma.gateway.count({ where: { organizationId: admin.organizationId } });
    console.log(`\n${admin.email} (${admin.name})`);
    console.log(`  orgId: ${admin.organizationId} | active: ${admin.active}`);
    console.log(`  devices: ${devices} | gateways: ${gateways}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
