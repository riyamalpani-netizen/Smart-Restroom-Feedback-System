require("dotenv").config();

const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { DATABASE_URL } = require("./env");

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Add it to backend/.env before starting the backend.");
}

// Use a connection pool so concurrent requests each get their own connection.
// A single pg.Client shared across async requests triggers the pg@9 deprecation
// warning: "Calling client.query() when the client is already executing a query".
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;
