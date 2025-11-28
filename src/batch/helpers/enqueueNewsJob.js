// src/batch/helpers/enqueueNewsJob.js
import { newsQueue } from "../queues/jobQueue.js";
import NewsJob from "../models/NewsJob.js";

export async function enqueueNewsJob(note = "Auto trigger") {
  const jobDoc = await NewsJob.create({
    jobType: "newsJob",
    status: "pending",
    note,
    statusFlag: false
  });

  await newsQueue.add("newsJob", { jobDocId: jobDoc._id.toString() });

  return jobDoc;
}
