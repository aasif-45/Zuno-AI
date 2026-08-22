import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { ArrowDown } from "lucide-react";
import MessageBubble from "./MessageBubble.jsx";

export default function MessageList({ onOpenArtifact }) {
  const { selectedConversation } = useSelector(
    (state) => state.conversation
  );

  const { loading } = useSelector((state) => state.message);
  const rawMessages = useSelector(
    (state) => state.message?.messages || state.message?.message || []
  );

  const listRef = useRef(null);
  const lastUserMsgRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Filter out invalid or empty messages to avoid rendering stray empty bubbles
  const validMessages = useMemo(() => {
    if (!Array.isArray(rawMessages)) return [];
    return rawMessages.filter((msg) => {
      if (!msg || typeof msg !== "object") return false;
      const hasContent = typeof msg.content === "string" && msg.content.trim().length > 0;
      const hasImages = Array.isArray(msg.images) && msg.images.length > 0;
      const hasArtifacts = Array.isArray(msg.artifacts) && msg.artifacts.length > 0;
      const hasAttachment = Boolean(msg.filePreviewUrl || msg.fileName);
      return hasContent || hasImages || hasArtifacts || hasAttachment;
    });
  }, [rawMessages]);

  // Find index of the latest user message
  const lastUserIndex = useMemo(() => {
    for (let i = validMessages.length - 1; i >= 0; i--) {
      if (validMessages[i]?.role === "user") return i;
    }
    return -1;
  }, [validMessages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  };

  const scrollToPrompt = () => {
    if (lastUserMsgRef.current) {
      lastUserMsgRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      scrollToBottom();
    }
  };

  useEffect(() => {
    scrollToPrompt();
  }, [validMessages.length, loading]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollBottom(isScrolledUp);
  };

  // If valid messages list is empty and not loading, show landing state
  if (!validMessages?.length && !loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#212121]">
        <div className="flex h-full items-center justify-center px-6">
          <div className="max-w-lg text-center select-none">
            {/* Title */}
            <h1 className="mb-3 text-4xl font-semibold tracking-tight text-white font-serif">
              MY AI
            </h1>

            {/* Subtitle */}
            <h2 className="mb-4 text-xl font-medium text-slate-200">
              How can I help you today?
            </h2>

            {/* Description */}
            <p className="mx-auto max-w-md text-[15px] leading-7 text-slate-400">
              Ask me anything — code, debugging, explanations,
              writing, brainstorming, or just a quick question.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {["Write a Netflix clone", "Today News", "Build a dashboard"].map((s, idx) => (
                <button
                  key={idx}
                  className="text-xs text-slate-300 bg-white/[0.05] border border-white/10 px-3.5 py-2 rounded-xl hover:bg-white/10 hover:text-white transition-all duration-150 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="relative flex-1 overflow-y-auto bg-[#212121] px-6 py-6 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]"
    >
      <div className="mx-auto max-w-3xl space-y-4 pb-4">
        {validMessages.map((msg, idx) => {
          const isLatestUser = idx === lastUserIndex;
          return (
            <div
              key={msg._id || msg.id || idx}
              ref={isLatestUser ? lastUserMsgRef : null}
              className="scroll-mt-4"
            >
              <MessageBubble
                role={msg?.role}
                content={msg?.content}
                images={msg?.images}
                artifacts={msg?.artifacts}
                fileName={msg?.fileName}
                fileType={msg?.fileType}
                filePreviewUrl={msg?.filePreviewUrl}
                onOpenArtifact={onOpenArtifact}
              />
            </div>
          );
        })}

        {/* Specialized Loading Animations for all Agents (PDF, PPT, Image, Code, Search, Chat) */}
        {loading && (() => {
          const lastMsg = validMessages.length > 0 ? validMessages[validMessages.length - 1] : null;
          const lastText = (lastMsg?.content || "").toLowerCase();
          const fileType = lastMsg?.fileType || "";
          const fileName = (lastMsg?.fileName || "").toLowerCase();

          let type = "chat";
          if (fileType === "application/pdf" || fileName.endsWith(".pdf") || /\b(pdf|document|summarize pdf|create pdf)\b/i.test(lastText)) {
            type = "pdf";
          } else if (/\b(ppt|presentation|powerpoint|slides|slide deck)\b/i.test(lastText)) {
            type = "ppt";
          } else if (fileType.startsWith("image/") || /\.(jpeg|jpg|png|webp|gif)$/i.test(fileName)) {
            type = "imageAnalyzer";
          } else if (/\b(image|draw|picture|photo|logo|generate image|create image|render image|wallpaper)\b/i.test(lastText)) {
            type = "image";
          } else if (/\b(code|coding|function|component|debug|algorithm|python|javascript|react|html|css|sql|script)\b/i.test(lastText)) {
            type = "coding";
          } else if (/\b(search|news|weather|price|who is|latest|current date|today)\b/i.test(lastText)) {
            type = "search";
          }

          return (
            <MessageBubble
              role="assistant"
              isLoading={true}
              loadingType={type}
            />
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-To-Bottom Arrow Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-8 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#2f2f2f] text-slate-200 shadow-2xl hover:bg-[#3a3a3a] hover:text-white transition-all cursor-pointer"
          title="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}