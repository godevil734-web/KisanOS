import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  X, 
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface RoleSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: 'farmer' | 'aggregator' | 'buyer') => void;
  initialRole?: 'farmer' | 'aggregator' | 'buyer';
}

export const RoleSelectModal: React.FC<RoleSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectRole,
  initialRole = 'farmer'
}) => {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<'farmer' | 'aggregator' | 'buyer'>(initialRole);

  if (!isOpen) return null;

  const handleContinue = (role: 'farmer' | 'aggregator' | 'buyer') => {
    onSelectRole(role);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-4xl bg-white text-[#26332C] rounded-2xl shadow-xl border border-[#E5E0D5] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 sm:px-8 pt-6 pb-5 bg-[#FAF9F5] border-b border-[#E5E0D5]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-[#637067] hover:text-[#26332C] hover:bg-[#EFECE4] transition-colors"
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFECE4] text-[#315C45] text-xs font-semibold border border-[#D8D2C4] mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-[#315C45]" />
            <span>{t('roleModal.badge')}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#26332C] tracking-tight">
            {t('roleModal.title')}
          </h2>
          <p className="text-xs sm:text-sm text-[#5A6860] mt-1 max-w-xl">
            {t('roleModal.subtitle')}
          </p>
        </div>

        {/* 3 Interactive Cards */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            
            {/* 1. FARMER */}
            <div
              onClick={() => setSelected('farmer')}
              className={`group relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                selected === 'farmer'
                  ? 'border-[#315C45] bg-[#FAF9F5] shadow-xs ring-2 ring-[#315C45]/20'
                  : 'border-[#E5E0D5] bg-white hover:border-[#315C45]/60 hover:shadow-2xs'
              }`}
            >
              {selected === 'farmer' && (
                <div className="absolute top-3 right-3 text-[#315C45]">
                  <CheckCircle2 className="w-5 h-5 fill-[#EFECE4]" />
                </div>
              )}

              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EFECE4] text-[#315C45] flex items-center justify-center text-2xl mb-3">
                  🌾
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#315C45] mb-1">
                  {t('landing.farmerCardTag')}
                </div>
                <h3 className="text-base font-bold text-[#26332C] mb-1.5">
                  {t('roleModal.farmerTitle')}
                </h3>
                <p className="text-xs text-[#5A6860] leading-relaxed mb-3">
                  {t('roleModal.farmerSubtitle')}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {[t('farmer.myCrops'), t('farmer.findBuyers'), t('farmer.myOffers'), t('farmer.myDeals')].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#EFECE4] text-[#4A5750]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E0D5]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContinue('farmer');
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>{t('roleModal.continueFarmer')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. AGGREGATOR */}
            <div
              onClick={() => setSelected('aggregator')}
              className={`group relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                selected === 'aggregator'
                  ? 'border-[#C58B4E] bg-[#FDF9F3] shadow-xs ring-2 ring-[#C58B4E]/20'
                  : 'border-[#E5E0D5] bg-white hover:border-[#C58B4E]/60 hover:shadow-2xs'
              }`}
            >
              {selected === 'aggregator' && (
                <div className="absolute top-3 right-3 text-[#C58B4E]">
                  <CheckCircle2 className="w-5 h-5 fill-[#FDF8F0]" />
                </div>
              )}

              <div>
                <div className="w-12 h-12 rounded-xl bg-[#FDF8F0] text-[#C58B4E] flex items-center justify-center text-2xl mb-3">
                  📦
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C58B4E] mb-1">
                  {t('landing.aggregatorCardTag')}
                </div>
                <h3 className="text-base font-bold text-[#26332C] mb-1.5">
                  {t('roleModal.aggregatorTitle')}
                </h3>
                <p className="text-xs text-[#5A6860] leading-relaxed mb-3">
                  {t('roleModal.aggregatorSubtitle')}
                </p>

                {/* Aggregation visual pill */}
                <div className="bg-[#FAF9F5] rounded p-1.5 border border-[#EFE5D3] mb-3 text-center">
                  <span className="text-[11px] font-semibold text-[#6E5536]">2T + 3T + 5T</span>
                  <span className="text-[10px] text-[#A69784] mx-1">↓</span>
                  <span className="text-[11px] font-bold text-[#C58B4E]">10T Bulk Lot</span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {[t('aggregator.operatingZone'), t('aggregator.activeBatches'), t('aggregator.poolLots')].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FDF8F0] text-[#6E5536]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E0D5]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContinue('aggregator');
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#C58B4E] hover:bg-[#B3793E] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>{t('roleModal.continueAggregator')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. BIG BUYER */}
            <div
              onClick={() => setSelected('buyer')}
              className={`group relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                selected === 'buyer'
                  ? 'border-[#536B78] bg-[#F2F6F8] shadow-xs ring-2 ring-[#536B78]/20'
                  : 'border-[#E5E0D5] bg-white hover:border-[#536B78]/60 hover:shadow-2xs'
              }`}
            >
              {selected === 'buyer' && (
                <div className="absolute top-3 right-3 text-[#536B78]">
                  <CheckCircle2 className="w-5 h-5 fill-[#EEF3F6]" />
                </div>
              )}

              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EEF3F6] text-[#415D6D] flex items-center justify-center text-2xl mb-3">
                  🏢
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#415D6D] mb-1">
                  {t('landing.buyerCardTag')}
                </div>
                <h3 className="text-base font-bold text-[#26332C] mb-1.5">
                  {t('roleModal.buyerTitle')}
                </h3>
                <p className="text-xs text-[#5A6860] leading-relaxed mb-3">
                  {t('roleModal.buyerSubtitle')}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {[t('buyer.postDemand'), t('buyer.channelDiscovery'), t('buyer.activeContracts')].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#EEF3F6] text-[#435762]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E0D5]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContinue('buyer');
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#536B78] hover:bg-[#415661] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>{t('roleModal.continueBuyer')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 sm:px-8 py-3.5 bg-[#FAF9F5] border-t border-[#E5E0D5] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E0DBD0] text-[#4A5750] text-xs font-semibold hover:bg-[#EFECE4] transition-colors"
          >
            {t('common.cancel')}
          </button>

          <button
            type="button"
            onClick={() => handleContinue(selected)}
            className="px-6 py-2 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-colors"
          >
            <span>{t('common.getStarted')} →</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default RoleSelectModal;
