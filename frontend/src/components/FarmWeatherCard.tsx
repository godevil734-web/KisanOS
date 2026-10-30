import React, { useState } from 'react';
import { MapPin, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { FarmWeatherResponse } from '../services/api';
import { FarmLocationData } from '../hooks/useFarmLocation';
import { FarmWeatherModal } from './FarmWeatherModal';

interface FarmWeatherCardProps {
  weather: FarmWeatherResponse | null;
  location: FarmLocationData;
  isLoading?: boolean;
  isStale?: boolean;
  staleReason?: string;
  errorMessage?: string | null;
  onRefresh: () => void;
  onRequestGps: () => void;
  onSaveManualLocation: (details: { village: string; district: string; state: string }) => void;
  themeVariant?: 'harvest' | 'classic';
}

export const FarmWeatherCard: React.FC<FarmWeatherCardProps> = ({
  weather,
  location,
  isLoading = false,
  isStale = false,
  staleReason,
  errorMessage,
  onRefresh,
  onRequestGps,
  onSaveManualLocation,
  themeVariant = 'harvest'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const current = weather?.current;
  const isHarvest = themeVariant === 'harvest';

  // Format short display location (e.g. "Agra, UP")
  const shortLocation = location.village
    ? `${location.village}, ${location.district || 'UP'}`
    : `${location.district || 'Agra'}, ${location.state ? (location.state.length > 10 ? 'UP' : location.state) : 'UP'}`;

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className={`group p-3 sm:p-3.5 rounded-xl border shadow-xs cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between h-[155px] sm:h-[160px] min-h-[155px] sm:min-h-[160px] max-h-[155px] sm:max-h-[160px] overflow-hidden ${
          isHarvest
            ? 'bg-white border-[#E5E0D5] hover:border-[#176B45]/50'
            : 'bg-white border-slate-200 hover:border-emerald-400'
        }`}
        title="क्लिक करके 7 दिन का पूर्वानुमान व कृषि सुझाव देखें"
      >
        <div className="flex flex-col justify-between h-full">
          {/* Location line */}
          <div className="text-xs font-bold text-[#17251D] flex items-center justify-between gap-1">
            <span className="flex items-center gap-1.5 truncate max-w-[145px]">
              <MapPin className={`h-3.5 w-3.5 shrink-0 ${isHarvest ? 'text-[#176B45]' : 'text-emerald-600'}`} />
              <span className="truncate">{shortLocation}</span>
            </span>
            {isStale && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="Cached data" />
            )}
          </div>

          {/* Subtitle */}
          <div className="text-[10px] sm:text-[11px] text-[#657468] flex items-center justify-between">
            <span>मौसम पूर्वानुमान (Weather)</span>
            <span className="text-[9px] sm:text-[10px] font-bold text-[#176B45] group-hover:underline flex items-center gap-0.5">
              <span>7 दिन</span>
              <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </div>

          {/* Temp & Icon */}
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl leading-none">{current?.icon || '🌤️'}</span>
            <span className="text-base sm:text-lg font-black text-[#17251D] leading-none">
              {current?.temperature !== undefined ? `${current.temperature}°C` : '28°C'}
            </span>
            {isLoading && (
              <RefreshCw className="h-3 w-3 text-slate-400 animate-spin shrink-0" />
            )}
          </div>

          {/* Condition text */}
          <div className="text-[10px] sm:text-[11px] text-[#657468] font-medium truncate">
            {current?.condition || 'साफ मौसम (अनुमानित)'}
          </div>
        </div>
      </div>

      {/* Detailed Weather Modal */}
      <FarmWeatherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        weather={weather}
        location={location}
        isLoading={isLoading}
        isStale={isStale}
        staleReason={staleReason}
        errorMessage={errorMessage}
        onRefresh={onRefresh}
        onRequestGps={onRequestGps}
        onSaveManualLocation={onSaveManualLocation}
        themeVariant={themeVariant}
      />
    </>
  );
};
