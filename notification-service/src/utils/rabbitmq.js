import amqp from "amqplib";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "jobs";
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

// Kết nối tới RabbitMQ
async function connectToRabbitMQ(retries = MAX_RETRIES, delay = RETRY_DELAY_MS) {
  if (channel) return channel;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Attempt ${attempt} to connect to RabbitMQ...`);

      connection = await amqp.connect(process.env.RABBITMQ_URL);

      connection.on("error", (err) => {
        logger.error("RabbitMQ connection error", err);
      });

      connection.on("close", () => {
        logger.error("RabbitMQ connection closed. Exiting...");
        process.exit(1); // để Docker restart
      });

      channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

      logger.info("Connected to RabbitMQ successfully.");
      return channel;
    } catch (e) {
      logger.error(`Error connecting to RabbitMQ: ${e.message}`);

      if (attempt < retries) {
        logger.info(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error("Max retries reached. Exiting...");
        process.exit(1);
      }
    }
  }
}

// Subscribe vào event
async function consumeEvent(routingKey, callback, exchangeName = EXCHANGE_NAME) {
  try {
    await connectToRabbitMQ();

    await channel.assertExchange(exchangeName, "topic", { durable: true });

    const q = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(q.queue, exchangeName, routingKey);

    channel.consume(q.queue, (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          callback(content);
          channel.ack(msg);
        } catch (error) {
          logger.error("Error processing message", error);
          channel.nack(msg);
        }
      }
    });

    logger.info(`Subscribed to event: ${routingKey} on exchange: ${exchangeName}`);
  } catch (err) {
    logger.error("Error consuming event", err);
    process.exit(1);
  }
}

export { connectToRabbitMQ, consumeEvent };
