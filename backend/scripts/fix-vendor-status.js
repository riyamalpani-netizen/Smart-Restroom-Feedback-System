const prisma = require('../src/config/database');
async function main() {
  const r = await prisma.organization.updateMany({
    where: { vendorStatus: 'inactive' },
    data: { vendorStatus: 'active' },
  });
  console.log('Updated', r.count, 'vendors to active');
  const all = await prisma.organization.findMany({ select: { id: true, name: true, vendorStatus: true } });
  all.forEach(o => console.log(`  ${o.name} → ${o.vendorStatus}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
