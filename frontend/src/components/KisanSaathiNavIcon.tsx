import React, { useState } from 'react';

interface KisanSaathiNavIconProps {
  className?: string;
  isActive?: boolean;
}

/**
 * Authentic visual identity for Kisan Saathi AI in the Farmer Dashboard sidebar.
 * Reuses the official KisanOS farmer mascot avatar (/dashboard/farmer_mascot.jpg)
 * and the live pulsing green online indicator from KisanSaathiWidget.
 */
export const KisanSaathiNavIcon: React.FC<KisanSaathiNavIconProps> = ({ 
  className = 'h-4 w-4',
  isActive = false
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {!imageError ? (
        <img
          src="/dashboard/farmer_mascot.jpg"
          alt="Kisan Saathi AI"
          className="h-full w-full rounded-full object-cover ring-1 ring-emerald-400/60 shadow-2xs group-hover:scale-110 transition-transform"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="h-full w-full rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center text-[10px] ring-1 ring-emerald-400/40">
          🌾
        </span>
      )}
      {/* Live green pulse dot from KisanSaathiWidget */}
      <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5 pointer-events-none">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 ring-1 ring-emerald-950" />
      </span>
    </span>
  );
};

export default KisanSaathiNavIcon;
