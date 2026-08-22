import { Searchtool } from "../config/tavily.js";

export const searchAgent = async (state) => {
  try {
    const rawResults = await Searchtool.invoke({
      query: state.prompt,
    });

    let resultsList = [];
    let imagesList = [];

    if (Array.isArray(rawResults)) {
      resultsList = rawResults;
    } else if (rawResults && typeof rawResults === "object") {
      resultsList = Array.isArray(rawResults.results) ? rawResults.results : [rawResults];
      imagesList = Array.isArray(rawResults.images) ? rawResults.images : [];
    } else if (typeof rawResults === "string") {
      try {
        const parsed = JSON.parse(rawResults);
        resultsList = Array.isArray(parsed) ? parsed : (parsed.results || [parsed]);
      } catch {
        resultsList = [{ title: "Search Summary", content: rawResults }];
      }
    }

    return {
      ...state,
      searchResults: resultsList,
      images: imagesList,
    };
  } catch (error) {
    console.error("Search agent error:", error.message);
    return {
      ...state,
      searchResults: [],
      images: [],
    };
  }
};

