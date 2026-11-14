import React, { useState, useEffect, useRef } from 'react';
import {
  Wand2,
  Sun,
  Contrast,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Eye,
  SlidersHorizontal,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  BrandWatermark,
  EditableAreaId,
  HistoryItem,
  ProductPlacement,
  SmartFixPresetId,
  StudioBackground,
  StudioPatch,
} from '../types';
import { getAreaMeta, mapActiveElementToArea, StudioEditableState } from '../utils/aiPatch';
import {
  computeSmartAutoFixPlan,
  DEFAULT_IMAGE_OPTICS,
  ImageOpticsMetrics,
  measureProductOpticsFromSrc,
  normalizeAiSmartFixResponse,
  SMART_FIX_PRESETS,
  SmartAutoFixPlan,
} from '../utils/smartAutoFix';
import { wcagContrastRatio } from '../utils/colorHarmony';
import { renderHighResCover } from '../utils/exportCanvas';

interface SmartAutoFixPanelProps {
  studioState: StudioEditableState;
  activeElement: string | null;
  brandWatermark?: BrandWatermark;
  onApplyAutoFixPatch: (
    patch: StudioPatch,
    targetArea: EditableAreaId,
    toastLabel: string
  ) => void;
  onUpdateProduct: (updater: (prev: ProductPlacement) => ProductPlacement) => void;
  onUpdateBackground: (updater: (prev: StudioBackground) => StudioBackground) => void;
  onCommitHistory: () => void;
  canUndo: boolean;
  onUndo: () => void;
  currentSnapshot: HistoryItem;
  isComparingBefore: boolean;
  onToggleCompareBefore: (snapshot: HistoryItem | null) => void;
}

const SELECTABLE_AREAS: Array<{ id: Exclude<EditableAreaId, 'all'>; label: string }> = [
  { id: 'product', label: 'Ürün' },
  { id: 'background', label: 'Arka Plan' },
  { id: 'text', label: 'Metin & CTA' },
  { id: 'badges', label: 'Rozetler' },
  { id: 'promo', label: 'Kampanya' },
];

