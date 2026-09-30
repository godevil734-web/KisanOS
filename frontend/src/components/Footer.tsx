import React from 'react';
import { Sprout, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onSelectTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <div className="h-7 w-7 rounded-lg bg-agri-600 flex items-center justify-center">
                <Sprout className="h-4 w-4 text-white" />
              </div>
              <span>KisanConnect</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Full-stack multi-sided agricultural supply chain platform. Digitize and coordinate useful functions performed by farmers, aggregators, cold storage operators, and transporters.
            </p>
            <div className="text-[11px] text-agri-400 font-bold uppercase tracking-wider">
              "Connect. Aggregate. Store. Move. Sell."
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Stakeholder Gateways</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onSelectTab('farmer')} className="hover:text-white transition-colors">
                  Farmer Hub & Net Realization
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('aggregator')} className="hover:text-white transition-colors">
                  Local Aggregator Subscriptions & Batches
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('buyer')} className="hover:text-white transition-colors">
                  Buyer Industrial Procurement
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('storage')} className="hover:text-white transition-colors">
                  Cold Storage Capacity & Release
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('transport')} className="hover:text-white transition-colors">
                  Rural Logistics Route Planner
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Intelligence & Governance</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onSelectTab('intelligence')} className="hover:text-white transition-colors">
                  Mandi Benchmark Prices
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('intelligence')} className="hover:text-white transition-colors">
                  Regional Supply vs Demand Gap
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('intelligence')} className="hover:text-white transition-colors">
                  AI Yield Prediction & CV Grading
                </button>
              </li>
              <li>
                <button onClick={() => onSelectTab('admin')} className="hover:text-white transition-colors">
                  Platform Admin & Subscription Config
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Statutory Advisory</h4>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 leading-relaxed">
              <ShieldCheck className="h-4 w-4 text-emerald-400 mb-1" />
              Agricultural price realizations and supply forecasts are <strong>indicative model estimates</strong> based on terminal arrivals and distance metrics. No guaranteed futures are implied.
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/80 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div>© 2026 KisanConnect Multi-Sided Agricultural Supply Chain Platform.</div>
          <div className="flex items-center gap-1">
            <span>Built for Indian Agriculture • Uttar Pradesh Demonstration Hub</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
