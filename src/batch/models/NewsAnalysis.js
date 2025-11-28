import mongoose from "mongoose";

const quickActionSchema = new mongoose.Schema(
  {
    audience: String,
    actionTitle: String,
    actionDescription: String
  },
  { _id: false }
);

const impactSummarySchema = new mongoose.Schema(
  {
    geopolitics: String,
    economyAndMarkets: String,
    publicPerception: String
  },
  { _id: false }
);

const newsAnalysisSchema = new mongoose.Schema(
    {
      title: { type: String, required: true },
      description: String,
      sourceName: String,
      url: { type: String, index: true, unique: true }, // <- make URL unique
      urlToImage: String,
      publishedAt: String,
      content: String,
  
      // store AI JSON-like output as plain string
      aiText: String,
  
      status: { type: Boolean, default: true },
      jobId: { type: mongoose.Schema.Types.ObjectId, ref: "NewsJob" }
    },
    { timestamps: true }
  );
  

export default mongoose.model("NewsAnalysis", newsAnalysisSchema);
