import { Worker } from "bullmq";
import { connection } from "../../config/redisConfig.js";
import { readData } from "../helpers/reader.js";
import { processGoogleSearch } from "../helpers/googleSearchProcessor.js";
import { writeResult } from "../helpers/writer.js";
import GoogleSearchJob from "../models/googleSearchJob.js";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB for Google Search worker"))
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });

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

const googleWorker = new Worker(
  "google-search-queue",
  async (job) => {
    console.log(`Processing Google Search job: ${job.id} (${job.name})`);
    const input = await readData(job.data);
    const processed = await processGoogleSearch(job.name, input);
    const output = await writeResult(processed);

    if (job.data.jobDocId) {
      await GoogleSearchJob.findByIdAndUpdate(
        job.data.jobDocId,
        { status: "completed", result: processed.result },
        { new: true }
      );
    }

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

    if (job.data.jobDocId) {
      await GoogleSearchJob.findByIdAndUpdate(
        job.data.jobDocId,
        { status: "completed", result: processed.result, emailSent },
        { new: true }
      );
    }

    return output;
  },
  { connection, concurrency: 5, lockDuration: 60000, maxStalledCount: 0 }
);

googleWorker.on("failed", async (job, err) => {
  console.error(`Google job ${job.id} failed:`, err);
  if (job.data.jobDocId) {
    await GoogleSearchJob.findByIdAndUpdate(job.data.jobDocId, {
      status: "failed",
    });
  }
});

googleWorker.on("completed", (job) => {
  console.log(`Google job ${job.id} completed successfully`);
});
