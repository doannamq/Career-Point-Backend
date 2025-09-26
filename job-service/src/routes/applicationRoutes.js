import express from "express";
import authenticateRequest from "../middleware/authMiddleware.js";
import {
  getMyApplications,
  getApplicationDetail,
  updateApplicationStatus,
  getJobApplicants,
  getApplicationBatch,
  getApplicationsByApplicants,
  getApplicantsForJobs,
} from "../controllers/applicationController.js";

const router = express.Router();

// Tất cả routes đều yêu cầu xác thực
router.use(authenticateRequest);

router.post("/batch", getApplicationBatch);
router.post("/batch-by-applicants", getApplicationsByApplicants); // Dùng để check ở page search xem user đã ứng tuyển những job nào trong danh sách job hiện tại
router.get("/my-applications", getMyApplications);
router.get("/:id", getApplicationDetail);
router.patch("/:id/status", updateApplicationStatus);
router.get("/job/:slug/applicants", getJobApplicants);
router.post("/batch-applicants", getApplicantsForJobs); // Dùng cho nhà tuyển dụng muốn xem tất cả ứng viên của nhiều job mà nhà tuyển dụng đã đăng.

export default router;
