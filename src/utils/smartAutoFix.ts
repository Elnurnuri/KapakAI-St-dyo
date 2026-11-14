import {
  EditableAreaId,
  SmartFixPresetId,
  StudioPatch,
} from '../types';
import { clamp, StudioEditableState } from './aiPatch';
import { ensureReadableTextColor, wcagContrastRatio } from './colorHarmony';
import { evaluateStudioDesign } from './adAuditor';
import { computeGoldenRatioPlacement } from './goldenRatio';

export interface ImageOpticsMetrics {
  meanLuminance: number; // 0..1
  rmsContrast: number; // 0..0.5
  dynamicRange: number; // 0..1 (P95 - P05)
  edgeAcutance: number; // 0..1 normalized micro-edge sharpness
  meanSaturation: number; // 0..1
  exposureStatus: 'underexposed' | 'balanced' | 'overexposed';
  contrastStatus: 'flat' | 'balanced' | 'harsh';
  clarityStatus: 'soft' | 'crisp';
}

export interface SmartFixPresetMeta {
  id: SmartFixPresetId;
  label: string;
  shortDesc: string;
  targetLum: number;
  baseContrast: number;
  baseClarity: number;
  bgBrightness: number;
  bgContrast: number;
  bgBlurOnPhoto: number;
  vignette: boolean;
  ambientGlow: number;
}

export const SMART_FIX_PRESETS: SmartFixPresetMeta[] = [
  {
    id: 'marketplace-pro',
    label: 'Pazaryeri Standart',
    shortDesc: 'Dengeli stüdyo ışığı, net etiket keskinliği ve yüksek okunabilirlik',
    targetLum: 0.56,
    baseContrast: 1.12,
    baseClarity: 0.38,
    bgBrightness: 0.96,
    bgContrast: 1.06,
    bgBlurOnPhoto: 1,
    vignette: true,
    ambientGlow: 0.28,
  },
  {
    id: 'crisp-commercial',
    label: 'Ultra Net & Canlı',
    shortDesc: 'Maksimum ürün keskinliği, güçlü dinamik kontrast ve canlı tonlar',
    targetLum: 0.59,
    baseContrast: 1.18,
    baseClarity: 0.58,
    bgBrightness: 0.98,
    bgContrast: 1.12,
    bgBlurOnPhoto: 1.5,
    vignette: true,
    ambientGlow: 0.34,
  },
  {
    id: 'luxury-editorial',
    label: 'Lüks & Derin Kontrast',
    shortDesc: 'Sinematik alan derinliği, dramatik vinyet ve vurucu ürün ayrımı',
    targetLum: 0.53,
    baseContrast: 1.16,
    baseClarity: 0.44,
    bgBrightness: 0.88,
    bgContrast: 1.14,
    bgBlurOnPhoto: 2.5,
    vignette: true,
    ambientGlow: 0.42,
  },
  {
    id: 'soft-natural',
    label: 'Doğal Gün Işığı',
    shortDesc: 'Yumuşak geçişli zemin gölgesi ve doğal organik aydınlatma',
    targetLum: 0.57,
    baseContrast: 1.06,
    baseClarity: 0.26,
    bgBrightness: 1.02,
    bgContrast: 1.02,
    bgBlurOnPhoto: 0,
    vignette: false,
    ambientGlow: 0.18,
  },
];

export interface SmartFixDiffItem {
  id: string;
  area: EditableAreaId;
  label: string;
  beforeValue: string;
  afterValue: string;
}

export interface SmartAutoFixPlan {
  scope: EditableAreaId;
  presetId: SmartFixPresetId;
  source: 'studio' | 'ai';
  summary: string;
  lightingNote: string;
  contrastNote: string;
  clarityNote: string;
  compositionNote: string;
  patch: StudioPatch;
  diffs: SmartFixDiffItem[];
}

export const DEFAULT_IMAGE_OPTICS: ImageOpticsMetrics = {
  meanLuminance: 0.52,
  rmsContrast: 0.19,
  dynamicRange: 0.58,
  edgeAcutance: 0.42,
  meanSaturation: 0.44,
  exposureStatus: 'balanced',
  contrastStatus: 'balanced',
  clarityStatus: 'crisp',
};

/**
 * Pure pixel-level optical analyzer measuring luminance exposure, RMS & percentile contrast,
 * Sobel/Laplacian micro-edge sharpness (acutance), and HSL saturation on foreground pixels.
 */
