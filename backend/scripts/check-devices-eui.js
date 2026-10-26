require("dotenv").config();
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const devices = await prisma.device.findMany({
    select: { id: true, badgeId: true, deviceEui: true, healthStatus: true, restroomId: true },
  });
  console.log(`Found ${devices.length} device(s) in DB:`);
  devices.forEach((d) => console.log(JSON.stringify(d)));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
