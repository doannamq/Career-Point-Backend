import express from "express";
import authenticateRequest from "../middleware/authMiddleware.js";
import {
  getNotifications,
  markAsRead,
} from "../controllers/notifcationController.js";

const routes = express.Router();

routes.use(authenticateRequest);

routes.get("/notifications", getNotifications);
routes.post("/notifications/:jobSlug", markAsRead);

export default routes;
