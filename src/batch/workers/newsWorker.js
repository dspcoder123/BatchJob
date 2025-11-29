import { Worker } from "bullmq";
import { connection } from "../../config/redisConfig.js";
import { readData } from "../helpers/reader.js";
import { processNews } from "../helpers/newsProcessor.js";
import { writeResult } from "../helpers/writer.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

import NewsJob from "../models/NewsJob.js";
import NewsAnalysis from "../models/NewsAnalysis.js";

dotenv.config();

// Mongo connection (similar to googleSearchWorker)
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("✅ Connected to MongoDB for News worker"))
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB (news worker):", err);
    process.exit(1);
  });
const newsWorker = new Worker(
  "news-queue",
  async (job) => {
    console.log(`Processing News job: ${job.id} (${job.name})`);
    let output;
    
    try {
      const input = await readData(job.data);
      const processed = await processNews(job.name, input);

      // 1️⃣ Create / update NewsJob doc
      let jobDoc = null;
      if (job.data.jobDocId) {
        jobDoc = await NewsJob.findByIdAndUpdate(
          job.data.jobDocId,
          {
            status: "completed",
            article: processed.article,
            aiAnalysis: processed.aiAnalysis,
            statusFlag: true
          },
          { new: true }
        );
      } else {
        jobDoc = await NewsJob.create({
          jobType: "newsJob",
          status: "completed",
          article: processed.article,
          aiAnalysis: processed.aiAnalysis,
          statusFlag: true
        });
      }

      // 2️⃣ Insert into NewsAnalysis (main collection for UI / Payload)
      const { article, aiAnalysis } = processed;

      // skip if this URL already exists
      const existing = await NewsAnalysis.findOne({ url: article.url });
      if (existing) {
        console.log("⚠️ Skipping duplicate article:", article.url);
      } else {
        const analysisDoc = await NewsAnalysis.create({
          title: article.title,
          description: article.description,
          sourceName: article.sourceName,
          url: article.url,
          urlToImage: article.urlToImage,
          publishedAt: article.publishedAt,
          content: article.content,
          aiText: aiAnalysis.rawJsonText || "",
          status: true,
          jobId: jobDoc ? jobDoc._id.toString() : null
        });
        console.log("✅ Saved NewsAnalysis:", analysisDoc._id);
      }

      output = await writeResult(processed);
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      throw error; // Let BullMQ handle the retry
    }
    
    return output;
  },
  { 
    connection, 
    concurrency: 1, // Reduce concurrency to 1 to prevent lock contention
    lockDuration: 300000, // 5 minutes lock duration
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 100 }, // Keep last 100 failed jobs
    maxStalledCount: 1, // Mark as failed after 1 stall
    retryProcessDelay: 5000 // Wait 5 seconds before retrying a failed job
  }
);

newsWorker.on("failed", async (job, err) => {
  console.error(`News job ${job.id} failed:`, err);
  if (job?.data?.jobDocId) {
    await NewsJob.findByIdAndUpdate(job.data.jobDocId, {
      status: "failed",
      statusFlag: false
    });
  }
});

newsWorker.on("completed", (job) => {
  console.log(`News job ${job.id} completed successfully`);
});

export default newsWorker;
