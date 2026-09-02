const crypto = require("crypto");

/**
 * configEncryption — AES-256-GCM symmetric encryption for provider configuration objects.
 *
 * The encryption key is derived from NOTIFICATION_ENCRYPTION_KEY in .env.
 * If not set, falls back to a key derived from JWT_SECRET (not ideal for production —
 * set NOTIFICATION_ENCRYPTION_KEY explicitly in production environments).
 *
 * Fields treated as secrets (encrypted at the field level, not the whole object):
 *   password, appPassword, smtpPassword, authToken, clientSecret, refreshToken,
 *   accessToken, apiKey, signingSecret, headerValue (when used as auth)
 *
 * The full config JSON is stored as ciphertext in NotificationChannel.configuration.
 * Only the backend ever decrypts it — the frontend never receives raw secrets.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

const SECRET_FIELDS = new Set([
  "password",
  "appPassword",
  "smtpPassword",
  "authToken",
  "clientSecret",
  "refreshToken",
  "accessToken",
  "apiKey",
  "signingSecret",
  "webhookSecret",
  "headerValue",
]);

function getEncryptionKey() {
  const raw = process.env.NOTIFICATION_ENCRYPTION_KEY || process.env.JWT_SECRET || "default-dev-key-change-in-prod";
  // Derive a 32-byte key via SHA-256
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypt a string value.
 * Returns a hex string: IV_HEX:TAG_HEX:CIPHERTEXT_HEX
 */
function encryptValue(plaintext) {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value previously encrypted with encryptValue.
 * Returns the original plaintext string, or null on failure.
 */
function decryptValue(ciphertext) {
  if (!ciphertext) return ciphertext;
  // If it doesn't look like our format, return as-is (legacy plain values)
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext;

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const data = Buffer.from(parts[2], "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
  } catch {
    // Return null instead of throwing — caller decides how to handle
    return null;
  }
}

/**
 * Encrypt all secret fields in a config object (in-place clone).
 * Non-secret fields are passed through unchanged.
 *
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>}
 */
function encryptConfig(config) {
  if (!config || typeof config !== "object") return config;
  const result = { ...config };
  for (const [key, value] of Object.entries(result)) {
    if (SECRET_FIELDS.has(key) && value) {
      result[key] = encryptValue(String(value));
    }
  }
  return result;
}

/**
 * Decrypt all secret fields in a config object (in-place clone).
 *
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>}
 */
function decryptConfig(config) {
  if (!config || typeof config !== "object") return config;
  const result = { ...config };
  for (const [key, value] of Object.entries(result)) {
    if (SECRET_FIELDS.has(key) && value) {
      result[key] = decryptValue(String(value));
    }
  }
  return result;
}

/**
 * Strip all secret fields from a config before sending to the frontend.
 * Replaces values with a redacted sentinel so the UI knows the field is set.
 *
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>}
 */
function redactConfig(config) {
  if (!config || typeof config !== "object") return config;
  const result = { ...config };
  for (const key of Object.keys(result)) {
    if (SECRET_FIELDS.has(key) && result[key]) {
      result[key] = "••••••••"; // sentinel — never the actual value
    }
  }
  return result;
}

/**
 * Parse the stored JSON configuration string and decrypt it.
 *
 * @param {string} configStr  — raw value from DB (JSON string)
 * @returns {Record<string, unknown>}
 */
function parseAndDecryptConfig(configStr) {
  try {
    const parsed = JSON.parse(configStr || "{}");
    return decryptConfig(parsed);
  } catch {
    return {};
  }
}

/**
 * Encrypt a config object and serialize to JSON string for DB storage.
 *
 * @param {Record<string, unknown>} configObj
 * @returns {string}
 */
function encryptAndSerializeConfig(configObj) {
  const encrypted = encryptConfig(configObj || {});
  return JSON.stringify(encrypted);
}

module.exports = {
  encryptValue,
  decryptValue,
  encryptConfig,
  decryptConfig,
  redactConfig,
  parseAndDecryptConfig,
  encryptAndSerializeConfig,
  SECRET_FIELDS,
};
