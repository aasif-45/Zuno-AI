import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { PanelLeft, SquarePen } from "lucide-react";
import { setMobileSidebarOpen, setSelectedConversation } from "../redux/conversationSlice.js";
import { clearMessages } from "../redux/messageSlice.js";
import AnimatedTitle from "./AnimatedTitle.jsx";

export default function Nav() {
  const dispatch = useDispatch();
  const { selectedConversation } = useSelector((state) => state.conversation);

  const handleMobileNewChat = () => {
    dispatch(setSelectedConversation(null));
    dispatch(clearMessages());
    localStorage.removeItem("lastConvId");
    if (window.location.pathname !== "/" && window.location.pathname !== "") {
      window.history.pushState(null, "", "/");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-[#212121]/90 backdrop-blur-md px-3 sm:px-4 select-none shrink-0">
      {/* Left: Mobile Menu Button + Brand Title */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={() => dispatch(setMobileSidebarOpen(true))}
          title="Open sidebar"
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <PanelLeft size={20} />
        </button>

        <span className="text-base font-semibold text-white tracking-tight shrink-0">
          Zuno AI
        </span>
      </div>

      {/* Center: Conversation Title */}
      <div className="max-w-[160px] sm:max-w-xs truncate text-center text-xs font-medium text-slate-400">
        <AnimatedTitle text={selectedConversation?.title || "New Chat"} />
      </div>

      {/* Right: Mobile New Chat / Desktop Spacer */}
      <div className="flex items-center justify-end w-9 sm:w-16">
        <button
          onClick={handleMobileNewChat}
          title="New chat"
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <SquarePen size={19} />
        </button>
      </div>
    </header>
  );
}
