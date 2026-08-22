import Payment from "../models/payment.model.js";
import { plans } from "../config/plans.js";
import razorpay from "../config/razorpay.js";
import crypto from "crypto";
import axios from "axios";

export const createOrder = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { plan } = req.body;

    const selectedPlan = plans[plan];

    if (!selectedPlan) {
      return res.status(400).json({ message: `Invalid plan specified: ${plan}` });
    }

    const order = await razorpay.orders.create({
      amount: selectedPlan.amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    await Payment.create({
      userId: userId || "guest",
      orderId: order.id,
      amount: selectedPlan.amount,
      credits: selectedPlan.credits,
      plan: selectedPlan.id,
      currency: order.currency,
      status: "created",
    });

    return res.status(200).json({
      order,
      plan: selectedPlan,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({
      message: error?.error?.description || error?.message || "Unable to process payment order",
    });
  }
};


export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: "Payment verification failed",
      });
    }

    const payment = await Payment.findOne({ orderId: razorpay_order_id });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    payment.status = "paid";
    payment.paymentId = razorpay_payment_id;
    payment.paidAt = new Date();
    await payment.save();


    try {
      console.log(`--> Sending update-plan request to AUTH_SERVICE (${process.env.AUTH_SERVICE}/update-plan) for userId: ${payment.userId}, plan: ${payment.plan}, credits: ${payment.credits}`);
      const authRes = await axios.post(`${process.env.AUTH_SERVICE}/update-plan`, {
        userId: payment.userId,
        plan: payment.plan,
        credits: payment.credits,
      });
      console.log("--> AUTH_SERVICE update-plan response:", authRes.data);
    } catch (authErr) {
      console.error("--> AUTH_SERVICE update-plan error:", authErr?.response?.data || authErr.message);
    }


    return res.status(200).json({
      message: "Payment verified",
    });
  } catch (error) {
    return res.status(500).json({
      message: `Verify payment error: ${error.message}`,
    });
  }
};