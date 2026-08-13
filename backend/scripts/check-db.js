require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const locations = await prisma.location.findMany({ take: 5 });
  console.log("Locations:", locations);
  const floors = await prisma.floor.findMany({ take: 5 });
  console.log("Floors:", floors);
  const restrooms = await prisma.restroom.findMany({ take: 5 });
  console.log("Restrooms:", restrooms);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
