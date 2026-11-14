import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { buildAiCreativePrompt, mapAspectRatioForGemini } from "./src/utils/aiCreative";
import type { AiCreativeMode, AspectRatio } from "./src/types";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to extract raw base64 and mimeType from data URL or raw base64
function parseImagePayload(imageBase64: string, fallbackMime = "image/jpeg"): { data: string; mimeType: string } {
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return {
    mimeType: fallbackMime,
    data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
  };
}

function cleanJsonResponse(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

// Endpoint: AI Product Analysis & Marketing Copy Generator
app.post("/api/ai/analyze-and-copy", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", productName, category, targetVibe } = req.body;

    const parts: any[] = [];
    if (imageBase64 && !imageBase64.startsWith("/")) {
      const parsedImg = parseImagePayload(imageBase64, mimeType);
      parts.push({
        inlineData: {
          data: parsedImg.data,
          mimeType: parsedImg.mimeType,
        },
      });
    }

    const promptText = `
You are a world-class creative art director and e-commerce marketing genius specializing in high-converting product cover ads and poster design.
Analyze this product image or details:
- Product Name hint: "${productName || "Unknown"}"
- Category hint: "${category || "General"}"
- Target Vibe / Style: "${targetVibe || "Modern Aesthetic"}"

Return a valid JSON object strictly matching this schema:
{
  "productTitle": "Detected or polished concise product title",
  "category": "Detected category (e.g. Kozmetik & Parfüm, Teknoloji, İçecek, Moda, Gıda, E-Ticaret)",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "marketingHeadlines": [
    { "eyebrow": "Kısa Çarpıcı Giriş", "title": "Büyük Vurucu Başlık", "subtitle": "Açıklayıcı alt metin", "cta": "Buton Metni" }
  ],
  "featureBadges": [
    { "icon": "shield|sparkles|droplet|sun|award|zap|leaf|clock", "label": "Örn: %100 Orijinal" },
    { "icon": "sparkles", "label": "Örn: 24s Kalıcı" },
    { "icon": "award", "label": "Örn: Premium Seri" }
  ],
  "pricingBadges": [
    { "tag": "%25 İNDİRİM", "sub": "Sınırlı Stok" },
    { "tag": "ÜCRETSİZ KARGO", "sub": "Aynı Gün Teslimat" }
  ],
  "compositionAdvice": "1-2 sentences on best background, lighting, and placement advice",
  "recommendedAiPrompt": "High-fidelity English prompt to generate matching commercial studio background or scene for this product"
}

Provide Turkish copy with premium advertising tone (like Apple, Nike, Dior, GoPro, Domestika campaigns). Return ONLY pure JSON.
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = cleanJsonResponse(response.text || "{}");
    const parsed = JSON.parse(text);
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI Analysis error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Yapay zeka analizinde hata oluştu",
    });
  }
});

// Endpoint: AI Visual Center of Gravity & Bounding Box Detection for Golden Ratio Alignment
app.post("/api/ai/detect-center-of-gravity", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/png" } = req.body;

    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.startsWith("/")) {
      return res.status(400).json({
        success: false,
        error: "Ağırlık merkezi tespiti için geçerli bir görsel verisi gerekli.",
      });
    }

    const parsedImg = parseImagePayload(imageBase64, mimeType);

    const promptText = `
You are an expert computer vision and visual composition physicist.
Analyze this product image and determine the product's PERCEPTUAL VISUAL CENTER OF GRAVITY (ağırlık merkezi) inside the frame using normalized coordinates from 0.0 (left/top edge) to 1.0 (right/bottom edge).

Guidelines:
- Visual center of gravity is NOT always the simple bounding-box midpoint (0.5, 0.5).
- Consider physical volume, base mass, dense/heavy regions (e.g., thick glass base of a perfume bottle sits lower around y=0.58-0.65; sneaker heel/midsole pulls weight toward heel; tilted bottle or asymmetric handle shifts horizontal visual mass).
- Also identify the tight normalized bounding box of the visible product itself (ignoring transparent or solid outer margins).
- Write a concise 1-sentence Turkish "rationale" explaining where the product's visual weight is concentrated.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: {
        parts: [
          {
            inlineData: {
              data: parsedImg.data,
              mimeType: parsedImg.mimeType,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            centerOfGravityX: {
              type: Type.NUMBER,
              description: "Normalized horizontal visual center of gravity (0.0 to 1.0).",
            },
            centerOfGravityY: {
              type: Type.NUMBER,
              description: "Normalized vertical visual center of gravity (0.0 to 1.0).",
            },
            boundingBox: {
              type: Type.OBJECT,
              properties: {
                xMin: { type: Type.NUMBER },
                yMin: { type: Type.NUMBER },
                xMax: { type: Type.NUMBER },
                yMax: { type: Type.NUMBER },
              },
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score from 0.0 to 1.0.",
            },
            rationale: {
              type: Type.STRING,
              description: "1-sentence Turkish explanation of where the visual mass sits.",
            },
          },
        },
      },
    });

    const parsed = JSON.parse(cleanJsonResponse(response.text || "{}"));
    const clamp01 = (v: unknown, def: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0.05, Math.min(0.95, n)) : def;
    };

    const cgX = clamp01(parsed.centerOfGravityX, 0.5);
    const cgY = clamp01(parsed.centerOfGravityY, 0.55);
    const bbox = parsed.boundingBox || {};
    const xMin = Math.max(0, Math.min(0.9, Number(bbox.xMin) || 0.05));
    const yMin = Math.max(0, Math.min(0.9, Number(bbox.yMin) || 0.05));
    const xMax = Math.max(xMin + 0.05, Math.min(1, Number(bbox.xMax) || 0.95));
    const yMax = Math.max(yMin + 0.05, Math.min(1, Number(bbox.yMax) || 0.95));

    return res.json({
      success: true,
      data: {
        centerOfGravityX: Number(cgX.toFixed(4)),
        centerOfGravityY: Number(cgY.toFixed(4)),
        boundingBox: {
          xMin: Number(xMin.toFixed(4)),
          yMin: Number(yMin.toFixed(4)),
          xMax: Number(xMax.toFixed(4)),
          yMax: Number(yMax.toFixed(4)),
        },
        confidence: Math.max(0.2, Math.min(1, Number(parsed.confidence) || 0.9)),
        rationale:
          typeof parsed.rationale === "string" && parsed.rationale.trim()
            ? parsed.rationale.trim()
            : `Ürünün görsel ağırlık merkezi (%${Math.round(cgX * 100)}, %${Math.round(cgY * 100)}) yapay zeka ile tespit edildi.`,
      },
    });
  } catch (error: any) {
    console.error("AI Center of Gravity error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Ağırlık merkezi tespitinde hata oluştu",
    });
  }
});

