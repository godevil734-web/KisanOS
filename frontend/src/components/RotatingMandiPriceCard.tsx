import React from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Plus, AlertCircle } from 'lucide-react';
import { MandiCropPriceData } from '../hooks/useRotatingMandiPrices';

interface RotatingMandiPriceCardProps {
  currentCrop: string;
  currentIndex: number;
  totalCrops: number;
  priceData: MandiCropPriceData | null;
  isRefreshing: boolean;
  refreshError?: string | null;
  lastFetchTime: Date | null;
  onNext: () => void;
  onPrev: () => void;
  onSelectIndex: (index: number) => void;
  onRefresh: () => void;
  onAddCropClick?: () => void;
  onViewAllMandisClick?: () => void;
  themeVariant?: 'harvest' | 'classic';
}

export const RotatingMandiPriceCard: React.FC<RotatingMandiPriceCardProps> = ({
  currentCrop,
  currentIndex,
  totalCrops,
  priceData,
  isRefreshing,
  refreshError,
  lastFetchTime,
  onNext,
  onPrev,
  onSelectIndex,
  onRefresh,
  onAddCropClick,
  onViewAllMandisClick,
  themeVariant = 'harvest'
}) => {
  const isHarvest = themeVariant === 'harvest';

  // Empty state: Farmer has no registered crops
  if (totalCrops === 0) {
    return (
      <div 
        onClick={onAddCropClick}
        className={`p-2.5 rounded-lg border shadow-2xs flex flex-col justify-between transition-all cursor-pointer ${
          isHarvest 
            ? 'bg-white border-[#E5E0D5] hover:border-[#176B45]/50' 
            : 'bg-white border-slate-200 hover:border-emerald-400'
        }`}
        title="फसल जोड़ें"
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[9px] font-bold text-[#657468]">
            <span>मंडी भाव (Mandi Rate)</span>
            <span className="text-[8px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
              फसल जोड़ें
            </span>
          </div>

          <div className="text-xs font-bold text-[#17251D] pt-0.5 leading-tight">
            अपनी फसलें जोड़ें
          </div>
          <div className="text-[10px] text-[#657468] leading-tight">
            मंडी भाव देखने के लिए अपनी फसल दर्ज करें
          </div>

          <div className="pt-1 flex items-center gap-1 text-[10px] font-black text-[#176B45]">
            <Plus className="h-3 w-3" />
            <span>+ Add your crops</span>
          </div>
        </div>
      </div>
    );
  }

  const isVerified = priceData?.priceStatus === 'VERIFIED';
  const isUnavailable = priceData?.priceStatus === 'UNAVAILABLE';
  const isFetching = priceData?.priceStatus === 'FETCHING';

  // Format last fetched time
  const formattedFetchTime = lastFetchTime
    ? lastFetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : priceData?.marketDate || 'आज';

  return (
    <div
      className={`p-3 sm:p-3.5 rounded-xl border shadow-xs flex flex-col justify-between h-[155px] sm:h-[160px] min-h-[155px] sm:min-h-[160px] max-h-[155px] sm:max-h-[160px] overflow-hidden transition-all group relative select-none ${
        isHarvest
          ? 'bg-white border-[#E5E0D5] hover:border-[#176B45]/50'
          : 'bg-white border-slate-200 hover:border-emerald-400'
      }`}
    >
      <div className="flex flex-col justify-between h-full">
        {/* Top Header: Label, Last Updated & Manual Refresh Button */}
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-[#657468]">
          <span 
            onClick={onViewAllMandisClick} 
            className="cursor-pointer hover:underline flex items-center gap-1"
            title="सभी मंडियों के भाव देखें"
          >
            <span>मंडी भाव</span>
            <span className="text-[9px] text-slate-400">({currentIndex + 1}/{totalCrops})</span>
          </span>

          <div className="flex items-center gap-1.5">
            <span 
              className="text-[9px] sm:text-[10px] text-slate-400" 
              title={lastFetchTime ? `अंतिम अपडेट: ${lastFetchTime.toLocaleTimeString()}` : 'अपडेट समय'}
            >
              {formattedFetchTime}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={isRefreshing}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                isRefreshing 
                  ? 'text-[#176B45] cursor-not-allowed opacity-80' 
                  : 'text-[#657468] hover:text-[#176B45] hover:bg-slate-100'
              }`}
              title="ताज़ा सरकारी मंडी भाव लोड करें (Click to refresh latest prices)"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error notification banner if manual refresh fails */}
        {refreshError && (
          <div className="text-[9px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-1 truncate">
            <AlertCircle className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{refreshError}</span>
          </div>
        )}

        {/* Crop Name prominently displayed */}
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm sm:text-[15px] font-black truncate max-w-[100px] sm:max-w-[120px] ${
            isHarvest ? 'text-[#E6A52E]' : 'text-emerald-700'
          }`}>
            {currentCrop}
          </span>

          {/* Quick Prev / Next manual arrows */}
          {totalCrops > 1 && (
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                className="h-5 w-5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                title="पिछली फसल"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="h-5 w-5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                title="अगली फसल"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Price & Unit */}
        <div className="h-6 flex items-center">
          {isVerified && priceData?.modalPrice ? (
            <div className="text-sm sm:text-base font-black text-[#17251D] flex items-baseline gap-1 truncate leading-none">
              <span>₹{priceData.modalPrice.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-[#657468] font-normal">/क्विंटल</span>
            </div>
          ) : isUnavailable ? (
            <div className="text-xs font-bold text-slate-500 truncate" title="मूल्य अनुपलब्ध (Price unavailable)">
              मूल्य अनुपलब्ध (N/A)
            </div>
          ) : (
            <div className="text-xs font-bold text-slate-400 animate-pulse truncate">
              भाव लोड हो रहा है...
            </div>
          )}
        </div>

        {/* Mandi Name & Actual Market Date */}
        <div className="text-[10px] sm:text-[11px] text-[#657468] flex items-center justify-between gap-1 truncate">
          <span className="truncate max-w-[95px] sm:max-w-[110px]" title={priceData?.mandiName}>
            {priceData?.mandiName || 'सरकारी मंडी'}
          </span>
          <span className="text-[9px] text-slate-400 shrink-0">
            {priceData?.marketDate || '30/10/2026'}
          </span>
        </div>

        {/* Indicator dots for multi-crop rotation */}
        {totalCrops > 1 && totalCrops <= 6 && (
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            {Array.from({ length: totalCrops }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx 
                    ? (isHarvest ? 'w-3.5 bg-[#176B45]' : 'w-3.5 bg-emerald-600') 
                    : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
                title={`फसल ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
