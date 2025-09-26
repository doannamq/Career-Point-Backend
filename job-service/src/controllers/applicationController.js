// backend/job-service/src/controllers/applicationController.js
import mongoose from "mongoose";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import logger from "../utils/logger.js";
import { publishEvent } from "../utils/rabbitmq.js";

// Lấy danh sách ứng tuyển của người dùng hiện tại
export const getMyApplications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const applications = await Application.find({ userId })
      .populate({
        path: "jobId",
        select: "title company companyName location slug",
      })
      .sort({ createdAt: -1 });

    const formattedApplications = applications.map((app) => ({
      id: app._id,
      jobTitle: app.jobId.title,
      jobSlug: app.jobId.slug,
      company: app.jobId.company,
      companyName: app.jobId.companyName,
      location: app.jobId.location,
      appliedDate: app.appliedDate.toISOString().split("T")[0],
      status: app.status,
    }));

    res.status(200).json({
      success: true,
      applications: formattedApplications,
    });
  } catch (error) {
    logger.error("Error fetching applications: ", error);
    res.status(500).json({
      success: false,
      message: "Error fetching applications",
    });
  }
};

// Lấy chi tiết một đơn ứng tuyển
export const getApplicationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const application = await Application.findById(id).populate({
      path: "jobId",
      select: "title company location description skills jobType postedBy",
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.userId.toString() !== user.userId && application.jobId.postedBy.toString() !== user.userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this application",
      });
    }

    res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    logger.error("Error fetching application details: ", error);
    res.status(500).json({
      success: false,
      message: "Error fetching application details",
    });
  }
};

// Cập nhật trạng thái đơn ứng tuyển (dành cho nhà tuyển dụng)
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // Thêm notes để ghi chú lý do
    const user = req.user;

    // Validate status
    const validStatuses = ["Pending", "In Review", "Interview Scheduled", "Rejected", "Accepted"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    if (user.userRole !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can update application status",
      });
    }

    const application = await Application.findById(id).populate({
      path: "jobId",
      select: "postedBy title",
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.jobId.postedBy.toString() !== user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update status for your own job postings",
      });
    }

    // Lưu trạng thái cũ để so sánh
    const oldStatus = application.status;

    // Cập nhật application
    application.status = status;
    if (notes) {
      application.notes = notes;
    }
    await application.save();

    // Chỉ gửi thông báo nếu status thay đổi
    if (oldStatus !== status) {
      let notificationMessage = "";
      let notificationType = "application_status_update";

      switch (status) {
        case "Accepted":
          notificationMessage = `Chúc mừng! Đơn ứng tuyển cho vị trí "${application.jobId.title}" đã được chấp nhận. Chúng tôi sẽ sớm liên hệ với bạn để trao đổi thêm.`;
          notificationType = "success";
          break;
        case "Rejected":
          notificationMessage = `Rất tiếc, đơn ứng tuyển cho vị trí "${application.jobId.title}" không được chấp nhận. Cảm ơn bạn đã quan tâm và ứng tuyển.`;
          notificationType = "error";
          break;
        case "Interview Scheduled":
          notificationMessage = `Bạn đã được mời tham gia phỏng vấn cho vị trí "${application.jobId.title}". Vui lòng kiểm tra email để biết thêm chi tiết.`;
          notificationType = "info";
          break;
        case "In Review":
          notificationMessage = `Đơn ứng tuyển cho vị trí "${application.jobId.title}" hiện đang được xem xét. Chúng tôi sẽ thông báo cho bạn khi có cập nhật mới.`;
          notificationType = "warning";
          break;
        default:
          notificationMessage = `Trạng thái đơn ứng tuyển cho vị trí "${application.jobId.title}" đã được cập nhật: ${status}.`;
      }

      // Gửi thông báo cho ứng viên
      try {
        await publishEvent("application.status.updated", {
          userId: application.userId.toString(),
          jobId: application.jobId._id.toString(),
          applicationId: application._id.toString(),
          status: status,
          oldStatus: oldStatus,
          message: notificationMessage,
          type: notificationType,
          priority: status === "Accepted" || status === "Interview Scheduled" ? "high" : "medium",
          metadata: {
            jobTitle: application.jobId.title,
            companyId: user.companyId || null,
          },
          actions:
            status === "Interview Scheduled"
              ? [
                  {
                    label: "Xem chi tiết",
                    type: "link",
                    url: `/applications/${application._id}`,
                    method: "GET",
                  },
                ]
              : status === "Accepted"
              ? [
                  {
                    label: "Xem công việc",
                    type: "link",
                    url: `/jobs/${application.jobId.slug}`,
                    method: "GET",
                  },
                ]
              : undefined,
        });
      } catch (notificationError) {
        logger.warn("Failed to send notification:", notificationError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      application: {
        ...application.toObject(),
        oldStatus, // Trả về status cũ để FE có thể xử lý
      },
    });
  } catch (error) {
    logger.error("Error updating application status: ", error);
    res.status(500).json({
      success: false,
      message: "Error updating application status",
    });
  }
};

