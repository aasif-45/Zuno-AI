import axios from "axios";
import { randomUUID } from "crypto";

import {
  getModel,
  invokeModelWithFallback,
} from "../config/llmModel.js";

import { HumanMessage } from "@langchain/core/messages";

import { uploadToS3 } from "../utils/uloadToS3.js";
import { getS3Url } from "../utils/getS3Url.js";

export const imageGenAgent = async (state) => {
  const prompt = state.prompt?.trim() || "artwork";

  let enhancedPrompt = prompt;

  // ==========================================
  // 1. ENHANCE USER PROMPT
  // ==========================================

  try {
    const llm = await getModel("chat");

    const refinerPrompt = `
You are an expert AI image prompt engineer.

Convert the user's request into a high-quality image generation prompt.

Improve:
- Subject
- Environment
- Composition
- Lighting
- Camera perspective
- Colors
- Materials
- Mood
- Details
- Realism

Create a visually rich but concise prompt.

Return ONLY the final image prompt.
Do not add explanations.
Do not use Markdown.
Maximum 60 words.

User request:
${prompt}
`;

    const response = await invokeModelWithFallback(
      llm,
      [new HumanMessage(refinerPrompt)]
    );

    if (typeof response?.content === "string") {
      const cleaned = response.content
        .trim()
        .replace(/^["']|["']$/g, "");

      if (cleaned) {
        enhancedPrompt = cleaned;
      }
    }
  } catch (error) {
    console.warn(
      "Prompt enhancement failed. Using original prompt:",
      error.message
    );
  }

  // ==========================================
  // 2. GENERATE IMAGE BUFFER (Cloudflare Worker -> Pollinations Fallback)
  // ==========================================

  let buffer;

  // Primary: Cloudflare Worker Free Image Generation API
  try {
    const cfEndpoint = process.env.CF_IMAGE_API_URL || "https://free-image-generation-api.mmaa67918.workers.dev/";
    const cfApiKey = process.env.CF_IMAGE_API_KEY || "your-secret-api-key-aasif";

    console.log("🎨 Attempting primary image generation via Cloudflare Worker API...");

    const cfRes = await axios.post(
      cfEndpoint,
      {
        prompt: enhancedPrompt,
        width: 1024,
        height: 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${cfApiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 60000,
      }
    );

    if (cfRes?.data && cfRes.data.length > 0) {
      buffer = Buffer.from(cfRes.data);
      console.log(`✅ Cloudflare Worker image generated successfully (${buffer.length} bytes)`);
    }
  } catch (error) {
    console.warn("⚠️ Cloudflare Worker image API failed. Falling back to Pollinations AI:", error.message);
  }

  // Fallback: Pollinations AI
  if (!buffer) {
    try {
      const finalPrompt = `${enhancedPrompt}, ultra realistic, high detail, professional photography, natural lighting, sharp focus`;
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

      console.log("🎨 Generating image via Pollinations AI fallback:", imageUrl);

      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };

      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        headers,
      });
      buffer = Buffer.from(imageResponse.data);
    } catch (error) {
      console.error("Image generation download failed:", error.message);

      return {
        ...state,
        aiResponse:
          "I generated the image, but I couldn't download it for storage. Please try again.",
      };
    }
  }

  // ==========================================
  // 4. CREATE UNIQUE S3 FILE NAME
  // ==========================================

  const userId = state.userId || "anonymous";

  const fileName = `images/${userId}/${randomUUID()}.png`;

  // ==========================================
  // 5. UPLOAD IMAGE TO S3
  // ==========================================

  try {
    await uploadToS3(
      fileName,
      buffer,
      "image/png"
    );

    console.log(
      "Image uploaded to S3:",
      fileName
    );
  } catch (error) {
    console.error(
      "S3 upload failed:",
      error.message
    );

    return {
      ...state,
      aiResponse:
        "The image was generated, but I couldn't save it. Please try again.",
    };
  }

  // ==========================================
  // 6. GENERATE PRESIGNED URL
  // ==========================================

  let downloadUrl;

  try {
    // 24 hours
    downloadUrl = await getS3Url(
      fileName,
      24 * 60 * 60
    );
  } catch (error) {
    console.error(
      "Failed to generate S3 URL:",
      error.message
    );

    return {
      ...state,
      aiResponse:
        "The image was generated and saved, but I couldn't create the access link.",
    };
  }

  // ==========================================
  // 7. RETURN RESPONSE
  // ==========================================

  const aiResponse = `Here is your generated image for **"${prompt}"**:

![Generated Image](${downloadUrl})

[Download Image](${downloadUrl})

*The download link expires in 24 hours.*`;

  return {
    ...state,

    aiResponse,

    // Useful for your frontend
    images: [downloadUrl],

    // Useful if you later save metadata
    imageData: {
      key: fileName,
      url: downloadUrl,
      prompt,
      enhancedPrompt,
      expiresIn: 24 * 60 * 60,
    },
  };
};


