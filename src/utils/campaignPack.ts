import {
  AspectRatio,
  FeatureBadge,
  FloatingElement,
  ProductPlacement,
  PromoBadge,
  StudioBackground,
  StudioTypography,
  CanvasLayer,
  BrandWatermark,
} from '../types';

export interface ChannelSpec {
  ratio: AspectRatio;
  slug: string;
  title: string;
  platforms: string;
  dimensions1x: string;
  dimensions2x: string;
}

export const CAMPAIGN_CHANNELS: ChannelSpec[] = [
  {
    ratio: '1:1',
    slug: '1x1-kare-post',
    title: 'Kare Vitrin & Post',
    platforms: 'Instagram Kare · Trendyol · Meta Katalog',
    dimensions1x: '1080 × 1080 px',
    dimensions2x: '2160 × 2160 px',
  },
  {
    ratio: '4:5',
    slug: '4x5-dikey-akis',
    title: 'Dikey Sosyal Akış',
    platforms: 'Instagram Feed · Facebook Mobil Reklam',
    dimensions1x: '1080 × 1350 px',
    dimensions2x: '2160 × 2700 px',
  },
  {
    ratio: '9:16',
    slug: '9x16-hikaye-reels',
    title: 'Hikaye & Reels Tam Ekran',
    platforms: 'Instagram Story · Reels · TikTok · Shorts',
    dimensions1x: '1080 × 1920 px',
    dimensions2x: '2160 × 3840 px',
  },
  {
    ratio: '16:9',
    slug: '16x9-yatay-banner',
    title: 'Web Hero & Yatay Banner',
    platforms: 'E-Ticaret Slider · YouTube Kapak · Google Display',
    dimensions1x: '1920 × 1080 px',
    dimensions2x: '3840 × 2160 px',
  },
];

export interface AdaptableStudioState {
  aspectRatio: AspectRatio;
  background: StudioBackground;
  product: ProductPlacement;
  typography: StudioTypography;
  badges: FeatureBadge[];
  badgesPosition: { x: number; y: number };
  promoBadge: PromoBadge;
  floatingElements: FloatingElement[];
  layers: CanvasLayer[];
  brandWatermark?: BrandWatermark;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Intelligently reflows typography, product placement, feature badges, and promo badge
 * for a target aspect ratio while preserving brand colors, copy, and visual balance.
 */
export function adaptStateToAspectRatio(
  state: AdaptableStudioState,
  targetRatio: AspectRatio
): AdaptableStudioState {
  if (state.aspectRatio === targetRatio) {
    return {
      ...state,
      product: { ...state.product },
      typography: { ...state.typography },
      badgesPosition: { ...state.badgesPosition },
      promoBadge: { ...state.promoBadge },
      floatingElements: state.floatingElements.map((f) => ({ ...f })),
    };
  }

  const hasPlaque = Boolean(state.typography.plaqueStyle && state.typography.plaqueStyle !== 'none');

  if (targetRatio === '9:16') {
    // Tall Story / Reels layout: keep top >= 14% and bottom edge of stacked badges <= 80% (above 18% Reels UI bar)
    return {
      ...state,
      aspectRatio: '9:16',
      typography: {
        ...state.typography,
        alignment: 'center',
        positionX: 50,
        positionY: 14,
        headlineSize: clamp(Number((state.typography.headlineSize * 0.88).toFixed(2)), 0.74, 1.12),
      },
      product: {
        ...state.product,
        x: hasPlaque ? 50 : 66,
        y: hasPlaque ? 60 : 59,
        scale: clamp(Number((state.product.scale * 0.94).toFixed(2)), 0.65, 1.26),
      },
      badgesPosition: {
        x: 6,
        y: 54,
      },
      promoBadge: {
        ...state.promoBadge,
        x: 82,
        y: 40,
      },
      floatingElements: state.floatingElements.map((f) => ({
        ...f,
        y: clamp(f.y, 16, 79),
      })),
    };
  }

  if (targetRatio === '16:9') {
    // Wide Hero Banner layout: editorial left copy + Golden Ratio right product showcase
    return {
      ...state,
      aspectRatio: '16:9',
      typography: {
        ...state.typography,
        alignment: hasPlaque ? 'center' : 'left',
        positionX: hasPlaque ? 30 : 7,
        positionY: hasPlaque ? 18 : 19,
        headlineSize: clamp(Number((state.typography.headlineSize * 0.92).toFixed(2)), 0.72, 1.18),
      },
      product: {
        ...state.product,
        x: 74,
        y: 54,
        scale: clamp(Number((state.product.scale * 1.04).toFixed(2)), 0.7, 1.6),
      },
      badgesPosition: {
        x: 7,
        y: 67,
      },
      promoBadge: {
        ...state.promoBadge,
        x: 56,
        y: 22,
      },
      floatingElements: state.floatingElements.map((f) => ({
        ...f,
        x: clamp(f.x, 8, 92),
        y: clamp(f.y, 12, 88),
      })),
    };
  }

  if (targetRatio === '1:1') {
    // Square Catalog / Post: balanced asymmetrical split or centered plaque
    const centerMode = hasPlaque;
    return {
      ...state,
      aspectRatio: '1:1',
      typography: {
        ...state.typography,
        alignment: centerMode ? 'center' : 'left',
        positionX: centerMode ? 50 : 7,
        positionY: centerMode ? 8 : 13,
        headlineSize: clamp(state.typography.headlineSize, 0.78, 1.22),
      },
      product: {
        ...state.product,
        x: centerMode ? 50 : 68,
        y: centerMode ? 65 : 56,
        scale: clamp(state.product.scale, 0.7, 1.45),
      },
      badgesPosition: {
        x: 7,
        y: centerMode ? 68 : 64,
      },
      promoBadge: {
        ...state.promoBadge,
        x: 83,
        y: centerMode ? 42 : 18,
      },
      floatingElements: state.floatingElements.map((f) => ({ ...f })),
    };
  }

  // '4:5' Vertical Feed standard
  const centerMode = hasPlaque;
  return {
    ...state,
    aspectRatio: '4:5',
    typography: {
      ...state.typography,
      alignment: centerMode ? 'center' : 'left',
      positionX: centerMode ? 50 : 7,
      positionY: centerMode ? 9 : 12,
      headlineSize: clamp(state.typography.headlineSize, 0.8, 1.28),
    },
    product: {
      ...state.product,
      x: centerMode ? 50 : 65,
      y: centerMode ? 64 : 58,
      scale: clamp(state.product.scale, 0.72, 1.5),
    },
    badgesPosition: {
      x: 7,
      y: centerMode ? 68 : 62,
    },
    promoBadge: {
      ...state.promoBadge,
      x: 82,
      y: centerMode ? 40 : 18,
    },
    floatingElements: state.floatingElements.map((f) => ({ ...f })),
  };
}
