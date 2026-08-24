import { randomUUID } from "crypto";
import {
  getModel,
  invokeModelWithFallback,
  buildCleanLLMMessages,
} from "../config/llmModel.js";

// Resilient file extractor that handles raw JSON, dirty JSON, markdown code blocks, and full HTML
function extractArtifactFiles(rawContent, userPrompt) {
  if (!rawContent) return null;

  // 1. Try standard JSON extraction
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const cleaned = jsonMatch[0]
        .replace(/,\s*([\]}])/g, "$1") // strip trailing commas
        .replace(/[\u0000-\u001F]+/g, (match) => {
          if (match === "\n" || match === "\r" || match === "\t") return match;
          return "";
        });
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.files) && parsed.files.length > 0) {
        const validFiles = parsed.files.filter(
          (f) => f && typeof f.name === "string" && typeof f.content === "string"
        );
        if (validFiles.length > 0) return validFiles;
      }
    }
  } catch (_) {
    // Continue to next extraction strategy
  }

  // 2. Try markdown fenced code blocks (```html ... ```, ```css ... ```, ```javascript ... ```)
  const codeBlockRegex = /```([a-zA-Z0-9_\-\+]+)?\s*(?:\/\/\s*([\w\.\-]+)|\/\*\s*([\w\.\-]+)\s*\*\/|<!--\s*([\w\.\-]+)\s*-->)?\n([\s\S]*?)```/g;
  const blockFiles = [];
  let blockMatch;
  let fileIdx = 1;

  while ((blockMatch = codeBlockRegex.exec(rawContent)) !== null) {
    const lang = (blockMatch[1] || "").toLowerCase();
    const explicitName = blockMatch[2] || blockMatch[3] || blockMatch[4];
    const codeContent = (blockMatch[5] || "").trim();

    if (!codeContent) continue;

    let fileName = explicitName;
    if (!fileName) {
      if (lang === "html" || codeContent.includes("<!DOCTYPE") || codeContent.includes("<html") || codeContent.includes("<div")) {
        fileName = "index.html";
      } else if (lang === "css" || (codeContent.includes("{") && codeContent.includes("margin") && !codeContent.includes("function"))) {
        fileName = "styles.css";
      } else if (lang === "javascript" || lang === "js" || lang === "ts") {
        fileName = "script.js";
      } else if (lang === "python" || lang === "py") {
        fileName = "main.py";
      } else {
        fileName = `file_${fileIdx}.${lang || "txt"}`;
        fileIdx++;
      }
    }

    // Deduplicate filename if necessary
    if (blockFiles.some((f) => f.name === fileName)) {
      const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
      const base = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;
      fileName = `${base}_${fileIdx}${ext}`;
      fileIdx++;
    }

    blockFiles.push({ name: fileName, content: codeContent });
  }

  if (blockFiles.length > 0) return blockFiles;

  // 3. If rawContent itself looks like complete HTML
  if (rawContent.includes("<!DOCTYPE html") || rawContent.includes("<html")) {
    return [
      {
        name: "index.html",
        content: rawContent.trim(),
      },
    ];
  }

  return null;
}

export const codingAgent = async (state) => {
  try {
    const rawPrompt = (state.prompt || "").trim();
    const lowerPrompt = rawPrompt.toLowerCase();

    // ---------------------------
    // Step 1: Detect Intent (Fast Regex + Fallback)
    // ---------------------------
    const isProjectRequest =
      /\b(make|build|create|generate|write|develop|design|code|implement)\s+(a\s+|an\s+)?(calculator|app|website|web app|game|dashboard|landing page|clone|portfolio|component|tool|ui|todo list|weather app|timer|form|quiz|widget)\b/i.test(lowerPrompt) ||
      /\b(coin toss|tic tac toe|snake game|pong|rock paper scissors|blackjack|memory game|flappy bird|wordle|hangman|sudoku|card game|roulette)\b/i.test(lowerPrompt) ||
      /\b(html|css|javascript|frontend|react|full project|multi-file|interactive game)\b/i.test(lowerPrompt);

    let intent = isProjectRequest ? "project_generation" : "algo_dsa_code";

    const llm = await getModel("coding");

    const systemPrompt = `
You are Zuno AI, an expert software engineering assistant.
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
- index.html (semantic HTML, modern responsive layout, links styles.css and script.js)
- styles.css (modern sleek dark/light styling, clean CSS variables, smooth transitions and animations)
- script.js (fully interactive, bug-free, complete working vanilla JavaScript)

Requirements:
- Sleek modern UI design with dark mode styling
- Fully working interactive gameplay/features (e.g. if coin toss game: 3D coin flip animation, heads/tails outcome calculation, streak score counter, sound/visual feedback)
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

      // Extract files using robust parser
      const extractedFiles = extractArtifactFiles(rawContent, rawPrompt);

      if (extractedFiles && extractedFiles.length > 0) {
        return {
          ...state,
          intent,
          aiResponse: `Here is your complete, interactive project for **"${rawPrompt}"**. You can test the live preview, edit, and download the code in the Artifact panel on the right!`,
          artifacts: [
            {
              id: randomUUID(),
              type: "project",
              title: rawPrompt.length > 40 ? rawPrompt.slice(0, 40) + "..." : rawPrompt,
              files: extractedFiles,
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