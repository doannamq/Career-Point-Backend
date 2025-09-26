import amqp from "amqplib";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "jobs";

async function connectRabbitMQ(retries = 5, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to connect to RabbitMQ...`);
      connection = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
      console.log("Connected to RabbitMQ successfully.");
      return channel;
    } catch (e) {
      console.error("Error connecting to RabbitMQ", e);
      if (attempt < retries) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("Max retries reached. Exiting process...");
        process.exit(1);
      }
    }
  }
}

async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectRabbitMQ();
  }

  channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));
  console.log(`Event published: ${routingKey}`);
}

async function consumeEvent(routingKey, callback) {
  if (!channel) {
    await connectRabbitMQ();
  }

  try {
    const q = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(q.queue, "companies", routingKey);
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
  } catch (error) {
    logger.error("Error consuming event", error);
    process.exit(1);
  }
}

export { connectRabbitMQ, publishEvent, consumeEvent };
