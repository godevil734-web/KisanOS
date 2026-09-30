import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Sprout, 
  Plus, 
  Minus,
  CheckCircle2, 
  MapPin, 
  TrendingUp, 
  ArrowRight, 
  Home, 
  Package, 
  Coins, 
  User, 
  Phone, 
  ChevronRight, 
  X, 
  Clock, 
  Sparkles,
  Search,
  Check,
  Building2,
  Calendar
} from 'lucide-react';

type BottomTab = 'home' | 'my_crops' | 'rates' | 'profile';

interface CropItem {
  id: string;
  nameHi: string;
  nameEn: string;
  icon: string;
  defaultVariety: string;
  currentRateQuintal: number;
}

const standardCrops: CropItem[] = [
  { id: 'Potato', nameHi: 'आलू', nameEn: 'Potato', icon: '🥔', defaultVariety: 'Kufri Jyoti / Chipsona', currentRateQuintal: 1850 },
  { id: 'Wheat', nameHi: 'गेहूं', nameEn: 'Wheat', icon: '🌾', defaultVariety: 'Sharbati / HD-2967', currentRateQuintal: 2275 },
  { id: 'Maize', nameHi: 'मक्का', nameEn: 'Maize', icon: '🌽', defaultVariety: 'Yellow Hybrid', currentRateQuintal: 1950 },
  { id: 'Tomato', nameHi: 'टमाटर', nameEn: 'Tomato', icon: '🍅', defaultVariety: 'Himsona / Hybrid', currentRateQuintal: 2400 },
  { id: 'Onion', nameHi: 'प्याज', nameEn: 'Onion', icon: '🧅', defaultVariety: 'Nashik Red', currentRateQuintal: 2100 },
];

