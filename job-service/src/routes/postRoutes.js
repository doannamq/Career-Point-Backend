import express from "express";
import authenticateRequest from "../middleware/authMiddleware.js";
import {
  applyJob,
  createJob,
  deleteJob,
  getAllJob,
  getJob,
} from "../controllers/jobController.js";

const router = express.Router();

router.use(authenticateRequest);

router.post("/", createJob);
router.get("/", getAllJob);
router.get("/:slug", getJob);
router.delete("/:slug", deleteJob);
router.post("/:slug/apply", applyJob);

export default router;
