import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUp,
  Paperclip,
  Mic,
  Zap,
  MessageSquare,
  Globe,
  Code2,
  FileText,
  Presentation,
  Image,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { getCurrentuser } from "../features/getCurrentUser";
import { setUserData } from "../redux/userSlice";

import sendMessage from "../features/sendMessage";
import { createConversation } from "../features/createConversation";
import {
  addConversation,
  updateConversation,
  setSelectedConversation,
} from "../redux/conversationSlice";
import {
  addMessage,
  setLoading,
} from "../redux/messageSlice";


const AGENTS = [
  {
    id: "auto",
    icon: Zap,
    label: "Auto",
    description: "Automatically choose the best AI for your task.",
    color: "text-yellow-400",
  },
  {
    id: "chat",
    icon: MessageSquare,
    label: "General Chat",
    description: "Answer questions, brainstorm ideas, and have conversations.",
    color: "text-blue-400",
  },
  {
    id: "search",
    icon: Globe,
    label: "Web Search",
    description: "Search the real-time web for live news, facts, and latest data.",
    color: "text-cyan-400",
  },
  {
    id: "coding",
    icon: Code2,
    label: "Code",
    description: "Write, debug, explain, and optimize code.",
    color: "text-green-400",
  },
  {
    id: "pdf",
    icon: FileText,
    label: "PDF",
    description: "Read, summarize, analyze, and answer questions from PDFs.",
    color: "text-red-400",
  },
  {
    id: "ppt",
    icon: Presentation,
    label: "Presentation",
    description: "Create slides, outlines, and presentation content.",
    color: "text-orange-400",
  },
  {
    id: "image",
    icon: Image,
    label: "Image",
    description: "Generate, edit, and analyze images.",
    color: "text-purple-400",
  },
];

