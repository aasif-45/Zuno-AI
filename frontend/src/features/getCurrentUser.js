import api from "../../utils/axios.js";

export const getCurrentuser = async () => {
    try {
        const { data } = await api.get("/api/me");
        console.log(data);
        return data;
    } catch (error) {
        if (error.response?.status !== 401) {
            console.error(error);
        }
        return null;
    }
}