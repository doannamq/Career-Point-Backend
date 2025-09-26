import express from "express";
import authenticateRequest from "../middleware/authMiddleware.js";
import { saveUnsaveJob, checkSavedStatus, getSavedJobs, getSavedJobBatch } from "../controllers/saveJobController.js";

const router = express.Router();

router.use(authenticateRequest);

router.post("/batch", getSavedJobBatch);
router.post("/:jobId/save-unsave", saveUnsaveJob);
router.get("/:jobId/saved", checkSavedStatus);
router.get("/", getSavedJobs);

export default router;
