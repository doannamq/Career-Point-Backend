import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    salary: {
      type: Number,
      min: 0,
      required: true,
    },
    experience: {
      type: String,
    },
    skills: {
      type: [String],
      required: true,
    },
    benefits: {
      type: [String],
      required: true,
    },
    applicationDeadline: {
      type: Date,
      required: true,
    },
    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Remote", "Hybrid"],
      required: true,
    },
    category: {
      type: String,
      required: true,
      lowercase: true,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // applicants: {
    //   type: [mongoose.Schema.Types.ObjectId],
    //   ref: "User",
    //   default: [],
    // },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    featuredExpiry: {
      type: Date,
    },
    isHot: {
      type: Boolean,
      default: false,
    },
    hotUntil: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Draft", "Published", "Closed", "Expired", "Archived", "Pending", "Rejected"],
      required: true,
      default: "Pending",
    },
  },
  { timestamps: true }
);

jobSchema.index({ slug: "text", title: "text", company: "text" });

const Job = mongoose.model("Job", jobSchema);

export default Job;
