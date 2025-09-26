import { consumeEvent } from "../utils/rabbitmq.js";
import { cacheSubscription } from "../redis/subscriptionCache.js";

const handleCompanyCreated = async (data, redisClient) => {
  // console.log(">>> Received company.created in job-service:", data);
  const { companyId, subscription } = data;
  await cacheSubscription(redisClient, companyId, subscription);
};

const handleCompanySubscriptionUpdated = async (data, redisClient) => {
  const { companyId, subscription } = data;
  await cacheSubscription(redisClient, companyId, subscription);
};

export { handleCompanyCreated, handleCompanySubscriptionUpdated };
