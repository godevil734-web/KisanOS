import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { ColdStorage, StorageBooking } from '../types';
import { 
  Warehouse, 
  ThermometerSnowflake, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Plus, 
  FileText, 
  AlertCircle,
  TrendingUp,
  Percent,
  Layers
} from 'lucide-react';

export const ColdStorageDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [facilities, setFacilities] = useState<ColdStorage[]>([]);
  const [selectedStorage, setSelectedStorage] = useState<ColdStorage | null>(null);
  const [bookings, setBookings] = useState<StorageBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // New storage booking simulation modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [newBooking, setNewBooking] = useState({
    cropName: 'Potato',
    variety: 'Kufri Chipsona',
    quantityTons: 25,
    durationMonths: 3
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const storages = await api.getStorageFacilities();
      setFacilities(storages);
      if (storages.length > 0) {
        setSelectedStorage(storages[0]);
      }
      const myBookings = await api.getMyStorageBookings();
      setBookings(myBookings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleBookSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStorage) return;

    try {
      await api.bookStorage({
        storageId: selectedStorage.id,
        cropName: newBooking.cropName,
        variety: newBooking.variety,
        quantityTons: newBooking.quantityTons,
        durationMonths: newBooking.durationMonths
      });
      alert('Storage Space Booked! Digital Receipt issued.');
      setShowBookingModal(false);
      await fetchData();
    } catch (err) {
      alert('Error booking storage: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-cyan-100 text-cyan-900 flex items-center justify-center font-bold text-xl border border-cyan-200">
            ❄️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {selectedStorage?.name || 'Agra Imperial Cold Logistics & CA Store'}
              </h1>
              <span className="text-xs bg-cyan-100 text-cyan-800 px-2.5 py-0.5 rounded-full font-bold border border-cyan-200 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-cyan-600" />
                Licensed CA Operator
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Location: {selectedStorage?.location} • Standard Charge: <strong>₹{selectedStorage?.storageChargePerMonthPerTon || 450}/Ton/Month</strong> (≈₹0.45/kg)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBookingModal(true)}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Book Inflow Inventory</span>
          </button>
        </div>
      </div>

      {/* Section 23: Cold Storage Capacity Utilization Dashboard */}
      {selectedStorage && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">{t('storage.totalCapacity')}</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {selectedStorage.totalCapacityTons.toLocaleString()} T
              </div>
              <span className="text-[10px] text-slate-500">Insured CA chambers</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">{t('storage.occupied')}</span>
              <div className="text-2xl font-extrabold text-cyan-800 mt-1">
                {selectedStorage.occupiedCapacityTons.toLocaleString()} T
              </div>
              <span className="text-[10px] text-cyan-600 font-semibold">Active produce held</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">{t('storage.available')}</span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                {selectedStorage.availableCapacityTons.toLocaleString()} T
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">Ready for immediate intake</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">{t('storage.capacityTracker')}</span>
              <div className="text-2xl font-extrabold text-purple-700 mt-1">
                {selectedStorage.utilizationPercent}%
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div 
                  className="bg-purple-600 h-full rounded-full" 
                  style={{ width: `${selectedStorage.utilizationPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Section 23: Crop Inventory Breakdown & Scheduled Release Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inventory Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-cyan-600" />
                  <h3 className="text-sm font-bold text-slate-900">Stored Crop Inventory Breakdown</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">By commodity</span>
              </div>

              <div className="space-y-3">
                {selectedStorage.inventory.map((inv, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{inv.cropName}</span>
                        <span className="text-[10px] text-slate-500">Variety: {inv.variety}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-cyan-900">{inv.quantityTons} Tonnes</span>
                        <span className="text-[10px] text-slate-400 block">{inv.occupiedPercent}% of total</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-cyan-600 h-full rounded-full" 
                        style={{ width: `${inv.occupiedPercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expected Release Schedule */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">Projected Market Release Schedule</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">Upcoming out-turns</span>
              </div>

              <div className="space-y-3">
                {selectedStorage.inventory[0]?.expectedReleaseMonths?.map((rel, rIdx) => (
                  <div key={rIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-xs">
                        📅
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{rel.month}</span>
                        <span className="text-[10px] text-slate-500">Contractual farm holding expiry</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-purple-900 text-sm">{rel.quantityTons} Tonnes</span>
                      <span className="text-[10px] text-slate-400 block">Scheduled dispatch</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cold storage equipment specs */}
              <div className="bg-cyan-50/50 p-3 rounded-xl border border-cyan-100 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-900 block">
                  Cold Storage Technical Facilities:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStorage.facilities.map((fac, fIdx) => (
                    <span key={fIdx} className="text-[10px] bg-white text-cyan-950 font-semibold px-2 py-0.5 rounded border border-cyan-200">
                      ✓ {fac}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BOOK COLD STORAGE INFLOW */}
      {showBookingModal && selectedStorage && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Book Cold Storage Intake</h3>
                <p className="text-xs text-slate-500">Reserve space at {selectedStorage.name}.</p>
              </div>
              <button 
                onClick={() => setShowBookingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookSpace} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Crop</label>
                <input
                  type="text"
                  value={newBooking.cropName}
                  onChange={(e) => setNewBooking({ ...newBooking, cropName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Quantity (Tonnes)</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedStorage.availableCapacityTons}
                    value={newBooking.quantityTons}
                    onChange={(e) => setNewBooking({ ...newBooking, quantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Duration (Months)</label>
                  <select
                    value={newBooking.durationMonths}
                    onChange={(e) => setNewBooking({ ...newBooking, durationMonths: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                  >
                    <option value={1}>1 Month</option>
                    <option value={2}>2 Months</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200 text-xs text-cyan-900 space-y-1">
                <div className="flex justify-between">
                  <span>Monthly Rate:</span>
                  <span className="font-bold">₹{selectedStorage.storageChargePerMonthPerTon} / Ton / Mo</span>
                </div>
                <div className="flex justify-between font-extrabold text-cyan-950 pt-1 border-t border-cyan-200">
                  <span>Total Estimated Storage Charge:</span>
                  <span>₹{(newBooking.quantityTons * selectedStorage.storageChargePerMonthPerTon * newBooking.durationMonths).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-sm"
                >
                  Issue Digital Deposit Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
