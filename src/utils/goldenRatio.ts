import type {
  AspectRatio,
  ProductCenterOfGravity,
  StudioTypography,
} from '../types';

export const GOLDEN_RATIO = 1.618033988749895;
export const GOLDEN_MAJOR = 61.80339887498949; // 100 / phi (%)
export const GOLDEN_MINOR = 38.19660112501051; // 100 - 100 / phi (%)

export type GoldenPresetId =
  | 'auto'
  | 'right-golden'
  | 'left-golden'
  | 'bottom-center-golden'
  | 'top-right-golden';

export interface GoldenTargetPoint {
  id: Exclude<GoldenPresetId, 'auto'>;
  x: number; // 0..100 canvas percentage
  y: number; // 0..100 canvas percentage
  label: string;
}

export const GOLDEN_TARGET_POINTS: Record<
  Exclude<GoldenPresetId, 'auto'>,
  GoldenTargetPoint
> = {
  'right-golden': {
    id: 'right-golden',
    x: Number(GOLDEN_MAJOR.toFixed(1)),
    y: Number(GOLDEN_MAJOR.toFixed(1)),
    label: 'Sağ Altın Nokta (%61.8, %61.8)',
  },
  'left-golden': {
    id: 'left-golden',
    x: Number(GOLDEN_MINOR.toFixed(1)),
    y: Number(GOLDEN_MAJOR.toFixed(1)),
    label: 'Sol Altın Nokta (%38.2, %61.8)',
  },
  'bottom-center-golden': {
    id: 'bottom-center-golden',
    x: 50,
    y: Number(GOLDEN_MAJOR.toFixed(1)),
    label: 'Merkez Altın Yatay (%50, %61.8)',
  },
  'top-right-golden': {
    id: 'top-right-golden',
    x: Number(GOLDEN_MAJOR.toFixed(1)),
    y: Number(GOLDEN_MINOR.toFixed(1)),
    label: 'Üst Sağ Altın (%61.8, %38.2)',
  },
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getCanvasAspectDimensions(
  ratio: AspectRatio,
  baseWidth = 1080
): { width: number; height: number } {
  switch (ratio) {
    case '1:1':
      return { width: baseWidth, height: baseWidth };
    case '9:16':
      return { width: baseWidth, height: Math.round(baseWidth * (16 / 9)) };
    case '4:5':
      return { width: baseWidth, height: Math.round(baseWidth * (5 / 4)) };
    case '16:9':
      return { width: Math.round(baseWidth * (16 / 9)), height: baseWidth };
  }
}

/**
 * Computes rendered product image box dimensions as percentages of canvas width/height,
 * matching StudioCanvas & exportCanvas proportions (46% maxW, 48% maxH at scale=1.0).
 */
export function getRenderedProductBoxPercent(params: {
  aspectRatio: AspectRatio;
  imgWidth: number;
  imgHeight: number;
  scale: number;
}): { widthPercent: number; heightPercent: number } {
  const { aspectRatio, imgWidth, imgHeight, scale } = params;
  const safeW = Math.max(1, imgWidth || 1000);
  const safeH = Math.max(1, imgHeight || 1000);
  const { width: canvasW, height: canvasH } = getCanvasAspectDimensions(aspectRatio, 1080);

  const maxH = canvasH * 0.48 * scale;
  const maxW = canvasW * 0.46 * scale;
  const imgRatio = safeW / safeH;

  let targetH = maxH;
  let targetW = targetH * imgRatio;
  if (targetW > maxW) {
    targetW = maxW;
    targetH = targetW / imgRatio;
  }

  return {
    widthPercent: (targetW / canvasW) * 100,
    heightPercent: (targetH / canvasH) * 100,
  };
}

/**
 * Deterministic pixel-mass Center of Gravity & foreground bounding box detector.
 * Uses alpha transparency when present, or contrast against sampled border background for opaque images.
 */
export function computePixelCenterOfGravity(
  data: Uint8ClampedArray,
  width: number,
  height: number
): ProductCenterOfGravity {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);

  // Check if image has meaningful transparency
  let transparentCount = 0;
  const total = safeW * safeH;
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] < 200) transparentCount++;
  }
  const hasAlphaMask = transparentCount > total * 0.03;

  // Sample border average color if image is opaque
  let bgR = 255;
  let bgG = 255;
  let bgB = 255;
  if (!hasAlphaMask) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    for (let x = 0; x < safeW; x += Math.max(1, Math.floor(safeW / 20))) {
      for (const y of [0, safeH - 1]) {
        const idx = (y * safeW + x) * 4;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        count++;
      }
    }
    if (count > 0) {
      bgR = sumR / count;
      bgG = sumG / count;
      bgB = sumB / count;
    }
  }

  let weightSum = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = safeW;
  let minY = safeH;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < safeH; y++) {
    for (let x = 0; x < safeW; x++) {
      const idx = (y * safeW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      let weight = 0;
      if (hasAlphaMask) {
        if (a <= 20) continue;
        // Weight opaque interior + subtle optical density (darker/saturated areas carry slightly more visual mass)
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const opticalFactor = 0.72 + 0.28 * (1 - luma * 0.65);
        weight = (a / 255) * opticalFactor;
      } else {
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        if (dist < 22) continue;
        weight = Math.min(1, dist / 140);
      }

      if (weight > 0.05) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        weightSum += weight;
        sumX += (x + 0.5) * weight;
        sumY += (y + 0.5) * weight;
      }
    }
  }

  if (weightSum <= 0 || maxX <= minX || maxY <= minY) {
    return {
      x: 0.5,
      y: 0.5,
      boundingBox: { xMin: 0.1, yMin: 0.1, xMax: 0.9, yMax: 0.9 },
      source: 'pixel',
      confidence: 0.5,
      rationale: 'Piksel yoğunluğu merkezde dengeli tespit edildi.',
    };
  }

  const cx = clamp(sumX / weightSum / safeW, 0.08, 0.92);
  const cy = clamp(sumY / weightSum / safeH, 0.08, 0.92);

  return {
    x: Number(cx.toFixed(4)),
    y: Number(cy.toFixed(4)),
    boundingBox: {
      xMin: Number(clamp(minX / safeW, 0, 0.95).toFixed(4)),
      yMin: Number(clamp(minY / safeH, 0, 0.95).toFixed(4)),
      xMax: Number(clamp((maxX + 1) / safeW, 0.05, 1).toFixed(4)),
      yMax: Number(clamp((maxY + 1) / safeH, 0.05, 1).toFixed(4)),
    },
    source: 'pixel',
    confidence: hasAlphaMask ? 0.86 : 0.72,
    rationale: `Ürünün görsel ağırlık merkezi (%${Math.round(cx * 100)}, %${Math.round(cy * 100)}) piksel yoğunluğuna göre belirlendi.`,
  };
}

