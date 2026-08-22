import api from "../../utils/axios.js";

export const verifyPayment = async (paymentData) => {
  try {
    const { data } = await api.post("/api/billing/verify", paymentData);
    return data;
  } catch (error) {
    console.error("Verify payment error:", error);
    throw error;
  }
};
