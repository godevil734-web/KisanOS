import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, ArrowRight, CheckCircle2, Phone, MapPin, User, Sprout, Sparkles } from 'lucide-react';

interface FarmerRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSwitchToLogin?: () => void;
}

export const FarmerRegisterModal: React.FC<FarmerRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToLogin,
}) => {
  const { register } = useAuth();
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('Agra');
  const [primaryCrop, setPrimaryCrop] = useState('आलू (Potato)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = () => {
    if (!mobileNumber || mobileNumber.replace(/\D/g, '').length < 10) {
      setError('कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें (Enter valid 10-digit mobile number)');
      return;
    }
    setError(null);
    setOtpSent(true);
    // Auto-fill demo OTP for effortless trial
    setOtp('1234');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = mobileNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('कृपया 10 अंकों का मोबाइल नंबर दर्ज करें');
      return;
    }

    if (!name.trim()) {
      setError('कृपया अपना नाम दर्ज करें (Please enter your name)');
      return;
    }

    if (!village.trim()) {
      setError('कृपया अपने गाँव का नाम दर्ज करें (Please enter your village)');
      return;
    }

    setLoading(true);

    try {
      const generatedEmail = `farmer-${cleanPhone || Date.now()}@kisan.in`;
      await register({
        name: name.trim(),
        email: generatedEmail,
        password: 'password123',
        phone: `+91 ${cleanPhone.slice(-10)}`,
        location: `${village.trim()}, ${district}, UP`,
        role: 'farmer',
        profileDetails: {
          farmName: `${name.trim()} का खेत`,
          acres: 8,
          cropsGrown: [primaryCrop.split(' ')[0]],
          irrigationType: 'Tube well'
        }
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'पंजीकरण विफल रहा। कृपया पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 sm:px-8 pt-7 pb-5 bg-gradient-to-b from-emerald-50/60 to-white border-b border-stone-100">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title="बंद करें"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
            <span>🌾 किसान पंजीकरण</span>
            <span>•</span>
            <span>Farmer Registration</span>
          </div>

          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            अपनी फसल सीधे खरीदारों को बेचें
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            2 मिनट में नया किसान खाता बनाएं। कोई जटिल दस्तावेज़ नहीं।
          </p>
        </div>

        {/* Short Registration Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* 1. Mobile Number & OTP */}
          <div className="space-y-2">
            <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              <span>मोबाइल नंबर (Mobile Number) *</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="98765 43210"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                className="px-4 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors shrink-0"
              >
                {otpSent ? 'OTP भेजा गया ✓' : 'OTP भेजें'}
              </button>
            </div>
          </div>

          {/* 2. OTP Input */}
          {otpSent && (
            <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-900">
                  OTP दर्ज करें (Enter OTP):
                </label>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  डेमो OTP: 1234
                </span>
              </div>
              <input
                type="text"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="4-digit OTP"
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 text-center text-lg font-black tracking-widest text-emerald-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          )}

          {/* 3. Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              <span>किसान का पूरा नाम (Full Name) *</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="उदा. रमेश कुमार शर्मा"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          {/* 4. Village & District */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>गाँव (Village) *</span>
              </label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="उदा. खंदौली (Khandauli)"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-stone-800">
                जिला (District) *
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="Agra">Agra (आगरा)</option>
                <option value="Mathura">Mathura (मथुरा)</option>
                <option value="Aligarh">Aligarh (अलीगढ़)</option>
                <option value="Firozabad">Firozabad (फिरोजाबाद)</option>
                <option value="Hathras">Hathras (हाथरस)</option>
                <option value="Etawah">Etawah (इटावा)</option>
                <option value="Mainpuri">Mainpuri (मैनपुरी)</option>
              </select>
            </div>
          </div>

          {/* 5. Primary Crop */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-700" />
              <span>मुख्य फसल (Primary Crop) *</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: '🥔 आलू', val: 'आलू (Potato)' },
                { label: '🌾 गेहूं', val: 'गेहूं (Wheat)' },
                { label: '🌽 मक्का', val: 'मक्का (Maize)' },
                { label: '🍅 टमाटर', val: 'टमाटर (Tomato)' },
                { label: '🧅 प्याज', val: 'प्याज (Onion)' },
                { label: '🌱 अन्य फसल', val: 'अन्य फसल (Other)' },
              ].map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => setPrimaryCrop(c.val)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-all ${
                    primaryCrop === c.val
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-emerald-400'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-800/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>खाता बनाएं और फसल बेचें (Register & Continue)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Quick Switch to Login */}
          <div className="text-center pt-2 text-xs text-stone-500">
            <span>पहले से पंजीकृत हैं? </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onSwitchToLogin) onSwitchToLogin();
              }}
              className="font-bold text-emerald-700 hover:underline"
            >
              सीधे लॉगिन करें (Login here)
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default FarmerRegisterModal;
