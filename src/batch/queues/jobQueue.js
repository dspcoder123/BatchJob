import { Queue } from "bullmq";
import { connection } from "../../config/redisConfig.js";
export const jobQueue = new Queue("main-job-queue", { connection });
export const job1Queue = new Queue("google-search-queue" , {connection});
export const newsQueue = new Queue("news-queue" , {connection})