export function normalizeCenterOfGravity(
  raw: Partial<ProductCenterOfGravity> | null | undefined,
  fallback?: ProductCenterOfGravity
): ProductCenterOfGravity {
  const base = fallback ?? {
    x: 0.5,
    y: 0.5,
    boundingBox: { xMin: 0.1, yMin: 0.1, xMax: 0.9, yMax: 0.9 },
    source: 'pixel' as const,
    confidence: 0.7,
  };

  const x =
    typeof raw?.x === 'number' && Number.isFinite(raw.x)
      ? clamp(raw.x, 0.08, 0.92)
      : base.x;
  const y =
    typeof raw?.y === 'number' && Number.isFinite(raw.y)
      ? clamp(raw.y, 0.08, 0.92)
      : base.y;

  let boundingBox = base.boundingBox;
  if (raw?.boundingBox) {
    const xMin = clamp(Number(raw.boundingBox.xMin) || 0, 0, 0.9);
    const yMin = clamp(Number(raw.boundingBox.yMin) || 0, 0, 0.9);
    const xMax = clamp(Number(raw.boundingBox.xMax) || 1, xMin + 0.05, 1);
    const yMax = clamp(Number(raw.boundingBox.yMax) || 1, yMin + 0.05, 1);
    boundingBox = { xMin, yMin, xMax, yMax };
  }

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    boundingBox,
    source: raw?.source === 'ai' ? 'ai' : base.source,
    confidence:
      typeof raw?.confidence === 'number' && Number.isFinite(raw.confidence)
        ? clamp(raw.confidence, 0.1, 1)
        : base.confidence,
    rationale: raw?.rationale || base.rationale,
    goldenTarget: raw?.goldenTarget || base.goldenTarget,
  };
}

