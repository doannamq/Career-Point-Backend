import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Redis from "ioredis";
import cors from "cors";
import helmet from "helmet";
import logger from "./utils/logger.js";
import companyRoutes from "./routes/companyRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

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
  "/api/company",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  companyRoutes
);

async function startServer() {
  try {
    app.listen(PORT, () => {
      logger.info(`Company service running on port ${PORT}`);
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
