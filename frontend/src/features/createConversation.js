import api from "../../utils/axios.js";

export const createConversation = async () => {
    try {
        const { data } = await api.post("/api/chat/create-conversation");
        console.log(data);
        return data;
    } catch (error) {
        if (error.response?.status !== 401) {
            console.error(error);
        }
        return null;
    }
}