export default function ChatInput() {
  const dispatch = useDispatch();
  const { selectedConversation } = useSelector((state) => state.conversation);
  const { loading } = useSelector((state) => state.message);

  const [message, setMessage] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("auto");
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);

  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentAgent = AGENTS.find((a) => a.id === selectedAgent) || AGENTS[0];
  const CurrentAgentIcon = currentAgent.icon;

  // Reset agent mode selector to "auto" whenever starting a new chat or switching conversations
  useEffect(() => {
    setSelectedAgent("auto");
    setAgentMenuOpen(false);
  }, [selectedConversation?._id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAgentMenuOpen(false);
      }
    };
    if (agentMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [agentMenuOpen]);

  const handleChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  };

  const resetTextarea = () => {
    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "28px";
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const promptText = message.trim();
    const fileToSend = attachedFile;

    // Allow sending when there is either text OR an attached file.
    if ((!promptText && !fileToSend) || loading) return;

    resetTextarea();
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    let targetConvId = selectedConversation?._id;
    let currentConv = selectedConversation;

    // If no active conversation, auto-create one first
    if (!targetConvId) {
      try {
        const newConv = await createConversation();
        if (newConv?._id) {
          dispatch(addConversation(newConv));
          dispatch(setSelectedConversation(newConv));
          targetConvId = newConv._id;
          currentConv = newConv;
        } else {
          console.error("Could not create new conversation");
          return;
        }
      } catch (err) {
        console.error("Error creating conversation on submit:", err);
        return;
      }
    }

    // Optimistically add user message object to Redux UI state
    const userMsg = {
      _id: Date.now().toString(),
      role: "user",
      content: promptText,
      fileName: fileToSend?.name || null,
      fileType: fileToSend?.type || null,
      // Local object URL so the attachment previews instantly in the chat.
      filePreviewUrl: fileToSend ? URL.createObjectURL(fileToSend) : null,
      conversationId: targetConvId,
    };

    dispatch(addMessage(userMsg));
    dispatch(setLoading(true));

    try {
      const payload = {
        prompt: promptText || "Analyze the attached file.",
        conversationId: targetConvId,
        agent: selectedAgent,
        file: fileToSend,
      };

      const res = await sendMessage(payload);

      // Extract LLM generated ChatGPT-style title if available
      const generatedTitle =
        res?.data?.title || res?.title || res?.data?.data?.title;
      if (generatedTitle) {
        const updatedConv = {
          ...(currentConv || selectedConversation),
          title: generatedTitle,
        };
        dispatch(updateConversation(updatedConv));
        dispatch(setSelectedConversation(updatedConv));
      }

      // Safely extract AI reply content and images from API response
      const aiReplyText =
        res?.data?.aiResponse ||
        res?.aiResponse ||
        res?.data?.data?.aiResponse ||
        res?.data?.content ||
        res?.answer;

      const responseImages =
        res?.images || res?.data?.images || res?.data?.data?.images || [];

      const responseArtifacts =
        res?.artifacts || res?.data?.artifacts || res?.data?.data?.artifacts || [];

      if (aiReplyText || responseImages.length > 0 || responseArtifacts.length > 0) {
        // Add AI assistant response object to Redux UI state
        const aiMsg = {
          _id: (Date.now() + 1).toString(),
          role: "assistant",
          content: aiReplyText || "",
          images: responseImages,
          artifacts: responseArtifacts,
          conversationId: targetConvId,
        };
        dispatch(addMessage(aiMsg));
      }

      // Refresh remaining user credits dynamically in Redux
      try {
        const updatedUser = await getCurrentuser();
        if (updatedUser) {
          dispatch(setUserData(updatedUser));
        }
      } catch (refreshErr) {
        console.warn("Credit refresh warning:", refreshErr);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const isOutOfCredits =
        error?.response?.status === 402 ||
        error?.response?.data?.outOfCredits ||
        error?.response?.data?.message?.includes("credits");

      const errorMessageText = isOutOfCredits
        ? "You have run out of AI credits. Please click 'Upgrade' in the sidebar or account menu to top up your plan!"
        : error?.response?.data?.message || "Failed to generate AI response. Please try again.";

      dispatch(
        addMessage({
          _id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorMessageText,
          conversationId: targetConvId,
        })
      );
    } finally {
      dispatch(setLoading(false));
    }
  };


  return (
    <div className="px-6 pb-5">
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
        <div className="rounded-[28px] border border-white/10 bg-[#2f2f2f] px-5 py-4 shadow-xl">
          {/* Attached file preview chip */}
          {attachedFile && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 w-fit max-w-full">
              {attachedFile.type?.startsWith("image/") ? (
                <Image size={16} className="text-purple-400 shrink-0" />
              ) : (
                <FileText size={16} className="text-red-400 shrink-0" />
              )}
              <span className="truncate text-xs text-gray-200 max-w-[200px]">
                {attachedFile.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
                title="Remove file"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={message}
            onChange={handleChange}
            placeholder="Ask Anything"
            disabled={loading}
            className="
              min-h-[28px]
              max-h-[180px]
              w-full
              resize-none
              overflow-y-auto
              bg-transparent
              text-[15px]
              leading-7
              text-white
              placeholder:text-gray-500
              focus:outline-none
              disabled:opacity-50
              [scrollbar-width:none]
              [&::-webkit-scrollbar]:hidden
            "
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Bottom Toolbar */}
          <div className="mt-3 flex items-center justify-between">
            {/* Left Tools & Agent Selector */}
            <div className="relative flex items-center gap-2" ref={menuRef}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-50"
                title="Attach a PDF or image"
              >
                <Paperclip size={18} />
              </button>

              {/* Hidden native file input (PDF + images only) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const isValidType =
                    file.type === "application/pdf" ||
                    file.type.startsWith("image/");
                  if (!isValidType) {
                    alert("Only PDF and image files are allowed.");
                    e.target.value = "";
                    return;
                  }

                  // Match backend multer limit of 20 MB.
                  if (file.size > 20 * 1024 * 1024) {
                    alert("File is too large. Maximum size is 20 MB.");
                    e.target.value = "";
                    return;
                  }

                  setAttachedFile(file);
                }}
              />

              {/* Agent Selector Button */}
              <button
                type="button"
                onClick={() => setAgentMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-white/10 hover:border-white/20 cursor-pointer"
                title="Select Agent Mode"
              >
                <CurrentAgentIcon size={14} className={currentAgent.color} />
                <span>{currentAgent.label}</span>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform duration-200 ${
                    agentMenuOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>

              {/* Agent Popup Menu */}
              <AnimatePresence>
                {agentMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 rounded-2xl border border-white/10 bg-[#252525] p-2 text-white shadow-2xl z-50 select-none"
                  >
                    <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                      Select Agent Mode
                    </div>
                    <div className="mt-1 space-y-1">
                      {AGENTS.map((agentItem) => {
                        const Icon = agentItem.icon;
                        const isSelected = agentItem.id === selectedAgent;
                        return (
                          <motion.div
                            key={agentItem.id}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedAgent(agentItem.id);
                              setAgentMenuOpen(false);
                            }}
                            className={`flex items-center justify-between rounded-xl p-2.5 transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-white/10 border border-white/10"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                                <Icon size={16} className={agentItem.color} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-white">
                                  {agentItem.label}
                                </span>
                                <span className="text-xs text-gray-400 leading-tight">
                                  {agentItem.description}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                size={16}
                                className="text-white shrink-0 ml-2"
                              />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Tools */}
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
                title="Voice input"
              >
                <Mic size={18} />
              </motion.button>

              <motion.button
                type="submit"
                whileHover={(message.trim() || attachedFile) && !loading ? { scale: 1.08 } : {}}
                whileTap={(message.trim() || attachedFile) && !loading ? { scale: 0.92 } : {}}
                disabled={(!message.trim() && !attachedFile) || loading}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  (message.trim() || attachedFile) && !loading
                    ? "bg-white text-black hover:bg-gray-200 cursor-pointer shadow-md"
                    : "cursor-not-allowed bg-[#3c3c3c] text-gray-500"
                }`}
                title="Send message"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">
          MY-AI can make mistakes. Please verify important information.
        </p>
      </form>
    </div>
  );
}
