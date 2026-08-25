import dotenv from "dotenv";
dotenv.config();

import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenAI } from "@google/genai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

let groqInstance = null;
let geminiInstance = null;
let currentGeminiKey = null;
let openRouterDeepSeekInstance = null;
let openRouterNemotronInstance = null;
let currentOpenRouterKey = null;
let genAIClient = null;

/**
 * Strips unwanted LaTeX signs and enforces Zuno AI identity
 */
export const cleanMathDollarSigns = (content = "") => {
  if (typeof content !== "string" || !content) return content;
  // Strip <think>...</think> reasoning blocks (e.g. from Qwen/DeepSeek)
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return cleaned
    .replace(/\$O\(([^$]+?)\)\$/gi, "O($1)")
    .replace(/\$([a-zA-Z0-9_\^+-]{1,15})\$/g, "$1");
};

/**
 * Rewrites every variation of the old "MY AI" name to "Zuno-AI".
 * Handles any separator between the two tokens (space, non-breaking space,
 * hyphen, underscore, or none at all) so responses can never leak the old brand.
 */
const MY_AI_PATTERN = /\bMY[\s  _-]*AI\b/gi;

export const enforceBrandIdentity = (text = "") => {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(new RegExp(`\\bI'?m\\s+${MY_AI_PATTERN.source}`, "gi"), "I'm Zuno-AI")
    .replace(MY_AI_PATTERN, "Zuno-AI")
    // Collapse "Zuno AI" / "Zuno_AI" to the canonical "Zuno-AI" spelling.
    .replace(/\bZuno[\s _]AI\b/g, "Zuno-AI")
    // After rewriting, a denial like "I'm MY AI, not Zuno AI" turns into a
    // self-contradiction — flatten it into a plain identity statement.
    .replace(/\bZuno-AI,?\s+not\s+Zuno-AI\b/gi, "Zuno-AI");
};

const sanitizeResult = (res) => {
  if (!res) return { content: "No limit left. Please try again later or upgrade your plan." };
  let text = "";
  if (typeof res.content === "string") {
    text = res.content;
  } else if (Array.isArray(res.content)) {
    text = res.content.map((c) => (typeof c === "string" ? c : c?.text || "")).join("\n");
  } else if (typeof res === "string") {
    text = res;
  } else if (res.text) {
    text = res.text;
  } else {
    text = String(res.content || "");
  }

  res.content = cleanMathDollarSigns(enforceBrandIdentity(text));
  return res;
};

export const getGroq = (modelName = "openai/gpt-oss-120b") => {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY || "",
    model: modelName,
    maxRetries: 2,
  });
};

export const getGemini = (modelName = "gemini-3.6-flash") => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  if (!geminiInstance || currentGeminiKey !== apiKey) {
    currentGeminiKey = apiKey;
    geminiInstance = new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName,
      temperature: 0.7,
    });
  }

  return geminiInstance;
};

export const getGenAIClient = () => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!apiKey) return null;

  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }

  return genAIClient;
};

/**
 * Primary Model for Coding & Auto Routing: OpenRouter DeepSeek V4 Flash
 */
export const getOpenRouterDeepSeekV4 = () => {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  if (!openRouterDeepSeekInstance || currentOpenRouterKey !== apiKey) {
    currentOpenRouterKey = apiKey;
    openRouterDeepSeekInstance = new ChatOpenAI({
      apiKey,
      model: "deepseek/deepseek-v4-flash",
      temperature: 0.2,
      maxTokens: 2500,
      maxRetries: 2,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    });
  }

  return openRouterDeepSeekInstance;
};

export const getOpenRouterDeepSeek = getOpenRouterDeepSeekV4;

/**
 * Fallback Tier 2 Model: OpenRouter Nemotron 3 Ultra Free
 */
export const getOpenRouterNemotron3Ultra = () => {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  if (!openRouterNemotronInstance || currentOpenRouterKey !== apiKey) {
    currentOpenRouterKey = apiKey;
    openRouterNemotronInstance = new ChatOpenAI({
      apiKey,
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      temperature: 0.2,
      maxTokens: 2500,
      maxRetries: 2,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    });
  }

  return openRouterNemotronInstance;
};

/**
 * Returns requested model instance with specific provider assignments.
 */
