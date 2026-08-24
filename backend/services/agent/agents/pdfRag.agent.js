import { PDFParse } from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { vectorStore } from '../config/vectorDb.js';
import { getModel, invokeModelWithFallback } from '../config/llmModel.js';
import { checkAgentLimit } from '../config/agentLimit.js';
import { deductCredits } from '../utils/deductCredits.js';

export const pdfRag = async (state) => {
    try {
        // 1. Check rate limits for PDF agent
        if (state.userId) {
            try {
                await checkAgentLimit(state.userId, 'pdf');
            } catch (lErr) {
                console.warn("Limit check warning:", lErr.message);
            }
        }

        // 2. Read the uploaded PDF file buffer from memory (multer.memoryStorage)
        const buffer = state.file?.buffer;
        if (!buffer) {
            return {
                ...state,
                aiResponse: "No PDF file was uploaded. Please upload a PDF to analyze."
            };
        }

        // 3. Extract text content from the PDF buffer (pdf-parse v2 class API)
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        const text = pdfData?.text || "";

        if (!text.trim()) {
            return {
                ...state,
                aiResponse: "The uploaded PDF appears to be empty or contains scanned images without selectable text."
            };
        }

        // 4. Split extracted text into smaller chunks
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const docs = await splitter.createDocuments([text]);

        // 5. Store document chunks & embeddings in Qdrant Vector Store
        let context = text.slice(0, 4000);
        try {
            const collectionName = `pdf_${Date.now()}`;
            const store = await vectorStore(docs, collectionName);
            const query = state.prompt || "Summarize the key points of this document.";
            const relevantDocs = await store.similaritySearch(query, 5);
            if (relevantDocs && relevantDocs.length > 0) {
                context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');
            }
        } catch (vecErr) {
            console.warn("Vector search fallback to direct text context:", vecErr.message);
        }

        // 6. Load LLM model
        const llm = await getModel('pdf');
        const query = state.prompt || "Summarize the key points of this document.";

        // 7. Construct RAG prompt with System and Human messages
        const messages = [
            new SystemMessage(
                `You are Zuno-AI, an AI assistant created for the Zuno-AI platform.

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

PDF Assistant Rules:
Answer accurately using the provided PDF context.
Never make up information.
If the answer is not present in the PDF context, reply: "I could not find this information in the uploaded PDF."
Use clean Markdown formatting.`
            ),
            new HumanMessage(
                `Context:
${context}

Question:
${query}`
            )
        ];

        // 8. Invoke LLM and get grounded answer
        const response = await invokeModelWithFallback(llm, messages);
        const textOutput = typeof response?.content === "string" ? response.content : String(response?.content || "");

        // 9. Deduct credits upon successful response
        if (state.userId) {
            try {
                await deductCredits(state.userId, 'pdf');
            } catch {}
        }

        return {
            ...state,
            aiResponse: textOutput || "I have analyzed the document."
        };

    } catch (error) {
        console.error('Error in PDF RAG Agent:', error);
        return {
            ...state,
            aiResponse: error.message || 'Failed to analyze PDF'
        };
    }
};