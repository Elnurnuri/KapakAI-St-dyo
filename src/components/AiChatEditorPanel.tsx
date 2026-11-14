import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  RefreshCw,
  CheckCircle2,
  Undo2,
  Target,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  AiChatMessage,
  EditableAreaId,
  StudioPatch,
} from '../types';
import {
  getAreaMeta,
  StudioEditableState,
} from '../utils/aiPatch';

interface AiChatEditorPanelProps {
  targetArea: EditableAreaId;
  onChangeTargetArea: (area: EditableAreaId) => void;
  studioState: StudioEditableState;
  messages: AiChatMessage[];
  onAppendMessage: (msg: AiChatMessage) => void;
  onClearMessages: () => void;
  onApplyPatch: (patch: StudioPatch, targetArea: EditableAreaId) => string[];
  canUndo: boolean;
  onUndo: () => void;
  onOpenAiWizard?: () => void;
}

const AREA_OPTIONS: Array<{ id: EditableAreaId; label: string }> = [
  { id: 'all', label: 'Tüm Şablon' },
  { id: 'background', label: 'Arka Plan' },
  { id: 'text', label: 'Metin' },
  { id: 'product', label: 'Ürün' },
  { id: 'badges', label: 'Rozetler' },
  { id: 'promo', label: 'Kampanya' },
];

