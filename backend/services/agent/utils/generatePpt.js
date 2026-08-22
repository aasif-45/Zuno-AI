import pptxgen from "pptxgenjs";

/**
 * Clean hex color helper for PptxGenJS (strips # and forces 6-character uppercase hex)
 */
const cleanColor = (colorHex, defaultHex) => {
  if (!colorHex || typeof colorHex !== "string") return defaultHex;
  const hex = colorHex.replace("#", "").toUpperCase().trim();
  return hex.length === 6 ? hex : defaultHex;
};

/**
 * Calculates relative luminance to determine if a color is light or dark
 */
const isDarkColor = (colorHex) => {
  const hex = cleanColor(colorHex, "0F172A");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 160;
};

/**
 * Truncates long text strings safely to prevent text overflow
 */
const truncate = (str = "", maxLen = 120) => {
  if (!str || typeof str !== "string") return "";
  const cleaned = str.trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + "...";
};

/**
 * Professional PowerPoint Generator using PptxGenJS
 * High-Contrast Dynamic Theme Engine: Ensures perfect text readability across light and dark themes.
 */
export const generatePpt = async (data) => {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 inches (16:9 widescreen)
  pptx.author = "MY AI";
  pptx.subject = data.title || "Presentation";
  pptx.title = data.title || "MY AI Presentation";
  pptx.company = "MY AI";
  pptx.lang = "en-US";

  // Parse Raw Theme Colors
  const rawTheme = data.theme || {};
  const bgHex = cleanColor(rawTheme.background, "0F172A");
  const isDarkBg = isDarkColor(bgHex);

  // Dynamic Theme Token Palette
  const theme = {
    primary: cleanColor(rawTheme.primary, isDarkBg ? "3B82F6" : "2563EB"),
    secondary: cleanColor(rawTheme.secondary, isDarkBg ? "1E293B" : "F1F5F9"),
    accent: cleanColor(rawTheme.accent, isDarkBg ? "38BDF8" : "D97706"),
    background: bgHex,
    isDarkBg,

    // Slide Outer Header / Title Text
    titleText: isDarkBg ? "F8FAFC" : "0F172A",
    subtitleText: isDarkBg ? "94A3B8" : "475569",

    // Card Container Fill & Border
    cardBg: isDarkBg ? "1E293B" : "FFFFFF",
    cardBorder: isDarkBg ? "334155" : "CBD5E1",

    // Card Inner Content Text Colors (Guarantees high contrast!)
    cardTextPrimary: isDarkBg ? "F8FAFC" : "0F172A",
    cardTextMuted: isDarkBg ? "94A3B8" : "475569",

    // Stat Pill & Dominant Numbers
    pillBg: cleanColor(rawTheme.primary, isDarkBg ? "3B82F6" : "2563EB"),
    pillText: "FFFFFF",
    statValueText: isDarkBg ? "38BDF8" : "2563EB",
  };

  // Define Master Slide Footer & Slide Number
  const sourceText = Array.isArray(data.sources) && data.sources.length > 0
    ? `SOURCES: ${data.sources.join(" · ").toUpperCase()}`
    : (data.title || "MY AI PRESENTATION").toUpperCase();

  pptx.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: theme.background },
    objects: [
      {
        text: truncate(sourceText, 70),
        options: {
          x: 0.65,
          y: 7.1,
          w: 6.5,
          h: 0.25,
          fontSize: 8.5,
          color: theme.subtitleText,
          bold: true,
        },
      },
      {
        line: {
          x: 0.65,
          y: 6.95,
          w: 12.0,
          h: 0,
          line: { color: theme.cardBorder, width: 1 },
        },
      },
      {
        text: "MY AI",
        options: {
          x: 11.5,
          y: 7.1,
          w: 1.1,
          h: 0.25,
          fontSize: 9,
          color: theme.subtitleText,
          align: "right",
        },
      },
    ],
    slideNumber: {
      x: 12.4,
      y: 7.08,
      color: theme.primary,
      fontSize: 9,
      bold: true,
    },
  });

  // =========================================================================
  // 1. SLIDE ITERATION & ROUTING
  // =========================================================================
  const slides = Array.isArray(data.slides) ? data.slides : [];

  slides.forEach((slideData, index) => {
    const rawType = (slideData.type || slideData.layout || "imageText").toLowerCase().trim();

    switch (rawType) {
      case "hero":
      case "title":
        createHeroSlide(pptx, slideData, data, theme);
        break;

      case "imagetext":
      case "image-text":
      case "image_text":
        createImageTextSlide(pptx, slideData, theme, index);
        break;

      case "textimage":
      case "text-image":
      case "text_image":
        createTextImageSlide(pptx, slideData, theme, index);
        break;

      case "twocolumn":
      case "two-column":
      case "two_column":
        createTwoColumnSlide(pptx, slideData, theme, index);
        break;

      case "stats":
      case "stat":
      case "metrics":
        createStatsSlide(pptx, slideData, theme, index);
        break;

      case "timeline":
      case "events":
        createTimelineSlide(pptx, slideData, theme, index);
        break;

      case "comparison":
      case "compare":
        createComparisonSlide(pptx, slideData, theme, index);
        break;

      case "cards":
      case "grid":
      case "features":
        createCardsSlide(pptx, slideData, theme, index);
        break;

      case "chart":
      case "graph":
        createChartSlide(pptx, slideData, theme, index);
        break;

      case "quote":
      case "testimonial":
        createQuoteSlide(pptx, slideData, theme, index);
        break;

      case "sectiondivider":
      case "section-divider":
      case "section_divider":
      case "section":
        createSectionDividerSlide(pptx, slideData, theme, index);
        break;

      case "conclusion":
      case "summary":
        createConclusionSlide(pptx, slideData, theme, index);
        break;

      default:
        if (slideData.imageBuffer) {
          createImageTextSlide(pptx, slideData, theme, index);
        } else {
          createTwoColumnSlide(pptx, slideData, theme, index);
        }
        break;
    }
  });

  // Always create final Thank You slide
  createThankYouSlide(pptx, data, theme);

  // Generate node Buffer
  return await pptx.write({ outputType: "nodebuffer" });
};

