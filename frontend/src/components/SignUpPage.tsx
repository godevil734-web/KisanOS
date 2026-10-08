import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { GoogleAuthButton } from './GoogleAuthButton';
import { 
  Sprout, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Boxes, 
  Lock, 
  Mail, 
  Phone, 
  Eye, 
  EyeOff, 
  Check, 
  Loader2, 
  RefreshCw, 
  ShieldCheck, 
  ChevronRight,
  MapPin,
  Briefcase,
  Layers,
  Sparkles
} from 'lucide-react';

interface SignUpPageProps {
  onSuccess: (target: string) => void;
  onNavigate: (path: string) => void;
}

export type SignUpRole = 'farmer' | 'aggregator' | 'dealer';

interface RoleCardMeta {
  role: SignUpRole;
  badge: string;
  badgeHi: string;
  icon: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  benefits: string[];
  benefitsHi: string[];
  accentBorder: string;
  accentBg: string;
  accentText: string;
}

const ROLES: RoleCardMeta[] = [
  {
    role: 'farmer',
    badge: 'PRODUCER',
    badgeHi: 'उत्पादक',
    icon: '🌾',
    title: 'Farmer',
    titleHi: 'किसान',
    description: 'Sell your harvest at better farm-gate prices directly to verified buyers.',
    descriptionHi: 'अपनी फसल को सीधे सत्यापित खरीदारों को बेहतर भाव पर बेचें।',
    benefits: [
      'Direct farm-gate price discovery',
      'Village-level harvest aggregation for small lots',
      'Fast, guaranteed digital payments'
    ],
    benefitsHi: [
      'मंडी बिचौलियों के बिना उचित दाम',
      'छोटे लॉट के लिए गाँव स्तर पर पूलिंग',
      'सुरक्षित और समय पर सीधा भुगतान'
    ],
    accentBorder: 'border-emerald-500',
    accentBg: 'bg-emerald-500/10',
    accentText: 'text-emerald-400'
  },
  {
    role: 'aggregator',
    badge: 'SUPPLY CHAIN',
    badgeHi: 'सप्लाई चेन',
    icon: '📦',
    title: 'Aggregator',
    titleHi: 'एग्रीगेटर',
    description: 'Pool farmer produce, manage local collection, and supply larger buyers.',
    descriptionHi: 'गाँव में किसानों की उपज एकत्र करें और थोक खरीदारों को आपूर्ति करें।',
    benefits: [
      'Aggregate small-holder crops into bulk lots',
      'Coordinate cold storage and village logistics',
      'Earn reliable commission and supply contracts'
    ],
    benefitsHi: [
      'छोटे किसानों की फसल को बड़े लॉट में जोड़ें',
      'कोल्ड स्टोरेज और परिवहन का समन्वय',
      'पारदर्शी कमीशन और स्थिर अनुबंध'
    ],
    accentBorder: 'border-amber-500',
    accentBg: 'bg-amber-500/10',
    accentText: 'text-amber-400'
  },
  {
    role: 'dealer',
    badge: 'PROCUREMENT',
    badgeHi: 'थोक खरीद',
    icon: '🏢',
    title: 'Buyer',
    titleHi: 'खरीदार',
    description: 'Source quality agricultural produce directly from verified farmers & aggregators.',
    descriptionHi: 'किसानों और एग्रीगेटर्स के नेटवर्क से सीधे गुणवत्तापूर्ण उपज खरीदें।',
    benefits: [
      'Direct procurement at scale with verified quality',
      'Create custom crop procurement requirements',
      'Transparent contracts and traceable farm supply'
    ],
    benefitsHi: [
      'सत्यापित गुणवत्ता के साथ थोक खरीद',
      'अपनी खरीद मांग (Requirements) सीधे पोस्ट करें',
      'पारदर्शी अनुबंध और ट्रेस करने योग्य आपूर्ति'
    ],
    accentBorder: 'border-cyan-500',
    accentBg: 'bg-cyan-500/10',
    accentText: 'text-cyan-400'
  }
];

