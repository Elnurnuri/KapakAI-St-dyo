import React, { useState } from 'react';
import {
  Briefcase,
  FolderOpen,
  Save,
  Trash2,
  Copy,
  Upload,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  BrandKit,
  BrandWatermark,
  SavedProject,
  StudioTypography,
} from '../types';

interface BrandAndProjectsPanelProps {
  brandKit: BrandKit;
  brandWatermark: BrandWatermark;
  onUpdateBrandKit: (updater: (prev: BrandKit) => BrandKit) => void;
  onUpdateBrandWatermark: (updater: (prev: BrandWatermark) => BrandWatermark) => void;
  onApplyBrandKitToCanvas: () => void;
  savedProjects: SavedProject[];
  onSaveProject: (name: string) => Promise<void>;
  onLoadProject: (project: SavedProject) => void;
  onDuplicateProject: (project: SavedProject) => void;
  onDeleteProject: (id: string) => void;
  onResetWorkspace: () => void;
  isSavingProject: boolean;
}

export const BrandAndProjectsPanel: React.FC<BrandAndProjectsPanelProps> = ({
  brandKit,
  brandWatermark,
  onUpdateBrandKit,
  onUpdateBrandWatermark,
  onApplyBrandKitToCanvas,
  savedProjects,
  onSaveProject,
  onLoadProject,
  onDuplicateProject,
  onDeleteProject,
  onResetWorkspace,
  isSavingProject,
}) => {
  const [projectName, setProjectName] = useState<string>('');

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = projectName.trim() || `${brandKit.brandName || 'Kampanya'} Tasarımı`;
    await onSaveProject(clean);
    setProjectName('');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const url = reader.result;
        onUpdateBrandKit((prev) => ({ ...prev, logoUrl: url, showWatermark: true }));
        onUpdateBrandWatermark((prev) => ({ ...prev, logoUrl: url, show: true }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const fontOptions: StudioTypography['fontFamily'][] = [
    'Cabinet Grotesk',
    'Plus Jakarta Sans',
    'Playfair Display',
    'Inter',
  ];

  const positionOptions: Array<{ id: BrandWatermark['position']; label: string }> = [
    { id: 'top-left', label: 'Sol Üst' },
    { id: 'top-right', label: 'Sağ Üst' },
    { id: 'bottom-left', label: 'Sol Alt' },
    { id: 'bottom-right', label: 'Sağ Alt' },
  ];

  return (
    <div className="space-y-5" data-testid="brand-projects-panel">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-orange-600" />
            <span>Marka Kiti & Projelerim</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kurumsal kimliğinizi sabitleyin ve kampanya tasarımlarınızı kaydedin
          </p>
        </div>
        <button
          type="button"
          onClick={onResetWorkspace}
          title="Çalışma alanını başlangıç şablonuna sıfırla"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 whitespace-nowrap shrink-0 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Sıfırla</span>
        </button>
      </div>

      {/* Section 1: Save & Load Projects */}
      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-slate-700" />
            <span>Kayıtlı Projeler ({savedProjects.length})</span>
          </span>
          <span className="text-[11px] text-slate-500">Otomatik taslak açık</span>
        </div>

        <form onSubmit={handleSaveSubmit} className="flex items-center gap-1.5">
          <label htmlFor="save-project-input" className="sr-only">
            Proje Adı
          </label>
          <input
            id="save-project-input"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Proje adı (örn: Yaz Lansmanı 4:5)"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={isSavingProject}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingProject ? 'Kaydediliyor' : 'Kaydet'}</span>
          </button>
        </form>

        {savedProjects.length === 0 ? (
          <div className="py-4 px-3 rounded-lg border border-dashed border-slate-200 bg-white text-center">
            <p className="text-xs font-semibold text-slate-700">Henüz Kayıtlı Proje Yok</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Farklı kampanya kurgularını yukarıdan isim vererek kaydedip dilediğiniz an geri yükleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {savedProjects.map((proj) => (
              <div
                key={proj.id}
                data-testid="saved-project-item"
                className="p-2 rounded-lg border border-slate-200 bg-white flex items-center gap-2.5"
              >
                {proj.thumbnailDataUrl ? (
                  <img
                    src={proj.thumbnailDataUrl}
                    alt={proj.name}
                    className="w-11 h-11 rounded object-cover border border-slate-100 shrink-0 bg-slate-100"
                  />
                ) : (
                  <div className="w-11 h-11 rounded bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {proj.aspectRatio}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{proj.name}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {proj.aspectRatio} ·{' '}
                    {new Date(proj.updatedAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onLoadProject(proj)}
                    className="px-2.5 py-1.5 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-800 text-[11px] font-bold transition-colors"
                  >
                    Yükle
                  </button>
                  <button
                    type="button"
                    aria-label={`Projeyi çoğalt: ${proj.name}`}
                    onClick={() => onDuplicateProject(proj)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Projeyi sil: ${proj.name}`}
                    onClick={() => onDeleteProject(proj.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Brand Kit & Corner Watermark */}
      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3.5">
        <div>
          <h4 className="text-xs font-extrabold text-slate-900">Kurumsal Marka Kiti</h4>
          <p className="text-[11px] text-slate-500">
            Marka adınızı, logonuzu, renklerinizi ve yazı tipinizi tüm şablonlara tek tıkla aktarın
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="brand-name-input" className="text-[11px] font-semibold text-slate-700 block mb-1">
              Marka Adı
            </label>
            <input
              id="brand-name-input"
              type="text"
              value={brandKit.brandName}
              onChange={(e) => {
                const val = e.target.value;
                onUpdateBrandKit((prev) => ({ ...prev, brandName: val }));
                onUpdateBrandWatermark((prev) => ({ ...prev, brandName: val }));
              }}
              placeholder="Örn: LUMINA SKIN"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
            />
          </div>
          <div>
            <label htmlFor="brand-tagline-input" className="text-[11px] font-semibold text-slate-700 block mb-1">
              Üst Slogan (Kicker)
            </label>
            <input
              id="brand-tagline-input"
              type="text"
              value={brandKit.tagline}
              onChange={(e) => onUpdateBrandKit((prev) => ({ ...prev, tagline: e.target.value }))}
              placeholder="Örn: DERMATOLOJİK SERİ"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
            />
          </div>
        </div>

        {/* Logo Upload + Watermark Toggle */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>{brandKit.logoUrl ? 'Logoyu Değiştir' : 'Marka Logosu Yükle'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            aria-pressed={brandWatermark.show}
            onClick={() => {
              const nextShow = !brandWatermark.show;
              onUpdateBrandWatermark((prev) => ({ ...prev, show: nextShow }));
              onUpdateBrandKit((prev) => ({ ...prev, showWatermark: nextShow }));
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              brandWatermark.show
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {brandWatermark.show && <Check className="w-3.5 h-3.5" />}
            <span>Köşe Filigranı</span>
          </button>
        </div>

        {brandWatermark.show && (
          <div className="grid grid-cols-4 gap-1.5">
            {positionOptions.map((pos) => (
              <button
                type="button"
                key={pos.id}
                onClick={() => {
                  onUpdateBrandWatermark((prev) => ({ ...prev, position: pos.id }));
                  onUpdateBrandKit((prev) => ({ ...prev, watermarkPosition: pos.id }));
                }}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-colors ${
                  brandWatermark.position === pos.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        )}

        {/* Brand Palette & Font */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="brand-primary-color" className="text-[10px] font-semibold text-slate-600 block mb-1">
              Başlık Rengi
            </label>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200">
              <input
                id="brand-primary-color"
                type="color"
                value={brandKit.primaryColor}
                onChange={(e) =>
                  onUpdateBrandKit((prev) => ({ ...prev, primaryColor: e.target.value }))
                }
                className="w-5 h-5 rounded cursor-pointer border-0 p-0"
              />
              <span className="text-[10px] font-mono text-slate-600 uppercase">
                {brandKit.primaryColor}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="brand-accent-color" className="text-[10px] font-semibold text-slate-600 block mb-1">
              Vurgu Rengi
            </label>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200">
              <input
                id="brand-accent-color"
                type="color"
                value={brandKit.accentColor}
                onChange={(e) =>
                  onUpdateBrandKit((prev) => ({ ...prev, accentColor: e.target.value }))
                }
                className="w-5 h-5 rounded cursor-pointer border-0 p-0"
              />
              <span className="text-[10px] font-mono text-slate-600 uppercase">
                {brandKit.accentColor}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="brand-cta-color" className="text-[10px] font-semibold text-slate-600 block mb-1">
              Buton Rengi
            </label>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200">
              <input
                id="brand-cta-color"
                type="color"
                value={brandKit.ctaColor}
                onChange={(e) =>
                  onUpdateBrandKit((prev) => ({ ...prev, ctaColor: e.target.value }))
                }
                className="w-5 h-5 rounded cursor-pointer border-0 p-0"
              />
              <span className="text-[10px] font-mono text-slate-600 uppercase">
                {brandKit.ctaColor}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="brand-font-select" className="text-[11px] font-semibold text-slate-700 block mb-1">
            Kurumsal Yazı Tipi
          </label>
          <select
            id="brand-font-select"
            value={brandKit.fontFamily}
            onChange={(e) =>
              onUpdateBrandKit((prev) => ({
                ...prev,
                fontFamily: e.target.value as StudioTypography['fontFamily'],
              }))
            }
            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
          >
            {fontOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onApplyBrandKitToCanvas}
          className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
        >
          <Check className="w-4 h-4" />
          <span>Marka Kitini Tuvale Uygula</span>
        </button>
      </div>
    </div>
  );
};
