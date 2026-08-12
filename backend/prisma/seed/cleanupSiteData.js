require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function cleanupSiteData() {
  const locations = await prisma.location.findMany({
    include: {
      floors: {
        include: {
          restrooms: true,
          floorPlans: true,
          zones: {
            include: {
              devices: true,
            },
          },
          devices: true,
        },
      },
    },
  });

  if (locations.length === 0) {
    console.log("No locations found. Nothing to clean up.");
    return;
  }

  console.log(`Found ${locations.length} location(s) to clean up.`);

  for (const location of locations) {
    console.log(`\nCleaning up location: ${location.officeName} (${location.id})`);

    for (const floor of location.floors) {
      console.log(`  Floor: ${floor.floorName} (${floor.id})`);

      const deviceIds = [
        ...floor.devices.map((d) => d.id),
        ...floor.zones.flatMap((z) => z.devices.map((d) => d.id)),
      ];
      const restroomIds = floor.restrooms.map((r) => r.id);
      const zoneIds = floor.zones.map((z) => z.id);
      const floorPlanIds = floor.floorPlans.map((fp) => fp.id);

      if (restroomIds.length > 0) {
        const alerts = await prisma.alert.findMany({
          where: { restroomId: { in: restroomIds } },
          select: { id: true },
        });
        const alertIds = alerts.map((a) => a.id);

        if (alertIds.length > 0) {
          const notifications = await prisma.notification.deleteMany({
            where: { alertId: { in: alertIds } },
          });
          console.log(
            `    Deleted ${notifications.count} notifications for alerts`
          );

          const deletedAlerts = await prisma.alert.deleteMany({
            where: { id: { in: alertIds } },
          });
          console.log(`    Deleted ${deletedAlerts.count} alerts`);
        }
      }

      if (deviceIds.length > 0) {
        const deviceHealthRecords = await prisma.deviceHealthRecord.deleteMany({
          where: { deviceId: { in: deviceIds } },
        });
        console.log(
          `    Deleted ${deviceHealthRecords.count} device health records`
        );

        const feedbacks = await prisma.feedback.deleteMany({
          where: { deviceId: { in: deviceIds } },
        });
        console.log(`    Deleted ${feedbacks.count} feedback entries`);

        await prisma.device.updateMany({
          where: { id: { in: deviceIds } },
          data: { zoneId: null, restroomId: null },
        });
        const devices = await prisma.device.deleteMany({
          where: { id: { in: deviceIds } },
        });
        console.log(`    Deleted ${devices.count} devices`);
      }

      if (zoneIds.length > 0) {
        const zones = await prisma.zone.deleteMany({
          where: { id: { in: zoneIds } },
        });
        console.log(`    Deleted ${zones.count} zones`);
      }

      if (floorPlanIds.length > 0) {
        const floorPlans = await prisma.floorPlan.deleteMany({
          where: { id: { in: floorPlanIds } },
        });
        console.log(`    Deleted ${floorPlans.count} floor plans`);
      }

      if (restroomIds.length > 0) {
        const restrooms = await prisma.restroom.deleteMany({
          where: { id: { in: restroomIds } },
        });
        console.log(`    Deleted ${restrooms.count} restrooms`);
      }
    }

    const floors = await prisma.floor.deleteMany({
      where: { locationId: location.id },
    });
    console.log(`  Deleted ${floors.count} floors`);

    const deletedLocation = await prisma.location.delete({
      where: { id: location.id },
    });
    console.log(`  Deleted location: ${deletedLocation.officeName}`);
  }

  console.log("\nSite configuration data cleaned up successfully!");
}

cleanupSiteData()
  .catch((error) => {
    console.error("Error cleaning up site data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
