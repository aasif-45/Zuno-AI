import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  User,
  Mail,
  ShieldCheck,
  Sparkles,
  Calendar,
  Key,
  Check,
  Camera,
  Coins,
  Cpu,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";

export default function ProfileModal({ isOpen, onClose, onUpgrade }) {
  const { userData } = useSelector((state) => state.user || {});
  const dispatch = useDispatch();

  const [name, setName] = useState(userData?.name || "Aasif");
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const getUserInitials = (n) => {
    if (!n) return "A";
    const parts = n.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  };

  const handleSaveName = () => {
    if (name.trim()) {
      dispatch(setUserData({ ...userData, name: name.trim() }));
      setIsEditing(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const displayName = userData?.name || "Aasif";
  const email = userData?.email || "user@example.com";
  const plan = userData?.plan || "Starter";
  const credits = userData?.credits ?? 400;

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
          className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[#1e1e1e] border border-white/10 text-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-200">
                <User size={18} />
              </div>
              <h2 className="text-lg font-semibold text-white">Your Profile</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
            {/* Avatar & Main Info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="relative group">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#10a37f] text-white font-bold text-xl shadow-lg">
                  {userData?.avatar ? (
                    <img
                      src={userData.avatar}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{getUserInitials(displayName)}</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#2a2a2a] border border-emerald-500/50 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-400 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white truncate">
                      {displayName}
                    </h3>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-slate-400 hover:text-white transition-colors underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400 truncate mt-0.5">{email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck size={12} /> Verified Account
                  </span>
                </div>
              </div>
            </div>

            {savedSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5"
              >
                <Check size={14} /> Name updated successfully!
              </motion.div>
            )}

            {/* Plan & Usage Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Plan Card */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Current Plan</span>
                  <Sparkles size={14} className="text-amber-400" />
                </div>
                <div className="text-base font-semibold text-white capitalize">
                  {plan} Plan
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onUpgrade?.();
                  }}
                  className="w-full mt-2 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  Upgrade Tier
                </button>
              </div>

              {/* Credits Card */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Available Credits</span>
                  <Coins size={14} className="text-emerald-400" />
                </div>
                <div className="text-base font-semibold text-emerald-400">
                  {credits} Credits
                </div>
                <div className="text-[11px] text-slate-400">
                  Refills automatically monthly
                </div>
              </div>
            </div>

            {/* Account Details List */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Account Details
              </h4>

              <div className="divide-y divide-white/5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Mail size={14} /> Email
                  </span>
                  <span className="text-slate-200 font-mono">{email}</span>
                </div>

                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Cpu size={14} /> Neural Agent Engine
                  </span>
                  <span className="text-emerald-400 font-medium">Gemini 3 + DeepSeek V4</span>
                </div>

                <div className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Calendar size={14} /> Member Since
                  </span>
                  <span className="text-slate-200">August 2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-[#191919] px-6 py-3.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
