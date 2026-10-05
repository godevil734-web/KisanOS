import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { 
  AggregationBatch, 
  BuyerRequirement, 
  FarmerListing, 
  SubscriptionPlan,
  Order
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
  Lock
} from 'lucide-react';

export const AggregatorDashboard: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [batches, setBatches] = useState<AggregationBatch[]>([]);
  const [farmerListings, setFarmerListings] = useState<FarmerListing[]>([]);
  const [buyerReqs, setBuyerReqs] = useState<BuyerRequirement[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscription modal
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-pro');
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');

  // New Batch Modal
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [selectedReqForBatch, setSelectedReqForBatch] = useState<BuyerRequirement | null>(null);
  const [selectedFarmerListings, setSelectedFarmerListings] = useState<FarmerListing[]>([]);

  // Supply filter
  const [cropFilter, setCropFilter] = useState('All');

  const profile = user?.aggregatorProfile;
  const isSubscribed = profile?.subscriptionStatus === 'ACTIVE';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchRes, listRes, reqRes, planRes, ordRes] = await Promise.all([
        api.getBatches(),
        api.getListings(),
        api.getRequirements({ status: 'OPEN' }),
        api.getSubscriptionPlans(),
        api.getOrders()
      ]);
      setBatches(batchRes);
      setFarmerListings(listRes);
      setBuyerReqs(reqRes);
      setPlans(planRes);
      setOrders(ordRes);
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
        region: profile?.operatingRegion || 'Agra - Mathura - Firozabad Belt',
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

  const handleOpenBatchBuilder = (req: BuyerRequirement) => {
    if (user?.status === 'pending') {
      alert('Account pending admin approval. You can browse, but cannot create batches / make offers until verified.');
      return;
    }
    if (!isSubscribed) {
      alert('Active Aggregator Subscription required to create aggregation batches. Please activate a plan.');
      setShowSubscriptionModal(true);
      return;
    }
    setSelectedReqForBatch(req);
    // Find compatible farmers for this crop
    const compatible = farmerListings.filter(f => 
      f.cropName.toLowerCase() === req.cropName.toLowerCase() && f.status === 'ACTIVE'
    );
    setSelectedFarmerListings(compatible.slice(0, 3)); // Pre-select top compatible farmers
    setShowNewBatchModal(true);
  };

  const toggleFarmerSelection = (listing: FarmerListing) => {
    if (selectedFarmerListings.some(f => f.id === listing.id)) {
      setSelectedFarmerListings(selectedFarmerListings.filter(f => f.id !== listing.id));
    } else {
      setSelectedFarmerListings([...selectedFarmerListings, listing]);
    }
  };

  const handleCreateBatch = async () => {
    if (!selectedReqForBatch) return;
    if (user?.status === 'pending') {
      alert('Account pending admin approval. You can browse, but cannot create batches / make offers until verified.');
      return;
    }

    try {
      const farmersPayload = selectedFarmerListings.map(f => ({
        listingId: f.id,
        farmerId: f.farmerId,
        farmerName: f.farmerName,
        farmerLocation: f.farmerLocation,
        quantityTons: f.quantityTons,
        purchasePricePerKg: f.expectedPricePerKg
      }));

      await api.createBatch({
        buyerRequirementId: selectedReqForBatch.id,
        buyerName: selectedReqForBatch.buyerCompany,
        cropName: selectedReqForBatch.cropName,
        variety: selectedReqForBatch.variety,
        targetQuantityTons: selectedReqForBatch.quantityTons,
        buyerSalePricePerKg: selectedReqForBatch.offeredPricePerKg,
        farmers: farmersPayload
      });

      alert('Aggregation Batch Created Successfully!');
      setShowNewBatchModal(false);
      await fetchData();
    } catch (err) {
      alert('Error creating batch: ' + (err as Error).message);
    }
  };

  // Calculations for batch builder modal
  const currentTotalTons = selectedFarmerListings.reduce((sum, f) => sum + f.quantityTons, 0);
  const targetTons = selectedReqForBatch?.quantityTons || 1;
  const progressPercent = Math.min(100, Math.round((currentTotalTons / targetTons) * 100));

  // Economic gross margin simulation
  const buyerSalePrice = selectedReqForBatch?.offeredPricePerKg || 21;
  const avgFarmerCost = selectedFarmerListings.length > 0 
    ? Number((selectedFarmerListings.reduce((sum, f) => sum + (f.quantityTons * f.expectedPricePerKg), 0) / currentTotalTons).toFixed(2))
    : 18;
  const logisticsAndStorageCost = 1.25;
  const estimatedGrossMargin = Number((buyerSalePrice - (avgFarmerCost + logisticsAndStorageCost)).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Top Banner: Business Profile & Subscription Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xl border border-amber-200">
            📦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {profile?.businessName || 'Agra Agro Aggregations'}
              </h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                isSubscribed
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200'
              }`}>
                {isSubscribed ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Lock className="h-3 w-3 text-rose-600" />}
                {isSubscribed ? `${t('common.active')} (${profile?.subscribedPlanId?.replace('plan-', '').toUpperCase() || 'PRO'})` : t('common.pending')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t('aggregator.operatingZone')}: <strong className="text-slate-700">{profile?.operatingRegion || 'Agra - Mathura Belt'} (0-50 km)</strong> • Max: {profile?.maxAggregationCapacityTons || 150} {t('common.ton')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSubscriptionModal(true)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors ${
              isSubscribed
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>{isSubscribed ? t('aggregator.subscribe') : t('aggregator.subscriptionPlans')}</span>
          </button>
        </div>
      </div>

      {/* Aggregator Overview KPI Cards (Section 9) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">{t('aggregator.activeBatches')}</span>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{batches.length}</div>
          <span className="text-[10px] text-slate-500">Toward bulk demand</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">Total Aggregated</span>
          <div className="text-2xl font-extrabold text-agri-700 mt-1">
            {batches.reduce((sum, b) => sum + b.currentAggregatedTons, 0)} Tonnes
          </div>
          <span className="text-[10px] text-slate-500">From verified farms</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">Farmers Connected</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{farmerListings.length}</div>
          <span className="text-[10px] text-slate-500">Within service radius</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">Completed Turnovers</span>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{user?.completedOrders || 45}</div>
          <span className="text-[10px] text-slate-500">Escrow completed</span>
        </div>
      </div>

      {/* SECTION A: ACTIVE BATCH FULFILLMENT & PROGRESS (Section 10) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Current Aggregation Batches</h3>
            <p className="text-xs text-slate-500">Multi-farmer lot pooling toward large industrial buyer requirements.</p>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
            <Layers className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No active aggregation batches</p>
            <p className="text-xs text-slate-500 mt-1">Select a buyer bulk demand contract below to assemble your first batch.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((batch) => {
              const progress = Math.min(100, Math.round((batch.currentAggregatedTons / batch.targetQuantityTons) * 100));
              const isReady = batch.currentAggregatedTons >= batch.targetQuantityTons;

              return (
                <div 
                  key={batch.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-amber-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{batch.buyerName}</span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isReady ? '✓ READY TO FULFILL' : 'GATHERING SUPPLY'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Commodity: <strong>{batch.cropName} ({batch.variety})</strong> • Target: {batch.targetQuantityTons} Tonnes
                      </span>
                    </div>

                    {/* Transparent Economic Model: Estimated Gross Margin (Section 11) */}
                    <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/80 text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                        Estimated Gross Margin
                      </span>
                      <div className="text-sm font-extrabold text-amber-900">
                        ₹{batch.estimatedGrossMarginPerKg.toFixed(2)}<span className="text-xs font-normal text-slate-600">/kg</span>
                      </div>
                      <span className="text-[9px] text-slate-500">Buyer ₹{batch.buyerSalePricePerKg} - (Cost ₹{batch.farmerPurchasePriceAvg} + Log ₹{batch.estimatedLogisticsCostPerKg})</span>
                    </div>
                  </div>

                  {/* Visual Progress Bar (Section 10) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Aggregated Progress: <strong>{batch.currentAggregatedTons} / {batch.targetQuantityTons} Tonnes</strong>
                      </span>
                      <span className="font-bold text-amber-700">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isReady ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Farmers Sourced Table */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Participating Farmers Sourced ({batch.farmers?.length || 0}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {batch.farmers?.map((f, i) => (
                        <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">{f.farmerName}</span>
                            <span className="text-[10px] text-slate-400">{f.farmerLocation}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-agri-700 block">{f.quantityTons}T</span>
                            <span className="text-[10px] text-slate-500">@ ₹{f.purchasePricePerKg}/kg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Multi-stop Collection Route Preview (Section 27) */}
                  {batch.collectionRoute && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-slate-600" />
                          Consolidated Multi-Stop Collection Route ({batch.collectionRoute.totalDistanceKm} km)
                        </span>
                        <span className="text-[11px] text-slate-600 font-semibold">
                          Logistics: ₹{batch.collectionRoute.estimatedCostPerKg}/kg
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                        {batch.collectionRoute.stops?.map((stop, sIdx) => (
                          <span key={sIdx} className="bg-white px-2 py-0.5 rounded border border-slate-200">
                            {stop}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION B: OPEN BUYER BULK DEMANDS (OPPORTUNITIES TO AGGREGATE) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Bulk Buyer Procurement Opportunities
            </h3>
            <p className="text-xs text-slate-500">Match requirements exceeding single farm capacities.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buyerReqs.map((req) => (
            <div 
              key={req.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all space-y-3"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900">{req.buyerCompany}</span>
                    <h4 className="text-base font-extrabold text-agri-800 mt-0.5">
                      Need {req.quantityTons}T {req.cropName} ({req.variety})
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-amber-700">₹{req.offeredPricePerKg}</span>
                    <span className="text-[10px] text-slate-400 block">per kg offered</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-3">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Quality Grade:</span>
                    <span className="font-semibold text-slate-800">{req.gradeRequired}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Size Required:</span>
                    <span className="font-medium text-slate-700">{req.sizeMinMm}-{req.sizeMaxMm} mm</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Target Date:</span>
                    <span className="font-medium text-slate-700">{req.requiredDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Location:</span>
                    <span className="font-medium text-slate-700 truncate block">{req.location}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleOpenBatchBuilder(req)}
                disabled={user?.status === 'pending'}
                title={user?.status === 'pending' ? 'Account pending approval' : 'Build Aggregation Batch for this Contract'}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs ${
                  user?.status === 'pending'
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>{user?.status === 'pending' ? 'Account Pending Approval' : 'Build Aggregation Batch for this Contract'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION C: LOCAL FARMER SUPPLY EXPLORER (Section 9) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Farmer Supply in Your Operating Radius ({profile?.serviceRadiusKm || 50} km)
            </h3>
            <p className="text-xs text-slate-500">Contact and commit small lots into your aggregation batches.</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
            >
              <option value="All">All Commodities</option>
              <option value="Potato">Potato</option>
              <option value="Tomato">Tomato</option>
              <option value="Wheat">Wheat</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Farmer & Location</th>
                  <th className="p-3.5">Crop & Variety</th>
                  <th className="p-3.5">Quantity</th>
                  <th className="p-3.5">Grade / Size</th>
                  <th className="p-3.5">Expected Price</th>
                  <th className="p-3.5">Verification</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {farmerListings
                  .filter(l => cropFilter === 'All' || l.cropName.toLowerCase() === cropFilter.toLowerCase())
                  .map((list) => (
                    <tr key={list.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <span className="font-bold text-slate-900 block">{list.farmerName}</span>
                        <span className="text-[10px] text-slate-400">{list.farmerLocation}</span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        {list.cropName} <span className="text-slate-400 font-normal">({list.variety})</span>
                      </td>
                      <td className="p-3.5 font-bold text-amber-700">
                        {list.quantityTons} Tonnes
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-800 block">{list.grade}</span>
                        <span className="text-[10px] text-slate-500">{list.sizeMinMm}-{list.sizeMaxMm} mm</span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        ₹{list.expectedPricePerKg}/kg
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          list.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {list.verificationStatus === 'VERIFIED' ? '✓ Verified' : 'Self-Declared'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => alert(`Contact details for ${list.farmerName}: ${list.farmerPhone} (${list.farmerLocation})`)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                        >
                          Contact Farmer
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: BATCH AGGREGATION BUILDER (Section 10 & 11) */}
      {showNewBatchModal && selectedReqForBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Build Aggregation Batch: {selectedReqForBatch.quantityTons}T {selectedReqForBatch.cropName}
                </h3>
                <p className="text-xs text-slate-500">Fulfill bulk demand for {selectedReqForBatch.buyerCompany}.</p>
              </div>
              <button 
                onClick={() => setShowNewBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Live Progress Bar toward 100T Buyer Need */}
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-950">
                  Total Committed Supply: {currentTotalTons} / {targetTons} Tonnes
                </span>
                <span className="font-extrabold text-amber-800">{progressPercent}%</span>
              </div>
              <div className="w-full bg-amber-200/50 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    progressPercent >= 100 ? 'bg-emerald-500' : 'bg-amber-600'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Buyer Sale Price: ₹{buyerSalePrice}/kg</span>
                <span>Avg Purchase Cost: ₹{avgFarmerCost}/kg</span>
                <span className="font-bold text-emerald-700">Est. Gross Margin: ₹{estimatedGrossMargin}/kg</span>
              </div>
            </div>

            {/* Select Farmers Checklist */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Select Eligible Farmers in Catchment Area:
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {farmerListings
                  .filter(f => f.cropName.toLowerCase() === selectedReqForBatch.cropName.toLowerCase())
                  .map((f) => {
                    const isSelected = selectedFarmerListings.some(item => item.id === f.id);
                    return (
                      <div 
                        key={f.id}
                        onClick={() => toggleFarmerSelection(f)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => {}} 
                            className="rounded text-agri-600"
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">{f.farmerName}</span>
                            <span className="text-[10px] text-slate-500">{f.farmerLocation} • {f.grade}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-amber-700 text-xs block">{f.quantityTons} Tonnes</span>
                          <span className="text-[10px] text-slate-500">Ask: ₹{f.expectedPricePerKg}/kg</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewBatchModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBatch}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm"
              >
                Confirm Aggregation Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBSCRIPTION PLANS (Section 7) */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Local Aggregator Subscription Plans</h3>
                <p className="text-xs text-slate-500">Choose a tier to unlock bulk pooling, farmer supply contact, and demand contracts.</p>
              </div>
              <button 
                onClick={() => setShowSubscriptionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/30 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{p.name}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">{p.badge}</span>
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900">
                        ₹{p.monthlyPrice}<span className="text-xs font-normal text-slate-500">/month</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{p.description}</p>
                      
                      <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                        <li>• Max {p.maxFarmers} Farmers per batch</li>
                        <li>• Up to {p.maxActiveBatches} Active Batches</li>
                        <li>• {p.maxAggregationCapacityTons}T Aggregation Cap</li>
                        {p.analyticsAccess && <li>• Demand Intelligence & Alerts</li>}
                        {p.storageAccess && <li>• Cold Storage Direct Booking</li>}
                      </ul>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubscribe(p.id);
                      }}
                      className={`mt-6 w-full py-2.5 rounded-xl font-bold text-xs transition-colors ${
                        isSelected
                          ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Select & Activate
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              Payment is simulated for this prototype demonstration. Pricing and limits are dynamically configurable via the Admin Panel.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
