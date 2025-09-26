import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.js";
import dotenv from "dotenv";

dotenv.config();

const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const refreshToken = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

export default generateTokens;
