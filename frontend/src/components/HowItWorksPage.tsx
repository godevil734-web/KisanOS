import React, { useState } from 'react';
import { 
  Sprout, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  CheckCircle2, 
  Network, 
  Boxes, 
  Warehouse, 
  Truck, 
  Building2, 
  BarChart3, 
  TrendingUp, 
  Sparkles, 
  Compass, 
  Activity, 
  Scale, 
  Info,
  ShieldCheck,
  Layers,
  MapPin,
  Cpu
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HowItWorksPageProps {
  onSelectTab: (tab: string) => void;
  onOpenGetStarted: (role?: 'farmer' | 'aggregator' | 'buyer') => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onSelectTab, onOpenGetStarted }) => {
  const { language } = useLanguage();
  const [activeStep, setActiveStep] = useState<number>(0);

  const isHindi = language === 'hi';
  const unitQ = isHindi ? 'क्विंटल' : 'Q';
  const unitKm = isHindi ? 'किमी' : 'km';

  const chainStages = [
    {
      role: 'farmer',
      title: isHindi ? '1. किसान (Farmer)' : '1. Farmer (Producer)',
      icon: '🌾',
      tag: 'Farm-Gate Supply',
      summary: isHindi 
        ? 'छोटे व सीमांत किसान अपनी फसल, मात्रा और कटाई की तिथि दर्ज करते हैं।' 
        : 'Smallholder farmers list harvest volume, crop variety, and farm-gate availability.',
      details: [
        isHindi ? 'सीधा पारदर्शी पंजीकरण' : 'Direct transparent harvest listing',
        isHindi ? 'स्थान व दूरी के अनुसार बाज़ार पहुंच' : 'Location-indexed market access',
        isHindi ? 'खेत पर तौल और त्वरित बैंक भुगतान' : 'Farm-gate weighment & digital settlement'
      ],
      color: 'border-[#C5DDD2] bg-[#EEF5F2] text-[#315C45]'
    },
    {
      role: 'aggregator',
      title: isHindi ? '2. FPO / स्थानीय एग्रीगेटर' : '2. FPO / Local Aggregator',
      icon: '📦',
      tag: 'Supply Pooling & QC',
      summary: isHindi 
        ? 'गांव स्तर पर 20-50 क्विंटल के कई लॉट्स को इकट्ठा कर 60-100 क्विंटल का इंडस्ट्रियल बैच तैयार करते हैं।' 
        : 'Aggregates multiple 20-50Q smallholder lots into 60-100Q standardized bulk industrial batches.',
      details: [
        isHindi ? 'गुणवत्ता जांच व छंटाई' : 'Quality grading & moisture testing',
        isHindi ? 'सप्लाई पूलिंग व बैच क्रिएशन' : 'Batch pooling & lot tracking',
        isHindi ? 'पारदर्शी सर्विस मार्जिन' : 'Transparent service margin'
      ],
      color: 'border-[#F0DFCD] bg-[#FDF8F0] text-[#C58B4E]'
    },
    {
      role: 'storage',
      title: isHindi ? '3. कोल्ड स्टोरेज (वैकल्पिक)' : '3. Cold Storage (Optional)',
      icon: '❄️',
      tag: 'Scientific Preservation',
      summary: isHindi 
        ? 'यदि तत्काल भाव कम हो, तो सुरक्षित तापमान में भंडारण कर इलेक्ट्रॉनिक वेयरहाउस रसीद (e-NWR) मिलती है।' 
        : 'Controlled-atmosphere preservation buffering harvest glut with electronic warehouse receipts.',
      details: [
        isHindi ? 'डिजिटल इनटेक रसीद' : 'Digital intake receipts & shelf-life monitoring',
        isHindi ? 'सटीक तापमान व आर्द्रता नियंत्रण' : 'Precise temperature & RH regulation',
        isHindi ? 'ऑफ-सीजन मूल्य वृद्धि का लाभ' : 'Off-season value realization capture'
      ],
      color: 'border-[#D1E3E6] bg-[#EEF5F6] text-[#3D6B75]'
    },
    {
      role: 'transport',
      title: isHindi ? '4. परिवहन व लॉजिस्टिक्स' : '4. Transport & Logistics',
      icon: '🚚',
      tag: 'Consolidated Movement',
      summary: isHindi 
        ? 'मल्टी-स्टॉप फार्म कलेक्शन और रूट ऑप्टिमाइज़ेशन से प्रति क्विंटल भाड़ा कम होता है।' 
        : 'Multi-stop farm collection routing minimizing dead-mile freight cost per quintal.',
      details: [
        isHindi ? 'मल्टी-पिकअप रूट शेड्यूलिंग' : 'Multi-point pickup route optimization',
        isHindi ? 'पारदर्शी भाड़ा कैलकुलेशन' : 'Transparent ton-km freight pricing',
        isHindi ? 'रीयल-टाइम जीपीएस ट्रैकिंग' : 'Real-time transit milestone tracking'
      ],
      color: 'border-[#DEE7EB] bg-[#F0F4F6] text-[#536B78]'
    },
    {
      role: 'buyer',
      title: isHindi ? '5. थोक खरीदार / फैक्टरी' : '5. Bulk Buyer / Factory',
      icon: '🏭',
      tag: 'Industrial Fulfilment',
      summary: isHindi 
        ? 'प्रोसेसर्स और रिटेलर्स को तय गुणवत्ता और मात्रा में निरंतर कच्चा माल प्राप्त होता है।' 
        : 'Food processors and institutional buyers receive consistent volume matching rigorous quality specs.',
      details: [
        isHindi ? 'सत्यापित ग्रेड व नमी मानक' : 'Strict grade & moisture compliance',
        isHindi ? 'पक्के अनुबंध व डिजिटल एस्क्रो' : 'Formal supply agreements & digital escrow',
        isHindi ? 'सप्लाई चेन ट्रैसेबिलिटी' : 'Full lot-to-farm traceability'
      ],
      color: 'border-[#DDD5E8] bg-[#F2EFF7] text-[#5E4B7A]'
    }
  ];

  return (
    <div className="bg-[#F7F5EF] text-[#26332C] min-h-screen font-sans pb-16">
      
      {/* Top Banner Navigation */}
      <div className="bg-[#315C45] text-white py-3 px-4 sm:px-8 shadow-sm sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('landing')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isHindi ? '← वापस किसान होम' : '← Back to Farmer Home'}</span>
            </button>
            <span className="hidden sm:inline text-white/40">|</span>
            <span className="text-xs font-semibold text-white/90 hidden sm:inline">
              {isHindi ? 'किसानकनेक्ट सम्पूर्ण सप्लाई-चेन संरचना' : 'KisanConnect Supply-Chain Architecture'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded">
              {isHindi ? 'सप्लाई चेन अवलोकन' : 'Supply Chain Overview'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-12">
        
        {/* ========================================================================= */}
        {/* 1. ARCHITECTURE HERO                                                      */}
        {/* ========================================================================= */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EFECE4] text-[#315C45] text-xs font-bold uppercase tracking-wider border border-[#D8D2C4] shadow-2xs mb-3">
            <Network className="w-3.5 h-3.5 text-[#315C45]" />
            <span>End-to-End Agri-Food Coordination</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#26332C] tracking-tight leading-tight">
            {isHindi ? 'किसानकनेक्ट के पीछे क्या है?' : 'What Powers KisanConnect Behind the Scenes?'}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#5A6860] leading-relaxed">
            {isHindi 
              ? 'किसान, एफपीओ, स्थानीय एग्रीगेटर, कोल्ड स्टोरेज, ट्रांसपोर्टर और बड़े खरीदारों को एक सुव्यवस्थित नेटवर्क में जोड़ने वाला डिजिटल प्लेटफॉर्म।' 
              : 'A multi-sided coordination platform connecting farmers, FPOs, local aggregators, cold storage facilities, transport fleets, and industrial buyers into a single cohesive network.'}
          </p>
          <div className="mt-4 p-3 rounded-xl bg-white border border-[#E5E0D5] text-xs font-semibold text-[#315C45] max-w-xl mx-auto flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#315C45]" />
            <span>
              {isHindi
                ? 'सिद्धांत: "किसानों के लिए सरल, सिस्टम में शक्तिशाली।"'
                : 'Core Principle: "Simple for farmers. Powerful behind the scenes."'}
            </span>
          </div>
        </div>


        {/* ========================================================================= */}
        {/* 2. THE COMPLETE 5-STAGE SUPPLY CHAIN                                      */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D5] shadow-xs">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-[#E5E0D5] gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#315C45] bg-[#EEF5F2] px-2.5 py-1 rounded border border-[#C5DDD2]">
                Supply Chain Architecture
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight mt-2">
                {isHindi ? 'खेत से फैक्टरी तक का 5-चरणीय प्रवाह' : 'From Farm-Gate to Factory: 5-Stage Coordination'}
              </h2>
            </div>
            <div className="text-xs text-[#5A6860] font-medium">
              🌾 Farmer → 📦 FPO / Aggregator → ❄️ Storage → 🚚 Transport → 🏭 Bulk Buyer
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {chainStages.map((stage, idx) => (
              <div 
                key={stage.role}
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  activeStep === idx 
                    ? 'border-[#315C45] shadow-md bg-[#FAF9F5]' 
                    : 'border-[#E5E0D5] bg-white hover:border-[#D8D2C4]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{stage.icon}</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#EFECE4] text-[#637067]">
                      Step 0{idx + 1}
                    </span>
                  </div>
                  <h3 className="font-black text-sm text-[#26332C] mb-1">
                    {stage.title}
                  </h3>
                  <div className="text-[10px] font-bold text-[#315C45] uppercase tracking-wider mb-2">
                    {stage.tag}
                  </div>
                  <p className="text-xs text-[#5A6860] leading-relaxed mb-3">
                    {stage.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#EAE5D8] space-y-1">
                  {stage.details.map((item, dIdx) => (
                    <div key={dIdx} className="text-[11px] text-[#4A5750] flex items-center gap-1.5 font-medium">
                      <Check className="w-3 h-3 text-[#315C45] shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-[#EEF5F2] border border-[#C5DDD2] text-xs text-[#315C45] font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-[#315C45] shrink-0" />
            <span>
              {isHindi
                ? 'किसानकनेक्ट किसी बिचौलिए या एफपीओ को समाप्त करने का दावा नहीं करता, बल्कि मौजूदा हितधारकों को डिजिटल प्लेटफॉर्म पर जोड़कर पूरी व्यवस्था को पारदर्शी और सुगम बनाता है।'
                : 'Important: KisanConnect does NOT claim to eliminate middlemen or FPOs. Instead, it digitally connects and coordinates participants already involved in the supply chain to eliminate information asymmetry.'}
            </span>
          </div>
        </section>


        {/* ========================================================================= */}
        {/* 3. SUPPLY POOLING & AGGREGATION MODEL                                     */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D5] shadow-xs">
          <div className="max-w-3xl mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C58B4E] bg-[#FDF8F0] px-2.5 py-1 rounded border border-[#F0DFCD]">
              Batch Pooling Mechanism
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight mt-2">
              {isHindi ? 'छोटे लॉट्स से बड़ा ऑर्डर: एग्रीगेशन मॉडल' : 'From Smallholder Lots to Bulk Orders: Aggregation Flow'}
            </h2>
            <p className="text-sm text-[#5A6860] mt-1 font-medium">
              {isHindi 
                ? 'अधिकांश भारतीय किसानों के पास 15-50 क्विंटल की छोटी फसल होती है, जबकि इंडस्ट्रियल खरीदार 100+ क्विंटल के बैच मांगते हैं। स्थानीय एग्रीगेटर/एफपीओ इस खाई को पाटते हैं।' 
                : 'Smallholder farmers typically produce 15-50 Quintals per harvest, whereas industrial buyers require minimum 100 Quintal standard batches. Local aggregators pool supply to bridge this mismatch.'}
            </p>
          </div>

          {/* Aggregation Diagram */}
          <div className="bg-[#FAF9F5] rounded-3xl p-5 sm:p-8 border border-[#E5E0D5]">
            <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
              
              {/* Individual Lots */}
              <div className="lg:col-span-4 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#315C45] mb-2 flex items-center justify-between">
                  <span>Smallholder Farmer Lots</span>
                  <span className="text-[10px] bg-[#EEF5F2] px-2 py-0.5 rounded text-[#315C45]">Farm-Gate</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#E5E0D5] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌾</span>
                    <div>
                      <div className="font-bold text-xs text-[#26332C]">Farmer A (Khandauli)</div>
                      <div className="text-[10px] text-[#637067]">Grade A • Moisture 14%</div>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#315C45] text-sm">20 {unitQ}</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#E5E0D5] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌾</span>
                    <div>
                      <div className="font-bold text-xs text-[#26332C]">Farmer B (Etmadpur)</div>
                      <div className="text-[10px] text-[#637067]">Grade A • Moisture 13%</div>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#315C45] text-sm">30 {unitQ}</span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#E5E0D5] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌾</span>
                    <div>
                      <div className="font-bold text-xs text-[#26332C]">Farmer C (Fatehabad)</div>
                      <div className="text-[10px] text-[#637067]">Grade A • Moisture 13.5%</div>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#315C45] text-sm">50 {unitQ}</span>
                </div>
              </div>

              {/* Pooling Arrow & Hub */}
              <div className="lg:col-span-3 text-center py-2 lg:py-0">
                <div className="p-4 rounded-2xl bg-[#FDF8F0] border-2 border-[#F0DFCD] text-center shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-[#C58B4E] text-white flex items-center justify-center text-2xl mx-auto mb-2">
                    📦
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#C58B4E]">
                    Aggregator / FPO Hub
                  </div>
                  <div className="text-lg font-black text-[#26332C] mt-1">
                    100 {unitQ} {isHindi ? 'पूल किया गया बैच' : 'Pooled Batch'}
                  </div>
                  <div className="text-[11px] text-[#6E5536] mt-1 font-medium">
                    Batch #KC-AGRA-100{unitQ}
                  </div>
                  <div className="mt-2 text-[10px] text-[#4A5750] bg-white py-1 px-2 rounded border border-[#E5E0D5]">
                    Quality Graded & Weighed
                  </div>
                </div>
              </div>

              {/* Bulk Buyer Fulfilment */}
              <div className="lg:col-span-4 bg-[#F0F4F6] rounded-2xl p-5 border border-[#DEE7EB]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#536B78] text-white flex items-center justify-center text-base">
                    🏭
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#536B78]">
                      Bulk Buyer Contract
                    </span>
                    <h4 className="text-sm font-black text-[#26332C]">
                      FreshBites Foods (Noida Plant)
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-[#5A6860] leading-relaxed mb-3">
                  {isHindi
                    ? '100 क्विंटल का एकीकृत लॉट एक ही चालान और सुरक्षित डिजिटल एस्क्रो भुगतान के साथ डिलीवर होता है।'
                    : '100 Quintal standardized supply delivered under single commercial dispatch note with digital escrow release.'}
                </p>

                <div className="space-y-1.5 text-[11px] text-[#4A5750] bg-white p-2.5 rounded-xl border border-[#D5E1E6]">
                  <div className="flex justify-between">
                    <span>Order Size:</span>
                    <strong className="text-[#26332C]">100 Quintals (10 MT)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Offer Price:</span>
                    <strong className="text-[#315C45]">₹1,850 / Quintal</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Terms:</span>
                    <strong className="text-[#26332C]">Direct Bank Transfer / Escrow</strong>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================================= */}
        {/* 4. NET REALIZATION BREAKDOWN                                              */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D5] shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#315C45] bg-[#EEF5F2] px-2.5 py-1 rounded border border-[#C5DDD2]">
                Economics & Farm-Gate Transparency
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight mt-2">
                {isHindi ? 'नेट वसूली हिसाब: किसान को क्या मिलता है?' : 'Net Realization Model: Transparent Farm-Gate Math'}
              </h2>
              <p className="text-sm text-[#5A6860] mt-2 leading-relaxed font-medium">
                {isHindi
                  ? 'मंडी में अनपेक्षित कटौती और गुप्त आढ़त के विपरीत, किसानकनेक्ट पर किसान को सौदे से पहले ही सटीक नेट भाव पता होता है।'
                  : 'Unlike traditional mandis with hidden cuts, bag deductions, and unexplained commissions, KisanConnect calculates full deductions upfront so farmers know their exact farm-gate net realization.'}
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#EEF5F2] text-[#315C45] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <strong className="text-xs text-[#26332C] block">
                      {isHindi ? 'पारदर्शी भाड़ा (Freight)' : 'Transparent Freight Deduction'}
                    </strong>
                    <span className="text-xs text-[#637067]">
                      Calculated on actual distance (₹/ton-km) rather than arbitrary lump sums.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#EEF5F2] text-[#315C45] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <strong className="text-xs text-[#26332C] block">
                      {isHindi ? 'लोडिंग व हैंडलिंग शुल्क' : 'Handling & Weighment Fee'}
                    </strong>
                    <span className="text-xs text-[#637067]">
                      Pre-agreed labor and crate handling fees with electronic weighment slips.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#EEF5F2] text-[#315C45] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <strong className="text-xs text-[#26332C] block">
                      {isHindi ? 'सुरक्षित डिजिटल भुगतान' : 'Escrow Protected Bank Settlement'}
                    </strong>
                    <span className="text-xs text-[#637067]">
                      Funds locked upon deal acceptance and released within 24-48 hours of dispatch.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Math Table Card */}
            <div className="bg-[#FAF9F5] rounded-3xl p-6 border border-[#E5E0D5] shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D5] mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#637067]">
                  Sample Calculation — 50 Quintal Potato Lot
                </span>
                <span className="text-[10px] font-bold text-[#315C45] bg-[#EEF5F2] px-2 py-0.5 rounded border border-[#C5DDD2]">
                  ILLUSTRATIVE
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 px-3 rounded-xl bg-white border border-[#E5E0D5]">
                  <span className="font-bold text-[#26332C]">{isHindi ? 'सकल खरीदार भाव' : 'Gross Buyer Offer'}</span>
                  <span className="font-extrabold text-[#26332C]">₹1,850 / {unitQ}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-xl bg-white/70 border border-[#E5E0D5]">
                  <span className="text-[#637067]">{isHindi ? 'परिवहन व भाड़ा' : 'Transport / Freight'} (35 {unitKm})</span>
                  <span className="font-bold text-[#8C3A3A]">− ₹110 / {unitQ}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-xl bg-white/70 border border-[#E5E0D5]">
                  <span className="text-[#637067]">{isHindi ? 'तुलाई व लोडिंग' : 'Loading, Crate & Weighment'}</span>
                  <span className="font-bold text-[#8C3A3A]">− ₹45 / {unitQ}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-xl bg-white/70 border border-[#E5E0D5]">
                  <span className="text-[#637067]">{isHindi ? 'प्लेटफ़ॉर्म समन्वय शुल्क' : 'Platform Coordination Fee'}</span>
                  <span className="font-bold text-[#8C3A3A]">− ₹25 / {unitQ}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t-2 border-[#D8D2C4]">
                <div className="p-4 rounded-2xl bg-[#EEF5F2] border-2 border-[#C5DDD2] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[#315C45]">
                      {isHindi ? 'किसान के हाथ में शुद्ध रकम' : 'Net Farmer Realization'}
                    </div>
                    <div className="text-3xl font-black text-[#315C45]">
                      ₹1,670 / {unitQ}
                    </div>
                    <div className="text-[10px] text-[#5A6860] mt-0.5">
                      {isHindi ? `खेत पर शुद्ध रकम (₹83,500 प्रति 50 ${unitQ})` : 'Net in hand at farm-gate (₹83,500 for 50 Q)'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#315C45] bg-white px-3 py-1.5 rounded-lg border border-[#C5DDD2]">
                    खेत पर वसूली
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-center text-[#7A8880] mt-3 italic">
                * Realization depends on quality grade and proximity to delivery point.
              </p>
            </div>
          </div>
        </section>


        {/* ========================================================================= */}
        {/* 5. STORAGE ECONOMICS: SELL NOW VS COLD STORAGE                             */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D5] shadow-xs">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3D6B75] bg-[#EEF5F6] px-2.5 py-1 rounded border border-[#D1E3E6]">
              Preservation Decision Logic
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight mt-2">
              {isHindi ? 'अभी बेचें या कोल्ड स्टोरेज में रखें?' : 'Sell Now vs Cold Storage: Analytical Framework'}
            </h2>
            <p className="text-sm text-[#5A6860] mt-1 font-medium">
              {isHindi 
                ? 'कटाई के समय भारी आवक से भाव गिरते हैं। किसानकनेक्ट किसान को तुरंत बेचने और 3-6 महीने बाद बेचने की तुलना दिखाता है।' 
                : 'At peak harvest, localized glut drops spot prices. KisanConnect provides clear decision trade-offs between immediate sale and off-season storage.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            
            {/* Option 1 */}
            <div className="p-6 rounded-2xl bg-[#FAF9F5] border-2 border-[#C5DDD2] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-[#315C45] bg-[#EEF5F2] px-2.5 py-0.5 rounded">
                    Option A: Immediate Sale
                  </span>
                  <span className="text-xs font-bold text-[#637067]">Liquidity Focus</span>
                </div>
                <div className="text-2xl font-black text-[#26332C] mt-2">
                  ₹1,670 / {unitQ} {isHindi ? 'शुद्ध रकम' : 'Net Realization'}
                </div>
                <p className="text-xs text-[#5A6860] mt-2 leading-relaxed">
                  Fast cash liquidity at farm gate with zero holding risk, zero storage rental, and zero moisture loss.
                </p>

                <div className="mt-4 space-y-1.5 text-xs text-[#4A5750]">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#315C45]" />
                    <span>Instant payment within 24-48 hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#315C45]" />
                    <span>No storage deposit or transport to cold store</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#315C45]" />
                    <span>Eliminates off-season price crash risk</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E5E0D5]">
                <button
                  type="button"
                  onClick={() => onSelectTab('farmer')}
                  className="w-full py-2.5 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Explore Farmer Sell Flow →</span>
                </button>
              </div>
            </div>

            {/* Option 2 */}
            <div className="p-6 rounded-2xl bg-[#FAF9F5] border-2 border-[#D1E3E6] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-[#3D6B75] bg-[#EEF5F6] px-2.5 py-0.5 rounded">
                    Option B: Cold Storage Intake
                  </span>
                  <span className="text-xs font-bold text-[#637067]">Off-Season Upside</span>
                </div>
                <div className="text-2xl font-black text-[#26332C] mt-2">
                  ~₹2,100 / {unitQ} {isHindi ? 'अनुमानित सकल' : 'Projected Gross'}
                </div>
                <p className="text-xs text-[#8C3A3A] mt-2 leading-relaxed font-semibold">
                  {isHindi ? `घटाएं स्टोरेज व हैंडलिंग: ~₹280 / ${unitQ} → शुद्ध संभावित: ~₹1,820 / ${unitQ}` : `Less Storage & Handling: ~₹280 / Q → Net Potential: ~₹1,820 / Q`}
                </p>

                <div className="mt-4 space-y-1.5 text-xs text-[#4A5750]">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#3D6B75]" />
                    <span>Digital e-NWR intake slip with cold room tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#3D6B75]" />
                    <span>Captures off-season festival & lean-period price premiums</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#3D6B75]" />
                    <span>Requires 4-6 months holding capacity</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E5E0D5]">
                <button
                  type="button"
                  onClick={() => onSelectTab('storage')}
                  className="w-full py-2.5 rounded-xl bg-[#3D6B75] hover:bg-[#325860] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Explore Cold Storage Network →</span>
                </button>
              </div>
            </div>

          </div>

          <p className="text-[11px] text-center text-[#7A8880] mt-4 italic">
            * Note: Future prices are market estimates, not guaranteed returns. Subject to regional supply dynamics.
          </p>
        </section>


        {/* ========================================================================= */}
        {/* 6. AI & FUTURE TECHNOLOGY ROADMAP                                         */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D5] shadow-xs">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#315C45] bg-[#EEF5F2] px-3 py-1 rounded-full border border-[#C5DDD2]">
              Future Capabilities / Planned Roadmap
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight mt-2">
              {isHindi ? 'एआई और तकनीकी रोडमैप' : 'AI & Advanced Agricultural Intelligence Roadmap'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5A6860] mt-2 font-medium">
              {isHindi
                ? 'वर्तमान में कोर प्लेटफॉर्म लाइव है। जैसे-जैसे लेनदेन और कटाई का डेटा बढ़ेगा, निम्नलिखित क्षमताएं चरणबद्ध रूप से जोड़ी जाएंगी:'
                : 'The core operational matching and order workflow is live. As harvest records and trade volume expand, the following AI capabilities are scheduled on the technical roadmap:'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-[#EEF5F2] text-[#315C45] flex items-center justify-center mb-2.5">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#315C45] bg-[#EEF5F2] px-1.5 py-0.5 rounded inline-block mb-1">
                  Phase 2
                </span>
                <h3 className="font-extrabold text-sm text-[#26332C] mb-1">
                  Supply Forecasting
                </h3>
                <p className="text-xs text-[#637067] leading-relaxed">
                  Correlating satellite NDVI imagery, sowing acreage, and mandi inflows to project regional harvest volume weeks ahead.
                </p>
              </div>
              <div className="text-[10px] text-[#7A8880] mt-3 pt-2 border-t border-[#EAE5D8]">
                Status: In Research & Model Design
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-[#FDF8F0] text-[#C58B4E] flex items-center justify-center mb-2.5">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#C58B4E] bg-[#FDF8F0] px-1.5 py-0.5 rounded inline-block mb-1">
                  Phase 2
                </span>
                <h3 className="font-extrabold text-sm text-[#26332C] mb-1">
                  Demand Forecasting
                </h3>
                <p className="text-xs text-[#637067] leading-relaxed">
                  Predictive buyer procurement calendars tracking processing capacity, seasonal demand cycles, and festival spikes.
                </p>
              </div>
              <div className="text-[10px] text-[#7A8880] mt-3 pt-2 border-t border-[#EAE5D8]">
                Status: Buyer Calibration Phase
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-[#F0F4F6] text-[#536B78] flex items-center justify-center mb-2.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#536B78] bg-[#F0F4F6] px-1.5 py-0.5 rounded inline-block mb-1">
                  Phase 3
                </span>
                <h3 className="font-extrabold text-sm text-[#26332C] mb-1">
                  Market & Price Insights
                </h3>
                <p className="text-xs text-[#637067] leading-relaxed">
                  Real-time APMC price indexing across 20+ regional mandis identifying inter-mandi spatial arbitrage opportunities.
                </p>
              </div>
              <div className="text-[10px] text-[#7A8880] mt-3 pt-2 border-t border-[#EAE5D8]">
                Status: API Feed Integration
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-[#EEF5F2] text-[#315C45] flex items-center justify-center mb-2.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#315C45] bg-[#EEF5F2] px-1.5 py-0.5 rounded inline-block mb-1">
                  Phase 3
                </span>
                <h3 className="font-extrabold text-sm text-[#26332C] mb-1">
                  Smart Matching
                </h3>
                <p className="text-xs text-[#637067] leading-relaxed">
                  Multi-objective optimization matching crop grade, moisture specs, distance, and truck capacity for lowest logistical friction.
                </p>
              </div>
              <div className="text-[10px] text-[#7A8880] mt-3 pt-2 border-t border-[#EAE5D8]">
                Status: Heuristic Testing
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-[#EEF5F2] text-[#315C45] flex items-center justify-center mb-2.5">
                  <Compass className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#315C45] bg-[#EEF5F2] px-1.5 py-0.5 rounded inline-block mb-1">
                  Phase 4
                </span>
                <h3 className="font-extrabold text-sm text-[#26332C] mb-1">
                  Yield Prediction
                </h3>
                <p className="text-xs text-[#637067] leading-relaxed">
                  Plot-level microclimate weather telemetry and soil organic carbon indicators forecasting expected harvest yield.
                </p>
              </div>
              <div className="text-[10px] text-[#7A8880] mt-3 pt-2 border-t border-[#EAE5D8]">
                Status: Long-Term Pilot
              </div>
            </div>

          </div>
        </section>


        {/* ========================================================================= */}
        {/* 7. LIVE PARTICIPANT PORTALS & DASHBOARD LINKS                              */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D5] shadow-xs">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-[#315C45] bg-[#EEF5F2] px-2.5 py-1 rounded border border-[#C5DDD2]">
              Interactive Role Portals
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#26332C] tracking-tight mt-2">
              {isHindi ? 'प्रत्येक हितधारक का समर्पित अनुभव' : 'Explore Dedicated Stakeholder Dashboards'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5A6860] mt-1 font-medium">
              {isHindi ? 'प्रत्येक हितधारक की समर्पित कार्यप्रणाली और डैशबोर्ड देखें:' : 'Explore the live operational workflows and dashboards built for each ecosystem role:'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            <button
              type="button"
              onClick={() => onSelectTab('farmer')}
              className="p-4 rounded-2xl bg-[#EEF5F2] border border-[#C5DDD2] hover:shadow-md transition-all text-center group cursor-pointer"
            >
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🌾</div>
              <div className="font-extrabold text-xs text-[#315C45]">Farmer Portal</div>
              <div className="text-[10px] text-[#5A6860] mt-1">List & Sell</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('aggregator')}
              className="p-4 rounded-2xl bg-[#FDF8F0] border border-[#F0DFCD] hover:shadow-md transition-all text-center group cursor-pointer"
            >
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">📦</div>
              <div className="font-extrabold text-xs text-[#C58B4E]">Aggregator Portal</div>
              <div className="text-[10px] text-[#5A6860] mt-1">Pool & Batch</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('buyer')}
              className="p-4 rounded-2xl bg-[#F0F4F6] border border-[#DEE7EB] hover:shadow-md transition-all text-center group cursor-pointer"
            >
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🏭</div>
              <div className="font-extrabold text-xs text-[#536B78]">Buyer Portal</div>
              <div className="text-[10px] text-[#5A6860] mt-1">Procure & Track</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('storage')}
              className="p-4 rounded-2xl bg-[#EEF5F6] border border-[#D1E3E6] hover:shadow-md transition-all text-center group cursor-pointer"
            >
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">❄️</div>
              <div className="font-extrabold text-xs text-[#3D6B75]">Cold Storage</div>
              <div className="text-[10px] text-[#5A6860] mt-1">Intake & Space</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('transport')}
              className="p-4 rounded-2xl bg-[#F7F5EF] border border-[#E0DBD0] hover:shadow-md transition-all text-center group cursor-pointer"
            >
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">🚚</div>
              <div className="font-extrabold text-xs text-[#26332C]">Transporter</div>
              <div className="text-[10px] text-[#5A6860] mt-1">Routes & Fleet</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('admin')}
              className="p-4 rounded-2xl bg-[#F5F2EB] border border-[#D8D2C4] hover:shadow-md transition-all text-center group cursor-pointer"
            >
              <div className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">⚙️</div>
              <div className="font-extrabold text-xs text-[#4A5750]">Admin Engine</div>
              <div className="text-[10px] text-[#5A6860] mt-1">Platform KPIs</div>
            </button>

          </div>
        </section>


        {/* Return to Farmer Landing CTA */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={() => onSelectTab('landing')}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white font-extrabold text-sm shadow-sm transition-all hover:shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isHindi ? 'किसान होम पर वापस जाएं' : 'Return to Farmer Landing Page'}</span>
          </button>
        </div>

      </div>

    </div>
  );
};

export default HowItWorksPage;
