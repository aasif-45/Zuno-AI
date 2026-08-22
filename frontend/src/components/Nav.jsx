import React, { useState, useEffect } from "react";
import { ChevronDown, Share2, MoreHorizontal, Sparkles, Check, Zap, Brain } from "lucide-react";
import { useSelector } from "react-redux";

import AnimatedTitle from "./AnimatedTitle.jsx";

export default function Nav() {
  const { selectedConversation } = useSelector((state) => state.conversation);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("MY-AI 4o");

  useEffect(() => {
    const handleOutsideClick = () => setModelMenuOpen(false);
    if (modelMenuOpen) {
      window.addEventListener("click", handleOutsideClick);
    }
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [modelMenuOpen]);

  if (!selectedConversation) return null;

  const models = [
    {
      id: "MY-AI 4o",
      name: "MY-AI 4o",
      desc: "Great for everyday tasks",
      icon: Sparkles,
    },
    {
      id: "MY-AI o1",
      name: "MY-AI o1",
      desc: "Uses advanced reasoning & code",
      icon: Brain,
    },
    {
      id: "MY-AI Mini",
      name: "MY-AI Mini",
      desc: "Fast & lightweight responses",
      icon: Zap,
    },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-[#212121]/90 backdrop-blur-md px-4 select-none">
      {/* Left: Model Selector Dropdown Button (ChatGPT Desktop Style) */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setModelMenuOpen(!modelMenuOpen);
          }}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-lg font-semibold text-slate-100 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <span>{selectedModel}</span>
          <ChevronDown size={16} className="text-slate-400 mt-0.5" />
        </button>

        {/* Dropdown Menu */}
        {modelMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-12 z-50 w-72 rounded-2xl bg-[#2f2f2f] p-2 text-white shadow-2xl border border-white/10 select-none animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Model Options
            </div>

            <div className="space-y-1 mt-1">
              {models.map((m) => {
                const IconComponent = m.icon;
                const isSelected = selectedModel === m.id;

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setModelMenuOpen(false);
                    }}
                    className={`flex items-start justify-between rounded-xl p-2.5 cursor-pointer transition-colors ${isSelected ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white">
                        <IconComponent size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">{m.name}</span>
                        <span className="text-xs text-slate-400">{m.desc}</span>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="text-white mt-1 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
