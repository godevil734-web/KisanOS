import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  RefreshCw, 
  Droplets, 
  Wind, 
  CloudRain, 
  Compass, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Calendar,
  Clock,
  ChevronRight
} from 'lucide-react';
import { FarmWeatherResponse } from '../services/api';
import { FarmLocationData } from '../hooks/useFarmLocation';

interface FarmWeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  weather: FarmWeatherResponse | null;
  location: FarmLocationData;
  isLoading: boolean;
  isStale: boolean;
  staleReason?: string;
  errorMessage?: string | null;
  onRefresh: () => void;
  onRequestGps: () => void;
  onSaveManualLocation: (details: { village: string; district: string; state: string }) => void;
  themeVariant?: 'harvest' | 'classic';
}

export const FarmWeatherModal: React.FC<FarmWeatherModalProps> = ({
  isOpen,
  onClose,
  weather,
  location,
  isLoading,
  isStale,
  staleReason,
  errorMessage,
  onRefresh,
  onRequestGps,
  onSaveManualLocation,
  themeVariant = 'harvest'
}) => {
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'advisories' | 'location'>('hourly');
  const [manualVillage, setManualVillage] = useState(location.village || '');
  const [manualDistrict, setManualDistrict] = useState(location.district || 'Agra');
  const [manualState, setManualState] = useState(location.state || 'Uttar Pradesh');
  const [showLocationForm, setShowLocationForm] = useState(false);

  if (!isOpen) return null;

  const isHarvest = themeVariant === 'harvest';

  const current = weather?.current;
  const hourly = weather?.hourly24 || [];
  const daily = weather?.daily7 || [];
  const advisories = weather?.advisories || [];

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDistrict.trim()) return;
    onSaveManualLocation({
      village: manualVillage.trim(),
      district: manualDistrict.trim(),
      state: manualState.trim()
    });
    setShowLocationForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className={`relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden ${
          isHarvest ? 'border-[#A3D1A5]' : 'border-emerald-200'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between text-white shrink-0 ${
          isHarvest ? 'bg-gradient-to-r from-[#104B35] to-[#176B45]' : 'bg-gradient-to-r from-emerald-800 to-teal-700'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl">{current?.icon || '🌤️'}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  किसान मौसम सेवा (Farm Weather Intelligence)
                </h3>
                {isStale && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-wider">
                    पुराना डेटा
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-100 font-medium">
                <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                <span className="font-bold">{location.displayName || 'Khandauli, Agra, UP'}</span>
                <span>•</span>
                <span>Open-Meteo Live API</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="मौसम रीफ्रेश करें"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="बंद करें"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stale or Error Alert */}
        {isStale && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{staleReason || 'नेटवर्क समस्या के कारण अंतिम उपलब्ध मान्य मौसम डेटा दिखाया जा रहा है।'}</span>
            </div>
            <button
              onClick={onRefresh}
              className="font-bold underline text-amber-950 hover:text-amber-800 shrink-0 cursor-pointer"
            >
              पुनः प्रयास
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5">
          {/* Top: Current Weather Spotlight */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
            isHarvest ? 'bg-[#FAF6ED] border-[#E5E0D5]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-4 text-center md:text-left">
              <span className="text-5xl">{current?.icon || '☀️'}</span>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900">
                    {current?.temperature !== undefined ? `${current.temperature}°C` : '--°C'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    (आभासी {current?.apparentTemperature !== undefined ? `${current.apparentTemperature}°C` : '--'})
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-700">
                  {current?.condition || 'साफ आसमान'} • <span className="text-slate-500 font-normal">{current?.conditionEn}</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">आर्द्रता (Humidity)</div>
                  <div className="font-extrabold text-slate-900">{current?.humidity ?? 65}%</div>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-2">
                <Wind className="h-4 w-4 text-teal-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">हवा (Wind)</div>
                  <div className="font-extrabold text-slate-900">{current?.windSpeedKmh ?? 8} km/h</div>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-2">
                <CloudRain className="h-4 w-4 text-indigo-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">वर्षा (Rain)</div>
                  <div className="font-extrabold text-slate-900">{current?.precipitationMm ?? 0} mm</div>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">दबाव (Pressure)</div>
                  <div className="font-extrabold text-slate-900">{current?.pressureHpa ?? 1012} hPa</div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab('hourly')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'hourly'
                  ? (isHarvest ? 'bg-[#176B45] text-white' : 'bg-emerald-700 text-white')
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>अगले 24 घंटे (Next 24h)</span>
            </button>

            <button
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'daily'
                  ? (isHarvest ? 'bg-[#176B45] text-white' : 'bg-emerald-700 text-white')
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>7 दिन का पूर्वानुमान (7-Day Forecast)</span>
            </button>

            <button
              onClick={() => setActiveTab('advisories')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'advisories'
                  ? (isHarvest ? 'bg-[#176B45] text-white' : 'bg-emerald-700 text-white')
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>कृषि सुझाव (Farm Advisories)</span>
            </button>

            <button
              onClick={() => setActiveTab('location')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto ${
                activeTab === 'location'
                  ? (isHarvest ? 'bg-[#176B45] text-white' : 'bg-emerald-700 text-white')
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>खेत का स्थान (Location)</span>
            </button>
          </div>

          {/* TAB 1: 24-HOUR HOURLY FORECAST */}
          {activeTab === 'hourly' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>प्रति घंटा मौसम पूर्वानुमान (Next 24 Hours)</span>
                <span className="text-[11px] text-slate-500 font-normal">दाएं स्क्रॉल करें →</span>
              </div>

              {hourly.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  प्रति घंटा डेटा लोड हो रहा है...
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 scrollbar-thin">
                  {hourly.map((h, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs text-center shrink-0 w-24 flex flex-col justify-between space-y-1.5 hover:border-emerald-400 transition-colors"
                    >
                      <div className="text-[11px] font-bold text-slate-600">{h.hour}</div>
                      <div className="text-2xl">{h.icon}</div>
                      <div className="text-sm font-black text-slate-900">{h.temperature}°C</div>
                      <div className="text-[10px] text-blue-600 font-bold flex items-center justify-center gap-0.5">
                        <Droplets className="h-2.5 w-2.5" />
                        <span>{h.rainProbability}%</span>
                      </div>
                      <div className="text-[9px] text-slate-400 leading-tight truncate" title={h.condition}>
                        {h.condition}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 7-DAY DAILY FORECAST */}
          {activeTab === 'daily' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700">
                साप्ताहिक मौसम पूर्वानुमान (7-Day Overview)
              </div>

              {daily.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  साप्ताहिक डेटा लोड हो रहा है...
                </div>
              ) : (
                <div className="space-y-2">
                  {daily.map((d, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 hover:border-emerald-400 transition-all text-xs"
                    >
                      <div className="w-28 flex items-center gap-2">
                        <span className="text-xl">{d.icon}</span>
                        <div>
                          <div className="font-extrabold text-slate-900">{d.dayName}</div>
                          <div className="text-[10px] text-slate-500">{d.date}</div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-[120px]">
                        <span className="font-bold text-slate-800">{d.condition}</span>
                        <span className="text-[10px] text-slate-400 block font-normal">{d.conditionEn}</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 block">बारिश</span>
                          <span className="font-bold text-blue-600 flex items-center gap-0.5">
                            <Droplets className="h-3 w-3" />
                            {d.rainProbability}% ({d.precipitationMm}mm)
                          </span>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <span className="text-sm font-black text-slate-900">{d.maxTemp}°C</span>
                          <span className="text-xs text-slate-400 ml-1">/ {d.minTemp}°C</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FARM-FOCUSED AGRICULTURAL ADVISORIES */}
          {activeTab === 'advisories' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">पूर्वानुमान आधारित कृषि सुझाव</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  स्वचालित विश्लेषित
                </span>
              </div>

              {advisories.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  कृषि परामर्श लोड हो रहा है...
                </div>
              ) : (
                <div className="space-y-3">
                  {advisories.map((adv) => {
                    const isWarning = adv.status === 'warning' || adv.status === 'danger';
                    return (
                      <div
                        key={adv.id}
                        className={`p-4 rounded-xl border flex items-start gap-3.5 shadow-2xs ${
                          isWarning ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${
                          isWarning ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isWarning ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">{adv.title}</span>
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                              isWarning ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                            }`}>
                              {adv.badge}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed font-medium">
                            {adv.recommendation}
                          </p>
                          <p className="text-[11px] text-slate-500 font-normal italic">
                            {adv.recommendationEn}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Official Agronomic Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-100 text-[11px] text-slate-600 flex items-start gap-2 border border-slate-200">
                <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  <strong>महत्वपूर्ण अस्वीकरण (Disclaimer):</strong> यह सुझाव लाइव मौसम पूर्वानुमान (Open-Meteo) के आधार पर उत्पन्न सामान्य कृषि परामर्श हैं। किसी भी विशेष रासायनिक छिड़काव या बुवाई/कटाई से पूर्व अपने नजदीकी कृषि विज्ञान केंद्र (KVK) अथवा कृषि अधिकारी से पुष्टि अवश्य करें।
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: FARM LOCATION & GPS SETTINGS */}
          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-emerald-600" />
                    <span className="font-black text-xs text-slate-900">वर्तमान सक्रिय खेत स्थान</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    location.source === 'gps' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {location.source === 'gps' ? 'GPS सत्यापित' : 'मैन्युअल सेट'}
                  </span>
                </div>

                <div className="text-sm font-extrabold text-slate-800">
                  {location.displayName || 'Khandauli, Agra, Uttar Pradesh'}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={onRequestGps}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>GPS से वर्तमान स्थान खोजें</span>
                  </button>

                  <button
                    onClick={() => setShowLocationForm(!showLocationForm)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>स्थान बदलें / मैन्युअल भरें</span>
                  </button>
                </div>

                {errorMessage && (
                  <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {errorMessage}
                  </div>
                )}
              </div>

              {/* Manual Location Form */}
              {showLocationForm && (
                <form onSubmit={handleManualSubmit} className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 space-y-3 text-xs">
                  <div className="font-bold text-slate-800">मैन्युअल स्थान दर्ज करें (Manual Selection)</div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">गांव / कस्बा (Village)</label>
                      <input
                        type="text"
                        value={manualVillage}
                        onChange={(e) => setManualVillage(e.target.value)}
                        placeholder="उदा. खंदौली (Khandauli)"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">जिला (District) *</label>
                      <input
                        type="text"
                        required
                        value={manualDistrict}
                        onChange={(e) => setManualDistrict(e.target.value)}
                        placeholder="उदा. आगरा (Agra)"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">राज्य (State) *</label>
                      <input
                        type="text"
                        required
                        value={manualState}
                        onChange={(e) => setManualState(e.target.value)}
                        placeholder="उदा. उत्तर प्रदेश (UP)"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLocationForm(false)}
                      className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                    >
                      रद्द करें
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                    >
                      सुरक्षित करें
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            अंतिम अपडेट: {weather?.fetchedAt ? new Date(weather.fetchedAt).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }) : 'आज'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer transition-colors"
          >
            बंद करें
          </button>
        </div>
      </div>
    </div>
  );
};
