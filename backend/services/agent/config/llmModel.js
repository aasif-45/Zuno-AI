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
let currentOpenRouterKey = null;
let openCodeInstance = null;
let currentOpenCodeKey = null;
let genAIClient = null;

/**
  Strips unwanted LaTeX signs
 */
export const cleanMathDollarSigns = (content = "") => {
  if (typeof content !== "string" || !content) return content;
  return content
    .replace(/\$O\(([^$]+?)\)\$/gi, "O($1)")
    .replace(/\$([a-zA-Z0-9_\^+-]{1,15})\$/g, "$1");
};

const sanitizeResult = (res) => {
  if (res && typeof res.content === "string") {
    res.content = cleanMathDollarSigns(res.content);
  }
  return res;
};

export const getGroq = () => {
  if (!groqInstance) {
    groqInstance = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY || "",
      model: "llama-3.3-70b-versatile",
      maxRetries: 2,
    });
  }
  return groqInstance;
};

const getOpenCodeCodingModel = () => {
  const apiKey = (process.env.OPENCODE_API_KEY || "").trim();

  if (!apiKey) {
    return null;
  }

  if (!openCodeInstance || currentOpenCodeKey !== apiKey) {
    currentOpenCodeKey = apiKey;

    openCodeInstance = new ChatOpenAI({
      apiKey,
      model: "deepseek-v4-flash-free",
      temperature: 0.2,
      maxRetries: 2,

      configuration: {
        baseURL: "https://opencode.ai/zen/v1",
      },
    });
  }

  return openCodeInstance;
};

export const getGemini = (modelName = "gemini-3.7-flash") => {
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

export const getOpenRouterDeepSeek = () => {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();

  if (!apiKey) {
    return null;
  }

  if (!openRouterDeepSeekInstance || currentOpenRouterKey !== apiKey) {
    currentOpenRouterKey = apiKey;

    openRouterDeepSeekInstance = new ChatOpenAI({
      apiKey,
      model: "deepseek/deepseek-chat",
      temperature: 0.7,
      maxRetries: 2,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    });
  }

  return openRouterDeepSeekInstance;
};

/**
 * Returns model instance with 3-tier fallback capabilities.
 */
export const getModel = async (type = "chat") => {
  switch (type) {
    case "chat":
    case "intent":
    case "search":
    case "pdf":
    case "ppt":
      return getGemini() || getOpenRouterDeepSeek() || getGroq();

    case "router":
      return getGroq();

    case "coding":
      return getGemini() || getOpenRouterDeepSeek() || getGroq();

    case "imageAnalyzer":
      return getGemini();

    default:
      return getGemini() || getOpenRouterDeepSeek() || getGroq();
  }
};

/**
 * Multi-tier execution pipeline implementing the Chat Agent architecture:
 * User prompt -> Gemini text model -> Fallback 1: OpenRouter DeepSeek -> Fallback 2: Groq text model -> Frontend
 */
export const invokeModelWithFallback = async (model, input) => {
  // Step 1: Gemini text model (Primary)
  try {
    const primaryModel = model || getGemini();
    if (primaryModel) {
      console.log("🤖 [Chat Agent Pipeline] Executing Step 1: Gemini text model...");
      const res = await primaryModel.invoke(input);
      console.log("✅ [Chat Agent Pipeline] Step 1 (Gemini text model) succeeded!");
      return sanitizeResult(res);
    }
  } catch (error) {
    console.error("⚠️ [Chat Agent Pipeline] Step 1 (Gemini text model) failed:", error.message || error);
  }

  // Step 2 (Fallback 1): OpenRouter DeepSeek
  try {
    console.log("🔄 [Chat Agent Pipeline] Step 2: Executing Fallback 1 -> OpenRouter DeepSeek...");
    const openRouterModel = getOpenRouterDeepSeek();
    if (!openRouterModel) {
      throw new Error("OPENROUTER_API_KEY is missing or not configured.");
    }
    const res = await openRouterModel.invoke(input);
    console.log("✅ [Chat Agent Pipeline] Step 2 Fallback 1 (OpenRouter DeepSeek) succeeded!");
    return sanitizeResult(res);
  } catch (err1) {
    console.error("⚠️ [Chat Agent Pipeline] Step 2 Fallback 1 (OpenRouter DeepSeek) failed:", err1.message || err1);
  }

  // Step 3 (Fallback 2): Groq text model
  try {
    console.log("🔄 [Chat Agent Pipeline] Step 3: Executing Fallback 2 -> Groq text model...");
    const groqModel = getGroq();
    const res = await groqModel.invoke(input);
    console.log("✅ [Chat Agent Pipeline] Step 3 Fallback 2 (Groq text model) succeeded!");
    return sanitizeResult(res);
  } catch (err2) {
    console.error("❌ [Chat Agent Pipeline] Step 3 Fallback 2 (Groq text model) failed:", err2.message || err2);
    throw err2;
  }
};

/**
 * Generates a concise, 2-5 word Title Case summary for a conversation.
 */
export const generateTitle = async (promptText, aiReplyText = "") => {
  try {
    const llm = getGroq();
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
  const clean = [new SystemMessage(systemPrompt)];

  const rawList = (history || [])
    .filter(
      (msg) =>
        msg &&
        msg.content &&
        typeof msg.content === "string" &&
        msg.content.trim().length > 0 &&
        !msg.content.includes("I encountered an issue")
    )
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content.trim(),
    }));

  if (currentPrompt && currentPrompt.trim()) {
    const trimmed = currentPrompt.trim();
    const last = rawList[rawList.length - 1];
    if (!last || last.content !== trimmed || last.role !== "user") {
      rawList.push({ role: "user", content: trimmed });
    }
  }

  const conversationTurns = [];
  for (const msg of rawList) {
    if (conversationTurns.length > 0) {
      const prev = conversationTurns[conversationTurns.length - 1];
      if (prev.role === msg.role) {
        prev.content = `${prev.content}\n${msg.content}`;
        continue;
      }
    }
    conversationTurns.push({ role: msg.role, content: msg.content });
  }

  if (conversationTurns.length > 0 && conversationTurns[0].role === "assistant") {
    conversationTurns.unshift({ role: "user", content: "Hello" });
  }

  const langChainMessages = conversationTurns.map((msg) =>
    msg.role === "assistant" ? new AIMessage(msg.content) : new HumanMessage(msg.content)
  );

  return [...clean, ...langChainMessages];
};