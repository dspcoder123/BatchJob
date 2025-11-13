import axios from "axios";

// Replace with your Perplexity API key and endpoint
const PERPLEXITY_API_URL = "https://api.perplexity.ai/search";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

export const processTask = async (jobType, data) => {
  if (jobType === "searchQuery") {
    const response = await axios.post(PERPLEXITY_API_URL, {
      query: data.query,
    }, {
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}` },
    });
    return { ...data, result: response.data };
  }
  return { ...data, result: "Job type not supported" };
};
export default processTask;
