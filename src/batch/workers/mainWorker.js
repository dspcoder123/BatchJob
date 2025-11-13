import { Worker } from "bullmq";
import { connection } from "../../config/redisConfig.js";
import { readData } from "../helpers/reader.js";
import { processTask } from "../helpers/processor.js";
import { writeResult } from "../helpers/writer.js";
import Job from "../models/job.js";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
import MyaiUserHistory from '../models/myaiUserHistory.js';
dotenv.config();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB for worker"))
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1); // Exit if can't connect (prevents silent failures)
  });

// Email sending helper (configure .env)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, text) {
  try {
    let info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
    console.log("✅ Email sent: ", info.response, info.accepted);
    return true;
  } catch (err) {
    console.error("❌ Email error:", err);
    return false;
  }
}

const mainWorker = new Worker(
  "main-job-queue",
  async (job) => {
    console.log(`Processing job: ${job.id} (${job.name})`);
    const input = await readData(job.data);
    const processed = await processTask(job.name, input);
    const output = await writeResult(processed);

    // 1️⃣ Update result in DB
    if (job.data.jobDocId) {
      await Job.findByIdAndUpdate(
        job.data.jobDocId,
        { status: "completed", result: processed.result },
        { new: true }
      );
    }

      // 1.5️⃣ New: Update or Insert per-user history document with multiple entries
      try {
        await MyaiUserHistory.findOneAndUpdate(
          { userEmail: input.userEmail, jobType: "perplexitySearch" },
          {
            $push: {
              history: {
                query: input.query,
                result: processed.result,
                status: "completed",
                emailSent: false,  // will update next
                createdAt: new Date()
              }
            }
          },
          { new: true, upsert: true }
        );
      } catch (err) {
        console.error("❌ Failed to update MyAI user history:", err);
      }

    // 2️⃣ Trigger email and update status
    let emailSent = false;
    try {
      let summaryText = "No summary found.";
      if (processed.result?.results?.[0]?.snippet) {
        summaryText = processed.result.results[0].snippet;
      } else if (processed.result?.results?.[0]?.title) {
        summaryText = processed.result.results[0].title;
      }

      const emailText = `Your job is done!\n\nSummary:\n${summaryText}`;

      emailSent = await sendEmail(
        input.userEmail,
        "Your Perplexity Job Result",
        emailText
      );
      console.log(`✅ Email sent to: ${input.userEmail}`);
    } catch (err) {
      console.error("❌ Failed to send email:", err);
    }

    // Final DB update for status and email
    if (job.data.jobDocId) {
      await Job.findByIdAndUpdate(
        job.data.jobDocId,
        { status: "completed", result: processed.result, emailSent },
        { new: true }
      );
    }
    const userHistoryDoc = await MyaiUserHistory.findOne({
      userEmail: input.userEmail,
      jobType: "perplexitySearch"
    });
    
    if (userHistoryDoc && userHistoryDoc.history.length > 0) {
      const lastIdx = userHistoryDoc.history.length - 1;
      userHistoryDoc.history[lastIdx].emailSent = emailSent;
      await userHistoryDoc.save();
    }
``    

     // 3.5️⃣ New: Also update last history array element's emailSent in user history
     try {
      await MyaiUserHistory.findOneAndUpdate(
        { userEmail: input.userEmail, jobType: "perplexitySearch" },
        { $set: { "history.-1.emailSent": emailSent } }
      );
    } catch (err) {
      console.error("❌ Failed to update emailSent in MyAI user history:", err);
    }

    return output;
  },
  { connection  , concurrency: 5 , lockDuration: 60000 , maxStalledCount: 0 }
);

mainWorker.on("failed", async (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
  if (job.data.jobDocId) {
    await Job.findByIdAndUpdate(job.data.jobDocId, { status: "failed" });
  }
});