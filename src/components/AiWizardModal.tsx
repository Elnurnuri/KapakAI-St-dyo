import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Type,
  Check,
  RefreshCw,
  ArrowRight,
  Upload,
  Layers,
  Download,
  Sticker,
  Palette,
} from 'lucide-react';
import {
  AiCreativeMode,
  AspectRatio,
  FeatureBadge,
  PromoBadge,
  StudioBackground,
  StudioTypography,
} from '../types';
import {
  removeBackgroundClient,
  sourceToBase64,
} from '../utils/backgroundRemoval';
import {
  AI_CREATIVE_MODES,
  AI_STYLE_PRESETS,
  AiStylePreset,
  mapAnalyzeResponseToCopyOptions,
  NormalizedCopyOption,
} from '../utils/aiCreative';

interface AiWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCutoutUrl: string;
  originalProductUrl?: string;
  currentAspectRatio: AspectRatio;
  onApplyBackground: (bg: StudioBackground) => void;
  onApplyAiDesign?: (payload: {
    imageUrl: string;
    mode: AiCreativeMode;
    keepEditableOverlays: boolean;
    fitMode: 'cover' | 'contain';
  }) => void;
  onAddStickerElement?: (stickerDataUrl: string, label: string) => void;
  onApplyCopy: (
    typography: Partial<StudioTypography>,
    badges?: FeatureBadge[],
    promo?: Partial<PromoBadge>
  ) => void;
}