// ===========================================================================
// REUSABLE HELPER FUNCTIONS
// ===========================================================================

function addHeaderBanner(slide, title, index, theme) {
  const numStr = String(index + 1).padStart(2, "0");

  // Section Badge
  slide.addText(`SECTION ${numStr}`, {
    x: 0.65,
    y: 0.45,
    w: 2.5,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: theme.primary,
    charSpacing: 1.5,
    margin: 0,
  });

  // Slide Title
  slide.addText(truncate(title, 65), {
    x: 0.65,
    y: 0.75,
    w: 11.8,
    h: 0.65,
    fontSize: 24,
    bold: true,
    color: theme.titleText,
    margin: 0,
    fit: "shrink",
  });

  // Accent Line
  slide.addShape("line", {
    x: 0.65,
    y: 1.48,
    w: 1.2,
    h: 0,
    line: { color: theme.primary, width: 3 },
  });
}

function addCard(slide, x, y, w, h, theme, options = {}) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: options.rectRadius || 0.08,
    fill: { color: options.fillColor || theme.cardBg },
    line: { color: options.borderColor || theme.cardBorder, width: 1 },
  });
}

function getImageDataUrl(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < 500) {
    return null;
  }
  let mime = null;
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
    mime = "image/png";
  } else if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF) {
    mime = "image/jpeg";
  } else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46) {
    mime = "image/gif";
  } else if (imageBuffer.length >= 12 && imageBuffer.slice(8, 12).toString("utf8") === "WEBP") {
    mime = "image/webp";
  } else {
    return null;
  }
  return `data:${mime};base64,${imageBuffer.toString("base64")}`;
}

