import axios from "axios";

/**
 * Searches and downloads real high-resolution internet images (using Tavily Web Search & Unsplash).
 * Consumes zero AI image generation tokens.
 * 
 * @param {string} keywordOrPrompt Search query keyword for the image
 * @returns {Promise<Buffer|null>} Image buffer or null if no valid image is found
 */
export const fetchImageBuffer = async (keywordOrPrompt) => {
  if (!keywordOrPrompt || typeof keywordOrPrompt !== "string" || !keywordOrPrompt.trim()) {
    return null;
  }

  // Clean search query to extract real-world subjects
  const cleanQuery = keywordOrPrompt
    .replace(/photorealistic|photography|hd|4k|hyperrealistic|ultra|cinematic|detailed|background|wide angle|camera angle|lighting/gi, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim();

  if (!cleanQuery) return null;

  // 1. Search real high-resolution internet images via Tavily Search API
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (apiKey) {
      console.log(`🌐 [Internet Image Search] Searching real web images for: "${cleanQuery}"...`);

      const tavilyRes = await axios.post(
        "https://api.tavily.com/search",
        {
          api_key: apiKey,
          query: `${cleanQuery} high quality photo`,
          include_images: true,
          max_results: 5,
        },
        { timeout: 10000 }
      );

      const imageUrls = tavilyRes.data?.images || [];

      for (const imgUrl of imageUrls) {
        if (typeof imgUrl === "string" && /^https?:\/\//i.test(imgUrl)) {
          try {
            console.log(`📥 [Internet Image Search] Downloading web image from: ${imgUrl.slice(0, 70)}...`);

            const imgResponse = await axios.get(imgUrl, {
              responseType: "arraybuffer",
              timeout: 12000,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
            });

            if (imgResponse?.data && imgResponse.data.length > 2000) {
              const buf = Buffer.from(imgResponse.data);
              console.log(`✅ [Internet Image Search] Image acquired successfully (${buf.length} bytes)`);
              return buf;
            }
          } catch (dlErr) {
            console.warn(`Failed downloading image URL ${imgUrl.slice(0, 40)}:`, dlErr.message);
          }
        }
      }
    }
  } catch (tavilyErr) {
    console.warn("⚠️ Tavily web image search failed:", tavilyErr.message);
  }

  // 2. Fallback: High-resolution curated Unsplash photo endpoint
  try {
    const unsplashSearchUrl = `https://source.unsplash.com/1024x1024/?${encodeURIComponent(cleanQuery)}`;
    console.log(`📷 [Unsplash Fallback] Fetching curated photo for: "${cleanQuery}"`);

    const unsplashRes = await axios.get(unsplashSearchUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (unsplashRes?.data && unsplashRes.data.length > 2000) {
      const buf = Buffer.from(unsplashRes.data);
      console.log(`✅ [Unsplash Fallback] Image acquired (${buf.length} bytes)`);
      return buf;
    }
  } catch (unsplashErr) {
    console.warn("⚠️ Unsplash image fallback failed:", unsplashErr.message);
  }

  return null;
};
