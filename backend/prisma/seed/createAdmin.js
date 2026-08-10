require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function createAdmin() {
  const password = "Admin@123";

  const hashedPassword = await bcrypt.hash(password, 10);

  const organization = await prisma.organization.upsert({
    where: { id: "org-admin" },
    update: {},
    create: {
      id: "org-admin",
      name: "Smart Restroom Admin Organization",
      timezone: "UTC",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@smartrestroom.com" },
    update: {
      password: hashedPassword,
      role: "super_admin",
      active: true,
    },
    create: {
      name: "Super Admin",
      email: "admin@smartrestroom.com",
      password: hashedPassword,
      role: "super_admin",
      active: true,
      organizationId: organization.id,
    },
  });

  await prisma.settings.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
    },
  });

  console.log("Super Admin created successfully!");
  console.log({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    organizationId: admin.organizationId,
  });
}

createAdmin()
  .catch((error) => {
    console.error("Error creating Super Admin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
