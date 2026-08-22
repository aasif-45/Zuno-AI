import React, { useState } from "react";
import { Sparkles, User, Settings, LogOut } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import Logout from "../features/logOut.js";
import { setUserData } from "../redux/userSlice.js";
import { setConversation, setSelectedConversation } from "../redux/conversationSlice.js";
import { clearMessages } from "../redux/messageSlice.js";

export default function AccountMenu({
  isOpen = true,
  onClose,
  onUpgrade,
  onProfile,
  onSettings,
  onLogout,
  className = "bottom-14 left-3",
}) {
  const { userData } = useSelector((state) => state.user || {});
  const [imageError, setImageError] = useState(false);
  const dispatch = useDispatch();

  if (!isOpen || !userData) return null;

  // Helper for initials
  const getUserInitials = (name) => {
    if (!name) return "A";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = userData?.name || "User";
  const userInitials = getUserInitials(displayName);
  const userPlan = userData?.plan || "Starter";

  const handleLogoutClick = async () => {
    onClose?.();
    dispatch(setUserData(null));
    dispatch(setConversation([]));
    dispatch(setSelectedConversation(null));
    dispatch(clearMessages());
    try {
      localStorage.removeItem("session_id");
      localStorage.removeItem("lastConvId");
    } catch (_) {}
    try {
      await Logout();
    } catch (_) {}
    if (onLogout) onLogout();
  };

  return (
    <div
      className={`absolute z-50 w-64 rounded-2xl bg-[#212121] p-1.5 text-white shadow-2xl border border-white/10 select-none animate-in fade-in zoom-in-95 duration-150 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Profile Header Row */}
      <div
        onClick={() => {
          onProfile?.();
          onClose?.();
        }}
        className="flex items-center justify-between rounded-xl p-2 hover:bg-white/5 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#10a37f] text-white font-semibold text-xs">
            {userData?.avatar && !imageError ? (
              <img
                src={userData.avatar}
                alt={displayName}
                className="h-full w-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span>{userInitials}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-semibold text-white leading-tight">
              {displayName}
            </span>
            <span className="truncate text-xs text-slate-400 leading-tight">
              <span className="capitalize">{userPlan} Plan</span>
            </span>
          </div>
        </div>
      </div>

      <div className="my-1.5 h-[1px] bg-white/10" />

      {/* 1. Upgrade plan */}
      <button
        onClick={() => {
          onUpgrade?.();
          onClose?.();
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        <Sparkles size={18} className="text-slate-300" />
        <span className="font-normal">Upgrade plan</span>
      </button>

      {/* 2. Profile */}
      <button
        onClick={() => {
          onProfile?.();
          onClose?.();
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        <User size={18} className="text-slate-300" />
        <span className="font-normal">Profile</span>
      </button>

      {/* 3. Settings */}
      <button
        onClick={() => {
          onSettings?.();
          onClose?.();
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        <Settings size={18} className="text-slate-300" />
        <span className="font-normal">Settings</span>
      </button>

      <div className="my-1.5 h-[1px] bg-white/10" />

      {/* 4. Log out */}
      <button
        onClick={handleLogoutClick}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        <LogOut size={18} className="text-slate-300" />
        <span className="font-normal">Log out</span>
      </button>
    </div>
  );
}
