import NotificationService from "../service/NotificationService.js";
import logger from "../utils/logger.js";

async function handleCompanyVerifiedEvent(event) {
  try {
    await NotificationService.createAndSendNotification({
      userId: event.userId,
      title: "Xác thực công ty",
      message: event.message || `Công ty của bạn đã được xác thực`,
      type: event.type || "company_verified",
      priority: "high",
      metadata: { companyId: event.companyId },
      actions: [
        {
          label: "Xem công ty",
          type: "link",
          url: `/companies/${event.companyId}`,
        },
        {
          label: "Đăng tuyển ngay",
          type: "link",
          url: `/post-job`,
        },
      ],
    });
    logger.info(`Notification sent for company verification: ${event.name}`);
  } catch (error) {
    logger.error("Error sending notification for company verification:", error);
  }
}

async function handleCompanySubscriptionUpdatedEvent(event) {
  try {
    await NotificationService.createAndSendNotification({
      userId: event.userId,
      title: "Nâng cấp gói dịch vụ",
      message: event.message || "Công ty của bạn đã nâng cấp gói dịch vụ",
      type: event.type,
      priority: "medium",
      metadata: { companyId: event.companyId },
      actions: [],
    });

    logger.info(`Notification sent for company subscription update: ${event.companyName}`);
  } catch (error) {
    logger.error("Error sending notification for company subscription update:", error);
  }
}

async function handleAdminCompanyInvitedUserEvent(event) {
  try {
    await NotificationService.createAndSendNotification({
      userId: event.userId,
      title: "Thông báo mới",
      message: event.message,
      type: event.type,
      priority: "medium",
      metadata: { companyId: event.companyId },
      actions: [
        {
          label: "Tham gia",
          type: "api_call",
          url: `/company/${event.companyId}/invite/accept`,
          method: "PATCH",
        },
        {
          label: "Từ chối",
          type: "api_call",
          url: `/company/${event.companyId}/invite/reject`,
          method: "DELETE",
        },
      ],
    });
  } catch (error) {
    logger.error("Error sending notification for admin company invited user:", error);
  }
}

export { handleCompanyVerifiedEvent, handleCompanySubscriptionUpdatedEvent, handleAdminCompanyInvitedUserEvent };
