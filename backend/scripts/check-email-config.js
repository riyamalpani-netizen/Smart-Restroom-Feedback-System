require("dotenv").config();
const prisma = require("../src/config/database");

async function main() {
  // Check new-style email channels
  const channels = await prisma.notificationChannel.findMany({
    where: { channelType: "email" },
    select: { id: true, name: true, provider: true, enabled: true, organizationId: true },
  });
  console.log("\n=== Email Notification Channels ===");
  console.log(JSON.stringify(channels, null, 2));

  // Check all channels (any type)
  const allChannels = await prisma.notificationChannel.findMany({
    select: { id: true, name: true, channelType: true, provider: true, enabled: true, organizationId: true },
  });
  console.log("\n=== All Notification Channels ===");
  console.log(JSON.stringify(allChannels, null, 2));

  // Check legacy settings
  const settings = await prisma.settings.findMany({
    select: { organizationId: true, teamsWebhook: true, teamsRecipient: true },
  });
  console.log("\n=== Settings (legacy webhook) ===");
  console.log(JSON.stringify(settings, null, 2));

  // Check notification logs (last 5)
  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { eventType: true, channelType: true, provider: true, recipient: true, status: true, error: true, createdAt: true },
  });
  console.log("\n=== Last 5 Notification Logs ===");
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
