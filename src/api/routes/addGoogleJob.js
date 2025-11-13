import express from "express";
import { addJobToQueue } from "../producer.js";
import GoogleSearchJob from "../../batch/models/googleSearchJob.js";

const router = express.Router();

router.post("/add-google-job", async (req, res) => {
  try {
    const { query, userEmail } = req.body;
    if (!query || !userEmail) {
      return res
        .status(400)
        .json({ error: "query and userEmail are required" });
    }

    const jobDoc = await GoogleSearchJob.create({
      jobType: "googleSearch",
      query,
      userEmail,
      status: "pending",
      emailSent: false,
    });

    const job = await addJobToQueue(
      "googleSearch",
      {
        query,
        userEmail,
        jobDocId: jobDoc._id,
      },
      "google-search-queue"
    );

    res.status(200).json({
      message: "Google Search Job added",
      jobId: job.id,
      dbId: jobDoc._id,
    });
  } catch (error) {
    console.error("❌ Failed to add Google Search job:", error);
    res.status(500).json({ error: "Failed to add google search job" });
  }
});

export default router;
