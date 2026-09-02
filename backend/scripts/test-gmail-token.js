require('dotenv').config();
const prisma = require('../src/config/database');
const { parseAndDecryptConfig } = require('../src/services/notifications/configEncryption');
const { google } = require('googleapis');

async function main() {
  const channel = await prisma.notificationChannel.findFirst({
    where: { channelType: 'email', provider: 'gmail' }
  });

  const cfg = parseAndDecryptConfig(channel.configuration);
  console.log('authMode:', cfg.authMode);
  console.log('gmailAddress:', cfg.gmailAddress);
  console.log('refreshToken (first 20):', cfg.refreshToken?.substring(0, 20));
  console.log('accessToken (first 20):', cfg.accessToken?.substring(0, 20));

  // Try to get a fresh access token
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    refresh_token: cfg.refreshToken,
    access_token: cfg.accessToken,
    expiry_date: cfg.expiryDate,
  });

  try {
    const { token } = await oauth2Client.getAccessToken();
    console.log('Fresh access token obtained:', !!token, '— first 20:', token?.substring(0, 20));
  } catch (e) {
    console.error('Token refresh failed:', e.message);
  }
}

main().finally(() => prisma.$disconnect());
