import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDominantProductColors,
  generateColorHarmonies,
  wcagContrastRatio,
  ensureReadableTextColor,
  normalizeAiHarmonies,
} from './colorHarmony';

test('extractDominantProductColors extracts warm orange & gold tones accurately while ignoring transparent background', () => {
  const w = 80;
  const h = 80;
  const rgba = new Uint8ClampedArray(w * h * 4); // all transparent by default

  // Fill central bottle body with warm orange (#f97316 -> 249, 115, 22)
  for (let y = 15; y < 65; y++) {
    for (let x = 25; x < 55; x++) {
      const idx = (y * w + x) * 4;
      rgba[idx] = 249;
      rgba[idx + 1] = 115;
      rgba[idx + 2] = 22;
      rgba[idx + 3] = 255;
    }
  }

  // Fill bottle cap with deep navy/slate (#1e293b -> 30, 41, 59)
  for (let y = 5; y < 15; y++) {
    for (let x = 32; x < 48; x++) {
      const idx = (y * w + x) * 4;
      rgba[idx] = 30;
      rgba[idx + 1] = 41;
      rgba[idx + 2] = 59;
      rgba[idx + 3] = 255;
    }
  }

  const profile = extractDominantProductColors(rgba, w, h, 4);
  assert.ok(profile.dominantColors.length >= 2);
  assert.equal(profile.temperature, 'warm');
  assert.equal(profile.dominantColors[0].hex, '#f97316');
  assert.ok(profile.dominantColors[0].share > profile.dominantColors[1].share);
});

test('generateColorHarmonies produces 5 distinct harmony schemes with WCAG AA (>= 4.5:1) headline readability', () => {
  const w = 40;
  const h = 40;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 217;
    rgba[i * 4 + 1] = 119;
    rgba[i * 4 + 2] = 6;
    rgba[i * 4 + 3] = 255;
  }

  const profile = extractDominantProductColors(rgba, w, h, 3);
  const harmonies = generateColorHarmonies(profile);

  assert.equal(harmonies.length, 5);
  const types = new Set(harmonies.map((hItem) => hItem.harmonyType));
  assert.equal(types.size, 5);

  for (const harmony of harmonies) {
    const headlineRatio = wcagContrastRatio(
      harmony.typography.headlineColor,
      harmony.background.primaryBgHex
    );
    const subtitleRatio = wcagContrastRatio(
      harmony.typography.subtitleColor,
      harmony.background.primaryBgHex
    );
    const ctaRatio = wcagContrastRatio(
      harmony.typography.ctaTextColor,
      harmony.typography.ctaBgColor
    );

    assert.ok(
      headlineRatio >= 4.5,
      `Expected headline contrast >= 4.5 on ${harmony.id}, got ${headlineRatio}`
    );
    assert.ok(
      subtitleRatio >= 4.5,
      `Expected subtitle contrast >= 4.5 on ${harmony.id}, got ${subtitleRatio}`
    );
    assert.ok(
      ctaRatio >= 4.5,
      `Expected CTA text contrast >= 4.5 on ${harmony.id}, got ${ctaRatio}`
    );
  }
});

test('ensureReadableTextColor auto-fixes low-contrast yellow-on-white or dark-on-dark combinations', () => {
  const fixedOnWhite = ensureReadableTextColor('#fef08a', '#ffffff', '#f8fafc', 4.5);
  assert.ok(wcagContrastRatio(fixedOnWhite, '#ffffff') >= 4.5);

  const fixedOnBlack = ensureReadableTextColor('#1e293b', '#0f172a', '#111827', 4.5);
  assert.ok(wcagContrastRatio(fixedOnBlack, '#0f172a') >= 4.5);
});

test('normalizeAiHarmonies sanitizes malformed colors and enforces WCAG contrast on AI palettes', () => {
  const normalized = normalizeAiHarmonies([
    {
      badge: 'AI Editoryal',
      title: 'Krem & Kehribar',
      description: 'Yumuşak krem fon.',
      primaryBgHex: '#fffbeb',
      secondaryBgHex: '#fef3c7',
      headlineColor: '#fef9c3', // deliberately unreadable light yellow on cream!
      highlightColor: '#fde68a',
      subtitleColor: '#ffffff',
      ctaBgColor: '#fbbf24',
      ctaTextColor: '#ffffff', // unreadable white on bright yellow!
    },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].harmonyType, 'ai-bespoke');
  assert.ok(
    wcagContrastRatio(normalized[0].typography.headlineColor, '#fffbeb') >= 4.5,
    'Unreadable AI headlineColor should be automatically corrected to high contrast'
  );
  assert.ok(
    wcagContrastRatio(normalized[0].typography.ctaTextColor, '#fbbf24') >= 4.5,
    'Unreadable AI ctaTextColor should be automatically corrected to high contrast'
  );
});