// Endpoint: AI Product Color Harmony & Typography Palette Advisor
app.post("/api/ai/color-harmony", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/png", extractedHexes = [] } = req.body;

    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.startsWith("/")) {
      return res.status(400).json({
        success: false,
        error: "Renk harmonisi analizi için geçerli ürün görseli gerekli.",
      });
    }

    const parsedImg = parseImagePayload(imageBase64, mimeType);
    const hexHint = Array.isArray(extractedHexes) && extractedHexes.length > 0
      ? `Detected dominant pixel hexes: ${extractedHexes.join(", ")}.`
      : "";

    const promptText = `
You are a senior brand colorist and advertising art director.
Inspect this product image and its color tones. ${hexHint}
Design 2 distinct, high-converting studio color harmony schemes tailored to this specific product's category, material, and mood:
1. One atmospheric/editorial palette that elevates perceived luxury or freshness.
2. One high-impact commercial campaign palette that maximizes product pop and click-through rate.

Rules:
- All hex values MUST be valid 6-digit hex strings starting with '#' (e.g. "#1e293b").
- "gradient" MUST be a valid CSS linear-gradient(...) or radial-gradient(...) using primaryBgHex and secondaryBgHex.
- Ensure strong WCAG contrast (>= 4.5:1) between headlineColor/subtitleColor and primaryBgHex/secondaryBgHex, and between ctaTextColor and ctaBgColor.
- Write "aiInsight", "badge", "title", and "description" in natural, polished Turkish.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: {
        parts: [
          {
            inlineData: {
              data: parsedImg.data,
              mimeType: parsedImg.mimeType,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiInsight: {
              type: Type.STRING,
              description: "1-2 sentence Turkish color analysis of the product and why these harmonies fit.",
            },
            harmonies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  badge: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  gradient: { type: Type.STRING },
                  primaryBgHex: { type: Type.STRING },
                  secondaryBgHex: { type: Type.STRING },
                  vignette: { type: Type.BOOLEAN },
                  headlineColor: { type: Type.STRING },
                  highlightColor: { type: Type.STRING },
                  subtitleColor: { type: Type.STRING },
                  ctaBgColor: { type: Type.STRING },
                  ctaTextColor: { type: Type.STRING },
                  glowColor: { type: Type.STRING },
                  ambientGlow: { type: Type.NUMBER },
                  promoColor: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(cleanJsonResponse(response.text || "{}"));
    return res.json({
      success: true,
      aiInsight:
        typeof parsed.aiInsight === "string" && parsed.aiInsight.trim()
          ? parsed.aiInsight.trim()
          : "Ürün renk tonlarına özel yapay zeka arka plan ve tipografi harmonileri hazırlandı.",
      harmonies: Array.isArray(parsed.harmonies) ? parsed.harmonies : [],
    });
  } catch (error: any) {
    console.error("AI Color Harmony error:", error);
    const msg = error?.message || "";
    const friendly =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
        ? "AI renk analizi kotası geçici olarak doldu; aşağıdaki otomatik renk çemberi harmonilerini hemen kullanabilirsiniz."
        : msg || "AI renk harmonisi analizinde hata oluştu.";
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
});

// Endpoint: AI Creative Poster, Studio Scene, 3D Sticker, Collage & Brand Board Generation
async function handleGenerateCreative(req: express.Request, res: express.Response) {
  try {
    const {
      prompt = "",
      mode = "studio-scene",
      aspectRatio = "1:1",
      negativePrompt,
      productBase64,
      referenceImageBase64,
      mimeType = "image/jpeg",
      headlineText,
      subtext,
      badgeText,
      brandColors,
      language = "Turkish",
    } = req.body;

    const validModes: AiCreativeMode[] = [
      "full-poster",
      "studio-scene",
      "promo-flyer",
      "sticker-3d",
      "collage-story",
      "brand-board",
    ];
    const safeMode: AiCreativeMode = validModes.includes(mode) ? mode : "studio-scene";

    const parts: any[] = [];
    let hasProductImage = false;
    let hasReferenceImage = false;

    if (productBase64 && typeof productBase64 === "string" && !productBase64.startsWith("/")) {
      const parsedImg = parseImagePayload(productBase64, mimeType);
      parts.push({
        inlineData: {
          data: parsedImg.data,
          mimeType: parsedImg.mimeType,
        },
      });
      hasProductImage = true;
    }

    if (
      referenceImageBase64 &&
      typeof referenceImageBase64 === "string" &&
      !referenceImageBase64.startsWith("/")
    ) {
      const parsedRef = parseImagePayload(referenceImageBase64, mimeType);
      parts.push({
        inlineData: {
          data: parsedRef.data,
          mimeType: parsedRef.mimeType,
        },
      });
      hasReferenceImage = true;
    }

    const roleHint =
      hasProductImage && hasReferenceImage
        ? "Image 1 is the user's real product to preserve. Image 2 is the visual layout & style reference to emulate."
        : hasProductImage
        ? "The attached image is the user's real product to place and preserve accurately."
        : hasReferenceImage
        ? "The attached image is the visual layout & style reference to emulate."
        : "";

    const enhancedPrompt = [
      roleHint,
      buildAiCreativePrompt({
        mode: safeMode,
        prompt,
        headlineText,
        subtext,
        badgeText,
        brandColors,
        negativePrompt,
        hasProductImage,
        hasReferenceImage,
        language,
      }),
    ]
      .filter(Boolean)
      .join(" ");

    parts.push({ text: enhancedPrompt });

    const chosenRatio = mapAspectRatioForGemini((aspectRatio || "1:1") as AspectRatio);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: chosenRatio,
        },
      },
    });

    let imageUrl: string | null = null;
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({
        success: false,
        error: "Görsel üretilemedi, lütfen açıklamayı detaylandırıp tekrar deneyin.",
      });
    }

    return res.json({ success: true, imageUrl, mode: safeMode });
  } catch (error: any) {
    console.error("AI Creative Generation error:", error);
    const msg = error?.message || "";
    const friendly =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
        ? "Görsel üretim kotası doldu veya ücretli API anahtarı gerekiyor (Settings > Secrets)."
        : msg || "Görsel üretiminde hata oluştu";
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
}

app.post("/api/ai/generate-scene", handleGenerateCreative);
app.post("/api/ai/generate-creative", handleGenerateCreative);

// Endpoint: AI Product Background Cleaner & Studio Isolation
app.post("/api/ai/clean-background", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", targetBackground = "white" } = req.body;

    if (!imageBase64 || imageBase64.startsWith("/")) {
      return res.status(400).json({ success: false, error: "Geçersiz veya eksik görsel verisi" });
    }

    const parsedImg = parseImagePayload(imageBase64, mimeType);

    const bgDescription =
      targetBackground === "white"
        ? "completely flat pure solid white background (#FFFFFF) with NO floor gradient and NO dark shadow outside the object so it can be cleanly keyed"
        : targetBackground === "studio-gray"
        ? "minimalist light studio gray background (#f1f5f9) with professional softbox lighting"
        : "clean solid color studio background";

    const promptText = `
