import Job from "../models/Job.js";
import logger from "../utils/logger.js";
import slugify from "slugify";
import validateCreateJob from "../utils/validation.js";
import { publishEvent } from "../utils/rabbitmq.js";

//create unique slug for job
const createUniqueSlug = async (title) => {
  let slug = slugify(title, { lower: true, strict: true });
  let originalSlug = slug;
  let count = 1;

  while (await Job.findOne({ slug })) {
    slug = `${originalSlug}-${count++}`;
  }

  return slug;
};

//create a new job
const createJob = async (req, res) => {
  logger.info("Creating job endpoint hit ...");
  try {
    const userRole = req.user.userRole;
    if (userRole !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can create jobs",
      });
    }

    const { error } = validateCreateJob(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const {
      title,
      description,
      company,
      location,
      salary,
      experience,
      skills,
      jobType,
    } = req.body;

    const slug = await createUniqueSlug(title);

    const newJob = new Job({
      title,
      slug,
      description,
      company,
      location,
      salary,
      experience,
      skills,
      jobType,
      postedBy: req.user.userId,
    });

    await newJob.save();

    // Publish event to RabbitMQ for search service
    await publishEvent("job.created", {
      jobSlug: newJob.slug.toString(),
      company: newJob.company.toString(),
      location: newJob.location.toString(),
      salary: newJob.salary,
      experience: newJob.experience.toString(),
      skills: newJob.skills,
      jobType: newJob.jobType.toString(),
      createdAt: newJob.createdAt,
      postedBy: newJob.postedBy.toString(),
    });

    logger.info("Job created successfully");

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      newJob,
    });
  } catch (error) {
    logger.error("Error creating job: ", error);
    res.status(500).json({
      success: false,
      message: "Error creating job",
    });
  }
};

//get all jobs
const getAllJob = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const jobs = await Job.find().skip(skip).limit(limit);
    const totalJobs = await Job.countDocuments();

    if (jobs.length <= 0) {
      return res.status(404).json({
        success: false,
        message: "Jobs not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Jobs fetched successfully",
      jobs,
      totalJobs,
      currentPage: page,
      totalPages: Math.ceil(totalJobs / limit),
    });
  } catch (error) {
    logger.error("Error fetching jobs: ", error);
    res.status(500).json({
      success: false,
      message: "Error fetching jobs",
    });
  }
};

//get job by slug
const getJob = async (req, res) => {
  try {
    const jobSlug = req.params;
    const job = await Job.findOne(jobSlug);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Job fetched successfully",
      job,
    });
  } catch (error) {
    logger.error("Error fetching job: ", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//delete a job
const deleteJob = async (req, res) => {
  try {
    const jobSlug = req.params;
    const job = await Job.findOne(jobSlug);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    await Job.deleteOne(job);

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting jobs: ", error);
    res.status(500).json({
      success: false,
      message: "Error deleting jobs",
    });
  }
};

//apply a job
const applyJob = async (req, res) => {
  logger.info("Applying for job endpoint hit...");
  try {
    const jobSlug = req.params;
    const job = await Job.findOne(jobSlug);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const user = req.user;
    if (user.userRole !== "applicant") {
      return res.status(403).json({
        success: false,
        message: "Only applicants can apply for jobs",
      });
    }

    const isApplied = job.applicants.includes(user.userId);
    if (isApplied) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for this job",
      });
    } else {
      job.applicants.push(user.userId);
      await job.save();

      // Publish event to RabbitMQ for notification service
      await publishEvent("job.application", {
        userId: job.postedBy.toString(),
        jobSlug: job.slug.toString(),
        message: `User ${user.userId} applied for job ${job.slug}`,
        type: "application_update",
      });

      logger.info("Job applied successfully");
      res.status(200).json({
        success: true,
        message: "Job applied successfully",
      });
    }
  } catch (error) {
    logger.error("Error apply job: ", error);
    res.status(500).json({
      success: false,
      message: "Error apply job",
    });
  }
};

export { createJob, getAllJob, getJob, deleteJob, applyJob };
