import mongoose from "mongoose";

const searchSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
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
    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Remote"],
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isHot: {
      type: Boolean,
      default: false,
    },
    postedBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

searchSchema.index({
  title: "text",
  slug: "text",
  company: "text",
  location: "text",
  skills: "text",
});
searchSchema.index({ isFeatured: -1, isHot: -1, createdAt: -1 });
searchSchema.index({ isFeatured: 1 });
searchSchema.index({ isHot: 1 });
searchSchema.index({ salary: -1 });

searchSchema.index({ createdAt: -1 });

const Search = mongoose.model("Search", searchSchema);

export default Search;
