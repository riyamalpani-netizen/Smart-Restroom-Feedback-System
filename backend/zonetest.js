require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const zoneController = require('./src/controllers/zoneController');
const restroomController = require('./src/controllers/restroomController');

async function findFloor() {
  return prisma.floor.findFirst({ include: { location: true } });
}

function fakeRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

async function main() {
  const floor = await findFloor();
  if (!floor) { console.log('NO_FLOOR'); await prisma.$disconnect(); return; }
  console.log('FLOOR', floor.id, 'org', floor.location?.organizationId);

  // Test 1: super_admin create zone
  for (const role of ['super_admin', 'site_incharge', 'regional_manager', 'vendor_manager', 'facility_manager']) {
    const req = {
      user: { role, organizationId: floor.location?.organizationId },
      body: {
        floorId: floor.id,
        name: 'TestZone_' + role,
        type: 'restroom',
        coordinates: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] },
        latitude: 30.73,
        longitude: 76.77,
      },
    };
    const res = fakeRes();
    try {
      await zoneController.createZone(req, res);
      console.log(role, '->', res.statusCode, JSON.stringify(res.body).slice(0, 120));
    } catch (e) {
      console.log(role, 'THREW', e.message);
    }
  }
  await prisma.$disconnect();
}
main();
