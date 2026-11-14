import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CREATIVE_MODES,
  AI_STYLE_PRESETS,
  applyModeLayerVisibility,
  buildAiCreativePrompt,
  mapAnalyzeResponseToCopyOptions,
  mapAspectRatioForGemini,
} from './aiCreative';
import type { CanvasLayer } from '../types';

test('AI_CREATIVE_MODES covers all 6 requested creative modes and AI_STYLE_PRESETS maps across all modes', () => {
  assert.equal(AI_CREATIVE_MODES.length, 6);
  const modeIds = new Set(AI_CREATIVE_MODES.map((m) => m.id));
  for (const preset of AI_STYLE_PRESETS) {
    assert.ok(modeIds.has(preset.mode), `Preset ${preset.id} has valid mode`);
    assert.ok(preset.prompt.trim().length > 20);
  }
  for (const mode of AI_CREATIVE_MODES) {
    assert.ok(
      AI_STYLE_PRESETS.some((p) => p.mode === mode.id),
      `Mode ${mode.id} should have at least one preset`
    );
  }
});

test('mapAspectRatioForGemini maps 4:5 cleanly to 3:4 and preserves supported ratios', () => {
  assert.equal(mapAspectRatioForGemini('1:1'), '1:1');
  assert.equal(mapAspectRatioForGemini('4:5'), '3:4');
  assert.equal(mapAspectRatioForGemini('9:16'), '9:16');
  assert.equal(mapAspectRatioForGemini('16:9'), '16:9');
});

test('buildAiCreativePrompt differentiates full-poster, studio-scene, sticker-3d, and brand-board requirements', () => {
  const posterPrompt = buildAiCreativePrompt({
    mode: 'full-poster',
    prompt: 'Siyah akıllı telefon reklam afişi',
    headlineText: 'YENİ PRO',
    subtext: '48MP Kamera • 120Hz',
    badgeText: 'ŞİMDİ KEŞFET',
    hasProductImage: true,
    hasReferenceImage: true,
  });
  assert.ok(posterPrompt.includes('CRITICAL PRODUCT PRESERVATION'));
  assert.ok(posterPrompt.includes('STYLE REFERENCE MATCH'));
  assert.ok(posterPrompt.includes('YENİ PRO'));
  assert.ok(posterPrompt.includes('ŞİMDİ KEŞFET'));

  const studioPrompt = buildAiCreativePrompt({
    mode: 'studio-scene',
    prompt: 'Islak taş podyum',
  });
  assert.ok(studioPrompt.includes('ZERO baked text'));

  const stickerPrompt = buildAiCreativePrompt({
    mode: 'sticker-3d',
    prompt: '3D kavisli ok rozeti',
    headlineText: 'ESKİYİ YENİLE',
  });
  assert.ok(stickerPrompt.includes('#FFFFFF'));
  assert.ok(stickerPrompt.includes('ESKİYİ YENİLE'));

  const brandPrompt = buildAiCreativePrompt({
    mode: 'brand-board',
    prompt: 'Kahve markası rehberi',
  });
  assert.ok(brandPrompt.includes('Brand Identity Guideline'));
});

test('mapAnalyzeResponseToCopyOptions normalizes backend /api/ai/analyze-and-copy schema cleanly', () => {
  const mapped = mapAnalyzeResponseToCopyOptions({
    productTitle: 'Lüks Parfüm 100ml',
    category: 'Lüks & Parfüm',
    colorPalette: ['#111827', '#f59e0b'],
    recommendedAiPrompt: 'Golden marble podium',
    marketingHeadlines: [
      {
        eyebrow: 'İMZA KOKU',
        title: 'ALTIN DOKUNUŞ',
        subtitle: '24 saat kalıcı esans.',
        cta: 'Keşfet',
      },
    ],
    featureBadges: [{ icon: 'sparkles', label: '%100 Orijinal' }],
  });

  assert.equal(mapped.productName, 'Lüks Parfüm 100ml');
  assert.equal(mapped.recommendedScenePrompt, 'Golden marble podium');
  assert.deepEqual(mapped.colorPalette, ['#111827', '#f59e0b']);
  assert.equal(mapped.options.length, 1);
  assert.equal(mapped.options[0].kicker, 'İMZA KOKU');
  assert.equal(mapped.options[0].headline, 'ALTIN DOKUNUŞ');
  assert.deepEqual(mapped.options[0].badges, ['%100 Orijinal']);
});

test('applyModeLayerVisibility hides overlapping overlays for full AI designs and keeps them in studio-scene', () => {
  const sampleLayers: CanvasLayer[] = [
    { id: 'layer-promo', name: 'Kampanya Rozeti', type: 'promoBadge', visible: true, locked: false },
    { id: 'layer-badges', name: 'Özellik Rozetleri', type: 'badges', visible: true, locked: false },
    { id: 'layer-product', name: 'Ürün Dekupesi', type: 'product', visible: true, locked: false },
    { id: 'layer-typography', name: 'Başlık & Metin', type: 'typography', visible: true, locked: false },
  ];

  const hidden = applyModeLayerVisibility(sampleLayers, 'full-poster', false);
  assert.ok(hidden.every((l) => l.visible === false));

  const kept = applyModeLayerVisibility(sampleLayers, 'full-poster', true);
  assert.ok(kept.every((l) => l.visible === true));

  const studio = applyModeLayerVisibility(hidden, 'studio-scene', false);
  assert.equal(studio.find((l) => l.type === 'product')?.visible, true);
  assert.equal(studio.find((l) => l.type === 'typography')?.visible, true);
});
