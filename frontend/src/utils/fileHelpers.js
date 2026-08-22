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
  if (!files.length) return "";
  const html = files.find((f) => /\.html?$/i.test(f.name))?.content || "";
  const css = files.find((f) => /\.css$/i.test(f.name))?.content || "";
  const js = files.find((f) => /\.(js|jsx)$/i.test(f.name))?.content || "";

  let baseHtml = html || `<div id="app"></div>`;
  if (css && !baseHtml.includes("<style>")) {
    baseHtml = baseHtml.includes("</head>")
      ? baseHtml.replace("</head>", `<style>\n${css}\n</style></head>`)
      : `<style>\n${css}\n</style>` + baseHtml;
  }
  if (js && !baseHtml.includes("<script>")) {
    baseHtml = baseHtml.includes("</body>")
      ? baseHtml.replace("</body>", `<script>\n${js}\n</script></body>`)
      : baseHtml + `<script>\n${js}\n</script>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body style="margin:0; padding:0; background:#0d0f14; color:#fff; font-family:system-ui,-apple-system,sans-serif;">${baseHtml}</body></html>`;
};
