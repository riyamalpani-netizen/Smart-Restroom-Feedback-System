const request = require("supertest");
const { app } = require("../../src/app");
const prisma = require("../../src/config/database");
const { TEST_USER, getAuthHeader } = require("../helpers/authHelper");

describe("Feedback Controller", () => {
  test("GET /api/feedback - should return feedback list", async () => {
    const res = await request(app)
      .get("/api/feedback")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Feedback fetched successfully");
    expect(Array.isArray(res.body.feedback)).toBe(true);
  });

  test("GET /api/feedback - should reject without auth", async () => {
    const res = await request(app).get("/api/feedback");
    expect(res.status).toBe(401);
  });

  test("GET /api/feedback/:id - should return 404 for non-existent feedback", async () => {
    const res = await request(app)
      .get("/api/feedback/non-existent-id")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Feedback not found");
  });
});
