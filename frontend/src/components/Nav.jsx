import React from "react";
import { useSelector } from "react-redux";
import AnimatedTitle from "./AnimatedTitle.jsx";

export default function Nav() {
  const { selectedConversation } = useSelector((state) => state.conversation);

  if (!selectedConversation) return null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-[#212121]/90 backdrop-blur-md px-4 select-none">
      {/* Left: Clean Brand Title */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="text-base font-semibold text-white tracking-tight">MY-AI</span>
      </div>

      {/* Center: Conversation Title */}
      <div className="hidden md:block max-w-xs truncate text-center text-xs font-medium text-slate-400">
        <AnimatedTitle text={selectedConversation.title || "New Chat"} />
      </div>

      {/* Right spacer to keep title perfectly centered */}
      <div className="w-16" />
    </header>
  );
}
