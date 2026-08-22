import React from 'react'
import api from "../../utils/axios.js";

// Same base URL the shared axios instance uses (VITE_SERVER_URL, fallback localhost).
// Reused here so a message's relative fileUrl (e.g. "/api/agent/uploads/<file>")
// can be turned into an absolute preview URL on load.
const rawApiBase = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const API_BASE = rawApiBase.endsWith("/") ? rawApiBase.slice(0, -1) : rawApiBase;

// Normalize a fetched message so attachments render after a page refresh.
// On refresh the backend returns fileUrl (relative) but no filePreviewUrl,
// so MessageBubble (which renders via filePreviewUrl) shows nothing.
function normalizeMessage(message) {
  if (!message || typeof message !== "object") return message;
  if (message.fileUrl && !message.filePreviewUrl) {
    return {
      ...message,
      filePreviewUrl: `${API_BASE}${message.fileUrl}`,
    };
  }
  return message;
}

async function getMessage(id) {
  try {
    const { data } = await api.get(`/api/chat/get-messages/${id}`);
    console.log(data);
    // Map each message so relative fileUrl becomes an absolute filePreviewUrl.
    return Array.isArray(data) ? data.map(normalizeMessage) : data;
  } catch (error) {
    console.log(error);
    return [];
    
  }
}

export default getMessage