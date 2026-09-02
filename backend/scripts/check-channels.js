const prisma = require('../src/config/database');

async function main() {
  const channels = await prisma.notificationChannel.findMany({
    include: { recipients: { select: { recipientValue: true, enabled: true } } }
  });

  if (channels.length === 0) {
    console.log('No notification channels configured in DB yet.');
    return;
  }

  channels.forEach(c => {
    console.log(`\n[${c.channelType}/${c.provider}] "${c.name}" — ${c.enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Recipients: ${c.recipients.map(r => r.recipientValue + (r.enabled ? '' : ' (disabled)')).join(', ') || 'none'}`);
  });

  const logs = await prisma.notificationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('\n--- Last 5 notification logs ---');
  if (logs.length === 0) { console.log('None'); return; }
  logs.forEach(l => console.log(`  ${l.status} | ${l.channelType}/${l.provider} | ${l.eventType} | ${l.recipient} | ${l.createdAt}`));
}

main().finally(() => prisma.$disconnect());
