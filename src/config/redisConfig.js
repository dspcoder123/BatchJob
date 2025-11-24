import { Redis } from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
export const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

// Optional: Ping test for connectivity check
connection.ping()
  .then(res => console.log("Redis ping response:", res))
  .catch(err => console.error("Redis ping error:", err));
