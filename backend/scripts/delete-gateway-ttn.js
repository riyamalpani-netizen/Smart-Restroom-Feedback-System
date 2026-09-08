/**
 * Deletes a gateway from TTN using the personal user API key (TTN_USER_API_KEY)
 * which has broader rights than the gateway-specific key.
 * Usage: node scripts/delete-gateway-ttn.js ritesh-mineuw-gateway-002
 */
require('dotenv').config();

const GATEWAY_ID = process.argv[2];
if (!GATEWAY_ID) { console.error('Usage: node delete-gateway-ttn.js <ttn-gateway-id>'); process.exit(1); }

const API_KEY    = process.env.TTN_USER_API_KEY;
const API_BASE   = (process.env.TTN_API_BASE_URL || 'https://eu1.cloud.thethings.network').replace(/\/$/, '');

async function main() {
  if (!API_KEY) throw new Error('TTN_USER_API_KEY not set in .env');

  const url = `${API_BASE}/api/v3/gateways/${encodeURIComponent(GATEWAY_ID)}`;
  console.log(`Deleting ${GATEWAY_ID} from TTN...`);

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (res.ok || res.status === 204) {
    console.log(`✓ Deleted successfully`);
  } else if (res.status === 404) {
    console.log(`Gateway not found on TTN (already deleted or never existed)`);
  } else {
    const t = await res.text();
    console.error(`✗ Failed (${res.status}): ${t}`);
  }
}

main().catch(console.error);
