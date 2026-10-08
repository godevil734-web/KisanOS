import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { GoogleAuthButton } from './GoogleAuthButton';
import { Sprout, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Building2, UserPlus, Lock, Phone, ChevronDown, Check } from 'lucide-react';

interface SignUpPageProps {
  onSuccess: (target: string) => void;
  onNavigate: (path: string) => void;
}

type SignUpRole = 'farmer' | 'aggregator' | 'dealer';

export const SignUpPage: React.FC<SignUpPageProps> = ({ onSuccess, onNavigate }) => {
  const { signupFarmer, signupBusiness, loginWithOtp, sendOtp, googleInit, googleVerifyOtp, googleRegister, googleResendOtp } = useAuth();
  const { t, language } = useLanguage();
  const isHi = language === 'hi';

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<SignUpRole>('farmer');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(true);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  // Helper to map roles to their target routes
  const getRoleDestination = (role: string) => {
    if (role === 'farmer') return '/list-crop';
    if (role === 'aggregator') return '/aggregator';
    if (role === 'dealer' || role === 'buyer') return '/buyer';
    if (role === 'admin') return '/admin';
    return '/dashboard';
  };

  // Google Existing User Login State (when existing user signs in with Google)
  const [googleExistingUser, setGoogleExistingUser] = useState<{
    tempToken: string;
    email: string;
    maskedEmail: string;
    role: string;
    user?: any;
  } | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Step 2 Form States - Farmer
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [farmerPassword, setFarmerPassword] = useState('');
  const [villageDistrict, setVillageDistrict] = useState('');
  const [mainCrops, setMainCrops] = useState<string[]>(['potato']);
  
  // Farmer OTP verification sub-step
  const [farmerOtpSent, setFarmerOtpSent] = useState(false);
  const [farmerOtpCode, setFarmerOtpCode] = useState('');
  const [farmerCooldown, setFarmerCooldown] = useState(0);

  // Step 2 Form States - Aggregator / Dealer
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [businessMobile, setBusinessMobile] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');

  // Google Sign-up State (Email OTP Verification)
  const [googleProfile, setGoogleProfile] = useState<{
    email: string;
    name: string;
    googleId: string;
    picture?: string;
  } | null>(null);
  const [googlePhone, setGooglePhone] = useState('');
  const [googlePassword, setGooglePassword] = useState('');
  const [googleOtpCode, setGoogleOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successPendingMsg, setSuccessPendingMsg] = useState<string | null>(null);

  const availableCrops = [
    { id: 'potato', name: isHi ? 'आलू' : 'Potato' },
    { id: 'wheat', name: isHi ? 'गेहूं' : 'Wheat' },
    { id: 'mustard', name: isHi ? 'सरसों' : 'Mustard' },
    { id: 'tomato', name: isHi ? 'टमाटर' : 'Tomato' },
    { id: 'onion', name: isHi ? 'प्याज़' : 'Onion' },
    { id: 'rice', name: isHi ? 'धान / चावल' : 'Paddy / Rice' }
  ];

  const handleSelectRole = (role: SignUpRole) => {
    setSelectedRole(role);
    setStep(2);
    setErrorMsg(null);
  };

  const toggleCrop = (cropId: string) => {
    if (mainCrops.includes(cropId)) {
      if (mainCrops.length > 1) {
        setMainCrops(mainCrops.filter(c => c !== cropId));
      }
    } else {
      setMainCrops([...mainCrops, cropId]);
    }
  };

  // Submit Farmer Registration
  const handleFarmerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = farmerPhone.replace(/\D/g, '').slice(-10);
    if (!farmerName.trim() || cleanPhone.length !== 10) {
      setErrorMsg(isHi ? 'कृपया अपना नाम और 10 अंकों का मोबाइल नंबर दर्ज करें' : 'Please enter your name and 10-digit mobile');
      return;
    }
    if (farmerPassword && farmerPassword.length < 6) {
      setErrorMsg(isHi ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए' : 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await signupFarmer({
        name: farmerName.trim(),
        phone: cleanPhone,
        villageDistrict: villageDistrict.trim() || 'Agra, UP',
        mainCrops,
        password: farmerPassword || undefined
      });
      setFarmerOtpSent(true);
      setFarmerOtpCode('');
      setFarmerCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Cooldown effect for resend email OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Cooldown effect for farmer mobile OTP
  useEffect(() => {
    if (farmerCooldown <= 0) return;
    const t = setTimeout(() => setFarmerCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [farmerCooldown]);


  // Google 1-Click Auth inside a specific role section (Step 2)
  const handleGoogleAuthInRole = async (googleData: { email: string; name: string; googleId: string; picture?: string; credential?: string }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await googleInit(googleData.credential ? { credential: googleData.credential } : { googleUser: googleData });
      if (res.status === 'OTP_REQUIRED') {
        // Existing user found! Provide inline Google OTP login
        setGoogleProfile(null);
        setGoogleExistingUser({
          tempToken: res.tempToken,
          maskedEmail: res.maskedEmail || res.email,
          email: res.email,
          role: res.role,
          user: res.user
        });
        setGoogleOtpCode('');
        setResendCooldown(60);
        return;
      }
      if (res.status === 'REGISTER_REQUIRED') {
        // New user! Enable Google registration for this role
        setGoogleExistingUser(null);
        setGoogleProfile(res.googleProfile || googleData);
        setFarmerName(googleData.name);
        setContactPerson(googleData.name);
        setBusinessEmail(googleData.email);
        setGoogleOtpCode('');
        setResendCooldown(60);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Google Email OTP Verification for Existing User Login
  const handleGoogleVerifyExistingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleExistingUser) return;
    if (!googleOtpCode || googleOtpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया Google ईमेल पर भेजा गया 6 अंकों का कोड दर्ज करें' : 'Please enter the 6-digit email verification code');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await googleVerifyOtp(googleExistingUser.tempToken, googleOtpCode.trim());
      onSuccess(getRoleDestination(loggedUser?.role || googleExistingUser.role || selectedRole));
    } catch (err: any) {
      setErrorMsg(err.message || 'Google OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Resend Email OTP for Existing User Login
  const handleResendGoogleLoginEmailOtp = async () => {
    if (!googleExistingUser?.email || resendCooldown > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await googleResendOtp(googleExistingUser.email);
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification code');
    } finally {
      setLoading(false);
    }
  };

  // Resend Email OTP for Google Registration
  const handleResendGoogleEmailOtp = async () => {
    if (!googleProfile?.email || resendCooldown > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await googleResendOtp(googleProfile.email);
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend email verification code');
    } finally {
      setLoading(false);
    }
  };

  // Submit Google Registration with Email OTP & Created Password
  const handleGoogleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleProfile) return;
    if (!googleOtpCode || googleOtpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया Google ईमेल पर भेजा गया 6 अंकों का कोड दर्ज करें' : 'Please enter the 6-digit email verification code');
      return;
    }
    if (googlePassword && googlePassword.length < 6) {
      setErrorMsg(isHi ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए' : 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const cleanPhone = googlePhone.replace(/\D/g, '').slice(-10);
      const payload: any = {
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        name: selectedRole === 'farmer' ? (farmerName.trim() || googleProfile.name) : (contactPerson.trim() || googleProfile.name),
        avatarUrl: googleProfile.picture,
        phone: cleanPhone || undefined,
        code: googleOtpCode.trim(),
        password: googlePassword || undefined,
        role: selectedRole
      };

      if (selectedRole === 'farmer') {
        payload.villageDistrict = villageDistrict.trim() || 'Agra, UP';
        payload.mainCrops = mainCrops;
      } else {
        payload.businessName = (businessName.trim() || `${selectedRole.toUpperCase()} Enterprise`);
        payload.contactPerson = contactPerson.trim() || googleProfile.name;
        payload.city = city.trim() || 'Agra, UP';
      }

      const res = await googleRegister(payload);
      if (res.status === 'pending') {
        setSuccessPendingMsg(res.message || 'Registration submitted! Waiting for approval.');
        setTimeout(() => {
          onSuccess(selectedRole === 'aggregator' ? '/aggregator' : '/dealer');
        }, 1500);
      } else {
        onSuccess(selectedRole === 'farmer' ? '/list-crop' : `/${selectedRole}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Verify Farmer OTP & complete
  const handleFarmerOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = farmerPhone.replace(/\D/g, '').slice(-10);
    setLoading(true);
    setErrorMsg(null);
    try {
      await loginWithOtp(cleanPhone, farmerOtpCode.trim(), 'farmer');
      onSuccess('/list-crop');
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Resend Farmer Mobile OTP
  const handleResendFarmerOtp = async () => {
    const cleanPhone = farmerPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || farmerCooldown > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await sendOtp(cleanPhone);
      setFarmerCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Submit Aggregator / Dealer Registration
  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = businessMobile.replace(/\D/g, '').slice(-10);
    if (!businessName.trim() || !contactPerson.trim() || cleanMobile.length !== 10 || !businessEmail.trim() || password.length < 6) {
      setErrorMsg(isHi ? 'कृपया सभी विवरण भरें (पासवर्ड कम से कम 6 अक्षरों का होना चाहिए)' : 'Please fill all details (password min 6 chars)');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await signupBusiness({
        role: selectedRole,
        businessName: businessName.trim(),
        contactPerson: contactPerson.trim(),
        mobile: cleanMobile,
        email: businessEmail.trim(),
        city: city.trim() || 'Agra, UP',
        password
      });
      setSuccessPendingMsg(res.message || 'Registration submitted! Waiting for approval.');
      setTimeout(() => {
        onSuccess(selectedRole === 'aggregator' ? '/aggregator' : '/dealer');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4 max-w-xl mx-auto animate-in fade-in duration-150 relative z-10">
      
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-[#D8D2C4] shadow-xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 shadow-xs mb-3">
            <UserPlus className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1C2B23]">
            {step === 1 
              ? (isHi ? 'साइन अप करें — अपनी भूमिका चुनें' : 'Sign Up — Choose Your Role')
              : (isHi ? 'विवरण दर्ज करें' : 'Enter Registration Details')
            }
          </h1>
          <p className="text-sm sm:text-base text-[#2B3B32] mt-1 font-medium">
            {step === 1
              ? (isHi ? 'कदम 1/2: आप किसानकनेक्ट का उपयोग किस रूप में करना चाहते हैं?' : 'Step 1/2: How will you be using KisanConnect?')
              : (isHi ? 'कदम 2/2: अपना विवरण दर्ज करें और नेटवर्क से जुड़ें' : 'Step 2/2: Complete your registration to join the network')
            }
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-900 text-xs sm:text-sm font-bold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-700 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successPendingMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs sm:text-sm font-bold flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <div className="font-extrabold">{isHi ? 'पंजीकरण सफल (अनुमोदन लंबित)' : 'Registration Successful (Pending Approval)'}</div>
              <div className="font-medium text-xs mt-0.5">{successPendingMsg}</div>
            </div>
          </div>
        )}

        {/* STEP 1: Role Selection Dropdown Menu */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Dropdown Menu for Role Selection */}
            <div className="space-y-3" ref={roleDropdownRef}>
              <label className="block text-xs sm:text-sm font-black text-[#1C2B23] uppercase tracking-wider">
                {isHi ? 'भूमिका चुनें (ड्रॉपडाउन मेन्यू)' : 'Choose Role from Dropdown Menu'}
              </label>

              {/* Dropdown Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className={`w-full min-h-[56px] px-4 py-3 rounded-2xl border-2 transition-all flex items-center justify-between text-left cursor-pointer shadow-xs ${
                    roleDropdownOpen
                      ? 'border-slate-800 bg-white ring-4 ring-slate-900/10'
                      : 'border-[#D8D2C4] bg-[#FAF9F5] hover:bg-white hover:border-slate-800'
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={roleDropdownOpen}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl">
                      {selectedRole === 'farmer' ? '🌾' : selectedRole === 'aggregator' ? '📦' : '🏢'}
                    </span>
                    <div>
                      <div className="text-sm sm:text-base font-black text-[#1C2B23]">
                        {isHi ? 'ड्रॉपडाउन से अपनी भूमिका चुनें...' : 'Select your role from dropdown...'}
                      </div>
                      <div className="text-xs text-[#5A6860] font-medium">
                        {isHi ? '3 विकल्प: किसान, एग्रीगेटर, थोक खरीदार' : '3 options: Farmer, Aggregator, Big Dealer'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg hidden sm:inline-block">
                      {roleDropdownOpen ? (isHi ? 'मेनू बंद करें' : 'Close Menu') : (isHi ? 'मेनू खोलें' : 'Open Menu')}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-800 transition-transform duration-200 shrink-0 ${roleDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Menu Options */}
                {roleDropdownOpen && (
                  <div className="mt-2.5 rounded-2xl bg-white border-2 border-slate-800 shadow-xl p-2 z-20 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-black text-[#71856B] uppercase tracking-wider border-b border-[#F0ECE1] flex items-center justify-between">
                      <span>{isHi ? 'विकल्प चुनें (क्लिक करते ही चयन पूरा होगा)' : 'Select Option (Clicking finishes this part)'}</span>
                      <span className="text-[10px] font-mono font-bold text-stone-500 uppercase">3 Options</span>
                    </div>

                    {/* 1. Farmer */}
                    <div 
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        handleSelectRole('farmer');
                      }}
                      className="p-4 rounded-xl border-2 border-[#C5DDD2] hover:border-slate-800 bg-[#FAF9F5] hover:bg-white cursor-pointer transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">🌾</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-[#1C2B23] group-hover:text-slate-900">
                              {isHi ? 'किसान (Farmer / Producer)' : 'Farmer (Producer)'}
                            </h3>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                              {isHi ? 'उत्पादक' : 'Producer'}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                              ⚡ Google / OTP
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#2B3B32] font-medium mt-0.5">
                            {isHi ? 'फसल लिस्ट करें, खेत पर सही भाव पाएं, Google या मोबाइल ओटीपी से लॉगिन।' : 'List harvest, get fair farm-gate prices, Google or mobile OTP login.'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-1 transition-transform shrink-0" />
                    </div>

                    {/* 2. Aggregator / FPO */}
                    <div 
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        handleSelectRole('aggregator');
                      }}
                      className="p-4 rounded-xl border-2 border-[#D8D2C4] hover:border-slate-800 bg-[#FAF9F5] hover:bg-white cursor-pointer transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">📦</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-[#1C2B23] group-hover:text-slate-900">
                              {isHi ? 'स्थानीय एग्रीगेटर / एफपीओ (Aggregator)' : 'Aggregator / FPO'}
                            </h3>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              {isHi ? 'संग्राहक' : 'FPO / Hub'}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                              ⚡ Google / Form
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#2B3B32] font-medium mt-0.5">
                            {isHi ? 'छोटे लॉट्स इकट्ठा कर 60T+ बड़े बैच बनाएं। Google या व्यापार विवरण से जुड़ें।' : 'Aggregate small lots into bulk batches. Google or business form.'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-1 transition-transform shrink-0" />
                    </div>

                    {/* 3. Big Dealer */}
                    <div 
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        handleSelectRole('dealer');
                      }}
                      className="p-4 rounded-xl border-2 border-[#D8D2C4] hover:border-slate-800 bg-[#FAF9F5] hover:bg-white cursor-pointer transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">🏢</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-[#1C2B23] group-hover:text-slate-900">
                              {isHi ? 'थोक व्यापारी / खरीदार (Big Dealer / Buyer)' : 'Big Dealer / Buyer'}
                            </h3>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                              {isHi ? 'थोक खरीदार' : 'Big Buyer'}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-300">
                              ⚡ Google / Form
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#2B3B32] font-medium mt-0.5">
                            {isHi ? 'सीधे खेतों व एग्रीगेटर से बल्क सप्लाई खरीदें। Google या व्यापार विवरण से जुड़ें।' : 'Procure bulk volume directly from farms & aggregators. Google or business form.'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-1 transition-transform shrink-0" />
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Role-Specific Form or Google Registration Form */}
        {step === 2 && (
          <div>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setRoleDropdownOpen(true);
                setErrorMsg(null);
                setFarmerOtpSent(false);
                setGoogleProfile(null);
                setGoogleExistingUser(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E3A2B] hover:underline mb-4 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isHi ? '← भूमिका पुनः चुनें' : '← Change role'}</span>
            </button>

            {/* Role Header Banner */}
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-[#EEF5F2] border border-[#C5DDD2] mb-5">
              <span className="text-3xl sm:text-4xl">
                {selectedRole === 'farmer' ? '🌾' : selectedRole === 'aggregator' ? '📦' : '🏢'}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-[#1C2B23]">
                    {selectedRole === 'farmer' 
                      ? (isHi ? 'किसान पंजीकरण एवं प्रवेश' : 'Farmer Access & Registration')
                      : selectedRole === 'aggregator'
                      ? (isHi ? 'एग्रीगेटर / एफपीओ पंजीकरण' : 'Aggregator / FPO Onboarding')
                      : (isHi ? 'थोक खरीदार पंजीकरण' : 'Big Dealer / Buyer Onboarding')
                    }
                  </h2>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                    selectedRole === 'farmer' 
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : selectedRole === 'aggregator'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-blue-100 text-blue-900 border-blue-300'
                  }`}>
                    {selectedRole === 'farmer' ? (isHi ? 'उत्पादक' : 'Producer') : selectedRole === 'aggregator' ? (isHi ? 'संग्राहक' : 'FPO / Hub') : (isHi ? 'थोक खरीदार' : 'Big Buyer')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#2B3B32] font-medium mt-0.5">
                  {selectedRole === 'farmer'
                    ? (isHi ? 'फसल लिस्ट करें, खेत पर सही भाव पाएं, मोबाइल ओटीपी या Google से तुरंत लॉगिन।' : 'List harvest, get fair farm-gate prices, instant Google or OTP login.')
                    : selectedRole === 'aggregator'
                    ? (isHi ? 'छोटे लॉट्स इकट्ठा कर 60T+ बैच बनाएं। Google या व्यापार विवरण से जुड़ें।' : 'Aggregate small lots into bulk batches. Google or business signup.')
                    : (isHi ? 'सीधे खेतों व एग्रीगेटर से बल्क सप्लाई खरीदें। Google या व्यापार विवरण से जुड़ें।' : 'Procure bulk volume directly from farms & aggregators. Google or business signup.')
                  }
                </p>
              </div>
            </div>

            {/* Existing User Google Login Card */}
            {googleExistingUser && (
              <div className="p-5 rounded-2xl bg-emerald-50/80 border-2 border-emerald-400 space-y-4 mb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold shadow-xs">
                      👋
                    </div>
                    <div>
                      <h3 className="text-base font-black text-emerald-950">
                        {isHi ? `स्वागत है, ${googleExistingUser.user?.name || 'उपयोगकर्ता'}!` : `Welcome back, ${googleExistingUser.user?.name || 'User'}!`}
                      </h3>
                      <p className="text-xs text-emerald-800 font-medium">
                        {isHi 
                          ? `सत्यापन कोड आपके Google ईमेल (${googleExistingUser.maskedEmail}) पर भेजा गया है।` 
                          : `Verification code sent to your Google email (${googleExistingUser.maskedEmail}).`
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleExistingUser(null);
                      setErrorMsg(null);
                    }}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                  >
                    {isHi ? 'रद्द करें' : 'Cancel'}
                  </button>
                </div>

                <form onSubmit={handleGoogleVerifyExistingUser} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wider">
                        {isHi ? '6-अंकों का Google ईमेल कोड' : '6-Digit Google Email Code'}
                      </label>
                      <button
                        type="button"
                        onClick={handleResendGoogleLoginEmailOtp}
                        disabled={resendCooldown > 0 || loading}
                        className="text-xs font-bold text-emerald-800 hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        {resendCooldown > 0
                          ? `${isHi ? 'पुनः भेजें' : 'Resend in'} ${resendCooldown}s`
                          : (isHi ? 'कोड दोबारा भेजें' : 'Resend Code')}
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={googleOtpCode}
                      onChange={(e) => setGoogleOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-emerald-400 focus:border-emerald-600 bg-white font-black text-lg text-center tracking-widest text-emerald-950 outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || googleOtpCode.trim().length !== 6}
                    className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{loading ? (isHi ? 'लॉगिन हो रहा है...' : 'Logging in...') : (isHi ? 'सत्यापित करें और लॉगिन करें' : 'Verify & Log In')}</span>
                    <ArrowRight className="w-5 h-5 text-emerald-400" />
                  </button>
                </form>
              </div>
            )}

            {/* Google 1-Click Auth Card for This Specific Role */}
            {!googleProfile && !googleExistingUser && !farmerOtpSent && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F5] border-2 border-[#D8D2C4] shadow-2xs text-center space-y-3 mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-black uppercase tracking-wider border border-emerald-300">
                  ⚡ {isHi ? '1-क्लिक त्वरित Google लॉगिन / साइनअप' : '1-Click Fast Google Login / Sign Up'}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#1C2B23]">
                    {selectedRole === 'farmer' 
                      ? (isHi ? 'Google से किसान साइन अप / लॉगिन' : 'Sign Up or Log In with Google as Farmer')
                      : selectedRole === 'aggregator'
                      ? (isHi ? 'Google से एग्रीगेटर साइन अप / लॉगिन' : 'Sign Up or Log In with Google as Aggregator')
                      : (isHi ? 'Google से थोक खरीदार साइन अप / लॉगिन' : 'Sign Up or Log In with Google as Buyer')
                    }
                  </h3>
                  <p className="text-xs text-[#5A6860] font-medium mt-0.5">
                    {isHi 
                      ? 'यदि पहले से खाता है तो सीधे लॉगिन होगा, नए उपयोगकर्ता के लिए 1-क्लिक पंजीकरण।'
                      : 'Logs in automatically if registered, or complete 1-click registration for this role.'
                    }
                  </p>
                </div>
                <div className="pt-1">
                  <GoogleAuthButton
                    onSuccess={handleGoogleAuthInRole}
                    onError={(err) => setErrorMsg(err)}
                    buttonText={
                      selectedRole === 'farmer'
                        ? (isHi ? 'Google से किसान लॉगिन / रजिस्टर करें' : 'Continue with Google as Farmer')
                        : selectedRole === 'aggregator'
                        ? (isHi ? 'Google से एग्रीगेटर लॉगिन / रजिस्टर करें' : 'Continue with Google as Aggregator')
                        : (isHi ? 'Google से खरीदार लॉगिन / रजिस्टर करें' : 'Continue with Google as Buyer')
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Divider between Google and Role-specific manual form */}
            {!googleProfile && !googleExistingUser && !farmerOtpSent && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#D8D2C4]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-[#5A6860] font-black tracking-wider">
                    {selectedRole === 'farmer'
                      ? (isHi ? 'या मोबाइल नंबर (ओटीपी) से किसान खाता बनाएं' : 'Or register with Mobile OTP')
                      : (isHi ? 'या व्यापार विवरण भरकर पंजीकरण करें' : 'Or register with business details')
                    }
                  </span>
                </div>
              </div>
            )}

            {/* GOOGLE REGISTRATION FLOW (If signed in via Google) */}
            {googleProfile ? (
              <form onSubmit={handleGoogleRegisterSubmit} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                      {isHi ? 'सत्यापित Google खाता' : 'Verified Google Account'}
                    </span>
                    <span className="text-sm font-black text-emerald-950">
                      {googleProfile.name} ({googleProfile.email})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGoogleProfile(null)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-950 underline"
                  >
                    {isHi ? 'बदलें' : 'Change'}
                  </button>
                </div>

                {/* Role Switcher */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('farmer')}
                    className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      selectedRole === 'farmer' ? 'bg-slate-900 text-white shadow-xs' : 'text-stone-700 hover:bg-white'
                    }`}
                  >
                    🌾 {isHi ? 'किसान' : 'Farmer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('aggregator')}
                    className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      selectedRole === 'aggregator' ? 'bg-slate-900 text-white shadow-xs' : 'text-stone-700 hover:bg-white'
                    }`}
                  >
                    📦 {isHi ? 'एग्रीगेटर' : 'Aggregator'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('dealer')}
                    className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      selectedRole === 'dealer' ? 'bg-slate-900 text-white shadow-xs' : 'text-stone-700 hover:bg-white'
                    }`}
                  >
                    🏢 {isHi ? 'थोक व्यापारी' : 'Dealer'}
                  </button>
                </div>

                {/* Email Verification OTP Code */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] uppercase tracking-wider">
                      {isHi ? 'Google ईमेल सत्यापन कोड (6-अंक)' : 'Google Email Verification Code (6 Digits)'}
                    </label>
                    <button
                      type="button"
                      onClick={handleResendGoogleEmailOtp}
                      disabled={resendCooldown > 0 || loading}
                      className="text-xs font-bold text-[#1E3A2B] hover:underline disabled:opacity-50"
                    >
                      {resendCooldown > 0
                        ? `${isHi ? 'पुनः भेजें' : 'Resend in'} ${resendCooldown}s`
                        : (isHi ? 'कोड दोबारा भेजें' : 'Resend Code')}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={googleOtpCode}
                    onChange={(e) => setGoogleOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-black text-lg text-center tracking-widest text-[#1C2B23] outline-none"
                    required
                  />
                  <p className="text-[11px] text-[#5A6860] mt-1 font-medium">
                    {isHi
                      ? `सत्यापन कोड आपके Google ईमेल (${googleProfile.email}) पर भेजा गया है।`
                      : `A 6-digit verification code was sent to your Google email (${googleProfile.email}).`}
                  </p>
                </div>

                {/* Optional Mobile Number */}
                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {isHi ? 'मोबाइल नंबर (वैकल्पिक)' : 'Mobile Number (Optional Contact)'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      value={googlePhone}
                      onChange={(e) => {
                        setGooglePhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                        setErrorMsg(null);
                      }}
                      placeholder="9876543210"
                      className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-base text-[#1C2B23] outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Create Password Input */}
                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {isHi ? 'पासवर्ड बनाएं (वैकल्पिक - भविष्य में सीधे लॉगिन हेतु)' : 'Create Password (Optional - for direct login later)'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={googlePassword}
                      onChange={(e) => setGooglePassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-[#5A6860] mt-1 font-medium">
                    {isHi ? 'कम से कम 6 अक्षर। इससे आप बिना Google के भी पासवर्ड से लॉगिन कर सकेंगे।' : 'Minimum 6 characters. Allows direct password login anytime.'}
                  </p>
                </div>

                {/* Role-Specific fields */}
                {selectedRole === 'farmer' ? (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                        {isHi ? 'गांव / ज़िला' : 'Village / District'}
                      </label>
                      <input
                        type="text"
                        value={villageDistrict}
                        onChange={(e) => setVillageDistrict(e.target.value)}
                        placeholder={isHi ? 'उदा. खंदौली, आगरा (उ.प्र.)' : 'e.g. Khandauli, Agra, UP'}
                        className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                        {isHi ? 'संस्था / व्यापार का नाम' : 'Business / Organization Name'}
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder={isHi ? 'उदा. ब्रज किसान प्रोड्यूसर कं. लि.' : 'e.g. Braj Farmers Producer Co.'}
                        className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                        {isHi ? 'शहर / मंडी केंद्र' : 'City / Mandi Location'}
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Agra, UP"
                        className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading || googleOtpCode.trim().length !== 6}
                  className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
                >
                  <span>{loading ? (isHi ? 'सत्यापित हो रहा है...' : 'Verifying...') : (isHi ? 'ईमेल सत्यापित करें और रजिस्टर करें' : 'Verify Email & Complete Registration')}</span>
                  <ArrowRight className="w-5 h-5 text-emerald-400" />
                </button>
              </form>
            ) : null}

            {/* Farmer Form (Name, Mobile, Village/District, Crops, Password) */}
            {!googleProfile && !googleExistingUser && selectedRole === 'farmer' && !farmerOtpSent && (
              <form onSubmit={handleFarmerSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {isHi ? 'किसान का पूरा नाम' : 'Farmer Full Name'}
                  </label>
                  <input
                    type="text"
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    placeholder={isHi ? 'उदा. रामेश कुमार' : 'e.g. Ramesh Kumar'}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {isHi ? 'मोबाइल नंबर (10 अंक)' : 'Mobile Number (10 digits)'}
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={farmerPhone}
                    onChange={(e) => setFarmerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-base text-[#1C2B23] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {isHi ? 'पासवर्ड बनाएं (वैकल्पिक / भविष्य में सीधे पासवर्ड लॉगिन हेतु)' : 'Create Password (Optional / for direct login later)'}
                  </label>
                  <input
                    type="password"
                    value={farmerPassword}
                    onChange={(e) => setFarmerPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                  />
                  <p className="text-[11px] text-[#5A6860] mt-1 font-medium">
                    {isHi ? 'यदि सेट करते हैं, तो अगली बार बिना ओटीपी के भी सीधे पासवर्ड से लॉगिन कर सकेंगे।' : 'If set, you can log in directly using this password in the future.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {isHi ? 'गांव / ज़िला' : 'Village / District'}
                  </label>
                  <input
                    type="text"
                    value={villageDistrict}
                    onChange={(e) => setVillageDistrict(e.target.value)}
                    placeholder={isHi ? 'उदा. खंदौली, आगरा (उ.प्र.)' : 'e.g. Khandauli, Agra, UP'}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-2 uppercase tracking-wider">
                    {isHi ? 'मुख्य फसलें (एक या अधिक चुनें)' : 'Main Crops (select one or more)'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableCrops.map(crop => (
                      <button
                        key={crop.id}
                        type="button"
                        onClick={() => toggleCrop(crop.id)}
                        className={`min-h-[44px] py-2 px-3 rounded-xl border-2 text-xs sm:text-sm font-black transition-all flex items-center justify-between cursor-pointer ${
                          mainCrops.includes(crop.id)
                            ? 'bg-[#EEF5F2] border-[#1E3A2B] text-[#1E3A2B]'
                            : 'bg-white border-[#D8D2C4] text-[#2B3B32] hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <span>{crop.name}</span>
                        {mainCrops.includes(crop.id) && <CheckCircle2 className="w-4 h-4 text-[#1E3A2B]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
                >
                  <span>{loading ? (isHi ? 'ओटीपी भेजा जा रहा है...' : 'Sending OTP...') : (isHi ? 'ओटीपी प्राप्त करें व आगे बढ़ें' : 'Get OTP & Continue')}</span>
                  <ArrowRight className="w-5 h-5 text-emerald-400" />
                </button>
              </form>
            )}

            {/* Farmer OTP Verification */}
            {!googleProfile && !googleExistingUser && selectedRole === 'farmer' && farmerOtpSent && (
              <form onSubmit={handleFarmerOtpVerify} className="space-y-4">


                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] uppercase tracking-wider">
                      {isHi ? 'मोबाइल पर आया 6-अंकों का ओटीपी' : 'Enter 6-Digit Mobile OTP'}
                    </label>
                    <button
                      type="button"
                      onClick={handleResendFarmerOtp}
                      disabled={farmerCooldown > 0 || loading}
                      className="text-xs font-bold text-emerald-800 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {farmerCooldown > 0
                        ? `${isHi ? 'पुनः भेजें' : 'Resend in'} ${farmerCooldown}s`
                        : (isHi ? 'ओटीपी पुनः भेजें' : 'Resend OTP')}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={farmerOtpCode}
                    onChange={(e) => setFarmerOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-black text-lg text-center tracking-widest text-[#1C2B23] outline-none"
                    required
                  />
                  <p className="text-[11px] text-[#5A6860] mt-1 font-medium">
                    {isHi
                      ? `6-अंकीय ओटीपी आपके मोबाइल (${farmerPhone}) पर भेजा गया है।`
                      : `A 6-digit OTP was sent to your mobile (${farmerPhone}).`}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || farmerOtpCode.length !== 6}
                  className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? (isHi ? 'जांच जारी...' : 'Verifying...') : (isHi ? 'खाता सक्रिय करें' : 'Activate Account')}</span>
                  <ArrowRight className="w-5 h-5 text-emerald-400" />
                </button>
              </form>
            )}

            {/* Aggregator / Dealer Form */}
            {!googleProfile && !googleExistingUser && (selectedRole === 'aggregator' || selectedRole === 'dealer') && (
              <form onSubmit={handleBusinessSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {selectedRole === 'aggregator' 
                      ? (isHi ? 'बिजनेस या एफपीओ का नाम' : 'Business or FPO Name') 
                      : (isHi ? 'कंपनी या फर्म का नाम' : 'Company or Business Name')
                    }
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={selectedRole === 'aggregator' ? 'e.g. Yamuna Valley Farmers Collective' : 'e.g. North India Agro Food Traders'}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                    {isHi ? 'संपर्क व्यक्ति का नाम' : 'Contact Person'}
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder={isHi ? 'उदा. सुनील वर्मा' : 'e.g. Sunil Verma'}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                      {isHi ? 'मोबाइल नंबर (10 अंक)' : 'Mobile Number'}
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={businessMobile}
                      onChange={(e) => setBusinessMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9811122334"
                      className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-base text-[#1C2B23] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                      {isHi ? 'ईमेल पता' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      placeholder="contact@business.in"
                      className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                      {isHi ? 'शहर / ज़िला' : 'City / District'}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Agra / Delhi"
                      className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                      {isHi ? 'पासवर्ड (कम से कम 6 अंक)' : 'Password (min 6 chars)'}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-medium">
                  <strong>* {isHi ? 'सूचना:' : 'Note:'}</strong> {isHi ? 'पंजीकरण के बाद खाता "लंबित (Pending)" रहेगा जब तक एडमिन द्वारा अनुमोदन नहीं दिया जाता।' : 'Account status will be "Pending" upon signup until reviewed by an administrator.'}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? (isHi ? 'पंजीकरण जारी...' : 'Submitting...') : (isHi ? 'पंजीकरण पूरा करें' : 'Complete Registration')}</span>
                  <ArrowRight className="w-5 h-5 text-emerald-400" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer Link: Go to Login */}
        <div className="mt-6 pt-5 border-t border-[#EAE5D8] text-center">
          <p className="text-sm font-semibold text-[#2B3B32]">
            {isHi ? 'पहले से खाता है?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="text-slate-900 hover:underline font-extrabold cursor-pointer ml-1"
            >
              {isHi ? 'लॉगिन करें →' : 'Log In →'}
            </button>
          </p>
        </div>

      </div>

    </div>
  );
};
