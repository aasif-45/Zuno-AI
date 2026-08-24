import puppeteer from "puppeteer";
import { randomUUID } from "crypto";

import { getModel, invokeModelWithFallback } from "../config/llmModel.js";
import { fetchImageBuffer } from "../utils/fetchImageBuffer.js";
import { HumanMessage } from "@langchain/core/messages";

import { uploadToS3 } from "../utils/uloadToS3.js";
import { getS3Url } from "../utils/getS3Url.js";

export const pdfAgent = async (state) => {
  const prompt = state.prompt?.trim();

  if (!prompt) {
    return {
      ...state,
      aiResponse: "Please tell me what you want in the PDF.",
    };
  }

  try {
    // Check if user explicitly asked for images/photos/diagrams in the prompt
    const userRequestedImages = /image|picture|photo|illustration|diagram|visual|with images|with photos|draw|graphic/i.test(prompt);

    // -----------------------------
    // 1. Generate PDF content
    // -----------------------------

    const llm = await getModel("pdf");

    const response = await invokeModelWithFallback(llm, [
      new HumanMessage(`
You are an expert professional document writer.

Create structured content for a PDF document based on the user request.

Return ONLY valid JSON with this exact schema:

{
  "title": "Document Title",
  "subtitle": "Brief professional subtitle",
  "sections": [
    {
      "heading": "Section Heading",
      "paragraphs": ["Detailed overview paragraph..."],
      "points": [
        "Item 1 with details",
        "Item 2 with details"
      ],
      "imageKeyword": "Search query for internet image if images are requested..."
    }
  ]
}

Rules:
- Create 4-8 comprehensive, well-organized sections.
- For lists or items (e.g. movies, web series, features), list each entry in "points".
- Use professional, engaging language.
- Do NOT use Markdown or HTML tags.
- Return ONLY the JSON object.

User request:
${prompt}
`),
    ]);

    const rawContent =
      typeof response?.content === "string"
        ? response.content.trim()
        : String(response?.content || "");

    const docData = extractJSON(rawContent);
    const docTitle = docData?.title || prompt;

    // Fetch images ONLY if user explicitly asked for images in prompt
    if (userRequestedImages && docData && Array.isArray(docData.sections)) {
      console.log(`🖼️ [PDF Agent] User requested images. Fetching internet photos for PDF sections...`);
      const imgPromises = docData.sections.map(async (sec) => {
        const query = sec.imageKeyword || sec.heading || docTitle;
        try {
          const buf = await fetchImageBuffer(query);
          if (buf && buf.length > 1000) {
            sec.imageBase64 = `data:image/png;base64,${buf.toString("base64")}`;
          }
        } catch (err) {
          console.warn(`Failed fetching image for PDF section "${sec.heading}":`, err.message);
        }
      });
      await Promise.allSettled(imgPromises);
    }

    // -----------------------------
    // 2. Convert content to HTML
    // -----------------------------

    const html = createPDFHTML(docTitle, docData, rawContent);

    // -----------------------------
    // 3. Generate PDF via Puppeteer
    // -----------------------------

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "16mm",
        bottom: "16mm",
        left: "16mm",
        right: "16mm",
      },
    });

    await browser.close();

    // -----------------------------
    // 4. Upload to S3
    // -----------------------------

    const userId = state.userId || "anonymous";
    const fileName = `pdf/${userId}/${Date.now()}-${randomUUID()}.pdf`;

    await uploadToS3(fileName, pdfBuffer, "application/pdf");

    // -----------------------------
    // 5. Generate download URL
    // -----------------------------

    const downloadUrl = await getS3Url(fileName, 24 * 60 * 60);

    // -----------------------------
    // 6. Return response
    // -----------------------------

    const safeTitle = docTitle.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);

    return {
      ...state,

      aiResponse:
        `## PDF Generated\n\n` +
        `I've created your document **"${escapeHTML(docTitle)}"**${userRequestedImages ? " with embedded images" : ""}.\n\n` +
        `**[Download PDF](${downloadUrl})**\n\n` +
        `*The download link expires in 24 hours.*`,

      artifacts: [
        {
          id: randomUUID(),
          type: "pdf",
          title: `${safeTitle}.pdf`,
          url: downloadUrl,
          downloadUrl: downloadUrl,
        },
      ],
      files: [
        {
          type: "pdf",
          key: fileName,
          url: downloadUrl,
          name: `${safeTitle}.pdf`,
          mimeType: "application/pdf",
          expiresIn: 86400,
        },
      ],
    };
  } catch (error) {
    console.error("PDF Agent Error:", error);

    return {
      ...state,
      aiResponse: "I couldn't generate the PDF. Please try again.",
    };
  }
};

