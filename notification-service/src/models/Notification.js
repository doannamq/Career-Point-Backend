import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      // enum: [
      //   "application_submitted",
      //   "application_accepted",
      //   "application_rejected",
      //   "application_interview_scheduled",
      //   "application_interview_reminder",
      //   "new_job_match",
      //   "job_expired",
      //   "job_updated",
      //   "profile_viewed",
      //   "message_received",
      //   "system_announcement",
      //   "payment_success",
      //   "subscription_expired",
      // ],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    isRead: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },

    metadata: {
      jobSlug: String,
      jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
      },
      applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Application",
      },
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
      },
      interviewDate: Date,
      // Add more fields as needed
    },

    actions: [
      {
        label: {
          type: String,
          required: true,
          maxlength: 50,
        },
        type: {
          type: String,
          enum: ["link", "api_call", "dismiss"],
          required: true,
        },
        url: String,
        method: {
          type: String,
          enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
          default: "GET",
        },
        payload: mongoose.Schema.Types.Mixed,
      },
    ],
    scheduledAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    deliveryStatus: {
      push: {
        type: String,
        enum: ["pending", "sent", "delivered", "failed"],
        default: "pending",
      },
      email: {
        type: String,
        enum: ["pending", "sent", "delivered", "failed", "skipped"],
        default: "skipped",
      },
      sms: {
        type: String,
        enum: ["pending", "sent", "delivered", "failed", "skipped"],
        default: "skipped",
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

NotificationSchema.virtual("isRecent").get(function () {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.createdAt > oneDayAgo;
});

NotificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  return this.save();
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ userId, isRead: false });
};

// Static method to mark all as read for a user
NotificationSchema.statics.markAllAsRead = function (userId) {
  return this.updateMany({ userId, isRead: false }, { isRead: true });
};

const Notification = mongoose.model("Notification", NotificationSchema);

export default Notification;
