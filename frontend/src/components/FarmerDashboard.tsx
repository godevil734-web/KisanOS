import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { FarmerListing, RequirementMatch, Order, Offer, Crop, BuyerRequirement } from '../types';
import { 
  Sprout, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Warehouse, 
  Layers, 
  DollarSign, 
  HelpCircle, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  FileCheck, 
  AlertCircle,
  Calendar,
  MapPin, 
  Scale, 
  Sparkles, 
  ArrowRight, 
  Info,
  PhoneCall,
  Mic,
  User,
  Search,
  Package,
  ShieldCheck,
  Home,
  Truck,
  Building2,
  Coins,
  X,
  Check
} from 'lucide-react';

type Lang = 'hi' | 'hinglish' | 'en';

export const FarmerDashboard: React.FC = () => {
  const { user } = useAuth();

  // Language System: 'hi' (Default), 'hinglish', 'en'
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('kc_farmer_lang') as Lang) || 'hi';
  });

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('kc_farmer_lang', newLang);
  };

  // Farmer Navigation Tabs: 'home' | 'listings' | 'buyers' | 'offers' | 'orders' | 'storage' | 'profile' | 'aggregator_info'
  const [activeTab, setActiveTab] = useState<'home' | 'listings' | 'buyers' | 'offers' | 'orders' | 'storage' | 'profile' | 'aggregator_info'>('home');

  // Backend Data
  const [listings, setListings] = useState<FarmerListing[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [storageFacilities, setStorageFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Listing for Buyer Matches
  const [selectedListingForMatches, setSelectedListingForMatches] = useState<FarmerListing | null>(null);
  const [matchedBuyers, setMatchedBuyers] = useState<RequirementMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Match score explanation modal
  const [selectedMatchExplanation, setSelectedMatchExplanation] = useState<RequirementMatch | null>(null);

  // Storage decision calculator state
  const [scenarioParams, setScenarioParams] = useState({
    currentOfferPrice: 18.0,
    expectedFuturePrice: 22.5,
    months: 3,
    storageChargePerKgPerMonth: 0.45,
    handlingPerKg: 0.35
  });
  const [scenarioResult, setScenarioResult] = useState<any>(null);

  // Voice Assistant Demo Modal
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // -------------------------------------------------------------
  // STEP-BY-STEP ADD PRODUCE WIZARD STATE
  // -------------------------------------------------------------
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardSuccessMessage, setWizardSuccessMessage] = useState<string | null>(null);
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState(false);

  const initialListingState = {
    cropName: 'Potato',
    customCropName: '',
    variety: 'Kufri Jyoti',
    quantityValue: 50,
    quantityUnit: 'quintal' as 'quintal' | 'ton',
    harvestTiming: 'ready_now' as 'ready_now' | '1_week' | '15_days' | '1_month' | 'custom_date',
    availableDate: new Date().toISOString().split('T')[0],
    qualityGrade: 'Grade A', // 'Grade A' (अच्छी), 'Grade B' (सामान्य), 'Grade C' (कम)
    village: 'Khandauli',
    tehsil: 'Etmadpur',
    district: 'Agra',
    expectedPricePerKg: 20,
    sizeMinMm: 45,
    sizeMaxMm: 75,
    moisturePercent: 18,
    defectsPercent: 2.0,
    storageRequirement: 'NONE' as 'NONE' | 'COLD_STORAGE' | 'DRY_VENTILATED'
  };

  const [wizardForm, setWizardForm] = useState(initialListingState);

  // Common visual crop cards
  const standardCrops = [
    { id: 'Potato', nameHi: 'आलू', nameEn: 'Potato', icon: '🥔', defaultVariety: 'Kufri Jyoti' },
    { id: 'Onion', nameHi: 'प्याज', nameEn: 'Onion', icon: '🧅', defaultVariety: 'Nashik Red' },
    { id: 'Tomato', nameHi: 'टमाटर', nameEn: 'Tomato', icon: '🍅', defaultVariety: 'Himsona' },
    { id: 'Wheat', nameHi: 'गेहूं', nameEn: 'Wheat', icon: '🌾', defaultVariety: 'Sharbati' },
    { id: 'Maize', nameHi: 'मक्का', nameEn: 'Maize', icon: '🌽', defaultVariety: 'Yellow Corn' },
    { id: 'Mango', nameHi: 'आम', nameEn: 'Mango', icon: '🥭', defaultVariety: 'Dasheri' },
  ];

  // Fetch farmer data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, cropRes, ordRes, offRes, storageRes] = await Promise.all([
        api.getListings({ farmerId: user?.id || '' }),
        api.getCrops(),
        api.getOrders(),
        api.getOffers(),
        api.getStorageFacilities().catch(() => [])
      ]);
      setListings(listRes);
      setCrops(cropRes);
      setOrders(ordRes);
      setOffers(offRes);
      setStorageFacilities(storageRes);

      if (listRes.length > 0) {
        handleViewMatches(listRes[0]);
      }
    } catch (err) {
      console.error('Error fetching farmer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    runStorageCalculation();
  }, [user]);

  const handleViewMatches = async (listing: FarmerListing) => {
    setSelectedListingForMatches(listing);
    setLoadingMatches(true);
    try {
      const res = await api.getListingMatches(listing.id);
      setMatchedBuyers(res.matches || []);
    } catch (err) {
      console.error('Error getting matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      await api.updateOfferStatus(offerId, 'ACCEPTED');
      alert(lang === 'hi' 
        ? 'सौदा पक्का हो गया! आपका ऑर्डर दर्ज हो गया है और एस्क्रो भुगतान सुरक्षित है।' 
        : lang === 'hinglish' 
        ? 'Sauda pakka ho gaya! Order confirm ho gaya hai aur payment safe hai.' 
        : 'Offer Accepted! Deal is confirmed and escrow secured.');
      await fetchData();
      setActiveTab('orders');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    try {
      await api.updateOfferStatus(offerId, 'REJECTED');
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const runStorageCalculation = async () => {
    try {
      const res = await api.calculateStorageScenario({
        currentOfferPricePerKg: scenarioParams.currentOfferPrice,
        expectedFuturePricePerKg: scenarioParams.expectedFuturePrice,
        storageDurationMonths: scenarioParams.months,
        storageChargePerMonthPerKg: scenarioParams.storageChargePerKgPerMonth
      });
      setScenarioResult(res);
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Step-by-Step Produce Listing
  const handleWizardSubmit = async () => {
    try {
      // Calculate quantity in Tons for backend compatibility
      const quantityInTons = wizardForm.quantityUnit === 'quintal' 
        ? Number((wizardForm.quantityValue / 10).toFixed(2)) 
        : Number(wizardForm.quantityValue);

      // Resolve harvest timing
      let calculatedDate = wizardForm.availableDate;
      const today = new Date();
      if (wizardForm.harvestTiming === 'ready_now') {
        calculatedDate = today.toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '1_week') {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        calculatedDate = d.toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '15_days') {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        calculatedDate = d.toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '1_month') {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        calculatedDate = d.toISOString().split('T')[0];
      }

      const isFuture = wizardForm.harvestTiming !== 'ready_now';
      const actualCropName = wizardForm.cropName === 'Other' && wizardForm.customCropName 
        ? wizardForm.customCropName 
        : wizardForm.cropName;

      const payload = {
        cropName: actualCropName,
        variety: wizardForm.variety || 'Standard',
        quantityTons: quantityInTons > 0 ? quantityInTons : 5,
        listingType: isFuture ? 'FUTURE_HARVEST' : 'AVAILABLE_NOW',
        availableDate: calculatedDate,
        harvestDate: calculatedDate,
        grade: wizardForm.qualityGrade,
        sizeMinMm: wizardForm.sizeMinMm,
        sizeMaxMm: wizardForm.sizeMaxMm,
        moisturePercent: wizardForm.moisturePercent,
        defectsPercent: wizardForm.defectsPercent,
        expectedPricePerKg: Number(wizardForm.expectedPricePerKg),
        storageRequirement: wizardForm.storageRequirement,
        farmerLocation: `${wizardForm.village}, ${wizardForm.tehsil}, ${wizardForm.district}`
      };

      const created = await api.createListing(payload);
      setWizardSuccessMessage(lang === 'hi' 
        ? 'आपका माल बाजार में दिखने लगा है! हम आपको खरीदार के ऑफर दिखाएंगे।' 
        : lang === 'hinglish' 
        ? 'Aapka maal market mein dikhne laga hai! Hum aapko buyer offers dikhayenge.' 
        : 'Your produce is now listed in the market! We will show you matching buyer offers.');
      
      await fetchData();
      
      // Auto-load matches for newly created listing
      if (created && created.id) {
        handleViewMatches(created);
      }

      setTimeout(() => {
        setShowAddWizard(false);
        setWizardStep(1);
        setWizardSuccessMessage(null);
        setActiveTab('buyers');
      }, 1800);

    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Translations dictionary
  const t = {
    greeting: lang === 'hi' ? 'नमस्ते' : lang === 'hinglish' ? 'Namaste' : 'Hello',
    whatToDo: lang === 'hi' ? 'आज आप क्या करना चाहते हैं?' : lang === 'hinglish' ? 'Aaj aap kya karna chahte hain?' : 'What would you like to do today?',
    verifiedFarmer: lang === 'hi' ? 'सत्यापित किसान' : lang === 'hinglish' ? 'Verified Kisan' : 'Verified Farmer',
    sellProduce: lang === 'hi' ? 'मेरा माल बेचें' : lang === 'hinglish' ? 'Mera Maal Bechein' : 'Sell My Produce',
    sellProduceSub: lang === 'hi' ? 'अपनी फसल की जानकारी दें' : lang === 'hinglish' ? 'Apni fasal ki jankari dein' : 'Add details to sell your crop',
    findBuyers: lang === 'hi' ? 'खरीदार देखें' : lang === 'hinglish' ? 'Buyer Dekho' : 'Find Buyers',
    findBuyersSub: lang === 'hi' ? 'कौन आपकी फसल खरीद रहा है?' : lang === 'hinglish' ? 'Kaun aapki fasal kharid raha hai?' : 'Who is buying your crop?',
    myOffers: lang === 'hi' ? 'मेरे ऑफर' : lang === 'hinglish' ? 'Mere Offer' : 'My Offers',
    myOffersSub: lang === 'hi' ? 'कितने रुपये के ऑफर मिले हैं?' : lang === 'hinglish' ? 'Kitne rupaye ke offer mile hain?' : 'Check price offers received',
    myDeals: lang === 'hi' ? 'मेरे सौदे' : lang === 'hinglish' ? 'Mere Saude' : 'My Deals',
    myDealsSub: lang === 'hi' ? 'मेरे चल रहे और पुराने ऑर्डर' : lang === 'hinglish' ? 'Mere chal rahe aur purane order' : 'Ongoing & completed orders',
    storage: lang === 'hi' ? 'भंडारण / कोल्ड स्टोर' : lang === 'hinglish' ? 'Cold Storage' : 'Cold Storage',
    storageSub: lang === 'hi' ? 'फसल सुरक्षित रखने की जगह देखें' : lang === 'hinglish' ? 'Fasal rakhne ki jagah dekhein' : 'Find storage space nearby',
    poolWithFarmers: lang === 'hi' ? 'कई किसान मिलकर बेचें' : lang === 'hinglish' ? 'Kai Kisan Milkar Bechein' : 'Pool with Other Farmers',
    poolWithFarmersSub: lang === 'hi' ? 'कम माल है? आसपास के किसानों के साथ मिलकर 60 टन का बड़ा ऑर्डर बनाएं' : lang === 'hinglish' ? 'Kam maal hai? Doosre kisano ke sath milkar 60 ton ka order banayein' : 'Pool small lots into 60T bulk industrial contracts',
    myCrops: lang === 'hi' ? 'मेरा माल' : lang === 'hinglish' ? 'Mera Maal' : 'My Crops',
    profile: lang === 'hi' ? 'प्रोफाइल' : lang === 'hinglish' ? 'Profile' : 'Profile',
    home: lang === 'hi' ? 'होम' : lang === 'hinglish' ? 'Home' : 'Home'
  };

  const pendingOffersCount = offers.filter(o => o.status === 'PENDING').length;
  const activeOrdersCount = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;

  return (
    <div className="space-y-6 pb-24 md:pb-12 text-slate-800">
      
      {/* 1. TOP HEADER & GREETING BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-bold shadow-xs">
            👨‍🌾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                {t.greeting}, {user?.name || 'रमेश कुमार'} 👋
              </h1>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>{t.verifiedFarmer}</span>
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-slate-400" />
              <span>{user?.location || 'Khandauli, Agra, UP'}</span>
              <span>•</span>
              <span>{user?.farmerProfile?.acres || 12} एकड़ खेती</span>
            </div>
          </div>
        </div>

        {/* Top Controls: Language Switcher & Voice Demo */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Voice Input Demo Button */}
          <button
            onClick={() => setShowVoiceModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1.5 transition-colors"
            title="बोलकर बताएं"
          >
            <Mic className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">बोलकर बताएं</span>
            <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1 rounded font-semibold">Demo</span>
          </button>

          {/* Language Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => handleLangChange('hi')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                lang === 'hi' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              हिंदी
            </button>
            <button
              onClick={() => handleLangChange('hinglish')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                lang === 'hinglish' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hinglish
            </button>
            <button
              onClick={() => handleLangChange('en')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                lang === 'en' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* 2. DESKTOP NAVIGATION TABS (Hidden on small mobile) */}
      <div className="hidden md:flex items-center border-b border-slate-200 space-x-1 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'home', label: t.home, icon: Home },
          { id: 'listings', label: `${t.myCrops} (${listings.length})`, icon: Sprout },
          { id: 'buyers', label: t.findBuyers, icon: Search },
          { id: 'offers', label: `${t.myOffers}`, count: pendingOffersCount, icon: DollarSign },
          { id: 'orders', label: `${t.myDeals}`, count: activeOrdersCount, icon: Package },
          { id: 'storage', label: t.storage, icon: Warehouse },
          { id: 'aggregator_info', label: t.poolWithFarmers, icon: Layers },
          { id: 'profile', label: t.profile, icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all relative ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white text-emerald-800' : 'bg-rose-500 text-white'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. MAIN CONTENT VIEWS */}

      {/* ========================================================================= */}
      {/* 🏠 TAB 1: FARMER HOME SCREEN */}
      {/* ========================================================================= */}
      {activeTab === 'home' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Main Question & Action Grid */}
          <div className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {t.whatToDo}
            </h2>

            {/* 5 Primary Large Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              
              {/* ACTION 1: मेरा माल बेचें (Add Crop Wizard) */}
              <button
                onClick={() => {
                  setWizardStep(1);
                  setShowAddWizard(true);
                }}
                className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-left shadow-md hover:shadow-lg hover:scale-[1.01] transition-all flex flex-col justify-between group min-h-[140px]"
              >
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                    🥔
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-extrabold flex items-center gap-1">
                    <Plus className="h-3 w-3" />
                    <span>नया</span>
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black">{t.sellProduce}</div>
                  <div className="text-xs text-emerald-100 mt-0.5">{t.sellProduceSub}</div>
                </div>
              </button>

              {/* ACTION 2: खरीदार देखें */}
              <button
                onClick={() => setActiveTab('buyers')}
                className="p-5 rounded-2xl bg-white border-2 border-slate-200 text-left shadow-xs hover:border-emerald-400 hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between group min-h-[140px]"
              >
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
                    🔎
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-slate-900">{t.findBuyers}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.findBuyersSub}</div>
                </div>
              </button>

              {/* ACTION 3: मेरे ऑफर */}
              <button
                onClick={() => setActiveTab('offers')}
                className="p-5 rounded-2xl bg-white border-2 border-slate-200 text-left shadow-xs hover:border-amber-400 hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between group min-h-[140px] relative"
              >
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl">
                    💰
                  </div>
                  {pendingOffersCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                      {pendingOffersCount} नए ऑफर
                    </span>
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                  )}
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-slate-900">{t.myOffers}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.myOffersSub}</div>
                </div>
              </button>

              {/* ACTION 4: मेरे सौदे */}
              <button
                onClick={() => setActiveTab('orders')}
                className="p-5 rounded-2xl bg-white border-2 border-slate-200 text-left shadow-xs hover:border-purple-400 hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between group min-h-[140px]"
              >
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl">
                    📦
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-purple-600 transition-colors" />
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-slate-900">{t.myDeals}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.myDealsSub}</div>
                </div>
              </button>

              {/* ACTION 5: भंडारण / कोल्ड स्टोर */}
              <button
                onClick={() => setActiveTab('storage')}
                className="p-5 rounded-2xl bg-white border-2 border-slate-200 text-left shadow-xs hover:border-cyan-400 hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between group min-h-[140px]"
              >
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-2xl">
                    🏠
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-cyan-600 transition-colors" />
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-slate-900">{t.storage}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.storageSub}</div>
                </div>
              </button>

              {/* ACTION 6: कई किसान मिलकर बेचें (Aggregator pooling) */}
              <button
                onClick={() => setActiveTab('aggregator_info')}
                className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 text-left shadow-xs hover:border-amber-400 hover:shadow-md hover:scale-[1.01] transition-all flex flex-col justify-between group min-h-[140px]"
              >
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl">
                    🤝
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                    बड़ा फायदा
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-lg font-black text-slate-900">{t.poolWithFarmers}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{t.poolWithFarmersSub}</div>
                </div>
              </button>

            </div>
          </div>

          {/* New Offer Alert Card (if any pending offers) */}
          {offers.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                  🔔
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-100">
                    नया खरीदार ऑफर (New Buyer Offer)
                  </div>
                  <div className="text-base sm:text-lg font-black">
                    {offers[0].buyerName}: {offers[0].cropName} के लिए ₹{offers[0].buyerOfferedPricePerKg}/kg
                  </div>
                  <div className="text-xs text-amber-100">
                    मात्रा: {offers[0].quantityTons} टन • "{offers[0].message || 'तुरंत उठान उपलब्ध'}"
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('offers')}
                className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-extrabold text-xs sm:text-sm shadow-xs hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto"
              >
                <span>ऑफर देखें (View Offer)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Simple Month Summary Numbers (Not dense charts!) */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              इस महीने का संक्षिप्त हिसाब (This Month's Summary):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-xl sm:text-2xl font-black text-emerald-700">₹25,000</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">कुल बिक्री (Sales)</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-xl sm:text-2xl font-black text-slate-900">12 क्विंटल</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">माल बेचा (Sold)</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-xl sm:text-2xl font-black text-blue-700">4</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">सक्रिय खरीदार (Buyers)</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-xl sm:text-2xl font-black text-purple-700">{orders.length}</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">सफल सौदे (Deals)</div>
              </div>
            </div>
          </div>

          {/* Nearby Buyer Opportunities Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">📍 पास के बड़े खरीदार (Nearby Buyers)</h3>
                <p className="text-xs text-slate-500">ये कंपनियां आपके इलाके से सीधे माल खरीदना चाहती हैं</p>
              </div>
              <button
                onClick={() => setActiveTab('buyers')}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>सभी देखें</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🍟</div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">FreshBites Foods Pvt Ltd</div>
                    <div className="text-[11px] text-slate-500">आलू चिप्सोना • जरूरत: 100 टन • ₹21.50/kg</div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  18 km दूर
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🧅</div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Apex Wholesale Agri Trade</div>
                    <div className="text-[11px] text-slate-500">प्याज नासिक रेड • जरूरत: 40 टन • ₹20.00/kg</div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  25 km दूर
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌾 TAB 2: MY CROPS / LISTINGS (मेरा माल) */}
      {/* ========================================================================= */}
      {activeTab === 'listings' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                मेरा माल (Mere Paas Kitna Maal Hai)
              </h2>
              <p className="text-xs text-slate-500">
                आपके द्वारा बाजार में दर्ज की गई फसलें ({listings.length})
              </p>
            </div>
            <button
              onClick={() => {
                setWizardStep(1);
                setShowAddWizard(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>नया माल जोड़ें (Add Crop)</span>
            </button>
          </div>

          {listings.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
              <div className="text-4xl">🌾</div>
              <h3 className="text-base font-bold text-slate-800">अभी कोई फसल नहीं डाली गई है</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                अपनी तैयार फसल या खेत में खड़ी फसल की जानकारी दें ताकि खरीदार आपसे संपर्क कर सकें।
              </p>
              <button
                onClick={() => {
                  setWizardStep(1);
                  setShowAddWizard(true);
                }}
                className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
              >
                + पहली फसल जोड़ें
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((list) => {
                const isFuture = list.listingType === 'FUTURE_HARVEST';
                return (
                  <div 
                    key={list.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isFuture ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            {isFuture ? '⏳ खड़ी फसल (Pre-harvest)' : '✓ तैयार फसल (Ready)'}
                          </span>
                          <h3 className="text-lg font-black text-slate-900 mt-1">
                            {list.cropName} <span className="text-xs font-medium text-slate-500">({list.variety})</span>
                          </h3>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-black text-emerald-700">₹{list.expectedPricePerKg}</div>
                          <span className="text-[10px] text-slate-400">उम्मीद भाव / किलो</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 text-[10px] block">मात्रा (Quantity):</span>
                          <span className="font-extrabold text-slate-800">
                            {list.quantityTons * 10} क्विंटल ({list.quantityTons} टन)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">गुणवत्ता (Grade):</span>
                          <span className="font-bold text-slate-800">{list.grade}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">तैयार तारीख:</span>
                          <span className="font-medium text-slate-700">{list.availableDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">साइज़ (Caliber):</span>
                          <span className="font-medium text-slate-700">{list.sizeMinMm}-{list.sizeMaxMm} mm</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                        <span>📍 {list.farmerLocation}</span>
                        <span className="font-bold text-emerald-700">✓ बाजार में सक्रिय</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        handleViewMatches(list);
                        setActiveTab('buyers');
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 border border-emerald-200"
                    >
                      <Search className="h-3.5 w-3.5 text-emerald-600" />
                      <span>इसके खरीदार देखें (See Matching Buyers)</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔎 TAB 3: BUYER DISCOVERY (मेरी फसल कौन खरीदेगा?) */}
      {/* ========================================================================= */}
      {activeTab === 'buyers' && (
        <div className="space-y-4 animate-fadeIn">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                मेरी फसल कौन खरीदेगा? (Kisko Maal Chahiye?)
              </h2>
              <p className="text-xs text-slate-500">
                आपके इलाके के सक्रिय खरीदार और कंपनियां
              </p>
            </div>

            {listings.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">फसल चुनें:</span>
                <select
                  value={selectedListingForMatches?.id || ''}
                  onChange={(e) => {
                    const found = listings.find(l => l.id === e.target.value);
                    if (found) handleViewMatches(found);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                >
                  {listings.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.cropName} ({l.quantityTons * 10} क्विंटल)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Simple Distance / Net Realization Tip */}
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
            <span className="text-lg">💡</span>
            <div>
              <strong className="block">ध्यान दें (Important Advice):</strong>
              सिर्फ ज्यादा कीमत देखना काफी नहीं है। दूर के खरीदार तक पहुंचाने का भाड़ा खर्च (Transport Cost) भी कटता है। हमारा सिस्टम नीचे आपको दिखाता है कि <strong>"खर्च के बाद आपके हाथ में कितना रुपया बचेगा" (Estimated Net Realization)</strong>।
            </div>
          </div>

          {loadingMatches ? (
            <div className="py-12 text-center text-slate-400">
              <Sparkles className="h-8 w-8 mx-auto animate-spin text-emerald-600 mb-2" />
              <p className="text-sm font-bold">अनुकूल खरीदार खोजे जा रहे हैं...</p>
            </div>
          ) : matchedBuyers.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
              <div className="text-4xl">🔍</div>
              <h3 className="text-base font-bold text-slate-800">अभी कोई सीधा खरीदार नहीं मिला</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                नए खरीदार रोज ऑर्डर डालते हैं। आप अपनी फसल का रेट थोड़ा अपडेट कर सकते हैं या पास के संग्राहक से जुड़ सकते हैं।
              </p>
              <button
                onClick={() => setActiveTab('aggregator_info')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs"
              >
                संग्राहक के साथ मिलकर बेचें
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {matchedBuyers.map((matchItem, idx) => {
                const req = matchItem.requirement;
                const nr = matchItem.netRealization;

                return (
                  <div 
                    key={idx}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs hover:border-emerald-400 transition-all space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{req.buyerCompany}</span>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {req.deliveryType === 'PICKUP_REQUIRED' ? '🚜 खेत से उठाएंगे' : '🚚 प्लांट तक'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          जरूरत: <strong>{req.quantityTons * 10} क्विंटल ({req.quantityTons} टन)</strong> • {req.cropName} ({req.variety})
                        </div>
                      </div>

                      {/* Match badge */}
                      <button
                        onClick={() => setSelectedMatchExplanation(matchItem)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center gap-1"
                        title="विस्तार से देखें"
                      >
                        <Sparkles className="h-3 w-3 text-emerald-600" />
                        <span>{matchItem.matchScore}% अनुकूल</span>
                      </button>
                    </div>

                    {/* Simple Price & Net In Hand Box */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">कंपनी का ऑफर भाव:</span>
                        <span className="font-extrabold text-slate-900 text-sm">₹{nr.buyerPrice.toFixed(2)} / किलो</span>
                      </div>
                      <div className="flex justify-between items-center text-rose-600">
                        <span>अनुमानित भाड़ा व खर्च (Deductions):</span>
                        <span className="font-semibold">- ₹{nr.totalDeductions.toFixed(2)} / किलो</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-900 block">खर्च काटकर आपके हाथ में (Net In Hand):</span>
                          <span className="text-[10px] text-slate-400">खेत पर शुद्ध भुगतान</span>
                        </div>
                        <span className="text-lg font-black text-emerald-700">
                          ₹{nr.estimatedNetRealization.toFixed(2)} / किलो
                        </span>
                      </div>
                    </div>

                    {/* Match reasons */}
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {matchItem.reasons.slice(0, 2).map((r, i) => (
                        <span key={i} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          ✓ {r}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="pt-1 flex items-center justify-between gap-3">
                      <button
                        onClick={() => setSelectedMatchExplanation(matchItem)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                      >
                        हिसाब समझें
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await api.createOffer({
                              requirementId: req.id,
                              listingId: selectedListingForMatches?.id,
                              sellerId: user?.id,
                              sellerName: user?.name,
                              cropName: selectedListingForMatches?.cropName,
                              variety: selectedListingForMatches?.variety,
                              quantityTons: selectedListingForMatches?.quantityTons,
                              offeredPricePerKg: req.offeredPricePerKg,
                              deliveryTerms: req.deliveryType
                            });
                            alert(`${req.buyerCompany} को आपका ऑफर भेज दिया गया है! वे जल्द संपर्क करेंगे।`);
                            await fetchData();
                            setActiveTab('offers');
                          } catch (e) {
                            alert((e as Error).message);
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors"
                      >
                        सौदा भेजें (Send Offer)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 💰 TAB 4: MY OFFERS (मेरे ऑफर) */}
      {/* ========================================================================= */}
      {activeTab === 'offers' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              मेरे ऑफर (Kitne Rupaye Ke Offer Mile Hain)
            </h2>
            <p className="text-xs text-slate-500">
              खरीदारों द्वारा आपकी फसल के लिए भेजी गई बोलियां
            </p>
          </div>

          {offers.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
              <div className="text-4xl">💰</div>
              <h3 className="text-base font-bold text-slate-800">अभी कोई नया ऑफर नहीं आया है</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                जैसे ही कोई खरीदार आपकी फसल के लिए बोली लगाएगा, वह सीधे यहाँ दिखाई देगी।
              </p>
              <button
                onClick={() => setActiveTab('buyers')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                खरीदार देखें और खुद ऑफर भेजें
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((off) => {
                const totalAmount = Math.round(off.buyerOfferedPricePerKg * off.quantityTons * 1000);
                return (
                  <div 
                    key={off.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">{off.buyerName}</span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          off.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : off.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {off.status === 'ACCEPTED' ? '✓ स्वीकृत (Accepted)' : off.status === 'REJECTED' ? '✕ अस्वीकृत' : '⏳ नया ऑफर (Pending)'}
                        </span>
                      </div>

                      <div className="text-lg font-black text-emerald-700">
                        ₹{off.buyerOfferedPricePerKg} / किलो
                        <span className="text-xs font-normal text-slate-500 ml-2">
                          (कुल रकम: <strong>₹{totalAmount.toLocaleString()}</strong>)
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">
                        मात्रा: <strong>{off.quantityTons * 10} क्विंटल ({off.quantityTons} टन)</strong> • {off.cropName} ({off.variety})
                      </div>

                      {off.message && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{off.message}"
                        </p>
                      )}

                      <div className="text-[10px] text-slate-400">
                        शर्तें: {off.deliveryTerms === 'PICKUP_REQUIRED' ? 'खेत से उठान' : 'डिलीवरी'} • {new Date(off.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                      {off.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleAcceptOffer(off.id)}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <Check className="h-4 w-4" />
                            <span>ऑफर स्वीकार करें (Accept)</span>
                          </button>
                          <button
                            onClick={() => handleRejectOffer(off.id)}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                          >
                            मना करें (Decline)
                          </button>
                        </>
                      )}

                      {off.status === 'ACCEPTED' && (
                        <button
                          onClick={() => setActiveTab('orders')}
                          className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>सौदा देखें (View Order)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 TAB 5: MY DEALS / ORDERS (मेरे सौदे) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              मेरे सौदे (Mere Chal Rahe Aur Purane Order)
            </h2>
            <p className="text-xs text-slate-500">
              सौदा तय होने से लेकर बैंक में पैसे आने तक का पूरा हिसाब
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
              <div className="text-4xl">📦</div>
              <h3 className="text-base font-bold text-slate-800">अभी कोई सक्रिय सौदा नहीं है</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                जब खरीदार आपका ऑफर स्वीकार करेगा, तो यहाँ आपका पक्का ऑर्डर और गाड़ी की जानकारी दिखेगी।
              </p>
              <button
                onClick={() => setActiveTab('buyers')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                खरीदार देखें
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((ord) => {
                const isCompleted = ord.status === 'COMPLETED';
                const isInTransit = ord.status === 'IN_TRANSIT';

                return (
                  <div 
                    key={ord.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs space-y-4"
                  >
                    {/* Top Order Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{ord.orderNumber}</span>
                          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                            खरीदार: {ord.buyerName}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">दिनांक: {new Date(ord.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isInTransit
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isCompleted ? '✓ भुगतान पूरा (Completed)' : isInTransit ? '🚚 रास्ते में है (In Transit)' : '🟡 सौदा तय (Confirmed)'}
                        </span>
                        <span className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          <span>सुरक्षित एस्क्रो</span>
                        </span>
                      </div>
                    </div>

                    {/* Order Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">फसल:</span>
                        <span className="font-bold text-slate-800">{ord.quantityTons * 10} क्विंटल {ord.cropName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">तय भाव:</span>
                        <span className="font-bold text-slate-800">₹{ord.unitPricePerKg} / किलो</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">कुल रकम:</span>
                        <span className="font-black text-emerald-700 text-sm">₹{ord.produceTotal.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">गाड़ी / ट्रांसपोर्ट:</span>
                        <span className="font-medium text-slate-700">{ord.transporterName || 'Kisan Express'}</span>
                      </div>
                    </div>

                    {/* Visual 5-Step Order Timeline */}
                    <div className="pt-2">
                      <div className="text-xs font-bold text-slate-500 mb-2">सौदा प्रगति (Deal Progress):</div>
                      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                          1. सौदा तय ✓
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          ord.status !== 'CREATED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          2. माल तैयार
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          isInTransit || isCompleted ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          3. उठान / रवाना
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          isCompleted ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          4. फैक्ट्री पहुंच
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          isCompleted ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          5. बैंक में पैसा
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🏠 TAB 6: COLD STORAGE & PRESERVATION (भंडारण) */}
      {/* ========================================================================= */}
      {activeTab === 'storage' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              कोल्ड स्टोरेज (Fasal Rakhne Ki Jagah Dekhein)
            </h2>
            <p className="text-xs text-slate-500">
              दाम कम है? फसल सुरक्षित रखें और भाव बढ़ने पर बाद में बेचें।
            </p>
          </div>

          {/* Simple Simulator: Sell Now vs Store */}
          <div className="bg-white rounded-2xl border-2 border-cyan-300 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">❄️</span>
              <h3 className="text-base font-black text-slate-900">
                मुनाफा जांचें: अभी बेचें या कोल्ड स्टोर में रखें?
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  आज का भाव (₹/kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={scenarioParams.currentOfferPrice}
                  onChange={(e) => setScenarioParams({ ...scenarioParams, currentOfferPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  भविष्य में अनुमानित भाव (₹/kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={scenarioParams.expectedFuturePrice}
                  onChange={(e) => setScenarioParams({ ...scenarioParams, expectedFuturePrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-cyan-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  स्टोरेज का समय
                </label>
                <select
                  value={scenarioParams.months}
                  onChange={(e) => setScenarioParams({ ...scenarioParams, months: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value={1}>1 महीना</option>
                  <option value={2}>2 महीने</option>
                  <option value={3}>3 महीने (मानक)</option>
                  <option value={6}>6 महीने</option>
                </select>
              </div>
            </div>

            {scenarioResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">विकल्प 1: आज बेचने पर</span>
                  <div className="text-xl font-black text-slate-900">
                    ₹{scenarioResult.currentOfferPricePerKg.toFixed(2)} / किलो
                  </div>
                  <div className="text-[11px] text-slate-500">तुरंत भुगतान, कोई किराया नहीं</div>
                </div>

                <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-800 uppercase text-[10px]">विकल्प 2: कोल्ड स्टोर में रखने पर</span>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      +{scenarioResult.netGainOrLossPerKg > 0 ? `₹${scenarioResult.netGainOrLossPerKg}/kg फायदा` : 'कम फायदा'}
                    </span>
                  </div>
                  <div className="text-xl font-black text-cyan-900">
                    ₹{scenarioResult.estimatedFutureNetRealization.toFixed(2)} / किलो
                  </div>
                  <div className="text-[11px] text-cyan-800 font-semibold">
                    💡 {scenarioResult.recommendation}
                  </div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400">
              *सलाह: यह अनुमान है, भविष्य की बाजार कीमत पर निर्भर करता है।
            </div>
          </div>

          {/* Cold Storage Facilities List */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">पास के उपलब्ध कोल्ड स्टोरेज (Nearby Facilities)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">आगरा इम्पीरियल कोल्ड लॉजिस्टिक्स</h4>
                      <p className="text-xs text-slate-500">आगरा बाईपास रोड • 8 km दूर</p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      खाली जगह: 2,400 टन
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    किराया: <strong>₹0.45 प्रति किलो / महीना</strong> • डिजिटल पर्ची उपलब्ध
                  </div>
                </div>
                <button
                  onClick={() => alert('कोल्ड स्टोर बुकिंग अनुरोध दर्ज हुआ। Imperial Cold आपसे संपर्क करेगा।')}
                  className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                >
                  जगह बुक करें (Book Space)
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">मथुरा कोल्ड चेन हब</h4>
                      <p className="text-xs text-slate-500">मथुरा रोड • 18 km दूर</p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      खाली जगह: 1,800 टन
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    किराया: <strong>₹0.40 प्रति किलो / महीना</strong> • आलू व प्याज भंडारण
                  </div>
                </div>
                <button
                  onClick={() => alert('कोल्ड स्टोर बुकिंग अनुरोध दर्ज हुआ। Mathura Hub आपसे संपर्क करेगा।')}
                  className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                >
                  जगह बुक करें (Book Space)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🤝 TAB 7: AGGREGATOR EXPLANATION (कई किसान मिलकर बेचें) */}
      {/* ========================================================================= */}
      {activeTab === 'aggregator_info' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-amber-300 shadow-sm space-y-6 animate-fadeIn">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              कई किसान मिलकर बेचें (Kai Kisan Milkar Bechein)
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              संग्राहक (Aggregator) क्यों जरूरी है?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              अगर आपका माल कम है, तो आसपास के दूसरे किसानों के साथ मिलकर बड़ी मात्रा में बेचा जा सकता है।
            </p>
          </div>

          {/* Simple Visual Explanation */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 text-xs sm:text-sm">
            <div className="font-bold text-amber-900">सरल उदाहरण (Simple Example):</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="block text-slate-500 text-[10px]">आपका माल</span>
                <span className="text-amber-800 text-base">15 टन</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="block text-slate-500 text-[10px]">किसान B (सुरेश)</span>
                <span className="text-amber-800 text-base">20 टन</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="block text-slate-500 text-[10px]">किसान C (महेंद्र)</span>
                <span className="text-amber-800 text-base">25 टन</span>
              </div>
              <div className="bg-amber-600 text-white p-3 rounded-xl border border-amber-700">
                <span className="block text-amber-200 text-[10px]">कुल बल्क बैच</span>
                <span className="text-white text-base">60 टन ट्रकलोड</span>
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed text-xs">
              फैक्ट्रियों (जैसे चिप्स कंपनी) को 60 से 100 टन का पूरा ट्रक चाहिए होता है। स्थानीय संग्राहक (Aggregator) आपके गाँव से माल उठाता है, गुणवत्ता जांचता है और कंपनी से <strong>₹1.50 से ₹2.50 प्रति किलो ज्यादा भाव</strong> दिलवाता है।
            </p>
          </div>

          {/* Local Aggregator Card */}
          <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-700">आपके इलाके में उपलब्ध संग्राहक</span>
                <h4 className="text-base font-black text-slate-900">विक्रम सिंह (आगरा कृषि कलेक्टिव्स)</h4>
                <div className="text-xs text-slate-500">📍 12 km दूर • आगरा-मथुरा क्षेत्र • 4.9★ रेटिंग</div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                सत्यापित आढ़ती
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">मांग:</span>
                <span className="font-bold text-slate-900">आलू चिप्सोना (60 टन बैच बना रहे हैं)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ऑफर भाव:</span>
                <span className="font-black text-emerald-700">₹20.50 / किलो (खेत से सीधा उठान)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => alert('विक्रम सिंह के बैच में आपका नाम जुड़ गया है। वे आज ही गाड़ी पिकअप के लिए संपर्क करेंगे।')}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                मुझे इस बैच में शामिल होना है (Join Batch)
              </button>
              <button
                onClick={() => setActiveTab('buyers')}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
              >
                सीधे खरीदार को बेचना है
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 👤 TAB 8: FARMER PROFILE (मेरा प्रोफाइल) */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 animate-fadeIn">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-800 font-black text-2xl flex items-center justify-center">
              👨‍🌾
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">{user?.name}</h2>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span>{user?.phone}</span>
                <span>•</span>
                <span>{user?.email}</span>
              </div>
              <div className="text-xs text-emerald-700 font-bold mt-1">
                ✓ आधार व बैंक खाता सत्यापित (Verified Profile)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 text-sm">खेती की जानकारी (Farm Details)</div>
              <div className="flex justify-between text-slate-600">
                <span>गाँव व जिला:</span>
                <span className="font-bold text-slate-900">{user?.location}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>कुल जमीन:</span>
                <span className="font-bold text-slate-900">{user?.farmerProfile?.acres || 12} एकड़</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>मुख्य फसलें:</span>
                <span className="font-bold text-slate-900">
                  {user?.farmerProfile?.cropsGrown?.join(', ') || 'Potato, Wheat'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>सिंचाई साधन:</span>
                <span className="font-bold text-slate-900">{user?.farmerProfile?.irrigationType || 'Tube well'}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 text-sm">मंच पर रिकॉर्ड (Track Record)</div>
              <div className="flex justify-between text-slate-600">
                <span>सफल सौदे:</span>
                <span className="font-bold text-emerald-700">{user?.completedOrders || 18} पूरे हुए</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>रेटिंग:</span>
                <span className="font-bold text-amber-600">{user?.rating || 4.8} ★ ({user?.reviewsCount || 14} समीक्षाएं)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>सक्रिय फसलें:</span>
                <span className="font-bold text-slate-900">{listings.length} फसलें दर्ज</span>
              </div>
            </div>
          </div>

          {/* Language Preference inside Profile */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-slate-900">पसंदीदा भाषा (App Language)</div>
              <div className="text-slate-500">चुनें जिस भाषा में आप सहज हैं</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleLangChange('hi')}
                className={`px-3 py-1.5 rounded-lg font-bold ${lang === 'hi' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}
              >
                हिंदी
              </button>
              <button
                onClick={() => handleLangChange('hinglish')}
                className={`px-3 py-1.5 rounded-lg font-bold ${lang === 'hinglish' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}
              >
                Hinglish
              </button>
              <button
                onClick={() => handleLangChange('en')}
                className={`px-3 py-1.5 rounded-lg font-bold ${lang === 'en' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}
              >
                English
              </button>
            </div>
          </div>

          {/* Helpline box */}
          <div className="p-4 rounded-2xl bg-slate-100 flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-emerald-600" />
              <span>किसान सहायता नंबर: <strong>1800-123-KISAN (54726)</strong></span>
            </div>
            <span className="text-[11px] text-slate-400">टोल-फ्री</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom on phones) */}
      {/* ========================================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center ${
            activeTab === 'home' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Home className="h-5 w-5 mb-0.5" />
          <span>{t.home}</span>
        </button>

        <button
          onClick={() => setActiveTab('listings')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center ${
            activeTab === 'listings' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Sprout className="h-5 w-5 mb-0.5" />
          <span>{t.myCrops}</span>
        </button>

        {/* Central Add Crop Button */}
        <button
          onClick={() => {
            setWizardStep(1);
            setShowAddWizard(true);
          }}
          className="flex flex-col items-center justify-center -mt-5 h-12 w-12 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold"
          title="फसल बेचें"
        >
          <Plus className="h-6 w-6" />
        </button>

        <button
          onClick={() => setActiveTab('buyers')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center ${
            activeTab === 'buyers' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Search className="h-5 w-5 mb-0.5" />
          <span>{t.findBuyers}</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center relative ${
            activeTab === 'orders' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Package className="h-5 w-5 mb-0.5" />
          <span>{t.myDeals}</span>
          {activeOrdersCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-600" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 5. STEP-BY-STEP ADD PRODUCE WIZARD MODAL (MERA MAAL BECHEIN) */}
      {/* ========================================================================= */}
      {showAddWizard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto border border-slate-100">
            
            {/* Wizard Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  कदम {wizardStep} / 6 (Step {wizardStep} of 6)
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  अपना माल बेचें (Apna Maal Bechein)
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddWizard(false);
                  setWizardStep(1);
                }}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(wizardStep / 6) * 100}%` }}
              />
            </div>

            {/* STEP 1: कौन सी फसल है? */}
            {wizardStep === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    कौन सी फसल बेचना चाहते हैं?
                  </h4>
                  <p className="text-xs text-slate-500">नीचे अपनी फसल चुनें:</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {standardCrops.map((c) => {
                    const isSelected = wizardForm.cropName === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setWizardForm({
                            ...wizardForm,
                            cropName: c.id,
                            variety: c.defaultVariety
                          });
                        }}
                        className={`p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 min-h-[95px] ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-3xl">{c.icon}</span>
                        <div className="text-xs font-black text-slate-900">
                          {c.nameHi} <span className="text-[10px] text-slate-500 block font-normal">({c.nameEn})</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Other Crop Option */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setWizardForm({ ...wizardForm, cropName: 'Other' })}
                    className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      wizardForm.cropName === 'Other'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    ➕ अन्य फसल (Other Crop)
                  </button>
                  {wizardForm.cropName === 'Other' && (
                    <input
                      type="text"
                      placeholder="फसल का नाम लिखें (e.g. सरसो / Mustard)"
                      value={wizardForm.customCropName}
                      onChange={(e) => setWizardForm({ ...wizardForm, customCropName: e.target.value })}
                      className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: आपके पास कितना माल है? */}
            {wizardStep === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आपके पास कितना माल है?
                  </h4>
                  <p className="text-xs text-slate-500">मात्रा और इकाई (Unit) बताएं:</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={wizardForm.quantityValue}
                      onChange={(e) => setWizardForm({ ...wizardForm, quantityValue: Math.max(1, Number(e.target.value)) })}
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 text-xl font-black text-slate-900 text-center bg-white"
                    />
                    <select
                      value={wizardForm.quantityUnit}
                      onChange={(e) => setWizardForm({ ...wizardForm, quantityUnit: e.target.value as any })}
                      className="px-3 py-3 rounded-xl border-2 border-slate-300 text-sm font-bold bg-white text-slate-800"
                    >
                      <option value="quintal">क्विंटल (Quintal)</option>
                      <option value="ton">टन (Tonne)</option>
                    </select>
                  </div>

                  {/* Quick Addition Chips */}
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-semibold">तुरंत जोड़ें:</span>
                    {[5, 10, 25, 50, 100].map((addVal) => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => setWizardForm({ ...wizardForm, quantityValue: wizardForm.quantityValue + addVal })}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        +{addVal}
                      </button>
                    ))}
                  </div>

                  <div className="text-center text-xs text-slate-500 pt-1">
                    {wizardForm.quantityUnit === 'quintal' 
                      ? `${wizardForm.quantityValue} क्विंटल = ${(wizardForm.quantityValue / 10).toFixed(1)} टन` 
                      : `${wizardForm.quantityValue} टन = ${wizardForm.quantityValue * 10} क्विंटल`}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: माल कब तैयार होगा? */}
            {wizardStep === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आपका माल कब तैयार होगा?
                  </h4>
                  <p className="text-xs text-slate-500">उठान के लिए उपयुक्त समय चुनें:</p>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'ready_now', labelHi: '🟢 अभी तैयार है (Ready Now)', desc: 'माल कट चुका है, तुरंत उठान चाहिए' },
                    { id: '1_week', labelHi: '🟡 1 हफ्ते में (In 1 Week)', desc: 'कटाई चल रही है, 7 दिन में तैयार' },
                    { id: '15_days', labelHi: '🟠 15 दिन में (In 15 Days)', desc: 'दो हफ्ते बाद उठान के लिए' },
                    { id: '1_month', labelHi: '🔵 1 महीने में (In 1 Month)', desc: 'खेत में खड़ी फसल का पहले से सौदा' },
                    { id: 'custom_date', labelHi: '📅 खुद तारीख चुनें (Pick Date)', desc: 'निश्चित तारीख' },
                  ].map((timing) => {
                    const isSelected = wizardForm.harvestTiming === timing.id;
                    return (
                      <div
                        key={timing.id}
                        onClick={() => setWizardForm({ ...wizardForm, harvestTiming: timing.id as any })}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-600 font-bold text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-sm">{timing.labelHi}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{timing.desc}</div>
                        </div>
                        <input
                          type="radio"
                          name="harvestTiming"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-emerald-600 h-4 w-4"
                        />
                      </div>
                    );
                  })}

                  {wizardForm.harvestTiming === 'custom_date' && (
                    <div className="pt-2">
                      <input
                        type="date"
                        value={wizardForm.availableDate}
                        onChange={(e) => setWizardForm({ ...wizardForm, availableDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: फसल की किस्म और गुणवत्ता */}
            {wizardStep === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    फसल की किस्म और गुणवत्ता
                  </h4>
                  <p className="text-xs text-slate-500">Variety और Quality बताएं:</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      फसल की किस्म (Variety):
                    </label>
                    <input
                      type="text"
                      value={wizardForm.variety}
                      onChange={(e) => setWizardForm({ ...wizardForm, variety: e.target.value })}
                      placeholder="उदा. Kufri Jyoti / Chipsona / Sharbati"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      फसल की गुणवत्ता (Quality):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { grade: 'Grade A', label: '🟢 अच्छी', sub: 'प्रीमियम / साफ' },
                        { grade: 'Grade B', label: '🟡 सामान्य', sub: 'स्टैंडर्ड' },
                        { grade: 'Grade C', label: '🔴 कम', sub: 'प्रोसेसिंग' }
                      ].map((q) => {
                        const isSelected = wizardForm.qualityGrade === q.grade;
                        return (
                          <button
                            key={q.grade}
                            type="button"
                            onClick={() => setWizardForm({ ...wizardForm, qualityGrade: q.grade })}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-sm font-black text-slate-900">{q.label}</div>
                            <div className="text-[10px] text-slate-500">{q.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Advanced Specs Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSpecs(!showAdvancedSpecs)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedSpecs ? 'rotate-180' : ''}`} />
                      <span>और जानकारी (साइज़, नमी - वैकल्पिक)</span>
                    </button>

                    {showAdvancedSpecs && (
                      <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">साइज़ मिन (mm):</label>
                          <input
                            type="number"
                            value={wizardForm.sizeMinMm}
                            onChange={(e) => setWizardForm({ ...wizardForm, sizeMinMm: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">साइज़ मैक्स (mm):</label>
                          <input
                            type="number"
                            value={wizardForm.sizeMaxMm}
                            onChange={(e) => setWizardForm({ ...wizardForm, sizeMaxMm: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: आपका माल कहाँ है? (Location) */}
            {wizardStep === 5 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आपका माल कहाँ रखा है?
                  </h4>
                  <p className="text-xs text-slate-500">गाड़ी पिकअप के लिए जगह बताएं:</p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">गाँव (Village):</label>
                      <input
                        type="text"
                        value={wizardForm.village}
                        onChange={(e) => setWizardForm({ ...wizardForm, village: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">तहसील (Tehsil):</label>
                      <input
                        type="text"
                        value={wizardForm.tehsil}
                        onChange={(e) => setWizardForm({ ...wizardForm, tehsil: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">जिला (District):</label>
                      <input
                        type="text"
                        value={wizardForm.district}
                        onChange={(e) => setWizardForm({ ...wizardForm, district: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWizardForm({
                        ...wizardForm,
                        village: 'Khandauli',
                        tehsil: 'Etmadpur',
                        district: 'Agra'
                      });
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span>मेरी प्रोफाइल की लोकेशन भरें (Use Profile Location)</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: उम्मीद की कीमत (Expected Price) & Confirmation */}
            {wizardStep === 6 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आप कितने रुपये में बेचना चाहते हैं?
                  </h4>
                  <p className="text-xs text-slate-500">आपकी उम्मीद की कीमत (Expected Rate):</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-black text-slate-700">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      value={wizardForm.expectedPricePerKg}
                      onChange={(e) => setWizardForm({ ...wizardForm, expectedPricePerKg: Number(e.target.value) })}
                      className="w-32 px-3 py-2.5 rounded-xl border-2 border-slate-300 text-2xl font-black text-emerald-700 text-center bg-white"
                    />
                    <span className="text-base font-bold text-slate-700">/ किलो</span>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                    💡 <strong>सलाह:</strong> यह आपकी उम्मीद की कीमत है। खरीदार इससे थोड़ा अलग ऑफर भी दे सकता है। अंतिम फैसला हमेशा आपका होगा।
                  </div>
                </div>

                {/* Final Summary Card before submission */}
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-2 text-xs">
                  <div className="font-extrabold text-emerald-950 text-sm border-b border-emerald-200 pb-1.5 flex justify-between">
                    <span>दर्ज होने वाली जानकारी:</span>
                    <span>✓ तैयार</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-emerald-900">
                    <div>फसल: <strong>{wizardForm.cropName === 'Other' ? wizardForm.customCropName : wizardForm.cropName} ({wizardForm.variety})</strong></div>
                    <div>मात्रा: <strong>{wizardForm.quantityValue} {wizardForm.quantityUnit === 'quintal' ? 'क्विंटल' : 'टन'}</strong></div>
                    <div>जगह: <strong>{wizardForm.village}, {wizardForm.district}</strong></div>
                    <div>उम्मीद भाव: <strong>₹{wizardForm.expectedPricePerKg}/kg</strong></div>
                  </div>
                </div>

                {wizardSuccessMessage && (
                  <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold text-center animate-bounce">
                    ✓ {wizardSuccessMessage}
                  </div>
                )}
              </div>
            )}

            {/* Wizard Navigation Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>पीछे (Back)</span>
                </button>
              ) : (
                <div />
              )}

              {wizardStep < 6 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep + 1)}
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs"
                >
                  <span>आगे बढ़ें (Next)</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleWizardSubmit}
                  className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5"
                >
                  <span>मेरा माल बाजार में डालें 🚀</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VOICE ASSISTANT DEMO MODAL */}
      {/* ========================================================================= */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
              🎤
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                जल्द आ रहा है (Coming Soon)
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                बोलकर बताएं (Voice Input)
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                भविष्य में आप सिर्फ बोल सकेंगे: <br />
                <strong className="text-slate-800">"मेरे पास 50 क्विंटल आलू है, ₹20 भाव चाहिए"</strong> <br />
                और KisanConnect आपकी फसल अपने आप दर्ज कर देगा।
              </p>
            </div>
            <button
              onClick={() => setShowVoiceModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              समझ गया (Close)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TRANSPARENT MATCH BREAKDOWN MODAL */}
      {/* ========================================================================= */}
      {selectedMatchExplanation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {selectedMatchExplanation.matchScore}% अनुकूलता का हिसाब
                </h3>
                <p className="text-xs text-slate-500">
                  यह खरीदार आपकी फसल के लिए क्यों सही है:
                </p>
              </div>
              <button 
                onClick={() => setSelectedMatchExplanation(null)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {selectedMatchExplanation.breakdown.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{item.factor}</span>
                    <span className="text-[10px] text-slate-400 ml-2">(अधिकतम {item.weight}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full rounded-full" 
                        style={{ width: `${(item.earned / item.weight) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-emerald-800 w-8 text-right">
                      {item.earned}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
              <span className="text-xs font-bold text-emerald-950 block">मुख्य कारण (Compatibility Reasons):</span>
              <ul className="text-xs text-emerald-900 space-y-0.5">
                {selectedMatchExplanation.reasons.map((r, i) => (
                  <li key={i}>✓ {r}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setSelectedMatchExplanation(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              बंद करें (Close)
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default FarmerDashboard;
