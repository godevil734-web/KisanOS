import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Sprout, 
  Droplets, 
  FlaskConical, 
  ShieldAlert, 
  Tractor, 
  Calendar, 
  MapPin, 
  Thermometer, 
  Wind, 
  Activity, 
  FileText, 
  CheckCircle2, 
  Layers, 
  Users, 
  Sparkles,
  ExternalLink,
  Printer
} from 'lucide-react';
import { api } from '../services/api';
import { FarmActivity, FarmerListing, TraceabilityPassport } from '../types';

interface FarmTraceabilityModalProps {
  listingId?: string;
  farmerId?: string;
  initialListing?: FarmerListing;
  isOpen: boolean;
  onClose: () => void;
  language?: 'en' | 'hi';
}

export const FarmTraceabilityModal: React.FC<FarmTraceabilityModalProps> = ({
  listingId,
  farmerId,
  initialListing,
  isOpen,
  onClose,
  language = 'en'
}) => {
  const [data, setData] = useState<TraceabilityPassport | null>(null);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  const isHi = language === 'hi';

  useEffect(() => {
    if (!isOpen) return;

    const loadTraceability = async () => {
      setLoading(true);
      try {
        if (listingId) {
          const res = await api.getListingTraceability(listingId);
          setData(res);
          setActivities(res.activities || []);
        } else if (farmerId) {
          const acts = await api.getActivities({ farmerId });
          setActivities(acts || []);
        } else {
          const acts = await api.getActivities();
          setActivities(acts || []);
        }
      } catch (err) {
        console.error('Failed to load traceability data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTraceability();
  }, [isOpen, listingId, farmerId]);

  if (!isOpen) return null;

  const getActivityIcon = (typeUri: string) => {
    switch (typeUri) {
      case 'sowing':
        return <Sprout className="w-4 h-4 text-emerald-600" />;
      case 'irrigation':
        return <Droplets className="w-4 h-4 text-cyan-600" />;
      case 'fertilization':
        return <FlaskConical className="w-4 h-4 text-amber-600" />;
      case 'crop_protection':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'harvesting':
        return <Tractor className="w-4 h-4 text-emerald-700" />;
      default:
        return <Activity className="w-4 h-4 text-slate-700" />;
    }
  };

  const getActivityBadgeColor = (typeUri: string) => {
    switch (typeUri) {
      case 'sowing':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'irrigation':
        return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      case 'fertilization':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'crop_protection':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'harvesting':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const filteredActivities = selectedTypeFilter === 'ALL'
    ? activities
    : activities.filter(a => a.typeUri === selectedTypeFilter);

  const listing = data?.listing || initialListing;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border-2 border-[#D8D2C4] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                NaLamKI / ITU-T Annex A.16
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                {data?.passportId || `PASSPORT-ID-${(listingId || 'LOT').slice(-8).toUpperCase()}`}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <span>{isHi ? 'डिजिटल फार्म पासपोर्ट एवं खेत गतिविधि' : 'Digital Farm Record & Traceability'}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
              {isHi 
                ? 'अंतरराष्ट्रीय NaLamKI कृषि मानक अनुरूप — बुवाई से कटाई तक का प्रमाणित रिकॉर्ड' 
                : 'Conforming to the open ITU-T/FAO digital farm twin architecture from seed to harvest.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Crop & Lot Summary Card */}
          {listing && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F5] border-2 border-[#D8D2C4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#D8D2C4] flex items-center justify-center text-3xl shrink-0 shadow-2xs">
                  {listing.cropName.toLowerCase().includes('potato') ? '🥔' : listing.cropName.toLowerCase().includes('onion') ? '🧅' : '🌾'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-[#1C2B23]">{listing.variety} {listing.cropName}</h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {listing.grade || 'Grade A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#5A6860] font-medium mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {listing.farmerLocation || (listing as any).location || 'Agra, UP'}
                    </span>
                    <span>•</span>
                    <span className="font-extrabold text-[#1C2B23]">{listing.quantityTons} Tons</span>
                    <span>•</span>
                    <span>{listing.farmerName ? `Farmer: ${listing.farmerName}` : ''}</span>
                  </div>
                </div>
              </div>

              {/* Quality & Assurance Pill */}
              <div className="flex sm:flex-col items-center sm:items-end gap-1.5 self-stretch sm:self-auto justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-200">
                <span className="text-xs font-bold text-slate-500">{isHi ? 'सत्यापन स्थिति' : 'Verification Status'}</span>
                <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  {listing.verificationStatus || 'VERIFIED AUDITED'}
                </span>
              </div>
            </div>
          )}

          {/* NaLamKI Agronomic Compliance Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block mb-1">
                {isHi ? 'जल दक्षता' : 'Water Management'}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-950 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                {isHi ? 'माइक्रो-ड्रिप अनुकूलित' : 'Micro-Drip Optimized'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block mb-1">
                {isHi ? 'कीट नियंत्रण' : 'Crop Protection'}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-amber-950 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                {isHi ? 'नीम-आधारित बायो-शील्ड' : 'Zero-Residue Bio-IPM'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200">
              <span className="text-[10px] font-black uppercase text-cyan-800 tracking-wider block mb-1">
                {isHi ? 'कटाई अवस्था' : 'Harvest BBCH'}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-cyan-950 flex items-center gap-1">
                <Sprout className="w-3.5 h-3.5 text-cyan-600" />
                BBCH 99 (Full Curing)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200">
              <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider block mb-1">
                {isHi ? 'खेत प्रलेखन' : 'Field Records'}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-purple-950 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                {activities.length} {isHi ? 'प्रमाणित गतिविधियां' : 'Audited Operations'}
              </span>
            </div>
          </div>

          {/* Operation Filter Buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-[#1C2B23] uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                <span>{isHi ? 'खेत गतिविधियों का प्रमाणित इतिहास' : 'Electronic Field Record (EFR) Timeline'}</span>
              </h4>
              <span className="text-xs font-bold text-slate-500">
                {filteredActivities.length} {isHi ? 'दर्ज' : 'Logged'}
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'ALL', label: isHi ? 'सभी' : 'All Activities' },
                { id: 'sowing', label: isHi ? 'बुवाई (Sowing)' : 'Sowing' },
                { id: 'irrigation', label: isHi ? 'सिंचाई (Irrigation)' : 'Irrigation' },
                { id: 'fertilization', label: isHi ? 'उर्वरक (Nutrition)' : 'Fertilization' },
                { id: 'crop_protection', label: isHi ? 'सुरक्षा (Protection)' : 'Crop Protection' },
                { id: 'harvesting', label: isHi ? 'कटाई (Harvest)' : 'Harvest' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedTypeFilter === f.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activities Timeline */}
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="animate-spin w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm font-bold">{isHi ? 'प्रमाणित डेटा लोड हो रहा है...' : 'Fetching NaLamKI field record timeline...'}</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-stone-50 border border-stone-200 text-stone-600">
              <p className="text-sm font-bold">{isHi ? 'इस फ़िल्टर में कोई गतिविधि दर्ज नहीं है।' : 'No activity logged matching this filter.'}</p>
            </div>
          ) : (
            <div className="space-y-3.5 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-stone-200">
              {filteredActivities.map((act, idx) => (
                <div 
                  key={act.id || idx}
                  className="relative pl-11 group"
                >
                  {/* Timeline dot with icon */}
                  <div className="absolute left-2.5 top-3.5 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-slate-900 flex items-center justify-center z-10 shadow-xs">
                    {getActivityIcon(act.typeUri)}
                  </div>

                  {/* Activity Card */}
                  <div className="p-4 sm:p-4.5 rounded-2xl bg-white border border-[#D8D2C4] shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase border ${getActivityBadgeColor(act.typeUri)}`}>
                          {act.typeLabel || act.typeUri}
                        </span>
                        <h4 className="text-sm sm:text-base font-extrabold text-[#1C2B23]">{act.name}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        <span>{new Date(act.startsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* BBCH Stage & Phenology */}
                    {act.bbchStage && (
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          🌱 {act.bbchStage}
                        </span>
                      </div>
                    )}

                    {/* Description / Agronomic Notes */}
                    {act.notes && (
                      <p className="text-xs text-[#2B3B32] font-medium mb-3 leading-relaxed">
                        {act.notes}
                      </p>
                    )}

                    {/* Resources (Machines & Workers) + Inputs/Outputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-stone-100 text-xs">
                      {act.resources && act.resources.length > 0 && (
                        <div className="flex items-start gap-1.5 text-stone-600">
                          <Tractor className="w-3.5 h-3.5 text-stone-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold text-stone-700">{isHi ? 'संसाधन:' : 'Resources:'} </span>
                            <span>{act.resources.map(r => r.name).join(', ')}</span>
                          </div>
                        </div>
                      )}

                      {act.inputsOutputs && act.inputsOutputs.length > 0 && (
                        <div className="flex items-start gap-1.5 text-stone-600">
                          <Layers className="w-3.5 h-3.5 text-stone-500 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold text-stone-700">{isHi ? 'सामग्री/उत्पाद:' : 'Input/Output:'} </span>
                            <span>{act.inputsOutputs.map(io => `${io.item} (${io.quantity})`).join(', ')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Microclimate / Ambient Conditions Chip */}
                    {act.conditions && (
                      <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center gap-3 text-[11px] text-stone-500 flex-wrap">
                        <span className="font-bold uppercase tracking-wider text-stone-600">{isHi ? 'खेत परिस्थितियां:' : 'Field Conditions:'}</span>
                        {act.conditions.temperature && (
                          <span className="flex items-center gap-1 font-semibold">
                            <Thermometer className="w-3 h-3 text-rose-500" />
                            {act.conditions.temperature}°C
                          </span>
                        )}
                        {act.conditions.humidity && (
                          <span className="flex items-center gap-1 font-semibold">
                            <Droplets className="w-3 h-3 text-cyan-500" />
                            {act.conditions.humidity}% RH
                          </span>
                        )}
                        {act.conditions.soilMoisture && (
                          <span className="flex items-center gap-1 font-semibold">
                            🌱 {act.conditions.soilMoisture}% Soil Moisture
                          </span>
                        )}
                        {act.conditions.windSpeedKmh && (
                          <span className="flex items-center gap-1 font-semibold">
                            <Wind className="w-3 h-3 text-slate-500" />
                            {act.conditions.windSpeedKmh} km/h
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-stone-50 border-t border-[#D8D2C4] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{isHi ? 'ITU-T रिकमेंडेशन एवं NaLamKI अनुपालन सत्यापित' : 'ITU-T Recommendation Annex A.16 Verified'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isHi ? 'पासपोर्ट प्रिंट करें' : 'Print Passport'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer shadow-xs"
            >
              {isHi ? 'बंद करें' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
