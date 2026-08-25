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
// Separate cache key per client: both used to share currentOpenRouterKey, so
// building one silently invalidated the other on every alternating call.
let currentNemotronKey = null;
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
// The separator class is deliberately permissive, but the surrounding guards
// are NOT \b: a bare \b let "myai" match inside identifiers such as the S3
// bucket name "myai-demo1", which rewrote presigned download hosts to a bucket
// that does not exist and broke every PDF/PPT link with SignatureDoesNotMatch.
const MY_AI_PATTERN = /(?<![\w-])MY[\s  _-]*AI(?![\w-])/gi;

// Spans that must never be brand-rewritten: URLs carry signed hostnames, and
// code spans/blocks carry identifiers the user has to copy verbatim.
const PROTECTED_SPANS = /```[\s\S]*?```|`[^`\n]*`|\bhttps?:\/\/[^\s<>"')\]]+/g;

/**
 * Applies fn to text while leaving URLs and code spans byte-for-byte intact.
 */
// Placeholder delimiter: a character an LLM response will never contain, so a
// masked span can never be confused with real prose.
const SPAN_SENTINEL = String.fromCharCode(1);
const SPAN_PLACEHOLDER = new RegExp(`${SPAN_SENTINEL}(\\d+)${SPAN_SENTINEL}`, "g");

const replaceOutsideProtectedSpans = (text, fn) => {
  const held = [];
  const masked = text.replace(PROTECTED_SPANS, (match) => {
    held.push(match);
    return `${SPAN_SENTINEL}${held.length - 1}${SPAN_SENTINEL}`;
  });
  if (!held.length) return fn(text);
  return fn(masked).replace(SPAN_PLACEHOLDER, (whole, i) => {
    const original = held[Number(i)];
    return original === undefined ? whole : original;
  });
};

export const enforceBrandIdentity = (text = "") => {
  if (typeof text !== "string" || !text) return text;
  return replaceOutsideProtectedSpans(text, (safe) => safe
    .replace(new RegExp(`\\bI'?m\\s+${MY_AI_PATTERN.source}`, "gi"), "I'm Zuno-AI")
    .replace(MY_AI_PATTERN, "Zuno-AI")
    // Collapse "Zuno AI" / "Zuno_AI" to the canonical "Zuno-AI" spelling.
    .replace(/\bZuno[\s _]AI\b/g, "Zuno-AI")
    // After rewriting, a denial like "I'm MY AI, not Zuno AI" turns into a
    // self-contradiction — flatten it into a plain identity statement.
    .replace(/\bZuno-AI,?\s+not\s+Zuno-AI\b/gi, "Zuno-AI"));
};

/**
 * Returned as the response body when every tier failed. It is user-facing prose,
 * so callers that write model output into a FILE (artifact, PDF section) must
 * test for it first — an artifact once shipped a script.js whose entire content
 * was this sentence, which the preview then tried to execute as JavaScript.
 */
export const NO_QUOTA_MESSAGE = "No limit left. Please try again later or upgrade your plan.";

export const isQuotaSentinel = (text = "") => /^\s*No limit left\./i.test(String(text || ""));

