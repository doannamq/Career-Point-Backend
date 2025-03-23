import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import Redis from "ioredis";
import helmet from "helmet";
import mongoose from "mongoose";
import searchRoutes from "./routes/searchRoutes.js";
import logger from "./utils/logger.js";
import { connectToRabbitMQ, consumeEvent } from "./utils/rabbitmq.js";
import {
  handleJobCreated,
  handleJobDeleted,
} from "./eventHandlers/search-event-handler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

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

app.use("/api/search", (req, res, next) => {
  req.redisClient = redisClient;
  next();
});

app.use("/api/search", searchRoutes);

async function startServer() {
  try {
    await connectToRabbitMQ();

    await consumeEvent("job.created", handleJobCreated);
    await consumeEvent("job.deleted", handleJobDeleted);

    app.listen(PORT, () => {
      logger.info(`Search service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Error starting server", error);
    process.exit(1);
  }
}

startServer();
