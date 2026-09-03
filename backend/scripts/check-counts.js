const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const [u, o, l, f, d, g, r, fb, a] = await Promise.all([
    p.user.count(),
    p.organization.count(),
    p.location.count(),
    p.floor.count(),
    p.device.count(),
    p.gateway.count(),
    p.restroom.count(),
    p.feedback.count(),
    p.alert.count(),
  ])
  console.log('users:', u, '| orgs:', o, '| sites:', l, '| floors:', f, '| devices:', d, '| gateways:', g, '| restrooms:', r, '| feedback:', fb, '| alerts:', a)
  await p.$disconnect()
}
main().catch(e => { console.error(e); p.$disconnect() })
