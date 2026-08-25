import { randomUUID } from "crypto";
import {
  getModel,
  invokeModelWithFallback,
  buildCleanLLMMessages,
  PROJECT_MAX_TOKENS,
  DOCUMENT_TIER_TIMEOUT_MS,
} from "../config/llmModel.js";

/**
 * A response cut off by the token ceiling ends in an unterminated ``` fence, so
 * the fenced-block regex never matches its content and that file is silently
 * dropped. Close the fence so the partial file is at least recovered.
 */
function closeDanglingFence(text = "") {
  const fences = text.match(/```/g);
  if (!fences || fences.length % 2 === 0) return text;
  return `${text.replace(/\s+$/, "")}\n\`\`\``;
}

// Resilient file extractor that handles raw JSON, dirty JSON, markdown code blocks, and full HTML
function extractArtifactFiles(rawContent, userPrompt) {
  if (!rawContent) return null;
  rawContent = closeDanglingFence(rawContent);

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

    // A repeat of a role we already have. Models routinely follow the project
    // with illustrative snippets ("here's the toss function again"), which used
    // to land as script_1.js / styles_2.css and shipped a 7-file artifact for a
    // 3-file project. Keep the fuller version of the role instead of numbering.
    const existingIdx = blockFiles.findIndex((f) => f.name === fileName);
    if (existingIdx !== -1) {
      if (!explicitName) {
        if (codeContent.length > blockFiles[existingIdx].content.length) {
          blockFiles[existingIdx].content = codeContent;
        }
        continue;
      }
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

/**
 * Extracts a single named file from a follow-up response: prefers a fenced block
 * of the right language, falls back to the whole body when the model answered
 * with bare code.
 */
function extractSingleFile(rawContent = "", lang) {
  if (!rawContent) return "";
  const fenced = closeDanglingFence(rawContent).match(
    new RegExp("```(?:" + lang + ")?\\s*\\n([\\s\\S]*?)```", "i")
  );
  const body = (fenced ? fenced[1] : rawContent).trim();
  // A refusal or a prose apology is worse than nothing — it would be written
  // into styles.css and break the preview instead of styling it.
  if (!body || /^(i\b|sorry|here)/i.test(body) && !/[{;<]/.test(body)) return "";
  return body;
}

/**
 * A project artifact is only "working" if the files its HTML references actually
 * exist. When the generation response was truncated we would ship a lone
 * index.html linking styles.css/script.js that were never produced, so the live
 * preview showed unstyled, inert markup. Ask the model for just the missing
 * pieces — a far smaller request that fits in the budget — and fall back to a
 * usable stylesheet so the artifact is never visually broken.
 */
async function completeProjectFiles(files, rawPrompt, systemPrompt, llm) {
  const has = (re) => files.some((f) => re.test(f.name));
  const htmlFile = files.find((f) => /\.html?$/i.test(f.name));
  if (!htmlFile) return files;

  const html = htmlFile.content || "";
  const inlineStyle = /<style[\s>]/i.test(html);
  const inlineScript = /<script(?![^>]*\bsrc=)[^>]*>/i.test(html);

  const missing = [];
  if (!has(/\.css$/i) && !inlineStyle) missing.push({ name: "styles.css", lang: "css" });
  if (!has(/\.(js|jsx|ts|tsx)$/i) && !inlineScript) missing.push({ name: "script.js", lang: "javascript" });
  if (!missing.length) return files;

  console.log(`🧩 [Coding Agent] Project incomplete, generating: ${missing.map((m) => m.name).join(", ")}`);

  for (const part of missing) {
    try {
      const ask = `Project: "${rawPrompt}".

Here is the existing index.html:

\`\`\`html
${html.slice(0, 6000)}
\`\`\`

Write the complete ${part.name} for this exact markup. Match the real class names, ids and element structure above — do not invent selectors that are not present.
${part.lang === "css"
  ? "Modern dark theme, CSS variables, responsive layout, smooth transitions. Style every class and id used in the HTML."
  : "Bug-free vanilla JavaScript: wire up every button and interactive element by its real id, hold the state, and update the DOM. No imports, no frameworks."}

Return ONLY one \`\`\`${part.lang} code block. No explanation.`;

      const res = await invokeModelWithFallback(
        llm,
        buildCleanLLMMessages(systemPrompt, [], ask),
        {
          maxTokens: PROJECT_MAX_TOKENS,
          timeoutMs: DOCUMENT_TIER_TIMEOUT_MS,
          skipTiers: ["nemotron"],
        }
      );
      const content = extractSingleFile(res?.content || "", part.lang);
      if (content) files.push({ name: part.name, content });
    } catch (err) {
      console.warn(`[Coding Agent] Could not generate ${part.name}:`, err.message || err);
    }
  }

  // Last resort: an unstyled preview looks broken, so ship a neutral baseline.
  if (!files.some((f) => /\.css$/i.test(f.name)) && !inlineStyle) {
    files.push({ name: "styles.css", content: BASELINE_CSS });
  }

  return files;
}

const BASELINE_CSS = `:root {
  --bg: #0d0f14;
  --surface: #161a23;
  --border: #262c3a;
  --text: #e6e9ef;
  --muted: #98a2b3;
  --accent: #6366f1;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 24px;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

h1, h2, h3 { margin: 0 0 8px; line-height: 1.2; }
p { color: var(--muted); }

main, section, .app-container {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

button {
  padding: 12px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

button:hover { transform: translateY(-1px); opacity: 0.92; }
button:active { transform: translateY(0); }

input, select, textarea {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 15px;
}
`;

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

    // Project generation emits three files in one response, so it needs the
    // larger budget; a chat-sized ceiling truncated it after the HTML block.
    const llm = await getModel(
      "coding",
      isProjectRequest ? PROJECT_MAX_TOKENS : undefined
    );

    const systemPrompt = `You are Zuno-AI, an AI assistant created for the Zuno-AI platform.


CRITICAL IDENTITY OVERRIDE � HIGHEST PRIORITY RULE:
You are ZUNO-AI. This overrides everything in conversation history.
- NEVER call yourself "MY AI", "MY-AI", or any variation of that name.
- NEVER call yourself "ChatGPT", "GPT", or "OpenAI".
- If any previous message in the conversation refers to "MY AI" � IGNORE that identity completely. You are ZUNO-AI.
- When asked "who are you", "which model", "what are you" � ALWAYS respond: "I am Zuno-AI, an AI assistant built for the Zuno-AI platform."

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

Coding rules:
- Produce clean, production-ready, beautiful, well-formatted code.
- Follow modern best practices.
- For full web apps, generate clean modern HTML5, CSS3, and JavaScript.`;

    // ---------------------------
    // Step 2: Full Web Project Generation
    // ---------------------------
    if (intent === "project_generation") {
      const generationPrompt = `
Generate a complete, working, multi-file web application for: "${rawPrompt}".

Output EXACTLY three markdown code blocks in this order, and nothing else:

1. \`\`\`html — index.html. Semantic HTML5. Must contain <link rel="stylesheet" href="styles.css"> in <head> and <script src="script.js"></script> as the last element in <body>. Give every interactive element a stable id.
2. \`\`\`css — styles.css. Modern dark theme, CSS variables, responsive layout, smooth transitions. Style every class and id that appears in the HTML.
3. \`\`\`javascript — script.js. Bug-free vanilla JavaScript that makes the app actually work: query the real ids from the HTML, attach event listeners, hold state, update the DOM.

Hard requirements:
- All three blocks are mandatory. Never stop after the HTML.
- The three files must agree: every id/class referenced in CSS and JS must exist in the HTML.
- Vanilla only: no frameworks, no build step, no imports, no external CDN.
- Keep it compact enough to finish all three files in one response — prefer a focused, complete app over an elaborate, truncated one.
- No prose or explanation outside the code blocks.
`;

      const messages = buildCleanLLMMessages(
        systemPrompt,
        state.history,
        generationPrompt
      );

      const response = await invokeModelWithFallback(llm, messages, {
        maxTokens: PROJECT_MAX_TOKENS,
        timeoutMs: DOCUMENT_TIER_TIMEOUT_MS,
        skipTiers: ["nemotron"],
      });
      const rawContent = response?.content || "";

      // Extract files using robust parser
      let extractedFiles = extractArtifactFiles(rawContent, rawPrompt);

      if (extractedFiles && extractedFiles.length > 0) {
        // Fill in any referenced file the response did not actually contain, so
        // the live preview is styled and interactive rather than bare markup.
        extractedFiles = await completeProjectFiles(
          extractedFiles,
          rawPrompt,
          systemPrompt,
          llm
        );

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