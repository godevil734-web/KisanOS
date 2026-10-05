import React, { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const DemoBanner: React.FC = () => {
  const { t } = useLanguage();
  // Default hidden: only shown if explicitly enabled via VITE_SHOW_DEMO_BANNER='true'
  const isBannerEnabled = import.meta.env.VITE_SHOW_DEMO_BANNER === 'true';

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return import.meta.env.VITE_DEMO_MODE === 'true';
  });

  useEffect(() => {
    if (!isBannerEnabled) return;

    // Check backend demo status via /api/config
    let mounted = true;
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (mounted && typeof data?.demoMode === 'boolean') {
          setIsDemoMode(data.demoMode);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [isBannerEnabled]);

  if (!isBannerEnabled || !isDemoMode) return null;

  return (
    <div 
      id="demo-mode-global-banner"
      role="status"
      aria-live="polite"
      className="bg-amber-600/90 text-amber-50 text-xs py-1.5 px-4 font-semibold text-center tracking-wide flex items-center justify-center gap-2 border-b border-amber-700/80 shadow-xs z-50 transition-all select-none"
    >
      <AlertTriangle className="w-3.5 h-3.5 text-amber-200 flex-shrink-0 animate-pulse" />
      <span className="truncate">{t('common.demoBanner')}</span>
      <span className="hidden sm:inline-block text-[10px] bg-amber-800/80 text-amber-200 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
        DEMO_MODE
      </span>
    </div>
  );
};
