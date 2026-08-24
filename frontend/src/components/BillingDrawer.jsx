import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDispatch, useSelector } from "react-redux";
import {
  X,
  Check,
  ShieldCheck,
  Zap,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { createOrder } from "../features/createOrder";
import { verifyPayment } from "../features/verifyPayment";
import { getCurrentuser } from "../features/getCurrentUser";
import { setUserData } from "../redux/userSlice";

// Helper function to dynamically load Razorpay SDK script if missing
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PLAN_CARDS = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    period: "/ month",
    description: "For casual exploration and basic assistance",
    credits: "100 Credits",
    badge: null,
    features: [
      "100 AI generation credits",
      "Standard response speed",
      "Access to base AI model",
      "Basic chat history",
    ],
  },
  {
    key: "starter",
    name: "Starter",
    price: "₹199",
    period: "/ month",
    description: "For regular users needing more power & speed",
    credits: "500 Credits",
    badge: null,
    features: [
      "500 AI generation credits",
      "Faster response times",
      "Full artifact & code export",
      "Access to standard web search",
      "Standard email support",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "₹499",
    period: "/ month",
    description: "For power users requiring maximum performance",
    credits: "1,000 Credits",
    badge: "POPULAR",
    features: [
      "1,000 AI generation credits",
      "Priority fast response speed",
      "Access to advanced AI models & tools",
      "Unlimited artifact exports & preview",
      "Priority 24/7 dedicated support",
    ],
  },
];

