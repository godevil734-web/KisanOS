import React, { useState, useEffect } from 'react';
import { 
  Sprout, 
  Layers, 
  Building2, 
  Warehouse, 
  Truck, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  ChevronRight,
  ShieldCheck,
  Eye,
  Network,
  Boxes,
  Compass,
  ArrowDown,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleSelectModal } from './RoleSelectModal';
import { RegisterModal } from './RegisterModal';
import { UserRole } from '../types';

interface LandingPageProps {
  onSelectTab: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectTab }) => {
  const { switchRole } = useAuth();

  // Modal controls
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerRole, setRegisterRole] = useState<UserRole>('farmer');

  // Floating bottom bar visibility state
  const [showFloatingBar, setShowFloatingBar] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 320) {
        setShowFloatingBar(true);
      } else {
        setShowFloatingBar(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRoleRoute = async (role: 'farmer' | 'aggregator' | 'buyer') => {
    await switchRole(role);
    onSelectTab(role);
  };

  const handleOpenRegister = (role: UserRole = 'farmer') => {
    setRegisterRole(role);
    setIsRegisterOpen(true);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-[#faf8f5] text-stone-800 font-sans selection:bg-emerald-600 selection:text-white pb-24">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION                                                          */}
      {/* ========================================================================= */}
      <section id="hero" className="relative pt-6 sm:pt-12 pb-16 sm:pb-24 overflow-hidden border-b border-stone-200">
        {/* Soft background ambient gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-32 left-1/4 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Subtle Agritech Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-emerald-900 text-xs font-bold border border-emerald-300 shadow-xs mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>भारत का एकीकृत कृषि आपूर्ति नेटवर्क • Unified Agricultural Supply</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-stone-900 tracking-tight leading-[1.15] max-w-4xl mx-auto mb-6">
            From Farm to Market, <span className="text-emerald-700 underline decoration-amber-400 decoration-wavy decoration-2">Made Simple.</span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg md:text-xl text-stone-600 max-w-3xl mx-auto leading-relaxed mb-8">
            KisanConnect connects farmers, local aggregators, storage, logistics, and bulk buyers to make agricultural selling and sourcing easier, more transparent, and more connected.
          </p>

          {/* CTAs (No login/register form directly in hero) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-14">
            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-800/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => scrollToSection('ecosystem')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white hover:bg-stone-50 text-stone-800 font-bold text-sm sm:text-base border border-stone-300 shadow-xs hover:border-stone-400 transition-all flex items-center justify-center gap-2"
            >
              <span>Explore How It Works</span>
              <ArrowDown className="w-4 h-4 text-stone-500" />
            </button>
          </div>

          {/* Hero Visual Banner (Generated photorealistic Indian agritech landscape) */}
          <div className="relative mx-auto max-w-5xl rounded-3xl overflow-hidden border-2 border-stone-200/90 shadow-2xl bg-stone-900 group">
            <img 
              src="/kisan_hero_agritech.jpg" 
              alt="KisanConnect Modern Agriculture Farm to Market" 
              className="w-full h-64 sm:h-96 md:h-[420px] object-cover object-center group-hover:scale-[1.01] transition-transform duration-700 opacity-95"
            />
            {/* Visual Glassmorphic Overlay Bar */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/90 via-stone-900/60 to-transparent p-5 sm:p-7 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-white">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  <span>🌾 Connected Agri-Supply Corridor</span>
                  <span>•</span>
                  <span>Agra - Western UP Corridor</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-stone-100">
                  Direct Field Sourcing, Controlled Atmosphere Storage & Verified Bulk Logistics
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsRoleModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>Explore Network</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Micro Trust Stats */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-stone-200/80">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-black text-stone-900">400+</div>
              <div className="text-xs text-stone-500 font-medium">Verified Farmers</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-black text-stone-900">10,000+ MT</div>
              <div className="text-xs text-stone-500 font-medium">Cold Storage Capacity</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-black text-stone-900">₹0 Hidden</div>
              <div className="text-xs text-stone-500 font-medium">Transparent Net Return</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-black text-stone-900">14-Day</div>
              <div className="text-xs text-stone-500 font-medium">Verified Settlement Cycle</div>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 2. VISUAL AGRICULTURAL ECOSYSTEM                                         */}
      {/* ========================================================================= */}
      <section id="ecosystem" className="py-16 sm:py-24 bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-bold border border-stone-200 mb-3">
              <Network className="w-3.5 h-3.5 text-emerald-600" />
              <span>Visual Agricultural Ecosystem</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight">
              The Connected Flow
            </h2>
            <p className="text-sm sm:text-base text-stone-600 mt-2">
              Supply → Connect → Aggregate → Store → Transport → Sell
            </p>
          </div>

          {/* Connected Flow Diagram */}
          <div className="relative">
            {/* Desktop Connector Line */}
            <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-1 bg-gradient-to-r from-emerald-400 via-amber-400 to-blue-500 -translate-y-1/2 z-0 opacity-40 rounded-full" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
              
              {/* Step 1: Farmer */}
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  🌾
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mb-1">
                  1. Supply
                </span>
                <h3 className="font-extrabold text-stone-900 text-base mb-1">FARMER</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Lists harvest crop, volume, variety and availability.
                </p>
              </div>

              {/* Step 2: Aggregation */}
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  📦
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mb-1">
                  2. Aggregate
                </span>
                <h3 className="font-extrabold text-stone-900 text-base mb-1">AGGREGATION</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Combines small village lots into standardized bulk lots.
                </p>
              </div>

              {/* Step 3: Storage */}
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  🏬
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 mb-1">
                  3. Store
                </span>
                <h3 className="font-extrabold text-stone-900 text-base mb-1">STORAGE</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Preserves crop quality in temperature-controlled spaces.
                </p>
              </div>

              {/* Step 4: Logistics */}
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  🚚
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 mb-1">
                  4. Transport
                </span>
                <h3 className="font-extrabold text-stone-900 text-base mb-1">LOGISTICS</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Dispatches verified freight vehicles directly to buyer hub.
                </p>
              </div>

              {/* Step 5: Big Buyer */}
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  🏢
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mb-1">
                  5. Sell & Fulfill
                </span>
                <h3 className="font-extrabold text-stone-900 text-base mb-1">BIG BUYER</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Sources high-tonnage produce with guaranteed specs.
                </p>
              </div>

            </div>
          </div>

          {/* Quick 10-second summary bar */}
          <div className="mt-8 bg-emerald-50 rounded-2xl p-4 border border-emerald-200/80 flex flex-wrap items-center justify-center gap-2 text-center text-xs font-semibold text-emerald-900">
            <span>🌾 Small Farmer Supply</span>
            <span className="text-emerald-400">→</span>
            <span>📦 Aggregator Pools</span>
            <span className="text-emerald-400">→</span>
            <span>🏬 Cold Storage Safeguard</span>
            <span className="text-emerald-400">→</span>
            <span>🚚 GPS Freight Corridors</span>
            <span className="text-emerald-400">→</span>
            <span>🏢 Industrial Bulk Delivery</span>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 3. "HOW KISANCONNECT WORKS" (5 Large Visual Cards)                       */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200">
            Transparent Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mt-3">
            How KisanConnect Works
          </h2>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            Five simple steps to connect farm supply directly with industrial procurement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 — Farmers */}
          <div className="bg-white rounded-3xl p-7 border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl mb-4">
                🌾
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Farmers</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                List your crop, quantity, location and availability.
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs text-stone-700">
              <div className="font-bold text-emerald-800">🥔 120 Quintals Potato (Chipsona)</div>
              <div className="text-[11px] text-stone-500">Agra, UP • Ready in 2 days</div>
            </div>
          </div>

          {/* Card 2 — Demand */}
          <div className="bg-white rounded-3xl p-7 border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-2xl mb-4">
                📈
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Find Demand</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                See who needs your crop and how much they need.
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs text-stone-700">
              <div className="font-bold text-blue-900">🏢 Haldiram Purees • 500 MT</div>
              <div className="text-[11px] text-stone-500">Target Price: ₹2,150/Q • Immediate Dispatch</div>
            </div>
          </div>

          {/* Card 3 — Aggregation */}
          <div className="bg-white rounded-3xl p-7 border-2 border-amber-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between md:col-span-2 lg:col-span-1">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl mb-4">
                📦
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Aggregate Supply</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-3">
                Combine produce from multiple farmers to fulfill larger orders.
              </p>
            </div>
            
            {/* Visual Example Requested */}
            <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200 text-center font-mono text-xs">
              <div className="text-stone-700 space-y-0.5">
                <div>Farmer A → 2 Ton</div>
                <div>Farmer B → 3 Ton</div>
                <div>Farmer C → 5 Ton</div>
              </div>
              <div className="text-amber-600 font-bold my-1">↓</div>
              <div className="text-sm font-black text-amber-900 bg-amber-200/80 py-1 rounded-lg">
                10 Ton Bulk Supply
              </div>
            </div>
          </div>

          {/* Card 4 — Storage & Logistics */}
          <div className="bg-white rounded-3xl p-7 border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-2xl mb-4">
                🏬
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Store & Move</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                Connect available storage and transportation when needed.
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs text-stone-700 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-teal-900">
                <span>❄️</span> 5,000 MT Cold Storage Space
              </div>
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <span>🚚</span> 22T Multi-Axle Carrier Booked
              </div>
            </div>
          </div>

          {/* Card 5 — Big Buyers */}
          <div className="bg-white rounded-3xl p-7 border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between md:col-span-2">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center text-2xl mb-4">
                🏢
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Bulk Buyers</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                Source agricultural produce from a connected supply network with certified quality and scheduled delivery.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 font-medium">
                ✓ Single Invoicing
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 font-medium">
                ✓ Uniform Quality Grade
              </div>
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 font-medium">
                ✓ Direct Field Traceability
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 4. FARMER VISUAL STORY (TIMELINE)                                        */}
      {/* ========================================================================= */}
      <section id="farmer-journey" className="py-16 sm:py-24 bg-white border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
              Farmer Experience
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mt-3">
              A Simpler Way to Sell Your Crop
            </h2>
            <p className="text-sm sm:text-base text-stone-600 mt-2">
              No guesswork, no distress selling, no unnecessary middleman cuts.
            </p>
          </div>

          {/* Visual Timeline (5 Steps) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Step 1 */}
            <div className="relative p-6 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl font-black mb-4 shadow-sm">
                🌾
              </div>
              <div className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-1">
                Step 1
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-2">
                1. List Your Crop
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Add crop name, quantity (bags/quintals), and location from your phone.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative p-6 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-black mb-4 shadow-sm">
                📊
              </div>
              <div className="text-xs font-black text-blue-700 uppercase tracking-wider mb-1">
                Step 2
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-2">
                2. Discover Demand
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Instantly view verified buyer requirements and active market orders.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative p-6 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-xl font-black mb-4 shadow-sm">
                💰
              </div>
              <div className="text-xs font-black text-amber-700 uppercase tracking-wider mb-1">
                Step 3
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-2">
                3. Compare Offers
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Review transparent prices and calculate your net profit in advance.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative p-6 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-xl font-black mb-4 shadow-sm">
                🤝
              </div>
              <div className="text-xs font-black text-teal-700 uppercase tracking-wider mb-1">
                Step 4
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-2">
                4. Make a Deal
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Lock in quantity and rate with digital verification and contract safety.
              </p>
            </div>

            {/* Step 5 */}
            <div className="relative p-6 rounded-2xl bg-stone-50 border border-stone-200 shadow-xs flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black mb-4 shadow-sm">
                🚚
              </div>
              <div className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-1">
                Step 5
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-2">
                5. Deliver / Store
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Dispatch directly or reserve cold storage space for better off-season prices.
              </p>
            </div>

          </div>

          {/* Quick CTA to try Farmer Mode */}
          <div className="mt-10 text-center">
            <button
              onClick={() => handleRoleRoute('farmer')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all hover:scale-105"
            >
              <span>Explore Farmer Portal (किसान पोर्टल देखें)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 5. BIG BUYER VISUAL STORY / AGGREGATION VISUAL                            */}
      {/* ========================================================================= */}
      <section id="aggregation-visual" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
            Solving Fragmented Supply
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mt-3">
            From Many Farmers to One Bulk Supply
          </h2>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            Institutional buyers need 500 MT of uniform produce. Individual farmers produce 2 to 5 MT each. KisanConnect bridges this gap seamlessly.
          </p>
        </div>

        {/* Aggregation Visual Board */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-stone-200 shadow-md">
          <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
            
            {/* Left: Fragmented Farmers */}
            <div className="lg:col-span-4 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                Smallholder Farmers (Individual Lots)
              </div>
              
              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">🌾 Farmer Ramesh (Khandauli)</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">2T Potato</span>
              </div>

              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">🌾 Farmer Suresh (Fatehabad)</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">3T Potato</span>
              </div>

              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">🌾 Farmer Baldev (Shamsabad)</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">5T Potato</span>
              </div>

              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">🌾 Farmer Dinesh (Bichpuri)</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">4T Potato</span>
              </div>
            </div>

            {/* Middle: KisanConnect Aggregator Engine */}
            <div className="lg:col-span-3 text-center py-4 lg:py-0">
              <div className="bg-amber-50 rounded-2xl p-5 border-2 border-dashed border-amber-300 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-black text-xl mx-auto mb-2">
                  📦
                </div>
                <div className="font-black text-stone-900 text-sm">
                  KisanConnect Platform
                </div>
                <div className="text-[11px] text-amber-800 font-semibold mt-1">
                  Local Aggregation Hub
                </div>
                <div className="mt-3 pt-3 border-t border-amber-200 text-[11px] text-stone-600 space-y-1">
                  <div>✓ Unified Quality Sorting</div>
                  <div>✓ Single Weighment Slip</div>
                  <div>✓ Escrow Settlement</div>
                </div>
              </div>

              <div className="mt-3 text-emerald-700 font-extrabold text-xs flex items-center justify-center gap-1">
                <span>14T Aggregated Supply</span>
                <ArrowRight className="w-4 h-4 hidden lg:inline" />
              </div>
            </div>

            {/* Right: Institutional Bulk Buyer */}
            <div className="lg:col-span-4 bg-stone-900 text-white rounded-2xl p-6 shadow-lg flex flex-col justify-between h-full">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center text-2xl mb-4">
                  🏢
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Bulk Procurement
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  Institutional Bulk Buyer
                </h3>
                <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                  Food processor or wholesale mandi distributor receives 1 single invoice, 1 coordinated truck delivery, and uniform standard specs.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-800 flex items-center justify-between text-xs font-bold text-emerald-400">
                <span>Single PO Fulfilled</span>
                <span>14 Tonnes Received</span>
              </div>
            </div>

          </div>
        </div>

      </section>


      {/* ========================================================================= */}
      {/* 6. ROLE-BASED "EXPLORE KISANCONNECT" (3 Large Premium Cards)             */}
      {/* ========================================================================= */}
      <section id="roles" className="py-16 sm:py-24 bg-white border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
              Interactive Entry
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mt-3">
              How do you want to use KisanConnect?
            </h2>
            <p className="text-sm sm:text-base text-stone-600 mt-2">
              Choose your role to explore the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            
            {/* CARD 1 — EXPLORE AS FARMER */}
            <div 
              id="role-farmer"
              className="group relative bg-white rounded-3xl p-7 border-2 border-stone-200 hover:border-emerald-600 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform">
                  🌾
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                  Growers & Sellers
                </div>
                <h3 className="text-2xl font-black text-stone-900 mb-2">
                  Explore as Farmer
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mb-6">
                  Sell your crop, discover buyers, compare offers and manage your deals with direct visibility on prices.
                </p>

                {/* Small visual tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {['My Crop', 'Buyers', 'Offers', 'Deals', 'Storage'].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleRoleRoute('farmer')}
                  className="w-full py-3.5 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 group-hover:gap-3 transition-all"
                >
                  <span>Explore as Farmer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CARD 2 — EXPLORE AS LOCAL AGGREGATOR */}
            <div 
              id="role-aggregator"
              className="group relative bg-white rounded-3xl p-7 border-2 border-stone-200 hover:border-amber-500 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform">
                  📦
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1">
                  Village Hubs
                </div>
                <h3 className="text-2xl font-black text-stone-900 mb-2">
                  Explore as Local Aggregator
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mb-4">
                  Connect with nearby farmers, aggregate supply and fulfill larger buyer requirements.
                </p>

                {/* Visual example box */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200/90 text-center font-mono text-xs mb-5">
                  <span className="font-bold text-stone-800">2T + 3T + 5T</span>
                  <span className="text-stone-400 mx-2">↓</span>
                  <span className="font-black text-amber-900">10T Bulk Order</span>
                </div>

                {/* Small visual tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {['Farmer Network', 'Aggregate Supply', 'Bulk Orders', 'Margin Estimate'].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleRoleRoute('aggregator')}
                  className="w-full py-3.5 px-5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-stone-950 font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 group-hover:gap-3 transition-all"
                >
                  <span>Explore as Aggregator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CARD 3 — EXPLORE AS BIG BUYER */}
            <div 
              id="role-buyer"
              className="group relative bg-white rounded-3xl p-7 border-2 border-stone-200 hover:border-blue-600 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform">
                  🏢
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-blue-700 mb-1">
                  Processors & Brands
                </div>
                <h3 className="text-2xl font-black text-stone-900 mb-2">
                  Explore as Big Buyer
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mb-6">
                  Post your requirements and discover agricultural supply from multiple farmers and aggregators.
                </p>

                {/* Small visual tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {['Post Requirement', 'Find Supply', 'Compare Offers', 'Bulk Procurement'].map((tag) => (
                    <span 
                      key={tag}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => handleRoleRoute('buyer')}
                  className="w-full py-3.5 px-5 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 group-hover:gap-3 transition-all"
                >
                  <span>Explore as Buyer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 7. TRUST / VALUE SECTION                                                 */}
      {/* ========================================================================= */}
      <section id="trust-values" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-black uppercase tracking-widest text-stone-700 bg-stone-200 px-3 py-1 rounded-full">
            Core Platform Values
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mt-3">
            Built for Transparency and Coordination
          </h2>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            No unrealistic promises. Just sound supply chain infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Value 1 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl mb-4">
                <Eye className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-1">
                Better Visibility
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Know what is available. Clear information on actual mandi rates, regional lot availability, and storage capacities.
              </p>
            </div>
          </div>

          {/* Value 2 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl mb-4">
                <Network className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-1">
                Better Connections
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Connect farmers with actual demand. Direct communication between authentic growers and genuine buyers.
              </p>
            </div>
          </div>

          {/* Value 3 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl mb-4">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-1">
                Bulk Supply
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Combine fragmented supply. Enable small farms to participate in large enterprise orders without middlemen exploitation.
              </p>
            </div>
          </div>

          {/* Value 4 */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-xl mb-4">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mb-1">
                Better Coordination
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Coordinate storage, logistics and transactions. Schedule verified vehicles and reserve cold storage directly.
              </p>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 8. CROP VISUALS SHOWCASE                                                 */}
      {/* ========================================================================= */}
      <section id="crops" className="py-16 sm:py-24 bg-white border-t border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
              Supported Agricultural Produce
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mt-3">
              Multi-Crop Agricultural Network
            </h2>
            <p className="text-sm sm:text-base text-stone-600 mt-2">
              Potato is our initial demo and primary live crop, with multiple staple and horticulture crops supported across regions.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* 1. Potato (Demo Highlight) */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-300 text-center relative group">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-stone-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live Pilot
              </span>
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🥔</div>
              <div className="font-black text-stone-900 text-sm">Potato (आलू)</div>
              <div className="text-[11px] text-amber-800 font-semibold mt-1">Full Live Matching</div>
            </div>

            {/* 2. Wheat */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center group hover:border-emerald-400 transition-colors">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🌾</div>
              <div className="font-black text-stone-900 text-sm">Wheat (गेहूं)</div>
              <div className="text-[11px] text-stone-500 mt-1">Staple Bulk Lots</div>
            </div>

            {/* 3. Maize */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center group hover:border-emerald-400 transition-colors">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🌽</div>
              <div className="font-black text-stone-900 text-sm">Maize (मक्का)</div>
              <div className="text-[11px] text-stone-500 mt-1">Feed & Industry</div>
            </div>

            {/* 4. Tomato */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center group hover:border-emerald-400 transition-colors">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🍅</div>
              <div className="font-black text-stone-900 text-sm">Tomato (टमाटर)</div>
              <div className="text-[11px] text-stone-500 mt-1">Cold Chain Transit</div>
            </div>

            {/* 5. Onion */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center group hover:border-emerald-400 transition-colors">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🧅</div>
              <div className="font-black text-stone-900 text-sm">Onion (प्याज)</div>
              <div className="text-[11px] text-stone-500 mt-1">Ventilated Storage</div>
            </div>

            {/* 6. Fruits */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-center group hover:border-emerald-400 transition-colors">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🥭</div>
              <div className="font-black text-stone-900 text-sm">Fruits (फल)</div>
              <div className="text-[11px] text-stone-500 mt-1">Mango, Citrus & CA</div>
            </div>

          </div>

          <div className="mt-8 text-center text-xs text-stone-500">
            * Note: Potato is our pilot demo crop with full price calculations and storage scenarios. Additional crop modules activate based on regional harvest seasons.
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 9. FINAL CTA SECTION                                                     */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-stone-900 to-stone-950 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🌱
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white max-w-2xl mx-auto">
            Ready to explore KisanConnect?
          </h2>

          <p className="text-stone-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Choose your role and see how the platform works for you.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm sm:text-base shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              <span>Get Started →</span>
            </button>

            <button
              onClick={() => handleOpenRegister('farmer')}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-stone-800/80 hover:bg-stone-800 text-stone-200 font-bold text-sm sm:text-base border border-stone-700 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>नया खाता बनाएं (Register)</span>
            </button>
          </div>
        </div>
      </section>


      {/* ========================================================================= */}
      {/* 10. FLOATING "GET STARTED" BAR (Section 5)                                */}
      {/* ========================================================================= */}
      <div 
        className={`fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl transition-all duration-300 pointer-events-none ${
          showFloatingBar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="pointer-events-auto bg-stone-900/90 backdrop-blur-md text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl border border-stone-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 pl-1.5 overflow-hidden">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <span className="text-xs sm:text-sm font-semibold truncate text-stone-200">
              Ready to explore KisanConnect?
            </span>
          </div>

          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="shrink-0 px-4 sm:px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs shadow-md transition-all hover:scale-105 flex items-center gap-1.5"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* 11. INTERACTIVE ROLE SELECTION MODAL                                      */}
      {/* ========================================================================= */}
      <RoleSelectModal 
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSelectRole={handleRoleRoute}
        onOpenRegister={handleOpenRegister}
      />

      {/* Universal Registration Modal */}
      <RegisterModal 
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialRole={registerRole}
        onSuccessRoleSelect={(role, tab) => {
          onSelectTab(tab);
        }}
      />

    </div>
  );
};

export default LandingPage;