export const AiWizardModal: React.FC<AiWizardModalProps> = ({
  isOpen,
  onClose,
  productCutoutUrl,
  originalProductUrl,
  currentAspectRatio,
  onApplyBackground,
  onApplyAiDesign,
  onAddStickerElement,
  onApplyCopy,
}) => {
  const [activeTab, setActiveTab] = useState<'scene' | 'copy'>('scene');

  // AI Creative Studio States
  const [creativeMode, setCreativeMode] = useState<AiCreativeMode>('full-poster');
  const [showAllPresets, setShowAllPresets] = useState<boolean>(false);
  const [scenePrompt, setScenePrompt] = useState<string>(
    AI_STYLE_PRESETS[0].prompt
  );
  const [headlineText, setHeadlineText] = useState<string>(
    AI_STYLE_PRESETS[0].headlineText || ''
  );
  const [subtext, setSubtext] = useState<string>(
    AI_STYLE_PRESETS[0].subtext || ''
  );
  const [badgeText, setBadgeText] = useState<string>(
    AI_STYLE_PRESETS[0].badgeText || ''
  );
  const [brandColors, setBrandColors] = useState<string>(
    AI_STYLE_PRESETS[0].brandColors || ''
  );
  const [includeProduct, setIncludeProduct] = useState<boolean>(true);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const [keepEditableOverlays, setKeepEditableOverlays] = useState<boolean>(false);

  const [isGeneratingScene, setIsGeneratingScene] = useState<boolean>(false);
  const [isExtractingSticker, setIsExtractingSticker] = useState<boolean>(false);
  const [generatedSceneUrl, setGeneratedSceneUrl] = useState<string | null>(null);
  const [generatedMode, setGeneratedMode] = useState<AiCreativeMode>('full-poster');
  const [sceneError, setSceneError] = useState<string | null>(null);

  // AI Copy States
  const [productName, setProductName] = useState<string>('Premium Ürün');
  const [productVibe, setProductVibe] = useState<string>('Kozmetik & Lüks');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState<boolean>(false);
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState<boolean>(false);
  const [copyResults, setCopyResults] = useState<NormalizedCopyOption[]>([]);
  const [detectedPalette, setDetectedPalette] = useState<string[]>([]);
  const [copyError, setCopyError] = useState<string | null>(null);

  const activeModeMeta = useMemo(
    () => AI_CREATIVE_MODES.find((m) => m.id === creativeMode) || AI_CREATIVE_MODES[0],
    [creativeMode]
  );

  const visiblePresets = useMemo(() => {
    if (showAllPresets) return AI_STYLE_PRESETS;
    return AI_STYLE_PRESETS.filter((p) => p.mode === creativeMode);
  }, [creativeMode, showAllPresets]);

  if (!isOpen) return null;

  const handleSelectMode = (nextMode: AiCreativeMode) => {
    setCreativeMode(nextMode);
    const meta = AI_CREATIVE_MODES.find((m) => m.id === nextMode);
    if (meta) {
      setIncludeProduct(meta.defaultIncludeProduct && Boolean(originalProductUrl || productCutoutUrl));
    }
    const matchingPreset = AI_STYLE_PRESETS.find((p) => p.mode === nextMode);
    if (matchingPreset) {
      setScenePrompt(matchingPreset.prompt);
      setHeadlineText(matchingPreset.headlineText || '');
      setSubtext(matchingPreset.subtext || '');
      setBadgeText(matchingPreset.badgeText || '');
      setBrandColors(matchingPreset.brandColors || '');
    }
  };

  const handleApplyPreset = (preset: AiStylePreset) => {
    setCreativeMode(preset.mode);
    const meta = AI_CREATIVE_MODES.find((m) => m.id === preset.mode);
    if (meta) {
      setIncludeProduct(meta.defaultIncludeProduct && Boolean(originalProductUrl || productCutoutUrl));
    }
    setScenePrompt(preset.prompt);
    setHeadlineText(preset.headlineText || '');
    setSubtext(preset.subtext || '');
    setBadgeText(preset.badgeText || '');
    setBrandColors(preset.brandColors || '');
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReferencePreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerateScene = async () => {
    if (!scenePrompt.trim()) {
      setSceneError('Lütfen oluşturmak istediğiniz tasarım veya sahne tarifini girin.');
      return;
    }
    setIsGeneratingScene(true);
    setSceneError(null);

    try {
      let productBase64: string | undefined;
      const src = originalProductUrl || productCutoutUrl;
      if (includeProduct && src) {
        try {
          const converted = await sourceToBase64(src);
          productBase64 = converted.base64;
        } catch {
          productBase64 = undefined;
        }
      }

      const res = await fetch('/api/ai/generate-creative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: creativeMode,
          prompt: scenePrompt,
          aspectRatio: creativeMode === 'sticker-3d' ? '1:1' : currentAspectRatio,
          productBase64,
          referenceImageBase64: referencePreviewUrl || undefined,
          headlineText: activeModeMeta.supportsOverlayCopy ? headlineText : undefined,
          subtext: activeModeMeta.supportsOverlayCopy ? subtext : undefined,
          badgeText: activeModeMeta.supportsOverlayCopy ? badgeText : undefined,
          brandColors,
          language: 'Turkish',
        }),
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        setGeneratedSceneUrl(data.imageUrl);
        setGeneratedMode(creativeMode);
      } else {
        setSceneError(data.error || 'Görsel üretilemedi.');
      }
    } catch (e: unknown) {
      setSceneError(e instanceof Error ? e.message : 'Bağlantı hatası oluştu.');
    } finally {
      setIsGeneratingScene(false);
    }
  };

  const handleApplyGeneratedToCanvas = (forceOverlaysVisible?: boolean) => {
    if (!generatedSceneUrl) return;
    const meta = AI_CREATIVE_MODES.find((m) => m.id === generatedMode) || AI_CREATIVE_MODES[0];
    const keepOverlays =
      forceOverlaysVisible !== undefined
        ? forceOverlaysVisible
        : generatedMode === 'studio-scene' || keepEditableOverlays;

    if (onApplyAiDesign) {
      onApplyAiDesign({
        imageUrl: generatedSceneUrl,
        mode: generatedMode,
        keepEditableOverlays: keepOverlays,
        fitMode: meta.recommendedFitMode,
      });
    } else {
      onApplyBackground({
        type: 'image',
        imageUrl: generatedSceneUrl,
        blur: 0,
        brightness: 1,
        vignette: false,
        stageStyle: 'none',
        fitMode: meta.recommendedFitMode,
      });
    }
    onClose();
  };

  const handleAddAsTransparentSticker = async (downloadOnly = false) => {
    if (!generatedSceneUrl) return;
    setIsExtractingSticker(true);
    setSceneError(null);
    try {
      const cleaned = await removeBackgroundClient(generatedSceneUrl, {
        tolerance: 30,
        feather: 1.5,
        mode: 'smart-flood',
      });

      if (downloadOnly) {
        const link = document.createElement('a');
        link.download = `kapakai-3d-sticker-${Date.now()}.png`;
        link.href = cleaned.cutoutDataUrl;
        link.click();
      } else if (onAddStickerElement) {
        onAddStickerElement(
          cleaned.cutoutDataUrl,
          headlineText.trim() || '3D AI Sticker'
        );
        onClose();
      }
    } catch (e: unknown) {
      setSceneError(e instanceof Error ? e.message : 'Sticker şeffaflaştırılamadı.');
    } finally {
      setIsExtractingSticker(false);
    }
  };

  const handleDownloadGenerated = () => {
    if (!generatedSceneUrl) return;
    const link = document.createElement('a');
    link.download = `kapakai-ai-${generatedMode}-${Date.now()}.png`;
    link.href = generatedSceneUrl;
    link.click();
  };

  const handleAnalyzeProductForCopy = async () => {
    const src = originalProductUrl || productCutoutUrl;
    if (!src) return;
    setIsAnalyzingProduct(true);
    setCopyError(null);
    try {
      const { base64 } = await sourceToBase64(src);
      const res = await fetch('/api/ai/analyze-and-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, language: 'tr' }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const normalized = mapAnalyzeResponseToCopyOptions(data.data);
        if (normalized.productName) setProductName(normalized.productName);
        if (normalized.recommendedScenePrompt) {
          setScenePrompt(normalized.recommendedScenePrompt);
        }
        setDetectedPalette(normalized.colorPalette);
        if (normalized.options.length > 0) {
          setCopyResults(normalized.options);
        } else {
          setCopyError('Analiz tamamlandı ancak slogan seçeneği döndürülemedi.');
        }
      } else {
        setCopyError(data.error || 'Ürün analiz edilemedi');
      }
    } catch (e: unknown) {
      setCopyError(e instanceof Error ? e.message : 'Analiz bağlantı hatası');
    } finally {
      setIsAnalyzingProduct(false);
    }
  };

  const handleGenerateCopy = async () => {
    if (!productName.trim()) {
      setCopyError('Lütfen ürün adı veya türünü girin.');
      return;
    }
    setIsGeneratingCopy(true);
    setCopyError(null);
    try {
      const res = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          vibe: productVibe,
          language: 'tr',
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.options)) {
        setCopyResults(data.options);
      } else {
        setCopyError(data.error || 'Slogan üretilemedi');
      }
    } catch (e: unknown) {
      setCopyError(e instanceof Error ? e.message : 'Bağlantı hatası');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const applyCopyOption = (item: NormalizedCopyOption) => {
    const badges: FeatureBadge[] = (item.badges || []).map((b: string, i: number) => ({
      id: `ai-b-${Date.now()}-${i}`,
      icon: i === 0 ? 'shield' : i === 1 ? 'sparkles' : 'zap',
      label: b,
    }));

    const fullHeadline = (item.headline || '').trim();
    const words = fullHeadline.split(/\s+/);
    const mainHeadline = words.length > 2 ? words.slice(0, -1).join(' ') : fullHeadline;
    const highlight =
      item.headlineHighlight ?? (words.length > 2 ? words[words.length - 1] : '');

    onApplyCopy(
      {
        kicker: item.kicker || '',
        headline: mainHeadline,
        headlineHighlight: highlight,
        subtitle: item.subheading || '',
        ctaText: item.cta || 'Şimdi İncele',
        showCta: true,
      },
      badges.length > 0 ? badges : undefined
    );
    onClose();
  };

  const productPreviewSrc = productCutoutUrl || originalProductUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Yapay Zeka Afiş ve Sahne Stüdyosu"
      className="fixed inset-0 z-[100] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50 via-purple-50 to-pink-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-orange-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Wand2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Yapay Zeka Afiş & Sahne Stüdyosu
              </h2>
              <p className="text-xs text-slate-600">
                Tam AI reklam afişi, 3D kampanya görseli, şeffaf 3D sticker veya marka kimliği panosu üretin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="AI Stüdyoyu Kapat"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-5 sm:px-6 pt-3 border-b border-slate-100 flex items-center gap-5 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('scene')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'scene'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>AI Afiş, Sticker & Sahne Üret</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('copy')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'copy'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>AI Slogan & Görsel Analiz</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'scene' ? (
            <div className="flex flex-col gap-4">
              {/* Step 1: Creative Mode Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    1. AI Üretim Türü Seçin
                  </span>
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                    {activeModeMeta.shortLabel}
                  </span>
                </div>
                <div
                  role="group"
                  aria-label="AI Üretim Türleri"
                  className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                >
                  {AI_CREATIVE_MODES.map((m) => {
                    const selected = creativeMode === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleSelectMode(m.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20'
                            : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-extrabold ${
                              selected ? 'text-orange-700' : 'text-slate-800'
                            }`}
                          >
                            {m.label}
                          </span>
                          {selected && <Check className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                          {m.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Reference Style Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    2. Hazır AI Stil Reçeteleri ({visiblePresets.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllPresets((prev) => !prev)}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700"
                  >
                    {showAllPresets
                      ? `Sadece "${activeModeMeta.shortLabel}" Stillerini Göster`
                      : `Tüm 12 AI Stilini Göster`}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {visiblePresets.map((preset) => {
                    const active = scenePrompt === preset.prompt;
                    return (
                      <button
                        type="button"
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                          active
                            ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-400/40'
                            : 'border-slate-200 hover:border-orange-400 bg-slate-50/40 hover:bg-orange-50/30'
                        }`}
                      >
                        <div
                          style={{ background: preset.accentGradient }}
                          className="w-8 h-8 rounded-lg flex-shrink-0 mt-0.5 shadow-xs border border-white/60"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded">
                              {preset.tag}
                            </span>
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {preset.title}
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {preset.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Prompt + Copy Fields + Product/Reference Inputs */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                <div className="lg:col-span-8 space-y-3">
                  <div>
                    <label
                      htmlFor="ai-creative-prompt"
                      className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      3. Tasarım & Sahne Tarifi (Prompt)
                    </label>
                    <textarea
                      id="ai-creative-prompt"
                      rows={2}
                      value={scenePrompt}
                      onChange={(e) => setScenePrompt(e.target.value)}
                      placeholder="Örn: Islak nehir taşı üzerinde güneş kremi, su sıçramaları, cam özellik kartı ve ferah yaz ışığı..."
                      className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-slate-300 bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none"
                    />
                  </div>

                  {activeModeMeta.supportsOverlayCopy && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="ai-headline-input"
                          className="block text-[11px] font-bold text-slate-600 mb-1"
                        >
                          {creativeMode === 'sticker-3d'
                            ? '3D Sticker Yazısı'
                            : 'Afiş Ana Başlığı (Opsiyonel)'}
                        </label>
                        <input
                          id="ai-headline-input"
                          type="text"
                          value={headlineText}
                          onChange={(e) => setHeadlineText(e.target.value)}
                          placeholder="Örn: ESKİYİ YENİLE veya YENİ SERİ"
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="ai-badge-input"
                          className="block text-[11px] font-bold text-slate-600 mb-1"
                        >
                          Fırsat / CTA Rozeti (Opsiyonel)
                        </label>
                        <input
                          id="ai-badge-input"
                          type="text"
                          value={badgeText}
                          onChange={(e) => setBadgeText(e.target.value)}
                          placeholder="Örn: 2+1, %50 İNDİRİM, HEMEN AL"
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="ai-subtext-input"
                          className="block text-[11px] font-bold text-slate-600 mb-1"
                        >
                          Alt Metin / Özellik İkonları (Opsiyonel)
                        </label>
                        <input
                          id="ai-subtext-input"
                          type="text"
                          value={subtext}
                          onChange={(e) => setSubtext(e.target.value)}
                          placeholder="Örn: SPF 50+ • Suya Dayanıklı • Hafif Doku"
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="ai-colors-input"
                          className="block text-[11px] font-bold text-slate-600 mb-1"
                        >
                          Renk Paleti / Atmosfer (Opsiyonel)
                        </label>
                        <input
                          id="ai-colors-input"
                          type="text"
                          value={brandColors}
                          onChange={(e) => setBrandColors(e.target.value)}
                          placeholder="Örn: Turkuaz, altın ve sıcak krem"
                          className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-orange-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Product & Reference Attachments */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  {/* Product Inclusion */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-800">
                        Mevcut Ürünümü Dahil Et
                      </span>
                      <input
                        type="checkbox"
                        aria-label="Mevcut Ürünümü Dahil Et"
                        checked={includeProduct}
                        disabled={!productPreviewSrc}
                        onChange={(e) => setIncludeProduct(e.target.checked)}
                        className="w-4 h-4 accent-orange-600 cursor-pointer"
                      />
                    </div>
                    {productPreviewSrc ? (
                      <div className="flex items-center gap-2.5">
                        <img
                          src={productPreviewSrc}
                          alt="Seçili Ürün"
                          className="w-11 h-11 rounded-lg object-contain bg-slate-100 border border-slate-200 p-1"
                        />
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Açık olduğunda AI tasarımın içine gerçek ürününüzü yerleştirir.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">
                        Henüz ürün fotoğrafı yüklenmemiş; AI konsepti sıfırdan çizer.
                      </p>
                    )}
                  </div>

                  {/* Style Reference Upload */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">
                        Stil Referans Görseli
                      </span>
                      {referencePreviewUrl && (
                        <button
                          type="button"
                          onClick={() => setReferencePreviewUrl(null)}
                          className="text-[10px] font-bold text-rose-600 hover:underline"
                        >
                          Kaldır
                        </button>
                      )}
                    </div>
                    {referencePreviewUrl ? (
                      <div className="flex items-center gap-2.5">
                        <img
                          src={referencePreviewUrl}
                          alt="Stil Referansı"
                          className="w-12 h-12 rounded-lg object-cover border border-purple-200"
                        />
                        <p className="text-[10px] text-purple-700 font-medium leading-tight">
                          Referans görselin kompozisyon ve ışık stili taklit edilecek.
                        </p>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-dashed border-slate-300 hover:border-purple-400 hover:bg-purple-50/40 text-[11px] font-semibold text-slate-600 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-purple-600" />
                        <span>Örnek Afiş / Referans Yükle</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReferenceUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {sceneError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {sceneError}
                </div>
              )}

              {/* Generated Result Preview & Actions */}
              {generatedSceneUrl && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col gap-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>AI Tasarım Hazır ({currentAspectRatio})</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadGenerated}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>İndir</span>
                      </button>

                      {generatedMode === 'sticker-3d' ? (
                        <>
                          <button
                            type="button"
                            disabled={isExtractingSticker}
                            onClick={() => handleAddAsTransparentSticker(true)}
                            className="px-3 py-1.5 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Şeffaf PNG İndir</span>
                          </button>
                          <button
                            type="button"
                            disabled={isExtractingSticker}
                            onClick={() => handleAddAsTransparentSticker(false)}
                            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-orange-600 hover:brightness-110 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-60"
                          >
                            {isExtractingSticker ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sticker className="w-3.5 h-3.5" />
                            )}
                            <span>Şeffaf Sticker Olarak Tuvale Ekle</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {generatedMode !== 'studio-scene' && (
                            <button
                              type="button"
                              onClick={() => handleApplyGeneratedToCanvas(true)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Üst Katmanları Koru</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleApplyGeneratedToCanvas()}
                            className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                          >
                            <span>
                              {generatedMode === 'studio-scene'
                                ? 'Stüdyo Sahnesi Yap'
                                : 'Tam AI Tasarım Olarak Uygula'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {generatedMode !== 'studio-scene' && generatedMode !== 'sticker-3d' && (
                    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepEditableOverlays}
                        onChange={(e) => setKeepEditableOverlays(e.target.checked)}
                        className="accent-orange-600"
                      />
                      <span>
                        Uygularken şablondaki mevcut yazı/rozet katmanlarını da açık bırak (kapalıyken Katmanlar sekmesinden geri açabilirsiniz)
                      </span>
                    </label>
                  )}

                  <div className="relative max-h-[340px] rounded-xl overflow-hidden border border-slate-300 bg-white flex items-center justify-center">
                    <img
                      src={generatedSceneUrl}
                      alt="Üretilen AI Tasarım"
                      className="max-h-[340px] w-auto object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Auto Analyze from Current Product */}
              {(originalProductUrl || productCutoutUrl) && (
                <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-700">
                    <p className="font-bold text-slate-900">Ürünü Görselden Tanı & Analiz Et</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Mevcut ürün fotoğrafını analiz edip renk paleti, reklam başlıkları ve AI sahne önerisi çıkarın.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyzeProductForCopy}
                    disabled={isAnalyzingProduct}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                  >
                    {isAnalyzingProduct ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Görselden Üret</span>
                  </button>
                </div>
              )}

              {detectedPalette.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Palette className="w-4 h-4 text-purple-600" />
                    <span>Önerilen Marka Paleti:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {detectedPalette.map((hex, i) => (
                      <div key={i} className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        <span
                          style={{ backgroundColor: hex }}
                          className="w-3.5 h-3.5 rounded-full border border-black/10"
                        />
                        <span className="text-[10px] font-mono text-slate-600">{hex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ürün Adı / Türü
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Örn: Parfüm, Güneş Kremi, Kahve, Kamera"
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Hedef Tarz / Ton
                  </label>
                  <select
                    value={productVibe}
                    onChange={(e) => setProductVibe(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all bg-white"
                  >
                    <option value="Kozmetik & Lüks">Lüks & Zarafet (Kozmetik/Parfüm)</option>
                    <option value="Aksiyon & Ekstrem Macera">Aksiyon & Macera (Doğa/Kamera)</option>
                    <option value="3D Eğlenceli & Pastel">Eğlenceli & 3D Renkli (İçecek/Atıştırmalık)</option>
                    <option value="Minimalist & Zanaat Butik">Minimalist & Zanaatkar (Kahve/Moda)</option>
                    <option value="E-Ticaret & İndirim Kampanyası">Kampanya & İndirim Patlaması</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateCopy}
                disabled={isGeneratingCopy}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {isGeneratingCopy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Reklam Sloganları Üretiliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>3 Farklı Reklam Başlığı & Sloganı Üret</span>
                  </>
                )}
              </button>

              {copyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {copyError}
                </div>
              )}

              {copyResults.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Önerilen Reklam Metinleri (Seçip Uygulayın)
                  </span>
                  <div className="flex flex-col gap-3">
                    {copyResults.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 hover:border-purple-400 bg-slate-50/50 hover:bg-purple-50/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1">
                          {item.kicker && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded">
                              {item.kicker}
                            </span>
                          )}
                          <h4 className="text-sm font-extrabold text-slate-900 mt-1">
                            {item.headline}
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {item.subheading}
                          </p>
                          {item.badges && item.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {item.badges.map((b: string, bIdx: number) => (
                                <span
                                  key={bIdx}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700"
                                >
                                  ✓ {b}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => applyCopyOption(item)}
                          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Tuvale Uygula</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer CTA for AI Image / Poster Generation */}
        {activeTab === 'scene' && (
          <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3 flex-shrink-0">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Oran:{' '}
              <strong className="text-slate-800">
                {creativeMode === 'sticker-3d' ? '1:1 (İzole)' : currentAspectRatio}
              </strong>
              {' • '}
              {includeProduct && productPreviewSrc ? 'Ürününüz dahil edilecek' : 'Ürünsüz konsept'}
            </span>
            <button
              type="button"
              onClick={handleGenerateScene}
              disabled={isGeneratingScene}
              className="flex-1 sm:flex-initial sm:min-w-[260px] py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-600 via-rose-600 to-purple-600 hover:brightness-110 text-white font-bold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {isGeneratingScene ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Yapay Zeka Tasarlıyor ({activeModeMeta.shortLabel})...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{activeModeMeta.label} Üret</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
