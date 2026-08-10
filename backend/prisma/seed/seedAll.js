require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function seedAll() {
  const now = new Date();

  const org = await prisma.organization.upsert({
    where: { id: "org-demo" },
    update: {},
    create: {
      id: "org-demo",
      name: "Demo Organization",
      timezone: "UTC",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@smartrestroom.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@smartrestroom.com",
      password: await bcrypt.hash("Admin@123", 10),
      role: "super_admin",
      active: true,
      organizationId: org.id,
    },
  });

  const location = await prisma.location.upsert({
    where: { id: "loc-1" },
    update: {},
    create: {
      id: "loc-1",
      organizationId: org.id,
      city: "New Delhi",
      officeName: "Head Office",
      address: "123 Main Street",
    },
  });

  const floor1 = await prisma.floor.upsert({
    where: { id: "floor-1" },
    update: {},
    create: {
      id: "floor-1",
      locationId: location.id,
      floorName: "Ground Floor",
    },
  });

  const floor2 = await prisma.floor.upsert({
    where: { id: "floor-2" },
    update: {},
    create: {
      id: "floor-2",
      locationId: location.id,
      floorName: "First Floor",
    },
  });

  const restrooms = await Promise.all([
    prisma.restroom.upsert({
      where: { id: "restroom-1" },
      update: {},
      create: { id: "restroom-1", floorId: floor1.id, organizationId: org.id, name: "Restroom 101", gender: "male", status: "good" },
    }),
    prisma.restroom.upsert({
      where: { id: "restroom-2" },
      update: {},
      create: { id: "restroom-2", floorId: floor1.id, organizationId: org.id, name: "Restroom 102", gender: "female", status: "good" },
    }),
    prisma.restroom.upsert({
      where: { id: "restroom-3" },
      update: {},
      create: { id: "restroom-3", floorId: floor2.id, organizationId: org.id, name: "Restroom 201", gender: "male", status: "alert" },
    }),
    prisma.restroom.upsert({
      where: { id: "restroom-4" },
      update: {},
      create: { id: "restroom-4", floorId: floor2.id, organizationId: org.id, name: "Restroom 202", gender: "female", status: "good" },
    }),
  ]);

  const devices = await Promise.all([
    prisma.device.upsert({
      where: { deviceEui: "DEVICE-EUI-001" },
      update: {},
      create: { deviceEui: "DEVICE-EUI-001", badgeId: "B001", restroomId: restrooms[0].id, batteryLevel: 92, healthStatus: "healthy", lastSeen: new Date(now.getTime() - 5 * 60 * 1000) },
    }),
    prisma.device.upsert({
      where: { deviceEui: "DEVICE-EUI-002" },
      update: {},
      create: { deviceEui: "DEVICE-EUI-002", badgeId: "B002", restroomId: restrooms[1].id, batteryLevel: 78, healthStatus: "healthy", lastSeen: new Date(now.getTime() - 12 * 60 * 1000) },
    }),
    prisma.device.upsert({
      where: { deviceEui: "DEVICE-EUI-003" },
      update: {},
      create: { deviceEui: "DEVICE-EUI-003", badgeId: "B003", restroomId: restrooms[2].id, batteryLevel: 24, healthStatus: "warning", lastSeen: new Date(now.getTime() - 3 * 60 * 1000) },
    }),
    prisma.device.upsert({
      where: { deviceEui: "DEVICE-EUI-004" },
      update: {},
      create: { deviceEui: "DEVICE-EUI-004", badgeId: "B004", restroomId: restrooms[3].id, batteryLevel: 65, healthStatus: "healthy", lastSeen: new Date(now.getTime() - 8 * 60 * 1000) },
    }),
  ]);

  const feedbacks = await Promise.all([
    prisma.feedback.create({ data: { deviceId: devices[2].id, restroomId: restrooms[2].id, feedbackType: "needs_cleaning", battery: 24, signalStrength: 60, timestamp: new Date(now.getTime() - 10 * 60 * 1000) } }),
    prisma.feedback.create({ data: { deviceId: devices[0].id, restroomId: restrooms[0].id, feedbackType: "happy", battery: 92, signalStrength: 80, timestamp: new Date(now.getTime() - 25 * 60 * 1000) } }),
    prisma.feedback.create({ data: { deviceId: devices[1].id, restroomId: restrooms[1].id, feedbackType: "happy", battery: 78, signalStrength: 75, timestamp: new Date(now.getTime() - 45 * 60 * 1000) } }),
    prisma.feedback.create({ data: { deviceId: devices[3].id, restroomId: restrooms[3].id, feedbackType: "average", battery: 65, signalStrength: 70, timestamp: new Date(now.getTime() - 60 * 60 * 1000) } }),
    prisma.feedback.create({ data: { deviceId: devices[2].id, restroomId: restrooms[2].id, feedbackType: "needs_cleaning", battery: 28, signalStrength: 55, timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000) } }),
    prisma.feedback.create({ data: { deviceId: devices[0].id, restroomId: restrooms[0].id, feedbackType: "happy", battery: 94, signalStrength: 85, timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000) } }),
  ]);

  const alert1 = await prisma.alert.create({
    data: {
      feedbackId: feedbacks[0].id,
      restroomId: restrooms[2].id,
      priority: "medium",
      status: "open",
    },
  });

  await prisma.alert.create({
    data: {
      feedbackId: feedbacks[4].id,
      restroomId: restrooms[2].id,
      priority: "high",
      status: "open",
    },
  });

  console.log("Seed completed successfully!");
  console.log({
    organization: org.name,
    admin: admin.email,
    locations: 1,
    floors: 2,
    restrooms: restrooms.length,
    devices: devices.length,
    feedback: feedbacks.length,
    alerts: 2,
  });
}

seedAll()
  .catch((error) => {
    console.error("Error seeding data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
