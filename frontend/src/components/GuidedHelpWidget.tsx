import React, { useState } from 'react';
import { 
  HelpCircle, 
  X, 
  Sprout, 
  TrendingUp, 
  Users, 
  PhoneCall, 
  ChevronRight, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface GuidedHelpWidgetProps {
  onNavigate?: (path: string) => void;
}

export const GuidedHelpWidget: React.FC<GuidedHelpWidgetProps> = ({ onNavigate }) => {
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<'sell' | 'price' | 'aggregator' | null>('sell');

  const handleActionClick = (path: string) => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  return (
    <>
      {/* Floating Help Trigger Button */}
      <button
        id="guided-help-fab"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t('help.floatingBtn') || 'Help & Guidance'}
        className="fixed bottom-5 right-5 z-40 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-4 py-2.5 shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center gap-2 border-2 border-emerald-400/40 focus:outline-hidden focus:ring-4 focus:ring-emerald-400/30 group"
      >
        <div className="relative">
          <HelpCircle className="h-5 w-5 text-emerald-200 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </div>
        <span className="text-xs font-black tracking-wide font-sans">
          {t('help.floatingBtn') || (language === 'hi' ? 'सहायता (Help)' : 'Help')}
        </span>
      </button>

      {/* Guided Help Modal / Mobile Bottom-Sheet (Responsive down to 375px) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          {/* Backdrop Click */}
          <div 
            className="fixed inset-0 -z-10" 
            onClick={() => setIsOpen(false)} 
            aria-hidden="true" 
          />

          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                  🌾
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    {t('help.modalTitle') || (language === 'hi' ? 'किसान सहायता केंद्र' : 'Kisan Sahayata (Help & Guidance)')}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    {t('help.modalSubtitle') || (language === 'hi' ? 'सरल व सीधे समाधान' : 'Quick self-service actions for farmers')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs text-slate-700">
              
              {/* ACTION A: Fasal Kaise Bechein? */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white hover:border-emerald-300 transition-colors space-y-3">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setActiveAccordion(activeAccordion === 'sell' ? null : 'sell')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <Sprout className="h-4 w-4" />
                    </div>
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                      {t('help.action1Title') || (language === 'hi' ? 'फसल कैसे बेचें? (Fasal kaise bechein?)' : 'How to sell your crop?')}
                    </h4>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${activeAccordion === 'sell' ? 'rotate-90' : ''}`} />
                </div>

                {activeAccordion === 'sell' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                    <ul className="space-y-2 text-slate-600 pl-1">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>1. फसल दर्ज करें:</strong> अपनी फसल, अनुमानित क्विंटल और गाँव का नाम भरें।</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>2. सीधे खरीदार देखें:</strong> कंपनियों और आढ़तियों के ताज़ा भाव देखकर पसंदीदा सौदा चुनें।</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>3. इलेक्ट्रॉनिक तुलाई व भुगतान:</strong> पारदर्शी वजन के तुरंत बाद सीधा बैंक खाते में पैसा।</span>
                      </li>
                    </ul>

                    <button
                      type="button"
                      onClick={() => handleActionClick('/list-crop')}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <span>{t('help.action1Cta') || (language === 'hi' ? 'अपनी फसल दर्ज करें' : 'List My Crop Now')}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ACTION B: Sahi Bhav Kaise Jaanein? */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white hover:border-emerald-300 transition-colors space-y-3">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setActiveAccordion(activeAccordion === 'price' ? null : 'price')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                      {t('help.action2Title') || (language === 'hi' ? 'सही भाव कैसे जानें? (Sahi bhav kaise jaanein?)' : 'How to check fair market rates?')}
                    </h4>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${activeAccordion === 'price' ? 'rotate-90' : ''}`} />
                </div>

                {activeAccordion === 'price' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                    <p className="text-slate-600 leading-relaxed">
                      {t('help.action2Desc') || (language === 'hi' 
                        ? 'मंडी में आढ़त (कमीशन) व कटौतियां लगती हैं। यहाँ आप क्षेत्रीय एपीएमसी मंडी भाव और सीधे खरीदारों के नेट भाव की तुलना एक साथ कर सकते हैं।' 
                        : 'Compare APMC Mandi spot rates against direct buyer realization. Avoid extra commission and unknown deductions.')}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleActionClick('/intelligence')}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <span>{t('help.action2Cta') || (language === 'hi' ? 'मंडी व बाजार भाव देखें' : 'View Mandi Benchmark Rates')}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ACTION C: Aggregator Se Judein */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white hover:border-emerald-300 transition-colors space-y-3">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setActiveAccordion(activeAccordion === 'aggregator' ? null : 'aggregator')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Users className="h-4 w-4" />
                    </div>
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                      {t('help.action3Title') || (language === 'hi' ? 'संग्राहक (आढ़ती) से जुड़ें (Aggregator se judein)' : 'Connect with Local Aggregator')}
                    </h4>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${activeAccordion === 'aggregator' ? 'rotate-90' : ''}`} />
                </div>

                {activeAccordion === 'aggregator' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                    <p className="text-slate-600 leading-relaxed">
                      {t('help.action3Desc') || (language === 'hi'
                        ? 'यदि आपकी फसल की मात्रा कम (5–10 टन) है, तो गाँव के संग्राहक आपके माल को 60 टन के बड़े बैच में जोड़ते हैं। इससे ट्रैक्टर/भाड़ा बचता है और बड़ी कंपनियों का ऊँचा भाव मिलता है।'
                        : 'If you have smaller volume lots, local aggregators pool produce into full 60T+ truckloads, saving your freight costs and unlocking bulk corporate buyer rates.')}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleActionClick('/how-it-works')}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <span>{t('help.action3Cta') || (language === 'hi' ? 'संग्रहण कैसे काम करता है' : 'How Aggregation Works')}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* EMERGENCY KISAN HELPLINE CARD */}
              <div className="bg-amber-50/80 border border-amber-300/80 p-4 rounded-2xl space-y-2 text-amber-950">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-amber-700 shrink-0" />
                  <strong className="text-xs sm:text-sm font-bold">
                    {t('help.helplineTitle') || (language === 'hi' ? 'टोल-फ्री किसान हेल्पलाइन' : 'Toll-Free Kisan Helpline')}
                  </strong>
                </div>

                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {t('help.helplineDesc') || (language === 'hi' 
                    ? 'कृषि विशेषज्ञों से सीधे बात करने और मार्गदर्शन के लिए सरकारी किसान कॉल सेंटर पर निशुल्क संपर्क करें:' 
                    : 'Direct toll-free national Kisan Call Centre advisory for agricultural queries:')}
                </p>

                <a
                  href="tel:18001801551"
                  className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-black text-xs transition-colors shadow-xs"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>{t('help.helplineCallBtn') || '1800-180-1551 (टोल-फ्री कॉल)'}</span>
                </a>
              </div>

            </div>

            {/* Footer with close */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                {t('common.close') || 'बंद करें (Close)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuidedHelpWidget;
