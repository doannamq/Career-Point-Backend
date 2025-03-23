import express from "express";
import dotenv from "dotenv";
import Redis from "ioredis";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./utils/connectDB.js";
import { handleJobApplicationEvent } from "./eventHandlers/apply-event-handler.js";
import logger from "./utils/logger.js";
import { connectToRabbitMQ, consumeEvent } from "./utils/rabbitmq.js";
import notificationRoutes from "./routes/notificationRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

connectDB();

const redisClient = new Redis(process.env.REDIS_URL);

app.use(express.json());
app.use(cors());
app.use(helmet());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

app.use("/api", (req, res, next) => {
  req.redisClient = redisClient;
  next();
});

app.use("/api", notificationRoutes);

app.get("/", (req, res) => {
  res.send("Notification service is running");
});

async function startServer(req, res) {
  try {
    await connectToRabbitMQ();

    await consumeEvent("job.application", handleJobApplicationEvent);

    app.listen(PORT, () => {
      logger.info(`Notification service is running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("Error starting server", err);
    process.exit(1);
  }
}

startServer();
