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
  const feedbacks = await prisma.feedback.findMany({
    take: 10,
    orderBy: { timestamp: "desc" },
    include: { device: true, restroom: true, alert: true },
  });
  console.log(JSON.stringify(feedbacks, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
