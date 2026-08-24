import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUp,
  Paperclip,
  Mic,
  MicOff,
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
  Volume2,
  Shield,
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
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [hasVoicePermission, setHasVoicePermission] = useState(() => {
    try {
      return localStorage.getItem("voice_input_allowed") === "true";
    } catch (_) {
      return false;
    }
  });

  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const baseMessageRef = useRef("");

  const currentAgent = AGENTS.find((a) => a.id === selectedAgent) || AGENTS[0];
  const CurrentAgentIcon = currentAgent.icon;

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

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

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    requestAnimationFrame(adjustTextareaHeight);
  };

  const resetTextarea = () => {
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "28px";
    }
  };

  const startListening = async () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Please try Google Chrome, Microsoft Edge, or Safari."
      );
      return;
    }

    // Explicitly request microphone permission to trigger browser prompt if not already granted
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (mediaErr) {
        console.warn("Microphone permission error:", mediaErr);
        if (
          window.location.protocol !== "https:" &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
        ) {
          setSpeechError(
            "Microphone access blocked. Please click 🔒 / tune icon in address bar -> Site settings -> Set Microphone to 'Allow'."
          );
        } else {
          setSpeechError(
            "Microphone access denied. Click the 🔒/tune icon in your browser address bar and set Microphone to 'Allow'."
          );
        }
        setTimeout(() => setSpeechError(null), 8000);
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";

      baseMessageRef.current = message ? message.trim() + " " : "";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const combined = `${baseMessageRef.current}${finalTranscript}${interimTranscript}`;
        setMessage(combined);

        if (finalTranscript) {
          baseMessageRef.current = `${baseMessageRef.current}${finalTranscript} `;
        }

        requestAnimationFrame(adjustTextareaHeight);
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechError(
            "Microphone access denied. Click the 🔒/tune icon in the address bar and set Microphone to 'Allow'."
          );
          setTimeout(() => setSpeechError(null), 7000);
        } else if (event.error !== "no-speech") {
          setSpeechError(`Speech recognition: ${event.error}`);
          setTimeout(() => setSpeechError(null), 4000);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else if (hasVoicePermission) {
      startListening();
    } else {
      setShowPermissionModal(true);
    }
  };

  const handleAllowPermission = () => {
    try {
      localStorage.setItem("voice_input_allowed", "true");
    } catch (_) {}
    setHasVoicePermission(true);
    setShowPermissionModal(false);
    startListening();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isListening) {
      stopListening();
    }
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
    <div className="px-3 sm:px-6 pb-2.5 sm:pb-5">
      {/* Microphone Permission Modal Popup */}
      <AnimatePresence>
        {showPermissionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPermissionModal(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#252525] p-5 sm:p-6 shadow-2xl z-10 text-white select-none"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Icon & Title */}
              <div className="flex items-center gap-3.5 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 shadow-inner">
                  <Mic size={24} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    Allow Microphone Access?
                  </h3>
                  <p className="text-xs text-gray-400">
                    Enable voice input and speech recognition
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3 text-xs sm:text-sm text-gray-300 mb-5 leading-relaxed">
                <p>
                  Zuno AI uses your microphone to transcribe your voice directly into text in real time so you can speak your prompts effortlessly.
                </p>
                <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3 flex items-start gap-2.5 text-xs text-gray-400">
                  <Shield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Audio is processed directly in your browser using the standard Web Speech API. Audio is not saved or shared.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  Don't Allow
                </button>
                <button
                  type="button"
                  onClick={handleAllowPermission}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-black bg-white hover:bg-gray-200 rounded-xl transition shadow-md cursor-pointer"
                >
                  <Check size={16} />
                  <span>Allow Microphone</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
        <div className="rounded-[22px] sm:rounded-[28px] border border-white/[0.10] bg-[#212124] focus-within:border-white/20 focus-within:bg-[#232327] px-3.5 sm:px-5 py-2.5 sm:py-3.5 shadow-2xl transition-all">

          {/* Speech Error Banner */}
          <AnimatePresence>
            {speechError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mb-2.5 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs text-amber-300 select-none"
              >
                <span className="truncate mr-2">{speechError}</span>
                <button
                  type="button"
                  onClick={() => setSpeechError(null)}
                  className="text-amber-400 hover:text-white cursor-pointer p-0.5 rounded hover:bg-amber-500/20"
                >
                  <X size={13} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={message}
            onChange={handleChange}
            placeholder="Ask Anything"
            disabled={loading}
            className="w-full resize-none bg-transparent text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none disabled:opacity-50 min-h-[24px] max-h-[180px] leading-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Bottom Bar: Action buttons & Agent selector */}
          <div className="mt-2.5 sm:mt-3 flex items-center justify-between">
            {/* Left Controls: File Attachment & Agent Selector */}
            <div className="relative flex items-center gap-2" ref={menuRef}>
              {/* File Attachment Button (PDF + Image) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-50"
                title="Attach a PDF or image"
              >
                <Paperclip size={17} />
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
                className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-gray-200 transition hover:bg-white/10 hover:border-white/20 cursor-pointer"
                title="Select Agent Mode"
              >
                <CurrentAgentIcon size={14} className={currentAgent.color} />
                <span className="hidden xs:inline sm:inline">{currentAgent.label}</span>
                <span className="xs:hidden sm:hidden">{currentAgent.label.split(" ")[0]}</span>
                <ChevronDown
                  size={13}
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
                    className="absolute bottom-full left-0 mb-2 w-[calc(100vw-36px)] max-w-sm sm:w-80 rounded-2xl border border-white/10 bg-[#252525] p-2 text-white shadow-2xl z-50 select-none"
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
                            className={`flex items-center justify-between rounded-xl p-2 sm:p-2.5 transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-white/10 border border-white/10"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                                <Icon size={16} className={agentItem.color} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs sm:text-sm font-medium text-white">
                                  {agentItem.label}
                                </span>
                                <span className="text-[11px] sm:text-xs text-gray-400 leading-tight">
                                  {agentItem.description}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                size={15}
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

            {/* Right Controls: Mic & Send Button */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <motion.button
                type="button"
                onClick={handleMicClick}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition cursor-pointer ${
                  isListening
                    ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/50 hover:bg-red-500/30 hover:text-red-300"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
                title={isListening ? "Stop listening" : "Voice input (Speech recognition)"}
              >
                {isListening ? (
                  <>
                    <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                    <MicOff size={17} className="relative z-10" />
                  </>
                ) : (
                  <Mic size={17} />
                )}
              </motion.button>

              <motion.button
                type="submit"
                whileHover={(message.trim() || attachedFile) && !loading ? { scale: 1.08 } : {}}
                whileTap={(message.trim() || attachedFile) && !loading ? { scale: 0.92 } : {}}
                disabled={(!message.trim() && !attachedFile) || loading}
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition cursor-pointer ${
                  (message.trim() || attachedFile) && !loading
                    ? "bg-white text-black hover:bg-gray-200 shadow-md"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                }`}
                title="Send message"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </div>

        <div className="text-center text-[10.5px] sm:text-xs text-gray-500 mt-2 px-2 select-none truncate">
          Zuno AI can make mistakes. Please verify important information.
        </div>
      </form>
    </div>
  );
}
