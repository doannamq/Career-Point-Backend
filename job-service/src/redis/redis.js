import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

let redisClient;

try {
  redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    reconnectOnError: (err) => {
      logger.error("Redis reconnect error:", err);
      return true;
    },
  });

  redisClient.on("connect", () => {
    logger.info("✅ Connected to Redis");
  });

  redisClient.on("error", (err) => {
    logger.error("❌ Redis error", err);
  });
} catch (err) {
  logger.error("Failed to initialize Redis client", err);
  throw err;
}

export default redisClient;
