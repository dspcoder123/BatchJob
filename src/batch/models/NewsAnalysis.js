import mongoose from "mongoose";

const newsAnalysisSchema = new mongoose.Schema(
    {
      title: { type: String, required: true },
      description: String,
      sourceName: String,
      url: { type: String, index: true, unique: true }, // <- make URL unique
      urlToImage: String,
      publishedAt: String,
      content: String,

      // structured AI analysis fields (simple strings)
      impactDescription: String,
      quickActions: String,

      status: { type: Boolean, default: true },
      jobId: { type: String }
    },
    { timestamps: true }
  );
  

export default mongoose.model("NewsAnalysis", newsAnalysisSchema);
