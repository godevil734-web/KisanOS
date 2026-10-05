import React, { useState } from 'react';
import { 
  X, 
  Sprout, 
  Droplets, 
  FlaskConical, 
  ShieldAlert, 
  Tractor, 
  CheckCircle2, 
  Calendar, 
  CloudSun,
  Sparkles,
  BookOpenCheck
} from 'lucide-react';
import { api } from '../services/api';
import { FarmerListing } from '../types';

interface FieldActivityLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: FarmerListing[];
  onActivityCreated: () => void;
  language?: 'en' | 'hi';
}

interface ActionCard {
  id: string;
  labelHi: string;
  labelEn: string;
  subHi: string;
  subEn: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  activeBg: string;
  defaultNameHi: string;
  defaultNameEn: string;
  bbch: string;
}

const ACTION_CARDS: ActionCard[] = [
  { 
    id: 'irrigation', 
    labelHi: 'पानी लगाया (सिंचाई)', 
    labelEn: 'Irrigation & Water', 
    subHi: 'ड्रिप / ट्यूबवेल / नहर', 
    subEn: 'Drip / Tube-well / Canal', 
    icon: Droplets, 
    color: 'text-cyan-600',
    activeBg: 'border-cyan-600 bg-cyan-50/50',
    defaultNameHi: 'ड्रिप / ट्यूबवेल सिंचाई',
    defaultNameEn: 'Tube-well / Drip Irrigation',
    bbch: 'BBCH 40 (Tuber Bulking & Hydration)'
  },
  { 
    id: 'fertilization', 
    labelHi: 'खाद / पोषण डाला', 
    labelEn: 'Fertilizer & Nutrition', 
    subHi: 'यूरिया, DAP या जैविक खाद', 
    subEn: 'Urea, NPK or Organic Compost', 
    icon: FlaskConical, 
    color: 'text-amber-600',
    activeBg: 'border-amber-600 bg-amber-50/50',
    defaultNameHi: 'पोषण एवं खाद प्रबंधन',
    defaultNameEn: 'Fertilizer & Nutrition',
    bbch: 'BBCH 45 (Vegetative Growth)'
  },
  { 
    id: 'crop_protection', 
    labelHi: 'कीट रोकथाम / स्प्रे', 
    labelEn: 'Crop Protection / Spray', 
    subHi: 'नीम तेल / सुरक्षा छिड़काव', 
    subEn: 'Bio-IPM / Neem Oil Spray', 
    icon: ShieldAlert, 
    color: 'text-emerald-600',
    activeBg: 'border-emerald-600 bg-emerald-50/50',
    defaultNameHi: 'फसल सुरक्षा स्प्रे (Bio-IPM)',
    defaultNameEn: 'Crop Protection (Bio-IPM)',
    bbch: 'BBCH 60 (Canopy Protection)'
  },
  { 
    id: 'harvesting', 
    labelHi: 'फसल कटाई की', 
    labelEn: 'Harvested Crop', 
    subHi: 'तैयार फसल की खेत से खुदाई/कटाई', 
    subEn: 'Harvested & Field Graded', 
    icon: Tractor, 
    color: 'text-purple-600',
    activeBg: 'border-purple-600 bg-purple-50/50',
    defaultNameHi: 'फसल कटाई एवं लॉट तैयार',
    defaultNameEn: 'Harvest & Farm Grading',
    bbch: 'BBCH 99 (Harvested Lot)'
  },
  { 
    id: 'sowing', 
    labelHi: 'बीज बोया / रोपण', 
    labelEn: 'Sowing & Seeds', 
    subHi: 'बुवाई व बीज उपचार', 
    subEn: 'Sowing & Seed Treatment', 
    icon: Sprout, 
    color: 'text-green-600',
    activeBg: 'border-green-600 bg-green-50/50',
    defaultNameHi: 'बुवाई एवं बीज रोपण',
    defaultNameEn: 'Sowing & Seed Planting',
    bbch: 'BBCH 09 (Emergence)'
  }
];

