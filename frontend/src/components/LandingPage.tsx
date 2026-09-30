import React, { useState } from 'react';
import { 
  Sprout, 
  ArrowRight, 
  CheckCircle2, 
  Warehouse, 
  Truck, 
  Building2, 
  MapPin, 
  Coins, 
  ChevronRight,
  ArrowDown,
  Layers,
  CreditCard,
  ShieldCheck,
  Package,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { GetStartedModal } from './GetStartedModal';
import { LoginModal } from './LoginModal';
import { FarmerRegisterModal } from './FarmerRegisterModal';

interface LandingPageProps {
  onSelectTab: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectTab }) => {
  const [isGetStartedOpen, setIsGetStartedOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isFarmerRegisterOpen, setIsFarmerRegisterOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-[#faf8f5] text-stone-800 font-sans selection:bg-emerald-700 selection:text-white pb-20">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION                                                          */}
      {/* ========================================================================= */}
      <section id="hero" className="relative pt-8 sm:pt-14 pb-14 sm:pb-18 overflow-hidden border-b border-stone-200">
        
        {/* Ambient atmospheric backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-20 left-1/4 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-96 h-96 bg-amber-200/35 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Wireframe Flow Badge: Small farmer → Aggregation → Large buyer */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-950 text-xs sm:text-sm font-extrabold border border-emerald-300 shadow-xs mb-6">
            <span>Small farmer</span>
            <span className="text-emerald-500">→</span>
            <span>Aggregation</span>
            <span className="text-emerald-500">→</span>
            <span>Large buyer</span>
          </div>

          {/* Headline (Specified in Wireframe) */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-stone-900 tracking-tight leading-[1.12] max-w-3xl mx-auto mb-5">
            "From Farm to Market,<br />
            <span className="text-emerald-800 underline decoration-amber-400 decoration-wavy decoration-2">Made Simple."</span>
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg md:text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed mb-8 font-normal">
            KisanConnect helps small farmers find buyers, combine fragmented produce into bulk supply, and connect that supply with larger buyers.
          </p>

          {/* CTAs (Specified in Wireframe: [🌾 Start Selling] [🏭 Source Produce]) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setIsFarmerRegisterOpen(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base shadow-lg shadow-emerald-800/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
            >
              <span>🌾 Start Selling</span>
              <span className="text-xs bg-emerald-800/80 px-2 py-0.5 rounded font-bold">फसल बेचें</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => scrollToSection('for-buyers')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-stone-50 text-stone-900 font-bold text-base border-2 border-stone-300 shadow-xs hover:border-stone-400 transition-all flex items-center justify-center gap-2"
            >
              <span>🏭 Source Produce</span>
              <ArrowDown className="w-4 h-4 text-stone-500" />
            </button>
          </div>

          {/* Hero Visual Image */}
          <div className="relative mx-auto max-w-5xl rounded-3xl overflow-hidden border-2 border-stone-200 shadow-2xl bg-stone-900 group">
            <img 
              src="/kisan_hero_agritech.jpg" 
              alt="KisanConnect Modern Agriculture Farm to Market" 
              className="w-full h-64 sm:h-96 md:h-[420px] object-cover object-center group-hover:scale-[1.01] transition-transform duration-700 opacity-95"
            />
            {/* Overlay Banner */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/90 via-stone-900/60 to-transparent p-5 sm:p-7 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-white">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  <span>🌾 Connected Agri-Supply Corridor</span>
                  <span>•</span>
                  <span>Direct Farm Sourcing</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-stone-100">
                  Fair prices for farmers • Consistent bulk volume for institutional buyers
                </div>
              </div>

              <button
                onClick={() => setIsGetStartedOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <span>Get Started Now</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 2. KEY METRICS / PILOT (Section in Wireframe)                            */}
      {/* ========================================================================= */}
      <section id="key-metrics" className="py-12 sm:py-16 bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-black mb-1">
                <span>📍 LIVE PILOT CORRIDOR</span>
                <span>•</span>
                <span>WESTERN UP</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                Key Metrics & Regional Pilot
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 max-w-sm">
              Demonstrated live pilot across Agra, Mathura, and Aligarh potato and staple agricultural clusters.
            </p>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 text-center">
              <div className="text-3xl sm:text-4xl font-black text-emerald-800">400+</div>
              <div className="text-xs font-bold text-stone-800 mt-1">Verified Farmers</div>
              <p className="text-[11px] text-stone-500 mt-0.5">Digitally listed farm lots</p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 text-center">
              <div className="text-3xl sm:text-4xl font-black text-amber-700">14 Ton</div>
              <div className="text-xs font-bold text-stone-800 mt-1">Standard Bulk Lots</div>
              <p className="text-[11px] text-stone-500 mt-0.5">Single freight dispatch</p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 text-center">
              <div className="text-3xl sm:text-4xl font-black text-stone-900">₹0</div>
              <div className="text-xs font-bold text-stone-800 mt-1">Hidden Mandi Cuts</div>
              <p className="text-[11px] text-stone-500 mt-0.5">Transparent net realization</p>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 text-center">
              <div className="text-3xl sm:text-4xl font-black text-blue-800">100%</div>
              <div className="text-xs font-bold text-stone-800 mt-1">Buyer PO Fulfillment</div>
              <p className="text-[11px] text-stone-500 mt-0.5">Single invoicing to factories</p>
            </div>

          </div>

          {/* Pilot Callout Banner */}
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🥔</span>
              <span><strong>Pilot Live Focus:</strong> Agra Potato (Chipsona, Kufri Jyoti) & Wheat with automated grade sorting and 24-hr escrow payout.</span>
            </div>
            <span className="font-bold text-emerald-700 shrink-0">Agra - Western UP Hub</span>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 3. HOW IT WORKS (Section in Wireframe: 5 connected nodes)                  */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-[#faf8f5] border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3.5 py-1 rounded-full border border-emerald-200">
              Supply Chain Flow
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 tracking-tight mt-3">
              How It Works
            </h2>
            <p className="text-base sm:text-lg font-bold text-emerald-800 mt-2">
              "Small farms. One connected market."
            </p>
            <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-md mx-auto">
              Connecting individual small farm lots to industrial-scale buyers with supporting infrastructure.
            </p>
          </div>

          {/* 5-Step Connected Flow (Farmer → Aggregator → Bulk Supply → Storage/Transport → Buyer/Factory) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative">
            
            {/* 1. 🌾 Farmer */}
            <div className="bg-white rounded-3xl p-6 border-2 border-stone-200 hover:border-emerald-600 transition-all flex flex-col justify-between shadow-xs">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl mb-4">
                  🌾
                </div>
                <div className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-1">
                  1. Farmer
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-2">
                  Small Farm Lots
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Individual farmers list available harvest lots (2 to 5 Ton) directly from their phone.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] font-bold text-emerald-800">
                किसान स्तर: 2T-5T लॉट
              </div>
            </div>

            {/* 2. 📦 Aggregator */}
            <div className="bg-white rounded-3xl p-6 border-2 border-amber-300 hover:border-amber-500 transition-all flex flex-col justify-between shadow-xs">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl mb-4">
                  📦
                </div>
                <div className="text-xs font-black text-amber-700 uppercase tracking-wider mb-1">
                  2. Aggregator
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-2">
                  Collection Hubs
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Local village aggregators combine small quantities and verify quality specs.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] font-bold text-amber-800">
                संकलन: माल एकत्रीकरण
              </div>
            </div>

            {/* 3. Bulk Supply */}
            <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl mb-4 font-black">
                  🏪
                </div>
                <div className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-1">
                  3. Bulk Supply
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-2">
                  Standardized Lots
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Combined high-volume produce becomes visible to verified corporate buyers.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] font-bold text-emerald-800">
                थोक आपूर्ति: 14T-25T
              </div>
            </div>

            {/* 4. ❄️ Storage / 🚚 Transport */}
            <div className="bg-white rounded-3xl p-6 border-2 border-stone-200 hover:border-teal-500 transition-all flex flex-col justify-between shadow-xs">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-xl mb-4">
                  ❄️🚚
                </div>
                <div className="text-xs font-black text-teal-700 uppercase tracking-wider mb-1">
                  4. Storage / Move
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-2">
                  Cold Chain & Freight
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Integrated cold storage protects shelf-life and GPS freight moves produce reliably.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] font-bold text-teal-800">
                कोल्ड स्टोरेज व ट्रांसपोर्ट
              </div>
            </div>

            {/* 5. 🏭 Buyer / Factory */}
            <div className="bg-white rounded-3xl p-6 border-2 border-stone-200 hover:border-blue-600 transition-all flex flex-col justify-between shadow-xs">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-2xl mb-4">
                  🏭
                </div>
                <div className="text-xs font-black text-blue-700 uppercase tracking-wider mb-1">
                  5. Buyer / Factory
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-2">
                  Industrial Scale
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Large buyers fulfill full procurement demands with 1 single contract & invoice.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] font-bold text-blue-800">
                फैक्ट्री आपूर्ति: 1 इनवॉइस
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 4. FROM SMALL LOTS TO BULK SUPPLY (Section in Wireframe)                  */}
      {/* ========================================================================= */}
      <section id="small-lots-bulk" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-black uppercase tracking-widest text-amber-900 bg-amber-200 px-3.5 py-1 rounded-full border border-amber-300">
            Core Business Model
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 tracking-tight mt-3">
            From Small Lots to Bulk Supply
          </h2>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            2T + 3T + 5T + 4T combined through KisanConnect Aggregation into 14 Ton Bulk Supply for Bulk Buyers.
          </p>
        </div>

        {/* The Exact Visual Diagram from Wireframe */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-stone-200 shadow-xl overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Left: 2T + 3T + 5T + 4T */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-stone-200">
                <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                  Individual Farm Lots
                </span>
                <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  2T + 3T + 5T + 4T
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🌾</span>
                  <div>
                    <div className="text-xs font-black text-stone-900">Farmer A (Khandauli)</div>
                    <div className="text-[11px] text-stone-500">Potato Chipsona</div>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  2 Ton
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🌾</span>
                  <div>
                    <div className="text-xs font-black text-stone-900">Farmer B (Fatehabad)</div>
                    <div className="text-[11px] text-stone-500">Potato Chipsona</div>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  3 Ton
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🌾</span>
                  <div>
                    <div className="text-xs font-black text-stone-900">Farmer C (Shamsabad)</div>
                    <div className="text-[11px] text-stone-500">Potato Kufri Jyoti</div>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  5 Ton
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🌾</span>
                  <div>
                    <div className="text-xs font-black text-stone-900">Farmer D (Bichpuri)</div>
                    <div className="text-[11px] text-stone-500">Potato Chipsona</div>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                  4 Ton
                </span>
              </div>

            </div>

            {/* Middle: ↓ 14 TON (Aggregation Node) */}
            <div className="lg:col-span-4 text-center py-4 lg:py-0">
              <div className="p-6 rounded-3xl bg-amber-50 border-2 border-dashed border-amber-400 shadow-sm relative">
                
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-2xl mx-auto mb-2 shadow-sm font-black">
                  📦
                </div>

                <div className="text-xs font-black uppercase tracking-wider text-amber-800 mb-0.5">
                  KisanConnect Aggregation
                </div>
                <h3 className="text-lg font-black text-stone-900">
                  Combined Village Lot
                </h3>

                {/* Big 14 TON Badge */}
                <div className="mt-4 pt-3 border-t border-amber-200">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Total Volume:
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-950 mt-0.5 tracking-tight">
                    14 TON
                  </div>
                  <div className="text-xs font-black text-emerald-700 mt-1">
                    ✓ Bulk Supply Standard Grade
                  </div>
                </div>
              </div>

              <div className="mt-3 text-stone-400 font-black text-sm flex items-center justify-center gap-1">
                <span>↓ Direct Contract Delivery ↓</span>
              </div>
            </div>

            {/* Right: Bulk Buyer / Factory */}
            <div className="lg:col-span-4 bg-stone-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between h-full border border-stone-800">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl">
                    🏭
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-900/80 text-blue-200 px-2.5 py-1 rounded-full border border-blue-700">
                    Industrial Order
                  </span>
                </div>

                <div className="text-xs font-black uppercase tracking-wider text-blue-300 mb-1">
                  Procurement
                </div>
                <h3 className="text-xl font-black text-white">
                  Bulk Buyer
                </h3>
                <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                  Food processor or wholesale distributor receives 1 single invoice, 1 scheduled logistics carrier, and certified quality parameters.
                </p>

                <div className="mt-5 space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 flex items-center justify-between">
                    <span className="text-stone-400">Buyer:</span>
                    <span className="font-bold text-white">FreshBites Foods Pvt Ltd</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 flex items-center justify-between">
                    <span className="text-stone-400">Total Received:</span>
                    <span className="font-black text-emerald-400">14 Ton Single Lot</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-stone-800 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero fragmented middleman cuts</span>
              </div>
            </div>

          </div>

        </div>

      </section>


      {/* ========================================================================= */}
      {/* 5. FOR FARMERS (Section in Wireframe)                                     */}
      {/* ========================================================================= */}
      <section id="for-farmers" className="py-16 sm:py-24 bg-white border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3.5 py-1 rounded-full border border-emerald-200">
              For Farmers • किसान
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 tracking-tight mt-3">
              सरल, पारदर्शी और सीधा व्यापार
            </h2>
            <p className="text-sm sm:text-base text-stone-600 mt-2">
              किसान भाइयों के लिए विशेष रूप से डिज़ाइन किया गया आसान मोबाइल इंटरफ़ेस।
            </p>
          </div>

          {/* 4 Cards from Wireframe (अपनी फसल बेचें, आज का भाव, मेरी फसल, खरीदारों के ऑफर) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            
            {/* 1. अपनी फसल बेचें */}
            <div className="p-6 rounded-3xl bg-emerald-50/70 border-2 border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl mb-4 shadow-sm">
                  🌾
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  अपनी फसल बेचें
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-2">
                  फसल का नाम, मात्रा (क्विंटल) और गाँव बताएं। 2 मिनट में आपकी फसल दर्ज हो जाएगी।
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-200/80 text-xs font-bold text-emerald-800">
                सीधी बिक्री →
              </div>
            </div>

            {/* 2. आज का भाव */}
            <div className="p-6 rounded-3xl bg-amber-50/70 border-2 border-amber-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center text-2xl mb-4 shadow-sm">
                  💰
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  आज का भाव
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-2">
                  आसपास की मंडियों और बड़ी कंपनियों के ताज़ा भाव देखें। कोई भ्रम नहीं।
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200/80 text-xs font-bold text-amber-800">
                ताज़ा मंडी भाव →
              </div>
            </div>

            {/* 3. मेरी फसल */}
            <div className="p-6 rounded-3xl bg-blue-50/70 border-2 border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl mb-4 shadow-sm">
                  📦
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  मेरी फसल
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-2">
                  आपके सभी लिस्टिंग और सौदों की स्थिति एक ही जगह पर सुरक्षित दिखेगी।
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-blue-200/80 text-xs font-bold text-blue-800">
                फसल ट्रैकिंग →
              </div>
            </div>

            {/* 4. खरीदारों के ऑफर */}
            <div className="p-6 rounded-3xl bg-indigo-50/70 border-2 border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl mb-4 shadow-sm">
                  🤝
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  खरीदारों के ऑफर
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed mt-2">
                  कंपनियों और संकलन केंद्रों से सीधे आने वाले ऑफर देखें और मनपसंद भाव चुनें।
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-indigo-200/80 text-xs font-bold text-indigo-800">
                सीधे ऑफर →
              </div>
            </div>

          </div>

          {/* Farmer Primary Action Box */}
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 rounded-3xl p-6 sm:p-10 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-2xl sm:text-3xl font-black">
                अपनी फसल का सही भाव पाना चाहते हैं?
              </h3>
              <p className="text-emerald-100 text-xs sm:text-sm">
                KisanConnect पर अभी किसान के रूप में जुड़ें और अपनी फसल बेचना शुरू करें।
              </p>
            </div>

            <button
              onClick={() => setIsFarmerRegisterOpen(true)}
              className="px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-sm sm:text-base shadow-md transition-all hover:scale-105 shrink-0 flex items-center gap-2"
            >
              <span>🌾 Start Selling (फसल बेचें)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>


      {/* ========================================================================= */}
      {/* 6. FOR BUYERS (Section in Wireframe: Aggregator, Wholesale, Factory)      */}
      {/* ========================================================================= */}
      <section id="for-buyers" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-black uppercase tracking-widest text-blue-800 bg-blue-100 px-3.5 py-1 rounded-full border border-blue-200">
            For Buyers
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 tracking-tight mt-3">
            Source Aggregated Produce
          </h2>
          <p className="text-sm sm:text-base text-stone-600 mt-2">
            Multi-tiered procurement tailored for local collection hubs, regional wholesale traders, and industrial food processing plants.
          </p>
        </div>

        {/* 3 Buyer Tiers from Wireframe: Aggregator, Wholesale Buyer, Factory / Processor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Tier 1: Aggregator */}
          <div className="p-7 rounded-3xl bg-white border-2 border-stone-200 hover:border-amber-400 shadow-sm flex flex-col justify-between transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl mb-4 font-black">
                📦
              </div>
              <div className="text-xs font-black text-amber-700 uppercase tracking-wider mb-1">
                Collection Hubs
              </div>
              <h3 className="text-xl font-black text-stone-900 mb-2">
                Aggregator
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Connect directly with nearby smallholder farmers. Combine regional village harvest lots, standardize specs, and supply into high-volume contracts.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-xs font-bold text-amber-700">
              ✓ Local Hub Integration
            </div>
          </div>

          {/* Tier 2: Wholesale Buyer */}
          <div className="p-7 rounded-3xl bg-white border-2 border-stone-200 hover:border-emerald-500 shadow-sm flex flex-col justify-between transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl mb-4 font-black">
                🏪
              </div>
              <div className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-1">
                Mandi & Trade Networks
              </div>
              <h3 className="text-xl font-black text-stone-900 mb-2">
                Wholesale Buyer
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Source reliable 10–25 Ton truckloads with verified digital weighment slips, transparent price benchmarks, and guaranteed dispatch schedules.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-xs font-bold text-emerald-700">
              ✓ Transparent Mandi Weighment
            </div>
          </div>

          {/* Tier 3: Factory / Processor */}
          <div className="p-7 rounded-3xl bg-white border-2 border-stone-200 hover:border-blue-600 shadow-sm flex flex-col justify-between transition-all">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-2xl mb-4 font-black">
                🏭
              </div>
              <div className="text-xs font-black text-blue-700 uppercase tracking-wider mb-1">
                Corporate & Processing
              </div>
              <h3 className="text-xl font-black text-stone-900 mb-2">
                Factory / Processor
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Industrial food processors receive certified size/moisture parameters, direct farm traceability, single invoicing, and integrated freight delivery.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-stone-100 text-xs font-bold text-blue-700">
              ✓ Single Master Invoicing
            </div>
          </div>

        </div>

        <div className="mt-10 text-center">
          <button
            onClick={() => onSelectTab('buyer')}
            className="px-8 py-3.5 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm shadow-md transition-all hover:scale-105 inline-flex items-center gap-2"
          >
            <span>🏭 Source Produce (खरीद शुरू करें)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </section>


      {/* ========================================================================= */}
      {/* 7. OUR VISION (Section in Wireframe: Storage, Logistics, Settlement)       */}
      {/* ========================================================================= */}
      <section id="our-vision" className="py-16 sm:py-24 bg-white border-t border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3.5 py-1 rounded-full border border-emerald-200">
              Our Vision
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 tracking-tight mt-3">
              Supporting Infrastructure
            </h2>
            <p className="text-sm sm:text-base text-stone-600 mt-2">
              Building the foundational supply chain backbone so Indian farmers never have to sell in distress.
            </p>
          </div>

          {/* 3 Vision Pillars from Wireframe: ❄️ Storage, 🚚 Logistics, 💳 Settlement */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. ❄️ Storage */}
            <div className="p-7 rounded-3xl bg-stone-50 border-2 border-stone-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-2xl mb-4 font-black">
                  ❄️
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  Storage
                </h3>
                <div className="text-xs font-bold text-teal-700 mb-2">Cold Storage Infrastructure</div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Controlled atmosphere facilities safeguard perishable harvests, helping farmers store produce during peak gluts and sell when market rates improve.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200 text-xs font-bold text-teal-800">
                भंडारण व कोल्ड चेन
              </div>
            </div>

            {/* 2. 🚚 Logistics */}
            <div className="p-7 rounded-3xl bg-stone-50 border-2 border-stone-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-2xl mb-4 font-black">
                  🚚
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  Logistics
                </h3>
                <div className="text-xs font-bold text-indigo-700 mb-2">Rural Freight Network</div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  GPS-connected transport corridors with verified drivers and multi-axle freight carriers connect farm gates directly to wholesale and factory hubs.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200 text-xs font-bold text-indigo-800">
                ग्रामीण लॉजिस्टिक्स व परिवहन
              </div>
            </div>

            {/* 3. 💳 Settlement */}
            <div className="p-7 rounded-3xl bg-stone-50 border-2 border-stone-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl mb-4 font-black">
                  💳
                </div>
                <h3 className="text-lg font-black text-stone-900 mb-1">
                  Settlement
                </h3>
                <div className="text-xs font-bold text-emerald-700 mb-2">Transparent Escrow & Payout</div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Digital weighment slips automatically trigger escrow settlements into farmer bank accounts within 24 hours, eliminating non-payment risks.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200 text-xs font-bold text-emerald-800">
                पारदर्शी 24 घंटे में भुगतान
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Modals */}
      <GetStartedModal 
        isOpen={isGetStartedOpen}
        onClose={() => setIsGetStartedOpen(false)}
        onSelectFarmer={() => setIsFarmerRegisterOpen(true)}
        onSelectBuyer={() => onSelectTab('buyer')}
      />

      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={(tab) => onSelectTab(tab)}
        onSwitchToRegister={() => setIsFarmerRegisterOpen(true)}
      />

      <FarmerRegisterModal 
        isOpen={isFarmerRegisterOpen}
        onClose={() => setIsFarmerRegisterOpen(false)}
        onSuccess={() => onSelectTab('farmer')}
        onSwitchToLogin={() => setIsLoginOpen(true)}
      />

    </div>
  );
};

export default LandingPage;
