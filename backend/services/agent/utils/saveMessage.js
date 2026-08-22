import axios from "axios";

export const saveMessageToDb = async (conversationId, role, content, images = [], artifacts = [], fileMeta = {}) => {
  try {
    const rawUrl = process.env.CHAT_SERVICE || "http://localhost:3010";
    const baseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
    const { fileName, fileType, fileUrl } = fileMeta || {};
    const res = await axios.post(`${baseUrl}/save-message`, {
      conversationId,
      role,
      content,
      images: Array.isArray(images) ? images : [],
      artifacts: Array.isArray(artifacts) ? artifacts : [],
      ...(fileName ? { fileName } : {}),
      ...(fileType ? { fileType } : {}),
      ...(fileUrl ? { fileUrl } : {}),
    });
    console.log(`[saveMessageToDb] Saved successfully:`, res.data?._id);
  } catch (error) {
    console.error("Error saving message to MongoDB:", error.response?.data || error.message);
  }
};

export const updateTitleInDb = async (conversationId, title) => {
  try {
    const rawUrl = process.env.CHAT_SERVICE || "http://localhost:3010";
    const baseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
    await axios.put(`${baseUrl}/update-conversation`, {
      id: conversationId,
      title: title,
    });
    console.log(`[updateTitleInDb] Updated title successfully to: "${title}"`);
  } catch (error) {
    console.error("Error updating title in MongoDB:", error.response?.data || error.message);
  }
};



