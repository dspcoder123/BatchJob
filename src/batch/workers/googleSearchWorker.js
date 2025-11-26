import { Worker } from "bullmq";
import { connection } from "../../config/redisConfig.js";
import { readData } from "../helpers/reader.js";
import { processGoogleSearch } from "../helpers/googleSearchProcessor.js";
import { writeResult } from "../helpers/writer.js";
import googleSearchHistory from "../models/googleSearchHistory.js";
import GoogleSearchJob from "../models/googleSearchJob.js";  // Import added
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Mongo connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() =>
    console.log("✅ Connected to MongoDB for Google Search worker")
  )
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, text) {
  try {
    const info = await transporter.sendMail({
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

const googleWorker = new Worker(
  "google-search-queue",
  async (job) => {
    console.log(`Processing Google Search job: ${job.id} (${job.name})`);

    const input = await readData(job.data); // expects { userEmail, query, ... }
    const processed = await processGoogleSearch(job.name, input);
    const output = await writeResult(processed);

    // 1️⃣ Update job document basic status + result
    if (job.data.jobDocId) {
      await GoogleSearchJob.findByIdAndUpdate(
        job.data.jobDocId,
        { status: "completed", result: processed.result },
        { new: true }
      );
    }

    // 1.5️⃣ Insert history entry (before emailSent is known)
    try {
      await googleSearchHistory.findOneAndUpdate(
        { userEmail: input.userEmail, jobType: "googleSearch" },
        {
          $push: {
            history: {
              query: input.query,
              result: processed.result,
              status: "completed",
              emailSent: false, // will update after email
              createdAt: new Date(),
            },
          },
        },
        { new: true, upsert: true }
      );
    } catch (err) {
      console.error("❌ Failed to update Google user history:", err);
    }

    // 2️⃣ Email logic
    let emailSent = false;
    try {
      let summaryText = "No summary found.";
      if (processed.result?.results?.[0]?.snippet) {
        summaryText = processed.result.results[0].snippet;
      } else if (processed.result?.results?.[0]?.title) {
        summaryText = processed.result.results[0].title;
      }

      const emailText = `Your Google Search job is done!\n\nSummary:\n${summaryText}`;

      emailSent = await sendEmail(
        input.userEmail,
        "Your Google Search Result",
        emailText
      );

      console.log(`✅ Email sent to: ${input.userEmail}`);
    } catch (err) {
      console.error("❌ Failed to send email:", err);
    }

    // 3️⃣ Final job update with emailSent
    if (job.data.jobDocId) {
      await GoogleSearchJob.findByIdAndUpdate(
        job.data.jobDocId,
        {
          status: "completed",
          result: processed.result,
          emailSent,
        },
        { new: true }
      );
    }

    // 3.5️⃣ Update last history entry's emailSent = true/false
    try {
      const userHistoryDoc = await googleSearchHistory.findOne({
        userEmail: input.userEmail,
        jobType: "googleSearch",
      });

      if (userHistoryDoc && userHistoryDoc.history.length > 0) {
        const lastIdx = userHistoryDoc.history.length - 1;
        userHistoryDoc.history[lastIdx].emailSent = emailSent;
        await userHistoryDoc.save();
      }
    } catch (err) {
      console.error("❌ Failed to update emailSent in Google user history:", err);
    }

    return output;
  },
  { connection, concurrency: 5, lockDuration: 60000, maxStalledCount: 0 }
);

googleWorker.on("failed", async (job, err) => {
  console.error(`Google job ${job.id} failed:`, err);
  if (job.data.jobDocId) {
    await GoogleSearchJob.findByIdAndUpdate(
      job.data.jobDocId,
      { status: "failed" }
    );
  }
});

googleWorker.on("completed", (job) => {
  console.log(`Google job ${job.id} completed successfully`);
});
