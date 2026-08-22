import React, { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  PanelLeft,
  SquarePen,
  Search,
  X,
  Sparkles,
  Trash2,
  MessageSquare,
  Pencil,
  Check,
} from "lucide-react";
import AccountMenu from "./AccountMenu";
import BillingDrawer from "./BillingDrawer.jsx";
import AnimatedTitle from "./AnimatedTitle.jsx";
import { getConversations } from "../features/getConversation";
import { deleteConversationApi } from "../features/deleteConversation";
import { updateConversationApi } from "../features/updateConversation";
import { useDispatch, useSelector } from "react-redux";
import {
  setConversation,
  addConversation,
  removeConversation,
  updateConversation,
  setSelectedConversation,
} from "../redux/conversationSlice";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showBillingDrawer, setShowBillingDrawer] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const dispatch = useDispatch();
  const { conversations, selectedConversation } = useSelector(
    (state) => state.conversation
  );
  const { userData } = useSelector((state) => state.user);

  // Helper to extract conversation ID from browser URL path or localStorage fallback
  const getConvIdFromUrl = () => {
    const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    if (window.location.pathname === "/") return null;
    return localStorage.getItem("lastConvId");
  };

  // 1. Immediately set selectedConversation on component mount to keep conversation on refresh
  useEffect(() => {
    const initialId = getConvIdFromUrl();
    if (initialId && !selectedConversation) {
      dispatch(setSelectedConversation({ _id: initialId, title: "New Chat" }));
    }
  }, []);

  // 2. Fetch conversations list from server and match selected conversation
  useEffect(() => {
    const getConv = async () => {
      try {
        const data = await getConversations();
        dispatch(setConversation(data));

        const urlConvId = getConvIdFromUrl();
        if (urlConvId && Array.isArray(data)) {
          const matched = data.find((c) => c._id === urlConvId);
          if (matched) {
            dispatch(setSelectedConversation(matched));
          }
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      }
    };

    getConv();
  }, [dispatch]);

  // 3. Update browser URL & localStorage whenever selectedConversation changes
  useEffect(() => {
    if (selectedConversation?._id) {
      localStorage.setItem("lastConvId", selectedConversation._id);
      const targetPath = `/c/${selectedConversation._id}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, "", targetPath);
      }
    } else {
      localStorage.removeItem("lastConvId");
      if (window.location.pathname !== "/" && window.location.pathname !== "") {
        window.history.pushState(null, "", "/");
      }
    }
  }, [selectedConversation]);

  // 4. Handle browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const urlConvId = getConvIdFromUrl();
      if (urlConvId) {
        const matched = (conversations || []).find((c) => c._id === urlConvId);
        dispatch(setSelectedConversation(matched || { _id: urlConvId, title: "New Chat" }));
      } else {
        dispatch(setSelectedConversation(null));
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [conversations, dispatch]);

  // Close account menu when clicking anywhere outside
  useEffect(() => {
    const handleOutsideClick = () => setShowAccountMenu(false);
    if (showAccountMenu) {
      window.addEventListener("click", handleOutsideClick);
    }
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [showAccountMenu]);

  const handleNewChat = () => {
    localStorage.removeItem("lastConvId");
    dispatch(setSelectedConversation(null));
    if (window.location.pathname !== "/") {
      window.history.pushState(null, "", "/");
    }
  };

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    // Remove from Redux state immediately
    dispatch(removeConversation(id));
    if (selectedConversation?._id === id) {
      const remaining = conversations.filter((c) => c._id !== id);
      dispatch(setSelectedConversation(remaining[0] || null));
    }
    // Delete from MongoDB database backend
    try {
      await deleteConversationApi(id);
    } catch (error) {
      console.error("Failed to delete conversation on backend:", error);
    }
  };

  const handleStartRename = (e, conv) => {
    e.stopPropagation();
    setEditingId(conv._id);
    setEditingTitle(conv.title || "New Chat");
  };

  const handleSaveRename = async (e, conv) => {
    e?.stopPropagation();
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== conv.title) {
      const updatedConv = { ...conv, title: trimmed };
      dispatch(updateConversation(updatedConv));
      if (selectedConversation?._id === conv._id) {
        dispatch(setSelectedConversation(updatedConv));
      }
      try {
        await updateConversationApi(conv._id, trimmed);
      } catch (error) {
        console.error("Failed to rename conversation on backend:", error);
      }
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((conv) =>
      (conv.title || "New Chat")
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim())
    );
  }, [conversations, searchQuery]);

  // Helper for avatar initials
  const getUserInitials = (name) => {
    if (!name) return "A";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside
      className={`relative z-40 flex h-screen flex-col bg-black text-white transition-all duration-300 ease-in-out shrink-0 select-none ${collapsed ? "w-[56px]" : "w-[260px]"
        }`}
    >
      {!collapsed ? (
        /* ================= EXPANDED SIDEBAR ================= */
        <>
          {/* --- TOP HEADER --- */}
          <div className="flex h-14 items-center justify-between px-3.5 shrink-0">
            {/* Left Logo */}
            <div
              onClick={handleNewChat}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              title="New chat"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
                <Sparkles size={16} />
              </div>
              <div className="font-bold font-serif">MY-AI</div>
            </div>

            {/* Right Action Icons (Search & Close) */}
            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={() => setShowSearch(!showSearch)}
                title="Search"
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <Search size={18} />
              </button>
              <button
                onClick={() => setCollapsed(!collapsed)}
                title="Close sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <PanelLeft size={18} />
              </button>
            </div>
          </div>

          {/* --- MAIN CONTENT --- */}
          <div className="flex flex-1 min-h-0 flex-col px-2 py-1 gap-1 overflow-hidden">
            {/* NEW CHAT ROW */}
            <motion.button
              whileHover={{ scale: 1.01, x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNewChat}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${!selectedConversation?._id
                  ? "bg-[#212121] text-white font-medium border border-white/10"
                  : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
            >
              <SquarePen size={18} className="text-white" />
              <span>New chat</span>
            </motion.button>

            {/* SEARCH INPUT BAR */}
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1 px-1"
              >
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl bg-white/5 pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-400 outline-none border border-white/10 focus:border-white/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 text-slate-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* RECENT CHATS TITLE */}
            <div className="mt-3 px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
              Recents
            </div>

            {/* CHAT LIST SCROLL AREA */}
            <div className="flex-1 overflow-y-auto space-y-0.5 select-none [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
              <div className="space-y-1">
                {filteredConversations.map((conv) => {
                  const isActive = selectedConversation?._id === conv._id;
                  const isEditing = editingId === conv._id;
                  const titleText = conv.title?.trim() || "New Chat";

                  return (
                    <motion.div
                      key={conv._id}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => dispatch(setSelectedConversation(conv))}
                      className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors cursor-pointer ${isActive
                          ? "bg-[#212121] text-white font-medium"
                          : "text-slate-200 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                      {isEditing ? (
                        <div
                          className="flex flex-1 items-center gap-1.5 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(e, conv);
                              if (e.key === "Escape") handleCancelRename(e);
                            }}
                            autoFocus
                            className="w-full rounded bg-[#2f2f2f] px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            onClick={(e) => handleSaveRename(e, conv)}
                            title="Save"
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            title="Cancel"
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate text-sm font-normal">
                            <AnimatedTitle text={titleText} />
                          </span>

                          <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-2">
                            <button
                              onClick={(e) => handleStartRename(e, conv)}
                              title="Rename"
                              className="p-1 text-slate-400 hover:text-white rounded"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteConversation(e, conv._id)}
                              title="Delete"
                              className="p-1 text-slate-400 hover:text-rose-400 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* --- FOOTER --- */}
          <div className="relative shrink-0 p-3 mt-auto bg-black">
            <AccountMenu
              isOpen={showAccountMenu}
              onClose={() => setShowAccountMenu(false)}
              onUpgrade={() => setShowBillingDrawer(true)}
              className="bottom-14 left-2"
            />

            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowAccountMenu((prev) => !prev);
              }}
              className="flex items-center justify-between cursor-pointer rounded-xl p-1 -mx-1 hover:bg-white/5 transition-colors"
            >
              {/* User Info Left */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#10a37f] text-white font-semibold text-xs">
                  {userData?.avatar && !imageError ? (
                    <img
                      src={userData.avatar}
                      alt={userData.name || "User"}
                      className="h-full w-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <span>{getUserInitials(userData?.name || "Aasif")}</span>
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-medium text-white leading-tight">
                    {userData?.name || "Aasif"}
                  </span>
                  <span className="truncate text-xs text-slate-400 capitalize leading-tight">
                    {userData?.plan || "Free"} Plan
                  </span>
                </div>
              </div>

              {/* Upgrade Button Right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBillingDrawer(true);
                }}
                className="rounded-full bg-[#212121] hover:bg-[#2a2a2a] px-3.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer border border-white/10 shrink-0"
              >
                Upgrade
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ================= COLLAPSED SIDEBAR ================= */
        <div className="flex h-full flex-col items-center py-3.5 justify-between">
          {/* Top Icons Column */}
          <div className="flex flex-col items-center gap-4">
            {/* Top Logo / Expand Button with hover icon swap */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              title="Open sidebar"
              className="group flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer outline-none focus:outline-none"
            >
              <Sparkles size={20} className="block group-hover:hidden" />
              <PanelLeft size={20} className="hidden group-hover:block text-slate-200" />
            </button>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              title="New chat"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer outline-none focus:outline-none ${!selectedConversation?._id
                  ? "bg-[#212121] text-white border border-white/10"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
            >
              <SquarePen size={20} />
            </button>

            {/* Search Button */}
            <button
              onClick={() => {
                setCollapsed(false);
                setShowSearch(true);
              }}
              title="Search"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer outline-none focus:outline-none"
            >
              <Search size={20} />
            </button>

            {/* Chat/Recents Button */}
            <button
              onClick={() => setCollapsed(false)}
              title="Recents"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer outline-none focus:outline-none"
            >
              <MessageSquare size={20} />
            </button>
          </div>

          {/* Bottom Avatar Circle with Click Account Menu */}
          <div
            className="relative cursor-pointer"
            title={userData?.name || "User"}
            onClick={(e) => {
              e.stopPropagation();
              setShowAccountMenu((prev) => !prev);
            }}
          >
            <AccountMenu
              isOpen={showAccountMenu}
              onClose={() => setShowAccountMenu(false)}
              onUpgrade={() => setShowBillingDrawer(true)}
              className="left-12 bottom-0"
            />
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#10a37f] text-white font-semibold text-xs">
              {userData?.avatar && !imageError ? (
                <img
                  src={userData.avatar}
                  alt={userData.name || "Aasif"}
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span>{getUserInitials(userData?.name || "Aasif")}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Billing Drawer Drawer Overlay */}
      <BillingDrawer
        open={showBillingDrawer}
        onClose={() => setShowBillingDrawer(false)}
      />
    </aside>
  );
}

