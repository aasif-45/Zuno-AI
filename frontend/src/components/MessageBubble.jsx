import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDispatch } from "react-redux";
import { openArtifact } from "../redux/messageSlice.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Copy,
  Check,
  Sparkles,
  X,
  FileCode2,
  ChevronRight,
  FileText,
  Presentation,
  Globe,
  Code2,
  Image as ImageIcon,
  Loader2,
  Cpu,
} from "lucide-react";

function ImageCard({ imageUrl, altText, onOpenLightbox }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(imageUrl);

  React.useEffect(() => {
    setCurrentUrl(imageUrl);
    setIsLoaded(false);
    setHasError(false);
  }, [imageUrl]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoaded(false);
    const separator = currentUrl.includes("?") ? "&" : "?";
    setCurrentUrl(`${currentUrl}${separator}retry=${Date.now()}`);
  };

  return (
    <div className="relative w-full aspect-[16/11] sm:aspect-[4/3] overflow-hidden rounded-[18px] border border-white/10 bg-[#282828] shadow-md select-none group">
      {/* Skeleton loading */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 w-full h-full bg-[#2b2b2b] animate-pulse flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <svg className="w-4 h-4 text-slate-300 animate-spin shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="2.5" r="1.5" />
              <circle cx="13.5" cy="8" r="1.5" />
              <circle cx="8" cy="13.5" r="1.5" />
              <circle cx="2.5" cy="8" r="1.5" />
            </svg>
            <span className="animate-pulse">Loading...</span>
          </div>
        </div>
      )}

      <img
        src={currentUrl}
        alt={altText}
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        onClick={() => isLoaded && onOpenLightbox && onOpenLightbox(currentUrl)}
        className={`w-full h-full object-cover transition-all duration-300 cursor-pointer ${
          isLoaded
            ? "opacity-100 scale-100 group-hover:scale-105"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        loading="eager"
      />

      {hasError && (
        <div className="absolute inset-0 w-full h-full p-3 text-center text-xs bg-[#282828] rounded-[20px] border border-red-500/20 flex flex-col items-center justify-center gap-2">
          <p className="font-medium text-red-400 text-xs">Failed to load image</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              className="px-2.5 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 underline hover:text-blue-300 font-medium"
            >
              Link
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  images = [],
  artifacts = [],
  fileName = null,
  fileType = null,
  filePreviewUrl = null,
  onOpenArtifact,
  onRegenerate,
  isLoading = false,
  loadingType = "chat",
  isImageLoading = false,
}) {
  const dispatch = useDispatch();
  const isUser = role === "user";
  const [copiedText, setCopiedText] = useState(false);
  const [copiedCodeStr, setCopiedCodeStr] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lightBox, setLightBox] = useState(null);

  // Extract all images and clean content so images appear FIRST at top of bubble
  const { cleanText, allImages } = useMemo(() => {
    const extracted = [];
    const seenUrls = new Set();
    const text = content || "";

    // 1. Process explicit images array prop if present
    if (Array.isArray(images) && images.length > 0) {
      images.forEach((img, idx) => {
        const src = typeof img === "string" ? img : img?.url || img?.src;
        if (src && !seenUrls.has(src)) {
          seenUrls.add(src);
          extracted.push({ url: src, alt: `Image ${idx + 1}` });
        }
      });
    }

    // 2. Extract markdown image links ![alt](url) or [Image: alt](url) from text
    const mediaRegex = /!?\[(?:Image:|Photo:)?\s*(.*?)\]\((.*?)\)/gi;
    let match;
    while ((match = mediaRegex.exec(text)) !== null) {
      const altText = match[1] || "Image";
      const url = match[2];
      const isDirectImage =
        match[0].startsWith("!") ||
        /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url) ||
        /pollinations\.ai|unsplash\.com|imgur\.com|media\.giphy\.com/i.test(url);

      if (isDirectImage && url && !seenUrls.has(url)) {
        seenUrls.add(url);
        extracted.push({ url, alt: altText });
      }
    }

    // 3. Remove extracted markdown images from main text content
    const clean = text
      .replace(mediaRegex, (fullMatch, alt, url) => {
        const isDirectImage =
          fullMatch.startsWith("!") ||
          /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(url) ||
          /pollinations\.ai|unsplash\.com|imgur\.com|media\.giphy\.com/i.test(url);
        return isDirectImage ? "" : fullMatch;
      })
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();

    return { cleanText: clean, allImages: extracted };
  }, [content, images]);

  const hasArtifacts = Array.isArray(artifacts) && artifacts.length > 0;

  // Determine if this message is an Image, PDF, or PPT response so we hide the copy button
  const hasArtifactPpt = Array.isArray(artifacts) && artifacts.some(
    (art) => art?.type === "ppt" || art?.title?.endsWith(".pptx")
  );
  const hasArtifactPdf = Array.isArray(artifacts) && artifacts.some(
    (art) => art?.type === "pdf" || art?.title?.endsWith(".pdf")
  );
  const hasImages = Array.isArray(allImages) && allImages.length > 0;
  const isImageOrDoc = hasImages || hasArtifactPpt || hasArtifactPdf;

  const shouldShowCopy =
    Boolean(cleanText && cleanText.trim().length > 0) && !isImageOrDoc;

  // If not loading and has no content, images, or artifacts, do not render empty bubble
  if (!isLoading && !cleanText && allImages.length === 0 && !hasArtifacts) {
    return null;
  }

  const copyToClipboardSafe = async (textToCopy) => {
    if (!textToCopy) return false;
    // Method 1: Modern Async Clipboard API
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        return true;
      } catch (err) {
        console.warn("Async clipboard failed, attempting legacy execCommand fallback:", err);
      }
    }

    // Method 2: Universal document.execCommand fallback (works on HTTP and all browsers)
    try {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error("Fallback execCommand copy failed:", fallbackErr);
      return false;
    }
  };

  const handleCopyText = async () => {
    const textToCopy = cleanText || content || "";
    if (!textToCopy) return;
    const ok = await copyToClipboardSafe(textToCopy);
    if (ok !== false) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handleCopyCode = async (codeStr) => {
    if (!codeStr) return;
    const ok = await copyToClipboardSafe(codeStr);
    if (ok !== false) {
      setCopiedCodeStr(codeStr);
      setTimeout(() => setCopiedCodeStr(null), 2000);
    }
  };

  // Authentic ChatGPT-style Loading Animations
  if (isLoading) {
    const type = isImageLoading ? "image" : loadingType;

    // 1. PDF / Document Generation (ChatGPT Style)
    if (type === "pdf") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full justify-start my-3 select-none"
        >
          <div className="max-w-md w-full bg-[#282828] border border-white/[0.08] rounded-2xl p-4 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3 text-xs font-medium text-slate-300">
                <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />
                <span>Generating document...</span>
              </div>
              <div className="space-y-2 p-3 bg-black/20 rounded-xl border border-white/5">
                <div className="h-2.5 bg-white/10 rounded-full w-3/4 animate-pulse" />
                <div className="h-2 bg-white/5 rounded-full w-full animate-pulse [animation-delay:0.15s]" />
                <div className="h-2 bg-white/5 rounded-full w-4/5 animate-pulse [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // 2. PPT Presentation Generation (ChatGPT Style)
    if (type === "ppt") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full justify-start my-3 select-none"
        >
          <div className="max-w-md w-full bg-[#282828] border border-white/[0.08] rounded-2xl p-4 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3 text-xs font-medium text-slate-300">
                <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />
                <span>Designing presentation...</span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2 bg-black/20 rounded-xl border border-white/5">
                <div className="aspect-[4/3] bg-white/10 rounded-lg animate-pulse" />
                <div className="aspect-[4/3] bg-white/5 rounded-lg animate-pulse [animation-delay:0.15s]" />
                <div className="aspect-[4/3] bg-white/5 rounded-lg animate-pulse [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // 3. Image Generation / Vision Analysis (ChatGPT DALL·E Style)
    if (type === "image" || type === "imageAnalyzer") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full justify-start my-3 select-none"
        >
          <div className="max-w-lg w-full">
            {/* ChatGPT Header */}
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-300">
              <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />
              <span>
                {type === "imageAnalyzer" ? "Analyzing image..." : "Creating image..."}
              </span>
            </div>

            {/* ChatGPT Minimal Dark Shimmer Canvas */}
            <div className="w-full aspect-[16/11] sm:aspect-[4/3] bg-[#282828] border border-white/[0.08] rounded-2xl overflow-hidden relative shadow-lg flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer pointer-events-none" />
              <div className="flex flex-col items-center gap-2 text-slate-500 z-10">
                <ImageIcon size={26} className="opacity-25" />
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // 4. Code Generation (ChatGPT Style)
    if (type === "coding") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full justify-start my-3 select-none"
        >
          <div className="max-w-md w-full bg-[#282828] border border-white/[0.08] rounded-2xl p-4 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3 text-xs font-medium text-slate-300">
                <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />
                <span>Writing code...</span>
              </div>
              <div className="space-y-1.5 p-3 bg-black/30 rounded-xl border border-white/5 font-mono text-[11px]">
                <div className="h-2 bg-white/15 rounded w-1/3 animate-pulse" />
                <div className="h-2 bg-white/5 rounded w-4/5 animate-pulse [animation-delay:0.1s]" />
                <div className="h-2 bg-white/5 rounded w-2/3 animate-pulse [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // 5. Web Search (ChatGPT Style)
    if (type === "search") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full justify-start my-3 select-none"
        >
          <div className="max-w-md w-full bg-[#282828] border border-white/[0.08] rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
                <Globe size={15} className="animate-spin [animation-duration:3s]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-slate-200">Searching web...</span>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Gathering live facts & references
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // 6. Default Chat (Clean ChatGPT 3-Dot Bounce)
    return (
      <div className="flex w-full justify-start my-3 select-none">
        <div className="flex items-center gap-2 py-2 px-3 bg-[#282828] border border-white/[0.08] rounded-2xl">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.32s]" />
            <div className="h-2 w-2 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.16s]" />
            <div className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" />
          </div>
          <span className="text-xs font-medium text-slate-400">Thinking...</span>
        </div>
      </div>
    );
  }

  if (isUser) {
    const isImageFile = fileType?.startsWith("image/");
    return (
      <div className="flex w-full flex-col items-end my-4 gap-2">
        {/* Attachment preview shown ABOVE the prompt text */}
        {(filePreviewUrl || fileName) && (
          isImageFile && filePreviewUrl ? (
            <motion.img
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              src={filePreviewUrl}
              alt={fileName || "attachment"}
              className="max-w-[240px] max-h-[240px] rounded-2xl border border-white/10 object-cover shadow-sm"
            />
          ) : filePreviewUrl ? (
            <a
              href={filePreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#262628] px-4 py-2.5 shadow-sm transition-colors hover:bg-[#323236]"
            >
              <FileText size={18} className="text-red-400 shrink-0" />
              <span className="truncate text-sm text-slate-200 max-w-[220px]">
                {fileName || "Attached file"}
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#262628] px-4 py-2.5 shadow-sm">
              <FileText size={18} className="text-red-400 shrink-0" />
              <span className="truncate text-sm text-slate-200 max-w-[220px]">
                {fileName || "Attached file"}
              </span>
            </div>
          )
        )}

        {content && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-[88%] sm:max-w-xl rounded-2xl sm:rounded-3xl bg-[#262628] border border-white/[0.08] px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-[15px] leading-relaxed text-white font-normal shadow-sm select-text"
          >
            {content}
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-full justify-start my-3 sm:my-4"
    >
      <div className="max-w-3xl flex-1 text-sm sm:text-[15px] leading-relaxed sm:leading-7 text-slate-100 select-text min-w-0">
        {/* 1. Images Gallery FIRST in a 4-column horizontal grid */}
        {allImages.length > 0 && (
          <div
            className={`grid gap-2.5 mb-4 w-full ${
              allImages.length === 1
                ? "grid-cols-1 max-w-md"
                : allImages.length === 2
                ? "grid-cols-2 max-w-xl"
                : "grid-cols-2 sm:grid-cols-4 max-w-3xl"
            }`}
          >
            {allImages.map((img, idx) => (
              <ImageCard
                key={idx}
                imageUrl={img.url}
                altText={img.alt || `Image ${idx + 1}`}
                onOpenLightbox={setLightBox}
              />
            ))}
          </div>
        )}

        {/* 2. Interactive Artifact Card (Single) */}
        {hasArtifacts && (
          <div className="mb-4 space-y-2 select-none">
            {artifacts.map((art, idx) => {
              const fileCount = Array.isArray(art?.files) ? art.files.length : 0;
              const isPpt = art?.type === "ppt" || art?.title?.endsWith(".pptx");
              const isPdf = art?.type === "pdf" || art?.title?.endsWith(".pdf");

              return (
                <motion.div
                  key={art.id || idx}
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (onOpenArtifact) onOpenArtifact(art);
                    dispatch(openArtifact(art));
                  }}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-white/10 bg-[#282828] hover:bg-[#303030] hover:border-white/20 transition-all cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                      {isPpt ? (
                        <Presentation size={20} />
                      ) : isPdf ? (
                        <FileText size={20} />
                      ) : (
                        <FileCode2 size={20} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white group-hover:text-emerald-300 transition-colors truncate">
                        {art.title || "Generated Code Project"}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {isPpt
                          ? "PowerPoint Presentation"
                          : isPdf
                          ? "PDF Document"
                          : `${fileCount} ${fileCount === 1 ? "file" : "files"} included`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-medium text-white group-hover:bg-emerald-500 group-hover:text-black transition-colors shrink-0 ml-3">
                    <span>{isPpt ? "View Slides" : isPdf ? "View PDF" : "View Code"}</span>
                    <ChevronRight size={14} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* 2. Render AI text content SECOND using react-markdown, remark-gfm, and react-syntax-highlighter */}
        {cleanText && (
          <div className="markdown-content text-slate-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const language = match ? match[1] : "text";
                  const codeString = String(children).replace(/\n$/, "");

                  if (!inline && (match || codeString.includes("\n"))) {
                    return (
                      <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] font-mono text-xs shadow-md">
                        <div className="flex items-center justify-between bg-[#2d2d2d] px-4 py-1.5 text-slate-400 border-b border-white/5 select-none">
                          <span className="text-xs uppercase font-sans font-medium">
                            {language}
                          </span>
                          <button
                            onClick={() => handleCopyCode(codeString)}
                            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedCodeStr === codeString ? (
                              <>
                                <Check size={13} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copy code</span>
                              </>
                            )}
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={language}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            padding: "1rem",
                            background: "#1e1e1e",
                            fontSize: "0.85rem",
                            lineHeight: "1.6",
                          }}
                          {...props}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return (
                    <code
                      className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-emerald-300"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                table({ children }) {
                  return (
                    <div className="my-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#1e1e1e] shadow-xl">
                      <table className="w-full text-left text-sm text-slate-200 border-collapse">
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children }) {
                  return (
                    <thead className="bg-[#282828] text-xs font-semibold tracking-wider text-slate-200 border-b border-white/10 uppercase">
                      {children}
                    </thead>
                  );
                },
                tbody({ children }) {
                  return (
                    <tbody className="divide-y divide-white/5 bg-[#181818]">
                      {children}
                    </tbody>
                  );
                },
                tr({ children }) {
                  return (
                    <tr className="hover:bg-white/[0.04] transition-colors">
                      {children}
                    </tr>
                  );
                },
                th({ children }) {
                  return (
                    <th className="px-4 py-3.5 border-r last:border-r-0 border-white/10 font-semibold">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="px-4 py-3 border-r last:border-r-0 border-white/5 font-normal">
                      {children}
                    </td>
                  );
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline hover:text-blue-300 font-medium inline-flex items-center gap-1"
                    >
                      {children}
                    </a>
                  );
                },
                h1({ children }) {
                  return (
                    <h1 className="text-xl font-bold text-white mt-4 mb-2">
                      {children}
                    </h1>
                  );
                },
                h2({ children }) {
                  return (
                    <h2 className="text-lg font-semibold text-white mt-4 mb-1.5">
                      {children}
                    </h2>
                  );
                },
                h3({ children }) {
                  return (
                    <h3 className="text-base font-semibold text-white mt-3 mb-1">
                      {children}
                    </h3>
                  );
                },
                ul({ children }) {
                  return (
                    <ul className="list-disc list-inside space-y-1 my-2 pl-2">
                      {children}
                    </ul>
                  );
                },
                ol({ children }) {
                  return (
                    <ol className="list-decimal list-inside space-y-1 my-2 pl-2">
                      {children}
                    </ol>
                  );
                },
                li({ children }) {
                  return <li className="text-slate-100">{children}</li>;
                },
                p({ children }) {
                  return (
                    <p className="mb-2.5 leading-relaxed last:mb-0">
                      {children}
                    </p>
                  );
                },
                strong({ children }) {
                  return (
                    <strong className="font-semibold text-white">
                      {children}
                    </strong>
                  );
                },
              }}
            >
              {cleanText}
            </ReactMarkdown>
          </div>
        )}

        {/* Clean Action Bar: Copy Only (Hidden on Image, PDF, and PPT responses) */}
        {shouldShowCopy && (
          <div className="flex items-center gap-2 mt-3 text-slate-400">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleCopyText}
              title="Copy"
              className="flex h-7 items-center gap-1.5 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/10 hover:text-white border border-white/5 transition-colors cursor-pointer text-xs font-normal"
            >
              {copiedText ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </motion.button>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightBox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setLightBox(null)}
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 rounded-full p-2 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setLightBox(null);
              }}
            >
              <X size={20} />
            </motion.button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={lightBox}
              alt="Enlarged view"
              onClick={(e) => e.stopPropagation()}
              className="max-w-[90vw] max-h-[85vh] rounded-2xl border border-white/10 shadow-2xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
