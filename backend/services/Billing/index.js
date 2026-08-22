import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import billingRouter from "./routes/billing.routes.js";


dotenv.config();

const app = express();

const PORT = process.env.PORT || 3020;

// Connect MongoDB
connectDB();

// Middleware
app.use(express.json());

// Billing routes
app.use("/", billingRouter);

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Billing service is running",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Billing started at port ${PORT}`);
});