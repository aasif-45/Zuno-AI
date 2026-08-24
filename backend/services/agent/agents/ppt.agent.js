import axios from "axios";
import { randomUUID } from "crypto";
import { HumanMessage } from "@langchain/core/messages";

import { getOpenRouterDeepSeek, getModel, invokeModelWithFallback } from "../config/llmModel.js";
import { generatePpt } from "../utils/generatePpt.js";
import { getSlideVisual } from "../utils/getPresentationImage.js";
import { uploadToS3 } from "../utils/uloadToS3.js";
import { getS3Url } from "../utils/getS3Url.js";

/**
 * 1. TAVILY RESEARCH HELPER
 * Searches Tavily for comprehensive, reliable information (career, achievements, stats, timeline, milestones).
 */
async function fetchTavilyResearch(query) {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return { text: "", sources: [] };

    console.log(`🌐 [Tavily Research] Collecting reliable facts for: "${query}"...`);

    const res = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: apiKey,
        query: `${query} career achievements statistics timeline milestones records facts`,
        max_results: 5,
        search_depth: "advanced",
      },
      { timeout: 10000 }
    );

    const results = res.data?.results || [];
    if (results.length === 0) return { text: "", sources: [] };

    const sources = [];
    const textBlocks = results.map((r, i) => {
      if (r.url) {
        try {
          const domain = new URL(r.url).hostname.replace("www.", "");
          if (domain && !sources.includes(domain)) {
            sources.push(domain);
          }
        } catch {}
      }
      return `${i + 1}. **${r.title}**: ${r.content || r.snippet || ""}`;
    });

    return {
      text: `## Tavily Verified Web Research Context\n\n${textBlocks.join("\n\n")}`,
      sources: sources.slice(0, 4),
    };
  } catch (err) {
    console.warn("⚠️ [Tavily Research] Web search failed:", err.message);
    return { text: "", sources: [] };
  }
}

/**
 * 2. DEEPSEEK PPT AGENT
 * DeepSeek is the ONLY model responsible for presentation planning based on Tavily research.
 */
