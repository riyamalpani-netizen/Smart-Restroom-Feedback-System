const request = require("supertest");
const { app } = require("../../src/app");
const prisma = require("../../src/config/database");
const { getAuthHeader } = require("../helpers/authHelper");

const timestamp = Date.now();
const TEST_GATEWAY_EUI = `AABBCCDDEEFF${(timestamp % 10000).toString().padStart(4, '0')}`;
const TEST_GATEWAY_NAME = `TEST-GW-${timestamp}`;

describe("Gateway Controller", () => {
  let createdGatewayId;

  afterAll(async () => {
    if (createdGatewayId) {
      try {
        await prisma.gateway.deleteMany({
          where: { name: { startsWith: "TEST-GW-" } },
        });
      } catch (e) {
        // ignore cleanup errors
      }
    }
  });

  test("GET /api/gateway - should return gateways list", async () => {
    const res = await request(app)
      .get("/api/gateway")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Gateways fetched successfully");
    expect(Array.isArray(res.body.gateways)).toBe(true);
  });

  test("GET /api/gateway/gateway-status - should return gateway status", async () => {
    const res = await request(app)
      .get("/api/gateway/gateway-status")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Gateway status fetched successfully");
    expect(Array.isArray(res.body.gateways)).toBe(true);
  });

  test("GET /api/gateway/network-status - should return network status", async () => {
    const res = await request(app)
      .get("/api/gateway/network-status")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Network status fetched successfully");
    expect(res.body.gateways).toBeDefined();
    expect(res.body.devices).toBeDefined();
  });

  test("GET /api/gateway/server-status - should return server status", async () => {
    const res = await request(app)
      .get("/api/gateway/server-status")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Server status fetched successfully");
    expect(res.body.server.status).toBe("operational");
    expect(res.body.server.uptime).toBeDefined();
  });

  test("GET /api/gateway/offline-devices - should return offline devices", async () => {
    const res = await request(app)
      .get("/api/gateway/offline-devices")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Offline devices fetched successfully");
    expect(Array.isArray(res.body.devices)).toBe(true);
  });

  test("GET /api/gateway/incident-log - should return incident log", async () => {
    const res = await request(app)
      .get("/api/gateway/incident-log")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Incident log fetched successfully");
    expect(Array.isArray(res.body.incidents)).toBe(true);
  });

  test("GET /api/gateway/recovery-status - should return recovery status", async () => {
    const res = await request(app)
      .get("/api/gateway/recovery-status")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Recovery status fetched successfully");
    expect(res.body.devices).toBeDefined();
    expect(res.body.gateways).toBeDefined();
  });

  test("POST /api/gateway - should create gateway with valid data", async () => {
    const res = await request(app)
      .post("/api/gateway")
      .set("Authorization", getAuthHeader())
      .send({
        name: TEST_GATEWAY_NAME,
        gatewayEui: TEST_GATEWAY_EUI,
        frequencyPlanId: "EU_863_870",
      });

    if (res.status === 201) {
      createdGatewayId = res.body.gateway.id;
    }

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Gateway created successfully");
    expect(res.body.gateway.name).toBe(TEST_GATEWAY_NAME);
    expect(res.body.gateway.gatewayEui).toBe(TEST_GATEWAY_EUI);
  });

  test("POST /api/gateway - should reject missing name", async () => {
    const res = await request(app)
      .post("/api/gateway")
      .set("Authorization", getAuthHeader())
      .send({
        gatewayEui: TEST_GATEWAY_EUI,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Gateway name and EUI are required");
  });

  test("POST /api/gateway - should reject invalid EUI format", async () => {
    const res = await request(app)
      .post("/api/gateway")
      .set("Authorization", getAuthHeader())
      .send({
        name: TEST_GATEWAY_NAME,
        gatewayEui: "INVALID",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Gateway EUI must be exactly 16 hexadecimal characters");
  });

  test("GET /api/gateway/:id - should return 404 for non-existent gateway", async () => {
    const res = await request(app)
      .get("/api/gateway/non-existent-id")
      .set("Authorization", getAuthHeader());

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Gateway not found");
  });

  test("GET /api/gateway - should reject without auth", async () => {
    const res = await request(app).get("/api/gateway");
    expect(res.status).toBe(401);
  });
});
