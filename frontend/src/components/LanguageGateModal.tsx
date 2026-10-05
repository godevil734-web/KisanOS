import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Sprout, Globe, CheckCircle2 } from 'lucide-react';

interface LanguageGateModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const GATE_PASSED_STORAGE_KEY = 'kisanconnect-lang-gate-passed';

export const LanguageGateModal: React.FC<LanguageGateModalProps> = ({ 
  forceOpen = false, 
  onClose 
}) => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    try {
      const gatePassed = localStorage.getItem(GATE_PASSED_STORAGE_KEY);
      if (!gatePassed) {
        setIsOpen(true);
      }
    } catch (e) {
      // LocalStorage access restricted; show gate safely
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleSelectLanguage = (lang: 'hi' | 'en') => {
    setLanguage(lang);
    try {
      localStorage.setItem(GATE_PASSED_STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Could not save language gate state', e);
    }
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1C2B23]/85 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-gate-title"
    >
      <div className="bg-[#FAF9F5] border-2 border-[#E5E0D5] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Brand Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#315C45] text-white shadow-sm mx-auto">
          <Sprout className="w-8 h-8 text-white" />
        </div>

        {/* Bilingually Framed Friendly Header */}
        <div className="space-y-1.5">
          <h2 id="lang-gate-title" className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight">
            अपनी भाषा चुनें <span className="text-[#315C45] block sm:inline">/ Choose Language</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#5A6860] font-medium max-w-sm mx-auto">
            किसान कनेक्ट पर आपका स्वागत है। आप इसे बाद में भी कभी भी बदल सकते हैं।
          </p>
        </div>

        {/* Large Buttons in their Own Script — Hindi First */}
        <div className="space-y-3.5 pt-2">
          
          {/* Button 1: Hindi (First, Prominent) */}
          <button
            type="button"
            onClick={() => handleSelectLanguage('hi')}
            className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between group cursor-pointer shadow-xs hover:shadow-md min-h-[72px] ${
              language === 'hi'
                ? 'bg-white border-[#315C45] ring-2 ring-[#315C45]/20'
                : 'bg-white border-[#D8D2C4] hover:border-[#315C45] hover:bg-[#FAF9F5]'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl sm:text-4xl p-2 rounded-xl bg-[#EEF5F2] border border-[#C5DDD2]">
                🌾
              </span>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight group-hover:text-[#315C45] transition-colors">
                  हिंदी
                </div>
                <div className="text-xs sm:text-sm text-[#5A6860] font-medium mt-0.5">
                  अपनी भाषा में आसान और सीधा कृषि मंच
                </div>
              </div>
            </div>
            <div className="text-[#315C45] font-black text-xl shrink-0 pl-2">
              {language === 'hi' ? <CheckCircle2 className="w-6 h-6 text-[#315C45]" /> : '→'}
            </div>
          </button>

          {/* Button 2: English (Second) */}
          <button
            type="button"
            onClick={() => handleSelectLanguage('en')}
            className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between group cursor-pointer shadow-xs hover:shadow-md min-h-[72px] ${
              language === 'en'
                ? 'bg-white border-[#315C45] ring-2 ring-[#315C45]/20'
                : 'bg-white border-[#D8D2C4] hover:border-[#315C45] hover:bg-[#FAF9F5]'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl sm:text-4xl p-2 rounded-xl bg-[#F0F4F6] border border-[#D5E1E7]">
                🌐
              </span>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight group-hover:text-[#315C45] transition-colors">
                  English
                </div>
                <div className="text-xs sm:text-sm text-[#5A6860] font-medium mt-0.5">
                  Direct and simple agricultural marketplace
                </div>
              </div>
            </div>
            <div className="text-[#315C45] font-black text-xl shrink-0 pl-2">
              {language === 'en' ? <CheckCircle2 className="w-6 h-6 text-[#315C45]" /> : '→'}
            </div>
          </button>

        </div>

        {/* Small Notice at bottom */}
        <div className="pt-2 text-[11px] text-[#71856B] flex items-center justify-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-[#315C45]" />
          <span>Switch anytime using the Globe icon in the header bar</span>
        </div>

      </div>
    </div>
  );
};

export default LanguageGateModal;
