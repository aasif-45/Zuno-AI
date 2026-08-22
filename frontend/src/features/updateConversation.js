import api from "../../utils/axios.js";

export const updateConversationApi = async (id, title) => {
  try {
    const { data } = await api.put("/api/chat/update-conversation", { id, title });
    return data;
  } catch (error) {
    console.error("Error updating conversation:", error);
    return null;
  }
};

export default updateConversationApi;
