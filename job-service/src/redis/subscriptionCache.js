import logger from "../utils/logger.js";
const cacheSubscription = async (redisClient, companyId, subscription) => {
  try {
    await redisClient.set(`subscription:${companyId}`, JSON.stringify(subscription));
    console.log(`Cached subscription for company ${companyId}`);
    logger.info(`Cached subscription for company ${companyId}`);
  } catch (error) {
    console.error("Error caching subscription for company", error);
    logger.error("Error caching subscription  cho company", error);
  }
};

const getSubscription = async (redisClient, companyId) => {
  try {
    const subStr = await redisClient.get(`subscription:${companyId}`);
    // console.log("subStr:", subStr);
    if (!subStr) return null;
    return JSON.parse(subStr);
  } catch (error) {
    logger.error("Error getting subscription  from redis cache", error);
    console.error("Error getting subscription  from redis cache", error);
    return null;
  }
};

export { cacheSubscription, getSubscription };
