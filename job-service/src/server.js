import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Redis from "ioredis";
import cors from "cors";
import helmet from "helmet";
import jobRoutes from "./routes/postRoutes.js";
import logger from "./utils/logger.js";
import { connectRabbitMQ } from "./utils/rabbitmq.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to Mongoose"))
  .catch((e) => logger.error("Error connecting to Mongoose", e));

const redisClient = new Redis(process.env.REDIS_URL);

//middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

app.use(
  "/api/jobs",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  jobRoutes
);

async function startServer() {
  try {
    await connectRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`Job service running on port ${PORT}`);
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

startServer();

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason:", reason);
});
