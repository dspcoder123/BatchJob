import mongoose from "mongoose";

const googleSearchJobSchema = new mongoose.Schema(
  {
    jobType: { type: String, default: "googleSearch" },
    userEmail: String,
    query: String,
    status: { type: String, default: "pending" },
    result: mongoose.Schema.Types.Mixed,
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("GoogleSearchJob", googleSearchJobSchema);
