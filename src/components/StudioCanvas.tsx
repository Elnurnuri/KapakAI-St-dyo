import React, { useRef, useState, useEffect } from 'react';
import {
  AspectRatio,
  BrandWatermark,
  FeatureBadge,
  FloatingElement,
  ProductPlacement,
  PromoBadge,
  StudioBackground,
  StudioTypography,
  CanvasLayer,
  LayerType,
  EditableAreaId,
} from '../types';
import { getAreaMeta, mapActiveElementToArea } from '../utils/aiPatch';
import {
  Move,
  FlipHorizontal,
  Sparkles,
  Layers,
  Shield,
  Droplet,
  Sun,
  Award,
  Zap,
  Leaf,
  Clock,
  Lock,
  Crosshair,
  Grid,
  RefreshCw,
  Palette,
  ShieldCheck,
  Eye,
  ZoomIn,
  ZoomOut,
  Wand2,
} from 'lucide-react';

interface StudioCanvasProps {
  aspectRatio: AspectRatio;
  background: StudioBackground;
  product: ProductPlacement;
  typography: StudioTypography;
  badges: FeatureBadge[];
  badgesPosition: { x: number; y: number };
  promoBadge: PromoBadge;
  floatingElements: FloatingElement[];
  layers?: CanvasLayer[];
  activeElement?: string | null;
  onSelectElement?: (type: string | null) => void;
  onOpenLayerTab?: () => void;
  onOpenAiChat?: (area: EditableAreaId) => void;
  onCommitHistory?: () => void;
  onUpdateProduct: (updater: (prev: ProductPlacement) => ProductPlacement) => void;
  onUpdateTypography: (updater: (prev: StudioTypography) => StudioTypography) => void;
  onUpdateBadgesPosition: (pos: { x: number; y: number }) => void;
  onUpdatePromoBadge: (updater: (prev: PromoBadge) => PromoBadge) => void;
  onUpdateFloatingElement: (id: string, updates: Partial<FloatingElement>) => void;
  showGoldenGuide?: boolean;
  onToggleGoldenGuide?: () => void;
  onAlignGoldenRatio?: () => void;
  isAligningProduct?: boolean;
  onDropProductFile?: (file: File) => void;
  onOpenHarmonyTab?: () => void;
  onOpenOptimizerTab?: () => void;
  onOpenAutoFixTab?: () => void;
  brandWatermark?: BrandWatermark;
  showSafeZone?: boolean;
  onToggleSafeZone?: () => void;
}

