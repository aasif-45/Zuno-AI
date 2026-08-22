import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl =
  process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,

  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("✅ Billing Redis connected successfully");
});

redis.on("ready", () => {
  console.log("🚀 Billing Redis ready");
});

redis.on("error", (err) => {
  console.warn(
    "⚠️ Billing Redis notice:",
    err.message
  );
});

/**
 * Get cached JSON data from Redis by key
 *
 * @param {string} key
 */
export const getCache = async (key) => {
  try {
    const data = await redis.get(key);

    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(
      `Redis GET error for key [${key}]:`,
      error.message
    );

    return null;
  }
};

/**
 * Set cached JSON data in Redis
 *
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
export const setCache = async (
  key,
  value,
  ttlSeconds = 3600
) => {
  try {
    await redis.set(
      key,
      JSON.stringify(value),
      "EX",
      ttlSeconds
    );

    return true;
  } catch (error) {
    console.error(
      `Redis SET error for key [${key}]:`,
      error.message
    );

    return false;
  }
};

/**
 * Delete cached key from Redis
 *
 * @param {string} key
 */
export const delCache = async (key) => {
  try {
    await redis.del(key);

    return true;
  } catch (error) {
    console.error(
      `Redis DEL error for key [${key}]:`,
      error.message
    );

    return false;
  }
};

export default redis;