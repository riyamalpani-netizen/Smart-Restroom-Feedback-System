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
  const device = await prisma.device.update({
    where: { deviceEui: "F4E5D6C7B8A99001" },
    data: { restroomId: "restroom-3" },
  });
  console.log("Device updated:", device);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
