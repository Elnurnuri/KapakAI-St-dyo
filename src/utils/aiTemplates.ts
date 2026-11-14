import {
  AspectRatio,
  CanvasLayer,
  CoverTemplate,
  FeatureBadge,
  FloatingElement,
  PromoBadge,
  StudioTypography,
  TemplateCategory,
} from '../types';
import { clamp } from './aiPatch';

const VALID_CATEGORIES: TemplateCategory[] = [
  'Kozmetik & Bakım',
  'Lüks & Parfüm',
  'E-Ticaret & Kampanya',
  'Gıda & İçecek',
  'Aksiyon & Teknoloji',
  'Moda & Aksesuar',
  '3D & Eğlence',
  'Minimalist Marka',
  'Pazaryeri & Vitrin',
];

const VALID_RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9'];
const VALID_FONTS: StudioTypography['fontFamily'][] = [
  'Cabinet Grotesk',
  'Plus Jakarta Sans',
  'Playfair Display',
  'Inter',
];
const VALID_ALIGNMENTS: StudioTypography['alignment'][] = ['left', 'center', 'right'];
const VALID_BADGE_ICONS: FeatureBadge['icon'][] = [
  'shield',
  'sparkles',
  'droplet',
  'sun',
  'award',
  'zap',
  'leaf',
  'clock',
  'check',
];
const VALID_FLOATING_TYPES: FloatingElement['type'][] = [
  'water-splash',
  'gold-coin',
  '3d-sphere',
  'sparkle',
  'leaf',
  'cloud',
  'glow-ring',
  'gold-ribbon',
];

function getFloatingLabel(type: string): string {
  switch (type) {
    case 'water-splash': return 'Su Damlaları';
    case 'gold-coin': return '3D Altın Para';
    case '3d-sphere': return 'Pastel Küre';
    case 'sparkle': return 'Işıltı Yıldızı';
    case 'leaf': return 'Gül Yaprağı';
    case 'glow-ring': return 'Neon Halka';
    case 'gold-ribbon': return 'Altın Kurdele';
    default: return 'Dekoratif Obje';
  }
}

