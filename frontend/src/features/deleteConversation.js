import api from "../../utils/axios";

export const deleteConversationApi = async (id) => {
  try {
    const response = await api.delete(`/api/chat/delete-conversation/${id}`);
    return response.data;
  } catch (error) {
    if (error.response?.status !== 401) {
      console.error("Failed to delete conversation:", error);
    }
    throw error;
  }
};
