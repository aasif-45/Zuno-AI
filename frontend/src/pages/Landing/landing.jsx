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
  const { userData } = useSelector((state) => state.user);

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

  return (
    <div className="flex h-screen w-full bg-[#0d0f14] text-white overflow-hidden">
      <Sidebar />
      <ChatArea />

      {!userData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[340px] bg-[#13151c] border border-white/[0.08] rounded-2xl p-7 flex">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src="/zuno-icon.png"
                  alt="Zuno AI"
                  className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                />
                <span className="text-lg font-bold font-serif text-white tracking-tight">Zuno AI</span>
              </div>
              <h2 className="text-[17px] font-semibold text-slate-100 tracking-tight">
                Welcome to Zuno AI
              </h2>
              <p className=" text-[14px] text-slate-500">
                Please login to continue using the app
              </p>
              {authError && (
                <div className="mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
                  {authError}
                </div>
              )}
              <button
                onClick={googleLogin}
                disabled={loadingAuth}
                className="w-full flex items-center justify-center gap-3 py-[8.5px] rounded-xl 
              text-sm font-medium text-black/90 bg-white hover:bg-gray-300 disabled:opacity-50
              transition-all duration-150 cursor-pointer mt-3"
              >
                <FcGoogle size={20} />
                {loadingAuth ? "Signing in..." : "Continue with google"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
