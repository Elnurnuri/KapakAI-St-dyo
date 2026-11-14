import {
  AbCampaignVariation,
  AspectRatio,
  FeatureBadge,
  ProductPlacement,
  PromoBadge,
  StudioBackground,
  StudioPatch,
  StudioTypography,
} from '../types';
import { ensureReadableTextColor, wcagContrastRatio } from './colorHarmony';

export interface AuditCheckResult {
  id: 'contrast' | 'cta' | 'safe-zone' | 'separation' | 'copy-density';
  title: string;
  status: 'pass' | 'warn';
  metric: string;
  detail: string;
  fixLabel?: string;
  autoFixPatch?: StudioPatch;
}

export interface AdAuditReport {
  passedCount: number;
  totalCount: number;
  readinessLabel: string;
  checks: AuditCheckResult[];
}

export interface AuditableState {
  aspectRatio: AspectRatio;
  background: StudioBackground;
  product: ProductPlacement;
  typography: StudioTypography;
  badges: FeatureBadge[];
  badgesPosition: { x: number; y: number };
  promoBadge: PromoBadge;
}

function extractGradientHexStops(gradient?: string): [string, string] {
  if (!gradient) return ['#1e293b', '#0f172a'];
  const matches = gradient.match(/#[0-9a-fA-F]{6}/g);
  if (matches && matches.length >= 2) {
    return [matches[0], matches[matches.length - 1]];
  }
  if (matches && matches.length === 1) {
    return [matches[0], matches[0]];
  }
  return ['#334155', '#1e293b'];
}

/**
 * Deterministic, mathematically grounded design & conversion audit of the live canvas state.
 * Every check inspects actual coordinates, contrast ratios, and copy structure, and provides
 * an actionable StudioPatch auto-fix when a warning is detected.
 */
export function evaluateStudioDesign(state: AuditableState): AdAuditReport {
  const checks: AuditCheckResult[] = [];
  const { aspectRatio, background, product, typography, badges, badgesPosition, promoBadge } = state;

  // 1. WCAG Headline & Background Contrast Check
  const has3dPlaque = Boolean(typography.plaqueStyle && typography.plaqueStyle !== 'none');
  const isPhotographicScene =
    !has3dPlaque && background.type === 'image' && Boolean(background.imageUrl);

  let bgStop1 = '#1e293b';
  let bgStop2 = '#0f172a';
  if (has3dPlaque) {
    bgStop1 =
      typography.plaqueStyle === 'emerald-3d'
        ? '#15803d'
        : typography.plaqueStyle === 'magenta-3d'
        ? '#db2777'
        : '#b91c1c';
    bgStop2 = bgStop1;
  } else if (isPhotographicScene) {
    // Photographic studio backdrops render text with directional vignette/scrim + shadow
    bgStop1 = '#0f172a';
    bgStop2 = '#0f172a';
  } else if (background.type === 'gradient' && background.gradient) {
    [bgStop1, bgStop2] = extractGradientHexStops(background.gradient);
  } else if (background.stageStyle === 'champagne-arch') {
    bgStop1 = '#fef3c7';
    bgStop2 = '#fde68a';
  } else if (background.stageStyle === 'festive-lights') {
    bgStop1 = '#991b1b';
    bgStop2 = '#7f1d1d';
  } else if (background.gradient) {
    [bgStop1, bgStop2] = extractGradientHexStops(background.gradient);
  }

  const headlineColor = typography.headlineColor || '#ffffff';
  const headlineRatio = isPhotographicScene
    ? Math.max(
        wcagContrastRatio(headlineColor, '#0f172a'),
        wcagContrastRatio(headlineColor, '#f8fafc')
      ) >= 7.5
      ? Math.max(
          wcagContrastRatio(headlineColor, '#1e293b'),
          wcagContrastRatio(headlineColor, '#f1f5f9')
        )
      : 2.8
    : Math.min(
        wcagContrastRatio(headlineColor, bgStop1),
        wcagContrastRatio(headlineColor, bgStop2)
      );

  const contrastPass = isPhotographicScene ? headlineRatio >= 4.5 : headlineRatio >= 4.5;

  if (contrastPass) {
    checks.push({
      id: 'contrast',
      title: 'Başlık & Sahne Okunabilirliği',
      status: 'pass',
      metric: `${headlineRatio.toFixed(1)}:1`,
      detail: 'Başlık ve alt metin renkleri arka planla yüksek kontrast sağlıyor.',
    });
  } else {
    const fixedHeadline = ensureReadableTextColor(headlineColor, bgStop1, bgStop2, 4.8);
    const fixedSubtitle = ensureReadableTextColor(typography.subtitleColor, bgStop1, bgStop2, 4.5);
    const fixedHighlight = ensureReadableTextColor(typography.highlightColor, bgStop1, bgStop2, 3.5);
    checks.push({
      id: 'contrast',
      title: 'Başlık & Sahne Okunabilirliği',
      status: 'warn',
      metric: `${headlineRatio.toFixed(1)}:1`,
      detail: 'Başlık kontrastı düşük (hedef >= 4.5:1). Mobil akışta okunması zorlaşabilir.',
      fixLabel: 'Kontrastı Düzelt',
      autoFixPatch: {
        typography: {
          headlineColor: fixedHeadline,
          subtitleColor: fixedSubtitle,
          highlightColor: fixedHighlight,
        },
      },
    });
  }

  // 2. CTA Visibility & Button Contrast Check
  const currentCtaBg = typography.ctaBgColor || '#c2410c';
  const currentCtaFg = typography.ctaTextColor || '#ffffff';
  const ctaContrast = wcagContrastRatio(currentCtaFg, currentCtaBg);
  const hasValidCta = Boolean(typography.showCta && typography.ctaText.trim().length >= 3);
  if (hasValidCta && ctaContrast >= 4.5) {
    checks.push({
      id: 'cta',
      title: 'Eylem Çağrısı (CTA) Netliği',
      status: 'pass',
      metric: `${ctaContrast.toFixed(1)}:1`,
      detail: `"${typography.ctaText}" butonu görünür ve yüksek okunabilirlikte.`,
    });
  } else {
    // If CTA uses a mid-tone warm brand color (like #ea580c) with white text, deepen button bg to #c2410c (5.2:1)
    const whiteRatioOnCurrent = wcagContrastRatio('#ffffff', currentCtaBg);
    const safeCtaBg =
      whiteRatioOnCurrent >= 3.0 && whiteRatioOnCurrent < 4.5 ? '#c2410c' : currentCtaBg;
    const safeCtaFg = ensureReadableTextColor(currentCtaFg, safeCtaBg, safeCtaBg, 4.6);
    checks.push({
      id: 'cta',
      title: 'Eylem Çağrısı (CTA) Netliği',
      status: 'warn',
      metric: hasValidCta ? `${ctaContrast.toFixed(1)}:1` : 'Kapalı',
      detail: !hasValidCta
        ? 'Aksiyon butonu kapalı veya boş; tıklama dönüşümü için net bir CTA önerilir.'
        : 'Buton metni ile buton zemini arasındaki kontrast 4.5:1 sınırının altında.',
      fixLabel: !hasValidCta ? 'CTA Butonunu Aç' : 'Buton Kontrastını Düzelt',
      autoFixPatch: {
        typography: {
          showCta: true,
          ctaText: typography.ctaText.trim() || 'HEMEN KEŞFET',
          ctaBgColor: safeCtaBg,
          ctaTextColor: safeCtaFg,
        },
      },
    });
  }

  // 3. Platform Safe-Zone Check (especially critical for 9:16 Reels/Story & edge margins)
  const topSafeMin = aspectRatio === '9:16' ? 13 : 5;
  const bottomSafeMax = aspectRatio === '9:16' ? 82 : 94;
  const perBadgeHeightPct = aspectRatio === '9:16' ? 7.2 : 8.5;
  const badgesBottomEdge = badgesPosition.y + badges.length * perBadgeHeightPct;

  const typoOut = typography.positionY < topSafeMin || typography.positionY > bottomSafeMax - 14;
  const promoOut =
    promoBadge.show &&
    (promoBadge.y < topSafeMin + 2 ||
      promoBadge.y > bottomSafeMax ||
      promoBadge.x < 8 ||
      promoBadge.x > 92);
  const badgesOut =
    badges.length > 0 && (badgesPosition.y < topSafeMin || badgesBottomEdge > bottomSafeMax);

  if (!typoOut && !promoOut && !badgesOut) {
    checks.push({
      id: 'safe-zone',
      title: `Platform Güvenli Alanı (${aspectRatio})`,
      status: 'pass',
      metric: 'Güvenli',
      detail:
        aspectRatio === '9:16'
          ? 'Metin ve rozetler Hikaye/Reels profil ve yanıt barlarının dışında.'
          : 'Tüm katmanlar kenar kesilme paylarının güvenli bölgesinde.',
    });
  } else {
    const maxSafeBadgesY = Math.max(
      topSafeMin + 4,
      Math.floor(bottomSafeMax - badges.length * perBadgeHeightPct - 1)
    );
    checks.push({
      id: 'safe-zone',
      title: `Platform Güvenli Alanı (${aspectRatio})`,
      status: 'warn',
      metric: 'Kenar Riski',
      detail:
        aspectRatio === '9:16'
          ? 'Bazı öğeler Instagram/TikTok üst profil veya alt mesaj arayüzünün altında kalabilir.'
          : 'Bazı metin veya rozetler tuval sınırlarına aşırı yakın.',
      fixLabel: 'Güvenli Alana Çek',
      autoFixPatch: {
        typography: {
          positionY: Math.max(topSafeMin + 1, Math.min(bottomSafeMax - 16, typography.positionY)),
        },
        badgesPosition: {
          x: Math.max(6, Math.min(70, badgesPosition.x)),
          y: Math.max(topSafeMin + 4, Math.min(maxSafeBadgesY, badgesPosition.y)),
        },
        promoBadge: {
          x: Math.max(14, Math.min(86, promoBadge.x)),
          y: Math.max(topSafeMin + 6, Math.min(bottomSafeMax - 4, promoBadge.y)),
        },
      },
    });
  }

  // 4. Visual Layer Separation (Product vs Headline anchor collision check)
  const textVisualCenterX =
    typography.alignment === 'center'
      ? typography.positionX
      : typography.alignment === 'right'
      ? typography.positionX - 22
      : typography.positionX + 22;
  const textVisualCenterY = typography.positionY + 14;
  const centerDist = Math.hypot(product.x - textVisualCenterX, product.y - textVisualCenterY);

  if (centerDist >= 26) {
    checks.push({
      id: 'separation',
      title: 'Ürün & Tipografi Ayrımı',
      status: 'pass',
      metric: `%${Math.round(centerDist)} aralık`,
      detail: 'Ürün silüeti ile ana başlık bloğu birbirini kapatmadan dengeli yerleşmiş.',
    });
  } else {
    const isTall = aspectRatio === '9:16';
    checks.push({
      id: 'separation',
      title: 'Ürün & Tipografi Ayrımı',
      status: 'warn',
      metric: `%${Math.round(centerDist)} çakışma`,
      detail: 'Başlık bloğu ürünün merkezine çok yakın; ürün veya yazı birbirini örtebilir.',
      fixLabel: 'Katmanları Dengele',
      autoFixPatch: isTall
        ? {
            typography: { alignment: 'center', positionX: 50, positionY: 16 },
            productPlacement: { x: 50, y: 58 },
          }
        : {
            typography: { alignment: 'left', positionX: 7, positionY: 14 },
            productPlacement: { x: 66, y: 58 },
          },
    });
  }

  // 5. Copy Brevity & Scannability Check
  const fullHeadline = `${typography.headline} ${typography.headlineHighlight || ''}`.trim();
  const wordCount = fullHeadline ? fullHeadline.split(/\s+/).length : 0;
  const scannable = wordCount >= 1 && wordCount <= 7;

  if (scannable) {
    checks.push({
      id: 'copy-density',
      title: 'Mesaj Yoğunluğu & Hızlı Algı',
      status: 'pass',
      metric: `${wordCount} kelime`,
      detail: 'Başlık 1.5 saniyelik sosyal medya tarama süresine uygun uzunlukta.',
    });
  } else {
    const trimmedWords = fullHeadline.split(/\s+/).slice(0, 5).join(' ');
    checks.push({
      id: 'copy-density',
      title: 'Mesaj Yoğunluğu & Hızlı Algı',
      status: 'warn',
      metric: `${wordCount} kelime`,
      detail:
        wordCount === 0
          ? 'Ana başlık boş bırakılmış.'
          : 'Başlık çok uzun; 3–6 kelimelik vurucu başlıklar daha yüksek tıklama alır.',
      fixLabel: wordCount === 0 ? 'Örnek Başlık Ekle' : 'Başlığı Kısalt',
      autoFixPatch: {
        typography: {
          headline: wordCount === 0 ? 'YENİ NESİL PERFORMANS' : trimmedWords,
          headlineHighlight: wordCount === 0 ? 'ŞİMDİ KEŞFET' : '',
        },
      },
    });
  }

  const passedCount = checks.filter((c) => c.status === 'pass').length;
  const totalCount = checks.length;
  const readinessLabel =
    passedCount === totalCount
      ? 'Yayına Hazır'
      : passedCount >= 4
      ? 'İyi Durumda (1 İyileştirme)'
      : 'İyileştirme Öneriliyor';

  return {
    passedCount,
    totalCount,
    readinessLabel,
    checks,
  };
}

/**
 * Sanitizes and enforces WCAG button readability on AI-generated A/B campaign variations.
 */
export function normalizeAbVariations(rawList: unknown): AbCampaignVariation[] {
  if (!Array.isArray(rawList)) return [];

  const defaultAngles = [
    { badge: 'Varyasyon A · Performans', accent: '#f59e0b', cta: '#ea580c' },
    { badge: 'Varyasyon B · Prestij & Arzu', accent: '#38bdf8', cta: '#0284c7' },
    { badge: 'Varyasyon C · Fırsat & Aciliyet', accent: '#f43f5e', cta: '#e11d48' },
  ];

  const validHex = (val: unknown, fallback: string): string =>
    typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim())
      ? val.trim().toLowerCase()
      : fallback;

  return rawList.slice(0, 3).map((item: any, idx) => {
    const fallback = defaultAngles[idx] || defaultAngles[0];
    const ctaBgHex = validHex(item?.ctaBgHex, fallback.cta);
    const ctaTextHex = ensureReadableTextColor(
      validHex(item?.ctaTextHex, '#ffffff'),
      ctaBgHex,
      ctaBgHex,
      4.5
    );

    return {
      id: `ab-var-${Date.now()}-${idx}`,
      angleBadge:
        typeof item?.angleBadge === 'string' && item.angleBadge.trim()
          ? item.angleBadge.trim().slice(0, 32)
          : fallback.badge,
      angleTitle:
        typeof item?.angleTitle === 'string' && item.angleTitle.trim()
          ? item.angleTitle.trim().slice(0, 44)
          : `Reklam Açısı ${idx + 1}`,
      rationale:
        typeof item?.rationale === 'string' && item.rationale.trim()
          ? item.rationale.trim().slice(0, 160)
          : 'Hedef kitlenin dikkatini ilk saniyede yakalamak için kurgulanan dönüşüm açısı.',
      kicker:
        typeof item?.kicker === 'string' && item.kicker.trim()
          ? item.kicker.trim().slice(0, 34)
          : 'ÖNE ÇIKAN SEÇİM',
      headline:
        typeof item?.headline === 'string' && item.headline.trim()
          ? item.headline.trim().slice(0, 38)
          : 'FARK YARATAN KALİTE.',
      headlineHighlight:
        typeof item?.headlineHighlight === 'string'
          ? item.headlineHighlight.trim().slice(0, 28)
          : 'HEMEN DENEYİN',
      subtitle:
        typeof item?.subtitle === 'string' && item.subtitle.trim()
          ? item.subtitle.trim().slice(0, 110)
          : 'Üstün formül ve gün boyu süren maksimum etki bir arada.',
      ctaText:
        typeof item?.ctaText === 'string' && item.ctaText.trim()
          ? item.ctaText.trim().slice(0, 22)
          : 'HEMEN İNCELE',
      promoText:
        typeof item?.promoText === 'string' && item.promoText.trim()
          ? item.promoText.trim().slice(0, 18)
          : 'ÖZEL FIRSAT',
      promoSubtext:
        typeof item?.promoSubtext === 'string'
          ? item.promoSubtext.trim().slice(0, 18)
          : 'SINIRLI STOK',
      accentHex: validHex(item?.accentHex, fallback.accent),
      ctaBgHex,
      ctaTextHex,
    };
  });
}
