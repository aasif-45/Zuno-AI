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