function addImage(slide, imageBuffer, x, y, w, h) {
  const dataUrl = getImageDataUrl(imageBuffer);
  if (!dataUrl) {
    return false;
  }
  try {
    slide.addImage({
      data: dataUrl,
      x,
      y,
      w,
      h,
      sizing: { type: "cover" },
    });
    return true;
  } catch (err) {
    console.warn("Failed to embed image in slide:", err.message);
    return false;
  }
}

// ===========================================================================
// MODULAR SLIDE BUILDERS (HIGH CONTRAST GUARANTEED)
// ===========================================================================

// 1. HERO SLIDE
function createHeroSlide(pptx, slideData, data, theme) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  // Left Vertical Accent Bar
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.22,
    h: 7.5,
    fill: { color: theme.primary },
    line: { color: theme.primary },
  });

  // Top Badge
  slide.addText("PRESENTATION", {
    x: 0.85,
    y: 1.2,
    w: 4.5,
    h: 0.3,
    fontSize: 11,
    bold: true,
    color: theme.primary,
    charSpacing: 2,
    margin: 0,
  });

  // Embed Hero Image if available
  const heroImg = slideData.imageBuffer || data.slides?.[0]?.imageBuffer;
  const hasImage = addImage(slide, heroImg, 6.8, 1.2, 5.8, 5.0);

  if (!hasImage) {
    // Styled Card Backdrop when no image exists
    addCard(slide, 6.8, 1.2, 5.8, 5.0, theme, { borderColor: theme.primary });
    slide.addText("MY AI", {
      x: 7.3,
      y: 3.0,
      w: 4.8,
      h: 1.2,
      fontSize: 32,
      bold: true,
      color: theme.primary,
      align: "center",
      valign: "mid",
      charSpacing: 4,
    });
  }

  const titleWidth = 5.6;

  // Title
  slide.addText(truncate(slideData.title || data.title || "Presentation Title", 80), {
    x: 0.85,
    y: 1.8,
    w: titleWidth,
    h: 1.8,
    fontSize: 36,
    bold: true,
    color: theme.titleText,
    margin: 0,
    fit: "shrink",
  });

  // Subtitle
  const sub = slideData.subtitle || data.subtitle || "";
  if (sub) {
    slide.addText(truncate(sub, 120), {
      x: 0.85,
      y: 3.8,
      w: titleWidth,
      h: 0.9,
      fontSize: 18,
      color: theme.subtitleText,
      margin: 0,
      fit: "shrink",
    });
  }

  // Bottom Footer
  slide.addText("Generated with MY AI", {
    x: 0.85,
    y: 6.3,
    w: 4.5,
    h: 0.3,
    fontSize: 11,
    color: theme.subtitleText,
    margin: 0,
  });
}

// 2. IMAGE + TEXT SLIDE (40/60 Split)
function createImageTextSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title, index, theme);

  const hasImage = addImage(slide, slideData.imageBuffer, 0.65, 1.8, 4.8, 4.8);

  const textX = hasImage ? 5.75 : 0.65;
  const textW = hasImage ? 6.9 : 12.0;

  // Text Container Card
  addCard(slide, textX, 1.8, textW, 4.8, theme);

  const points = Array.isArray(slideData.points) ? slideData.points : [];

  points.slice(0, 5).forEach((pt, pIdx) => {
    const py = 2.15 + pIdx * 0.85;

    // Bullet Dot
    slide.addShape("ellipse", {
      x: textX + 0.35,
      y: py + 0.08,
      w: 0.16,
      h: 0.16,
      fill: { color: theme.primary },
      line: { color: theme.primary },
    });

    // Point Text
    slide.addText(truncate(pt, 110), {
      x: textX + 0.7,
      y: py,
      w: textW - 0.9,
      h: 0.55,
      fontSize: 14.5,
      color: theme.cardTextPrimary,
      margin: 0,
      fit: "shrink",
      valign: "mid",
    });
  });
}

