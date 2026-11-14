import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Sliders,
  Scissors,
  Check,
  Download,
  RefreshCw,
  Paintbrush,
  Eraser,
  Undo2,
  Wand2,
} from 'lucide-react';
import {
  removeBackgroundClient,
  loadImage,
  sourceToBase64,
  autoCropCutout,
  magicWandEraseOnCanvas,
} from '../utils/backgroundRemoval';
import { detectProductCenterOfGravity } from '../utils/productAlignment';
import type { ProductCenterOfGravity } from '../types';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';

interface ProductUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSourceUrl?: string;
  onSelectCutout: (
    cutoutUrl: string,
    originalUrl: string,
    precomputedCog?: ProductCenterOfGravity | null
  ) => void;
}

export const ProductUploaderModal: React.FC<ProductUploaderModalProps> = ({
  isOpen,
  onClose,
  initialSourceUrl,
  onSelectCutout,
}) => {
  const [selectedSource, setSelectedSource] = useState<string>(
    initialSourceUrl || SAMPLE_PRODUCTS[0].src
  );
  const [cutoutResult, setCutoutResult] = useState<string | null>(null);
  const [uncroppedCutout, setUncroppedCutout] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [tolerance, setTolerance] = useState<number>(28);
  const [feather, setFeather] = useState<number>(1.5);
  const [bgMode, setBgMode] = useState<'smart-flood' | 'global-color'>('smart-flood');
  const [previewBg, setPreviewBg] = useState<'transparent' | 'white' | 'gray' | 'beige' | 'dark'>('transparent');
  const [activeTab, setActiveTab] = useState<'compare' | 'cutout' | 'touchup' | 'original'>('compare');
  const [splitPos, setSplitPos] = useState<number>(50);
  const [isAiCleaning, setIsAiCleaning] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Brush / Touch-up tool state
  const [brushMode, setBrushMode] = useState<'erase' | 'restore' | 'wand'>('erase');
  const [brushSize, setBrushSize] = useState<number>(28);
  const [touchUndoCount, setTouchUndoCount] = useState<number>(0);
  const [detectedCog, setDetectedCog] = useState<ProductCenterOfGravity | null>(null);
  const [isDetectingCog, setIsDetectingCog] = useState<boolean>(false);

  const touchCanvasRef = useRef<HTMLCanvasElement>(null);
  const touchHistoryRef = useRef<ImageData[]>([]);
  const origImgRef = useRef<HTMLImageElement | null>(null);
  const isPaintingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const autoCutoutTokenRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial source when modal opens with a custom product
  useEffect(() => {
    if (isOpen && initialSourceUrl) {
      setSelectedSource(initialSourceUrl);
    }
  }, [isOpen, initialSourceUrl]);

  // Preload original HTMLImageElement for instant synchronous restore brush
  useEffect(() => {
    if (!selectedSource || !isOpen) return;
    let cancelled = false;
    loadImage(selectedSource)
      .then((img) => {
        if (!cancelled) origImgRef.current = img;
      })
      .catch(() => {
        if (!cancelled) origImgRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSource, isOpen]);

  // Auto-process whenever selectedSource, tolerance, feather or bgMode change
  useEffect(() => {
    if (!selectedSource || !isOpen) return;

    let isCancelled = false;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      try {
        const res = await removeBackgroundClient(selectedSource, {
          tolerance,
          feather,
          mode: bgMode,
        });
        if (!isCancelled) {
          setCutoutResult(res.cutoutDataUrl);
          setUncroppedCutout(res.uncroppedCutoutDataUrl);
          touchHistoryRef.current = [];
          setTouchUndoCount(0);
          autoCutoutTokenRef.current += 1;
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Cutout processing error:', err);
        if (!isCancelled) setIsProcessing(false);
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [selectedSource, tolerance, feather, bgMode, isOpen]);

  // Automatically detect visual Center of Gravity via AI whenever the cutout updates
  useEffect(() => {
    if (!cutoutResult || !isOpen) return;
    let cancelled = false;
    setIsDetectingCog(true);

    detectProductCenterOfGravity(cutoutResult)
      .then(({ centerOfGravity }) => {
        if (!cancelled) {
          setDetectedCog(centerOfGravity);
        }
      })
      .catch(() => {
        if (!cancelled) setDetectedCog(null);
      })
      .finally(() => {
        if (!cancelled) setIsDetectingCog(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cutoutResult, isOpen]);

  // Sync touch-up canvas ONLY when tab becomes 'touchup' or a fresh auto-cutout completes
  useEffect(() => {
    if (activeTab !== 'touchup' || !uncroppedCutout || !touchCanvasRef.current) return;
    const canvas = touchCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;
    loadImage(uncroppedCutout)
      .then((img) => {
        if (cancelled) return;
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      })
      .catch((err) => console.error('Touch canvas sync error:', err));

    return () => {
      cancelled = true;
    };
    // Intentionally depend on uncroppedCutout & activeTab (uncroppedCutout is not overwritten mid-stroke)
  }, [activeTab, uncroppedCutout]);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setSelectedSource(result);
        setAiError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // AI Background Cleaning via Gemini (converts bundled URLs to base64 first!)
  const handleAiCleanBackground = async () => {
    setIsAiCleaning(true);
    setAiError(null);
    try {
      const { base64 } = await sourceToBase64(selectedSource);
      const res = await fetch('/api/ai/clean-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          targetBackground: 'white',
        }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setSelectedSource(data.imageUrl);
        setBgMode('smart-flood');
        setTolerance(26);
        setFeather(1.5);
      } else {
        setAiError(data.error || 'AI ile temizleme başarısız oldu');
      }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Bağlantı hatası');
    } finally {
      setIsAiCleaning(false);
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = touchCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      scaleX,
    };
  };

  const pushTouchHistory = () => {
    const canvas = touchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    touchHistoryRef.current = [...touchHistoryRef.current.slice(-14), snap];
    setTouchUndoCount(touchHistoryRef.current.length);
  };

  const commitTouchCanvasToCutout = async () => {
    const canvas = touchCanvasRef.current;
    if (!canvas) return;
    const rawUrl = canvas.toDataURL('image/png');
    setUncroppedCutout(rawUrl);
    try {
      const cropped = await autoCropCutout(rawUrl, 12);
      setCutoutResult(cropped);
    } catch {
      setCutoutResult(rawUrl);
    }
  };

  const handleTouchUndo = async () => {
    const canvas = touchCanvasRef.current;
    if (!canvas || touchHistoryRef.current.length === 0) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const prev = touchHistoryRef.current[touchHistoryRef.current.length - 1];
    touchHistoryRef.current = touchHistoryRef.current.slice(0, -1);
    setTouchUndoCount(touchHistoryRef.current.length);
    ctx.putImageData(prev, 0, 0);
    await commitTouchCanvasToCutout();
  };

  const drawBrushStroke = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    radius: number
  ) => {
    const canvas = touchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(2, radius * 0.25);
    const count = Math.max(1, Math.ceil(dist / step));

    for (let i = 0; i <= count; i++) {
      const t = count === 0 ? 0 : i / count;
      const px = from.x + (to.x - from.x) * t;
      const py = from.y + (to.y - from.y) * t;

      ctx.save();
      if (brushMode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (brushMode === 'restore' && origImgRef.current) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(origImgRef.current, 0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
    }
  };

  const handleTouchMouseDown = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (!pt || !touchCanvasRef.current) return;

    pushTouchHistory();

    if (brushMode === 'wand') {
      magicWandEraseOnCanvas(
        touchCanvasRef.current,
        pt.x,
        pt.y,
        Math.max(18, Math.min(60, tolerance))
      );
      await commitTouchCanvasToCutout();
      return;
    }

    isPaintingRef.current = true;
    lastPointRef.current = { x: pt.x, y: pt.y };
    drawBrushStroke(pt, pt, (brushSize * pt.scaleX) / 2);
  };

  const handleTouchMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintingRef.current || brushMode === 'wand') return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const prev = lastPointRef.current || { x: pt.x, y: pt.y };
    drawBrushStroke(prev, pt, (brushSize * pt.scaleX) / 2);
    lastPointRef.current = { x: pt.x, y: pt.y };
  };

  const handleTouchMouseEnd = async () => {
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;
    lastPointRef.current = null;
    await commitTouchCanvasToCutout();
  };

  const handleApplyToStudio = async () => {
    let finalCutout = cutoutResult;
    let cogToPass: ProductCenterOfGravity | null | undefined = detectedCog;
    if (activeTab === 'touchup' && touchCanvasRef.current) {
      finalCutout = await autoCropCutout(touchCanvasRef.current.toDataURL('image/png'), 12);
      cogToPass = undefined; // Re-detect on edited cutout
    }
    if (finalCutout) {
      onSelectCutout(finalCutout, selectedSource, cogToPass);
      onClose();
    } else {
      onSelectCutout(selectedSource, selectedSource, null);
      onClose();
    }
  };

  const handleDownloadCutout = () => {
    if (!cutoutResult) return;
    const link = document.createElement('a');
    link.download = `urun-seffaf-dekupe-${Date.now()}.png`;
    link.href = cutoutResult;
    link.click();
  };

  const handleDownloadWhiteBackground = async () => {
    if (!cutoutResult) return;
    const img = await loadImage(cutoutResult);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 1200);

    const maxDim = 840;
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    let targetW = maxDim;
    let targetH = maxDim;
    if (naturalW > naturalH) {
      targetH = (naturalH * maxDim) / naturalW;
    } else {
      targetW = (naturalW * maxDim) / naturalH;
    }

    const posX = (1200 - targetW) / 2;
    const posY = (1200 - targetH) / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 16;
    ctx.drawImage(img, posX, posY, targetW, targetH);

    const link = document.createElement('a');
    link.download = `urun-beyaz-fon-eticaret-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  const getPreviewBgStyle = () => {
    switch (previewBg) {
      case 'white':
        return 'bg-white';
      case 'gray':
        return 'bg-slate-100';
      case 'beige':
        return 'bg-[#faf6ed]';
      case 'dark':
        return 'bg-slate-900';
      default:
        return 'bg-transparency-grid';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ürün Arka Fon Temizleme Stüdyosu"
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Ürün Arka Fon Temizleme Stüdyosu
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  Otomatik Dekupe
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Fotoğraflarınızdaki arka planı temizleyin, kenarları rötuşlayın veya saf beyaz e-ticaret görseli üretin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dekupe Stüdyosunu Kapat"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          {/* Left Controls Column */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Upload Dropzone */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
              className={`border-2 border-dashed rounded-xl p-4 sm:p-5 cursor-pointer transition-all flex flex-col items-center justify-center text-center group w-full ${
                isDraggingFile
                  ? 'border-orange-600 bg-orange-100/60 scale-[1.01]'
                  : 'border-orange-300 hover:border-orange-500 bg-orange-50/20 hover:bg-orange-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-11 h-11 rounded-xl bg-white shadow-sm border border-orange-200 text-orange-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                Ürün Fotoğrafı Yükle veya Sürükle-Bırak
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                PNG, JPG, WebP desteklenir
              </p>
            </button>

            {/* AI Stüdyo Beyaz Fon Butonu */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-500/10 via-orange-500/10 to-amber-500/10 border border-orange-200/90 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800">
                  Gemini AI ile Karmaşık Arka Fonu Temizle
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Karmaşık dış mekan veya masa arka planlarını yapay zeka ile ayırıp ardından otomatik şeffaf PNG’ye çevirir.
              </p>
              <button
                type="button"
                onClick={handleAiCleanBackground}
                disabled={isAiCleaning}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isAiCleaning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Yapay Zeka Arka Fonu Temizliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gemini AI ile Temizle</span>
                  </>
                )}
              </button>
              {aiError && (
                <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
                  {aiError}
                </p>
              )}
            </div>

            {/* Sample Products Picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Örnek Stüdyo Ürünleri
                </span>
                <span className="text-[11px] text-orange-600 font-semibold">
                  {SAMPLE_PRODUCTS.length} Örnek
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_PRODUCTS.map((prod) => (
                  <button
                    type="button"
                    key={prod.id}
                    onClick={() => {
                      setSelectedSource(prod.src);
                      setAiError(null);
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      selectedSource === prod.src
                        ? 'border-orange-500 bg-orange-50/50 shadow-sm ring-1 ring-orange-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <img
                      src={prod.src}
                      alt={prod.name}
                      className="w-9 h-9 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {prod.category}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cutout Precision Sliders */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-col gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Dekupe Modu
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBgMode('smart-flood')}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      bgMode === 'smart-flood'
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Akıllı Sınır (İç Koru)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgMode('global-color')}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      bgMode === 'global-color'
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    İç Boşlukları da Sil
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-orange-600" />
                    Kesim Hassasiyeti (Tolerans)
                  </span>
                  <span className="text-xs font-mono font-bold text-orange-600">
                    {tolerance}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Kesim Hassasiyeti"
                  min="10"
                  max="75"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="accent-orange-600 w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">
                    Kenar Yumuşatma (Feather)
                  </span>
                  <span className="text-xs font-mono font-bold text-orange-600">
                    {feather}px
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Kenar Yumuşatma"
                  min="0"
                  max="5"
                  step="0.5"
                  value={feather}
                  onChange={(e) => setFeather(Number(e.target.value))}
                  className="accent-orange-600 w-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Live Preview & Interactive Work Canvas */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* Top Toolbar: View Tabs & Background Swatches */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('compare')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'compare'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Önce / Sonra
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cutout')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'cutout'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Temizlenmiş Görsel
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('touchup')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                    activeTab === 'touchup'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Paintbrush className="w-3 h-3 text-orange-600" />
                  <span>Rötuş & Sihirli Silgi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('original')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'original'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Orijinal
                </button>
              </div>

              {/* Background Color Swatches */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <span className="text-[10px] text-slate-500 font-bold px-1.5">Zemin:</span>
                {[
                  { id: 'transparent', title: 'Şeffaf (PNG)', cls: 'bg-transparency-grid' },
                  { id: 'white', title: 'Saf Beyaz', cls: 'bg-white' },
                  { id: 'gray', title: 'Stüdyo Grisi', cls: 'bg-slate-200' },
                  { id: 'beige', title: 'Sıcak Bej', cls: 'bg-[#faf6ed]' },
                  { id: 'dark', title: 'Karanlık Zemin', cls: 'bg-slate-900' },
                ].map((sw) => (
                  <button
                    type="button"
                    key={sw.id}
                    onClick={() => setPreviewBg(sw.id as typeof previewBg)}
                    title={sw.title}
                    aria-label={`Önizleme zemini: ${sw.title}`}
                    className={`w-6 h-6 rounded-lg border ${sw.cls} transition-all ${
                      previewBg === sw.id ? 'ring-2 ring-orange-500 scale-105' : 'border-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Brush Controls if touchup is active */}
            {activeTab === 'touchup' && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-orange-50/70 border border-orange-200 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBrushMode('erase')}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                      brushMode === 'erase'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Sil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushMode('restore')}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                      brushMode === 'restore'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    <span>Geri Yükle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushMode('wand')}
                    className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                      brushMode === 'wand'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Sihirli Değnek</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTouchUndo}
                    disabled={touchUndoCount === 0}
                    className="px-2 py-1 rounded-lg font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Geri Al</span>
                  </button>
                </div>

                {brushMode !== 'wand' && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">Boyut:</span>
                    <input
                      type="range"
                      aria-label="Rötuş Fırça Boyutu"
                      min="8"
                      max="70"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-24 accent-orange-600 cursor-pointer"
                    />
                    <span className="font-mono text-orange-600 font-bold">{brushSize}px</span>
                  </div>
                )}
              </div>
            )}

            {/* Main Interactive Preview Container */}
            <div
              className={`relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-300 select-none flex items-center justify-center transition-colors ${getPreviewBgStyle()}`}
            >
              {isProcessing && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg">
                    <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
                    <span>Arka Fon Otomatik Temizleniyor...</span>
                  </div>
                </div>
              )}

              {/* View 1: Cutout */}
              {activeTab === 'cutout' && cutoutResult && (
                <div className="relative inline-flex items-center justify-center max-h-full max-w-full p-4">
                  <div className="relative inline-block">
                    <img
                      src={cutoutResult}
                      alt="Temizlenmiş Ürün"
                      className="max-h-72 sm:max-h-80 max-w-full object-contain drop-shadow-xl block"
                    />
                    {detectedCog && (
                      <div
                        style={{
                          left: `${detectedCog.x * 100}%`,
                          top: `${detectedCog.y * 100}%`,
                        }}
                        title={detectedCog.rationale || 'AI Ağırlık Merkezi'}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center"
                      >
                        <div className="w-6 h-6 rounded-full border-2 border-amber-400 bg-orange-600/30 shadow-md" />
                        <div className="absolute w-2 h-2 rounded-full bg-orange-600 border border-white" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* View 2: Original */}
              {activeTab === 'original' && (
                <img
                  src={selectedSource}
                  alt="Orijinal Görsel"
                  className="max-h-full max-w-full object-contain p-4"
                />
              )}

              {/* View 3: Before / After Split Slider */}
              {activeTab === 'compare' && (
                <div className="relative w-full h-full flex items-center justify-center">
                  {cutoutResult && (
                    <img
                      src={cutoutResult}
                      alt="Temizlenmiş"
                      className="max-h-full max-w-full object-contain p-4"
                    />
                  )}

                  <div
                    className="absolute inset-0 overflow-hidden flex items-center justify-center"
                    style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                  >
                    <img
                      src={selectedSource}
                      alt="Orijinal"
                      className="max-h-full max-w-full object-contain p-4"
                    />
                  </div>

                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl flex items-center justify-center pointer-events-none"
                    style={{ left: `${splitPos}%` }}
                  >
                    <div className="w-6 h-6 rounded-full bg-white shadow-md border border-slate-300 flex items-center justify-center text-[10px] text-slate-800 font-bold">
                      ↔
                    </div>
                  </div>

                  <input
                    type="range"
                    aria-label="Önce Sonra Karşılaştırma Kaydırıcısı"
                    min="0"
                    max="100"
                    value={splitPos}
                    onChange={(e) => setSplitPos(Number(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-10"
                  />

                  <div className="absolute top-3 left-3 bg-slate-900/75 text-white text-[11px] px-2 py-0.5 rounded-md pointer-events-none">
                    Orijinal Arka Fon
                  </div>
                  <div className="absolute top-3 right-3 bg-orange-600/90 text-white text-[11px] px-2 py-0.5 rounded-md pointer-events-none flex items-center gap-1 font-bold">
                    <Check className="w-3 h-3" />
                    <span>Fon Temizlendi</span>
                  </div>
                </div>
              )}

              {/* View 4: Touch-up Canvas (no padding on canvas element itself so mouse coords map 1:1) */}
              {activeTab === 'touchup' && (
                <div className="relative w-full h-full p-4 flex items-center justify-center">
                  <canvas
                    ref={touchCanvasRef}
                    onMouseDown={handleTouchMouseDown}
                    onMouseMove={handleTouchMouseMove}
                    onMouseUp={handleTouchMouseEnd}
                    onMouseLeave={handleTouchMouseEnd}
                    className="max-h-full max-w-full block cursor-crosshair"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                    {brushMode === 'wand'
                      ? 'Sihirli Değnek: Silmek istediğiniz kapalı beyaz/renkli alana tıklayın'
                      : 'Fırça ile istenmeyen lekeleri silin veya eksik kenarları geri boyayın'}
                  </div>
                </div>
              )}
            </div>

            {/* Information Checklist */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Kenar Koruyucu Dekupe</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Altın Oran Hizalama</span>
                </div>
              </div>
              <div
                data-testid="uploader-cog-status"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold"
              >
                <Sparkles className="w-3 h-3 text-amber-600 flex-shrink-0" />
                {isDetectingCog ? (
                  <span>AI Ağırlık Merkezi Hesaplanıyor...</span>
                ) : detectedCog ? (
                  <span>
                    Ağırlık Merkezi: %{Math.round(detectedCog.x * 100)}, %
                    {Math.round(detectedCog.y * 100)} (
                    {detectedCog.source === 'ai' ? 'AI' : 'Piksel'})
                  </span>
                ) : (
                  <span>Ağırlık Merkezi Hazır</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadCutout}
              disabled={!cutoutResult}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Şeffaf PNG İndir</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadWhiteBackground}
              disabled={!cutoutResult}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-orange-600" />
              <span>Beyaz Fonlu İndir (JPG)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                onSelectCutout(selectedSource, selectedSource, null);
                onClose();
              }}
              className="px-3 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:bg-slate-200/60 transition-colors"
            >
              Silmeden Kullan
            </button>

            <button
              type="button"
              onClick={handleApplyToStudio}
              disabled={!cutoutResult && !selectedSource}
              className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Kapak Stüdyosuna Aktar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
