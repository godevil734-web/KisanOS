import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { BuyerRequirement, FarmerListing, AggregationBatch, Order, Crop } from '../types';
import { 
  ShoppingBag, 
  Plus, 
  Layers, 
  Warehouse, 
  Truck, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Filter, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  MapPin,
  Handshake,
  Check
} from 'lucide-react';
import { FarmTraceabilityModal } from './FarmTraceabilityModal';

export const BuyerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [requirements, setRequirements] = useState<BuyerRequirement[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'requirements' | 'supply_discovery' | 'offers' | 'orders'>('requirements');
  const [loading, setLoading] = useState(true);
  const [offerFilter, setOfferFilter] = useState<'ALL' | 'RECEIVED' | 'SENT' | 'NEGOTIATING' | 'DEALS'>('ALL');

  // Direct Offer Modal State (Buyer -> Farmer)
  const [directOfferModal, setDirectOfferModal] = useState<{
    isOpen: boolean;
    listing: any | null;
    quantityTons: number;
    pricePerKg: number;
    pickupTerms: string;
    targetDate: string;
    message: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    listing: null,
    quantityTons: 0,
    pricePerKg: 0,
    pickupTerms: 'Farm Gate Pickup',
    targetDate: '',
    message: '',
    isSubmitting: false
  });

  // Counter Offer Modal State (Negotiation)
  const [counterOfferModal, setCounterOfferModal] = useState<{
    isOpen: boolean;
    offer: any | null;
    counterPricePerKg: number;
    counterQuantityTons: number;
    pickupTerms: string;
    targetDate: string;
    message: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    offer: null,
    counterPricePerKg: 0,
    counterQuantityTons: 0,
    pickupTerms: 'Farm Gate Pickup',
    targetDate: '',
    message: '',
    isSubmitting: false
  });

  // NaLamKI Passport Modal State
  const [selectedListingForPassport, setSelectedListingForPassport] = useState<FarmerListing | null>(null);
  const [showPassportModal, setShowPassportModal] = useState(false);

  // New Demand Post Modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [newReq, setNewReq] = useState({
    cropName: 'Potato',
    variety: 'Kufri Jyoti',
    quantityTons: 60,
    gradeRequired: 'Grade A',
    sizeMinMm: 45,
    sizeMaxMm: 75,
    maxMoisture: 19,
    maxDefects: 3.0,
    location: 'Agra Bypass Delivery Hub / Farm Pickup',
    requiredDate: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
    offeredPricePerKg: 21.5,
    deliveryType: 'PICKUP_REQUIRED' as 'PICKUP_REQUIRED' | 'DELIVERY_TO_BUYER',
    specialRequirements: 'Factory procurement for food processing. Uniform sizing required.'
  });

  // Selected requirement for multi-channel matching
  const [selectedReqForDiscovery, setSelectedReqForDiscovery] = useState<BuyerRequirement | null>(null);
  const [discoveredSupply, setDiscoveredSupply] = useState<{
    farmerMatches: any[];
    aggregatorBatches: any[];
    coldStorageInventory: any[];
  }>({
    farmerMatches: [],
    aggregatorBatches: [],
    coldStorageInventory: []
  });
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [supplySummary, setSupplySummary] = useState<{
    requiredTons: number;
    directFarmerTons: number;
    aggregatorProcurementTons: number;
    coldStorageTons: number;
    totalAvailableTons: number;
    remainingTons: number;
    fulfillmentPercent: number;
    targetRequirementTons?: number;
    availableFarmerSupplyTons?: number;
    offersSentTons?: number;
    negotiatingTons?: number;
    confirmedProcurementTons?: number;
    remainingRequirementTons?: number;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, cropRes, ordRes, offRes] = await Promise.all([
        api.getRequirements({ buyerId: user?.id || '' }),
        api.getCrops(),
        api.getOrders(),
        api.getOffers().catch(() => [])
      ]);
      setRequirements(reqRes);
      setCrops(cropRes);
      setOrders(ordRes);
      setOffers(offRes || []);

      if (reqRes.length > 0) {
        handleDiscoverSupply(reqRes[0]);
      }
    } catch (err) {
      console.error('Error fetching buyer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      const res = await api.acceptOffer(offerId);
      alert(`सौदा पक्का! (Deal Confirmed!)\nDeal ID: ${res.deal?.orderNumber || 'Active'}\nएस्क्रो भुगतान सुरक्षित है और पक्का ऑर्डर बन गया है।`);
      await fetchData();
      setActiveTab('orders');
    } catch (err) {
      alert('Error accepting offer: ' + (err as Error).message);
    }
  };

  const handleRejectOffer = async (offerId: string, reason?: string) => {
    const finalReason = reason || prompt('कृपया अस्वीकार करने का कारण दर्ज करें (Reason):') || 'Buyer declined';
    try {
      await api.rejectOffer(offerId, finalReason);
      alert('प्रस्ताव अस्वीकृत कर दिया गया। (Offer declined)');
      await fetchData();
    } catch (err) {
      alert('Error rejecting offer: ' + (err as Error).message);
    }
  };

  const handleDirectOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directOfferModal.listing) return;
    const avail = Number(directOfferModal.listing.availableQuantityTons ?? directOfferModal.listing.quantityTons ?? 0);
    if (directOfferModal.quantityTons > avail) {
      alert(`इस फसल की केवल ${avail} टन मात्रा उपलब्ध है। (Only ${avail}T available)`);
      return;
    }
    setDirectOfferModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.createOffer({
        requirementId: selectedReqForDiscovery?.id,
        listingId: directOfferModal.listing.id,
        sellerId: directOfferModal.listing.farmerId,
        sellerName: directOfferModal.listing.farmerName,
        sellerRole: 'farmer',
        cropName: directOfferModal.listing.cropName,
        variety: directOfferModal.listing.variety,
        quantityTons: directOfferModal.quantityTons,
        offeredPricePerKg: directOfferModal.pricePerKg,
        pickupTerms: directOfferModal.pickupTerms,
        deliveryTerms: directOfferModal.pickupTerms,
        targetDate: directOfferModal.targetDate,
        message: directOfferModal.message
      });
      alert(`प्रस्ताव भेजा गया! (Offer Sent to ${directOfferModal.listing.farmerName})\nStatus: OFFER SENT — Waiting for Farmer`);
      setDirectOfferModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
      setActiveTab('offers');
      setOfferFilter('SENT');
    } catch (e) {
      alert('Error sending direct offer: ' + (e as Error).message);
    } finally {
      setDirectOfferModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleCounterOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterOfferModal.offer) return;
    setCounterOfferModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.counterOffer(counterOfferModal.offer.id, {
        counterPricePerKg: counterOfferModal.counterPricePerKg,
        counterQuantityTons: counterOfferModal.counterQuantityTons,
        pickupTerms: counterOfferModal.pickupTerms,
        deliveryTerms: counterOfferModal.pickupTerms,
        targetDate: counterOfferModal.targetDate,
        message: counterOfferModal.message
      });
      alert('जवाबी प्रस्ताव किसान को भेज दिया गया है! (Counter offer sent to farmer)\nStatus: NEGOTIATING');
      setCounterOfferModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
    } catch (err) {
      alert('Error sending counter offer: ' + (err as Error).message);
    } finally {
      setCounterOfferModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.status === 'pending') {
      alert('Account pending admin approval. You can browse, but cannot create batches / make offers until verified.');
      return;
    }
    try {
      await api.createRequirement(newReq);
      setShowPostModal(false);
      await fetchData();
    } catch (err) {
      alert('Error posting requirement: ' + (err as Error).message);
    }
  };

  const handleDiscoverSupply = async (req: BuyerRequirement) => {
    setSelectedReqForDiscovery(req);
    setLoadingDiscovery(true);
    try {
      const res = await api.getRequirementMatches(req.id);
      setDiscoveredSupply({
        farmerMatches: res.farmerMatches || [],
        aggregatorBatches: res.aggregatorBatches || [],
        coldStorageInventory: res.coldStorageInventory || []
      });

      if (res.supplySummary) {
        setSupplySummary(res.supplySummary);
      } else {
        const directTons = (res.farmerMatches || []).reduce((sum: number, m: any) => sum + (Number(m.listing?.quantityTons) || 0), 0);
        const aggTons = (res.aggregatorBatches || []).reduce((sum: number, b: any) => sum + (Number(b.currentAggregatedTons) || 0), 0);
        const csTons = (res.coldStorageInventory || []).reduce((sum: number, s: any) => sum + (Number(s.availableCapacityTons) || 0), 0);
        const total = directTons + aggTons + csTons;
        const targetReq = Number(req.quantityTons || 0);
        const confirmedProcured = Number(req.confirmedProcuredTons || 0);
        setSupplySummary({
          requiredTons: targetReq,
          targetRequirementTons: targetReq,
          directFarmerTons: directTons,
          availableFarmerSupplyTons: directTons,
          aggregatorProcurementTons: aggTons,
          coldStorageTons: csTons,
          totalAvailableTons: total,
          offersSentTons: 0,
          negotiatingTons: 0,
          confirmedProcurementTons: confirmedProcured,
          remainingRequirementTons: Math.max(0, targetReq - confirmedProcured),
          remainingTons: Math.max(0, targetReq - confirmedProcured),
          fulfillmentPercent: targetReq > 0 ? Math.min(100, Math.round((confirmedProcured / targetReq) * 100)) : 0
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDiscovery(false);
    }
  };

  const advanceOrderStatus = async (orderId: string, nextStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, nextStatus, `Updated by Buyer ${user?.name}`);
      await fetchData();
    } catch (err) {
      alert('Error updating order: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Buyer Enterprise Profile */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xl border border-blue-200">
            🏭
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {user?.buyerProfile?.companyName || 'FreshBites Foods Pvt Ltd'}
              </h1>
              <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold border border-blue-200 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-blue-600" />
                Verified Institutional Buyer
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {user?.buyerProfile?.businessType || 'Food Processor'} • Annual Volume: {user?.buyerProfile?.annualDemandTons || 2500} Tonnes • Delivery Hub: {user?.location}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (user?.status === 'pending') {
                alert('Account pending admin approval. You can browse, but cannot create batches / make offers until verified.');
                return;
              }
              setShowPostModal(true);
            }}
            disabled={user?.status === 'pending'}
            title={user?.status === 'pending' ? 'Account pending approval' : t('buyer.postDemand')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors ${
              user?.status === 'pending'
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>{user?.status === 'pending' ? 'Account Pending Approval' : t('buyer.postDemand')}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'requirements', label: `${t('buyer.industrialProcurement')} (${requirements.length})`, icon: ShoppingBag },
          { id: 'supply_discovery', label: t('buyer.channelDiscovery'), icon: Sparkles },
          { id: 'offers', label: `आवक प्रस्ताव / Incoming Offers (${offers.filter(o => o.status === 'PENDING' || o.status === 'COUNTERED').length})`, icon: Handshake },
          { id: 'orders', label: `${t('buyer.activeContracts')} (${orders.length})`, icon: Truck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BUYER REQUIREMENTS LIST */}
      {activeTab === 'requirements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Active Procurement Requirements
            </h3>
            {user?.status !== 'pending' && (
              <button
                onClick={() => setShowPostModal(true)}
                className="text-xs text-blue-700 font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                New Procurement Specification
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requirements.map((req) => (
              <div 
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                        {req.status}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-1.5">
                        {req.quantityTons}T {req.cropName}
                      </h4>
                      <span className="text-xs text-slate-500 font-medium">({req.variety})</span>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-blue-900">₹{req.offeredPricePerKg}</div>
                      <span className="text-[10px] text-slate-400">per kg offered</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-3">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Grade:</span>
                      <span className="font-semibold text-slate-800">{req.gradeRequired}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Size Caliber:</span>
                      <span className="font-medium text-slate-700">{req.sizeMinMm}-{req.sizeMaxMm} mm</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Target Date:</span>
                      <span className="font-medium text-slate-700">{req.requiredDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Logistics:</span>
                      <span className="font-medium text-slate-700">{req.deliveryType === 'PICKUP_REQUIRED' ? 'Farm Pickup' : 'Delivery'}</span>
                    </div>
                  </div>

                  {/* Confirmed Procurement Progress */}
                  <div className="space-y-1 mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold text-[11px]">Confirmed Procurement:</span>
                      <span className="font-extrabold text-emerald-700">
                        {req.confirmedProcuredTons || 0} / {req.quantityTons}T
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        style={{ width: `${Math.min(100, Math.round(((req.confirmedProcuredTons || 0) / (req.quantityTons || 1)) * 100))}%` }}
                        className="bg-emerald-600 h-full transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>Remaining: {Math.max(0, (req.quantityTons || 0) - (req.confirmedProcuredTons || 0))}T</span>
                      <span>{Math.min(100, Math.round(((req.confirmedProcuredTons || 0) / (req.quantityTons || 1)) * 100))}% Fulfilled</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleDiscoverSupply(req);
                    setActiveTab('supply_discovery');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Discover Matching Supply</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-CHANNEL SUPPLY DISCOVERY (Section 14 & 51) */}
      {activeTab === 'supply_discovery' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Currently Sourcing For:</span>
              <div className="text-base font-bold text-slate-900">
                {selectedReqForDiscovery?.quantityTons}T {selectedReqForDiscovery?.cropName} ({selectedReqForDiscovery?.variety}) at ₹{selectedReqForDiscovery?.offeredPricePerKg}/kg
              </div>
            </div>
            <select
              value={selectedReqForDiscovery?.id || ''}
              onChange={(e) => {
                const found = requirements.find(r => r.id === e.target.value);
                if (found) handleDiscoverSupply(found);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
            >
              {requirements.map(r => (
                <option key={r.id} value={r.id}>
                  {r.cropName} - {r.quantityTons}T (₹{r.offeredPricePerKg}/kg)
                </option>
              ))}
            </select>
          </div>

          {/* Multi-Channel Supply Progress Banner (Part 6: Strictly separated procurement metrics) */}
          {supplySummary && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>खरीद स्थिति और आपूर्ति पाइपलाइन (Procurement & Supply Pipeline)</span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                      (supplySummary.confirmedProcurementTons || 0) >= (supplySummary.targetRequirementTons || supplySummary.requiredTons)
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-blue-100 text-blue-900'
                    }`}>
                      {(supplySummary.confirmedProcurementTons || 0) >= (supplySummary.targetRequirementTons || supplySummary.requiredTons)
                        ? '✓ FULFILLED'
                        : 'IN PROGRESS'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target Requirement: <strong>{supplySummary.targetRequirementTons || supplySummary.requiredTons} Ton {selectedReqForDiscovery?.cropName}</strong> • Min Direct Lot: <strong>{((selectedReqForDiscovery?.minimumDirectFarmerLotKg || 20000) / 1000)} Ton</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-700">
                    {supplySummary.confirmedProcurementTons || 0} / {supplySummary.targetRequirementTons || supplySummary.requiredTons} Tonnes Confirmed
                  </span>
                  <span className="text-[10px] text-slate-500 block font-bold">
                    {supplySummary.remainingRequirementTons ?? supplySummary.remainingTons} Ton Remaining Requirement
                  </span>
                </div>
              </div>

              {/* Confirmed Procurement Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600">पक्की खरीद प्रगति (Confirmed Procurement Progress):</span>
                  <span className="text-emerald-700 font-extrabold">{supplySummary.fulfillmentPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                  <div 
                    style={{ width: `${supplySummary.fulfillmentPercent}%` }}
                    className="bg-emerald-600 h-full transition-all"
                  />
                </div>
              </div>

              {/* The 6 Explicit Metric Cards (Part 6) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Target Requirement</span>
                  <div className="text-base font-black text-slate-900 mt-1">{supplySummary.targetRequirementTons || supplySummary.requiredTons}T</div>
                  <span className="text-[10px] text-slate-400">Total specification</span>
                </div>

                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">Available Farmer Supply</span>
                  <div className="text-base font-black text-emerald-950 mt-1">{supplySummary.availableFarmerSupplyTons ?? supplySummary.directFarmerTons}T</div>
                  <span className="text-[10px] text-emerald-700">Listed by farmers</span>
                </div>

                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-800 block uppercase">Offers Sent</span>
                  <div className="text-base font-black text-blue-950 mt-1">{supplySummary.offersSentTons || 0}T</div>
                  <span className="text-[10px] text-blue-700">Reserved / Pending</span>
                </div>

                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 block uppercase">Negotiating</span>
                  <div className="text-base font-black text-amber-950 mt-1">{supplySummary.negotiatingTons || 0}T</div>
                  <span className="text-[10px] text-amber-700">Active counter-offers</span>
                </div>

                <div className="bg-emerald-100 p-2.5 rounded-xl border border-emerald-300">
                  <span className="text-[10px] font-bold text-emerald-900 block uppercase">Confirmed Procurement</span>
                  <div className="text-base font-black text-emerald-950 mt-1">{supplySummary.confirmedProcurementTons || 0}T</div>
                  <span className="text-[10px] text-emerald-800 font-bold">Mutually accepted deals</span>
                </div>

                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-800 block uppercase">Remaining Requirement</span>
                  <div className="text-base font-black text-rose-950 mt-1">{supplySummary.remainingRequirementTons ?? supplySummary.remainingTons}T</div>
                  <span className="text-[10px] text-rose-700">Yet to be confirmed</span>
                </div>
              </div>
            </div>
          )}

          {/* 3 Channels Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Channel 1: Individual Farmers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌾</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Channel 1: Direct Farmers ({discoveredSupply.farmerMatches.length})
                  </h4>
                </div>
              </div>

              <div className="space-y-3">
                {discoveredSupply.farmerMatches.map((m, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{m.listing.farmerName}</span>
                        <span className="text-[10px] text-slate-400">{m.listing.farmerLocation}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {m.matchScore}% Match
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-bold text-slate-700">
                        {m.listing.availableQuantityTons ?? m.listing.quantityTons} Tonnes Available
                        {m.listing.reservedQuantityTons > 0 && (
                          <span className="text-[10px] text-amber-600 font-normal block">
                            ({m.listing.reservedQuantityTons}T on hold in active offers)
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-agri-700">₹{m.listing.expectedPricePerKg}/kg</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedListingForPassport(m.listing);
                        setShowPassportModal(true);
                      }}
                      className="w-full py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>NaLamKI Farm Passport & Traceability</span>
                    </button>

                    <button
                      onClick={() => {
                        if (user?.status === 'pending') {
                          alert('Account pending admin approval. You can browse, but cannot create batches / make offers until verified.');
                          return;
                        }
                        const avail = Number(m.listing.availableQuantityTons ?? m.listing.quantityTons ?? 5);
                        setDirectOfferModal({
                          isOpen: true,
                          listing: m.listing,
                          quantityTons: Math.min(avail, Number(selectedReqForDiscovery?.quantityTons || avail)),
                          pricePerKg: Number(selectedReqForDiscovery?.offeredPricePerKg || m.listing.expectedPricePerKg || 21),
                          pickupTerms: selectedReqForDiscovery?.deliveryType === 'DELIVERY_TO_BUYER' ? 'Delivery to Buyer Mandi' : 'Farm Gate Pickup',
                          targetDate: selectedReqForDiscovery?.requiredDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                          message: `Direct farm procurement offer for ${m.listing.cropName}`,
                          isSubmitting: false
                        });
                      }}
                      disabled={user?.status === 'pending'}
                      title={user?.status === 'pending' ? 'Account pending approval' : 'Make Direct Farm Offer'}
                      className={`w-full py-1.5 rounded-lg font-bold text-xs transition-colors ${
                        user?.status === 'pending'
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                          : 'bg-agri-600 hover:bg-agri-700 text-white cursor-pointer'
                      }`}
                    >
                      {user?.status === 'pending' ? 'Account Pending Approval' : 'Make Direct Farm Offer'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel 2: Aggregator Batches */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-base">📦</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Channel 2: Aggregated Batches ({discoveredSupply.aggregatorBatches.length})
                  </h4>
                </div>
              </div>

              <div className="space-y-3">
                {discoveredSupply.aggregatorBatches.map((b, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{b.aggregatorName}</span>
                        <span className="text-[10px] text-slate-400">Consolidating {b.cropName}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        {b.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Aggregated:</span>
                        <span className="font-bold text-amber-800">{b.currentAggregatedTons} / {b.targetQuantityTons}T</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full" 
                          style={{ width: `${(b.currentAggregatedTons / b.targetQuantityTons) * 100}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => alert(`Aggregator ${b.aggregatorName} has locked ${b.currentAggregatedTons}T with 3 committed farmers.`)}
                      className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors"
                    >
                      Inspect Aggregator Batch
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel 3: Cold Storage Inventory */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-base">❄️</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Channel 3: Cold Storage Inventory ({discoveredSupply.coldStorageInventory.length})
                  </h4>
                </div>
              </div>

              <div className="space-y-3">
                {discoveredSupply.coldStorageInventory.map((cs, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{cs.storageName}</span>
                        <span className="text-[10px] text-slate-400">{cs.location}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full">
                        Stored Inventory
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500">Stored {cs.cropName} ({cs.variety}):</span>
                      <span className="font-bold text-cyan-900">{cs.availableQuantityTons} Tonnes</span>
                    </div>

                    <button
                      onClick={() => alert(`Cold storage facility ${cs.storageName} releases produce on scheduled lot cycles.`)}
                      className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition-colors"
                    >
                      Request Stored Lot Release
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INCOMING & SENT OFFERS WITH NEGOTIATION */}
      {activeTab === 'offers' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">
                खरीदार सौदा व प्रस्ताव प्रबंधन (Buyer Offer & Negotiation Management)
              </h3>
              <p className="text-xs text-slate-500">
                किसानों के साथ सीधे भेजे गए और प्राप्त प्रस्तावों की समीक्षा और बातचीत
              </p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-900 font-extrabold px-3 py-1 rounded-full self-start sm:self-auto">
              कुल: {offers.length} प्रस्ताव
            </span>
          </div>

          {/* Offer Management Filters (Part 2) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            {[
              { id: 'ALL', label: 'All Offers', count: offers.length },
              { id: 'RECEIVED', label: 'Received (From Farmers)', count: offers.filter(o => o.direction === 'RECEIVED').length },
              { id: 'SENT', label: 'Sent (To Farmers)', count: offers.filter(o => o.direction === 'SENT').length },
              { id: 'NEGOTIATING', label: 'Negotiating', count: offers.filter(o => o.status === 'COUNTERED').length },
              { id: 'DEALS', label: 'Confirmed Deals', count: offers.filter(o => o.status === 'ACCEPTED').length + orders.length }
            ].map(fBtn => (
              <button
                key={fBtn.id}
                onClick={() => setOfferFilter(fBtn.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  offerFilter === fBtn.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {fBtn.label} ({fBtn.count})
              </button>
            ))}
          </div>

          {(() => {
            const filteredOffers = offers.filter(off => {
              if (offerFilter === 'ALL') return true;
              if (offerFilter === 'RECEIVED') return off.direction === 'RECEIVED';
              if (offerFilter === 'SENT') return off.direction === 'SENT';
              if (offerFilter === 'NEGOTIATING') return off.status === 'COUNTERED';
              if (offerFilter === 'DEALS') return off.status === 'ACCEPTED';
              return true;
            });

            if (filteredOffers.length === 0) {
              return (
                <div className="text-center py-14 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                  <div className="text-4xl">🤝</div>
                  <h4 className="text-sm font-bold text-slate-800">इस श्रेणी में कोई प्रस्ताव नहीं है</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {offerFilter === 'SENT'
                      ? 'आपने अभी तक किसी किसान को सीधा प्रस्ताव नहीं भेजा है।'
                      : offerFilter === 'RECEIVED'
                      ? 'किसानों से अभी कोई सीधा प्रस्ताव प्राप्त नहीं हुआ है।'
                      : offerFilter === 'NEGOTIATING'
                      ? 'वर्तमान में कोई सक्रिय जवाबी बातचीत (Counter-Offer) नहीं है।'
                      : offerFilter === 'DEALS'
                      ? 'अभी कोई स्वीकृत सौदा नहीं है।'
                      : 'अभी कोई प्रस्ताव उपलब्ध नहीं है।'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredOffers.map((off) => {
                  const effectivePrice = off.effectivePricePerKg ?? (
                    (off.status === 'COUNTERED' && off.counterPricePerKg)
                      ? off.counterPricePerKg
                      : (off.offeredPricePerKg || off.buyerOfferedPricePerKg || off.farmerExpectedPricePerKg || 0)
                  );
                  const effectiveQty = off.effectiveQuantityTons ?? (
                    (off.status === 'COUNTERED' && off.counterQuantityTons)
                      ? off.counterQuantityTons
                      : off.quantityTons
                  );
                  const totalAmount = Math.round(effectivePrice * effectiveQty * 1000);
                  const isSentByMe = off.direction === 'SENT';
                  const isReceivedByMe = off.direction === 'RECEIVED';
                  const isMyTurnToRespond = off.isMyTurn;

                  return (
                    <div
                      key={off.id}
                      className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                            {isSentByMe ? `To: ${off.sellerName}` : `From: ${off.sellerName}`}
                          </span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                            {off.sellerRole === 'aggregator' ? 'संग्राहक' : 'किसान (Direct)'}
                          </span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            off.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : off.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : off.status === 'COUNTERED'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isSentByMe
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {off.status === 'ACCEPTED'
                              ? '✓ सौदा पक्का (Deal Confirmed)'
                              : off.status === 'REJECTED'
                              ? '✕ अस्वीकृत (Declined)'
                              : off.status === 'COUNTERED'
                              ? (isMyTurnToRespond ? '🔄 जवाबी भाव आया (Farmer Countered)' : '⏳ जवाबी भाव भेजा (Waiting for Farmer)')
                              : isSentByMe
                              ? 'OFFER SENT — Waiting for Farmer'
                              : 'FARMER OFFER RECEIVED'}
                          </span>
                        </div>

                        <div className="text-base font-black text-slate-900">
                          {effectiveQty} टन ({effectiveQty * 10} क्विंटल) • {off.cropName} {off.variety ? `(${off.variety})` : ''}
                          <span className="text-emerald-700 ml-3">
                            ₹{effectivePrice}/किग्रा
                          </span>
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            (कुल मूल्य: <strong>₹{totalAmount.toLocaleString()}</strong>)
                          </span>
                        </div>

                        {/* Negotiation Banner */}
                        {off.status === 'COUNTERED' && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 space-y-1">
                            <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                              <span>
                                {isMyTurnToRespond 
                                  ? '⚠️ किसान ने संशोधित भाव/मात्रा प्रस्तावित की है (Farmer Counter):'
                                  : '⏳ आपने संशोधित भाव/मात्रा भेजी है (Counter Sent):'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-bold text-slate-800">
                              <span className="bg-amber-200 px-2 py-0.5 rounded text-amber-950">₹{off.counterPricePerKg || effectivePrice}/किग्रा</span>
                              <span className="bg-amber-200 px-2 py-0.5 rounded text-amber-950">{off.counterQuantityTons || effectiveQty} टन</span>
                            </div>
                            {off.counterMessage && (
                              <p className="italic text-slate-600 bg-white p-2 rounded border border-amber-100">
                                "{off.counterMessage}"
                              </p>
                            )}
                          </div>
                        )}

                        {off.message && off.status !== 'COUNTERED' && (
                          <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                            "{off.message}"
                          </p>
                        )}

                        <div className="text-[10px] text-slate-400">
                          शर्तें: {off.deliveryTerms || off.pickupTerms || 'Farm Gate Pickup'} • 
                          तारीख: {off.targetDate || new Date(off.createdAt).toLocaleDateString()}
                        </div>

                        {/* Structured Negotiation History (Part 3) */}
                        {off.negotiationHistory && off.negotiationHistory.length > 1 && (
                          <div className="pt-1">
                            <details className="text-xs bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                              <summary className="font-bold text-slate-700 cursor-pointer">
                                बातचीत का इतिहास (Negotiation History — {off.negotiationHistory.length} दौर)
                              </summary>
                              <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-200">
                                {off.negotiationHistory.map((h: any, hIdx: number) => (
                                  <div key={hIdx} className="bg-white p-2 rounded border border-slate-100 flex items-start justify-between gap-2 text-[11px]">
                                    <div>
                                      <span className="font-extrabold text-slate-800">
                                        Round {h.round}: {h.senderName} ({h.senderRole === 'buyer' ? 'Buyer' : 'Farmer'})
                                      </span>
                                      <div className="text-slate-600 font-semibold">
                                        {h.quantityTons}T @ ₹{h.pricePerKg}/kg {h.pickupTerms ? `• ${h.pickupTerms}` : ''}
                                      </div>
                                      {h.message && <p className="italic text-slate-500">"{h.message}"</p>}
                                    </div>
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                        {/* Can accept/counter/reject if it is buyer's turn */}
                        {( (off.status === 'PENDING' && isReceivedByMe) || (off.status === 'COUNTERED' && isMyTurnToRespond) ) && (
                          <>
                            <button
                              onClick={() => handleAcceptOffer(off.id)}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="h-4 w-4" />
                              <span>स्वीकार करें (Accept Deal)</span>
                            </button>
                            <button
                              onClick={() => setCounterOfferModal({
                                isOpen: true,
                                offer: off,
                                counterPricePerKg: off.counterPricePerKg || effectivePrice,
                                counterQuantityTons: off.counterQuantityTons || effectiveQty,
                                pickupTerms: off.deliveryTerms || off.pickupTerms || 'Farm Gate Pickup',
                                targetDate: off.targetDate || '',
                                message: '',
                                isSubmitting: false
                              })}
                              className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                            >
                              जवाबी बातचीत (Negotiate)
                            </button>
                            <button
                              onClick={() => handleRejectOffer(off.id)}
                              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                            >
                              अस्वीकार (Reject)
                            </button>
                          </>
                        )}

                        {/* Waiting for farmer response */}
                        {( (off.status === 'PENDING' && isSentByMe) || (off.status === 'COUNTERED' && !isMyTurnToRespond) ) && (
                          <div className="flex items-center gap-2">
                            <div className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              <span>किसान के निर्णय की प्रतीक्षा है (Waiting for Farmer)</span>
                            </div>
                            <button
                              onClick={() => handleRejectOffer(off.id, 'Buyer withdrew offer')}
                              className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                              title="प्रस्ताव वापस लें"
                            >
                              वापस लें
                            </button>
                          </div>
                        )}

                        {off.status === 'ACCEPTED' && (
                          <button
                            onClick={() => setActiveTab('orders')}
                            className="px-4 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-300"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>सौदा देखें (View Active Deal)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 4: PROCUREMENT ORDERS & ESCROW LIFECYCLE */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">
            Active Procurement Orders & Escrow Tracking
          </h3>

          <div className="space-y-4">
            {orders.map((ord) => (
              <div 
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{ord.orderNumber}</span>
                      <span className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-semibold">
                        Seller: {ord.sellerName} ({ord.sellerType})
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">Created: {new Date(ord.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                      Status: {ord.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-full font-bold">
                      {ord.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Produce:</span>
                    <span className="font-bold text-slate-800">{ord.quantityTons}T {ord.cropName} ({ord.variety})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Price:</span>
                    <span className="font-bold text-slate-800">₹{ord.unitPricePerKg}/kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Escrow:</span>
                    <span className="font-bold text-emerald-700">₹{ord.totalAmount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Transporter:</span>
                    <span className="font-medium text-slate-700">{ord.transporterName || 'Kisan Express'}</span>
                  </div>
                </div>

                {/* State Machine Transition Buttons (Section 30) */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    Current stage: <strong>{ord.status}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ord.status === 'CONFIRMED' && (
                      <button
                        onClick={() => advanceOrderStatus(ord.id, 'READY_FOR_PICKUP')}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs"
                      >
                        Advance to Ready for Pickup
                      </button>
                    )}
                    {ord.status === 'READY_FOR_PICKUP' && (
                      <button
                        onClick={() => advanceOrderStatus(ord.id, 'IN_TRANSIT')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                      >
                        Dispatch Carrier (In Transit)
                      </button>
                    )}
                    {ord.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => advanceOrderStatus(ord.id, 'DELIVERED')}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold text-xs"
                      >
                        Confirm Gate Delivery
                      </button>
                    )}
                    {ord.status === 'DELIVERED' && (
                      <button
                        onClick={() => advanceOrderStatus(ord.id, 'COMPLETED')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                      >
                        Accept Quality & Release Escrow
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: POST BULK DEMAND REQUIREMENT (Section 14) */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Post Bulk Procurement Requirement</h3>
                <p className="text-xs text-slate-500">Define specifications to match with farmers and local aggregators.</p>
              </div>
              <button 
                onClick={() => setShowPostModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequirement} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Crop</label>
                  <select
                    value={newReq.cropName}
                    onChange={(e) => setNewReq({ ...newReq, cropName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  >
                    {crops.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Variety</label>
                  <input
                    type="text"
                    value={newReq.variety}
                    onChange={(e) => setNewReq({ ...newReq, variety: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                    placeholder="e.g. Kufri Jyoti / All"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Quantity (Tonnes)</label>
                  <input
                    type="number"
                    min="5"
                    value={newReq.quantityTons}
                    onChange={(e) => setNewReq({ ...newReq, quantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Offered Price (₹/kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newReq.offeredPricePerKg}
                    onChange={(e) => setNewReq({ ...newReq, offeredPricePerKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Grade Required</label>
                  <select
                    value={newReq.gradeRequired}
                    onChange={(e) => setNewReq({ ...newReq, gradeRequired: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  >
                    <option value="Grade A">Grade A</option>
                    <option value="Grade B">Grade B</option>
                    <option value="Grade C">Grade C</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Size Min (mm)</label>
                  <input
                    type="number"
                    value={newReq.sizeMinMm}
                    onChange={(e) => setNewReq({ ...newReq, sizeMinMm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Size Max (mm)</label>
                  <input
                    type="number"
                    value={newReq.sizeMaxMm}
                    onChange={(e) => setNewReq({ ...newReq, sizeMaxMm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Required By Date</label>
                  <input
                    type="date"
                    value={newReq.requiredDate}
                    onChange={(e) => setNewReq({ ...newReq, requiredDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Logistics Terms</label>
                  <select
                    value={newReq.deliveryType}
                    onChange={(e) => setNewReq({ ...newReq, deliveryType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  >
                    <option value="PICKUP_REQUIRED">Pickup Required (Farm/Hub Gate)</option>
                    <option value="DELIVERY_TO_BUYER">Delivery to Buyer Facility</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Delivery Location</label>
                <input
                  type="text"
                  value={newReq.location}
                  onChange={(e) => setNewReq({ ...newReq, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
                >
                  Publish Requirement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT OFFER TO FARMER */}
      {directOfferModal.isOpen && directOfferModal.listing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-lg">
                  🤝
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    सीधे किसान को प्रस्ताव भेजें (Make Direct Offer)
                  </h3>
                  <p className="text-xs text-slate-500">
                    किसान: <span className="font-bold text-slate-700">{directOfferModal.listing.farmerName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDirectOfferModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDirectOfferSubmit} className="space-y-3.5">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900">{directOfferModal.listing.cropName} ({directOfferModal.listing.variety})</span>
                  <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-black text-[10px]">
                    ग्रेड {directOfferModal.listing.grade}
                  </span>
                </div>
                <div className="flex items-center justify-between text-blue-800">
                  <span>उपलब्ध भंडार (Available):</span>
                  <span className="font-black text-sm">
                    {Number(directOfferModal.listing.availableQuantityTons ?? directOfferModal.listing.quantityTons ?? 0)} टन
                  </span>
                </div>
                <div className="text-[11px] text-blue-700">
                  किसान की अपेक्षित कीमत: ₹{directOfferModal.listing.expectedPricePerKg}/kg • स्थान: {directOfferModal.listing.farmerLocation}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    मात्रा (Tons) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={Number(directOfferModal.listing.availableQuantityTons ?? directOfferModal.listing.quantityTons ?? 0)}
                    required
                    value={directOfferModal.quantityTons || ''}
                    onChange={(e) => setDirectOfferModal({ ...directOfferModal, quantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="text-[10px] text-slate-400">
                    अधिकतम {Number(directOfferModal.listing.availableQuantityTons ?? directOfferModal.listing.quantityTons ?? 0)}T
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    प्रस्तावित भाव (₹/kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={directOfferModal.pricePerKg || ''}
                    onChange={(e) => setDirectOfferModal({ ...directOfferModal, pricePerKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="text-[10px] text-slate-400">
                    अपेक्षित: ₹{directOfferModal.listing.expectedPricePerKg}/kg
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    लॉजिस्टिक्स / पिकअप शर्तें
                  </label>
                  <select
                    value={directOfferModal.pickupTerms}
                    onChange={(e) => setDirectOfferModal({ ...directOfferModal, pickupTerms: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Farm Gate Pickup">Farm Gate Pickup (खेत से उठाव)</option>
                    <option value="Buyer to Arrange Transport">Buyer Arranges Transport (खरीदार का वाहन)</option>
                    <option value="Farmer Delivery to Facility">Farmer Delivery to Facility (फ़ैक्टरी डिलीवरी)</option>
                    <option value="Mandi Delivery">Mandi Delivery (मंडी सुपुर्दगी)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    अपेक्षित डिलीवरी तारीख
                  </label>
                  <input
                    type="date"
                    value={directOfferModal.targetDate}
                    onChange={(e) => setDirectOfferModal({ ...directOfferModal, targetDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  संदेश / विशेष निर्देश (Note to Farmer)
                </label>
                <textarea
                  rows={2}
                  value={directOfferModal.message}
                  onChange={(e) => setDirectOfferModal({ ...directOfferModal, message: e.target.value })}
                  placeholder="उदा. हम तत्काल डिलीवरी और तुरंत भुगतान के लिए तैयार हैं..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    अनुमानित कुल सौदा (Total Offer Value)
                  </span>
                  <div className="text-lg font-black text-slate-900">
                    ₹{Math.round((directOfferModal.quantityTons || 0) * 1000 * (directOfferModal.pricePerKg || 0)).toLocaleString()}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <span>{(directOfferModal.quantityTons || 0) * 10} क्विंटल</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDirectOfferModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={directOfferModal.isSubmitting || directOfferModal.quantityTons <= 0}
                  className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {directOfferModal.isSubmitting ? 'भेजा जा रहा है...' : 'प्रस्ताव भेजें (Send Direct Offer)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BUYER COUNTER OFFER */}
      {counterOfferModal.isOpen && counterOfferModal.offer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg">
                  🔄
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    जवाबी भाव प्रस्तावित करें (Propose Counter Terms)
                  </h3>
                  <p className="text-xs text-slate-500">
                    किसान: <span className="font-bold text-slate-700">{counterOfferModal.offer.sellerName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCounterOfferModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Negotiation History Trail if exists */}
            {counterOfferModal.offer.negotiationHistory && counterOfferModal.offer.negotiationHistory.length > 0 && (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2 text-xs">
                <span className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider block">
                  बातचीत का इतिहास (Negotiation Trail)
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {counterOfferModal.offer.negotiationHistory.map((h: any, idx: number) => (
                    <div key={idx} className="bg-white p-2 rounded-xl border border-slate-100 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className={h.byRole === 'buyer' ? 'text-blue-700' : 'text-emerald-700'}>
                          दौर {h.round}: {h.byRole === 'buyer' ? 'खरीदार (Buyer)' : 'किसान (Farmer)'}
                        </span>
                        <span>₹{h.pricePerKg}/kg • {h.quantityTons}T</span>
                      </div>
                      {h.notes && <p className="text-slate-500 italic">"{h.notes}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleCounterOfferSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    मात्रा (Tons) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={counterOfferModal.counterQuantityTons}
                    onChange={(e) => setCounterOfferModal({ ...counterOfferModal, counterQuantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    जवाबी भाव (₹/kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={counterOfferModal.counterPricePerKg}
                    onChange={(e) => setCounterOfferModal({ ...counterOfferModal, counterPricePerKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    पिकअप / डिलीवरी शर्तें
                  </label>
                  <select
                    value={counterOfferModal.pickupTerms}
                    onChange={(e) => setCounterOfferModal({ ...counterOfferModal, pickupTerms: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Farm Gate Pickup">Farm Gate Pickup (खेत से उठाव)</option>
                    <option value="Buyer to Arrange Transport">Buyer Arranges Transport (खरीदार का वाहन)</option>
                    <option value="Farmer Delivery to Facility">Farmer Delivery to Facility (फ़ैक्टरी डिलीवरी)</option>
                    <option value="Mandi Delivery">Mandi Delivery (मंडी सुपुर्दगी)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    अपेक्षित डिलीवरी तारीख
                  </label>
                  <input
                    type="date"
                    value={counterOfferModal.targetDate}
                    onChange={(e) => setCounterOfferModal({ ...counterOfferModal, targetDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  संदेश / कारण (Note to Farmer)
                </label>
                <textarea
                  rows={2}
                  value={counterOfferModal.message}
                  onChange={(e) => setCounterOfferModal({ ...counterOfferModal, message: e.target.value })}
                  placeholder="उदा. हमारी गुणवत्ता विनिर्देश के अनुसार अधिकतम ₹21/किलो दे सकते हैं..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-900 block uppercase">
                    संशोधित कुल सौदा (New Total Value)
                  </span>
                  <div className="text-lg font-black text-amber-950">
                    ₹{Math.round(counterOfferModal.counterQuantityTons * 1000 * counterOfferModal.counterPricePerKg).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCounterOfferModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={counterOfferModal.isSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {counterOfferModal.isSubmitting ? 'भेजा जा रहा है...' : 'जवाबी भाव भेजें (Send Counter)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NaLamKI Farm Passport Modal */}
      <FarmTraceabilityModal
        isOpen={showPassportModal}
        onClose={() => {
          setShowPassportModal(false);
          setSelectedListingForPassport(null);
        }}
        listingId={selectedListingForPassport?.id}
        initialListing={selectedListingForPassport || undefined}
        language={language === 'hi' ? 'hi' : 'en'}
      />
    </div>
  );
};
