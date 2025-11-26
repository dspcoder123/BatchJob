// models/googleSearchHistory.js
import mongoose from "mongoose";

const googleHistoryItemSchema = new mongoose.Schema({
  query: String,
  result: mongoose.Schema.Types.Mixed,
  status: { type: String, default: "completed" },
  emailSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const googleSearchHistorySchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  jobType: { type: String, default: "googleSearch" },
  history: [googleHistoryItemSchema],
});

export default mongoose.model("GoogleSearchHistory", googleSearchHistorySchema);
