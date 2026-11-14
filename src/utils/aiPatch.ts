import {
  AspectRatio,
  CanvasLayer,
  EditableAreaId,
  FeatureBadge,
  FloatingElement,
  ProductPlacement,
  PromoBadge,
  StudioBackground,
  StudioPatch,
  StudioTypography,
} from '../types';

export interface StudioEditableState {
  aspectRatio: AspectRatio;
  background: StudioBackground;
  typography: StudioTypography;
  badges: FeatureBadge[];
  badgesPosition: { x: number; y: number };
  promoBadge: PromoBadge;
  product: ProductPlacement;
  floatingElements: FloatingElement[];
  layers: CanvasLayer[];
}

export function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

export function mapActiveElementToArea(activeElement: string | null | undefined): EditableAreaId {
  if (!activeElement) return 'all';
  if (activeElement === 'text') return 'text';
  if (activeElement === 'product') return 'product';
  if (activeElement === 'badges') return 'badges';
  if (activeElement === 'promo') return 'promo';
  if (activeElement === 'background') return 'background';
  return 'all';
}

export function getAreaMeta(area: EditableAreaId): {
  label: string;
  shortLabel: string;
  suggestions: string[];
} {
  switch (area) {
    case 'background':
      return {
        label: 'Arka Plan Alanı',
        shortLabel: 'Arka Plan',
        suggestions: [
          'Zemini koyu zümrüt yeşili lüks stüdyo yap',
          'Pastel şeftali ve krem geçişli yumuşak fon ekle',
          'Gece neon mor-turkuaz arka plan ve hafif vinyet uygula',
        ],
      };
    case 'text':
      return {
        label: 'Başlık & Metin Alanı',
        shortLabel: 'Metin',
        suggestions: [
          'Başlığı daha lüks ve vurucu yaz, altın ton kullan',
          'Metni kampanya odaklı yap ve ortala',
          'Buton rengini koyu antrasit yap, yazıyı büyüt',
        ],
      };
    case 'product':
      return {
        label: 'Ürün & Işık/Gölge',
        shortLabel: 'Ürün',
        suggestions: [
          'Ürünü biraz büyüt, hafif eğim ve güçlü zemin gölgesi ver',
          'Ürünü ortala ve arkasına sıcak turuncu ışık halesi ekle',
          'Zemin yansımasını artır ve parlaklığı biraz yükselt',
        ],
      };
    case 'badges':
      return {
        label: 'Özellik Rozetleri',
        shortLabel: 'Rozetler',
        suggestions: [
          'Rozetleri organik ve çevre dostu vurgularla güncelle',
          'E-ticaret güven rozetleri yaz (Hızlı Kargo, Orijinal)',
          'Rozetleri sağ alt tarafa taşı',
        ],
      };
    case 'promo':
      return {
        label: 'Kampanya / İndirim Çıkartması',
        shortLabel: 'Kampanya',
        suggestions: [
          '%30 İNDİRİM daire rozeti yap, canlı kırmızı renkte',
          'YENİ SEZON etiketine çevir ve büyüt',
          'Kampanya çıkartmasını geçici olarak gizle',
        ],
      };
    case 'all':
    default:
      return {
        label: 'Tüm Şablon',
        shortLabel: 'Tüm Şablon',
        suggestions: [
          'Tüm tasarımı lüks altın-siyah editoryal tarza dönüştür',
          'Yaz indirimi temalı ferah turkuaz-sarı kapak yap',
          'Minimalist kahve/bej tonlarında butik bir kapak tasarla',
        ],
      };
  }
}

const VALID_FONTS: StudioTypography['fontFamily'][] = [
  'Cabinet Grotesk',
  'Plus Jakarta Sans',
  'Playfair Display',
  'Inter',
];

const VALID_ALIGNMENTS: StudioTypography['alignment'][] = ['left', 'center', 'right'];
const VALID_RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9'];
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

