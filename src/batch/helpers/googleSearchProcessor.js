import axios from "axios";

const API_KEY = process.env.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

export const processGoogleSearch = async (jobType, data) => {
  if (jobType === "googleSearch") {
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(data.query)}&num=10`;
    const response = await axios.get(url);
    const simplifiedResults = (response.data.items || []).map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      htmlTitle: item.htmlTitle,
      htmlSnippet: item.htmlSnippet,
      displayLink: item.displayLink,
      formattedUrl: item.formattedUrl,
      pagemap: item.pagemap
    }));
    return { ...data, result: { results: simplifiedResults } };
  }
  return { ...data, result: "Job type not supported" };
};
export default processGoogleSearch;
