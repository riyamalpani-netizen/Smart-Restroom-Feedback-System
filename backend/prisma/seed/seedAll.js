require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function seedAll() {
  const now = new Date();

  const org = await prisma.organization.upsert({
    where: { id: "org-demo" },
    update: {},
    create: {
      id: "org-demo",
      name: "Demo Organization",
      timezone: "UTC",
    },
  });

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "superadmin@smartrestroom.com" },
      update: {},
      create: {
        name: "Super Admin",
        email: "superadmin@smartrestroom.com",
        password: await bcrypt.hash("SuperAdmin@123", 10),
        role: "super_admin",
        active: true,
        organizationId: org.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "vendor@smartrestroom.com" },
      update: {},
      create: {
        name: "Vendor Admin",
        email: "vendor@smartrestroom.com",
        password: await bcrypt.hash("Vendor@123", 10),
        role: "vendor_admin",
        active: true,
        organizationId: org.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "facility@smartrestroom.com" },
      update: {},
      create: {
        name: "Facility Manager",
        email: "facility@smartrestroom.com",
        password: await bcrypt.hash("Facility@123", 10),
        role: "facility_manager",
        active: true,
        organizationId: org.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "viewer@smartrestroom.com" },
      update: {},
      create: {
        name: "Viewer",
        email: "viewer@smartrestroom.com",
        password: await bcrypt.hash("Viewer@123", 10),
        role: "viewer",
        active: true,
        organizationId: org.id,
      },
    }),
  ]);

  console.log("Seed completed successfully!");
  console.log({
    organization: org.name,
    users: users.map((u) => ({ email: u.email, role: u.role })),
  });
}

seedAll()
  .catch((error) => {
    console.error("Error seeding data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
