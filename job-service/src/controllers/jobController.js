import Job from "../models/Job.js";
import Application from "../models/Application.js";
import logger from "../utils/logger.js";
import slugify from "slugify";
import validateCreateJob from "../utils/validation.js";
import { publishEvent } from "../utils/rabbitmq.js";
import mongoose from "mongoose";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { getSubscription } from "../redis/subscriptionCache.js";
import redisClient from "../redis/redis.js";
import { scheduleJob } from "node-schedule";

const APPLICATION_THRESHOLD = 10; // Số ứng viên tối thiểu để xem xét là "hot"
const DAYS_THRESHOLD = 1; // Số ngày kể từ khi đăng
const HOT_DURATION_DAYS = 7; // Số ngày để đánh dấu là "hot"

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
      companyName,
      location,
      salary,
      experience,
      skills,
      jobType,
      benefits,
      applicationDeadline,
    } = req.body;

    const categories = [
      "công nghệ",
      "y tế",
      "kinh doanh",
      "giáo dục",
      "bán lẻ",
      "dịch vụ khách sạn",
      "logistics",
      "kỹ thuật",
      "thiết kế",
      "tài chính",
    ];

    const prompt = `
      Bạn là một trợ lý AI cho web tuyển dụng. Hãy phân loại category cho job theo title của job vào một trong các category sau: 
      ${categories.join(", ")}.
      Job title: ${title}
      Chỉ trả về một trong các category ở danh sách trên. Không giải thích gì thêm.
      `;

    if (applicationDeadline < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Application deadline must be in the future",
      });
    }

    const OLLAMA_URL = "http://host.docker.internal:11434"; // Khi chạy docker
    // const OLLAMA_URL = "http://localhost:11434"; //Khi chạy local service

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3:instruct",
        prompt,
        stream: false,
      }),
    });

    const categoryJSON = await response.json();
    const category = categoryJSON.response;

    const subscription = await getSubscription(redisClient, company.toString());
    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: "Company subscription not found",
      });
    }

    // Check job limit
    const jobCount = await Job.countDocuments({ company });
    if (jobCount >= subscription.jobPostLimit) {
      return res.status(403).json({
        success: false,
        message: `You plan (${subscription.plan}) allows only ${subscription.jobPostLimit} jobs.`,
      });
    }

    // Check featured limit
    if (req.body.isFeatured) {
      const featuredCount = await Job.countDocuments({ company, isFeatured: true });
      if (featuredCount >= subscription.featuredJobsLimit) {
        return res.status(403).json({
          success: false,
          message: `Your plan (${subscription.plan}) allows only ${subscription.featuredJobsLimit} featured jobs.`,
        });
      }
    }

    const slug = await createUniqueSlug(title);

    const newJob = new Job({
      title,
      slug,
      description,
      company,
      companyName,
      location,
      salary,
      experience,
      skills,
      jobType,
      category: category,
      benefits,
      applicationDeadline,
      postedBy: req.user.userId,
    });

    await newJob.save();

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
    const { query, company, page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const searchRegex = typeof query === "string" && query.trim() !== "" ? { $regex: query, $options: "i" } : undefined;

    const searchFilter = searchRegex
      ? {
          $or: [{ title: searchRegex }, { company: searchRegex }],
        }
      : {};

    const result = await Job.find(searchFilter).skip(skip).limit(Number(limit));

    const totalJobs = await Job.countDocuments(searchFilter);

    const totalPages = Math.ceil(totalJobs / limit);

    res.status(200).json({
      success: true,
      message: "Job fetched successfully",
      jobs: result,
      totalJobs,
      totalPages,
      currentPage: Number(page),
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

// get silimilar jobs
const getSimilarJobs = async (req, res) => {
  try {
    const { slug } = req.params;
    const { limit = 3 } = req.query; // Default limit to 3 similar jobs

    // First, get the current job to compare with
    const currentJob = await Job.findOne({ slug });

    if (!currentJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Only show published jobs that are not expired
    const baseQuery = {
      _id: { $ne: currentJob._id }, // Exclude current job by ID
      status: "Published",
      applicationDeadline: { $gte: new Date() }, // Not expired
    };

    // Build aggregation pipeline for similarity scoring
    const pipeline = [
      { $match: baseQuery },
      {
        $addFields: {
          similarityScore: {
            $add: [
              // Category match (highest priority) - 50 points
              {
                $cond: [{ $eq: ["$category", currentJob.category] }, 50, 0],
              },
              // Company match - 30 points
              {
                $cond: [{ $eq: ["$company", currentJob.company] }, 30, 0],
              },
              // Skills overlap - up to 20 points (4 points per matching skill, max 5 skills)
              {
                $multiply: [
                  {
                    $size: {
                      $setIntersection: ["$skills", currentJob.skills],
                    },
                  },
                  4,
                ],
              },
              // Same location - 10 points
              {
                $cond: [{ $eq: ["$location", currentJob.location] }, 10, 0],
              },
              // Same job type - 5 points
              {
                $cond: [{ $eq: ["$jobType", currentJob.jobType] }, 5, 0],
              },
              // Similar salary range (within 20%) - 5 points
              {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$salary", currentJob.salary * 0.8] },
                      { $lte: ["$salary", currentJob.salary * 1.2] },
                    ],
                  },
                  5,
                  0,
                ],
              },
            ],
          },
        },
      },
      // Only return jobs with some similarity (score > 0)
      { $match: { similarityScore: { $gt: 0 } } },
      // Sort by similarity score (descending), then by creation date (newest first)
      {
        $sort: {
          similarityScore: -1,
          createdAt: -1,
        },
      },
      // Limit results
      { $limit: parseInt(limit) },
      // Populate company details
      {
        $lookup: {
          from: "companies",
          localField: "company",
          foreignField: "_id",
          as: "companyDetails",
        },
      },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          description: { $substr: ["$description", 0, 150] }, // Truncate description
          companyName: 1,
          location: 1,
          salary: 1,
          experience: 1,
          skills: { $slice: ["$skills", 5] }, // Limit to first 5 skills
          jobType: 1,
          category: 1,
          applicationDeadline: 1,
          isFeatured: 1,
          isHot: 1,
          createdAt: 1,
          similarityScore: 1,
          companyDetails: { $arrayElemAt: ["$companyDetails", 0] },
        },
      },
    ];

    const similarJobs = await Job.aggregate(pipeline);

    // If we don't have enough similar jobs, get some recent jobs from the same category
    if (similarJobs.length < parseInt(limit)) {
      const remainingLimit = parseInt(limit) - similarJobs.length;
      const existingJobIds = similarJobs.map((job) => job._id);

      const fallbackJobs = await Job.find({
        ...baseQuery,
        _id: {
          $nin: [...existingJobIds, currentJob._id],
        },
        category: currentJob.category,
      })
        .populate("company", "name logo")
        .sort({ createdAt: -1 })
        .limit(remainingLimit)
        .select({
          title: 1,
          slug: 1,
          description: 1,
          companyName: 1,
          location: 1,
          salary: 1,
          experience: 1,
          skills: 1,
          jobType: 1,
          category: 1,
          applicationDeadline: 1,
          isFeatured: 1,
          isHot: 1,
          createdAt: 1,
        });

      // Add fallback jobs with a lower similarity score
      const fallbackWithScore = fallbackJobs.map((job) => ({
        ...job.toObject(),
        similarityScore: 1,
        companyDetails: job.company,
      }));

      similarJobs.push(...fallbackWithScore);
    }

    res.status(200).json({
      success: true,
      count: similarJobs.length,
      data: similarJobs,
      message: "Similar jobs retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching similar jobs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching similar jobs",
      error: error.message,
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

    //Publish event to RabbitMQ for search service
    await publishEvent("job.deleted", {
      jobId: job._id.toString(),
      slug: job.slug.toString(),
      company: job.company.toString(),
      status: job.status,
    });

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
    const { slug } = req.params;
    const job = await Job.findOne({ slug });
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    const user = req.user;
    if (user.userRole !== "applicant") {
      return res.status(403).json({ success: false, message: "Only applicants can apply for jobs" });
    }

    const existing = await Application.findOne({ jobId: job._id, userId: user.userId });
    if (existing) {
      return res.status(400).json({ success: false, message: "You have already applied for this job" });
    }

    let resumeUrl;

    if (req.file?.buffer) {
      // Trường hợp upload CV mới
      const result = await uploadBufferToCloudinary(req.file.buffer, "cv_uploads", req.file.mimetype); // upload resume lên cloudinary
      resumeUrl = result.secure_url;
    } else if (req.body.resumeUrl) {
      // Trường hợp dùng CV có sẵn
      resumeUrl = req.body.resumeUrl;
    } else {
      return res.status(400).json({ success: false, message: "Resume file or URL is required" });
    }

    // Tạo record Application
    const newApplication = await Application.create({
      jobId: job._id,
      userId: user.userId,
      status: "Pending",
      coverLetter: req.body.coverLetter || "",
      resumeUrl,
      userName: req.body.userName,
      userEmail: req.body.userEmail,
      userPhoneNumber: req.body.userPhoneNumber,
    });

    // Thêm applicant vào job nếu chưa có
    // if (!job.applicants.includes(user.userId)) {
    //   job.applicants.push(user.userId);
    //   await job.save();
    // }

    // Publish event
    await publishEvent("job.application", {
      userId: job.postedBy.toString(),
      jobSlug: job.slug.toString(),
      message: `User ${user.userId} applied for job ${job.slug}`,
      type: "application_update",
    });

    setTimeout(async () => {
      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - DAYS_THRESHOLD);

        // Count recent applications for this job
        const applicationCount = await Application.countDocuments({
          jobId: job._id,
          appliedDate: { $gte: oneWeekAgo },
        });

        // If threshold is reached and job isn't already hot, mark it as hot
        if (applicationCount >= APPLICATION_THRESHOLD && !job.isHot) {
          const hotUntil = new Date();
          hotUntil.setDate(hotUntil.getDate() + HOT_DURATION_DAYS);

          await Job.findByIdAndUpdate(job._id, {
            isHot: true,
            hotUntil: hotUntil,
          });

          await publishEvent("job.hot", {
            jobId: job._id.toString(),
            slug: job.slug,
            title: job.title,
            companyName: job.companyName,
            isHot: true,
            hotUntil: hotUntil,
          });

          logger.info(`Job marked as hot after application: ${job.title}`);
        }
      } catch (error) {
        logger.error("Error checking trending status after application:", error);
      }
    }, 1000); // Run after response is sent

    res.status(200).json({ success: true, message: "Job applied successfully", application: newApplication });
  } catch (error) {
    logger.error("Error apply job: ", error);
    res.status(500).json({ success: false, message: "Error apply job" });
  }
};

