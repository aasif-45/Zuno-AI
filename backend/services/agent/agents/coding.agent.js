import { randomUUID } from "crypto";
import {
  getModel,
  invokeModelWithFallback,
  buildCleanLLMMessages,
} from "../config/llmModel.js";

// Resilient file extractor that handles raw JSON, dirty JSON, markdown code blocks, and full HTML
function extractArtifactFiles(rawContent, userPrompt) {
  if (!rawContent) return null;

  // 1. Try standard JSON extraction (including markdown ```json ... ```)
  try {
    let cleanJson = rawContent;
    const jsonBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      cleanJson = jsonBlockMatch[1];
    }
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
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

    if (!codeContent || lang === "json") continue;

    let fileName = explicitName;
    if (!fileName) {
      if (lang === "html" || codeContent.includes("<!DOCTYPE") || codeContent.includes("<html") || codeContent.includes("<div") || codeContent.includes("<canvas") || codeContent.includes("<body")) {
        fileName = "index.html";
      } else if (lang === "css" || (codeContent.includes("{") && (codeContent.includes("margin") || codeContent.includes("background") || codeContent.includes("color")) && !codeContent.includes("function"))) {
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

  if (blockFiles.length > 0) {
    // If we extracted css and js, but no html, create an index.html container
    if (!blockFiles.some((f) => /\.html?$/i.test(f.name))) {
      blockFiles.unshift({
        name: "index.html",
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Preview</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <div id="app"></div>\n  <script src="script.js"></script>\n</body>\n</html>`,
      });
    }
    return blockFiles;
  }

  // 3. If rawContent itself looks like complete HTML
  if (rawContent.includes("<!DOCTYPE html") || rawContent.includes("<html") || rawContent.includes("<canvas") || rawContent.includes("<body")) {
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
      /\b(make|build|create|generate|write|develop|design|code|implement|show|give)\s+(a\s+|an\s+|me\s+(a\s+|an\s+)?)?(game|app|website|web app|calculator|clone|dashboard|landing page|todo|portfolio|component|tool|ui|todo list|weather app|timer|form|quiz|widget|simulation|animation|interactive)\b/i.test(lowerPrompt) ||
      /\b(game|balloon|burst|bursting|pop|popping|coin toss|tic tac toe|snake|pong|rock paper scissors|blackjack|memory game|flappy bird|wordle|hangman|sudoku|card game|roulette|puzzle|shooter|arcade)\b/i.test(lowerPrompt) ||
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
Generate a complete, modern, fully-functional multi-file web application for: "${rawPrompt}".

Files to provide:
1. index.html - Semantic HTML5 structure, links to styles.css and script.js, modern dark layout.
2. styles.css - Sleek modern UI design, CSS variables, glassmorphism, responsive grid, smooth animations.
3. script.js - Bug-free vanilla JavaScript with full interactive features, event listeners, state handling, sound/visual feedback, and score/game mechanics.

You may output either valid JSON:
{
  "files": [
    { "name": "index.html", "content": "..." },
    { "name": "styles.css", "content": "..." },
    { "name": "script.js", "content": "..." }
  ]
}

OR structured Markdown code blocks (e.g. \`\`\`html ... \`\`\`, \`\`\`css ... \`\`\`, \`\`\`javascript ... \`\`\`).
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
1. Explain how the solution or algorithm works clearly.
2. Provide clean, efficient code implementation in standard fenced code blocks (e.g. \`\`\`javascript, \`\`\`html, \`\`\`python, \`\`\`cpp).
3. If web code or game is requested, provide complete, working code in \`\`\`html, \`\`\`css, and \`\`\`javascript blocks.
4. For algorithms, include Time and Space Complexity using plain O(n) notation without dollar signs.
`;

    const messages = buildCleanLLMMessages(
      systemPrompt,
      state.history,
      markdownPrompt
    );

    const response = await invokeModelWithFallback(llm, messages);
    const content = response?.content || "No response generated.";

    // Fallback file extraction: If the markdown output contains code blocks (HTML, CSS, JS, Python), create an artifact!
    const fallbackFiles = extractArtifactFiles(content, rawPrompt);
    const generatedArtifacts = fallbackFiles && fallbackFiles.length > 0
      ? [
          {
            id: randomUUID(),
            type: "project",
            title: rawPrompt.length > 40 ? rawPrompt.slice(0, 40) + "..." : rawPrompt,
            files: fallbackFiles,
          },
        ]
      : [];

    return {
      ...state,
      intent,
      aiResponse: content,
      artifacts: generatedArtifacts,
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