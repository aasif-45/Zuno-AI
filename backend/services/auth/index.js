import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
import authRoutes from "./routes/auth.route.js";

dotenv.config();

const port = process.env.PORT;

const app = express();

app.use(express.json());

app.use("/", authRoutes);

app.get("/", (req, res) => {
    res.send("HI Auth");
});

app.listen(port, () => {
    console.log(`Auth service started at ${port}`);
    connectDb();
});
