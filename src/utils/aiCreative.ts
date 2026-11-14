import type {
  AiCreativeMode,
  AspectRatio,
  CanvasLayer,
} from '../types';

export interface AiCreativeModeMeta {
  id: AiCreativeMode;
  label: string;
  shortLabel: string;
  description: string;
  supportsOverlayCopy: boolean;
  recommendedFitMode: 'cover' | 'contain';
  defaultIncludeProduct: boolean;
}

export interface AiStylePreset {
  id: string;
  mode: AiCreativeMode;
  title: string;
  tag: string;
  description: string;
  prompt: string;
  headlineText?: string;
  subtext?: string;
  badgeText?: string;
  brandColors?: string;
  accentGradient: string;
}

export interface AiCreativePromptInput {
  mode: AiCreativeMode;
  prompt: string;
  headlineText?: string;
  subtext?: string;
  badgeText?: string;
  brandColors?: string;
  negativePrompt?: string;
  hasProductImage?: boolean;
  hasReferenceImage?: boolean;
  language?: string;
}

export interface NormalizedCopyOption {
  kicker?: string;
  headline?: string;
  headlineHighlight?: string;
  subheading?: string;
  cta?: string;
  badges?: string[];
}

export interface NormalizedAnalyzeOutput {
  productName?: string;
  category?: string;
  colorPalette: string[];
  recommendedScenePrompt?: string;
  options: NormalizedCopyOption[];
}

export const AI_CREATIVE_MODES: AiCreativeModeMeta[] = [
  {
    id: 'full-poster',
    label: 'Tam AI Reklam Afişi',
    shortLabel: 'Tam Afiş',
    description: 'Ürün, başlık, teknik ikonlar ve CTA hepsi tek profesyonel karede çizilir.',
    supportsOverlayCopy: true,
    recommendedFitMode: 'cover',
    defaultIncludeProduct: true,
  },
  {
    id: 'studio-scene',
    label: 'Ürünlü Stüdyo Sahnesi',
    shortLabel: 'Stüdyo Sahne',
    description: 'Yazısız podyum, su sıçraması veya 3D sahne üretir; üstüne kendi yazılarınız gelir.',
    supportsOverlayCopy: false,
    recommendedFitMode: 'cover',
    defaultIncludeProduct: true,
  },
  {
    id: 'promo-flyer',
    label: '3D Kampanya & Sosyal Afiş',
    shortLabel: 'Kampanya Afişi',
    description: '2+1 fırsatları, dev 3D rakamlar, konfeti, parlayan butonlar ve indirim afişleri.',
    supportsOverlayCopy: true,
    recommendedFitMode: 'cover',
    defaultIncludeProduct: true,
  },
  {
    id: 'sticker-3d',
    label: '3D Sticker & Rozet Sanatı',
    shortLabel: '3D Sticker',
    description: 'Beyaz zeminde "ESKİYİ YENİLE" tarzı 3D parlak yazı ve kavisli ok rozeti üretir.',
    supportsOverlayCopy: true,
    recommendedFitMode: 'contain',
    defaultIncludeProduct: false,
  },
  {
    id: 'collage-story',
    label: 'Öncesi/Sonrası & Kolaj',
    shortLabel: 'Kolaj / Split',
    description: 'Bölünmüş karşılaştırma, yakın çekim detay kutusu veya çok kareli hikaye afişi.',
    supportsOverlayCopy: true,
    recommendedFitMode: 'contain',
    defaultIncludeProduct: true,
  },
  {
    id: 'brand-board',
    label: 'Marka Kimliği & Ambalaj Panosu',
    shortLabel: 'Marka Panosu',
    description: 'Logo, renk paleti, ambalaj seti ve sosyal medya kartları tek marka panosunda.',
    supportsOverlayCopy: true,
    recommendedFitMode: 'contain',
    defaultIncludeProduct: true,
  },
];

