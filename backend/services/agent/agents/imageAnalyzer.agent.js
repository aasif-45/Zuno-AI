import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { getModel } from '../config/llmModel.js';
import { checkAgentLimit } from '../config/agentLimit.js';
import { deductCredits } from '../utils/deductCredits.js';

export const imageAnalyzer = async (state) => {
    try {
        // 1. Check rate limits
        try {
            await checkAgentLimit(state.userId, 'image');
        } catch (lErr) {
            console.warn("Limit check warning:", lErr.message);
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
        const systemPrompt = `You are a CORTEX AI vision image analyzer agent.
Rules:
- Analyze the uploaded image thoroughly and answer the user's question accurately.
- Extract any text, labels, charts, code, or recognizable elements.
- Use clear, structured Markdown.`;

        const userPrompt = state.prompt || "Describe and analyze this image in detail.";

        let aiResponse = "";

        // Attempt 1: Gemini 2.0 Flash Vision
        const geminiLlm = getGemini();
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
                aiResponse = res?.content;
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
                    aiResponse = res?.content;
                } catch (orErr) {
                    console.warn("OpenRouter vision attempt failed:", orErr.message);
                }
            }
        }

        if (!aiResponse) {
            aiResponse = "I was unable to process the image with the current vision models. Please try again with a different image format (PNG, JPG, WebP).";
        }

        // 4. Deduct user credits upon success
        try {
            await deductCredits(state.userId, 'image');
        } catch {}

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