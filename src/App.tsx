import React, { useState, useEffect, useCallback } from 'react';
import {
  AbCampaignVariation,
  AspectRatio,
  BrandKit,
  BrandWatermark,
  CanvasLayer,
  CoverTemplate,
  ExportImageFormat,
  FeatureBadge,
  FloatingElement,
  HistoryItem,
  ProductCenterOfGravity,
  ProductPlacement,
  PromoBadge,
  SavedProject,
  StudioBackground,
  StudioTypography,
  EditableAreaId,
  AiChatMessage,
  StudioPatch,
} from './types';
import { COVER_TEMPLATES } from './data/templates';
import { SAMPLE_PRODUCTS } from './data/sampleProducts';
import { removeBackgroundClient } from './utils/backgroundRemoval';
import { renderHighResCover } from './utils/exportCanvas';
import { createSnapshot, pushUndoPast, applyUndo, applyRedo } from './utils/history';
import { applyStudioPatch, mapActiveElementToArea, StudioEditableState } from './utils/aiPatch';
import { applyModeLayerVisibility } from './utils/aiCreative';
import { alignProductWithGoldenRatio } from './utils/productAlignment';
import { adaptStateToAspectRatio } from './utils/campaignPack';
import { ensureReadableTextColor } from './utils/colorHarmony';
import type { GoldenPresetId } from './utils/goldenRatio';
import type { ColorHarmonyRecommendation } from './utils/colorHarmony';
import type { ApplyHarmonyScope } from './components/ColorHarmonyPanel';
import { Header } from './components/Header';
import { StudioCanvas } from './components/StudioCanvas';
import { SidebarTabs, SidebarTabId } from './components/SidebarTabs';
import { ProductUploaderModal } from './components/ProductUploaderModal';
import { AiWizardModal } from './components/AiWizardModal';
import { MultiChannelModal } from './components/MultiChannelModal';
import { CheckCircle2 } from 'lucide-react';

function getFloatingLabel(type: string): string {
  switch (type) {
    case 'water-splash': return 'Su Damlaları';
    case 'gold-coin': return '3D Altın Para';
    case '3d-sphere': return 'Pastel Küre';
    case 'sparkle': return 'Işıltı Yıldızı';
    case 'leaf': return 'Gül Yaprağı';
    case 'glow-ring': return 'Neon Halka';
    case 'gold-ribbon': return 'Altın Kurdele';
    case 'custom-sticker': return '3D AI Sticker';
    default: return 'Dekoratif Obje';
  }
}

function buildDefaultLayers(template: CoverTemplate, floatings: FloatingElement[]): CanvasLayer[] {
  if (template.layers && template.layers.length > 0) {
    return template.layers.map((l) => ({ ...l }));
  }
  return [
    { id: 'layer-promo', name: 'Kampanya Rozeti', type: 'promoBadge', visible: true, locked: false },
    { id: 'layer-badges', name: 'Özellik Rozetleri', type: 'badges', visible: true, locked: false },
    ...floatings.map((f) => ({
      id: `layer-float-${f.id}`,
      name: getFloatingLabel(f.type),
      type: 'floating' as const,
      visible: true,
      locked: false,
      floatingId: f.id,
    })),
    { id: 'layer-product', name: 'Ürün Dekupesi', type: 'product', visible: true, locked: false },
    { id: 'layer-typography', name: 'Başlık & Metin', type: 'typography', visible: true, locked: false },
  ];
}

const DEFAULT_BRAND_KIT: BrandKit = {
  brandName: 'LUMINA STUDIO',
  tagline: 'DERMATOLOJİK BAKIM SERİSİ',
  logoUrl: undefined,
  primaryColor: '#ffffff',
  accentColor: '#f59e0b',
  ctaColor: '#c2410c',
  fontFamily: 'Cabinet Grotesk',
  watermarkPosition: 'top-right',
  showWatermark: false,
};

