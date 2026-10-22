import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Palette,
  Save,
  Upload,
  RotateCcw,
  Eye,
  EyeOff,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  Undo2,
  Paintbrush
} from 'lucide-react';
import { api } from '../services/api';
import { ThemePalette } from '../types';
import { DEFAULT_PALETTES } from '../context/DashboardAppearanceContext';

interface ThemeColorCustomizerProps {
  activeDesignId: string;
  designName: string;
  onPalettePublished?: () => void;
}

// Preset definitions
const PRESET_PALETTES: Record<string, { name: string; nameHi: string; palette: ThemePalette }> = {
  kisan_green: {
    name: 'Kisan Green',
    nameHi: 'किसान ग्रीन',
    palette: {
      sidebarBg: '#1B5E3B', sidebarText: '#FFFFFF', sidebarIcon: '#B8E6CC',
      sidebarActiveBg: '#0F4429', sidebarActiveText: '#FFFFFF', sidebarHoverBg: '#247A4D', sidebarBorder: '#0F4429',
      headerBg: '#1B5E3B', headerText: '#FFFFFF', headerIcon: '#B8E6CC',
      headerBorder: '#0F4429', headerDropdownBg: '#FFFFFF', headerDropdownText: '#1B3A2B',
      pageBg: '#F5F9F6', textPrimary: '#1B3A2B', textSecondary: '#5A7A68',
      cardBg: '#FFFFFF', cardBorder: '#D4E8DC', cardHeadingText: '#1B3A2B',
      inputBg: '#FFFFFF', inputBorder: '#D4E8DC', modalBg: '#FFFFFF',
      primaryButtonBg: '#1B5E3B', primaryButtonText: '#FFFFFF',
      secondaryButtonBg: '#E0F0E6', secondaryButtonText: '#1B5E3B',
      hoverState: '#0F4429', focusRing: '#1B5E3B', disabledState: '#C4D6CC',
      linkColor: '#1B5E3B', accentColor: '#E6A52E'
    }
  },
  harvest_premium: {
    name: 'Harvest Premium',
    nameHi: 'हार्वेस्ट प्रीमियम',
    palette: { ...DEFAULT_PALETTES['harvest_standard'] }
  },
  light_fresh: {
    name: 'Light & Fresh',
    nameHi: 'लाइट और फ्रेश',
    palette: {
      sidebarBg: '#FFFFFF', sidebarText: '#334155', sidebarIcon: '#3B82F6',
      sidebarActiveBg: '#EFF6FF', sidebarActiveText: '#1D4ED8', sidebarHoverBg: '#F1F5F9', sidebarBorder: '#E2E8F0',
      headerBg: '#FFFFFF', headerText: '#1E293B', headerIcon: '#64748B',
      headerBorder: '#E2E8F0', headerDropdownBg: '#FFFFFF', headerDropdownText: '#334155',
      pageBg: '#F8FAFC', textPrimary: '#1E293B', textSecondary: '#64748B',
      cardBg: '#FFFFFF', cardBorder: '#E2E8F0', cardHeadingText: '#0F172A',
      inputBg: '#FFFFFF', inputBorder: '#CBD5E1', modalBg: '#FFFFFF',
      primaryButtonBg: '#3B82F6', primaryButtonText: '#FFFFFF',
      secondaryButtonBg: '#F1F5F9', secondaryButtonText: '#334155',
      hoverState: '#2563EB', focusRing: '#3B82F6', disabledState: '#CBD5E1',
      linkColor: '#3B82F6', accentColor: '#F59E0B'
    }
  },
  earth_harvest: {
    name: 'Earth & Harvest',
    nameHi: 'मिट्टी और फसल',
    palette: {
      sidebarBg: '#44311E', sidebarText: '#FDE8CD', sidebarIcon: '#F5C882',
      sidebarActiveBg: '#5C422B', sidebarActiveText: '#FFFFFF', sidebarHoverBg: '#6B5138', sidebarBorder: '#3A2817',
      headerBg: '#44311E', headerText: '#FDE8CD', headerIcon: '#F5C882',
      headerBorder: '#3A2817', headerDropdownBg: '#FFFFFF', headerDropdownText: '#3A2817',
      pageBg: '#FDF8F0', textPrimary: '#3A2817', textSecondary: '#8B7355',
      cardBg: '#FFFFFF', cardBorder: '#E8DCC8', cardHeadingText: '#3A2817',
      inputBg: '#FFFFFF', inputBorder: '#E8DCC8', modalBg: '#FFFFFF',
      primaryButtonBg: '#9A6832', primaryButtonText: '#FFFFFF',
      secondaryButtonBg: '#F5EDE0', secondaryButtonText: '#5C422B',
      hoverState: '#7A5228', focusRing: '#9A6832', disabledState: '#D6CCC0',
      linkColor: '#9A6832', accentColor: '#D97706'
    }
  }
};

