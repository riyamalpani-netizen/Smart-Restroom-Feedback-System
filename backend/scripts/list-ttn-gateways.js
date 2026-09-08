require('dotenv').config();

const API_KEY  = process.env.TTN_GATEWAY_API_KEY;
const API_BASE = (process.env.TTN_API_BASE_URL || 'https://eu1.cloud.thethings.network').replace(/\/$/, '');
const OWNER_ID = process.env.TTN_GATEWAY_OWNER_ID;

async function main() {
  if (!API_KEY) throw new Error('TTN_GATEWAY_API_KEY not set');

  const url = `${API_BASE}/api/v3/users/${encodeURIComponent(OWNER_ID)}/gateways`;
  console.log(`Listing gateways for user: ${OWNER_ID}\n`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t}`);
  }

  const data = await res.json();
  const gateways = data.gateways || [];

  if (!gateways.length) {
    console.log('No gateways found under this account.');
    return;
  }

  gateways.forEach(g => {
    console.log(`  ID : ${g.ids?.gateway_id}`);
    console.log(`  EUI: ${g.ids?.eui || '(none)'}`);
    console.log(`  Name: ${g.name || '(none)'}`);
    console.log('');
  });
}

main().catch(console.error);
