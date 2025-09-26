import mongoose from "mongoose";

const FCMTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    deviceId: {
      type: String,
      required: false,
    },
    platform: {
      type: String,
      enum: ["web", "android", "ios"],
      default: "web",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

FCMTokenSchema.index({ userId: 1, isActive: 1 });
FCMTokenSchema.index({ token: 1 }, { unique: true });

const FCMToken = mongoose.model("FCMToken", FCMTokenSchema);
export default FCMToken;
