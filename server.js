import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import jobRoutes from "./src/api/routes/jobRoutes.js";
import googleRoutes from "./src/api/routes/addGoogleJob.js";
import myaiUserHistoryRoutes from "./src/api/routes/myaiUserHistory.js";
import googleSearchHistory from "./src/api/routes/googleSearchRoutes.js";
import newsRoutes from "./src/api/routes/newsRoutes.js";

// workers (side‑effect imports start the workers)
import "./src/batch/workers/mainWorker.js";
import "./src/batch/workers/googleSearchWorker.js";
import "./src/batch/workers/newsWorker.js";

// Bull Board setup
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { jobQueue, job1Queue, newsQueue } from "./src/batch/queues/jobQueue.js";
import { enqueueNewsJob } from "./src/batch/helpers/enqueueNewsJob.js";
const app = express();

// Bull Board config
const serverAdapter = new ExpressAdapter();

createBullBoard({
  queues: [
    new BullMQAdapter(jobQueue),      // main-job-queue
    new BullMQAdapter(job1Queue),     // google-search-queue
    new BullMQAdapter(newsQueue)      // news-queue (NEW)
  ],
  serverAdapter
});

serverAdapter.setBasePath("/admin/queues");

// CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://auth-management-iota.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  })
);

// Routes
app.use("/admin/queues", serverAdapter.getRouter());
app.use(express.json());
app.use("/api", jobRoutes);
app.use("/api", googleRoutes);
app.use("/api/myai", myaiUserHistoryRoutes);
app.use("/api/google", googleSearchHistory);
app.use("/api/news", newsRoutes); // NEW

// MongoDB

// ... existing mongoose.connect(...)
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(5000, () => {
      console.log("🚀 Server running on port 5000");

      // 🔁 first run immediately
      enqueueNewsJob("Auto trigger on server start")
        .then((jobDoc) =>
          console.log("🟢 Auto news job enqueued on start:", jobDoc._id.toString())
        )
        .catch((err) => console.error("❌ Failed to enqueue startup news job:", err));

      // 🔁 then every 20 seconds
      setInterval(() => {
        enqueueNewsJob("Auto trigger every 20s")
          .then((jobDoc) =>
            console.log("🕒 Auto news job enqueued (20s):", jobDoc._id.toString())
          )
          .catch((err) => console.error("❌ Failed to enqueue 20s news job:", err));
      }, 20_000);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });

