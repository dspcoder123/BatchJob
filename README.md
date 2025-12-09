# Batch Job Processing System

## 1. Overview

This project is a **background job processing system** built with:

- Node.js + Express – HTTP API server
- BullMQ + Redis – Job queues & background workers
- MongoDB + Mongoose – Persistent storage
- External services:
  - Perplexity AI (Main worker)
  - Google Search (Google worker)
  - News API + AI analysis (News worker)
- Nodemailer – Sends email notifications to users

There are **three workers**, all using Redis via BullMQ:

- Main Worker (Perplexity AI) – Queue: `main-job-queue`
- Google Search Worker – Queue: `google-search-queue`
- News Worker – Queue: `news-queue`

A Bull Board UI is provided to monitor all queues.

---

## 2. Folder Structure

```text
BatchJob/
├── .env                     # Local environment variables
├── .env.example             # Example env configuration
├── package.json             # Node.js dependencies and scripts
├── package-lock.json
├── readme                   # Original short readme (optional)
├── redisfile.txt            # Redis-related notes (optional)
├── server.js                # Main Express server + workers + Bull Board
└── src/
    ├── api/
    │   └── routes/
    │       ├── jobRoutes.js            # Perplexity job APIs
    │       ├── addGoogleJob.js         # Google Search job APIs
    │       ├── myaiUserHistory.js      # Perplexity history APIs
    │       ├── googleSearchRoutes.js   # Google history APIs
    │       └── newsRoutes.js           # News job/result APIs
    │
    ├── batch/
    │   ├── queues/
    │   │   └── jobQueue.js             # BullMQ queues (main/google/news)
    │   │
    │   ├── workers/
    │   │   ├── mainWorker.js           # Main (Perplexity) worker
    │   │   ├── googleSearchWorker.js   # Google Search worker
    │   │   └── newsWorker.js           # News worker
    │   │
    │   ├── helpers/
    │   │   ├── reader.js               # Normalizes/reads job input
    │   │   ├── writer.js               # Normalizes/writes job output
    │   │   ├── processor.js            # Perplexity processing logic
    │   │   ├── googleSearchProcessor.js# Google Search processing
    │   │   └── newsProcessor.js        # News fetch + AI analysis
    │   │
    │   └── models/
    │       ├── job.js                  # Perplexity job model
    │       ├── myaiUserHistory.js      # Perplexity user history
    │       ├── googleSearchJob.js      # Google Search job model
    │       ├── googleSearchHistory.js  # Google Search history
    │       ├── NewsJob.js              # News job model
    │       └── NewsAnalysis.js         # News analysis for UI
    │
    ├── config/
    │   └── redisConfig.js              # Shared Redis (ioredis) connection
    │
    └── collections/                    # (Currently unused / reserved)
```

---

## 3. Environment & Setup

### 3.1 Environment Variables

Create a `.env` file based on `.env.example`. Typical keys:

```env
# Server
PORT=5000

# MongoDB
MONGO_URI=mongodb://localhost:27017/batchjob

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Email / Gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password   # Use an app password, not raw Gmail password

# API keys
PERPLEXITY_API_KEY=...
GOOGLE_API_KEY=...
NEWS_API_KEY=...
```

### 3.2 Install Dependencies

```bash
npm install
```

### 3.3 Start Redis

Redis must be running before you start the app, for example:

```bash
# Example with Docker
docker run -p 6379:6379 redis
```

Or use any local/remote Redis instance reachable from this app.

### 3.4 Start the Server

```bash
npm start
# or
node server.js
```

The server will start the Express app, initialize Bull Board, and automatically start all three workers.

---

## 4. Redis & Queue Setup

### 4.1 Redis Configuration

`src/config/redisConfig.js` defines a shared Redis connection using `ioredis`:

```js
import { Redis } from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const connection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});
```

This `connection` is reused by all queues and workers.

### 4.2 BullMQ Queues

`src/batch/queues/jobQueue.js`:

