import SaveJob from "../models/SaveJob.js";
import Job from "../models/Job.js";
import logger from "../utils/logger.js";
import { publishEvent } from "../utils/rabbitmq.js";
import mongoose from "mongoose";

// Combined save/unsave job function
export const saveUnsaveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    // Check if job exists (only needed for saving)
    const existingSave = await SaveJob.findOne({ jobId, userId });

    // If job is already saved, unsave it
    if (existingSave) {
      await SaveJob.findOneAndDelete({ jobId, userId });

      logger.info(`User ${userId} unsaved job ${jobId}`);

      return res.status(200).json({
        success: true,
        message: "Job unsaved successfully",
        isSaved: false,
      });
    }
    // If job is not saved, save it
    else {
      // Verify job exists before saving
      const job = await Job.findById(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      const saveJob = new SaveJob({
        userId,
        jobId,
      });

      await saveJob.save();

      // Publish event to notify
      await publishEvent("job.save", {
        userId: userId.toString(),
        jobId: jobId.toString(),
        message: `Việc làm ${job.title} đã được lưu`,
        type: "job_saved",
      });

      logger.info(`User ${userId} saved job ${jobId}`);

      return res.status(200).json({
        success: true,
        message: "Job saved successfully",
        data: saveJob,
        isSaved: true,
      });
    }
  } catch (error) {
    logger.error("Error processing save/unsave job operation: ", error);
    res.status(500).json({
      success: false,
      message: "Error processing save/unsave job operation",
    });
  }
};

// Check save status
export const checkSavedStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    const saveJob = await SaveJob.findOne({ jobId, userId });

    res.status(200).json({
      success: true,
      isSaved: !!saveJob,
    });
  } catch (error) {
    logger.error("Error checking save status: ", error);
    res.status(500).json({
      success: false,
      message: "Error checking save status",
    });
  }
};

// Get saved jobs
export const getSavedJobs = async (req, res) => {
  try {
    const userId = req.user.userId;

    const savedJobs = await SaveJob.find({ userId })
      .populate({
        path: "jobId",
        select: "title company companyName location jobType salary slug createdAt",
      })
      .sort({ createdAt: -1 });

    const formattedSavedJobs = savedJobs
      .filter((saved) => saved.jobId !== null) // Lọc bỏ các job đã bị xóa
      .map((saved) => ({
        id: saved._id,
        jobId: saved.jobId._id,
        title: saved.jobId.title,
        company: saved.jobId.company,
        companyName: saved.jobId.companyName,
        location: saved.jobId.location,
        jobType: saved.jobId.jobType,
        salary: saved.jobId.salary,
        slug: saved.jobId.slug,
        savedDate: saved.savedDate.toISOString().split("T")[0],
      }));

    res.status(200).json({
      success: true,
      savedJobs: formattedSavedJobs,
    });
  } catch (error) {
    logger.error("Error getting saved jobs: ", error);
    res.status(500).json({
      success: false,
      message: "Error getting saved jobs",
    });
  }
};

export const getSavedJobBatch = async (req, res) => {
  try {
    const { jobIds, userId } = req.body;

    if (!Array.isArray(jobIds) || jobIds.length === 0 || !userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
      });
    }

    const objectJobIds = jobIds.map((id) => new mongoose.Types.ObjectId(id));

    const savedJobs = await SaveJob.find({
      userId,
      jobId: { $in: objectJobIds },
    }).select("jobId");

    const savedJobIds = savedJobs.map((s) => s.jobId.toString());

    res.status(200).json({
      success: true,
      savedJobIds,
    });
  } catch (error) {
    logger.warn("Error get saved job batch", error);
    res.status(500).json({
      success: false,
      message: "Error fetching saved job batch",
    });
  }
};
