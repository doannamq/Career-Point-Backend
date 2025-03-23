import express from "express";
import {
  loginUser,
  registerUser,
  refreshTokenUser,
  logoutUser,
} from "../controllers/identifyController.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshTokenUser);
router.post("/logout", logoutUser);

export default router;
