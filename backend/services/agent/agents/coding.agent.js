import { randomUUID } from "crypto";
import {
  getModel,
  invokeModelWithFallback,
  buildCleanLLMMessages,
} from "../config/llmModel.js";

export const codingAgent = async (state) => {
  try {
    const rawPrompt = (state.prompt || "").trim();
    const lowerPrompt = rawPrompt.toLowerCase();

    // ---------------------------
    // Step 1: Detect Intent (Fast Regex + Fallback)
    // ---------------------------
    const isProjectRequest =
      /\b(make|build|create|generate|write|develop|design)\s+(a\s+|an\s+)?(calculator|app|website|web app|game|dashboard|landing page|clone|portfolio|component|tool|ui|todo list|weather app|timer|form)\b/i.test(lowerPrompt) ||
      /\b(html|css|javascript|frontend|react|full project|multi-file)\b/i.test(lowerPrompt);

    let intent = isProjectRequest ? "project_generation" : "algo_dsa_code";

    const llm = await getModel("coding");

    const systemPrompt = `
You are MY-AI, an expert software engineering assistant.
Rules:
- Produce clean, production-ready, beautiful, well-formatted code.
- Follow modern best practices.
- For full web apps, generate clean modern HTML5, CSS3, and JavaScript.
`;

    // ---------------------------
    // Step 2: Full Web Project Generation
    // ---------------------------
    if (intent === "project_generation") {
      const generationPrompt = `
Generate a full, working multi-file web application artifact for: "${rawPrompt}".

Default stack:
- index.html (semantic HTML, links styles.css and script.js, modern layout)
- styles.css (modern responsive dark/light styling, clean CSS variables, smooth animations)
- script.js (interactive, bug-free, fully functional vanilla JavaScript)

Requirements:
- Responsive, sleek modern UI design
- Fully working interactive features (e.g. if calculator, all buttons and math work)
- Return ONLY valid JSON with no markdown wrapping.

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
`;

      const messages = buildCleanLLMMessages(
        systemPrompt,
        state.history,
        generationPrompt
      );

      const response = await invokeModelWithFallback(llm, messages);
      const rawContent = response?.content || "";

      let data = null;
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("JSON parse warning in coding agent:", parseErr.message);
      }

      if (data && Array.isArray(data.files) && data.files.length > 0) {
        return {
          ...state,
          intent,
          aiResponse: `Here is your complete, interactive project for **"${rawPrompt}"**. You can preview, edit, and download the code in the Artifact panel!`,
          artifacts: [
            {
              id: randomUUID(),
              type: "project",
              title: rawPrompt.length > 40 ? rawPrompt.slice(0, 40) + "..." : rawPrompt,
              files: data.files,
            },
          ],
        };
      }
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