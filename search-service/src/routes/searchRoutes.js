import express from "express";
import { searchJobController } from "../controllers/search-controller.js";
import authenticateRequest from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateRequest);

router.get("/jobs", searchJobController);

export default router;
