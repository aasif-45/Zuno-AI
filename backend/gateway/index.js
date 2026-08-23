import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
dotenv.config();
import cors from "cors";
import cookieParser from "cookie-parser";
import { protect } from "./middleware/auth.middleware.js";
import { getCurrentUser } from "./controllers/user.controller.js";
import { ProxtWithHeader } from "./utils/proxyWithHeader.js";
import morgan from "morgan";
const port = process.env.PORT || 3000;

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://d2w8b5ky2np1tx.cloudfront.net",
  "http://myai-demo1.s3-website.ap-south-1.amazonaws.com",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".cloudfront.net")) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for public AI gateway
    }
  },
  credentials: true,
}));

app.use(morgan("dev"));
app.use(cookieParser());

app.use("/api/auth", proxy(process.env.AUTH_SERVICE));
app.use("/api/chat", protect, ProxtWithHeader(process.env.CHAT_SERVICE));
app.use("/api/agent", protect, ProxtWithHeader(process.env.AGENT_SERVICE));

app.use("/api/billing", protect, ProxtWithHeader(process.env.BILLING_SERVICE));

app.get("/api/me", protect, getCurrentUser);

app.listen(port, () => {
  console.log(`Gateway started at ${port}`)
});

app.get("/", (req, res) => {
  res.send("HI");
})