function normalizeColor(val: unknown, fallback: string): string {
  if (typeof val === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

export function normalizeGeneratedTemplates(
  rawTemplates: unknown,
  options?: {
    fallbackCategory?: TemplateCategory;
    preferredAspectRatio?: AspectRatio | 'auto';
    idPrefix?: string;
    seedTimestamp?: number;
  }
): CoverTemplate[] {
  if (!Array.isArray(rawTemplates)) return [];

  const fallbackCategory =
    options?.fallbackCategory && VALID_CATEGORIES.includes(options.fallbackCategory)
      ? options.fallbackCategory
      : 'Minimalist Marka';
  const preferredRatio = options?.preferredAspectRatio;
  const idPrefix = options?.idPrefix || 'ai-custom';
  const stamp = options?.seedTimestamp ?? Date.now();

  const fallbackGradients = [
    'radial-gradient(circle at 75% 30%, #38bdf8 0%, #1e3a8a 55%, #0f172a 100%)',
    'linear-gradient(135deg, #fef3c7 0%, #fde68a 45%, #f59e0b 100%)',
    'radial-gradient(ellipse at 50% 25%, #f5d0fe 0%, #a855f7 52%, #3b0764 100%)',
  ];

  return rawTemplates.slice(0, 4).map((rawItem: any, idx: number): CoverTemplate => {
    const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
    const rawRatio = item.aspectRatio as AspectRatio;
    const aspectRatio: AspectRatio =
      preferredRatio && preferredRatio !== 'auto' && VALID_RATIOS.includes(preferredRatio)
        ? preferredRatio
        : VALID_RATIOS.includes(rawRatio)
        ? rawRatio
        : idx === 1
        ? '1:1'
        : '4:5';

    const category: TemplateCategory = VALID_CATEGORIES.includes(item.category)
      ? item.category
      : fallbackCategory;

    const bgObj = item.background && typeof item.background === 'object' ? item.background : {};
    const gradient =
      typeof bgObj.gradient === 'string' &&
      (bgObj.gradient.includes('gradient(') || bgObj.gradient.startsWith('#'))
        ? bgObj.gradient
        : fallbackGradients[idx % fallbackGradients.length];

    const typoObj = item.typography && typeof item.typography === 'object' ? item.typography : {};
    const alignment: StudioTypography['alignment'] = VALID_ALIGNMENTS.includes(typoObj.alignment)
      ? typoObj.alignment
      : 'left';

    const typography: StudioTypography = {
      kicker: String(typoObj.kicker || 'ÖZEL TASARIM').slice(0, 42),
      headline: String(typoObj.headline || `ÖZEL KONSEPT ${idx + 1}`).slice(0, 52),
      headlineHighlight: typoObj.headlineHighlight
        ? String(typoObj.headlineHighlight).slice(0, 40)
        : undefined,
      subtitle: String(
        typoObj.subtitle || 'Ürününüzü öne çıkaran özel yapay zeka kompozisyonu.'
      ).slice(0, 120),
      ctaText: String(typoObj.ctaText || 'HEMEN İNCELE').slice(0, 28),
      showCta: typeof typoObj.showCta === 'boolean' ? typoObj.showCta : true,
      fontFamily: VALID_FONTS.includes(typoObj.fontFamily) ? typoObj.fontFamily : 'Cabinet Grotesk',
      headlineColor: normalizeColor(typoObj.headlineColor, '#ffffff'),
      highlightColor: normalizeColor(typoObj.highlightColor, '#fbbf24'),
      subtitleColor: normalizeColor(typoObj.subtitleColor, '#e2e8f0'),
      ctaBgColor: normalizeColor(typoObj.ctaBgColor, '#f97316'),
      ctaTextColor: normalizeColor(typoObj.ctaTextColor, '#ffffff'),
      headlineSize:
        typeof typoObj.headlineSize === 'number' ? clamp(typoObj.headlineSize, 0.65, 1.45) : 0.96,
      alignment,
      positionX:
        typeof typoObj.positionX === 'number'
          ? clamp(Math.round(typoObj.positionX), 4, 88)
          : alignment === 'center'
          ? 50
          : 7,
      positionY:
        typeof typoObj.positionY === 'number' ? clamp(Math.round(typoObj.positionY), 5, 72) : 9,
      plaqueStyle:
        typoObj.plaqueStyle && ['none', 'emerald-3d', 'magenta-3d', 'crimson-3d'].includes(typoObj.plaqueStyle)
          ? typoObj.plaqueStyle
          : 'none',
      plaqueTilt:
        typeof typoObj.plaqueTilt === 'number' ? clamp(typoObj.plaqueTilt, -8, 8) : 0,
      subtitlePill: typeof typoObj.subtitlePill === 'boolean' ? typoObj.subtitlePill : false,
    };

    const rawBadges = Array.isArray(item.badges) ? item.badges : [];
    const badges: FeatureBadge[] = rawBadges.slice(0, 3).map((b: any, bIdx: number) => ({
      id: `${idPrefix}-${stamp}-${idx}-b${bIdx}`,
      icon: VALID_BADGE_ICONS.includes(b?.icon) ? b.icon : 'sparkles',
      label: String(b?.label || 'Özel Seri').slice(0, 34),
      sublabel: b?.sublabel ? String(b.sublabel).slice(0, 44) : undefined,
    }));

    const badgesPosObj =
      item.badgesPosition && typeof item.badgesPosition === 'object' ? item.badgesPosition : {};
    const badgesPosition = {
      x: typeof badgesPosObj.x === 'number' ? clamp(Math.round(badgesPosObj.x), 4, 65) : 7,
      y: typeof badgesPosObj.y === 'number' ? clamp(Math.round(badgesPosObj.y), 12, 82) : 62,
    };

    const promoObj = item.promoBadge && typeof item.promoBadge === 'object' ? item.promoBadge : {};
    const promoType: PromoBadge['type'] =
      promoObj.type && ['tag', 'circle', 'pill', 'banner'].includes(promoObj.type)
        ? promoObj.type
        : 'circle';
    const promoBadge: PromoBadge = {
      show: typeof promoObj.show === 'boolean' ? promoObj.show : true,
      type: promoType,
      text: String(promoObj.text || 'YENİ').slice(0, 20),
      subtext: promoObj.subtext ? String(promoObj.subtext).slice(0, 20) : undefined,
      color: normalizeColor(promoObj.color, '#ea580c'),
      textColor: normalizeColor(promoObj.textColor, '#ffffff'),
      x: typeof promoObj.x === 'number' ? clamp(Math.round(promoObj.x), 8, 92) : 84,
      y: typeof promoObj.y === 'number' ? clamp(Math.round(promoObj.y), 8, 92) : 16,
      scale: typeof promoObj.scale === 'number' ? clamp(promoObj.scale, 0.6, 1.5) : 1.0,
      rotation:
        typeof promoObj.rotation === 'number' ? clamp(Math.round(promoObj.rotation), -35, 35) : 0,
    };

    const rawFloatings = Array.isArray(item.floatingElements) ? item.floatingElements : [];
    const floatingElements: FloatingElement[] = rawFloatings
      .slice(0, 4)
      .map((f: any, fIdx: number) => ({
        id: `${idPrefix}-${stamp}-${idx}-f${fIdx}`,
        type: VALID_FLOATING_TYPES.includes(f?.type) ? f.type : 'sparkle',
        x: typeof f?.x === 'number' ? clamp(Math.round(f.x), 6, 94) : 45 + fIdx * 12,
        y: typeof f?.y === 'number' ? clamp(Math.round(f.y), 6, 94) : 35 + fIdx * 14,
        scale: typeof f?.scale === 'number' ? clamp(f.scale, 0.5, 1.8) : 1.0,
        rotation:
          typeof f?.rotation === 'number' ? clamp(Math.round(f.rotation), -180, 180) : 0,
        opacity: typeof f?.opacity === 'number' ? clamp(f.opacity, 0.2, 1) : 0.85,
      }));

    const prodObj =
      item.productDefaultPlacement && typeof item.productDefaultPlacement === 'object'
        ? item.productDefaultPlacement
        : {};
    const productDefaultPlacement = {
      x: typeof prodObj.x === 'number' ? clamp(Math.round(prodObj.x), 18, 86) : 68,
      y: typeof prodObj.y === 'number' ? clamp(Math.round(prodObj.y), 25, 84) : 58,
      scale: typeof prodObj.scale === 'number' ? clamp(prodObj.scale, 0.55, 1.5) : 1.0,
      rotation:
        typeof prodObj.rotation === 'number' ? clamp(Math.round(prodObj.rotation), -30, 30) : 0,
      shadowOpacity:
        typeof prodObj.shadowOpacity === 'number' ? clamp(prodObj.shadowOpacity, 0, 1) : 0.5,
      shadowBlur:
        typeof prodObj.shadowBlur === 'number' ? clamp(Math.round(prodObj.shadowBlur), 6, 48) : 26,
      shadowOffsetY:
        typeof prodObj.shadowOffsetY === 'number'
          ? clamp(Math.round(prodObj.shadowOffsetY), 0, 36)
          : 18,
      reflection: typeof prodObj.reflection === 'boolean' ? prodObj.reflection : true,
      reflectionOpacity:
        typeof prodObj.reflectionOpacity === 'number'
          ? clamp(prodObj.reflectionOpacity, 0.1, 0.7)
          : 0.3,
      brightness:
        typeof prodObj.brightness === 'number' ? clamp(prodObj.brightness, 0.7, 1.4) : 1.05,
      contrast:
        typeof prodObj.contrast === 'number' ? clamp(prodObj.contrast, 0.8, 1.35) : 1.06,
      ambientGlow:
        typeof prodObj.ambientGlow === 'number' ? clamp(prodObj.ambientGlow, 0, 1) : 0.25,
      glowColor: normalizeColor(prodObj.glowColor, '#ffffff'),
    };

    const layers: CanvasLayer[] = [
      { id: 'layer-promo', name: 'Kampanya Rozeti', type: 'promoBadge', visible: true, locked: false },
      { id: 'layer-badges', name: 'Özellik Rozetleri', type: 'badges', visible: true, locked: false },
      ...floatingElements.map((f) => ({
        id: `layer-float-${f.id}`,
        name: getFloatingLabel(f.type),
        type: 'floating' as const,
        visible: true,
        locked: false,
        floatingId: f.id,
      })),
      { id: 'layer-product', name: 'Ürün Dekupesi', type: 'product', visible: true, locked: false },
      { id: 'layer-typography', name: 'Başlık & Metin', type: 'typography', visible: true, locked: false },
    ];

    const validImageUrl =
      typeof bgObj.imageUrl === 'string' &&
      (bgObj.imageUrl.startsWith('/assets/backgrounds/') || bgObj.imageUrl.startsWith('data:image/'))
        ? bgObj.imageUrl
        : undefined;

    return {
      id: `${idPrefix}-${stamp}-${idx}`,
      title: String(item.title || `AI Özel Şablon #${idx + 1}`).slice(0, 60),
      category,
      description: String(
        item.description || 'İsteğinize özel olarak yapay zeka tarafından sıfırdan tasarlandı.'
      ).slice(0, 130),
      aspectRatio,
      background: {
        type: validImageUrl ? 'image' : 'gradient',
        imageUrl: validImageUrl,
        gradient,
        blur: typeof bgObj.blur === 'number' ? clamp(Math.round(bgObj.blur), 0, 12) : 0,
        brightness:
          typeof bgObj.brightness === 'number' ? clamp(bgObj.brightness, 0.6, 1.4) : 1,
        vignette: typeof bgObj.vignette === 'boolean' ? bgObj.vignette : false,
        stageStyle:
          bgObj.stageStyle && ['none', 'champagne-arch', 'festive-lights'].includes(bgObj.stageStyle)
            ? bgObj.stageStyle
            : 'none',
      },
      typography,
      badges,
      badgesPosition,
      promoBadge,
      floatingElements,
      productDefaultPlacement,
      layers,
      isCustomAi: true,
    };
  });
}
