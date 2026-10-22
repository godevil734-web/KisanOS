import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { DashboardAppearanceSetting, DashboardDesign, ThemePalette } from '../types';
import { useAuth } from './AuthContext';

// Default palettes per layout (mirrors backend DEFAULT_PALETTES)
export const DEFAULT_PALETTES: Record<string, ThemePalette> = {
  classic_standard: {
    sidebarBg: '#315C45', sidebarText: '#FFFFFF', sidebarIcon: '#FFFFFF',
    sidebarActiveBg: '#264A37', sidebarActiveText: '#FFFFFF', sidebarHoverBg: '#3A6B50', sidebarBorder: '#264A37',
    headerBg: '#F7F5EF', headerText: '#26332C', headerIcon: '#637067',
    headerBorder: '#E5E0D5', headerDropdownBg: '#FFFFFF', headerDropdownText: '#26332C',
    pageBg: '#F7F5EF', textPrimary: '#26332C', textSecondary: '#637067',
    cardBg: '#FFFFFF', cardBorder: '#E5E0D5', cardHeadingText: '#26332C',
    inputBg: '#FFFFFF', inputBorder: '#D8D2C4', modalBg: '#FFFFFF',
    primaryButtonBg: '#315C45', primaryButtonText: '#FFFFFF',
    secondaryButtonBg: '#EFECE4', secondaryButtonText: '#26332C',
    hoverState: '#264A37', focusRing: '#315C45', disabledState: '#D8D2C4',
    linkColor: '#315C45', accentColor: '#C58B4E'
  },
  harvest_standard: {
    sidebarBg: '#104B35', sidebarText: '#FFFFFF', sidebarIcon: '#E8F1E5',
    sidebarActiveBg: '#176B45', sidebarActiveText: '#FFFFFF', sidebarHoverBg: '#0D3D2B', sidebarBorder: '#0D3D2B',
    headerBg: '#104B35', headerText: '#FFFFFF', headerIcon: '#E8F1E5',
    headerBorder: '#0D3D2B', headerDropdownBg: '#FFFFFF', headerDropdownText: '#17251D',
    pageBg: '#F7F4E9', textPrimary: '#17251D', textSecondary: '#657468',
    cardBg: '#FFFFFF', cardBorder: '#E5E0D5', cardHeadingText: '#17251D',
    inputBg: '#FFFFFF', inputBorder: '#E5E0D5', modalBg: '#FFFFFF',
    primaryButtonBg: '#176B45', primaryButtonText: '#FFFFFF',
    secondaryButtonBg: '#E8F1E5', secondaryButtonText: '#104B35',
    hoverState: '#104B35', focusRing: '#176B45', disabledState: '#D8D2C4',
    linkColor: '#176B45', accentColor: '#E6A52E'
  },
  harvest_canvas: {
    sidebarBg: '#F7F4E9', sidebarText: '#17251D', sidebarIcon: '#176B45',
    sidebarActiveBg: '#E8F1E5', sidebarActiveText: '#104B35', sidebarHoverBg: '#EFECE4', sidebarBorder: '#E5E0D5',
    headerBg: '#F7F4E9', headerText: '#17251D', headerIcon: '#176B45',
    headerBorder: '#E5E0D5', headerDropdownBg: '#FFFFFF', headerDropdownText: '#17251D',
    pageBg: '#F7F4E9', textPrimary: '#17251D', textSecondary: '#657468',
    cardBg: '#FFFFFF', cardBorder: '#E5E0D5', cardHeadingText: '#17251D',
    inputBg: '#FFFFFF', inputBorder: '#E5E0D5', modalBg: '#FFFFFF',
    primaryButtonBg: '#176B45', primaryButtonText: '#FFFFFF',
    secondaryButtonBg: '#E8F1E5', secondaryButtonText: '#104B35',
    hoverState: '#104B35', focusRing: '#176B45', disabledState: '#D8D2C4',
    linkColor: '#176B45', accentColor: '#37A86B'
  }
};

export const DEFAULT_APPEARANCE: DashboardAppearanceSetting = {
  activeDesignId: 'classic_standard',
  theme: 'classic',
  layout: 'standard',
  updatedAt: null,
  updatedBy: 'system'
};

