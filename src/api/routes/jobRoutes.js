import express from "express";
import { addJobToQueue } from "../producer.js";
import Job from "../../batch/models/job.js";

const router = express.Router();

router.post("/add-job", async (req, res) => {
  try {
    const { query, userEmail } = req.body;
    if (!query || !userEmail) {
      return res.status(400).json({ error: "query and userEmail are required" });
    }

    // 1. Create a job record in MongoDB
    const jobDoc = await Job.create({
      jobType: "searchQuery",
      query,
      userEmail,
      status: "pending",
      emailSent: false,
    });

    // 2. Add job to BullMQ queue, include db Doc ID
    const job = await addJobToQueue("searchQuery", {
      query,
      userEmail,
      jobDocId: jobDoc._id,
    });

    // 3. Respond with both queue and DB IDs
    res.status(200).json({
      message: "Job added",
      jobId: job.id,
      dbId: jobDoc._id,
    });

  } catch (error) {
    console.error("❌ Failed to add job to DB or queue:", error);
    res.status(500).json({ error: "Failed to add job" });
  }
});



// POST /api/retry-pending
router.post("/retry-pending", async (req, res) => {
  try {
    // Find pending jobs where email was NOT sent
    const pendingJobs = await Job.find({ status: "pending", emailSent: false });

    if (pendingJobs.length === 0) {
      return res.json({ message: "No pending jobs found" });
    }

    // Requeue each job
    const results = [];
    for (let jobDoc of pendingJobs) {
      const job = await addJobToQueue(jobDoc.jobType, {
        query: jobDoc.query,
        userEmail: jobDoc.userEmail,
        jobDocId: jobDoc._id,
      });
      results.push({ jobId: job.id, dbId: jobDoc._id });
    }

    res.json({ message: "Jobs requeued", jobs: results });
  } catch (error) {
    console.error("❌ Error requeuing jobs:", error);
    res.status(500).json({ error: "Failed to requeue pending jobs" });
  }
});


export default router;
