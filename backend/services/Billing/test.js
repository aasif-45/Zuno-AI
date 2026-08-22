import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function testRazorpay() {
  console.log("🔄 Testing Razorpay API...");

  try {
    const order = await razorpay.orders.create({
      amount: 100, // ₹1 = 100 paise
      currency: "INR",
      receipt: `test_${Date.now()}`,
    });

    console.log("\n✅ RAZORPAY API WORKING\n");

    console.log("Order ID :", order.id);
    console.log("Amount   :", order.amount);
    console.log("Currency :", order.currency);
    console.log("Status   :", order.status);

  } catch (error) {
    console.log("\n❌ RAZORPAY API FAILED\n");

    console.log("Status :", error?.statusCode);
    console.log(
      "Error  :",
      error?.error?.description || error?.message
    );
  }
}

testRazorpay();