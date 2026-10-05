import React, { useState } from 'react';
import { 
  CheckCircle2, 
  X, 
  MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SAMPLE_CROPS, SAMPLE_BUYER_REQUIREMENTS } from '../data/sampleMarketData';
import { calculateTakeHome } from '../utils/calculator';

interface LandingPageProps {
  onSelectTab: (tab: string) => void;
  onOpenGetStarted: (role?: 'farmer' | 'aggregator' | 'buyer') => void;
  onNavigate?: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectTab, onOpenGetStarted, onNavigate }) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const isHi = language === 'hi';
  const unitQ = isHi ? 'क्विंटल' : 'Q';
  const unitKm = isHi ? 'किमी' : 'km';
  const headingTracking = isHi ? 'tracking-normal' : 'tracking-tight';

  const handleListCrop = () => {
    if (user) {
      if (onNavigate) {
        onNavigate('/list-crop');
      } else {
        onSelectTab('farmer');
      }
    } else {
      if (onNavigate) {
        onNavigate('/login?next=/list-crop');
      } else {
        onSelectTab('login');
      }
    }
  };

  // Buyer View Modal state (opened when clicking CTA or crop card)
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  const [selectedCropFilter, setSelectedCropFilter] = useState<string>('all');

  // Interactive Calculator State
  const [calcCropId, setCalcCropId] = useState<string>('potato');
  const [calcQty, setCalcQty] = useState<number>(20);
  const [calcDist, setCalcDist] = useState<number>(35);

  const takeHomeResult = calculateTakeHome(calcCropId, calcQty, calcDist);

  // Crops & Buyer Requirements from sample data
  const cropsList = SAMPLE_CROPS;
  const buyersList = SAMPLE_BUYER_REQUIREMENTS;

  const handleOpenCropBuyers = (cropId: string) => {
    setSelectedCropFilter(cropId);
    setIsBuyerModalOpen(true);
  };

  const filteredBuyers = selectedCropFilter === 'all'
    ? buyersList
    : buyersList.filter(b => b.cropId === selectedCropFilter);

  return (
    <div className="bg-[#F7F5EF] text-[#1C2B23] font-sans selection:bg-[#1E3A2B] selection:text-white pb-0 transition-colors duration-150 overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION — Farmer-First & Benefit-Driven                           */}
      {/* ========================================================================= */}
      <section id="hero" className="relative pt-6 sm:pt-10 md:pt-12 pb-8 sm:pb-12 border-b border-[#D8D2C4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFECE4] text-[#1E3A2B] text-xs sm:text-sm font-bold uppercase tracking-wider border border-[#D8D2C4] shadow-2xs mb-4">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#1E3A2B]" />
            <span>{t('landing.heroBadge')}</span>
          </div>

          {/* Headline */}
          <h1 className={`text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#1C2B23] ${headingTracking} leading-tight mb-3 sm:mb-4`}>
            {t('landing.heroTitlePart1')}{' '}
            <span className="text-[#315C45]">{t('landing.heroTitleHighlight')}</span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg md:text-xl text-[#2B3B32] max-w-2xl mx-auto leading-relaxed mb-6 sm:mb-8 font-medium">
            {t('landing.heroSubtitle')}
          </p>

          {/* Primary & Secondary Action CTAs — Min 48px tap target */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6">
            <button
              type="button"
              onClick={handleListCrop}
              className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] rounded-2xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-extrabold text-lg shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>{t('landing.heroCtaListCrop')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCropFilter('all');
                setIsBuyerModalOpen(true);
              }}
              className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] rounded-2xl bg-white hover:bg-[#EFECE4] text-[#1C2B23] font-extrabold text-lg border-2 border-[#1E3A2B] shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t('landing.heroCtaBuyerDemand')}</span>
            </button>
          </div>

          {/* Authentic Agricultural Hero Image */}
          <div className="relative mx-auto max-w-3xl rounded-2xl sm:rounded-3xl overflow-hidden border border-[#D8D2C4] shadow-sm bg-white mt-2">
            <img 
              src="/kisan_hero_agritech.jpg" 
              alt={t('landing.heroImageAlt')} 
              className="w-full h-52 sm:h-72 md:h-[320px] object-cover object-center"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1C2B23]/90 via-[#1C2B23]/40 to-transparent p-4 sm:p-5 text-left">
              <div className="flex items-center gap-2 text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8BAE97]" />
                <span className="text-sm sm:text-base font-bold text-white">
                  {t('landing.heroImageCaption')}
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 2. HOW IT WORKS (CONSOLIDATED) — 4 Steps + Folded Worked Example          */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-12 sm:py-16 bg-white border-b border-[#D8D2C4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto">
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black text-[#1C2B23] ${headingTracking}`}>
              {t('landing.stepsHeading')}
            </h2>
            <p className="text-[18px] sm:text-xl text-[#2B3B32] mt-2 font-medium">
              {t('landing.stepsSubheading')}
            </p>
          </div>

          {/* 4 Large Clean Steps — Icon-First Layout with 1 Large Icon, 1 Short Label, 1 Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Step 1 */}
            <div className="bg-[#FAF9F5] rounded-3xl p-6 border-2 border-[#D8D2C4] hover:border-[#1E3A2B] transition-all flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl sm:text-5xl" aria-hidden="true">🌾</span>
                  <span className="text-xs font-black text-[#1E3A2B] bg-[#EEF5F2] px-2.5 py-1 rounded-full border border-[#C5DDD2]">
                    {t('landing.stepBadge', { step: 1 })}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#1C2B23] mb-2 leading-snug">
                  {t('landing.step1Title')}
                </h3>
                <p className="text-[18px] text-[#2B3B32] leading-relaxed font-medium">
                  {t('landing.step1Desc')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleListCrop}
                className="mt-5 w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-extrabold text-base transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>{t('landing.heroCtaListCrop')}</span>
              </button>
            </div>

            {/* Step 2 */}
            <div className="bg-[#FAF9F5] rounded-3xl p-6 border-2 border-[#D8D2C4] hover:border-[#1E3A2B] transition-all flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl sm:text-5xl" aria-hidden="true">👀</span>
                  <span className="text-xs font-black text-[#1E3A2B] bg-[#EEF5F2] px-2.5 py-1 rounded-full border border-[#C5DDD2]">
                    {t('landing.stepBadge', { step: 2 })}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#1C2B23] mb-2 leading-snug">
                  {t('landing.step2Title')}
                </h3>
                <p className="text-[18px] text-[#2B3B32] leading-relaxed font-medium">
                  {t('landing.step2Desc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCropFilter('all');
                  setIsBuyerModalOpen(true);
                }}
                className="mt-5 w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-extrabold text-base transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>{t('landing.heroCtaBuyerDemand')}</span>
              </button>
            </div>

            {/* Step 3 */}
            <div className="bg-[#FAF9F5] rounded-3xl p-6 border-2 border-[#D8D2C4] hover:border-[#1E3A2B] transition-all flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl sm:text-5xl" aria-hidden="true">💰</span>
                  <span className="text-xs font-black text-[#1E3A2B] bg-[#EEF5F2] px-2.5 py-1 rounded-full border border-[#C5DDD2]">
                    {t('landing.stepBadge', { step: 3 })}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#1C2B23] mb-2 leading-snug">
                  {t('landing.step3Title')}
                </h3>
                <p className="text-[18px] text-[#2B3B32] leading-relaxed font-medium">
                  {t('landing.step3Desc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenGetStarted('farmer')}
                className="mt-5 w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-white hover:bg-[#EEF5F2] text-[#1E3A2B] border-2 border-[#1E3A2B] font-extrabold text-base transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>{t('landing.actionCard3Btn')}</span>
              </button>
            </div>

            {/* Step 4 */}
            <div className="bg-[#FAF9F5] rounded-3xl p-6 border-2 border-[#D8D2C4] hover:border-[#1E3A2B] transition-all flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl sm:text-5xl" aria-hidden="true">🤝</span>
                  <span className="text-xs font-black text-[#1E3A2B] bg-[#EEF5F2] px-2.5 py-1 rounded-full border border-[#C5DDD2]">
                    {t('landing.stepBadge', { step: 4 })}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#1C2B23] mb-2 leading-snug">
                  {t('landing.step4Title')}
                </h3>
                <p className="text-[18px] text-[#2B3B32] leading-relaxed font-medium">
                  {t('landing.step4Desc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCropFilter('all');
                  setIsBuyerModalOpen(true);
                }}
                className="mt-5 w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-extrabold text-base transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>{t('landing.step4Btn')}</span>
              </button>
            </div>

          </div>

          {/* Folded Worked Example: Real-life 20 Quintals Potato Walkthrough */}
          <div className="bg-[#FAF9F5] rounded-3xl p-6 sm:p-8 border-2 border-[#D8D2C4] shadow-xs">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#1E3A2B] bg-[#EEF5F2] px-3.5 py-1 rounded-full border border-[#C5DDD2]">
                {t('landing.exampleHeading')}
              </span>
              <p className="text-[18px] sm:text-xl font-bold text-[#1C2B23] mt-2.5">
                {t('landing.exampleSubheading')}
              </p>
            </div>

            {/* 5-Stage Worked Example Flow with Baseline Alignment and Directional Arrows */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-3 sm:gap-2">
              
              {/* 1. 20 Quintals Potato */}
              <div className="w-full md:w-auto flex-1 bg-white rounded-2xl p-4 text-center border-2 border-[#D8D2C4] flex flex-col justify-between shadow-2xs min-h-[140px]">
                <div>
                  <div className="h-10 flex items-center justify-center text-3xl sm:text-4xl mb-1">🥔</div>
                  <div className="font-black text-base sm:text-lg text-[#1C2B23] min-h-[40px] flex items-center justify-center leading-tight">
                    {t('landing.exampleStep1')}
                  </div>
                </div>
                <div className="text-sm text-[#2B3B32] font-semibold mt-2 pt-1.5 border-t border-[#F0ECE1]">
                  {t('landing.exampleStep1Sub')}
                </div>
              </div>

              <div className="flex items-center justify-center text-[#1E3A2B] font-black text-2xl py-1 md:py-0 shrink-0 self-center">
                <span className="hidden md:inline" aria-label="next step">→</span>
                <span className="md:hidden" aria-label="next step">↓</span>
              </div>

              {/* 2. Buyer Demand */}
              <div className="w-full md:w-auto flex-1 bg-white rounded-2xl p-4 text-center border-2 border-[#D8D2C4] flex flex-col justify-between shadow-2xs min-h-[140px]">
                <div>
                  <div className="h-10 flex items-center justify-center text-3xl sm:text-4xl mb-1">👀</div>
                  <div className="font-black text-base sm:text-lg text-[#1C2B23] min-h-[40px] flex items-center justify-center leading-tight">
                    {t('landing.exampleStep2')}
                  </div>
                </div>
                <div className="text-sm text-[#2B3B32] font-semibold mt-2 pt-1.5 border-t border-[#F0ECE1]">
                  {t('landing.exampleStep2Sub')}
                </div>
              </div>

              <div className="flex items-center justify-center text-[#1E3A2B] font-black text-2xl py-1 md:py-0 shrink-0 self-center">
                <span className="hidden md:inline" aria-label="next step">→</span>
                <span className="md:hidden" aria-label="next step">↓</span>
              </div>

              {/* 3. Price Offer */}
              <div className="w-full md:w-auto flex-1 bg-white rounded-2xl p-4 text-center border-2 border-[#D8D2C4] flex flex-col justify-between shadow-2xs min-h-[140px]">
                <div>
                  <div className="h-10 flex items-center justify-center text-3xl sm:text-4xl mb-1">💰</div>
                  <div className="font-black text-base sm:text-lg text-[#1C2B23] min-h-[40px] flex items-center justify-center leading-tight">
                    {t('landing.exampleStep3')}
                  </div>
                </div>
                <div className="text-sm text-[#2B3B32] font-semibold mt-2 pt-1.5 border-t border-[#F0ECE1]">
                  {t('landing.exampleStep3Sub')}
                </div>
              </div>

              <div className="flex items-center justify-center text-[#1E3A2B] font-black text-2xl py-1 md:py-0 shrink-0 self-center">
                <span className="hidden md:inline" aria-label="next step">→</span>
                <span className="md:hidden" aria-label="next step">↓</span>
              </div>

              {/* 4. Confirmed Deal */}
              <div className="w-full md:w-auto flex-1 bg-white rounded-2xl p-4 text-center border-2 border-[#D8D2C4] flex flex-col justify-between shadow-2xs min-h-[140px]">
                <div>
                  <div className="h-10 flex items-center justify-center text-3xl sm:text-4xl mb-1">🤝</div>
                  <div className="font-black text-base sm:text-lg text-[#1C2B23] min-h-[40px] flex items-center justify-center leading-tight">
                    {t('landing.exampleStep4')}
                  </div>
                </div>
                <div className="text-sm text-[#2B3B32] font-semibold mt-2 pt-1.5 border-t border-[#F0ECE1]">
                  {t('landing.exampleStep4Sub')}
                </div>
              </div>

              <div className="flex items-center justify-center text-[#1E3A2B] font-black text-2xl py-1 md:py-0 shrink-0 self-center">
                <span className="hidden md:inline" aria-label="next step">→</span>
                <span className="md:hidden" aria-label="next step">↓</span>
              </div>

              {/* 5. Delivery & Payment */}
              <div className="w-full md:w-auto flex-1 bg-[#EEF5F2] rounded-2xl p-4 text-center border-2 border-[#C5DDD2] flex flex-col justify-between shadow-2xs min-h-[140px]">
                <div>
                  <div className="h-10 flex items-center justify-center text-3xl sm:text-4xl mb-1">🚚</div>
                  <div className="font-black text-base sm:text-lg text-[#1E3A2B] min-h-[40px] flex items-center justify-center leading-tight">
                    {t('landing.exampleStep5')}
                  </div>
                </div>
                <div className="text-sm text-[#2B3B32] font-semibold mt-2 pt-1.5 border-t border-[#C5DDD2]">
                  {t('landing.exampleStep5Sub')}
                </div>
              </div>

            </div>

            <div className="mt-6 pt-4 border-t border-[#D8D2C4] text-center">
              <p className="text-[18px] text-[#2B3B32] font-medium leading-relaxed">
                {t('landing.exampleNote')}
              </p>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 3. SIMPLE CROP DIRECTORY — Direct Demand Discovery                        */}
      {/* ========================================================================= */}
      <section id="crop-directory" className="py-12 sm:py-16 bg-[#FAF9F5] border-b border-[#D8D2C4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black text-[#1C2B23] ${headingTracking}`}>
              {t('landing.cropsHeading')}
            </h2>
            <p className="text-[18px] sm:text-xl text-[#2B3B32] mt-2 font-medium">
              {t('landing.cropsSubheading')}
            </p>
          </div>

          {/* Detailed Crop Cards with Large Crop Icons, Big Numbers & Dedicated 48px Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 items-stretch">
            {cropsList.map((crop) => (
              <div 
                key={crop.id}
                onClick={() => handleOpenCropBuyers(crop.id)}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-[#D8D2C4] hover:border-[#1E3A2B] transition-all flex flex-col justify-between text-center cursor-pointer shadow-2xs group hover:shadow-sm"
              >
                <div>
                  <div className="h-10 sm:h-12 flex items-center justify-center text-3xl sm:text-4xl my-1 sm:my-2 group-hover:scale-110 transition-transform">
                    {crop.icon}
                  </div>

                  <div className="font-black text-[#1C2B23] text-sm sm:text-base leading-tight min-h-[38px] flex items-center justify-center">
                    {t('crops.' + crop.id)}
                  </div>

                  {/* Big Numbers for price */}
                  <div className="text-sm sm:text-base font-black text-[#1E3A2B] mt-2 leading-tight">
                    {crop.samplePriceRange} / {unitQ}
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-[#2B3B32] mt-1">
                    {t('landing.cropBuyersCount', { count: crop.demoBuyerCount })}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#D8D2C4]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCropBuyers(crop.id);
                    }}
                    className="w-full min-h-[48px] px-2 py-2 rounded-xl bg-[#EEF5F2] hover:bg-[#1E3A2B] text-[#1E3A2B] hover:text-white font-extrabold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1 cursor-pointer border border-[#C5DDD2]"
                  >
                    <span>{t('landing.cropViewDemand')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setSelectedCropFilter('all');
                setIsBuyerModalOpen(true);
              }}
              className="min-h-[48px] px-8 py-3.5 rounded-2xl bg-white hover:bg-[#EEF5F2] text-[#1E3A2B] border-2 border-[#1E3A2B] font-extrabold text-base transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              {t('landing.cropViewAll')}
            </button>
            <p className="text-center text-xs text-[#5C6F64] mt-3 font-medium">
              * {t('landing.sampleDataFootnote')}
            </p>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 4. INTERACTIVE CALCULATOR — What Will I Take Home?                        */}
      {/* ========================================================================= */}
      <section id="net-calculator" className="py-12 sm:py-16 bg-white border-b border-[#D8D2C4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#1E3A2B] bg-[#EEF5F2] px-3.5 py-1 rounded-full border border-[#C5DDD2]">
              {t('landing.calcBadge')}
            </span>
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black text-[#1C2B23] ${headingTracking} mt-2.5`}>
              {t('landing.calcHeading')}
            </h2>
            <p className="text-[18px] sm:text-xl text-[#2B3B32] mt-2 font-medium">
              {t('landing.calcSubheading')}
            </p>
          </div>

          {/* Calculator Container: Inputs on Left, Realization Breakdown on Right */}
          <div className="bg-[#FAF9F5] rounded-3xl p-6 sm:p-8 border-2 border-[#D8D2C4] shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Controls Column (7 Cols on desktop) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. Crop Selector */}
                <div>
                  <label className="block text-sm sm:text-base font-black text-[#1C2B23] uppercase tracking-wider mb-2.5">
                    {t('landing.calcCropLabel')}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {cropsList.map((crop) => (
                      <button
                        key={crop.id}
                        type="button"
                        onClick={() => setCalcCropId(crop.id)}
                        className={`p-3 min-h-[48px] rounded-xl border-2 text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          calcCropId === crop.id
                            ? 'bg-[#1E3A2B] text-white border-[#1E3A2B] shadow-xs font-black'
                            : 'bg-white text-[#1C2B23] border-[#D8D2C4] hover:border-[#1E3A2B] font-bold'
                        }`}
                      >
                        <span className="text-2xl">{crop.icon}</span>
                        <span className="text-base font-bold truncate">
                          {t('crops.' + crop.id)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Quantity (Quintals) — Big Numbers & 48px Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm sm:text-base font-black text-[#1C2B23] uppercase tracking-wider">
                      {t('landing.calcQtyLabel')}
                    </label>
                    <span className="text-2xl sm:text-3xl font-black text-[#1E3A2B] bg-white px-3.5 py-1 rounded-xl border border-[#D8D2C4] shadow-2xs">
                      {calcQty} {unitQ}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="200"
                    step="5"
                    value={calcQty}
                    onChange={(e) => setCalcQty(Number(e.target.value))}
                    className="w-full h-3 bg-[#D8D2C4] rounded-lg appearance-none cursor-pointer accent-[#1E3A2B]"
                    aria-label={t('landing.calcQtyLabel')}
                  />
                  <div className="flex items-center justify-between gap-2.5 mt-2.5">
                    {[10, 20, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCalcQty(preset)}
                        className={`text-base font-black px-4 py-2.5 min-h-[48px] rounded-xl border-2 transition-all flex items-center justify-center flex-1 cursor-pointer ${
                          calcQty === preset
                            ? 'bg-[#1E3A2B] text-white border-[#1E3A2B]'
                            : 'bg-white text-[#2B3B32] border-[#D8D2C4] hover:bg-[#FAF9F5]'
                        }`}
                      >
                        {preset} {unitQ}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Distance (km) — Big Numbers & 48px Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm sm:text-base font-black text-[#1C2B23] uppercase tracking-wider">
                      {t('landing.calcDistLabel')}
                    </label>
                    <span className="text-2xl sm:text-3xl font-black text-[#1E3A2B] bg-white px-3.5 py-1 rounded-xl border border-[#D8D2C4] shadow-2xs">
                      {calcDist} {unitKm}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    step="5"
                    value={calcDist}
                    onChange={(e) => setCalcDist(Number(e.target.value))}
                    className="w-full h-3 bg-[#D8D2C4] rounded-lg appearance-none cursor-pointer accent-[#1E3A2B]"
                    aria-label={t('landing.calcDistLabel')}
                  />
                  <div className="flex items-center justify-between gap-2.5 mt-2.5">
                    {[15, 35, 60, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCalcDist(preset)}
                        className={`text-base font-black px-4 py-2.5 min-h-[48px] rounded-xl border-2 transition-all flex items-center justify-center flex-1 cursor-pointer ${
                          calcDist === preset
                            ? 'bg-[#1E3A2B] text-white border-[#1E3A2B]'
                            : 'bg-white text-[#2B3B32] border-[#D8D2C4] hover:bg-[#FAF9F5]'
                        }`}
                      >
                        {preset} {unitKm}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Net Take-Home Breakdown Card (5 Cols on desktop) — High Contrast & Big Numbers */}
              <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border-2 border-[#D8D2C4] shadow-sm flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between border-b border-[#EAE5D8] pb-3 mb-4">
                    <span className="text-sm font-black text-[#1E3A2B] uppercase tracking-wider">
                      {t('landing.calcCostBreakdown')}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-sm sm:text-base">
                    <div className="flex items-center justify-between">
                      <span className="text-[#2B3B32] font-semibold">{t('landing.calcBuyerGross')}</span>
                      <strong className="text-[#1C2B23] font-black text-base sm:text-lg">
                        + ₹{takeHomeResult.buyerPricePerQ.toLocaleString('en-IN')} / {unitQ}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-rose-800">
                      <span className="font-semibold">{t('landing.calcFreight')} ({calcDist} {unitKm})</span>
                      <strong className="font-black text-base sm:text-lg">
                        − ₹{takeHomeResult.transportPerQ.toLocaleString('en-IN')} / {unitQ}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-rose-800">
                      <span className="font-semibold">{t('landing.calcHandling')}</span>
                      <strong className="font-black text-base sm:text-lg">
                        − ₹{takeHomeResult.handlingPerQ.toLocaleString('en-IN')} / {unitQ}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-5 border-t-2 border-[#D8D2C4] bg-[#FAF9F5] rounded-2xl p-5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm sm:text-base font-bold text-[#2B3B32]">{t('landing.calcNetPerQ')}</span>
                    <strong className="text-3xl sm:text-4xl font-black text-[#1E3A2B]">
                      ₹{takeHomeResult.netPerQ.toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <div className="flex items-baseline justify-between pt-3 border-t border-[#EAE5D8]">
                    <span className="text-sm sm:text-base font-bold text-[#1C2B23]">{t('landing.calcNetTotal')}</span>
                    <strong className="text-2xl sm:text-3xl font-black text-[#1C2B23]">
                      ₹{takeHomeResult.totalNet.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-[#2B3B32] font-medium leading-relaxed">
                  {t('landing.calcDisclaimer')}
                  <p className="text-xs text-[#5C6F64] font-medium mt-2">
                    * {t('landing.sampleDataFootnote')}
                  </p>
                </div>
              </div>

            </div>

            {/* Sell Now vs Cold Storage Comparison Sub-section */}
            <div className="mt-10 pt-8 border-t-2 border-[#D8D2C4]">
              <div className="mb-6 text-left">
                <h3 className="text-xl sm:text-2xl font-black text-[#1C2B23]">
                  {t('landing.storageHeading')}
                </h3>
                <p className="text-[18px] sm:text-xl text-[#2B3B32] mt-1 font-medium">
                  {t('landing.storageSubheading')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
                
                {/* Option 1: Sell Now */}
                <div className="bg-white rounded-3xl p-6 border-2 border-[#C5DDD2] shadow-2xs flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black text-[#1E3A2B] bg-[#EEF5F2] px-3 py-1 rounded-full border border-[#C5DDD2]">
                        {t('landing.storageSellNowTitle')}
                      </span>
                      <span className="text-sm text-[#2B3B32] font-bold">
                        {t('landing.storageSellNowSubtitle')}
                      </span>
                    </div>

                    {/* Symmetrical 4-step Breakdown */}
                    <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#D8D2C4] space-y-2.5 mb-4">
                      {/* 1. Selling price */}
                      <div className="flex items-center justify-between text-sm sm:text-base font-medium">
                        <span className="text-[#2B3B32]">{t('landing.storageLineGross')}</span>
                        <strong className="text-[#1C2B23] font-black text-base sm:text-lg">
                          + ₹{takeHomeResult.buyerPricePerQ.toLocaleString('en-IN')} / {unitQ}
                        </strong>
                      </div>

                      {/* 2. Minus storage cost */}
                      <div className="flex items-center justify-between text-sm sm:text-base font-medium text-[#5A6860]">
                        <span className="font-semibold">{t('landing.storageLineStorageCost')}</span>
                        <strong className="font-black">
                          − ₹0 / {unitQ}
                        </strong>
                      </div>

                      {/* 3. Minus transport and loading */}
                      <div className="flex items-center justify-between text-sm sm:text-base font-medium text-rose-800">
                        <span className="font-semibold">{t('landing.storageLineTransportHandling')}</span>
                        <strong className="font-black">
                          − ₹{(takeHomeResult.transportPerQ + takeHomeResult.handlingPerQ).toLocaleString('en-IN')} / {unitQ}
                        </strong>
                      </div>

                      {/* 4. You take home */}
                      <div className="pt-2.5 border-t border-[#EAE5D8] flex items-baseline justify-between">
                        <span className="text-sm sm:text-base font-bold text-[#1E3A2B]">{t('landing.storageLineTakeHome')}</span>
                        <div className="text-right">
                          <strong className="text-2xl sm:text-3xl font-black text-[#1E3A2B] block">
                            ₹{takeHomeResult.sellNowNetPerQ.toLocaleString('en-IN')} / {unitQ}
                          </strong>
                          <span className="text-xs sm:text-sm font-black text-[#2B3B32]">
                            {t('landing.calcSellNowTotalNet', { amount: takeHomeResult.sellNowTotal.toLocaleString('en-IN') })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[17px] sm:text-[18px] text-[#2B3B32] leading-relaxed font-medium">
                      {t('landing.storageSellNowDesc')}
                    </p>
                  </div>
                  <div className="mt-5 pt-3.5 border-t border-[#EAE5D8] text-sm sm:text-base text-[#1E3A2B] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{t('landing.storageSellNowBenefit')}</span>
                  </div>
                </div>

                {/* Option 2: Store in Cold Storage */}
                <div className="bg-white rounded-3xl p-6 border-2 border-[#D8D2C4] shadow-2xs flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black text-[#1C2B23] bg-[#F0ECE1] px-3 py-1 rounded-full border border-[#D8D2C4]">
                        {t('landing.storageStoreTitle')}
                      </span>
                      <span className="text-sm text-[#2B3B32] font-bold">
                        {t('landing.storageStoreSubtitle')}
                      </span>
                    </div>

                    {/* Symmetrical 4-step Breakdown */}
                    <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#D8D2C4] space-y-2.5 mb-4">
                      {/* 1. Selling price */}
                      <div className="flex items-center justify-between text-sm sm:text-base font-medium">
                        <span className="text-[#2B3B32]">{t('landing.storageLineGrossOffSeason')}</span>
                        <strong className="text-[#1C2B23] font-black text-base sm:text-lg">
                          ~+ ₹{takeHomeResult.storeEstOffSeasonPricePerQ.toLocaleString('en-IN')} / {unitQ}
                        </strong>
                      </div>

                      {/* 2. Minus storage cost */}
                      <div className="flex items-center justify-between text-sm sm:text-base font-medium text-rose-800">
                        <span className="font-semibold">{t('landing.storageLineStorageCost')}</span>
                        <strong className="font-black">
                          − ₹{takeHomeResult.storeEstCostPerQ.toLocaleString('en-IN')} / {unitQ}
                        </strong>
                      </div>

                      {/* 3. Minus transport and loading */}
                      <div className="flex items-center justify-between text-sm sm:text-base font-medium text-rose-800">
                        <span className="font-semibold">{t('landing.storageLineTransportHandling')}</span>
                        <strong className="font-black">
                          − ₹{(takeHomeResult.transportPerQ + takeHomeResult.handlingPerQ).toLocaleString('en-IN')} / {unitQ}
                        </strong>
                      </div>

                      {/* 4. You take home */}
                      <div className="pt-2.5 border-t border-[#EAE5D8] flex items-baseline justify-between">
                        <span className="text-sm sm:text-base font-bold text-[#1C2B23]">{t('landing.storageLineTakeHomeEst')}</span>
                        <div className="text-right">
                          <strong className="text-2xl sm:text-3xl font-black text-[#1C2B23] block">
                            ~₹{takeHomeResult.storeEstNetPerQ.toLocaleString('en-IN')} / {unitQ}
                          </strong>
                          <span className="text-xs sm:text-sm font-black text-[#2B3B32]">
                            {t('landing.storageStoreEstTotalNet', { amount: takeHomeResult.storeEstTotalNet.toLocaleString('en-IN') })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[17px] sm:text-[18px] text-[#2B3B32] leading-relaxed font-medium">
                      {t('landing.storageStoreDesc')}
                    </p>

                    {/* If Price Falls Downside Line */}
                    <div className="mt-3 p-3 rounded-2xl bg-[#F7F5EF] border border-[#D8D2C4] text-xs sm:text-sm font-bold text-[#1C2B23]">
                      {t('landing.storagePriceFalls', { 
                        price: takeHomeResult.storeDownsidePricePerQ.toLocaleString('en-IN'), 
                        net: takeHomeResult.storeDownsideNetPerQ.toLocaleString('en-IN'), 
                        total: takeHomeResult.storeDownsideTotalNet.toLocaleString('en-IN') 
                      })}
                    </div>
                  </div>

                  {/* Kept: Estimate Only Warning */}
                  <div className="mt-4 pt-3.5 border-t border-[#EAE5D8] text-xs sm:text-sm text-amber-950 bg-amber-50 p-3 rounded-xl border border-amber-300 font-medium">
                    <strong>* {t('landing.storageEstimateOnly')}:</strong> {t('landing.storageStoreEstimateNotice')}
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 5. SUPPLY POOLING — Small Lots, Big Order                                 */}
      {/* ========================================================================= */}
      <section id="supply-pooling" className="py-12 sm:py-16 bg-[#FAF9F5] border-b border-[#D8D2C4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#1E3A2B] bg-[#EEF5F2] px-3.5 py-1 rounded-full border border-[#C5DDD2]">
              {t('landing.poolingBadge')}
            </span>
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black text-[#1C2B23] ${headingTracking} mt-2.5`}>
              {t('landing.poolingHeading')}
            </h2>
            <p className="text-[18px] sm:text-xl text-[#2B3B32] mt-2 font-medium">
              {t('landing.poolingSubheading')}
            </p>
          </div>

          {/* Visual: Farmer A 20Q + Farmer B 30Q + Farmer C 50Q = 100Q Bulk Order */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#D8D2C4] shadow-xs">
            
            <div className="grid grid-cols-1 lg:grid-cols-11 gap-5 items-center">
              
              {/* Left Column: 3 Small Farmers (4 Cols) */}
              <div className="lg:col-span-4 space-y-3">
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#1E3A2B] mb-2">
                  {t('landing.poolingIndividualLotsTitle')}
                </div>

                {/* Farmer A */}
                <div className="bg-[#FAF9F5] rounded-2xl p-3.5 border-2 border-[#D8D2C4] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">👨‍🌾</span>
                    <div>
                      <div className="font-black text-sm sm:text-base text-[#1C2B23]">{t('landing.poolingLotA')}</div>
                      <div className="text-xs text-[#2B3B32] font-semibold">{t('landing.poolingLotHarvestSub')}</div>
                    </div>
                  </div>
                  <span className="text-base sm:text-lg font-black text-[#1E3A2B] bg-white px-3 py-1 rounded-xl border border-[#D8D2C4]">
                    20 {unitQ}
                  </span>
                </div>

                {/* Farmer B */}
                <div className="bg-[#FAF9F5] rounded-2xl p-3.5 border-2 border-[#D8D2C4] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">👨‍🌾</span>
                    <div>
                      <div className="font-black text-sm sm:text-base text-[#1C2B23]">{t('landing.poolingLotB')}</div>
                      <div className="text-xs text-[#2B3B32] font-semibold">{t('landing.poolingLotHarvestSub')}</div>
                    </div>
                  </div>
                  <span className="text-base sm:text-lg font-black text-[#1E3A2B] bg-white px-3 py-1 rounded-xl border border-[#D8D2C4]">
                    30 {unitQ}
                  </span>
                </div>

                {/* Farmer C */}
                <div className="bg-[#FAF9F5] rounded-2xl p-3.5 border-2 border-[#D8D2C4] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">👨‍🌾</span>
                    <div>
                      <div className="font-black text-sm sm:text-base text-[#1C2B23]">{t('landing.poolingLotC')}</div>
                      <div className="text-xs text-[#2B3B32] font-semibold">{t('landing.poolingLotHarvestSub')}</div>
                    </div>
                  </div>
                  <span className="text-base sm:text-lg font-black text-[#1E3A2B] bg-white px-3 py-1 rounded-xl border border-[#D8D2C4]">
                    50 {unitQ}
                  </span>
                </div>
              </div>

              {/* Middle Transition: Pooling & Batching (3 Cols) */}
              <div className="lg:col-span-3 text-center py-4 lg:py-0">
                <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-[#EEF5F2] border-2 border-[#C5DDD2] mb-2 shadow-2xs">
                  <span className="text-3xl">📦</span>
                </div>
                <div className="font-black text-sm sm:text-base text-[#1E3A2B]">
                  {t('landing.poolingBatch')}
                </div>
                <div className="text-xs sm:text-sm text-[#2B3B32] mt-1 font-semibold leading-tight">
                  {t('landing.poolingBatchSub')}
                </div>
                <div className="mt-3 text-sm sm:text-base font-black text-[#1E3A2B] flex items-center justify-center gap-1.5">
                  <span>{isHi ? '20 क्विंटल + 30 क्विंटल + 50 क्विंटल' : '20Q + 30Q + 50Q'}</span>
                  <span>=</span>
                  <span className="bg-[#1E3A2B] text-white px-2 py-0.5 rounded-lg text-lg font-black">100 {unitQ}</span>
                </div>
              </div>

              {/* Right Column: Industrial Bulk Buyer (4 Cols) — No dark highlight, clear soft badge */}
              <div className="lg:col-span-4 bg-[#FAF9F5] rounded-3xl p-6 border-2 border-[#C5DDD2] text-left flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-[#EAF5EF] text-[#1E3A2B] border border-[#BDE0CE]">
                      {t('landing.poolingBulkBadge')}
                    </span>
                    <span className="text-lg sm:text-xl font-black text-[#1E3A2B]">
                      100 {unitQ}
                    </span>
                  </div>
                  <h4 className="font-black text-base sm:text-lg text-[#1C2B23] mt-2">
                    {t('landing.poolingBuyer')}
                  </h4>
                  <p className="text-[18px] text-[#2B3B32] leading-relaxed mt-2 font-medium">
                    {t('landing.poolingBuyerSub')}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[#EAE5D8] flex items-center justify-between text-sm">
                  <span className="text-[#2B3B32] font-semibold">{t('landing.poolingFulfilledBenefit')}</span>
                  <span className="text-sm font-black text-[#1E3A2B] flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('landing.poolingStatusBadge')}</span>
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 6. IMPORTANT SECONDARY LINK — Connected Ecosystem                         */}
      {/* ========================================================================= */}
      <section id="secondary-supply-chain-link" className="py-10 sm:py-14 bg-white border-y border-[#D8D2C4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-[#FAF9F5] rounded-3xl p-6 sm:p-8 border-2 border-[#D8D2C4] text-center space-y-4">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#1E3A2B] bg-[#EEF5F2] px-3.5 py-1 rounded-full border border-[#C5DDD2]">
              {t('landing.ecosystemBadge')}
            </span>

            <h3 className="text-2xl sm:text-3xl font-black text-[#1C2B23]">
              {t('landing.ecosystemHeading')}
            </h3>

            <p className="text-[18px] sm:text-xl text-[#2B3B32] max-w-2xl mx-auto leading-relaxed font-medium">
              {t('landing.ecosystemText')}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onSelectTab('how-it-works');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-8 py-3.5 min-h-[48px] rounded-2xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-extrabold text-base shadow-xs transition-all hover:shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <span>{t('landing.ecosystemBtn')}</span>
              </button>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 7. SMALL FINAL CTA — Action-Oriented                                      */}
      {/* ========================================================================= */}
      <section id="final-cta" className="py-12 sm:py-16 bg-[#FAF9F5] text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF5F2] text-[#1E3A2B] border border-[#C5DDD2] flex items-center justify-center text-3xl mx-auto shadow-2xs">
            🌱
          </div>

          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black ${headingTracking} text-[#1C2B23]`}>
            {t('landing.finalCtaHeading')}
          </h2>

          <p className="text-[18px] sm:text-xl text-[#2B3B32] max-w-md mx-auto leading-relaxed font-medium">
            {t('landing.finalCtaSubtitle')}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleListCrop}
              className="px-8 py-3.5 min-h-[48px] rounded-2xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-extrabold text-lg shadow-sm transition-all hover:shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{t('landing.finalCtaBtn')}</span>
            </button>
          </div>
        </div>
      </section>


      {/* ========================================================================= */}
      {/* MODAL: BUYER REQUIREMENTS DISCOVERY                                       */}
      {/* ========================================================================= */}
      {isBuyerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto border-2 border-[#D8D2C4] shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#D8D2C4]">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#1E3A2B] bg-[#EEF5F2] px-3 py-1 rounded border border-[#C5DDD2]">
                  {t('landing.buyerModalBadge')}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-[#1C2B23] mt-1.5">
                  {t('landing.buyerModalTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBuyerModalOpen(false)}
                className="p-2 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-2xl text-[#2B3B32] hover:text-[#1C2B23] hover:bg-[#EFECE4] transition-colors cursor-pointer border border-[#D8D2C4]"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Filter buttons — Min 48px tap targets */}
            <div className="flex items-center gap-2 overflow-x-auto py-3.5 border-b border-[#F0ECE1]">
              <button
                type="button"
                onClick={() => setSelectedCropFilter('all')}
                className={`px-4 py-2 min-h-[48px] rounded-full text-sm sm:text-base font-bold transition-all cursor-pointer ${
                  selectedCropFilter === 'all'
                    ? 'bg-[#1E3A2B] text-white shadow-2xs'
                    : 'bg-[#FAF9F5] text-[#2B3B32] hover:bg-[#EFECE4] border border-[#D8D2C4]'
                }`}
              >
                {t('landing.buyerModalAll')}
              </button>
              {cropsList.map(crop => (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => setSelectedCropFilter(crop.id)}
                  className={`px-4 py-2 min-h-[48px] rounded-full text-sm sm:text-base font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCropFilter === crop.id
                      ? 'bg-[#1E3A2B] text-white shadow-2xs'
                      : 'bg-[#FAF9F5] text-[#2B3B32] hover:bg-[#EFECE4] border border-[#D8D2C4]'
                  }`}
                >
                  <span className="text-lg">{crop.icon}</span>
                  <span>{t('crops.' + crop.id)}</span>
                </button>
              ))}
            </div>

            {/* Buyers Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              {filteredBuyers.map((req) => (
                <div 
                  key={req.id}
                  className="bg-[#FAF9F5] rounded-3xl p-5 border-2 border-[#D8D2C4] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-[#EEF5F2] text-[#1E3A2B] border border-[#C5DDD2]">
                          {t('landing.buyerRequirementBadge')}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm text-[#2B3B32] font-bold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#1E3A2B]" />
                        {isHi ? req.locationHi : req.locationEn}
                      </span>
                    </div>

                    <h4 className="font-black text-base sm:text-lg text-[#1C2B23]">
                      {isHi ? req.buyerNameHi : req.buyerNameEn}
                    </h4>
                    <p className="text-xs sm:text-sm text-[#2B3B32] font-semibold mb-3">
                      {isHi ? req.categoryHi : req.categoryEn}
                    </p>

                    <div className="p-3.5 rounded-2xl bg-white border border-[#D8D2C4] space-y-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-[#2B3B32] font-medium">{t('landing.buyerModalCropLabel')}</span>
                        <strong className="text-[#1C2B23] font-bold">{isHi ? req.varietyHi : req.varietyEn}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#2B3B32] font-medium">{t('landing.buyerModalQtyLabel')}</span>
                        <strong className="text-base sm:text-lg font-black text-[#1E3A2B]">{t('landing.quantityWithUnit', { qty: req.quantityQ })}</strong>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-[#EAE5D8]">
                        <span className="text-[#2B3B32] font-black">{t('landing.buyerModalPriceLabel')}</span>
                        <strong className="text-lg sm:text-xl font-black text-[#1C2B23]">{t('landing.pricePerQuintal', { price: req.offeredPricePerQ.toLocaleString('en-IN') })}</strong>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#2B3B32] mb-4 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-[#1E3A2B] shrink-0" />
                      <span>{isHi ? req.termsHi : req.termsEn}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsBuyerModalOpen(false);
                      handleListCrop();
                    }}
                    className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-black text-sm sm:text-base shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t('landing.buyerModalApplyBtn')}</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-[#D8D2C4] flex items-center justify-between text-xs sm:text-sm text-[#2B3B32] font-medium">
              <span>* {t('landing.sampleDataFootnote')}</span>
              <button
                type="button"
                onClick={() => setIsBuyerModalOpen(false)}
                className="px-6 py-2.5 min-h-[48px] rounded-xl bg-[#EFECE4] text-[#1C2B23] font-black hover:bg-[#E0DBD0] transition-colors cursor-pointer border border-[#D8D2C4]"
              >
                {t('landing.buyerModalClose')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default LandingPage;
