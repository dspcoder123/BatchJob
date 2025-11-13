import { jobQueue, job1Queue } from "../batch/queues/jobQueue.js";

export const addJobToQueue = async (
  jobType,
  data,
  queueName = "main-job-queue"
) => {
  try {
    const selectedQueue =
      queueName === "google-search-queue" ? job1Queue : jobQueue;
    const job = await selectedQueue.add(jobType, data);
    console.log(`Job added to ${queueName}: ${job.id}`);
    return job;
  } catch (error) {
    console.error("Failed to add job:", error);
  }
};
