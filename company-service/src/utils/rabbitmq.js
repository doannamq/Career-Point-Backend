import amqp from "amqplib";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "companies";

async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
    console.log("Connected to RabbitMQ");

    return channel;
  } catch (error) {
    console.error(error);
  }
}

async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectRabbitMQ();
  }

  channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));
  console.log(`Event published: ${routingKey}`);
}

export { connectRabbitMQ, publishEvent };
