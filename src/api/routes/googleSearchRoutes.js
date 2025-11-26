import express from "express";
import GoogleSearchHistory from '../../batch/models/googleSearchHistory.js';

const router = express.Router();

// Add entry to Google search history
router.post("/history/add", async (req, res) => {
  const { userEmail, query, result, status, emailSent } = req.body;
  const jobType = "googleSearch";

  try {
    const doc = await GoogleSearchHistory.findOneAndUpdate(
      { userEmail, jobType },
      { $push: { history: { query, result, status, emailSent } } },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

// Get all Google search history
router.get("/history", async (req, res) => {
  const { userEmail } = req.query;
  const jobType = "googleSearch";

  try {
    const doc = await GoogleSearchHistory.findOne({ userEmail, jobType });
    res.json({ success: true, data: doc ? doc.history : [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

// Clear Google history (optional)
router.post("/history/clear", async (req, res) => {
  const { userEmail } = req.body;
  const jobType = "googleSearch";

  try {
    const doc = await GoogleSearchHistory.findOneAndUpdate(
      { userEmail, jobType },
      { $set: { history: [] } },
      { new: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

// Delete one search entry
router.delete("/history/:historyId", async (req, res) => {
  const { historyId } = req.params;
  const { userEmail } = req.query;
  const jobType = "googleSearch";

  try {
    const doc = await GoogleSearchHistory.findOneAndUpdate(
      { userEmail, jobType },
      { $pull: { history: { _id: historyId } } },
      { new: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

// Rename a history item
router.post("/history/rename", async (req, res) => {
  const { historyId, newQuery, userEmail } = req.body;
  const jobType = "googleSearch";

  try {
    await GoogleSearchHistory.updateOne(
      { userEmail, jobType, "history._id": historyId },
      { $set: { "history.$.query": newQuery } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

export default router;