// =====================================
// ROBUST JSON EXTRACTOR
// =====================================

function extractJSON(text = "") {
  if (!text) return null;

  // 1. Check inside markdown codeblock if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : text;

  // 2. Locate first { and last }
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubStr = candidate.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSubStr);
    } catch (e) {
      console.warn("JSON parse failed on candidate string:", e.message);
    }
  }

  return null;
}

// =====================================
// EXECUTIVE PDF HTML TEMPLATE
// =====================================

function createPDFHTML(title, docData, rawContent) {
  let bodyHTML = "";

  if (docData && Array.isArray(docData.sections) && docData.sections.length > 0) {
    if (docData.subtitle) {
      bodyHTML += `<div class="subtitle">${escapeHTML(docData.subtitle)}</div>`;
    }

    docData.sections.forEach((sec) => {
      bodyHTML += `<div class="section-card">`;
      if (sec.heading) {
        bodyHTML += `<h2 class="section-heading">${escapeHTML(sec.heading)}</h2>`;
      }
      if (Array.isArray(sec.paragraphs)) {
        sec.paragraphs.forEach((p) => {
          if (p) bodyHTML += `<p class="paragraph-text">${escapeHTML(p)}</p>`;
        });
      }

      // Render image if fetched for this section
      if (sec.imageBase64) {
        bodyHTML += `
          <div class="image-container">
            <img src="${sec.imageBase64}" alt="${escapeHTML(sec.heading || title)}" class="section-image" />
          </div>
        `;
      }

      if (Array.isArray(sec.points) && sec.points.length > 0) {
        bodyHTML += `<ul class="points-list">`;
        sec.points.forEach((pt) => {
          if (pt) bodyHTML += `<li>${escapeHTML(pt)}</li>`;
        });
        bodyHTML += `</ul>`;
      }
      bodyHTML += `</div>`;
    });
  } else {
    // Fallback for unstructured output
    bodyHTML = `<div class="section-card">` + rawContent
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (line.startsWith("- ")) return `<li>${escapeHTML(line.slice(2))}</li>`;
        if (line.endsWith(":") && line.length < 100) return `<h2 class="section-heading">${escapeHTML(line.slice(0, -1))}</h2>`;
        return `<p class="paragraph-text">${escapeHTML(line)}</p>`;
      })
      .join("\n") + `</div>`;
  }

  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@page {
  size: A4;
  margin: 15mm;
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  background: #ffffff;
  line-height: 1.6;
  font-size: 13.5px;
  margin: 0;
  padding: 0;
}

/* Header Banner */
.header-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2.5px solid #4f46e5;
  padding-bottom: 12px;
  margin-bottom: 20px;
}

.document-title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.02em;
}

.brand-badge {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  font-weight: 600;
  font-family: monospace;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.subtitle {
  font-size: 14px;
  color: #64748b;
  font-weight: 400;
  margin-top: -10px;
  margin-bottom: 22px;
  line-height: 1.5;
}

/* Section Cards */
.section-card {
  background: #ffffff;
  margin-bottom: 18px;
  page-break-inside: avoid;
}

.section-heading {
  font-size: 16px;
  font-weight: 600;
  color: #1e1b4b;
  border-left: 4px solid #4f46e5;
  padding-left: 10px;
  margin-top: 14px;
  margin-bottom: 10px;
}

.paragraph-text {
  color: #334155;
  margin: 6px 0 10px 0;
  font-size: 13.5px;
}

/* Embedded Images */
.image-container {
  margin: 12px 0;
  text-align: center;
}

.section-image {
  max-width: 100%;
  max-height: 280px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Points & Lists */
.points-list {
  margin: 8px 0;
  padding: 0;
  list-style: none;
}

.points-list li {
  position: relative;
  padding: 8px 12px 8px 24px;
  margin-bottom: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #1e293b;
  font-size: 13px;
}

.points-list li::before {
  content: "•";
  position: absolute;
  left: 10px;
  top: 7px;
  color: #4f46e5;
  font-size: 16px;
  font-weight: bold;
}

/* Footer */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #94a3b8;
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
  background: #ffffff;
}
</style>
</head>
<body>

<div class="header-banner">
  <div>
    <h1 class="document-title">${escapeHTML(title)}</h1>
  </div>
  <div class="brand-badge">ZUNO AI DOCUMENT</div>
</div>

${bodyHTML}

<div class="footer">
  <span>Generated by Zuno AI</span>
  <span>${currentDate}</span>
</div>

</body>
</html>
`;
}

// =====================================
// HTML ESCAPE
// =====================================

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