export const INITIAL_REGISTERED_DESIGNS: DashboardDesign[] = [
  {
    id: 'classic_standard',
    name: 'Classic — Original Dashboard',
    theme: 'classic',
    themeName: 'Classic KisanConnect',
    layout: 'standard',
    layoutName: 'Standard Layout',
    description: 'Original farmer dashboard with ivory background, green action headers, comprehensive crop cards, and classic layout.',
    isDefault: true,
    features: [
      'Original KisanConnect production design',
      'Familiar workflow cards & layout',
      'Full weather and mandi integrations',
      'Stable production baseline'
    ]
  },
  {
    id: 'harvest_standard',
    name: 'Harvest Premium — Standard',
    theme: 'harvest_premium',
    themeName: 'Harvest Premium',
    layout: 'standard',
    layoutName: 'Standard Layout',
    description: 'Modern agricultural theme featuring warm ivory canvas (#F7F4E9), deep forest green (#104B35) sidebar & header, amber accents, balanced action grid, and rectangular 12px cards.',
    isDefault: false,
    features: [
      'Warm ivory (#F7F4E9) high-contrast canvas',
      'Deep forest green (#104B35) matching sidebar & header',
      'Clean 12px rectangular card geometry',
      'Dedicated hero crop search & stats banner'
    ]
  },
  {
    id: 'harvest_canvas',
    name: 'Harvest Canvas — Unified Ivory',
    theme: 'harvest_canvas',
    themeName: 'Harvest Canvas',
    layout: 'standard',
    layoutName: 'Unified Canvas Layout',
    description: 'Unified theme where the sidebar and top header match the exact same website canvas color (#F7F4E9), creating a seamless monochromatic aesthetic with emerald navigation accents.',
    isDefault: false,
    features: [
      'Sidebar & header seamlessly match website color (#F7F4E9)',
      'Monochromatic ivory canvas with clean slate borders (#E5E0D5)',
      'High-contrast dark typography and emerald action buttons',
      'All 7 crop management cards & live mandi prices intact'
    ]
  }
];

// Apply a palette to CSS custom properties on document root
function applyPaletteToCSSVars(palette: ThemePalette) {
  const root = document.documentElement;
  root.style.setProperty('--app-sidebar-bg', palette.sidebarBg);
  root.style.setProperty('--app-sidebar-text', palette.sidebarText);
  root.style.setProperty('--app-sidebar-icon', palette.sidebarIcon);
  root.style.setProperty('--app-sidebar-active-bg', palette.sidebarActiveBg);
  root.style.setProperty('--app-sidebar-active-text', palette.sidebarActiveText);
  root.style.setProperty('--app-sidebar-hover-bg', palette.sidebarHoverBg);
  root.style.setProperty('--app-sidebar-border', palette.sidebarBorder);
  root.style.setProperty('--app-header-bg', palette.headerBg);
  root.style.setProperty('--app-header-text', palette.headerText);
  root.style.setProperty('--app-header-icon', palette.headerIcon);
  root.style.setProperty('--app-header-border', palette.headerBorder);
  root.style.setProperty('--app-header-dropdown-bg', palette.headerDropdownBg);
  root.style.setProperty('--app-header-dropdown-text', palette.headerDropdownText);
  root.style.setProperty('--app-page-bg', palette.pageBg);
  root.style.setProperty('--app-text-primary', palette.textPrimary);
  root.style.setProperty('--app-text-secondary', palette.textSecondary);
  root.style.setProperty('--app-card-bg', palette.cardBg);
  root.style.setProperty('--app-card-border', palette.cardBorder);
  root.style.setProperty('--app-card-heading', palette.cardHeadingText);
  root.style.setProperty('--app-input-bg', palette.inputBg);
  root.style.setProperty('--app-input-border', palette.inputBorder);
  root.style.setProperty('--app-modal-bg', palette.modalBg);
  root.style.setProperty('--app-primary-button-bg', palette.primaryButtonBg);
  root.style.setProperty('--app-primary-button-text', palette.primaryButtonText);
  root.style.setProperty('--app-secondary-button-bg', palette.secondaryButtonBg);
  root.style.setProperty('--app-secondary-button-text', palette.secondaryButtonText);
  root.style.setProperty('--app-hover-state', palette.hoverState);
  root.style.setProperty('--app-focus-ring', palette.focusRing);
  root.style.setProperty('--app-disabled-state', palette.disabledState);
  root.style.setProperty('--app-link', palette.linkColor);
  root.style.setProperty('--app-accent', palette.accentColor);
}

interface DashboardAppearanceContextType {
  appearance: DashboardAppearanceSetting;
  designs: DashboardDesign[];
  activePalette: ThemePalette;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  activateDesign: (designId: string) => Promise<boolean>;
  restoreClassic: () => Promise<boolean>;
  refreshAppearance: () => Promise<void>;
  refreshPalette: () => Promise<void>;
}

const DashboardAppearanceContext = createContext<DashboardAppearanceContextType | undefined>(undefined);

const STORAGE_KEY = 'kc_farmer_appearance';
const PALETTE_STORAGE_KEY = 'kc_active_palette';

