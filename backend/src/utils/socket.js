const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const logger = require("../middleware/logger");

let io = null;

function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === "production" ? false : "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`Client connected: ${socket.id}`, { userId: socket.user?.sub, role: socket.user?.role });

    socket.on("disconnect", () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  logger.info("Socket.IO initialized with auth");
  return io;
}

function getIO() {
  return io;
}

function emitToClients(event, data) {
  try {
    if (io) {
      io.emit(event, data);
    }
  } catch (error) {
    logger.error("Socket emit error:", error);
  }
}

module.exports = {
  initializeSocket,
  getIO,
  emitToClients,
};
