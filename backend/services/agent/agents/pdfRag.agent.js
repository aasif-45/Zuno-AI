import { PDFParse } from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { vectorStore } from '../config/vectorDb.js';
import { getModel } from '../config/llmModel.js';
import { checkAgentLimit } from '../config/agentLimit.js';
import { deductCredits } from '../utils/deductCredits.js';

export const pdfRag = async (state) => {
    try {
        // 1. Check rate limits for PDF agent
        await checkAgentLimit(state.userId, 'pdf');

        // 2. Read the uploaded PDF file buffer from memory (multer.memoryStorage)
        const buffer = state.file.buffer;

        // 3. Extract text content from the PDF buffer (pdf-parse v2 class API)
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        const text = pdfData.text;

        // 4. Split extracted text into smaller chunks
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const docs = await splitter.createDocuments([text]);

        // 5. Store document chunks & embeddings in Qdrant Vector Store
        const collectionName = `pdf_${Date.now()}`;
        const store = await vectorStore(docs, collectionName);

        // 6. Perform similarity search in Qdrant based on user prompt
        const query = state.prompt;
        const relevantDocs = await store.similaritySearch(query, 5);

        // 7. Merge relevant document chunks into context
        const context = relevantDocs
            .map((doc) => doc.pageContent)
            .join('\n\n');

        // 8. Load LLM model (e.g., Groq / Gemini)
        const llm = await getModel('pdfRag');

        // 9. Construct RAG prompt with System and Human messages
        const messages = [
            new SystemMessage(
                `You are CORTEX AI PDF Assistant.
Answer ONLY using the provided PDF context.
Never make up information.
If the answer is not present in the PDF context, reply: "I could not find this information in the uploaded PDF."
Use Markdown formatting.`
            ),
            new HumanMessage(
                `Context:
${context}

Question:
${query}`
            )
        ];

        // 10. Invoke LLM and get grounded answer
        const response = await llm.invoke(messages);

        // 11. Deduct credits upon successful response
        await deductCredits(state.userId, 'pdf');

        return {
            ...state,
            aiResponse: response.content
        };

    } catch (error) {
        console.error('Error in PDF RAG Agent:', error);
        return {
            ...state,
            aiResponse: error.message || 'Failed to analyze PDF'
        };
    }
};