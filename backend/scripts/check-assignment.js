const prisma = require('../src/config/database');
async function main() {
  // Show all orgs
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, vendorStatus: true } });
  console.log('\n=== All Organizations ===');
  orgs.forEach(o => console.log(`  ${o.id} | ${o.name} | ${o.vendorStatus}`));

  // Show all devices with their organizationId
  const devices = await prisma.device.findMany({
    select: { id: true, name: true, badgeId: true, organizationId: true, deviceEui: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('\n=== Recent Devices (last 10) ===');
  devices.forEach(d => console.log(`  ${d.badgeId} | orgId: ${d.organizationId || 'UNASSIGNED'} | ${d.name || ''}`));

  // Show vendor admins and their orgs
  const vendorAdmins = await prisma.user.findMany({
    where: { role: 'vendor_admin' },
    select: { email: true, organizationId: true, name: true },
  });
  console.log('\n=== Vendor Admins ===');
  vendorAdmins.forEach(u => console.log(`  ${u.email} | orgId: ${u.organizationId} | ${u.name}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
