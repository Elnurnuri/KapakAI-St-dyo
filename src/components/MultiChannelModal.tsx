import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Layers,
  RefreshCw,
  ArrowUpRight,
  Archive,
} from 'lucide-react';
import {
  AspectRatio,
  ExportImageFormat,
} from '../types';
import {
  AdaptableStudioState,
  adaptStateToAspectRatio,
  CAMPAIGN_CHANNELS,
} from '../utils/campaignPack';
import { renderHighResCover } from '../utils/exportCanvas';
import { buildZipArchive, dataUrlToUint8Array } from '../utils/zipBuilder';

interface MultiChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  studioState: AdaptableStudioState;
  onSwitchAndAdaptRatio: (ratio: AspectRatio) => void;
  onNotify: (msg: string) => void;
}

export const MultiChannelModal: React.FC<MultiChannelModalProps> = ({
  isOpen,
  onClose,
  studioState,
  onSwitchAndAdaptRatio,
  onNotify,
}) => {
  const [previews, setPreviews] = useState<Record<AspectRatio, string>>({
    '1:1': '',
    '4:5': '',
    '9:16': '',
    '16:9': '',
  });
  const [isRenderingPreviews, setIsRenderingPreviews] = useState<boolean>(false);
  const [format, setFormat] = useState<ExportImageFormat>('png');
  const [scaleMultiplier, setScaleMultiplier] = useState<1 | 2>(1);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [downloadingSingle, setDownloadingSingle] = useState<AspectRatio | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsRenderingPreviews(true);

    async function buildPreviews() {
      const next: Record<AspectRatio, string> = {
        '1:1': '',
        '4:5': '',
        '9:16': '',
        '16:9': '',
      };

      for (const ch of CAMPAIGN_CHANNELS) {
        const adapted = adaptStateToAspectRatio(studioState, ch.ratio);
        try {
          const canvas = await renderHighResCover({
            ...adapted,
            scaleMultiplier: 0.5, // Fast crisp 540p preview for modal grid
          });
          if (cancelled) return;
          next[ch.ratio] = canvas.toDataURL('image/jpeg', 0.88);
        } catch (err) {
          console.error('Preview render failed for', ch.ratio, err);
        }
      }

      if (!cancelled) {
        setPreviews(next);
        setIsRenderingPreviews(false);
      }
    }

    void buildPreviews();
    return () => {
      cancelled = true;
    };
  }, [isOpen, studioState]);

  if (!isOpen) return null;

  const getMimeType = (fmt: ExportImageFormat) =>
    fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';

  const getExt = (fmt: ExportImageFormat) => (fmt === 'jpeg' ? 'jpg' : fmt);

  const handleDownloadSingleChannel = async (ratio: AspectRatio, slug: string) => {
    setDownloadingSingle(ratio);
    try {
      const adapted = adaptStateToAspectRatio(studioState, ratio);
      const canvas = await renderHighResCover({
        ...adapted,
        scaleMultiplier,
      });
      const dataUrl = canvas.toDataURL(getMimeType(format), 0.94);
      const link = document.createElement('a');
      link.download = `kapakai-${slug}-${scaleMultiplier}x.${getExt(format)}`;
      link.href = dataUrl;
      link.click();
      onNotify(`${ratio} kanal görseli indirildi`);
    } catch (err) {
      console.error('Single channel export error:', err);
      onNotify('Görsel dışa aktarılırken hata oluştu');
    } finally {
      setDownloadingSingle(null);
    }
  };

  const handleDownloadFullCampaignZip = async () => {
    setIsDownloadingZip(true);
    try {
      const entries: Array<{ name: string; data: Uint8Array }> = [];
      const ext = getExt(format);
      const mime = getMimeType(format);

      for (const ch of CAMPAIGN_CHANNELS) {
        const adapted = adaptStateToAspectRatio(studioState, ch.ratio);
        const canvas = await renderHighResCover({
          ...adapted,
          scaleMultiplier,
        });
        const dataUrl = canvas.toDataURL(mime, 0.94);
        entries.push({
          name: `kapakai-${ch.slug}-${scaleMultiplier === 2 ? '4k' : 'hd'}.${ext}`,
          data: dataUrlToUint8Array(dataUrl),
        });
      }

      const zipBytes = buildZipArchive(entries);
      const blob = new Blob([new Uint8Array(zipBytes)], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `kapakai-4lu-kampanya-paketi-${Date.now()}.zip`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      onNotify('4’lü çoklu kanal kampanya paketi (.ZIP) indirildi!');
    } catch (err) {
      console.error('ZIP pack export error:', err);
      onNotify('Kampanya paketi oluşturulurken bir hata oluştu');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="multichannel-modal-title"
      data-testid="multichannel-modal"
      className="fixed inset-0 z-[105] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="multichannel-modal-title"
                className="text-base font-extrabold text-slate-900 truncate"
              >
                Çoklu Kanal Kampanya Paketi & Akıllı Boyutlandırma
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Tasarımınız 4 ana reklam formatına güvenli alan kurallarıyla otomatik uyarlandı
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Çoklu kanal penceresini kapat"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Controls Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Format Selector */}
            <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
              {(['png', 'jpeg', 'webp'] as ExportImageFormat[]).map((fmt) => (
                <button
                  type="button"
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase transition-colors ${
                    format === fmt
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt === 'jpeg' ? 'JPG' : fmt}
                </button>
              ))}
            </div>

            {/* Quality Selector */}
            <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setScaleMultiplier(1)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  scaleMultiplier === 1
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1080p HD
              </button>
              <button
                type="button"
                onClick={() => setScaleMultiplier(2)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  scaleMultiplier === 2
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                4K Ultra HD
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadFullCampaignZip}
            disabled={isDownloadingZip || isRenderingPreviews}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {isDownloadingZip ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>ZIP Paketi Hazırlanıyor...</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                <span>4’lü Kampanya Paketini İndir (.ZIP)</span>
              </>
            )}
          </button>
        </div>

        {/* 4-Channel Preview Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-100/60 flex-1">
          {CAMPAIGN_CHANNELS.map((ch) => {
            const previewSrc = previews[ch.ratio];
            const isCurrent = studioState.aspectRatio === ch.ratio;
            return (
              <div
                key={ch.ratio}
                data-testid={`channel-card-${ch.ratio}`}
                className={`rounded-xl border bg-white flex flex-col overflow-hidden ${
                  isCurrent ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200'
                }`}
              >
                {/* Preview Viewport */}
                <div className="h-56 bg-slate-100 p-3 flex items-center justify-center relative border-b border-slate-100">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt={`${ch.title} (${ch.ratio})`}
                      className="max-h-full max-w-full object-contain rounded shadow-md border border-slate-200/80"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
                      <span className="text-[11px] font-semibold">Önizleme hazırlanıyor...</span>
                    </div>
                  )}
                </div>

                {/* Metadata & Actions */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold text-slate-900">{ch.title}</span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500">
                        {ch.ratio}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{ch.platforms}</p>
                    <p className="text-[10px] font-mono tabular-nums text-slate-400 mt-1">
                      {scaleMultiplier === 2 ? ch.dimensions2x : ch.dimensions1x}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleChannel(ch.ratio, ch.slug)}
                      disabled={downloadingSingle === ch.ratio}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3 h-3" />
                      <span>{downloadingSingle === ch.ratio ? 'İniyor...' : 'İndir'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchAndAdaptRatio(ch.ratio);
                        onClose();
                      }}
                      title="Ana tuvali bu orana akıllı yerleşimle geçir"
                      className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-slate-700 hover:text-orange-800 text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <span>Düzenle</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
