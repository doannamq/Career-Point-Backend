import amqp from "amqplib";
import logger from "./logger.js";
import dotenv from "dotenv";

dotenv.config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "jobs";

async function connectToRabbitMQ(retries = 5, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Attempt ${attempt} to connect to RabbitMQ...`);
      connection = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
      logger.info("Connected to RabbitMQ successfully.");
      return channel;
    } catch (e) {
      logger.error("Error connecting to RabbitMQ", e);
      if (attempt < retries) {
        logger.info(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error("Max retries reached. Exiting process...");
        process.exit(1);
      }
    }
  }
}

async function consumeEvent(routingKey, callback) {
  if (!channel) {
    await connectToRabbitMQ();
  }

  try {
    const q = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);

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

    logger.info(`Subscribed to event: ${routingKey}`);
  } catch (err) {
    logger.error("Error consuming event", err);
    process.exit(1);
  }
}

export { connectToRabbitMQ, consumeEvent };
