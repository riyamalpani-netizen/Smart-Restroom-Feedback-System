/**
 * Tries to find and delete a gateway across all TTN clusters.
 * Usage: node scripts/find-delete-gateway-all-clusters.js ritesh-mineuw-gateway-002
 */
require('dotenv').config();

const GATEWAY_ID = process.argv[2];
if (!GATEWAY_ID) { console.error('Usage: node find-delete-gateway-all-clusters.js <ttn-gateway-id>'); process.exit(1); }

const CLUSTERS = [
  'https://eu1.cloud.thethings.network',
  'https://nam1.cloud.thethings.network',
  'https://au1.cloud.thethings.network',
];

const KEYS = [
  process.env.TTN_GATEWAY_API_KEY,
  process.env.TTN_USER_API_KEY,
  process.env.TTN_API_KEY,
].filter(Boolean);

async function tryRequest(url, key, method) {
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}` },
    });
    return { status: res.status, body: res.status !== 204 ? await res.text() : '' };
  } catch (e) {
    return { status: 0, body: e.message };
  }
}

async function main() {
  for (const cluster of CLUSTERS) {
    const url = `${cluster}/api/v3/gateways/${encodeURIComponent(GATEWAY_ID)}`;
    console.log(`\nChecking ${cluster}...`);

    for (const key of KEYS) {
      const keyLabel = key.slice(0, 20) + '...';

      // Try GET first
      const get = await tryRequest(url, key, 'GET');
      if (get.status === 200) {
        console.log(`  FOUND with key ${keyLabel}`);
        // Try DELETE
        const del = await tryRequest(url, key, 'DELETE');
        if (del.status === 200 || del.status === 204) {
          console.log(`  ✓ DELETED successfully`);
        } else {
          console.log(`  ✗ Delete failed (${del.status}): ${del.body.slice(0, 150)}`);
        }
        break;
      } else if (get.status === 404) {
        console.log(`  Not found on this cluster`);
        break;
      } else if (get.status === 403) {
        console.log(`  Exists but no rights with key ${keyLabel} (${get.status})`);
      } else {
        console.log(`  ${get.status} with key ${keyLabel}: ${get.body.slice(0, 80)}`);
      }
    }
  }
  console.log('\nDone.');
}

main().catch(console.error);