```js
import { Queue } from "bullmq";
import { connection } from "../../config/redisConfig.js";

export const jobQueue = new Queue("main-job-queue", { connection });
export const job1Queue = new Queue("google-search-queue", { connection });
export const newsQueue = new Queue("news-queue", { connection });
```

- `jobQueue` → Main/Perplexity worker
- `job1Queue` → Google Search worker
- `newsQueue` → News worker

APIs push jobs to these queues; workers consume them in the background.

---

## 5. Server & Bull Board

### 5.1 Server Entry Point

`server.js`:

- Initializes Express app
- Configures CORS and JSON middleware
- Registers routes:
  - `/api` + `jobRoutes.js` for main jobs
  - `/api` + `addGoogleJob.js` for Google jobs
  - `/api/myai` + `myaiUserHistory.js`
  - `/api/google` + `googleSearchRoutes.js`
  - `/api/news` + `newsRoutes.js`
- Sets up Bull Board for monitoring queues
- Imports workers, which start listening to their queues:

```js
import "./src/batch/workers/mainWorker.js";
import "./src/batch/workers/googleSearchWorker.js";
import "./src/batch/workers/newsWorker.js";
```

### 5.2 Bull Board UI

Bull Board is configured with `@bull-board/api` and `@bull-board/express` and is mounted at:

- `http://localhost:<PORT>/admin/queues`

From there you can:

- View queues: `main-job-queue`, `google-search-queue`, `news-queue`
- Inspect jobs, payloads, logs, failures
- Retry or remove jobs manually

---

## 6. Worker 1 – Main Worker (Perplexity AI)

**File**: `src/batch/workers/mainWorker.js`

**Queue name**: `main-job-queue`

### 6.1 Responsibilities

- Consume jobs from `main-job-queue`
- Call Perplexity AI via `processTask`
- Store results in:
  - `Job` collection (per job)
  - `MyaiUserHistory` collection (per user)
- Send an email notification to the user
- Update job status on success/failure

### 6.2 Handler Flow (Simple)

1. Read input from the job data (`query`, `userEmail`, `jobDocId`).
2. Call `processTask(job.name, input)` which talks to Perplexity.
3. Write normalized output using `writeResult(processed)`.
4. Update `Job` document (status + result).
5. Append an entry in `MyaiUserHistory`.
6. Send an email to `userEmail` with a small summary.
7. Update `emailSent` flag in both `Job` and `MyaiUserHistory`.
8. On error, mark the job as `failed`.

### 6.3 APIs for Main Worker

#### Add a Perplexity job

- **URL**: `POST /api/add-job`
- **Body**:

```json
{
  "query": "What is the impact of AI in healthcare?",
  "userEmail": "user@example.com"
}
```

- **Response (example)**:

```json
{
  "message": "Job added",
  "jobId": "1694991938710-0",
  "dbId": "6751234c9876abc123456789"
}
```

#### Retry pending Perplexity jobs

- **URL**: `POST /api/retry-pending`
- **Body**: none

- **Response (example)**:

```json
{
  "message": "Jobs requeued",
  "jobs": [
    { "jobId": "1694991938710-1", "dbId": "6751234c9876abc123456789" }
  ]
}
```

---

## 7. Worker 2 – Google Search Worker

**File**: `src/batch/workers/googleSearchWorker.js`

**Queue name**: `google-search-queue`

### 7.1 Responsibilities

- Consume jobs from `google-search-queue`
- Execute Google search logic via `processGoogleSearch`
- Store results in:
  - `GoogleSearchJob` (per job)
  - `googleSearchHistory` (per user)
- Send an email with a snippet / title
- Update status and handle failures

### 7.2 Handler Flow (Simple)

1. Read input (`query`, `userEmail`, `jobDocId`).
2. Call `processGoogleSearch(job.name, input)`.
3. Persist result via `writeResult(processed)`.
4. Update `GoogleSearchJob` with `status: completed`, `result`.
5. Append history entry in `googleSearchHistory` with `emailSent: false`.
6. Send email to user with top search snippet/title.
7. Update `emailSent` in both `GoogleSearchJob` and the latest history entry.
8. On failure, mark job as `failed`.

### 7.3 APIs for Google Search Worker

