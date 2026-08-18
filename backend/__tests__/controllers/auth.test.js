const request = require("supertest");
const { app } = require("../../src/app");
const prisma = require("../../src/config/database");

const EXISTING_USER = {
  email: "superadmin@smartrestroom.com",
  password: "SuperAdmin@123",
  role: "super_admin",
};

let authToken;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Auth Controller", () => {
  test("POST /api/auth/login - should login with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: EXISTING_USER.email,
        password: EXISTING_USER.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(EXISTING_USER.email);
    expect(res.body.user.role).toBe(EXISTING_USER.role);
    authToken = res.body.token;
  });

  test("POST /api/auth/login - should reject missing email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "testpassword123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email and password are required");
  });

  test("POST /api/auth/login - should reject missing password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: EXISTING_USER.email });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email and password are required");
  });

  test("POST /api/auth/login - should reject invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: EXISTING_USER.email,
        password: "wrongpassword",
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  test("POST /api/auth/refresh-token - should refresh valid token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh-token")
      .send({ token: authToken });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Token refreshed successfully");
    expect(res.body.token).toBeDefined();
  });

  test("POST /api/auth/refresh-token - should reject invalid token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh-token")
      .send({ token: "invalid-token" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid or expired token");
  });

  test("GET /api/auth/profile - should return profile with valid token", async () => {
    const res = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Profile fetched successfully");
    expect(res.body.user.email).toBe(EXISTING_USER.email);
  });

  test("GET /api/auth/profile - should reject without token", async () => {
    const res = await request(app).get("/api/auth/profile");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Access token required");
  });
});
