import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

export const embeddings = new GoogleGenerativeAIEmbeddings({
    // "text-embedding-004" and "gemini-embedding-001" are retired; use the current model.
    model: "gemini-embedding-2",
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
});