export const AI_STYLE_PRESETS: AiStylePreset[] = [
  {
    id: 'poster-tech-editorial',
    mode: 'full-poster',
    title: 'Editoryal Teknoloji & Renk Paleti',
    tag: 'Teknoloji',
    description: 'Temiz stüdyo ışığı, alt kısımda özellik kartları ve renk seçenek daireleri.',
    prompt:
      'Yumuşak gri stüdyo zemininde üst düzey editoryal ürün reklam afişi, net mimari gölge, alt kısımda 5 dairesel renk seçeneği noktası ve 4 sütunlu şık teknik özellik şeridi.',
    headlineText: 'YENİ NESİL GÜÇ',
    subtext: '48MP Pro Kamera • 120Hz OLED Ekran • Hızlı Şarj',
    badgeText: 'ŞİMDİ İNCELE',
    brandColors: 'Koyu grafit, titanyum grisi ve sıcak turuncu vurgu',
    accentGradient: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
  },
  {
    id: 'poster-cosmetic-smear',
    mode: 'full-poster',
    title: 'Kozmetik Sürüm & Fayda İkonları',
    tag: 'Kozmetik',
    description: 'Krem/ruj doku sürümü, öncesi-sonrası detay penceresi ve 4 ikonlu alt şerit.',
    prompt:
      'Sıcak krem zemin üzerinde ticari güzellik ve kozmetik afişi, ürünün arkasında parlak krem/ruj doku sürümü, makro stüdyo yansımaları ve alt kenarda 4 minimalist fayda ikonu.',
    headlineText: '24 SAAT KALICI ETKİ',
    subtext: 'Mat Bitiş • Nemlendirici Formül • Yoğun Pigment',
    badgeText: 'DERMATOLOJİK TESTLİ',
    brandColors: 'Sıcak krem, gül kurusu ve koyu bordo',
    accentGradient: 'linear-gradient(135deg, #be185d 0%, #fb7185 100%)',
  },
  {
    id: 'poster-splash-glass',
    mode: 'full-poster',
    title: 'Islak Kaya, Sıçrama & Cam Kartlar',
    tag: 'Cilt / Outdoor',
    description: 'Islak taş podyum, güneş parlaması, su sıçramaları ve buzlu cam özellik kartı.',
    prompt:
      'Islak nehir taşı üzerinde duran ürün, etrafında kristal su sıçramaları ve altın güneş ışığı parlaması, sol tarafta buzlu cam (glassmorphism) özellik kartı ve şık hap şeklinde CTA butonu.',
    headlineText: 'GÜNEŞE KARŞI TAM KORUMA',
    subtext: 'SPF 50+ • Suya Dayanıklı • Hafif Doku',
    badgeText: 'HEMEN KEŞFET',
    brandColors: 'Turkuaz su, altın güneş ve beyaz buzlu cam',
    accentGradient: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
  },
  {
    id: 'poster-dark-action',
    mode: 'full-poster',
    title: 'Karanlık Asfalt & Dev Rakam',
    tag: 'Aksiyon / Spor',
    description: 'Gece asfalt/kaya dokusu, ışık izleri, arkada dev yarı saydam tipografi ve 6 ikonlu grid.',
    prompt:
      'Koyu volkanik bazalt ve ıslak asfalt arka planında adrenalin dolu aksiyon afişi, dramatik kenar ışığı, hız ışık izleri, ürünün arkasında dev yarı saydam rakam tipografisi ve altta 6 ikonlu teknik şerit.',
    headlineText: 'SINIRLARI ZORLA',
    subtext: 'Ultra Dayanıklı • 5K Netlik • Su Geçirmez Gövde',
    badgeText: 'PRO SERİ',
    brandColors: 'Obsidyen siyah, alev turuncusu ve elektrik mavisi',
    accentGradient: 'linear-gradient(135deg, #0f172a 0%, #ea580c 100%)',
  },
  {
    id: 'promo-2plus1-3d',
    mode: 'promo-flyer',
    title: '2+1 / Çoklu Fırsat 3D Sosyal Afiş',
    tag: 'Kampanya',
    description: 'Dev 3D konturlu rakamlar, uçuşan su/içecek sıçramaları ve enerjik sosyal afiş.',
    prompt:
      'Canlı sosyal medya kampanya afişi, dev parlak 3D konturlu 2+1 rakamları, dinamik içecek ve meyve/buz sıçramaları, yüksek enerjili stüdyo ışığı ve dikkat çekici perakende teklif düzeni.',
    headlineText: '2 ALANA 1 HEDİYE',
    subtext: 'Tüm Seçili Ürünlerde Hafta Sonu Fırsatı',
    badgeText: '2+1',
    brandColors: 'Canlı elektrik mavisi, limon sarısı ve beyaz 3D',
    accentGradient: 'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)',
  },
  {
    id: 'promo-gift-burst',
    mode: 'promo-flyer',
    title: 'Işıklı Kutu & Yılbaşı / Flaş İndirim',
    tag: 'Banner / İndirim',
    description: 'Parlayan hediye kutusundan fışkıran ürünler, peri ışıkları ve 3D yeşil CTA butonu.',
    prompt:
      'Sıcak kızıl kırmızı fonlu e-ticaret kampanya afişi, üstte parlayan salkım peri ışıkları, içinden altın ışık ve ürünlerin fışkırdığı açık hediye kutusu, kar tepesi zemin ve parlak 3D yeşil CTA butonu.',
    headlineText: 'BÜYÜK SEZON İNDİRİMİ',
    subtext: 'Sepette %50’ye Varan Fırsatlar',
    badgeText: 'KAÇIRMA >',
    brandColors: 'Kızıl kırmızı, altın ışıkları ve zümrüt yeşil buton',
    accentGradient: 'linear-gradient(135deg, #b91c1c 0%, #f59e0b 100%)',
  },
  {
    id: 'sticker-eskiyi-yenile',
    mode: 'sticker-3d',
    title: '"ESKİYİ YENİLE" 3D Kavisli Ok Rozeti',
    tag: '3D Sticker',
    description: 'Kalın 3D kabartmalı harfler, turuncu-mor kavisli oklar ve ışıltı patlamaları.',
    prompt:
      'Saf düz beyaz (#FFFFFF) zemin ortasında izole 3D parlak rozet illüstrasyonu, kalın beyaz kabartmalı ve fuşya-mor derinlikli büyük harfler, etrafında dönen parlak turuncu ve mor 3D kavisli oklar, beyaz ışık parlamaları.',
    headlineText: 'ESKİYİ YENİLE',
    subtext: 'Anında Değişim Fırsatı',
    badgeText: 'FIRSAT',
    brandColors: 'Parlak beyaz, fuşya-mor derinlik, canlı turuncu ve mor oklar',
    accentGradient: 'linear-gradient(135deg, #f97316 0%, #a855f7 100%)',
  },
  {
    id: 'sticker-mega-indirim',
    mode: 'sticker-3d',
    title: '3D Parlak Altın & Kırmızı Kampanya Rozeti',
    tag: '3D Etiket',
    description: 'Tuvalin üstüne şeffaf katman olarak eklenebilen parlak 3D kampanya etiketi.',
    prompt:
      'Saf düz beyaz (#FFFFFF) zemin ortasında izole 3D parlak kampanya etiketi, metalik altın ve yakut kırmızı kabartmalı 3D harfler, dinamik yıldız ve kurdele kıvrımları, keskin kenarlı şeffaf çıkartma formatı.',
    headlineText: 'SÜPER FIRSAT',
    subtext: '%50 İNDİRİM',
    badgeText: 'SINIRLI SÜRE',
    brandColors: 'Altın sarısı, parlak yakut kırmızı ve beyaz parıltı',
    accentGradient: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)',
  },
  {
    id: 'scene-3d-floating',
    mode: 'studio-scene',
    title: '3D Yüzen Küreler & Pastel Stüdyo',
    tag: '3D Sahne',
    description: 'Şeftali/pastel stüdyoda havada süzülen 3D küreler ve geometrik ahşap bloklar.',
    prompt:
      'Şeftali ve pastel mercan tonlarında modern 3D ürün fotoğrafçılığı stüdyosu, havada süzülen mat 3D küreler, geometrik meşe ahşap bloklar ve merkezde ürün podyumu, yumuşak softbox ışığı, yazısız.',
    brandColors: 'Şeftali, mercan pembe ve açık meşe',
    accentGradient: 'linear-gradient(135deg, #fb7185 0%, #fdba74 100%)',
  },
  {
    id: 'scene-craft-flatlay',
    mode: 'studio-scene',
    title: 'Zanaat Flat-Lay & Butik Sabun/Kozmetik',
    tag: 'Minimalist',
    description: 'Üstten çekim minimalist beyaz zemin, doğal gölgeler ve el yapımı ürün estetiği.',
    prompt:
      'Galeri beyazı doğal taş yüzeyde üstten çekim minimalist stüdyo flat-lay sahnesi, yumuşak gün ışığı gölgeleri, doğal zanaat aksesuarları ve başlık için ferah boş alan, yazısız.',
    brandColors: 'Galeri beyazı, doğal taş ve zeytin yeşili',
    accentGradient: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
  },
  {
    id: 'collage-split-before-after',
    mode: 'collage-story',
    title: 'Öncesi / Sonrası & Çok Kareli Kolaj',
    tag: 'Karşılaştırma',
    description: 'Bölünmüş öncesi/sonrası karşılaştırma veya alıntı kartlı çok kareli hikaye afişi.',
    prompt:
      'Modern bölünmüş ekran Öncesi/Sonrası karşılaştırma ve çok kareli hikaye reklam düzeni, yuvarlatılmış fotoğraf kartları, dairesel makro detay zoom penceresi ve alt kısımda 3 ikonlu fayda şeridi.',
    headlineText: 'İLK KULLANIMDA FARKI GÖR',
    subtext: 'Öncesi & Sonrası Gerçek Dönüşüm',
    badgeText: 'KANITLANMIŞ SONUÇ',
    brandColors: 'Temiz beyaz kartlar, sıcak mercan ve kömür grisi',
    accentGradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
  },
  {
    id: 'brand-guideline-board',
    mode: 'brand-board',
    title: 'Tam Marka Kimliği & Ambalaj Panosu',
    tag: 'Marka Rehberi',
    description: 'Logo, renk paleti kutuları, ambalaj mockupları ve sosyal medya kareleri bir arada.',
    prompt:
      'Tek sayfada profesyonel Marka Kimlik Rehberi ve Ambalaj Sunum Panosu: üstte minimalist logo ve tipografi örneği, 4-5 adet hex kodlu renk paleti kartı, sıçrama efektli 3D ürün ambalaj mockupları ve 3 uyumlu sosyal medya kare önizlemesi.',
    headlineText: 'MARKA KİMLİK REHBERİ',
    subtext: 'Logo Sistemi • Renk Paleti • Ambalaj & Sosyal Tasarım',
    badgeText: 'BRAND KIT',
    brandColors: 'Koyu mor/kahve imza rengi, krem ve canlı vurgu tonu',
    accentGradient: 'linear-gradient(135deg, #6d28d9 0%, #db2777 100%)',
  },
];

