import express from "express";
import {
  loginUser,
  registerUser,
  refreshTokenUser,
  logoutUser,
  resetPassword,
  forgotPassword,
} from "../controllers/identifyController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshTokenUser);
router.post("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
