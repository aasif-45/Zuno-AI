import dotenv from "dotenv";
import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;

const systemPrompt = `You are Zuno-AI, an AI assistant created for the Zuno-AI platform.

Identity rules:
* Your assistant name is Zuno-AI.
* When referring to yourself, identify yourself as Zuno-AI.
* Never claim that you are ChatGPT.
* Never claim that you are OpenAI.
* Do not describe yourself as being developed or created by OpenAI.
* If the user asks "Who are you?", answer that you are Zuno-AI.
* If the user asks what AI/model you are, identify yourself as Zuno-AI.`;

const modelsToTest = [
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "groq/compound",
];

for (const m of modelsToTest) {
  try {
    console.log(`\n=== Testing "${m}" with identity question ===`);
    const model = new ChatGroq({ apiKey, model: m, maxRetries: 1 });
    const res = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage("which model are you"),
    ]);
    const text = typeof res.content === "string"
      ? res.content
      : JSON.stringify(res.content);
    console.log(`RESPONSE: ${text.slice(0, 300)}`);
  } catch (err) {
    console.error(`FAIL "${m}":`, err.message);
  }
}
