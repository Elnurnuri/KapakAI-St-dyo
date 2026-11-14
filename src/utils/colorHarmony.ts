import { loadImage } from './backgroundRemoval';

export interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number]; // h: 0..360, s: 0..100, l: 0..100
  share: number; // percentage 0..100
  name: string;
}

export interface ProductColorProfile {
  dominantColors: ExtractedColor[];
  temperature: 'warm' | 'cool' | 'neutral';
  temperatureLabel: string;
  averageLightness: number;
  averageSaturation: number;
  moodSummary: string;
}

export type HarmonyCategory =
  | 'complementary'
  | 'analogous'
  | 'tonal-light'
  | 'split-dark'
  | 'triadic-pop'
  | 'ai-bespoke';

export interface ColorHarmonyRecommendation {
  id: string;
  harmonyType: HarmonyCategory;
  badge: string;
  title: string;
  description: string;
  background: {
    gradient: string;
    primaryBgHex: string;
    secondaryBgHex: string;
    vignette: boolean;
  };
  typography: {
    headlineColor: string;
    highlightColor: string;
    subtitleColor: string;
    ctaBgColor: string;
    ctaTextColor: string;
  };
  productAccent: {
    glowColor: string;
    ambientGlow: number;
    promoColor: string;
    promoTextColor: string;
  };
  contrastScore: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const cleaned = (hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return [128, 128, 128];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      case bn:
        h = ((rn - gn) / d + 4) * 60;
        break;
    }
  }

  return [Math.round(wrapHue(h)), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = wrapHue(h) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

export function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const s = clamp(c, 0, 255) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function wcagContrastRatio(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Ensures foreground text color achieves at least `minRatio` WCAG contrast against both background stops.
 */
export function ensureReadableTextColor(
  candidateHex: string,
  primaryBgHex: string,
  secondaryBgHex?: string,
  minRatio = 4.5
): string {
  const bg2 = secondaryBgHex || primaryBgHex;
  const check = (fg: string) =>
    Math.min(wcagContrastRatio(fg, primaryBgHex), wcagContrastRatio(fg, bg2));

  if (/^#[0-9a-fA-F]{6}$/.test(candidateHex) && check(candidateHex) >= minRatio) {
    return candidateHex;
  }

  const [r, g, b] = hexToRgb(candidateHex);
  const [h, s] = rgbToHsl(r, g, b);

  const whiteContrast = check('#ffffff');
  const darkContrast = check('#09090b');

  if (whiteContrast >= darkContrast) {
    for (const l of [84, 90, 95, 98]) {
      const hex = hslToHex(h, Math.min(s, 75), l);
      if (check(hex) >= minRatio) return hex;
    }
    return '#ffffff';
  } else {
    for (const l of [22, 16, 11, 6]) {
      const hex = hslToHex(h, Math.min(s, 65), l);
      if (check(hex) >= minRatio) return hex;
    }
    return '#09090b';
  }
}

export function describeColorNameTr(h: number, s: number, l: number): string {
  if (l >= 92 && s < 18) return 'Fildişi Beyaz';
  if (l <= 13) return 'Obsidyen Siyah';
  if (s < 12) {
    if (l > 72) return 'Gümüş Gri';
    if (l > 40) return 'Antrasit Gri';
    return 'Koyu Grafit';
  }

  const hue = wrapHue(h);

  if (hue < 16 || hue >= 345) {
    if (l >= 76) return 'Pudra Mercan';
    if (l <= 30) return 'Bordo Yakut';
    return s >= 65 ? 'Canlı Mercan' : 'Gül Kırmızısı';
  }
  if (hue < 36) {
    if (l >= 78) return 'Pastel Şeftali';
    if (l >= 63) return s >= 70 ? 'Kayısı Turuncu' : 'Sıcak Somon';
    if (l <= 36) return 'Koyu Bakır';
    return s >= 75 ? 'Canlı Mandalina' : 'Toprak Turuncu';
  }
  if (hue < 56) {
    if (l >= 78) return 'Şampanya Krem';
    if (l <= 35) return 'Karamel Bronz';
    return 'Kehribar Altın';
  }
  if (hue < 82) {
    if (l >= 78) return 'Vanilya Sarısı';
    if (l <= 35) return 'Zeytin Altını';
    return 'Limon Sarısı';
  }
  if (hue < 155) {
    if (l >= 76) return 'Pastel Nane';
    if (l <= 30) return 'Orman Yeşili';
    return s >= 50 ? 'Zümrüt Yeşili' : 'Adaçayı Yeşili';
  }
  if (hue < 195) {
    if (l >= 76) return 'Buzul Turkuaz';
    if (l <= 30) return 'Derin Petrol';
    return 'Turkuaz Su';
  }
  if (hue < 245) {
    if (l >= 76) return 'Gökyüzü Mavisi';
    if (l <= 28) return 'Gece Laciverti';
    return 'Safir Mavi';
  }
  if (hue < 288) {
    if (l >= 76) return 'Pastel Lavanta';
    if (l <= 28) return 'Derin İndigo';
    return 'İndigo Mor';
  }
  if (hue < 325) {
    if (l >= 76) return 'Açık Orkide';
    if (l <= 28) return 'Mürdüm Moru';
    return 'Fuşya Orkide';
  }
  if (l >= 76) return 'Pudra Pembe';
  if (l <= 30) return 'Koyu Vişne';
  return 'Gül Kurusu';
}

/**
 * Pure RGBA pixel analyzer that extracts up to `maxColors` perceptually distinct
 * dominant colors from an image's foreground product pixels.
 */
export function extractDominantProductColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors = 5
): ProductColorProfile {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const totalPixels = safeW * safeH;

  // Detect whether image has transparency mask
  let transparentCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] < 180) transparentCount++;
  }
  const hasTransparency = transparentCount > totalPixels * 0.03;

  // Border background estimate if image is opaque
  let bgR = 255;
  let bgG = 255;
  let bgB = 255;
  if (!hasTransparency) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let cnt = 0;
    const step = Math.max(1, Math.floor(safeW / 24));
    for (let x = 0; x < safeW; x += step) {
      for (const y of [0, safeH - 1]) {
        const idx = (y * safeW + x) * 4;
        sr += data[idx];
        sg += data[idx + 1];
        sb += data[idx + 2];
        cnt++;
      }
    }
    if (cnt > 0) {
      bgR = sr / cnt;
      bgG = sg / cnt;
      bgB = sb / cnt;
    }
  }

  interface Bucket {
    sumR: number;
    sumG: number;
    sumB: number;
    weight: number;
  }

  const buckets = new Map<number, Bucket>();
  const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / 12000)));
  let totalWeight = 0;
  let sumLightness = 0;
  let sumSaturation = 0;
  let warmScore = 0;

  for (let y = 0; y < safeH; y += stride) {
    for (let x = 0; x < safeW; x += stride) {
      const idx = (y * safeW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (hasTransparency) {
        if (a < 110) continue; // Ignore transparent & semi-transparent edge halo
      } else {
        const distBg = Math.hypot(r - bgR, g - bgG, b - bgB);
        if (distBg < 24) continue;
      }

      const [h, s, l] = rgbToHsl(r, g, b);
      // Slight perceptual boost for chromatic brand colors so tiny neutral shadows don't dominate
      const chromaBoost = 1 + (s / 100) * 0.55;
      const w = (a / 255) * chromaBoost;

      // Quantize RGB into 16x16x16 bins (step = 16)
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const existing = buckets.get(key);
      if (existing) {
        existing.sumR += r * w;
        existing.sumG += g * w;
        existing.sumB += b * w;
        existing.weight += w;
      } else {
        buckets.set(key, { sumR: r * w, sumG: g * w, sumB: b * w, weight: w });
      }

      totalWeight += w;
      sumLightness += l * w;
      sumSaturation += s * w;

      if (s >= 14) {
        const isWarmHue = (h >= 0 && h <= 72) || h >= 315;
        warmScore += (isWarmHue ? 1 : -1) * w * (s / 100);
      }
    }
  }

  if (totalWeight <= 0 || buckets.size === 0) {
    const fallbackColor: ExtractedColor = {
      hex: '#ea580c',
      rgb: [234, 88, 12],
      hsl: [21, 90, 48],
      share: 100,
      name: 'Sıcak Turuncu',
    };
    return {
      dominantColors: [fallbackColor],
      temperature: 'warm',
      temperatureLabel: 'Sıcak Tonlu',
      averageLightness: 50,
      averageSaturation: 75,
      moodSummary: 'Canlı ve sıcak ürün tonları tespit edildi.',
    };
  }

  const sortedBins = Array.from(buckets.values())
    .sort((a, b) => b.weight - a.weight)
    .map((b) => {
      const r = Math.round(b.sumR / b.weight);
      const g = Math.round(b.sumG / b.weight);
      const bl = Math.round(b.sumB / b.weight);
      return { r, g, b: bl, weight: b.weight };
    });

  // Merge perceptually similar bins (Euclidean RGB distance < 46)
  const merged: Array<{ r: number; g: number; b: number; weight: number }> = [];
  for (const bin of sortedBins) {
    const near = merged.find(
      (m) => Math.hypot(m.r - bin.r, m.g - bin.g, m.b - bin.b) < 46
    );
    if (near) {
      const combined = near.weight + bin.weight;
      near.r = Math.round((near.r * near.weight + bin.r * bin.weight) / combined);
      near.g = Math.round((near.g * near.weight + bin.g * bin.weight) / combined);
      near.b = Math.round((near.b * near.weight + bin.b * bin.weight) / combined);
      near.weight = combined;
    } else {
      merged.push({ ...bin });
    }
  }

  const topMerged = merged
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(1, maxColors));

  const topSum = topMerged.reduce((acc, item) => acc + item.weight, 0) || 1;
  const dominantColors: ExtractedColor[] = topMerged.map((item) => {
    const hsl = rgbToHsl(item.r, item.g, item.b);
    return {
      hex: rgbToHex(item.r, item.g, item.b),
      rgb: [item.r, item.g, item.b],
      hsl,
      share: Math.max(1, Math.round((item.weight / topSum) * 100)),
      name: describeColorNameTr(hsl[0], hsl[1], hsl[2]),
    };
  });

  const avgL = Math.round(sumLightness / totalWeight);
  const avgS = Math.round(sumSaturation / totalWeight);
  const normWarm = warmScore / totalWeight;

  const temperature: 'warm' | 'cool' | 'neutral' =
    avgS < 14 || Math.abs(normWarm) < 0.08
      ? 'neutral'
      : normWarm > 0
      ? 'warm'
      : 'cool';

  const temperatureLabel =
    temperature === 'warm'
      ? 'Sıcak Tonlu'
      : temperature === 'cool'
      ? 'Soğuk & Ferah Tonlu'
      : 'Nötr & Dengeli';

  const primaryName = dominantColors[0]?.name || 'Ürün';
  const secondaryName = dominantColors
    .map((c) => c.name)
    .find((n) => n !== primaryName);

  const moodSummary =
    temperature === 'warm'
      ? `Üründe ${primaryName}${secondaryName ? ` ve ${secondaryName}` : ''} hakim. Tamamlayıcı serin kontrastlar ürünü patlatırken, şampanya ve sıcak analog geçişler doğal bir bütünlük sağlar.`
      : temperature === 'cool'
      ? `Üründe ${primaryName}${secondaryName ? ` ve ${secondaryName}` : ''} öne çıkıyor. Sıcak altın/mercan vurgular dikkat çekerken, buzul ve derin okyanus geçişleri teknoloji/ferahlık hissini güçlendirir.`
      : `Üründe dengeli ${primaryName} tonları hakim. Yumuşak monokrom stüdyo ışığı veya yüksek kontrastlı koyu vitrin paletleriyle kusursuz okunabilirlik elde edilir.`;

  return {
    dominantColors,
    temperature,
    temperatureLabel,
    averageLightness: avgL,
    averageSaturation: avgS,
    moodSummary,
  };
}

