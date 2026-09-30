import React from 'react';
import { X, ArrowRight, Sprout, Building2 } from 'lucide-react';

interface GetStartedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFarmer: () => void;
  onSelectBuyer: () => void;
}

export const GetStartedModal: React.FC<GetStartedModalProps> = ({
  isOpen,
  onClose,
  onSelectFarmer,
  onSelectBuyer,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 sm:px-8 pt-8 pb-6 bg-gradient-to-b from-stone-50 to-white border-b border-stone-100 text-center">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title="बंद करें (Close)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-200 mb-3">
            <Sprout className="w-3.5 h-3.5 text-emerald-700" />
            <span>KisanConnect • किसान और खरीदार मंच</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            आप KisanConnect पर क्या करना चाहते हैं?
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-2 max-w-md mx-auto">
            Choose what you would like to do on KisanConnect to get started.
          </p>
        </div>

        {/* 2 Focused Options (As specified: Option 1: Farmer, Option 2: Buyer) */}
        <div className="p-6 sm:p-8 space-y-4">
          
          {/* OPTION 1: मैं किसान हूँ */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectFarmer();
            }}
            className="w-full text-left p-6 rounded-2xl border-2 border-stone-200 hover:border-emerald-600 bg-white hover:bg-emerald-50/40 shadow-sm hover:shadow-md transition-all group flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shrink-0">
                🌾
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-emerald-700 mb-0.5">
                  विक्रेता (Seller)
                </div>
                <h3 className="text-lg sm:text-xl font-black text-stone-900">
                  मैं किसान हूँ
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 font-medium mt-0.5">
                  "अपनी फसल बेचना चाहता हूँ"
                </p>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition-colors shrink-0">
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* OPTION 2: मैं फसल खरीदना चाहता हूँ */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectBuyer();
            }}
            className="w-full text-left p-6 rounded-2xl border-2 border-stone-200 hover:border-blue-600 bg-white hover:bg-blue-50/40 shadow-sm hover:shadow-md transition-all group flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shrink-0">
                🏪
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-blue-700 mb-0.5">
                  खरीदार (Buyer / Business)
                </div>
                <h3 className="text-lg sm:text-xl font-black text-stone-900">
                  मैं फसल खरीदना चाहता हूँ
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 font-medium mt-0.5">
                  "मैं फसल खरीदना चाहता हूँ (थोक एवं फैक्ट्री खरीद)"
                </p>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center group-hover:bg-blue-700 group-hover:text-white transition-colors shrink-0">
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

        </div>

        {/* Subtle Footer Note */}
        <div className="px-6 sm:px-8 py-4 bg-stone-50 border-t border-stone-100 text-center text-xs text-stone-500">
          <span>सुरक्षित और पारदर्शी कृषि व्यापार • Verified Farmers & Direct Institutional Buyers</span>
        </div>

      </div>
    </div>
  );
};

export default GetStartedModal;
