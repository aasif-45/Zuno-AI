import { StateGraph, START, END } from '@langchain/langgraph';
import { agentState } from './state.js';
import { router } from './router.js';
import { chatAgent } from '../agents/chat.agent.js';
import { codingAgent } from '../agents/coding.agent.js';
import { imageGenAgent } from '../agents/imageGen.agent.js';
import { pdfAgent } from '../agents/pdf.agent.js';
import { pptAgent } from '../agents/ppt.agent.js';
import { searchAgent } from '../agents/search.agent.js';
import { pdfRag } from '../agents/pdfRag.agent.js';
import { imageAnalyzer } from '../agents/imageAnalyzer.agent.js';

const workflow = new StateGraph(agentState);

workflow.addNode("router", router);
workflow.addNode("chat", chatAgent);
workflow.addNode("coding", codingAgent);
workflow.addNode("imageGen", imageGenAgent);
workflow.addNode("pdf", pdfAgent);
workflow.addNode("ppt", pptAgent);
workflow.addNode("search", searchAgent);
workflow.addNode("pdfRag", pdfRag);
workflow.addNode("imageAnalyzer", imageAnalyzer);

workflow.addEdge(START, "router");

workflow.addConditionalEdges("router", (state) => {
    const agent = (state.agent || "").toString().trim().toLowerCase().replace(/[^a-z]/g, "");
    switch (agent) {
        case "chat":
            return "chat";
        case "search":
            return "search";    
        case "coding":
            return "coding";
        case "pdf":
            return "pdf";
        case "ppt":
            return "ppt";    
        case "imagegen":
            return "imageGen";
        case "image":
            return "imageGen"; 
        case "pdfrag":
            return "pdfRag";
        case "imageanalyzer":
            return "imageAnalyzer";             
        default:
            return "chat";
    }
}, {
   chat: "chat",
   search: "search",
   coding: "coding",
   pdf: "pdf",
   ppt: "ppt",
   imageGen: "imageGen",
   pdfRag: "pdfRag",
   imageAnalyzer: "imageAnalyzer",
});

workflow.addEdge("search", "chat");
workflow.addEdge("chat", END);
workflow.addEdge("coding", END);
workflow.addEdge("imageGen", END);
workflow.addEdge("pdf", END);
workflow.addEdge("ppt", END);
workflow.addEdge("pdfRag", END);
workflow.addEdge("imageAnalyzer", END);
export const graph = workflow.compile();
