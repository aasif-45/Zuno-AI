import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ArrowDown } from "lucide-react";
import MessageBubble from "./MessageBubble.jsx";
import sendMessage from "../features/sendMessage.js";
import { addMessage, setLoading } from "../redux/messageSlice.js";
import { getCurrentuser } from "../features/getCurrentUser.js";
import { setUserData } from "../redux/userSlice.js";

export default function MessageList({ onOpenArtifact }) {
  const dispatch = useDispatch();
  const { selectedConversation, conversationsLoading } = useSelector(
    (state) => state.conversation
  );

  const { loading, isFetchingMessages } = useSelector((state) => state.message);
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

  const handleRegenerate = async (msgIndex) => {
    if (loading) return;

    // Find the user prompt for this turn (preceding user message)
    let promptMsg = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (validMessages[i]?.role === "user") {
        promptMsg = validMessages[i];
        break;
      }
    }
    if (!promptMsg?.content) return;

    const convId = selectedConversation?._id;
    if (!convId) return;

    dispatch(setLoading(true));
    try {
      const data = await sendMessage({
        prompt: promptMsg.content,
        conversationId: convId,
      });
      if (data?.data) {
        dispatch(addMessage(data.data));
      }
      try {
        const u = await getCurrentuser();
        if (u) dispatch(setUserData(u));
      } catch (_) {}
    } catch (e) {
      console.error("Regenerate failed:", e);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (validMessages.length > 0) {
      setTimeout(() => scrollToPrompt(), 60);
    }
  }, [validMessages.length]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 150);
  };

  // If messages or conversation are actively being fetched/restored, show clean placeholder to prevent "New Chat" flash
  if (isFetchingMessages || (selectedConversation?._id && !validMessages.length && conversationsLoading)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#171717]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-slate-600 border-t-emerald-400 animate-spin" />
        </div>
      </div>
    );
  }

  // If valid messages list is empty and not loading, show landing state
  if (!validMessages?.length && !loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#171717]">
        <div className="flex h-full items-center justify-center px-4 sm:px-6">
          <div className="max-w-lg text-center select-none">
            {/* Logo Emblem & Title */}
            <div className="flex flex-col items-center justify-center mb-3">
              <img
                src="/zuno-icon.png"
                alt="Zuno AI Logo"
                className="h-14 w-14 sm:h-16 sm:w-16 mb-2 object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]"
              />
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-sans">
                Zuno AI
              </h1>
            </div>

            {/* Subtitle */}
            <h2 className="mb-4 text-lg sm:text-xl font-medium text-slate-200">
              How can I help you today?
            </h2>

            {/* Description */}
            <p className="mx-auto max-w-md text-sm sm:text-[15px] leading-6 sm:leading-7 text-slate-400">
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
      className="relative flex-1 overflow-y-auto overscroll-contain bg-[#171717] px-3 sm:px-6 py-4 sm:py-6 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]"
    >
      <div className="mx-auto min-w-0 max-w-3xl space-y-4 pb-4">
        {validMessages.map((msg, idx) => {
          const isLatestUser = idx === lastUserIndex;
          const isAssistant = msg?.role === "assistant";
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
                onRegenerate={isAssistant ? () => handleRegenerate(idx) : null}
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
          if (fileType === "application/pdf" || fileName.endsWith(".pdf") || /\b(pdf|downloadable pdf|pdf file|document|summarize pdf|create pdf)\b/i.test(lastText)) {
            type = "pdf";
          } else if (/\b(ppt|presentation|powerpoint|slides|slide deck)\b/i.test(lastText)) {
            type = "ppt";
          } else if (fileType.startsWith("image/") || /\.(jpeg|jpg|png|webp|gif)$/i.test(fileName)) {
            type = "imageAnalyzer";
          } else if (/\b(code|coding|matlab|program|function|component|debug|algorithm|python|javascript|react|html|css|sql|script)\b/i.test(lastText)) {
            type = "coding";
          } else if (
            /\b(generate|create|render|draw|make|paint)\s+(an?\s+)?(image|picture|photo|illustration|logo|wallpaper|drawing|artwork|portrait|banner|avatar)\b/i.test(lastText) ||
            /\b(picture\s+of|photo\s+of|image\s+of|painting\s+of|wallpaper\s+of|artwork\s+of)\b/i.test(lastText) ||
            /^(draw|generate image|create image|paint)\b/i.test(lastText)
          ) {
            type = "image";
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
          className="fixed bottom-28 right-4 sm:bottom-24 sm:right-8 z-30 flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-white/10 bg-[#2f2f2f] text-slate-200 shadow-2xl hover:bg-[#3a3a3a] hover:text-white transition-all cursor-pointer"
          title="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}