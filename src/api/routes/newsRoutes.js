// src/api/routes/newsRoutes.js
import express from "express";
import { enqueueNewsJob } from "../../batch/helpers/enqueueNewsJob.js";
import NewsAnalysis from "../../batch/models/NewsAnalysis.js";
const router = express.Router();

router.post("/run-news-once", async (req, res) => {
  try {
    const jobDoc = await enqueueNewsJob("Manual trigger from /api/news/run-news-once");
    res.json({ message: "News job enqueued", jobId: jobDoc._id });
  } catch (err) {
    console.error("❌ Failed to enqueue news job:", err);
    res.status(500).json({ error: "Failed to enqueue news job" });
  }
});


// GET /api/news/jobs  -> all news jobs (latest first)
// GET /api/news/analyses  -> all analyzed news, latest first
router.get("/analyses", async (req, res) => {
  try {
    const analyses = await NewsAnalysis.find().sort({ createdAt: -1 } ).limit(2); ; // newest first [web:208]
    res.json(analyses).format;
  } catch (err) {
    console.error("❌ Failed to fetch news analyses:", err);
    res.status(500).json({ error: "Failed to fetch news analyses" });
  }
});

export default router;
