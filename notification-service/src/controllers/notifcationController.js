import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";
import NotificationService from "../service/NotificationService.js";

// Register FCM Token
const registerFCMToken = async (req, res) => {
  try {
    const { token, deviceId, platform = "web" } = req.body;
    const userId = req.user.userId;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required",
      });
    }

    await NotificationService.registerFCMToken(userId, token, deviceId, platform);

    res.status(200).json({
      success: true,
      message: "FCM token registered successfully",
    });
  } catch (error) {
    logger.error("Error registering FCM token:", error);
    res.status(500).json({
      success: false,
      message: "Error registering FCM token",
    });
  }
};

// Get notifications with pagination
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type;
    const isRead = req.query.isRead;

    // Build query
    const query = { userId };
    if (type) query.type = type;
    if (isRead !== undefined) query.isRead = isRead === "true";

    // Get notifications with pagination
    const notifications = await Notification.find(query)
      .populate("senderId", "firstName lastName avatar")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        unreadCount,
      },
    });
  } catch (error) {
    logger.error("Error getting notifications:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const sendFirebaseNotification = async (req, res) => {
  try {
    const { title, body, deviceToken } = req.body;
    await NotificationService.sendNotification(deviceToken, title, body);
    res.status(200).json({
      success: true,
      message: "Notification sent successfully",
    });
  } catch (error) {
    logger.error("Error sending notification:", error);
    console.error("Error sending notification:", error);
    res.status(500).json({
      success: false,
      message: "Error sending notification",
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    await Notification.markAllAsRead(userId);

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get notification settings
const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's FCM tokens
    const tokens = await FCMToken.find({ userId, isActive: true }).select("platform deviceId lastUsed");

    res.json({
      success: true,
      data: {
        devices: tokens,
        preferences: {
          // You can extend this with user preference settings
          pushEnabled: tokens.length > 0,
          emailEnabled: false, // From user settings
          typesEnabled: {
            application_submitted: true,
            application_accepted: true,
            application_rejected: true,
            application_interview_scheduled: true,
            new_job_match: true,
            // ... other types
          },
        },
      },
    });
  } catch (error) {
    logger.error("Error getting notification settings:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Send test notification (for debugging)
const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, message } = req.body;

    await NotificationService.createAndSendNotification({
      userId,
      title: title || "Test Notification",
      message: message || "This is a test notification",
      type: "system_announcement",
      priority: "low",
    });

    res.json({
      success: true,
      message: "Test notification sent",
    });
  } catch (error) {
    logger.error("Error sending test notification:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Internal API for sending notifications (used by other services)
const sendNotificationInternal = async (req, res) => {
  try {
    const notificationData = req.body;

    // Validate required fields
    const required = ["userId", "title", "message", "type"];
    const missing = required.filter((field) => !notificationData[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const notification = await NotificationService.createAndSendNotification(notificationData);

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error("Error sending internal notification:", error);
    res.status(500).json({
      success: false,
      message: "Error sending notification",
    });
  }
};

export {
  registerFCMToken,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationSettings,
  sendTestNotification,
  sendNotificationInternal,
  sendFirebaseNotification,
};