const BillingDrawer = ({ open, onClose }) => {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [notification, setNotification] = useState(null);

  const dispatch = useDispatch();
  const userData = useSelector(
    (state) => state.user?.userData || state.user
  );

  const activePlan = (userData?.plan || "free").toLowerCase();

  const defaultTotal =
    activePlan === "pro" ? 1000 : activePlan === "starter" ? 500 : 100;
  const totalCredits = Number(userData?.totalCredits ?? defaultTotal);

  const currentCredits = Number(
    userData?.credits !== undefined && userData?.credits !== null
      ? userData.credits
      : defaultTotal
  );

  const creditPercentage = Math.min(
    Math.max(Math.round((currentCredits / totalCredits) * 100), 0),
    100
  );

  const handleUpgrade = async (planKey) => {
    const PLAN_TIERS = { free: 0, starter: 1, pro: 2 };
    const activeTier = PLAN_TIERS[activePlan] ?? 0;
    const targetTier = PLAN_TIERS[planKey] ?? 0;

    if (targetTier <= activeTier) return;


    try {
      setNotification(null);
      setLoadingPlan(planKey);

      // 1. Ensure Razorpay SDK script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setNotification({
          type: "error",
          message: "Razorpay SDK failed to load. Please check your internet connection.",
        });
        setLoadingPlan(null);
        return;
      }

      // 2. Create Razorpay Order from Backend
      const data = await createOrder(planKey);

      if (!data?.order) {
        setNotification({
          type: "error",
          message: "Unable to create payment order. Please try again.",
        });
        setLoadingPlan(null);
        return;
      }

      // 3. Configure Razorpay Options
      const razorpayKey =
        import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_TNhgIFCaJPqU2r";

      const options = {
        key: razorpayKey,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "Zuno AI",
        description: `${data?.plan?.name || planKey.toUpperCase()} Plan Subscription`,
        order_id: data.order.id,
        prefill: {
          name: userData?.name || "",
          email: userData?.email || "",
        },
        handler: async (response) => {
          try {
            setNotification({
              type: "info",
              message: "Verifying payment authorization...",
            });

            // Verify Payment on Backend
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // Refresh user state dynamically in Redux
            try {
              const updatedUser = await getCurrentuser();
              if (updatedUser) {
                dispatch(setUserData(updatedUser));
              }
            } catch (err) {
              console.error("Failed to refresh user profile:", err);
            }

            setNotification({
              type: "success",
              message: `${planKey.toUpperCase()} plan activated successfully!`,
            });

            setTimeout(() => {
              setNotification(null);
              onClose?.();
            }, 1800);
          } catch (error) {
            console.error("Payment verification failed:", error);
            setNotification({
              type: "error",
              message:
                error?.response?.data?.message ||
                "Payment verification failed. Please contact support.",
            });
          } finally {
            setLoadingPlan(null);
          }
        },
        theme: {
          color: "#10a37f",
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        console.error("Payment failed:", response.error);
        setNotification({
          type: "error",
          message:
            response?.error?.description ||
            "Payment transaction failed. Please try again.",
        });
        setLoadingPlan(null);
      });

      rzp.open();
    } catch (error) {
      console.error("Upgrade error:", error);
      setNotification({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Unable to initiate payment process.",
      });
      setLoadingPlan(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 flex h-[90vh] max-h-[720px] w-[92%] max-w-[860px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border border-white/10 bg-[#14161f] text-white shadow-2xl overflow-hidden select-none"
          >
            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#14161f]">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Upgrade your plan
                </h2>
                <p className="text-xs text-[#b4b4b4] mt-0.5">
                  Get access to faster responses, priority model access, and expanded credit limits.
                </p>
              </div>

              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Notification Banner */}
            <AnimatePresence>
              {notification && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`mx-6 mt-4 flex items-center gap-2.5 rounded-xl border p-3 text-xs ${
                    notification.type === "success"
                      ? "border-[#10a37f]/40 bg-[#10a37f]/10 text-[#10a37f]"
                      : notification.type === "info"
                      ? "border-[#10a37f]/30 bg-[#10a37f]/10 text-[#10a37f]"
                      : "border-rose-500/30 bg-rose-950/40 text-rose-300"
                  }`}
                >
                  {notification.type === "success" ? (
                    <CheckCircle2 size={16} className="shrink-0 text-[#10a37f]" />
                  ) : notification.type === "info" ? (
                    <Loader2 size={16} className="shrink-0 animate-spin text-[#10a37f]" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  )}
                  <span className="flex-1 font-medium leading-tight">
                    {notification.message}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Current Quota Status Bar */}
            <div className="mx-6 mt-4 flex items-center justify-between rounded-2xl bg-[#1c1e28] border border-white/[0.08] px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <Zap size={15} className="text-amber-400" />
                <span>
                  Current Plan:{" "}
                  <strong className="font-semibold text-white capitalize">
                    {activePlan}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-300 font-medium">
                  {currentCredits} / {totalCredits} Credits Available
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-[#10a37f] transition-all duration-300"
                    style={{ width: `${creditPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ChatGPT 3-Column Plan Comparison Cards */}
            <div className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                {PLAN_CARDS.map((plan) => {
                  const PLAN_TIERS = { free: 0, starter: 1, pro: 2 };
                  const activeTier = PLAN_TIERS[activePlan] ?? 0;
                  const cardTier = PLAN_TIERS[plan.key] ?? 0;

                  const isCurrent = activePlan === plan.key;
                  const isLowerTier = cardTier < activeTier;
                  const isDisabled = isCurrent || isLowerTier || loadingPlan !== null;
                  const isLoadingThis = loadingPlan === plan.key;
                  const isPro = plan.key === "pro";

                  return (
                    <div
                      key={plan.key}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-150 ${
                        isCurrent
                          ? "border-white/20 bg-[#1c1e28]"
                          : isPro
                          ? "border-[#10a37f]/50 bg-[#1c1e28] shadow-lg shadow-[#10a37f]/10"
                          : "border-white/10 bg-[#1c1e28]/70 hover:border-white/20"
                      }`}
                    >
                      {/* Popular Badge */}
                      {plan.badge && (
                        <div className="absolute -top-3 right-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#10a37f] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm uppercase tracking-wider">
                            <Sparkles size={10} />
                            {plan.badge}
                          </span>
                        </div>
                      )}

                      <div>
                        {/* Plan Header */}
                        <div className="flex items-baseline justify-between">
                          <h3 className="text-lg font-bold text-white">
                            {plan.name}
                          </h3>
                          <span className="text-xs text-[#b4b4b4]">
                            {plan.credits}
                          </span>
                        </div>

                        {/* Price */}
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-white tracking-tight">
                            {plan.price}
                          </span>
                          <span className="text-xs text-[#b4b4b4]">
                            {plan.period}
                          </span>
                        </div>

                        <p className="mt-1.5 text-xs text-[#b4b4b4] leading-relaxed">
                          {plan.description}
                        </p>

                        {/* Action Button */}
                        <button
                          disabled={isDisabled}
                          onClick={() => handleUpgrade(plan.key)}
                          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all duration-150 ${
                            isCurrent || isLowerTier
                              ? "bg-[#383838] text-[#8e8e93] cursor-not-allowed border border-white/5"
                              : isPro
                              ? "bg-[#10a37f] text-white hover:bg-[#0e8e6e] shadow-sm cursor-pointer"
                              : "bg-white text-black hover:bg-[#e3e3e3] cursor-pointer"
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {isLoadingThis ? (
                            <>
                              <Loader2 size={15} className="animate-spin text-current" />
                              <span>Processing...</span>
                            </>
                          ) : isCurrent ? (
                            "Your Current Plan"
                          ) : isLowerTier ? (
                            activePlan === "pro" ? "Included in Pro" : "Included in Starter"
                          ) : (
                            `Upgrade to ${plan.name}`
                          )}
                        </button>


                        <div className="my-4 h-[1px] bg-white/10" />

                        {/* Feature Checklist */}
                        <ul className="space-y-2.5 text-xs text-slate-200">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#10a37f]/20 text-[#10a37f] mt-0.5">
                                <Check size={11} />
                              </div>
                              <span className="leading-tight">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Security Footer */}
            <div className="border-t border-white/10 bg-[#1e1e1e] px-6 py-3.5 flex items-center justify-between text-xs text-[#b4b4b4]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#10a37f]" />
                <span>Encrypted 256-bit checkout • Powered by Razorpay</span>
              </div>
              <span>Cancel or adjust subscription anytime</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BillingDrawer;