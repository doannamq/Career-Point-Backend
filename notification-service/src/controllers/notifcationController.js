import Notification from "../models/Notification.js";

const getNotifications = async (req, res) => {
  try {
    const user = req.user;
    const notifications = await Notification.find({ user: user._id }).sort({
      createdAt: -1,
    });
    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    const user = req.user;
    const { jobSlug } = req.params;

    const notification = await Notification.findOne({ jobSlug });

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
      notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export { getNotifications, markAsRead };