Isolate the single main product from this image and completely remove its current background.
Place the isolated product centered on a ${bgDescription}.
Preserve all product details, logos, textures, contours, and labels accurately.
No extra props, no text overlays, sharp crisp silhouette edges.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: parsedImg.data,
              mimeType: parsedImg.mimeType,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    let imageUrl: string | null = null;
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      return res.status(500).json({
        success: false,
        error: "Yapay zeka ile arka fon temizlenemedi, lütfen tekrar deneyin.",
      });
    }

    return res.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("AI Clean Background error:", error);
    const msg = error?.message || "";
    const friendly =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
        ? "AI Arka Fon temizleme için ücretli Gemini API kotası gerekiyor; sol taraftaki otomatik kesim ve rötuş fırçasını kullanabilirsiniz."
        : msg || "Arka fon temizlenirken hata oluştu";
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
});

// Endpoint: AI Smart Copywriter
app.post("/api/ai/generate-copy", async (req, res) => {
  try {
    const { productName, audience, vibe, language = "tr" } = req.body;

    const prompt = `
Create 3 distinct commercial cover headline sets for a product:
Product: "${productName || "Ürün"}"
Target Audience: "${audience || "Genel Müşteriler"}"
Style Vibe: "${vibe || "Etkileyici & Modern"}"
Language: "${language}"

Return a valid JSON array of 3 options:
[
  {
    "style": "Macera / Dinamik",
    "kicker": "KEŞFETMEYE HAZIR OL",
    "headline": "SINIRLARI AŞ",
    "subheading": "Zorlu koşullarda bile kusursuz performans.",
    "badges": ["Suya Dayanıklı", "Ultra Hafif", "Hızlı Kargo"],
    "cta": "Şimdi Keşfet"
  }
]
Return pure JSON only.
`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(cleanJsonResponse(response.text || "[]"));
    return res.json({ success: true, options: parsed });
  } catch (error: any) {
    console.error("AI Copy error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Metin üretiminde hata oluştu",
    });
  }
});

