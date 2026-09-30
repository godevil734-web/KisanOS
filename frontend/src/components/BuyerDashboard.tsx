import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  MapPin
} from 'lucide-react';

export const BuyerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<BuyerRequirement[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'requirements' | 'supply_discovery' | 'orders'>('requirements');
  const [loading, setLoading] = useState(true);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, cropRes, ordRes] = await Promise.all([
        api.getRequirements({ buyerId: user?.id || '' }),
        api.getCrops(),
        api.getOrders()
      ]);
      setRequirements(reqRes);
      setCrops(cropRes);
      setOrders(ordRes);

      if (reqRes.length > 0) {
        handleDiscoverSupply(reqRes[0]);
      }
    } catch (err) {
      console.error('Error fetching buyer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
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
            onClick={() => setShowPostModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-4 w-4 text-emerald-400" />
            <span>Post Bulk Requirement</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'requirements', label: `My Demand Specifications (${requirements.length})`, icon: ShoppingBag },
          { id: 'supply_discovery', label: 'Multi-Channel Supply Discovery', icon: Sparkles },
          { id: 'orders', label: `Procurement Orders (${orders.length})`, icon: Truck },
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
            <button
              onClick={() => setShowPostModal(true)}
              className="text-xs text-blue-700 font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              New Procurement Specification
            </button>
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
                      <span className="font-bold text-slate-700">{m.listing.quantityTons} Tonnes</span>
                      <span className="font-bold text-agri-700">₹{m.listing.expectedPricePerKg}/kg</span>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          await api.createOffer({
                            requirementId: selectedReqForDiscovery?.id,
                            listingId: m.listing.id,
                            sellerId: m.listing.farmerId,
                            sellerName: m.listing.farmerName,
                            cropName: m.listing.cropName,
                            variety: m.listing.variety,
                            quantityTons: m.listing.quantityTons,
                            offeredPricePerKg: selectedReqForDiscovery?.offeredPricePerKg,
                            deliveryTerms: selectedReqForDiscovery?.deliveryType
                          });
                          alert(`Offer sent to ${m.listing.farmerName}!`);
                        } catch (e) {
                          alert('Error sending offer: ' + (e as Error).message);
                        }
                      }}
                      className="w-full py-1.5 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-bold text-xs transition-colors"
                    >
                      Make Direct Farm Offer
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

      {/* TAB 3: PROCUREMENT ORDERS & ESCROW LIFECYCLE */}
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
    </div>
  );
};