function finalizeHarmony(
  raw: Omit<ColorHarmonyRecommendation, 'contrastScore'>
): ColorHarmonyRecommendation {
  const headlineColor = ensureReadableTextColor(
    raw.typography.headlineColor,
    raw.background.primaryBgHex,
    raw.background.secondaryBgHex,
    4.6
  );
  const highlightColor = ensureReadableTextColor(
    raw.typography.highlightColor,
    raw.background.primaryBgHex,
    raw.background.secondaryBgHex,
    3.2
  );
  const subtitleColor = ensureReadableTextColor(
    raw.typography.subtitleColor,
    raw.background.primaryBgHex,
    raw.background.secondaryBgHex,
    4.5
  );
  const ctaTextColor = ensureReadableTextColor(
    raw.typography.ctaTextColor,
    raw.typography.ctaBgColor,
    raw.typography.ctaBgColor,
    4.5
  );
  const promoTextColor = ensureReadableTextColor(
    raw.productAccent.promoTextColor,
    raw.productAccent.promoColor,
    raw.productAccent.promoColor,
    4.5
  );

  const contrastScore = wcagContrastRatio(headlineColor, raw.background.primaryBgHex);

  return {
    ...raw,
    typography: {
      headlineColor,
      highlightColor,
      subtitleColor,
      ctaBgColor: raw.typography.ctaBgColor,
      ctaTextColor,
    },
    productAccent: {
      ...raw.productAccent,
      promoTextColor,
    },
    contrastScore,
  };
}

