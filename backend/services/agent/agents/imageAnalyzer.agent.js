import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { getModel } from '../config/llmModel.js';
import { checkAgentLimit } from '../config/agentLimit.js';
import { deductCredits } from '../utils/deductCredits.js';

export const imageAnalyzer = async (state) => {
    try {
        // 1. Check rate limits
        await checkAgentLimit(state.userId, 'image');

        // 2. Load LLM model
        const llm = await getModel('imageAnalyzer');

        // 3. Convert image file buffer to Base64 (buffer from multer.memoryStorage)
        const imageBuffer = state.file.buffer;
        const base64Image = imageBuffer.toString('base64');

        // 4. Construct messages array
        const messages = [
            new SystemMessage(
                `You are a CORTEX AI image analyzer agent.
Rules:
- Analyze only the uploaded image.
- Answer the user's question accurately.
- If text exists in the image, extract it.
- If charts or tables exist, explain them.
- If something is unclear, say so.
- Use Markdown when helpful.`
            ),
            new HumanMessage({
                content: [
                    {
                        type: 'text',
                        text: state.prompt || 'Analyze the image'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${state.file.mimetype};base64,${base64Image}`
                        }
                    }
                ]
            })
        ];

        // 5. Invoke LLM and get response
        const response = await llm.invoke(messages);

        // 6. Deduct user credits upon success
        await deductCredits(state.userId, 'vision');

        return {
            ...state,
            aiResponse: response.content
        };

    } catch (error) {
        console.error('Error in Image Analyzer Agent:', error);
        return {
            ...state,
            aiResponse: error.message || 'Failed to analyze image'
        };
    }
};