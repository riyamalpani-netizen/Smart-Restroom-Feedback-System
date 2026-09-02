const express = require("express");
const { google } = require("googleapis");
const prisma = require("../config/database");
const { authenticate, authorize } = require("../auth/authMiddleware");
const { encryptAndSerializeConfig, parseAndDecryptConfig } = require("../services/notifications/configEncryption");

const router = express.Router();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || `${process.env.APP_URL || "http://localhost:5000"}/api/notifications/gmail/callback`
  );
}

/**
 * GET /api/notifications/gmail/auth-url
 * Returns the Google OAuth2 consent URL.
 * Frontend opens this in a popup.
 */
router.get("/auth-url", authenticate, authorize("vendor_admin", "super_admin"), (req, res) => {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return res.status(503).json({
      message: "Gmail OAuth2 is not configured on this server. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env",
    });
  }

  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",      // gets refresh_token
    prompt: "consent",           // force consent screen so refresh_token is always returned
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state: req.user?.organizationId || "",
  });

  res.json({ url });
});

/**
 * GET /api/notifications/gmail/callback
 * Google redirects here after the user grants consent.
 * Exchanges the code for tokens and returns them to the opener window.
 */
router.get("/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.send(`
      <script>
        window.opener && window.opener.postMessage(
          { type: "GMAIL_OAUTH_ERROR", error: "${error}" },
          "*"
        );
        window.close();
      </script>
    `);
  }

  if (!code) {
    return res.send(`
      <script>
        window.opener && window.opener.postMessage(
          { type: "GMAIL_OAUTH_ERROR", error: "No authorization code received" },
          "*"
        );
        window.close();
      </script>
    `);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const gmailAddress = userInfo.data.email;

    // Send tokens back to the opener window via postMessage
    // Tokens are sent as-is — the frontend will POST them to save the channel
    const payload = {
      type:         "GMAIL_OAUTH_SUCCESS",
      gmailAddress,
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate:   tokens.expiry_date,
      scope:        tokens.scope,
    };

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Gmail Connected</title></head>
        <body>
          <p style="font-family:sans-serif;text-align:center;margin-top:60px;color:#10b981;">
            ✅ Gmail connected successfully. This window will close automatically.
          </p>
          <script>
            const payload = ${JSON.stringify(payload)};
            if (window.opener) {
              window.opener.postMessage(payload, "*");
            }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Gmail OAuth callback error:", err.message);
    res.send(`
      <script>
        window.opener && window.opener.postMessage(
          { type: "GMAIL_OAUTH_ERROR", error: ${JSON.stringify(err.message)} },
          "*"
        );
        window.close();
      </script>
    `);
  }
});

/**
 * POST /api/notifications/gmail/disconnect/:channelId
 * Revokes the stored Gmail OAuth tokens for a channel.
 */
router.post("/disconnect/:channelId", authenticate, authorize("vendor_admin", "super_admin"), async (req, res) => {
  try {
    const channel = await prisma.notificationChannel.findFirst({
      where: { id: req.params.channelId, organizationId: req.user?.organizationId },
    });
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const config = parseAndDecryptConfig(channel.configuration);

    if (config.accessToken) {
      try {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ access_token: config.accessToken });
        await oauth2Client.revokeCredentials();
      } catch { /* token may already be expired — ignore */ }
    }

    // Clear OAuth tokens from config
    const cleaned = {
      ...config,
      accessToken:  null,
      refreshToken: null,
      expiryDate:   null,
      gmailAddress: null,
      authMode:     null,
    };

    await prisma.notificationChannel.update({
      where: { id: req.params.channelId },
      data: { configuration: encryptAndSerializeConfig(cleaned) },
    });

    res.json({ message: "Gmail disconnected" });
  } catch (err) {
    console.error("Gmail disconnect error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