// Endpoint: Conversational Template & Selected Area Editor
app.post("/api/ai/chat-edit", async (req, res) => {
  try {
    const {
      message,
      targetArea = "all",
      history = [],
      currentState = {},
    } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "Lütfen düzenleme talimatını yazın." });
    }

    const recentHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .map((h: any) => `${h.role === "user" ? "Kullanıcı" : "Tasarımcı AI"}: ${h.text}`)
          .join("\n")
      : "";

    const prompt = `
You are KapakAI Studio's senior creative art director and conversational template editor.
The user wants to modify the CURRENT cover design by chatting with you.

TARGET SELECTED AREA: "${targetArea}"
(Meaning:
- "all": You can modify any visual parts of the template together: background gradient/vignette, typography, badges, promoBadge, productPlacement, floatingElements.
- "background": Focus strictly on "background" (either a curated studio photo backdrop imageUrl from ["/assets/backgrounds/champagne-arch.jpg", "/assets/backgrounds/emerald-velvet.jpg", "/assets/backgrounds/magenta-satin.jpg", "/assets/backgrounds/terracotta-niche.jpg", "/assets/backgrounds/crimson-festive.jpg", "/assets/backgrounds/tropical-rock.jpg", "/assets/backgrounds/obsidian-neon.jpg", "/assets/backgrounds/nordic-oak.jpg"] OR a rich CSS gradient like radial-gradient(...)/linear-gradient(...), blur, brightness, vignette, stageStyle: "none"|"champagne-arch"|"festive-lights") and optionally "aspectRatio".
- "text": Focus strictly on "typography" (kicker, headline, headlineHighlight, subtitle, ctaText, showCta, fontFamily, colors, headlineSize 0.6..1.6, alignment left|center|right, positionX 2..92, positionY 2..86, plaqueStyle: "none"|"emerald-3d"|"magenta-3d"|"crimson-3d", plaqueTilt: -6..6, subtitlePill: true|false).
- "product": Focus strictly on "productPlacement" (x 10..90, y 10..90, scale 0.4..1.8, rotation -45..45, flipX, shadowOpacity 0..1, shadowBlur 4..50, reflection, reflectionOpacity, brightness 0.6..1.5, contrast 0.7..1.4, ambientGlow 0..1, glowColor hex).
- "badges": Focus strictly on "badges" (array of 1-4 { icon: "shield"|"sparkles"|"droplet"|"sun"|"award"|"zap"|"leaf"|"clock", label, sublabel }) and "badgesPosition" ({ x: 2..72, y: 5..85 }).
- "promo": Focus strictly on "promoBadge" ({ show, type: "tag"|"circle"|"pill", text, subtext, color, textColor, x: 6..94, y: 6..94, scale: 0.5..1.8, rotation: -45..45 }).
)

CURRENT CANVAS STATE (JSON):
${JSON.stringify(currentState)}

${recentHistory ? `CONVERSATION HISTORY:\n${recentHistory}\n` : ""}
USER REQUEST: "${message.trim()}"

Return a valid JSON object matching this exact schema:
{
  "assistantMessage": "Doğal, samimi ve profesyonel Türkçe yanıt (neleri değiştirdiğini 1-2 cümle ile özetle).",
  "patch": {
    "aspectRatio": "1:1" | "4:5" | "9:16" | "16:9", // optional
    "scenePrompt": "English studio backdrop prompt ONLY if user explicitly requests generating a brand-new AI photographic background image", // optional
    "background": { "type": "image"|"gradient", "imageUrl": "/assets/backgrounds/...", "gradient": "linear-gradient(...) or radial-gradient(...)", "blur": 0, "brightness": 1, "vignette": false, "stageStyle": "none"|"champagne-arch"|"festive-lights" }, // optional
    "typography": { "kicker": "...", "headline": "...", "headlineHighlight": "...", "subtitle": "...", "ctaText": "...", "showCta": true, "fontFamily": "Cabinet Grotesk"|"Plus Jakarta Sans"|"Playfair Display"|"Inter", "headlineColor": "#hex", "highlightColor": "#hex", "subtitleColor": "#hex", "ctaBgColor": "#hex", "ctaTextColor": "#hex", "headlineSize": 1.0, "alignment": "left"|"center"|"right", "positionX": 7, "positionY": 9, "plaqueStyle": "none"|"emerald-3d"|"magenta-3d"|"crimson-3d", "plaqueTilt": -2, "subtitlePill": false }, // optional
    "badges": [ { "id": "b1", "icon": "sparkles", "label": "...", "sublabel": "..." } ], // optional
    "badgesPosition": { "x": 7, "y": 60 }, // optional
    "promoBadge": { "show": true, "type": "circle"|"pill"|"tag", "text": "...", "subtext": "...", "color": "#hex", "textColor": "#hex", "x": 84, "y": 16, "scale": 1.0, "rotation": 0 }, // optional
    "productPlacement": { "x": 70, "y": 55, "scale": 0.95, "rotation": 0, "shadowOpacity": 0.45, "shadowBlur": 24, "reflection": true, "reflectionOpacity": 0.3, "brightness": 1.05, "contrast": 1.05, "ambientGlow": 0.3, "glowColor": "#hex" }, // optional
    "floatingElements": [ { "id": "f1", "type": "water-splash"|"gold-coin"|"3d-sphere"|"sparkle"|"leaf"|"glow-ring"|"gold-ribbon", "x": 50, "y": 70, "scale": 1.0, "rotation": 0, "opacity": 0.9 } ] // optional, only when targetArea is "all"
  }
}

Design rules:
1. Ensure high contrast & readability between background and text colors (e.g., light text on dark backgrounds, dark text on pastel/bright backgrounds).
2. Avoid overlapping text, badges, and product placement.
3. Only include sections in "patch" that are relevant to the user's request and allowed by targetArea (unless targetArea is "all").
4. Return ONLY valid pure JSON.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(cleanJsonResponse(response.text || "{}"));
    return res.json({
      success: true,
      assistantMessage: parsed.assistantMessage || "Seçili alan isteğinize göre güncellendi.",
      patch: parsed.patch || {},
    });
  } catch (error: any) {
    console.error("AI Chat Edit error:", error);
    const msg = error?.message || "";
    const friendly =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
        ? "Gemini API istek kotası geçici olarak doldu. Biraz sonra tekrar deneyin veya manuel kontrolleri kullanın."
        : msg || "AI tasarım sohbetinde beklenmeyen bir hata oluştu.";
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
});

// Endpoint: Generate Multiple Custom Cover Templates from Scratch
app.post("/api/ai/generate-templates", async (req, res) => {
  try {
    const {
      prompt,
      category = "Tümü",
      aspectRatio = "auto",
      count = 3,
      generateImages = false,
    } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: "Lütfen oluşturmak istediğiniz şablon fikrini veya ürün konseptini yazın.",
      });
    }

    const safeCount = Math.min(4, Math.max(2, Number(count) || 3));
    const categoryInstruction =
      category && category !== "Tümü" && category !== "AI Özel"
        ? `Prefer category "${category}", or choose the closest match among the allowed categories.`
        : `Choose the best matching category from the allowed list.`;
    const ratioInstruction =
      aspectRatio && aspectRatio !== "auto"
        ? `All templates MUST use aspectRatio "${aspectRatio}".`
        : `Use varied commercial aspect ratios across the ${safeCount} options (mix of "4:5", "1:1", "9:16", "16:9" suited to the concept).`;

    const aiPrompt = `
