const request = require("supertest");
const { app } = require("../../src/app");
const prisma = require("../../src/config/database");
const { TEST_USER, getAuthHeader } = require("../helpers/authHelper");

describe("Device Controller", () => {
  test("GET /api/devices - should return devices list", async () => {
    const res = await request(app)
      .get("/api/devices")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Devices fetched successfully");
    expect(Array.isArray(res.body.devices)).toBe(true);
  });

  test("GET /api/devices/offline - should return offline devices", async () => {
    const res = await request(app)
      .get("/api/devices/offline")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Offline devices fetched successfully");
    expect(Array.isArray(res.body.devices)).toBe(true);
  });

  test("GET /api/devices/:id - should return 404 for non-existent device", async () => {
    const res = await request(app)
      .get("/api/devices/non-existent-id")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Device not found");
  });

  test("GET /api/devices - should reject without auth", async () => {
    const res = await request(app).get("/api/devices");
    expect(res.status).toBe(401);
  });

  test("POST /api/devices - should reject without required fields", async () => {
    const res = await request(app)
      .post("/api/devices")
      .set("Authorization", getAuthHeader())
      .send({});

    expect(res.status).toBe(400);
  });
});
