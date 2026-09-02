const prisma = require('../src/config/database');

async function main() {
  const channels = await prisma.notificationChannel.findMany({
    where: { channelType: 'email', provider: 'gmail' },
    select: { id: true, name: true, configuration: true }
  });

  channels.forEach(c => {
    const cfg = JSON.parse(c.configuration || '{}');
    console.log('---');
    console.log('ID:', c.id);
    console.log('Name:', c.name);
    console.log('authMode:', cfg.authMode);
    console.log('hasRefreshToken:', !!cfg.refreshToken);
    console.log('hasAccessToken:', !!cfg.accessToken);
    console.log('gmailAddress:', cfg.gmailAddress);
  });

  if (channels.length === 0) console.log('No Gmail channels found');
}

main().finally(() => prisma.$disconnect());
