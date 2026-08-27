const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRaw`select 1`.then(() => console.log('DB_OK')).catch((e) => console.log('DB_ERR', e.message)).finally(() => p.$disconnect());
