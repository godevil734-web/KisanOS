import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { MarketPrice, RegionalSupplyForecast } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Cpu, 
  Sparkles, 
  Scan, 
  Layers, 
  ShieldCheck, 
  Info, 
  Calendar,
  MapPin,
  Camera,
  CheckCircle2
} from 'lucide-react';
import { VoiceListenButton } from './VoiceListenButton';

export const MarketIntelligenceDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [forecasts, setForecasts] = useState<RegionalSupplyForecast[]>([]);
  const [activeIntelTab, setActiveIntelTab] = useState<'prices' | 'regional_gap' | 'ai_yield' | 'cv_vision'>('prices');
  const [loading, setLoading] = useState(true);

  // AI Yield Predictor state
  const [yieldInputs, setYieldInputs] = useState({
    cropName: 'Potato',
    variety: 'Kufri Jyoti',
    acres: 10,
    irrigationType: 'Tube well & Drip',
    soilType: 'Alluvial sandy loam',
    historicalYieldPerAcre: 14
  });
  const [yieldResult, setYieldResult] = useState<any>(null);
  const [loadingYield, setLoadingYield] = useState(false);

  // AI Computer Vision produce scanner state
  const [cvInputs, setCvInputs] = useState({
    cropName: 'Potato',
    variety: 'Kufri Jyoti',
    selectedImageSample: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'
  });
  const [cvResult, setCvResult] = useState<any>(null);
  const [loadingCV, setLoadingCV] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pricesRes, forecastsRes] = await Promise.all([
          api.getMarketPrices(),
          api.getRegionalForecasts()
        ]);
        setPrices(pricesRes);
        setForecasts(forecastsRes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRunYieldPrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingYield(true);
    try {
      const res = await api.predictYield(yieldInputs);
      setYieldResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingYield(false);
    }
  };

  const handleRunCVAnalysis = async () => {
    setLoadingCV(true);
    try {
      const res = await api.analyzeProduceCV(cvInputs);
      setCvResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCV(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold text-xl border border-purple-200">
            📊
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Market Intelligence & AI Agronomic Layer
              </h1>
              <span className="text-xs bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full font-bold border border-purple-200 flex items-center gap-1">
                <Cpu className="h-3 w-3 text-purple-600" />
                Live Terminal Feeds
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              APMC Mandi spot rates, regional supply-demand balance forecasts, and agricultural AI models.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'prices', label: t('intelligence.mandiSpotRates'), icon: BarChart3 },
          { id: 'regional_gap', label: t('intelligence.supplyDemandGap'), icon: Layers },
          { id: 'ai_yield', label: t('intelligence.aiYieldPredictor'), icon: Sparkles },
          { id: 'cv_vision', label: t('intelligence.cvProduceGrader'), icon: Scan }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeIntelTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveIntelTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: APMC MANDI PRICES (Section 20) */}
      {activeIntelTab === 'prices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Mandi Benchmark Prices Across Northern Agricultural Belts
            </h3>
            <span className="text-xs text-slate-400">
              Source: AGMARKNET & Regional APMC Committees
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prices.map((p) => {
              const isUp = p.trend === 'UP';
              const isDown = p.trend === 'DOWN';

              return (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {p.mandi} ({p.district})
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-0.5">
                        {p.cropName} <span className="text-xs text-slate-500 font-normal">({p.variety})</span>
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <VoiceListenButton 
                        size="xs"
                        textHi={`${p.mandi} मंडी में ${p.cropName} (${p.variety}) का मॉडल भाव ${p.modalPrice.toFixed(0)} रुपये प्रति किलो है। न्यूनतम भाव ${p.minPrice} और अधिकतम ${p.maxPrice} रुपये है। बाजार रुख ${p.trend === 'UP' ? 'बढ़त' : p.trend === 'DOWN' ? 'गिरावट' : 'स्थिर'} पर है।`}
                        textEn={`In ${p.mandi} mandi, modal rate for ${p.cropName} ${p.variety} is ₹${p.modalPrice.toFixed(2)} per kg. Minimum is ₹${p.minPrice} and maximum is ₹${p.maxPrice}. Trend is ${p.trend}.`}
                      />
                      <span className={`flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        isUp ? 'bg-emerald-100 text-emerald-800' : isDown ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isUp && <TrendingUp className="h-3 w-3" />}
                        {isDown && <TrendingDown className="h-3 w-3" />}
                        {!isUp && !isDown && <Minus className="h-3 w-3" />}
                        {p.trend}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">Modal Mandi Rate</span>
                      <div className="text-2xl font-extrabold text-slate-900">
                        ₹{p.modalPrice.toFixed(2)}<span className="text-xs font-normal text-slate-500">/kg</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>Min: ₹{p.minPrice}/kg</div>
                      <div>Max: ₹{p.maxPrice}/kg</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Arrivals Today: {p.volumeTonsToday} Tonnes</span>
                    <span>Date: {p.date}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <strong>Indicative Price Notice:</strong> Mandi prices reflect spot market trade. KisanConnect matches with direct buyers or aggregator contracts may achieve different Net Realizations based on delivery point and grading.
          </div>
        </div>
      )}

      {/* TAB 2: REGIONAL SUPPLY-DEMAND BALANCE (Sections 33, 34, 35) */}
      {activeIntelTab === 'regional_gap' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Regional Supply & Demand Forecast Intelligence
            </h3>
            <p className="text-xs text-slate-500">
              Aggregated projections highlighting regional surplus buffers and emerging deficit procurement zones.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {forecasts.map((f, idx) => {
              const isSurplus = f.balanceType === 'SURPLUS';

              return (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-purple-600" />
                        <h4 className="text-base font-bold text-slate-900">{f.region}</h4>
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        Commodity: <strong>{f.crop}</strong> • Harvest Window: {f.harvestWindow}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <VoiceListenButton
                        size="xs"
                        textHi={`${f.region} क्षेत्र में ${f.crop} फसल की स्थिति: आपूर्ति ${f.estimatedSupplyTons.toLocaleString()} टन और मांग ${f.estimatedDemandTons.toLocaleString()} टन है। संतुलन ${f.balanceType === 'SURPLUS' ? 'अधिशेष' : 'कमी'} ${f.potentialBalance.toLocaleString()} टन। सलाह: ${f.recommendation}`}
                        textEn={`${f.region} forecast for ${f.crop}: Projected supply ${f.estimatedSupplyTons.toLocaleString()} tonnes, demand ${f.estimatedDemandTons.toLocaleString()} tonnes. Advisory: ${f.recommendation}`}
                      />
                      <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                        isSurplus 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isSurplus ? `+${f.potentialBalance.toLocaleString()}T SURPLUS` : `${f.potentialBalance.toLocaleString()}T DEFICIT`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Projected Supply</span>
                      <span className="font-extrabold text-slate-900 text-sm">{f.estimatedSupplyTons.toLocaleString()} T</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Projected Demand</span>
                      <span className="font-extrabold text-slate-900 text-sm">{f.estimatedDemandTons.toLocaleString()} T</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Cold Store Buffer</span>
                      <span className="font-extrabold text-cyan-800 text-sm">{f.coldStorageBufferTons.toLocaleString()} T</span>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-xs text-purple-950 space-y-1">
                    <span className="font-bold block">Market Advisory:</span>
                    <p className="leading-relaxed">{f.recommendation}</p>
                    <span className="text-[10px] text-purple-700 block pt-1 font-semibold">
                      Model Reliability: {f.confidenceScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: AI AGRONOMIC YIELD PREDICTOR (Section 32 & 37) */}
      {activeIntelTab === 'ai_yield' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">
                Machine Learning Agronomic Yield Predictor
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Estimate farm output based on acreage, variety genetics, irrigation infrastructure, and soil type.
            </p>
          </div>

          <form onSubmit={handleRunYieldPrediction} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Crop</label>
              <select
                value={yieldInputs.cropName}
                onChange={(e) => setYieldInputs({ ...yieldInputs, cropName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
              >
                <option value="Potato">Potato</option>
                <option value="Wheat">Wheat</option>
                <option value="Tomato">Tomato</option>
                <option value="Onion">Onion</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Variety</label>
              <input
                type="text"
                value={yieldInputs.variety}
                onChange={(e) => setYieldInputs({ ...yieldInputs, variety: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Cultivated Land (Acres)</label>
              <input
                type="number"
                min="1"
                value={yieldInputs.acres}
                onChange={(e) => setYieldInputs({ ...yieldInputs, acres: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Irrigation Method</label>
              <select
                value={yieldInputs.irrigationType}
                onChange={(e) => setYieldInputs({ ...yieldInputs, irrigationType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
              >
                <option value="Tube well & Drip">Tube well & Micro-Drip (+12% efficiency)</option>
                <option value="Canal & Sprinkler">Canal & Sprinkler (+5% efficiency)</option>
                <option value="Flood Irrigation">Conventional Flood Irrigation (Baseline)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Historical Baseline (Tons/Acre)</label>
              <input
                type="number"
                value={yieldInputs.historicalYieldPerAcre}
                onChange={(e) => setYieldInputs({ ...yieldInputs, historicalYieldPerAcre: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loadingYield}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                {loadingYield ? 'Computing Model...' : 'Run Yield Prediction Model'}
              </button>
            </div>
          </form>

          {yieldResult && (
            <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/80 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-900 block">
                    {yieldResult.modelType}
                  </span>
                  <div className="text-2xl font-extrabold text-purple-950 mt-0.5">
                    {yieldResult.totalEstimatedProductionTons} Tonnes Estimated Output
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-purple-700 font-semibold block">Yield Density:</span>
                  <span className="text-lg font-bold text-purple-900">{yieldResult.estimatedYieldPerAcre} T / Acre</span>
                </div>
              </div>

              <div className="text-xs text-purple-900 space-y-1">
                <div>✓ Model Confidence: <strong>{yieldResult.confidenceScore}</strong></div>
                <div className="text-[11px] text-slate-500 italic mt-1">{yieldResult.disclaimer}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMPUTER VISION PRODUCE GRADER (Section 37) */}
      {activeIntelTab === 'cv_vision' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Computer Vision Produce Quality Grading Simulator
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Convolutional neural net produce visual inspection for tuber sizing, skin blemishes, and grade certification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Crop Sample</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Potato', variety: 'Kufri Jyoti', img: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60' },
                    { name: 'Tomato', variety: 'Himsona', img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=60' },
                    { name: 'Onion', variety: 'Nashik Red', img: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop&q=60' }
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCvInputs({ cropName: s.name, variety: s.variety, selectedImageSample: s.img })}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        cvInputs.cropName === s.name
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <img src={s.img} alt={s.name} className="h-16 w-full object-cover rounded-lg mb-1" />
                      <span className="text-xs font-bold text-slate-800 block">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunCVAnalysis}
                disabled={loadingCV}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" />
                <span>{loadingCV ? 'Processing Neural Inference...' : 'Analyze Produce Image with KisanVision'}</span>
              </button>
            </div>

            {/* Inference Results Card */}
            <div>
              {cvResult ? (
                <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      {cvResult.model}
                    </span>
                    <span className="text-xs font-extrabold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                      {cvResult.modelConfidencePercent}% Confidence
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Predicted Quality Grade:</span>
                      <span className="font-extrabold text-emerald-900">{cvResult.estimatedGrade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Calibrated Sizing Range:</span>
                      <span className="font-bold text-slate-800">{cvResult.estimatedSizeRange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Detected Surface Blemishes:</span>
                      <span className="font-bold text-slate-800">{cvResult.detectedDefectRatePercent}% (Permissible: &lt;3.5%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Skin Firmness / Turgidity:</span>
                      <span className="font-medium text-slate-700">{cvResult.skinQualityAssessment}</span>
                    </div>
                  </div>

                  <div className="p-2 bg-white/90 rounded-lg text-xs font-bold text-emerald-900 border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{cvResult.verifiedLabel}</span>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                  <Scan className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-medium">Click "Analyze Produce Image" to run automated computer vision quality classification.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
