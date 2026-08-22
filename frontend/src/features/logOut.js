import api from "../../utils/axios.js";

async function logOut() {
  try {
    await api.get("/api/auth/logout");
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    try {
      localStorage.removeItem("session_id");
      localStorage.removeItem("lastConvId");
      if (window.location.pathname !== "/" && window.location.pathname !== "") {
        window.history.pushState(null, "", "/");
      }
    } catch {}
  }
}

export default logOut;