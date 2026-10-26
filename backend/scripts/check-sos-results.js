require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const feedback = await prisma.feedback.findMany({
    where: { device: { deviceEui: "2CF7F1C0731005B8" } },
    orderBy: { timestamp: "desc" },
    take: 5,
    select: { id: true, feedbackType: true, battery: true, signalStrength: true, timestamp: true, rawPayload: true },
  });

  console.log("\n=== FEEDBACK RECORDS (last 5) ===");
  if (feedback.length === 0) {
    console.log("  No feedback found for this device EUI.");
    console.log("  → Device may not be in the DB or restroomId is unassigned.");
  }
  feedback.forEach((f) => {
    let sosMode = "n/a";
    try {
      const parsed = JSON.parse(f.rawPayload);
      sosMode = parsed._parsed?.sosMode ?? "n/a";
    } catch (_) {}
    console.log(`  [${f.timestamp.toISOString()}]  feedbackType=${f.feedbackType}  battery=${f.battery}  SOS_mode=${sosMode}`);
  });

  const alerts = await prisma.alert.findMany({
    where: { feedback: { device: { deviceEui: "2CF7F1C0731005B8" } } },
    orderBy: { feedback: { timestamp: "desc" } },
    take: 5,
    select: { id: true, priority: true, status: true },
  });

  console.log("\n=== ALERTS (last 5) ===");
  if (alerts.length === 0) {
    console.log("  No alerts found (expected for happy, or if no needs_cleaning was sent).");
  }
  alerts.forEach((a) => console.log(`  alert=${a.id}  priority=${a.priority}  status=${a.status}`));

  // Also check device lastSeen to confirm device health was updated
  const device = await prisma.device.findUnique({
    where: { deviceEui: "2CF7F1C0731005B8" },
    select: { id: true, batteryLevel: true, lastSeen: true, healthStatus: true, restroomId: true },
  });
  console.log("\n=== DEVICE STATE ===");
  if (!device) {
    console.log("  Device NOT found in DB for EUI 2CF7F1C0731005B8");
    console.log("  → This is why feedback records were not created. Register the device first.");
  } else {
    console.log(`  id=${device.id}`);
    console.log(`  batteryLevel=${device.batteryLevel}  healthStatus=${device.healthStatus}`);
    console.log(`  lastSeen=${device.lastSeen}`);
    console.log(`  restroomId=${device.restroomId ?? "UNASSIGNED (feedback still saved, alert skipped)"}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