export default function App() {
  const defaultTemplate = COVER_TEMPLATES[0];

  // Canvas State
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultTemplate.aspectRatio);
  const [background, setBackground] = useState<StudioBackground>(defaultTemplate.background);
  const [typography, setTypography] = useState<StudioTypography>(defaultTemplate.typography);
  const [badges, setBadges] = useState<FeatureBadge[]>(defaultTemplate.badges);
  const [badgesPosition, setBadgesPosition] = useState<{ x: number; y: number }>(
    defaultTemplate.badgesPosition ?? { x: 7, y: 60 }
  );
  const [promoBadge, setPromoBadge] = useState<PromoBadge>(defaultTemplate.promoBadge);
  const [floatingElements, setFloatingElements] = useState<FloatingElement[]>(
    defaultTemplate.floatingElements
  );
  const [layers, setLayers] = useState<CanvasLayer[]>(() =>
    buildDefaultLayers(defaultTemplate, defaultTemplate.floatingElements)
  );
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTabId>('templates');
  const [activeCanvasElement, setActiveCanvasElement] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductPlacement>({
    src: '',
    originalSrc: SAMPLE_PRODUCTS[0].src,
    x: defaultTemplate.productDefaultPlacement.x ?? 66,
    y: defaultTemplate.productDefaultPlacement.y ?? 58,
    scale: defaultTemplate.productDefaultPlacement.scale ?? 1.0,
    rotation: defaultTemplate.productDefaultPlacement.rotation ?? 0,
    flipX: false,
    shadowOpacity: defaultTemplate.productDefaultPlacement.shadowOpacity ?? 0.45,
    shadowBlur: defaultTemplate.productDefaultPlacement.shadowBlur ?? 24,
    shadowOffsetY: defaultTemplate.productDefaultPlacement.shadowOffsetY ?? 20,
    shadowSpread: 0,
    reflection: defaultTemplate.productDefaultPlacement.reflection ?? true,
    reflectionOpacity: defaultTemplate.productDefaultPlacement.reflectionOpacity ?? 0.35,
    brightness: defaultTemplate.productDefaultPlacement.brightness ?? 1.05,
    contrast: defaultTemplate.productDefaultPlacement.contrast ?? 1.05,
    saturation: 1.0,
    ambientGlow: defaultTemplate.productDefaultPlacement.ambientGlow ?? 0,
    glowColor: defaultTemplate.productDefaultPlacement.glowColor ?? '#ffffff',
  });

  // Brand Kit & Corner Watermark State
  const [brandKit, setBrandKit] = useState<BrandKit>(() => {
    try {
      const raw = localStorage.getItem('kapakai_brand_kit_v1');
      if (raw) return { ...DEFAULT_BRAND_KIT, ...JSON.parse(raw) };
    } catch {
      // ignore storage errors
    }
    return DEFAULT_BRAND_KIT;
  });

  const [brandWatermark, setBrandWatermark] = useState<BrandWatermark>(() => ({
    show: brandKit.showWatermark,
    brandName: brandKit.brandName,
    logoUrl: brandKit.logoUrl,
    position: brandKit.watermarkPosition,
    opacity: 0.92,
    theme: 'dark',
  }));

  useEffect(() => {
    try {
      localStorage.setItem('kapakai_brand_kit_v1', JSON.stringify(brandKit));
    } catch {
      // ignore storage errors
    }
  }, [brandKit]);

  // Saved Projects State
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    try {
      const raw = localStorage.getItem('kapakai_saved_projects_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('kapakai_saved_projects_v1', JSON.stringify(savedProjects));
    } catch {
      // ignore quota errors
    }
  }, [savedProjects]);

  const [activeTemplateId, setActiveTemplateId] = useState<string>(defaultTemplate.id);

  // Clean Past / Future Undo-Redo stacks
  const [pastHistory, setPastHistory] = useState<HistoryItem[]>([]);
  const [futureHistory, setFutureHistory] = useState<HistoryItem[]>([]);

  // Conversational AI Editor State
  const [aiTargetArea, setAiTargetArea] = useState<EditableAreaId>('all');
  const [aiChatMessages, setAiChatMessages] = useState<AiChatMessage[]>([]);

  // Custom AI-Generated Templates State
  const [customTemplates, setCustomTemplates] = useState<CoverTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('kapakai_custom_templates_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('kapakai_custom_templates_v1', JSON.stringify(customTemplates));
    } catch {
      // ignore storage errors
    }
  }, [customTemplates]);

  // Modals & UI
  const [isUploaderOpen, setIsUploaderOpen] = useState<boolean>(false);
  const [isAiWizardOpen, setIsAiWizardOpen] = useState<boolean>(false);
  const [isMultiChannelOpen, setIsMultiChannelOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSavingProject, setIsSavingProject] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showGoldenGuide, setShowGoldenGuide] = useState<boolean>(false);
  const [showSafeZone, setShowSafeZone] = useState<boolean>(false);
  const [isAligningProduct, setIsAligningProduct] = useState<boolean>(false);
  const [compareBeforeSnapshot, setCompareBeforeSnapshot] = useState<HistoryItem | null>(null);

  // Initial cutout loading for sample product image
  useEffect(() => {
    let isMounted = true;
    async function initUserSample() {
      try {
        const sampleUrl = SAMPLE_PRODUCTS[0].src;
        const res = await removeBackgroundClient(sampleUrl, {
          tolerance: 28,
          feather: 1.5,
          mode: 'smart-flood',
        });
        if (isMounted) {
          setProduct((prev) =>
            prev.src
              ? prev
              : {
                  ...prev,
                  src: res.cutoutDataUrl,
                  originalSrc: sampleUrl,
                }
          );
        }
      } catch (err) {
        console.error('Failed to init sample cutout:', err);
      }
    }
    void initUserSample();
    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  }, []);

  const currentSnapshot = useCallback(
    (): HistoryItem =>
      createSnapshot({
        placement: product,
        background,
        typography,
        badges,
        badgesPosition,
        promoBadge,
        floatingElements,
        aspectRatio,
        layers,
        brandWatermark,
      }),
    [
      product,
      background,
      typography,
      badges,
      badgesPosition,
      promoBadge,
      floatingElements,
      aspectRatio,
      layers,
      brandWatermark,
    ]
  );

  const restoreSnapshot = useCallback((snap: HistoryItem) => {
    setProduct(snap.placement);
    setBackground(snap.background);
    setTypography(snap.typography);
    setBadges(snap.badges);
    setBadgesPosition(snap.badgesPosition ?? { x: 7, y: 60 });
    setPromoBadge(snap.promoBadge);
    setFloatingElements(snap.floatingElements);
    setAspectRatio(snap.aspectRatio);
    if (snap.layers) setLayers(snap.layers);
    if (snap.brandWatermark) setBrandWatermark(snap.brandWatermark);
  }, []);

  const commitHistory = useCallback(() => {
    setCompareBeforeSnapshot(null);
    const snap = currentSnapshot();
    setPastHistory((prev) => pushUndoPast(prev, snap));
    setFutureHistory([]);
  }, [currentSnapshot]);

  const handleUndo = useCallback(() => {
    if (pastHistory.length === 0) return;
    setCompareBeforeSnapshot(null);
    const { nextPast, nextFuture, restored } = applyUndo(
      pastHistory,
      futureHistory,
      currentSnapshot()
    );
    if (restored) {
      setPastHistory(nextPast);
      setFutureHistory(nextFuture);
      restoreSnapshot(restored);
      showToast('Son işlem geri alındı');
    }
  }, [pastHistory, futureHistory, currentSnapshot, restoreSnapshot, showToast]);

  const handleRedo = useCallback(() => {
    if (futureHistory.length === 0) return;
    setCompareBeforeSnapshot(null);
    const { nextPast, nextFuture, restored } = applyRedo(
      pastHistory,
      futureHistory,
      currentSnapshot()
    );
    if (restored) {
      setPastHistory(nextPast);
      setFutureHistory(nextFuture);
      restoreSnapshot(restored);
      showToast('İşlem ileri alındı');
    }
  }, [pastHistory, futureHistory, currentSnapshot, restoreSnapshot, showToast]);

  // Keyboard Undo / Redo + Arrow Precision Nudging + Delete Floating shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete selected floating element cleanly
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        activeCanvasElement?.startsWith('floating:')
      ) {
        e.preventDefault();
        const floatId = activeCanvasElement.slice('floating:'.length);
        commitHistory();
        setFloatingElements((prev) => prev.filter((el) => el.id !== floatId));
        setLayers((prev) => prev.filter((l) => l.floatingId !== floatId));
        setActiveCanvasElement(null);
        showToast('Seçili dekoratif obje silindi');
        return;
      }

      // Precision Arrow Key Nudging (1% or 5% with Shift)
      if (
        activeCanvasElement &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commitHistory();

        if (activeCanvasElement === 'product') {
          setProduct((prev) => ({
            ...prev,
            x: Math.max(4, Math.min(96, prev.x + dx)),
            y: Math.max(4, Math.min(96, prev.y + dy)),
          }));
        } else if (activeCanvasElement === 'text') {
          setTypography((prev) => ({
            ...prev,
            positionX: Math.max(2, Math.min(94, prev.positionX + dx)),
            positionY: Math.max(2, Math.min(90, prev.positionY + dy)),
          }));
        } else if (activeCanvasElement === 'promo') {
          setPromoBadge((prev) => ({
            ...prev,
            x: Math.max(5, Math.min(95, prev.x + dx)),
            y: Math.max(5, Math.min(95, prev.y + dy)),
          }));
        } else if (activeCanvasElement === 'badges') {
          setBadgesPosition((prev) => ({
            x: Math.max(2, Math.min(76, prev.x + dx)),
            y: Math.max(4, Math.min(88, prev.y + dy)),
          }));
        } else if (activeCanvasElement.startsWith('floating:')) {
          const floatId = activeCanvasElement.slice('floating:'.length);
          setFloatingElements((prev) =>
            prev.map((el) =>
              el.id === floatId
                ? {
                    ...el,
                    x: Math.max(3, Math.min(97, el.x + dx)),
                    y: Math.max(3, Math.min(97, el.y + dy)),
                  }
                : el
            )
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, activeCanvasElement, commitHistory, showToast]);

  // Smart Aspect Ratio Switch (automatically reflows layout to fit target channel cleanly)
  const handleSmartRatioSwitch = useCallback(
    (nextRatio: AspectRatio) => {
      if (nextRatio === aspectRatio) return;
      commitHistory();
      const adapted = adaptStateToAspectRatio(
        {
          aspectRatio,
          background,
          product,
          typography,
          badges,
          badgesPosition,
          promoBadge,
          floatingElements,
          layers,
          brandWatermark,
        },
        nextRatio
      );
      setAspectRatio(adapted.aspectRatio);
      setTypography(adapted.typography);
      setProduct(adapted.product);
      setBadgesPosition(adapted.badgesPosition);
      setPromoBadge(adapted.promoBadge);
      setFloatingElements(adapted.floatingElements);
      showToast(`${nextRatio} formatına akıllı yerleşimle geçildi`);
    },
    [
      aspectRatio,
      background,
      product,
      typography,
      badges,
      badgesPosition,
      promoBadge,
      floatingElements,
      layers,
      brandWatermark,
      commitHistory,
      showToast,
    ]
  );

  // Select and apply a template
  const handleSelectTemplate = (template: CoverTemplate) => {
    commitHistory();
    setActiveTemplateId(template.id);
    setAspectRatio(template.aspectRatio);
    setBackground(template.background);
    setTypography(template.typography);
    setBadges(template.badges);
    setBadgesPosition(template.badgesPosition ?? { x: 7, y: 60 });
    setPromoBadge(template.promoBadge);
    setFloatingElements(template.floatingElements);
    setLayers(buildDefaultLayers(template, template.floatingElements));

    setProduct((prev) => ({
      ...prev,
      x: template.productDefaultPlacement.x ?? prev.x,
      y: template.productDefaultPlacement.y ?? prev.y,
      scale: template.productDefaultPlacement.scale ?? prev.scale,
      rotation: template.productDefaultPlacement.rotation ?? 0,
      shadowOpacity: template.productDefaultPlacement.shadowOpacity ?? prev.shadowOpacity,
      shadowBlur: template.productDefaultPlacement.shadowBlur ?? prev.shadowBlur,
      shadowOffsetY: template.productDefaultPlacement.shadowOffsetY ?? prev.shadowOffsetY,
      reflection: template.productDefaultPlacement.reflection ?? prev.reflection,
      reflectionOpacity: template.productDefaultPlacement.reflectionOpacity ?? prev.reflectionOpacity,
      brightness: template.productDefaultPlacement.brightness ?? prev.brightness,
      contrast: template.productDefaultPlacement.contrast ?? prev.contrast,
      ambientGlow: template.productDefaultPlacement.ambientGlow ?? 0,
      glowColor: template.productDefaultPlacement.glowColor ?? '#ffffff',
    }));

    showToast(`"${template.title}" şablonu uygulandı`);
  };

  const handleAlignProductGoldenRatio = useCallback(
    async (
      preset: GoldenPresetId = 'auto',
      overrideSrc?: string,
      precomputedCog?: ProductCenterOfGravity | null,
      autoScale = preset === 'auto'
    ) => {
      const targetSrc = overrideSrc || product.src;
      if (!targetSrc) return;

      setIsAligningProduct(true);
      try {
        const result = await alignProductWithGoldenRatio({
          imageSrc: targetSrc,
          aspectRatio,
          typography,
          currentScale: product.scale,
          autoScale,
          precomputedCog:
            precomputedCog !== undefined
              ? precomputedCog
              : !overrideSrc && preset !== 'auto'
              ? product.centerOfGravity
              : undefined,
          overridePreset: preset,
          flipX: overrideSrc ? false : product.flipX,
        });

        setProduct((prev) => {
          if (overrideSrc && prev.src !== overrideSrc) return prev;
          return {
            ...prev,
            x: result.x,
            y: result.y,
            scale: result.scale,
            centerOfGravity: result.centerOfGravity,
          };
        });
        setShowGoldenGuide(true);
        showToast(result.summary);
      } catch (err) {
        console.error('Golden ratio alignment error:', err);
        showToast('Altın oran hizalaması tamamlanamadı');
      } finally {
        setIsAligningProduct(false);
      }
    },
    [product.src, product.scale, product.flipX, product.centerOfGravity, aspectRatio, typography, showToast]
  );

  const handleSelectCutout = useCallback(
    (
      cutoutUrl: string,
      originalUrl: string,
      precomputedCog?: ProductCenterOfGravity | null
    ) => {
      commitHistory();
      setProduct((prev) => ({
        ...prev,
        src: cutoutUrl,
        originalSrc: originalUrl,
        rotation: 0,
        flipX: false,
        centerOfGravity: precomputedCog ?? undefined,
      }));
      setActiveCanvasElement('product');
      showToast('Ürün içeri aktarıldı, ağırlık merkezi & Altın Oran uygulanıyor...');
      void handleAlignProductGoldenRatio('auto', cutoutUrl, precomputedCog, true);
    },
    [commitHistory, handleAlignProductGoldenRatio, showToast]
  );

  const handleDropProductFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        if (!dataUrl) return;
        try {
          showToast('Görsel temizleniyor ve AI ağırlık merkezi analiz ediliyor...');
          const res = await removeBackgroundClient(dataUrl, {
            tolerance: 28,
            feather: 1.5,
            mode: 'smart-flood',
          });
          handleSelectCutout(res.cutoutDataUrl, dataUrl, undefined);
        } catch {
          handleSelectCutout(dataUrl, dataUrl, undefined);
        }
      };
      reader.readAsDataURL(file);
    },
    [handleSelectCutout, showToast]
  );

  const handleSelectCanvasElement = useCallback((el: string | null) => {
    setActiveCanvasElement(el);
    if (el) {
      setAiTargetArea(mapActiveElementToArea(el));
    }
  }, []);

  const handleApplyColorHarmony = useCallback(
    (harmony: ColorHarmonyRecommendation, scope: ApplyHarmonyScope) => {
      commitHistory();

      if (scope.applyBackground) {
        setBackground((prev) => ({
          ...prev,
          type: 'gradient',
          imageUrl: undefined,
          gradient: harmony.background.gradient,
          vignette: harmony.background.vignette,
          blur: 0,
          brightness: 1,
          stageStyle: 'none',
        }));
      }

      if (scope.applyTypography) {
        setTypography((prev) => ({
          ...prev,
          headlineColor: harmony.typography.headlineColor,
          highlightColor: harmony.typography.highlightColor,
          subtitleColor: harmony.typography.subtitleColor,
          ctaBgColor: harmony.typography.ctaBgColor,
          ctaTextColor: harmony.typography.ctaTextColor,
          plaqueStyle: 'none',
          subtitlePill: false,
        }));
      }

      if (scope.applyProductAccent) {
        setProduct((prev) => ({
          ...prev,
          glowColor: harmony.productAccent.glowColor,
          ambientGlow: harmony.productAccent.ambientGlow,
        }));
        setPromoBadge((prev) => ({
          ...prev,
          color: harmony.productAccent.promoColor,
          textColor: harmony.productAccent.promoTextColor,
        }));
      }

      showToast(`"${harmony.title}" renk harmonisi uygulandı`);
    },
    [commitHistory, showToast]
  );

  const handleApplyBrandKitToCanvas = useCallback(() => {
    commitHistory();
    const safeCtaText = ensureReadableTextColor('#ffffff', brandKit.ctaColor, brandKit.ctaColor, 4.5);
    setTypography((prev) => ({
      ...prev,
      kicker: brandKit.tagline.trim() || prev.kicker,
      fontFamily: brandKit.fontFamily,
      headlineColor: brandKit.primaryColor,
      highlightColor: brandKit.accentColor,
      ctaBgColor: brandKit.ctaColor,
      ctaTextColor: safeCtaText,
      plaqueStyle: 'none',
    }));
    setPromoBadge((prev) => ({
      ...prev,
      color: brandKit.ctaColor,
      textColor: safeCtaText,
    }));
    setBrandWatermark((prev) => ({
      ...prev,
      show: true,
      brandName: brandKit.brandName,
      logoUrl: brandKit.logoUrl,
      position: brandKit.watermarkPosition,
    }));
    setBrandKit((prev) => ({ ...prev, showWatermark: true }));
    showToast(`"${brandKit.brandName || 'Marka Kiti'}" renk, yazı tipi ve filigranı uygulandı`);
  }, [brandKit, commitHistory, showToast]);

  const handleSaveProject = useCallback(
    async (name: string) => {
      setIsSavingProject(true);
      try {
        let thumbUrl: string | undefined;
        try {
          const thumbCanvas = await renderHighResCover({
            aspectRatio,
            background,
            product,
            typography,
            badges,
            badgesPosition,
            promoBadge,
            floatingElements,
            layers,
            brandWatermark,
            scaleMultiplier: 0.2,
          });
          thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.78);
        } catch {
          thumbUrl = undefined;
        }

        const newProject: SavedProject = {
          id: `proj-${Date.now()}`,
          name,
          updatedAt: Date.now(),
          thumbnailDataUrl: thumbUrl,
          aspectRatio,
          snapshot: currentSnapshot(),
        };
        setSavedProjects((prev) => [newProject, ...prev].slice(0, 16));
        showToast(`"${name}" projesi kaydedildi`);
      } finally {
        setIsSavingProject(false);
      }
    },
    [
      aspectRatio,
      background,
      product,
      typography,
      badges,
      badgesPosition,
      promoBadge,
      floatingElements,
      layers,
      brandWatermark,
      currentSnapshot,
      showToast,
    ]
  );

  const handleLoadProject = useCallback(
    (proj: SavedProject) => {
      commitHistory();
      restoreSnapshot(proj.snapshot);
      showToast(`"${proj.name}" projesi yüklendi`);
    },
    [commitHistory, restoreSnapshot, showToast]
  );

  const handleDuplicateProject = useCallback(
    (proj: SavedProject) => {
      const copy: SavedProject = {
        ...proj,
        id: `proj-${Date.now()}-${Math.round(Math.random() * 999)}`,
        name: `${proj.name} (Kopya)`,
        updatedAt: Date.now(),
        snapshot: createSnapshot(proj.snapshot),
      };
      setSavedProjects((prev) => [copy, ...prev].slice(0, 16));
      showToast('Proje kopyası oluşturuldu');
    },
    [showToast]
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      setSavedProjects((prev) => prev.filter((p) => p.id !== id));
      showToast('Kayıtlı proje silindi');
    },
    [showToast]
  );

  const handleResetWorkspace = useCallback(() => {
    commitHistory();
    handleSelectTemplate(COVER_TEMPLATES[0]);
    setBrandWatermark((prev) => ({ ...prev, show: false }));
    showToast('Çalışma alanı başlangıç şablonuna sıfırlandı');
  }, [commitHistory, showToast]);

  const currentEditableState: StudioEditableState = {
    aspectRatio,
    background,
    typography,
    badges,
    badgesPosition,
    promoBadge,
    product,
    floatingElements,
    layers,
  };

  const handleApplyAiPatch = useCallback(
    (patch: StudioPatch, targetArea: EditableAreaId): string[] => {
      const stateSnapshot: StudioEditableState = {
        aspectRatio,
        background,
        typography,
        badges,
        badgesPosition,
        promoBadge,
        product,
        floatingElements,
        layers,
      };
      const { nextState, appliedChanges } = applyStudioPatch(stateSnapshot, patch, targetArea);
      if (appliedChanges.length > 0) {
        commitHistory();
        setAspectRatio(nextState.aspectRatio);
        setBackground(nextState.background);
        setTypography(nextState.typography);
        setBadges(nextState.badges);
        setBadgesPosition(nextState.badgesPosition);
        setPromoBadge(nextState.promoBadge);
        setProduct(nextState.product);
        setFloatingElements(nextState.floatingElements);
        setLayers(nextState.layers);
        showToast('AI düzenlemesi tuvale uygulandı');
      }
      return appliedChanges;
    },
    [
      aspectRatio,
      background,
      typography,
      badges,
      badgesPosition,
      promoBadge,
      product,
      floatingElements,
      layers,
      commitHistory,
      showToast,
    ]
  );

  const handleApplyOptimizerPatch = useCallback(
    (patch: StudioPatch, toastLabel?: string) => {
      const changes = handleApplyAiPatch(patch, 'all');
      if (changes.length > 0 && toastLabel) {
        showToast(toastLabel);
      }
    },
    [handleApplyAiPatch, showToast]
  );

  const handleApplyAutoFixPatch = useCallback(
    (patch: StudioPatch, targetArea: EditableAreaId, toastLabel: string) => {
      const changes = handleApplyAiPatch(patch, targetArea);
      if (changes.length > 0 && toastLabel) {
        showToast(toastLabel);
      }
    },
    [handleApplyAiPatch, showToast]
  );

  const handleApplyAbVariation = useCallback(
    (v: AbCampaignVariation) => {
      commitHistory();
      setTypography((prev) => ({
        ...prev,
        kicker: v.kicker,
        headline: v.headline,
        headlineHighlight: v.headlineHighlight,
        subtitle: v.subtitle,
        ctaText: v.ctaText,
        showCta: true,
        highlightColor: v.accentHex,
        ctaBgColor: v.ctaBgHex,
        ctaTextColor: v.ctaTextHex,
      }));
      setPromoBadge((prev) => ({
        ...prev,
        show: true,
        text: v.promoText,
        subtext: v.promoSubtext,
        color: v.ctaBgHex,
        textColor: v.ctaTextHex,
      }));
      showToast(`"${v.angleTitle}" reklam varyasyonu uygulandı`);
    },
    [commitHistory, showToast]
  );

  const handleExport = async (format: ExportImageFormat = 'png', scaleMultiplier = 1) => {
    setIsExporting(true);
    try {
      const canvas = await renderHighResCover({
        aspectRatio,
        background,
        product,
        typography,
        badges,
        badgesPosition,
        promoBadge,
        floatingElements,
        layers,
        brandWatermark,
        scaleMultiplier,
      });

      const mimeType =
        format === 'png'
          ? 'image/png'
          : format === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
      const ext = format === 'jpeg' ? 'jpg' : format;
      const dataUrl = canvas.toDataURL(mimeType, 0.95);

      const link = document.createElement('a');
      link.download = `kapakai-tasarim-${aspectRatio.replace(':', '-')}-${scaleMultiplier}x-${Date.now()}.${ext}`;
      link.href = dataUrl;
      link.click();

      showToast(
        `Kapak görseli (${scaleMultiplier === 2 ? '4K Ultra HD' : '1080p HD'} ${ext.toUpperCase()}) indirildi!`
      );
    } catch (e) {
      console.error('Export error:', e);
      showToast('Dışa aktarma sırasında bir hata oluştu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCutoutOnly = () => {
    if (!product.src) {
      showToast('Henüz bir ürün dekupe edilmedi');
      return;
    }
    const link = document.createElement('a');
    link.download = `kapakai-dekupe-urun-${Date.now()}.png`;
    link.href = product.src;
    link.click();
    showToast('Şeffaf ürün görseli indirildi');
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-slate-100 text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-[110] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        aspectRatio={aspectRatio}
        onAspectRatioChange={handleSmartRatioSwitch}
        onOpenUploader={() => setIsUploaderOpen(true)}
        onOpenAiGenerator={() => setIsAiWizardOpen(true)}
        onOpenMultiChannel={() => setIsMultiChannelOpen(true)}
        onExport={() => handleExport('png', 1)}
        canUndo={pastHistory.length > 0}
        canRedo={futureHistory.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isExporting={isExporting}
        hasProduct={Boolean(product.src)}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {compareBeforeSnapshot && (
          <div
            data-testid="compare-before-banner"
            className="absolute top-3 left-1/2 -translate-x-1/2 lg:left-[calc(50%-12rem)] z-40 px-3 py-1.5 rounded-lg bg-slate-900/95 text-white text-xs font-bold shadow-lg flex items-center gap-2.5 border border-slate-700"
          >
            <span>Önceki Hal Önizleniyor</span>
            <button
              type="button"
              onClick={() => setCompareBeforeSnapshot(null)}
              className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition-colors"
            >
              Sonraki Hali Gör
            </button>
          </div>
        )}
        <StudioCanvas
          aspectRatio={compareBeforeSnapshot ? compareBeforeSnapshot.aspectRatio : aspectRatio}
          background={compareBeforeSnapshot ? compareBeforeSnapshot.background : background}
          product={compareBeforeSnapshot ? compareBeforeSnapshot.placement : product}
          typography={compareBeforeSnapshot ? compareBeforeSnapshot.typography : typography}
          badges={compareBeforeSnapshot ? compareBeforeSnapshot.badges : badges}
          badgesPosition={
            compareBeforeSnapshot
              ? compareBeforeSnapshot.badgesPosition ?? badgesPosition
              : badgesPosition
          }
          promoBadge={compareBeforeSnapshot ? compareBeforeSnapshot.promoBadge : promoBadge}
          floatingElements={
            compareBeforeSnapshot ? compareBeforeSnapshot.floatingElements : floatingElements
          }
          layers={compareBeforeSnapshot ? compareBeforeSnapshot.layers ?? layers : layers}
          activeElement={activeCanvasElement}
          onSelectElement={handleSelectCanvasElement}
          onOpenLayerTab={() => setActiveSidebarTab('layers')}
          onOpenAiChat={(area) => {
            setAiTargetArea(area);
            setActiveSidebarTab('aiChat');
          }}
          onCommitHistory={commitHistory}
          onUpdateProduct={(updater) => {
            setCompareBeforeSnapshot(null);
            setProduct((prev) => updater(prev));
          }}
          onUpdateTypography={(updater) => {
            setCompareBeforeSnapshot(null);
            setTypography((prev) => updater(prev));
          }}
          onUpdateBadgesPosition={(pos) => {
            setCompareBeforeSnapshot(null);
            setBadgesPosition(pos);
          }}
          onUpdatePromoBadge={(updater) => {
            setCompareBeforeSnapshot(null);
            setPromoBadge((prev) => updater(prev));
          }}
          onUpdateFloatingElement={(id, updates) => {
            setCompareBeforeSnapshot(null);
            setFloatingElements((prev) =>
              prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
            );
          }}
          showGoldenGuide={showGoldenGuide}
          onToggleGoldenGuide={() => setShowGoldenGuide((v) => !v)}
          onAlignGoldenRatio={() => {
            commitHistory();
            void handleAlignProductGoldenRatio('auto', undefined, null, true);
          }}
          isAligningProduct={isAligningProduct}
          onDropProductFile={handleDropProductFile}
          onOpenAutoFixTab={() => setActiveSidebarTab('autoFix')}
          onOpenHarmonyTab={() => setActiveSidebarTab('harmony')}
          onOpenOptimizerTab={() => setActiveSidebarTab('optimizer')}
          brandWatermark={
            compareBeforeSnapshot
              ? compareBeforeSnapshot.brandWatermark ?? brandWatermark
              : brandWatermark
          }
          showSafeZone={showSafeZone}
          onToggleSafeZone={() => setShowSafeZone((v) => !v)}
        />

        <SidebarTabs
          currentTemplateId={activeTemplateId}
          onSelectTemplate={handleSelectTemplate}
          background={background}
          onUpdateBackground={(updater) => setBackground((p) => updater(p))}
          product={product}
          onUpdateProduct={(updater) => setProduct((p) => updater(p))}
          typography={typography}
          onUpdateTypography={(updater) => setTypography((p) => updater(p))}
          badges={badges}
          onUpdateBadges={(updater) => setBadges((p) => updater(p))}
          promoBadge={promoBadge}
          onUpdatePromoBadge={(updater) => setPromoBadge((p) => updater(p))}
          floatingElements={floatingElements}
          onUpdateFloatingElements={(updater) => {
            commitHistory();
            setFloatingElements((prevFloats) => {
              const nextFloats = updater(prevFloats);
              setLayers((prevLayers) => {
                const filtered = prevLayers.filter(
                  (l) =>
                    l.type !== 'floating' || nextFloats.some((f) => f.id === l.floatingId)
                );
                nextFloats.forEach((f) => {
                  if (!filtered.some((l) => l.floatingId === f.id)) {
                    filtered.unshift({
                      id: `layer-float-${f.id}`,
                      name: getFloatingLabel(f.type),
                      type: 'floating',
                      visible: true,
                      locked: false,
                      floatingId: f.id,
                    });
                  }
                });
                return filtered;
              });
              return nextFloats;
            });
          }}
          layers={layers}
          onUpdateLayers={(newLayers) => {
            commitHistory();
            setLayers(newLayers);
          }}
          activeElement={activeCanvasElement}
          onSelectElement={handleSelectCanvasElement}
          onDeleteFloatingElement={(id) => {
            commitHistory();
            setFloatingElements((prev) => prev.filter((el) => el.id !== id));
            setLayers((prev) => prev.filter((l) => l.floatingId !== id));
          }}
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
          onOpenAiWizard={() => setIsAiWizardOpen(true)}
          onOpenBgRemover={() => setIsUploaderOpen(true)}
          onExport={handleExport}
          onOpenMultiChannel={() => setIsMultiChannelOpen(true)}
          onDownloadCutoutOnly={handleDownloadCutoutOnly}
          isExporting={isExporting}
          aiTargetArea={aiTargetArea}
          onChangeAiTargetArea={setAiTargetArea}
          aiChatMessages={aiChatMessages}
          onAppendAiMessage={(msg) => setAiChatMessages((prev) => [...prev, msg])}
          onClearAiMessages={() => setAiChatMessages([])}
          onApplyAiPatch={handleApplyAiPatch}
          studioState={currentEditableState}
          canUndo={pastHistory.length > 0}
          onUndo={handleUndo}
          customTemplates={customTemplates}
          onAddCustomTemplates={(generated) => {
            setCustomTemplates((prev) => [...generated, ...prev].slice(0, 24));
            showToast(`${generated.length} yeni özel şablon sıfırdan oluşturuldu!`);
          }}
          onDeleteCustomTemplate={(id) => {
            setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
            showToast('Özel şablon silindi');
          }}
          onAlignGoldenRatio={(preset = 'auto') => {
            commitHistory();
            void handleAlignProductGoldenRatio(
              preset,
              undefined,
              preset === 'auto' ? null : undefined,
              preset === 'auto'
            );
          }}
          showGoldenGuide={showGoldenGuide}
          onToggleGoldenGuide={() => setShowGoldenGuide((v) => !v)}
          isAligningProduct={isAligningProduct}
          onApplyColorHarmony={handleApplyColorHarmony}
          showSafeZone={showSafeZone}
          onToggleSafeZone={() => setShowSafeZone((v) => !v)}
          onApplyOptimizerPatch={handleApplyOptimizerPatch}
          onApplyAbVariation={handleApplyAbVariation}
          brandKit={brandKit}
          brandWatermark={brandWatermark}
          onUpdateBrandKit={(updater) => setBrandKit((prev) => updater(prev))}
          onUpdateBrandWatermark={(updater) => setBrandWatermark((prev) => updater(prev))}
          onApplyBrandKitToCanvas={handleApplyBrandKitToCanvas}
          savedProjects={savedProjects}
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onResetWorkspace={handleResetWorkspace}
          isSavingProject={isSavingProject}
          onApplyAutoFixPatch={handleApplyAutoFixPatch}
          onCommitHistory={commitHistory}
          currentSnapshot={currentSnapshot()}
          isComparingBefore={Boolean(compareBeforeSnapshot)}
          onToggleCompareBefore={setCompareBeforeSnapshot}
        />
      </main>

      {/* Product Upload & Background Removal Modal */}
      <ProductUploaderModal
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        initialSourceUrl={product.originalSrc}
        onSelectCutout={handleSelectCutout}
      />

      {/* Multi-Channel Campaign Pack & ZIP Export Modal */}
      <MultiChannelModal
        isOpen={isMultiChannelOpen}
        onClose={() => setIsMultiChannelOpen(false)}
        studioState={{
          aspectRatio,
          background,
          product,
          typography,
          badges,
          badgesPosition,
          promoBadge,
          floatingElements,
          layers,
          brandWatermark,
        }}
        onSwitchAndAdaptRatio={handleSmartRatioSwitch}
        onNotify={showToast}
      />

      {/* AI Wizard Modal */}
      <AiWizardModal
        isOpen={isAiWizardOpen}
        onClose={() => setIsAiWizardOpen(false)}
        productCutoutUrl={product.src}
        originalProductUrl={product.originalSrc}
        currentAspectRatio={aspectRatio}
        onApplyBackground={(bg) => {
          commitHistory();
          setBackground(bg);
          showToast('Yapay zeka sahnesi tuvale uygulandı');
        }}
        onApplyAiDesign={({ imageUrl, mode, keepEditableOverlays, fitMode }) => {
          commitHistory();
          setBackground((prev) => ({
            ...prev,
            type: 'image',
            imageUrl,
            blur: 0,
            brightness: 1,
            vignette: false,
            stageStyle: 'none',
            fitMode,
          }));
          setLayers((prev) => applyModeLayerVisibility(prev, mode, keepEditableOverlays));
          showToast(
            mode === 'studio-scene'
              ? 'AI stüdyo sahnesi tuvale uygulandı'
              : 'Tam AI tasarım tuvale uygulandı'
          );
        }}
        onAddStickerElement={(stickerDataUrl, label) => {
          commitHistory();
          const newId = `sticker-${Date.now()}`;
          const newFloat: FloatingElement = {
            id: newId,
            type: 'custom-sticker',
            imageUrl: stickerDataUrl,
            label,
            x: 50,
            y: 26,
            scale: 1.35,
            rotation: -3,
            opacity: 1,
          };
          setFloatingElements((prev) => [...prev, newFloat]);
          setLayers((prev) => [
            {
              id: `layer-float-${newId}`,
              name: label || '3D AI Sticker',
              type: 'floating',
              visible: true,
              locked: false,
              floatingId: newId,
            },
            ...prev,
          ]);
          setActiveCanvasElement(`floating:${newId}`);
          showToast('Şeffaf 3D AI Sticker tuvale eklendi!');
        }}
        onApplyCopy={(newTypo, newBadges, newPromo) => {
          commitHistory();
          setTypography((prev) => ({ ...prev, ...newTypo }));
          if (newBadges) setBadges(newBadges);
          if (newPromo) setPromoBadge((prev) => ({ ...prev, ...newPromo }));
          showToast('Yapay zeka reklam metinleri uygulandı');
        }}
      />
    </div>
  );
}