const sanitizeResult = (res) => {
  if (!res) return { content: NO_QUOTA_MESSAGE };
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

/**
 * Token budgets: deliberately UNSET (null = do not send max_tokens at all).
 *
 * Every cap we tried was worse than no cap. 2500 truncated projects after the
 * HTML block and cut documents off mid-JSON. Raising it to 4000 made OpenRouter
 * reject the call outright on a low credit balance — "You requested up to 4000
 * tokens, but can only afford 395" — which pushed every request down the
 * fallback chain, and 8000 also tripped the Groq free-tier TPM ceiling.
 *
 * With no max_tokens the provider applies its own model default: nothing is
 * pre-rejected for a budget we never needed to state, and responses run to
 * their natural end. The names are kept so callers can express "this is a big
 * output" without hard-coding a number here.
 */
export const CHAT_MAX_TOKENS = null;
export const DOCUMENT_MAX_TOKENS = null;
export const PROJECT_MAX_TOKENS = null;

/**
 * Per-tier invocation ceiling. Four tiers at 65s each could push a single
 * request past 200s, far beyond the ALB idle timeout (now 300s, previously 60s),
 * which is what produced 504s while the container quietly finished the work.
 * 25s is enough for every tier that actually answers; the free tiers that stall
 * never recover within 65s either, so the extra waiting bought nothing.
 */
export const TIER_TIMEOUT_MS = 25000;

/**
 * Documents and projects are the longest outputs and are now uncapped, so they
 * need more wall-clock than a chat reply — still bounded so the full cascade
 * stays under the ALB idle timeout.
 */
export const DOCUMENT_TIER_TIMEOUT_MS = 60000;

// max_tokens is omitted entirely unless a caller asks for a specific ceiling.
const tokenLimit = (maxTokens) =>
  Number.isFinite(maxTokens) && maxTokens > 0 ? { maxTokens } : {};

/**
 * Groq is the exception to the "send no limit" rule: with max_tokens omitted it
 * applies a 2048-token default — LOWER than the cap we removed — and qwen3.6
 * spends a chunk of that on its <think> preamble, so script.js arrived as bare
 * variable declarations with no functions or listeners (measured:
 * finish_reason "length" at exactly 2048 output tokens).
 *
 * The ceiling is what the free tier can actually pay for, not a quality choice:
 * Groq counts prompt + requested completion against 8000 tokens/minute, and a
 * project prompt is ~900, so 6000 got rejected with 429 "Limit 8000 ...
 * Requested 6918" as soon as two calls landed in the same minute. 4000 leaves
 * room for the follow-up repair call.
 */
const GROQ_MAX_OUTPUT_TOKENS = 4000;

export const getGroq = (modelName = "openai/gpt-oss-120b", maxTokens = CHAT_MAX_TOKENS) => {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY || "",
    model: modelName,
    ...tokenLimit(Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : GROQ_MAX_OUTPUT_TOKENS),
    maxRetries: 2,
  });
};

