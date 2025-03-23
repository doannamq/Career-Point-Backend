import Notification from "../models/Notification.js";
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

export { handleJobApplicationEvent };