export const SmartAutoFixPanel: React.FC<SmartAutoFixPanelProps> = ({
  studioState,
  activeElement,
  brandWatermark,
  onApplyAutoFixPatch,
  onUpdateProduct,
  onUpdateBackground,
  onCommitHistory,
  canUndo,
  onUndo,
  currentSnapshot,
  isComparingBefore,
  onToggleCompareBefore,
}) => {
  const mappedCanvasArea = mapActiveElementToArea(activeElement);

  const [scopeMode, setScopeMode] = useState<'all' | 'selected'>(() =>
    mappedCanvasArea !== 'all' ? 'selected' : 'all'
  );
  const [selectedArea, setSelectedArea] = useState<Exclude<EditableAreaId, 'all'>>(() =>
    mappedCanvasArea !== 'all' ? mappedCanvasArea : 'product'
  );
  const [presetId, setPresetId] = useState<SmartFixPresetId>('marketplace-pro');
  const [optics, setOptics] = useState<ImageOpticsMetrics>(DEFAULT_IMAGE_OPTICS);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [aiStatusNotice, setAiStatusNotice] = useState<string | null>(null);
  const [lastPlan, setLastPlan] = useState<SmartAutoFixPlan | null>(null);
  const [beforeSnapshot, setBeforeSnapshot] = useState<HistoryItem | null>(null);

  // Keep selected area synced when user clicks a specific layer on the canvas
  useEffect(() => {
    const nextArea = mapActiveElementToArea(activeElement);
    if (nextArea !== 'all') {
      setSelectedArea(nextArea);
    }
  }, [activeElement]);

  // Measure real pixel luminance, contrast, and edge sharpness whenever product image changes
  useEffect(() => {
    let cancelled = false;
    if (!studioState.product.src) {
      setOptics(DEFAULT_IMAGE_OPTICS);
      return;
    }
    measureProductOpticsFromSrc(studioState.product.src).then((measured) => {
      if (!cancelled) {
        setOptics(measured);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studioState.product.src]);

  // Clear comparison mode on unmount
  useEffect(() => {
    return () => {
      onToggleCompareBefore(null);
    };
  }, [onToggleCompareBefore]);

  const effectiveScope: EditableAreaId = scopeMode === 'all' ? 'all' : selectedArea;
  const scopeLabel =
    effectiveScope === 'all' ? 'Tüm Tuval' : getAreaMeta(effectiveScope).shortLabel;

  const ctaContrast = wcagContrastRatio(
    studioState.typography.ctaTextColor || '#ffffff',
    studioState.typography.ctaBgColor || '#c2410c'
  );

  const handleInstantStudioFix = () => {
    onToggleCompareBefore(null);
    setAiStatusNotice(null);
    const savedBefore: HistoryItem = {
      ...currentSnapshot,
      placement: { ...currentSnapshot.placement },
      background: { ...currentSnapshot.background },
      typography: { ...currentSnapshot.typography },
      badges: currentSnapshot.badges.map((b) => ({ ...b })),
      badgesPosition: currentSnapshot.badgesPosition
        ? { ...currentSnapshot.badgesPosition }
        : undefined,
      promoBadge: { ...currentSnapshot.promoBadge },
      floatingElements: currentSnapshot.floatingElements.map((f) => ({ ...f })),
    };

    const plan = computeSmartAutoFixPlan(studioState, optics, effectiveScope, presetId);
    setBeforeSnapshot(savedBefore);
    setLastPlan(plan);
    onApplyAutoFixPatch(
      plan.patch,
      effectiveScope,
      `${scopeLabel} e-ticaret standardına optimize edildi`
    );
  };

  const handleAiSmartAutoFix = async () => {
    onToggleCompareBefore(null);
    setIsAnalyzingAi(true);
    setAiStatusNotice(null);

    const savedBefore: HistoryItem = {
      ...currentSnapshot,
      placement: { ...currentSnapshot.placement },
      background: { ...currentSnapshot.background },
      typography: { ...currentSnapshot.typography },
      badges: currentSnapshot.badges.map((b) => ({ ...b })),
      badgesPosition: currentSnapshot.badgesPosition
        ? { ...currentSnapshot.badgesPosition }
        : undefined,
      promoBadge: { ...currentSnapshot.promoBadge },
      floatingElements: currentSnapshot.floatingElements.map((f) => ({ ...f })),
    };

    try {
      let compositeImageBase64 = '';
      try {
        const previewCanvas = await renderHighResCover({
          aspectRatio: studioState.aspectRatio,
          background: studioState.background,
          product: studioState.product,
          typography: studioState.typography,
          badges: studioState.badges,
          badgesPosition: studioState.badgesPosition,
          promoBadge: studioState.promoBadge,
          floatingElements: studioState.floatingElements,
          layers: studioState.layers,
          brandWatermark,
          scaleMultiplier: 0.5,
        });
        compositeImageBase64 = previewCanvas.toDataURL('image/jpeg', 0.84);
      } catch {
        compositeImageBase64 = studioState.product.src || '';
      }

      const compactState = {
        aspectRatio: studioState.aspectRatio,
        background: {
          type: studioState.background.type,
          blur: studioState.background.blur,
          brightness: studioState.background.brightness,
          contrast: studioState.background.contrast ?? 1,
          vignette: studioState.background.vignette,
        },
        product: {
          x: studioState.product.x,
          y: studioState.product.y,
          scale: studioState.product.scale,
          brightness: studioState.product.brightness,
          contrast: studioState.product.contrast,
          saturation: studioState.product.saturation,
          clarity: studioState.product.clarity ?? 0,
          shadowOpacity: studioState.product.shadowOpacity,
          ambientGlow: studioState.product.ambientGlow,
        },
        typography: {
          headlineColor: studioState.typography.headlineColor,
          highlightColor: studioState.typography.highlightColor,
          subtitleColor: studioState.typography.subtitleColor,
          ctaBgColor: studioState.typography.ctaBgColor,
          ctaTextColor: studioState.typography.ctaTextColor,
          alignment: studioState.typography.alignment,
          positionX: studioState.typography.positionX,
          positionY: studioState.typography.positionY,
        },
      };

      const res = await fetch('/api/ai/smart-auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositeImageBase64,
          mimeType: 'image/jpeg',
          targetArea: effectiveScope,
          presetId,
          optics,
          currentState: compactState,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        const fallbackPlan = computeSmartAutoFixPlan(
          studioState,
          optics,
          effectiveScope,
          presetId
        );
        setBeforeSnapshot(savedBefore);
        setLastPlan(fallbackPlan);
        setAiStatusNotice(
          json?.error ||
            'Canlı AI servisine ulaşılamadı; stüdyo optik motoruyla kalibrasyon uygulandı.'
        );
        onApplyAutoFixPatch(
          fallbackPlan.patch,
          effectiveScope,
          `${scopeLabel} otomatik optimize edildi`
        );
        return;
      }

      const aiPlan = normalizeAiSmartFixResponse(
        json.data,
        studioState,
        optics,
        effectiveScope,
        presetId
      );
      setBeforeSnapshot(savedBefore);
      setLastPlan(aiPlan);
      onApplyAutoFixPatch(
        aiPlan.patch,
        effectiveScope,
        `AI otomatik optimizasyon (${scopeLabel}) uygulandı`
      );
    } catch {
      const fallbackPlan = computeSmartAutoFixPlan(
        studioState,
        optics,
        effectiveScope,
        presetId
      );
      setBeforeSnapshot(savedBefore);
      setLastPlan(fallbackPlan);
      setAiStatusNotice('Ağ gecikmesi nedeniyle stüdyo optik kalibrasyonu devreye alındı.');
      onApplyAutoFixPatch(
        fallbackPlan.patch,
        effectiveScope,
        `${scopeLabel} otomatik optimize edildi`
      );
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleResetOptics = () => {
    onToggleCompareBefore(null);
    onCommitHistory();
    onUpdateProduct((prev) => ({
      ...prev,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      clarity: 0,
    }));
    onUpdateBackground((prev) => ({
      ...prev,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blur: 0,
    }));
    setLastPlan(null);
  };

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastPlan && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [lastPlan]);

  const effectiveLuminance = Math.min(
    0.99,
    Math.max(0.05, optics.meanLuminance * studioState.product.brightness)
  );
  const effectiveDynamicRange = Math.min(
    0.99,
    Math.max(0.08, optics.dynamicRange * Math.pow(studioState.product.contrast, 1.35))
  );
  const effectiveClarity = Math.min(
    0.99,
    Math.max(
      optics.edgeAcutance,
      optics.edgeAcutance * 0.55 + (studioState.product.clarity ?? 0) * 0.65
    )
  );

  const exposureLabel =
    effectiveLuminance < 0.42
      ? 'Düşük Pozlama'
      : effectiveLuminance > 0.78
      ? 'Yüksek Parlaklık'
      : 'Dengeli Işık';

  const contrastLabel =
    effectiveDynamicRange < 0.36
      ? 'Düşük Kontrast'
      : effectiveDynamicRange > 0.84
      ? 'Sert Kontrast'
      : 'Dengeli Ton';

  const clarityLabel =
    effectiveClarity >= 0.42 || (studioState.product.clarity ?? 0) >= 0.22
      ? 'Yüksek Netlik'
      : 'Yumuşak Doku';

  return (
    <div data-testid="smart-autofix-panel" className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-orange-600 shrink-0" />
            <span>Otomatik Optimizasyon</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Aydınlatma dengesi, dinamik kontrast, görsel netlik ve e-ticaret hizası
          </p>
        </div>
        {canUndo && (
          <button
            type="button"
            onClick={() => {
              onToggleCompareBefore(null);
              onUndo();
            }}
            className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Geri Al</span>
          </button>
        )}
      </div>

      {/* Scope Selector: Entire Canvas vs Selected Area */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">Optimizasyon Kapsamı</span>
          <span className="text-slate-500">Hedef: {scopeLabel}</span>
        </div>

        <div
          role="group"
          aria-label="Optimizasyon Kapsamı"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            onClick={() => setScopeMode('all')}
            className={`py-1.5 px-3 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
              scopeMode === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tüm Tuval
          </button>
          <button
            type="button"
            onClick={() => setScopeMode('selected')}
            className={`py-1.5 px-3 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
              scopeMode === 'selected'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Seçili Alan ({getAreaMeta(selectedArea).shortLabel})
          </button>
        </div>

        {scopeMode === 'selected' && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {SELECTABLE_AREAS.map((area) => {
              const isSelected = selectedArea === area.id;
              return (
                <button
                  type="button"
                  key={area.id}
                  onClick={() => setSelectedArea(area.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {area.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* E-Commerce Mastering Profile Selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5">
        <span className="block text-xs font-bold text-slate-800">
          E-Ticaret Görsel Standardı
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {SMART_FIX_PRESETS.map((preset) => {
            const active = presetId === preset.id;
            return (
              <button
                type="button"
                key={preset.id}
                onClick={() => setPresetId(preset.id)}
                className={`text-left p-2.5 rounded-lg border transition-colors ${
                  active
                    ? 'border-orange-500 bg-orange-50/60 text-slate-900'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold leading-snug whitespace-nowrap truncate">
                  {preset.label}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                  {preset.shortDesc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Measured Optical Diagnostics */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">Canlı Optik Ölçüm</span>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            {studioState.aspectRatio}
          </span>
        </div>

        <div className="px-3.5 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-600">Aydınlatma Dengesi</span>
          <span className="font-mono tabular-nums text-slate-900 font-semibold">
            %{Math.round(effectiveLuminance * 100)} · {exposureLabel}
          </span>
        </div>

        <div className="px-3.5 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-600">Kontrast Dinamiği</span>
          <span className="font-mono tabular-nums text-slate-900 font-semibold">
            Δ %{Math.round(effectiveDynamicRange * 100)} · {contrastLabel}
          </span>
        </div>

        <div className="px-3.5 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-600">Görsel Netlik</span>
          <span className="font-mono tabular-nums text-slate-900 font-semibold">
            %{Math.round(effectiveClarity * 100)} · {clarityLabel}
          </span>
        </div>

        <div className="px-3.5 py-2 flex items-center justify-between text-xs">
          <span className="text-slate-600">CTA Okunabilirlik</span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              ctaContrast >= 4.5 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {ctaContrast.toFixed(1)}:1 · {ctaContrast >= 4.5 ? 'WCAG AA' : 'Düşük'}
          </span>
        </div>
      </div>

      {/* Primary One-Click AI Auto-Fix + Instant Studio Calibration */}
      <div className="space-y-2">
        <button
          type="button"
          data-testid="ai-smart-autofix-btn"
          onClick={handleAiSmartAutoFix}
          disabled={isAnalyzingAi}
          className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {isAnalyzingAi ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>AI Işık, Kontrast ve Netliği İyileştiriyor...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>AI ile Otomatik Optimize Et ({scopeLabel})</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-testid="instant-smart-autofix-btn"
          onClick={handleInstantStudioFix}
          disabled={isAnalyzingAi}
          className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Tek Tıkla Hızlı Stüdyo Kalibrasyonu</span>
        </button>
      </div>

      {aiStatusNotice && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{aiStatusNotice}</span>
        </div>
      )}

      {/* Applied Auto-Fix Report & Before/After Comparison */}
      {lastPlan && (
        <div
          ref={reportRef}
          data-testid="smart-autofix-result"
          className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100"
        >
          <div className="p-3.5 bg-slate-50/80 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {lastPlan.source === 'ai' ? 'AI Optimizasyon Raporu' : 'Stüdyo Kalibrasyon Raporu'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{lastPlan.summary}</p>
            </div>

            {beforeSnapshot && (
              <button
                type="button"
                data-testid="compare-before-after-btn"
                aria-pressed={isComparingBefore}
                onClick={() =>
                  onToggleCompareBefore(isComparingBefore ? null : beforeSnapshot)
                }
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isComparingBefore
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>{isComparingBefore ? 'Sonraki Hali Gör' : 'Önceki Hali Gör'}</span>
              </button>
            )}
          </div>

          <div className="p-3.5 space-y-2 text-[11px] text-slate-600 leading-relaxed">
            <p>
              <strong className="text-slate-800">Aydınlatma:</strong> {lastPlan.lightingNote}
            </p>
            <p>
              <strong className="text-slate-800">Kontrast:</strong> {lastPlan.contrastNote}
            </p>
            <p>
              <strong className="text-slate-800">Netlik:</strong> {lastPlan.clarityNote}
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {lastPlan.diffs.map((d) => (
              <div
                key={d.id}
                className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-slate-700 truncate">{d.label}</span>
                <span className="font-mono tabular-nums text-[11px] text-slate-900 font-semibold whitespace-nowrap shrink-0">
                  <span className="text-slate-400">{d.beforeValue}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="text-emerald-700">{d.afterValue}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Precision Manual Optical Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Hassas Işık, Kontrast & Netlik</span>
          </span>
          <button
            type="button"
            onClick={handleResetOptics}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Sıfırla
          </button>
        </div>

        {/* Product Brightness */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <label htmlFor="autofix-prod-brightness" className="font-semibold text-slate-700 flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-500" />
              <span>Ürün Aydınlatma</span>
            </label>
            <span className="font-mono tabular-nums text-slate-600">
              %{Math.round((studioState.product.brightness ?? 1) * 100)}
            </span>
          </div>
          <input
            id="autofix-prod-brightness"
            type="range"
            min={0.65}
            max={1.4}
            step={0.02}
            value={studioState.product.brightness ?? 1}
            onMouseDown={onCommitHistory}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateProduct((p) => ({ ...p, brightness: val }));
            }}
            className="w-full accent-orange-600"
          />
        </div>

        {/* Product Contrast */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <label htmlFor="autofix-prod-contrast" className="font-semibold text-slate-700 flex items-center gap-1">
              <Contrast className="w-3 h-3 text-slate-600" />
              <span>Dinamik Kontrast</span>
            </label>
            <span className="font-mono tabular-nums text-slate-600">
              %{Math.round((studioState.product.contrast ?? 1) * 100)}
            </span>
          </div>
          <input
            id="autofix-prod-contrast"
            type="range"
            min={0.75}
            max={1.4}
            step={0.02}
            value={studioState.product.contrast ?? 1}
            onMouseDown={onCommitHistory}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateProduct((p) => ({ ...p, contrast: val }));
            }}
            className="w-full accent-orange-600"
          />
        </div>

        {/* Product Optical Clarity / Sharpness */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <label htmlFor="autofix-prod-clarity" className="font-semibold text-slate-700 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-600" />
              <span>Görsel Netlik (Keskinlik)</span>
            </label>
            <span className="font-mono tabular-nums text-slate-600">
              %{Math.round((studioState.product.clarity ?? 0) * 100)}
            </span>
          </div>
          <input
            id="autofix-prod-clarity"
            type="range"
            min={0}
            max={1}
            step={0.04}
            value={studioState.product.clarity ?? 0}
            onMouseDown={onCommitHistory}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateProduct((p) => ({ ...p, clarity: val }));
            }}
            className="w-full accent-orange-600"
          />
        </div>

        {/* Background Scene Brightness */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <label htmlFor="autofix-bg-brightness" className="font-semibold text-slate-700">
              Sahne Arka Plan Parlaklığı
            </label>
            <span className="font-mono tabular-nums text-slate-600">
              %{Math.round((studioState.background.brightness ?? 1) * 100)}
            </span>
          </div>
          <input
            id="autofix-bg-brightness"
            type="range"
            min={0.65}
            max={1.3}
            step={0.02}
            value={studioState.background.brightness ?? 1}
            onMouseDown={onCommitHistory}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateBackground((bg) => ({ ...bg, brightness: val }));
            }}
            className="w-full accent-orange-600"
          />
        </div>
      </div>
    </div>
  );
};
