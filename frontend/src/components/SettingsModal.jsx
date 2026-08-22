import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Settings,
  Moon,
  Globe,
  Trash2,
  Download,
  Shield,
  Volume2,
  Info,
  Check,
  Cpu,
  Layers,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { setConversation } from "../redux/conversationSlice";

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState("dark");
  const [language, setLanguage] = useState("en");
  const [soundEffects, setSoundEffects] = useState(true);
  const [streamSpeed, setStreamSpeed] = useState("normal");
  const [clearedSuccess, setClearedSuccess] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  const { conversations } = useSelector((state) => state.conversation || {});
  const dispatch = useDispatch();

  if (!isOpen) return null;

  const handleExportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conversations, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `my_ai_conversations_${new Date().toISOString().slice(0, 10)}.json`);
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", duration: 0.25 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#1e1e1e] border border-white/10 text-white shadow-2xl flex flex-col md:flex-row min-h-[480px] max-h-[85vh]"
        >
          {/* Close Button Mobile/Global */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-white/10 p-3 bg-[#181818] flex md:flex-col gap-1 shrink-0 overflow-x-auto md:overflow-x-visible">
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
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">General Settings</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Customize your interface preferences</p>
                </div>

                <div className="divide-y divide-white/5 space-y-4">
                  {/* Theme */}
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Theme</div>
                      <div className="text-xs text-slate-400">Select application color mode</div>
                    </div>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="bg-[#2a2a2a] border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="dark">Dark (ChatGPT Default)</option>
                      <option value="system">System Synchronized</option>
                    </select>
                  </div>

                  {/* Language */}
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Language</div>
                      <div className="text-xs text-slate-400">Interface and response language</div>
                    </div>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="bg-[#2a2a2a] border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500 cursor-pointer"
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
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Default Model Engine</div>
                      <div className="text-xs text-slate-400">Preferred neural reasoning engine</div>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-white/10 text-emerald-400 border border-white/5">
                      Auto Router (Multi-Agent)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* DATA CONTROLS TAB */}
            {activeTab === "data" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Data Controls</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Manage your conversations and privacy</p>
                </div>

                {clearedSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5"
                  >
                    <Check size={14} /> Conversation history cleared successfully.
                  </motion.div>
                )}

                {exportedSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5"
                  >
                    <Check size={14} /> Chat archive exported to JSON file!
                  </motion.div>
                )}

                <div className="divide-y divide-white/5 space-y-4">
                  {/* Export */}
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Export Chat History</div>
                      <div className="text-xs text-slate-400">Download all your chats and code in JSON format</div>
                    </div>
                    <button
                      onClick={handleExportData}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      <Download size={14} /> Export
                    </button>
                  </div>

                  {/* Clear All Chats */}
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-medium text-rose-400">Delete All Conversations</div>
                      <div className="text-xs text-slate-400">Permanently remove all previous chat history</div>
                    </div>
                    <button
                      onClick={handleClearAllChats}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-medium text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} /> Clear All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SPEECH TAB */}
            {activeTab === "speech" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Speech & Audio</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Microphone and speech recognition preferences</p>
                </div>

                <div className="divide-y divide-white/5 space-y-4">
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Microphone Input</div>
                      <div className="text-xs text-slate-400">Web Speech API realtime dictation</div>
                    </div>
                    <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                      Enabled
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Interface Sound Effects</div>
                      <div className="text-xs text-slate-400">Subtle audio cues on message completions</div>
                    </div>
                    <button
                      onClick={() => setSoundEffects(!soundEffects)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        soundEffects ? "bg-emerald-500" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">About MY AI</h3>
                  <p className="text-xs text-slate-400 mt-0.5">System specifications & agent architecture</p>
                </div>

                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Platform Version</span>
                    <span className="text-slate-200 font-mono">v2.4.0 (2026.08 Production)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Agent Framework</span>
                    <span className="text-slate-200 font-mono">LangGraph StateGraph</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Supported Agents</span>
                    <span className="text-emerald-400">Chat, Coding, PPT, PDF, Vision, ImageGen, Search</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Infrastructure</span>
                    <span className="text-slate-200 font-mono">AWS ECS Fargate + Cloudflare Workers</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
