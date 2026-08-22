import axios from "axios";

export const getMessages = async (conversationId) => {
  try {
    const baseUrl = (process.env.CHAT_SERVICE);
    const { data } = await axios.get(`${baseUrl}/get-messages/${conversationId}`);
    return data;
  } catch (error) {
    console.error("Error in getMessages helper:", error.message);
    return [];
  }
};
