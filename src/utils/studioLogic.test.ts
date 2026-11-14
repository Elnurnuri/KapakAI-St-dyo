import test from 'node:test';
import assert from 'node:assert/strict';
import { computeForegroundAlpha } from './backgroundRemoval';
import { createSnapshot, pushUndoPast, applyUndo, applyRedo } from './history';
import { getDimensionsForRatio } from './exportCanvas';
import { applyStudioPatch, mapActiveElementToArea } from './aiPatch';
import { normalizeGeneratedTemplates } from './aiTemplates';
import { COVER_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import type { HistoryItem } from '../types';

function makeDummyHistoryItem(headline: string): HistoryItem {
  return {
    placement: {
      src: 'data:image/png;base64,abc',
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      flipX: false,
      shadowOpacity: 0.4,
      shadowBlur: 20,
      shadowOffsetY: 16,
      shadowSpread: 0,
      reflection: true,
      reflectionOpacity: 0.3,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      ambientGlow: 0,
      glowColor: '#ffffff',
    },
    background: {
      type: 'gradient',
      gradient: 'linear-gradient(135deg, #000, #fff)',
      blur: 0,
      brightness: 1,
      vignette: false,
    },
    typography: {
      kicker: 'TEST',
      headline,
      subtitle: 'Sub',
      ctaText: 'Go',
      showCta: true,
      fontFamily: 'Inter',
      headlineColor: '#000',
      highlightColor: '#f00',
      subtitleColor: '#333',
      ctaBgColor: '#000',
      ctaTextColor: '#fff',
      headlineSize: 1,
      alignment: 'left',
      positionX: 8,
      positionY: 10,
    },
    badges: [],
    badgesPosition: { x: 8, y: 60 },
    promoBadge: {
      show: true,
      type: 'circle',
      text: '25%',
      color: '#f00',
      textColor: '#fff',
      x: 80,
      y: 20,
      scale: 1,
      rotation: 0,
    },
    floatingElements: [],
    aspectRatio: '4:5',
    layers: [],
  };
}

test('computeForegroundAlpha smart-flood strips exterior white background while preserving white interior inside dark border', () => {
  // 20x20 synthetic image:
  // Outer background: white (255,255,255)
  // Product box (x: 5..14, y: 5..14) has dark rim (20,20,20) and white interior (255,255,255)
  const w = 20;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const inBox = x >= 5 && x <= 14 && y >= 5 && y <= 14;
      const onRim =
        inBox && (x === 5 || x === 14 || y === 5 || y === 14);

      if (onRim) {
        data[idx] = 20;
        data[idx + 1] = 20;
        data[idx + 2] = 20;
      } else {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }
      data[idx + 3] = 255;
    }
  }

  const smart = computeForegroundAlpha(data, w, h, {
    tolerance: 32,
    feather: 0,
    mode: 'smart-flood',
  });

  // Exterior corner (1,1) should be transparent (0)
  assert.equal(smart.alphaMap[1 * w + 1], 0);
  // Dark rim (5,5) should be opaque (1)
  assert.equal(smart.alphaMap[5 * w + 5], 1);
  // White interior center (10,10) protected by smart-flood!
  assert.equal(smart.alphaMap[10 * w + 10], 1);

  // Contrast with global-color mode which strips enclosed white too
  const global = computeForegroundAlpha(data, w, h, {
    tolerance: 32,
    feather: 0,
    mode: 'global-color',
  });
  assert.equal(global.alphaMap[10 * w + 10], 0);
});

