import express from "express";
import MyaiUserHistory from "../../batch/models/myaiUserHistory.js";

const router = express.Router();

// Add a new entry to a user's history
router.post("/history/add", async (req, res) => {
  const { userEmail, query, result, status, emailSent } = req.body;
  const jobType = "perplexitySearch";
  try {
    const doc = await MyaiUserHistory.findOneAndUpdate(
      { userEmail, jobType },
      { $push: { history: { query, result, status, emailSent } } },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

// Get the whole history for a user
router.get("/history", async (req, res) => {
  const { userEmail } = req.query;
  const jobType = "perplexitySearch";
  try {
    const doc = await MyaiUserHistory.findOne({ userEmail, jobType });
    res.json({ success: true, data: doc ? doc.history : [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

// Clear history for a user (for "New Chat")
router.post("/history/clear", async (req, res) => {
  const { userEmail } = req.body;
  const jobType = "perplexitySearch";
  try {
    const doc = await MyaiUserHistory.findOneAndUpdate(
      { userEmail, jobType },
      { $set: { history: [] } },
      { new: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

export default router;