export const FieldActivityLoggerModal: React.FC<FieldActivityLoggerModalProps> = ({
  isOpen,
  onClose,
  listings,
  onActivityCreated,
  language = 'en'
}) => {
  const isHi = language === 'hi';

  const [selectedType, setSelectedType] = useState<string>('irrigation');
  const [listingId, setListingId] = useState<string>(listings[0]?.id || '');
  const [dateStr, setDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeCard = ACTION_CARDS.find(c => c.id === selectedType) || ACTION_CARDS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        name: isHi ? activeCard.defaultNameHi : activeCard.defaultNameEn,
        typeUri: activeCard.id,
        typeLabel: isHi ? activeCard.labelHi : activeCard.labelEn,
        status: 'COMPLETED',
        startsAt: new Date(dateStr).toISOString(),
        endsAt: new Date(dateStr).toISOString(),
        bbchStage: activeCard.bbch,
        listingId: listingId || undefined,
        notes: notes.trim()
        // conditions will automatically be fetched by backend with Open-Meteo weather service
      };

      await api.createActivity(payload);
      onActivityCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'डायरी सुरक्षित नहीं हो सकी' : 'Failed to save field diary'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border-2 border-[#D8D2C4] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Simple & Welcoming */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                {isHi ? 'डिजिटल खेत डायरी' : 'Digital Farm Diary'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">
              {isHi ? 'खेत की डायरी (Fasal Diary)' : 'Farm Field Diary (Khet Diary)'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
              {isHi 
                ? 'सिर्फ एक बटन दबाएं — तारीख और मौसम अपने आप जुड़ जाएगा।' 
                : 'Just tap what you did — date & weather are auto-recorded.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Value Proposition Tip Banner */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-900 shrink-0">
          <span className="text-base">💡</span>
          <span>
            {isHi 
              ? 'डायरी पूरी रखने पर खरीदार से ₹50-₹100/क्विंटल तक बेहतर दाम मिल सकता है।' 
              : 'Full diary records help earn ₹50-₹100/quintal premium from verified buyers.'}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-bold">
              {errorMsg}
            </div>
          )}

          {/* 4-5 Large Visual Action Cards */}
          <div>
            <label className="block text-xs font-black text-[#1C2B23] uppercase tracking-wider mb-2.5">
              {isHi ? 'आज खेत में क्या काम किया?' : 'What did you do on your farm today?'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACTION_CARDS.map(card => {
                const Icon = card.icon;
                const isSelected = selectedType === card.id;
                return (
                  <button
                    type="button"
                    key={card.id}
                    onClick={() => setSelectedType(card.id)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 relative ${
                      isSelected
                        ? `${card.activeBg} border-slate-900 shadow-md ring-2 ring-emerald-500/20`
                        : 'bg-[#FAF9F5] border-[#D8D2C4] hover:bg-white hover:border-slate-700 text-[#1C2B23]'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-slate-900 text-emerald-400' : 'bg-white text-slate-700 border border-stone-200'} shrink-0 shadow-2xs`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-[#1C2B23] truncate">
                          {isHi ? card.labelHi : card.labelEn}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 block truncate mt-0.5">
                        {isHi ? card.subHi : card.subEn}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attached Crop Lot & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-black text-[#1C2B23] uppercase tracking-wider mb-1.5">
                {isHi ? 'किस फसल के लिए?' : 'Select Crop Lot'}
              </label>
              <select
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="w-full min-h-[46px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-slate-800 bg-[#FAF9F5] font-extrabold text-sm text-[#1C2B23] outline-none"
              >
                {listings.length === 0 ? (
                  <option value="">{isHi ? 'सामान्य खेत रिकॉर्ड' : 'General Farm Record'}</option>
                ) : (
                  listings.map(l => (
                    <option key={l.id} value={l.id}>
                      🥔 {l.cropName} ({l.variety || 'लॉट'}) - {l.quantityTons}T
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-[#1C2B23] uppercase tracking-wider mb-1.5">
                {isHi ? 'तारीख (Date)' : 'Date'}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 pl-10 rounded-xl border-2 border-[#D8D2C4] focus:border-slate-800 bg-[#FAF9F5] font-extrabold text-sm text-[#1C2B23] outline-none"
                  required
                />
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Quick Note - Plain Rural Hindi Placeholder */}
          <div>
            <label className="block text-xs font-black text-[#1C2B23] uppercase tracking-wider mb-1.5">
              {isHi ? 'कोई खास बात? (वैकल्पिक)' : 'Quick Notes (Optional)'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isHi ? 'उदा: यूरिया 1 कट्टा / 2 घंटे नहर का पानी / नीम तेल छिड़का' : 'e.g. 1 bag urea / 2 hrs drip / bio neem spray'}
              className="w-full min-h-[46px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-slate-800 bg-[#FAF9F5] font-semibold text-sm text-[#1C2B23] outline-none"
            />
          </div>

          {/* Auto Weather Assurance Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-800 text-amber-400 shrink-0">
                <CloudSun className="w-4 h-4" />
              </div>
              <div>
                <span className="font-black text-white block">
                  {isHi ? 'मौसम डेटा अपने आप जुड़ रहा है' : 'Hyperlocal Weather Auto-Recorded'}
                </span>
                <span className="text-[11px] text-slate-300 font-medium">
                  {isHi ? 'आगरा / पश्चिमी उत्तर प्रदेश · 28°C · नमी 65% · NaLamKI Verified' : 'Agra / Western UP · 28°C · Humidity 65% · Open Standard'}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
              Auto ✓
            </span>
          </div>

          {/* Big Green 1-Tap Save Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <BookOpenCheck className="w-5 h-5" />
            <span>
              {submitting 
                ? (isHi ? 'सुरक्षित हो रहा है...' : 'Saving to Diary...') 
                : (isHi ? 'डायरी में सुरक्षित करें (Save to Diary)' : 'Save to Field Diary')}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
