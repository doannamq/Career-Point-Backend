import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

const authenticateRequest = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    logger.warn("Missing token in request headers");
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};

export default authenticateRequest;
