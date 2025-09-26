import express from "express";
import { updateProfile, getProfile, getProfileById, uploadResume } from "../controllers/userController.js";
import authenticateRequest from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(authenticateRequest);
router.put("/update-profile", updateProfile);
router.patch("/upload-resume", upload.single("resume"), uploadResume);
router.get("/:id/profile", getProfileById);
router.get("/profile", getProfile);

export default router;