You are KapakAI Studio's Lead Art Director.
The user couldn't find a template matching what they want in our existing library, so you must design ${safeCount} COMPLETELY NEW, DISTINCT, studio-grade product cover templates FROM SCRATCH.

USER BRIEF: "${prompt.trim()}"
${categoryInstruction}
${ratioInstruction}

Make the ${safeCount} templates visually diverse (different color palettes, typography vibes, layouts, and moods):
- Option 1: Bold & High-Contrast Hero Layout
- Option 2: Warm, Editorial & Atmospheric Layout
- Option 3: Clean Modern / Dynamic Campaign Layout

Allowed categories (exact strings):
"Kozmetik & Bakım" | "Lüks & Parfüm" | "E-Ticaret & Kampanya" | "Gıda & İçecek" | "Aksiyon & Teknoloji" | "Moda & Aksesuar" | "3D & Eğlence" | "Minimalist Marka" | "Pazaryeri & Vitrin"

Allowed fontFamily: "Cabinet Grotesk" | "Plus Jakarta Sans" | "Playfair Display" | "Inter"
Allowed badge icons: "shield" | "sparkles" | "droplet" | "sun" | "award" | "zap" | "leaf" | "clock" | "check"
Allowed floatingElements types: "water-splash" | "gold-coin" | "3d-sphere" | "sparkle" | "leaf" | "glow-ring" | "gold-ribbon"
Allowed promoBadge types: "tag" | "circle" | "pill"
Allowed stageStyle: "none" | "champagne-arch" | "festive-lights"
Allowed plaqueStyle: "none" | "emerald-3d" | "magenta-3d" | "crimson-3d"