// 3. TEXT + IMAGE SLIDE (60/40 Split)
function createTextImageSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title, index, theme);

  const hasImage = addImage(slide, slideData.imageBuffer, 7.85, 1.8, 4.8, 4.8);

  const textX = 0.65;
  const textW = hasImage ? 6.9 : 12.0;

  // Text Container Card
  addCard(slide, textX, 1.8, textW, 4.8, theme);

  const points = Array.isArray(slideData.points) ? slideData.points : [];

  points.slice(0, 5).forEach((pt, pIdx) => {
    const py = 2.15 + pIdx * 0.85;

    slide.addShape("ellipse", {
      x: textX + 0.35,
      y: py + 0.08,
      w: 0.16,
      h: 0.16,
      fill: { color: theme.primary },
      line: { color: theme.primary },
    });

    slide.addText(truncate(pt, 110), {
      x: textX + 0.7,
      y: py,
      w: textW - 0.9,
      h: 0.55,
      fontSize: 14.5,
      color: theme.cardTextPrimary,
      margin: 0,
      fit: "shrink",
      valign: "mid",
    });
  });
}

// 4. TWO COLUMN SLIDE
function createTwoColumnSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title, index, theme);

  let leftPts = Array.isArray(slideData.leftPoints) ? slideData.leftPoints : [];
  let rightPts = Array.isArray(slideData.rightPoints) ? slideData.rightPoints : [];

  if (leftPts.length === 0 && rightPts.length === 0) {
    const pts = Array.isArray(slideData.points) ? slideData.points : [];
    const mid = Math.ceil(pts.length / 2);
    leftPts = pts.slice(0, mid);
    rightPts = pts.slice(mid, 6);
  }

  // Column 1 Card
  addCard(slide, 0.65, 1.8, 5.8, 4.8, theme);
  leftPts.forEach((pt, pIdx) => {
    const py = 2.15 + pIdx * 1.3;
    slide.addShape("ellipse", {
      x: 0.95,
      y: py + 0.08,
      w: 0.15,
      h: 0.15,
      fill: { color: theme.primary },
    });
    slide.addText(truncate(pt, 100), {
      x: 1.25,
      y: py,
      w: 4.9,
      h: 0.8,
      fontSize: 14,
      color: theme.cardTextPrimary,
      margin: 0,
      fit: "shrink",
    });
  });

  // Column 2 Card
  addCard(slide, 6.85, 1.8, 5.8, 4.8, theme);
  rightPts.forEach((pt, pIdx) => {
    const py = 2.15 + pIdx * 1.3;
    slide.addShape("ellipse", {
      x: 7.15,
      y: py + 0.08,
      w: 0.15,
      h: 0.15,
      fill: { color: theme.primary },
    });
    slide.addText(truncate(pt, 100), {
      x: 7.45,
      y: py,
      w: 4.9,
      h: 0.8,
      fontSize: 14,
      color: theme.cardTextPrimary,
      margin: 0,
      fit: "shrink",
    });
  });
}

// 5. STATS SLIDE (PROMINENT HIGH CONTRAST METRICS)
function createStatsSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title || "Key Metrics & Impact", index, theme);

  const stats = Array.isArray(slideData.stats) ? slideData.stats : [];
  const count = Math.min(Math.max(stats.length, 1), 4);

  const totalW = 12.0;
  const gap = 0.35;
  const cardW = (totalW - gap * (count - 1)) / count;

  stats.slice(0, 4).forEach((st, sIdx) => {
    const cx = 0.65 + sIdx * (cardW + gap);

    // Stat Card Container
    addCard(slide, cx, 2.0, cardW, 4.4, theme, { borderColor: theme.primary });

    // Top Accent Pill (White bold text on Primary Accent fill)
    slide.addShape("roundRect", {
      x: cx + 0.3,
      y: 2.3,
      w: cardW - 0.6,
      h: 0.35,
      rectRadius: 0.05,
      fill: { color: theme.pillBg },
    });
    slide.addText(`METRIC ${sIdx + 1}`, {
      x: cx + 0.3,
      y: 2.3,
      w: cardW - 0.6,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: theme.pillText,
      align: "center",
      valign: "mid",
      charSpacing: 1,
    });

    // Large Dominant Value
    slide.addText(truncate(st.value || "0", 15), {
      x: cx + 0.2,
      y: 2.8,
      w: cardW - 0.4,
      h: 1.4,
      fontSize: 36,
      bold: true,
      color: theme.statValueText,
      align: "center",
      valign: "mid",
      fit: "shrink",
    });

    // Label
    slide.addText(truncate(st.label || "", 40), {
      x: cx + 0.2,
      y: 4.3,
      w: cardW - 0.4,
      h: 0.6,
      fontSize: 15,
      bold: true,
      color: theme.cardTextPrimary,
      align: "center",
      valign: "mid",
      fit: "shrink",
    });

    // Description
    if (st.description) {
      slide.addText(truncate(st.description, 80), {
        x: cx + 0.2,
        y: 5.0,
        w: cardW - 0.4,
        h: 1.1,
        fontSize: 12.5,
        color: theme.cardTextMuted,
        align: "center",
        fit: "shrink",
      });
    }
  });
}

