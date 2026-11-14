import React from 'react';
import {
  Sparkles,
  Download,
  Undo2,
  Redo2,
  Wand2,
  Scissors,
  Archive,
} from 'lucide-react';
import { AspectRatio } from '../types';

interface HeaderProps {
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onOpenUploader: () => void;
  onOpenAiGenerator: () => void;
  onOpenMultiChannel: () => void;
  onExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isExporting: boolean;
  hasProduct: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  aspectRatio,
  onAspectRatioChange,
  onOpenUploader,
  onOpenAiGenerator,
  onOpenMultiChannel,
  onExport,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isExporting,
  hasProduct,
}) => {
  const ratioLabels: { id: AspectRatio; label: string; desc: string }[] = [
    { id: '1:1', label: '1:1', desc: 'Kare (Instagram Post & Katalog) — Akıllı yerleşimle geç' },
    { id: '4:5', label: '4:5', desc: 'Dikey (Instagram Akış) — Akıllı yerleşimle geç' },
    { id: '9:16', label: '9:16', desc: 'Hikaye & Reels — Güvenli alan uyumlu geç' },
    { id: '16:9', label: '16:9', desc: 'Web Banner / Yatay — Akıllı yerleşimle geç' },
  ];

  return (
    <header className="min-h-14 flex-shrink-0 border-b border-slate-200 bg-white px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 z-30 sticky lg:static top-0">
      {/* Zone 1: Clean Single-Line Brand Wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-amber-400 shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          KapakAI Stüdyo
        </span>
      </div>

      {/* Zone 2: Aspect Ratio Segmented Switch & Undo/Redo */}
      <div className="flex items-center gap-2.5 order-3 sm:order-2 w-full sm:w-auto justify-between sm:justify-center">
        <div
          role="group"
          aria-label="Tuval Oranı"
          className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80"
        >
          {ratioLabels.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => onAspectRatioChange(r.id)}
              title={r.desc}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                aspectRatio === r.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Geri Al (Ctrl+Z)"
            aria-label="Geri Al"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="İleri Al (Ctrl+Y)"
            aria-label="İleri Al"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zone 3: Workspace Actions & Primary Export CTA */}
      <div className="flex items-center gap-2 order-2 sm:order-3 shrink-0">
        <button
          type="button"
          onClick={onOpenUploader}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Scissors className="w-3.5 h-3.5 text-orange-600" />
          <span>{hasProduct ? 'Ürün & Arka Fon' : 'Ürün Yükle'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenAiGenerator}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Wand2 className="w-3.5 h-3.5 text-orange-600" />
          <span className="hidden md:inline">AI Sihirbazı</span>
        </button>

        <button
          type="button"
          onClick={onOpenMultiChannel}
          title="1:1, 4:5, 9:16 ve 16:9 çoklu kanal kampanya paketini önizle ve ZIP indir"
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Archive className="w-3.5 h-3.5 text-slate-700" />
          <span className="hidden xl:inline">4 Kanal Paket</span>
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-500 text-white shadow-xs transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {isExporting ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Dışa Aktar</span>
        </button>
      </div>
    </header>
  );
};
