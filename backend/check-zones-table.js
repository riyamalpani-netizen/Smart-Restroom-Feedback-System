const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const connectionString = 'postgresql://postgres:Postgres%40123@localhost:5432/smart_restroom?schema=public'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT CAST(to_regclass('public.zones') AS TEXT) as zones`
    console.log('zones table exists:', result)
  } catch (e) {
    console.error('Error:', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