export const FarmerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  const [loading, setLoading] = useState(false);

  // Farmer's real or mock listings
  const [listings, setListings] = useState<any[]>([
    {
      id: 'lst-1',
      cropName: 'Potato',
      cropNameHi: 'आलू',
      icon: '🥔',
      variety: 'Chipsona',
      quantityValue: 50,
      quantityUnit: 'Quintal',
      expectedPricePerKg: 19.5,
      status: 'AVAILABLE',
      village: 'खंदौली (Khandauli)',
      district: 'Agra',
      listedDate: 'आज (Today)'
    },
    {
      id: 'lst-2',
      cropName: 'Wheat',
      cropNameHi: 'गेहूं',
      icon: '🌾',
      variety: 'Sharbati',
      quantityValue: 80,
      quantityUnit: 'Quintal',
      expectedPricePerKg: 22.7,
      status: 'AVAILABLE',
      village: 'खंदौली (Khandauli)',
      district: 'Agra',
      listedDate: '3 दिन पहले'
    }
  ]);

  // Buyer offers received
  const [offers, setOffers] = useState<any[]>([
    {
      id: 'off-1',
      buyerName: 'ब्रजभूमि एग्री संकलन केंद्र (Aggregator)',
      cropName: 'आलू (Potato)',
      icon: '🥔',
      offeredRateQuintal: 1850,
      distanceKm: 18,
      quantityTons: 10,
      status: 'PENDING',
      pickupLocation: 'खेत से सीधी उठान (Direct Field Pickup)'
    },
    {
      id: 'off-2',
      buyerName: 'FreshBites Foods Pvt Ltd (Bulk Buyer)',
      cropName: 'आलू (Potato)',
      icon: '🥔',
      offeredRateQuintal: 2100,
      distanceKm: 24,
      quantityTons: 25,
      status: 'PENDING',
      pickupLocation: 'आगra मंडी हब (Agra Hub)'
    }
  ]);

  // Selected Offer Detail Modal
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);

  // -------------------------------------------------------------
  // 5-STEP SELL CROP WIZARD STATE (Section 9)
  // -------------------------------------------------------------
  const [showSellWizard, setShowSellWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [sellForm, setSellForm] = useState({
    crop: standardCrops[0],
    customCropName: '',
    quantity: 50,
    unit: 'Quintal' as 'Quintal' | 'Ton',
    village: user?.location?.split(',')[0] || 'खंदौली (Khandauli)',
    district: 'Agra (आगरा)',
    locationNote: 'खेत पर सीधे गाड़ी पहुँच सकती है',
    sellTiming: '2–3 दिन में' as 'आज' | '2–3 दिन में' | '1 हफ्ते में' | 'बाद में',
  });
  const [wizardSuccess, setWizardSuccess] = useState(false);

  // Fetch real data if backend is active
  useEffect(() => {
    const loadData = async () => {
      try {
        const [listRes, offRes] = await Promise.all([
          api.getListings().catch(() => null),
          api.getOffers().catch(() => null)
        ]);
        if (listRes && listRes.length > 0) {
          setListings(listRes);
        }
        if (offRes && offRes.length > 0) {
          setOffers(offRes);
        }
      } catch (e) {
        // use default fallback
      }
    };
    loadData();
  }, []);

  // Wizard Handlers
  const handleQuantityDelta = (delta: number) => {
    setSellForm(prev => ({
      ...prev,
      quantity: Math.max(1, prev.quantity + delta)
    }));
  };

  const handleFinishSellFlow = async () => {
    setWizardSuccess(true);
    const newListing = {
      id: `lst-${Date.now()}`,
      cropName: sellForm.crop.id,
      cropNameHi: sellForm.crop.nameHi,
      icon: sellForm.crop.icon,
      variety: sellForm.crop.defaultVariety,
      quantityValue: sellForm.quantity,
      quantityUnit: sellForm.unit,
      expectedPricePerKg: (sellForm.crop.currentRateQuintal / 100),
      status: 'AVAILABLE',
      village: sellForm.village,
      district: sellForm.district,
      listedDate: 'आज (Just now)'
    };

    setListings(prev => [newListing, ...prev]);

    try {
      await api.createListing({
        cropName: sellForm.crop.id,
        variety: sellForm.crop.defaultVariety,
        quantityValue: sellForm.quantity,
        quantityUnit: sellForm.unit.toLowerCase(),
        expectedPricePerKg: (sellForm.crop.currentRateQuintal / 100),
        village: sellForm.village,
        district: sellForm.district,
        harvestTiming: sellForm.sellTiming
      }).catch(() => null);
    } catch (e) {
      // quiet catch
    }

    setTimeout(() => {
      setWizardSuccess(false);
      setShowSellWizard(false);
      setWizardStep(1);
      setActiveTab('my_crops');
    }, 1800);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-28 md:pb-16 font-sans text-stone-800">
      
      {/* ========================================================================= */}
      {/* 1. HEADER: "नमस्ते, [Farmer Name]" (Section 8)                            */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white flex items-center justify-center text-3xl shadow-sm shrink-0">
            👨‍🌾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-stone-900">
                नमस्ते, {user?.name || 'रमेश कुमार'} 👋
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>सत्यापित किसान</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 font-medium mt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{user?.location || 'खंदौली, आगरा (UP)'}</span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">KisanConnect नेटवर्क से जुड़े हैं</span>
            </div>
          </div>
        </div>

        {/* Quick sell produce shortcut button */}
        <button
          onClick={() => {
            setWizardStep(1);
            setShowSellWizard(true);
          }}
          className="self-start sm:self-auto px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-800/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>फसल बेचें</span>
        </button>
      </div>


      {/* ========================================================================= */}
      {/* 2. TAB CONTENT VIEWS                                                      */}
      {/* ========================================================================= */}

      {/* TAB 1: HOME (Section 8: Main Card + 3 Secondary Cards) */}
      {activeTab === 'home' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* MAIN CARD: "🌾 अपनी फसल बेचें" (Section 8) */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white p-6 sm:p-8 shadow-xl">
            {/* Background subtle decoration */}
            <div className="absolute right-0 bottom-0 translate-x-6 translate-y-6 text-emerald-600/30 text-9xl pointer-events-none select-none font-serif">
              🌾
            </div>

            <div className="relative z-10 max-w-lg space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-emerald-100 text-xs font-bold backdrop-blur-xs">
                <span>🌾 आसान बिक्री प्रक्रिया</span>
                <span>•</span>
                <span>Direct Sourcing</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
                  अपनी फसल बेचें
                </h2>
                <p className="text-emerald-100 text-sm sm:text-base font-normal">
                  खरीदारों तक अपनी फसल पहुँचाएं और बिना बिचौलियों के सीधा और सही दाम पाएं।
                </p>
              </div>

              {/* Button: "फसल बेचें →" (Section 8) */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setShowSellWizard(true);
                  }}
                  className="px-7 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-sm sm:text-base shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group"
                >
                  <span>फसल बेचें →</span>
                </button>
              </div>
            </div>
          </div>


          {/* 3 SECONDARY CARDS (Section 8: आज का भाव, मेरी फसल, खरीदारों के ऑफर) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* CARD 1: 💰 आज का भाव */}
            <div 
              onClick={() => setActiveTab('rates')}
              className="bg-white rounded-3xl p-6 border-2 border-stone-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    💰
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    ताज़ा भाव
                  </span>
                </div>

                <h3 className="text-lg font-black text-stone-900 mb-1">
                  आज का भाव
                </h3>
                <p className="text-xs text-stone-500 mb-4">
                  मंडी एवं खरीदारों के ताज़ा रेट
                </p>

                {/* Price Highlights */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-stone-50 flex items-center justify-between">
                    <span className="font-bold text-stone-700">🥔 आलू (Potato)</span>
                    <span className="font-black text-emerald-700">₹1,850 / Q</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-stone-50 flex items-center justify-between">
                    <span className="font-bold text-stone-700">🌾 गेहूं (Wheat)</span>
                    <span className="font-black text-emerald-700">₹2,275 / Q</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-amber-700">
                <span>सभी फसलों का भाव देखें</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* CARD 2: 📦 मेरी फसल */}
            <div 
              onClick={() => setActiveTab('my_crops')}
              className="bg-white rounded-3xl p-6 border-2 border-stone-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    📦
                  </div>
                  <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    {listings.length} सक्रिय फसलें
                  </span>
                </div>

                <h3 className="text-lg font-black text-stone-900 mb-1">
                  मेरी फसल
                </h3>
                <p className="text-xs text-stone-500 mb-4">
                  दर्ज की गई फसलों की स्थिति
                </p>

                <div className="space-y-2 text-xs">
                  {listings.slice(0, 2).map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-stone-50 flex items-center justify-between">
                      <div className="font-bold text-stone-800 truncate">
                        {item.icon} {item.cropNameHi} ({item.quantityValue} {item.quantityUnit})
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                        बाजार में सक्रिय
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-blue-700">
                <span>फसल प्रबंधन देखें</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* CARD 3: 🤝 खरीदारों के ऑफर */}
            <div 
              onClick={() => setActiveTab('home')}
              className="bg-white rounded-3xl p-6 border-2 border-stone-200 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    🤝
                  </div>
                  <span className="text-[11px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded-full animate-pulse">
                    {offers.length} नए ऑफर
                  </span>
                </div>

                <h3 className="text-lg font-black text-stone-900 mb-1">
                  खरीदारों के ऑफर
                </h3>
                <p className="text-xs text-stone-500 mb-4">
                  आसपास के खरीदारों की सीधी बोलियां
                </p>

                <div className="space-y-2 text-xs">
                  {offers.map((off) => (
                    <div 
                      key={off.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOffer(off);
                      }}
                      className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-emerald-950 truncate max-w-[130px]">
                          {off.buyerName.split(' ')[0]}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          ₹{off.offeredRateQuintal}/Q • {off.distanceKm} km away
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-emerald-800 bg-white px-2 py-1 rounded-lg border border-emerald-300">
                        देखें
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                <span>ऑफर का विवरण देखें</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

          </div>

          {/* Quick Notice: Behind the Scenes Ecosystem */}
          <div className="p-4 rounded-2xl bg-stone-100/90 border border-stone-200 flex items-center justify-between text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <span><strong>सुरक्षित व्यापार:</strong> तौल पर्ची, संकलन केंद्र व भुगतान सीधे आपके बैंक खाते में।</span>
            </div>
            <span className="text-emerald-700 font-bold shrink-0 hidden sm:inline">100% पारदर्शी</span>
          </div>

        </div>
      )}


      {/* TAB 2: मेरी फसल (My Crops List) */}
      {activeTab === 'my_crops' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-stone-900">मेरी फसल (My Produce)</h2>
              <p className="text-xs text-stone-500">आपके द्वारा दर्ज की गई सभी फसलें और उनकी वर्तमान स्थिति</p>
            </div>
            <button
              onClick={() => {
                setWizardStep(1);
                setShowSellWizard(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-emerald-700 text-white font-black text-xs shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>नई फसल जोड़ें</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {listings.map((lst) => (
              <div key={lst.id} className="bg-white rounded-3xl p-6 border-2 border-stone-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl">{lst.icon || '🥔'}</span>
                      <div>
                        <h3 className="text-lg font-black text-stone-900">
                          {lst.cropNameHi || lst.cropName}
                        </h3>
                        <span className="text-xs text-stone-500">किस्म: {lst.variety}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-200">
                      ✓ उपलब्ध
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="p-2.5 bg-stone-50 rounded-xl">
                      <span className="text-stone-400 block text-[10px]">मात्रा (Quantity):</span>
                      <span className="font-black text-stone-900 text-sm">
                        {lst.quantityValue} {lst.quantityUnit}
                      </span>
                    </div>
                    <div className="p-2.5 bg-stone-50 rounded-xl">
                      <span className="text-stone-400 block text-[10px]">अपेक्षित भाव:</span>
                      <span className="font-black text-emerald-700 text-sm">
                        ₹{(lst.expectedPricePerKg * 100).toFixed(0)} / Q
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-stone-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>{lst.village || 'खंदौली'}, {lst.district || 'Agra'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">दर्ज: {lst.listedDate || 'हाल ही में'}</span>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    ऑफर देखें →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* TAB 3: आज का भाव (Market Mandi Rates) */}
      {activeTab === 'rates' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div>
            <h2 className="text-2xl font-black text-stone-900">आज का भाव (Today's Market Price)</h2>
            <p className="text-xs text-stone-500">आगरा व आसपास की प्रमुख मंडियों के आधिकारिक एवं खरीदार भाव</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {standardCrops.map((c) => (
              <div key={c.id} className="bg-white rounded-3xl p-5 border-2 border-stone-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{c.icon}</span>
                      <div>
                        <h3 className="text-lg font-black text-stone-900">{c.nameHi}</h3>
                        <span className="text-xs text-stone-400">({c.nameEn})</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      <span>स्थिर भाव</span>
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-center my-3">
                    <span className="text-[11px] font-bold text-amber-800 uppercase block">आज का औसत भाव</span>
                    <span className="text-2xl font-black text-amber-950">₹{c.currentRateQuintal}</span>
                    <span className="text-xs text-amber-800 font-bold"> / क्विंटल (₹{(c.currentRateQuintal / 100).toFixed(1)}/kg)</span>
                  </div>

                  <div className="text-xs text-stone-500 space-y-1">
                    <div>• प्रमुख किस्म: <strong className="text-stone-800">{c.defaultVariety}</strong></div>
                    <div>• मुख्य मंडी: <strong className="text-stone-800">आगरा नवीन मंडी (Agra)</strong></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100">
                  <button
                    onClick={() => {
                      setSellForm(prev => ({ ...prev, crop: c }));
                      setWizardStep(1);
                      setShowSellWizard(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
                  >
                    यह फसल बेचें →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* TAB 4: PROFILE (किसान प्रोफाइल) */}
      {activeTab === 'profile' && (
        <div className="max-w-xl mx-auto space-y-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-stone-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4 border-b border-stone-100 pb-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-4xl">
                👨‍🌾
              </div>
              <div>
                <h2 className="text-xl font-black text-stone-900">{user?.name || 'रमेश कुमार'}</h2>
                <p className="text-xs text-stone-500">KisanConnect पंजीकृत किसान</p>
                <span className="inline-block mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ सत्यापित खाता (Verified)
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl flex items-center justify-between">
                <span className="text-stone-500">मोबाइल नंबर:</span>
                <span className="font-black text-stone-900">{user?.phone || '+91 98765 43210'}</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl flex items-center justify-between">
                <span className="text-stone-500">गाँव एवं जिला:</span>
                <span className="font-black text-stone-900">{user?.location || 'खंदौली, आगरा, UP'}</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl flex items-center justify-between">
                <span className="text-stone-500">खेत का आकार:</span>
                <span className="font-black text-stone-900">8 एकड़</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl flex items-center justify-between">
                <span className="text-stone-500">मुख्य फसल:</span>
                <span className="font-black text-stone-900">🥔 आलू (Potato) & 🌾 गेहूं</span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={() => logout()}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-700 font-bold text-xs transition-colors"
              >
                खाता लॉगआउट करें (Logout)
              </button>

              <button
                onClick={() => setActiveTab('home')}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-black text-xs shadow-xs"
              >
                मुख्य पृष्ठ पर जाएं (Home)
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 3. MOBILE-FIRST BOTTOM NAVIGATION (Section 8: Home, मेरी फसल, भाव, Profile)*/}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-xl py-2 px-4 max-w-lg mx-auto sm:rounded-t-3xl">
        <div className="flex items-center justify-around">
          
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              activeTab === 'home'
                ? 'text-emerald-700 font-black scale-105'
                : 'text-stone-400 hover:text-stone-700 font-semibold'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px]">Home</span>
          </button>

          {/* 2. मेरी फसल */}
          <button
            type="button"
            onClick={() => setActiveTab('my_crops')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              activeTab === 'my_crops'
                ? 'text-emerald-700 font-black scale-105'
                : 'text-stone-400 hover:text-stone-700 font-semibold'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[11px]">मेरी फसल</span>
          </button>

          {/* Center Quick Action button */}
          <button
            type="button"
            onClick={() => {
              setWizardStep(1);
              setShowSellWizard(true);
            }}
            className="flex flex-col items-center justify-center -translate-y-3 w-12 h-12 rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-800/30 hover:scale-110 active:scale-95 transition-all"
            title="फसल बेचें"
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* 3. भाव */}
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              activeTab === 'rates'
                ? 'text-emerald-700 font-black scale-105'
                : 'text-stone-400 hover:text-stone-700 font-semibold'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[11px]">भाव</span>
          </button>

          {/* 4. Profile */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              activeTab === 'profile'
                ? 'text-emerald-700 font-black scale-105'
                : 'text-stone-400 hover:text-stone-700 font-semibold'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[11px]">Profile</span>
          </button>

        </div>
      </nav>


      {/* ========================================================================= */}
      {/* 4. SELL CROP FLOW MODAL (Section 9: Simple 5-step flow)                   */}
      {/* ========================================================================= */}
      {showSellWizard && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-stone-50 to-white border-b border-stone-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  कदम {wizardStep} / 5 (Step {wizardStep} of 5)
                </span>
                <h3 className="text-lg font-black text-stone-900 mt-1">
                  अपनी फसल बेचें (Sell Crop)
                </h3>
              </div>

              <button
                onClick={() => {
                  setShowSellWizard(false);
                  setWizardStep(1);
                }}
                className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                title="बंद करें"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div className="w-full bg-stone-100 h-1.5">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300"
                style={{ width: `${(wizardStep / 5) * 100}%` }}
              />
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-7 overflow-y-auto space-y-5">
              
              {/* ------------------------------------------------------------- */}
              {/* STEP 1: "आप क्या बेचना चाहते हैं?" (Section 9)                  */}
              {/* ------------------------------------------------------------- */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <h4 className="text-xl font-black text-stone-900">
                      आप क्या बेचना चाहते हैं?
                    </h4>
                    <p className="text-xs text-stone-500">
                      अपनी फसल का चुनाव करें:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {standardCrops.map((c) => {
                      const isSelected = sellForm.crop.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSellForm({ ...sellForm, crop: c })}
                          className={`p-4 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <span className="text-4xl">{c.icon}</span>
                          <span className="text-sm font-black text-stone-900">{c.nameHi}</span>
                          <span className="text-[11px] text-stone-500">({c.nameEn})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* STEP 2: "आपके पास कितनी फसल है?" (Section 9)                   */}
              {/* ------------------------------------------------------------- */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <h4 className="text-xl font-black text-stone-900">
                      आपके पास कितनी फसल है?
                    </h4>
                    <p className="text-xs text-stone-500">
                      मात्रा और इकाई (Quintal या Ton) चुनें:
                    </p>
                  </div>

                  <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200 text-center space-y-5">
                    
                    {/* Unit Selector */}
                    <div className="inline-flex p-1 bg-stone-200/80 rounded-2xl text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setSellForm({ ...sellForm, unit: 'Quintal' })}
                        className={`px-4 py-1.5 rounded-xl transition-all ${
                          sellForm.unit === 'Quintal'
                            ? 'bg-white text-emerald-800 shadow-xs font-black'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        क्विंटल (Quintal)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSellForm({ ...sellForm, unit: 'Ton' })}
                        className={`px-4 py-1.5 rounded-xl transition-all ${
                          sellForm.unit === 'Ton'
                            ? 'bg-white text-emerald-800 shadow-xs font-black'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        टन (Ton)
                      </button>
                    </div>

                    {/* Quantity with [-] [value] [+] */}
                    <div className="flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => handleQuantityDelta(-5)}
                        className="w-12 h-12 rounded-2xl bg-white border-2 border-stone-300 hover:border-emerald-600 text-stone-800 font-black text-xl flex items-center justify-center transition-all active:scale-95 shadow-xs"
                      >
                        <Minus className="w-5 h-5" />
                      </button>

                      <div className="px-6 py-3 rounded-2xl bg-white border-2 border-emerald-600 min-w-[130px] shadow-sm">
                        <span className="text-3xl sm:text-4xl font-black text-emerald-800">
                          {sellForm.quantity}
                        </span>
                        <span className="text-xs font-bold text-stone-500 block">
                          {sellForm.unit === 'Quintal' ? 'क्विंटल' : 'टन'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuantityDelta(5)}
                        className="w-12 h-12 rounded-2xl bg-white border-2 border-stone-300 hover:border-emerald-600 text-stone-800 font-black text-xl flex items-center justify-center transition-all active:scale-95 shadow-xs"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Quick increment buttons */}
                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                      <span className="text-[11px] text-stone-400 font-bold">त्वरित जोड़ें:</span>
                      {[10, 25, 50, 100].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleQuantityDelta(num)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-100"
                        >
                          +{num}
                        </button>
                      ))}
                    </div>

                    <div className="text-xs text-stone-500">
                      {sellForm.unit === 'Quintal' 
                        ? `${sellForm.quantity} क्विंटल = ${(sellForm.quantity / 10).toFixed(1)} टन`
                        : `${sellForm.quantity} टन = ${sellForm.quantity * 10} क्विंटल`}
                    </div>

                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* STEP 3: "फसल कहाँ है?" (Section 9)                             */}
              {/* ------------------------------------------------------------- */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <h4 className="text-xl font-black text-stone-900">
                      फसल कहाँ है?
                    </h4>
                    <p className="text-xs text-stone-500">
                      खरीदार की गाड़ी उठान के लिए जगह बताएं:
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        गाँव का नाम (Village):
                      </label>
                      <input
                        type="text"
                        value={sellForm.village}
                        onChange={(e) => setSellForm({ ...sellForm, village: e.target.value })}
                        placeholder="गाँव का नाम लिखें"
                        className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        जिला (District):
                      </label>
                      <select
                        value={sellForm.district}
                        onChange={(e) => setSellForm({ ...sellForm, district: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Agra (आगरा)">Agra (आगरा)</option>
                        <option value="Mathura (मथुरा)">Mathura (मथुरा)</option>
                        <option value="Aligarh (अलीगढ़)">Aligarh (अलीगढ़)</option>
                        <option value="Firozabad (फिरोजाबाद)">Firozabad (फिरोजाबाद)</option>
                        <option value="Hathras (हाथरस)">Hathras (हाथरस)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        जगह का विवरण (Location Detail):
                      </label>
                      <input
                        type="text"
                        value={sellForm.locationNote}
                        onChange={(e) => setSellForm({ ...sellForm, locationNote: e.target.value })}
                        placeholder="उदा. खेत के पास पक्की सड़क है"
                        className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* STEP 4: "आप कब बेचना चाहते हैं?" (Section 9)                   */}
              {/* ------------------------------------------------------------- */}
              {wizardStep === 4 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <h4 className="text-xl font-black text-stone-900">
                      आप कब बेचना चाहते हैं?
                    </h4>
                    <p className="text-xs text-stone-500">
                      उठान का उपयुक्त समय चुनें:
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { id: 'आज', label: '🟢 आज (Today)', desc: 'फसल तैयार है, तुरंत उठान चाहिए' },
                      { id: '2–3 दिन में', label: '🟡 2–3 दिन में (In 2-3 Days)', desc: 'कटाई चल रही है, 2-3 दिन में तैयार' },
                      { id: '1 हफ्ते में', label: '🟠 1 हफ्ते में (In 1 Week)', desc: 'एक हफ्ते के अंदर उठान' },
                      { id: 'बाद में', label: '🔵 बाद में (Later / Post-Harvest)', desc: 'भविष्य की फसल का अग्रिम सौदा' },
                    ].map((t) => {
                      const isSelected = sellForm.sellTiming === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSellForm({ ...sellForm, sellTiming: t.id as any })}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20'
                              : 'bg-white border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div>
                            <div className="font-black text-sm text-stone-900">{t.label}</div>
                            <div className="text-xs text-stone-500 mt-0.5">{t.desc}</div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* STEP 5: MATCHING OFFERS (Section 9)                           */}
              {/* ------------------------------------------------------------- */}
              {wizardStep === 5 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-center space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                      ✓ खरीदार उपलब्ध
                    </span>
                    <h4 className="text-xl font-black text-stone-900 mt-2">
                      आपकी फसल के लिए उपलब्ध ऑफर
                    </h4>
                    <p className="text-xs text-stone-500">
                      नीचे दिए गए ऑफर में से सीधे सौदा स्वीकार करें या लिस्ट करें:
                    </p>
                  </div>

                  {/* Example Matching Offers Card (Exact Section 9 requirement) */}
                  <div className="space-y-3">
                    
                    {/* Offer 1: Local Aggregator (Exact example from spec) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📦</span>
                          <span className="font-black text-stone-900 text-sm sm:text-base">Local Aggregator</span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded">तुरंत उठान</span>
                        </div>
                        <div className="text-xl font-black text-emerald-800 mt-1">
                          ₹1,850 / Quintal
                        </div>
                        <div className="text-xs text-stone-500 font-medium">
                          18 km away • खंदौली संकलन हब
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleFinishSellFlow}
                        className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm shadow-md transition-all self-start sm:self-auto"
                      >
                        [ ऑफर देखें / स्वीकार करें ]
                      </button>
                    </div>

                    {/* Offer 2: Big Buyer */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/80 border-2 border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🏢</span>
                          <span className="font-black text-stone-900 text-sm sm:text-base">FreshBites Foods (Factory)</span>
                        </div>
                        <div className="text-xl font-black text-blue-900 mt-1">
                          ₹2,100 / Quintal
                        </div>
                        <div className="text-xs text-stone-500 font-medium">
                          24 km away • सीधे फैक्ट्री डिलीवरी
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleFinishSellFlow}
                        className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-black text-xs sm:text-sm shadow-md transition-all self-start sm:self-auto"
                      >
                        [ ऑफर देखें / स्वीकार करें ]
                      </button>
                    </div>

                  </div>

                  {wizardSuccess && (
                    <div className="p-3 bg-emerald-700 text-white rounded-2xl text-xs font-bold text-center animate-bounce">
                      ✓ आपकी फसल सफलतापूर्वक दर्ज हो गई है!
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Bottom Actions */}
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-3">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="px-4 py-2.5 rounded-xl bg-stone-200 text-stone-800 font-bold text-xs hover:bg-stone-300 transition-colors"
                >
                  ← पीछे (Back)
                </button>
              ) : (
                <div />
              )}

              {wizardStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep + 1)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>आगे बढ़ें (Next)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishSellFlow}
                  className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm shadow-md transition-all"
                >
                  फसल दर्ज करें (Complete)
                </button>
              )}
            </div>

          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* 5. OFFER DETAIL MODAL                                                     */}
      {/* ========================================================================= */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  ऑफर विवरण
                </span>
                <h3 className="text-base font-black text-stone-900 mt-1">
                  {selectedOffer.buyerName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOffer(null)}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-1">
              <span className="text-xs text-emerald-800 font-bold">पेश किया गया भाव (Offered Rate):</span>
              <div className="text-3xl font-black text-emerald-950">
                ₹{selectedOffer.offeredRateQuintal} / क्विंटल
              </div>
              <div className="text-xs text-emerald-700 font-semibold">
                दूरी: {selectedOffer.distanceKm} km • {selectedOffer.pickupLocation}
              </div>
            </div>

            <div className="text-xs text-stone-600 space-y-2">
              <div className="flex justify-between">
                <span>फसल:</span>
                <span className="font-bold text-stone-900">{selectedOffer.cropName}</span>
              </div>
              <div className="flex justify-between">
                <span>खरीद मात्रा:</span>
                <span className="font-bold text-stone-900">{selectedOffer.quantityTons} टन</span>
              </div>
              <div className="flex justify-between">
                <span>भुगतान:</span>
                <span className="font-bold text-emerald-700">तौल पर्ची के 24 घंटे में बैंक ट्रांसफर</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  alert('ऑफर स्वीकार कर लिया गया है! खरीदार आपसे जल्द संपर्क करेगा।');
                  setSelectedOffer(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-700 text-white font-black text-xs shadow-md hover:bg-emerald-800"
              >
                ऑफर स्वीकार करें (Accept)
              </button>
              <button
                onClick={() => setSelectedOffer(null)}
                className="px-4 py-3 rounded-2xl bg-stone-100 text-stone-700 font-bold text-xs"
              >
                बंद करें
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FarmerDashboard;
