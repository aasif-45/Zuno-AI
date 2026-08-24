import { signInWithPopup } from "firebase/auth";
import React from "react";
import { auth, googleProvider } from "../../../utils/firebase.js";
import api from "../../../utils/axios.js";
import { FcGoogle } from "react-icons/fc";
import { useDispatch, useSelector } from "react-redux";
import { setUserData } from "../../redux/userSlice.js";
import Sidebar from "../../components/Sidebar.jsx";
import ChatArea from "../../components/ChatArea.jsx";
import Artifact from "../../components/Artifact.jsx";

export default function LandingPage() {
  const dispatch = useDispatch();
  const { userData, authLoading } = useSelector((state) => state.user);

  const [authError, setAuthError] = React.useState("");
  const [loadingAuth, setLoadingAuth] = React.useState(false);

  const handleLogin = async (token) => {
    try {
      setLoadingAuth(true);
      setAuthError("");
      const { data } = await api.post("/api/auth/login", { token });
      if (data?.sessionId || data?.token) {
        localStorage.setItem("session_id", data.sessionId || data.token);
      }
      dispatch(setUserData(data));
      console.log("Login success:", data);
    } catch (error) {
      console.error("Login failed:", error);
      setAuthError(error.response?.data?.message || error.message || "Login failed");
    } finally {
      setLoadingAuth(false);
    }
  };

  const googleLogin = async () => {
    try {
      setAuthError("");
      setLoadingAuth(true);
      const data = await signInWithPopup(auth, googleProvider);
      const token = await data.user.getIdToken();
      await handleLogin(token);
    } catch (error) {
      console.error("Google sign in error:", error);
      if (error.code === "auth/unauthorized-domain") {
        setAuthError("This domain is not authorized in Firebase Console.");
      } else if (error.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in popup was closed.");
      } else {
        setAuthError(error.message || "Failed to sign in with Google.");
      }
      setLoadingAuth(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0d0f14] text-white">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <img
            src="/zuno-icon.png"
            alt="Zuno AI"
            className="h-14 w-14 object-contain drop-shadow-[0_0_24px_rgba(56,189,248,0.55)]"
          />
          <span className="text-lg font-bold font-sans tracking-tight text-white/90">
            Zuno AI
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0d0f14] text-white overflow-hidden">
      <Sidebar />
      <ChatArea />

      {!userData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="w-full max-w-[360px] bg-[#14161f] border border-white/[0.10] rounded-3xl p-7 flex flex-col items-center text-center shadow-2xl">
            {/* Logo Emblem & Brand Title */}
            <div className="flex flex-col items-center gap-3 mb-4">
              <img
                src="/zuno-icon.png"
                alt="Zuno AI"
                className="h-12 w-12 object-contain drop-shadow-[0_0_16px_rgba(56,189,248,0.5)]"
              />
              <span className="text-2xl font-bold font-sans text-white tracking-tight">Zuno AI</span>
            </div>

            {/* Clean Subtitle */}
            <p className="text-[13.5px] text-slate-400 mb-6 leading-relaxed">
              Sign in with Google to continue to your workspace
            </p>

            {authError && (
              <div className="w-full mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed text-left">
                {authError}
              </div>
            )}

            <button
              onClick={googleLogin}
              disabled={loadingAuth}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl 
              text-sm font-semibold text-black bg-white hover:bg-gray-200 disabled:opacity-50
              transition-all duration-150 cursor-pointer shadow-lg active:scale-[0.98]"
            >
              <FcGoogle size={20} />
              {loadingAuth ? "Signing in..." : "Continue with Google"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