export const getGemini = (modelName = "gemini-3.6-flash") => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  // Cache per model as well as per key — keying on the API key alone handed
  // callers a client pinned to whatever model was requested first.
  const cacheKey = `${apiKey}::${modelName}`;
  if (!geminiInstance || currentGeminiKey !== cacheKey) {
    currentGeminiKey = cacheKey;
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
export const getOpenRouterDeepSeekV4 = (maxTokens = CHAT_MAX_TOKENS) => {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  // Cache per token budget too — document generation needs a larger budget
  // than chat, and a key-only cache handed it whichever client was built first.
  const cacheKey = `${apiKey}::${maxTokens}`;
  if (!openRouterDeepSeekInstance || currentOpenRouterKey !== cacheKey) {
    currentOpenRouterKey = cacheKey;
    openRouterDeepSeekInstance = new ChatOpenAI({
      apiKey,
      model: "deepseek/deepseek-v4-flash",
      temperature: 0.2,
      ...tokenLimit(maxTokens),
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
 * Vision-capable fallbacks for image analysis.
 *
 * deepseek/deepseek-v4-flash is text-only — sending it an image_url part fails
 * with "No endpoints found that support image input", so image analysis needs
 * its own model list rather than reusing the general chat fallbacks.
 */
const OPENROUTER_VISION_MODELS = [
  "google/gemini-3.7-flash",
  "minimax/minimax-m3:free",
];

export const getOpenRouterVisionModels = () => {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) return [];

  return OPENROUTER_VISION_MODELS.map((model) => ({
    model,
    client: new ChatOpenAI({
      apiKey,
      model,
      temperature: 0.2,
      maxRetries: 1,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    }),
  }));
};

/**
 * Fallback Tier 2 Model: OpenRouter Nemotron 3 Ultra Free
 */
export const getOpenRouterNemotron3Ultra = (maxTokens = CHAT_MAX_TOKENS) => {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  const cacheKey = `${apiKey}::${maxTokens}`;
  if (!openRouterNemotronInstance || currentNemotronKey !== cacheKey) {
    currentNemotronKey = cacheKey;
    openRouterNemotronInstance = new ChatOpenAI({
      apiKey,
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      temperature: 0.2,
      ...tokenLimit(maxTokens),
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
export const getModel = async (type = "chat", maxTokens = CHAT_MAX_TOKENS) => {
  switch (type) {
    case "coding":
      // Primary: OpenRouter DeepSeek V4 Flash -> Nemotron 3 Ultra -> Groq Qwen
      return getOpenRouterDeepSeekV4(maxTokens) || getOpenRouterNemotron3Ultra(maxTokens) || getGroq("qwen/qwen3.6-27b", maxTokens);

    case "router":
      // Primary: OpenRouter DeepSeek V4 Flash -> Groq Qwen
      return getOpenRouterDeepSeekV4() || getGroq("qwen/qwen3.6-27b");

    case "imageAnalyzer":
    case "pdfRag":
      // Image and PDF Analysis: Google Gemini 3.6 Flash
      return getGemini("gemini-3.6-flash");

    case "pdf":
    case "ppt":
      // Document generation returns one large JSON object — give it room so the
      // response is not truncated mid-object.
      return getOpenRouterDeepSeekV4(DOCUMENT_MAX_TOKENS) || getGemini("gemini-3.6-flash");

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
export const invokeModelWithFallback = async (model, input, options = {}) => {
  // Fallback tiers must honour the caller's token budget: a document request
  // that fell through to a 2500-token fallback came back truncated.
  const maxTokens = options.maxTokens || CHAT_MAX_TOKENS;

  // Per-tier ceiling. This used to be 65s on each of four tiers, so a request
  // could legitimately run past 200s — well beyond the ALB idle timeout, which
  // returned 504 to the browser while the container carried on and saved the
  // answer. The reply then only appeared after a refresh.
  const tierTimeout = options.timeoutMs || TIER_TIMEOUT_MS;

  // Tiers the caller wants skipped, e.g. a free model that reliably stalls.
  const skip = new Set(options.skipTiers || []);

  const invokeWithTimeout = (modelInst, ms = tierTimeout) => {
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
      const res = await invokeWithTimeout(model);
      console.log("✅ [AI Agent Pipeline] Primary Model succeeded!");
      return sanitizeResult(res);
    } catch (errPrimary) {
      console.error("⚠️ [AI Agent Pipeline] Primary Model failed, moving to fallbacks:", errPrimary.message || errPrimary);
    }
  }

  // Fallback Tier 1: OpenRouter DeepSeek V4 Flash Free
  try {
    console.log("🔄 [AI Agent Pipeline] Fallback Tier 1: Executing OpenRouter DeepSeek V4 Flash...");
    const deepseekV4 = getOpenRouterDeepSeekV4(maxTokens);
    if (deepseekV4) {
      const res = await invokeWithTimeout(deepseekV4);
      console.log("✅ [AI Agent Pipeline] OpenRouter DeepSeek V4 Flash succeeded!");
      return sanitizeResult(res);
    }
  } catch (errV4) {
    console.error("⚠️ [AI Agent Pipeline] OpenRouter DeepSeek V4 Flash failed:", errV4.message || errV4);
  }

  // Fallback Tier 2: OpenRouter Nemotron 3 Ultra Free
  if (!skip.has("nemotron")) {
    try {
      console.log("🔄 [AI Agent Pipeline] Fallback Tier 2: Executing OpenRouter Nemotron 3 Ultra Free...");
      const nemotron = getOpenRouterNemotron3Ultra(maxTokens);
      if (nemotron) {
        const res = await invokeWithTimeout(nemotron);
        console.log("✅ [AI Agent Pipeline] OpenRouter Nemotron 3 Ultra Free succeeded!");
        return sanitizeResult(res);
      }
    } catch (errNemo) {
      console.error("⚠️ [AI Agent Pipeline] OpenRouter Nemotron 3 Ultra Free failed:", errNemo.message || errNemo);
    }
  }

  // Fallback Tier 3: LangChain Groq Model (Qwen - neutral, no brand identity)
  try {
    console.log("🔄 [AI Agent Pipeline] Fallback Tier 3: Executing LangChain Groq (Qwen) model...");
    const groqModel = getGroq("qwen/qwen3.6-27b", maxTokens);
    if (groqModel) {
      const res = await invokeWithTimeout(groqModel);
      console.log("✅ [AI Agent Pipeline] LangChain Groq (Qwen) model succeeded!");
      return sanitizeResult(res);
    }
  } catch (errGroq) {
    console.error("⚠️ [AI Agent Pipeline] LangChain Groq (Qwen) model failed:", errGroq.message || errGroq);
  }

  // Quota Exceeded / All Models Failed
  console.error("❌ [AI Agent Pipeline] All AI model fallbacks exhausted or limit reached.");
  return {
    content: NO_QUOTA_MESSAGE,
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