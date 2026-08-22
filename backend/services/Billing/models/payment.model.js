import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    // Razorpay Order ID
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Razorpay Payment ID
    paymentId: {
      type: String,
      default: null,
      index: true,
    },

    // Amount in INR
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    // Credits purchased
    credits: {
      type: Number,
      required: true,
      min: 0,
    },

    // Plan purchased
    plan: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
