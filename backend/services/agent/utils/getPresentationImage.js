import axios from "axios";
import { HumanMessage } from "@langchain/core/messages";
import { getGroq } from "../config/llmModel.js";

/**
 * Validates binary magic bytes for image formats (PNG, JPEG, GIF, WEBP)
 * Prevents HTML error pages from being treated as images.
 */
export const isValidImageBuffer = (buf) => {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 500) return false;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // GIF: 47 49 46
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // WEBP: RIFF....WEBP
  if (buf.length >= 12 && buf.slice(8, 12).toString("utf8") === "WEBP") return true;
  return false;
};

/**
 * 4-Tier Image & Visual Layout Engine matching exact specification:
 * 
 * 1. Tavily Image Search -> Returns { type: "image", source: "tavily", data: buffer }
 * 2. Pollinations AI     -> Returns { type: "image", source: "pollinations", data: buffer }
 * 3. Groq Visual Fallback-> Transforms slide into visual infographic structure (stats/timeline/cards)
 * 4. Built-in Fallback  -> Returns { type: "fallback", data: null } (generatePpt.js renders gradient card)
 * 
 * @param {Object} slide Slide object from presentation plan
 * @param {string} research Raw Tavily research context
 * @returns {Promise<Object>} Visual resolution result
 */
export const getSlideVisual = async (slide, research = "") => {
  const query = slide.imageQuery || slide.title || "";
  const cleanQuery = query
    .replace(/photorealistic|hd|4k|hyperrealistic|cinematic|detailed|background|wide angle|lighting/gi, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim();

  // =========================================================================
  // PRIORITY 1: TAVILY IMAGE SEARCH
  // =========================================================================
  if (cleanQuery) {
    try {
      const apiKey = process.env.TAVILY_API_KEY;
      if (apiKey) {
        console.log(`🌐 [PPT Visual Engine] Step 1: Searching Tavily web images for: "${cleanQuery}"...`);

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
              const imgResponse = await axios.get(imgUrl, {
                responseType: "arraybuffer",
                timeout: 10000,
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
              });

              if (imgResponse?.data) {
                const buf = Buffer.from(imgResponse.data);
                if (isValidImageBuffer(buf)) {
                  console.log(`✅ [PPT Visual Engine] Step 1 Succeeded: Tavily web image acquired (${buf.length} bytes)`);
                  return { type: "image", source: "tavily", data: buf };
                }
              }
            } catch (dlErr) {
              console.warn(`Failed downloading Tavily image ${imgUrl.slice(0, 40)}:`, dlErr.message);
            }
          }
        }
      }
    } catch (tavErr) {
      console.warn("⚠️ [PPT Visual Engine] Step 1 Tavily image search failed:", tavErr.message);
    }
  }

  // =========================================================================
  // PRIORITY 2: POLLINATIONS AI IMAGE GENERATION
  // =========================================================================
  if (cleanQuery) {
    try {
      const seed = Math.floor(Math.random() * 1000000);
      const finalPrompt = `${cleanQuery}, presentation slide photo, high resolution, professional lighting`;
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=576&nologo=true&seed=${seed}`;

      console.log(`🎨 [PPT Visual Engine] Step 2: Fetching Pollinations AI image for: "${cleanQuery}"...`);

      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (imageResponse?.data) {
        const buf = Buffer.from(imageResponse.data);
        if (isValidImageBuffer(buf)) {
          console.log(`✅ [PPT Visual Engine] Step 2 Succeeded: Pollinations image acquired (${buf.length} bytes)`);
          return { type: "image", source: "pollinations", data: buf };
        }
      }
    } catch (polErr) {
      console.warn("⚠️ [PPT Visual Engine] Step 2 Pollinations AI failed:", polErr.message);
    }
  }

  // =========================================================================
  // PRIORITY 3: GROQ VISUAL CONTENT FALLBACK (Infographic Layout Conversion)
  // =========================================================================
  try {
    const groq = getGroq();
    if (groq) {
      console.log(`🤖 [PPT Visual Engine] Step 3: Executing Groq visual content fallback...`);
      const fallbackPrompt = `You are a professional PowerPoint visual designer.

An image could not be found or generated.
Do NOT generate an image.

Instead, convert this slide into a visually compelling infographic-style PowerPoint layout.

Available layouts:
stats
timeline
cards
comparison
twoColumn
quote

Use ONLY the provided research.
Do not invent statistics or facts.
Return ONLY valid JSON with updated slide properties matching the selected layout type.

Slide:
${JSON.stringify(slide)}

Research Data:
${JSON.stringify(typeof research === "string" ? research.slice(0, 1000) : research)}`;

      const groqRes = await groq.invoke([new HumanMessage(fallbackPrompt)]);
      const rawJson = typeof groqRes?.content === "string" ? groqRes.content.trim() : "";
      const updatedSlide = parseJSON(rawJson);
      if (updatedSlide && (updatedSlide.type || updatedSlide.stats || updatedSlide.events || updatedSlide.cards)) {
        console.log(`✅ [PPT Visual Engine] Step 3 Succeeded: Groq converted slide to layout "${updatedSlide.type || "infographic"}"`);
        return { type: "layout_override", slide: updatedSlide };
      }
    }
  } catch (groqErr) {
    console.warn("⚠️ [PPT Visual Engine] Step 3 Groq visual fallback failed:", groqErr.message);
  }

  // =========================================================================
  // PRIORITY 4: BUILT-IN PPT FALLBACK (Styled Gradient Card)
  // =========================================================================
  console.log("ℹ️ [PPT Visual Engine] Step 4: Using built-in PPT gradient card fallback.");
  return { type: "fallback", data: null };
};

// Legacy compatibility export
export const getPresentationImage = async (query) => {
  const result = await getSlideVisual({ imageQuery: query }, "");
  return result.type === "image" ? result.data : null;
};

function parseJSON(content = "") {
  if (!content) return null;
  const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonStr = match ? match[1] : content;
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(jsonStr.substring(start, end + 1));
  } catch {
    return null;
  }
}
