import express from "express";
import mongoose from "mongoose";
import jobRoutes from "./src/api/routes/jobRoutes.js";
import googleRoutes from "./src/api/routes/addGoogleJob.js";
import myaiUserHistoryRoutes from './src/api/routes/myaiUserHistory.js'
import "./src/batch/workers/mainWorker.js";
import "./src/batch/workers/googleSearchWorker.js";
import cors from 'cors';



// Bull Board setup
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { jobQueue, job1Queue } from "./src/batch/queues/jobQueue.js";

const app = express();
const serverAdapter = new ExpressAdapter();
// Configure Bull Board with both queues
createBullBoard({
  queues: [new BullMQAdapter(jobQueue), new BullMQAdapter(job1Queue)],
  serverAdapter,
});
serverAdapter.setBasePath("/admin/queues");
app.use(cors({
  origin: 'http://localhost:3000', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true // if you need to send cookies or auth headers
}));


app.use("/admin/queues", serverAdapter.getRouter());
app.use(express.json());
app.use("/api", jobRoutes);
app.use("/api", googleRoutes);
app.use('/api/myai', myaiUserHistoryRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(5000, () => console.log("🚀 Server running on port 4000"));
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });
