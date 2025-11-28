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

    const input = await readData(job.data); // can contain extra metadata if you need
    const processed = await processNews(job.name, input);

    // 1️⃣ Create / update NewsJob doc
    let jobDoc = null;
    try {
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
    } catch (err) {
      console.error("❌ Failed to create/update NewsJob:", err);
    }

    // 2️⃣ Insert into NewsAnalysis (main collection for UI / Payload)
    try {
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
            jobId: jobDoc ? jobDoc._id : null
          });
        
          console.log("✅ Saved NewsAnalysis:", analysisDoc._id);
        }
    } catch (err) {
      console.error("❌ Failed to save NewsAnalysis:", err);
    }

    const output = await writeResult(processed);
    return output;
  },
  { connection, concurrency: 2, lockDuration: 60000, maxStalledCount: 0 }
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