export const pptAgent = async (state) => {
  try {
    const prompt = state.prompt?.trim();

    if (!prompt) {
      return {
        ...state,
        aiResponse: "Please tell me what presentation topic you would like to create.",
      };
    }

    // STEP 1: TAVILY RESEARCH
    const research = await fetchTavilyResearch(prompt);

    // STEP 2: DEEPSEEK PPT PLANNER
    console.log(`🤖 [DeepSeek Planner] Initializing DeepSeek model for presentation structure...`);
    const deepseekModel = getOpenRouterDeepSeek() || (await getModel("ppt"));

    // Detect slide count request
    const slideMatch = prompt.match(/(\d+)\s*slides?/i);
    const targetSlideCount = slideMatch ? Math.max(5, Math.min(parseInt(slideMatch[1], 10), 15)) : 8;

    const systemPrompt = `You are Zuno-AI, an AI assistant created for the Zuno-AI platform.

Identity rules:
* Your assistant name is Zuno-AI.
* When referring to yourself, identify yourself as Zuno-AI.
* Never claim that you are ChatGPT.
* Never claim that you are OpenAI.
* Never introduce yourself as an OpenAI assistant.
* Never say "I am ChatGPT", "I am OpenAI", or similar.
* Do not describe yourself as being developed or created by OpenAI.
* If the user asks "Who are you?", answer that you are Zuno-AI.
* If the user asks what AI/model you are, identify yourself as Zuno-AI without falsely claiming to be another product or company.
* Do not invent information about the underlying model/provider.
* Follow the user's request normally without unnecessarily mentioning your identity.

Presentation Planner Rules:
- Your task is to plan a highly professional, visually diverse presentation based on the user request and Tavily research data.

CRITICAL FACTUAL RULE:
- Do NOT invent facts, statistics, or dates.
- Ground ALL numerical metrics, milestones, and dates strictly in the provided Tavily research data.

${research.text ? `${research.text}\n\nUse the verified Tavily research above to extract actual numbers, years, and facts.` : ""}

Return ONLY valid JSON matching this exact presentation schema:

{
  "title": "Presentation Title",
  "subtitle": "Presentation Subtitle",
  "sources": ["${(research.sources.length > 0 ? research.sources.join('", "') : "Tavily Research")}"],
  "theme": {
    "primary": "#0F172A",
    "secondary": "#1E293B",
    "accent": "#3B82F6",
    "background": "#F8FAFC",
    "text": "#0F172A"
  },
  "slides": [
    {
      "type": "hero",
      "title": "Presentation Title",
      "subtitle": "High impact subtitle overview",
      "imageQuery": "3-8 word image search prompt"
    },
    {
      "type": "imageText",
      "title": "Slide Title",
      "points": ["Short bullet point 1", "Short bullet point 2", "Short bullet point 3"],
      "imageQuery": "3-8 word image search prompt"
    },
    {
      "type": "textImage",
      "title": "Slide Title",
      "points": ["Short bullet point 1", "Short bullet point 2", "Short bullet point 3"],
      "imageQuery": "3-8 word image search prompt"
    },
    {
      "type": "twoColumn",
      "title": "Slide Title",
      "leftPoints": ["Point 1", "Point 2"],
      "rightPoints": ["Point 3", "Point 4"]
    },
    {
      "type": "stats",
      "title": "Key Metrics & Impact",
      "stats": [
        { "value": "70+", "label": "Centuries", "description": "International Hundreds" },
        { "value": "13,000+", "label": "ODI Runs", "description": "Fastest to milestone" }
      ]
    },
    {
      "type": "timeline",
      "title": "Career Progression",
      "events": [
        { "year": "2008", "title": "Debut", "description": "U-19 World Cup Victory & Senior Debut" },
        { "year": "2011", "title": "World Cup Champion", "description": "Member of CWC winning squad" }
      ]
    },
    {
      "type": "comparison",
      "title": "Format Breakdown",
      "items": [
        { "label": "Test Matches", "value": "8,800+ Runs, 29 Centuries" },
        { "label": "ODI Matches", "value": "13,800+ Runs, 50 Centuries" }
      ]
    },
    {
      "type": "cards",
      "title": "Core Attributes",
      "cards": [
        { "title": "Fitness Culture", "description": "Revolutionized athletic standards" },
        { "title": "Chase Master", "description": "Unmatched record in successful run chases" }
      ]
    },
    {
      "type": "chart",
      "title": "Annual Performance Metrics",
      "chartType": "bar",
      "labels": ["2016", "2017", "2018", "2019"],
      "values": [2595, 2818, 2735, 2455]
    },
    {
      "type": "quote",
      "title": "Iconic Insight",
      "quote": "Self-belief and hard work will always earn you success.",
      "author": "Virat Kohli"
    },
    {
      "type": "sectionDivider",
      "title": "Legacy & Future Impact",
      "subtitle": "Inspecting enduring contributions"
    },
    {
      "type": "conclusion",
      "title": "Key Takeaways",
      "points": ["Relentless pursuit of excellence", "Transformed cricket culture", "Global sporting icon"]
    }
  ]
}

Layout Options:
- hero
- imageText
- textImage
- twoColumn
- stats
- timeline
- comparison
- cards
- chart (ONLY include if numerical data is in Tavily research; omit if no data exists)
- quote
- sectionDivider
- conclusion

Rules:
- Generate EXACTLY ${targetSlideCount} slides.
- Do NOT use the same type for consecutive slides. Vary layout types across presentation!
- Keep bullets under 15 words. Target 20-50 visible words per slide.
- Topic-aware colors: Sports (Dark background #0B0F19, Red #EF4444), Tech (Dark slate #0F172A, Blue #3B82F6), Business (Light #F8FAFC, Navy #1E3A8A), History (Warm #1C1917, Amber #D97706), Science (Deep #030712, Emerald #10B981).

Return ONLY valid JSON.
User prompt:
${prompt}
`;

    // Invoke DeepSeek model with fallback pipeline
    const response = await invokeModelWithFallback(deepseekModel, [
      new HumanMessage(systemPrompt),
    ]);

    const rawContent =
      typeof response?.content === "string"
        ? response.content.trim()
        : String(response?.content || "");

    const data = parseJSON(rawContent);

    if (!data?.title || !Array.isArray(data?.slides) || data.slides.length === 0) {
      throw new Error("Invalid presentation structure returned by DeepSeek model");
    }

    if (research.sources.length > 0 && (!data.sources || data.sources.length === 0)) {
      data.sources = research.sources;
    }

    console.log(`📊 [DeepSeek Planner] Presentation "${data.title}" planned (${data.slides.length} slides).`);

    // STEP 3: VISUAL RESOLUTION (4-Tier Pipeline: Tavily -> Pollinations -> Groq Fallback -> Built-in)
    console.log(`🖼️ [Visual Engine] Resolving visual assets per slide...`);

    const visualPromises = data.slides.map(async (slide) => {
      const type = (slide.type || slide.layout || "").toLowerCase().trim();
      const needsVisual =
        type === "hero" ||
        type === "imagetext" ||
        type === "textimage" ||
        Boolean(slide.imageQuery);

      if (needsVisual) {
        const visualRes = await getSlideVisual(slide, research.text);

        if (visualRes.type === "image" && visualRes.data) {
          slide.imageBuffer = visualRes.data;
        } else if (visualRes.type === "layout_override" && visualRes.slide) {
          // Groq infographic content fallback
          Object.assign(slide, visualRes.slide);
          slide.imageBuffer = null;
        } else {
          slide.imageBuffer = null;
        }
      } else {
        slide.imageBuffer = null;
      }
    });

    await Promise.allSettled(visualPromises);

    // STEP 4: GENERATE PPTX FILE via generatePpt.js
    console.log("⚡ [PPT Engine] Rendering PowerPoint presentation file...");
    const pptBuffer = await generatePpt(data);

    if (!pptBuffer || pptBuffer.length === 0) {
      throw new Error("PPT generation produced an empty file buffer");
    }

    // STEP 5: AWS S3 UPLOAD & PRESIGNED URL (PRESERVED ARCHITECTURE)
    const userId = state.userId || "anonymous";
    const fileName = `ppt/${userId}/${Date.now()}-${randomUUID()}.pptx`;
    const contentType =
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    await uploadToS3(fileName, pptBuffer, contentType);
    const downloadUrl = await getS3Url(fileName, 24 * 60 * 60);

    const safeTitle = (data.title || "Presentation")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50);

    const sourceFooterText = Array.isArray(data.sources) && data.sources.length > 0
      ? `\n\n*Sources: ${data.sources.join(" · ")}*`
      : "";

    return {
      ...state,

      aiResponse:
        `## Presentation Created\n\n` +
        `I've created your PowerPoint presentation **"${escapeHTML(data.title)}"** successfully.\n\n` +
        `**[Download Presentation (.pptx)](${downloadUrl})**\n\n` +
        `*The download link expires in 24 hours.*${sourceFooterText}`,

      artifacts: [],
      files: [
        {
          type: "pptx",
          key: fileName,
          name: `${safeTitle}.pptx`,
          url: downloadUrl,
          mimeType: contentType,
          expiresIn: 86400,
        },
      ],
    };
  } catch (error) {
    console.error("PPT Agent Error:", error);

    return {
      ...state,
      aiResponse:
        error?.message ||
        "I couldn't generate the presentation. Please try again.",
    };
  }
};

function parseJSON(content = "") {
  if (!content) {
    throw new Error("Empty LLM response");
  }

  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : content;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Invalid JSON structure returned by model");
  }

  const jsonStr = candidate.substring(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    const cleaned = jsonStr
      .replace(/,\s*([\]}])/g, "$1")
      .replace(/[\u0000-\u001F]+/g, (m) => (m === "\n" || m === "\r" || m === "\t" ? m : ""));
    return JSON.parse(cleaned);
  }
}

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}