import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { 
  AggregationBatch, 
  BuyerRequirement, 
  FarmerListing, 
  SubscriptionPlan,
  Order,
  ProcurementPlan
} from '../types';
import { 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  TrendingUp, 
  Truck, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  MapPin, 
  DollarSign, 
  ArrowRight,
  Filter,
  Package,
  Calendar,
  Sparkles,
  Lock,
  ClipboardList,
  Target,
  ShoppingCart,
  Boxes,
  Warehouse,
  Check,
  X,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calculator,
  Info
} from 'lucide-react';

export const AggregatorDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();

  // Primary 6-Level Hierarchy Navigation Tabs:
  // 1. Buyer Demand
  // 2. Farmer Supply
  // 3. Procurement Plans
  // 4. Aggregation & Fulfillment
  // 5. Storage / Logistics
  // 6. Transactions
  const [activeTab, setActiveTab] = useState<'demand' | 'supply' | 'procurement' | 'aggregation' | 'logistics' | 'transactions'>('demand');

  // Core Data States
  const [buyerDemands, setBuyerDemands] = useState<any[]>([]);
  const [farmerSupply, setFarmerSupply] = useState<any[]>([]);
  const [procurementPlans, setProcurementPlans] = useState<ProcurementPlan[]>([]);
  const [batches, setBatches] = useState<AggregationBatch[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sentOffers, setSentOffers] = useState<any[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Guide and Economics Simulator UI states
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [showProfitCalculator, setShowProfitCalculator] = useState(false);

  // Profit calculator interactive inputs
  const [calcVolumeTons, setCalcVolumeTons] = useState(50);
  const [calcBuyerPrice, setCalcBuyerPrice] = useState(21.5);
  const [calcFarmerCost, setCalcFarmerCost] = useState(19.0);
  const [calcLogisticsCost, setCalcLogisticsCost] = useState(1.15);

  // Aggregator Make Offer to Bulk Buyer modal
  const [makeOfferModal, setMakeOfferModal] = useState<{
    isOpen: boolean;
    requirement: any | null;
    quantityTons: number;
    offeredPricePerKg: number;
    deliveryTerms: string;
    message: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    requirement: null,
    quantityTons: 30,
    offeredPricePerKg: 21.5,
    deliveryTerms: 'Buyer Warehouse Delivery (Consolidated Truckload)',
    message: 'हमारे पास ग्रेड-A गुणवत्ता का समेकित (aggregated) बैच तैयार है।',
    isSubmitting: false
  });

  // Filters
  const [cropFilter, setCropFilter] = useState('All');
  const [demandCropFilter, setDemandCropFilter] = useState('All');

  // Subscription modal
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-pro');
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Active Procurement Plan Builder (Draft)
  const [draftPlan, setDraftPlan] = useState<{
    targetReq: any | null;
    selectedFarmers: any[];
    notes: string;
  }>({
    targetReq: null,
    selectedFarmers: [],
    notes: ''
  });
  const [showPlanBuilderModal, setShowPlanBuilderModal] = useState(false);

  const profile = user?.aggregatorProfile;
  const isSubscribed = profile?.subscriptionStatus === 'ACTIVE';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [demandRes, supplyRes, planRes, batchRes, subPlanRes, ordRes, sentOffRes, incOffRes, dealRes] = await Promise.all([
        api.getAggregatorDemand().catch(() => []),
        api.getAggregatorSupply().catch(() => []),
        api.getProcurementPlans().catch(() => []),
        api.getBatches().catch(() => []),
        api.getSubscriptionPlans().catch(() => []),
        api.getOrders().catch(() => []),
        api.getSentOffers().catch(() => []),
        api.getIncomingOffers().catch(() => []),
        api.getDeals().catch(() => [])
      ]);

      setBuyerDemands(demandRes.demands || demandRes || []);
      setFarmerSupply(supplyRes.supply || supplyRes || []);
      setProcurementPlans(planRes || []);
      setBatches(batchRes || []);
      setPlans(subPlanRes || []);
      setOrders(ordRes || []);
      setSentOffers(sentOffRes || []);
      setIncomingOffers(incOffRes || []);
      setDeals(dealRes || []);
    } catch (err) {
      console.error('Error fetching aggregator data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSubscribe = async (planId: string) => {
    try {
      await api.subscribeAggregator({
        planId,
        billingCycle: selectedCycle,
        region: profile?.operatingRegion || 'Kushinagar Aggregation Hub, UP',
        crops: ['Potato', 'Onion', 'Tomato', 'Wheat', 'Maize']
      });
      alert('Subscription Activated! Payment simulated successfully.');
      setShowSubscriptionModal(false);
      await refreshUser();
      await fetchData();
    } catch (err) {
      alert('Subscription failed: ' + (err as Error).message);
    }
  };

  // Start Procurement Plan for a specific Buyer Demand
  const handleStartPlanForDemand = (req: any) => {
    // Pre-select compatible supply if available
    const compatibleSupply = farmerSupply.filter((s: any) => 
      s.cropName?.toLowerCase() === req.cropName?.toLowerCase()
    );

    setDraftPlan({
      targetReq: req,
      selectedFarmers: compatibleSupply.slice(0, 3), // default select top 3
      notes: `Procurement plan for ${req.buyerCompany || req.buyerName}`
    });
    setShowPlanBuilderModal(true);
  };

  // Add/Remove farmer from active draft plan
  const toggleFarmerInPlan = (supplyItem: any) => {
    const exists = draftPlan.selectedFarmers.some(f => f.listingId === supplyItem.listingId || f.id === supplyItem.id);
    if (exists) {
      setDraftPlan(prev => ({
        ...prev,
        selectedFarmers: prev.selectedFarmers.filter(f => (f.listingId || f.id) !== (supplyItem.listingId || supplyItem.id))
      }));
    } else {
      setDraftPlan(prev => ({
        ...prev,
        selectedFarmers: [...prev.selectedFarmers, supplyItem]
      }));
    }
  };

  // Save Procurement Plan
  const handleSaveProcurementPlan = async () => {
    if (!draftPlan.targetReq) {
      alert('Please select a target buyer demand requirement.');
      return;
    }
    if (draftPlan.selectedFarmers.length === 0) {
      alert('Please select at least one farmer lot to include in the plan.');
      return;
    }

    try {
      const payload = {
        buyerRequirementId: draftPlan.targetReq.id,
        buyerName: draftPlan.targetReq.buyerCompany || draftPlan.targetReq.buyerName,
        cropName: draftPlan.targetReq.cropName,
        variety: draftPlan.targetReq.variety,
        targetQuantityTons: Number(draftPlan.targetReq.quantityTons),
        buyerOfferedPricePerKg: Number(draftPlan.targetReq.offeredPricePerKg),
        notes: draftPlan.notes,
        selectedFarmers: draftPlan.selectedFarmers.map(f => ({
          listingId: f.listingId || f.id,
          farmerId: f.farmerId,
          farmerName: f.farmerName,
          quantityTons: Number(f.quantityTons),
          quantityKg: Number(f.quantityKg || f.quantityTons * 1000),
          pricePerKg: Number(f.pricePerKg || f.expectedPricePerKg),
          distanceKm: f.distanceKm,
          grade: f.grade,
          variety: f.variety,
          location: f.location || f.farmerLocation
        }))
      };

      await api.createProcurementPlan(payload);
      alert('Procurement Plan Created Successfully! You can now track fulfillment and create batches when ready.');
      setShowPlanBuilderModal(false);
      await fetchData();
      setActiveTab('procurement');
    } catch (err) {
      alert('Error creating procurement plan: ' + (err as Error).message);
    }
  };

  // Create batch or direct fulfillment from existing procurement plan
  const handleFulfillPlan = async (plan: ProcurementPlan) => {
    if (user?.status === 'pending') {
      alert('Account pending admin approval.');
      return;
    }
    if (!isSubscribed) {
      alert('Active subscription required to execute batches. Please activate a subscription.');
      setShowSubscriptionModal(true);
      return;
    }

    try {
      const res = await api.createBatchFromPlan(plan.id, {});
      alert(`Success: ${res.fulfillmentType === 'DIRECT_FULFILLMENT' ? 'Direct fulfillment confirmed (single farmer)!' : 'Aggregated batch created (multi-farmer pooling)!'}`);
      await fetchData();
      setActiveTab('aggregation');
    } catch (err) {
      alert('Error executing fulfillment: ' + (err as Error).message);
    }
  };

  // Draft Plan Economics Simulation
  const draftTotalTons = draftPlan.selectedFarmers.reduce((sum, f) => sum + Number(f.quantityTons || 0), 0);
  const draftTargetTons = Number(draftPlan.targetReq?.quantityTons || 100);
  const draftRemainingTons = Math.max(0, draftTargetTons - draftTotalTons);
  const draftBuyerPrice = Number(draftPlan.targetReq?.offeredPricePerKg || 20);
  
  const draftAvgFarmerCost = draftTotalTons > 0
    ? Number((draftPlan.selectedFarmers.reduce((sum, f) => sum + (Number(f.quantityTons) * Number(f.pricePerKg || f.expectedPricePerKg || 18.5)), 0) / draftTotalTons).toFixed(2))
    : 18.5;
  const draftEstLogistics = 1.15;
  const draftGrossMarginPerKg = Number((draftBuyerPrice - draftAvgFarmerCost - draftEstLogistics).toFixed(2));
  const draftTotalMargin = Math.round(draftGrossMarginPerKg * draftTotalTons * 1000);

  // Real-time margin calculator values
  const simTurnover = Math.round(calcVolumeTons * 1000 * calcBuyerPrice);
  const simFarmerPayout = Math.round(calcVolumeTons * 1000 * calcFarmerCost);
  const simLogisticsExpense = Math.round(calcVolumeTons * 1000 * calcLogisticsCost);
  const simGrossMarginPerKg = Number((calcBuyerPrice - calcFarmerCost - calcLogisticsCost).toFixed(2));
  const simNetProfit = Math.round(simGrossMarginPerKg * calcVolumeTons * 1000);

  // Make Offer to Bulk Buyer handlers
  const handleOpenMakeOffer = (req: any) => {
    setMakeOfferModal({
      isOpen: true,
      requirement: req,
      quantityTons: Number(req.quantityTons || 30),
      offeredPricePerKg: Number(req.offeredPricePerKg || 21.5),
      deliveryTerms: 'Buyer Warehouse Delivery (Consolidated Truckload)',
      message: `नमस्ते, हम ${profile?.businessName || user?.name || 'कुशीनगर एग्रीगेटर हब'} से ${req.cropName} का उच्च गुणवत्ता वाला समेकित (aggregated) बैच आपूर्ति करने का प्रस्ताव देते हैं।`,
      isSubmitting: false
    });
  };

  const handleSendOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!makeOfferModal.requirement) return;
    setMakeOfferModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.createOffer({
        requirementId: makeOfferModal.requirement.id,
        buyerId: makeOfferModal.requirement.buyerId,
        buyerName: makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName,
        sellerId: user?.id,
        sellerName: profile?.businessName || user?.name || 'Kushinagar Aggregation Hub',
        cropName: makeOfferModal.requirement.cropName,
        variety: makeOfferModal.requirement.variety,
        quantityTons: makeOfferModal.quantityTons,
        offeredPricePerKg: makeOfferModal.offeredPricePerKg,
        deliveryTerms: makeOfferModal.deliveryTerms,
        message: makeOfferModal.message
      });
      alert(`Bulk offer sent successfully to ${makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName}!`);
      setMakeOfferModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
      setActiveTab('transactions');
    } catch (err) {
      alert('Failed to send offer: ' + (err as Error).message);
    } finally {
      setMakeOfferModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleAcceptFarmerOffer = async (offerId: string) => {
    if (!confirm('क्या आप किसान का यह सौदा स्वीकार करना चाहते हैं? इससे आर्डर दर्ज हो जाएगा।')) return;
    try {
      await api.acceptOffer(offerId);
      alert('सौदा स्वीकार कर लिया गया! आर्डर सफलतापूर्वक दर्ज हुआ।');
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleRejectFarmerOffer = async (offerId: string) => {
    const reason = prompt('अस्वीकार करने का कारण लिखें:') || 'गुणवत्ता या मूल्य असहमति';
    try {
      await api.rejectOffer(offerId, reason);
      alert('सौदा प्रस्ताव अस्वीकार कर दिया गया।');
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Aggregator Profile & Subscription */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-2xl border border-amber-200">
            🌾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">
                {profile?.businessName || user?.name || 'Kushinagar Farmers Cooperative'}
              </h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                isSubscribed
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200'
              }`}>
                {isSubscribed ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Lock className="h-3 w-3 text-rose-600" />}
                {isSubscribed ? `ACTIVE (${profile?.subscribedPlanId?.replace('plan-', '').toUpperCase() || 'PRO'})` : 'UNSUBSCRIBED'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Role: <strong>Local Procurement & Supply Coordination</strong> • Zone: <strong>{user?.location || 'Kushinagar, UP'} (0–50 km radius)</strong> • Capacity: <strong>{profile?.maxAggregationCapacityTons || 500}T</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSubscriptionModal(true)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSubscribed
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>{isSubscribed ? 'Manage Subscription' : 'Upgrade Plan'}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">Buyer Demands Near You</span>
          <div className="text-2xl font-black text-purple-700 mt-1">{buyerDemands.length}</div>
          <span className="text-[10px] text-slate-500">Commercial & Local requirements</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">Available Farmer Supply</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {farmerSupply.reduce((sum, s) => sum + Number(s.quantityTons || 0), 0)} Tonnes
          </div>
          <span className="text-[10px] text-slate-500">{farmerSupply.length} farmer lots within radius</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">Procurement Plans</span>
          <div className="text-2xl font-black text-amber-700 mt-1">{procurementPlans.length}</div>
          <span className="text-[10px] text-slate-500">Active coordination plans</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">Active Batches</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{batches.length}</div>
          <span className="text-[10px] text-slate-500">Pooled lots in fulfillment</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 💡 ARCHITECTURAL GUIDE: HOW AGGREGATOR WORKS IN KISANOS */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50/50 rounded-3xl border-2 border-amber-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-lg shadow-xs">
              💡
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>KisanOS Aggregator Architecture</span>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  ग्रामीण संग्राहक मॉडल
                </span>
              </h3>
              <p className="text-xs text-slate-600">
                बिना खेत की जमीन के 30–60 टन के कॉर्पोरेट आर्डर पूरे करें और प्रति ट्रक ₹60,000–₹90,000 शुद्ध मुनाफा कमाएं।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfitCalculator(!showProfitCalculator)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border ${
                showProfitCalculator 
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                  : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>{showProfitCalculator ? 'कैलकुलेटर छिपाएं' : 'मुनाफा कैलकुलेटर'}</span>
            </button>

            <button
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-amber-100/60 transition-colors cursor-pointer"
              title="Toggle Guide"
            >
              {showHowItWorks ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* 4 Architectural Steps */}
        {showHowItWorks && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 animate-fadeIn">
            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">चरण 1</span>
                <span className="text-xl">👨‍🌾</span>
              </div>
              <h4 className="text-xs font-black text-slate-900">छोटे किसानों की समस्या</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                86% किसानों के पास केवल 2 से 10 टन उपज होती है। बड़ी औद्योगिक इकाइयां (चिप्स, फूड प्रोसेसिंग) कम से कम 30–60 टन का पूरा ट्रक ही लेती हैं।
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">चरण 2</span>
                <span className="text-xl">🤝</span>
              </div>
              <h4 className="text-xs font-black text-slate-900">संग्राहक (FPO / Hub)</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                आप अपने 50 किमी दायरे में 5–8 किसानों के छोटे लॉट जोड़ते हैं, गुणवत्ता व नमी जांचते हैं और एक संगठित 60 टन का बैच तैयार करते हैं।
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">चरण 3</span>
                <span className="text-xl">🚚</span>
              </div>
              <h4 className="text-xs font-black text-slate-900">समेकित उठान व कोल्ड स्टोरेज</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                एक ही बड़े ट्रक द्वारा गाँव-गाँव से फार्म-गेट उठान कराएं या रीजनल कोल्ड स्टोरेज का सहारा लें, जिससे प्रति किलो ढुलाई लागत ₹1.15 पर सिमट जाती है।
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-2 bg-gradient-to-b from-white to-emerald-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">चरण 4: मुनाफा</span>
                <span className="text-xl">💰</span>
              </div>
              <h4 className="text-xs font-black text-slate-900">पारदर्शी मार्जिन मॉडल</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                कंपनी से ₹21.50/किग्रा लें, किसान को ₹19.00 दें (मंडी भाव से ₹2 अधिक), ढुलाई ₹1.15 दें। <strong>शुद्ध मार्जिन ₹1.35/किग्रा (60 टन = ₹81,000 बचत)</strong>!
              </p>
            </div>
          </div>
        )}

        {/* 📊 INTERACTIVE LIVE MARGIN SIMULATOR */}
        {showProfitCalculator && (
          <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 shadow-xs space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-amber-600" />
                  <span>लाइव एग्रीगेटर मुनाफा सिम्युलेटर (Live Margin Calculator)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  मात्रा और भाव बदलकर देखें कि समेकन (aggregation) से प्रति बैच कितनी कमाई होगी।
                </p>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                मार्जिन: ₹{simGrossMarginPerKg}/किग्रा
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600">बैच मात्रा (Volume):</span>
                  <span className="font-black text-amber-800">{calcVolumeTons} टन</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={calcVolumeTons}
                  onChange={(e) => setCalcVolumeTons(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">{calcVolumeTons * 10} क्विंटल ({calcVolumeTons * 1000} किग्रा)</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600">खरीदार भाव (Buyer Price):</span>
                  <span className="font-black text-purple-700">₹{calcBuyerPrice.toFixed(2)}/किग्रा</span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="35"
                  step="0.5"
                  value={calcBuyerPrice}
                  onChange={(e) => setCalcBuyerPrice(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">थोक कंपनी से मिलने वाला भाव</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600">किसान खरीद दर (Farmer Cost):</span>
                  <span className="font-black text-emerald-700">₹{calcFarmerCost.toFixed(2)}/किग्रा</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="30"
                  step="0.5"
                  value={calcFarmerCost}
                  onChange={(e) => setCalcFarmerCost(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">खेत से सीधा किसान को भुगतान</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600">ढुलाई लागत (Logistics):</span>
                  <span className="font-black text-slate-700">₹{calcLogisticsCost.toFixed(2)}/किग्रा</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.05"
                  value={calcLogisticsCost}
                  onChange={(e) => setCalcLogisticsCost(Number(e.target.value))}
                  className="w-full accent-slate-600 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">ट्रक किराया + लोडिंग/अनलोडिंग</span>
              </div>
            </div>

            {/* Calculated Results Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 block">कुल टर्नओवर (Revenue)</span>
                <span className="text-base font-black text-slate-900">₹{simTurnover.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 block">किसानों को भुगतान (Farmer Payout)</span>
                <span className="text-base font-black text-emerald-800">₹{simFarmerPayout.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 block">लॉजिस्टिक्स व्यय (Transit Cost)</span>
                <span className="text-base font-black text-blue-800">₹{simLogisticsExpense.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-amber-500 text-white p-3 rounded-xl shadow-xs">
                <span className="text-[10px] font-black uppercase text-amber-100 block">एग्रीगेटर शुद्ध मुनाफा (Net Profit)</span>
                <span className="text-lg font-black text-white">₹{simNetProfit.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6-TIER HIERARCHY NAVIGATION TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-1 text-xs font-bold shadow-xs">
        {[
          { id: 'demand', label: '1. Buyer Demand', icon: Target },
          { id: 'supply', label: '2. Farmer Supply', icon: Users },
          { id: 'procurement', label: '3. Procurement Plans', icon: ClipboardList },
          { id: 'aggregation', label: '4. Aggregation & Fulfillment', icon: Layers },
          { id: 'logistics', label: '5. Storage & Logistics', icon: Warehouse },
          { id: 'transactions', label: '6. Transactions', icon: DollarSign }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 🎯 TAB 1: BUYER DEMAND NEAR YOU */}
      {/* ========================================================================= */}
      {activeTab === 'demand' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Buyer Demand Near You</span>
                <span className="text-xs bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded-full">
                  Commercial Orders
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Work on large buyer contracts even when you personally own zero produce. Procure and aggregate local farmer supply.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter Crop:</span>
              <select
                value={demandCropFilter}
                onChange={(e) => setDemandCropFilter(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl outline-none"
              >
                <option value="All">All Crops</option>
                <option value="Potato">Potato</option>
                <option value="Tomato">Tomato</option>
                <option value="Wheat">Wheat</option>
                <option value="Onion">Onion</option>
              </select>
            </div>
          </div>

          {buyerDemands.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 text-slate-400">
              <Target className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No active buyer demand contracts</p>
              <p className="text-xs text-slate-500 mt-1">Check back shortly or invite buyers to post demand.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {buyerDemands
                .filter(d => demandCropFilter === 'All' || d.cropName?.toLowerCase() === demandCropFilter.toLowerCase())
                .map((req) => {
                  const bType = req.buyerType || (req.quantityTons >= 20 ? 'bulk' : 'local');
                  const availSupply = Number(req.availableSupplyTons || 62);
                  const reqTons = Number(req.quantityTons);
                  const remainingTons = Math.max(0, reqTons - availSupply);
                  const minDirectLot = Number(req.minimumDirectFarmerLotKg || (bType === 'bulk' ? 20000 : 250)) / 1000;

                  return (
                    <div
                      key={req.id}
                      className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                bType === 'bulk' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
                              }`}>
                                {bType === 'bulk' ? 'BULK DEMAND' : 'LOCAL DEMAND'}
                              </span>
                              {req.aggregationAllowed && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                                  Aggregation Allowed
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-black text-slate-900 mt-1">
                              {req.buyerCompany || req.buyerName}
                            </h3>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>{req.location}</span>
                              <strong className="text-slate-700">• {req.distanceKm ?? 41} km</strong>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-black text-emerald-700">
                              ₹{Number(req.offeredPricePerKg).toFixed(2)}/kg
                            </span>
                            <span className="text-[10px] text-slate-400 block">Indicative Price</span>
                          </div>
                        </div>

                        {/* Specs Grid */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Commodity:</span>
                            <span className="font-extrabold text-slate-800">{req.cropName} ({req.variety || 'Kufri Jyoti'})</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Quality Required:</span>
                            <span className="font-extrabold text-slate-800">{req.gradeRequired || 'Grade A'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Contract Demand:</span>
                            <span className="font-extrabold text-purple-700">{reqTons} Tonnes</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Min Direct Lot:</span>
                            <span className="font-extrabold text-slate-800">{minDirectLot} Tonnes</span>
                          </div>
                        </div>

                        {/* Supply Progress */}
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600">
                              Current Available Supply: <strong>{availSupply} Ton</strong>
                            </span>
                            <span className="font-black text-amber-700">
                              Remaining: <strong>{remainingTons} Ton</strong>
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 rounded-full" 
                              style={{ width: `${Math.min(100, Math.round((availSupply / reqTons) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setCropFilter(req.cropName);
                            setActiveTab('supply');
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Find Farmer Supply →
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenMakeOffer(req)}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>सौदा भेजें (Make Offer)</span>
                          </button>

                          <button
                            onClick={() => handleStartPlanForDemand(req)}
                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Build Plan</span>
                          </button>
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
      {/* 🌾 TAB 2: FARMER SUPPLY IN SERVICE RADIUS */}
      {/* ========================================================================= */}
      {activeTab === 'supply' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Farmer Supply in Operating Radius</span>
                <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                  {farmerSupply.length} Local Lots Available
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified farm produce lots within {profile?.serviceRadiusKm || 50} km. Adding a farmer creates a procurement selection (not an immediate batch).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter Crop:</span>
              <select
                value={cropFilter}
                onChange={(e) => setCropFilter(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl outline-none"
              >
                <option value="All">All Crops</option>
                <option value="Potato">Potato</option>
                <option value="Tomato">Tomato</option>
                <option value="Wheat">Wheat</option>
                <option value="Onion">Onion</option>
              </select>
            </div>
          </div>

          {farmerSupply.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 text-slate-400">
              <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No farmer supply listed in radius</p>
              <p className="text-xs text-slate-500 mt-1">Farmers in your region will appear here as they register crop listings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {farmerSupply
                .filter(s => cropFilter === 'All' || s.cropName?.toLowerCase() === cropFilter.toLowerCase())
                .map((supplyItem) => {
                  const qty = Number(supplyItem.quantityTons);
                  const price = Number(supplyItem.expectedPricePerKg || supplyItem.pricePerKg);
                  const dist = supplyItem.distanceKm ?? 12;

                  return (
                    <div
                      key={supplyItem.listingId || supplyItem.id}
                      className="bg-white rounded-2xl border-2 border-slate-200 p-4 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              {supplyItem.cropName} ({supplyItem.variety})
                            </span>
                            <h4 className="text-sm font-black text-slate-900 mt-1">
                              {supplyItem.farmerName}
                            </h4>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>{supplyItem.location || 'Kushinagar'}</span>
                              <strong className="text-slate-700">• {dist} km away</strong>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-black text-slate-900">
                              {qty} Ton
                            </span>
                            <span className="text-[10px] text-slate-400 block">{qty * 10} क्विंटल</span>
                          </div>
                        </div>

                        {/* Price & Quality Details */}
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Grade:</span>
                            <span className="font-extrabold text-slate-800">{supplyItem.grade || 'Grade A'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Expected Price:</span>
                            <span className="font-black text-emerald-700">₹{price.toFixed(2)}/kg</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          Total Value: <strong>₹{(qty * 1000 * price).toLocaleString('en-IN')}</strong>
                        </span>

                        <button
                          onClick={() => {
                            if (!draftPlan.targetReq && buyerDemands.length > 0) {
                              setDraftPlan(prev => ({ ...prev, targetReq: buyerDemands[0] }));
                            }
                            toggleFarmerInPlan(supplyItem);
                            setShowPlanBuilderModal(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add to Procurement Plan</span>
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
      {/* 📋 TAB 3: PROCUREMENT PLANS */}
      {/* ========================================================================= */}
      {activeTab === 'procurement' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Procurement Plans</span>
                <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  Supply Coordination
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize farmer supply selections against verified buyer demand. Economics are indicative and transparent.
              </p>
            </div>

            <button
              onClick={() => {
                if (buyerDemands.length > 0) {
                  setDraftPlan({
                    targetReq: buyerDemands[0],
                    selectedFarmers: farmerSupply.slice(0, 3),
                    notes: ''
                  });
                }
                setShowPlanBuilderModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Procurement Plan</span>
            </button>
          </div>

          {procurementPlans.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 text-slate-400">
              <ClipboardList className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No procurement plans created yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Select buyer demand from Tab 1 or click "New Procurement Plan" to draft a supply coordination plan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {procurementPlans.map((plan) => {
                const totalProc = Number(plan.totalProcuredTons);
                const targetTons = Number(plan.targetQuantityTons);
                const remTons = Math.max(0, targetTons - totalProc);
                const pct = Math.min(100, Math.round((totalProc / targetTons) * 100));

                return (
                  <div
                    key={plan.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs space-y-4 hover:border-amber-400 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{plan.buyerName}</span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            plan.status === 'BATCH_CREATED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {plan.status}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 mt-0.5 block">
                          Target: <strong>{targetTons} Ton {plan.cropName} ({plan.variety || 'Standard'})</strong> • Procured: <strong>{totalProc} Ton ({plan.selectedFarmers?.length || 0} farmers)</strong>
                        </span>
                      </div>

                      {/* Economics Strip (Labelled: ESTIMATED / INDICATIVE) */}
                      <div className="bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200/80 text-right">
                        <span className="text-[9px] font-black tracking-wider uppercase text-amber-900 block">
                          ESTIMATED GROSS MARGIN
                        </span>
                        <div className="text-sm font-black text-amber-900">
                          ₹{Number(plan.estimatedGrossMarginPerKg || 0.36).toFixed(2)}/kg
                          <span className="text-xs font-semibold text-slate-600 ml-1.5">
                            (Est: ₹{Number(plan.estimatedGrossMarginTotal || 12600).toLocaleString('en-IN')})
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 block">
                          Buyer ₹{plan.buyerOfferedPricePerKg} - (Procure ₹{plan.avgFarmerPricePerKg} + Log ₹{plan.estimatedLogisticsCostPerKg})
                        </span>
                        <span className="text-[8px] text-amber-700 font-bold tracking-wide">
                          * ESTIMATED • INDICATIVE • SUBJECT TO FINAL TERMS
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">
                          Fulfillment Progress: <strong>{totalProc} / {targetTons} Tonnes</strong>
                        </span>
                        <span className="font-black text-amber-700">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Participating Farmer Lots */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Selected Farmer Lots ({plan.selectedFarmers?.length || 0}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {plan.selectedFarmers?.map((f, fIdx) => (
                          <div key={fIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-black text-slate-900 block">{f.farmerName}</span>
                              <span className="text-[10px] text-slate-500">{f.grade || 'Grade A'} • {f.distanceKm ? `${f.distanceKm} km` : 'Local'}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-emerald-700 block">{f.quantityTons}T</span>
                              <span className="text-[10px] text-slate-500">@ ₹{f.pricePerKg}/kg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions: Direct Procurement vs Aggregated Batch */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        {plan.selectedFarmers?.length === 1 
                          ? '1 Farmer satisfies selection → Single direct fulfillment'
                          : `${plan.selectedFarmers?.length} Farmers pooled → Aggregation batch consolidation`}
                      </span>

                      {plan.status !== 'BATCH_CREATED' && (
                        <button
                          onClick={() => handleFulfillPlan(plan)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Boxes className="h-4 w-4" />
                          <span>
                            {plan.selectedFarmers?.length === 1 ? 'Execute Direct Procurement' : 'Create Aggregated Batch'}
                          </span>
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
      {/* 📦 TAB 4: AGGREGATION & FULFILLMENT */}
      {/* ========================================================================= */}
      {activeTab === 'aggregation' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>Aggregation & Fulfillment</span>
              <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                Batch Execution
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active consolidated lots dispatched toward bulk buyers with multi-stop transport coordination.
            </p>
          </div>

          {batches.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 text-slate-400">
              <Layers className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No active batches in progress</p>
              <p className="text-xs text-slate-500 mt-1">
                Batches are created when multi-farmer procurement plans are committed. Pooling is optional.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {batches.map((batch) => {
                const progress = Math.min(100, Math.round((batch.currentAggregatedTons / batch.targetQuantityTons) * 100));
                const isReady = batch.currentAggregatedTons >= batch.targetQuantityTons;

                return (
                  <div
                    key={batch.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs space-y-4 hover:border-amber-400 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{batch.buyerName}</span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isReady ? '✓ READY TO FULFILL' : 'GATHERING SUPPLY'}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 mt-0.5 block">
                          Commodity: <strong>{batch.cropName} ({batch.variety})</strong> • Target: {batch.targetQuantityTons} Tonnes
                        </span>
                      </div>

                      <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/80 text-right">
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-900 block">
                          ESTIMATED GROSS MARGIN
                        </span>
                        <div className="text-sm font-black text-amber-900">
                          ₹{batch.estimatedGrossMarginPerKg.toFixed(2)}<span className="text-xs font-normal text-slate-600">/kg</span>
                        </div>
                        <span className="text-[9px] text-slate-500">
                          Buyer ₹{batch.buyerSalePricePerKg} - (Cost ₹{batch.farmerPurchasePriceAvg} + Log ₹{batch.estimatedLogisticsCostPerKg})
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">
                          Aggregated Progress: <strong>{batch.currentAggregatedTons} / {batch.targetQuantityTons} Tonnes</strong>
                        </span>
                        <span className="font-black text-amber-700">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Farmers Sourced */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Participating Farmers Sourced ({batch.farmers?.length || 0}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {batch.farmers?.map((f, i) => (
                          <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-black text-slate-800 block">{f.farmerName}</span>
                              <span className="text-[10px] text-slate-400">{f.farmerLocation}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-emerald-700 block">{f.quantityTons}T</span>
                              <span className="text-[10px] text-slate-500">@ ₹{f.purchasePricePerKg}/kg</span>
                            </div>
                          </div>
                        ))}
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
      {/* 🚚 TAB 5: STORAGE & LOGISTICS */}
      {/* ========================================================================= */}
      {activeTab === 'logistics' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-lg font-black text-slate-900">Cold Storage & Transport Infrastructure</h2>
            <p className="text-xs text-slate-500">Supporting logistics facilities for temporary aggregation holding and bulk dispatch.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
                  <Warehouse className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">Kushinagar Regional Cold Storage</h4>
                  <span className="text-xs text-slate-500">Temperature: 2°C–4°C • Capacity: 2500 Ton</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Utilize cold storage holding buffers for non-immediate bulk dispatch. Supported crops: Potato, Tomato, Onion.
              </p>
              <div className="text-xs font-bold text-blue-700">
                Rate: ₹0.45 / kg / month • Available space: 840 Ton
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">Consolidated Transport Fleets</h4>
                  <span className="text-xs text-slate-500">Multi-stop collection trucks: 10T, 16T, 25T</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Optimized route pickup minimizes transit cost from smallholder cluster stops into direct buyer delivery hubs.
              </p>
              <div className="text-xs font-bold text-emerald-700">
                Average transport cost: ₹1.15 / kg within 50 km radius
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💰 TAB 6: TRANSACTIONS & MARKETPLACE DEALS */}
      {/* ========================================================================= */}
      {activeTab === 'transactions' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-lg font-black text-slate-900">Transactions & Marketplace Lifecycle</h2>
            <p className="text-xs text-slate-500">
              Track incoming farmer pooling requests, outgoing bulk offers to companies, and confirmed escrow orders.
            </p>
          </div>

          {/* SECTION 1: INCOMING FARMER POOLING REQUESTS */}
          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                  👨‍🌾
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    किसानों से प्राप्त पूलिंग अनुरोध (Incoming Farmer Pooling Offers)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    स्थानीय किसानों द्वारा आपके एग्रीगेटर हब को भेजे गए आपूर्ति प्रस्ताव।
                  </p>
                </div>
              </div>
              <span className="text-xs font-black bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full">
                {incomingOffers.length} अनुरोध
              </span>
            </div>

            {incomingOffers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                <p className="font-bold text-slate-600">कोई नया किसान पूलिंग अनुरोध नहीं है</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  जब किसान "Join Batch" पर क्लिक करके सौदा भेजेंगे, वे यहाँ दिखाई देंगे।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingOffers.map((offer) => {
                  const isActionable = offer.status === 'OFFER_MADE' || offer.status === 'COUNTERED';
                  return (
                    <div
                      key={offer.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">{offer.sellerName}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            offer.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : offer.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {offer.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          फसल: <strong>{offer.cropName} ({offer.variety || 'Standard'})</strong> • मात्रा: <strong>{offer.quantityTons} टन</strong> ({offer.quantityTons * 10} क्विंटल)
                        </div>
                        <div className="text-xs text-emerald-700 font-bold mt-0.5">
                          प्रस्तावित भाव: ₹{Number(offer.offeredPricePerKg).toFixed(2)}/किग्रा • डिलीवरी: {offer.deliveryTerms || 'खेत से उठान'}
                        </div>
                        {offer.message && (
                          <p className="text-[11px] text-slate-500 italic mt-1">"{offer.message}"</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isActionable && (
                          <>
                            <button
                              onClick={() => handleAcceptFarmerOffer(offer.id)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              स्वीकार करें (Accept)
                            </button>
                            <button
                              onClick={() => handleRejectFarmerOffer(offer.id)}
                              className="px-3 py-2 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                            >
                              अस्वीकार
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: SENT BULK OFFERS TO CORPORATE BUYERS */}
          <div className="bg-white rounded-2xl border-2 border-purple-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-100 text-purple-800 font-bold text-xs">
                  🏢
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    थोक खरीदारों को भेजे गए सौदे (Sent Bulk Offers to Buyers)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    बड़ी कंपनियों (FreshBites, Balaji आदि) को सीधे भेजे गए समेकित प्रस्ताव।
                  </p>
                </div>
              </div>
              <span className="text-xs font-black bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full">
                {sentOffers.length} प्रेषित
              </span>
            </div>

            {sentOffers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                <p className="font-bold text-slate-600">कोई प्रेषित सौदा नहीं है</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  टैब 1 (Buyer Demand) में किसी भी मांग पर "सौदा भेजें (Make Offer)" दबाकर बल्क ऑफर भेजें।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{offer.buyerName}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          offer.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : offer.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {offer.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        फसल: <strong>{offer.cropName} ({offer.variety})</strong> • मात्रा: <strong>{offer.quantityTons} टन</strong> • भाव: <strong>₹{offer.offeredPricePerKg}/किग्रा</strong>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        शर्तें: {offer.deliveryTerms || 'वेयरहाउस डिलीवरी'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-purple-800">
                        ₹{(Number(offer.quantityTons) * 1000 * Number(offer.offeredPricePerKg)).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block">कुल सौदा मूल्य</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: CONFIRMED DEALS & ESCROW ORDERS */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                पुष्ट आर्डर व सौदे (Confirmed Deals & Escrow Orders)
              </h3>
              <span className="text-xs font-bold text-slate-500">{orders.length} आर्डर</span>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                <DollarSign className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                <p className="font-bold text-slate-600">कोई पुष्ट आर्डर नहीं है</p>
                <p className="text-[11px] text-slate-400 mt-0.5">सौदा स्वीकार होते ही आर्डर यहाँ दर्ज हो जाएगा।</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((ord) => (
                  <div key={ord.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900">{ord.orderNumber}</span>
                      <h4 className="font-black text-slate-900 text-sm">{ord.cropName} ({ord.variety}) • {ord.quantityTons}T</h4>
                      <span className="text-xs text-slate-500">पार्टी: {ord.buyerName || ord.sellerName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-700">₹{Number(ord.totalAmount).toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">{ord.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📝 DRAFT PROCUREMENT PLAN BUILDER MODAL */}
      {/* ========================================================================= */}
      {showPlanBuilderModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>📋 Draft Procurement Plan</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    Supply Coordination
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Select and allocate compatible farmer supply lots toward buyer demand contract.
                </p>
              </div>
              <button 
                onClick={() => setShowPlanBuilderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Target Buyer Demand Selector */}
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 block">Target Buyer Demand Requirement:</label>
              <select
                value={draftPlan.targetReq?.id || ''}
                onChange={(e) => {
                  const req = buyerDemands.find(d => d.id === e.target.value);
                  if (req) {
                    setDraftPlan(prev => ({
                      ...prev,
                      targetReq: req,
                      notes: `Procurement plan for ${req.buyerCompany || req.buyerName}`
                    }));
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
              >
                {buyerDemands.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.buyerCompany || d.buyerName} — {d.quantityTons}T {d.cropName} ({d.variety}) @ ₹{d.offeredPricePerKg}/kg
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Farmers Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Select Compatible Farmer Supply Lots ({farmerSupply.length} available):
                </span>
                <span className="font-black text-emerald-700">
                  Selected: {draftTotalTons} / {draftTargetTons} Ton
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {farmerSupply
                  .filter(s => !draftPlan.targetReq || s.cropName?.toLowerCase() === draftPlan.targetReq.cropName?.toLowerCase())
                  .map((s) => {
                    const isChecked = draftPlan.selectedFarmers.some(f => (f.listingId || f.id) === (s.listingId || s.id));
                    return (
                      <div
                        key={s.listingId || s.id}
                        onClick={() => toggleFarmerInPlan(s)}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => {}} 
                            className="rounded text-emerald-600 cursor-pointer"
                          />
                          <div>
                            <span className="font-black block">{s.farmerName}</span>
                            <span className="text-[10px] text-slate-500">{s.grade || 'Grade A'} • {s.distanceKm ?? 12} km away • {s.location || 'Local'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-800 block">{s.quantityTons} Ton</span>
                          <span className="text-[10px] text-slate-500">@ ₹{s.expectedPricePerKg || s.pricePerKg}/kg</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Transparent Indicative Economics Box */}
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-2 text-xs text-amber-950">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                <span className="font-black uppercase tracking-wider text-[11px] text-amber-900">
                  Economics Simulation (Indicative)
                </span>
                <span className="text-[10px] font-bold text-amber-800">
                  Target: {draftTargetTons}T | Selected: {draftTotalTons}T | Remaining: {draftRemainingTons}T
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Indicative Buyer Price:</span>
                  <span className="font-black text-slate-900">₹{draftBuyerPrice.toFixed(2)}/kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Weighted Farmer Cost:</span>
                  <span className="font-black text-slate-900">₹{draftAvgFarmerCost.toFixed(2)}/kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Estimated Logistics:</span>
                  <span className="font-black text-slate-900">₹{draftEstLogistics.toFixed(2)}/kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Estimated Gross Margin:</span>
                  <span className="font-black text-emerald-700">₹{draftGrossMarginPerKg.toFixed(2)}/kg</span>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/60 flex justify-between items-center text-xs">
                <span className="font-extrabold text-amber-900">
                  Estimated Gross Profit on Selected Volume:
                </span>
                <span className="text-base font-black text-emerald-700">
                  ₹{draftTotalMargin.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="text-[10px] text-amber-800 italic pt-1">
                * All economics are ESTIMATED and INDICATIVE, SUBJECT TO FINAL TERMS. No guaranteed profit claims.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPlanBuilderModal(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProcurementPlan}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs cursor-pointer"
              >
                Save Procurement Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Aggregator Subscription Plans</h3>
                <p className="text-xs text-slate-500">Enable multi-farmer lot pooling and bulk contract execution.</p>
              </div>
              <button onClick={() => setShowSubscriptionModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {plans.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    selectedPlanId === p.id ? 'border-amber-500 bg-amber-50/60' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{p.name}</h4>
                    <p className="text-xs text-slate-500">{p.description || 'Access full bulk demand and pooling tools.'}</p>
                    <span className="text-[10px] text-amber-800 font-bold mt-1 block">
                      Max Capacity: {p.maxAggregationCapacityTons} Tons
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900">₹{p.pricePerMonth}</span>
                    <span className="text-[10px] text-slate-400 block">/ month</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleSubscribe(selectedPlanId)}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Activate Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🚀 AGGREGATOR TO BULK BUYER MAKE OFFER MODAL */}
      {/* ========================================================================= */}
      {makeOfferModal.isOpen && makeOfferModal.requirement && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>🏢 थोक खरीदार को सौदा प्रस्ताव (Send Bulk Offer)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  खरीदार: <strong>{makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName}</strong>
                </p>
              </div>
              <button
                onClick={() => setMakeOfferModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendOfferSubmit} className="space-y-4 text-xs">
              <div className="bg-purple-50 rounded-2xl p-3 border border-purple-100 text-xs text-purple-900 space-y-1">
                <div className="font-bold">मांग विवरण:</div>
                <div className="flex justify-between">
                  <span>फसल:</span>
                  <span className="font-black">{makeOfferModal.requirement.cropName} ({makeOfferModal.requirement.variety || 'Grade A'})</span>
                </div>
                <div className="flex justify-between">
                  <span>कंपनी की मांग:</span>
                  <span className="font-black">{makeOfferModal.requirement.quantityTons} टन (संकेतक भाव: ₹{makeOfferModal.requirement.offeredPricePerKg}/किग्रा)</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ऑफर की जाने वाली मात्रा (टन में / Tons):
                </label>
                <input
                  type="number"
                  min="5"
                  step="1"
                  value={makeOfferModal.quantityTons}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, quantityTons: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 outline-none"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  = {Math.round(makeOfferModal.quantityTons * 10)} क्विंटल ({makeOfferModal.quantityTons * 1000} किग्रा)
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  प्रस्तावित भाव (₹ प्रति किलो / ₹ per kg):
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.25"
                  value={makeOfferModal.offeredPricePerKg}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, offeredPricePerKg: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 outline-none"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  = ₹{Math.round(makeOfferModal.offeredPricePerKg * 100)} / क्विंटल
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">डिलीवरी की शर्तें:</label>
                <input
                  type="text"
                  value={makeOfferModal.deliveryTerms}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, deliveryTerms: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">संदेश (नोट):</label>
                <textarea
                  rows={2}
                  value={makeOfferModal.message}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, message: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 outline-none"
                />
              </div>

              {/* Total Value Summary */}
              <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 flex justify-between items-center text-xs">
                <span className="font-bold text-emerald-900">कुल सौदा मूल्य (Total Contract Value):</span>
                <span className="text-base font-black text-emerald-800">
                  ₹{Math.round(makeOfferModal.quantityTons * 1000 * makeOfferModal.offeredPricePerKg).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMakeOfferModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-bold text-xs"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={makeOfferModal.isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{makeOfferModal.isSubmitting ? 'भेज रहे हैं...' : 'सौदा प्रस्ताव भेजें (Send Offer)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
