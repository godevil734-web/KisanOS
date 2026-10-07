import React, { useState, useEffect, useMemo } from 'react';
import { 
  Landmark, 
  Search, 
  MapPin, 
  TrendingUp, 
  RotateCw, 
  Filter, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  Sparkles, 
  Building2, 
  Scale, 
  Tag, 
  ExternalLink,
  ChevronDown,
  Info,
  DollarSign,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api, MandiLocationState, MandiPriceRecord, MandiCommoditySummary, MandiPricesResponse } from '../services/api';

interface MandiPricesViewProps {
  user: any;
  lang: 'hi' | 'en';
  farmerListings?: any[];
  onFindBuyersForCrop: (cropName: string) => void;
  onListCrop: (cropName: string, modalPrice?: number) => void;
}

export const MandiPricesView: React.FC<MandiPricesViewProps> = ({
  user,
  lang,
  farmerListings = [],
  onFindBuyersForCrop,
  onListCrop
}) => {
  // -------------------------------------------------------------
  // STATE & DISTRICT SELECTION STATE
  // -------------------------------------------------------------
  const defaultState = user?.state || user?.location?.state || 'Uttar Pradesh';
  const defaultDistrict = user?.district || user?.location?.district || 'all';

  const [selectedState, setSelectedState] = useState<string>(defaultState);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(defaultDistrict);
  const [statesList, setStatesList] = useState<MandiLocationState[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState<boolean>(true);

  // -------------------------------------------------------------
  // MANDI PRICES DATA STATE
  // -------------------------------------------------------------
  const [mandiData, setMandiData] = useState<MandiPricesResponse | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -------------------------------------------------------------
  // FILTERING & SEARCH STATE
  // -------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'commodities' | 'mandis'>('commodities');
  const [sortBy, setSortBy] = useState<'volume' | 'price_desc' | 'price_asc' | 'name'>('volume');

  // Load locations on mount
  useEffect(() => {
    let mounted = true;
    async function loadLocations() {
      setIsLoadingLocations(true);
      try {
        const res = await api.getMandiLocations();
        if (mounted && res.success && res.states) {
          setStatesList(res.states);
          
          // Verify if defaultState is in statesList
          const hasState = res.states.some(s => s.state_name.toLowerCase() === defaultState.toLowerCase());
          if (!hasState && res.states.length > 0) {
            setSelectedState(res.states[0].state_name);
          }
        }
      } catch (err: any) {
        console.warn('Could not load dynamic mandi locations:', err);
      } finally {
        if (mounted) setIsLoadingLocations(false);
      }
    }
    loadLocations();
    return () => { mounted = false; };
  }, []);

  // Districts for current state
  const availableDistricts = useMemo(() => {
    const st = statesList.find(s => s.state_name.toLowerCase() === selectedState.toLowerCase());
    return st ? st.districts : [];
  }, [statesList, selectedState]);

  // Fetch prices function
  const fetchPrices = async (stateToFetch: string, districtToFetch: string) => {
    setIsLoadingPrices(true);
    setErrorMessage(null);
    try {
      const res = await api.getMandiPrices({
        state: stateToFetch,
        district: districtToFetch === 'all' ? undefined : districtToFetch
      });
      if (res && res.success) {
        setMandiData(res);
      } else {
        setErrorMessage(res.message || 'Failed to fetch government mandi rates.');
      }
    } catch (err: any) {
      console.error('Error fetching government mandi prices:', err);
      setErrorMessage(err.message || 'Government Mandi server is currently updating. Please try again.');
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // Fetch prices on initial load or when state/district changes
  useEffect(() => {
    fetchPrices(selectedState, selectedDistrict);
  }, [selectedState, selectedDistrict]);

  // Filtered commodity summaries
  const filteredCommodities = useMemo(() => {
    if (!mandiData?.commoditySummaries) return [];
    let list = mandiData.commoditySummaries;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.commodity.toLowerCase().includes(q) ||
        (c.group && c.group.toLowerCase().includes(q))
      );
    }

    // Group filter
    if (selectedGroup !== 'All') {
      list = list.filter(c => c.group && c.group.toLowerCase() === selectedGroup.toLowerCase());
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === 'volume') {
        return (b.totalArrivals || 0) - (a.totalArrivals || 0) || b.reportingMandisCount - a.reportingMandisCount;
      }
      if (sortBy === 'price_desc') {
        return b.avgModalPrice - a.avgModalPrice;
      }
      if (sortBy === 'price_asc') {
        return a.avgModalPrice - b.avgModalPrice;
      }
      return a.commodity.localeCompare(b.commodity);
    });
  }, [mandiData, searchQuery, selectedGroup, sortBy]);

  // Filtered raw mandi records
  const filteredRecords = useMemo(() => {
    if (!mandiData?.records) return [];
    let list = mandiData.records;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => 
        r.commodity.toLowerCase().includes(q) ||
        r.market.toLowerCase().includes(q) ||
        r.district.toLowerCase().includes(q) ||
        (r.variety && r.variety.toLowerCase().includes(q))
      );
    }

    if (selectedGroup !== 'All') {
      list = list.filter(r => r.group && r.group.toLowerCase() === selectedGroup.toLowerCase());
    }

    return list;
  }, [mandiData, searchQuery, selectedGroup]);

  // Unique groups for filter chips
  const availableGroups = useMemo(() => {
    if (!mandiData?.commoditySummaries) return ['All'];
    const groups = new Set<string>();
    mandiData.commoditySummaries.forEach(c => {
      if (c.group) groups.add(c.group);
    });
    return ['All', ...Array.from(groups)];
  }, [mandiData]);

  // Farmer's crops comparison helper
  const farmerCropComparison = useMemo(() => {
    if (!farmerListings.length || !mandiData?.commoditySummaries) return [];
    const matches: Array<{ listing: any; mandiSummary: MandiCommoditySummary }> = [];

    farmerListings.forEach(listing => {
      const cropName = listing.cropName || listing.crop?.name || '';
      const summary = mandiData.commoditySummaries.find(s => 
        s.commodity.toLowerCase().includes(cropName.toLowerCase()) ||
        cropName.toLowerCase().includes(s.commodity.toLowerCase())
      );
      if (summary) {
        matches.push({ listing, mandiSummary: summary });
      }
    });

    return matches;
  }, [farmerListings, mandiData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER SECTION & OFFICIAL GOVERNMENT SOURCE BADGE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Subtle background ornamentation */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {lang === 'hi' ? 'आधिकारिक सरकारी मंडी भाव' : 'Official Government Mandi Feed'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-200 border border-white/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {lang === 'hi' ? '100% असली डेटा (शून्य फ़ेक)' : '100% Real Govt Data (Zero Mock)'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Landmark className="h-8 w-8 text-emerald-400 shrink-0" />
              <span>{lang === 'hi' ? 'सरकारी कृषि मंडी भाव' : 'Live Government Mandi Prices'}</span>
            </h1>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {lang === 'hi' 
                ? 'कृषि एवं किसान कल्याण मंत्रालय (DMI Agmarknet व data.gov.in) से सीधे प्राप्त दैनिक थोक मंडी भाव एवं आवक। अपने क्षेत्र की किसी भी फसल का वास्तविक सरकारी भाव जानकर सही मूल्य पर बेचने का निर्णय लें।'
                : 'Direct daily wholesale mandi prices & arrival volumes from the Ministry of Agriculture & Farmers Welfare (Agmarknet & data.gov.in). Real market data to help you negotiate better crop sales.'}
            </p>
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchPrices(selectedState, selectedDistrict)}
              disabled={isLoadingPrices}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all border border-white/15 backdrop-blur-md cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`h-4 w-4 ${isLoadingPrices ? 'animate-spin' : ''}`} />
              <span>{isLoadingPrices ? (lang === 'hi' ? 'अपडेट हो रहा है...' : 'Fetching Live...') : (lang === 'hi' ? 'ताज़ा भाव प्राप्त करें' : 'Refresh Live Rates')}</span>
            </button>
          </div>
        </div>

        {/* Source Attribution & Report Date Banner */}
        {mandiData && (
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400" />
              <span>
                <strong className="text-white">{lang === 'hi' ? 'स्रोत: ' : 'Source: '}</strong>
                {mandiData.source}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-400" />
              <span>
                <strong className="text-white">{lang === 'hi' ? 'मंडी सत्र दिनांक: ' : 'Report Session: '}</strong>
                {mandiData.reportDate}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. STATE & DISTRICT SELECTOR CARD */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* State Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                <span>{lang === 'hi' ? 'राज्य चुनें (State)' : 'Select State'}</span>
              </label>
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={(e) => {
                    const newState = e.target.value;
                    setSelectedState(newState);
                    setSelectedDistrict('all'); // Reset district when state changes
                  }}
                  className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-10 cursor-pointer"
                >
                  {statesList.map((s) => (
                    <option key={s.id || s.state_name} value={s.state_name}>
                      {s.state_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* District Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-teal-600" />
                <span>{lang === 'hi' ? 'ज़िला चुनें (District)' : 'Select District'}</span>
              </label>
              <div className="relative">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-10 cursor-pointer"
                >
                  <option value="all">{lang === 'hi' ? 'सभी ज़िले (संपूर्ण राज्य)' : 'All Districts (Whole State)'}</option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Location Action Status */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              {selectedDistrict === 'all' 
                ? `${selectedState} (${availableDistricts.length} ${lang === 'hi' ? 'ज़िले' : 'Districts'})`
                : `${selectedDistrict}, ${selectedState}`}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. YOUR CROPS HIGHLIGHT / PRICE COMPARISON */}
      {/* ------------------------------------------------------------- */}
      {farmerCropComparison.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/50 rounded-2xl p-5 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-emerald-950">
                {lang === 'hi' ? 'आपकी सूचीबद्ध फसलों के लिए मंडी भाव तुलना' : 'Market Comparison for Your Listed Crops'}
              </h2>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
              {farmerCropComparison.length} {lang === 'hi' ? 'फसलें पहचानी गईं' : 'Crops matched'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {farmerCropComparison.map(({ listing, mandiSummary }) => {
              const farmerPrice = Number(listing.pricePerKg || (listing.expectedPricePerKg)) || 0;
              const mandiPriceKg = Number(mandiSummary.avgPricePerKg) || 0;
              const diff = mandiPriceKg - farmerPrice;

              return (
                <div key={listing.id} className="bg-white rounded-xl p-3.5 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm">{mandiSummary.commodity}</span>
                      <span className="text-[11px] font-semibold text-slate-500">{mandiSummary.reportingMandisCount} mandis</span>
                    </div>

                    <div className="flex items-baseline justify-between mt-2 text-xs">
                      <span className="text-slate-600">{lang === 'hi' ? 'सरकारी औसत भाव:' : 'Govt Modal Rate:'}</span>
                      <span className="font-black text-emerald-700 text-sm">
                        ₹{mandiSummary.avgModalPrice}/Q <span className="text-xs font-normal text-slate-500">(₹{mandiSummary.avgPricePerKg}/kg)</span>
                      </span>
                    </div>

                    {farmerPrice > 0 && (
                      <div className="flex items-baseline justify-between mt-1 text-xs">
                        <span className="text-slate-600">{lang === 'hi' ? 'आपकी अपेक्षित दर:' : 'Your Expected Rate:'}</span>
                        <span className="font-bold text-slate-800">₹{farmerPrice}/kg</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onFindBuyersForCrop(mandiSummary.commodity)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{lang === 'hi' ? 'खरीदार खोजें' : 'Find Buyers'}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] text-slate-400">{mandiSummary.priceRange}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MARKET METRICS STATS SUMMARY */}
      {/* ------------------------------------------------------------- */}
      {mandiData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'hi' ? 'सक्रिय मंडियां' : 'Reporting Mandis'}</span>
              <Building2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {new Set(mandiData.records.map(r => r.market)).size}
              </span>
              <span className="text-xs text-slate-500">{lang === 'hi' ? 'केंद्र' : 'Centers'}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {lang === 'hi' ? 'आज व्यापार दर्ज कराने वाली मंडियां' : 'Mandis reporting trade today'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'hi' ? 'कुल फसलें' : 'Commodities'}</span>
              <Package className="h-4 w-4 text-teal-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {mandiData.distinctCommoditiesCount}
              </span>
              <span className="text-xs text-slate-500">{lang === 'hi' ? 'प्रकार' : 'Varieties'}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {lang === 'hi' ? 'उपलब्ध कृषि उत्पाद' : 'Different produce items on market'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'hi' ? 'कुल दैनिक आवक' : 'Total Arrivals'}</span>
              <Scale className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {(() => {
                  const total = mandiData.records.reduce((acc, r) => acc + (Number(r.arrivals) || 0), 0);
                  return total > 0 ? `${Math.round(total).toLocaleString()}` : 'Recorded';
                })()}
              </span>
              <span className="text-xs text-slate-500">MT</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {lang === 'hi' ? 'सत्र में पहुंची कुल मात्रा' : 'Recorded arrival volume in session'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'hi' ? 'सत्र तिथि' : 'Report Date'}</span>
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-black text-slate-900">
                {mandiData.reportDate}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>{lang === 'hi' ? 'नवीनतम आधिकारिक रिकॉर्ड' : 'Latest Verified Session'}</span>
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. SEARCH, FILTER CHIPS & VIEW TOGGLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'hi' ? 'फसल या मंडी खोजें (उदा: आलू, गेहूं, सरसों, प्याज, टमाटर)...' : 'Search crop or mandi (e.g. Potato, Wheat, Mustard, Onion, Tomato)...'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 shrink-0">{lang === 'hi' ? 'क्रम:' : 'Sort:'}</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="volume">{lang === 'hi' ? 'अधिकतम आवक (Highest Volume)' : 'Highest Arrivals Volume'}</option>
              <option value="price_desc">{lang === 'hi' ? 'उच्चतम भाव (Highest Price)' : 'Highest Modal Price'}</option>
              <option value="price_asc">{lang === 'hi' ? 'न्यूनतम भाव (Lowest Price)' : 'Lowest Modal Price'}</option>
              <option value="name">{lang === 'hi' ? 'नाम (A-Z)' : 'Commodity Name (A-Z)'}</option>
            </select>
          </div>

          {/* View Toggle Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('commodities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'commodities' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'hi' ? 'फसल अनुसार' : 'By Commodity'}
            </button>
            <button
              onClick={() => setViewMode('mandis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'mandis' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'hi' ? 'सभी मंडी केंद्र' : 'All Mandis Table'}
            </button>
          </div>
        </div>

        {/* Group Filter Chips */}
        {availableGroups.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="h-3 w-3" />
              <span>{lang === 'hi' ? 'श्रेणी:' : 'Category:'}</span>
            </span>
            {availableGroups.map((group) => {
              const isSelected = selectedGroup === group;
              return (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {group}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. CONTENT AREA: COMMODITY CARDS OR DETAILED MANDI TABLE */}
      {/* ------------------------------------------------------------- */}

      {/* Loading Skeleton */}
      {isLoadingPrices && (
        <div className="space-y-4">
          <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-slate-200">
            <div className="flex flex-col items-center gap-3 text-center">
              <RotateCw className="h-8 w-8 text-emerald-600 animate-spin" />
              <p className="text-sm font-bold text-slate-700">
                {lang === 'hi' ? 'सरकारी मंडी सर्वर से ताज़ा भाव प्राप्त किए जा रहे हैं...' : 'Retrieving live government mandi prices from Agmarknet...'}
              </p>
              <p className="text-xs text-slate-400">
                {lang === 'hi' ? 'कृषि एवं किसान कल्याण मंत्रालय डेटाबेस से सीधा संपर्क स्थापित किया जा रहा है' : 'Querying official Ministry of Agriculture real-time records'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        </div>
      )}

      {/* Error / Empty Notification Banner */}
      {!isLoadingPrices && errorMessage && (
        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">{lang === 'hi' ? 'सरकारी डेटा उपलब्धता सूचना' : 'Government Data Availability Notice'}</h3>
              <p className="text-xs text-amber-800 mt-1">{errorMessage}</p>
              <p className="text-xs text-amber-700 mt-2">
                {lang === 'hi' 
                  ? 'सुझाव: ज़िले में "सभी ज़िले" का विकल्प चुनें या कुछ देर बाद पुनः प्रयास करें।'
                  : 'Tip: Select "All Districts" or refresh in a few minutes as daily mandi reports are published.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedDistrict('all')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer"
          >
            {lang === 'hi' ? 'संपूर्ण राज्य का भाव देखें' : 'View All State Mandis'}
          </button>
        </div>
      )}

      {/* Zero Records Case */}
      {!isLoadingPrices && !errorMessage && mandiData && mandiData.records.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <Landmark className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {lang === 'hi' ? 'इस ज़िले में आज कोई मंडी व्यापार दर्ज नहीं हुआ' : 'No Mandi Trading Recorded for this District Today'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {lang === 'hi'
              ? 'आज मंडी बंद हो सकती है (जैसे रविवार या अवकाश) अथवा दैनिक रिपोर्टिंग अभी जारी है। आप पूरे राज्य की अन्य सक्रिय मंडियां देख सकते हैं।'
              : 'Mandis may be closed today (such as weekends or market holidays) or reporting may still be underway. You can browse all active mandis across the state.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => setSelectedDistrict('all')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              {lang === 'hi' ? 'संपूर्ण राज्य की मंडियां देखें' : 'Browse All State Mandis'}
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: COMMODITY CARDS VIEW */}
      {!isLoadingPrices && !errorMessage && mandiData && mandiData.records.length > 0 && viewMode === 'commodities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              {lang === 'hi' ? 'दर्ज फसलें:' : 'Showing'} <strong className="text-slate-800">{filteredCommodities.length}</strong> {lang === 'hi' ? 'फसलें' : 'commodities'}
            </span>
            <span>
              {selectedDistrict === 'all' ? selectedState : `${selectedDistrict}, ${selectedState}`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCommodities.map((item) => {
              return (
                <div 
                  key={item.commodity} 
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Commodity & Group */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {item.group || 'Agriculture'}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-1 group-hover:text-emerald-700 transition-colors">
                          {item.commodity}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.reportingMandisCount} {lang === 'hi' ? 'मंडियां' : 'mandis'}
                        </span>
                      </div>
                    </div>

                    {/* Modal Price Highlight */}
                    <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-slate-100">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {lang === 'hi' ? 'औसत मॉडल भाव (Modal Rate)' : 'Average Modal Rate'}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          ₹{item.avgModalPrice.toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">/ क्विंटल (Quintal)</span>
                      </div>
                      <div className="mt-1 text-xs font-bold text-emerald-700">
                        ≈ ₹{item.avgPricePerKg} / किग्रा (kg)
                      </div>
                    </div>

                    {/* Min - Max Range Bar */}
                    <div className="mt-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-semibold">{lang === 'hi' ? 'न्यूनतम:' : 'Min:'} ₹{item.lowestPrice}</span>
                        <span className="text-[11px] text-slate-400">{lang === 'hi' ? 'मूल्य सीमा' : 'Price Spread'}</span>
                        <span className="font-semibold">{lang === 'hi' ? 'अधिकतम:' : 'Max:'} ₹{item.highestPrice}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full rounded-full w-full" />
                      </div>
                    </div>

                    {/* Arrivals Volume if available */}
                    {item.totalArrivals !== null && item.totalArrivals !== undefined && (
                      <div className="mt-3 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
                        <span>{lang === 'hi' ? 'दैनिक आवक:' : 'Daily Arrivals:'}</span>
                        <span className="font-bold text-slate-700">{item.totalArrivals} {item.arrivalsUnit || 'MT'}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Farmer Decision Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onFindBuyersForCrop(item.commodity)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer"
                      title="इस भाव पर खरीदार खोजें"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>{lang === 'hi' ? 'खरीदार खोजें' : 'Find Buyers'}</span>
                    </button>

                    <button
                      onClick={() => onListCrop(item.commodity, item.avgModalPrice)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
                      title="इस फसल की बिक्री सूची बनाएं"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>{lang === 'hi' ? 'फसल बेचें' : 'Sell Crop'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DETAILED MANDIS TABLE VIEW */}
      {!isLoadingPrices && !errorMessage && mandiData && mandiData.records.length > 0 && viewMode === 'mandis' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="font-bold">
              {lang === 'hi' ? 'कुल रिकॉर्ड्स:' : 'Total Mandi Records:'} {filteredRecords.length}
            </span>
            <span className="text-slate-500">
              {mandiData.source}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">{lang === 'hi' ? 'मंडी केंद्र (Market)' : 'Mandi Market'}</th>
                  <th className="py-3 px-4">{lang === 'hi' ? 'ज़िला (District)' : 'District'}</th>
                  <th className="py-3 px-4">{lang === 'hi' ? 'फसल (Commodity)' : 'Commodity'}</th>
                  <th className="py-3 px-4">{lang === 'hi' ? 'किस्म (Variety)' : 'Variety'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'hi' ? 'मॉडल भाव (Modal)' : 'Modal Price'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'hi' ? 'न्यूनतम / अधिकतम' : 'Min / Max Range'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'hi' ? 'आवक (Arrivals)' : 'Arrivals'}</th>
                  <th className="py-3 px-4 text-center">{lang === 'hi' ? 'कार्यवाही' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredRecords.slice(0, 100).map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{record.market}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{record.district}</td>
                    <td className="py-3 px-4 font-bold text-emerald-950">
                      {record.commodity}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{record.variety || 'Standard'}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      ₹{record.modalPrice.toLocaleString()} / Q
                      <div className="text-[10px] font-bold text-emerald-700">₹{record.modalPricePerKg}/kg</div>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      ₹{record.minPrice} - ₹{record.maxPrice}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {record.arrivals ? `${record.arrivals} ${record.arrivalsUnit || 'MT'}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onFindBuyersForCrop(record.commodity)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] transition-all cursor-pointer"
                        >
                          {lang === 'hi' ? 'खरीदार' : 'Buyers'}
                        </button>
                        <button
                          onClick={() => onListCrop(record.commodity, record.modalPrice)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-all cursor-pointer"
                        >
                          {lang === 'hi' ? 'बेचें' : 'Sell'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length > 100 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
              {lang === 'hi' 
                ? `शीर्ष 100 रिकॉर्ड्स प्रदर्शित (कुल ${filteredRecords.length} उपलब्ध)। किसी विशिष्ट फसल को खोजने हेतु ऊपर सर्च बार का उपयोग करें।`
                : `Showing first 100 records of ${filteredRecords.length}. Use the search bar above to narrow down to specific crops.`}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. GOVERNMENT TRANSPARENCY & DATA ACCREDITATION FOOTER */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Info className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{lang === 'hi' ? 'सरकारी डेटा पारदर्शिता नीति (Government Data Integrity)' : 'Official Government Data Integrity & Compliance'}</span>
        </div>
        <p className="leading-relaxed">
          {lang === 'hi'
            ? 'किसानकनेक्ट केवल भारत सरकार के अधिकृत कृषि विपणन पोर्टल (Agmarknet 2.0 / data.gov.in) द्वारा जारी आधिकारिक थोक मूल्यों को सीधे प्रदर्शित करता है। इसमें कोई अनुमानित (ML/AI) भाव या कृत्रिम डेटा शामिल नहीं है। मंडी भाव एपीएमसी यार्ड के मॉडल लेनदेन पर आधारित हैं।'
            : 'KisanConnect displays authentic wholesale rates directly reported by APMC mandis to the Ministry of Agriculture & Farmers Welfare via Agmarknet 2.0 & data.gov.in. No simulated, predicted, or artificial price quotes are used.'}
        </p>
      </div>
    </div>
  );
};
