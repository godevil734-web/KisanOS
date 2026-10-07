import React, { useState } from 'react';
import { Sprout, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface FooterProps {
  onSelectTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  const { language, t } = useLanguage();
  const isHi = language === 'hi';
  const [modalInfo, setModalInfo] = useState<{ title: string; desc: string } | null>(null);

  const navigateToTab = (tab: string) => {
    onSelectTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToCropNetwork = () => {
    onSelectTab('landing');
    setTimeout(() => {
      const el = document.getElementById('crop-directory');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  const openComingSoon = (title: string, desc: string) => {
    setModalInfo({ title, desc });
  };

  return (
    <footer className="relative bg-[#EFECE4] text-[#2B3B32] text-sm border-t-2 border-[#D8D2C4] mt-0 overflow-hidden">
      
      {/* Agriculture Scenic Landscape Banner Header */}
      <div className="relative w-full h-44 sm:h-56 md:h-64 overflow-hidden border-b-2 border-[#D8D2C4]">
        <img 
          src="/farm_landscape_preview.jpg" 
          alt="Indian Agriculture Fields" 
          className="w-full h-full object-cover object-center"
        />
        {/* Soft gradient blend into footer background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#EFECE4] via-[#EFECE4]/30 to-black/20" />
        
        {/* Agricultural Banner Content */}
        <div className="absolute bottom-4 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E3A2B]/90 backdrop-blur-md text-white text-xs sm:text-sm font-black shadow-md border border-emerald-400/30">
            <span className="text-base">🌾</span>
            <span>{isHi ? 'खेत से मंडी तक • सशक्त किसान, आत्मनिर्भर भारत' : 'From Soil to Sale • Empowering Indian Agriculture'}</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-[#1E3A2B] text-xs font-black shadow-xs border border-[#D8D2C4]">
            <span>🌱</span>
            <span>{isHi ? 'पारदर्शी डिजिटल कृषि आपूर्ति नेटवर्क' : 'Transparent Agricultural Supply Chain'}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 text-[#1C2B23] font-bold text-lg">
              <div className="h-8 w-8 rounded-xl bg-[#1E3A2B] flex items-center justify-center text-white shadow-2xs">
                <Sprout className="h-5 w-5 text-white" />
              </div>
              <span className="font-black tracking-tight text-xl">KisanConnect</span>
            </div>
            <p className="text-[#2B3B32] text-sm leading-relaxed max-w-xs font-medium">
              {t('footer.description')}
            </p>
            <div className="text-xs font-black text-[#1E3A2B] tracking-wide">
              {t('footer.tagline')}
            </div>
          </div>

          {/* Column 1: Platform — Real Pages */}
          <div>
            <h4 className="text-[#1C2B23] font-black text-sm uppercase tracking-wider mb-3.5">
              {t('footer.platformTitle')}
            </h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('how-it-works')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.howItWorks')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('farmer')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.forFarmers')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('aggregator')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.forAggregators')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('buyer')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.forBuyers')}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Network — Real Pages */}
          <div>
            <h4 className="text-[#1C2B23] font-black text-sm uppercase tracking-wider mb-3.5">
              {t('footer.networkTitle')}
            </h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('storage')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.coldStorage')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('transport')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.transport')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={navigateToCropNetwork} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.cropNetwork')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('intelligence')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.marketInsights')}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Company & Information */}
          <div>
            <h4 className="text-[#1C2B23] font-black text-sm uppercase tracking-wider mb-3.5">
              {t('footer.companyTitle')}
            </h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              <li>
                <button 
                  type="button"
                  onClick={() => navigateToTab('how-it-works')} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.about')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => openComingSoon(t('footer.values'), t('footer.valuesDesc'))} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.values')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => openComingSoon(t('footer.contact'), t('footer.contactDesc'))} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.contact')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => openComingSoon(t('footer.privacy'), t('footer.privacyDesc'))} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.privacy')}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => openComingSoon(t('footer.terms'), t('footer.termsDesc'))} 
                  className="text-[#2B3B32] hover:text-[#1E3A2B] hover:underline transition-colors text-left cursor-pointer min-h-[32px] flex items-center"
                >
                  {t('footer.terms')}
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Footer Bottom Bar */}
        <div className="border-t-2 border-[#D8D2C4] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs sm:text-sm text-[#2B3B32] font-semibold gap-3">
          <div>{t('footer.copyright')}</div>
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={() => openComingSoon(t('footer.privacy'), t('footer.privacyDesc'))}
              className="hover:text-[#1E3A2B] hover:underline cursor-pointer"
            >
              {t('footer.privacy')}
            </button>
            <span>•</span>
            <button 
              type="button" 
              onClick={() => openComingSoon(t('footer.terms'), t('footer.termsDesc'))}
              className="hover:text-[#1E3A2B] hover:underline cursor-pointer"
            >
              {t('footer.terms')}
            </button>
            <span>•</span>
            <span>{t('footer.builtFor')}</span>
          </div>
        </div>
      </div>

      {/* Info / Coming Soon Modal for Zero Dead Links */}
      {modalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border-2 border-[#D8D2C4] shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#D8D2C4] mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#1E3A2B] bg-[#EEF5F2] px-2.5 py-1 rounded-full border border-[#C5DDD2]">
                  {t('footer.comingSoonBadge')}
                </span>
                <h3 className="text-lg font-black text-[#1C2B23]">
                  {modalInfo.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalInfo(null)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#2B3B32] hover:bg-[#EFECE4] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-base text-[#2B3B32] leading-relaxed font-medium mb-6">
              {modalInfo.desc}
            </p>

            <button
              type="button"
              onClick={() => setModalInfo(null)}
              className="w-full min-h-[48px] py-2.5 px-4 rounded-xl bg-[#1E3A2B] hover:bg-[#15291E] text-white font-black text-base shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            >
              <span>OK</span>
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
