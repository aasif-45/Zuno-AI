import api from "../../utils/axios.js";

async function sendMessage(payload) {
  try {
    // Build multipart/form-data so an optional file upload is supported.
    const formData = new FormData();
    formData.append("prompt", payload.prompt ?? "");

    if (payload.conversationId) {
      formData.append("conversationId", payload.conversationId);
    }
    if (payload.agent) {
      formData.append("agent", payload.agent);
    }
    if (payload.file) {
      // Multer on the backend expects the field name "file".
      formData.append("file", payload.file);
    }

    const { data } = await api.post("/api/agent/prompt", formData);
    return data;
  } catch (error) {
    console.error("Failed to send message:", error);
    throw error;
  }
}

export default sendMessage;