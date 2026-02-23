import { createClient } from "redis";
import logger from "../utils/logger";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        logger.error("Redis max reconnection attempts reached");
        return new Error("Redis connection failed");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on("error", (err: Error) =>
  logger.error("Redis Client Error:", err),
);
redisClient.on("connect", () => logger.info("✅ Redis connected"));
redisClient.on("reconnecting", () => logger.warn("⚠️ Redis reconnecting..."));

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error("Failed to connect to Redis:", error);
    throw error;
  }
};

export default redisClient;