export const getModel = async (type = "chat") => {
  switch (type) {
    case "coding":
      // Primary: OpenRouter DeepSeek V4 Flash -> Nemotron 3 Ultra -> Groq Qwen
      return getOpenRouterDeepSeekV4() || getOpenRouterNemotron3Ultra() || getGroq("qwen/qwen3.6-27b");

    case "router":
      // Primary: OpenRouter DeepSeek V4 Flash -> Groq Qwen
      return getOpenRouterDeepSeekV4() || getGroq("qwen/qwen3.6-27b");

    case "imageAnalyzer":
    case "pdfRag":
      // Image and PDF Analysis: Google Gemini 3.6 Flash
      return getGemini("gemini-3.6-flash");

    case "pdf":
    case "ppt":
    case "search":
    case "chat":
    default:
      // Primary: OpenRouter DeepSeek V4 Flash (clean - no legacy brand training)
      // Fallback: Gemini 3.6 Flash (also clean)
      return getOpenRouterDeepSeekV4() || getGemini("gemini-3.6-flash");
  }
};

/**
 * Multi-tier execution pipeline for Coding/Artifact & General Agent Fallbacks:
 * Primary: Requested Agent Model
 * Fallback Tier 1: OpenRouter DeepSeek V4 Flash
 * Fallback Tier 2: OpenRouter Nemotron 3 Ultra Free
 * Fallback Tier 3: LangChain Groq model
 * Exhausted: Returns "No limit left. Please try again later or upgrade your plan."
 */
