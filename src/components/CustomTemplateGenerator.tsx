import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Wand2, AlertCircle } from 'lucide-react';
import { AspectRatio, CoverTemplate, TemplateCategory } from '../types';
import { normalizeGeneratedTemplates } from '../utils/aiTemplates';

interface CustomTemplateGeneratorProps {
  initialPrompt?: string;
  selectedCategory: 'Tümü' | 'AI Özel' | TemplateCategory;
  onTemplatesGenerated: (templates: CoverTemplate[]) => void;
  onClose?: () => void;
}

const EXAMPLE_PROMPTS = [
  'Kış indirimi spor ayakkabı, dinamik mavi ve neon turuncu',
  'Organik zeytinyağı şişesi, Akdeniz sıcaklığı ve altın başlık',
  'Oyuncu kulaklığı lansmanı, koyu siber mor ve cyan ışık',
];

export const CustomTemplateGenerator: React.FC<CustomTemplateGeneratorProps> = ({
  initialPrompt = '',
  selectedCategory,
  onTemplatesGenerated,
  onClose,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | 'auto'>('auto');
  const [generateImages, setGenerateImages] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrompt && !prompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handleGenerate = async (e?: React.FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    const targetPrompt = (overridePrompt ?? prompt).trim();
    if (!targetPrompt || isGenerating) {
      setError('Lütfen nasıl bir şablon istediğinizi kısaca yazın.');
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/ai/generate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: targetPrompt,
          category: selectedCategory,
          aspectRatio,
          count: 3,
          generateImages,
        }),
      });

      const data = await res.json();
      if (!data.success || !Array.isArray(data.templates)) {
        setError(data.error || 'Özel şablonlar oluşturulamadı.');
        return;
      }

      const fallbackCat: TemplateCategory =
        selectedCategory !== 'Tümü' && selectedCategory !== 'AI Özel'
          ? selectedCategory
          : 'Minimalist Marka';

      const normalized = normalizeGeneratedTemplates(data.templates, {
        fallbackCategory: fallbackCat,
        preferredAspectRatio: aspectRatio,
      });

      if (normalized.length === 0) {
        setError('Geçerli şablon verisi alınamadı, lütfen tekrar deneyin.');
        return;
      }

      onTemplatesGenerated(normalized);
      setPrompt('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sunucu bağlantı hatası oluştu.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 via-orange-50/60 to-white border border-purple-200/90 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-purple-600" />
            <span>AI ile Sıfırdan Özel Şablon Üret</span>
          </h4>
          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
            İstediğiniz tarzı anlatın, yapay zeka size sıfırdan 3 farklı özgün şablon tasarlasın.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded-md"
          >
            Kapat
          </button>
        )}
      </div>

      <form onSubmit={handleGenerate} className="space-y-2.5">
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label="Özel Şablon Konsepti"
          placeholder="Örn: Spor çantası için enerjik neon siyah-yeşil lansman afişi..."
          disabled={isGenerating}
          className="w-full text-xs p-2.5 rounded-xl border border-purple-200 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none disabled:opacity-60"
        />

        {/* Quick aspect ratio choice */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            Boyut Oranı:
          </span>
          <div className="flex gap-1" role="group" aria-label="Özel Şablon Oranı">
            {(['auto', '4:5', '1:1', '9:16', '16:9'] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setAspectRatio(r)}
                disabled={isGenerating}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                  aspectRatio === r
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                }`}
              >
                {r === 'auto' ? 'Karışık' : r}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={generateImages}
            disabled={isGenerating}
            onChange={(e) => setGenerateImages(e.target.checked)}
            className="accent-purple-600"
          />
          <span>Her şablon için yapay zeka ile özgün arka plan görseli çiz</span>
        </label>

        {/* Example quick-fills */}
        <div className="flex flex-wrap gap-1">
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              type="button"
              key={i}
              disabled={isGenerating}
              onClick={() => {
                setPrompt(ex);
                handleGenerate(undefined, ex);
              }}
              className="text-[10px] px-2 py-1 rounded-lg bg-white/90 hover:bg-purple-100/70 border border-purple-200/80 text-purple-800 font-medium text-left transition-colors"
            >
              + {ex}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isGenerating}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-orange-600 text-white font-bold text-xs shadow-md shadow-purple-500/20 hover:brightness-110 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>AI 3 Özel Şablon Tasarlıyor...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sıfırdan 3 Özel Şablon Üret</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
