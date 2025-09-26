import express from "express";
import authenticateRequest from "../middleware/authMiddleware.js";
import {
  deleteNotification,
  getNotifications,
  getNotificationSettings,
  markAllAsRead,
  markAsRead,
  registerFCMToken,
  sendNotificationInternal,
  sendTestNotification,
} from "../controllers/notifcationController.js";
import { sendFirebaseNotification } from "../controllers/notifcationController.js";

const router = express.Router();

router.use(authenticateRequest);

// FCM Token management
router.post("/notifications/fcm-token", registerFCMToken);

// Notification CRUD
router.get("/notifications", getNotifications);
router.post("/notifications/:notificationId/read", markAsRead);
router.post("/mark-all-read", markAllAsRead);
router.delete("/:notificationId", deleteNotification);

// Settings
router.get("/notifications/settings", getNotificationSettings);

// Test notification
router.post("/notifications/test-send", sendTestNotification);

// Internal routes (for microservices communication)
router.post("/notifications/internal/send", sendNotificationInternal);

export default router;
