const request = require("supertest");
const { app } = require("../../src/app");
const prisma = require("../../src/config/database");
const { TEST_USER, getAuthHeader } = require("../helpers/authHelper");

describe("Test Mode Controller", () => {
  test("POST /api/test-mode/simulate-feedback - should reject without badgeId or deviceEui", async () => {
    const res = await request(app)
      .post("/api/test-mode/simulate-feedback")
      .set("Authorization", getAuthHeader())
      .send({ feedbackType: "happy" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Badge ID or Device EUI is required");
  });

  test("POST /api/test-mode/simulate-feedback - should reject invalid feedback type", async () => {
    const res = await request(app)
      .post("/api/test-mode/simulate-feedback")
      .set("Authorization", getAuthHeader())
      .send({ badgeId: "BADGE-TEST", feedbackType: "invalid_type" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid feedback type. Must be one of: happy, average, needs_cleaning, emergency");
  });

  test("POST /api/test-mode/simulate-feedback - should return 404 for non-existent device", async () => {
    const res = await request(app)
      .post("/api/test-mode/simulate-feedback")
      .set("Authorization", getAuthHeader())
      .send({ badgeId: "BADGE-NONEXISTENT", feedbackType: "happy" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Device not found with provided badge ID or device EUI");
  });

  test("GET /api/test-mode/events - should return test events", async () => {
    const res = await request(app)
      .get("/api/test-mode/events")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Test events fetched successfully");
    expect(res.body.testMode).toBe(true);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  test("GET /api/test-mode/events - should reject without auth", async () => {
    const res = await request(app).get("/api/test-mode/events");
    expect(res.status).toBe(401);
  });

  test("POST /api/test-mode/events/clear - should clear test events", async () => {
    const res = await request(app)
      .post("/api/test-mode/events/clear")
      .set("Authorization", getAuthHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Badge ID or Device EUI is required");
  });

  test("POST /api/test-mode/simulate-feedback - should reject count > 100", async () => {
    const res = await request(app)
      .post("/api/test-mode/simulate-feedback")
      .set("Authorization", getAuthHeader())
      .send({ badgeId: "BADGE-TEST", feedbackType: "happy", count: 101 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Count must be between 1 and 100");
  });

  test("POST /api/test-mode/simulate-feedback - should reject count < 1", async () => {
    const res = await request(app)
      .post("/api/test-mode/simulate-feedback")
      .set("Authorization", getAuthHeader())
      .send({ badgeId: "BADGE-TEST", feedbackType: "happy", count: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Count must be between 1 and 100");
  });
});