// check user already applied for a job
const checkApplied = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const job = await Job.findOne({ slug });
    if (!job) {
      return res.status(401).json({
        success: false,
        message: "Job not found",
      });
    }

    const existing = await Application.findOne({ jobId: job._id, userId });
    res.json({
      applied: !!existing,
    });
  } catch (error) {
    logger.error("Error checking application status", error);
    res.status(500).json({
      success: false,
      message: "Error checking application status",
    });
  }
};

//approve a job
const approveJob = async (req, res) => {
  logger.info("Approve job endpoint hit ...");
  try {
    const userRole = req.user?.userRole;
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can approve job",
      });
    }

    const { id: jobId } = req.params;

    // Kiểm tra job có tồn tại không
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Cập nhật và lấy bản mới
    const updatedJob = await Job.findByIdAndUpdate(jobId, { status: "Published" }, { new: true });

    //Publish for search service
    await publishEvent("job.published", {
      company: updatedJob.company.toString(),
      jobId: updatedJob._id.toString(),
      title: updatedJob.title,
      slug: updatedJob.slug,
      companyName: updatedJob.companyName,
      location: updatedJob.location,
      salary: updatedJob.salary,
      experience: updatedJob.experience,
      skills: updatedJob.skills,
      jobType: updatedJob.jobType,
      createdAt: updatedJob.createdAt,
      postedBy: updatedJob.postedBy.toString(),
      status: updatedJob.status,
      category: updatedJob.category,
      isFeatured: updatedJob.isFeatured,
      message: `Việc làm ${updatedJob.title} đã được phê duyệt`,
      type: "job_published",
    });

    res.json({
      success: true,
      message: "Job approved successfully",
      job: updatedJob,
    });
  } catch (error) {
    logger.error("Error approving job", error);
    res.status(500).json({
      success: false,
      message: "Error approving job",
    });
  }
};

