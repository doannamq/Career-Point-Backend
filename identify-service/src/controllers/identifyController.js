import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import generateTokens from "../utils/generateToken.js";
import logger from "../utils/logger.js";
import { validateRegistration, validateLogin } from "../utils/validation.js";
import crypto from "crypto";
import nodemailer from "nodemailer";

//register
const registerUser = async (req, res) => {
  logger.info("Registration endpoint hit...");
  try {
    //validate the schema
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { email, password, name, role, phoneNumber } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      logger.warn("Email already exists");
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    let userPhoneNumber = await User.findOne({ phoneNumber });
    if (userPhoneNumber) {
      logger.warn("Phone number already exists");
      return res.status(400).json({
        success: false,
        message: "Phone number already exists",
      });
    }

    user = new User({ name, email, password, role, phoneNumber });
    await user.save();
    logger.info("User saved successfully", user._id);

    const { accessToken, refreshToken } = await generateTokens(user);

    const data = res.status(201).json({
      success: true,
      message: "User registered successfully!",
      accessToken,
      refreshToken,
      userId: user._id,
      role: user.role,
      userName: user.name,
      userEmail: user.email,
    });
  } catch (e) {
    logger.error("Registration error occured", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//login
const loginUser = async (req, res) => {
  logger.info("Login endpoint hit...");
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      logger.warn("User not found");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    //validate password
    const isValidatePassword = await user.comparePassword(password);
    if (!isValidatePassword) {
      logger.warn("Invalid password");
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    const { accessToken, refreshToken } = await generateTokens(user);

    res.status(200).json({
      success: true,
      message: "User logged in successfully!",
      userId: user._id,
      role: user.role,
      userName: user.name,
      userEmail: user.email,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Login error occured", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//refresh token
const refreshTokenUser = async (req, res) => {
  logger.info("Refresh token endpoint hit...");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "Refresh token missing",
      });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn("Invalid or expired refresh token");

      return res.status(401).json({
        success: false,
        message: `Invalid or expired refresh token`,
      });
    }

    const user = await User.findById(storedToken.user);

    if (!user) {
      logger.warn("User not found");

      return res.status(401).json({
        success: false,
        message: `User not found`,
      });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateTokens(user);

    //delete the old refresh token
    await RefreshToken.deleteOne({ _id: storedToken._id });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (e) {
    logger.error("Refresh token error occured", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//logout
const logoutUser = async (req, res) => {
  logger.info("Logout endpoint hit...");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "Refresh token missing",
      });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (!storedToken) {
      logger.warn("Invalid refresh token");
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    await RefreshToken.deleteOne({ token: refreshToken });
    logger.info("Refresh token deleted for logout");

    res.json({
      success: true,
      message: "Logged out successfully!",
    });
  } catch (e) {
    logger.error("Error while logging out", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// forgot password
const forgotPassword = async (req, res) => {
  logger.info("Forgot password endpoint hit...");
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    user.resetPasswordOTP = hashedOtp;
    user.resetPasswordExpire = Date.now() + 1000 * 60 * 5; // 5 phút

    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // gmail của bạn
        pass: process.env.EMAIL_PASS, // app password (không dùng password thường)
      },
    });

    await transporter.sendMail({
      from: `Career Point <${process.env.EMAIL_USER}>`, // sender address
      to: email, // list of receivers
      subject: "Mã OTP đặt lại mật khẩu", // Subject line
      text: `Mã OTP để đặt lại mật khẩu của bạn là ${otp}. Mã này có hiệu lực trong 5 phút.`, // plain text body
    });

    res.json({
      success: true,
      message: "OTP sent to email",
    });
  } catch (error) {
    logger.error("Error while sending OTP", error);
    res.status(500).json({
      success: false,
      message: "Error while sending OTP",
    });
  }
};

// reset password
const resetPassword = async (req, res) => {
  logger.info("Reset password endpoint hit...");
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.resetPasswordOTP || !user.resetPasswordExpire) {
      return res.status(400).json({
        success: false,
        message: "OTP invalid or expired",
      });
    }

    if (Date.now() > user.resetPasswordExpire) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedOtp !== user.resetPasswordOTP) {
      return res.status(400).json({
        success: false,
        message: "OTP is wrong",
      });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    logger.error("Error while resetting password", error);
    res.status(500).json({
      success: false,
      message: "Error while resetting password",
    });
  }
};

export { registerUser, loginUser, refreshTokenUser, logoutUser, forgotPassword, resetPassword };
