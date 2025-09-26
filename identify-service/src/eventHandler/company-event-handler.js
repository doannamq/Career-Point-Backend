import User from "../models/User.js";
import logger from "../utils/logger.js";
import { publishEvent } from "../utils/rabbitmq.js";

/**
 * Xử lý khi recruiter tạo company mới:
 * - Thêm companyId vào mảng companies của user (nếu chưa có)
 * @param {Object} event - Event object từ RabbitMQ
 * @param {String} event.userId - ID của user (recruiter)
 * @param {String} event.companyId - ID của company mới tạo
 */
export async function handleUpdateProfile(event) {
  const { userId, companyId } = event;
  try {
    if (!userId || !companyId) {
      logger.warn("Missing userId or companyId in event", event);
      return;
    }
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { companies: companyId } }, // $addToSet để tránh trùng lặp
      { new: true }
    );
    logger.info(`Added company ${companyId} to user ${userId}`);
  } catch (error) {
    logger.error("Error handling update company at user profile", error);
  }
}

/**
 * Xử lý khi member được admin_company accept vào công ty:
 * - Thêm companyId vào mảng companies của user (nếu chưa có)
 * @param {Object} event - Event object từ RabbitMQ
 * @param {String} event.userId - ID của user (member)
 * @param {String} event.companyId - ID của company
 */
export async function handleCompanyMemberAccepted(event) {
  const { userId, companyId } = event;
  try {
    if (!userId || !companyId) {
      logger.warn("Missing userId or companyId in event", event);
      return;
    }
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { companies: companyId } }, // $addToSet để tránh trùng lặp
      { new: true }
    );
    logger.info(`Added company ${companyId} to user ${userId} (accepted)`);
  } catch (error) {
    logger.error("Error handling company.member.accepted event", error);
  }
}

export async function handleCompanyMemberInvited(event) {
  const { userEmail, companyId, companyName, invitedBy } = event;
  try {
    if (!userEmail || !companyId) {
      logger.warn("Missing userEmail or companyId in event", event);
      return;
    }
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      logger.warn(`User with email ${userEmail} not found, cannot invite`);
      return;
    }

    // publish event mời user cho notification service
    await publishEvent("identify.user.invited", {
      userId: user._id,
      companyId,
      invitedBy,
      message: `Bạn đã được mời tham gia công ty ${companyName}.`,
      type: "company_member_invite",
    });
  } catch (error) {
    logger.error("Error handling company.member.invited event", error);
  }
}