// 6. TIMELINE SLIDE
function createTimelineSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title || "Career Progression", index, theme);

  const events = Array.isArray(slideData.events) ? slideData.events : [];
  const count = Math.min(Math.max(events.length, 1), 4);

  const cardW = 2.75;
  const gap = 0.25;

  // Horizontal Connecting Line
  slide.addShape("line", {
    x: 0.8,
    y: 2.1,
    w: 11.5,
    h: 0,
    line: { color: theme.primary, width: 3 },
  });

  events.slice(0, 4).forEach((ev, eIdx) => {
    const cx = 0.65 + eIdx * (cardW + gap);

    // Year Badge Circle on Line
    slide.addShape("ellipse", {
      x: cx + cardW / 2 - 0.35,
      y: 1.75,
      w: 0.7,
      h: 0.7,
      fill: { color: theme.pillBg },
      line: { color: theme.cardBorder, width: 2 },
    });
    slide.addText(truncate(ev.year || String(2008 + eIdx * 3), 6), {
      x: cx + cardW / 2 - 0.35,
      y: 1.75,
      w: 0.7,
      h: 0.7,
      fontSize: 10,
      bold: true,
      color: theme.pillText,
      align: "center",
      valign: "mid",
    });

    // Timeline Card
    addCard(slide, cx, 2.6, cardW, 4.0, theme);

    // Event Title
    slide.addText(truncate(ev.title || "Milestone", 40), {
      x: cx + 0.2,
      y: 2.8,
      w: cardW - 0.4,
      h: 0.6,
      fontSize: 15,
      bold: true,
      color: theme.primary,
      margin: 0,
      fit: "shrink",
    });

    // Description
    slide.addText(truncate(ev.description || "", 120), {
      x: cx + 0.2,
      y: 3.5,
      w: cardW - 0.4,
      h: 2.8,
      fontSize: 13,
      color: theme.cardTextPrimary,
      margin: 0,
      fit: "shrink",
    });
  });
}

// 7. COMPARISON SLIDE
function createComparisonSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title || "Side-by-Side Comparison", index, theme);

  const items = Array.isArray(slideData.items) ? slideData.items : [];

  // Item A Card
  addCard(slide, 0.65, 1.8, 5.7, 4.8, theme, { borderColor: theme.primary });
  const itemA = items[0] || { label: "Category A", value: "Primary specifications and advantages" };
  slide.addText((itemA.label || "OPTION A").toUpperCase(), {
    x: 0.95,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: theme.primary,
    charSpacing: 1.5,
  });
  slide.addText(truncate(itemA.value || "", 200), {
    x: 0.95,
    y: 2.7,
    w: 5.1,
    h: 3.6,
    fontSize: 14,
    color: theme.cardTextPrimary,
    fit: "shrink",
  });

  // Item B Card
  addCard(slide, 6.95, 1.8, 5.7, 4.8, theme, { borderColor: theme.primary });
  const itemB = items[1] || { label: "Category B", value: "Secondary specifications and advantages" };
  slide.addText((itemB.label || "OPTION B").toUpperCase(), {
    x: 7.25,
    y: 2.1,
    w: 5.0,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: theme.primary,
    charSpacing: 1.5,
  });
  slide.addText(truncate(itemB.value || "", 200), {
    x: 7.25,
    y: 2.7,
    w: 5.1,
    h: 3.6,
    fontSize: 14,
    color: theme.cardTextPrimary,
    fit: "shrink",
  });
}