test('undo / redo stack works cleanly from the very first action', () => {
  const s0 = createSnapshot(makeDummyHistoryItem('Başlık 0'));
  const s1 = createSnapshot(makeDummyHistoryItem('Başlık 1'));
  const s2 = createSnapshot(makeDummyHistoryItem('Başlık 2'));

  let past: HistoryItem[] = [];
  let future: HistoryItem[] = [];
  let current = s0;

  // User makes Edit 1 -> s1
  past = pushUndoPast(past, current);
  future = [];
  current = s1;

  // User makes Edit 2 -> s2
  past = pushUndoPast(past, current);
  future = [];
  current = s2;

  assert.equal(past.length, 2);
  assert.equal(current.typography.headline, 'Başlık 2');

  // Undo back to s1
  const u1 = applyUndo(past, future, current);
  assert.ok(u1.restored);
  past = u1.nextPast;
  future = u1.nextFuture;
  current = u1.restored;
  assert.equal(current.typography.headline, 'Başlık 1');

  // Undo back to s0 (initial state)
  const u2 = applyUndo(past, future, current);
  assert.ok(u2.restored);
  past = u2.nextPast;
  future = u2.nextFuture;
  current = u2.restored;
  assert.equal(current.typography.headline, 'Başlık 0');
  assert.equal(past.length, 0);

  // Redo forward to s1 and s2
  const r1 = applyRedo(past, future, current);
  assert.ok(r1.restored);
  past = r1.nextPast;
  future = r1.nextFuture;
  current = r1.restored;
  assert.equal(current.typography.headline, 'Başlık 1');

  const r2 = applyRedo(past, future, current);
  assert.ok(r2.restored);
  current = r2.restored;
  assert.equal(current.typography.headline, 'Başlık 2');
});

test('getDimensionsForRatio returns exact commercial export pixel sizes', () => {
  assert.deepEqual(getDimensionsForRatio('1:1', 1080), { width: 1080, height: 1080 });
  assert.deepEqual(getDimensionsForRatio('4:5', 1080), { width: 1080, height: 1350 });
  assert.deepEqual(getDimensionsForRatio('9:16', 1080), { width: 1080, height: 1920 });
  assert.deepEqual(getDimensionsForRatio('16:9', 1080), { width: 1920, height: 1080 });
});

test('mapActiveElementToArea maps studio canvas selection ids accurately', () => {
  assert.equal(mapActiveElementToArea('text'), 'text');
  assert.equal(mapActiveElementToArea('product'), 'product');
  assert.equal(mapActiveElementToArea('badges'), 'badges');
  assert.equal(mapActiveElementToArea('promo'), 'promo');
  assert.equal(mapActiveElementToArea('background'), 'background');
  assert.equal(mapActiveElementToArea('floating-f1'), 'all');
  assert.equal(mapActiveElementToArea(null), 'all');
});

test('applyStudioPatch scopes changes to targetArea, clamps values, preserves product.src, and syncs floating layers', () => {
  const base = makeDummyHistoryItem('Eski Başlık');
  const initialState = {
    aspectRatio: base.aspectRatio,
    background: base.background,
    typography: base.typography,
    badges: base.badges,
    badgesPosition: base.badgesPosition ?? { x: 8, y: 60 },
    promoBadge: base.promoBadge,
    product: { ...base.placement, originalSrc: 'data:image/png;base64,orig' },
    floatingElements: base.floatingElements,
    layers: [
      { id: 'layer-product', name: 'Ürün Dekupesi', type: 'product' as const, visible: true, locked: false },
      { id: 'layer-typography', name: 'Başlık & Metin', type: 'typography' as const, visible: true, locked: false },
    ],
  };

  // 1. Scoped to 'text': unauthorized background patch must be ignored, headlineSize clamped
  const textRes = applyStudioPatch(
    initialState,
    {
      background: { gradient: 'linear-gradient(#f00, #00f)' },
      typography: {
        headline: 'YENİ LÜKS BAŞLIK',
        headlineSize: 3.5, // exceeds max 1.6
        fontFamily: 'Playfair Display',
      },
    },
    'text'
  );
  assert.equal(textRes.nextState.background.gradient, initialState.background.gradient);
  assert.equal(textRes.nextState.typography.headline, 'YENİ LÜKS BAŞLIK');
  assert.equal(textRes.nextState.typography.headlineSize, 1.6);
  assert.equal(textRes.nextState.typography.fontFamily, 'Playfair Display');
  assert.deepEqual(textRes.appliedChanges, ['Metin & tipografi güncellendi']);

  // 2. Full template ('all'): preserves product.src/originalSrc and rebuilds floating layers cleanly
  const allRes = applyStudioPatch(
    initialState,
    {
      productPlacement: { scale: 2.5, x: 5, shadowOpacity: 0.8 },
      floatingElements: [
        { id: 'fl-1', type: 'sparkle', x: 20, y: 25, scale: 1.2, rotation: 0, opacity: 0.9 },
      ],
    },
    'all'
  );
  assert.equal(allRes.nextState.product.src, initialState.product.src);
  assert.equal(allRes.nextState.product.originalSrc, 'data:image/png;base64,orig');
  assert.equal(allRes.nextState.product.scale, 1.8); // clamped
  assert.equal(allRes.nextState.product.x, 10); // clamped
  assert.equal(allRes.nextState.floatingElements.length, 1);
  assert.ok(allRes.nextState.layers.some((l) => l.floatingId === 'fl-1'));
});