/**
 * Selects the optimal Golden Ratio intersection point so the product's visual center of gravity
 * creates balanced negative space opposite the active typography block.
 */
export function selectGoldenRatioTarget(
  typography: Pick<StudioTypography, 'alignment' | 'positionX' | 'positionY'>,
  overridePreset: GoldenPresetId = 'auto'
): GoldenTargetPoint {
  if (overridePreset !== 'auto' && GOLDEN_TARGET_POINTS[overridePreset]) {
    return GOLDEN_TARGET_POINTS[overridePreset];
  }

  if (typography.alignment === 'left' || typography.positionX < 36) {
    return GOLDEN_TARGET_POINTS['right-golden'];
  }
  if (typography.alignment === 'right' || typography.positionX > 64) {
    return GOLDEN_TARGET_POINTS['left-golden'];
  }
  if (typography.positionY >= 52) {
    return {
      id: 'top-right-golden',
      x: 50,
      y: Number(GOLDEN_MINOR.toFixed(1)),
      label: 'Üst Altın Yatay (%50, %38.2)',
    };
  }
  return GOLDEN_TARGET_POINTS['bottom-center-golden'];
}

export interface GoldenPlacementResult {
  x: number;
  y: number;
  scale: number;
  goldenTarget: GoldenTargetPoint;
  achievedCenterOfGravity: { x: number; y: number };
  centerOfGravity: ProductCenterOfGravity;
  summary: string;
}

/**
 * Aligns a product image onto the canvas so that its AI/pixel-detected visual Center of Gravity
 * lands directly on the selected Golden Ratio power point (phi = 1.618), while optionally sizing
 * the product via Golden Ratio proportions and preventing canvas edge clipping.
 */
