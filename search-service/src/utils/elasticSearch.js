import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_URL,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export default elasticClient;
