import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
import chatRouter from "./routes/chat.routes.js";

dotenv.config();

const port = process.env.PORT;

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("HI Chat");
});

app.use("/", chatRouter);

app.listen(port, () => {
    console.log(`chat service started at ${port}`);
    connectDb();
});


