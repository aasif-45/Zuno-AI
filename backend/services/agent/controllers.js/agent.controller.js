import axios from "axios";
import { graph } from "../graph/graph.js";
import { getMemory, addMessage } from "../config/memory.js";
import { saveMessageToDb, updateTitleInDb } from "../utils/saveMessage.js";
import { generateTitle, enforceBrandIdentity } from "../config/llmModel.js";
import { uploadToS3 } from "../utils/uloadToS3.js";
import { checkAgentLimit } from "../config/agentLimit.js";

export const agentController = async (req, res) => {
  try {
    const { prompt, conversationId, agent } = req.body;

    const file = req.file

    // Build public file metadata for the uploaded attachment (if any).
    // The uploaded file lives in memory (multer.memoryStorage -> req.file.buffer);
    // we push it to a private S3 bucket and expose it through the agent service's
    // /uploads/:key route which 302-redirects to a short-lived presigned URL.
    // The gateway proxies /api/agent -> AGENT_SERVICE WITHOUT stripping the
    // /api/agent prefix (express-http-proxy preserves the mounted path), so the
    // public path is /api/agent/uploads/<encoded-key>.
    let fileMeta = {};
    if (file) {
      try {
        const safeName = file.originalname
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9._-]/g, "");
        const key = `${Date.now()}-${safeName}`;

        await uploadToS3(key, file.buffer, file.mimetype);

        fileMeta = {
          fileName: file.originalname,
          fileType: file.mimetype,
          fileUrl: `/api/agent/uploads/${encodeURIComponent(key)}`,
        };
      } catch (uploadErr) {
        // Non-fatal: log and continue the AI response without file metadata.
        console.error("[S3] File upload failed, continuing without fileMeta:", uploadErr);
        fileMeta = {};
      }
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    console.log(`\n---------------------------------------------------------`);
    console.log(`🚀 [Agent Controller] New Request: "${prompt.slice(0, 60)}" | Requested Mode: "${agent || "auto"}"`);

    const userId = req.headers["x-user-id"] || req.body?.userId || "";
    const userName = req.headers["x-user-name"] || req.body?.userName || "";
    const userEmail = req.headers["x-user-email"] || req.body?.userEmail || "";

    // Rate limit check (per user, per agent, 60s window)
    if (userId) {
      // Normalize requested agent to match the keys in agentLimit.js.
      // The router uses "imageGen"/"image"; limits use "image".
      const requested = (agent || "chat").toString().trim().toLowerCase();
      let limitAgent = "chat";
      if (requested === "imagegen" || requested === "image") limitAgent = "image";
      else if (requested === "coding" || requested === "code") limitAgent = "coding";
      else if (requested === "pdf") limitAgent = "pdf";
      else if (requested === "pdfrag") limitAgent = "pdfRag";
      else if (requested === "imageanalyzer") limitAgent = "imageAnalyzer";
      else if (requested === "ppt") limitAgent = "ppt";
      else if (requested === "search") limitAgent = "search";
      else limitAgent = "chat";

      try {
        await checkAgentLimit(userId, limitAgent);
      } catch (limitErr) {
        if (limitErr.status === 429) {
          return res.status(429).json(limitErr.data);
        }
        // Non-fatal (e.g. Redis down): log and continue.
        console.warn("[RateLimit] Check skipped:", limitErr.message);
      }
    }

    // Step 1: Pre-check: Verify user has remaining credits before processing AI request
    if (userId) {
      try {
        const authServiceUrl = process.env.AUTH_SERVICE || "http://localhost:3005";
        await axios.post(`${authServiceUrl}/deduct-credits`, {
          userId,
          amount: 0, // 0 amount verifies credit availability without deducting yet
        });
      } catch (creditErr) {
        if (
          creditErr.response?.status === 400 &&
          creditErr.response?.data?.message === "Not enough credits"
        ) {
          console.warn(`[Credits] Pre-check failed: User ${userId} ran out of credits.`);
          return res.status(402).json({
            success: false,
            message: "You have run out of AI credits. Please upgrade your plan in Billing to continue.",
            outOfCredits: true,
          });
        }
        console.warn("[Credits] Pre-check warning:", creditErr.response?.data || creditErr.message);
      }
    }

    // Load conversation memory
    const history = conversationId
      ? (await getMemory(conversationId)) || []
      : [];

    // Store the user's message in Redis memory & MongoDB
    if (conversationId) {
      await addMessage(conversationId, "user", prompt);
      await saveMessageToDb(conversationId, "user", prompt, [], [], fileMeta);
    }

    // Invoke the graph
    const result = await graph.invoke({
      prompt,
      conversationId,
      history,
      userName,
      userEmail,
      agent,
      file
    });

    // Final brand guard: some agents (e.g. imageAnalyzer) invoke their model
    // directly and bypass the per-model sanitizer, so enforce it once here on
    // the exact text that gets persisted and returned to the client.
    const aiResponse = enforceBrandIdentity(
      result?.aiResponse || "I encountered an issue processing your request. Please try again."
    );

    // Step 2: Post-execution: Determine the EXACT sub-agent executed and deduct appropriate cost
    if (userId) {
      try {
        const authServiceUrl = process.env.AUTH_SERVICE || "http://localhost:3005";
        let actualAgentMode = (result?.agent || agent || "chat").toString().toLowerCase().trim();

        if (
          actualAgentMode === "imagegen" ||
          actualAgentMode === "image" ||
          (result?.images && result.images.length > 0)
        ) {
          actualAgentMode = "image";
        } else if (
          actualAgentMode === "ppt" ||
          (result?.artifacts && result.artifacts.some((a) => a.type === "ppt" || a.title?.endsWith(".pptx")))
        ) {
          actualAgentMode = "ppt";
        } else if (
          actualAgentMode === "pdf" ||
          (result?.artifacts && result.artifacts.some((a) => a.type === "pdf"))
        ) {
          actualAgentMode = "pdf";
        } else if (actualAgentMode === "coding" || actualAgentMode === "code") {
          actualAgentMode = "coding";
        } else if (actualAgentMode === "search") {
          actualAgentMode = "search";
        } else {
          actualAgentMode = "chat";
        }

        console.log(`[Credits] Deducting credits for user: ${userId}, actual executed mode: ${actualAgentMode}`);
        const deductRes = await axios.post(`${authServiceUrl}/deduct-credits`, {
          userId,
          agent: actualAgentMode,
        });

        console.log(`[Credits] Successfully deducted ${deductRes.data?.deducted} credits for [${actualAgentMode}]. Remaining: ${deductRes.data?.credits}`);
      } catch (creditErr) {
        console.warn("[Credits] Post-execution credit deduction notice:", creditErr.response?.data || creditErr.message);
      }
    }

    // Store the assistant's response in Redis memory & MongoDB
    if (conversationId && aiResponse) {
      await addMessage(
        conversationId,
        "assistant",
        aiResponse,
        result?.images || [],
        result?.artifacts || []
      );
      await saveMessageToDb(conversationId, "assistant", aiResponse, result?.images || [], result?.artifacts || []);
    }

    // Generate intelligent ChatGPT-style 2-4 word summary title on first message turn
    let title = null;
    if (conversationId && history.length === 0 && aiResponse) {
      title = await generateTitle(prompt, aiResponse);
      if (title) {
        await updateTitleInDb(conversationId, title);
      }
    }

    const artifacts = result?.artifacts || [];

    return res.status(200).json({
      success: true,
      answer: aiResponse,
      images: result?.images || [],
      artifacts: artifacts,
      title: title,
      data: {
        ...result,
        aiResponse,
        answer: aiResponse,
        images: result?.images || [],
        artifacts: artifacts,
        title,
      },
    });
  } catch (error) {
    console.error("Agent controller error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const agent = agentController;