#### Add a Google Search job

- **URL**: `POST /api/add-google-job`
- **Body**:

```json
{
  "query": "Latest Node.js features 2024",
  "userEmail": "user@example.com"
}
```

- **Response (example)**:

```json
{
  "message": "Google Search Job added",
  "jobId": "1694992000123-0",
  "dbId": "6751234c9876abc123456791"
}
```

---

## 8. Worker 3 – News Worker

**File**: `src/batch/workers/newsWorker.js`

**Queue name**: `news-queue`

### 8.1 Responsibilities

- Consume jobs from `news-queue`
- Use `processNews` to:
  - Fetch a news article
  - Generate AI analysis of that article
- Store:
  - Internal job state in `NewsJob`
  - Final article + AI analysis in `NewsAnalysis`
- Avoid duplicates (by URL)

### 8.2 Simple Flow

1. API call `POST /api/news/run-news-once` triggers a manual job.
2. `newsRoutes.js` calls `enqueueNewsJob(...)`.
3. `enqueueNewsJob` creates/updates a `NewsJob` document and enqueues to `news-queue`.
4. `newsWorker` picks the job:
   - Reads input via `readData(job.data)`.
   - Calls `processNews(job.name, input)` to get `{ article, aiAnalysis }`.
5. Updates or creates `NewsJob` with `status: completed`, `article`, `aiAnalysis`, `statusFlag: true`.
6. Checks `NewsAnalysis` by `url`:
   - If exists → skip (duplicate).
   - Else → create new `NewsAnalysis` with article fields + AI text.
7. Returns output via `writeResult(processed)`.
8. On failure, sets `status: failed`, `statusFlag: false` in `NewsJob`.

### 8.3 APIs for News Worker

#### Trigger one News job

- **URL**: `POST /api/news/run-news-once`
- **Body**: none

- **Response (example)**:

```json
{
  "message": "News job enqueued",
  "jobId": "6751234c9876abc123456792"
}
```

#### Fetch analyzed news

- **URL**: `GET /api/news/analyses`
- **Body**: none

- **Response (example)**:

```json
[
  {
    "_id": "6751234c9876abc123456793",
    "title": "Breaking: Example News Headline",
    "description": "Short description...",
    "sourceName": "Example News",
    "url": "https://example.com/news/123",
    "urlToImage": "https://example.com/image.jpg",
    "publishedAt": "2025-11-29T10:01:00.000Z",
    "content": "Full content or partial text...",
    "aiText": "{ ... AI analysis text ... }",
    "status": true,
    "jobId": "6751234c9876abc123456792",
    "createdAt": "2025-11-29T10:05:00.000Z"
  }
]
```

---

## 9. End-to-End Flows (Summary)

### 9.1 Perplexity Worker Flow

1. Client calls `POST /api/add-job`.
2. App creates a `Job` doc and enqueues to `main-job-queue`.
3. `mainWorker` processes query with Perplexity.
4. Result stored in `Job` + `MyaiUserHistory`.
5. Email summary sent to user.

### 9.2 Google Search Worker Flow

1. Client calls `POST /api/add-google-job`.
2. App creates `GoogleSearchJob` and enqueues to `google-search-queue`.
3. `googleSearchWorker` runs search and stores result.
4. History updated in `googleSearchHistory`.
5. Email summary sent to user.

### 9.3 News Worker Flow

1. Client calls `POST /api/news/run-news-once`.
2. App enqueues job to `news-queue` via `enqueueNewsJob`.
3. `newsWorker` fetches article and AI analysis.
4. Saves `NewsJob` + `NewsAnalysis` (no duplicates by URL).
5. Frontend can read from `GET /api/news/analyses`.

---

## 10. Monitoring & Debugging

- Use **Bull Board** at `/admin/queues` to monitor queues and jobs.
- Check logs in the terminal for worker processing, failures, and email statuses.
- Inspect MongoDB collections (`Job`, `MyaiUserHistory`, `GoogleSearchJob`, `googleSearchHistory`, `NewsJob`, `NewsAnalysis`) to verify stored data.
