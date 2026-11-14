import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZipArchive, computeCrc32 } from './zipBuilder';
import { adaptStateToAspectRatio, AdaptableStudioState } from './campaignPack';
import { evaluateStudioDesign, normalizeAbVariations } from './adAuditor';
import { applyStudioPatch } from './aiPatch';

function createBaseStudioState(): AdaptableStudioState {
  return {
    aspectRatio: '4:5',
    background: {
      type: 'gradient',
      gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      blur: 0,
      brightness: 1,
      vignette: false,
      stageStyle: 'none',
    },
    product: {
      src: 'data:image/png;base64,iVBORw0KGgo=',
      x: 65,
      y: 58,
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
      ambientGlow: 0.2,
      glowColor: '#ffffff',
    },
    typography: {
      kicker: 'YENİ SERİ',
      headline: 'KORU. BESLE.',
      headlineHighlight: 'IŞILDA.',
      subtitle: 'Gün boyu ferah koruma sağlayan hafif formül.',
      ctaText: 'HEMEN KEŞFET',
      showCta: true,
      fontFamily: 'Cabinet Grotesk',
      headlineColor: '#0f172a',
      highlightColor: '#c2410c',
      subtitleColor: '#334155',
      ctaBgColor: '#9a3412',
      ctaTextColor: '#ffffff',
      headlineSize: 1,
      alignment: 'left',
      positionX: 7,
      positionY: 14,
      plaqueStyle: 'none',
    },
    badges: [
      { id: 'b1', icon: 'sun', label: 'SPF 50+ Koruma' },
      { id: 'b2', icon: 'droplet', label: '24s Nemlendirme' },
    ],
    badgesPosition: { x: 7, y: 62 },
    promoBadge: {
      show: true,
      type: 'pill',
      text: '%25 İNDİRİM',
      subtext: 'BUGÜNE ÖZEL',
      color: '#9a3412',
      textColor: '#ffffff',
      x: 82,
      y: 18,
      scale: 1,
      rotation: -4,
    },
    floatingElements: [
      {
        id: 'f1',
        type: 'sparkle',
        x: 45,
        y: 8,
        scale: 1,
        rotation: 0,
        opacity: 0.9,
      },
    ],
    layers: [
      { id: 'layer-promo', name: 'Kampanya Rozeti', type: 'promoBadge', visible: true, locked: false },
      { id: 'layer-badges', name: 'Özellik Rozetleri', type: 'badges', visible: true, locked: false },
      { id: 'layer-float-f1', name: 'Işıltı', type: 'floating', visible: true, locked: false, floatingId: 'f1' },
      { id: 'layer-product', name: 'Ürün', type: 'product', visible: true, locked: false },
      { id: 'layer-typography', name: 'Metin', type: 'typography', visible: true, locked: false },
    ],
  };
}

test('buildZipArchive produces a spec-compliant PKZIP binary with exact CRC-32 and EOCD headers', () => {
  const encoder = new TextEncoder();
  const payloadA = encoder.encode('123456789'); // Standard IEEE 802.3 CRC-32 test vector -> 0xCBF43926
  assert.equal(computeCrc32(payloadA), 0xcbf43926);

  const payloadB = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG signature bytes
  const archive = buildZipArchive([
    { name: '1x1-post.txt', data: payloadA },
    { name: '9x16-reels.png', data: payloadB },
  ]);

  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  // Local file header 1 magic = PK\x03\x04
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), 0xcbf43926);

  // End of Central Directory magic at archive.length - 22 = PK\x05\x06
  const eocdOffset = archive.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  // Total entry count = 2
  assert.equal(view.getUint16(eocdOffset + 10, true), 2);
});

test('adaptStateToAspectRatio reflows 9:16 inside Story/Reels safe zones and 16:9 into widescreen split', () => {
  const base = createBaseStudioState();

  const story = adaptStateToAspectRatio(base, '9:16');
  assert.equal(story.aspectRatio, '9:16');
  assert.equal(story.typography.alignment, 'center');
  assert.ok(story.typography.positionY >= 14 && story.typography.positionY <= 82);
  assert.ok(story.badgesPosition.y >= 14 && story.badgesPosition.y <= 82);
  assert.ok(story.floatingElements[0].y >= 16 && story.floatingElements[0].y <= 82);

  const banner = adaptStateToAspectRatio(base, '16:9');
  assert.equal(banner.aspectRatio, '16:9');
  assert.equal(banner.typography.alignment, 'left');
  assert.ok(banner.product.x >= 68, 'Product should sit on right Golden zone in 16:9 banner');
});

test('evaluateStudioDesign flags contrast, CTA, safe-zone, and collision issues and auto-fixes them cleanly', () => {
  const broken = createBaseStudioState();
  broken.aspectRatio = '9:16';
  broken.typography.headlineColor = '#f1f5f9'; // Unreadable pale gray on light gradient!
  broken.typography.showCta = false; // Missing CTA
  broken.typography.positionY = 4; // Inside top Reels UI danger zone!
  broken.typography.positionX = 50;
  broken.typography.alignment = 'center';
  broken.product.x = 50;
  broken.product.y = 18; // Colliding right on top of headline!

  const initialReport = evaluateStudioDesign(broken);
  assert.ok(initialReport.passedCount <= 2, `Expected multiple warnings, got ${initialReport.passedCount}/5`);

  // Apply every autoFixPatch sequentially via applyStudioPatch
  let fixedState = { ...broken };
  for (const check of initialReport.checks) {
    if (check.status === 'warn' && check.autoFixPatch) {
      const { nextState } = applyStudioPatch(fixedState, check.autoFixPatch, 'all');
      fixedState = { ...fixedState, ...nextState };
    }
  }

  const afterReport = evaluateStudioDesign(fixedState);
  assert.equal(
    afterReport.passedCount,
    afterReport.totalCount,
    `Expected all ${afterReport.totalCount} checks to pass after auto-fix, got: ${JSON.stringify(
      afterReport.checks.filter((c) => c.status === 'warn').map((c) => c.id)
    )}`
  );
});

test('normalizeAbVariations enforces WCAG AA CTA text contrast and clean defaults', () => {
  const vars = normalizeAbVariations([
    {
      angleBadge: 'Test Açı',
      angleTitle: 'Rasyonel Performans',
      headline: 'ULTRA HIZLI ETKİ',
      ctaBgHex: '#facc15', // bright yellow
      ctaTextHex: '#ffffff', // unreadable white on yellow -> should auto-correct to dark
    },
  ]);

  assert.equal(vars.length, 1);
  assert.notEqual(vars[0].ctaTextHex, '#ffffff');
});
