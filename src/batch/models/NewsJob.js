import mongoose from "mongoose";

const newsJobSchema = new mongoose.Schema(
  {
    jobType: { type: String, default: "newsJob" },
    status: { type: String, default: "pending" }, // pending | completed | failed
    // for debugging / trace
    note: { type: String },

    // original article snapshot
    article: {
      sourceName: String,
      author: String,
      title: String,
      description: String,
      url: String,
      urlToImage: String,
      publishedAt: String,
      content: String
    },

    // AI analysis (simple strings)
    aiAnalysis: {
      impactDescription: String,
      quickActions: String
    },

    // flag you mentioned
    statusFlag: { type: Boolean, default: true } // true = active/visible
  },
  { timestamps: true }
);

export default mongoose.model("NewsJob", newsJobSchema);
