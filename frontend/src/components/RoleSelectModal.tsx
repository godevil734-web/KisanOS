import React, { useState } from 'react';
import { 
  Sprout, 
  Layers, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  Sparkles,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface RoleSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: 'farmer' | 'aggregator' | 'buyer') => void;
  onOpenRegister?: (role: UserRole) => void;
}

export const RoleSelectModal: React.FC<RoleSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectRole,
  onOpenRegister
}) => {
  const { switchRole } = useAuth();
  const [selected, setSelected] = useState<'farmer' | 'aggregator' | 'buyer'>('farmer');

  if (!isOpen) return null;

  const handleConfirm = async (role: 'farmer' | 'aggregator' | 'buyer') => {
    await switchRole(role);
    onSelectRole(role);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 sm:px-10 pt-8 pb-6 bg-gradient-to-b from-stone-50 to-white border-b border-stone-200">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Interactive Platform Gateway</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Choose how you want to explore KisanConnect
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-xl">
            Select your role to explore tailored features for farmers, local village aggregators, or institutional bulk buyers.
          </p>
        </div>

        {/* 3 Interactive Cards */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            
            {/* 1. FARMER */}
            <div
              onClick={() => setSelected('farmer')}
              onDoubleClick={() => handleConfirm('farmer')}
              className={`group relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selected === 'farmer'
                  ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20 -translate-y-1'
                  : 'border-stone-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              {selected === 'farmer' && (
                <div className="absolute top-3 right-3 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5 fill-emerald-100" />
                </div>
              )}

              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                  🌾
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                  Growers & Sellers
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  Explore as Farmer
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mb-4">
                  Sell your crop, discover buyers, compare offers and manage your deals with transparent net returns.
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {['My Crop', 'Buyers', 'Offers', 'Deals', 'Storage'].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-bold text-emerald-700 border-t border-stone-100 mt-2">
                <span>View Farmer Portal</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 2. AGGREGATOR */}
            <div
              onClick={() => setSelected('aggregator')}
              onDoubleClick={() => handleConfirm('aggregator')}
              className={`group relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selected === 'aggregator'
                  ? 'border-amber-600 bg-amber-50/40 shadow-md ring-2 ring-amber-500/20 -translate-y-1'
                  : 'border-stone-200 bg-white hover:border-amber-400 hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              {selected === 'aggregator' && (
                <div className="absolute top-3 right-3 text-amber-600">
                  <CheckCircle2 className="w-5 h-5 fill-amber-100" />
                </div>
              )}

              <div>
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                  📦
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                  Collection Hubs
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  Explore as Local Aggregator
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mb-3">
                  Connect with nearby farmers, aggregate small supply lots and fulfill high-volume buyer contracts.
                </p>

                {/* Aggregation Visual snippet */}
                <div className="bg-stone-50 rounded-lg p-2 border border-stone-200 mb-3 text-center">
                  <span className="text-[11px] font-bold text-stone-700">2T + 3T + 5T</span>
                  <span className="text-[10px] text-stone-400 mx-1">↓</span>
                  <span className="text-[11px] font-black text-amber-800">10T Bulk Order</span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {['Farmer Network', 'Aggregate Supply', 'Bulk Orders', 'Margin Estimate'].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-bold text-amber-700 border-t border-stone-100 mt-2">
                <span>View Aggregator Desk</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 3. BIG BUYER */}
            <div
              onClick={() => setSelected('buyer')}
              onDoubleClick={() => handleConfirm('buyer')}
              className={`group relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                selected === 'buyer'
                  ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20 -translate-y-1'
                  : 'border-stone-200 bg-white hover:border-blue-400 hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              {selected === 'buyer' && (
                <div className="absolute top-3 right-3 text-blue-600">
                  <CheckCircle2 className="w-5 h-5 fill-blue-100" />
                </div>
              )}

              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                  🏢
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                  Processors & Retail
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  Explore as Big Buyer
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mb-4">
                  Post requirements, discover consistent multi-farmer supply, compare quotes, and streamline procurement.
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {['Post Requirement', 'Find Supply', 'Compare Offers', 'Bulk Procurement'].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-bold text-blue-700 border-t border-stone-100 mt-2">
                <span>View Buyer Procurement</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 sm:px-10 py-5 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-stone-500 text-center sm:text-left">
            <span>Want to create a custom profile? </span>
            {onOpenRegister && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRegister(selected);
                }}
                className="font-bold text-emerald-700 hover:text-emerald-800 underline ml-1"
              >
                Register a new account here
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleConfirm(selected)}
              className="flex-1 sm:flex-initial px-7 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <span>Continue as {selected === 'farmer' ? 'Farmer' : selected === 'aggregator' ? 'Aggregator' : 'Buyer'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
