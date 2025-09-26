import NotificationService from "../service/NotificationService.js";
import logger from "../utils/logger.js";

async function handlePublishJobEvent(event) {
  try {
    await NotificationService.createAndSendNotification({
      userId: event.postedBy,
      title: "Việc làm đã được đăng",
      message: event.message || "Việc làm của bạn đã được đăng thành công",
      type: event.type || "job_published",
      priority: "medium",
      metadata: { jobId: event.jobId },
      actions: [
        {
          label: "Xem việc làm",
          type: "link",
          url: `/jobs/${event.slug}`,
        },
      ],
    });
    logger.info(`Notification sent for job published: ${event.title}`);
  } catch (error) {
    logger.error("Error sending notification for published job:", error);
  }
}

export { handlePublishJobEvent };
