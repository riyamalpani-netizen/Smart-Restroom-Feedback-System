require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function seedDashboardData() {
  const now = new Date();

  const admin = await prisma.user.upsert({
    where: { email: "admin@smartrestroom.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@smartrestroom.com",
      password: await bcrypt.hash("Admin@123", 10),
      role: "super_admin",
      active: true,
    },
  });

  const restroomData = [
    { name: "Floor 1 - Men", floor: 1, location: "East Wing", badgeId: "B001", status: "good" },
    { name: "Floor 1 - Women", floor: 1, location: "East Wing", badgeId: "B002", status: "good" },
    { name: "Floor 2 - Men", floor: 2, location: "West Wing", badgeId: "B003", status: "alert" },
    { name: "Floor 2 - Women", floor: 2, location: "West Wing", badgeId: "B004", status: "good" },
    { name: "Floor 3 - Accessible", floor: 3, location: "Central", badgeId: "B005", status: "offline" },
  ];

  const createdRestrooms = [];

  for (const room of restroomData) {
    const existing = await prisma.restroom.findUnique({
      where: { badgeId: room.badgeId },
    });

    if (!existing) {
      const item = await prisma.restroom.create({ data: room });
      createdRestrooms.push(item);
    } else {
      createdRestrooms.push(existing);
    }
  }

  const deviceData = [
    { badgeId: "B001", restroomId: createdRestrooms[0].id, battery: 92, status: "online", health: "healthy", lastCommunication: new Date(now.getTime() - 5 * 60 * 1000) },
    { badgeId: "B002", restroomId: createdRestrooms[1].id, battery: 78, status: "online", health: "healthy", lastCommunication: new Date(now.getTime() - 12 * 60 * 1000) },
    { badgeId: "B003", restroomId: createdRestrooms[2].id, battery: 24, status: "online", health: "warning", lastCommunication: new Date(now.getTime() - 3 * 60 * 1000) },
    { badgeId: "B004", restroomId: createdRestrooms[3].id, battery: 65, status: "online", health: "healthy", lastCommunication: new Date(now.getTime() - 8 * 60 * 1000) },
    { badgeId: "B005", restroomId: createdRestrooms[4].id, battery: 8, status: "offline", health: "critical", lastCommunication: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
  ];

  for (const device of deviceData) {
    await prisma.device.upsert({
      where: { badgeId: device.badgeId },
      update: device,
      create: device,
    });
  }

  const alerts = [
    {
      restroomId: createdRestrooms[2].id,
      type: "Unhappy Feedback",
      status: "open",
      time: new Date(now.getTime() - 10 * 60 * 1000),
      assignedToId: admin.id,
    },
    {
      restroomId: createdRestrooms[4].id,
      type: "Device Offline",
      status: "acknowledged",
      time: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      assignedToId: admin.id,
      acknowledgedById: admin.id,
    },
    {
      restroomId: createdRestrooms[2].id,
      type: "Low Battery",
      status: "resolved",
      time: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      assignedToId: admin.id,
      acknowledgedById: admin.id,
      resolvedTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
  ];

  for (const alert of alerts) {
    await prisma.alert.create({ data: alert });
  }

  const feedbackEntries = [
    { restroomId: createdRestrooms[2].id, type: "unhappy", badgeId: "B003", battery: 24, deviceStatus: "online", time: new Date(now.getTime() - 10 * 60 * 1000) },
    { restroomId: createdRestrooms[0].id, type: "happy", badgeId: "B001", battery: 92, deviceStatus: "online", time: new Date(now.getTime() - 25 * 60 * 1000) },
    { restroomId: createdRestrooms[1].id, type: "happy", badgeId: "B002", battery: 78, deviceStatus: "online", time: new Date(now.getTime() - 45 * 60 * 1000) },
    { restroomId: createdRestrooms[3].id, type: "neutral", badgeId: "B004", battery: 65, deviceStatus: "online", time: new Date(now.getTime() - 60 * 60 * 1000) },
    { restroomId: createdRestrooms[2].id, type: "unhappy", badgeId: "B003", battery: 28, deviceStatus: "online", time: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    { restroomId: createdRestrooms[0].id, type: "happy", badgeId: "B001", battery: 94, deviceStatus: "online", time: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
  ];

  for (const entry of feedbackEntries) {
    await prisma.feedbackEntry.create({ data: entry });
  }

  console.log("Dashboard seed data created successfully");
  console.log({
    admin: admin.email,
    restrooms: createdRestrooms.length,
    alerts: alerts.length,
    feedback: feedbackEntries.length,
  });
}

seedDashboardData()
  .catch((error) => {
    console.error("Error seeding dashboard data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
