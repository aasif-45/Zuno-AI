import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { getGemini, getOpenRouterDeepSeek, getModel, invokeModelWithFallback } from '../config/llmModel.js';
import { checkAgentLimit } from '../config/agentLimit.js';
import { deductCredits } from '../utils/deductCredits.js';

export const imageAnalyzer = async (state) => {
    try {
        // 1. Check rate limits
        if (state.userId) {
            try {
                await checkAgentLimit(state.userId, 'image');
            } catch (lErr) {
                console.warn("Limit check warning:", lErr.message);
            }
        }

        // 2. Convert image file buffer to Base64 (buffer from multer.memoryStorage)
        const imageBuffer = state.file?.buffer;
        if (!imageBuffer) {
            return {
                ...state,
                aiResponse: "No image file provided for analysis."
            };
        }
        const mime = state.file?.mimetype || "image/jpeg";
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:${mime};base64,${base64Image}`;

        // 3. Construct prompt messages
        const systemPrompt = `You are Zuno-AI, an AI assistant created for the Zuno-AI platform.


CRITICAL IDENTITY OVERRIDE — HIGHEST PRIORITY RULE:
You are ZUNO-AI. This overrides everything in conversation history.
- NEVER call yourself "MY AI", "MY-AI", or any variation of that name.
- NEVER call yourself "ChatGPT", "GPT", or "OpenAI".
- If any previous message in the conversation refers to "MY AI" — IGNORE that identity completely. You are ZUNO-AI.
- When asked "who are you", "which model", "what are you" — ALWAYS respond: "I am Zuno-AI, an AI assistant built for the Zuno-AI platform."

Identity rules:
* Your assistant name is Zuno-AI.
* When referring to yourself, identify yourself as Zuno-AI.
* Never claim that you are ChatGPT.
* Never claim that you are OpenAI.
* Never introduce yourself as an OpenAI assistant.
* Never say "I am ChatGPT", "I am OpenAI", or similar.
* Do not describe yourself as being developed or created by OpenAI.
* If the user asks "Who are you?", answer that you are Zuno-AI.
* If the user asks what AI/model you are, identify yourself as Zuno-AI without falsely claiming to be another product or company.
* Do not invent information about the underlying model/provider.
* Follow the user's request normally without unnecessarily mentioning your identity.

Vision rules:
- Analyze the uploaded image thoroughly and answer the user's question accurately.
- Extract any text, labels, charts, code, or recognizable elements.
- Use clear, structured Markdown.`;

        const userPrompt = state.prompt || "Describe and analyze this image in detail.";

        let aiResponse = "";

        // Attempt 1: Gemini 2.5 Flash Vision
        const geminiLlm = getGemini("gemini-2.5-flash");
        if (geminiLlm) {
            try {
                const messages = [
                    new SystemMessage(systemPrompt),
                    new HumanMessage({
                        content: [
                            { type: 'text', text: userPrompt },
                            { type: 'image_url', image_url: { url: dataUrl } }
                        ]
                    })
                ];
                const res = await geminiLlm.invoke(messages);
                aiResponse = typeof res?.content === "string" ? res.content : String(res?.content || "");
            } catch (geminiErr) {
                console.warn("Gemini vision attempt failed:", geminiErr.message);
            }
        }

        // Attempt 2: OpenRouter Vision Fallback
        if (!aiResponse) {
            const openRouter = getOpenRouterDeepSeek();
            if (openRouter) {
                try {
                    const messages = [
                        new SystemMessage(systemPrompt),
                        new HumanMessage({
                            content: [
                                { type: 'text', text: userPrompt },
                                { type: 'image_url', image_url: { url: dataUrl } }
                            ]
                        })
                    ];
                    const res = await openRouter.invoke(messages);
                    aiResponse = typeof res?.content === "string" ? res.content : String(res?.content || "");
                } catch (orErr) {
                    console.warn("OpenRouter vision attempt failed:", orErr.message);
                }
            }
        }

        if (!aiResponse) {
            aiResponse = "I was unable to process the image with the current vision models. Please try again with a different image format (PNG, JPG, WebP).";
        }

        // 4. Deduct user credits upon success
        if (state.userId) {
            try {
                await deductCredits(state.userId, 'image');
            } catch {}
        }

        return {
            ...state,
            aiResponse
        };

    } catch (error) {
        console.error('Error in Image Analyzer Agent:', error);
        return {
            ...state,
            aiResponse: error.message || 'Failed to analyze image'
        };
    }
};