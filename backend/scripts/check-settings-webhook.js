require("dotenv").config();
const prisma = require("../src/config/database");

async function main() {
  const settings = await prisma.settings.findMany({
    select: {
      organizationId: true,
      teamsWebhook: true,
      teamsRecipient: true,
      organization: { select: { name: true } },
    },
  });

  console.log(`\nSettings records (${settings.length} total):\n`);
  settings.forEach(s => {
    console.log(`  Org: ${s.organization?.name || s.organizationId}`);
    console.log(`  teamsWebhook: ${s.teamsWebhook || "NOT SET"}`);
    console.log(`  teamsRecipient: ${s.teamsRecipient || "NOT SET"}`);
    console.log();
  });

  // Check notificationChannels state
  const channels = await prisma.notificationChannel.findMany({
    select: { name: true, provider: true, enabled: true, organizationId: true },
  });
  console.log(`NotificationChannels (${channels.length} total):`);
  channels.forEach(c => console.log(`  [${c.enabled ? "ON" : "OFF"}] ${c.name} | ${c.provider} | org: ${c.organizationId}`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
