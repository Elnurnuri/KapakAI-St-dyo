import type {
  AspectRatio,
  ProductCenterOfGravity,
  StudioTypography,
} from '../types';
import { loadImage } from './backgroundRemoval';
import {
  computePixelCenterOfGravity,
  computeGoldenRatioPlacement,
  normalizeCenterOfGravity,
  type GoldenPresetId,
  type GoldenPlacementResult,
} from './goldenRatio';

export interface MeasuredProductImage {
  imgWidth: number;
  imgHeight: number;
  compactPngBase64: string;
  pixelFallback: ProductCenterOfGravity;
}

/**
 * Loads an image in the browser, extracts its natural dimensions, computes a fast
 * deterministic pixel-mass Center of Gravity fallback, and creates a compact PNG
 * payload for server-side Gemini Vision analysis.
 */
export async function measureProductImage(
  imageSrc: string
): Promise<MeasuredProductImage> {
  const img = await loadImage(imageSrc);
  const imgWidth = img.naturalWidth || img.width || 1000;
  const imgHeight = img.naturalHeight || img.height || 1000;

  const maxSide = 384;
  let w = imgWidth;
  let h = imgHeight;
  if (w > maxSide || h > maxSide) {
    if (w >= h) {
      h = Math.max(1, Math.round((h * maxSide) / w));
      w = maxSide;
    } else {
      w = Math.max(1, Math.round((w * maxSide) / h));
      h = maxSide;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      imgWidth,
      imgHeight,
      compactPngBase64: imageSrc,
      pixelFallback: {
        x: 0.5,
        y: 0.5,
        boundingBox: { xMin: 0.08, yMin: 0.08, xMax: 0.92, yMax: 0.92 },
        source: 'pixel',
        confidence: 0.5,
        rationale: 'Varsayılan merkez ağırlık noktası kullanıldı.',
      },
    };
  }

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixelFallback = computePixelCenterOfGravity(imgData.data, w, h);
  const compactPngBase64 = canvas.toDataURL('image/png');

  return {
    imgWidth,
    imgHeight,
    compactPngBase64,
    pixelFallback,
  };
}

/**
 * Calls server-side Gemini Vision endpoint to detect the product's visual Center of Gravity
 * and bounding box, gracefully falling back to deterministic pixel-mass calculation if offline or rate-limited.
 */
export async function detectProductCenterOfGravity(
  imageSrc: string,
  measured?: MeasuredProductImage
): Promise<{
  centerOfGravity: ProductCenterOfGravity;
  imgWidth: number;
  imgHeight: number;
}> {
  const info = measured ?? (await measureProductImage(imageSrc));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('/api/ai/detect-center-of-gravity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: info.compactPngBase64,
        mimeType: 'image/png',
      }),
    });

    if (!res.ok) {
      return {
        centerOfGravity: info.pixelFallback,
        imgWidth: info.imgWidth,
        imgHeight: info.imgHeight,
      };
    }

    const payload = await res.json();
    if (payload?.success && payload?.data) {
      const normalized = normalizeCenterOfGravity(
        {
          x: payload.data.centerOfGravityX,
          y: payload.data.centerOfGravityY,
          boundingBox: payload.data.boundingBox,
          confidence: payload.data.confidence,
          rationale: payload.data.rationale,
          source: 'ai',
        },
        info.pixelFallback
      );
      return {
        centerOfGravity: normalized,
        imgWidth: info.imgWidth,
        imgHeight: info.imgHeight,
      };
    }
  } catch {
    // Graceful fallback to deterministic pixel analysis
  } finally {
    clearTimeout(timeout);
  }

  return {
    centerOfGravity: info.pixelFallback,
    imgWidth: info.imgWidth,
    imgHeight: info.imgHeight,
  };
}

/**
 * End-to-end auto-alignment function triggered when a user imports an image or clicks
 * "Altın Orana Hizala": detects the product's visual Center of Gravity with AI and
 * computes default placement (x, y, scale) aligned to the Golden Ratio (phi = 1.618).
 */
export async function alignProductWithGoldenRatio(params: {
  imageSrc: string;
  aspectRatio: AspectRatio;
  typography: Pick<StudioTypography, 'alignment' | 'positionX' | 'positionY'>;
  currentScale?: number;
  autoScale?: boolean;
  precomputedCog?: ProductCenterOfGravity | null;
  overridePreset?: GoldenPresetId;
  flipX?: boolean;
}): Promise<GoldenPlacementResult> {
  const {
    imageSrc,
    aspectRatio,
    typography,
    currentScale = 1,
    autoScale = true,
    precomputedCog,
    overridePreset = 'auto',
    flipX = false,
  } = params;

  const measured = await measureProductImage(imageSrc);
  let cog = precomputedCog;

  if (!cog) {
    const detected = await detectProductCenterOfGravity(imageSrc, measured);
    cog = detected.centerOfGravity;
  }

  return computeGoldenRatioPlacement({
    aspectRatio,
    typography,
    imgWidth: measured.imgWidth,
    imgHeight: measured.imgHeight,
    centerOfGravity: cog,
    currentScale,
    autoScale,
    overridePreset,
    flipX,
  });
}