test('COVER_TEMPLATES provides at least 21 unique templates covering all 9 categories', () => {
  assert.ok(COVER_TEMPLATES.length >= 21);
  const ids = new Set(COVER_TEMPLATES.map((t) => t.id));
  assert.equal(ids.size, COVER_TEMPLATES.length);

  const categories = TEMPLATE_CATEGORIES.filter((c) => c !== 'Tümü');
  assert.equal(categories.length, 9);
  for (const cat of categories) {
    const matches = COVER_TEMPLATES.filter((t) => t.category === cat);
    assert.ok(matches.length >= 2, `Category ${cat} should have at least 2 templates`);
  }
});

test('normalizeGeneratedTemplates sanitizes, clamps, and marks custom AI templates from scratch', () => {
  const result = normalizeGeneratedTemplates(
    [
      {
        title: 'Kış Spor Ayakkabı Özel',
        category: 'Geçersiz Kategori',
        aspectRatio: '16:9',
        background: { gradient: 'linear-gradient(135deg, #0f172a, #0284c7)', vignette: true },
        typography: {
          headline: 'KIŞ KOŞUSU',
          headlineColor: 'not-a-hex',
          headlineSize: 9.9,
          fontFamily: 'InvalidFont',
          alignment: 'center',
          positionX: 50,
          positionY: 8,
        },
        badges: [{ icon: 'invalid-icon', label: 'Su Geçirmez' }],
        floatingElements: [{ type: 'glow-ring', x: 150, y: -10, scale: 5 }],
        productDefaultPlacement: { x: 200, y: 50, scale: 0.1 },
      },
      {},
    ],
    {
      fallbackCategory: 'Aksiyon & Teknoloji',
      preferredAspectRatio: '4:5',
      seedTimestamp: 123456,
    }
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'ai-custom-123456-0');
  assert.equal(result[0].isCustomAi, true);
  assert.equal(result[0].category, 'Aksiyon & Teknoloji'); // invalid category fell back
  assert.equal(result[0].aspectRatio, '4:5'); // respected preferredAspectRatio
  assert.equal(result[0].typography.headlineColor, '#ffffff'); // invalid hex fell back
  assert.equal(result[0].typography.headlineSize, 1.45); // clamped max
  assert.equal(result[0].typography.fontFamily, 'Cabinet Grotesk'); // invalid font fell back
  assert.equal(result[0].badges[0].icon, 'sparkles');
  assert.equal(result[0].floatingElements[0].x, 94); // clamped
  assert.equal(result[0].floatingElements[0].y, 6); // clamped
  assert.equal(result[0].productDefaultPlacement.x, 86); // clamped
  assert.equal(result[0].productDefaultPlacement.scale, 0.55); // clamped
  assert.ok(result[0].layers && result[0].layers.length >= 5);
  assert.notEqual(result[0].id, result[1].id);
});

import { STUDIO_BACKDROPS } from '../data/backgrounds';

test('STUDIO_BACKDROPS provides at least 8 unique photographic backdrops and Pazaryeri & Vitrin templates use distinct backgrounds', () => {
  assert.ok(STUDIO_BACKDROPS.length >= 8);
  const bgUrls = new Set(STUDIO_BACKDROPS.map((b) => b.imageUrl));
  assert.equal(bgUrls.size, STUDIO_BACKDROPS.length);

  const showcaseTemplates = COVER_TEMPLATES.filter((t) => t.category === 'Pazaryeri & Vitrin');
  assert.equal(showcaseTemplates.length, 5);
  const showcaseBackgroundKeys = new Set(
    showcaseTemplates.map((t) => `${t.background.type}:${t.background.imageUrl ?? t.background.gradient}`)
  );
  assert.equal(
    showcaseBackgroundKeys.size,
    showcaseTemplates.length,
    'Each Pazaryeri & Vitrin template must have a distinct background'
  );
});

