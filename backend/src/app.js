const express = require("express");
const cors = require("cors");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const prisma = require("./config/database");
const { connectMQTT, disconnectMQTT } = require("./services/mqttService");
const { initializeSocket } = require("./utils/socket");
const { startCronJobs, stopCronJobs } = require("./services/cronService");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const authRoutes = require("./auth/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const locationRoutes = require("./routes/locationRoutes");
const floorRoutes = require("./routes/floorRoutes");
const floorPlanRoutes = require("./routes/floorPlanRoutes");
const zoneRoutes = require("./routes/zoneRoutes");
const restroomRoutes = require("./routes/restroomRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const alertRoutes = require("./routes/alertRoutes");
const reportRoutes = require("./routes/reportRoutes");
const userRoutes = require("./users/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const gatewayRoutes = require("./routes/gatewayRoutes");
const { JWT_SECRET, NODE_ENV } = require("./config/env");
const logger = require("./middleware/logger");
const http = require("http");

const app = express();

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Restroom Feedback System API",
      version: "1.0.0",
      description: "API documentation for the Smart Restroom Feedback System",
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 5000}` },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["super_admin", "vendor_admin", "facility_manager", "viewer"] },
            active: { type: "boolean" },
          },
        },
        Feedback: {
          type: "object",
          properties: {
            id: { type: "string" },
            feedbackType: { type: "string", enum: ["happy", "average", "needs_cleaning", "emergency"] },
            timestamp: { type: "string", format: "date-time" },
            battery: { type: "integer" },
            signalStrength: { type: "integer" },
          },
        },
        Alert: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string", enum: ["open", "assigned", "in_progress", "closed"] },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login user",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } },
            },
          },
          responses: {
            "200": { description: "Login successful", content: { "application/json": { schema: { type: "object" } } } },
            "401": { description: "Invalid credentials" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout user",
          responses: { "200": { description: "Logout successful" } },
        },
      },
      "/api/auth/refresh-token": {
        post: {
          tags: ["Auth"],
          summary: "Refresh JWT token",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } },
          },
          responses: { "200": { description: "Token refreshed" } },
        },
      },
      "/api/auth/profile": {
        get: {
          tags: ["Auth"],
          summary: "Get current user profile",
          responses: { "200": { description: "Profile fetched" } },
        },
      },
      "/api/dashboard": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard data",
          responses: { "200": { description: "Dashboard data" } },
        },
      },
      "/api/dashboard/summary": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard summary",
          responses: { "200": { description: "Dashboard summary" } },
        },
      },
      "/api/dashboard/charts": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard chart data",
          responses: { "200": { description: "Chart data" } },
        },
      },
      "/api/dashboard/live": {
        get: {
          tags: ["Dashboard"],
          summary: "Get live dashboard status",
          responses: { "200": { description: "Live status" } },
        },
      },
      "/api/dashboard/heatmap": {
        get: {
          tags: ["Dashboard"],
          summary: "Get heat map data",
          parameters: [
            { name: "period", in: "query", schema: { type: "string", enum: ["today", "week", "month"] } },
            { name: "floorId", in: "query", schema: { type: "string" } },
            { name: "locationId", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Heat map data" } },
        },
      },
      "/api/feedback": {
        get: {
          tags: ["Feedback"],
          summary: "Get all feedback",
          responses: { "200": { description: "Feedback list" } },
        },
        post: {
          tags: ["Feedback"],
          summary: "Create feedback",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Feedback" } } },
          },
          responses: { "201": { description: "Feedback created" } },
        },
      },
      "/api/feedback/{id}": {
        get: {
          tags: ["Feedback"],
          summary: "Get feedback by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Feedback details" } },
        },
        delete: {
          tags: ["Feedback"],
          summary: "Delete feedback",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/restrooms": {
        get: {
          tags: ["Restrooms"],
          summary: "Get all restrooms",
          responses: { "200": { description: "Restrooms list" } },
        },
        post: {
          tags: ["Restrooms"],
          summary: "Create restroom",
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/restrooms/{id}": {
        get: {
          tags: ["Restrooms"],
          summary: "Get restroom by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Restroom details" } },
        },
        put: {
          tags: ["Restrooms"],
          summary: "Update restroom",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Restrooms"],
          summary: "Delete restroom",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deleted" } },
        },
      },
      "/api/devices": {
        get: {
          tags: ["Devices"],
          summary: "Get all devices",
          responses: { "200": { description: "Devices list" } },
        },
        post: {
          tags: ["Devices"],
          summary: "Create device",
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/devices/{id}": {
        get: {
          tags: ["Devices"],
          summary: "Get device by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Device details" } },
        },
        put: {
          tags: ["Devices"],
          summary: "Update device",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
      },
      "/api/devices/health/{deviceId}": {
        get: {
          tags: ["Devices"],
          summary: "Get device health",
          parameters: [{ name: "deviceId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Health data" } },
        },
      },
      "/api/devices/offline": {
        get: {
          tags: ["Devices"],
          summary: "Get offline devices",
          responses: { "200": { description: "Offline devices" } },
        },
      },
      "/api/alerts": {
        get: {
          tags: ["Alerts"],
          summary: "Get all alerts",
          responses: { "200": { description: "Alerts list" } },
        },
        post: {
          tags: ["Alerts"],
          summary: "Create alert",
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/alerts/stats": {
        get: {
          tags: ["Alerts"],
          summary: "Get alert statistics",
          responses: { "200": { description: "Alert stats" } },
        },
      },
      "/api/alerts/{id}": {
        get: {
          tags: ["Alerts"],
          summary: "Get alert by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Alert details" } },
        },
        put: {
          tags: ["Alerts"],
          summary: "Update alert",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
      },
      "/api/alerts/{id}/acknowledge": {
        post: {
          tags: ["Alerts"],
          summary: "Acknowledge alert",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Acknowledged" } },
        },
      },
      "/api/alerts/{id}/resolve": {
        post: {
          tags: ["Alerts"],
          summary: "Resolve alert",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Resolved" } },
        },
      },
      "/api/reports/daily": {
        get: {
          tags: ["Reports"],
          summary: "Get daily report",
          responses: { "200": { description: "Report data" } },
        },
      },
      "/api/reports/weekly": {
        get: {
          tags: ["Reports"],
          summary: "Get weekly report",
          responses: { "200": { description: "Report data" } },
        },
      },
      "/api/reports/monthly": {
        get: {
          tags: ["Reports"],
          summary: "Get monthly report",
          responses: { "200": { description: "Report data" } },
        },
      },
      "/api/reports/export/pdf": {
        get: {
          tags: ["Reports"],
          summary: "Export PDF report",
          responses: { "200": { description: "PDF exported" } },
        },
      },
      "/api/reports/export/excel": {
        get: {
          tags: ["Reports"],
          summary: "Export Excel report",
          responses: { "200": { description: "Excel exported" } },
        },
      },
      "/api/reports/export/csv": {
        get: {
          tags: ["Reports"],
          summary: "Export CSV report",
          responses: { "200": { description: "CSV exported" } },
        },
      },
      "/api/users": {
        get: {
          tags: ["Users"],
          summary: "Get all users",
          responses: { "200": { description: "Users list" } },
        },
        post: {
          tags: ["Users"],
          summary: "Create user",
          responses: { "201": { description: "Created" } },
        },
      },
      "/api/users/{id}": {
        get: {
          tags: ["Users"],
          summary: "Get user by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "User details" } },
        },
        put: {
          tags: ["Users"],
          summary: "Update user",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } },
        },
        delete: {
          tags: ["Users"],
          summary: "Deactivate user",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Deactivated" } },
        },
      },
      "/api/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "Get notifications",
          responses: { "200": { description: "Notifications list" } },
        },
      },
      "/api/settings": {
        get: {
          tags: ["Settings"],
          summary: "Get settings",
          responses: { "200": { description: "Settings" } },
        },
        put: {
          tags: ["Settings"],
          summary: "Update settings",
          responses: { "200": { description: "Updated" } },
        },
      },
      "/api/settings/test-teams-webhook": {
        post: {
          tags: ["Settings"],
          summary: "Test Teams webhook",
          responses: { "200": { description: "Test sent" } },
        },
      },
      "/api/gateway/gateway-status": {
        get: {
          tags: ["Disaster / Gateway"],
          summary: "Get gateway status",
          responses: { "200": { description: "Gateway status" } },
        },
      },
      "/api/gateway/network-status": {
        get: {
          tags: ["Disaster / Gateway"],
          summary: "Get network status",
          responses: { "200": { description: "Network status" } },
        },
      },
      "/api/gateway/offline-devices": {
        get: {
          tags: ["Disaster / Gateway"],
          summary: "Get offline devices",
          responses: { "200": { description: "Offline devices" } },
        },
      },
      "/api/gateway/incident-log": {
        get: {
          tags: ["Disaster / Gateway"],
          summary: "Get incident log",
          responses: { "200": { description: "Incident log" } },
        },
      },
      "/api/gateway/recovery-status": {
        get: {
          tags: ["Disaster / Gateway"],
          summary: "Get recovery status",
          responses: { "200": { description: "Recovery status" } },
        },
      },
      "/api/gateway/incidents/{alertId}/close": {
        post: {
          tags: ["Disaster / Gateway"],
          summary: "Manually close incident",
          parameters: [{ name: "alertId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Incident closed" } },
        },
      },
      "/api/gateway/audit-log": {
        get: {
          tags: ["Disaster / Gateway"],
          summary: "Get audit log",
          responses: { "200": { description: "Audit log" } },
        },
        post: {
          tags: ["Disaster / Gateway"],
          summary: "Create audit log entry",
          responses: { "201": { description: "Audit log created" } },
        },
      },
      "/api/gateway/server-status": {
        get: {
          tags: ["Disaster / Gateway"],
          summary: "Get server status",
          responses: { "200": { description: "Server status" } },
        },
      },
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  },
  apis: [],
};

const specs = swaggerJsDoc(swaggerOptions);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/floor-plans", floorPlanRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/restrooms", restroomRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/gateway", gatewayRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "Smart Restroom Feedback System Backend is running" });
});

app.use(notFound);
app.use(errorHandler);

function startServer(server) {
  const httpServer = http.createServer(app);
  const io = initializeSocket(httpServer);

  connectMQTT(io);
  startCronJobs();

  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
  });

  process.on("SIGINT", async () => {
    logger.info("Shutting down server...");
    disconnectMQTT();
    stopCronJobs();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down server...");
    disconnectMQTT();
    stopCronJobs();
    await prisma.$disconnect();
    process.exit(0);
  });
}

module.exports = { app, startServer };
