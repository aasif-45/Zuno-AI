import {
  getModel,
  invokeModelWithFallback,
  buildCleanLLMMessages,
} from "../config/llmModel.js";

export const chatAgent = async (state) => {
  try {
    const llm = await getModel("chat");

    const searchList = Array.isArray(state.searchResults)
      ? state.searchResults
      : (state.searchResults?.results || []);

    const searchContext = searchList.length > 0
      ? `
## Web Search Results

${searchList
  .map((item, index) => {
    const title = item.title || item.name || `Result ${index + 1}`;
    const snippet = item.snippet || item.content || item.description || "";
    const source = item.source || item.website || "";
    const url = item.url || "";

    return `### ${index + 1}. ${title}
${snippet ? `- Snippet: ${snippet}` : ""}
${source ? `- Source: ${source}` : ""}
${url ? `- URL: ${url}` : ""}`;
  })
  .join("\n\n")}

Use these search results as the primary source of truth to answer the user's question.
`
      : "";

    const now = new Date();
    const currentDateTimeIST = now.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "medium",
    });

    const systemPrompt = `You are Zuno AI, an intelligent, modern AI assistant.
 
CRITICAL IDENTITY RULES:
- Your name is Zuno AI (or ZUNO AI).
- You are NOT ChatGPT. You are NOT developed by OpenAI. You are NOT GPT-4.
- NEVER say you are ChatGPT, GPT-3, GPT-4, or developed by OpenAI.
- If asked "who are you", "what model are you", or "who created you", always answer that you are Zuno AI, an advanced multi-agent AI platform built to help with code, presentations, PDF documents, vision, web search, and general reasoning.

Current Real-Time Date & Time (IST / Asia/Kolkata): ${currentDateTimeIST}

${searchContext}
Follow these rules:

1. For queries asking for "current time", "current date", "today's date", or time in any city (like Delhi, London, New York), use the Current Real-Time Date & Time provided above to calculate and state the exact current time and date directly and confidently. Never state that you don't have access to current time.
2. Use ONLY the information found in the search results when web search results exist.
3. Never invent facts that are not supported by the search results.
4. Prefer information from highly reliable sources such as Reuters, AP, Bloomberg, BBC, The Verge, TechCrunch, Wired, official company blogs, Microsoft, Google, Apple, etc.
5. If multiple sources report the same story, merge them into one concise summary.
6. If sources conflict, explicitly mention the disagreement instead of choosing one.
7. Rank news or findings by importance, not by the order in which the search results appear.
8. For news headlines, provide:
   - Headline
   - 1–2 sentence summary
   - Source
9. If a claim appears in only one low-confidence source, say:
   "This has been reported by <source>, but it has not yet been widely confirmed."
10. Never answer with outdated general knowledge when search results exist.
11. If search results are empty or not provided, answer using general knowledge. If real-time or live data is requested and unavailable, say:
    "I couldn't find reliable recent information on that topic."

Your highest priority is factual accuracy. It is better to say "I don't know" than to invent information.
`;

    const messages = buildCleanLLMMessages(
      systemPrompt,
      state.history,
      state.prompt
    );

    const response = await invokeModelWithFallback(llm, messages);

    const textOutput =
      typeof response?.content === "string"
        ? response.content
        : Array.isArray(response?.content)
        ? response.content.map((c) => (typeof c === "string" ? c : c?.text || "")).join("\n")
        : String(response?.content || response?.text || "");

    return {
      ...state,
      aiResponse: textOutput || "Hello! I am Zuno AI, an advanced AI assistant. How can I help you today?",
    };
  } catch (error) {
    console.error("Chat agent error:", error.message);
    return {
      ...state,
      aiResponse: "Hello! I am Zuno AI, an advanced AI assistant. How can I help you today?",
    };
  }
};
