import razorpay from "../config/razorpay.js";
import crypto from "crypto";

export const createRazorpayOrder = async ({ amount, currency = "INR", receipt }) => {
  return await razorpay.orders.create({
    amount: amount * 100,
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
  });
};

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return generatedSignature === signature;
};
