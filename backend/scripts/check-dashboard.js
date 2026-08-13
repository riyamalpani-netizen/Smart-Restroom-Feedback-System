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
  const totalRestrooms = await prisma.restroom.count()
  const totalDevices = await prisma.device.count()
  const todayFeedback = await prisma.feedback.count({
    where: {
      timestamp: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  })
  const activeAlerts = await prisma.alert.count({
    where: {
      status: {
        not: 'closed',
      },
    },
  })
  const onlineDevices = await prisma.device.count({
    where: {
      healthStatus: 'healthy',
    },
  })
  const offlineDevices = totalDevices - onlineDevices

  console.log({
    totalRestrooms,
    totalDevices,
    todayFeedback,
    activeAlerts,
    onlineDevices,
    offlineDevices,
  })
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