// Lấy tất cả đơn ứng tuyển của user cho một công việc (dành cho nhà tuyển dụng)
export const getJobApplicants = async (req, res) => {
  try {
    const { slug } = req.params;
    const user = req.user;

    if (user.userRole !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can view job applicants",
      });
    }

    const job = await Job.findOne({ slug });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    if (job.postedBy.toString() !== user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only view applicants for your own job postings",
      });
    }

    const applicants = await Application.find({ jobId: job._id })
      .select("userId userName userEmail userPhoneNumber status appliedDate resumeUrl coverLetter notes")
      .sort({ appliedDate: -1 });

    res.status(200).json({
      success: true,
      applicants,
      count: applicants.length,
    });
  } catch (error) {
    logger.error("Error fetching job applicants: ", error);
    res.status(500).json({
      success: false,
      message: "Error fetching job applicants",
    });
  }
};

// Lấy trạng thái ứng tuyển và số lượng ứng viên cho một loạt jobIds
export const getApplicationBatch = async (req, res) => {
  try {
    const { jobIds, userId } = req.body;

    if (!Array.isArray(jobIds) || jobIds.length === 0 || !userId) {
      return res.status(500).json({
        success: false,
        message: "Invalid input",
      });
    }

    const objectJobIds = jobIds.map((id) => new mongoose.Types.ObjectId(id));

    const applied = await Application.find({
      userId,
      jobId: { $in: objectJobIds },
    }).select("jobId");

    const appliedJobIds = applied.map((a) => a.jobId.toString());

    const applicants = await Application.aggregate([
      {
        $match: { jobId: { $in: objectJobIds } },
      },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);

    const applicantsMap = applicants.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      appliedJobIds,
      applicantsMap,
    });
  } catch (error) {
    logger.warn("Error in get application batch", error);
    res.status(500).json({
      success: false,
      message: "Error fetching application batch",
    });
  }
};

// Lấy đơn ứng tuyển theo danh sách applicantIds cho một jobId cụ thể
export const getApplicationsByApplicants = async (req, res) => {
  try {
    const { jobId, applicantIds } = req.body;

    if (!jobId || !Array.isArray(applicantIds) || applicantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid input",
      });
    }

    const objectJobId = new mongoose.Types.ObjectId(jobId);
    const objectApplicantIds = applicantIds.map((id) => new mongoose.Types.ObjectId(id));

    const applications = await Application.find({
      jobId: objectJobId,
      userId: { $in: objectApplicantIds },
    }).select(
      "userId userName userEmail userPhoneNumber jobId status appliedDate notes resumeUrl coverLetter createdAt updatedAt"
    );

    const applicants = applications.map((app) => ({
      userId: app.userId,
      applicationId: app._id,
      userName: app.userName,
      userEmail: app.userEmail,
      userPhoneNumber: app.userPhoneNumber,
      status: app.status,
      appliedDate: app.appliedDate,
      notes: app.notes,
      resumeUrl: app.resumeUrl,
      coverLetter: app.coverLetter,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));

    res.status(200).json({
      success: true,
      applicants,
    });
  } catch (error) {
    logger.error("Error in getApplicationsByApplicants", error);
    res.status(500).json({
      success: false,
      message: "Error fetching applications by applicants",
    });
  }
};

/**
 * Lấy danh sách ứng viên cho nhiều job cùng lúc (batch)
 * Dùng cho nhà tuyển dụng muốn xem tất cả ứng viên của nhiều job mà nhà tuyển dụng đã đăng.
 */
export const getApplicantsForJobs = async (req, res) => {
  try {
    const { jobIds } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }
    const objectJobIds = jobIds.map((id) => new mongoose.Types.ObjectId(id));
    const applications = await Application.find({ jobId: { $in: objectJobIds } })
      .select("jobId userId userName userEmail userPhoneNumber status appliedDate resumeUrl coverLetter notes")
      .sort({ appliedDate: -1 });

    // Group by jobId và đếm số lượng
    const applicantsByJob = {};
    const applicantsCountByJob = {};
    applications.forEach((app) => {
      const jobId = app.jobId.toString();
      if (!applicantsByJob[jobId]) {
        applicantsByJob[jobId] = [];
        applicantsCountByJob[jobId] = 0;
      }
      applicantsByJob[jobId].push(app);
      applicantsCountByJob[jobId]++;
    });

    res.status(200).json({
      success: true,
      applicantsByJob,
      applicantsCountByJob,
    });
  } catch (error) {
    logger.error("Error fetching batch applicants: ", error);
    res.status(500).json({ success: false, message: "Error fetching batch applicants" });
  }
};
