import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Redis from "ioredis";
import cors from "cors";
import helmet from "helmet";
import jobRoutes from "./routes/jobRoutes.js";
import logger from "./utils/logger.js";
import { connectRabbitMQ, consumeEvent } from "./utils/rabbitmq.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import savedJobRoutes from "./routes/savedJobRoutes.js";
import { handleCompanyCreated, handleCompanySubscriptionUpdated } from "./eventHandler/eventHandler.js";
import { startTrendingJobsScheduler } from "./controllers/jobController.js";
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

app.use("/api/applications", applicationRoutes);

app.use("/api/saved-jobs", savedJobRoutes);

async function startServer() {
  try {
    await connectRabbitMQ();

    await consumeEvent("company.created", (data) => handleCompanyCreated(data, redisClient));
    await consumeEvent("company.subscription.updated", (data) => handleCompanySubscriptionUpdated(data, redisClient));

    app.listen(PORT, () => {
      logger.info(`Job service running on port ${PORT}`);
      // console.log("redis client: ", redisClient);

      startTrendingJobsScheduler();
      logger.info("Trending jobs scheduler started");
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
