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

    // 1. Check for strong explicit file/document output requests (e.g. "Deliver this as a pdf", "Create PPT")
    if (/\b(deliver this as a (downloadable )?pdf|create (a )?pdf|generate (a )?pdf|export (as )?pdf)\b/i.test(lowerPrompt)) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "-> pdf" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "pdf" };
    }

    if (/\b(deliver this as a (downloadable )?ppt|create (a )?ppt|generate (a )?ppt|create slides|presentation on)\b/i.test(lowerPrompt)) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "-> ppt" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "ppt" };
    }

    // 2. If agent is explicitly specified by user (not auto)
    if (state.agent && state.agent !== "auto") {
      const userAgent = state.agent.toString().trim().toLowerCase().replace(/[^a-z]/g, "");
      if (userAgent === "image" || userAgent === "imagegen") {
        // If user picked Image dropdown but prompt explicitly asks for PDF/Code, override with actual intent
        if (!/\b(pdf|slides|presentation|powerpoint)\b/i.test(lowerPrompt)) {
          return { ...state, agent: "imageGen" };
        }
      } else if (VALID_AGENTS.includes(userAgent)) {
        return { ...state, agent: userAgent };
      }
    }

    // 3. Fast-Path Keyword Shortcuts (Instant 0ms Direct Routing)
    if (/\b(ppt|presentation|powerpoint|slides|slide deck)\b/i.test(lowerPrompt)) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "Auto -> ppt" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "ppt" };
    }

    if (/\b(pdf|generate pdf|create pdf|downloadable pdf)\b/i.test(lowerPrompt)) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "Auto -> pdf" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "pdf" };
    }

    // Fast-Path Direct Route for Coding & Game / App / Web Projects
    if (
      /\b(game|balloon|burst|bursting|pop|popping|calculator|simulator|simulation|animation|interactive)\b/i.test(lowerPrompt) ||
      /\b(make|build|create|generate|write|develop|code|implement|design|give me|show me)\s+(a\s+|an\s+|me\s+(a\s+|an\s+)?)?(game|app|website|web app|calculator|clone|dashboard|landing page|todo|portfolio|component|tool|form|timer|tracker|quiz|widget)\b/i.test(lowerPrompt) ||
      /\b(coin toss|tic tac toe|snake|pong|rock paper scissors|blackjack|memory game|flappy bird|wordle|hangman|sudoku|card game|roulette|puzzle|arcade|shooter)\b/i.test(lowerPrompt) ||
      /\b(html|css|javascript|react|vue|node|python script|c\+\+|java code|dsa|binary search|sorting algorithm)\b/i.test(lowerPrompt)
    ) {
      console.log(`⚡ [Agent Router] Fast-Path Direct Route: "Auto -> coding" for query: "${rawPrompt.slice(0, 50)}..."`);
      return { ...state, agent: "coding" };
    }

    // Strict Image Generation Regex (prevents false matches on "generalized", "regenerate", "drawing conclusions", etc.)
    const isImageGenIntent =
      /\b(generate|create|render|draw|make|paint)\s+(an?\s+)?(image|picture|photo|illustration|logo|wallpaper|drawing|artwork|portrait|banner|avatar)\b/i.test(lowerPrompt) ||
      /\b(picture\s+of|photo\s+of|image\s+of|painting\s+of|wallpaper\s+of|artwork\s+of)\b/i.test(lowerPrompt) ||
      /^(draw|generate image|create image|paint)\b/i.test(lowerPrompt);

    if (isImageGenIntent && !/\b(code|program|matlab|python|javascript|pdf|ppt)\b/i.test(lowerPrompt)) {
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
