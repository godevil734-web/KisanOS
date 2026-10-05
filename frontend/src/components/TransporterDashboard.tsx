import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { Transporter, TransporterVehicle, Order } from '../types';
import { 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Plus, 
  DollarSign, 
  Route, 
  Clock, 
  Navigation,
  FileCheck,
  ShieldCheck,
  Scale
} from 'lucide-react';

export const TransporterDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-stop route calculation simulator (Section 27)
  const [routeStops, setRouteStops] = useState<string[]>([
    'Stop 1: Farah, Mathura (Mahendra Yadav - 20T)',
    'Stop 2: Khandauli, Agra (Ramesh Kumar - 15T)',
    'Stop 3: Tundla, Firozabad (Suresh Patel - 12T)',
    'Destination: FreshBites Processing Hub, Okhla'
  ]);
  const [routeCalcResult, setRouteCalcResult] = useState<any>(null);
  const [selectedVehicleType, setSelectedVehicleType] = useState('Tata 16-Wheeler Heavy Truck');
  const [totalQuantityTons, setTotalQuantityTons] = useState(47);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trpRes, ordRes] = await Promise.all([
        api.getTransporters(),
        api.getOrders()
      ]);
      setTransporters(trpRes);
      setOrders(ordRes);
      runRouteCalculation();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const runRouteCalculation = async () => {
    try {
      const res = await api.calculateRoute({
        stops: routeStops,
        totalQuantityTons,
        vehicleType: selectedVehicleType
      });
      setRouteCalcResult(res);
    } catch (e) {
      console.error(e);
    }
  };

  const currentTransporter = transporters[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xl border border-amber-200">
            🚚
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {currentTransporter?.companyName || 'Kisan Express Agri Freight'}
              </h1>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Verified Freight Carrier
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Base: {currentTransporter?.baseLocation || 'Agra NH-19 Transit Circle'} • Fleet Size: {currentTransporter?.vehicles?.length || 3} Commercial Vehicles • Completed: {currentTransporter?.totalTripsCompleted || 142} Dispatches
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 block">Fleet Availability</span>
          <span className="text-sm font-extrabold text-emerald-700">3 Vehicles Ready</span>
        </div>
      </div>

      {/* Vehicle Fleet Cards (Section 25) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">
          {t('transport.fleetDirectory')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {currentTransporter?.vehicles?.map((veh) => (
            <div key={veh.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Reg: {veh.registrationNumber}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">{veh.vehicleType}</h4>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  {veh.availability}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] block">Payload Capacity:</span>
                  <span className="font-extrabold text-slate-800">{veh.capacityTons} Tonnes</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Tariff Rate:</span>
                  <span className="font-bold text-agri-700">₹{veh.ratePerKm}/km</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 text-[10px] block">Current Location:</span>
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {veh.currentLocation}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500">
                Ideal for: {veh.suitedCrops.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 27: AGGREGATED MULTI-STOP LOGISTICS OPTIMIZER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-agri-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Aggregated Rural Collection Route Planner (Section 27)
            </h3>
            <p className="text-xs text-slate-500">
              Instead of 5 individual trips from fragmented farms, consolidate into ONE efficient multi-stop collection corridor.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Vehicle Assignment</label>
            <select
              value={selectedVehicleType}
              onChange={(e) => setSelectedVehicleType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
            >
              <option value="Tata 16-Wheeler Heavy Truck">Tata 16-Wheeler (22T Bulk)</option>
              <option value="Eicher Canter 17ft (Ventilated)">Eicher Canter (6T)</option>
              <option value="Mahindra Bolero Maxi Truck">Bolero Maxi Truck (2T)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Consolidated Payload (Tons)</label>
            <input
              type="number"
              value={totalQuantityTons}
              onChange={(e) => setTotalQuantityTons(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-agri-700"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={runRouteCalculation}
              className="w-full py-2.5 px-4 rounded-xl bg-agri-600 hover:bg-agri-700 text-white font-bold text-xs transition-colors shadow-xs"
            >
              Recalculate Route Freight
            </button>
          </div>
        </div>

        {/* Route Stops Sequence */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Pickup Stops Sequence:
          </span>
          <div className="space-y-2">
            {routeStops.map((stop, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-agri-100 text-agri-800 font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-800">{stop}</span>
                </div>
                <span className="text-[10px] text-slate-400">Scheduled Stop</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calculated Results Strip (Section 27 formula) */}
        {routeCalcResult && (
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Total Route Distance</span>
              <div className="text-xl font-extrabold text-emerald-950 mt-0.5">{routeCalcResult.totalDistanceKm} km</div>
              <span className="text-[10px] text-slate-500">Agra-Mathura Belt</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Total Freight Invoice</span>
              <div className="text-xl font-extrabold text-emerald-950 mt-0.5">₹{routeCalcResult.totalTransportCost.toLocaleString()}</div>
              <span className="text-[10px] text-slate-500">Base + ₹{routeCalcResult.ratePerKm}/km</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Effective Transport Cost</span>
              <div className="text-xl font-extrabold text-agri-700 mt-0.5">₹{routeCalcResult.costPerKg}<span className="text-xs font-normal">/kg</span></div>
              <span className="text-[10px] text-slate-500">Shared across farmers</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Estimated Transit</span>
              <div className="text-xl font-extrabold text-emerald-950 mt-0.5">≈ {routeCalcResult.estimatedTransitHours} Hours</div>
              <span className="text-[10px] text-slate-500">Includes loading delays</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