export function computeGoldenRatioPlacement(params: {
  aspectRatio: AspectRatio;
  typography: Pick<StudioTypography, 'alignment' | 'positionX' | 'positionY'>;
  imgWidth: number;
  imgHeight: number;
  centerOfGravity: ProductCenterOfGravity;
  currentScale?: number;
  autoScale?: boolean;
  overridePreset?: GoldenPresetId;
  flipX?: boolean;
}): GoldenPlacementResult {
  const {
    aspectRatio,
    typography,
    imgWidth,
    imgHeight,
    centerOfGravity,
    currentScale = 1,
    autoScale = true,
    overridePreset = 'auto',
    flipX = false,
  } = params;

  const cg = normalizeCenterOfGravity(centerOfGravity);
  const effectiveCgX = flipX ? 1 - cg.x : cg.x;
  const target = selectGoldenRatioTarget(typography, overridePreset);

  // Compute Golden Ratio-balanced scale using visible product bounding box footprint
  let scale = clamp(currentScale, 0.5, 1.8);
  if (autoScale) {
    const bboxH = cg.boundingBox
      ? Math.max(0.25, cg.boundingBox.yMax - cg.boundingBox.yMin)
      : 0.85;
    const bboxW = cg.boundingBox
      ? Math.max(0.25, cg.boundingBox.xMax - cg.boundingBox.xMin)
      : 0.85;

    const unitBox = getRenderedProductBoxPercent({
      aspectRatio,
      imgWidth,
      imgHeight,
      scale: 1,
    });

    const visibleHeightAtUnit = unitBox.heightPercent * bboxH;
    const visibleWidthAtUnit = unitBox.widthPercent * bboxW;

    // Aim for Golden Ratio minor (~38.2%..43%) visual footprint so wide bottles never graze side copy
    const desiredVisibleH = typography.alignment === 'center' ? 40 : 43;
    const desiredVisibleW = typography.alignment === 'center' ? 48 : 35;

    const scaleByH = desiredVisibleH / Math.max(10, visibleHeightAtUnit);
    const scaleByW = desiredVisibleW / Math.max(10, visibleWidthAtUnit);
    scale = clamp(Math.min(scaleByH, scaleByW), 0.75, 1.35);
    scale = Number(scale.toFixed(2));
  }

  const box = getRenderedProductBoxPercent({
    aspectRatio,
    imgWidth,
    imgHeight,
    scale,
  });

  // Align visual Center of Gravity (effectiveCgX, cg.y) onto (target.x, target.y)
  // Remember: product (x, y) is the geometric center (0.5, 0.5) of the rendered box!
  let x = target.x - (effectiveCgX - 0.5) * box.widthPercent;
  let y = target.y - (cg.y - 0.5) * box.heightPercent;

  // Keep visible product bounding box safely inside canvas edges (3%..97%)
  const bbox = cg.boundingBox ?? { xMin: 0.05, yMin: 0.05, xMax: 0.95, yMax: 0.95 };
  const halfW = box.widthPercent / 2;
  const halfH = box.heightPercent / 2;

  const effXMin = flipX ? 1 - bbox.xMax : bbox.xMin;
  const effXMax = flipX ? 1 - bbox.xMin : bbox.xMax;
  const visibleLeftOffset = (effXMin - 0.5) * box.widthPercent;
  const visibleRightOffset = (effXMax - 0.5) * box.widthPercent;
  const visibleTopOffset = (bbox.yMin - 0.5) * box.heightPercent;
  const visibleBottomOffset = (bbox.yMax - 0.5) * box.heightPercent;

  const minCenterX = Math.max(12, 4 - visibleLeftOffset);
  const maxCenterX = Math.min(88, 96 - visibleRightOffset);
  const minCenterY = Math.max(14, 4 - visibleTopOffset);
  const maxCenterY = Math.min(88, 96 - visibleBottomOffset);

  if (minCenterX <= maxCenterX) {
    x = clamp(x, minCenterX, maxCenterX);
  } else {
    x = clamp(x, 12 + halfW * 0.1, 88 - halfW * 0.1);
  }

  if (minCenterY <= maxCenterY) {
    y = clamp(y, minCenterY, maxCenterY);
  } else {
    y = clamp(y, 14 + halfH * 0.1, 88 - halfH * 0.1);
  }

  x = Number(x.toFixed(1));
  y = Number(y.toFixed(1));

  const achievedCgX = Number((x + (effectiveCgX - 0.5) * box.widthPercent).toFixed(1));
  const achievedCgY = Number((y + (cg.y - 0.5) * box.heightPercent).toFixed(1));

  const enrichedCg: ProductCenterOfGravity = {
    ...cg,
    goldenTarget: {
      x: target.x,
      y: target.y,
      label: target.label,
    },
  };

  const summary = `Ağırlık merkezi (%${Math.round(cg.x * 100)}, %${Math.round(
    cg.y * 100
  )}) ${target.label} noktasına hizalandı.`;

  return {
    x,
    y,
    scale,
    goldenTarget: target,
    achievedCenterOfGravity: { x: achievedCgX, y: achievedCgY },
    centerOfGravity: enrichedCg,
    summary,
  };
}
