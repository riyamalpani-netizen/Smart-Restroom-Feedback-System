const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Vendor admin users
  const admins = await prisma.user.findMany({
    where: { role: 'vendor_admin' },
    select: { id: true, email: true, name: true, active: true, organizationId: true }
  });
  console.log('=== VENDOR ADMINS ===');
  console.log(JSON.stringify(admins, null, 2));

  // 2. Devices and whether they have a restroomId
  const devices = await prisma.device.findMany({
    select: { id: true, deviceEui: true, badgeId: true, restroomId: true, organizationId: true }
  });
  console.log('\n=== DEVICES (restroomId check) ===');
  console.log(JSON.stringify(devices, null, 2));

  // 3. NotificationChannels — if any exist they suppress legacy track B
  const channels = await prisma.notificationChannel.findMany({
    select: { id: true, organizationId: true, channelType: true, provider: true, enabled: true }
  });
  console.log('\n=== NOTIFICATION CHANNELS ===');
  console.log(JSON.stringify(channels, null, 2));

  // 4. Settings (teamsWebhook per org)
  const settings = await prisma.settings.findMany({
    select: { organizationId: true, teamsWebhook: true, teamsRecipient: true }
  });
  console.log('\n=== SETTINGS (teams) ===');
  console.log(JSON.stringify(settings, null, 2));

  // 5. Recent alerts + their notification records
  const alerts = await prisma.alert.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { notifications: true }
  });
  console.log('\n=== RECENT ALERTS + NOTIFICATIONS ===');
  console.log(JSON.stringify(alerts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