Allowed studio photo backdrops (background.imageUrl, optional — use DIFFERENT ones across options for maximum visual variety!):
"/assets/backgrounds/champagne-arch.jpg" (warm ivory arch & travertine podium)
"/assets/backgrounds/emerald-velvet.jpg" (deep emerald velvet & brass marble podium)
"/assets/backgrounds/magenta-satin.jpg" (flowing magenta silk & pearl podium)
"/assets/backgrounds/terracotta-niche.jpg" (mediterranean terracotta arch & stone block)
"/assets/backgrounds/crimson-festive.jpg" (crimson holiday banner, fairy lights & snow)
"/assets/backgrounds/tropical-rock.jpg" (wet river rock & turquoise tropical splashes)
"/assets/backgrounds/obsidian-neon.jpg" (obsidian tech pedestal & cyan-violet halo)
"/assets/backgrounds/nordic-oak.jpg" (scandinavian alabaster wall & light oak plinth)

Return a valid JSON object with this EXACT shape:
{
  "templates": [
    {
      "title": "Kısa ve akılda kalıcı Türkçe şablon adı",
      "category": "One of the 9 allowed categories",
      "description": "1 cümlelik Türkçe stil ve kompozisyon açıklaması",
      "aspectRatio": "4:5",
      "background": {
        "type": "image",
        "imageUrl": "/assets/backgrounds/emerald-velvet.jpg",
        "gradient": "rich multi-stop CSS linear-gradient(...) or radial-gradient(...) as fallback",
        "blur": 0,
        "brightness": 1,
        "vignette": false,
        "stageStyle": "none"
      },
      "typography": {
        "kicker": "KISA ÜST ETİKET",
        "headline": "ANA BAŞLIK",
        "headlineHighlight": "VURGULU SATIR",
        "subtitle": "Ürünü ve avantajı anlatan kısa açıklama metni.",
        "ctaText": "HEMEN KEŞFET",
        "showCta": true,
        "fontFamily": "Cabinet Grotesk",
        "headlineColor": "#ffffff",
        "highlightColor": "#fbbf24",
        "subtitleColor": "#e2e8f0",
        "ctaBgColor": "#f97316",
        "ctaTextColor": "#ffffff",
        "headlineSize": 0.95,
        "alignment": "left",
        "positionX": 7,
        "positionY": 10,
        "plaqueStyle": "none",
        "plaqueTilt": -2,
        "subtitlePill": false
      },
      "badges": [
        { "icon": "sparkles", "label": "Özellik 1", "sublabel": "Kısa detay" },
        { "icon": "shield", "label": "Özellik 2", "sublabel": "Kısa detay" }
      ],
      "badgesPosition": { "x": 7, "y": 64 },
      "promoBadge": {
        "show": true,
        "type": "circle",
        "text": "%25",
        "subtext": "FIRSAT",
        "color": "#ef4444",
        "textColor": "#ffffff",
        "x": 85,
        "y": 15,
        "scale": 1.0,
        "rotation": -6
      },
      "floatingElements": [
        { "type": "sparkle", "x": 48, "y": 28, "scale": 0.9, "rotation": 10, "opacity": 0.85 }
      ],
      "productDefaultPlacement": {
        "x": 68,
        "y": 58,
        "scale": 1.0,
        "rotation": 0,
        "shadowOpacity": 0.5,
        "shadowBlur": 26,
        "shadowOffsetY": 18,
        "reflection": true,
        "reflectionOpacity": 0.3,
        "brightness": 1.05,
        "contrast": 1.05,
        "ambientGlow": 0.35,
        "glowColor": "#fbbf24"
      }
    }
  ]
}

