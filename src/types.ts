export type AspectRatio = '1:1' | '9:16' | '4:5' | '16:9';

export type ExportImageFormat = 'png' | 'jpeg' | 'webp';

export type TemplateCategory =
  | 'Kozmetik & Bakım'
  | 'Aksiyon & Teknoloji'
  | '3D & Eğlence'
  | 'Minimalist Marka'
  | 'E-Ticaret & Kampanya'
  | 'Lüks & Parfüm'
  | 'Gıda & İçecek'
  | 'Moda & Aksesuar'
  | 'Pazaryeri & Vitrin';

export type EditableAreaId =
  | 'all'
  | 'background'
  | 'text'
  | 'product'
  | 'badges'
  | 'promo';

export type AiCreativeMode =
  | 'full-poster'
  | 'studio-scene'
  | 'promo-flyer'
  | 'sticker-3d'
  | 'collage-story'
  | 'brand-board';

export interface FloatingElement {
  id: string;
  type:
    | 'water-splash'
    | 'gold-coin'
    | '3d-sphere'
    | 'sparkle'
    | 'leaf'
    | 'cloud'
    | 'glow-ring'
    | 'gold-ribbon'
    | 'custom-sticker';
  imageUrl?: string;
  label?: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number;
  rotation: number;
  opacity: number;
}

export interface FeatureBadge {
  id: string;
  icon: 'shield' | 'sparkles' | 'droplet' | 'sun' | 'award' | 'zap' | 'leaf' | 'clock' | 'check';
  label: string;
  sublabel?: string;
}

export interface PromoBadge {
  show: boolean;
  type: 'tag' | 'circle' | 'pill' | 'banner';
  text: string;
  subtext?: string;
  color: string;
  textColor: string;
  x: number; // percentage
  y: number; // percentage
  scale: number;
  rotation: number;
}

export interface StudioTypography {
  kicker: string;
  headline: string;
  headlineHighlight?: string;
  subtitle: string;
  ctaText: string;
  showCta: boolean;
  fontFamily: 'Cabinet Grotesk' | 'Plus Jakarta Sans' | 'Playfair Display' | 'Inter';
  headlineColor: string;
  highlightColor: string;
  subtitleColor: string;
  ctaBgColor: string;
  ctaTextColor: string;
  headlineSize: number; // multiplier e.g. 1
  alignment: 'left' | 'center' | 'right';
  positionY: number; // percentage 10 - 80
  positionX: number; // percentage 10 - 80
  plaqueStyle?: 'none' | 'emerald-3d' | 'magenta-3d' | 'crimson-3d';
  plaqueTilt?: number; // degrees e.g. -2
  subtitlePill?: boolean;
}

export interface BrandWatermark {
  show: boolean;
  brandName: string;
  logoUrl?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number; // 0.3 - 1.0
  theme: 'light' | 'dark';
}

export interface BrandKit {
  brandName: string;
  tagline: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  ctaColor: string;
  fontFamily: StudioTypography['fontFamily'];
  watermarkPosition: BrandWatermark['position'];
  showWatermark: boolean;
}

export interface ProductCenterOfGravity {
  x: number; // 0..1 normalized horizontal visual center of gravity inside product image
  y: number; // 0..1 normalized vertical visual center of gravity inside product image
  boundingBox?: {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
  };
  source: 'ai' | 'pixel';
  confidence: number; // 0..1
  rationale?: string;
  goldenTarget?: {
    x: number; // 0..100 percentage on canvas
    y: number; // 0..100 percentage on canvas
    label: string;
  };
}

export interface ProductPlacement {
  src: string; // cutout data URL or image path
  originalSrc?: string;
  x: number; // percentage center 0-100
  y: number; // percentage center 0-100
  scale: number; // 0.2 - 2.5
  rotation: number; // -180 to 180
  flipX: boolean;
  // Shadow
  shadowOpacity: number; // 0 - 1
  shadowBlur: number; // px
  shadowOffsetY: number; // px
  shadowSpread: number;
  // Reflection
  reflection: boolean;
  reflectionOpacity: number; // 0 - 1
  // Adjustments
  brightness: number; // 0.5 - 1.5
  contrast: number; // 0.5 - 1.5
  saturation: number; // 0 - 2
  clarity?: number; // 0 - 1 optical micro-contrast & edge sharpness
  ambientGlow: number; // 0 - 1
  glowColor: string;
  centerOfGravity?: ProductCenterOfGravity;
}

export interface StudioBackground {
  type: 'image' | 'gradient' | 'ai';
  imageUrl?: string;
  gradient?: string;
  blur: number; // 0 - 20px
  brightness: number; // 0.5 - 1.5
  contrast?: number; // 0.7 - 1.4
  saturation?: number; // 0.5 - 1.5
  vignette: boolean;
  stageStyle?: 'none' | 'champagne-arch' | 'festive-lights';
  fitMode?: 'cover' | 'contain';
}

export type SmartFixPresetId =
  | 'marketplace-pro'
  | 'crisp-commercial'
  | 'luxury-editorial'
  | 'soft-natural';

export type LayerType = 'product' | 'typography' | 'badges' | 'promoBadge' | 'floating';

export interface CanvasLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  floatingId?: string;
}

export interface CoverTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  description: string;
  aspectRatio: AspectRatio;
  background: StudioBackground;
  typography: StudioTypography;
  badges: FeatureBadge[];
  badgesPosition?: { x: number; y: number };
  promoBadge: PromoBadge;
  floatingElements: FloatingElement[];
  productDefaultPlacement: Partial<ProductPlacement>;
  thumbnailUrl?: string;
  layers?: CanvasLayer[];
  isCustomAi?: boolean;
}

export interface HistoryItem {
  placement: ProductPlacement;
  background: StudioBackground;
  typography: StudioTypography;
  badges: FeatureBadge[];
  badgesPosition?: { x: number; y: number };
  promoBadge: PromoBadge;
  floatingElements: FloatingElement[];
  aspectRatio: AspectRatio;
  layers?: CanvasLayer[];
  brandWatermark?: BrandWatermark;
}

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  thumbnailDataUrl?: string;
  aspectRatio: AspectRatio;
  snapshot: HistoryItem;
}

export interface AbCampaignVariation {
  id: string;
  angleBadge: string;
  angleTitle: string;
  rationale: string;
  kicker: string;
  headline: string;
  headlineHighlight: string;
  subtitle: string;
  ctaText: string;
  promoText: string;
  promoSubtext: string;
  accentHex: string;
  ctaBgHex: string;
  ctaTextHex: string;
}

export interface StudioPatch {
  aspectRatio?: AspectRatio;
  background?: Partial<StudioBackground>;
  typography?: Partial<StudioTypography>;
  badges?: FeatureBadge[];
  badgesPosition?: { x: number; y: number };
  promoBadge?: Partial<PromoBadge>;
  productPlacement?: Partial<Omit<ProductPlacement, 'src' | 'originalSrc'>>;
  floatingElements?: FloatingElement[];
  scenePrompt?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  targetArea: EditableAreaId;
  appliedChanges?: string[];
  isError?: boolean;
}
