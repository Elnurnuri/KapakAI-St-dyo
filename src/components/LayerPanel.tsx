import React from 'react';
import {
  CanvasLayer,
  FloatingElement,
  LayerType,
} from '../types';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Package,
  Type,
  Award,
  Tag,
  Sparkles,
  Trash2,
  ArrowUpDown,
} from 'lucide-react';

interface LayerPanelProps {
  layers: CanvasLayer[];
  onUpdateLayers: (newLayers: CanvasLayer[]) => void;
  activeElement: string | null;
  onSelectElement: (type: string | null) => void;
  onDeleteFloatingElement?: (floatingId: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  onUpdateLayers,
  activeElement,
  onSelectElement,
  onDeleteFloatingElement,
}) => {
  const moveLayer = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const updated = [...layers];
    const item = updated[index];

    if (direction === 'up' && index > 0) {
      updated[index] = updated[index - 1];
      updated[index - 1] = item;
    } else if (direction === 'down' && index < updated.length - 1) {
      updated[index] = updated[index + 1];
      updated[index + 1] = item;
    } else if (direction === 'top' && index > 0) {
      updated.splice(index, 1);
      updated.unshift(item);
    } else if (direction === 'bottom' && index < updated.length - 1) {
      updated.splice(index, 1);
      updated.push(item);
    }

    onUpdateLayers(updated);
  };

  const toggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateLayers(
      layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const toggleLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateLayers(
      layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
    );
  };

  const getLayerIcon = (type: LayerType) => {
    switch (type) {
      case 'product':
        return <Package className="w-4 h-4 text-orange-600" />;
      case 'typography':
        return <Type className="w-4 h-4 text-blue-600" />;
      case 'badges':
        return <Award className="w-4 h-4 text-emerald-600" />;
      case 'promoBadge':
        return <Tag className="w-4 h-4 text-rose-600" />;
      case 'floating':
        return <Sparkles className="w-4 h-4 text-purple-600" />;
    }
  };

  // Quick preset actions
  const sendHeadlineBehindProduct = () => {
    const typoIndex = layers.findIndex((l) => l.type === 'typography');
    const prodIndex = layers.findIndex((l) => l.type === 'product');
    if (typoIndex !== -1 && prodIndex !== -1 && typoIndex < prodIndex) {
      // In layers array, index 0 is top. If typography is index 0 and product is index 1,
      // moving typography behind product means typography index > product index!
      const updated = [...layers];
      const typo = updated.splice(typoIndex, 1)[0];
      const newProdIndex = updated.findIndex((l) => l.type === 'product');
      updated.splice(newProdIndex + 1, 0, typo);
      onUpdateLayers(updated);
    }
  };

  const bringProductToFront = () => {
    const prodIndex = layers.findIndex((l) => l.type === 'product');
    if (prodIndex > 0) {
      const updated = [...layers];
      const prod = updated.splice(prodIndex, 1)[0];
      updated.unshift(prod);
      onUpdateLayers(updated);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-extrabold text-slate-800">
              Katman Yönetimi
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Öğe sıralamasını (önde/arkada), görünürlüğü ve kilitleri düzenleyin
          </p>
        </div>
        <span className="text-[11px] font-bold text-orange-600 px-2 py-0.5 rounded-full bg-orange-100">
          {layers.length} Katman
        </span>
      </div>

      {/* Quick Layout Presets */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={sendHeadlineBehindProduct}
          className="p-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50/50 text-left transition-all group"
        >
          <span className="text-[11px] font-bold text-slate-800 group-hover:text-blue-700 block">
            ✍️ Başlığı Ürünün Arkasına Al
          </span>
          <span className="text-[10px] text-slate-500">Dergi & Reklam stili</span>
        </button>

        <button
          onClick={bringProductToFront}
          className="p-2 rounded-xl border border-slate-200 hover:border-orange-300 bg-slate-50 hover:bg-orange-50/50 text-left transition-all group"
        >
          <span className="text-[11px] font-bold text-slate-800 group-hover:text-orange-700 block">
            🛍️ Ürünü En Öne Getir
          </span>
          <span className="text-[10px] text-slate-500">Tüm öğelerin üstünde</span>
        </button>
      </div>

      {/* Layer Stack Explanation */}
      <div className="flex items-center justify-between px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">
        <span>▲ En Üst (Önde)</span>
        <span>▼ En Alt (Arkada)</span>
      </div>

      {/* Layers List */}
      <div className="space-y-1.5">
        {layers.map((layer, index) => {
          const isSelected =
            (layer.type === 'product' && activeElement === 'product') ||
            (layer.type === 'typography' && activeElement === 'text') ||
            (layer.type === 'badges' && activeElement === 'badges') ||
            (layer.type === 'promoBadge' && activeElement === 'promo') ||
            (layer.type === 'floating' &&
              Boolean(layer.floatingId) &&
              activeElement === `floating:${layer.floatingId}`);

          return (
            <div
              key={layer.id}
              onClick={() => {
                if (layer.type === 'product') onSelectElement('product');
                else if (layer.type === 'typography') onSelectElement('text');
                else if (layer.type === 'badges') onSelectElement('badges');
                else if (layer.type === 'promoBadge') onSelectElement('promo');
                else if (layer.type === 'floating' && layer.floatingId)
                  onSelectElement(`floating:${layer.floatingId}`);
                else onSelectElement(null);
              }}
              className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'border-orange-500 bg-orange-50/70 shadow-sm ring-1 ring-orange-500/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
              } ${!layer.visible ? 'opacity-50' : ''}`}
            >
              {/* Layer Index Badge */}
              <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-center">
                {index + 1}
              </span>

              {/* Type Icon */}
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                {getLayerIcon(layer.type)}
              </div>

              {/* Layer Name & Tag */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {layer.name}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span>{index === 0 ? 'En Önde' : index === layers.length - 1 ? 'En Arkada' : 'Orta Katman'}</span>
                  {layer.locked && (
                    <span className="text-amber-600 font-semibold">• Kilitli</span>
                  )}
                  {!layer.visible && (
                    <span className="text-rose-600 font-semibold">• Gizli</span>
                  )}
                </div>
              </div>

              {/* Action Buttons: Visibility & Lock */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => toggleVisibility(layer.id, e)}
                  title={layer.visible ? 'Katmanı Gizle' : 'Katmanı Göster'}
                  className={`p-1 rounded hover:bg-slate-200/60 transition-colors ${
                    layer.visible ? 'text-slate-500 hover:text-slate-800' : 'text-rose-500'
                  }`}
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={(e) => toggleLock(layer.id, e)}
                  title={layer.locked ? 'Kilidi Aç' : 'Katmanı Kilitle'}
                  className={`p-1 rounded hover:bg-slate-200/60 transition-colors ${
                    layer.locked ? 'text-amber-600' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Reordering Controls: Up / Down / Top / Bottom */}
              <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(index, 'up');
                  }}
                  disabled={index === 0}
                  title="Bir Üste Taşı (Öne)"
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-20 disabled:hover:bg-transparent"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(index, 'down');
                  }}
                  disabled={index === layers.length - 1}
                  title="Bir Alta Taşı (Arkaya)"
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-20 disabled:hover:bg-transparent"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(index, 'top');
                  }}
                  disabled={index === 0}
                  title="En Öne Getir"
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-20 disabled:hover:bg-transparent hidden sm:block"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(index, 'bottom');
                  }}
                  disabled={index === layers.length - 1}
                  title="En Arkaya Gönder"
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-20 disabled:hover:bg-transparent hidden sm:block"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                </button>

                {/* Delete if floating element */}
                {layer.type === 'floating' && layer.floatingId && onDeleteFloatingElement && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFloatingElement(layer.floatingId!);
                    }}
                    title="Bu Dekoratif Öğeyi Sil"
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer Tip Box */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
        <ArrowUpDown className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
        <span>
          Katman sırası tuvalde ve indirilen yüksek çözünürlüklü kapak görselinde anında geçerli olur.
        </span>
      </div>
    </div>
  );
};
