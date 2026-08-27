require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const r = await prisma.$queryRaw`select 1 as x`;
    console.log('DB_OK', JSON.stringify(r));
  } catch (e) {
    console.log('DB_ERR', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