CRITICAL LAYOUT RULES:
1. Never overlap text, badges, and product! E.g. if alignment="left" (positionX: 7, positionY: 9), place product on right (x: 68..74, y: 55..62) and badges at bottom-left (x: 7, y: 62..70). If alignment="center" (positionX: 50, positionY: 7), place product centered below (x: 50, y: 63) and keep badgesPosition at x: 7, y: 74 or minimal badges.
2. Guarantee strong WCAG contrast between background gradient and headlineColor/subtitleColor.
3. All copy (title, description, kicker, headline, subtitle, ctaText, badges) MUST be polished, natural Turkish tailored to the USER BRIEF.
4. Return ONLY valid pure JSON.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: aiPrompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(cleanJsonResponse(response.text || "{}"));
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.templates) ? parsed.templates : [];

    if (list.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Yapay zeka şablon oluşturamadı, lütfen fikrinizi biraz daha detaylandırın.",
      });
    }

    // Optionally generate bespoke AI photographic backdrops for each custom template
    if (generateImages) {
      await Promise.allSettled(
        list.map(async (tmpl: any) => {
          try {
            const sceneDesc = `${tmpl?.title || ""} ${tmpl?.description || ""} ${prompt.trim()}`;
            const imgPrompt = buildAiCreativePrompt({
              mode: "studio-scene",
              prompt: sceneDesc,
            });
            const ratio = mapAspectRatioForGemini((tmpl?.aspectRatio || "4:5") as AspectRatio);
            const imgRes = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite-image",
              contents: { parts: [{ text: imgPrompt }] },
              config: { imageConfig: { aspectRatio: ratio } },
            });
            for (const part of imgRes.candidates?.[0]?.content?.parts ?? []) {
              if (part.inlineData?.data) {
                const mime = part.inlineData.mimeType ?? "image/png";
                tmpl.background = {
                  ...(tmpl.background || {}),
                  type: "image",
                  imageUrl: `data:${mime};base64,${part.inlineData.data}`,
                };
                break;
              }
            }
          } catch {
            // Keep gradient/curated backdrop fallback cleanly if image quota is unavailable
          }
        })
      );
    }

    return res.json({ success: true, templates: list });
  } catch (error: any) {
    console.error("AI Generate Templates error:", error);
    const msg = error?.message || "";
    const friendly =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
        ? "Yapay zeka istek kotası geçici olarak doldu. Biraz sonra tekrar deneyin."
        : msg || "Özel şablonlar üretilirken bir hata oluştu.";
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
});