// 8. CARDS SLIDE (Grid Attributes)
function createCardsSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title || "Key Features & Attributes", index, theme);

  const cards = Array.isArray(slideData.cards) ? slideData.cards : [];
  const cardW = 3.75;
  const gap = 0.35;

  cards.slice(0, 3).forEach((cd, cIdx) => {
    const cx = 0.65 + cIdx * (cardW + gap);

    // Feature Card
    addCard(slide, cx, 1.8, cardW, 4.8, theme);

    // Top Icon Badge
    slide.addShape("roundRect", {
      x: cx + 0.3,
      y: 2.1,
      w: 0.5,
      h: 0.5,
      rectRadius: 0.05,
      fill: { color: theme.pillBg },
    });
    slide.addText(String(cIdx + 1), {
      x: cx + 0.3,
      y: 2.1,
      w: 0.5,
      h: 0.5,
      fontSize: 14,
      bold: true,
      color: theme.pillText,
      align: "center",
      valign: "mid",
    });

    // Card Title
    slide.addText(truncate(cd.title || `Attribute ${cIdx + 1}`, 45), {
      x: cx + 0.3,
      y: 2.8,
      w: cardW - 0.6,
      h: 0.6,
      fontSize: 16,
      bold: true,
      color: theme.primary,
      fit: "shrink",
    });

    // Card Description
    slide.addText(truncate(cd.description || "", 140), {
      x: cx + 0.3,
      y: 3.5,
      w: cardW - 0.6,
      h: 2.8,
      fontSize: 13.5,
      color: theme.cardTextPrimary,
      fit: "shrink",
    });
  });
}

// 9. NATIVE CHART SLIDE
function createChartSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title || "Data Analytics", index, theme);

  const labels = Array.isArray(slideData.labels) && slideData.labels.length > 0
    ? slideData.labels
    : ["Q1", "Q2", "Q3", "Q4"];

  const values = Array.isArray(slideData.values) && slideData.values.length > 0
    ? slideData.values
    : [25, 45, 60, 85];

  const chartData = [
    {
      name: slideData.title || "Performance",
      labels,
      values,
    },
  ];

  const chartTypeStr = (slideData.chartType || "bar").toLowerCase();
  let chartType = pptx.ChartType.bar;
  if (chartTypeStr === "line") chartType = pptx.ChartType.line;
  if (chartTypeStr === "doughnut" || chartTypeStr === "pie") chartType = pptx.ChartType.doughnut;

  try {
    slide.addChart(chartType, chartData, {
      x: 0.65,
      y: 1.8,
      w: 12.0,
      h: 4.8,
      chartColors: [theme.primary, theme.accent, "10B981", "F59E0B"],
      showValue: true,
      valGridLine: { color: theme.cardBorder, width: 0.5 },
      catAxisLabelColor: theme.titleText,
      valAxisLabelColor: theme.titleText,
      legendPos: "b",
      legendColor: theme.titleText,
    });
  } catch (err) {
    console.warn("Failed to render native chart slide:", err.message);
    createTwoColumnSlide(pptx, slideData, theme, index);
  }
}