export const AiChatEditorPanel: React.FC<AiChatEditorPanelProps> = ({
  targetArea,
  onChangeTargetArea,
  studioState,
  messages,
  onAppendMessage,
  onClearMessages,
  onApplyPatch,
  canUndo,
  onUndo,
  onOpenAiWizard,
}) => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const areaMeta = getAreaMeta(targetArea);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      targetArea,
    };
    onAppendMessage(userMsg);
    setInput('');
    setIsSending(true);

    try {
      // Strip heavy base64 strings before sending current state to AI
      const lightState = {
        aspectRatio: studioState.aspectRatio,
        background: {
          ...studioState.background,
          imageUrl: studioState.background.imageUrl ? '[image]' : undefined,
        },
        typography: studioState.typography,
        badges: studioState.badges,
        badgesPosition: studioState.badgesPosition,
        promoBadge: studioState.promoBadge,
        productPlacement: {
          x: studioState.product.x,
          y: studioState.product.y,
          scale: studioState.product.scale,
          rotation: studioState.product.rotation,
          flipX: studioState.product.flipX,
          shadowOpacity: studioState.product.shadowOpacity,
          shadowBlur: studioState.product.shadowBlur,
          reflection: studioState.product.reflection,
          reflectionOpacity: studioState.product.reflectionOpacity,
          brightness: studioState.product.brightness,
          contrast: studioState.product.contrast,
          ambientGlow: studioState.product.ambientGlow,
          glowColor: studioState.product.glowColor,
        },
        floatingElements: studioState.floatingElements,
      };

      const res = await fetch('/api/ai/chat-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          targetArea,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          currentState: lightState,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        onAppendMessage({
          id: `a-err-${Date.now()}`,
          role: 'assistant',
          text: data.error || 'Düzenleme uygulanamadı, lütfen tekrar deneyin.',
          targetArea,
          isError: true,
        });
        return;
      }

      const nextPatch: StudioPatch = { ...(data.patch || {}) };

      if (
        typeof nextPatch.scenePrompt === 'string' &&
        nextPatch.scenePrompt.trim() &&
        (targetArea === 'all' || targetArea === 'background')
      ) {
        try {
          const imgRes = await fetch('/api/ai/generate-scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'studio-scene',
              prompt: nextPatch.scenePrompt.trim(),
              aspectRatio: studioState.aspectRatio,
            }),
          });
          const imgData = await imgRes.json();
          if (imgData.success && imgData.imageUrl) {
            nextPatch.background = {
              ...(nextPatch.background || {}),
              type: 'image',
              imageUrl: imgData.imageUrl,
              stageStyle: 'none',
            };
          }
        } catch {
          // Keep non-image patch changes cleanly if scene gen fails
        }
      }

      const applied = onApplyPatch(nextPatch, targetArea);
      onAppendMessage({
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.assistantMessage || 'İsteğiniz tasarıma uygulandı.',
        targetArea,
        appliedChanges: applied,
      });
    } catch (err: unknown) {
      onAppendMessage({
        id: `a-err-${Date.now()}`,
        role: 'assistant',
        text: err instanceof Error ? err.message : 'Sunucu bağlantı hatası oluştu.',
        targetArea,
        isError: true,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendPrompt(input);
  };

  return (
    <div className="flex flex-col h-full min-h-[460px] gap-3">
      {/* Header + Undo */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>AI Tasarım Sohbeti</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tuvalden bir alan seçin ve yapay zeka ile konuşarak anında değiştirin
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onOpenAiWizard && (
            <button
              type="button"
              onClick={onOpenAiWizard}
              className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
              title="Tam AI Afiş / 3D Sticker Stüdyosunu Aç"
            >
              <Wand2 className="w-3 h-3" />
              <span>AI Afiş</span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearMessages}
              title="Sohbeti Temizle"
              aria-label="Sohbeti Temizle"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Target Area Selector */}
      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-orange-600" />
            <span>Düzenlenecek Alan:</span>
          </span>
          <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
            {areaMeta.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Düzenlenecek Şablon Alanı">
          {AREA_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.id}
              onClick={() => onChangeTargetArea(opt.id)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                targetArea === opt.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[340px]">
        {messages.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/80 via-orange-50/50 to-white border border-purple-200/70 space-y-2.5">
            <p className="text-xs font-bold text-slate-800">
              Seçili alan ({areaMeta.shortLabel}) için örnek komutlar:
            </p>
            <div className="flex flex-col gap-1.5">
              {areaMeta.suggestions.map((sug, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => sendPrompt(sug)}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 font-medium transition-all"
                >
                  “{sug}”
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-sm'
                    : m.isError
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-sm'
                    : 'bg-purple-50/80 text-slate-800 border border-purple-200/80 rounded-bl-sm'
                }`}
              >
                {m.role === 'user' && (
                  <span className="block text-[10px] text-amber-300 font-bold mb-0.5">
                    Hedef: {getAreaMeta(m.targetArea).shortLabel}
                  </span>
                )}
                <p>{m.text}</p>
                {m.appliedChanges && m.appliedChanges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.appliedChanges.map((ch, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/90 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {ch}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-start">
            <div className="bg-purple-50 border border-purple-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs text-purple-800 font-semibold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
              <span>AI seçili alanı düzenliyor...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Suggestions Strip when conversation already started */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-1 overflow-x-auto scrollbar-none flex-1">
            {areaMeta.suggestions.slice(0, 2).map((sug, i) => (
              <button
                type="button"
                key={i}
                onClick={() => sendPrompt(sug)}
                disabled={isSending}
                className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-700 font-semibold whitespace-nowrap truncate max-w-[165px] transition-colors"
                title={sug}
              >
                {sug}
              </button>
            ))}
          </div>
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="text-[11px] font-bold text-slate-600 hover:text-orange-600 flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              <Undo2 className="w-3 h-3" />
              <span>Geri Al</span>
            </button>
          )}
        </div>
      )}

      {/* Chat Prompt Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-1 border-t border-slate-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`${areaMeta.shortLabel} için değişiklik yazın...`}
          aria-label="AI Tasarım Sohbet Mesajı"
          disabled={isSending}
          className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          aria-label="AI Komutu Gönder"
          className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-orange-600 text-white font-bold text-xs shadow-sm hover:brightness-110 flex items-center justify-center gap-1.5 transition-all disabled:opacity-45"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Uygula</span>
        </button>
      </form>
    </div>
  );
};
