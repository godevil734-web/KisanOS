import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { 
  Sprout, 
  Layers, 
  ShoppingBag, 
  Warehouse, 
  Truck, 
  ShieldCheck, 
  CheckCircle2, 
  X, 
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  Building,
  Lock,
  User as UserIcon,
  HelpCircle
} from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRoleSelect?: (role: UserRole, tab: string) => void;
  initialRole?: UserRole;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccessRoleSelect,
  initialRole = 'farmer' 
}) => {
  const { register } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Common Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('password123');
  const [location, setLocation] = useState('Agra, UP');

  // Role-Specific Profile Details
  // Farmer:
  const [farmName, setFarmName] = useState('');
  const [acres, setAcres] = useState<number>(8);
  const [cropsGrown, setCropsGrown] = useState<string[]>(['Potato', 'Wheat']);
  const [irrigationType, setIrrigationType] = useState('Tube well');

  // Aggregator:
  const [businessName, setBusinessName] = useState('');
  const [operatingRegion, setOperatingRegion] = useState('Agra - Mathura Cluster');
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(50);
  const [maxCapacityTons, setMaxCapacityTons] = useState<number>(60);

  // Buyer:
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState('Food Processor & Snack Manufacturer');
  const [annualDemandTons, setAnnualDemandTons] = useState<number>(1500);
  const [gstNumber, setGstNumber] = useState('07AAACP9876K1Z9');

  // Cold Storage:
  const [facilityName, setFacilityName] = useState('');
  const [storageCapacityTons, setStorageCapacityTons] = useState<number>(5000);
  const [chargePerMonthPerTon, setChargePerMonthPerTon] = useState<number>(450);

  // Transporter:
  const [agencyName, setAgencyName] = useState('');
  const [fleetSize, setFleetSize] = useState<number>(5);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(['Canter 6T', 'Tata 22T']);

  if (!isOpen) return null;

  // Preset Fast Demos for testing in 1-click
  const fillDemoData = (role: UserRole) => {
    const timestamp = Date.now().toString().slice(-4);
    if (role === 'farmer') {
      setName(`राधेश्याम वर्मा (${timestamp})`);
      setPhone(`+91 98765 ${timestamp}`);
      setLocation('Khandauli, Agra, UP');
      setFarmName('वर्मा कृषि फार्म');
      setAcres(10);
      setCropsGrown(['Potato', 'Onion', 'Tomato']);
      setIrrigationType('Tube well & Sprinkler');
    } else if (role === 'aggregator') {
      setName(`दिनेश चौधरी (${timestamp})`);
      setPhone(`+91 98222 ${timestamp}`);
      setLocation('Mathura Transport Hub, UP');
      setBusinessName('ब्रजभूमि कृषि संकलन केंद्र');
      setOperatingRegion('Mathura - Agra - Aligarh');
      setServiceRadiusKm(50);
      setMaxCapacityTons(80);
    } else if (role === 'buyer') {
      setName(`अमित सिंघानिया (${timestamp})`);
      setPhone(`+91 98333 ${timestamp}`);
      setLocation('Noida Food Park, UP');
      setCompanyName('Haldiram Snacks & Purees Pvt Ltd');
      setBusinessType('Industrial Food Processor');
      setAnnualDemandTons(3500);
      setGstNumber(`09AAACH${timestamp}A1Z1`);
    } else if (role === 'cold_storage') {
      setName(`हरिशंकर गुप्ता (${timestamp})`);
      setPhone(`+91 98444 ${timestamp}`);
      setLocation('Agra Highway, UP');
      setFacilityName('गुप्ता कोल्ड चेन एवं वेयरहाउस');
      setStorageCapacityTons(6000);
      setChargePerMonthPerTon(420);
    } else if (role === 'transporter') {
      setName(`मनोज कुमार यादव (${timestamp})`);
      setPhone(`+91 98555 ${timestamp}`);
      setLocation('Agra Bypass Freight Terminal');
      setAgencyName('यादव किसान एक्सप्रेस लॉजिस्टिक्स');
      setFleetSize(6);
      setVehicleTypes(['Canter 6T', 'Tata 22T', 'Bolero 2T']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const generatedEmail = `${phone.replace(/\D/g, '') || `user${Date.now()}`}@kisan.in`;

      let profileDetails: any = {};
      if (selectedRole === 'farmer') {
        profileDetails = {
          farmName: farmName || `${name}'s Farm`,
          acres: Number(acres) || 5,
          cropsGrown: cropsGrown.length ? cropsGrown : ['Potato'],
          irrigationType
        };
      } else if (selectedRole === 'aggregator') {
        profileDetails = {
          businessName: businessName || `${name} Agro Hub`,
          operatingRegion,
          serviceRadiusKm: Number(serviceRadiusKm) || 50,
          maxAggregationCapacityTons: Number(maxCapacityTons) || 50,
          allowedCrops: ['Potato', 'Onion', 'Wheat']
        };
      } else if (selectedRole === 'buyer') {
        profileDetails = {
          companyName: companyName || `${name} Foods Corp`,
          businessType,
          annualDemandTons: Number(annualDemandTons) || 500,
          gstNumber: gstNumber || '07AAACP0000A1Z5'
        };
      } else if (selectedRole === 'cold_storage') {
        profileDetails = {
          facilityName: facilityName || `${name} Cold Logistics`,
          capacityTons: Number(storageCapacityTons) || 5000,
          chargePerMonthPerTon: Number(chargePerMonthPerTon) || 450,
          supportedCrops: ['Potato', 'Apple', 'Onion']
        };
      } else if (selectedRole === 'transporter') {
        profileDetails = {
          agencyName: agencyName || `${name} Freight`,
          fleetSize: Number(fleetSize) || 4,
          vehicleTypes,
          routes: ['Agra - Mathura - Delhi - Kanpur']
        };
      }

      await register({
        name,
        email: generatedEmail,
        password,
        phone,
        location,
        role: selectedRole,
        profileDetails
      });

      setSuccessMsg(`स्वागत है, ${name}! आपका नया खाता बन गया है।`);
      setTimeout(() => {
        onClose();
        if (onSuccessRoleSelect) {
          const tab = selectedRole === 'cold_storage' 
            ? 'storage' 
            : selectedRole === 'transporter' 
            ? 'transport' 
            : selectedRole;
          onSuccessRoleSelect(selectedRole, tab);
        }
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'पंजीकरण में त्रुटि हुई। कृपया पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              KisanConnect ऑनबोर्डिंग
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              नया खाता बनाएं (Register New Account)
            </h3>
            <p className="text-xs text-slate-500">
              अपनी श्रेणी चुनें और तुरंत जुड़ें — किसान, आढ़ती, खरीदार या कोल्ड स्टोर
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Role Picker Tabs */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">आप कौन हैं? (Select Role):</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {[
              { id: 'farmer' as UserRole, label: 'किसान', sub: 'Farmer', icon: '🌾', color: 'emerald' },
              { id: 'aggregator' as UserRole, label: 'संग्राहक', sub: 'Aggregator', icon: '📦', color: 'amber' },
              { id: 'buyer' as UserRole, label: 'बड़ा खरीदार', sub: 'Big Buyer', icon: '🏭', color: 'blue' },
              { id: 'cold_storage' as UserRole, label: 'कोल्ड स्टोर', sub: 'Storage', icon: '❄️', color: 'cyan' },
              { id: 'transporter' as UserRole, label: 'ट्रांसपोर्टर', sub: 'Freight', icon: '🚚', color: 'purple' },
            ].map((r) => {
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r.id);
                    setError(null);
                  }}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center min-h-[68px] ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl">{r.icon}</span>
                  <div className="text-[11px] font-black mt-0.5 leading-tight">{r.label}</div>
                  <div className={`text-[9px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>{r.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Demo Fast Fill Button */}
        <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">परीक्षण के लिए डेमो डेटा भरें:</span>
          <button
            type="button"
            onClick={() => fillDemoData(selectedRole)}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-2xs"
          >
            <Sparkles className="h-3 w-3" />
            <span>1-क्लिक ऑटो-फिल</span>
          </button>
        </div>

        {/* Error / Success Notices */}
        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-200">
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold text-center animate-bounce">
            ✓ {successMsg}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* Basic Info: Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {selectedRole === 'farmer' ? 'किसान का पूरा नाम (Full Name)' : 'संपर्क व्यक्ति का नाम (Name)'} *
              </label>
              <input
                type="text"
                required
                placeholder="उदा. राधेश्याम वर्मा"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                मोबाइल नंबर (Phone Number) *
              </label>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Location & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                गाँव / शहर व जिला (Location) *
              </label>
              <input
                type="text"
                required
                placeholder="उदा. खंदौली, आगरा, यूपी"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                सुरक्षा पासवर्ड (Password) *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
              />
            </div>
          </div>

          {/* ROLE-SPECIFIC FIELDS */}

          {/* 1. FARMER PROFILE DETAILS */}
          {selectedRole === 'farmer' && (
            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-3">
              <div className="font-black text-emerald-900 text-xs">खेती की जानकारी (Farm Details):</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">खेत / फार्म का नाम</label>
                  <input
                    type="text"
                    placeholder="उदा. वर्मा कृषि फार्म"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">कुल जमीन (एकड़ / Acres)</label>
                  <input
                    type="number"
                    min={1}
                    value={acres}
                    onChange={(e) => setAcres(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">मुख्य फसलें (Crops Grown)</label>
                <div className="flex flex-wrap gap-2">
                  {['Potato', 'Onion', 'Tomato', 'Wheat', 'Mustard', 'Maize'].map((c) => {
                    const isChecked = cropsGrown.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setCropsGrown(cropsGrown.filter(x => x !== c));
                          } else {
                            setCropsGrown([...cropsGrown, c]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          isChecked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {c === 'Potato' ? '🥔 आलू' : c === 'Onion' ? '🧅 प्याज' : c === 'Tomato' ? '🍅 टमाटर' : c === 'Wheat' ? '🌾 गेहूं' : c === 'Mustard' ? '🌼 सरसों' : '🌽 मक्का'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. AGGREGATOR PROFILE DETAILS */}
          {selectedRole === 'aggregator' && (
            <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
              <div className="font-black text-amber-900 text-xs">व्यावसायिक केंद्र की जानकारी (Aggregator Hub Details):</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">फर्म / हब का नाम (Business Name)</label>
                  <input
                    type="text"
                    placeholder="उदा. ब्रजभूमि एग्रो कलेक्टिव्स"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">कार्यक्षेत्र (Operating Region)</label>
                  <input
                    type="text"
                    value={operatingRegion}
                    onChange={(e) => setOperatingRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">पिकअप दायरा (Service Radius)</label>
                  <select
                    value={serviceRadiusKm}
                    onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-bold"
                  >
                    <option value={25}>25 km Radius</option>
                    <option value={50}>50 km Radius (Standard)</option>
                    <option value={75}>75 km Radius</option>
                    <option value={100}>100 km Radius</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">अधिकतम बैच क्षमता (Tons)</label>
                  <input
                    type="number"
                    value={maxCapacityTons}
                    onChange={(e) => setMaxCapacityTons(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. BIG BUYER PROFILE DETAILS */}
          {selectedRole === 'buyer' && (
            <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-3">
              <div className="font-black text-blue-900 text-xs">खरीदार कंपनी की जानकारी (Buyer Company Details):</div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">कंपनी / ब्रांड का नाम (Company Name)</label>
                  <input
                    type="text"
                    placeholder="उदा. Haldiram Snacks Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">व्यवसाय का प्रकार (Business Type)</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white font-bold"
                  >
                    <option value="Food Processor & Snack Manufacturer">Food Processor (चिप्स, वेफर्स, स्नैक्स)</option>
                    <option value="Modern Supermarket Chain">Modern Retail / Supermarket (सुपरमार्केट)</option>
                    <option value="Large Mandi Wholesaler">Mandi Bulk Wholesaler (थोक व्यापारी)</option>
                    <option value="Export House">Agri Exporter (कृषि निर्यातक)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">वार्षिक खरीद मांग (Annual Demand Tons)</label>
                  <input
                    type="number"
                    value={annualDemandTons}
                    onChange={(e) => setAnnualDemandTons(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">जीएसटी नंबर (GSTIN)</label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. COLD STORAGE PROFILE DETAILS */}
          {selectedRole === 'cold_storage' && (
            <div className="p-3.5 bg-cyan-50/70 rounded-2xl border border-cyan-200 space-y-3">
              <div className="font-black text-cyan-900 text-xs">कोल्ड स्टोरेज की जानकारी:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">फैसिलिटी का नाम (Cold Storage Name)</label>
                  <input
                    type="text"
                    placeholder="उदा. आगरा इम्पीरियल कोल्ड लॉजिस्टिक्स"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-cyan-300 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">कुल क्षमता (Total Capacity Tons)</label>
                  <input
                    type="number"
                    value={storageCapacityTons}
                    onChange={(e) => setStorageCapacityTons(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-cyan-300 bg-white font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">मासिक किराया दर (₹ / Ton / Month)</label>
                <input
                  type="number"
                  value={chargePerMonthPerTon}
                  onChange={(e) => setChargePerMonthPerTon(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-300 bg-white font-bold"
                />
              </div>
            </div>
          )}

          {/* 5. TRANSPORTER PROFILE DETAILS */}
          {selectedRole === 'transporter' && (
            <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-3">
              <div className="font-black text-purple-900 text-xs">ट्रांसपोर्ट एजेंसी की जानकारी:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ट्रांसपोर्ट एजेंसी का नाम</label>
                  <input
                    type="text"
                    placeholder="उदा. किसान एक्सप्रेस फ्रेट"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">गाड़ियों की संख्या (Fleet Size)</label>
                  <input
                    type="number"
                    value={fleetSize}
                    onChange={(e) => setFleetSize(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 bg-white font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
            >
              {loading ? (
                <span>खाता बनाया जा रहा है...</span>
              ) : (
                <>
                  <span>नया खाता बनाएं और शुरू करें 🚀</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default RegisterModal;
