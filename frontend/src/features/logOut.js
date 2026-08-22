import api from "../../utils/axios.js";

async function logOut() {
  try {
    await api.get("/api/auth/logout");
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    try {
      localStorage.removeItem("session_id");
    } catch {}
  }
}

export default logOut;