/**
 * Generates 5 studio-grade, WCAG-verified Color Harmony palettes tailored to the product's
 * extracted dominant colors (Complementary, Analogous, Tonal Studio Light, Luxury Split-Dark, Triadic Campaign).
 */
export function generateColorHarmonies(
  profile: ProductColorProfile
): ColorHarmonyRecommendation[] {
  // Pick the most chromatic color among the top 3 as our primary hue anchor so neutral caps/labels don't flatten palettes
  const topCandidates = profile.dominantColors.slice(0, 3);
  const chromaticAnchor =
    [...topCandidates].sort((a, b) => b.hsl[1] - a.hsl[1])[0] ||
    profile.dominantColors[0];

  const [baseH, rawS, baseL] = chromaticAnchor
    ? chromaticAnchor.hsl
    : [24, 82, 52];
  const baseS = clamp(rawS, 28, 88);

  const compH = wrapHue(baseH + 180);
  const analogH1 = wrapHue(baseH + 28);
  const analogH2 = wrapHue(baseH - 24);
  const splitH1 = wrapHue(baseH + 150);
  const splitH2 = wrapHue(baseH + 210);
  const triadH = wrapHue(baseH + 120);

  // 1. Tamamlayıcı Kontrast (Complementary Hero)
  const compBg1 = hslToHex(compH, clamp(baseS * 0.68, 34, 66), 20);
  const compBg2 = hslToHex(wrapHue(compH + 18), clamp(baseS * 0.58, 28, 56), 34);
  const compGlow = hslToHex(baseH, clamp(baseS, 55, 92), 62);
  const compCta = hslToHex(baseH, clamp(baseS, 68, 92), clamp(baseL, 44, 54));

  const complementary = finalizeHarmony({
    id: 'harmony-complementary',
    harmonyType: 'complementary',
    badge: 'Tamamlayıcı Kontrast',
    title: 'Zıt Kutup & Ürün Patlaması',
    description:
      'Ürünün ana renginin tam zıttı sahne tonu kullanılarak ürün silüeti maksimum görsel odak kazanır.',
    background: {
      gradient: `radial-gradient(circle at 64% 54%, ${compBg2} 0%, ${compBg1} 72%, ${hslToHex(
        compH,
        45,
        11
      )} 100%)`,
      primaryBgHex: compBg1,
      secondaryBgHex: compBg2,
      vignette: true,
    },
    typography: {
      headlineColor: '#ffffff',
      highlightColor: hslToHex(baseH, 90, 72),
      subtitleColor: hslToHex(compH, 22, 88),
      ctaBgColor: compCta,
      ctaTextColor: '#ffffff',
    },
    productAccent: {
      glowColor: compGlow,
      ambientGlow: 0.35,
      promoColor: compCta,
      promoTextColor: '#ffffff',
    },
  });

  // 2. Yumuşak Monokrom / Ton-Sür-Ton Stüdyo (Tonal Editorial Light)
  const lightBg1 = hslToHex(baseH, clamp(baseS * 0.42, 16, 42), 95);
  const lightBg2 = hslToHex(analogH1, clamp(baseS * 0.48, 18, 46), 86);
  const darkBrandText = hslToHex(baseH, clamp(baseS * 0.65, 25, 58), 15);
  const richAccent = hslToHex(baseH, clamp(baseS, 62, 88), 38);

  const tonalLight = finalizeHarmony({
    id: 'harmony-tonal-light',
    harmonyType: 'tonal-light',
    badge: 'Ton-Sür-Ton Stüdyo',
    title: 'Aydınlık Editoryal & Yumuşak Ton',
    description:
      'Ürün renginden türetilen pastel stüdyo ışığı ve koyu tipografi ile ferah, modern marka görünümü.',
    background: {
      gradient: `linear-gradient(135deg, ${lightBg1} 0%, #ffffff 46%, ${lightBg2} 100%)`,
      primaryBgHex: lightBg1,
      secondaryBgHex: lightBg2,
      vignette: false,
    },
    typography: {
      headlineColor: darkBrandText,
      highlightColor: richAccent,
      subtitleColor: hslToHex(baseH, 22, 28),
      ctaBgColor: hslToHex(baseH, clamp(baseS, 60, 88), 32),
      ctaTextColor: '#ffffff',
    },
    productAccent: {
      glowColor: hslToHex(baseH, 75, 78),
      ambientGlow: 0.25,
      promoColor: richAccent,
      promoTextColor: '#ffffff',
    },
  });

  // 3. Analog Harmoni (Analogous Atmospheric Flow)
  const analogBg1 = hslToHex(analogH2, clamp(baseS * 0.72, 36, 68), 26);
  const analogBg2 = hslToHex(analogH1, clamp(baseS * 0.76, 40, 74), 38);
  const analogHighlight = hslToHex(wrapHue(baseH + 38), 92, 76);

  const analogous = finalizeHarmony({
    id: 'harmony-analogous',
    harmonyType: 'analogous',
    badge: 'Analog Renk Uyumu',
    title: 'Doğal Akış & Sıcak/Soğuk Geçiş',
    description:
      'Renk çemberinde ürünün komşu tonlarıyla kurulan yumuşak geçişli atmosferik kapak paleti.',
    background: {
      gradient: `linear-gradient(145deg, ${analogBg1} 0%, ${hslToHex(
        baseH,
        clamp(baseS * 0.65, 32, 62),
        22
      )} 52%, ${analogBg2} 100%)`,
      primaryBgHex: analogBg1,
      secondaryBgHex: analogBg2,
      vignette: true,
    },
    typography: {
      headlineColor: '#ffffff',
      highlightColor: analogHighlight,
      subtitleColor: hslToHex(baseH, 26, 90),
      ctaBgColor: hslToHex(analogH1, 85, 44),
      ctaTextColor: '#ffffff',
    },
    productAccent: {
      glowColor: hslToHex(baseH, 85, 66),
      ambientGlow: 0.35,
      promoColor: hslToHex(analogH2, 82, 42),
      promoTextColor: '#ffffff',
    },
  });

  // 4. Lüks Koyu Ayrık-Tamamlayıcı (Luxury Split-Complementary Dark)
  const splitBg1 = hslToHex(splitH1, 36, 11);
  const splitBg2 = hslToHex(splitH2, 44, 21);
  const luxGoldOrTint = hslToHex(baseH, clamp(baseS, 65, 90), 72);

  const splitDark = finalizeHarmony({
    id: 'harmony-split-dark',
    harmonyType: 'split-dark',
    badge: 'Lüks Koyu Vitrin',
    title: 'Derin Kadife & Işıltılı Vurgu',
    description:
      'Koyu ayrık-tamamlayıcı sahne üzerinde parlak ürün halesi ve prestijli yüksek kontrastlı başlıklar.',
    background: {
      gradient: `radial-gradient(circle at 65% 56%, ${splitBg2} 0%, ${splitBg1} 68%, #050811 100%)`,
      primaryBgHex: splitBg1,
      secondaryBgHex: splitBg2,
      vignette: true,
    },
    typography: {
      headlineColor: '#f8fafc',
      highlightColor: luxGoldOrTint,
      subtitleColor: '#cbd5e1',
      ctaBgColor: hslToHex(baseH, clamp(baseS, 68, 90), 46),
      ctaTextColor: '#ffffff',
    },
    productAccent: {
      glowColor: hslToHex(baseH, 88, 62),
      ambientGlow: 0.45,
      promoColor: hslToHex(baseH, 82, 46),
      promoTextColor: '#ffffff',
    },
  });

  // 5. Canlı Triadik Kampanya (Triadic Pop)
  const triadBg1 = hslToHex(triadH, 52, 92);
  const triadBg2 = hslToHex(baseH, 60, 88);
  const triadDark = hslToHex(compH, 55, 16);
  const triadPop = hslToHex(baseH, 86, 42);

  const triadicPop = finalizeHarmony({
    id: 'harmony-triadic-pop',
    harmonyType: 'triadic-pop',
    badge: 'Triadik Enerji',
    title: 'Sosyal Medya & Kampanya Pop',
    description:
      'Üçgen renk harmonisiyle dikkat çekici sosyal medya ve e-ticaret indirim kartları için enerjik palet.',
    background: {
      gradient: `linear-gradient(135deg, ${triadBg1} 0%, #ffffff 50%, ${triadBg2} 100%)`,
      primaryBgHex: triadBg1,
      secondaryBgHex: triadBg2,
      vignette: false,
    },
    typography: {
      headlineColor: triadDark,
      highlightColor: triadPop,
      subtitleColor: hslToHex(compH, 30, 26),
      ctaBgColor: triadPop,
      ctaTextColor: '#ffffff',
    },
    productAccent: {
      glowColor: hslToHex(triadH, 80, 68),
      ambientGlow: 0.25,
      promoColor: hslToHex(wrapHue(triadH + 120), 82, 44),
      promoTextColor: '#ffffff',
    },
  });

  return [complementary, tonalLight, analogous, splitDark, triadicPop];
}