export function analyzeImageOptics(buffer: {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
}): ImageOpticsMetrics {
  const { data, width, height } = buffer;
  if (!width || !height || data.length < width * height * 4) {
    return DEFAULT_IMAGE_OPTICS;
  }

  const lumHist = new Uint32Array(256);
  let fgCount = 0;
  let lumSum = 0;
  let lumSqSum = 0;
  let satSum = 0;

  // Grayscale grid (-1 for transparent background) for interior edge acutance
  const lumGrid = new Float32Array(width * height);
  lumGrid.fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a <= 32) continue;

      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const l = (maxC + minC) / 2;
      const d = maxC - minC;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1) + 1e-6);

      fgCount++;
      lumSum += lum;
      lumSqSum += lum * lum;
      satSum += Math.min(1, sat);
      lumGrid[y * width + x] = lum;

      const bin = Math.max(0, Math.min(255, Math.round(lum * 255)));
      lumHist[bin]++;
    }
  }

  if (fgCount < 16) {
    return DEFAULT_IMAGE_OPTICS;
  }

  const meanLuminance = lumSum / fgCount;
  const variance = Math.max(0, lumSqSum / fgCount - meanLuminance * meanLuminance);
  const rmsContrast = Math.sqrt(variance);

  // Compute P05 and P95 dynamic range from histogram
  const p05Target = fgCount * 0.05;
  const p95Target = fgCount * 0.95;
  let cumulative = 0;
  let p05Bin = 0;
  let p95Bin = 255;
  let foundP05 = false;
  for (let i = 0; i < 256; i++) {
    cumulative += lumHist[i];
    if (!foundP05 && cumulative >= p05Target) {
      p05Bin = i;
      foundP05 = true;
    }
    if (cumulative >= p95Target) {
      p95Bin = i;
      break;
    }
  }
  const dynamicRange = Math.max(0, (p95Bin - p05Bin) / 255);

  // Measure interior micro-edge sharpness (Laplacian energy on opaque 3x3 neighborhoods)
  let edgeSum = 0;
  let edgeSamples = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const c = lumGrid[y * width + x];
      if (c < 0) continue;
      const n = lumGrid[(y - 1) * width + x];
      const s = lumGrid[(y + 1) * width + x];
      const w = lumGrid[y * width + (x - 1)];
      const e = lumGrid[y * width + (x + 1)];
      if (n < 0 || s < 0 || w < 0 || e < 0) continue; // skip outer cutout boundary

      const lap = Math.abs(4 * c - n - s - w - e);
      edgeSum += lap;
      edgeSamples++;
    }
  }

  // Typical crisp product photo mean interior Laplacian is ~0.09..0.16; normalize to 0..1
  const rawLap = edgeSamples > 0 ? edgeSum / edgeSamples : 0.05;
  const edgeAcutance = clamp(rawLap / 0.15, 0.05, 1);
  const meanSaturation = clamp(satSum / fgCount, 0, 1);

  const exposureStatus: ImageOpticsMetrics['exposureStatus'] =
    meanLuminance < 0.41
      ? 'underexposed'
      : meanLuminance > 0.76
      ? 'overexposed'
      : 'balanced';

  const contrastStatus: ImageOpticsMetrics['contrastStatus'] =
    rmsContrast < 0.16 || dynamicRange < 0.42
      ? 'flat'
      : rmsContrast > 0.33
      ? 'harsh'
      : 'balanced';

  const clarityStatus: ImageOpticsMetrics['clarityStatus'] =
    edgeAcutance < 0.36 ? 'soft' : 'crisp';

  return {
    meanLuminance: Number(meanLuminance.toFixed(3)),
    rmsContrast: Number(rmsContrast.toFixed(3)),
    dynamicRange: Number(dynamicRange.toFixed(3)),
    edgeAcutance: Number(edgeAcutance.toFixed(3)),
    meanSaturation: Number(meanSaturation.toFixed(3)),
    exposureStatus,
    contrastStatus,
    clarityStatus,
  };
}

/**
 * Browser helper: samples a product image on a 96x96 offscreen canvas to extract real pixel optics.
 */
export async function measureProductOpticsFromSrc(src: string): Promise<ImageOpticsMetrics> {
  if (!src || typeof document === 'undefined') {
    return DEFAULT_IMAGE_OPTICS;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_IMAGE_OPTICS);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        resolve(analyzeImageOptics(imageData));
      } catch {
        resolve(DEFAULT_IMAGE_OPTICS);
      }
    };
    img.onerror = () => resolve(DEFAULT_IMAGE_OPTICS);
    img.src = src;
  });
}