//reject a job
const rejectJob = async (req, res) => {
  logger.info("Reject job endpoint hit ...");
  try {
    const userRole = req.user?.userRole;
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can reject job",
      });
    }

    const { id: jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const updatedJob = await Job.findByIdAndUpdate(jobId, { status: "Rejected" }, { new: true });

    res.json({
      success: true,
      message: "Job rejected successfully",
      job: updatedJob,
    });
  } catch (error) {
    logger.error("Error rejecting job", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting job",
    });
  }
};

//get my posted job
const getMyPostedJob = async (req, res) => {
  logger.info("Get my posted job endpoint hit ...");
  try {
    const userRole = req.user?.userRole;
    const userId = req.user?.userId;

    if (userRole !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can view their posted jobs",
      });
    }

    const jobs = await Job.find({ postedBy: userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      message: "Fetched posted jobs successfully",
      jobs,
    });
  } catch (error) {
    logger.error("Failed to get my posted job", error);
    return res.status(500).json({
      success: false,
      message: "Can not get my posted job",
    });
  }
};

//get job by company id
const getJobsByCompanyId = async (req, res) => {
  logger.info("Get job by company id endpoint hit ...");
  try {
    const companyId = req.params.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "Missing company id" });
    }

    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const totalJobs = await Job.countDocuments({ company: new mongoose.Types.ObjectId(companyId) });

    const jobs = await Job.find({ company: new mongoose.Types.ObjectId(companyId) })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: "Get jobs by company id successfully",
      jobs,
      pagination: {
        totalJobs,
        currentPage: page,
        totalPages: Math.ceil(totalJobs / limit),
        pageSize: limit,
      },
    });
  } catch (error) {
    logger.error("Error getting jobs by company id", error);
    res.status(500).json({
      success: false,
      message: "Error getting jobs by company id",
    });
  }
};

