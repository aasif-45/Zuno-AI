const ext = (file = "") => file.split(".").pop()?.toLowerCase() || "";

const LANG_MAP = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  html: "html",
  htm: "html",
  css: "css",
  json: "json",
  sql: "sql",
  md: "markdown",
};

const BADGE_MAP = {
  html: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  htm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  css: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  js: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  jsx: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  ts: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  tsx: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  py: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

export const getLanguage = (file = "") => LANG_MAP[ext(file)] || "text";

export const getFileBadgeStyle = (file = "") =>
  BADGE_MAP[ext(file)] || "bg-slate-500/10 text-slate-300 border-slate-500/20";

export const generateSrcDoc = (files = []) => {
  if (!files || !files.length) return "";

  // 1. Find HTML or create root container
  const htmlFile = files.find((f) => /\.html?$/i.test(f.name));
  let htmlContent = htmlFile?.content || "";

  // 2. Aggregate all CSS styles
  const allCss = files
    .filter((f) => /\.css$/i.test(f.name))
    .map((f) => f.content || "")
    .join("\n\n");

  // 3. Aggregate all JavaScript code
  const allJs = files
    .filter((f) => /\.(js|jsx|ts|tsx)$/i.test(f.name))
    .map((f) => f.content || "")
    .join("\n\n");

  // If no HTML file was provided, build a basic HTML shell
  if (!htmlContent.trim()) {
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>`;
  }

  // 4. Strip relative <link> and <script> tags for local project files so the browser doesn't 404
  files.forEach((f) => {
    if (!f?.name) return;
    const escaped = f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(`<link[^>]*href=["'](?:\\.\\/)?${escaped}["'][^>]*>`, "gi");
    htmlContent = htmlContent.replace(linkRegex, "");

    const scriptRegex = new RegExp(`<script[^>]*src=["'](?:\\.\\/)?${escaped}["'][^>]*>\\s*<\\/script>`, "gi");
    htmlContent = htmlContent.replace(scriptRegex, "");
  });

  // 5. Inject styles into <head> or at top
  if (allCss.trim()) {
    const styleTag = `<style>\n${allCss}\n</style>`;
    if (htmlContent.includes("</head>")) {
      htmlContent = htmlContent.replace("</head>", `${styleTag}\n</head>`);
    } else if (htmlContent.includes("<body")) {
      htmlContent = htmlContent.replace("<body", `${styleTag}\n<body`);
    } else {
      htmlContent = `${styleTag}\n${htmlContent}`;
    }
  }

  // 6. Inject JavaScript before </body> or at end
  if (allJs.trim()) {
    const scriptTag = `<script>
document.addEventListener("DOMContentLoaded", () => {
  try {
${allJs}
  } catch (err) {
    console.error("Artifact script error:", err);
  }
});
if (document.readyState === "complete" || document.readyState === "interactive") {
  try {
${allJs}
  } catch (err) {
    console.error("Artifact script error:", err);
  }
}
</script>`;

    if (htmlContent.includes("</body>")) {
      htmlContent = htmlContent.replace("</body>", `${scriptTag}\n</body>`);
    } else if (htmlContent.includes("</html>")) {
      htmlContent = htmlContent.replace("</html>", `${scriptTag}\n</html>`);
    } else {
      htmlContent = `${htmlContent}\n${scriptTag}`;
    }
  }

  // 7. Ensure valid HTML document wrapping if missing
  if (!htmlContent.includes("<html") && !htmlContent.includes("<!DOCTYPE")) {
    htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0;">
  ${htmlContent}
</body>
</html>`;
  }

  return htmlContent;
};