export function mapAspectRatioForGemini(aspectRatio: AspectRatio): '1:1' | '3:4' | '4:3' | '9:16' | '16:9' {
  switch (aspectRatio) {
    case '1:1':
      return '1:1';
    case '4:5':
      return '3:4';
    case '9:16':
      return '9:16';
    case '16:9':
      return '16:9';
    default:
      return '1:1';
  }
}

export function buildAiCreativePrompt(input: AiCreativePromptInput): string {
  const {
    mode,
    prompt,
    headlineText,
    subtext,
    badgeText,
    brandColors,
    negativePrompt,
    hasProductImage = false,
    hasReferenceImage = false,
    language = 'Turkish',
  } = input;

  const cleanPrompt = (prompt || '').trim() || 'Modern premium commercial product creative';
  const colorLine = brandColors?.trim() ? `Brand Color Palette: ${brandColors.trim()}.` : '';
  const productLine = hasProductImage
    ? 'CRITICAL PRODUCT PRESERVATION: Preserve the exact uploaded product shape, label, branding, proportions, and colors from the provided product image and integrate it naturally with matching reflections and contact shadows.'
    : '';
  const referenceLine = hasReferenceImage
    ? 'STYLE REFERENCE MATCH: Follow the layout structure, lighting mood, visual hierarchy, and graphic language of the provided style reference image while adapting it to the requested product and copy.'
    : '';

  const copyParts: string[] = [];
  if (headlineText?.trim()) copyParts.push(`Main Headline Text (exact spelling in ${language}): "${headlineText.trim()}"`);
  if (subtext?.trim()) copyParts.push(`Subtext / Feature Bullets (exact spelling in ${language}): "${subtext.trim()}"`);
  if (badgeText?.trim()) copyParts.push(`Promo Badge / CTA Button Text (exact spelling in ${language}): "${badgeText.trim()}"`);
  const copyLine = copyParts.length > 0 ? copyParts.join('. ') + '.' : '';
  const negLine = negativePrompt?.trim() ? `Avoid: ${negativePrompt.trim()}.` : '';

  switch (mode) {
    case 'full-poster':
      return [
        'Complete, agency-grade commercial advertising poster ready to publish, 8k editorial photography and graphic layout.',
        `Creative Brief: ${cleanPrompt}.`,
        productLine,
        referenceLine,
        colorLine,
        copyLine || `Include crisp, balanced ${language} advertising headline typography, clean feature icon row or spec pills, and a sleek CTA pill.`,
        'Ultra-crisp typography legibility, balanced negative space, realistic commercial lighting, no garbled letters or watermarks.',
        negLine,
      ]
        .filter(Boolean)
        .join(' ');

    case 'promo-flyer':
      return [
        'High-converting vibrant social media campaign flyer and retail offer poster.',
        `Campaign Concept: ${cleanPrompt}.`,
        productLine,
        referenceLine,
        colorLine,
        copyLine || `Include bold glossy 3D promotional typography/offer numerals in ${language}, dynamic splashes or confetti accents, and a clickable-looking 3D CTA pill.`,
        'Punchy commercial colors, dynamic depth, sharp legible lettering, zero messy artifacts.',
        negLine,
      ]
        .filter(Boolean)
        .join(' ');

    case 'sticker-3d':
      return [
        'Isolated 3D glossy commercial typography & campaign badge sticker illustration.',
        `Sticker Design: ${cleanPrompt}.`,
        referenceLine,
        colorLine,
        copyLine || `Main 3D Extruded Lettering in ${language}: "${headlineText?.trim() || 'FIRSAT'}".`,
        'CRITICAL ISOLATION RULE: Center the 3D sticker artwork with generous margin on a COMPLETELY FLAT PURE SOLID WHITE (#FFFFFF) background with ZERO background gradient, ZERO floor shadow extending to edges, and crisp silhouette borders so it extracts cleanly into a transparent PNG sticker.',
        negLine,
      ]
        .filter(Boolean)
        .join(' ');

    case 'collage-story':
      return [
        'Editorial split-screen comparison or multi-vignette storytelling advertisement poster.',
        `Visual Story: ${cleanPrompt}.`,
        productLine,
        referenceLine,
        colorLine,
        copyLine || `Include clean ${language} card titles, Before/After or multi-frame visual panels with rounded borders, and an icon benefit footer.`,
        'Cohesive color grading across all frames, clean grid gutters, sharp readable text.',
        negLine,
      ]
        .filter(Boolean)
        .join(' ');

    case 'brand-board':
      return [
        'Complete 1-page professional Brand Identity Guideline & Packaging Presentation Board.',
        `Brand Concept: ${cleanPrompt}.`,
        productLine,
        referenceLine,
        colorLine,
        copyLine || `Include clean ${language} section labels, logo lockup, color swatch cards with hex tags, typography specimen, hero splash packaging mockup, and social media post previews arranged in a crisp editorial grid.`,
        'Behance-quality graphic design presentation board, clean white/neutral presentation canvas, sharp layout precision.',
        negLine,
      ]
        .filter(Boolean)
        .join(' ');

    case 'studio-scene':
    default:
      return [
        'Commercial advertisement product photography studio backdrop, ultra high resolution 8k, master composition.',
        `Style and scenery: ${cleanPrompt}.`,
        productLine || 'Clean podium, pedestal, or open surface with atmospheric studio lighting and depth of field bokeh.',
        referenceLine,
        colorLine,
        'Leave clean breathing space for external overlay typography. ZERO baked text, ZERO random watermarks, ZERO unwanted logos.',
        negLine,
      ]
        .filter(Boolean)
        .join(' ');
  }
}

