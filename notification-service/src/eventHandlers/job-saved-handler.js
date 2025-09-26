import NotificationService from "../service/NotificationService.js";
import logger from "../utils/logger.js";

async function handleJobSavedEvent(event) {
  try {
    await NotificationService.createAndSendNotification({
      userId: event.userId,
      title: "Đã lưu việc làm",
      message: event.message || "Bạn vừa lưu một công việc mới",
      type: event.type || "job_saved",
      priority: "medium",
      metadata: { jobId: event.jobId },
      actions: [
        {
          label: "Xem việc làm",
          type: "link",
          url: `/jobs/${event.jobId}`,
        },
      ],
    });
    logger.info(`Notification sent for saved job: ${event.jobId}`);
  } catch (error) {
    logger.error("Error sending notification for saved job:", error);
  }
}

export { handleJobSavedEvent };
