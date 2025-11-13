import mongoose from "mongoose";

const searchEntrySchema = new mongoose.Schema({
  query: String,
  result: mongoose.Schema.Types.Mixed,
  status: String,
  emailSent: Boolean,
  createdAt: { type: Date, default: Date.now }
});

const userHistorySchema = new mongoose.Schema({
  userEmail: String,
  jobType: { type: String, default: "perplexitySearch" },
  history: [searchEntrySchema]
}, { timestamps: true });

export default mongoose.model("MyaiUserHistory", userHistorySchema);
