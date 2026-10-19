import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { DashboardAppearanceSetting, DashboardDesign } from '../types';

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
    description: 'Modern agricultural theme featuring warm ivory canvas (#F7F4E9), deep forest green (#104B35) sidebar, amber accents, balanced action grid, and rectangular 12px cards.',
    isDefault: false,
    features: [
      'Warm ivory (#F7F4E9) high-contrast canvas',
      'Deep forest green (#104B35) collapsible sidebar',
      'Clean 12px rectangular card geometry',
      'Dedicated hero crop search & stats banner'
    ]
  }
];

interface DashboardAppearanceContextType {
  appearance: DashboardAppearanceSetting;
  designs: DashboardDesign[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  activateDesign: (designId: string) => Promise<boolean>;
  restoreClassic: () => Promise<boolean>;
  refreshAppearance: () => Promise<void>;
}

const DashboardAppearanceContext = createContext<DashboardAppearanceContextType | undefined>(undefined);

const STORAGE_KEY = 'kc_farmer_appearance';

export const DashboardAppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const [designs, setDesigns] = useState<DashboardDesign[]>(INITIAL_REGISTERED_DESIGNS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with server
  const refreshAppearance = useCallback(async () => {
    try {
      const serverSetting = await api.getFarmerDashboardAppearance();
      if (serverSetting && serverSetting.activeDesignId) {
        setAppearance(serverSetting);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverSetting));
        } catch {
          // ignore storage errors
        }
      }
    } catch (err: any) {
      console.warn('[APPEARANCE CONTEXT] Failed to load from server, using fallback/cached setting:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAppearance();

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
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<DashboardAppearanceSetting>;
      if (customEvent.detail?.activeDesignId) {
        setAppearance(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('dashboard-appearance-changed', handleCustomChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dashboard-appearance-changed', handleCustomChange);
    };
  }, [refreshAppearance]);

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
        isLoading,
        isSaving,
        error,
        activateDesign,
        restoreClassic,
        refreshAppearance
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
