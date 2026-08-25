import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Settings,
  Shield,
  Volume2,
  Info,
  Check,
  Download,
  Trash2,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { setConversation } from "../redux/conversationSlice";

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState("dark");
  const [language, setLanguage] = useState("en");
  const [soundEffects, setSoundEffects] = useState(true);
  const [clearedSuccess, setClearedSuccess] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  const { conversations } = useSelector((state) => state.conversation || {});
  const dispatch = useDispatch();

  // Prevent background page scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conversations, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `zuno_ai_conversations_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportedSuccess(true);
      setTimeout(() => setExportedSuccess(false), 3000);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  const handleClearAllChats = () => {
    if (window.confirm("Are you sure you want to clear all conversation history? This cannot be undone.")) {
      dispatch(setConversation([]));
      localStorage.removeItem("lastConvId");
      setClearedSuccess(true);
      setTimeout(() => setClearedSuccess(false), 3000);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "data", label: "Data Controls", icon: Shield },
    { id: "speech", label: "Speech & Audio", icon: Volume2 },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Window: Mobile Bottom-Sheet / Desktop Centered Card */}
        <motion.div
          initial={{ y: "100%", opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.9 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative w-full max-w-none md:max-w-2xl md:mx-auto overflow-hidden rounded-t-3xl md:rounded-3xl bg-[#14161f] border border-white/10 text-white shadow-2xl flex flex-col md:flex-row h-[92dvh] max-h-[95vh] md:h-auto md:min-h-[480px] md:max-h-[85vh] select-none"
        >
          {/* Close Button (Desktop overlay) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 hidden md:flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>

          {/* Fixed Mobile Header */}
          <div className="flex md:hidden items-center justify-between border-b border-white/10 px-4 py-3.5 shrink-0 bg-[#0f1118] z-20">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-200">
                <Settings size={17} />
              </div>
              <span className="text-base font-semibold text-white tracking-tight">Settings</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs: Horizontally Scrollable on Mobile / Left Vertical Sidebar on Desktop */}
          <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-white/10 px-4 py-2.5 md:p-3 bg-[#0f1118] flex md:flex-col gap-1.5 shrink-0 overflow-x-auto md:overflow-x-visible no-scrollbar [scrollbar-width:none]">
            <div className="hidden md:flex items-center gap-2 px-3 py-3 mb-2">
              <Settings size={18} className="text-slate-300" />
              <span className="text-sm font-semibold text-white">Settings</span>
            </div>

            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 md:py-2.5 rounded-xl text-xs sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[40px] md:min-h-[42px] shrink-0 touch-manipulation ${
                    isActive
                      ? "bg-white/15 text-white shadow-sm border border-white/10 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <Icon size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scrollable Content Pane */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-6 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
              {/* GENERAL TAB */}
              {activeTab === "general" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold text-white">General Settings</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Customize your interface preferences</p>
                  </div>

                  <div className="divide-y divide-white/5 space-y-4">
                    {/* Theme */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Theme</div>
                        <div className="text-xs text-slate-400">Select application color mode</div>
                      </div>
                      <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="w-full sm:w-auto min-h-[44px] bg-[#2a2a2a] border border-white/10 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-emerald-500 cursor-pointer touch-manipulation"
                      >
                        <option value="dark">Dark (Default)</option>
                        <option value="system">System Synchronized</option>
                      </select>
                    </div>

                    {/* Language */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Language</div>
                        <div className="text-xs text-slate-400">Interface and response language</div>
                      </div>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full sm:w-auto min-h-[44px] bg-[#2a2a2a] border border-white/10 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-emerald-500 cursor-pointer touch-manipulation"
                      >
                        <option value="en">English (US)</option>
                        <option value="auto">Auto-detect</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="hi">हिन्दी (Hindi)</option>
                      </select>
                    </div>

                    {/* Model Engine */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Default Model Engine</div>
                        <div className="text-xs text-slate-400">Preferred neural reasoning engine</div>
                      </div>
                      <span className="self-start sm:self-auto text-xs font-mono px-3 py-1.5 rounded-lg bg-white/10 text-emerald-400 border border-white/5">
                        Best Model
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DATA CONTROLS TAB */}
              {activeTab === "data" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold text-white">Data Controls</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Manage your conversations and privacy</p>
                  </div>

                  {clearedSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3"
                    >
                      <Check size={15} /> Conversation history cleared successfully.
                    </motion.div>
                  )}

                  {exportedSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3"
                    >
                      <Check size={15} /> Chat archive exported to JSON file!
                    </motion.div>
                  )}

                  <div className="divide-y divide-white/5 space-y-4">
                    {/* Export */}
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-4">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Export Chat History</div>
                        <div className="text-xs text-slate-400">Download all your chats and code in JSON format</div>
                      </div>
                      <button
                        onClick={handleExportData}
                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer touch-manipulation"
                      >
                        <Download size={15} /> Export
                      </button>
                    </div>

                    {/* Clear All Chats */}
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-4">
                      <div>
                        <div className="text-sm font-medium text-rose-400">Delete All Conversations</div>
                        <div className="text-xs text-slate-400">Permanently remove all previous chat history</div>
                      </div>
                      <button
                        onClick={handleClearAllChats}
                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-xs font-semibold text-rose-400 border border-rose-500/30 transition-colors cursor-pointer touch-manipulation"
                      >
                        <Trash2 size={15} /> Clear All
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SPEECH TAB */}
              {activeTab === "speech" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold text-white">Speech & Audio</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Microphone and speech recognition preferences</p>
                  </div>

                  <div className="divide-y divide-white/5 space-y-4">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-4">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Microphone Input</div>
                        <div className="text-xs text-slate-400">Web Speech API realtime dictation</div>
                      </div>
                      <span className="self-start sm:self-auto text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                        Enabled
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-4">
                      <div>
                        <div className="text-sm font-medium text-slate-200">Interface Sound Effects</div>
                        <div className="text-xs text-slate-400">Subtle audio cues on message completions</div>
                      </div>
                      <button
                        onClick={() => setSoundEffects(!soundEffects)}
                        className={`relative inline-flex h-7 w-12 shrink-0 self-start sm:self-auto items-center rounded-full transition-colors cursor-pointer touch-manipulation ${
                          soundEffects ? "bg-emerald-500" : "bg-white/20"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            soundEffects ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ABOUT TAB */}
              {activeTab === "about" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold text-white">About Zuno AI</h3>
                    <p className="text-xs text-slate-400 mt-0.5">System specifications & agent architecture</p>
                  </div>

                  <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-3.5 text-xs">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-slate-400">Platform Version</span>
                      <span className="text-slate-200 font-mono break-words sm:text-right">v2.4.0 (2026.08 Production)</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-slate-400">Agent Framework</span>
                      <span className="text-slate-200 font-mono break-words sm:text-right">LangGraph StateGraph</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-slate-400">Supported Agents</span>
                      <span className="text-emerald-400 break-words sm:text-right">Chat, Coding, PPT, PDF, Vision, ImageGen, Search</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-slate-400">Infrastructure</span>
                      <span className="text-slate-200 font-mono break-words sm:text-right">AWS ECS Fargate + Cloudflare Workers</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Actions on Mobile */}
            <div className="flex md:hidden items-center justify-end border-t border-white/10 bg-[#0f1118] px-4 py-3 shrink-0 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
              <button
                onClick={onClose}
                className="w-full min-h-[44px] flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer touch-manipulation"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
