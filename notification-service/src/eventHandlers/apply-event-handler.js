import Notification from "../models/Notification.js";
import NotificationService from "../service/NotificationService.js";
import logger from "../utils/logger.js";

async function handleJobApplicationEvent(event) {
  try {
    const newNotification = new Notification({
      userId: event.userId,
      jobSlug: event.jobSlug,
      message: event.message,
      type: event.type,
    });

    await newNotification.save();

    logger.info(`Notification created: ${event.jobSlug}`);
  } catch (error) {
    console.error("Error saving notification:", error);
  }
}

async function handleUpdateApplicationStatusEvent(event) {
  try {
    await NotificationService.createAndSendNotification({
      userId: event.userId,
      title: "Bạn có một thông báo mới",
      message: event.message || "Trạng thái ứng tuyển của bạn đã được cập nhật",
      type: event.type,
      priority: event.priority,
      metadata: event.metadata,
      actions: event.actions,
    });
    logger.info(`Notification sent for applicant: ${event.title}`);
  } catch (error) {
    console.error("Error saving notification:", error);
  }
}

export { handleJobApplicationEvent, handleUpdateApplicationStatusEvent };
