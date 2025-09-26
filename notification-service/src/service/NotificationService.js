import FCMToken from "../models/FCMToken.js";
import Notification from "../models/Notification.js";
import admin from "../utils/firebase.js";
import logger from "../utils/logger.js";

class NotificationService {
  static async registerFCMToken(userId, token, deviceId = null, platform = "web") {
    try {
      await FCMToken.findOneAndUpdate(
        { userId, token },
        { userId, token, deviceId, platform, isActive: true, lastUsed: new Date() },
        { upsert: true, new: true }
      );

      logger.info(`FCM token registered/updated for user ${userId}`);
      return true;
    } catch (error) {
      logger.error("Error registering FCM token:", error);
      throw error;
    }
  }

  static async getUserTokens(userId) {
    try {
      const tokens = await FCMToken.find({
        userId,
        isActive: true,
      }).select("token");

      return tokens.map((t) => t.token);
    } catch (error) {
      logger.error("Error getting user tokens:", error);
      return [];
    }
  }

  static async sendNotification(token, title, body, data = {}) {
    try {
      const message = {
        token,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
        },
        webpush: {
          fcmOptions: {
            link: data.url || "/notifications",
          },
        },
      };

      const response = await admin.messaging().send(message);
      logger.info("Notification sent successfully:", response);
      return { success: true, messageId: response };
    } catch (error) {
      logger.error("Error sending notification:", error);
      if (error.code === "messaging/registration-token-not-registered") {
        await this.deactivateToken(token);
      }

      return { success: false, error: error.message };
    }
  }

  static async sendMulticast(tokens, title, body, data = {}) {
    try {
      const message = {
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
        },
        webpush: {
          fcmOptions: {
            link: data.url || "/notifications",
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...message,
      });

      // Xử lý lỗi như cũ
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            if (resp.error?.code === "messaging/registration-token-not-registered") {
              this.deactivateToken(tokens[idx]);
            }
          }
        });
      }

      logger.info(`Multicast sent: ${response.successCount} success, ${response.failureCount} failed`);
      return response;
    } catch (error) {
      logger.error("Error sending multicast notification:", error);
      throw error;
    }
  }

  static async deactivateToken(token) {
    try {
      await FCMToken.updateOne({ token }, { isActive: false });
      logger.info(`Token deactivated: ${token}`);
    } catch (error) {
      logger.error("Error deactivating token:", error);
    }
  }

  static async createAndSendNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();

      const tokens = await this.getUserTokens(notificationData.userId);

      if (tokens.length === 0) {
        logger.warn(`No active tokens found for user ${notificationData.userId}`);
        await Notification.updateOne({ _id: notification._id }, { "deliveryStatus.push": "failed" });
        return notification;
      }

      // Prepare notification data
      const data = {
        notificationId: notification._id.toString(),
        type: notification.type,
        url: this.generateNotificationUrl(notification),
        userId: notification.userId.toString(),
        ...Object.entries(notification.metadata || {}).reduce((acc, [key, value]) => {
          if (value) acc[key] = value.toString();
          return acc;
        }, {}),
      };

      // Send push notification
      let pushResult;
      if (tokens.length === 1) {
        pushResult = await this.sendNotification(tokens[0], notification.title, notification.message, data);
      } else {
        pushResult = await this.sendMulticast(tokens, notification.title, notification.message, data);
      }

      // Update delivery status
      const status = pushResult.success || (pushResult.successCount && pushResult.successCount > 0) ? "sent" : "failed";

      await Notification.updateOne({ _id: notification._id }, { "deliveryStatus.push": status });

      logger.info(`Notification created and sent: ${notification._id}`);
      return notification;
    } catch (error) {
      logger.error("Error creating and sending notification:", error);
      throw error;
    }
  }

  // Cần check lại sau
  static generateNotificationUrl(notification) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5000";

    switch (notification.type) {
      case "application_submitted":
        return `${baseUrl}/employer/applications/${notification.metadata.applicationId}`;
      case "application_accepted":
      case "application_rejected":
        return `${baseUrl}/applications/${notification.metadata.applicationId}`;
      case "application_interview_scheduled":
        return `${baseUrl}/interviews/${notification.metadata.applicationId}`;
      case "new_job_match":
        return `${baseUrl}/jobs/${notification.metadata.jobSlug}`;
      case "profile_viewed":
        return `${baseUrl}/profile`;
      case "message_received":
        return `${baseUrl}/messages`;
      default:
        return `${baseUrl}/notifications`;
    }
  }

  static async notifyJobApplication(applicationData) {
    const { jobId, jobTitle, companyName, applicantName, recruiterId, applicationId } = applicationData;

    return await this.createAndSendNotification({
      userId: recruiterId,
      title: "Ứng viên mới apply vào job",
      message: `${applicantName} vừa apply vào vị trí ${jobTitle} tại ${companyName}`,
      type: "application_submitted",
      priority: "high",
      metadata: {
        jobId,
        applicationId,
      },
      actions: [
        {
          label: "Xem hồ sơ",
          type: "link",
          url: `/employer/applications/${applicationId}`,
        },
      ],
    });
  }

  static async notifyApplicationStatus(applicationData) {
    const { applicantId, jobTitle, companyName, status, applicationId } = applicationData;

    const statusMessages = {
      accepted: `Chúc mừng! Hồ sơ của bạn cho vị trí ${jobTitle} tại ${companyName} đã được chấp nhận`,
      rejected: `Hồ sơ của bạn cho vị trí ${jobTitle} tại ${companyName} chưa phù hợp lần này`,
    };

    return await this.createAndSendNotification({
      userId: applicantId,
      title: status === "accepted" ? "Hồ sơ được chấp nhận!" : "Cập nhật trạng thái ứng tuyển",
      message: statusMessages[status],
      type: status === "accepted" ? "application_accepted" : "application_rejected",
      priority: status === "accepted" ? "high" : "medium",
      metadata: {
        applicationId,
      },
      actions: [
        {
          label: "Xem chi tiết",
          type: "link",
          url: `/applications/${applicationId}`,
        },
      ],
    });
  }

  static async notifyInterviewScheduled(interviewData) {
    const { applicantId, jobTitle, companyName, interviewDate, applicationId } = interviewData;

    return await this.createAndSendNotification({
      userId: applicantId,
      title: "Lịch phỏng vấn được sắp xếp",
      message: `Bạn có lịch phỏng vấn cho vị trí ${jobTitle} tại ${companyName} vào ${new Date(
        interviewDate
      ).toLocaleString("vi-VN")}`,
      type: "application_interview_scheduled",
      priority: "high",
      metadata: {
        applicationId,
        interviewDate,
      },
      actions: [
        {
          label: "Xem chi tiết",
          type: "link",
          url: `/interviews/${applicationId}`,
        },
      ],
    });
  }
}

export default NotificationService;
