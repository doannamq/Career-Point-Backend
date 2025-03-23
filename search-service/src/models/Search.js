import mongoose from "mongoose";

const searchSchema = new mongoose.Schema(
  {
    jobSlug: {
      type: String,
      required: true,
      unique: true,
    },
    company: {
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
      enum: ["Full-time", "Part-time", "Contract", "Internship"],
      required: true,
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

searchSchema.index({ jobSlug: "text" });
searchSchema.index({ createdAt: -1 });

const Search = mongoose.model("Search", searchSchema);

export default Search;