type DragTarget =
  | { kind: 'product'; startClientX: number; startClientY: number; origX: number; origY: number }
  | { kind: 'text'; startClientX: number; startClientY: number; origX: number; origY: number }
  | { kind: 'promo'; startClientX: number; startClientY: number; origX: number; origY: number }
  | { kind: 'badges'; startClientX: number; startClientY: number; origX: number; origY: number }
  | { kind: 'floating'; id: string; startClientX: number; startClientY: number; origX: number; origY: number };

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  aspectRatio,
  background,
  product,
  typography,
  badges,
  badgesPosition,
  promoBadge,
  floatingElements,
  layers = [],
  activeElement: externalActiveElement,
  onSelectElement,
  onOpenLayerTab,
  onOpenAiChat,
  onCommitHistory,
  onUpdateProduct,
  onUpdateTypography,
  onUpdateBadgesPosition,
  onUpdatePromoBadge,
  onUpdateFloatingElement,
  showGoldenGuide = false,
  onToggleGoldenGuide,
  onAlignGoldenRatio,
  isAligningProduct = false,
  onDropProductFile,
  onOpenHarmonyTab,
  onOpenOptimizerTab,
  onOpenAutoFixTab,
  brandWatermark,
  showSafeZone = false,
  onToggleSafeZone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const didMoveRef = useRef<boolean>(false);
  const [internalActiveElement, setInternalActiveElement] = useState<string | null>('product');
  const [isFileHovering, setIsFileHovering] = useState<boolean>(false);
  const [snapState, setSnapState] = useState<{ x50: boolean; y50: boolean }>({
    x50: false,
    y50: false,
  });
  const [zoomScale, setZoomScale] = useState<number>(1);

  const activeElement = externalActiveElement !== undefined ? externalActiveElement : internalActiveElement;
  const setActiveElement = (val: string | null) => {
    setInternalActiveElement(val);
    if (onSelectElement) onSelectElement(val);
  };

  const getLayerZIndex = (type: LayerType, floatingId?: string) => {
    if (!layers || layers.length === 0) return 15;
    const index = layers.findIndex(
      (l) => l.type === type && (!floatingId || l.floatingId === floatingId)
    );
    if (index === -1) return 15;
    return (layers.length - index) * 10;
  };

  const isLayerVisible = (type: LayerType, floatingId?: string) => {
    if (!layers || layers.length === 0) return true;
    const layer = layers.find(
      (l) => l.type === type && (!floatingId || l.floatingId === floatingId)
    );
    return layer ? layer.visible : true;
  };

  const isLayerLocked = (type: LayerType, floatingId?: string) => {
    if (!layers || layers.length === 0) return false;
    const layer = layers.find(
      (l) => l.type === type && (!floatingId || l.floatingId === floatingId)
    );
    return layer ? layer.locked : false;
  };

  const startDrag = (e: React.MouseEvent, target: DragTarget, selectKey: string) => {
    e.stopPropagation();
    setActiveElement(selectKey);
    didMoveRef.current = false;
    setDragTarget(target);
  };

  useEffect(() => {
    if (!dragTarget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragTarget.startClientX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragTarget.startClientY) / rect.height) * 100;

      if (Math.abs(deltaX) > 0.3 || Math.abs(deltaY) > 0.3) {
        if (!didMoveRef.current) {
          didMoveRef.current = true;
          onCommitHistory?.();
        }
      }

      const snapCenter = (val: number) => {
        if (Math.abs(val - 50) <= 1.2) return { v: 50, snapped: true };
        return { v: val, snapped: false };
      };

      if (dragTarget.kind === 'product') {
        const rawX = Math.max(5, Math.min(95, dragTarget.origX + deltaX));
        const rawY = Math.max(5, Math.min(95, dragTarget.origY + deltaY));
        const sx = snapCenter(rawX);
        const sy = snapCenter(rawY);
        setSnapState({ x50: sx.snapped, y50: sy.snapped });
        onUpdateProduct((prev) => ({
          ...prev,
          x: sx.v,
          y: sy.v,
        }));
      } else if (dragTarget.kind === 'text') {
        const rawX = Math.max(2, Math.min(92, Math.round(dragTarget.origX + deltaX)));
        const rawY = Math.max(2, Math.min(88, Math.round(dragTarget.origY + deltaY)));
        const sx = snapCenter(rawX);
        setSnapState({ x50: sx.snapped, y50: false });
        onUpdateTypography((prev) => ({
          ...prev,
          positionX: sx.v,
          positionY: rawY,
        }));
      } else if (dragTarget.kind === 'promo') {
        const rawX = Math.max(6, Math.min(94, Math.round(dragTarget.origX + deltaX)));
        const rawY = Math.max(6, Math.min(94, Math.round(dragTarget.origY + deltaY)));
        const sx = snapCenter(rawX);
        const sy = snapCenter(rawY);
        setSnapState({ x50: sx.snapped, y50: sy.snapped });
        onUpdatePromoBadge((prev) => ({
          ...prev,
          x: sx.v,
          y: sy.v,
        }));
      } else if (dragTarget.kind === 'badges') {
        setSnapState({ x50: false, y50: false });
        onUpdateBadgesPosition({
          x: Math.max(2, Math.min(72, Math.round(dragTarget.origX + deltaX))),
          y: Math.max(5, Math.min(85, Math.round(dragTarget.origY + deltaY))),
        });
      } else if (dragTarget.kind === 'floating') {
        const rawX = Math.max(3, Math.min(97, Math.round(dragTarget.origX + deltaX)));
        const rawY = Math.max(3, Math.min(97, Math.round(dragTarget.origY + deltaY)));
        const sx = snapCenter(rawX);
        const sy = snapCenter(rawY);
        setSnapState({ x50: sx.snapped, y50: sy.snapped });
        onUpdateFloatingElement(dragTarget.id, {
          x: sx.v,
          y: sy.v,
        });
      }
    };

    const handleMouseUp = () => {
      setDragTarget(null);
      setSnapState({ x50: false, y50: false });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragTarget, onCommitHistory, onUpdateProduct, onUpdateTypography, onUpdatePromoBadge, onUpdateBadgesPosition, onUpdateFloatingElement]);

  // Fit artboard cleanly inside viewport height without clipping
  const getAspectRatioStyle = () => {
    switch (aspectRatio) {
      case '1:1':
        return 'h-[min(520px,calc(100vh-11.5rem))] max-w-[92vw] aspect-square';
      case '4:5':
        return 'h-[min(580px,calc(100vh-11.5rem))] max-w-[92vw] aspect-[4/5]';
      case '9:16':
        return 'h-[min(620px,calc(100vh-11.5rem))] max-w-[92vw] aspect-[9/16]';
      case '16:9':
        return 'w-[min(740px,92%)] aspect-[16/9]';
    }
  };

  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'sun':
        return <Sun className="w-3 h-3 text-white" />;
      case 'shield':
        return <Shield className="w-3 h-3 text-white" />;
      case 'droplet':
        return <Droplet className="w-3 h-3 text-white" />;
      case 'award':
        return <Award className="w-3 h-3 text-white" />;
      case 'zap':
        return <Zap className="w-3 h-3 text-white" />;
      case 'leaf':
        return <Leaf className="w-3 h-3 text-white" />;
      case 'clock':
        return <Clock className="w-3 h-3 text-white" />;
      default:
        return <Sparkles className="w-3 h-3 text-white" />;
    }
  };

  const clarityK = Number((Math.max(0, Math.min(1, product.clarity ?? 0)) * 0.45).toFixed(3));
  const clarityCenter = Number((1 + 4 * clarityK).toFixed(3));

  return (
    <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center p-3 sm:p-4 lg:p-5 overflow-y-auto bg-[#e9edf2] select-none">
      {/* Hidden SVG Unsharp Convolution Filter for Real Optical Product Clarity */}
      <svg className="sr-only" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="kapakai-product-clarity" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              kernelMatrix={`0 ${-clarityK} 0 ${-clarityK} ${clarityCenter} ${-clarityK} 0 ${-clarityK} 0`}
              preserveAlpha="true"
            />
          </filter>
        </defs>
      </svg>
      {/* Floating Canvas Quick Controls Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-slate-200/80 z-20 text-xs flex-shrink-0">
        <span className="text-slate-500 font-medium">Oran:</span>
        <span className="font-bold text-slate-800">{aspectRatio}</span>
        <div className="w-px h-3 bg-slate-200 mx-0.5" />
        <button
          onClick={() => {
            onCommitHistory?.();
            onUpdateProduct((p) => ({ ...p, x: 50, y: 55 }));
          }}
          className="text-slate-600 hover:text-orange-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
        >
          Ortala
        </button>
        <button
          onClick={() => {
            onCommitHistory?.();
            onUpdateProduct((p) => ({ ...p, flipX: !p.flipX }));
          }}
          className="text-slate-600 hover:text-orange-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors flex items-center gap-1"
        >
          <FlipHorizontal className="w-3 h-3" />
          <span>Aynala</span>
        </button>
        <button
          onClick={() => {
            onCommitHistory?.();
            onUpdateProduct((p) => ({ ...p, reflection: !p.reflection }));
          }}
          className={`font-medium px-2 py-0.5 rounded transition-colors ${
            product.reflection
              ? 'bg-orange-100 text-orange-700 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Zemin Yansıması
        </button>
        {onAlignGoldenRatio && (
          <>
            <div className="w-px h-3 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={onAlignGoldenRatio}
              disabled={isAligningProduct || !product.src}
              title="Ürünün ağırlık merkezini AI ile bulup Altın Oran noktasına hizala"
              className="text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {isAligningProduct ? (
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
              ) : (
                <Crosshair className="w-3 h-3 text-amber-600" />
              )}
              <span>{isAligningProduct ? 'Hizalanıyor...' : 'Altın Oran Hizala'}</span>
            </button>
          </>
        )}
        {onToggleGoldenGuide && (
          <button
            type="button"
            onClick={onToggleGoldenGuide}
            title="Altın Oran (φ = 1.618) kılavuz çizgilerini aç/kapat"
            aria-pressed={showGoldenGuide}
            className={`font-bold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 border ${
              showGoldenGuide
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Grid className="w-3 h-3" />
            <span>φ Kılavuz</span>
          </button>
        )}
        {onToggleSafeZone && (
          <button
            type="button"
            onClick={onToggleSafeZone}
            title="Instagram / Reels / TikTok platform güvenli alan sınırlarını göster"
            aria-pressed={showSafeZone}
            className={`font-bold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 border whitespace-nowrap ${
              showSafeZone
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Güvenli Alan</span>
          </button>
        )}
        {onOpenHarmonyTab && (
          <button
            type="button"
            onClick={onOpenHarmonyTab}
            title="Ürün renk tonlarına uygun arka plan ve tipografi harmonileri"
            className="text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 font-bold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <Palette className="w-3 h-3 text-orange-600" />
            <span>Renk Harmonisi</span>
          </button>
        )}
        {onOpenAutoFixTab && (
          <button
            type="button"
            onClick={onOpenAutoFixTab}
            title="Aydınlatma, kontrast, netlik ve e-ticaret kompozisyonunu tek tıkla optimize et"
            className="text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 font-bold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <Wand2 className="w-3 h-3 text-sky-600" />
            <span>Oto Optimizasyon</span>
          </button>
        )}
        {onOpenOptimizerTab && (
          <button
            type="button"
            onClick={onOpenOptimizerTab}
            title="Canlı reklam kalite denetimi ve A/B varyasyonları"
            className="text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Kalite & A/B</span>
          </button>
        )}
        {onOpenLayerTab && (
          <>
            <div className="w-px h-3 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={onOpenLayerTab}
              className="text-slate-700 hover:text-orange-600 font-bold px-2 py-0.5 rounded hover:bg-orange-50 transition-colors flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5 text-orange-600" />
              <span>Katmanlar ({layers.length})</span>
            </button>
          </>
        )}
        {onOpenAiChat && (
          <>
            <div className="w-px h-3 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={() => onOpenAiChat(mapActiveElementToArea(activeElement))}
              className="text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 font-bold px-2.5 py-0.5 rounded-full transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>
                AI: {getAreaMeta(mapActiveElementToArea(activeElement)).shortLabel} Düzenle
              </span>
            </button>
          </>
        )}
      </div>

      {/* Main Artboard Canvas */}
      <div
        ref={containerRef}
        data-testid="studio-artboard"
        onClick={() =>
          setActiveElement(activeElement === 'background' ? null : 'background')
        }
        onDragOver={(e) => {
          if (onDropProductFile && e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault();
            setIsFileHovering(true);
          }
        }}
        onDragLeave={() => setIsFileHovering(false)}
        onDrop={(e) => {
          if (!onDropProductFile) return;
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) {
            e.preventDefault();
            setIsFileHovering(false);
            onDropProductFile(file);
          } else {
            setIsFileHovering(false);
          }
        }}
        style={{
          transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
          transformOrigin: 'center center',
        }}
        className={`relative isolate shadow-2xl rounded-2xl overflow-hidden border transition-all mx-auto flex-shrink-0 bg-white ${
          isFileHovering
            ? 'border-amber-500 ring-4 ring-amber-400/50'
            : activeElement === 'background'
            ? 'border-purple-500 ring-2 ring-purple-400/50'
            : 'border-slate-300'
        } ${getAspectRatioStyle()}`}
      >
        {/* Dedicated Background Layer (isolated blur, brightness, contrast & saturation so foreground stays crisp!) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: background.gradient || '#f8fafc',
            filter:
              [
                background.blur > 0 ? `blur(${background.blur}px)` : '',
                `brightness(${background.brightness})`,
                background.contrast !== undefined && background.contrast !== 1
                  ? `contrast(${background.contrast})`
                  : '',
                background.saturation !== undefined && background.saturation !== 1
                  ? `saturate(${background.saturation})`
                  : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined,
            transform: background.blur > 0 ? 'scale(1.06)' : undefined,
          }}
        >
          {background.type === 'image' && background.imageUrl && (
            <img
              src={background.imageUrl}
              alt="Arka Plan"
              referrerPolicy="no-referrer"
              className={`w-full h-full ${
                background.fitMode === 'contain' ? 'object-contain' : 'object-cover'
              }`}
            />
          )}
        </div>

        {/* Optional Vignette */}
        {background.vignette && (
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.48)_100%)]" />
        )}

        {/* Stage Decor Layer: Champagne Arch & Marble Podium OR Festive Fairy Lights */}
        {background.stageStyle === 'champagne-arch' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Soft architectural pillars & central golden arch */}
            <div className="absolute inset-x-[12%] top-[28%] bottom-[8%] rounded-t-full bg-gradient-to-b from-amber-100/80 via-amber-50/45 to-transparent border border-amber-200/70 shadow-inner" />
            <div className="absolute left-[4%] top-0 bottom-0 w-[10%] bg-gradient-to-r from-amber-200/45 via-amber-100/20 to-transparent" />
            <div className="absolute right-[4%] top-0 bottom-0 w-[10%] bg-gradient-to-l from-amber-200/45 via-amber-100/20 to-transparent" />
            {/* Radial center spotlight */}
            <div className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 w-[72%] h-[42%] rounded-full bg-white/55 blur-2xl" />
            {/* Travertine / Marble Display Podium at bottom */}
            <div
              style={{
                background: 'linear-gradient(180deg, #fefce8 0%, #f5e6c8 45%, #d6b88c 100%)',
              }}
              className="absolute left-1/2 bottom-[2%] -translate-x-1/2 w-[90%] h-[11%] rounded-[50%] border-t-2 border-white/95 shadow-[0_12px_28px_rgba(120,53,15,0.28)]"
            >
              <div className="absolute inset-x-[6%] top-[18%] h-[2px] rounded-full bg-white/75" />
            </div>
          </div>
        )}

        {background.stageStyle === 'festive-lights' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Soft snowy hill base */}
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(226,232,240,0.92) 100%)',
              }}
              className="absolute -left-[8%] -right-[8%] -bottom-[12%] h-[24%] rounded-[50%] shadow-[0_-8px_24px_rgba(255,255,255,0.35)]"
            />
            {/* Top string fairy lights */}
            <svg viewBox="0 0 500 90" className="absolute top-0 left-0 w-full h-[22%] overflow-visible">
              <path
                d="M -10,8 Q 125,46 250,18 T 510,10"
                fill="none"
                stroke="rgba(254,240,138,0.55)"
                strokeWidth="2"
              />
              {[
                [35, 19],
                [82, 26],
                [135, 30],
                [190, 26],
                [248, 18],
                [308, 12],
                [366, 10],
                [424, 12],
                [472, 11],
              ].map(([bx, by], idx) => (
                <g key={idx}>
                  <circle cx={bx} cy={by + 4} r="13" fill="rgba(253,224,71,0.32)" />
                  <circle cx={bx} cy={by + 4} r="4.5" fill="#fef08a" />
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Floating Elements (Water splashes, 3D spheres, gold coins, etc.) */}
        {floatingElements.map((el) => {
          const visible = isLayerVisible('floating', el.id);
          const locked = isLayerLocked('floating', el.id);
          const zIndex = getLayerZIndex('floating', el.id);
          if (!visible) return null;

          return (
            <div
              key={el.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveElement(`floating:${el.id}`);
              }}
              onMouseDown={(e) => {
                if (locked) {
                  e.stopPropagation();
                  return;
                }
                startDrag(
                  e,
                  { kind: 'floating', id: el.id, startClientX: e.clientX, startClientY: e.clientY, origX: el.x, origY: el.y },
                  `floating:${el.id}`
                );
              }}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale})`,
                opacity: el.opacity,
                zIndex,
                cursor: locked ? 'default' : 'grab',
              }}
              className={`absolute transition-shadow ${
                activeElement === `floating:${el.id}` ? 'ring-2 ring-purple-500 rounded-full p-1' : ''
              }`}
            >
              {el.type === 'water-splash' && (
                <div className="relative pointer-events-none">
                  <div className="w-14 h-9 rounded-full bg-gradient-to-r from-white/90 via-sky-200/60 to-transparent blur-[1px] shadow-lg shadow-sky-400/20" />
                  <div className="absolute -top-3 left-2 w-2.5 h-2.5 rounded-full bg-white/90 shadow-sm" />
                  <div className="absolute top-7 right-1 w-3 h-3 rounded-full bg-sky-100/90 shadow-sm" />
                  <div className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-white/80" />
                </div>
              )}
              {el.type === 'gold-coin' && (
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-yellow-600 via-amber-300 to-yellow-100 shadow-xl border-2 border-yellow-100/80 flex items-center justify-center text-amber-950 font-black text-sm drop-shadow-md pointer-events-none">
                  %
                </div>
              )}
              {el.type === '3d-sphere' && (
                <div className="w-11 h-11 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffffff,#f43f5e_45%,#881337_100%)] shadow-2xl pointer-events-none" />
              )}
              {el.type === 'sparkle' && (
                <Sparkles className="w-7 h-7 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none" />
              )}
              {el.type === 'leaf' && (
                <div className="w-7 h-9 rounded-[50%_0_50%_0] bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg transform rotate-45 pointer-events-none" />
              )}
              {el.type === 'glow-ring' && (
                <div className="w-24 h-8 rounded-full border-2 border-cyan-400 shadow-[0_0_20px_#22d3ee] opacity-80 pointer-events-none" />
              )}
              {el.type === 'gold-ribbon' && (
                <svg
                  viewBox="0 0 80 80"
                  className="w-14 h-14 drop-shadow-[0_6px_12px_rgba(146,64,14,0.35)] pointer-events-none"
                >
                  <defs>
                    <linearGradient id={`rib-${el.id}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="45%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12,18 C28,6 54,14 48,34 C42,50 18,44 26,64 C32,74 56,70 68,54 C54,60 38,58 38,44 C38,30 62,36 66,18 C52,6 28,2 12,18 Z"
                    fill={`url(#rib-${el.id})`}
                    stroke="#fef9c3"
                    strokeWidth="1.2"
                  />
                </svg>
              )}
              {el.type === 'custom-sticker' && el.imageUrl && (
                <img
                  src={el.imageUrl}
                  alt={el.label || '3D AI Sticker'}
                  draggable={false}
                  className="w-28 h-28 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.32)] pointer-events-none select-none"
                />
              )}
            </div>
          );
        })}

        {/* Product Layer (Ambient Glow, Reflection, Shadow, and Main Cutout) */}
        {product.src && isLayerVisible('product') && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setActiveElement('product');
            }}
            onMouseDown={(e) => {
              if (isLayerLocked('product')) {
                e.stopPropagation();
                setActiveElement('product');
                return;
              }
              startDrag(
                e,
                { kind: 'product', startClientX: e.clientX, startClientY: e.clientY, origX: product.x, origY: product.y },
                'product'
              );
            }}
            style={{
              left: `${product.x}%`,
              top: `${product.y}%`,
              transform: `translate(-50%, -50%) rotate(${product.rotation}deg)`,
              cursor: isLayerLocked('product') ? 'default' : dragTarget?.kind === 'product' ? 'grabbing' : 'grab',
              zIndex: getLayerZIndex('product'),
            }}
            className="absolute flex flex-col items-center justify-center"
          >
            {/* Optional Ambient Glow */}
            {product.ambientGlow > 0 && (
              <div
                style={{
                  width: `${product.scale * 230}px`,
                  height: `${product.scale * 230}px`,
                  background: `radial-gradient(circle, ${product.glowColor || '#ffffff'} 0%, transparent 70%)`,
                  opacity: product.ambientGlow * 0.65,
                }}
                className="absolute rounded-full pointer-events-none blur-xl"
              />
            )}

            {/* Ground Contact Shadow */}
            {product.shadowOpacity > 0 && (
              <div
                style={{
                  width: `${product.scale * 190}px`,
                  height: `${product.scale * 28}px`,
                  bottom: `${-Math.min(18, product.shadowOffsetY * 0.6)}px`,
                  filter: `blur(${product.shadowBlur * 0.7}px)`,
                  opacity: product.shadowOpacity,
                }}
                className="absolute bg-black rounded-full pointer-events-none"
              />
            )}

            {/* Product Image */}
            <div
              data-clarity={clarityK > 0 ? String(product.clarity) : '0'}
              style={{
                transform: `scaleX(${product.flipX ? -1 : 1})`,
                filter: [
                  `brightness(${product.brightness})`,
                  `contrast(${product.contrast})`,
                  `saturate(${product.saturation})`,
                  clarityK > 0.005 ? 'url(#kapakai-product-clarity)' : '',
                ]
                  .filter(Boolean)
                  .join(' '),
              }}
              className="relative flex flex-col items-center"
            >
              <div className="relative inline-block">
                <img
                  src={product.src}
                  alt="Ürün"
                  draggable={false}
                  style={{
                    maxHeight: `${product.scale * 280}px`,
                    maxWidth: `${product.scale * 240}px`,
                  }}
                  className={`object-contain drop-shadow-xl select-none transition-shadow block ${
                    activeElement === 'product'
                      ? 'ring-2 ring-orange-500/85 ring-offset-2 ring-offset-transparent rounded-xl'
                      : ''
                  }`}
                />
                {showGoldenGuide && product.centerOfGravity && (
                  <div
                    data-testid="product-cog-marker"
                    style={{
                      left: `${product.centerOfGravity.x * 100}%`,
                      top: `${product.centerOfGravity.y * 100}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center justify-center"
                  >
                    <div className="w-7 h-7 rounded-full border-2 border-amber-300 bg-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.75)]" />
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white shadow-sm" />
                  </div>
                )}
              </div>

              {/* Realistic Ground Floor Mirror Reflection (out-of-flow so product center stays exact) */}
              {product.reflection && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pointer-events-none select-none">
                  <div
                    style={{
                      opacity: product.reflectionOpacity,
                      maxHeight: `${product.scale * 65}px`,
                      transform: 'scaleY(-1) translateY(2px)',
                      maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 85%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 85%)',
                    }}
                    className="overflow-hidden"
                  >
                    <img
                      src={product.src}
                      alt="Yansıma"
                      draggable={false}
                      style={{
                        maxHeight: `${product.scale * 280}px`,
                        maxWidth: `${product.scale * 240}px`,
                      }}
                      className="object-contain filter blur-[0.6px] block"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Drag Handle Indicator */}
            {activeElement === 'product' && (
              <div className="absolute -top-6 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 pointer-events-none whitespace-nowrap">
                {isLayerLocked('product') ? <Lock className="w-2.5 h-2.5" /> : <Move className="w-2.5 h-2.5" />}
                <span>{isLayerLocked('product') ? 'Kilitli' : 'Sürükle & Taşı'}</span>
              </div>
            )}
          </div>
        )}

        {/* Feature Badges (draggable!) */}
        {badges.length > 0 && isLayerVisible('badges') && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setActiveElement('badges');
            }}
            onMouseDown={(e) => {
              if (isLayerLocked('badges')) {
                e.stopPropagation();
                setActiveElement('badges');
                return;
              }
              startDrag(
                e,
                {
                  kind: 'badges',
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  origX: badgesPosition.x,
                  origY: badgesPosition.y,
                },
                'badges'
              );
            }}
            style={{
              left: `${badgesPosition.x}%`,
              top: `${badgesPosition.y}%`,
              zIndex: getLayerZIndex('badges'),
              cursor: isLayerLocked('badges') ? 'default' : 'grab',
            }}
            className={`absolute flex flex-col gap-1.5 max-w-[44%] transition-shadow ${
              activeElement === 'badges' ? 'ring-2 ring-emerald-500 rounded-xl p-1' : ''
            }`}
          >
            {badges.map((b) => (
              <div
                key={b.id}
                className="glass-panel px-2.5 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-white/70"
              >
                <div className="w-5 h-5 rounded-md bg-orange-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                  {getBadgeIcon(b.icon)}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight truncate">
                    {b.label}
                  </p>
                  {b.sublabel && (
                    <p className="text-[9px] text-slate-600 leading-tight truncate mt-0.5">
                      {b.sublabel}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Promo / Discount Badge (draggable!) */}
        {promoBadge.show && isLayerVisible('promoBadge') && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setActiveElement('promo');
            }}
            onMouseDown={(e) => {
              if (isLayerLocked('promoBadge')) {
                e.stopPropagation();
                setActiveElement('promo');
                return;
              }
              startDrag(
                e,
                {
                  kind: 'promo',
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  origX: promoBadge.x,
                  origY: promoBadge.y,
                },
                'promo'
              );
            }}
            style={{
              left: `${promoBadge.x}%`,
              top: `${promoBadge.y}%`,
              transform: `translate(-50%, -50%) rotate(${promoBadge.rotation}deg) scale(${promoBadge.scale})`,
              zIndex: getLayerZIndex('promoBadge'),
              cursor: isLayerLocked('promoBadge') ? 'default' : 'grab',
            }}
            className={`absolute transition-shadow ${
              activeElement === 'promo' ? 'ring-2 ring-orange-500 rounded-full' : ''
            }`}
          >
            {promoBadge.type === 'circle' ? (
              <div
                style={{ backgroundColor: promoBadge.color }}
                className="w-16 h-16 rounded-full shadow-xl flex flex-col items-center justify-center text-center p-1 border-2 border-white/80 drop-shadow-lg"
              >
                <span
                  style={{ color: promoBadge.textColor }}
                  className="text-xs font-black leading-tight uppercase"
                >
                  {promoBadge.text}
                </span>
                {promoBadge.subtext && (
                  <span
                    style={{ color: promoBadge.textColor }}
                    className="text-[9px] font-bold opacity-90 uppercase tracking-tighter"
                  >
                    {promoBadge.subtext}
                  </span>
                )}
              </div>
            ) : (
              <div
                style={{ backgroundColor: promoBadge.color }}
                className="px-3 py-1.5 rounded-xl shadow-lg flex flex-col items-center justify-center text-center border border-white/60 drop-shadow-md whitespace-nowrap"
              >
                <span
                  style={{ color: promoBadge.textColor }}
                  className="text-xs font-black uppercase leading-tight"
                >
                  {promoBadge.text}
                </span>
                {promoBadge.subtext && (
                  <span
                    style={{ color: promoBadge.textColor }}
                    className="text-[9px] font-bold opacity-90"
                  >
                    {promoBadge.subtext}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Typography Overlays (draggable!) */}
        {isLayerVisible('typography') && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setActiveElement('text');
            }}
            onMouseDown={(e) => {
              if (isLayerLocked('typography')) {
                e.stopPropagation();
                setActiveElement('text');
                return;
              }
              startDrag(
                e,
                {
                  kind: 'text',
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  origX: typography.positionX,
                  origY: typography.positionY,
                },
                'text'
              );
            }}
            style={{
              left: `${typography.positionX}%`,
              top: `${typography.positionY}%`,
              textAlign: typography.alignment,
              transform:
                typography.alignment === 'center'
                  ? 'translateX(-50%)'
                  : typography.alignment === 'right'
                  ? 'translateX(-100%)'
                  : 'none',
              width: typography.alignment === 'center' ? '82%' : '47%',
              zIndex: getLayerZIndex('typography'),
              cursor: isLayerLocked('typography') ? 'default' : 'grab',
            }}
            className={`absolute transition-shadow ${
              activeElement === 'text'
                ? 'ring-2 ring-orange-400 ring-offset-2 rounded-xl p-1.5 bg-white/15 backdrop-blur-[1px]'
                : ''
            }`}
          >
            {typography.plaqueStyle && typography.plaqueStyle !== 'none' ? (
              <div
                style={{
                  transform: `rotate(${typography.plaqueTilt ?? -2}deg)`,
                }}
                className="flex flex-col items-center"
              >
                <div
                  style={{
                    background:
                      typography.plaqueStyle === 'emerald-3d'
                        ? 'linear-gradient(180deg, #22c55e 0%, #15803d 48%, #14532d 100%)'
                        : typography.plaqueStyle === 'magenta-3d'
                        ? 'linear-gradient(180deg, #f43f8e 0%, #db2777 48%, #831843 100%)'
                        : 'linear-gradient(180deg, #ef4444 0%, #b91c1c 48%, #7f1d1d 100%)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.32)',
                  }}
                  className="relative overflow-hidden w-full px-5 py-3.5 rounded-2xl border-2 border-white/80 text-center"
                >
                  <div className="pointer-events-none absolute inset-x-4 top-0.5 h-[2px] rounded-full bg-white/75" />
                  <div className="pointer-events-none absolute inset-x-4 bottom-0.5 h-[2px] rounded-full bg-black/25" />
                  {typography.kicker && (
                    <p
                      style={{ color: typography.ctaTextColor || '#ffffff' }}
                      className="text-xs sm:text-sm font-black uppercase tracking-wider mb-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]"
                    >
                      {typography.kicker}
                    </p>
                  )}
                  {typography.headline && (
                    <h2
                      style={{
                        color: typography.headlineColor || '#fde047',
                        fontSize: `${typography.headlineSize * 2.15}rem`,
                        fontFamily: typography.fontFamily,
                        lineHeight: 0.98,
                        textShadow: '0 3px 0 rgba(0,0,0,0.35), 0 6px 14px rgba(0,0,0,0.35)',
                      }}
                      className="font-black tracking-tight break-words uppercase"
                    >
                      {typography.headline}
                      {typography.headlineHighlight && (
                        <span
                          style={{ color: typography.highlightColor || '#ffffff' }}
                          className="block mt-0.5 text-[0.72em]"
                        >
                          {typography.headlineHighlight}
                        </span>
                      )}
                    </h2>
                  )}
                  {!typography.subtitlePill && typography.subtitle && (
                    <p
                      style={{ color: typography.subtitleColor || '#ffffff' }}
                      className="text-xs sm:text-sm mt-1 font-extrabold uppercase tracking-wide drop-shadow-xs"
                    >
                      {typography.subtitle}
                    </p>
                  )}
                </div>

                {typography.subtitlePill && typography.subtitle && (
                  <div className="-mt-2 px-4 py-1.5 rounded-xl bg-amber-50/95 border border-amber-200/90 shadow-md">
                    <p
                      style={{ color: typography.subtitleColor || '#450a0a' }}
                      className="text-[11px] sm:text-xs font-black uppercase tracking-wide"
                    >
                      {typography.subtitle}
                    </p>
                  </div>
                )}

                {typography.showCta && typography.ctaText && (
                  <div className="mt-2.5">
                    <span
                      style={{
                        background:
                          typography.ctaBgColor === '#15803d'
                            ? 'linear-gradient(180deg, #4ade80 0%, #15803d 55%, #14532d 100%)'
                            : typography.ctaBgColor,
                        color: typography.ctaTextColor,
                        boxShadow: '0 6px 14px rgba(0,0,0,0.3)',
                      }}
                      className="inline-block px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase border border-white/70"
                    >
                      {typography.ctaText}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Kicker */}
                {typography.kicker && (
                  <p
                    style={{ color: typography.highlightColor }}
                    className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1 drop-shadow-xs"
                  >
                    {typography.kicker}
                  </p>
                )}

                {/* Headline */}
                {typography.headline && (
                  <h2
                    style={{
                      color: typography.headlineColor,
                      fontSize: `${typography.headlineSize * 1.9}rem`,
                      fontFamily: typography.fontFamily,
                      lineHeight: 1.04,
                    }}
                    className="font-extrabold tracking-tight drop-shadow-xs break-words"
                  >
                    {typography.headline}
                    {typography.headlineHighlight && (
                      <span
                        style={{ color: typography.highlightColor }}
                        className="block mt-0.5"
                      >
                        {typography.headlineHighlight}
                      </span>
                    )}
                  </h2>
                )}

                {/* Subtitle */}
                {typography.subtitle && (
                  <p
                    style={{ color: typography.subtitleColor }}
                    className="text-[11px] sm:text-xs mt-1.5 font-medium opacity-90 line-clamp-3 drop-shadow-xs"
                  >
                    {typography.subtitle}
                  </p>
                )}

                {/* CTA Button */}
                {typography.showCta && typography.ctaText && (
                  <div className="mt-2.5">
                    <span
                      style={{
                        background:
                          background.stageStyle === 'festive-lights' ||
                          typography.ctaBgColor === '#15803d'
                            ? 'linear-gradient(180deg, #4ade80 0%, #15803d 52%, #14532d 100%)'
                            : typography.ctaBgColor,
                        color: typography.ctaTextColor,
                        boxShadow:
                          background.stageStyle === 'festive-lights' ||
                          typography.ctaBgColor === '#15803d'
                            ? '0 8px 18px rgba(0,0,0,0.38)'
                            : undefined,
                      }}
                      className={`inline-block px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-wider uppercase shadow-md ${
                        background.stageStyle === 'festive-lights' ||
                        typography.ctaBgColor === '#15803d'
                          ? 'border border-white/75'
                          : ''
                      }`}
                    >
                      {typography.ctaText}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Golden Ratio Overlay Guide (non-interactive, excluded from exports) */}
        {showGoldenGuide && (
          <div
            data-testid="golden-ratio-overlay"
            className="absolute inset-0 pointer-events-none z-[90]"
          >
            {/* Vertical Golden Lines (38.2% & 61.8%) */}
            <div
              style={{ left: '38.197%' }}
              className="absolute top-0 bottom-0 w-px bg-amber-400/70 border-l border-dashed border-amber-300"
            />
            <div
              style={{ left: '61.803%' }}
              className="absolute top-0 bottom-0 w-px bg-amber-400/70 border-l border-dashed border-amber-300"
            />
            {/* Horizontal Golden Lines (38.2% & 61.8%) */}
            <div
              style={{ top: '38.197%' }}
              className="absolute left-0 right-0 h-px bg-amber-400/70 border-t border-dashed border-amber-300"
            />
            <div
              style={{ top: '61.803%' }}
              className="absolute left-0 right-0 h-px bg-amber-400/70 border-t border-dashed border-amber-300"
            />

            {/* 4 Golden Power Intersections */}
            {[
              { x: 38.197, y: 38.197 },
              { x: 61.803, y: 38.197 },
              { x: 38.197, y: 61.803 },
              { x: 61.803, y: 61.803 },
            ].map((pt, i) => (
              <div
                key={i}
                style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-amber-300/90 bg-amber-400/20"
              />
            ))}

            {/* Active Golden Target Label */}
            {product.centerOfGravity?.goldenTarget && (
              <div
                style={{
                  left: `${product.centerOfGravity.goldenTarget.x}%`,
                  top: `${product.centerOfGravity.goldenTarget.y}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <div className="w-5 h-5 rounded-full border-2 border-white shadow-md bg-amber-500/35" />
              </div>
            )}

            <div className="absolute bottom-2.5 right-2.5 bg-slate-900/80 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/40 backdrop-blur-xs">
              Altın Oran φ = 1.618
            </div>
          </div>
        )}

        {/* Brand Corner Watermark (rendered both on canvas and high-res exports) */}
        {brandWatermark &&
          brandWatermark.show &&
          (brandWatermark.brandName.trim() || brandWatermark.logoUrl) && (
            <div
              data-testid="brand-watermark-badge"
              style={{ opacity: brandWatermark.opacity }}
              className={`absolute pointer-events-none z-[85] px-2.5 py-1 rounded-full border backdrop-blur-xs flex items-center gap-1.5 ${
                brandWatermark.position === 'top-left'
                  ? 'top-[3.8%] left-[4.5%]'
                  : brandWatermark.position === 'top-right'
                  ? 'top-[3.8%] right-[4.5%]'
                  : brandWatermark.position === 'bottom-left'
                  ? 'bottom-[3.8%] left-[4.5%]'
                  : 'bottom-[3.8%] right-[4.5%]'
              } ${
                brandWatermark.theme === 'dark'
                  ? 'bg-slate-900/75 text-white border-white/20'
                  : 'bg-white/85 text-slate-900 border-slate-900/10'
              }`}
            >
              {brandWatermark.logoUrl && (
                <img
                  src={brandWatermark.logoUrl}
                  alt={brandWatermark.brandName || 'Marka Logosu'}
                  className="w-4 h-4 object-contain"
                />
              )}
              {brandWatermark.brandName.trim() && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider leading-none">
                  {brandWatermark.brandName.trim()}
                </span>
              )}
            </div>
          )}

        {/* Smart Center Snap Alignment Guides during Drag */}
        {dragTarget && (snapState.x50 || snapState.y50) && (
          <div className="absolute inset-0 pointer-events-none z-[92]">
            {snapState.x50 && (
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-fuchsia-500 shadow-[0_0_6px_rgba(217,70,239,0.8)]" />
            )}
            {snapState.y50 && (
              <div className="absolute top-1/2 left-0 right-0 h-px bg-fuchsia-500 shadow-[0_0_6px_rgba(217,70,239,0.8)]" />
            )}
          </div>
        )}

        {/* Platform Safe-Zone Guide Overlay (excluded from exports) */}
        {showSafeZone && (
          <div
            data-testid="safe-zone-overlay"
            className="absolute inset-0 pointer-events-none z-[91]"
          >
            {aspectRatio === '9:16' ? (
              <>
                <div className="absolute inset-x-0 top-0 h-[13%] bg-rose-950/35 border-b border-dashed border-rose-300/80 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-rose-100 bg-slate-900/75 px-2 py-0.5 rounded">
                    Hikaye / Reels Profil Alanı (%13)
                  </span>
                </div>
                <div className="absolute right-0 top-[46%] bottom-[18%] w-[13%] bg-rose-950/25 border-l border-dashed border-rose-300/70 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-rose-100 -rotate-90 whitespace-nowrap">
                    Etkileşim İkonları
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[18%] bg-rose-950/35 border-t border-dashed border-rose-300/80 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-rose-100 bg-slate-900/75 px-2 py-0.5 rounded">
                    Açıklama & Yanıt Barı (%18)
                  </span>
                </div>
              </>
            ) : (
              <div className="absolute inset-[5%] border border-dashed border-sky-400/90 rounded-lg">
                <span className="absolute top-1.5 right-2 text-[9px] font-bold text-white bg-slate-900/75 px-1.5 py-0.5 rounded">
                  Güvenli Çerçeve (%90)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Drag-Drop Direct Product Import Overlay */}
        {isFileHovering && (
          <div className="absolute inset-0 z-[95] bg-amber-500/20 backdrop-blur-xs border-2 border-dashed border-amber-400 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/90 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl">
              Görseli Bırakın: AI Ağırlık Merkezi & Altın Oran Hizalama
            </div>
          </div>
        )}
      </div>

      {/* Bottom Stage Helper Bar: Keyboard Nudge Hint & Zoom Controls */}
      <div className="mt-3 flex items-center justify-between gap-3 px-3 py-1 rounded-lg bg-white/90 border border-slate-200/80 text-[11px] text-slate-600 z-20">
        <span className="hidden sm:inline">
          Ok tuşları: Hassas kaydır (%1) · Shift+Ok: Hızlı kaydır (%5)
        </span>
        <div className="flex items-center gap-1 tabular-nums">
          <button
            type="button"
            aria-label="Uzaklaştır"
            onClick={() => setZoomScale((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))))}
            className="p-1 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomScale(1)}
            title="Yakınlaştırmayı %100 sıfırla"
            className="px-1.5 py-0.5 rounded hover:bg-slate-100 font-mono font-bold text-slate-800"
          >
            %{Math.round(zoomScale * 100)}
          </button>
          <button
            type="button"
            aria-label="Yakınlaştır"
            onClick={() => setZoomScale((z) => Math.min(1.2, Number((z + 0.1).toFixed(2))))}
            className="p-1 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
