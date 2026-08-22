import { getGroq, invokeModelWithFallback } from "../config/llmModel.js";
import { HumanMessage } from "@langchain/core/messages";

const VALID_AGENTS = [
  "chat",
  "search",
  "coding",
  "pdf",
  "ppt",
  "imagegen",
];

export const router = async (state) => {
  try {
    const rawPrompt = (state.prompt || "").toString().trim();
    const lowerPrompt = rawPrompt.toLowerCase();

    // 0. Uploaded-file routing takes highest priority (safe optional access)
    const fileMimeType = state.file?.mimetype || "";

    if (fileMimeType === "application/pdf") {
      console.log(`⚡ [Agent Router] File-based route: PDF uploaded -> pdfRag`);
      return { ...state, agent: "pdfRag" };
    }

    if (fileMimeType.startsWith("image/")) {
      console.log(`⚡ [Agent Router] File-based route: Image uploaded -> imageAnalyzer`);
      return { ...state, agent: "imageAnalyzer" };
    }

    // 1. If agent is explicitly specified by user (not auto), respect it directly
    if (state.agent && state.agent !== "auto") {
      const userAgent = state.agent.toString().trim().toLowerCase().replace(/[^a-z]/g, "");
      if (userAgent === "image" || userAgent === "imagegen") {
        return { ...state, agent: "imageGen" };
      }
      if (VALID_AGENTS.includes(userAgent)) {
        return { ...state, agent: userAgent };
      }
    }

    // 2. Fast-Path Keyword Shortcuts (Instant 0ms Direct Routing)
    if (/\b(ppt|presentation|powerpoint|slides|slide deck)\b/i.test(lowerPrompt)) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "Auto -> ppt" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "ppt" };
    }

    if (/\b(pdf|generate pdf|create pdf)\b/i.test(lowerPrompt)) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "Auto -> pdf" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "pdf" };
    }

    if (/\b(image|draw|generate image|create image|picture of|photo of|render image)\b/i.test(lowerPrompt)) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "Auto -> imageGen" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "imageGen" };
    }

    // 3. Use Groq Model for Free & Fast Routing Classification
    const llm = getGroq();
    const promptSnippet = rawPrompt.slice(0, 1000);

    const promptText = `
You are an agent router classifier.

Available agents:
- ppt: Presentation creation, PowerPoint, slides, PPT generation.
- coding: Generate code, debug code, build web app projects, scripts, algorithms.
- pdf: PDF creation or PDF questions.
- imageGen: Generate or create pictures, artwork, photos.
- search: Real-time web search, latest news, current dates, live scores.
- chat: General conversation, greetings, explanations.

Rules:
Output ONLY ONE word from this exact list:
ppt
coding
pdf
imageGen
search
chat

User Query:
${promptSnippet}
`;

    const response = await invokeModelWithFallback(llm, [new HumanMessage(promptText)]);

    const agent = (response?.content || "")
      .toString()
      .trim()
      .replace(/[^\w]/g, "")
      .toLowerCase();

    let targetAgent = "chat";
    if (agent === "image" || agent === "imagegen") {
      targetAgent = "imageGen";
    } else if (VALID_AGENTS.includes(agent)) {
      targetAgent = agent;
    }

    console.log(`⚡ [Agent Router (Groq)] Routed Mode: "Auto -> ${targetAgent}" for query: "${promptSnippet.slice(0, 50)}..."`);

    return {
      ...state,
      agent: targetAgent,
    };
  } catch (error) {
    console.error("Router error, defaulting to chat:", error.message);
    return {
      ...state,
      agent: "chat",
    };
  }
};
