import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeImageOptics,
  applyConvolutionSharpenToImageData,
  computeSmartAutoFixPlan,
  normalizeAiSmartFixResponse,
} from './smartAutoFix';
import { applyStudioPatch, StudioEditableState } from './aiPatch';
import { COVER_TEMPLATES } from '../data/templates';
import { wcagContrastRatio } from './colorHarmony';

function makeBaseStudioState(): StudioEditableState {
  const tmpl = COVER_TEMPLATES[0];
  return {
    aspectRatio: '4:5',
    background: { ...tmpl.background },
    typography: {
      ...tmpl.typography,
      ctaBgColor: '#ea580c', // 3.6:1 with white -> should be upgraded to >= 4.5:1
      ctaTextColor: '#ffffff',
    },
    badges: tmpl.badges.map((b) => ({ ...b })),
    badgesPosition: { ...(tmpl.badgesPosition || { x: 7, y: 60 }) },
    promoBadge: { ...tmpl.promoBadge },
    product: {
      src: 'data:image/png;base64,iVBORw0KGgo=',
      x: 16, // Deliberately colliding with left-aligned headline!
      y: 22,
      scale: 1.0,
      rotation: 0,
      flipX: false,
      shadowOpacity: 0.2,
      shadowBlur: 10,
      shadowOffsetY: 12,
      shadowSpread: 0,
      reflection: false,
      reflectionOpacity: 0.2,
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      clarity: 0,
      ambientGlow: 0,
      glowColor: '#ffffff',
    },
    floatingElements: [],
    layers: [],
  };
}

test('analyzeImageOptics detects dark/flat/soft vs bright/high-contrast/sharp product buffers', () => {
  const width = 24;
  const height = 24;
  const darkFlat = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    darkFlat[i * 4] = 48;
    darkFlat[i * 4 + 1] = 50;
    darkFlat[i * 4 + 2] = 52;
    darkFlat[i * 4 + 3] = 255;
  }
  const darkMetrics = analyzeImageOptics({ data: darkFlat, width, height });
  assert.equal(darkMetrics.exposureStatus, 'underexposed');
  assert.equal(darkMetrics.contrastStatus, 'flat');
  assert.equal(darkMetrics.clarityStatus, 'soft');

  // Checkerboard high-frequency interior pattern -> high contrast & crisp acutance
  const crispBuf = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const hi = (x + y) % 2 === 0 ? 225 : 75;
      crispBuf[idx] = hi;
      crispBuf[idx + 1] = Math.round(hi * 0.85);
      crispBuf[idx + 2] = 40;
      crispBuf[idx + 3] = 255;
    }
  }
  const crispMetrics = analyzeImageOptics({ data: crispBuf, width, height });
  assert.equal(crispMetrics.exposureStatus, 'balanced');
  assert.equal(crispMetrics.clarityStatus, 'crisp');
  assert.ok(crispMetrics.edgeAcutance > darkMetrics.edgeAcutance);
});

test('computeSmartAutoFixPlan lifts underexposed product, boosts clarity, resolves collision, and enforces WCAG CTA contrast', () => {
  const state = makeBaseStudioState();
  const plan = computeSmartAutoFixPlan(
    state,
    {
      meanLuminance: 0.28,
      rmsContrast: 0.11,
      dynamicRange: 0.3,
      edgeAcutance: 0.18,
      meanSaturation: 0.22,
      exposureStatus: 'underexposed',
      contrastStatus: 'flat',
      clarityStatus: 'soft',
    },
    'all',
    'marketplace-pro'
  );

  assert.ok((plan.patch.productPlacement?.brightness ?? 1) > 1.1);
  assert.ok((plan.patch.productPlacement?.contrast ?? 1) >= 1.18);
  assert.ok((plan.patch.productPlacement?.clarity ?? 0) >= 0.5);
  // Colliding product at x=16, y=22 should be moved away from left headline
  assert.ok((plan.patch.productPlacement?.x ?? 16) >= 55);

  const { nextState } = applyStudioPatch(state, plan.patch, 'all');
  const ctaContrast = wcagContrastRatio(
    nextState.typography.ctaTextColor,
    nextState.typography.ctaBgColor
  );
  assert.ok(ctaContrast >= 4.5, `Expected WCAG AA CTA >= 4.5, got ${ctaContrast}`);
});

test('computeSmartAutoFixPlan strictly isolates selected scope (product-only leaves text & background untouched)', () => {
  const state = makeBaseStudioState();
  const plan = computeSmartAutoFixPlan(state, undefined, 'product', 'crisp-commercial');

  assert.ok(plan.patch.productPlacement, 'Expected productPlacement patch');
  assert.equal(plan.patch.background, undefined, 'Background must not be patched in product scope');
  assert.equal(plan.patch.typography, undefined, 'Typography must not be patched in product scope');

  const { nextState } = applyStudioPatch(state, plan.patch, 'product');
  assert.equal(nextState.typography.ctaBgColor, state.typography.ctaBgColor);
  assert.ok((nextState.product.clarity ?? 0) >= 0.55);
});

test('normalizeAiSmartFixResponse clamps out-of-range AI numbers and enforces WCAG AA readability', () => {
  const state = makeBaseStudioState();
  const plan = normalizeAiSmartFixResponse(
    {
      aiSummary: 'AI stüdyo ışık dengesini ve keskinliği optimize etti.',
      patch: {
        productPlacement: {
          brightness: 9.5, // extreme -> must clamp to <= 1.3
          contrast: 0.1, // extreme -> must clamp to >= 0.92
          clarity: 4.0, // extreme -> must clamp to <= 0.85
        },
        typography: {
          ctaBgColor: '#fef08a', // bright yellow
          ctaTextColor: '#ffffff', // unreadable white on yellow -> must auto-fix to dark ink
        },
      },
    },
    state,
    undefined,
    'all',
    'luxury-editorial'
  );

  assert.equal(plan.source, 'ai');
  assert.equal(plan.patch.productPlacement?.brightness, 1.3);
  assert.equal(plan.patch.productPlacement?.contrast, 0.92);
  assert.equal(plan.patch.productPlacement?.clarity, 0.85);

  const ctaRatio = wcagContrastRatio(
    plan.patch.typography?.ctaTextColor || '#ffffff',
    plan.patch.typography?.ctaBgColor || '#fef08a'
  );
  assert.ok(ctaRatio >= 4.5, `Expected normalized AI CTA contrast >= 4.5, got ${ctaRatio}`);
});

test('applyConvolutionSharpenToImageData sharpens interior step edge while preserving transparent silhouette alpha', () => {
  const w = 6;
  const h = 6;
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const val = x < 3 ? 90 : 170;
      buf[idx] = val;
      buf[idx + 1] = val;
      buf[idx + 2] = val;
      buf[idx + 3] = 255;
    }
  }

  const sharpened = applyConvolutionSharpenToImageData(buf, w, h, 0.8);
  // Transparent border pixel alpha remains 0
  assert.equal(sharpened[3], 0);
  // Interior left-of-edge pixel (x=2, y=2) gets darker (< 90) and right-of-edge pixel (x=3, y=2) gets brighter (> 170)
  const leftEdgeIdx = (2 * w + 2) * 4;
  const rightEdgeIdx = (2 * w + 3) * 4;
  assert.ok(sharpened[leftEdgeIdx] < 90, `Expected < 90, got ${sharpened[leftEdgeIdx]}`);
  assert.ok(sharpened[rightEdgeIdx] > 170, `Expected > 170, got ${sharpened[rightEdgeIdx]}`);
});
