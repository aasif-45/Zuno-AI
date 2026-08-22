import React from "react";
import { Share2, MoreHorizontal } from "lucide-react";
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

      {/* Center: Conversation Title (Optional subtitle display) */}
      <div className="hidden md:block max-w-xs truncate text-center text-xs font-medium text-slate-400">
        <AnimatedTitle text={selectedConversation.title || "New Chat"} />
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-1 text-slate-400">
        <button
          title="Share"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <Share2 size={18} />
        </button>

        <button
          title="More options"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
    </header>
  );
}