// get jobs by category
const getJobsByCategory = async (req, res) => {
  logger.info("Get jobs by category endpoint hit...");
  try {
    let { categoryName } = req.params;

    if (!categoryName) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    categoryName = categoryName.toLowerCase();

    const query = { category: categoryName };

    if (req.user?.role !== "admin") {
      query.status = "Published";
    }

    const jobs = await Job.find(query);

    return res.status(200).json({
      success: true,
      message: "Get jobs by category successfully",
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    logger.error("Error get jobs by category", error);
    res.status(500).json({
      success: false,
      message: "Error get jobs by category",
    });
  }
};

// Mark job as featured
const markJobAsFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.userRole;

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Chỉ recruiter đăng job hoặc admin công ty mới được thao tác
    if (userRole !== "recruiter" && userRole !== "admin_company") {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    if (userRole === "recruiter" && job.postedBy.toString() !== userId) {
      return res.status(403).json({ success: false, message: "You can only feature your own jobs" });
    }

    if (job.isFeatured) {
      return res.status(400).json({ success: false, message: "Job is already featured" });
    }

    const subscription = await getSubscription(redisClient, job.company.toString());
    if (!subscription || !subscription.endDate) {
      return res.status(400).json({
        success: false,
        message: "Company subscription not found or invalid",
      });
    }

    const featuredCount = await Job.countDocuments({ company: job.company, isFeatured: true });
    if (featuredCount >= subscription.featuredJobsLimit) {
      return res.status(403).json({
        success: false,
        message: `Your plan (${subscription.plan}) allows only ${subscription.featuredJobsLimit} featured jobs.`,
      });
    }

    job.isFeatured = true;
    job.featuredExpiry = new Date(subscription.endDate);
    await job.save();

    publishEvent("job.featured", {
      jobId: job._id.toString(),
      title: job.title,
      slug: job.slug,
      isFeatured: job.isFeatured,
    });

    return res.status(200).json({
      success: true,
      message: "Job marked as featured successfully",
    });
  } catch (error) {
    console.error("Error marking job as featured", error);
    logger.error("Error marking job as featured", error);
    res.status(500).json({
      success: false,
      message: "Error marking job as featured",
    });
  }
};

// Mark trending jobs as hot
const checkForTrendingJobs = async (req, res) => {
  logger.info("Check for trending jobs endpoint hit...");
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - DAYS_THRESHOLD);

    const trendingJobsData = await Application.aggregate([
      {
        $match: {
          appliedDate: { $gte: oneWeekAgo },
        },
      },
      {
        $group: {
          _id: "$jobId",
          applicationCount: { $sum: 1 },
          recentApplications: { $push: "$appliedDate" },
        },
      },
      {
        $match: {
          applicationCount: { $gte: APPLICATION_THRESHOLD },
        },
      },
    ]);

    if (trendingJobsData.length === 0) {
      logger.info("No trending jobs found");
      return res.status(200).json({
        success: true,
        message: "No trending jobs found",
        trendingJobs: [],
      });
    }

    const trendingJobIds = trendingJobsData.map((item) => item._id);

    const hotUntil = new Date();
    hotUntil.setDate(hotUntil.getDate() + HOT_DURATION_DAYS);

    const updatedJobs = await Job.updateMany(
      {
        _id: { $in: trendingJobIds },
        isHot: false,
        status: "Published", // Only mark published jobs as hot
      },
      {
        $set: {
          isHot: true,
          hotUntil: hotUntil,
        },
      }
    );

    logger.info(`Marked ${updatedJobs.modifiedCount} new jobs as hot/trending`);

    let newlyMarkedHotJobs = [];

    if (updatedJobs.modifiedCount > 0) {
      newlyMarkedHotJobs = await Job.find({
        _id: { $in: trendingJobIds },
        isHot: true,
      });

      // Publish events for each newly hot job
      for (const job of newlyMarkedHotJobs) {
        await publishEvent("job.hot", {
          jobId: job._id.toString(),
          slug: job.slug,
          title: job.title,
          companyName: job.companyName,
          isHot: true,
          hotUntil: job.hotUntil,
        });

        logger.info(`Published hot status for job: ${job.title}`);
      }
    }

    // Return all trending jobs, including those that were already marked hot
    const allTrendingJobs = await Job.find({
      _id: { $in: trendingJobIds },
    });

    return res.status(200).json({
      success: true,
      message: `Found ${trendingJobsData.length} trending jobs, marked ${updatedJobs.modifiedCount} new jobs as hot`,
      trendingJobs: allTrendingJobs,
      newlyMarkedHotJobs,
    });
  } catch (error) {
    logger.error("Error getting trending jobs", error);
    res.status(500).json({
      success: false,
      message: "Error getting trending jobs",
    });
  }
};

