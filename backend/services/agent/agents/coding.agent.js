import { randomUUID } from "crypto";
import {
  getModel,
  invokeModelWithFallback,
  buildCleanLLMMessages,
} from "../config/llmModel.js";

export const codingAgent = async (state) => {
  try {
    // ---------------------------
    // Step 1: Detect Coding Intent
    // ---------------------------
    const intentLLM = await getModel("intent");

    const intentPrompt = `
You are a coding request classifier.

Choose EXACTLY one label:

- project_generation: User explicitly wants a full web app, website, UI component, dashboard, landing page, or multi-file web project (HTML/CSS/JS, React, etc.).
- algo_dsa_code: User asks for a Data Structure, Algorithm (e.g., insertion sort, binary search, sorting, tree, graph, dynamic programming), code snippet, standalone function, script, or DSA problem.
- code_review: User wants code reviewed.
- code_explanation: User wants code explained.
- debugging: User wants to debug an error or fix code.
- optimization: User wants to optimize performance or memory.
- conversion: User wants code translated from one language to another.

Reply ONLY with the exact label.

User Request:
${state.prompt}
`;

    const intentResponse = await invokeModelWithFallback(
      intentLLM,
      intentPrompt
    );

    const intent = (intentResponse?.content || "")
      .trim()
      .toLowerCase()
      .replace(/[^\w]/g, "_");

    const llm = await getModel("coding");

    const systemPrompt = `
You are MY-AI, an expert software engineering and computer science assistant.

Rules:
- Produce clean, production-ready, well-formatted code.
- Follow modern best practices.
- Format responses using GitHub Flavored Markdown (GFM).
- Use proper fenced code blocks with language identifiers.
`;

    // ---------------------------
    // Step 2: Full Web Project Generation
    // ---------------------------
    if (intent === "project_generation") {
      const generationPrompt = `
Generate a full multi-file web project artifact for this user request.

Default stack:
- index.html
- styles.css
- script.js (or app.js)

Requirements:
- Responsive, modern UI design
- Semantic HTML
- Clean CSS variables
- Well commented code

Return ONLY valid JSON. No markdown wrappers.

Schema:
{
  "files": [
    {
      "name": "index.html",
      "content": "..."
    },
    {
      "name": "styles.css",
      "content": "..."
    },
    {
      "name": "script.js",
      "content": "..."
    }
  ]
}

User Request:
${state.prompt}
`;

      const messages = buildCleanLLMMessages(
        systemPrompt,
        state.history,
        generationPrompt
      );

      const response = await invokeModelWithFallback(llm, messages);

      let data;
      try {
        data = JSON.parse(response.content);
      } catch {
        const match = response.content.match(/\{[\s\S]*\}/);
        if (!match) {
          throw new Error("Invalid JSON returned by model.");
        }
        data = JSON.parse(match[0]);
      }

      return {
        ...state,
        intent,
        aiResponse: `Here is your complete project for **"${state.prompt}"**:`,
        artifacts: [
          {
            id: randomUUID(),
            type: "project",
            title: state.prompt,
            files: data.files || [],
          },
        ],
      };
    }

    // ---------------------------
    // Step 3: DSA / Algorithms / Code Snippets / Debugging / Explanations
    // ---------------------------
    const markdownPrompt = `
User Request:
${state.prompt}

Respond in clean, well-structured GitHub Flavored Markdown.

Guidelines:
1. If the request is for a Data Structure or Algorithm (e.g. Insertion Sort, Binary Search, etc.):
   - Explain how the algorithm works in simple, clear steps.
   - Provide clean, efficient code implementation in the requested language (or Python, C++, Java, or JavaScript if unspecified).
   - Use fenced code blocks with language identifiers (e.g. \`\`\`C++ ... \`\`\`).
   - Include Time Complexity (Best, Average, Worst Case) and Space Complexity using plain Big-O notation without dollar signs (e.g. write O(n), O(1), O(2^n), n - do NOT write $O(n)$ or $n$).
   - Provide a step-by-step example execution.

2. Structure response using clear Markdown headings (# Solution, ## Algorithm Explanation, ## Code Implementation, ## Complexity Analysis).

Do NOT return JSON.
`;

    const messages = buildCleanLLMMessages(
      systemPrompt,
      state.history,
      markdownPrompt
    );

    const response = await invokeModelWithFallback(llm, messages);

    return {
      ...state,
      intent,
      aiResponse: response?.content || "No response generated.",
      artifacts: [],
    };
  } catch (error) {
    console.error("Coding agent error:", error);
    return {
      ...state,
      aiResponse:
        "I encountered an issue while processing your coding request. Please try again.",
      artifacts: [],
    };
  }
};