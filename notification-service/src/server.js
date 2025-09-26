import express from "express";
import dotenv from "dotenv";
import Redis from "ioredis";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./utils/connectDB.js";
import logger from "./utils/logger.js";
import { connectToRabbitMQ, consumeEvent } from "./utils/rabbitmq.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { handleJobApplicationEvent, handleUpdateApplicationStatusEvent } from "./eventHandlers/apply-event-handler.js";
import { handleJobSavedEvent } from "./eventHandlers/job-saved-handler.js";
import {
  handleAdminCompanyInvitedUserEvent,
  handleCompanySubscriptionUpdatedEvent,
  handleCompanyVerifiedEvent,
} from "./eventHandlers/company-handler.js";
import { handlePublishJobEvent } from "./eventHandlers/job-handler.js";

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
  logger.info(`Request body: ${JSON.stringify(req.body)}`);
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

async function startServer() {
  try {
    await connectToRabbitMQ();

    //jobs events
    await consumeEvent("job.application", handleJobApplicationEvent);
    // await consumeEvent("job.save", handleJobSavedEvent);
    await consumeEvent("job.published", handlePublishJobEvent);
    await consumeEvent("application.status.updated", handleUpdateApplicationStatusEvent);

    //company events
    await consumeEvent("company.verified", handleCompanyVerifiedEvent, "companies");
    await consumeEvent("company.subscription.updated", handleCompanySubscriptionUpdatedEvent, "companies");
    await consumeEvent("identify.user.invited", handleAdminCompanyInvitedUserEvent, "companies");

    app.listen(PORT, () => {
      logger.info(`Notification service is running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("Error starting server", err);
    process.exit(1);
  }
}

startServer();