// Palette color categories for the editor UI
const PALETTE_SECTIONS = [
  {
    id: 'sidebar',
    label: 'Navigation & Sidebar',
    labelHi: 'नेविगेशन और साइडबार',
    icon: '🧭',
    keys: [
      { key: 'sidebarBg', label: 'Background', labelHi: 'पृष्ठभूमि' },
      { key: 'sidebarText', label: 'Text', labelHi: 'टेक्स्ट' },
      { key: 'sidebarIcon', label: 'Icons', labelHi: 'आइकन' },
      { key: 'sidebarActiveBg', label: 'Active Item BG', labelHi: 'सक्रिय आइटम BG' },
      { key: 'sidebarActiveText', label: 'Active Item Text', labelHi: 'सक्रिय आइटम टेक्स्ट' },
      { key: 'sidebarHoverBg', label: 'Hover BG', labelHi: 'होवर BG' },
      { key: 'sidebarBorder', label: 'Border/Divider', labelHi: 'बॉर्डर' },
    ]
  },
  {
    id: 'header',
    label: 'Header & Navigation Bar',
    labelHi: 'हेडर और नेविगेशन बार',
    icon: '📐',
    keys: [
      { key: 'headerBg', label: 'Background', labelHi: 'पृष्ठभूमि' },
      { key: 'headerText', label: 'Text', labelHi: 'टेक्स्ट' },
      { key: 'headerIcon', label: 'Icons', labelHi: 'आइकन' },
      { key: 'headerBorder', label: 'Border', labelHi: 'बॉर्डर' },
      { key: 'headerDropdownBg', label: 'Dropdown BG', labelHi: 'ड्रॉपडाउन BG' },
      { key: 'headerDropdownText', label: 'Dropdown Text', labelHi: 'ड्रॉपडाउन टेक्स्ट' },
    ]
  },
  {
    id: 'page',
    label: 'Page & Content Surfaces',
    labelHi: 'पेज और कंटेंट सतह',
    icon: '📄',
    keys: [
      { key: 'pageBg', label: 'Main Background', labelHi: 'मुख्य पृष्ठभूमि' },
      { key: 'textPrimary', label: 'Primary Text', labelHi: 'प्राथमिक टेक्स्ट' },
      { key: 'textSecondary', label: 'Secondary Text', labelHi: 'द्वितीयक टेक्स्ट' },
      { key: 'cardBg', label: 'Card Background', labelHi: 'कार्ड पृष्ठभूमि' },
      { key: 'cardBorder', label: 'Card Border', labelHi: 'कार्ड बॉर्डर' },
      { key: 'cardHeadingText', label: 'Card Heading', labelHi: 'कार्ड शीर्षक' },
      { key: 'inputBg', label: 'Form Input BG', labelHi: 'फॉर्म इनपुट BG' },
      { key: 'inputBorder', label: 'Form Input Border', labelHi: 'फॉर्म इनपुट बॉर्डर' },
      { key: 'modalBg', label: 'Modal/Dropdown', labelHi: 'मोडल/ड्रॉपडाउन' },
    ]
  },
  {
    id: 'buttons',
    label: 'Buttons & Interaction',
    labelHi: 'बटन और इंटरैक्शन',
    icon: '🎯',
    keys: [
      { key: 'primaryButtonBg', label: 'Primary Button BG', labelHi: 'प्राथमिक बटन BG' },
      { key: 'primaryButtonText', label: 'Primary Button Text', labelHi: 'प्राथमिक बटन टेक्स्ट' },
      { key: 'secondaryButtonBg', label: 'Secondary Button BG', labelHi: 'द्वितीयक बटन BG' },
      { key: 'secondaryButtonText', label: 'Secondary Button Text', labelHi: 'द्वितीयक बटन टेक्स्ट' },
      { key: 'hoverState', label: 'Hover State', labelHi: 'होवर स्टेट' },
      { key: 'focusRing', label: 'Focus Ring', labelHi: 'फोकस रिंग' },
      { key: 'disabledState', label: 'Disabled State', labelHi: 'डिसेबल्ड स्टेट' },
      { key: 'linkColor', label: 'Link Color', labelHi: 'लिंक रंग' },
      { key: 'accentColor', label: 'Accent Color', labelHi: 'एक्सेंट रंग' },
    ]
  }
];

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const ThemeColorCustomizer: React.FC<ThemeColorCustomizerProps> = ({
  activeDesignId,
  designName,
  onPalettePublished
}) => {
  const isHi = false; // Can be extended with useLanguage if needed

  // Working palette (the draft being edited)
  const [draftPalette, setDraftPalette] = useState<ThemePalette>(
    () => DEFAULT_PALETTES[activeDesignId] || DEFAULT_PALETTES['classic_standard']
  );

  // Saved states for comparison
  const [publishedPalette, setPublishedPalette] = useState<ThemePalette | null>(null);
  const [savedDraft, setSavedDraft] = useState<ThemePalette | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // UI state
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['sidebar', 'header']);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load existing draft and published palette from server
  useEffect(() => {
    const load = async () => {
      try {
        const [draftRes, pubRes] = await Promise.allSettled([
          api.getThemePaletteDraft(activeDesignId),
          api.getPublishedThemePalette(activeDesignId)
        ]);
        if (pubRes.status === 'fulfilled' && pubRes.value?.palette) {
          setPublishedPalette(pubRes.value.palette);
        }
        if (draftRes.status === 'fulfilled' && draftRes.value?.draft) {
          setDraftPalette(draftRes.value.draft);
          setSavedDraft(draftRes.value.draft);
        } else if (pubRes.status === 'fulfilled' && pubRes.value?.palette) {
          setDraftPalette(pubRes.value.palette);
        }
      } catch (err) {
        console.warn('Failed to load palette state:', err);
      }
    };
    load();
  }, [activeDesignId]);

  // Track unsaved changes
  useEffect(() => {
    const compareTarget = savedDraft || publishedPalette || DEFAULT_PALETTES[activeDesignId];
    if (!compareTarget) { setHasUnsavedChanges(false); return; }
    const changed = Object.keys(draftPalette).some(
      k => (draftPalette as any)[k] !== (compareTarget as any)[k]
    );
    setHasUnsavedChanges(changed);
  }, [draftPalette, savedDraft, publishedPalette, activeDesignId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Update single color in draft
  const updateColor = useCallback((key: string, value: string) => {
    setDraftPalette(prev => ({ ...prev, [key]: value }));
  }, []);

  // Apply preset
  const applyPreset = (presetId: string) => {
    const preset = PRESET_PALETTES[presetId];
    if (preset) {
      setDraftPalette({ ...preset.palette });
      setSelectedPreset(presetId);
    }
  };

  // Toggle preview
  const togglePreview = () => {
    if (!isPreviewActive) {
      // Apply draft to CSS vars temporarily
      const root = document.documentElement;
      Object.entries(draftPalette).forEach(([key, value]) => {
        const cssVar = `--app-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        // Map camelCase to CSS var names
        const varMap: Record<string, string> = {
          sidebarBg: '--app-sidebar-bg', sidebarText: '--app-sidebar-text', sidebarIcon: '--app-sidebar-icon',
          sidebarActiveBg: '--app-sidebar-active-bg', sidebarActiveText: '--app-sidebar-active-text',
          sidebarHoverBg: '--app-sidebar-hover-bg', sidebarBorder: '--app-sidebar-border',
          headerBg: '--app-header-bg', headerText: '--app-header-text', headerIcon: '--app-header-icon',
          headerBorder: '--app-header-border', headerDropdownBg: '--app-header-dropdown-bg',
          headerDropdownText: '--app-header-dropdown-text',
          pageBg: '--app-page-bg', textPrimary: '--app-text-primary', textSecondary: '--app-text-secondary',
          cardBg: '--app-card-bg', cardBorder: '--app-card-border', cardHeadingText: '--app-card-heading',
          inputBg: '--app-input-bg', inputBorder: '--app-input-border', modalBg: '--app-modal-bg',
          primaryButtonBg: '--app-primary-button-bg', primaryButtonText: '--app-primary-button-text',
          secondaryButtonBg: '--app-secondary-button-bg', secondaryButtonText: '--app-secondary-button-text',
          hoverState: '--app-hover-state', focusRing: '--app-focus-ring', disabledState: '--app-disabled-state',
          linkColor: '--app-link', accentColor: '--app-accent'
        };
        const v = varMap[key];
        if (v) root.style.setProperty(v, value);
      });
      setIsPreviewActive(true);
    } else {
      // Restore published palette
      if (publishedPalette) {
        Object.entries(publishedPalette).forEach(([key, value]) => {
          const varMap: Record<string, string> = {
            sidebarBg: '--app-sidebar-bg', sidebarText: '--app-sidebar-text', sidebarIcon: '--app-sidebar-icon',
            sidebarActiveBg: '--app-sidebar-active-bg', sidebarActiveText: '--app-sidebar-active-text',
            sidebarHoverBg: '--app-sidebar-hover-bg', sidebarBorder: '--app-sidebar-border',
            headerBg: '--app-header-bg', headerText: '--app-header-text', headerIcon: '--app-header-icon',
            headerBorder: '--app-header-border', headerDropdownBg: '--app-header-dropdown-bg',
            headerDropdownText: '--app-header-dropdown-text',
            pageBg: '--app-page-bg', textPrimary: '--app-text-primary', textSecondary: '--app-text-secondary',
            cardBg: '--app-card-bg', cardBorder: '--app-card-border', cardHeadingText: '--app-card-heading',
            inputBg: '--app-input-bg', inputBorder: '--app-input-border', modalBg: '--app-modal-bg',
            primaryButtonBg: '--app-primary-button-bg', primaryButtonText: '--app-primary-button-text',
            secondaryButtonBg: '--app-secondary-button-bg', secondaryButtonText: '--app-secondary-button-text',
            hoverState: '--app-hover-state', focusRing: '--app-focus-ring', disabledState: '--app-disabled-state',
            linkColor: '--app-link', accentColor: '--app-accent'
          };
          const v = varMap[key];
          if (v) document.documentElement.style.setProperty(v, value);
        });
      }
      setIsPreviewActive(false);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const res = await api.saveThemePaletteDraft(activeDesignId, draftPalette);
      if (res.success) {
        setSavedDraft(res.draft);
        showFeedback('success', 'Draft palette saved successfully');
      } else {
        showFeedback('error', 'Failed to save draft');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to save draft palette');
    } finally {
      setIsSaving(false);
    }
  };

  // Publish palette
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await api.publishThemePalette(activeDesignId, draftPalette);
      if (res.success) {
        setPublishedPalette(res.publishedPalette);
        setSavedDraft(null);
        setIsPreviewActive(false);
        // Dispatch event so context picks up the change
        window.dispatchEvent(new CustomEvent('theme-palette-changed', { detail: res.publishedPalette }));
        try {
          localStorage.setItem('kc_active_palette', JSON.stringify(res.publishedPalette));
        } catch { /* ignore */ }
        showFeedback('success', 'Theme palette published globally!');
        onPalettePublished?.();
      } else {
        showFeedback('error', 'Failed to publish palette');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to publish theme palette');
    } finally {
      setIsPublishing(false);
    }
  };

  // Discard changes — restore from saved draft or published
  const handleDiscard = () => {
    if (savedDraft) {
      setDraftPalette(savedDraft);
    } else if (publishedPalette) {
      setDraftPalette(publishedPalette);
    } else {
      setDraftPalette(DEFAULT_PALETTES[activeDesignId] || DEFAULT_PALETTES['classic_standard']);
    }
    setSelectedPreset(null);
    if (isPreviewActive) togglePreview();
    showFeedback('success', 'Changes discarded');
  };

  // Restore default
  const handleRestoreDefault = async () => {
    setIsRestoring(true);
    try {
      const res = await api.restoreDefaultPalette(activeDesignId);
      if (res.success) {
        setDraftPalette(res.publishedPalette);
        setPublishedPalette(res.publishedPalette);
        setSavedDraft(null);
        setSelectedPreset(null);
        if (isPreviewActive) setIsPreviewActive(false);
        window.dispatchEvent(new CustomEvent('theme-palette-changed', { detail: res.publishedPalette }));
        try {
          localStorage.setItem('kc_active_palette', JSON.stringify(res.publishedPalette));
        } catch { /* ignore */ }
        showFeedback('success', 'Default palette restored');
        onPalettePublished?.();
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to restore default palette');
    } finally {
      setIsRestoring(false);
      setConfirmRestore(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-100 text-violet-800">
              <Paintbrush className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-black text-slate-900">
              Global Colors & Branding
            </h3>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Customize the color palette for <strong>{designName}</strong>. Preview changes before publishing to ensure your website looks exactly right.
          </p>
        </div>

        {/* Status indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {isPreviewActive && (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider animate-pulse">
              Preview Active
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-black uppercase tracking-wider">
              Unsaved Changes
            </span>
          )}
        </div>
      </div>

      {/* Feedback alert */}
      {feedback && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
            : 'bg-rose-50 text-rose-900 border border-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer text-sm">✕</button>
        </div>
      )}

      {/* Preset Palettes */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Palette Presets
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(PRESET_PALETTES).map(([id, preset]) => (
            <button
              key={id}
              onClick={() => applyPreset(id)}
              className={`p-3 rounded-xl border-2 transition-all cursor-pointer text-left space-y-2 ${
                selectedPreset === id
                  ? 'border-violet-500 ring-2 ring-violet-200 bg-violet-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  <div className="h-4 w-4 rounded-full border border-white shadow-xs" style={{ backgroundColor: preset.palette.sidebarBg }} />
                  <div className="h-4 w-4 rounded-full border border-white shadow-xs" style={{ backgroundColor: preset.palette.primaryButtonBg }} />
                  <div className="h-4 w-4 rounded-full border border-white shadow-xs" style={{ backgroundColor: preset.palette.accentColor }} />
                </div>
                {selectedPreset === id && <Check className="h-3.5 w-3.5 text-violet-600" />}
              </div>
              <div className="text-xs font-bold text-slate-800">{preset.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Color Editor Sections */}
      <div className="space-y-3">
        {PALETTE_SECTIONS.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          return (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{section.icon}</span>
                  <span className="text-sm font-black text-slate-800">{section.label}</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {section.keys.length} colors
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 border-t border-slate-100 pt-3">
                  {section.keys.map(({ key, label }) => {
                    const value = (draftPalette as any)[key] || '#FFFFFF';
                    const isValid = HEX_REGEX.test(value);
                    return (
                      <div key={key} className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 block">{label}</label>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input
                              type="color"
                              value={isValid ? value : '#FFFFFF'}
                              onChange={(e) => updateColor(key, e.target.value.toUpperCase())}
                              className="h-9 w-9 rounded-lg cursor-pointer border border-slate-200 shadow-xs p-0.5"
                              title={label}
                            />
                          </div>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => {
                              const v = e.target.value.toUpperCase();
                              if (v.length <= 7) updateColor(key, v);
                            }}
                            className={`flex-1 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border ${
                              isValid ? 'border-slate-200 text-slate-800' : 'border-rose-300 text-rose-700 bg-rose-50'
                            } focus:outline-none focus:ring-2 focus:ring-violet-300`}
                            placeholder="#RRGGBB"
                            maxLength={7}
                          />
                          <div
                            className="h-6 w-6 rounded-md border border-slate-200 shadow-xs shrink-0"
                            style={{ backgroundColor: isValid ? value : '#FFF' }}
                          />
                        </div>
                        {!isValid && value.length > 0 && (
                          <span className="text-[10px] text-rose-500 font-bold">Invalid hex</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={togglePreview}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-xs ${
              isPreviewActive
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {isPreviewActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{isPreviewActive ? 'Exit Preview' : 'Live Preview'}</span>
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            <span>{isPublishing ? 'Publishing...' : 'Publish Theme'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDiscard}
            disabled={!hasUnsavedChanges}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="h-4 w-4" />
            <span>Discard Changes</span>
          </button>

          <button
            onClick={() => setConfirmRestore(true)}
            className="px-4 py-2.5 rounded-xl bg-white border border-amber-300 hover:border-amber-400 text-amber-800 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restore Defaults</span>
          </button>
        </div>
      </div>

      {/* Inline Preview Mockup */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-800">Quick Preview</h4>
          <span className="text-[10px] font-bold text-slate-400">Using current draft colors</span>
        </div>
        <div className="p-5 flex gap-3" style={{ backgroundColor: draftPalette.pageBg }}>
          {/* Sidebar mockup */}
          <div className="w-32 rounded-xl p-3 space-y-1.5 shrink-0 hidden sm:block" style={{ backgroundColor: draftPalette.sidebarBg, borderRight: `1px solid ${draftPalette.sidebarBorder}` }}>
            <div className="text-[10px] font-bold mb-2" style={{ color: draftPalette.sidebarText }}>KisanOS</div>
            <div className="px-2 py-1 rounded-md text-[9px] font-bold" style={{ backgroundColor: draftPalette.sidebarActiveBg, color: draftPalette.sidebarActiveText }}>🏠 Dashboard</div>
            <div className="px-2 py-1 rounded-md text-[9px]" style={{ color: draftPalette.sidebarText }}>🌾 Listings</div>
            <div className="px-2 py-1 rounded-md text-[9px]" style={{ color: draftPalette.sidebarText }}>📊 Mandi</div>
            <div className="px-2 py-1 rounded-md text-[9px]" style={{ color: draftPalette.sidebarText }}>🤝 Buyers</div>
          </div>
          <div className="flex-1 space-y-2.5 min-w-0">
            {/* Header mockup */}
            <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={{ backgroundColor: draftPalette.headerBg, borderBottom: `1px solid ${draftPalette.headerBorder}` }}>
              <span className="text-xs font-bold" style={{ color: draftPalette.headerText }}>Dashboard</span>
              <div className="flex gap-1.5">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: draftPalette.headerIcon, opacity: 0.5 }} />
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: draftPalette.headerIcon, opacity: 0.5 }} />
              </div>
            </div>
            {/* Cards mockup */}
            <div className="grid grid-cols-2 gap-2">
              {['Card 1', 'Card 2'].map((c, i) => (
                <div key={i} className="rounded-xl p-2.5 space-y-1.5" style={{ backgroundColor: draftPalette.cardBg, border: `1px solid ${draftPalette.cardBorder}` }}>
                  <div className="text-[10px] font-bold" style={{ color: draftPalette.cardHeadingText }}>{c}</div>
                  <div className="text-[9px]" style={{ color: draftPalette.textSecondary }}>Sample content</div>
                  <button className="w-full py-1 rounded-md text-[9px] font-bold" style={{ backgroundColor: draftPalette.primaryButtonBg, color: draftPalette.primaryButtonText }}>
                    Action
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Restore Modal */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Restore Default Colors?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This will reset the palette for <strong>{designName}</strong> to its original default colors and publish the change immediately.
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmRestore(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreDefault}
                disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {isRestoring ? 'Restoring...' : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Restore Defaults</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
