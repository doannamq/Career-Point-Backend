// backend/job-service/src/models/Application.js
import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userPhoneNumber: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["Pending", "In Review", "Interview Scheduled", "Rejected", "Accepted"],
      default: "Pending",
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    resumeUrl: {
      type: String,
      required: false,
    },
    coverLetter: {
      type: String,
      required: false,
    },
    notes: {
      type: String,
      required: false,
    },
    // Thêm fields để tracking
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["Pending", "In Review", "Interview Scheduled", "Rejected", "Accepted"],
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],
    interviewDetails: {
      scheduledAt: Date,
      location: String,
      interviewType: {
        type: String,
        enum: ["online", "onsite", "phone"],
      },
      meetingLink: String,
      notes: String,
    },
  },
  { timestamps: true }
);

// Middleware để tự động thêm vào statusHistory khi status thay đổi
applicationSchema.pre("save", function (next) {
  if (this.isModified("status") && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this._changedBy, // Cần set từ controller
    });
  }
  next();
});

// Tạo indexes để tìm kiếm nhanh hơn
applicationSchema.index({ userId: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ status: 1 });

const Application = mongoose.model("Application", applicationSchema);

export default Application;
