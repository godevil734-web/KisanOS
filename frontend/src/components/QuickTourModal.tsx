import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  ShieldCheck, 
  Sprout, 
  Coins, 
  Check, 
  ArrowRight,
  TrendingUp,
  MapPin
} from 'lucide-react';

interface QuickTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

export const QuickTourModal: React.FC<QuickTourModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isHi = language === 'hi';

  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: isHi ? 'किसान कनेक्ट में आपका स्वागत है' : 'Welcome to KisanConnect',
      subtitle: isHi ? 'किसानों के लिए भारत का आधुनिक डिजिटल एग्री-प्लेटफ़ॉर्म' : "India's Modern Digital Agri-Operating System",
      icon: '🌾',
      badge: isHi ? 'कदम 1 / 4' : 'Step 1 of 4',
      content: (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isHi 
              ? `नमस्ते ${user?.name || 'किसान साथी'}! किसान कनेक्ट आपके खेत से लेकर खरीदार तक सीधा संपर्क स्थापित करता है बिना किसी बिचौलिए के।`
              : `Hello ${user?.name || 'Farmer'}! KisanConnect connects your farm directly to verified buyers and transparent mandi benchmarks without intermediaries.`}
          </p>
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>{isHi ? 'मुख्य विशेषताएं' : 'Core Capabilities'}</span>
            </div>
            <ul className="text-xs text-emerald-800 space-y-1 list-disc list-inside">
              <li>{isHi ? 'सरकारी एपीएमसी मंडी लाइव भाव' : 'Live Official Mandi benchmark rates'}</li>
              <li>{isHi ? 'सीधे थोक खरीदार एवं पूल ऑर्डर' : 'Direct institutional buyers & pooling'}</li>
              <li>{isHi ? 'डिजिटल किसान पासपोर्ट और प्रमाणन' : 'Digital Farmer Passport & Traceability'}</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: isHi ? 'समर्पित किसान प्रोफाइल व पासपोर्ट' : 'Dedicated Profile & Farmer Passport',
      subtitle: isHi ? 'आपकी भूमि, आधार और फसल का आधिकारिक डिजिटल रिकॉर्ड' : 'Official verification of your land, crops, and identity',
      icon: '🛡️',
      badge: isHi ? 'कदम 2 / 4' : 'Step 2 of 4',
      content: (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isHi
              ? 'शीर्ष-दाएं प्रोफाइल अवतार पर क्लिक करके आप अपने समर्पित किसान प्रोफाइल में जा सकते हैं।'
              : 'Click your top-right avatar anytime to open your dedicated KisanOS Farmer Profile.'}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">📜 {isHi ? 'डिजिटल पासपोर्ट' : 'Digital Passport'}</span>
              <span className="text-[11px] text-slate-500">{isHi ? 'NaLamKI ओपन ट्विन क्यूआर कोड' : 'NaLamKI QR credentials'}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">🌱 {isHi ? 'खेत व फसलें' : 'Fields & Crops'}</span>
              <span className="text-[11px] text-slate-500">{isHi ? 'जमीन का क्षेत्रफल और किस्म' : 'Acreage & crop tracking'}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: isHi ? 'फसल बिक्री एवं सरकारी मंडी भाव' : 'Sell Produce & Mandi Prices',
      subtitle: isHi ? 'लाइव भाव देखकर अपनी उपज का सही दाम प्राप्त करें' : 'Get fair market pricing backed by real wholesale data',
      icon: '📈',
      badge: isHi ? 'कदम 3 / 4' : 'Step 3 of 4',
      content: (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isHi
              ? 'डैशबोर्ड में सरकारी मंडी भाव टैब से अपने जिले का भाव जांचें और खरीदारों के सीधे ऑफर स्वीकार या नेगोशिएट करें।'
              : 'Check daily Agmarknet rates from the Mandi Prices tab and accept or counter verified buyer offers directly.'}
          </p>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{isHi ? 'हर सफल सौदे पर तुरंत पुष्टि और पेमेंट ट्रैकिंग' : 'Instant escrow tracking & guaranteed fulfillment confirmation'}</span>
          </div>
        </div>
      )
    },
    {
      title: isHi ? 'किसान पॉइंट्स और रिवॉर्ड्स' : 'Kisan Points & Trust Rewards',
      subtitle: isHi ? 'प्रोफाइल पूर्ण करने और सौदे करने पर पॉइंट्स अर्जित करें' : 'Earn reward points for activities, land registration & sales',
      icon: '🪙',
      badge: isHi ? 'कदम 4 / 4' : 'Step 4 of 4',
      content: (
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isHi
              ? 'खेत जोड़ने पर 20 पॉइंट्स, फसल दर्ज करने पर 10 पॉइंट्स, और पहली बिक्री पर 50 पॉइंट्स मिलते हैं!'
              : 'Earn +20 points for registering fields, +10 for crop records, and +50 points for your first completed sale!'}
          </p>
          <div className="p-3.5 rounded-2xl bg-emerald-900 text-white space-y-1.5 text-xs">
            <div className="flex items-center justify-between font-bold text-emerald-300">
              <span>{isHi ? 'वर्तमान पॉइंट्स बैलेंस:' : 'Current Points Balance:'}</span>
              <span className="text-base font-black text-amber-300">🪙 {(user as any)?.kisanPoints || 0} pts</span>
            </div>
            <p className="text-[11px] text-slate-300">
              {isHi 
                ? 'पॉइंट्स आपके प्रोफाइल के ट्रस्ट स्कोर को बढ़ाते हैं जिससे खरीदार आपको प्राथमिकता देते हैं।'
                : 'Points elevate your buyer trust tier, putting your listings at the top of buyer searches.'}
            </p>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGoProfile = () => {
    onClose();
    if (onNavigate) onNavigate('/profile');
    else window.location.href = '/profile';
  };

  const activeStep = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{activeStep.icon}</span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {activeStep.badge}
              </span>
              <h3 className="font-black text-base sm:text-lg text-slate-900 mt-0.5">
                {activeStep.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-xs font-semibold text-slate-500 -mt-2">
          {activeStep.subtitle}
        </p>

        {/* Step Content */}
        <div className="min-h-[140px] flex flex-col justify-center">
          {activeStep.content}
        </div>

        {/* Step Progress Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentStep ? 'w-6 bg-[#315C45]' : 'w-2 bg-slate-200 hover:bg-slate-300'
              }`}
              aria-label={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
              currentStep === 0 
                ? 'opacity-40 cursor-not-allowed text-slate-400' 
                : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{isHi ? 'पीछे' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-2">
            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleGoProfile}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold cursor-pointer border border-emerald-200 transition-colors"
              >
                {isHi ? 'प्रोफाइल खोलें' : 'Open Profile'}
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <span>{currentStep === steps.length - 1 ? (isHi ? 'पूर्ण हुआ (Got It)' : 'Got It') : (isHi ? 'आगे (Next)' : 'Next')}</span>
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default QuickTourModal;