/**
 * Sanitizes and WCAG-verifies custom AI harmony recommendations returned by `/api/ai/color-harmony`.
 */
export function normalizeAiHarmonies(rawList: unknown): ColorHarmonyRecommendation[] {
  if (!Array.isArray(rawList)) return [];

  const validHex = (val: unknown, fallback: string): string => {
    if (typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim())) {
      return val.trim().toLowerCase();
    }
    return fallback;
  };

  return rawList.slice(0, 3).map((item: any, idx) => {
    const primaryBgHex = validHex(item?.primaryBgHex, idx === 0 ? '#1e293b' : '#f8fafc');
    const secondaryBgHex = validHex(item?.secondaryBgHex, idx === 0 ? '#0f172a' : '#e2e8f0');
    const gradient =
      typeof item?.gradient === 'string' &&
      (item.gradient.includes('linear-gradient') || item.gradient.includes('radial-gradient'))
        ? item.gradient
        : `radial-gradient(circle at 64% 54%, ${secondaryBgHex} 0%, ${primaryBgHex} 100%)`;

    return finalizeHarmony({
      id: `harmony-ai-${Date.now()}-${idx}`,
      harmonyType: 'ai-bespoke',
      badge:
        typeof item?.badge === 'string' && item.badge.trim()
          ? item.badge.trim().slice(0, 28)
          : 'AI Sanat Yönetmeni',
      title:
        typeof item?.title === 'string' && item.title.trim()
          ? item.title.trim().slice(0, 44)
          : `AI Özel Harmoni ${idx + 1}`,
      description:
        typeof item?.description === 'string' && item.description.trim()
          ? item.description.trim().slice(0, 160)
          : 'Ürün tonlarına özel yapay zeka renk ve tipografi eşleştirmesi.',
      background: {
        gradient,
        primaryBgHex,
        secondaryBgHex,
        vignette: Boolean(item?.vignette),
      },
      typography: {
        headlineColor: validHex(item?.headlineColor, '#ffffff'),
        highlightColor: validHex(item?.highlightColor, '#fbbf24'),
        subtitleColor: validHex(item?.subtitleColor, '#e2e8f0'),
        ctaBgColor: validHex(item?.ctaBgColor, '#ea580c'),
        ctaTextColor: validHex(item?.ctaTextColor, '#ffffff'),
      },
      productAccent: {
        glowColor: validHex(item?.glowColor, '#fbbf24'),
        ambientGlow: clamp(Number(item?.ambientGlow) || 0.3, 0, 0.7),
        promoColor: validHex(item?.promoColor, '#ea580c'),
        promoTextColor: '#ffffff',
      },
    });
  });
}

/**
 * Browser helper: loads a product cutout/photo, extracts its dominant color profile,
 * builds 5 instant WCAG-verified harmonies, and prepares a compact PNG for optional Gemini AI enrichment.
 */
export async function analyzeProductColorsFromImage(imageSrc: string): Promise<{
  profile: ProductColorProfile;
  harmonies: ColorHarmonyRecommendation[];
  compactPngBase64: string;
}> {
  const img = await loadImage(imageSrc);
  const natW = img.naturalWidth || img.width || 512;
  const natH = img.naturalHeight || img.height || 512;

  const maxSide = 256;
  let w = natW;
  let h = natH;
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
    throw new Error('Renk analizi için Canvas 2D başlatılamadı.');
  }

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);

  const profile = extractDominantProductColors(imgData.data, w, h, 5);
  const harmonies = generateColorHarmonies(profile);
  const compactPngBase64 = canvas.toDataURL('image/png');

  return {
    profile,
    harmonies,
    compactPngBase64,
  };
}