/**
 * Pure 3x3 unsharp convolution kernel preserving silhouette alpha so high-res exports
 * match live SVG feConvolveMatrix clarity rendering without dark cutout fringes.
 */
export function applyConvolutionSharpenToImageData(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  clarityAmount: number
): Uint8ClampedArray {
  const k = clamp(clarityAmount, 0, 1) * 0.48;
  const out = new Uint8ClampedArray(src);
  if (k <= 0.01 || width < 3 || height < 3) {
    return out;
  }

  const centerWeight = 1 + 4 * k;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const a = src[idx + 3];
      if (a <= 24) continue;

      const nIdx = ((y - 1) * width + x) * 4;
      const sIdx = ((y + 1) * width + x) * 4;
      const wIdx = (y * width + (x - 1)) * 4;
      const eIdx = (y * width + (x + 1)) * 4;

      // Skip anti-aliased outer cutout edge pixels to prevent dark/bright fringe halos
      if (
        src[nIdx + 3] <= 24 ||
        src[sIdx + 3] <= 24 ||
        src[wIdx + 3] <= 24 ||
        src[eIdx + 3] <= 24
      ) {
        continue;
      }

      for (let c = 0; c < 3; c++) {
        const val =
          src[idx + c] * centerWeight -
          k * (src[nIdx + c] + src[sIdx + c] + src[wIdx + c] + src[eIdx + c]);
        out[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }

  return out;
}

function fmtPct(mult: number): string {
  return `%${Math.round(mult * 100)}`;
}

/**
 * Computes a deterministic, e-commerce-grade Smart Auto-Fix plan for either the entire canvas ('all')
 * or a specific selected element ('product' | 'background' | 'text' | 'badges' | 'promo').
 */
export function computeSmartAutoFixPlan(
  state: StudioEditableState,
  optics: ImageOpticsMetrics = DEFAULT_IMAGE_OPTICS,
  scope: EditableAreaId = 'all',
  presetId: SmartFixPresetId = 'marketplace-pro'
): SmartAutoFixPlan {
  const preset =
    SMART_FIX_PRESETS.find((p) => p.id === presetId) || SMART_FIX_PRESETS[0];
  const allow = (area: EditableAreaId) => scope === 'all' || scope === area;

  const patch: StudioPatch = {};
  const diffs: SmartFixDiffItem[] = [];

  // Run existing ad quality & safe-zone auditor to incorporate layout/WCAG fixes cleanly
  const audit = evaluateStudioDesign({
    aspectRatio: state.aspectRatio,
    background: state.background,
    product: state.product,
    typography: state.typography,
    badges: state.badges,
    badgesPosition: state.badgesPosition,
    promoBadge: state.promoBadge,
  });

  // 1. PRODUCT LIGHTING, CONTRAST, CLARITY & GROUNDING
  if (allow('product')) {
    const lumDelta = preset.targetLum - optics.meanLuminance;
    const rawBrightness = clamp(
      Number((1 + lumDelta * 0.55).toFixed(2)),
      0.9,
      1.24
    );

    const contrastBoost =
      optics.contrastStatus === 'flat'
        ? 0.08
        : optics.contrastStatus === 'harsh'
        ? -0.06
        : 0;
    const targetContrast = clamp(
      Number((preset.baseContrast + contrastBoost).toFixed(2)),
      0.96,
      1.28
    );

    const satBoost =
      optics.meanSaturation < 0.28
        ? 1.12
        : optics.meanSaturation > 0.72
        ? 0.98
        : preset.id === 'crisp-commercial'
        ? 1.1
        : 1.04;
    const targetSaturation = clamp(Number(satBoost.toFixed(2)), 0.9, 1.25);

    const clarityBoost = optics.clarityStatus === 'soft' ? 0.16 : 0;
    const targetClarity = clamp(
      Number((preset.baseClarity + clarityBoost).toFixed(2)),
      0.18,
      0.78
    );

    const targetShadowOpacity = preset.id === 'luxury-editorial' ? 0.58 : 0.48;
    const targetShadowBlur = preset.id === 'soft-natural' ? 28 : 22;
    const targetReflection = preset.id !== 'soft-natural';
    const targetReflectionOpacity = preset.id === 'luxury-editorial' ? 0.36 : 0.28;

    let nextX = state.product.x;
    let nextY = state.product.y;
    let nextScale = state.product.scale;

    const separationWarn = audit.checks.find(
      (c) => c.id === 'separation' && c.status === 'warn'
    );
    if (state.product.centerOfGravity && separationWarn) {
      const golden = computeGoldenRatioPlacement({
        aspectRatio: state.aspectRatio,
        typography: state.typography,
        imgWidth: 1000,
        imgHeight: 1000,
        centerOfGravity: state.product.centerOfGravity,
        currentScale: state.product.scale,
        autoScale: true,
        overridePreset: 'auto',
        flipX: state.product.flipX,
      });
      nextX = golden.x;
      nextY = golden.y;
      nextScale = golden.scale;
    } else if (separationWarn?.autoFixPatch?.productPlacement) {
      nextX = separationWarn.autoFixPatch.productPlacement.x ?? nextX;
      nextY = separationWarn.autoFixPatch.productPlacement.y ?? nextY;
    } else if (state.product.scale < 0.78 || state.product.scale > 1.45) {
      nextScale = clamp(state.product.scale, 0.88, 1.22);
    }

    patch.productPlacement = {
      brightness: rawBrightness,
      contrast: targetContrast,
      saturation: targetSaturation,
      clarity: targetClarity,
      shadowOpacity: targetShadowOpacity,
      shadowBlur: targetShadowBlur,
      reflection: targetReflection,
      reflectionOpacity: targetReflectionOpacity,
      ambientGlow: preset.ambientGlow,
      glowColor: state.typography.highlightColor || state.product.glowColor || '#ffffff',
      x: nextX,
      y: nextY,
      scale: nextScale,
    };

    if (Math.abs((state.product.brightness ?? 1) - rawBrightness) >= 0.02) {
      diffs.push({
        id: 'prod-brightness',
        area: 'product',
        label: 'Ürün Aydınlatma Dengesi',
        beforeValue: fmtPct(state.product.brightness ?? 1),
        afterValue: fmtPct(rawBrightness),
      });
    }
    if (Math.abs((state.product.contrast ?? 1) - targetContrast) >= 0.02) {
      diffs.push({
        id: 'prod-contrast',
        area: 'product',
        label: 'Ürün Dinamik Kontrastı',
        beforeValue: fmtPct(state.product.contrast ?? 1),
        afterValue: fmtPct(targetContrast),
      });
    }
    if (Math.abs((state.product.clarity ?? 0) - targetClarity) >= 0.03) {
      diffs.push({
        id: 'prod-clarity',
        area: 'product',
        label: 'Mikro Netlik & Keskinlik',
        beforeValue: fmtPct(state.product.clarity ?? 0),
        afterValue: fmtPct(targetClarity),
      });
    }
    if (
      Math.abs(state.product.x - nextX) >= 1.5 ||
      Math.abs(state.product.y - nextY) >= 1.5
    ) {
      diffs.push({
        id: 'prod-pos',
        area: 'product',
        label: 'E-Ticaret Odak Konumu',
        beforeValue: `X:%${Math.round(state.product.x)} Y:%${Math.round(state.product.y)}`,
        afterValue: `X:%${Math.round(nextX)} Y:%${Math.round(nextY)}`,
      });
    }
  }

  // 2. BACKGROUND LIGHTING SEPARATION & DEPTH OF FIELD
  if (allow('background')) {
    const isPhoto = state.background.type === 'image' && Boolean(state.background.imageUrl);
    const targetBgBrightness = preset.bgBrightness;
    const targetBgContrast = preset.bgContrast;
    const targetBgSaturation = preset.id === 'crisp-commercial' ? 1.08 : 1.02;
    const targetBlur = isPhoto
      ? Math.max(state.background.blur, preset.bgBlurOnPhoto)
      : state.background.blur;

    patch.background = {
      brightness: targetBgBrightness,
      contrast: targetBgContrast,
      saturation: targetBgSaturation,
      blur: targetBlur,
      vignette: preset.vignette,
    };

    if (Math.abs((state.background.brightness ?? 1) - targetBgBrightness) >= 0.02) {
      diffs.push({
        id: 'bg-brightness',
        area: 'background',
        label: 'Sahne Işık Ayrımı',
        beforeValue: fmtPct(state.background.brightness ?? 1),
        afterValue: fmtPct(targetBgBrightness),
      });
    }
    if (Math.abs((state.background.contrast ?? 1) - targetBgContrast) >= 0.02) {
      diffs.push({
        id: 'bg-contrast',
        area: 'background',
        label: 'Sahne Kontrast Dengesi',
        beforeValue: fmtPct(state.background.contrast ?? 1),
        afterValue: fmtPct(targetBgContrast),
      });
    }
    if (isPhoto && Math.abs(state.background.blur - targetBlur) >= 0.5) {
      diffs.push({
        id: 'bg-dof',
        area: 'background',
        label: 'Optik Alan Derinliği (Bokeh)',
        beforeValue: `${state.background.blur}px`,
        afterValue: `${targetBlur}px`,
      });
    }
  }

  // 3. TYPOGRAPHY & CTA WCAG READABILITY + SAFE ZONE
  if (allow('text')) {
    const contrastWarn = audit.checks.find((c) => c.id === 'contrast' && c.status === 'warn');
    const ctaWarn = audit.checks.find((c) => c.id === 'cta' && c.status === 'warn');
    const safeWarn = audit.checks.find((c) => c.id === 'safe-zone' && c.status === 'warn');
    const sepWarn = audit.checks.find((c) => c.id === 'separation' && c.status === 'warn');

    const typoPatch: NonNullable<StudioPatch['typography']> = {
      ...(contrastWarn?.autoFixPatch?.typography || {}),
      ...(ctaWarn?.autoFixPatch?.typography || {}),
      ...(safeWarn?.autoFixPatch?.typography || {}),
      ...(scope === 'text' && sepWarn?.autoFixPatch?.typography
        ? sepWarn.autoFixPatch.typography
        : {}),
    };

    // Ensure CTA button is enabled and has crisp >= 4.6:1 contrast
    const currentCtaBg = typoPatch.ctaBgColor || state.typography.ctaBgColor || '#c2410c';
    const whiteRatio = wcagContrastRatio('#ffffff', currentCtaBg);
    const refinedCtaBg =
      whiteRatio >= 3.0 && whiteRatio < 4.5 ? '#c2410c' : currentCtaBg;
    const refinedCtaFg = ensureReadableTextColor(
      typoPatch.ctaTextColor || state.typography.ctaTextColor || '#ffffff',
      refinedCtaBg,
      refinedCtaBg,
      4.6
    );
    typoPatch.ctaBgColor = refinedCtaBg;
    typoPatch.ctaTextColor = refinedCtaFg;
    typoPatch.showCta = true;

    patch.typography = typoPatch;

    const beforeCtaRatio = wcagContrastRatio(
      state.typography.ctaTextColor || '#ffffff',
      state.typography.ctaBgColor || '#ea580c'
    );
    const afterCtaRatio = wcagContrastRatio(refinedCtaFg, refinedCtaBg);
    if (afterCtaRatio - beforeCtaRatio >= 0.3 || !state.typography.showCta) {
      diffs.push({
        id: 'typo-cta',
        area: 'text',
        label: 'CTA Buton Kontrastı (WCAG AA)',
        beforeValue: state.typography.showCta ? `${beforeCtaRatio.toFixed(1)}:1` : 'Kapalı',
        afterValue: `${afterCtaRatio.toFixed(1)}:1`,
      });
    }
    if (typoPatch.headlineColor && typoPatch.headlineColor !== state.typography.headlineColor) {
      diffs.push({
        id: 'typo-headline',
        area: 'text',
        label: 'Başlık Okunabilirlik Rengi',
        beforeValue: state.typography.headlineColor.toUpperCase(),
        afterValue: typoPatch.headlineColor.toUpperCase(),
      });
    }
  }

  // 4. BADGES SAFE ZONE ALIGNMENT
  if (allow('badges')) {
    const safeWarn = audit.checks.find((c) => c.id === 'safe-zone' && c.status === 'warn');
    if (safeWarn?.autoFixPatch?.badgesPosition) {
      patch.badgesPosition = safeWarn.autoFixPatch.badgesPosition;
      diffs.push({
        id: 'badges-safe',
        area: 'badges',
        label: 'Rozet Güvenli Alan Hizası',
        beforeValue: `Y:%${Math.round(state.badgesPosition.y)}`,
        afterValue: `Y:%${Math.round(patch.badgesPosition.y)}`,
      });
    }
  }

  // 5. PROMO BADGE CONTRAST & SAFE PLACEMENT
  if (allow('promo') && state.promoBadge.show) {
    const safeWarn = audit.checks.find((c) => c.id === 'safe-zone' && c.status === 'warn');
    const promoBg = state.promoBadge.color || '#ea580c';
    const whiteOnPromo = wcagContrastRatio('#ffffff', promoBg);
    const nextPromoBg = whiteOnPromo >= 3.0 && whiteOnPromo < 4.5 ? '#c2410c' : promoBg;
    const nextPromoFg = ensureReadableTextColor(
      state.promoBadge.textColor || '#ffffff',
      nextPromoBg,
      nextPromoBg,
      4.5
    );

    patch.promoBadge = {
      ...(safeWarn?.autoFixPatch?.promoBadge || {}),
      color: nextPromoBg,
      textColor: nextPromoFg,
    };

    const beforePromoRatio = wcagContrastRatio(
      state.promoBadge.textColor || '#ffffff',
      promoBg
    );
    const afterPromoRatio = wcagContrastRatio(nextPromoFg, nextPromoBg);
    if (afterPromoRatio - beforePromoRatio >= 0.3) {
      diffs.push({
        id: 'promo-contrast',
        area: 'promo',
        label: 'Kampanya Rozeti Netliği',
        beforeValue: `${beforePromoRatio.toFixed(1)}:1`,
        afterValue: `${afterPromoRatio.toFixed(1)}:1`,
      });
    }
  }

  // Ensure at least 1 meaningful diff entry if already near-optimal
  if (diffs.length === 0) {
    diffs.push({
      id: 'studio-calibrated',
      area: scope,
      label: `${preset.label} Kalibrasyonu`,
      beforeValue: 'Standart',
      afterValue: 'Optimize Edildi',
    });
  }

  const lightingNote =
    optics.exposureStatus === 'underexposed'
      ? `Ürün ortalama parlaklığı düşük (%${Math.round(optics.meanLuminance * 100)}); stüdyo dolgu ışığı ve zemin yansıması dengelendi.`
      : optics.exposureStatus === 'overexposed'
      ? `Parlak bölgelerde patlama riski (%${Math.round(optics.meanLuminance * 100)}); ürün pozlaması ve vinyet dengelendi.`
      : `Aydınlatma dengesi (%${Math.round(optics.meanLuminance * 100)}) ${preset.label.toLowerCase()} sahne ayrımına göre kalibre edildi.`;

  const contrastNote =
    optics.contrastStatus === 'flat'
      ? `Düşük ton aralığı (Δ %${Math.round(optics.dynamicRange * 100)}) genişletilerek ürün hacmi ve WCAG metin kontrastı güçlendirildi.`
      : `Dinamik kontrast eğrisi ve buton okunabilirliği e-ticaret standardına sabitlendi.`;

  const clarityNote =
    optics.clarityStatus === 'soft'
      ? `Yumuşak kenar keskinliği (%${Math.round(optics.edgeAcutance * 100)}) mikro-kontrast netlik filtresiyle keskinleştirildi.`
      : `Ürün etiket ve kontur netliği (%${Math.round(optics.edgeAcutance * 100)}) ince keskinlik katmanıyla korundu.`;

  const compositionNote =
    scope === 'all'
      ? `${state.aspectRatio} formatında ürün odak noktası, güvenli alan payları ve tipografi hiyerarşisi hizalandı.`
      : `Yalnızca seçili katman koruma altına alınarak diğer tuval öğelerine dokunulmadı.`;

  return {
    scope,
    presetId,
    source: 'studio',
    summary: `${preset.label} profiliyle aydınlatma, kontrast ve netlik tek tıkla optimize edildi.`,
    lightingNote,
    contrastNote,
    clarityNote,
    compositionNote,
    patch,
    diffs,
  };
}

/**
 * Normalizes and clamps multimodal AI Smart Auto-Fix JSON response on top of safe deterministic bounds,
 * guaranteeing strict scope isolation and WCAG AA readability.
 */
export function normalizeAiSmartFixResponse(
  rawAi: any,
  state: StudioEditableState,
  optics: ImageOpticsMetrics = DEFAULT_IMAGE_OPTICS,
  scope: EditableAreaId = 'all',
  presetId: SmartFixPresetId = 'marketplace-pro'
): SmartAutoFixPlan {
  const baseline = computeSmartAutoFixPlan(state, optics, scope, presetId);
  if (!rawAi || typeof rawAi !== 'object') {
    return baseline;
  }

  const allow = (area: EditableAreaId) => scope === 'all' || scope === area;
  const validHex = (val: unknown): string | undefined =>
    typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim())
      ? val.trim().toLowerCase()
      : undefined;

  const mergedPatch: StudioPatch = {};
  const diffs: SmartFixDiffItem[] = [];

  if (allow('product')) {
    const baseP = baseline.patch.productPlacement || {};
    const aiP = rawAi?.patch?.productPlacement || rawAi?.productPlacement || {};

    const brightness =
      typeof aiP.brightness === 'number'
        ? clamp(Number(aiP.brightness.toFixed(2)), 0.85, 1.3)
        : baseP.brightness ?? 1.06;
    const contrast =
      typeof aiP.contrast === 'number'
        ? clamp(Number(aiP.contrast.toFixed(2)), 0.92, 1.32)
        : baseP.contrast ?? 1.12;
    const saturation =
      typeof aiP.saturation === 'number'
        ? clamp(Number(aiP.saturation.toFixed(2)), 0.85, 1.3)
        : baseP.saturation ?? 1.05;
    const clarity =
      typeof aiP.clarity === 'number'
        ? clamp(Number(aiP.clarity.toFixed(2)), 0.15, 0.85)
        : baseP.clarity ?? 0.38;
    const shadowOpacity =
      typeof aiP.shadowOpacity === 'number'
        ? clamp(Number(aiP.shadowOpacity.toFixed(2)), 0.15, 0.75)
        : baseP.shadowOpacity ?? 0.48;
    const shadowBlur =
      typeof aiP.shadowBlur === 'number'
        ? clamp(Math.round(aiP.shadowBlur), 8, 42)
        : baseP.shadowBlur ?? 22;
    const ambientGlow =
      typeof aiP.ambientGlow === 'number'
        ? clamp(Number(aiP.ambientGlow.toFixed(2)), 0, 0.75)
        : baseP.ambientGlow ?? 0.28;
    const glowColor = validHex(aiP.glowColor) || baseP.glowColor || state.product.glowColor;
    const x =
      typeof aiP.x === 'number' ? clamp(Math.round(aiP.x), 18, 84) : baseP.x ?? state.product.x;
    const y =
      typeof aiP.y === 'number' ? clamp(Math.round(aiP.y), 24, 82) : baseP.y ?? state.product.y;
    const scale =
      typeof aiP.scale === 'number'
        ? clamp(Number(aiP.scale.toFixed(2)), 0.65, 1.45)
        : baseP.scale ?? state.product.scale;

    mergedPatch.productPlacement = {
      ...baseP,
      brightness,
      contrast,
      saturation,
      clarity,
      shadowOpacity,
      shadowBlur,
      ambientGlow,
      glowColor,
      x,
      y,
      scale,
    };

    diffs.push({
      id: 'ai-prod-light',
      area: 'product',
      label: 'AI Ürün Aydınlatma',
      beforeValue: fmtPct(state.product.brightness ?? 1),
      afterValue: fmtPct(brightness),
    });
    diffs.push({
      id: 'ai-prod-contrast',
      area: 'product',
      label: 'AI Dinamik Kontrast',
      beforeValue: fmtPct(state.product.contrast ?? 1),
      afterValue: fmtPct(contrast),
    });
    diffs.push({
      id: 'ai-prod-clarity',
      area: 'product',
      label: 'AI Görsel Netlik (Clarity)',
      beforeValue: fmtPct(state.product.clarity ?? 0),
      afterValue: fmtPct(clarity),
    });
  }

  if (allow('background')) {
    const baseB = baseline.patch.background || {};
    const aiB = rawAi?.patch?.background || rawAi?.background || {};
    const brightness =
      typeof aiB.brightness === 'number'
        ? clamp(Number(aiB.brightness.toFixed(2)), 0.75, 1.2)
        : baseB.brightness ?? 0.96;
    const contrast =
      typeof aiB.contrast === 'number'
        ? clamp(Number(aiB.contrast.toFixed(2)), 0.88, 1.28)
        : baseB.contrast ?? 1.06;
    const saturation =
      typeof aiB.saturation === 'number'
        ? clamp(Number(aiB.saturation.toFixed(2)), 0.8, 1.25)
        : baseB.saturation ?? 1.04;
    const blur =
      typeof aiB.blur === 'number'
        ? clamp(Number(aiB.blur.toFixed(1)), 0, 6)
        : baseB.blur ?? state.background.blur;
    const vignette =
      typeof aiB.vignette === 'boolean' ? aiB.vignette : baseB.vignette ?? true;

    mergedPatch.background = {
      brightness,
      contrast,
      saturation,
      blur,
      vignette,
    };

    diffs.push({
      id: 'ai-bg-balance',
      area: 'background',
      label: 'AI Sahne Işık & Kontrastı',
      beforeValue: `${fmtPct(state.background.brightness ?? 1)} / ${fmtPct(state.background.contrast ?? 1)}`,
      afterValue: `${fmtPct(brightness)} / ${fmtPct(contrast)}`,
    });
  }

  if (allow('text')) {
    const baseT = baseline.patch.typography || {};
    const aiT = rawAi?.patch?.typography || rawAi?.typography || {};
    const ctaBg = validHex(aiT.ctaBgColor) || baseT.ctaBgColor || state.typography.ctaBgColor;
    const whiteRatio = wcagContrastRatio('#ffffff', ctaBg);
    const safeCtaBg = whiteRatio >= 3.0 && whiteRatio < 4.5 ? '#c2410c' : ctaBg;
    const safeCtaFg = ensureReadableTextColor(
      validHex(aiT.ctaTextColor) || baseT.ctaTextColor || state.typography.ctaTextColor,
      safeCtaBg,
      safeCtaBg,
      4.6
    );

    mergedPatch.typography = {
      ...baseT,
      ...(validHex(aiT.headlineColor) ? { headlineColor: validHex(aiT.headlineColor) } : {}),
      ...(validHex(aiT.highlightColor) ? { highlightColor: validHex(aiT.highlightColor) } : {}),
      ...(validHex(aiT.subtitleColor) ? { subtitleColor: validHex(aiT.subtitleColor) } : {}),
      ctaBgColor: safeCtaBg,
      ctaTextColor: safeCtaFg,
      showCta: true,
    };

    // Never allow AI to introduce a low-contrast headline on gradient scenes
    const testAudit = evaluateStudioDesign({
      aspectRatio: state.aspectRatio,
      background: { ...state.background, ...(mergedPatch.background || {}) },
      product: { ...state.product, ...(mergedPatch.productPlacement || {}) },
      typography: { ...state.typography, ...mergedPatch.typography },
      badges: state.badges,
      badgesPosition: state.badgesPosition,
      promoBadge: state.promoBadge,
    });
    const contrastFix = testAudit.checks.find(
      (c) => c.id === 'contrast' && c.status === 'warn'
    );
    if (contrastFix?.autoFixPatch?.typography) {
      mergedPatch.typography = {
        ...mergedPatch.typography,
        ...contrastFix.autoFixPatch.typography,
      };
    }

    diffs.push({
      id: 'ai-typo-cta',
      area: 'text',
      label: 'Tipografi & CTA Okunabilirlik',
      beforeValue: `${wcagContrastRatio(state.typography.ctaTextColor || '#ffffff', state.typography.ctaBgColor || '#ea580c').toFixed(1)}:1`,
      afterValue: `${wcagContrastRatio(safeCtaFg, safeCtaBg).toFixed(1)}:1`,
    });
  }

  if (allow('badges') && baseline.patch.badgesPosition) {
    mergedPatch.badgesPosition = baseline.patch.badgesPosition;
  }

  if (allow('promo') && baseline.patch.promoBadge) {
    mergedPatch.promoBadge = baseline.patch.promoBadge;
  }

  const cleanStr = (val: unknown, fallback: string) =>
    typeof val === 'string' && val.trim().length > 4 ? val.trim() : fallback;

  return {
    scope,
    presetId,
    source: 'ai',
    summary: cleanStr(rawAi.aiSummary, baseline.summary),
    lightingNote: cleanStr(rawAi.lightingNote, baseline.lightingNote),
    contrastNote: cleanStr(rawAi.contrastNote, baseline.contrastNote),
    clarityNote: cleanStr(rawAi.clarityNote, baseline.clarityNote),
    compositionNote: cleanStr(rawAi.compositionNote, baseline.compositionNote),
    patch: mergedPatch,
    diffs: diffs.length > 0 ? diffs : baseline.diffs,
  };
}
