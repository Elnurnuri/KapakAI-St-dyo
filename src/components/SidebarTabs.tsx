import React, { useState, useRef, useEffect } from 'react';
import {
  CoverTemplate,
  FeatureBadge,
  FloatingElement,
  ProductPlacement,
  PromoBadge,
  StudioBackground,
  StudioTypography,
  CanvasLayer,
  EditableAreaId,
  AiChatMessage,
  StudioPatch,
  TemplateCategory,
  BrandKit,
  BrandWatermark,
  SavedProject,
  AbCampaignVariation,
  ExportImageFormat,
  HistoryItem,
} from '../types';
import { COVER_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';
import { STUDIO_BACKDROPS, PRESET_GRADIENTS } from '../data/backgrounds';
import { LayerPanel } from './LayerPanel';
import { AiChatEditorPanel } from './AiChatEditorPanel';
import { CustomTemplateGenerator } from './CustomTemplateGenerator';
import { ColorHarmonyPanel, ApplyHarmonyScope } from './ColorHarmonyPanel';
import { CampaignOptimizerPanel } from './CampaignOptimizerPanel';
import { BrandAndProjectsPanel } from './BrandAndProjectsPanel';
import { SmartAutoFixPanel } from './SmartAutoFixPanel';
import { StudioEditableState } from '../utils/aiPatch';
import type { GoldenPresetId } from '../utils/goldenRatio';
import type { ColorHarmonyRecommendation } from '../utils/colorHarmony';
import {
  LayoutTemplate,
  Image as ImageIcon,
  Package,
  Type,
  Tag,
  Download,
  Scissors,
  Sparkles,
  Plus,
  Trash2,
  Wand2,
  Layers,
  MessageSquareText,
  Upload,
  Check,
  Crosshair,
  Grid,
  RefreshCw,
  Palette,
  ShieldCheck,
  Briefcase,
  Archive,
} from 'lucide-react';

export type SidebarTabId =
  | 'templates'
  | 'autoFix'
  | 'harmony'
  | 'optimizer'
  | 'brandProjects'
  | 'aiChat'
  | 'layers'
  | 'background'
  | 'product'
  | 'text'
  | 'badges'
  | 'export';

interface SidebarTabsProps {
  currentTemplateId?: string;
  onSelectTemplate: (template: CoverTemplate) => void;
  background: StudioBackground;
  onUpdateBackground: (updater: (prev: StudioBackground) => StudioBackground) => void;
  product: ProductPlacement;
  onUpdateProduct: (updater: (prev: ProductPlacement) => ProductPlacement) => void;
  typography: StudioTypography;
  onUpdateTypography: (updater: (prev: StudioTypography) => StudioTypography) => void;
  badges: FeatureBadge[];
  onUpdateBadges: (updater: (prev: FeatureBadge[]) => FeatureBadge[]) => void;
  promoBadge: PromoBadge;
  onUpdatePromoBadge: (updater: (prev: PromoBadge) => PromoBadge) => void;
  floatingElements: FloatingElement[];
  onUpdateFloatingElements: (updater: (prev: FloatingElement[]) => FloatingElement[]) => void;
  layers: CanvasLayer[];
  onUpdateLayers: (newLayers: CanvasLayer[]) => void;
  activeElement?: string | null;
  onSelectElement?: (type: string | null) => void;
  onDeleteFloatingElement?: (floatingId: string) => void;
  activeTab?: SidebarTabId;
  onTabChange?: (tab: SidebarTabId) => void;
  onOpenAiWizard: () => void;
  onOpenBgRemover?: () => void;
  onExport: (format: ExportImageFormat, scaleMultiplier: number) => void;
  onOpenMultiChannel?: () => void;
  onDownloadCutoutOnly: () => void;
  isExporting: boolean;
  // Conversational AI Editor props
  aiTargetArea: EditableAreaId;
  onChangeAiTargetArea: (area: EditableAreaId) => void;
  aiChatMessages: AiChatMessage[];
  onAppendAiMessage: (msg: AiChatMessage) => void;
  onClearAiMessages: () => void;
  onApplyAiPatch: (patch: StudioPatch, targetArea: EditableAreaId) => string[];
  studioState: StudioEditableState;
  canUndo: boolean;
  onUndo: () => void;
  // Custom AI Templates props
  customTemplates: CoverTemplate[];
  onAddCustomTemplates: (templates: CoverTemplate[]) => void;
  onDeleteCustomTemplate: (id: string) => void;
  // AI Center of Gravity & Golden Ratio props
  onAlignGoldenRatio?: (preset?: GoldenPresetId) => void;
  showGoldenGuide?: boolean;
  onToggleGoldenGuide?: () => void;
  isAligningProduct?: boolean;
  // Color Harmony props
  onApplyColorHarmony?: (
    harmony: ColorHarmonyRecommendation,
    scope: ApplyHarmonyScope
  ) => void;
  // Optimizer & A/B + Brand & Projects props
  showSafeZone?: boolean;
  onToggleSafeZone?: () => void;
  onApplyOptimizerPatch?: (patch: StudioPatch, toastLabel?: string) => void;
  onApplyAbVariation?: (variation: AbCampaignVariation) => void;
  brandKit?: BrandKit;
  brandWatermark?: BrandWatermark;
  onUpdateBrandKit?: (updater: (prev: BrandKit) => BrandKit) => void;
  onUpdateBrandWatermark?: (updater: (prev: BrandWatermark) => BrandWatermark) => void;
  onApplyBrandKitToCanvas?: () => void;
  savedProjects?: SavedProject[];
  onSaveProject?: (name: string) => Promise<void>;
  onLoadProject?: (project: SavedProject) => void;
  onDuplicateProject?: (project: SavedProject) => void;
  onDeleteProject?: (id: string) => void;
  onResetWorkspace?: () => void;
  isSavingProject?: boolean;
  // Smart Auto-Fix (Otomatik Optimizasyon) props
  onApplyAutoFixPatch?: (
    patch: StudioPatch,
    targetArea: EditableAreaId,
    toastLabel: string
  ) => void;
  onCommitHistory?: () => void;
  currentSnapshot?: HistoryItem;
  isComparingBefore?: boolean;
  onToggleCompareBefore?: (snapshot: HistoryItem | null) => void;
}

const FLOATING_CATALOG: Array<{ type: FloatingElement['type']; label: string }> = [
  { type: 'water-splash', label: 'Su Damlaları' },
  { type: 'gold-coin', label: '3D Altın Para' },
  { type: '3d-sphere', label: 'Pastel Küre' },
  { type: 'sparkle', label: 'Işıltı Yıldızı' },
  { type: 'leaf', label: 'Gül Yaprağı' },
  { type: 'glow-ring', label: 'Neon Halka' },
  { type: 'gold-ribbon', label: 'Altın Kurdele' },
];

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  currentTemplateId,
  onSelectTemplate,
  background,
  onUpdateBackground,
  product,
  onUpdateProduct,
  typography,
  onUpdateTypography,
  badges,
  onUpdateBadges,
  promoBadge,
  onUpdatePromoBadge,
  floatingElements,
  onUpdateFloatingElements,
  layers,
  onUpdateLayers,
  activeElement,
  onSelectElement,
  onDeleteFloatingElement,
  activeTab: externalActiveTab,
  onTabChange,
  onOpenAiWizard,
  onOpenBgRemover,
  onExport,
  onOpenMultiChannel,
  onDownloadCutoutOnly,
  isExporting,
  aiTargetArea,
  onChangeAiTargetArea,
  aiChatMessages,
  onAppendAiMessage,
  onClearAiMessages,
  onApplyAiPatch,
  studioState,
  canUndo,
  onUndo,
  customTemplates,
  onAddCustomTemplates,
  onDeleteCustomTemplate,
  onAlignGoldenRatio,
  showGoldenGuide = false,
  onToggleGoldenGuide,
  isAligningProduct = false,
  onApplyColorHarmony,
  showSafeZone = false,
  onToggleSafeZone,
  onApplyOptimizerPatch,
  onApplyAbVariation,
  brandKit,
  brandWatermark,
  onUpdateBrandKit,
  onUpdateBrandWatermark,
  onApplyBrandKitToCanvas,
  savedProjects = [],
  onSaveProject,
  onLoadProject,
  onDuplicateProject,
  onDeleteProject,
  onResetWorkspace,
  isSavingProject = false,
  onApplyAutoFixPatch,
  onCommitHistory,
  currentSnapshot,
  isComparingBefore = false,
  onToggleCompareBefore,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<SidebarTabId>('templates');
  const [selectedCategory, setSelectedCategory] = useState<'Tümü' | 'AI Özel' | TemplateCategory>('Tümü');
  const [templateSearch, setTemplateSearch] = useState('');
  const [isCustomGeneratorOpen, setIsCustomGeneratorOpen] = useState(false);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const currentTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setTab = (t: SidebarTabId) => {
    setInternalActiveTab(t);
    if (onTabChange) onTabChange(t);
  };

  useEffect(() => {
    if (tabContentRef.current) {
      tabContentRef.current.scrollTop = 0;
    }
  }, [currentTab]);

  const tabs: { id: SidebarTabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'templates', label: 'Şablonlar', icon: LayoutTemplate },
    { id: 'autoFix', label: 'Oto Optimizasyon', icon: Wand2 },
    { id: 'harmony', label: 'Renk Harmonisi', icon: Palette },
    { id: 'optimizer', label: 'Kalite & A/B', icon: ShieldCheck },
    { id: 'brandProjects', label: 'Marka & Proje', icon: Briefcase },
    { id: 'aiChat', label: 'AI Sohbet', icon: MessageSquareText },
    { id: 'layers', label: 'Katmanlar', icon: Layers },
    { id: 'background', label: 'Arka Plan', icon: ImageIcon },
    { id: 'product', label: 'Ürün', icon: Package },
    { id: 'text', label: 'Metin', icon: Type },
    { id: 'badges', label: 'Rozetler', icon: Tag },
    { id: 'export', label: 'Dışa Aktar', icon: Download },
  ];

  const allTemplates = [...customTemplates, ...COVER_TEMPLATES];
  const categoryMatched =
    selectedCategory === 'Tümü'
      ? allTemplates
      : selectedCategory === 'AI Özel'
      ? customTemplates
      : allTemplates.filter((t) => t.category === selectedCategory);

  const normalizedQuery = templateSearch.trim().toLowerCase();
  const filteredTemplates = normalizedQuery
    ? categoryMatched.filter(
        (t) =>
          t.title.toLowerCase().includes(normalizedQuery) ||
          t.description.toLowerCase().includes(normalizedQuery) ||
          t.category.toLowerCase().includes(normalizedQuery) ||
          t.typography.headline.toLowerCase().includes(normalizedQuery)
      )
    : categoryMatched;

  const handleUploadCustomBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateBackground((prev) => ({
          ...prev,
          type: 'image',
          imageUrl: reader.result as string,
          stageStyle: 'none',
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <aside className="w-full lg:w-96 border-l border-slate-200 bg-white flex flex-col h-auto lg:h-full min-h-0 flex-shrink-0 overflow-hidden shadow-sm">
      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Stüdyo Kontrol Sekmeleri"
        className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/80 p-2 flex-shrink-0"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = currentTab === tab.id;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={isSelected}
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-white text-orange-600 shadow-xs border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div ref={tabContentRef} className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-5">
        {/* TAB: SMART AUTO-FIX (OTOMATİK OPTİMİZASYON) */}
        {currentTab === 'autoFix' &&
          onApplyAutoFixPatch &&
          onCommitHistory &&
          currentSnapshot &&
          onToggleCompareBefore && (
            <SmartAutoFixPanel
              studioState={studioState}
              activeElement={activeElement || null}
              brandWatermark={brandWatermark}
              onApplyAutoFixPatch={onApplyAutoFixPatch}
              onUpdateProduct={onUpdateProduct}
              onUpdateBackground={onUpdateBackground}
              onCommitHistory={onCommitHistory}
              canUndo={canUndo}
              onUndo={onUndo}
              currentSnapshot={currentSnapshot}
              isComparingBefore={isComparingBefore}
              onToggleCompareBefore={onToggleCompareBefore}
            />
          )}

        {/* TAB: COLOR HARMONY */}
        {currentTab === 'harmony' && onApplyColorHarmony && (
          <ColorHarmonyPanel
            productSrc={product.src}
            onApplyHarmony={onApplyColorHarmony}
            onQuickColorPick={(role, hex) => {
              if (role === 'highlight') {
                onUpdateTypography((prev) => ({ ...prev, highlightColor: hex }));
              } else {
                onUpdateTypography((prev) => ({ ...prev, ctaBgColor: hex }));
              }
            }}
            canUndo={canUndo}
            onUndo={onUndo}
          />
        )}

        {/* TAB: CAMPAIGN QUALITY AUDIT & A/B VARIATIONS */}
        {currentTab === 'optimizer' && onApplyOptimizerPatch && onApplyAbVariation && (
          <CampaignOptimizerPanel
            state={{
              aspectRatio: studioState.aspectRatio,
              background,
              product,
              typography,
              badges,
              badgesPosition: studioState.badgesPosition,
              promoBadge,
            }}
            brandName={brandKit?.brandName}
            showSafeZone={showSafeZone}
            onToggleSafeZone={onToggleSafeZone || (() => {})}
            onApplyPatch={onApplyOptimizerPatch}
            onApplyVariation={onApplyAbVariation}
            canUndo={canUndo}
            onUndo={onUndo}
          />
        )}

        {/* TAB: BRAND KIT & SAVED PROJECTS */}
        {currentTab === 'brandProjects' &&
          brandKit &&
          brandWatermark &&
          onUpdateBrandKit &&
          onUpdateBrandWatermark &&
          onApplyBrandKitToCanvas &&
          onSaveProject &&
          onLoadProject &&
          onDuplicateProject &&
          onDeleteProject &&
          onResetWorkspace && (
            <BrandAndProjectsPanel
              brandKit={brandKit}
              brandWatermark={brandWatermark}
              onUpdateBrandKit={onUpdateBrandKit}
              onUpdateBrandWatermark={onUpdateBrandWatermark}
              onApplyBrandKitToCanvas={onApplyBrandKitToCanvas}
              savedProjects={savedProjects}
              onSaveProject={onSaveProject}
              onLoadProject={onLoadProject}
              onDuplicateProject={onDuplicateProject}
              onDeleteProject={onDeleteProject}
              onResetWorkspace={onResetWorkspace}
              isSavingProject={isSavingProject}
            />
          )}

        {/* TAB: AI CONVERSATIONAL EDITOR */}
        {currentTab === 'aiChat' && (
          <AiChatEditorPanel
            targetArea={aiTargetArea}
            onChangeTargetArea={onChangeAiTargetArea}
            studioState={studioState}
            messages={aiChatMessages}
            onAppendMessage={onAppendAiMessage}
            onClearMessages={onClearAiMessages}
            onApplyPatch={onApplyAiPatch}
            canUndo={canUndo}
            onUndo={onUndo}
            onOpenAiWizard={onOpenAiWizard}
          />
        )}

        {/* TAB: LAYERS */}
        {currentTab === 'layers' && (
          <LayerPanel
            layers={layers}
            onUpdateLayers={onUpdateLayers}
            activeElement={activeElement || null}
            onSelectElement={onSelectElement || (() => {})}
            onDeleteFloatingElement={onDeleteFloatingElement}
          />
        )}

        {/* TAB 1: TEMPLATES WITH CATEGORY FILTERS & AI FROM-SCRATCH GENERATOR */}
        {currentTab === 'templates' && (
          <div className="space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Özelleştirilmiş Reklam Şablonları
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hazır şablon seçin veya istediğiniz tarz yoksa AI ile sıfırdan üretin
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomGeneratorOpen((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex-shrink-0 ${
                  isCustomGeneratorOpen
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                }`}
              >
                <Wand2 className="w-3 h-3" />
                <span>AI Üret</span>
              </button>
            </div>

            {/* Template Search */}
            <div className="relative">
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                aria-label="Şablonlarda Ara"
                placeholder="Şablon ara (örn: kahve, spor, parfüm)..."
                className="w-full text-xs px-3 py-2 pr-14 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-orange-500 outline-none transition-all"
              />
              {templateSearch && (
                <button
                  type="button"
                  onClick={() => setTemplateSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-slate-800"
                >
                  Temizle
                </button>
              )}
            </div>

            {/* AI Custom Template Generator (open manually OR automatically when search returns nothing) */}
            {(isCustomGeneratorOpen || filteredTemplates.length === 0) && (
              <CustomTemplateGenerator
                initialPrompt={filteredTemplates.length === 0 ? templateSearch : ''}
                selectedCategory={selectedCategory}
                onTemplatesGenerated={(generated) => {
                  onAddCustomTemplates(generated);
                  setSelectedCategory('AI Özel');
                  setTemplateSearch('');
                  setIsCustomGeneratorOpen(false);
                }}
                onClose={
                  filteredTemplates.length > 0 ? () => setIsCustomGeneratorOpen(false) : undefined
                }
              />
            )}

            {/* Category Filter Chips */}
            <div
              role="group"
              aria-label="Şablon Kategorileri"
              className="flex flex-wrap gap-1.5"
            >
              {TEMPLATE_CATEGORIES.map((cat) => {
                const count =
                  cat === 'Tümü'
                    ? allTemplates.length
                    : allTemplates.filter((t) => t.category === cat).length;
                const active = selectedCategory === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      active
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-orange-300 hover:bg-orange-50/40'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}

              {customTemplates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('AI Özel')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                    selectedCategory === 'AI Özel'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Özel ({customTemplates.length})</span>
                </button>
              )}
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">
                  “{templateSearch}” ile eşleşen hazır şablon bulunamadı
                </p>
                <p className="text-[11px] text-slate-500">
                  Yukarıdaki AI panelinden fikrinizi yazıp sıfırdan 3 özel şablon oluşturabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                {filteredTemplates.map((tmpl) => (
                  <div key={tmpl.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => onSelectTemplate(tmpl)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex gap-3.5 items-center text-left w-full ${
                        currentTemplateId === tmpl.id
                          ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-500/20'
                          : tmpl.isCustomAi
                          ? 'border-purple-200 bg-purple-50/20 hover:border-purple-400 hover:bg-purple-50/40'
                          : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        style={{
                          background:
                            tmpl.background.gradient ||
                            'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                        }}
                        className="w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200/90 relative p-1.5 flex flex-col justify-between shadow-inner"
                      >
                        {tmpl.background.type === 'image' && tmpl.background.imageUrl && (
                          <img
                            src={tmpl.background.imageUrl}
                            alt={tmpl.title}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                        <div className="relative z-10 space-y-0.5">
                          <p
                            style={{ color: tmpl.typography.headlineColor }}
                            className="text-[7px] font-black leading-[1.05] line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                          >
                            {tmpl.typography.headline}
                          </p>
                          {tmpl.typography.headlineHighlight && (
                            <p
                              style={{ color: tmpl.typography.highlightColor }}
                              className="text-[6.5px] font-extrabold leading-none truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                            >
                              {tmpl.typography.headlineHighlight}
                            </p>
                          )}
                        </div>
                        {tmpl.promoBadge.show && (
                          <div
                            style={{ backgroundColor: tmpl.promoBadge.color }}
                            className="relative z-10 self-start w-4 h-4 rounded-full border border-white/80 shadow-xs"
                          />
                        )}
                        <span className="relative z-10 self-end bg-black/75 text-white text-[9px] px-1 py-0.5 rounded font-mono leading-none">
                          {tmpl.aspectRatio}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 pr-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600">
                            {tmpl.category}
                          </span>
                          {tmpl.isCustomAi && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700">
                              AI Özel
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                          {tmpl.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                          {tmpl.description}
                        </p>
                      </div>
                    </button>

                    {tmpl.isCustomAi && (
                      <button
                        type="button"
                        aria-label={`Özel şablonu sil: ${tmpl.title}`}
                        title="Özel Şablonu Sil"
                        onClick={() => onDeleteCustomTemplate(tmpl.id)}
                        className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isCustomGeneratorOpen && filteredTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => setIsCustomGeneratorOpen(true)}
                className="w-full py-2.5 px-3 rounded-2xl border border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-50 text-purple-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Aradığın şablon yok mu? AI sıfırdan üretsin</span>
              </button>
            )}
          </div>
        )}

        {/* TAB 2: BACKGROUND & AI */}
        {currentTab === 'background' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-orange-500/10 to-pink-500/10 border border-orange-200/80">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Gemini AI ile Özel Sahne Üret
                </h4>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Ürününüz için fotoğraf stüdyosu kalitesinde büyüleyici arka planlar oluşturun.
              </p>
              <button
                type="button"
                onClick={onOpenAiWizard}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 hover:brightness-110 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Sahne Sihirbazını Aç</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTab('harmony')}
              className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Palette className="w-3.5 h-3.5 text-amber-600" />
              <span>Ürüne Göre Otomatik Renk Harmonisi Öner</span>
            </button>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Hazır Stüdyo Sahneleri ({STUDIO_BACKDROPS.length})
                </label>
                <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-[10px] font-bold transition-colors">
                  <Upload className="w-3 h-3" />
                  <span>Arka Fon Yükle</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCustomBackground}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {STUDIO_BACKDROPS.map((bd) => {
                  const isSelected =
                    background.type === 'image' && background.imageUrl === bd.imageUrl;
                  return (
                    <button
                      type="button"
                      key={bd.id}
                      onClick={() =>
                        onUpdateBackground((prev) => ({
                          ...prev,
                          type: 'image',
                          imageUrl: bd.imageUrl,
                          gradient: bd.fallbackGradient,
                          stageStyle: bd.stageStyle ?? 'none',
                        }))
                      }
                      className={`group relative flex flex-col items-start rounded-xl overflow-hidden border text-left transition-all ${
                        isSelected
                          ? 'border-orange-500 ring-2 ring-orange-500/25 bg-orange-50/40'
                          : 'border-slate-200 hover:border-orange-300 bg-white'
                      }`}
                    >
                      <div
                        style={{ background: bd.fallbackGradient }}
                        className="w-full h-20 relative overflow-hidden"
                      >
                        <img
                          src={bd.imageUrl}
                          alt={bd.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-[9px] font-bold">
                          {bd.category}
                        </span>
                      </div>
                      <div className="p-2 w-full">
                        <p className="text-[11px] font-bold text-slate-800 truncate">
                          {bd.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sahne Dekor Katmanı
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'none', label: 'Sade' },
                  { id: 'champagne-arch', label: 'Altın Kemer' },
                  { id: 'festive-lights', label: 'Işıklı Kar' },
                ].map((opt) => {
                  const active = (background.stageStyle ?? 'none') === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() =>
                        onUpdateBackground((prev) => ({
                          ...prev,
                          stageStyle: opt.id as StudioBackground['stageStyle'],
                        }))
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                        active
                          ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Hazır Stüdyo Renk Geçişleri ({PRESET_GRADIENTS.length})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_GRADIENTS.map((g, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() =>
                      onUpdateBackground((prev) => ({
                        ...prev,
                        type: 'gradient',
                        imageUrl: undefined,
                        gradient: g.value,
                      }))
                    }
                    className={`group flex flex-col items-center gap-1 p-1 rounded-xl border transition-all ${
                      background.type === 'gradient' && background.gradient === g.value
                        ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/40'
                        : 'border-slate-200 hover:border-orange-400'
                    }`}
                  >
                    <div
                      style={{ background: g.value }}
                      className="w-full h-10 rounded-lg shadow-inner"
                    />
                    <span className="text-[10px] text-slate-600 truncate w-full text-center font-medium">
                      {g.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              {background.type === 'image' && background.imageUrl && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Görsel Sığdırma Modu
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'cover', label: 'Tuvali Doldur (Cover)' },
                      { id: 'contain', label: 'Tam Sığdır (Contain)' },
                    ].map((opt) => {
                      const active = (background.fitMode ?? 'cover') === opt.id;
                      return (
                        <button
                          type="button"
                          key={opt.id}
                          onClick={() =>
                            onUpdateBackground((prev) => ({
                              ...prev,
                              fitMode: opt.id as 'cover' | 'contain',
                            }))
                          }
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                            active
                              ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Arka Plan Bulanıklığı (Bokeh)</span>
                  <span className="font-mono text-orange-600">{background.blur}px</span>
                </div>
                <input
                  type="range"
                  aria-label="Arka Plan Bulanıklığı"
                  min="0"
                  max="15"
                  value={background.blur}
                  onChange={(e) =>
                    onUpdateBackground((p) => ({ ...p, blur: Number(e.target.value) }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Parlaklık</span>
                  <span className="font-mono text-orange-600">
                    {Math.round(background.brightness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Arka Plan Parlaklığı"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={background.brightness}
                  onChange={(e) =>
                    onUpdateBackground((p) => ({
                      ...p,
                      brightness: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Arka Plan Kontrastı</span>
                  <span className="font-mono text-orange-600 tabular-nums">
                    {Math.round((background.contrast ?? 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Arka Plan Kontrastı"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={background.contrast ?? 1}
                  onChange={(e) =>
                    onUpdateBackground((p) => ({
                      ...p,
                      contrast: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-700">Vinyet (Kenar Karartma)</span>
                <button
                  type="button"
                  aria-label="Vinyet Aç Kapat"
                  onClick={() =>
                    onUpdateBackground((p) => ({ ...p, vignette: !p.vignette }))
                  }
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    background.vignette ? 'bg-orange-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      background.vignette ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCT & SHADOW */}
        {currentTab === 'product' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">
                Ürün Boyutu & Gölge Efektleri
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ürünün sahnede doğal ve gerçekçi durması için stüdyo gölgesi ve yansımaları
              </p>
            </div>

            {onOpenBgRemover && (
              <button
                type="button"
                onClick={onOpenBgRemover}
                className="w-full py-2.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Scissors className="w-4 h-4 text-orange-600" />
                <span>Arka Fonu Temizle / Dekupeyi Düzenle</span>
              </button>
            )}

            {/* AI Center of Gravity & Golden Ratio Alignment */}
            {onAlignGoldenRatio && (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-extrabold text-slate-800">
                      AI Ağırlık Merkezi & Altın Oran (φ)
                    </span>
                  </div>
                  {onToggleGoldenGuide && (
                    <button
                      type="button"
                      onClick={onToggleGoldenGuide}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                        showGoldenGuide
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Grid className="w-3 h-3" />
                      <span>Kılavuz</span>
                    </button>
                  )}
                </div>

                {product.centerOfGravity ? (
                  <div className="text-[11px] bg-white/80 rounded-lg p-2 border border-amber-200/70 space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span>
                        Ağırlık Merkezi: %{Math.round(product.centerOfGravity.x * 100)}, %
                        {Math.round(product.centerOfGravity.y * 100)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        {product.centerOfGravity.source === 'ai' ? 'AI Analizi' : 'Piksel Analizi'}
                      </span>
                    </div>
                    {product.centerOfGravity.rationale && (
                      <p className="text-[10px] text-slate-600 leading-snug">
                        {product.centerOfGravity.rationale}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    Görsel içeri aktarıldığında veya butona basıldığında ürünün görsel ağırlık merkezi bulunup Altın Oran (%61.8) noktasına hizalanır.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onAlignGoldenRatio('auto')}
                  disabled={isAligningProduct || !product.src}
                  className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  {isAligningProduct ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isAligningProduct
                      ? 'Ağırlık Merkezi Hesaplanıyor...'
                      : 'AI Ağırlık Merkezi ile Altın Orana Hizala'}
                  </span>
                </button>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'right-golden' as GoldenPresetId, label: 'Sağ %61.8' },
                    { id: 'left-golden' as GoldenPresetId, label: 'Sol %38.2' },
                    { id: 'bottom-center-golden' as GoldenPresetId, label: 'Merkez %61.8' },
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => onAlignGoldenRatio(preset.id)}
                      disabled={isAligningProduct || !product.src}
                      className="py-1.5 px-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-100/70 text-[10px] font-bold text-slate-700 transition-colors disabled:opacity-50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Ürün Boyutu (Ölçek)</span>
                  <span className="font-mono text-orange-600">
                    {Math.round(product.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Ürün Ölçeği"
                  min="0.4"
                  max="1.8"
                  step="0.05"
                  value={product.scale}
                  onChange={(e) =>
                    onUpdateProduct((p) => ({ ...p, scale: Number(e.target.value) }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Döndürme Açısı</span>
                  <span className="font-mono text-orange-600">{product.rotation}°</span>
                </div>
                <input
                  type="range"
                  aria-label="Döndürme Açısı"
                  min="-45"
                  max="45"
                  value={product.rotation}
                  onChange={(e) =>
                    onUpdateProduct((p) => ({
                      ...p,
                      rotation: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateProduct((p) => ({ ...p, flipX: !p.flipX }))}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {product.flipX ? 'Aynalamayı Kapat' : 'Yatay Aynala'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProduct((p) => ({
                      ...p,
                      x: 50,
                      y: 55,
                      rotation: 0,
                    }))
                  }
                  className="py-1.5 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Ortala
                </button>
              </div>
            </div>

            {/* Drop Shadow & Ambient Glow */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Stüdyo Taban Gölgesi & Işık Halesi
              </span>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Gölge Opaklığı</span>
                  <span className="font-mono text-orange-600">
                    {Math.round(product.shadowOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Gölge Opaklığı"
                  min="0"
                  max="1"
                  step="0.05"
                  value={product.shadowOpacity}
                  onChange={(e) =>
                    onUpdateProduct((p) => ({
                      ...p,
                      shadowOpacity: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Gölge Yayılımı (Blur)</span>
                  <span className="font-mono text-orange-600">{product.shadowBlur}px</span>
                </div>
                <input
                  type="range"
                  aria-label="Gölge Yayılımı"
                  min="4"
                  max="50"
                  value={product.shadowBlur}
                  onChange={(e) =>
                    onUpdateProduct((p) => ({
                      ...p,
                      shadowBlur: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div className="pt-1 border-t border-slate-200/80">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Arka Işık Halesi (Ambient Glow)</span>
                  <span className="font-mono text-orange-600">
                    {Math.round(product.ambientGlow * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    aria-label="Arka Işık Halesi"
                    min="0"
                    max="1"
                    step="0.05"
                    value={product.ambientGlow}
                    onChange={(e) =>
                      onUpdateProduct((p) => ({
                        ...p,
                        ambientGlow: Number(e.target.value),
                      }))
                    }
                    className="flex-1 accent-orange-600 cursor-pointer"
                  />
                  <input
                    type="color"
                    aria-label="Işık Halesi Rengi"
                    value={product.glowColor || '#ffffff'}
                    onChange={(e) =>
                      onUpdateProduct((p) => ({ ...p, glowColor: e.target.value }))
                    }
                    className="w-7 h-7 rounded cursor-pointer border border-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* Floor Mirror Reflection */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Zemin Ayna Yansıması
                </span>
                <button
                  type="button"
                  aria-label="Zemin Ayna Yansıması Aç Kapat"
                  onClick={() =>
                    onUpdateProduct((p) => ({
                      ...p,
                      reflection: !p.reflection,
                    }))
                  }
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    product.reflection ? 'bg-orange-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      product.reflection ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {product.reflection && (
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Yansıma Saydamlığı</span>
                    <span className="font-mono text-orange-600">
                      {Math.round(product.reflectionOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Yansıma Saydamlığı"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={product.reflectionOpacity}
                    onChange={(e) =>
                      onUpdateProduct((p) => ({
                        ...p,
                        reflectionOpacity: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-orange-600 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Color Adjustments */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Ürün Renk & Işık Ayarı
              </span>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Parlaklık</span>
                  <span className="font-mono text-orange-600">
                    {Math.round(product.brightness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Ürün Parlaklığı"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={product.brightness}
                  onChange={(e) =>
                    onUpdateProduct((p) => ({
                      ...p,
                      brightness: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Kontrast</span>
                  <span className="font-mono text-orange-600 tabular-nums">
                    {Math.round(product.contrast * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Ürün Kontrastı"
                  min="0.8"
                  max="1.35"
                  step="0.05"
                  value={product.contrast}
                  onChange={(e) =>
                    onUpdateProduct((p) => ({
                      ...p,
                      contrast: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Görsel Netlik (Keskinlik)</span>
                  <span className="font-mono text-orange-600 tabular-nums">
                    +{Math.round((product.clarity ?? 0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Ürün Görsel Netliği"
                  min="0"
                  max="1"
                  step="0.05"
                  value={product.clarity ?? 0}
                  onChange={(e) =>
                    onUpdateProduct((p) => ({
                      ...p,
                      clarity: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TYPOGRAPHY & AI SLOGANS */}
        {currentTab === 'text' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Tipografi & Reklam Metni
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vurucu başlıklar, alt açıklamalar ve eylem butonları
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAiWizard}
                className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center gap-1 text-xs font-bold"
                title="AI ile Slogan Üret"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>AI Slogan</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Üst Vurgu (Kicker)
                </label>
                <input
                  type="text"
                  value={typography.kicker}
                  onChange={(e) =>
                    onUpdateTypography((t) => ({ ...t, kicker: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ana Başlık (Headline)
                </label>
                <input
                  type="text"
                  value={typography.headline}
                  onChange={(e) =>
                    onUpdateTypography((t) => ({ ...t, headline: e.target.value }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-orange-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  İkinci Satır Vurgusu
                </label>
                <input
                  type="text"
                  value={typography.headlineHighlight || ''}
                  onChange={(e) =>
                    onUpdateTypography((t) => ({
                      ...t,
                      headlineHighlight: e.target.value,
                    }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-orange-500 outline-none font-bold text-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alt Açıklama (Subtitle)
                </label>
                <textarea
                  rows={2}
                  value={typography.subtitle}
                  onChange={(e) =>
                    onUpdateTypography((t) => ({ ...t, subtitle: e.target.value }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-orange-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  CTA Buton Metni
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={typography.ctaText}
                    onChange={(e) =>
                      onUpdateTypography((t) => ({ ...t, ctaText: e.target.value }))
                    }
                    className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-orange-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTypography((t) => ({ ...t, showCta: !t.showCta }))
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      typography.showCta
                        ? 'bg-orange-50 border-orange-300 text-orange-700'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    {typography.showCta ? 'Açık' : 'Kapalı'}
                  </button>
                </div>
              </div>
            </div>

            {/* Styling */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Yazı Tipi (Font)
                </label>
                <select
                  value={typography.fontFamily}
                  onChange={(e) =>
                    onUpdateTypography((t) => ({
                      ...t,
                      fontFamily: e.target.value as StudioTypography['fontFamily'],
                    }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Cabinet Grotesk">Cabinet Grotesk (Modern Reklam)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Temiz Sans)</option>
                  <option value="Playfair Display">Playfair Display (Lüks Serif)</option>
                  <option value="Inter">Inter (Minimal Tech)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>Başlık Boyutu</span>
                  <span className="font-mono text-orange-600">
                    {Math.round(typography.headlineSize * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Başlık Boyutu"
                  min="0.6"
                  max="1.6"
                  step="0.05"
                  value={typography.headlineSize}
                  onChange={(e) =>
                    onUpdateTypography((t) => ({
                      ...t,
                      headlineSize: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Başlık Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Başlık Rengi"
                      value={typography.headlineColor}
                      onChange={(e) =>
                        onUpdateTypography((t) => ({
                          ...t,
                          headlineColor: e.target.value,
                        }))
                      }
                      className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <span className="text-[11px] font-mono">{typography.headlineColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Vurgu Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Vurgu Rengi"
                      value={typography.highlightColor}
                      onChange={(e) =>
                        onUpdateTypography((t) => ({
                          ...t,
                          highlightColor: e.target.value,
                        }))
                      }
                      className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <span className="text-[11px] font-mono">{typography.highlightColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Alt Metin Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Alt Metin Rengi"
                      value={typography.subtitleColor}
                      onChange={(e) =>
                        onUpdateTypography((t) => ({
                          ...t,
                          subtitleColor: e.target.value,
                        }))
                      }
                      className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <span className="text-[11px] font-mono">{typography.subtitleColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    CTA Buton & Yazı
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      aria-label="CTA Arka Plan Rengi"
                      value={typography.ctaBgColor}
                      onChange={(e) =>
                        onUpdateTypography((t) => ({
                          ...t,
                          ctaBgColor: e.target.value,
                        }))
                      }
                      className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <input
                      type="color"
                      aria-label="CTA Yazı Rengi"
                      value={typography.ctaTextColor}
                      onChange={(e) =>
                        onUpdateTypography((t) => ({
                          ...t,
                          ctaTextColor: e.target.value,
                        }))
                      }
                      className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Hizalama
                </label>
                <div className="flex gap-2">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      type="button"
                      key={align}
                      onClick={() =>
                        onUpdateTypography((t) => ({
                          ...t,
                          alignment: align,
                          positionX: align === 'center' ? 50 : align === 'right' ? 92 : 7,
                        }))
                      }
                      className={`flex-1 py-1 text-xs font-bold rounded-lg border ${
                        typography.alignment === align
                          ? 'bg-white border-orange-500 text-orange-600 shadow-sm'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {align === 'left' ? 'Sol' : align === 'center' ? 'Orta' : 'Sağ'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BADGES & 3D STICKERS */}
        {currentTab === 'badges' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">
                Özellik Rozetleri & Kampanya
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Güven etiketleri, indirim çıkartmaları ve dekoratif 3D objeler
              </p>
            </div>

            {/* Promo Badge Settings */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Kampanya & İndirim Çıkartması
                </span>
                <button
                  type="button"
                  aria-label="Kampanya Çıkartması Aç Kapat"
                  onClick={() =>
                    onUpdatePromoBadge((p) => ({ ...p, show: !p.show }))
                  }
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    promoBadge.show ? 'bg-orange-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      promoBadge.show ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {promoBadge.show && (
                <div className="space-y-2.5 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Ana Metin (%25 İNDİRİM)"
                      value={promoBadge.text}
                      onChange={(e) =>
                        onUpdatePromoBadge((p) => ({ ...p, text: e.target.value }))
                      }
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Alt Metin (SINIRLI STOK)"
                      value={promoBadge.subtext || ''}
                      onChange={(e) =>
                        onUpdatePromoBadge((p) => ({ ...p, subtext: e.target.value }))
                      }
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Rozet Rengi"
                      value={promoBadge.color}
                      onChange={(e) =>
                        onUpdatePromoBadge((p) => ({ ...p, color: e.target.value }))
                      }
                      className="w-7 h-7 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="color"
                      aria-label="Rozet Yazı Rengi"
                      value={promoBadge.textColor}
                      onChange={(e) =>
                        onUpdatePromoBadge((p) => ({ ...p, textColor: e.target.value }))
                      }
                      className="w-7 h-7 rounded cursor-pointer border border-slate-300"
                    />
                    <span className="text-[11px] text-slate-600">Zemin / Yazı</span>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePromoBadge((p) => ({
                          ...p,
                          type: p.type === 'circle' ? 'pill' : 'circle',
                        }))
                      }
                      className="text-xs px-2.5 py-1 rounded-lg border bg-white text-slate-700 font-bold"
                    >
                      Şekil: {promoBadge.type === 'circle' ? 'Daire' : 'Etiket'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>Boyut</span>
                        <span>{Math.round(promoBadge.scale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        aria-label="Kampanya Rozeti Boyutu"
                        min="0.6"
                        max="1.6"
                        step="0.05"
                        value={promoBadge.scale}
                        onChange={(e) =>
                          onUpdatePromoBadge((p) => ({ ...p, scale: Number(e.target.value) }))
                        }
                        className="w-full accent-orange-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>Açı</span>
                        <span>{promoBadge.rotation}°</span>
                      </div>
                      <input
                        type="range"
                        aria-label="Kampanya Rozeti Açısı"
                        min="-35"
                        max="35"
                        value={promoBadge.rotation}
                        onChange={(e) =>
                          onUpdatePromoBadge((p) => ({
                            ...p,
                            rotation: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-orange-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature Pills List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Özellik Rozetleri ({badges.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBadges((prev) => [
                      ...prev,
                      {
                        id: `b-${Date.now()}`,
                        icon: 'sparkles',
                        label: 'Yeni Özellik',
                        sublabel: 'Kısa açıklama',
                      },
                    ])
                  }
                  className="text-xs text-orange-600 font-bold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  <span>Rozet Ekle</span>
                </button>
              </div>

              {badges.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Rozet İkonu"
                      value={b.icon}
                      onChange={(e) =>
                        onUpdateBadges((prev) =>
                          prev.map((item) =>
                            item.id === b.id
                              ? { ...item, icon: e.target.value as FeatureBadge['icon'] }
                              : item
                          )
                        )
                      }
                      className="text-[11px] px-1.5 py-1 rounded bg-white border border-slate-300"
                    >
                      <option value="sun">Güneş</option>
                      <option value="shield">Kalkan</option>
                      <option value="droplet">Damla</option>
                      <option value="sparkles">Işıltı</option>
                      <option value="award">Ödül</option>
                      <option value="zap">Hız</option>
                      <option value="leaf">Yaprak</option>
                      <option value="clock">Saat</option>
                    </select>
                    <input
                      type="text"
                      value={b.label}
                      onChange={(e) =>
                        onUpdateBadges((prev) =>
                          prev.map((item) =>
                            item.id === b.id ? { ...item, label: e.target.value } : item
                          )
                        )
                      }
                      className="flex-1 text-xs px-2 py-1 rounded bg-white border border-slate-300 font-bold"
                    />
                    <button
                      type="button"
                      aria-label={`Rozeti sil: ${b.label}`}
                      onClick={() =>
                        onUpdateBadges((prev) => prev.filter((item) => item.id !== b.id))
                      }
                      className="p-1 rounded text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Alt açıklama (isteğe bağlı)"
                    value={b.sublabel || ''}
                    onChange={(e) =>
                      onUpdateBadges((prev) =>
                        prev.map((item) =>
                          item.id === b.id ? { ...item, sublabel: e.target.value } : item
                        )
                      )
                    }
                    className="w-full text-[11px] px-2 py-1 rounded bg-white border border-slate-200 text-slate-600"
                  />
                </div>
              ))}
            </div>

            {/* Floating Visual Elements Add & Manage */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Dekoratif 3D Efekt Ekle
              </span>
              <div className="flex flex-wrap gap-1.5">
                {FLOATING_CATALOG.map((item) => (
                  <button
                    type="button"
                    key={item.type}
                    onClick={() =>
                      onUpdateFloatingElements((prev) => [
                        ...prev,
                        {
                          id: `f-${Date.now()}-${Math.round(Math.random() * 1000)}`,
                          type: item.type,
                          x: Math.round(25 + Math.random() * 50),
                          y: Math.round(25 + Math.random() * 50),
                          scale: 1.0,
                          rotation: Math.round(Math.random() * 30 - 15),
                          opacity: 0.9,
                        },
                      ])
                    }
                    className="text-xs px-2.5 py-1 rounded-lg border bg-white border-slate-200 text-slate-700 hover:border-orange-400 hover:text-orange-600 font-medium transition-all"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>

              {floatingElements.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Sahnedeki Efektler ({floatingElements.length})
                  </span>
                  {floatingElements.map((el, idx) => {
                    const label =
                      el.type === 'custom-sticker'
                        ? el.label || '3D AI Sticker'
                        : FLOATING_CATALOG.find((c) => c.type === el.type)?.label || el.type;
                    return (
                      <div
                        key={el.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs"
                      >
                        <span className="font-semibold text-slate-700 truncate flex-1">
                          {label} #{idx + 1}
                        </span>
                        <input
                          type="range"
                          aria-label={`${label} boyut`}
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={el.scale}
                          onChange={(e) =>
                            onUpdateFloatingElements((prev) =>
                              prev.map((item) =>
                                item.id === el.id
                                  ? { ...item, scale: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="w-16 accent-orange-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          aria-label={`${label} sil`}
                          onClick={() => {
                            if (onDeleteFloatingElement) {
                              onDeleteFloatingElement(el.id);
                            } else {
                              onUpdateFloatingElements((prev) =>
                                prev.filter((item) => item.id !== el.id)
                              );
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: EXPORT */}
        {currentTab === 'export' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">
                Yüksek Çözünürlüklü Dışa Aktar
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                PNG, JPG, WebP veya 4’lü çoklu kanal kampanya paketi (.ZIP) olarak indirin
              </p>
            </div>

            {onOpenMultiChannel && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-white space-y-2.5">
                <div>
                  <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                    <span>4’lü Çoklu Kanal Kampanya Paketi (.ZIP)</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    1:1 Post, 4:5 Akış, 9:16 Hikaye/Reels ve 16:9 Web Banner formatlarını tek tıkla üretip indirin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenMultiChannel}
                  className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>4 Kanalı Önizle & ZIP İndir</span>
                </button>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Sosyal Medya & Web HD (1080p)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Instagram, Trendyol, Hepsiburada ve hızlı Web yüklemesi için optimize
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onExport('png', 1)}
                  disabled={isExporting}
                  className="py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1 transition-all disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExport('jpeg', 1)}
                  disabled={isExporting}
                  className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1 transition-all disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExport('webp', 1)}
                  disabled={isExporting}
                  className="py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>WebP</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/40 flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <h4 className="text-xs font-bold text-orange-950">
                    Retina & 4K Ultra Çözünürlük (2160p)
                  </h4>
                </div>
                <p className="text-[11px] text-orange-800/80 mt-0.5">
                  Kristal netliğinde reklam afişi ve katalog baskısı için 2x ölçek
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onExport('png', 2)}
                  disabled={isExporting}
                  className="py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>4K PNG İndir</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExport('webp', 2)}
                  disabled={isExporting}
                  className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>4K WebP İndir</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Yalnızca Temizlenmiş Ürün (Şeffaf PNG)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Arka planı silinmiş ürün dekupe görselini şeffaf olarak indirin
                </p>
              </div>
              <button
                type="button"
                onClick={onDownloadCutoutOnly}
                className="w-full py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Şeffaf PNG Dekupe İndir</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