export const SignUpPage: React.FC<SignUpPageProps> = ({ onSuccess, onNavigate }) => {
  const { initSignup, resendSignupOtp, verifySignup, googleInit, googleVerifyOtp, googleRegister, googleResendOtp } = useAuth();
  const { language } = useLanguage();
  const isHi = language === 'hi';

  // Read URL query parameter for pre-selected role (?role=farmer|aggregator|buyer|dealer)
  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialRoleParam = queryParams?.get('role') || queryParams?.get('tab');
  const initialRole: SignUpRole = initialRoleParam === 'aggregator'
    ? 'aggregator'
    : (initialRoleParam === 'buyer' || initialRoleParam === 'dealer')
      ? 'dealer'
      : 'farmer';

  // Wizard Steps: 1 = Choose Role, 2 = Registration Details, 3 = Verify Email OTP
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<SignUpRole>(initialRole);

  // Common Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');

  // Role-Specific Fields - Farmer
  const [village, setVillage] = useState('');
  const [mainCrops, setMainCrops] = useState<string[]>(['Potato']);
  const [showFarmProfileDetails, setShowFarmProfileDetails] = useState(false);

  // Role-Specific Fields - Aggregator
  const [businessName, setBusinessName] = useState('');
  const [operatingArea, setOperatingArea] = useState('');
  const [capacity, setCapacity] = useState('');
  const [fpoName, setFpoName] = useState('');

  // Role-Specific Fields - Buyer
  const [companyName, setCompanyName] = useState('');
  const [buyerType, setBuyerType] = useState('Wholesale Buyer');
  const [procurementQuantity, setProcurementQuantity] = useState('');

  // Step 3 OTP Verification States
  const [signupToken, setSignupToken] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Google 2FA Modal / Inline State
  const [googleExistingModal, setGoogleExistingModal] = useState<{
    tempToken: string;
    email: string;
    maskedEmail: string;
    role: string;
  } | null>(null);

  // Status & Loading States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Target destination mapping
  const getRoleDestination = (role: string) => {
    if (role === 'farmer') return '/list-crop';
    if (role === 'aggregator') return '/aggregator';
    if (role === 'dealer' || role === 'buyer') return '/dealer';
    return '/dashboard';
  };

  // Crops list for farmers
  const availableCrops = [
    { id: 'Potato', en: 'Potato', hi: 'आलू' },
    { id: 'Wheat', en: 'Wheat', hi: 'गेहूं' },
    { id: 'Rice', en: 'Rice / Paddy', hi: 'धान / चावल' },
    { id: 'Mustard', en: 'Mustard', hi: 'सरसों' },
    { id: 'Tomato', en: 'Tomato', hi: 'टमाटर' },
    { id: 'Onion', en: 'Onion', hi: 'प्याज़' },
    { id: 'Other', en: 'Other Crops', hi: 'अन्य' }
  ];

  // Buyer types list
  const buyerTypes = [
    { value: 'Food Processor', en: 'Food Processor', hi: 'फूड प्रोसेसर / खाद्य प्रसंस्करण' },
    { value: 'FMCG / Retail', en: 'FMCG / Retail Chain', hi: 'एफएमसीजी / रिटेल चेन' },
    { value: 'Wholesale Buyer', en: 'Wholesale Buyer (Mandi)', hi: 'थोक खरीदार' },
    { value: 'Institutional Buyer', en: 'Institutional Buyer / Canteen', hi: 'संस्थागत खरीदार' },
    { value: 'Exporter', en: 'Exporter', hi: 'निर्यातक' },
    { value: 'Other', en: 'Other', hi: 'अन्य' }
  ];

  // Password Validation Checklist Rules
  const passwordRules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    match: password.length > 0 && password === confirmPassword
  };

  const isPasswordValid = 
    passwordRules.length &&
    passwordRules.upper &&
    passwordRules.lower &&
    passwordRules.number &&
    passwordRules.special;

  // Resend Cooldown Timer Effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-focus first OTP box when entering Step 3
  useEffect(() => {
    if (step === 3) {
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Masking helper fallback
  const getMaskedDisplay = (rawEmail: string) => {
    if (maskedEmail) return maskedEmail;
    if (!rawEmail || !rawEmail.includes('@')) return rawEmail;
    const [name, domain] = rawEmail.split('@');
    if (name.length <= 2) return `${name.charAt(0)}*@${domain}`;
    return `${name.charAt(0)}${'*'.repeat(Math.max(name.length - 2, 3))}${name.slice(-1)}@${domain}`;
  };

  // Handle OTP digit box input & auto-advance
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = clean;
    setOtpDigits(updated);
    setErrorMsg(null);

    // Auto-advance
    if (clean && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits filled
    const fullCode = updated.join('');
    if (fullCode.length === 6 && !updated.includes('')) {
      handleVerifyOtpDirect(fullCode);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || '';
    }
    setOtpDigits(updated);
    setErrorMsg(null);

    const nextFocus = Math.min(pasted.length, 5);
    otpInputRefs.current[nextFocus]?.focus();

    if (pasted.length === 6) {
      handleVerifyOtpDirect(pasted);
    }
  };

  // Toggle crops chip
  const toggleCrop = (cropName: string) => {
    if (mainCrops.includes(cropName)) {
      if (mainCrops.length > 1) {
        setMainCrops(mainCrops.filter(c => c !== cropName));
      }
    } else {
      setMainCrops([...mainCrops, cropName]);
    }
  };

  // =========================================================================
  // STEP 2 SUBMIT -> DISPATCH REAL BREVO EMAIL OTP (No Demo / No Hardcoded)
  // =========================================================================
  const handleInitiateSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic Validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg(isHi ? 'कृपया अपना पूरा नाम दर्ज करें।' : 'Please enter your full name (minimum 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMsg(isHi ? 'कृपया एक मान्य ईमेल पता दर्ज करें।' : 'Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setErrorMsg(isHi ? 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg(isHi ? 'पासवर्ड सुरक्षा शर्तों को पूरा नहीं करता।' : 'Password does not meet the security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(isHi ? 'दोनों पासवर्ड मेल नहीं खाते।' : 'Passwords do not match.');
      return;
    }

    // Role-specific required fields
    if (selectedRole === 'aggregator' && !businessName.trim()) {
      setErrorMsg(isHi ? 'कृपया व्यापार या एग्रीगेटर का नाम दर्ज करें।' : 'Please enter your business or aggregator name.');
      return;
    }

    if (selectedRole === 'dealer' && !companyName.trim()) {
      setErrorMsg(isHi ? 'कृपया कंपनी / संगठन का नाम दर्ज करें।' : 'Please enter your company or organization name.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        role: selectedRole,
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        password,
        state: stateName.trim(),
        district: district.trim(),
        village: village.trim(),
        mainCrops: selectedRole === 'farmer' ? mainCrops : undefined,
        businessName: selectedRole === 'aggregator' ? businessName.trim() : undefined,
        operatingArea: selectedRole === 'aggregator' ? operatingArea.trim() : undefined,
        capacity: selectedRole === 'aggregator' ? (capacity.trim() || fpoName.trim()) : undefined,
        buyerType: selectedRole === 'dealer' ? buyerType : undefined,
        procurementQuantity: selectedRole === 'dealer' ? procurementQuantity.trim() : undefined
      };

      const res = await initSignup(payload);
      if (res.success && res.signupToken) {
        setSignupToken(res.signupToken);
        setMaskedEmail(res.maskedEmail || getMaskedDisplay(email.trim()));
        setResendCooldown(60);
        setStep(3);
        setSuccessMsg(isHi ? 'सत्यापन कोड आपके ईमेल पर भेज दिया गया है।' : 'Verification code sent to your email.');
      } else {
        setErrorMsg(res.error || (isHi ? 'पंजीकरण शुरू करने में त्रुटि।' : 'Failed to initiate registration.'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'पंजीकरण विफल रहा।' : 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // STEP 3 SUBMIT -> VERIFY REAL 6-DIGIT EMAIL OTP & ISSUE SESSION
  // =========================================================================
  const handleVerifyOtpDirect = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setErrorMsg(isHi ? 'कृपया सभी 6 अंकों का कोड दर्ज करें।' : 'Please enter all 6 digits of the verification code.');
      return;
    }

    if (!signupToken) {
      setErrorMsg(isHi ? 'सत्र समाप्त हो गया है। कृपया पुनः प्रयास करें।' : 'Registration session expired. Please start again.');
      setStep(2);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const createdUser = await verifySignup({ signupToken, code });
      setSuccessMsg(isHi ? 'सत्यापन सफल! आपका स्वागत है...' : 'Verification successful! Redirecting to your dashboard...');
      setTimeout(() => {
        onSuccess(getRoleDestination(createdUser?.role || selectedRole));
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'अमान्य अथवा समाप्त कोड। कृपया दोबारा प्रयास करें।' : 'Invalid or expired verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerifyOtpDirect();
  };

  // Resend OTP via Brevo
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !signupToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await resendSignupOtp(signupToken);
      if (res.success) {
        setResendCooldown(60);
        setSuccessMsg(isHi ? 'नया सत्यापन कोड आपके ईमेल पर भेजा गया है।' : 'New verification code sent to your email.');
      } else {
        setErrorMsg(res.error || (isHi ? 'कोड दोबारा भेजने में विफल।' : 'Unable to resend verification code.'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'कोड भेजने में त्रुटि।' : 'Failed to resend verification code.'));
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // GOOGLE AUTH INTEGRATION (ROLE ATTACHED)
  // =========================================================================
  const handleGoogleSuccess = async (googleData: { email: string; name: string; googleId: string; picture?: string; credential?: string }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await googleInit(googleData.credential ? { credential: googleData.credential } : { googleUser: googleData });
      
      if (res.status === 'OTP_REQUIRED') {
        // Existing user found -> Trigger inline 2FA login
        setGoogleExistingModal({
          tempToken: res.tempToken,
          email: res.email,
          maskedEmail: res.maskedEmail || res.email,
          role: res.role
        });
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(60);
      } else if (res.status === 'REGISTER_REQUIRED') {
        // New user from Google -> Pre-fill Step 2 with Google details and role
        setFullName(googleData.name || '');
        setEmail(googleData.email || '');
        if (selectedRole === 'aggregator') setBusinessName(googleData.name || '');
        if (selectedRole === 'dealer') setCompanyName(googleData.name || '');
        setStep(2);
        setSuccessMsg(isHi ? 'Google विवरण प्राप्त हुआ। कृपया आवश्यक जानकारी भरें।' : 'Google account linked. Complete your details below.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'Google प्रमाणीकरण विफल रहा।' : 'Google authentication failed.'));
    } finally {
      setLoading(false);
    }
  };

  // Verify Google OTP for existing user
  const handleVerifyGoogleExistingOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleExistingModal) return;
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMsg(isHi ? 'कृपया 6 अंकों का कोड दर्ज करें।' : 'Please enter all 6 digits of the code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await googleVerifyOtp(googleExistingModal.tempToken, fullCode);
      setSuccessMsg(isHi ? 'सत्यापन सफल!' : 'Identity verified successfully!');
      setTimeout(() => {
        onSuccess(getRoleDestination(user?.role || googleExistingModal.role || selectedRole));
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'अमान्य कोड।' : 'Invalid verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const currentRoleMeta = ROLES.find(r => r.role === selectedRole) || ROLES[0];

  return (
    <div className="min-h-[calc(100vh-72px)] w-full flex items-center justify-center p-3 sm:p-6 lg:p-10 text-stone-100 relative overflow-hidden bg-[#040E08]">
      
      {/* 🌾 Atmospheric Agriculture Background Layer */}
      <div 
        className="absolute inset-0 bg-center bg-cover bg-no-repeat pointer-events-none scale-105 opacity-25"
        style={{ backgroundImage: `url('/farm_landscape_preview.jpg')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#030B06] via-[#05140A]/95 to-[#040E08]/95 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] rounded-full bg-emerald-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none" />

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN CONTAINER                                                 */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full max-w-6xl min-h-[660px] rounded-3xl border border-emerald-900/50 bg-[#07130C]/90 backdrop-blur-2xl shadow-2xl shadow-black/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Agricultural Brand & Dynamic Role Value Proposition       */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 p-6 sm:p-9 lg:p-11 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-emerald-900/60 bg-gradient-to-br from-[#081810]/95 via-[#05120B]/90 to-[#030C07]/95 relative overflow-hidden">
          
          <div>
            {/* Brand Logo & Identity */}
            <div className="flex items-center gap-3.5 mb-7">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/70 border border-emerald-400/40">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-white font-mono flex items-center gap-1.5">
                  KISAN<span className="text-emerald-400">CONNECT</span>
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-emerald-300 uppercase font-mono">
                    {isHi ? 'कृषि डिजिटल आपूर्ति नेटवर्क' : 'AGRICULTURAL SUPPLY NETWORK'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contextual Value Proposition Card */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {step === 1 
                    ? (isHi ? 'पारदर्शी कृषि पारिस्थितिकी तंत्र' : 'Transparent Agricultural Ecosystem')
                    : `${currentRoleMeta.icon} ${isHi ? currentRoleMeta.titleHi : currentRoleMeta.title}`
                  }
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                {selectedRole === 'farmer' && (
                  isHi ? 'अपनी फसल सीधे बाजार में उचित मूल्य पर बेचें।' : 'Sell your harvest directly at fair farm-gate prices.'
                )}
                {selectedRole === 'aggregator' && (
                  isHi ? 'गाँव स्तर पर उपज एकत्रित करें और बड़े खरीदारों को आपूर्ति करें।' : 'Pool regional harvest and supply institutional buyers.'
                )}
                {selectedRole === 'dealer' && (
                  isHi ? 'सत्यापित खेतों से पारदर्शी थोक कृषि खरीद करें।' : 'Direct agricultural procurement at scale with verified quality.'
                )}
              </h2>

              <p className="text-stone-300 text-sm leading-relaxed">
                {isHi ? currentRoleMeta.descriptionHi : currentRoleMeta.description}
              </p>

              {/* Dynamic Feature Bullets */}
              <div className="pt-2 space-y-2.5">
                {(isHi ? currentRoleMeta.benefitsHi : currentRoleMeta.benefits).map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-200">
                    <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-900/80 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-700/60">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Trust & Security Banner */}
          <div className="mt-8 pt-6 border-t border-emerald-900/50">
            <div className="flex items-center gap-3 text-xs text-stone-400">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {isHi 
                  ? 'सुरक्षित प्रमाणीकरण • वास्तविक ईमेल ओटीपी • सरकारी मानकों के अनुरूप'
                  : 'Encrypted Security • Real Email Verification • Direct Settlements'
                }
              </span>
            </div>
          </div>

        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: Interactive Multi-Stage Registration Flow               */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 p-6 sm:p-9 lg:p-11 flex flex-col justify-between bg-[#06140C]/95">
          
          <div>
            {/* Top Navigation & Step Indicator */}
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-emerald-900/40">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400 font-mono">
                  {step === 1 && (isHi ? 'कदम 1/3 • भूमिका चयन' : 'Step 1 of 3 • Choose Role')}
                  {step === 2 && (isHi ? 'कदम 2/3 • खाता विवरण' : 'Step 2 of 3 • Account Details')}
                  {step === 3 && (isHi ? 'कदम 3/3 • ईमेल सत्यापन' : 'Step 3 of 3 • Verify Email')}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                  {step === 1 && (isHi ? 'किसानकनेक्ट का उपयोग कैसे करेंगे?' : 'Choose how you use KisanConnect')}
                  {step === 2 && (isHi ? 'पंजीकरण विवरण दर्ज करें' : 'Create your account')}
                  {step === 3 && (isHi ? 'अपना ईमेल सत्यापित करें' : 'Verify your email address')}
                </h1>
              </div>

              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setStep(prev => (prev === 3 ? 2 : 1));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 text-xs font-semibold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{step === 3 ? (isHi ? 'विवरण बदलें' : 'Back to Form') : (isHi ? 'भूमिका बदलें' : 'Change Role')}</span>
                </button>
              )}
            </div>

            {/* Global Alerts */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="flex-1">{successMsg}</span>
              </div>
            )}

            {/* =================================================================== */}
            {/* STEP 1: CHOOSE HOW YOU USE KISANCONNECT (3 CLEAR ROLE CARDS)       */}
            {/* =================================================================== */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <p className="text-xs sm:text-sm text-stone-300">
                  {isHi 
                    ? 'कृपया अपने कार्य के अनुसार उपयुक्त भूमिका का चयन करें:'
                    : 'Select the role that matches your agricultural operations:'
                  }
                </p>

                <div className="grid grid-cols-1 gap-3.5 pt-1">
                  {ROLES.map((roleItem) => {
                    const isSelected = selectedRole === roleItem.role;
                    return (
                      <div
                        key={roleItem.role}
                        onClick={() => setSelectedRole(roleItem.role)}
                        className={`group relative p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer text-left flex items-start gap-4 ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/40'
                            : 'bg-[#0B1E13]/60 border-emerald-900/50 hover:bg-[#0D2417] hover:border-emerald-700/60'
                        }`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedRole(roleItem.role);
                          }
                        }}
                      >
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105 ${
                          isSelected ? 'bg-emerald-500/20 border border-emerald-400/50' : 'bg-stone-900/60 border border-stone-800'
                        }`}>
                          {roleItem.icon}
                        </div>

                        {/* Text Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base sm:text-lg font-bold text-white">
                                {isHi ? roleItem.titleHi : roleItem.title}
                              </h3>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                                isSelected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-stone-800 text-stone-400'
                              }`}>
                                {isHi ? roleItem.badgeHi : roleItem.badge}
                              </span>
                            </div>

                            {/* Radio checkmark */}
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelected ? 'border-emerald-400 bg-emerald-500 text-black' : 'border-stone-700 bg-transparent'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>

                          <p className="text-xs sm:text-sm text-stone-300 mt-1 leading-snug">
                            {isHi ? roleItem.descriptionHi : roleItem.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Primary CTA to proceed to Step 2 */}
                <div className="pt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setStep(2);
                    }}
                    className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/80 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <span>
                      {isHi 
                        ? `${currentRoleMeta.titleHi} के रूप में आगे बढ़ें`
                        : `Continue as ${currentRoleMeta.title}`
                      }
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Or Google Sign-Up tied to this role */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-emerald-900/60" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase font-mono">
                      <span className="bg-[#06140C] px-3 text-stone-400 font-semibold">
                        {isHi ? 'या गूगल के माध्यम से' : 'or continue with google'}
                      </span>
                    </div>
                  </div>

                  <GoogleAuthButton
                    onSuccess={handleGoogleSuccess}
                    onError={(err) => setErrorMsg(err)}
                    buttonText={
                      isHi
                        ? `Google से ${currentRoleMeta.titleHi} के रूप में जुड़ें`
                        : `Continue with Google as ${currentRoleMeta.title}`
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* STEP 2: REGISTRATION DETAILS (DYNAMICALLY ADAPTED BY ROLE)          */}
            {/* =================================================================== */}
            {step === 2 && (
              <form onSubmit={handleInitiateSignup} className="space-y-4 animate-in fade-in duration-150">
                
                {/* Active Role Mini Header */}
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{currentRoleMeta.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white">
                        {isHi ? `पंजीकरण: ${currentRoleMeta.titleHi}` : `Registering as ${currentRoleMeta.title}`}
                      </div>
                      <div className="text-[11px] text-emerald-300">
                        {isHi ? currentRoleMeta.descriptionHi : currentRoleMeta.description}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer shrink-0"
                  >
                    {isHi ? 'बदलें' : 'Change'}
                  </button>
                </div>

                {/* --- 1. CORE CREDENTIALS (Full Name, Email, Mobile) --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Full Name */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-semibold text-stone-200">
                      {isHi ? 'पूरा नाम' : 'Full Name'} <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={isHi ? 'उदा. राजेश कुमार' : 'e.g. Rajesh Kumar'}
                      className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-stone-900/80 border border-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-stone-500 text-sm outline-none transition-all"
                    />
                  </div>

                  {/* Role Specific Business Name for Aggregator / Buyer */}
                  {selectedRole === 'aggregator' && (
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-200">
                        {isHi ? 'व्यापार / एग्रीगेटर नाम' : 'Business / Aggregator Name'} <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder={isHi ? 'उदा. ब्रज किसान एग्रीगेशन केंद्र' : 'e.g. Braj Agro Aggregation Hub'}
                        className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-stone-900/80 border border-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-stone-500 text-sm outline-none transition-all"
                      />
                    </div>
                  )}

                  {selectedRole === 'dealer' && (
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-200">
                        {isHi ? 'कंपनी / संगठन का नाम' : 'Company / Organization Name'} <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder={isHi ? 'उदा. एग्रो फूड्स प्राइवेट लिमिटेड' : 'e.g. AgroFoods Processing Pvt Ltd'}
                        className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-stone-900/80 border border-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-stone-500 text-sm outline-none transition-all"
                      />
                    </div>
                  )}

                  {/* Email Address */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-stone-200">
                      {isHi ? 'ईमेल पता' : selectedRole === 'dealer' ? 'Business Email' : 'Email Address'} <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full min-h-[46px] pl-9 pr-3.5 py-2 rounded-xl bg-stone-900/80 border border-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-stone-500 text-sm outline-none transition-all"
                      />
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-stone-200">
                      {isHi ? 'मोबाइल नंबर' : 'Mobile Number'} <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="9876543210"
                        className="w-full min-h-[46px] pl-9 pr-3.5 py-2 rounded-xl bg-stone-900/80 border border-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-stone-500 text-sm outline-none transition-all"
                      />
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3.5 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* --- 2. PASSWORD & CONFIRM PASSWORD WITH COMPACT CHECKLIST --- */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-200">
                        {isHi ? 'पासवर्ड' : 'Password'} <span className="text-emerald-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full min-h-[46px] pl-9 pr-10 py-2 rounded-xl bg-stone-900/80 border border-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-stone-500 text-sm outline-none transition-all"
                        />
                        <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5 pointer-events-none" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-stone-400 hover:text-white"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-200">
                        {isHi ? 'पासवर्ड की पुष्टि करें' : 'Confirm Password'} <span className="text-emerald-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full min-h-[46px] pl-9 pr-10 py-2 rounded-xl bg-stone-900/80 border border-stone-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-stone-500 text-sm outline-none transition-all"
                        />
                        <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3.5 pointer-events-none" />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-stone-400 hover:text-white"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Compact Dynamic Password Validation Checklist */}
                  <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800 text-[11px] grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-medium">
                    <div className={`flex items-center gap-1.5 ${passwordRules.length ? 'text-emerald-400' : 'text-stone-400'}`}>
                      <Check className={`w-3 h-3 ${passwordRules.length ? 'opacity-100' : 'opacity-40'}`} />
                      <span>{isHi ? '8+ अक्षर' : '8+ characters'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.upper ? 'text-emerald-400' : 'text-stone-400'}`}>
                      <Check className={`w-3 h-3 ${passwordRules.upper ? 'opacity-100' : 'opacity-40'}`} />
                      <span>{isHi ? 'बड़ा अक्षर (A-Z)' : 'Uppercase letter'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.lower ? 'text-emerald-400' : 'text-stone-400'}`}>
                      <Check className={`w-3 h-3 ${passwordRules.lower ? 'opacity-100' : 'opacity-40'}`} />
                      <span>{isHi ? 'छोटा अक्षर (a-z)' : 'Lowercase letter'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.number ? 'text-emerald-400' : 'text-stone-400'}`}>
                      <Check className={`w-3 h-3 ${passwordRules.number ? 'opacity-100' : 'opacity-40'}`} />
                      <span>{isHi ? 'कम से कम 1 संख्या' : 'One number'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.special ? 'text-emerald-400' : 'text-stone-400'}`}>
                      <Check className={`w-3 h-3 ${passwordRules.special ? 'opacity-100' : 'opacity-40'}`} />
                      <span>{isHi ? 'विशेष वर्ण (!@#)' : 'Special char'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordRules.match ? 'text-emerald-400' : 'text-stone-400'}`}>
                      <Check className={`w-3 h-3 ${passwordRules.match ? 'opacity-100' : 'opacity-40'}`} />
                      <span>{isHi ? 'पासवर्ड मेल खाता है' : 'Passwords match'}</span>
                    </div>
                  </div>
                </div>

                {/* --- 3. ROLE-SPECIFIC PROFILES --- */}
                
                {/* A. FARMER SPECIFIC DETAILS */}
                {selectedRole === 'farmer' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-t border-stone-800 pt-3">
                      <div>
                        <span className="text-xs font-bold text-stone-200">
                          {isHi ? 'खेत और फसल विवरण' : 'Farm Profile Details'}
                        </span>
                        <span className="text-[11px] text-stone-400 block">
                          {isHi ? '(वैकल्पिक — आप इसे बाद में भी पूरा कर सकते हैं)' : '(You can also complete this later)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFarmProfileDetails(!showFarmProfileDetails)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                      >
                        {showFarmProfileDetails ? (isHi ? 'छुपाएं' : 'Hide') : (isHi ? 'विवरण भरें +' : 'Fill Details +')}
                      </button>
                    </div>

                    {showFarmProfileDetails && (
                      <div className="space-y-3 p-3.5 rounded-2xl bg-stone-900/40 border border-stone-800 animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'राज्य' : 'State'}</label>
                            <input
                              type="text"
                              value={stateName}
                              onChange={(e) => setStateName(e.target.value)}
                              placeholder="Uttar Pradesh"
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'जिला' : 'District'}</label>
                            <input
                              type="text"
                              value={district}
                              onChange={(e) => setDistrict(e.target.value)}
                              placeholder="Agra"
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'गाँव / कस्बा' : 'Village / Town'}</label>
                            <input
                              type="text"
                              value={village}
                              onChange={(e) => setVillage(e.target.value)}
                              placeholder="Fatehabad"
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Selectable Crop Chips */}
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-300 mb-1.5">
                            {isHi ? 'मुख्य फसलें (चयन करें):' : 'Main Crops Produced (Select):'}
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {availableCrops.map(crop => {
                              const active = mainCrops.includes(crop.id);
                              return (
                                <button
                                  type="button"
                                  key={crop.id}
                                  onClick={() => toggleCrop(crop.id)}
                                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    active
                                      ? 'bg-emerald-500 text-black border border-emerald-400'
                                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'
                                  }`}
                                >
                                  {isHi ? crop.hi : crop.en}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* B. AGGREGATOR SPECIFIC DETAILS */}
                {selectedRole === 'aggregator' && (
                  <div className="space-y-3 pt-2 border-t border-stone-800">
                    <span className="text-xs font-bold text-stone-200 block">
                      {isHi ? 'एग्रीगेशन एवं परिचालन विवरण' : 'Aggregation & Operational Area'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'राज्य एवं जिला' : 'State & District'}</label>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="Agra, UP"
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'परिचालन क्षेत्र (Operating Area)' : 'Operating Area / Mandi Zone'}</label>
                        <input
                          type="text"
                          value={operatingArea}
                          onChange={(e) => setOperatingArea(e.target.value)}
                          placeholder="e.g. Fatehabad & Shamsabad Block"
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'उपज पूलिंग क्षमता' : 'Aggregation Capacity'}</label>
                        <input
                          type="text"
                          value={capacity}
                          onChange={(e) => setCapacity(e.target.value)}
                          placeholder="e.g. 50 MT / month"
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'FPO / संस्था का नाम (वैकल्पिक)' : 'FPO / Org Name (Optional)'}</label>
                        <input
                          type="text"
                          value={fpoName}
                          onChange={(e) => setFpoName(e.target.value)}
                          placeholder="e.g. Kisan Samriddhi FPO"
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* C. BUYER SPECIFIC DETAILS */}
                {selectedRole === 'dealer' && (
                  <div className="space-y-3 pt-2 border-t border-stone-800">
                    <span className="text-xs font-bold text-stone-200 block">
                      {isHi ? 'थोक खरीद एवं व्यापार प्रकार' : 'Procurement & Buyer Type'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'खरीदार का प्रकार' : 'Buyer Type'}</label>
                        <select
                          value={buyerType}
                          onChange={(e) => setBuyerType(e.target.value)}
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                        >
                          {buyerTypes.map(t => (
                            <option key={t.value} value={t.value}>
                              {isHi ? t.hi : t.en}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'राज्य एवं जिला' : 'State & District'}</label>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="Delhi / Agra"
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-stone-300 mb-1">{isHi ? 'सामान्य खरीद मात्रा (वैकल्पिक)' : 'Typical Procurement Quantity (Optional)'}</label>
                        <input
                          type="text"
                          value={procurementQuantity}
                          onChange={(e) => setProcurementQuantity(e.target.value)}
                          placeholder="e.g. 100+ MT per quarter"
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary CTA Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/80 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isHi ? 'सत्यापन कोड भेजा जा रहा है...' : 'Sending Verification Code...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isHi ? 'खाता बनाएं एवं कोड प्राप्त करें' : 'Create Account & Verify Email'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* =================================================================== */}
            {/* STEP 3: OTP VERIFICATION UI (6 INDIVIDUAL BOXES + BREVO DELIVERY)  */}
            {/* =================================================================== */}
            {step === 3 && (
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-6 animate-in fade-in duration-150">
                
                {/* Heading & Masked Email Display */}
                <div className="text-center space-y-1.5 pt-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 mb-2">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {isHi ? 'अपना ईमेल सत्यापित करें' : 'Verify your email'}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-300">
                    {isHi 
                      ? 'हमने 6-अंकों का सत्यापन कोड इस ईमेल पर भेजा है:'
                      : 'We sent a 6-digit verification code to'
                    }
                  </p>
                  <div className="inline-block px-3 py-1 rounded-full bg-stone-900 border border-stone-700 text-emerald-300 font-mono text-xs sm:text-sm font-semibold">
                    {maskedEmail || getMaskedDisplay(email)}
                  </div>
                </div>

                {/* 6 Individual Digit Boxes */}
                <div className="flex justify-center items-center gap-2 sm:gap-3 py-3" onPaste={handleDigitPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      className={`w-11 h-14 sm:w-13 sm:h-16 text-center text-xl sm:text-2xl font-black font-mono rounded-xl border-2 transition-all outline-none ${
                        digit
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-stone-700 bg-stone-900/80 text-white focus:border-emerald-400 focus:bg-stone-900'
                      }`}
                      autoComplete="one-time-code"
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Resend Cooldown Section */}
                <div className="text-center text-xs text-stone-400 space-y-1">
                  <div>
                    {isHi ? 'कोड प्राप्त नहीं हुआ?' : "Didn't receive the code?"}{' '}
                    {resendCooldown > 0 ? (
                      <span className="font-mono text-emerald-400 font-semibold">
                        {isHi ? `${resendCooldown} सेकंड में पुनः भेजें` : `Resend in ${resendCooldown}s`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-emerald-400 hover:text-emerald-300 underline font-bold cursor-pointer ml-1 disabled:opacity-50"
                      >
                        {isHi ? 'ओटीपी पुनः भेजें' : 'Resend OTP'}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {isHi ? 'कोड 5 मिनट के लिए मान्य है। स्पैम फ़ोल्डर भी जांचें।' : 'Code expires in 5 minutes. Please check your spam folder too.'}
                  </p>
                </div>

                {/* Primary CTA */}
                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading || otpDigits.join('').length !== 6}
                    className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/80 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isHi ? 'सत्यापित किया जा रहा है...' : 'Verifying Code...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isHi ? 'सत्यापित करें और खाता खोलें' : 'Verify & Create Account'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setStep(2);
                    }}
                    className="w-full py-2 text-center text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                  >
                    {isHi ? '← विवरण संशोधित करने के लिए वापस जाएं' : '← Change email or registration details'}
                  </button>
                </div>
              </form>
            )}

            {/* =================================================================== */}
            {/* GOOGLE EXISTING USER 2FA MODAL (IF APPLICABLE)                      */}
            {/* =================================================================== */}
            {googleExistingModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#07130C] border border-emerald-700/60 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 text-center shadow-2xl">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-700">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {isHi ? 'सुरक्षा सत्यापन (Google)' : 'Verify Identity'}
                    </h3>
                    <p className="text-xs text-stone-300 mt-1">
                      {isHi 
                        ? `कोड भेजा गया है: ${googleExistingModal.maskedEmail}` 
                        : `Enter the code sent to ${googleExistingModal.maskedEmail}`
                      }
                    </p>
                  </div>

                  <div className="flex justify-center gap-2" onPaste={handleDigitPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-black font-mono rounded-xl border border-stone-700 bg-stone-900 text-white focus:border-emerald-400 outline-none"
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setGoogleExistingModal(null)}
                      className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold"
                    >
                      {isHi ? 'रद्द करें' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyGoogleExistingOtp}
                      disabled={loading || otpDigits.join('').length !== 6}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {loading ? (isHi ? 'जांच जारी...' : 'Verifying...') : (isHi ? 'लॉगिन करें' : 'Verify & Continue')}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Login Navigation Switcher */}
          <div className="mt-8 pt-5 border-t border-emerald-900/40 text-center">
            <span className="text-xs text-stone-400">
              {isHi ? 'पहले से खाता मौजूद है?' : 'Already have a KisanConnect account?'}{' '}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer ml-1"
            >
              {isHi ? 'लॉग इन करें' : 'Log In here'}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
