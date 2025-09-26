import express from "express";
import authenticateRequest from "../middleware/authMiddleware.js";
import {
  applyJob,
  approveJob,
  checkApplied,
  createJob,
  deleteJob,
  getAllJob,
  getJob,
  getJobsByCategory,
  getJobsByCompanyId,
  getMyPostedJob,
  getSimilarJobs,
  markJobAsFeatured,
  rejectJob,
} from "../controllers/jobController.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public routes (no authentication required)
router.get("/", getAllJob);
router.get("/:companyId/jobs-company", getJobsByCompanyId);
router.get("/category/:categoryName", getJobsByCategory);
router.get("/:slug", getJob);
router.get("/similar/:slug", getSimilarJobs);

// Protected routes (authentication required)
router.use(authenticateRequest);
router.post("/", createJob);
router.get("/posted-job/my-posted-job", getMyPostedJob);
router.delete("/:slug", deleteJob);
router.post("/:slug/apply", upload.single("resume"), applyJob);
router.patch("/:id/mark-featured", markJobAsFeatured);
router.get("/:slug/check-applied", checkApplied);

//admin
router.patch("/:id/approve", approveJob);
router.patch("/:id/reject", rejectJob);

export default router;
