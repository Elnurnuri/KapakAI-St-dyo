import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Undo2,
  Check,
  Eye,
} from 'lucide-react';
import {
  AbCampaignVariation,
  StudioPatch,
} from '../types';
import {
  AuditableState,
  evaluateStudioDesign,
  normalizeAbVariations,
} from '../utils/adAuditor';
import { loadImage } from '../utils/backgroundRemoval';

interface CampaignOptimizerPanelProps {
  state: AuditableState;
  brandName?: string;
  showSafeZone: boolean;
  onToggleSafeZone: () => void;
  onApplyPatch: (patch: StudioPatch, toastLabel?: string) => void;
  onApplyVariation: (variation: AbCampaignVariation) => void;
  canUndo: boolean;
  onUndo: () => void;
}

async function getCompactProductBase64(src: string): Promise<string> {
  if (!src) return '';
  try {
    const img = await loadImage(src);
    const maxSide = 256;
    const natW = img.naturalWidth || img.width || 256;
    const natH = img.naturalHeight || img.height || 256;
    const scale = Math.min(1, maxSide / Math.max(natW, natH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(natW * scale));
    canvas.height = Math.max(1, Math.round(natH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

export const CampaignOptimizerPanel: React.FC<CampaignOptimizerPanelProps> = ({
  state,
  brandName = '',
  showSafeZone,
  onToggleSafeZone,
  onApplyPatch,
  onApplyVariation,
  canUndo,
  onUndo,
}) => {
  const report = useMemo(() => evaluateStudioDesign(state), [state]);
  const warningChecks = report.checks.filter((c) => c.status === 'warn' && c.autoFixPatch);

  const [variations, setVariations] = useState<AbCampaignVariation[]>([]);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);
  const [isGeneratingAb, setIsGeneratingAb] = useState<boolean>(false);
  const [abError, setAbError] = useState<string | null>(null);

  const handleFixAllWarnings = () => {
    const merged: StudioPatch = {};
    for (const item of warningChecks) {
      if (!item.autoFixPatch) continue;
      if (item.autoFixPatch.typography) {
        merged.typography = { ...(merged.typography || {}), ...item.autoFixPatch.typography };
      }
      if (item.autoFixPatch.productPlacement) {
        merged.productPlacement = {
          ...(merged.productPlacement || {}),
          ...item.autoFixPatch.productPlacement,
        };
      }
      if (item.autoFixPatch.badgesPosition) {
        merged.badgesPosition = { ...item.autoFixPatch.badgesPosition };
      }
      if (item.autoFixPatch.promoBadge) {
        merged.promoBadge = { ...(merged.promoBadge || {}), ...item.autoFixPatch.promoBadge };
      }
    }
    onApplyPatch(merged, 'Tüm reklam kalite ve okunabilirlik uyarıları düzeltildi');
  };

  const handleGenerateAbVariations = async () => {
    setIsGeneratingAb(true);
    setAbError(null);
    try {
      const compactImg = await getCompactProductBase64(state.product.src);
      const res = await fetch('/api/ai/ab-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compactImg,
          mimeType: 'image/png',
          currentHeadline: `${state.typography.headline} ${state.typography.headlineHighlight || ''}`.trim(),
          currentSubtitle: state.typography.subtitle,
          brandName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const normalized = normalizeAbVariations(data.variations);
        if (normalized.length > 0) {
          setVariations(normalized);
        } else {
          setAbError('Varyasyon listesi oluşturulamadı, lütfen tekrar deneyin.');
        }
      } else {
        setAbError(data.error || 'A/B varyasyon üretiminde hata oluştu.');
      }
    } catch (err: unknown) {
      setAbError(err instanceof Error ? err.message : 'Bağlantı hatası oluştu.');
    } finally {
      setIsGeneratingAb(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="campaign-optimizer-panel">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            <span>Kalite Denetimi & A/B Test</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Canlı okunabilirlik, güvenli alan kontrolü ve 3 farklı dönüşüm açısı
          </p>
        </div>
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 whitespace-nowrap shrink-0 transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            <span>Geri Al</span>
          </button>
        )}
      </div>

      {/* Section 1: Real-Time Deterministic Ad Quality & Conversion Audit */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-3.5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-extrabold text-slate-900 block">
              Canlı Reklam Uyumluluk Kontrolü
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {report.passedCount} / {report.totalCount} kriter onaylı · {report.readinessLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleSafeZone}
            aria-pressed={showSafeZone}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
              showSafeZone
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Güvenli Alan</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {report.checks.map((item) => (
            <div
              key={item.id}
              data-testid={`audit-check-${item.id}`}
              className="p-3 flex items-start justify-between gap-2.5"
            >
              <div className="flex items-start gap-2 min-w-0">
                {item.status === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{item.title}</span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span
                      className={`text-[11px] font-mono tabular-nums font-semibold ${
                        item.status === 'pass' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {item.metric}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{item.detail}</p>
                </div>
              </div>

              {item.status === 'warn' && item.autoFixPatch && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyPatch(item.autoFixPatch!, `${item.title} otomatik düzeltildi`)
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-bold whitespace-nowrap shrink-0 transition-colors"
                >
                  {item.fixLabel || 'Düzelt'}
                </button>
              )}
            </div>
          ))}
        </div>

        {warningChecks.length > 1 && (
          <div className="p-3 bg-amber-50/50 border-t border-slate-200">
            <button
              type="button"
              onClick={handleFixAllWarnings}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Tüm Uyarıları Otomatik Düzelt ({warningChecks.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Section 2: AI A/B Campaign Variations */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900">
              AI A/B Kampanya Varyasyonları
            </h4>
            <p className="text-[11px] text-slate-500">
              Aynı ürün için 3 farklı psikolojik satış açısını tek tıkla karşılaştırın
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateAbVariations}
          disabled={isGeneratingAb}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {isGeneratingAb ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>3 Farklı A/B Satış Açısı Üretiliyor...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {variations.length > 0
                  ? 'A/B Varyasyonlarını Yeniden Üret'
                  : '3 Farklı A/B Reklam Açısı Üret'}
              </span>
            </>
          )}
        </button>

        {abError && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {abError}
          </p>
        )}

        {variations.length === 0 && !isGeneratingAb ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-700">
              Performans · Prestij · Aciliyet Testi
            </p>
            <p className="text-[11px] text-slate-500">
              Butona tıkladığınızda ürününüze özel 3 farklı başlık, alt metin, CTA ve indirim etiketi kurgulanır.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {variations.map((v, index) => {
              const isSelected = activeVariationId === v.id;
              const letter = ['A', 'B', 'C'][index] || 'V';
              return (
                <div
                  key={v.id}
                  data-testid={`ab-variation-card-${letter}`}
                  className={`p-3.5 rounded-xl border bg-white space-y-2 transition-all ${
                    isSelected
                      ? 'border-orange-500 ring-2 ring-orange-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-bold text-slate-800">
                      Varyasyon {letter} · {v.angleTitle}
                    </span>
                    <span
                      style={{
                        backgroundColor: v.ctaBgHex,
                        color: v.ctaTextHex,
                      }}
                      className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase whitespace-nowrap shrink-0"
                    >
                      {v.ctaText}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-500">{v.kicker}</p>
                    <p className="text-xs font-extrabold text-slate-900 leading-snug">
                      {v.headline}{' '}
                      <span style={{ color: v.accentHex }}>{v.headlineHighlight}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 leading-snug">{v.subtitle}</p>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-snug">{v.rationale}</p>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveVariationId(v.id);
                      onApplyVariation(v);
                    }}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Varyasyon {letter} Aktif</span>
                      </>
                    ) : (
                      <span>Varyasyon {letter}’yı Tuvalde Dene</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