export function mapAnalyzeResponseToCopyOptions(rawData: any): NormalizedAnalyzeOutput {
  if (!rawData || typeof rawData !== 'object') {
    return { colorPalette: [], options: [] };
  }

  const productName =
    typeof rawData.productTitle === 'string'
      ? rawData.productTitle
      : typeof rawData.productName === 'string'
      ? rawData.productName
      : undefined;

  const category = typeof rawData.category === 'string' ? rawData.category : undefined;

  const colorPalette = Array.isArray(rawData.colorPalette)
    ? rawData.colorPalette.filter((c: unknown): c is string => typeof c === 'string').slice(0, 6)
    : [];

  const recommendedScenePrompt =
    typeof rawData.recommendedAiPrompt === 'string'
      ? rawData.recommendedAiPrompt
      : typeof rawData.recommendedScenePrompt === 'string'
      ? rawData.recommendedScenePrompt
      : undefined;

  const badgeLabels: string[] = Array.isArray(rawData.featureBadges)
    ? rawData.featureBadges
        .map((b: any) => (typeof b === 'string' ? b : b?.label))
        .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 4)
    : Array.isArray(rawData.badges)
    ? rawData.badges.filter((s: unknown): s is string => typeof s === 'string').slice(0, 4)
    : [];

  const options: NormalizedCopyOption[] = [];

  if (Array.isArray(rawData.marketingHeadlines) && rawData.marketingHeadlines.length > 0) {
    for (const h of rawData.marketingHeadlines.slice(0, 3)) {
      options.push({
        kicker: h?.eyebrow || h?.kicker || category || 'ÖNE ÇIKAN',
        headline: h?.title || h?.headline || productName || 'YENİ SERİ',
        subheading: h?.subtitle || h?.subheading || '',
        cta: h?.cta || 'Hemen İncele',
        badges: badgeLabels,
      });
    }
  } else if (rawData.headline || rawData.title) {
    options.push({
      kicker: rawData.kicker || rawData.eyebrow || '',
      headline: rawData.headline || rawData.title || '',
      subheading: rawData.subheading || rawData.subtitle || '',
      cta: rawData.cta || 'Hemen İncele',
      badges: badgeLabels,
    });
  }

  return {
    productName,
    category,
    colorPalette,
    recommendedScenePrompt,
    options,
  };
}

export function applyModeLayerVisibility(
  layers: CanvasLayer[],
  mode: AiCreativeMode,
  keepEditableOverlays = false
): CanvasLayer[] {
  const hideOverlays =
    !keepEditableOverlays &&
    (mode === 'full-poster' ||
      mode === 'promo-flyer' ||
      mode === 'collage-story' ||
      mode === 'brand-board');

  return layers.map((layer) => {
    if (hideOverlays) {
      if (
        layer.type === 'product' ||
        layer.type === 'typography' ||
        layer.type === 'badges' ||
        layer.type === 'promoBadge' ||
        layer.type === 'floating'
      ) {
        return { ...layer, visible: false };
      }
      return layer;
    }

    // In studio-scene mode, restore core layers cleanly
    if (mode === 'studio-scene') {
      if (layer.type === 'product' || layer.type === 'typography') {
        return { ...layer, visible: true };
      }
    }
    return layer;
  });
}
