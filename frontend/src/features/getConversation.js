import api from "../../utils/axios";

export const getConversations = async () => {
  try {
    const response = await api.get("/api/chat/get-conversations");
    return response.data;
  } catch (error) {
    if (error.response?.status !== 401) {
      console.error("Failed to fetch conversations:", error);
    }

    throw error;
  }
};