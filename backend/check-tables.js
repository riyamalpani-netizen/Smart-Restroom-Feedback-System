const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const connectionString = 'postgresql://postgres:Postgres%40123@localhost:5432/smart_restroom?schema=public'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const floors = await prisma.$queryRaw`SELECT id, "floorName" as floorName FROM floors LIMIT 5`
    console.log('floors:', floors)
    
    const restrooms = await prisma.$queryRaw`SELECT id, name FROM restrooms LIMIT 5`
    console.log('restrooms:', restrooms)
    
    const zones = await prisma.$queryRaw`SELECT id, name, type, coordinates, latitude, longitude FROM zones LIMIT 5`
    console.log('zones:', zones)
  } catch (e) {
    console.error('Error:', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
