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
  Strips unwanted LaTeX signs and enforces MY AI identity
 */
export const cleanMathDollarSigns = (content = "") => {
  if (typeof content !== "string" || !content) return content;
  return content
    .replace(/\$O\(([^$]+?)\)\$/gi, "O($1)")
    .replace(/\$([a-zA-Z0-9_\^+-]{1,15})\$/g, "$1")
    .replace(/\bdeveloped by OpenAI\b/gi, "developed by the MY AI team")
    .replace(/\bcreated by OpenAI\b/gi, "created by the MY AI team")
    .replace(/\bbased on (GPT-4|GPT-3\.5|ChatGPT)\b/gi, "powered by the MY AI neural engine")
    .replace(/\bI am ChatGPT\b/gi, "I am MY AI")
    .replace(/\bI am an AI assistant developed by OpenAI\b/gi, "I am MY AI, an advanced AI assistant");
};

const sanitizeResult = (res) => {
  if (!res) return { content: "Hello! I am MY AI, how can I help you today?" };
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

  res.content = cleanMathDollarSigns(text);
  return res;
};

export const getGroq = (modelName = "openai/gpt-oss-120b") => {
  if (!groqInstance) {
    groqInstance = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY || "",
      model: modelName,
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
      maxTokens: 2500,
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
      return getOpenCodeCodingModel() || getOpenRouterDeepSeek() || getGemini() || getGroq();

    case "router":
      return getGroq();

    case "coding":
      return getOpenCodeCodingModel() || getOpenRouterDeepSeek() || getGemini() || getGroq();

    case "imageAnalyzer":
      return getGemini();

    default:
      return getOpenCodeCodingModel() || getOpenRouterDeepSeek() || getGemini() || getGroq();
  }
};

/**
 * Multi-tier execution pipeline:
 * User prompt -> OpenCode (deepseek-v4-flash-free) -> OpenRouter DeepSeek -> Gemini text model -> Groq text model -> Frontend
 */
export const invokeModelWithFallback = async (model, input) => {
  // Step 1: Specific requested model / OpenCode deepseek-v4-flash-free
  if (model) {
    try {
      console.log("🤖 [AI Agent Pipeline] Executing Primary Model...");
      const res = await model.invoke(input);
      console.log("✅ [AI Agent Pipeline] Primary Model succeeded!");
      return sanitizeResult(res);
    } catch (errPrimary) {
      console.error("⚠️ [AI Agent Pipeline] Primary Model failed, moving to fallbacks:", errPrimary.message || errPrimary);
    }
  }

  // Step 2: OpenCode deepseek-v4-flash-free
  try {
    const openCodeModel = getOpenCodeCodingModel();
    if (openCodeModel && openCodeModel !== model) {
      console.log("🤖 [AI Agent Pipeline] Trying OpenCode deepseek-v4-flash-free...");
      const res = await openCodeModel.invoke(input);
      console.log("✅ [AI Agent Pipeline] OpenCode deepseek-v4-flash-free succeeded!");
      return sanitizeResult(res);
    }
  } catch (errOpenCode) {
    console.error("⚠️ [AI Agent Pipeline] OpenCode deepseek-v4-flash-free failed:", errOpenCode.message || errOpenCode);
  }

  // Step 3: OpenRouter DeepSeek
  try {
    console.log("🔄 [AI Agent Pipeline] Step 3: Executing OpenRouter DeepSeek...");
    const openRouterModel = getOpenRouterDeepSeek();
    if (openRouterModel) {
      const res = await openRouterModel.invoke(input);
      console.log("✅ [AI Agent Pipeline] OpenRouter DeepSeek succeeded!");
      return sanitizeResult(res);
    }
  } catch (errOpenRouter) {
    console.error("⚠️ [AI Agent Pipeline] OpenRouter DeepSeek failed:", errOpenRouter.message || errOpenRouter);
  }

  // Step 4: Gemini text model
  try {
    console.log("🔄 [AI Agent Pipeline] Step 4: Executing Gemini text model...");
    const geminiModel = getGemini();
    if (geminiModel) {
      const res = await geminiModel.invoke(input);
      console.log("✅ [AI Agent Pipeline] Gemini text model succeeded!");
      return sanitizeResult(res);
    }
  } catch (errGemini) {
    console.error("⚠️ [AI Agent Pipeline] Gemini text model failed:", errGemini.message || errGemini);
  }

  // Step 5: Groq text model (openai/gpt-oss-120b)
  try {
    console.log("🔄 [AI Agent Pipeline] Step 5: Executing Groq text model...");
    const groqModel = getGroq();
    const res = await groqModel.invoke(input);
    console.log("✅ [AI Agent Pipeline] Groq text model succeeded!");
    return sanitizeResult(res);
  } catch (errGroq) {
    console.error("❌ [AI Agent Pipeline] Groq text model failed:", errGroq.message || errGroq);
    return {
      content: "I am MY AI, an advanced AI assistant. How can I help you today?",
    };
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
  const clean = systemPrompt ? [new SystemMessage(systemPrompt)] : [];

  // 1. Filter and clean raw history list
  const filtered = (history || [])
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
      content: cleanMathDollarSigns(msg.content.trim()),
    }));

  // 2. Ensure current prompt is included at the end if not already present
  if (currentPrompt && currentPrompt.trim()) {
    const trimmed = cleanMathDollarSigns(currentPrompt.trim());
    const last = filtered[filtered.length - 1];
    if (!last || last.content !== trimmed || last.role !== "user") {
      filtered.push({ role: "user", content: trimmed });
    }
  }

  // 3. Strict Alternation Enforcement: Merge consecutive same-role turns
  const alternatingTurns = [];
  for (const item of filtered) {
    if (!item.content) continue;
    if (alternatingTurns.length === 0) {
      // First turn must be user
      alternatingTurns.push({ role: item.role, content: item.content });
    } else {
      const prev = alternatingTurns[alternatingTurns.length - 1];
      if (prev.role === item.role) {
        // Merge consecutive same-role contents into one single turn
        prev.content = `${prev.content}\n\n${item.content}`;
      } else {
        alternatingTurns.push({ role: item.role, content: item.content });
      }
    }
  }

  // If first turn is assistant, prepend a polite user prompt
  if (alternatingTurns.length > 0 && alternatingTurns[0].role === "assistant") {
    alternatingTurns.unshift({ role: "user", content: "Hello" });
  }

  // Ensure last turn is user
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