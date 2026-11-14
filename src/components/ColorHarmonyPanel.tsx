import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Check,
  RefreshCw,
  Eye,
  Undo2,
  Droplet,
} from 'lucide-react';
import {
  analyzeProductColorsFromImage,
  normalizeAiHarmonies,
  ColorHarmonyRecommendation,
  ProductColorProfile,
} from '../utils/colorHarmony';

export interface ApplyHarmonyScope {
  applyBackground: boolean;
  applyTypography: boolean;
  applyProductAccent: boolean;
}

interface ColorHarmonyPanelProps {
  productSrc: string;
  onApplyHarmony: (
    harmony: ColorHarmonyRecommendation,
    scope: ApplyHarmonyScope
  ) => void;
  onQuickColorPick?: (role: 'highlight' | 'cta', hex: string) => void;
  canUndo?: boolean;
  onUndo?: () => void;
}

export const ColorHarmonyPanel: React.FC<ColorHarmonyPanelProps> = ({
  productSrc,
  onApplyHarmony,
  onQuickColorPick,
  canUndo = false,
  onUndo,
}) => {
  const [profile, setProfile] = useState<ProductColorProfile | null>(null);
  const [baseHarmonies, setBaseHarmonies] = useState<ColorHarmonyRecommendation[]>([]);
  const [aiHarmonies, setAiHarmonies] = useState<ColorHarmonyRecommendation[]>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [compactPng, setCompactPng] = useState<string>('');
  const [isAnalyzingPixels, setIsAnalyzingPixels] = useState<boolean>(false);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [appliedHarmonyId, setAppliedHarmonyId] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Scope toggles
  const [applyBackground, setApplyBackground] = useState<boolean>(true);
  const [applyTypography, setApplyTypography] = useState<boolean>(true);
  const [applyProductAccent, setApplyProductAccent] = useState<boolean>(true);

  // Automatically extract product dominant colors & build 5 harmonies whenever productSrc changes
  useEffect(() => {
    if (!productSrc) {
      setProfile(null);
      setBaseHarmonies([]);
      setAiHarmonies([]);
      setAiInsight(null);
      return;
    }

    let cancelled = false;
    setIsAnalyzingPixels(true);
    setAiHarmonies([]);
    setAiInsight(null);
    setAiError(null);
    setAppliedHarmonyId(null);

    analyzeProductColorsFromImage(productSrc)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.profile);
        setBaseHarmonies(res.harmonies);
        setCompactPng(res.compactPngBase64);
      })
      .catch((err) => {
        console.error('Product color analysis error:', err);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzingPixels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productSrc]);

  const handleGenerateAiHarmonies = async () => {
    if (!compactPng) return;
    setIsLoadingAi(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/color-harmony', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compactPng,
          mimeType: 'image/png',
          extractedHexes: profile?.dominantColors.map((c) => c.hex) || [],
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const normalized = normalizeAiHarmonies(data.harmonies);
        if (normalized.length > 0) {
          setAiHarmonies(normalized);
          setAiInsight(data.aiInsight || null);
        } else {
          setAiError('Yapay zeka ek renk önerisi döndüremedi.');
        }
      } else {
        setAiError(data.error || 'AI renk analizi sırasında bir hata oluştu.');
      }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Bağlantı hatası oluştu.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleCopyHex = (hex: string) => {
    setCopiedHex(hex);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(hex).catch(() => {});
    }
    setTimeout(() => {
      setCopiedHex((cur) => (cur === hex ? null : cur));
    }, 1600);
  };

  const handleTriggerApply = (
    harmony: ColorHarmonyRecommendation,
    overrideScope?: ApplyHarmonyScope
  ) => {
    const scope = overrideScope ?? {
      applyBackground: applyBackground || (!applyTypography && !applyProductAccent),
      applyTypography,
      applyProductAccent,
    };
    setAppliedHarmonyId(harmony.id);
    onApplyHarmony(harmony, scope);
  };

  const allHarmonies = [...aiHarmonies, ...baseHarmonies];

  return (
    <div className="space-y-4" data-testid="color-harmony-panel">
      {/* Panel Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-orange-600" />
            <span>Ürün Renk Harmonisi</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ürününüzün renk tonlarına göre uyumlu arka plan ve okunabilir tipografi paletleri
          </p>
        </div>
        {canUndo && onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-colors flex-shrink-0"
          >
            <Undo2 className="w-3 h-3" />
            <span>Geri Al</span>
          </button>
        )}
      </div>

      {!productSrc ? (
        <div className="p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-1.5">
          <Droplet className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-700">Henüz Ürün Görseli Yok</p>
          <p className="text-[11px] text-slate-500">
            Renk tonlarını analiz etmek için üst menüden bir ürün fotoğrafı yükleyin.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Extracted Product Dominant Colors Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <img
                    src={productSrc}
                    alt="Analiz Edilen Ürün"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-slate-800 block truncate">
                    Tespit Edilen Ürün Tonları
                  </span>
                  {profile && (
                    <span className="text-[10px] font-bold text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      {profile.temperatureLabel} • Doygunluk %{profile.averageSaturation}
                    </span>
                  )}
                </div>
              </div>
              {isAnalyzingPixels && (
                <RefreshCw className="w-4 h-4 animate-spin text-orange-600 flex-shrink-0" />
              )}
            </div>

            {profile && (
              <>
                {/* Proportional Color Distribution Bar */}
                <div
                  data-testid="dominant-color-bar"
                  className="h-3.5 w-full rounded-full overflow-hidden flex border border-slate-200/80 shadow-inner"
                >
                  {profile.dominantColors.map((col) => (
                    <div
                      key={col.hex}
                      style={{
                        width: `${col.share}%`,
                        backgroundColor: col.hex,
                      }}
                      title={`${col.name} (${col.hex}) - %${col.share}`}
                    />
                  ))}
                </div>

                {/* Dominant Swatch Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {profile.dominantColors.map((col) => (
                    <button
                      type="button"
                      key={col.hex}
                      onClick={() => {
                        handleCopyHex(col.hex);
                        onQuickColorPick?.('highlight', col.hex);
                      }}
                      title={`${col.name} (${col.hex}) — Tıklayarak vurgu rengi yap & kopyala`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-orange-400 text-left transition-all shadow-2xs"
                    >
                      <span
                        style={{ backgroundColor: col.hex }}
                        className="w-3.5 h-3.5 rounded-full border border-black/15 flex-shrink-0"
                      />
                      <span className="text-[10px] font-bold text-slate-700">
                        {copiedHex === col.hex ? 'Kopyalandı!' : col.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        %{col.share}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Mood / AI Insight Summary */}
                <p className="text-[11px] text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
                  {aiInsight || profile.moodSummary}
                </p>
              </>
            )}

            {/* Gemini AI Deep Color Advisor Trigger */}
            <button
              type="button"
              onClick={handleGenerateAiHarmonies}
              disabled={isLoadingAi || isAnalyzingPixels || !compactPng}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
            >
              {isLoadingAi ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>AI Özel Renk Uyumu Analiz Ediyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {aiHarmonies.length > 0
                      ? 'AI Sanat Yönetmeni Paletlerini Yenile'
                      : 'AI ile Özel Kategori & Atmosfer Paleti Üret'}
                  </span>
                </>
              )}
            </button>

            {aiError && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-medium">
                {aiError}
              </p>
            )}
          </div>

          {/* 2. Application Scope Controls */}
          <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-200/70 space-y-2">
            <span className="text-[11px] font-extrabold text-slate-700 block">
              Uygulama Kapsamı
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  id: 'bg',
                  label: 'Arka Plan',
                  active: applyBackground,
                  toggle: () => setApplyBackground((v) => !v),
                },
                {
                  id: 'typo',
                  label: 'Tipografi',
                  active: applyTypography,
                  toggle: () => setApplyTypography((v) => !v),
                },
                {
                  id: 'accent',
                  label: 'Işık & Rozet',
                  active: applyProductAccent,
                  toggle: () => setApplyProductAccent((v) => !v),
                },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={item.active}
                  onClick={item.toggle}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition-all ${
                    item.active
                      ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.active && <Check className="w-2.5 h-2.5" />}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Recommended Harmony Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Önerilen Paletler ({allHarmonies.length})
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>WCAG Okunabilirlik Onaylı</span>
              </span>
            </div>

            {allHarmonies.map((harmony) => {
              const isApplied = appliedHarmonyId === harmony.id;
              const isAi = harmony.harmonyType === 'ai-bespoke';

              return (
                <div
                  key={harmony.id}
                  data-testid={`harmony-card-${harmony.harmonyType}`}
                  className={`rounded-2xl border overflow-hidden transition-all bg-white ${
                    isApplied
                      ? 'border-orange-500 ring-2 ring-orange-500/25 shadow-md'
                      : isAi
                      ? 'border-purple-300 hover:border-purple-400 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Live Mini Canvas Preview */}
                  <div
                    style={{ background: harmony.background.gradient }}
                    className="p-3.5 relative overflow-hidden flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 z-10 min-w-0">
                      <span
                        style={{ color: harmony.typography.highlightColor }}
                        className="text-[9px] font-black uppercase tracking-widest block"
                      >
                        {harmony.badge}
                      </span>
                      <p
                        style={{ color: harmony.typography.headlineColor }}
                        className="text-sm font-black tracking-tight leading-tight truncate"
                      >
                        {harmony.title}
                      </p>
                      <p
                        style={{ color: harmony.typography.subtitleColor }}
                        className="text-[10px] font-medium opacity-95 truncate"
                      >
                        Örnek alt başlık ve kontrast görünümü
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 z-10 flex-shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-black/35 text-white text-[9px] font-mono font-bold backdrop-blur-xs">
                        {harmony.contrastScore}:1 {harmony.contrastScore >= 7 ? 'AAA' : 'AA'}
                      </span>
                      <span
                        style={{
                          backgroundColor: harmony.typography.ctaBgColor,
                          color: harmony.typography.ctaTextColor,
                        }}
                        className="px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider shadow-sm"
                      >
                        KEŞFET
                      </span>
                    </div>
                  </div>

                  {/* Card Details & Swatches */}
                  <div className="p-3 space-y-2.5">
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {harmony.description}
                    </p>

                    {/* 5-Role Color Swatch Row */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { label: 'Zemin 1', hex: harmony.background.primaryBgHex },
                        { label: 'Zemin 2', hex: harmony.background.secondaryBgHex },
                        { label: 'Başlık', hex: harmony.typography.headlineColor },
                        { label: 'Vurgu', hex: harmony.typography.highlightColor },
                        { label: 'Buton', hex: harmony.typography.ctaBgColor },
                      ].map((sw) => (
                        <button
                          type="button"
                          key={`${harmony.id}-${sw.label}`}
                          onClick={() => handleCopyHex(sw.hex)}
                          title={`${sw.label}: ${sw.hex} (Kopyala)`}
                          className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors"
                        >
                          <span
                            style={{ backgroundColor: sw.hex }}
                            className="w-full h-4 rounded border border-black/15"
                          />
                          <span className="text-[9px] font-bold text-slate-600 leading-none">
                            {copiedHex === sw.hex ? 'Kopya' : sw.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Apply Actions */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleTriggerApply(harmony)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isApplied
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-900 hover:bg-orange-600 text-white shadow-xs'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Uygulandı</span>
                          </>
                        ) : (
                          <>
                            <Palette className="w-3.5 h-3.5" />
                            <span>Harmoniyi Uygula</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleTriggerApply(harmony, {
                            applyBackground: true,
                            applyTypography: false,
                            applyProductAccent: false,
                          })
                        }
                        title="Sadece arka plan renk geçişini uygula"
                        className="py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-700 transition-colors"
                      >
                        Sadece Fon
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleTriggerApply(harmony, {
                            applyBackground: false,
                            applyTypography: true,
                            applyProductAccent: false,
                          })
                        }
                        title="Sadece yazı ve buton renklerini uygula"
                        className="py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-700 transition-colors"
                      >
                        Sadece Yazı
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
