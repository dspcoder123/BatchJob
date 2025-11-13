import mongoose from "mongoose";
const jobSchema = new mongoose.Schema({
  jobType: String,
  userEmail: String,
  query: String,
  status: { type: String, default: "pending" },
  result: mongoose.Schema.Types.Mixed,
  emailSent: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.model("Job", jobSchema);
