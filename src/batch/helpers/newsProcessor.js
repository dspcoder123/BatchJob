import axios from "axios";
import NewsAnalysis from "../models/NewsAnalysis.js"; // adjust path if needed

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

// Helper: call NewsAPI and return the latest article
async function fetchLatestNewsArticle() {
  const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=100&apiKey=${NEWS_API_KEY}`;

  console.log("🔎 Calling NewsAPI:", url);

  try {
    const response = await axios.get(url, { timeout: 20000 });
    console.log("✅ NewsAPI status:", response.status);

    const articles = response.data.articles || [];
    if (!articles.length) {
      throw new Error("No articles returned from NewsAPI");
    }

        // pick first article whose URL is not already in NewsAnalysis
        let article = null;
        for (const a of articles) {
          if (!a?.url) continue;
          const exists = await NewsAnalysis.findOne({ url: a.url }).lean();
          if (!exists) {
            article = a;
            break;
          }
        }
    
        // if all are already seen, just take the first one (to avoid total failure)
        if (!article) {
          console.log("⚠️ All fetched headlines already processed; reusing latest.");
          article = articles[0];
        }

    return {
      sourceName: article.source?.name || null,
      author: article.author || null,
      title: article.title || "",
      description: article.description || "",
      url: article.url || "",
      urlToImage: article.urlToImage || "",
      publishedAt: article.publishedAt || null,
      content: article.content || ""
    };
  } catch (err) {
    console.error("❌ NewsAPI error:", err.message);
    throw err;
  }
}

// Helper: call Perplexity to get simple impact description + quick actions text
async function analyzeArticleWithAI(article) {
  const systemPrompt = `
You are an AI that analyzes news articles and returns STRICT JSON.

Rules:
- Start directly with "{" and end with "}" (no markdown, no commentary).
- Follow this exact shape:
{
  "impactDescription": "5-6 sentences explaining the overall impact of this news for a general audience.",
  "quickActions": "3-6 short bullet-style suggestions in plain text, separated by line breaks, telling the reader what to do or how to think about this news."
}
- Do NOT add any other keys.
- Do NOT wrap the output in markdown code fences or any extra text.
`.trim();

  const userPrompt = `
Here is a news article. Analyze it and follow the JSON shape from the system message.

Title: ${article.title}
Description: ${article.description}
Source: ${article.sourceName}
URL: ${article.url}
PublishedAt: ${article.publishedAt}
ContentSnippet: ${article.content}
`.trim();

  const body = {
    model: "sonar-pro",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 350
  };

  let response;
  try {
    response = await axios.post(PERPLEXITY_URL, body, {
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 15000
    });
  } catch (err) {
    console.error("❌ Perplexity error status:", err.response?.status);
    console.error("❌ Perplexity error body:", err.response?.data);
    // if API fails, return empty text
    return { rawJsonText: "" };
  }

  let content = response.data?.choices?.[0]?.message?.content || "";
  content = content.trim();

  // strip ``` if model still wraps in code fences
  if (content.startsWith("```")) {
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      content = content.slice(firstBrace, lastBrace + 1);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error("❌ Failed to parse AI JSON, falling back to empty strings", e.message);
    parsed = {
      impactDescription: "",
      quickActions: ""
    };
  }

  const {
    impactDescription = "",
    quickActions = ""
  } = parsed || {};

  return {
    impactDescription,
    quickActions
  };
}

// Main processor entry
export const processNews = async (jobType, data) => {
  if (jobType !== "newsJob") {
    return { ...data, result: "Job type not supported" };
  }

  const article = await fetchLatestNewsArticle();
  const aiAnalysis = await analyzeArticleWithAI(article);

  return {
    ...data,
    article,
    aiAnalysis
  };
};

export default processNews;