export function applyStudioPatch(
  state: StudioEditableState,
  patch: StudioPatch,
  targetArea: EditableAreaId
): { nextState: StudioEditableState; appliedChanges: string[] } {
  const appliedChanges: string[] = [];
  let nextAspectRatio = state.aspectRatio;
  let nextBackground = { ...state.background };
  let nextTypography = { ...state.typography };
  let nextBadges = state.badges.map((b) => ({ ...b }));
  let nextBadgesPosition = { ...state.badgesPosition };
  let nextPromoBadge = { ...state.promoBadge };
  let nextProduct = { ...state.product };
  let nextFloating = state.floatingElements.map((f) => ({ ...f }));
  let nextLayers = state.layers.map((l) => ({ ...l }));

  const allow = (area: EditableAreaId) => targetArea === 'all' || targetArea === area;

  if (patch.aspectRatio && allow('background') && VALID_RATIOS.includes(patch.aspectRatio)) {
    nextAspectRatio = patch.aspectRatio;
    appliedChanges.push(`Oran: ${patch.aspectRatio}`);
  }

  if (patch.background && allow('background')) {
    const bg = patch.background;
    if (typeof bg.imageUrl === 'string' && (bg.imageUrl.startsWith('/assets/backgrounds/') || bg.imageUrl.startsWith('data:image/'))) {
      nextBackground.type = 'image';
      nextBackground.imageUrl = bg.imageUrl;
      if (bg.gradient) nextBackground.gradient = bg.gradient;
    } else if (bg.gradient && typeof bg.gradient === 'string') {
      nextBackground.type = 'gradient';
      nextBackground.gradient = bg.gradient;
      nextBackground.imageUrl = undefined;
    }
    if (typeof bg.blur === 'number') nextBackground.blur = clamp(bg.blur, 0, 15);
    if (typeof bg.brightness === 'number') nextBackground.brightness = clamp(bg.brightness, 0.5, 1.5);
    if (typeof bg.contrast === 'number') nextBackground.contrast = clamp(bg.contrast, 0.7, 1.4);
    if (typeof bg.saturation === 'number') nextBackground.saturation = clamp(bg.saturation, 0.5, 1.5);
    if (typeof bg.vignette === 'boolean') nextBackground.vignette = bg.vignette;
    if (bg.stageStyle && ['none', 'champagne-arch', 'festive-lights'].includes(bg.stageStyle)) {
      nextBackground.stageStyle = bg.stageStyle;
    }
    appliedChanges.push('Arka plan güncellendi');
  }

  if (patch.typography && allow('text')) {
    const t = patch.typography;
    if (typeof t.kicker === 'string') nextTypography.kicker = t.kicker;
    if (typeof t.headline === 'string') nextTypography.headline = t.headline;
    if (typeof t.headlineHighlight === 'string') nextTypography.headlineHighlight = t.headlineHighlight;
    if (typeof t.subtitle === 'string') nextTypography.subtitle = t.subtitle;
    if (typeof t.ctaText === 'string') nextTypography.ctaText = t.ctaText;
    if (typeof t.showCta === 'boolean') nextTypography.showCta = t.showCta;
    if (t.fontFamily && VALID_FONTS.includes(t.fontFamily)) nextTypography.fontFamily = t.fontFamily;
    if (typeof t.headlineColor === 'string') nextTypography.headlineColor = t.headlineColor;
    if (typeof t.highlightColor === 'string') nextTypography.highlightColor = t.highlightColor;
    if (typeof t.subtitleColor === 'string') nextTypography.subtitleColor = t.subtitleColor;
    if (typeof t.ctaBgColor === 'string') nextTypography.ctaBgColor = t.ctaBgColor;
    if (typeof t.ctaTextColor === 'string') nextTypography.ctaTextColor = t.ctaTextColor;
    if (typeof t.headlineSize === 'number') nextTypography.headlineSize = clamp(t.headlineSize, 0.6, 1.6);
    if (t.alignment && VALID_ALIGNMENTS.includes(t.alignment)) nextTypography.alignment = t.alignment;
    if (typeof t.positionX === 'number') nextTypography.positionX = clamp(Math.round(t.positionX), 2, 92);
    if (typeof t.positionY === 'number') nextTypography.positionY = clamp(Math.round(t.positionY), 2, 86);
    if (t.plaqueStyle && ['none', 'emerald-3d', 'magenta-3d', 'crimson-3d'].includes(t.plaqueStyle)) {
      nextTypography.plaqueStyle = t.plaqueStyle;
    }
    if (typeof t.plaqueTilt === 'number') nextTypography.plaqueTilt = clamp(t.plaqueTilt, -8, 8);
    if (typeof t.subtitlePill === 'boolean') nextTypography.subtitlePill = t.subtitlePill;
    appliedChanges.push('Metin & tipografi güncellendi');
  }

  if (Array.isArray(patch.badges) && allow('badges')) {
    nextBadges = patch.badges.slice(0, 5).map((b, idx) => ({
      id: b.id || `ai-badge-${Date.now()}-${idx}`,
      icon: VALID_BADGE_ICONS.includes(b.icon) ? b.icon : 'sparkles',
      label: String(b.label || 'Özellik'),
      sublabel: b.sublabel ? String(b.sublabel) : undefined,
    }));
    appliedChanges.push(`Rozetler (${nextBadges.length}) güncellendi`);
  }

  if (patch.badgesPosition && allow('badges')) {
    nextBadgesPosition = {
      x: clamp(Math.round(patch.badgesPosition.x), 2, 72),
      y: clamp(Math.round(patch.badgesPosition.y), 5, 85),
    };
    if (!appliedChanges.includes('Rozetler')) {
      appliedChanges.push('Rozet konumu güncellendi');
    }
  }

  if (patch.promoBadge && allow('promo')) {
    const p = patch.promoBadge;
    if (typeof p.show === 'boolean') nextPromoBadge.show = p.show;
    if (p.type && ['tag', 'circle', 'pill', 'banner'].includes(p.type)) nextPromoBadge.type = p.type;
    if (typeof p.text === 'string') nextPromoBadge.text = p.text;
    if (typeof p.subtext === 'string') nextPromoBadge.subtext = p.subtext;
    if (typeof p.color === 'string') nextPromoBadge.color = p.color;
    if (typeof p.textColor === 'string') nextPromoBadge.textColor = p.textColor;
    if (typeof p.x === 'number') nextPromoBadge.x = clamp(Math.round(p.x), 6, 94);
    if (typeof p.y === 'number') nextPromoBadge.y = clamp(Math.round(p.y), 6, 94);
    if (typeof p.scale === 'number') nextPromoBadge.scale = clamp(p.scale, 0.5, 1.8);
    if (typeof p.rotation === 'number') nextPromoBadge.rotation = clamp(Math.round(p.rotation), -45, 45);
    appliedChanges.push('Kampanya etiketi güncellendi');
  }

  if (patch.productPlacement && allow('product')) {
    const pp = patch.productPlacement;
    if (typeof pp.x === 'number') nextProduct.x = clamp(pp.x, 10, 90);
    if (typeof pp.y === 'number') nextProduct.y = clamp(pp.y, 10, 90);
    if (typeof pp.scale === 'number') nextProduct.scale = clamp(pp.scale, 0.4, 1.8);
    if (typeof pp.rotation === 'number') nextProduct.rotation = clamp(pp.rotation, -45, 45);
    if (typeof pp.flipX === 'boolean') nextProduct.flipX = pp.flipX;
    if (typeof pp.shadowOpacity === 'number') nextProduct.shadowOpacity = clamp(pp.shadowOpacity, 0, 1);
    if (typeof pp.shadowBlur === 'number') nextProduct.shadowBlur = clamp(pp.shadowBlur, 4, 50);
    if (typeof pp.shadowOffsetY === 'number') nextProduct.shadowOffsetY = clamp(pp.shadowOffsetY, 0, 40);
    if (typeof pp.reflection === 'boolean') nextProduct.reflection = pp.reflection;
    if (typeof pp.reflectionOpacity === 'number') nextProduct.reflectionOpacity = clamp(pp.reflectionOpacity, 0.05, 0.8);
    if (typeof pp.brightness === 'number') nextProduct.brightness = clamp(pp.brightness, 0.6, 1.5);
    if (typeof pp.contrast === 'number') nextProduct.contrast = clamp(pp.contrast, 0.7, 1.45);
    if (typeof pp.saturation === 'number') nextProduct.saturation = clamp(pp.saturation, 0.4, 1.8);
    if (typeof pp.clarity === 'number') nextProduct.clarity = clamp(pp.clarity, 0, 1);
    if (typeof pp.ambientGlow === 'number') nextProduct.ambientGlow = clamp(pp.ambientGlow, 0, 1);
    if (typeof pp.glowColor === 'string') nextProduct.glowColor = pp.glowColor;
    appliedChanges.push('Ürün yerleşimi ve ışık ayarlandı');
  }

  if (Array.isArray(patch.floatingElements) && targetArea === 'all') {
    nextFloating = patch.floatingElements.slice(0, 6).map((el, idx) => ({
      id: el.id || `ai-float-${Date.now()}-${idx}`,
      type: VALID_FLOATING_TYPES.includes(el.type) ? el.type : 'sparkle',
      x: clamp(Math.round(el.x), 5, 95),
      y: clamp(Math.round(el.y), 5, 95),
      scale: clamp(el.scale ?? 1, 0.5, 2),
      rotation: clamp(Math.round(el.rotation ?? 0), -180, 180),
      opacity: clamp(el.opacity ?? 0.9, 0.1, 1),
    }));

    // Keep non-floating layers and rebuild floating entries cleanly
    const nonFloating = nextLayers.filter((l) => l.type !== 'floating');
    const floatLayers: CanvasLayer[] = nextFloating.map((f) => ({
      id: `layer-float-${f.id}`,
      name: getFloatingLabel(f.type),
      type: 'floating',
      visible: true,
      locked: false,
      floatingId: f.id,
    }));
    const productIdx = nonFloating.findIndex((l) => l.type === 'product');
    if (productIdx >= 0) {
      nextLayers = [
        ...nonFloating.slice(0, productIdx),
        ...floatLayers,
        ...nonFloating.slice(productIdx),
      ];
    } else {
      nextLayers = [...floatLayers, ...nonFloating];
    }
    appliedChanges.push('3D efektler güncellendi');
  }

  return {
    nextState: {
      aspectRatio: nextAspectRatio,
      background: nextBackground,
      typography: nextTypography,
      badges: nextBadges,
      badgesPosition: nextBadgesPosition,
      promoBadge: nextPromoBadge,
      product: nextProduct,
      floatingElements: nextFloating,
      layers: nextLayers,
    },
    appliedChanges,
  };
}
