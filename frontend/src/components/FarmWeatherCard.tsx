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
        className={`group p-2.5 rounded-lg border shadow-2xs cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between ${
          isHarvest
            ? 'bg-white border-[#E5E0D5] hover:border-[#176B45]/50'
            : 'bg-white border-slate-200 hover:border-emerald-400'
        }`}
        title="क्लिक करके 7 दिन का पूर्वानुमान व कृषि सुझाव देखें"
      >
        <div className="space-y-0.5">
          {/* Location line */}
          <div className="text-[10px] font-bold text-[#17251D] flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 truncate max-w-[130px]">
              <MapPin className={`h-3 w-3 shrink-0 ${isHarvest ? 'text-[#176B45]' : 'text-emerald-600'}`} />
              <span className="truncate">{shortLocation}</span>
            </span>
            {isStale && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" title="Cached data" />
            )}
          </div>

          {/* Subtitle */}
          <div className="text-[9px] text-[#657468] flex items-center justify-between">
            <span>मौसम पूर्वानुमान (Weather)</span>
            <span className="text-[8px] font-bold text-[#176B45] group-hover:underline flex items-center gap-0.5">
              <span>7 दिन</span>
              <ChevronRight className="h-2 w-2" />
            </span>
          </div>

          {/* Temp & Icon */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-base">{current?.icon || '🌤️'}</span>
            <span className="text-sm font-black text-[#17251D]">
              {current?.temperature !== undefined ? `${current.temperature}°C` : '28°C'}
            </span>
            {isLoading && (
              <RefreshCw className="h-2.5 w-2.5 text-slate-400 animate-spin" />
            )}
          </div>

          {/* Condition text */}
          <div className="text-[9px] text-[#657468] font-medium truncate">
            {current?.condition || 'साफ आसमान'}
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