export const invokeModelWithFallback = async (model, input) => {
  const invokeWithTimeout = (modelInst, ms = 65000) => {
    return Promise.race([
      modelInst.invoke(input),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Model timeout after ${ms}ms`)), ms)
      ),
    ]);
  };

  // Step 1: Requested Primary Model
  if (model) {
    try {
      console.log("🤖 [AI Agent Pipeline] Executing Requested Primary Model...");
      const res = await invokeWithTimeout(model, 65000);
      console.log("✅ [AI Agent Pipeline] Primary Model succeeded!");
      return sanitizeResult(res);
    } catch (errPrimary) {
      console.error("⚠️ [AI Agent Pipeline] Primary Model failed, moving to fallbacks:", errPrimary.message || errPrimary);
    }
  }

  // Fallback Tier 1: OpenRouter DeepSeek V4 Flash Free
  try {
    console.log("🔄 [AI Agent Pipeline] Fallback Tier 1: Executing OpenRouter DeepSeek V4 Flash...");
    const deepseekV4 = getOpenRouterDeepSeekV4();
    if (deepseekV4) {
      const res = await invokeWithTimeout(deepseekV4, 65000);
      console.log("✅ [AI Agent Pipeline] OpenRouter DeepSeek V4 Flash succeeded!");
      return sanitizeResult(res);
    }
  } catch (errV4) {
    console.error("⚠️ [AI Agent Pipeline] OpenRouter DeepSeek V4 Flash failed:", errV4.message || errV4);
  }

  // Fallback Tier 2: OpenRouter Nemotron 3 Ultra Free
  try {
    console.log("🔄 [AI Agent Pipeline] Fallback Tier 2: Executing OpenRouter Nemotron 3 Ultra Free...");
    const nemotron = getOpenRouterNemotron3Ultra();
    if (nemotron) {
      const res = await invokeWithTimeout(nemotron, 65000);
      console.log("✅ [AI Agent Pipeline] OpenRouter Nemotron 3 Ultra Free succeeded!");
      return sanitizeResult(res);
    }
  } catch (errNemo) {
    console.error("⚠️ [AI Agent Pipeline] OpenRouter Nemotron 3 Ultra Free failed:", errNemo.message || errNemo);
  }

  // Fallback Tier 3: LangChain Groq Model (Qwen - neutral, no brand identity)
  try {
    console.log("🔄 [AI Agent Pipeline] Fallback Tier 3: Executing LangChain Groq (Qwen) model...");
    const groqModel = getGroq("qwen/qwen3.6-27b");
    if (groqModel) {
      const res = await invokeWithTimeout(groqModel, 65000);
      console.log("✅ [AI Agent Pipeline] LangChain Groq (Qwen) model succeeded!");
      return sanitizeResult(res);
    }
  } catch (errGroq) {
    console.error("⚠️ [AI Agent Pipeline] LangChain Groq (Qwen) model failed:", errGroq.message || errGroq);
  }

  // Quota Exceeded / All Models Failed
  console.error("❌ [AI Agent Pipeline] All AI model fallbacks exhausted or limit reached.");
  return {
    content: "No limit left. Please try again later or upgrade your plan.",
  };
};

/**
 * Generates a concise, 2-5 word Title Case summary for a conversation.
 */
export const generateTitle = async (promptText, aiReplyText = "") => {
  try {
    const llm = getOpenRouterDeepSeekV4() || getGroq("qwen/qwen3.6-27b");
    const systemPrompt = `You are a title generator. Generate a 2 to 5 word title summarizing the user's topic. Rules: Output ONLY the title text, do NOT use quotes or end punctuation, format in Title Case (e.g. API Development Overview, Netflix Clone Architecture, React State Management).`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(`User Prompt: "${promptText}"\n${aiReplyText ? `Response Snippet: "${aiReplyText.slice(0, 150)}"` : ""}`),
    ];

    const response = await invokeModelWithFallback(llm, messages);
    let title = response?.content?.trim() || "";
    title = title.replace(/^["'`\s]+|["'`\s]+$/g, "").replace(/\n.*/s, "");
    if (title.length > 45) {
      title = title.slice(0, 45).trim();
    }
    return title || "New Chat";
  } catch (error) {
    console.error("Generate title error:", error.message);
    const clean = promptText.replace(/[^\w\s]/gi, "").trim();
    const words = clean.split(/\s+/).slice(0, 4);
    if (words.length > 0 && words[0]) {
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return "New Chat";
  }
};

export const GFM_FORMATTING_RULES = `

### Mandatory Output Formatting Rules:
- Format ALL responses using valid GitHub Flavored Markdown (GFM).
- Do NOT wrap math terms or Big-O complexities in single dollar signs (e.g. do NOT write $O(n)$ or $n$). Write clean plain text like O(n), O(1), O(2^n), n.
- Use proper Markdown headings (#, ##, ###).
- Use bullet and numbered lists where appropriate.
- Format links as [Title](https://example.com).
- Format images as ![Alt text](image_url).
- Format tables using GFM table syntax.
- Use fenced code blocks with the explicit language specified (e.g. \`\`\`javascript, \`\`\`python, etc.).
- Use **bold**, *italic*, and \`inline code\` correctly.
- Never escape Markdown characters (do not output \\[, \\], \\(, \\), etc.).
- Never wrap the entire response in a single code block.
- Ensure the output renders cleanly in react-markdown with remark-gfm.`;

/**
 * Safely constructs native LangChain message instances with system prompt and cleaned history context,
 * ensuring no consecutive duplicate roles exist and excluding error messages.
 */
export const buildCleanLLMMessages = (systemPrompt, history = [], currentPrompt = "") => {
  const clean = systemPrompt ? [new SystemMessage(systemPrompt)] : [];

  const filtered = (history || [])
    .filter(
      (msg) =>
        msg &&
        msg.content &&
        typeof msg.content === "string" &&
        msg.content.trim().length > 0 &&
        !msg.content.includes("I encountered an issue")
    )
    .map((msg) => {
      let content = msg.content.trim();
      if (msg.role === "assistant") {
        content = enforceBrandIdentity(content);
      }
      return {
        role: msg.role === "assistant" ? "assistant" : "user",
        content: cleanMathDollarSigns(content),
      };
    });

  if (currentPrompt && currentPrompt.trim()) {
    const trimmed = cleanMathDollarSigns(currentPrompt.trim());
    const last = filtered[filtered.length - 1];
    if (!last || last.content !== trimmed || last.role !== "user") {
      filtered.push({ role: "user", content: trimmed });
    }
  }

  const alternatingTurns = [];
  for (const item of filtered) {
    if (!item.content) continue;
    if (alternatingTurns.length === 0) {
      alternatingTurns.push({ role: item.role, content: item.content });
    } else {
      const prev = alternatingTurns[alternatingTurns.length - 1];
      if (prev.role === item.role) {
        prev.content = `${prev.content}\n\n${item.content}`;
      } else {
        alternatingTurns.push({ role: item.role, content: item.content });
      }
    }
  }

  if (alternatingTurns.length > 0 && alternatingTurns[0].role === "assistant") {
    alternatingTurns.unshift({ role: "user", content: "Hello" });
  }

  if (alternatingTurns.length > 0 && alternatingTurns[alternatingTurns.length - 1].role !== "user") {
    if (currentPrompt && currentPrompt.trim()) {
      alternatingTurns.push({ role: "user", content: currentPrompt.trim() });
    }
  }

  const langChainMessages = alternatingTurns.map((msg) =>
    msg.role === "assistant" ? new AIMessage(msg.content) : new HumanMessage(msg.content)
  );

  return [...clean, ...langChainMessages];
};