export const DashboardAppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();

  // Initialize from localStorage if present for immediate render without flicker, otherwise DEFAULT_APPEARANCE (Classic)
  const [appearance, setAppearance] = useState<DashboardAppearanceSetting>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.activeDesignId) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_APPEARANCE;
  });

  const [activePalette, setActivePalette] = useState<ThemePalette>(() => {
    try {
      const cached = localStorage.getItem(PALETTE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.sidebarBg) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_PALETTES['classic_standard'];
  });

  const [designs, setDesigns] = useState<DashboardDesign[]>(INITIAL_REGISTERED_DESIGNS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch and apply palette for the active design
  const refreshPalette = useCallback(async (designId?: string): Promise<void> => {
    const targetDesignId = designId || appearance?.activeDesignId || 'classic_standard';
    try {
      const res = await api.getPublishedThemePalette(targetDesignId);
      if (res?.palette) {
        setActivePalette(res.palette);
        applyPaletteToCSSVars(res.palette);
        try {
          localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(res.palette));
        } catch {
          // ignore storage errors
        }
      }
    } catch (err: any) {
      console.warn('[PALETTE] Failed to load published palette, using default:', err.message);
      const fallback = DEFAULT_PALETTES[targetDesignId] || DEFAULT_PALETTES['classic_standard'];
      setActivePalette(fallback);
      applyPaletteToCSSVars(fallback);
    }
  }, [appearance?.activeDesignId]);

  // Sync with server
  const refreshAppearance = useCallback(async (): Promise<DashboardAppearanceSetting> => {
    try {
      const serverSetting = await api.getFarmerDashboardAppearance();
      if (serverSetting && serverSetting.activeDesignId) {
        setAppearance(serverSetting);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverSetting));
        } catch {
          // ignore storage errors
        }
        // Also refresh palette for the active design
        await refreshPalette(serverSetting.activeDesignId);
        return serverSetting;
      }
    } catch (err: any) {
      console.warn('[APPEARANCE CONTEXT] Failed to load from server, using fallback/cached setting:', err.message);
    } finally {
      setIsLoading(false);
    }
    return DEFAULT_APPEARANCE;
  }, [refreshPalette]);

  // Initial load
  useEffect(() => {
    refreshAppearance();
  }, [refreshAppearance]);

  // Re-fetch whenever an authenticated session is established, changed, or refreshed (login, logout, switchRole)
  useEffect(() => {
    refreshAppearance();
  }, [user?.id, user?.role, token, refreshAppearance]);

  // Re-fetch on window focus to immediately catch theme activations made in other tabs or sessions
  useEffect(() => {
    const handleFocus = () => {
      refreshAppearance();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshAppearance]);

  useEffect(() => {
    // Listen for cross-tab or cross-component appearance changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.activeDesignId) {
            setAppearance(parsed);
          }
        } catch {
          // ignore
        }
      }
      if (e.key === PALETTE_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.sidebarBg) {
            setActivePalette(parsed);
            applyPaletteToCSSVars(parsed);
          }
        } catch {
          // ignore
        }
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<DashboardAppearanceSetting>;
      if (customEvent.detail?.activeDesignId) {
        setAppearance(customEvent.detail);
      }
    };

    const handlePaletteChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemePalette>;
      if (customEvent.detail?.sidebarBg) {
        setActivePalette(customEvent.detail);
        applyPaletteToCSSVars(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('dashboard-appearance-changed', handleCustomChange);
    window.addEventListener('theme-palette-changed', handlePaletteChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dashboard-appearance-changed', handleCustomChange);
      window.removeEventListener('theme-palette-changed', handlePaletteChange);
    };
  }, []);

  // Apply palette from cache on initial mount (before server response)
  useEffect(() => {
    if (activePalette?.sidebarBg) {
      applyPaletteToCSSVars(activePalette);
    }
  }, []);

  // Activate a design (admin only)
  const activateDesign = async (designId: string): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const target = designs.find(d => d.id === designId) || INITIAL_REGISTERED_DESIGNS.find(d => d.id === designId);
      if (!target) throw new Error(`Unknown design ID: ${designId}`);

      const res = await api.updateFarmerDashboardAppearance({
        activeDesignId: target.id,
        theme: target.theme,
        layout: target.layout
      });

      if (res && res.setting) {
        setAppearance(res.setting);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(res.setting));
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('dashboard-appearance-changed', { detail: res.setting }));
        // Refresh palette for the newly activated design
        await refreshPalette(designId);
        return true;
      }
      return false;
    } catch (err: any) {
      const msg = err.message || 'Failed to activate design';
      setError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Restore classic original dashboard (admin only)
  const restoreClassic = async (): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.restoreClassicDashboardAppearance();
      if (res && res.setting) {
        setAppearance(res.setting);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(res.setting));
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('dashboard-appearance-changed', { detail: res.setting }));
        // Apply classic palette
        await refreshPalette('classic_standard');
        return true;
      }
      return false;
    } catch (err: any) {
      const msg = err.message || 'Failed to restore classic design';
      setError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardAppearanceContext.Provider
      value={{
        appearance,
        designs,
        activePalette,
        isLoading,
        isSaving,
        error,
        activateDesign,
        restoreClassic,
        refreshAppearance,
        refreshPalette
      }}
    >
      {children}
    </DashboardAppearanceContext.Provider>
  );
};

export const useDashboardAppearance = (): DashboardAppearanceContextType => {
  const context = useContext(DashboardAppearanceContext);
  if (!context) {
    throw new Error('useDashboardAppearance must be used within a DashboardAppearanceProvider');
  }
  return context;
};