// Remove expired hot status from jobs (after 7 days)
const removeExpiredHotStatus = async (req, res) => {
  try {
    logger.info("Removing expired hot status...");

    const now = new Date();

    // Find jobs with expired hot status
    const expiredHotJobs = await Job.find({
      isHot: true,
      hotUntil: { $lte: now },
    });

    if (expiredHotJobs.length === 0) {
      logger.info("No expired hot jobs found");
      return;
    }

    // Update jobs to remove hot status
    await Job.updateMany(
      {
        _id: { $in: expiredHotJobs.map((job) => job._id) },
      },
      {
        $set: {
          isHot: false,
        },
        $unset: {
          hotUntil: "",
        },
      }
    );

    logger.info(`Removed hot status from ${expiredHotJobs.length} jobs`);

    // Publish events for each job that is no longer hot
    for (const job of expiredHotJobs) {
      await publishEvent("job.hot", {
        jobId: job._id.toString(),
        slug: job.slug,
        title: job.title,
        companyName: job.companyName,
        isHot: false,
      });

      logger.info(`Published hot status removal for job: ${job.title}`);
    }
  } catch (error) {
    logger.error("Error removing expired hot status:", error);
  }
};

const startTrendingJobsScheduler = async (req, res) => {
  logger.info("Starting trending jobs scheduler");

  // Check for trending jobs every day at 1 AM
  scheduleJob("0 1 * * *", async () => {
    logger.info("Running scheduled check for trending jobs");
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - DAYS_THRESHOLD);

      const trendingJobsData = await Application.aggregate([
        {
          $match: {
            appliedDate: { $gte: oneWeekAgo },
          },
        },
        {
          $group: {
            _id: "$jobId",
            applicationCount: { $sum: 1 },
            recentApplications: { $push: "$appliedDate" },
          },
        },
        {
          $match: {
            applicationCount: { $gte: APPLICATION_THRESHOLD },
          },
        },
      ]);

      if (trendingJobsData.length === 0) {
        logger.info("No trending jobs found in scheduled check");
        return;
      }

      const trendingJobIds = trendingJobsData.map((item) => item._id);

      const hotUntil = new Date();
      hotUntil.setDate(hotUntil.getDate() + HOT_DURATION_DAYS);

      const updatedJobs = await Job.updateMany(
        {
          _id: { $in: trendingJobIds },
          isHot: false,
          status: "Published",
        },
        {
          $set: {
            isHot: true,
            hotUntil: hotUntil,
          },
        }
      );

      logger.info(`Scheduled check marked ${updatedJobs.modifiedCount} new jobs as hot/trending`);

      if (updatedJobs.modifiedCount > 0) {
        const newlyHotJobs = await Job.find({
          _id: { $in: trendingJobIds },
          isHot: true,
        });

        // Publish events for each newly hot job
        for (const job of newlyHotJobs) {
          await publishEvent("job.hot", {
            jobId: job._id.toString(),
            slug: job.slug,
            title: job.title,
            companyName: job.companyName,
            isHot: true,
            hotUntil: job.hotUntil,
          });

          logger.info(`Published hot status for job: ${job.title}`);
        }
      }
    } catch (error) {
      logger.error("Error in scheduled trending jobs check:", error);
    }
  });

  // Check for expired hot status every day at 2 AM
  scheduleJob("0 2 * * *", async () => {
    logger.info("Running scheduled check for expired hot status");
    try {
      await removeExpiredHotStatus();
    } catch (error) {
      logger.error("Error in scheduled expired hot status check:", error);
    }
  });

  // Run an initial check when the server starts (with slight delay to ensure services are connected)
  setTimeout(async () => {
    try {
      logger.info("Running initial trending jobs check after server start");
      await removeExpiredHotStatus();

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - DAYS_THRESHOLD);

      const trendingJobsData = await Application.aggregate([
        {
          $match: {
            appliedDate: { $gte: oneWeekAgo },
          },
        },
        {
          $group: {
            _id: "$jobId",
            applicationCount: { $sum: 1 },
          },
        },
        {
          $match: {
            applicationCount: { $gte: APPLICATION_THRESHOLD },
          },
        },
      ]);

      if (trendingJobsData.length > 0) {
        const trendingJobIds = trendingJobsData.map((item) => item._id);
        const hotUntil = new Date();
        hotUntil.setDate(hotUntil.getDate() + HOT_DURATION_DAYS);

        const updatedJobs = await Job.updateMany(
          {
            _id: { $in: trendingJobIds },
            isHot: false,
            status: "Published",
          },
          {
            $set: {
              isHot: true,
              hotUntil: hotUntil,
            },
          }
        );

        logger.info(`Initial check marked ${updatedJobs.modifiedCount} jobs as hot/trending`);
      }
    } catch (error) {
      logger.error("Error in initial trending jobs check:", error);
    }
  }, 10000);
};

export {
  createJob,
  getAllJob,
  getJob,
  getSimilarJobs,
  deleteJob,
  applyJob,
  checkApplied,
  approveJob,
  rejectJob,
  getMyPostedJob,
  getJobsByCompanyId,
  getJobsByCategory,
  markJobAsFeatured,
  checkForTrendingJobs,
  removeExpiredHotStatus,
  startTrendingJobsScheduler,
};