// 10. QUOTE SLIDE
function createQuoteSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title || "Key Insight", index, theme);

  addCard(slide, 1.2, 2.0, 10.9, 4.4, theme, { borderColor: theme.primary });

  // Quote Mark Graphic
  slide.addText("“", {
    x: 1.5,
    y: 2.1,
    w: 1.0,
    h: 1.0,
    fontSize: 72,
    bold: true,
    color: theme.primary,
  });

  // Quote Content
  slide.addText(truncate(slideData.quote || "Success is not final, failure is not fatal: it is the courage to continue that counts.", 180), {
    x: 1.8,
    y: 2.8,
    w: 9.7,
    h: 2.2,
    fontSize: 22,
    italic: true,
    color: theme.cardTextPrimary,
    fit: "shrink",
  });

  // Author Attribution
  if (slideData.author) {
    slide.addText(`— ${slideData.author.toUpperCase()}`, {
      x: 1.8,
      y: 5.2,
      w: 9.7,
      h: 0.5,
      fontSize: 14,
      bold: true,
      color: theme.primary,
      charSpacing: 1.5,
    });
  }
}

// 11. SECTION DIVIDER SLIDE
function createSectionDividerSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  // Full Center Backdrop Card
  addCard(slide, 1.0, 1.5, 11.33, 4.5, theme, { borderColor: theme.primary });

  // Accent Pill
  slide.addText(`SECTION ${String(index + 1).padStart(2, "0")}`, {
    x: 1.5,
    y: 2.2,
    w: 4.0,
    h: 0.4,
    fontSize: 12,
    bold: true,
    color: theme.primary,
    charSpacing: 2,
  });

  // Title
  slide.addText(truncate(slideData.title || "Section Overview", 70), {
    x: 1.5,
    y: 2.8,
    w: 10.3,
    h: 1.5,
    fontSize: 34,
    bold: true,
    color: theme.cardTextPrimary,
    fit: "shrink",
  });

  // Subtitle
  if (slideData.subtitle) {
    slide.addText(truncate(slideData.subtitle, 120), {
      x: 1.5,
      y: 4.5,
      w: 10.3,
      h: 0.8,
      fontSize: 16,
      color: theme.cardTextMuted,
      fit: "shrink",
    });
  }
}

// 12. CONCLUSION SLIDE
function createConclusionSlide(pptx, slideData, theme, index) {
  const slide = pptx.addSlide("MASTER_SLIDE");
  addHeaderBanner(slide, slideData.title || "Conclusion & Key Takeaways", index, theme);

  addCard(slide, 0.65, 1.8, 12.0, 4.8, theme, { borderColor: theme.primary });

  const points = Array.isArray(slideData.points) ? slideData.points : [];

  points.slice(0, 5).forEach((pt, pIdx) => {
    const py = 2.15 + pIdx * 0.85;

    // Checkmark Badge
    slide.addText("✓", {
      x: 1.05,
      y: py,
      w: 0.3,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: theme.primary,
      valign: "mid",
    });

    slide.addText(truncate(pt, 120), {
      x: 1.45,
      y: py,
      w: 10.8,
      h: 0.55,
      fontSize: 15,
      color: theme.cardTextPrimary,
      margin: 0,
      fit: "shrink",
      valign: "mid",
    });
  });
}

// 13. THANK YOU / CLOSING SLIDE
function createThankYouSlide(pptx, data, theme) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  // Center Content Card
  addCard(slide, 2.0, 1.8, 9.33, 4.0, theme, { borderColor: theme.primary });

  slide.addText("THANK YOU", {
    x: 2.5,
    y: 2.3,
    w: 8.33,
    h: 1.0,
    fontSize: 42,
    bold: true,
    color: theme.primary,
    align: "center",
    valign: "mid",
    charSpacing: 3,
  });

  slide.addText(truncate(data.title || "Presentation Completed", 70), {
    x: 2.5,
    y: 3.5,
    w: 8.33,
    h: 0.8,
    fontSize: 18,
    color: theme.cardTextPrimary,
    align: "center",
    valign: "mid",
  });

  slide.addText("Generated with MY AI", {
    x: 2.5,
    y: 4.6,
    w: 8.33,
    h: 0.4,
    fontSize: 11,
    color: theme.cardTextMuted,
    align: "center",
  });
}