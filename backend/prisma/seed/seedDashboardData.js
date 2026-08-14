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

  const organization = await prisma.organization.upsert({
    where: { id: "org-demo-1" },
    update: {},
    create: {
      id: "org-demo-1",
      name: "Demo Organization",
      address: "123 Main Street",
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
      organizationId: organization.id,
    },
  });

  const eastWing = await prisma.location.upsert({
    where: { id: "loc-east" },
    update: {},
    create: {
      id: "loc-east",
      organizationId: organization.id,
      city: "East Wing",
      officeName: "East Wing",
    },
  });

  const westWing = await prisma.location.upsert({
    where: { id: "loc-west" },
    update: {},
    create: {
      id: "loc-west",
      organizationId: organization.id,
      city: "West Wing",
      officeName: "West Wing",
    },
  });

  const central = await prisma.location.upsert({
    where: { id: "loc-central" },
    update: {},
    create: {
      id: "loc-central",
      organizationId: organization.id,
      city: "Central",
      officeName: "Central",
    },
  });

  const floor1East = await prisma.floor.upsert({
    where: { id: "floor-1-east" },
    update: {},
    create: {
      id: "floor-1-east",
      locationId: eastWing.id,
      floorName: "Floor 1",
      floorNumber: 1,
    },
  });

  const floor2West = await prisma.floor.upsert({
    where: { id: "floor-2-west" },
    update: {},
    create: {
      id: "floor-2-west",
      locationId: westWing.id,
      floorName: "Floor 2",
      floorNumber: 2,
    },
  });

  const floor3Central = await prisma.floor.upsert({
    where: { id: "floor-3-central" },
    update: {},
    create: {
      id: "floor-3-central",
      locationId: central.id,
      floorName: "Floor 3",
      floorNumber: 3,
    },
  });

  const restroomData = [
    { id: "r1", name: "Floor 1 - Men", floorId: floor1East.id, organizationId: organization.id, status: "good" },
    { id: "r2", name: "Floor 1 - Women", floorId: floor1East.id, organizationId: organization.id, status: "good" },
    { id: "r3", name: "Floor 2 - Men", floorId: floor2West.id, organizationId: organization.id, status: "alert" },
    { id: "r4", name: "Floor 2 - Women", floorId: floor2West.id, organizationId: organization.id, status: "good" },
    { id: "r5", name: "Floor 3 - Accessible", floorId: floor3Central.id, organizationId: organization.id, status: "offline" },
  ];

  const createdRestrooms = [];
  for (const room of restroomData) {
    const existing = await prisma.restroom.findUnique({
      where: { id: room.id },
    });

    if (!existing) {
      const item = await prisma.restroom.create({ data: room });
      createdRestrooms.push(item);
    } else {
      createdRestrooms.push(existing);
    }
  }

  const deviceData = [
    { id: "d1", deviceEui: "EUI-001", badgeId: "B001", restroomId: createdRestrooms[0].id, floorId: createdRestrooms[0].floorId, batteryLevel: 92, healthStatus: "healthy", lastSeen: new Date(now.getTime() - 5 * 60 * 1000) },
    { id: "d2", deviceEui: "EUI-002", badgeId: "B002", restroomId: createdRestrooms[1].id, floorId: createdRestrooms[1].floorId, batteryLevel: 78, healthStatus: "healthy", lastSeen: new Date(now.getTime() - 12 * 60 * 1000) },
    { id: "d3", deviceEui: "EUI-003", badgeId: "B003", restroomId: createdRestrooms[2].id, floorId: createdRestrooms[2].floorId, batteryLevel: 24, healthStatus: "warning", lastSeen: new Date(now.getTime() - 3 * 60 * 1000) },
    { id: "d4", deviceEui: "EUI-004", badgeId: "B004", restroomId: createdRestrooms[3].id, floorId: createdRestrooms[3].floorId, batteryLevel: 65, healthStatus: "healthy", lastSeen: new Date(now.getTime() - 8 * 60 * 1000) },
    { id: "d5", deviceEui: "EUI-005", badgeId: "B005", restroomId: createdRestrooms[4].id, floorId: createdRestrooms[4].floorId, batteryLevel: 8, healthStatus: "critical", lastSeen: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
  ];

  for (const device of deviceData) {
    await prisma.device.upsert({
      where: { badgeId: device.badgeId },
      update: device,
      create: device,
    });
  }

  const createdDevices = await prisma.device.findMany({
    where: { badgeId: { in: deviceData.map((d) => d.badgeId) } },
  });

  const feedbackEntries = [
    { id: "f1", deviceId: createdDevices[2].id, restroomId: createdRestrooms[2].id, feedbackType: "needs_cleaning", battery: 24, signalStrength: 80, timestamp: new Date(now.getTime() - 10 * 60 * 1000) },
    { id: "f2", deviceId: createdDevices[0].id, restroomId: createdRestrooms[0].id, feedbackType: "happy", battery: 92, signalStrength: 90, timestamp: new Date(now.getTime() - 25 * 60 * 1000) },
    { id: "f3", deviceId: createdDevices[1].id, restroomId: createdRestrooms[1].id, feedbackType: "happy", battery: 78, signalStrength: 85, timestamp: new Date(now.getTime() - 45 * 60 * 1000) },
    { id: "f4", deviceId: createdDevices[3].id, restroomId: createdRestrooms[3].id, feedbackType: "average", battery: 65, signalStrength: 70, timestamp: new Date(now.getTime() - 60 * 60 * 1000) },
    { id: "f5", deviceId: createdDevices[2].id, restroomId: createdRestrooms[2].id, feedbackType: "emergency", battery: 28, signalStrength: 60, timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    { id: "f6", deviceId: createdDevices[0].id, restroomId: createdRestrooms[0].id, feedbackType: "happy", battery: 94, signalStrength: 92, timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
    { id: "f7", deviceId: createdDevices[4].id, restroomId: createdRestrooms[4].id, feedbackType: "needs_cleaning", battery: 8, signalStrength: 40, timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
    { id: "f8", deviceId: createdDevices[1].id, restroomId: createdRestrooms[1].id, feedbackType: "emergency", battery: 76, signalStrength: 88, timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
    { id: "f9", deviceId: createdDevices[3].id, restroomId: createdRestrooms[3].id, feedbackType: "needs_cleaning", battery: 55, signalStrength: 72, timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
    { id: "f10", deviceId: createdDevices[0].id, restroomId: createdRestrooms[0].id, feedbackType: "emergency", battery: 88, signalStrength: 95, timestamp: new Date(now.getTime() - 7 * 60 * 60 * 1000) },
  ];

  const createdFeedback = [];
  for (const entry of feedbackEntries) {
    const existing = await prisma.feedback.findUnique({
      where: { id: entry.id },
    });

    if (!existing) {
      const feedback = await prisma.feedback.create({ data: entry });
      createdFeedback.push(feedback);
    } else {
      createdFeedback.push(existing);
    }
  }

  const alerts = [
    {
      id: "a1",
      feedbackId: createdFeedback[0].id,
      restroomId: createdRestrooms[2].id,
      status: "open",
      priority: "high",
      assignedToId: admin.id,
      createdAt: new Date(now.getTime() - 10 * 60 * 1000),
    },
    {
      id: "a2",
      feedbackId: createdFeedback[4].id,
      restroomId: createdRestrooms[2].id,
      status: "assigned",
      priority: "critical",
      assignedToId: admin.id,
      acknowledgedById: admin.id,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      id: "a3",
      feedbackId: createdFeedback[6].id,
      restroomId: createdRestrooms[4].id,
      status: "open",
      priority: "medium",
      assignedToId: admin.id,
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      id: "a4",
      feedbackId: createdFeedback[7].id,
      restroomId: createdRestrooms[1].id,
      status: "in_progress",
      priority: "high",
      assignedToId: admin.id,
      acknowledgedById: admin.id,
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      id: "a5",
      feedbackId: createdFeedback[8].id,
      restroomId: createdRestrooms[3].id,
      status: "open",
      priority: "medium",
      assignedToId: admin.id,
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      id: "a6",
      feedbackId: createdFeedback[9].id,
      restroomId: createdRestrooms[0].id,
      status: "assigned",
      priority: "critical",
      assignedToId: admin.id,
      acknowledgedById: admin.id,
      createdAt: new Date(now.getTime() - 7 * 60 * 60 * 1000),
    },
  ];

  await prisma.alert.deleteMany({
    where: {
      id: {
        in: alerts.map((a) => a.id),
      },
    },
  });

  for (const alert of alerts) {
    await prisma.alert.create({ data: alert });
  }

  console.log("Dashboard seed data created successfully");
  console.log({
    admin: admin.email,
    organization: organization.name,
    locations: 3,
    floors: 3,
    restrooms: createdRestrooms.length,
    devices: createdDevices.length,
    alerts: alerts.length,
    feedback: createdFeedback.length,
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
