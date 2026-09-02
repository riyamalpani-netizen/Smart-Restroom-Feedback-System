const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../auth/authMiddleware");
const c = require("../controllers/notificationChannelController");

const auth = [authenticate, authorize("vendor_admin", "super_admin")];
const authAll = [authenticate, authorize("vendor_admin", "super_admin", "regional_manager", "vendor_manager", "facility_manager", "viewer")];

// Metadata (provider/channel catalog — read-only, any authenticated user)
router.get("/metadata", authenticate, c.getMetadata);

// Channel CRUD
router.get("/channels", authAll, c.getChannels);
router.post("/channels", auth, c.createChannel);
router.get("/channels/:id", authAll, c.getChannelById);
router.put("/channels/:id", auth, c.updateChannel);
router.delete("/channels/:id", auth, c.deleteChannel);
router.patch("/channels/:id/status", auth, c.toggleChannelStatus);
router.post("/channels/:id/test", auth, c.testChannel);

// Recipients
router.post("/channels/:id/recipients", auth, c.addRecipient);
router.put("/recipients/:id", auth, c.updateRecipient);
router.delete("/recipients/:id", auth, c.deleteRecipient);

// Templates
router.get("/templates", authAll, c.getTemplates);
router.post("/templates", auth, c.createTemplate);
router.put("/templates/:id", auth, c.updateTemplate);

// History / logs
router.get("/history", authAll, c.getHistory);

module.exports = router;
