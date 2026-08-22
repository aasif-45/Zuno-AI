import dotenv from "dotenv";
dotenv.config();

import express from "express";
import connectDb from "./config/db.js";
import AgentRouter from './routes/agent.route.js';
import { getS3Url } from "./utils/getS3Url.js";


const port = process.env.PORT || 5000;

const app = express();

app.use(express.json());

// Serve uploaded files from the private S3 bucket by redirecting to a
// short-lived presigned URL. Must be registered BEFORE the AgentRouter mount.
// req.params.key is auto-decoded by Express, matching the encodeURIComponent
// used when the key is stored in fileMeta.fileUrl.
app.get("/uploads/:key", async (req, res) => {
  try {
    const url = await getS3Url(req.params.key);
    return res.redirect(url);
  } catch (e) {
    console.error("S3 url error", e);
    return res.status(404).send("File not found");
  }
});

app.use("/", AgentRouter);

app.get("/", (req, res) => {
    res.send("HI Agent");
});

app.listen(port, () => {
    console.log(`Agent service started at ${port}`);
    connectDb();
});


