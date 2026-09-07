const prisma = require('../src/config/database');
async function main() {
  // Simulate what GET /api/devices returns for bkc@gmail.com (org: cmtr7kl150000t4uuu0wqw2rt)
  const orgId = 'cmtr7kl150000t4uuu0wqw2rt';
  const devices = await prisma.device.findMany({
    where: { organizationId: orgId },
    select: { id: true, badgeId: true, name: true, organizationId: true, lastSeen: true, healthStatus: true },
  });
  console.log(`\n=== Devices for org ${orgId} (BKC) ===`);
  devices.forEach(d => console.log(`  ${d.badgeId} | ${d.name} | health: ${d.healthStatus}`));

  // Check if badge-ritesh is properly assigned
  const d = await prisma.device.findFirst({ where: { badgeId: 'badge-ritesh' }, select: { organizationId: true, badgeId: true, name: true } });
  console.log('\n=== badge-ritesh ===');
  console.log(d);
}
main().catch(console.error).finally(() => prisma.$disconnect());