// Endpoint: AI A/B Campaign Angle & Conversion Copy Variations
app.post("/api/ai/ab-variations", async (req, res) => {
  try {
    const {
      imageBase64,
      mimeType = "image/png",
      currentHeadline = "",
      currentSubtitle = "",
      brandName = "",
    } = req.body;

    const parts: any[] = [];
    if (imageBase64 && typeof imageBase64 === "string" && !imageBase64.startsWith("/")) {
      const parsedImg = parseImagePayload(imageBase64, mimeType);
      parts.push({
        inlineData: {
          data: parsedImg.data,
          mimeType: parsedImg.mimeType,
        },
      });
    }

    const promptText = `
You are an elite performance-marketing creative strategist for e-commerce & social media ads.
Analyze the product (and current draft headline: "${currentHeadline}", subtitle: "${currentSubtitle}", brand: "${brandName}") and generate 3 distinct high-converting Turkish A/B test variations with completely different psychological angles:
1. Rational / Performance & Proof (Rasyonel Performans & Kanıt)
2. Emotional / Luxury & Desire (Prestij, Estetik & Arzu)
3. Urgency / Offer & Direct Response (Fırsat, Kampanya & Hızlı Aksiyon)

Rules:
- All copy MUST be natural, punchy Turkish ("kicker", "headline", "headlineHighlight", "subtitle", "ctaText", "promoText", "promoSubtext").
- Keep "headline" 2-4 words max and "headlineHighlight" 1-3 words max so mobile scannability is under 1.5 seconds.
- Provide matching 6-digit hex colors ("accentHex", "ctaBgHex", "ctaTextHex") suited to each psychological angle.
`.trim();

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  angleBadge: { type: Type.STRING },
                  angleTitle: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  kicker: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  headlineHighlight: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  ctaText: { type: Type.STRING },
                  promoText: { type: Type.STRING },
                  promoSubtext: { type: Type.STRING },
                  accentHex: { type: Type.STRING },
                  ctaBgHex: { type: Type.STRING },
                  ctaTextHex: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(cleanJsonResponse(response.text || "{}"));
    return res.json({
      success: true,
      variations: Array.isArray(parsed?.variations) ? parsed.variations : [],
    });
  } catch (error: any) {
    console.error("AI A/B Variations error:", error);
    const msg = error?.message || "";
    const friendly =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
        ? "Yapay zeka istek kotası geçici olarak doldu. Biraz sonra tekrar deneyin."
        : msg || "A/B kampanya varyasyonları üretilirken bir hata oluştu.";
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
});

// Endpoint: AI Smart Auto-Fix (Lighting Balance, Dynamic Contrast, Optical Clarity & E-Commerce Composition)
app.post("/api/ai/smart-auto-fix", async (req, res) => {
  try {
    const {
      compositeImageBase64,
      mimeType = "image/jpeg",
      targetArea = "all",
      presetId = "marketplace-pro",
      optics = {},
      currentState = {},
    } = req.body;

    const parts: any[] = [];
    if (
      compositeImageBase64 &&
      typeof compositeImageBase64 === "string" &&
      !compositeImageBase64.startsWith("/")
    ) {
      const parsedImg = parseImagePayload(compositeImageBase64, mimeType);
      parts.push({
        inlineData: {
          data: parsedImg.data,
          mimeType: parsedImg.mimeType,
        },
      });
    }

    const promptText = `
You are a senior e-commerce retoucher, commercial studio lighting director, and advertising composition specialist.
Inspect the rendered ad canvas image (if attached), the measured product pixel optics, and the current studio state.
Optimize the visual composition to professional e-commerce standards for:
- TARGET SCOPE: "${targetArea}" ("all" = entire canvas composition, "product" = product lighting/contrast/clarity/grounding only, "background" = backdrop lighting/depth/contrast only, "text" = typography & CTA contrast/placement only, "badges" = feature badges placement, "promo" = promo sticker contrast/placement).
- MASTERING PROFILE: "${presetId}" ("marketplace-pro", "crisp-commercial", "luxury-editorial", or "soft-natural").
- MEASURED PIXEL OPTICS: ${JSON.stringify(optics)}
- CURRENT STUDIO STATE: ${JSON.stringify(currentState)}

Optimization Rules:
1. Lighting Balance (Aydınlatma Dengesi): Normalize product brightness (0.88..1.25), calibrate ground contact shadowOpacity (0.25..0.68), shadowBlur (12..34), floor reflection, ambientGlow (0.1..0.55), and separate product from background via background.brightness (0.82..1.08) and vignette.
2. Dynamic Contrast (Kontrast Ayarları): Enhance product.contrast (1.02..1.26) and background.contrast (0.96..1.18) so the product has 3D studio volume, and ensure typography/CTA colors achieve crisp WCAG AA contrast (>= 4.8:1).
3. Visual Clarity & Sharpness (Görsel Netlik): Calibrate product.clarity (0.22..0.72) for sharp label typography and texture acutance, and subtle background.blur (0..3) when background details compete with the product.
4. E-Commerce Composition: Ensure zero collision between headline/CTA, product silhouette, and feature badges, respecting safe margins for "${currentState?.aspectRatio || "4:5"}".
5. Write "aiSummary", "lightingNote", "contrastNote", "clarityNote", and "compositionNote" in concise, natural, professional Turkish (1 sentence each).
`.trim();

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiSummary: { type: Type.STRING },
            lightingNote: { type: Type.STRING },
            contrastNote: { type: Type.STRING },
            clarityNote: { type: Type.STRING },
            compositionNote: { type: Type.STRING },
            patch: {
              type: Type.OBJECT,
              properties: {
                productPlacement: {
                  type: Type.OBJECT,
                  properties: {
                    brightness: { type: Type.NUMBER },
                    contrast: { type: Type.NUMBER },
                    saturation: { type: Type.NUMBER },
                    clarity: { type: Type.NUMBER },
                    shadowOpacity: { type: Type.NUMBER },
                    shadowBlur: { type: Type.NUMBER },
                    ambientGlow: { type: Type.NUMBER },
                    glowColor: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    scale: { type: Type.NUMBER },
                  },
                },
                background: {
                  type: Type.OBJECT,
                  properties: {
                    brightness: { type: Type.NUMBER },
                    contrast: { type: Type.NUMBER },
                    saturation: { type: Type.NUMBER },
                    blur: { type: Type.NUMBER },
                    vignette: { type: Type.BOOLEAN },
                  },
                },
                typography: {
                  type: Type.OBJECT,
                  properties: {
                    headlineColor: { type: Type.STRING },
                    highlightColor: { type: Type.STRING },
                    subtitleColor: { type: Type.STRING },
                    ctaBgColor: { type: Type.STRING },
                    ctaTextColor: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(cleanJsonResponse(response.text || "{}"));
    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error("AI Smart Auto-Fix error:", error);
    const msg = error?.message || "";
    const friendly =
      msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")
        ? "AI kota sınırına ulaşıldı; stüdyo optik motoruyla otomatik kalibrasyon uygulandı."
        : msg || "AI otomatik optimizasyon sırasında bir hata oluştu.";
    return res.status(500).json({
      success: false,
      error: friendly,
    });
  }
});

// Vite or Static Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 KapakAI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
