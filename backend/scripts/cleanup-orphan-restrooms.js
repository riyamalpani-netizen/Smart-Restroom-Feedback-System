/**
 * cleanup-orphan-restrooms.js
 *
 * Deletes restroom records that have no zone pointing to them.
 * These are left over from zones that were deleted before the cascade fix.
 *
 * Run with:  node backend/scripts/cleanup-orphan-restrooms.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Find all restroomIds that are referenced by at least one zone
  const linkedZones = await prisma.zone.findMany({
    where: { restroomId: { not: null } },
    select: { restroomId: true },
  })
  const linkedIds = linkedZones.map(z => z.restroomId)

  // Find restrooms NOT in that set
  const orphans = await prisma.restroom.findMany({
    where: { id: { notIn: linkedIds.length ? linkedIds : ['__none__'] } },
    select: { id: true, name: true, floorId: true },
  })

  if (orphans.length === 0) {
    console.log('No orphaned restrooms found.')
    return
  }

  console.log(`Found ${orphans.length} orphaned restroom(s):`)
  orphans.forEach(r => console.log(`  - [${r.id}] "${r.name}" (floor: ${r.floorId})`))

  const orphanIds = orphans.map(r => r.id)

  // Cascade delete: unlink devices, delete alerts/feedback/notifications, then restrooms
  await prisma.$transaction([
    prisma.device.updateMany({ where: { restroomId: { in: orphanIds } }, data: { restroomId: null } }),
    prisma.notification.deleteMany({ where: { alert: { restroomId: { in: orphanIds } } } }),
    prisma.alert.deleteMany({ where: { restroomId: { in: orphanIds } } }),
    prisma.feedback.deleteMany({ where: { restroomId: { in: orphanIds } } }),
    prisma.restroom.deleteMany({ where: { id: { in: orphanIds } } }),
  ])

  console.log(`Deleted ${orphans.length} orphaned restroom(s).`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
