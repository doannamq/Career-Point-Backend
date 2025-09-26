import User from "../models/User.js";
import logger from "../utils/logger.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

// get profile
const getProfile = async (req, res) => {
  logger.info("Get profile endpoint hit...");
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const data = await User.findById(userId).select("-password");

    logger.info("Profile fetched successfully");

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data,
    });
  } catch (error) {
    logger.error("Error getting profile", error);
    return res.status(500).json({
      success: false,
      message: "Error getting profile",
      error: error.message,
    });
  }
};

// update profile
const updateProfile = async (req, res) => {
  logger.info("Update profile endpoint hit...");
  try {
    const {
      name,
      email,
      phoneNumber,
      location,
      bio,
      profilePicture,
      skills,
      experience,
      education,
      company,
      companyWebsite,
      companyDescription,
      industry,
    } = req.body;

    const userId = req.user.userId;

    // Kiểm tra trùng email
    if (email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        logger.warn(`Email ${email} already in use by another user`);
        return res.status(400).json({
          success: false,
          message: "Email already in use by another user",
        });
      }
    }

    // Kiểm tra trùng số điện thoại
    if (phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber, _id: { $ne: userId } });
      if (existingPhone) {
        logger.warn(`Phone number ${phoneNumber} already in use by another user`);
        return res.status(400).json({
          success: false,
          message: "Phone number already in use by another user",
        });
      }
    }

    // Tạo danh sách các trường cần cập nhật
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (phoneNumber) updateFields.phoneNumber = phoneNumber;
    if (location) updateFields.location = location;
    if (bio) updateFields.bio = bio;
    if (profilePicture) updateFields.profilePicture = profilePicture;
    if (skills) updateFields.skills = skills;
    if (experience) updateFields.experience = experience;
    if (education) updateFields.education = education;
    if (company) updateFields.company = company;
    if (companyWebsite) updateFields.companyWebsite = companyWebsite;
    if (companyDescription) updateFields.companyDescription = companyDescription;
    if (industry) updateFields.industry = industry;

    const user = await User.findByIdAndUpdate(userId, updateFields, { new: true, runValidators: true });

    if (!user) {
      logger.warn("User not found");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    logger.info("Profile updated successfully");
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (error) {
    logger.error("Error updating profile", error);
    return res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// upload resume
const uploadResume = async (req, res) => {
  logger.info("Upload resume endpoint hit ...");

  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required",
      });
    }

    // Upload buffer lên Cloudinary
    const result = await uploadBufferToCloudinary(req.file.buffer, "cv_uploads", req.file.mimetype);

    // Lưu secure_url vào DB
    const updatedUser = await User.findByIdAndUpdate(userId, { resumeUrl: result.secure_url, resumeFileName: req.file.originalname }, { new: true });

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      resumeUrl: updatedUser.resumeUrl,
      resumeFileName: updatedUser.resumeFileName,
    });
  } catch (error) {
    logger.error("Error upload resume", error);
    return res.status(500).json({
      success: false,
      message: "Error upload resume",
    });
  }
};

// get profile by id for recruiter view applicants
const getProfileById = async (req, res) => {
  logger.info("Get profile by id endpoint hit ...");
  try {
    const { id } = req.params;
    if (!id) {
      logger.warn("User id is required");
      return res.status(400).json({
        success: false,
        message: "User id is required",
      });
    }

    const user = await User.findById(id).select("-password").lean();

    if (!user) {
      logger.warn("User not found");
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info("Get user profile by id successfully");
    return res.status(200).json({
      success: true,
      message: "Get user profile by id successfully",
      data: user,
    });
  } catch (error) {
    logger.error("Error get profile by id", error);
    return res.status(500).json({
      success: false,
      message: "Error get profile by id",
      error: error.message,
    });
  }
};

export { getProfile, updateProfile, getProfileById, uploadResume };
