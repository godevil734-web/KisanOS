import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { GoogleAuthButton } from './GoogleAuthButton';
import { 
  Sprout, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Phone, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Users, 
  TrendingUp, 
  Boxes, 
  Globe, 
  Shield, 
  X,
  Loader2,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface LoginPageProps {
  next?: string;
  onSuccess: (target: string) => void;
  onNavigate: (path: string) => void;
}

export type StakeholderRole = 'farmer' | 'aggregator' | 'dealer';
type AuthMethod = 'email' | 'phone';

const ROLE_CONFIG: Record<StakeholderRole, {
  titleEn: string;
  titleHi: string;
  icon: string;
  microcopyEn: string;
  microcopyHi: string;
  emailPlaceholder: string;
  targetUrl: string;
}> = {
  farmer: {
    titleEn: 'Farmer',
    titleHi: 'किसान',
    icon: '🌾',
    microcopyEn: 'Access your farm, offers and market opportunities.',
    microcopyHi: 'अपनी फसल, ऑफर और बाजार के अवसरों का प्रबंधन करें।',
    emailPlaceholder: 'farmer@example.com',
    targetUrl: '/list-crop',
  },
  dealer: {
    titleEn: 'Buyer',
    titleHi: 'खरीदार',
    icon: '🏢',
    microcopyEn: 'Manage procurement, suppliers and agricultural orders.',
    microcopyHi: 'थोक खरीद, आपूर्तिकर्ताओं और कृषि ऑर्डरों का प्रबंधन करें।',
    emailPlaceholder: 'buyer@example.com',
    targetUrl: '/dealer',
  },
  aggregator: {
    titleEn: 'Aggregator',
    titleHi: 'एग्रीगेटर',
    icon: '📦',
    microcopyEn: 'Pool farmer supply and coordinate agricultural logistics.',
    microcopyHi: 'गाँव स्तर पर फसल पूलिंग और कृषि लॉजिस्टिक्स का समन्वय करें।',
    emailPlaceholder: 'aggregator@example.com',
    targetUrl: '/aggregator',
  },
};

export const LoginPage: React.FC<LoginPageProps> = ({ next, onSuccess, onNavigate }) => {
  const { loginWithOtp, sendOtp, loginWithPassword, googleInit, googleVerifyOtp, googleRegister, googleResendOtp } = useAuth();
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'hi';

  // Read URL params for role pre-selection (?role=farmer|aggregator|dealer|buyer)
  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialRoleParam = queryParams?.get('role') || queryParams?.get('tab');
  const initialRole: StakeholderRole = initialRoleParam === 'aggregator'
    ? 'aggregator'
    : (initialRoleParam === 'dealer' || initialRoleParam === 'buyer')
      ? 'dealer'
      : 'farmer';

  const [selectedRole, setSelectedRole] = useState<StakeholderRole>(initialRole);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');

  // Primary Login Method: Email + Password
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Secondary Method: Phone / Email OTP
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [inlineOtpCode, setInlineOtpCode] = useState('');
  const [inlineOtpSent, setInlineOtpSent] = useState(false);
  const [inlineOtpCooldown, setInlineOtpCooldown] = useState(0);

  // Google 2FA Email OTP Modal State (Reference Screenshots 2 & 3)
  const [googleOtpModal, setGoogleOtpModal] = useState<{
    tempToken: string;
    email: string;
    maskedEmail: string;
    isNewUser?: boolean;
    googleProfile?: any;
  } | null>(null);

  // 6 Individual Digit Boxes for Modal OTP
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [googleOtpCooldown, setGoogleOtpCooldown] = useState(0);

  // Forgot password notification modal/dialog
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getTargetUrl = (role: string) => {
    if (next) return next;
    switch (role) {
      case 'aggregator': return '/aggregator';
      case 'dealer':
      case 'buyer': return '/dealer';
      case 'farmer':
      default: return '/list-crop';
    }
  };

  const handleRoleSelect = (role: StakeholderRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Cooldown effect for Google modal OTP resend
  useEffect(() => {
    if (googleOtpCooldown <= 0) return;
    const t = setTimeout(() => setGoogleOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [googleOtpCooldown]);

  // Cooldown effect for inline OTP resend
  useEffect(() => {
    if (inlineOtpCooldown <= 0) return;
    const t = setTimeout(() => setInlineOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [inlineOtpCooldown]);

  // Auto-focus first digit box when Google OTP modal opens
  useEffect(() => {
    if (googleOtpModal) {
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [googleOtpModal]);

  // Handle typing & automatic focus advance in the 6 individual OTP boxes
  const handleDigitChange = (index: number, val: string) => {
    const cleanDigit = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = cleanDigit;
    setOtpDigits(updated);
    setErrorMsg(null);

    if (cleanDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
        const updated = [...otpDigits];
        updated[index - 1] = '';
        setOtpDigits(updated);
      } else {
        const updated = [...otpDigits];
        updated[index] = '';
        setOtpDigits(updated);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || '';
    }
    setOtpDigits(updated);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  // ==========================================
  // 1. PRIMARY LOGIN: EMAIL + PASSWORD
  // ==========================================
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailIdentifier.trim();
    if (!cleanEmail) {
      setErrorMsg(isHi ? 'कृपया अपना ईमेल पता दर्ज करें।' : 'Please enter your email address.');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail) && !/^\d{10}$/.test(cleanEmail)) {
      setErrorMsg(isHi ? 'कृपया एक वैध ईमेल पता दर्ज करें।' : 'Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMsg(isHi ? 'कृपया अपना पासवर्ड दर्ज करें।' : 'Please enter your password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const loggedUser = await loginWithPassword(cleanEmail, password, selectedRole);
      onSuccess(getTargetUrl(loggedUser?.role || selectedRole));
    } catch (err: any) {
      setErrorMsg(
        err?.message || (isHi ? 'अमान्य क्रेडेंशियल्स।' : 'Invalid email or password. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 2. SECONDARY: INLINE PHONE / EMAIL OTP
  // ==========================================
  const handleSendInlineOtp = async () => {
    const identifier = phoneOrEmail.trim();
    if (!identifier) {
      setErrorMsg(isHi ? 'कृपया अपना ईमेल या मोबाइल नंबर दर्ज करें।' : 'Please enter your email or mobile number.');
      return;
    }

    const isEmail = identifier.includes('@');
    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        setErrorMsg(isHi ? 'कृपया एक वैध ईमेल पता दर्ज करें।' : 'Please enter a valid email address.');
        return;
      }
    } else {
      const cleanPhone = identifier.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        setErrorMsg(isHi ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
        return;
      }
    }

    if (inlineOtpCooldown > 0) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      await sendOtp(identifier);
      setInlineOtpSent(true);
      setInlineOtpCooldown(60);
      setSuccessMsg(
        isEmail
          ? (isHi ? `ओटीपी आपके ईमेल (${identifier}) पर भेज दिया गया है!` : `OTP sent to your email (${identifier}).`)
          : (isHi ? `ओटीपी आपके मोबाइल (${identifier}) पर भेज दिया गया है!` : `OTP sent to your mobile (${identifier}).`)
      );
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'ओटीपी भेजने में विफल।' : 'Unable to send OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleInlineOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = phoneOrEmail.trim();
    if (!identifier) {
      setErrorMsg(isHi ? 'कृपया अपना ईमेल या मोबाइल नंबर दर्ज करें।' : 'Please enter your email or mobile number.');
      return;
    }
    if (!inlineOtpCode || inlineOtpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया 6 अंकों का ओटीपी कोड दर्ज करें।' : 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithOtp(identifier, inlineOtpCode.trim(), selectedRole);
      onSuccess(getTargetUrl(loggedUser?.role || selectedRole));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'लॉगिन विफल रहा।' : 'Login failed. Invalid or expired OTP.'));
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. GOOGLE OAUTH → BREVO OTP FLOW
  // ==========================================
  const handleGoogleSuccess = async (googleData: { email: string; name: string; googleId: string; picture?: string; credential?: string }) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await googleInit(googleData.credential ? { credential: googleData.credential } : { googleUser: googleData });
      
      if (res.status === 'OTP_REQUIRED') {
        // Existing user found -> Trigger Brevo OTP modal
        setGoogleOtpModal({
          tempToken: res.tempToken,
          email: res.email,
          maskedEmail: res.maskedEmail || res.email,
          isNewUser: false
        });
        setGoogleOtpCooldown(60);
      } else if (res.status === 'REGISTER_REQUIRED') {
        // New user -> Trigger Brevo OTP modal for role registration
        setGoogleOtpModal({
          tempToken: res.tempToken,
          email: res.email,
          maskedEmail: res.maskedEmail || res.email,
          isNewUser: true,
          googleProfile: res.googleProfile || googleData
        });
        setGoogleOtpCooldown(60);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'Google लॉगिन विफल रहा' : 'Google authentication failed.'));
    } finally {
      setLoading(false);
    }
  };

  // Verify Google Modal 6-Digit OTP
  const handleVerifyGoogleModalOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOtpModal) return;

    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMsg(isHi ? 'कृपया सभी 6 अंकों का कोड दर्ज करें।' : 'Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (googleOtpModal.isNewUser) {
        // New user registration completion
        const regRes = await googleRegister({
          tempToken: googleOtpModal.tempToken,
          code: fullCode,
          role: selectedRole,
          googleProfile: googleOtpModal.googleProfile
        });
        setSuccessMsg(isHi ? 'खाता सफलतापूर्वक सत्यापित हुआ!' : 'Account verified successfully!');
        setGoogleOtpModal(null);
        setTimeout(() => onSuccess(getTargetUrl(selectedRole)), 800);
      } else {
        // Existing user login
        const loggedUser = await googleVerifyOtp(googleOtpModal.tempToken, fullCode);
        setSuccessMsg(isHi ? 'पहचान सत्यापित हुई!' : 'Identity verified successfully!');
        setGoogleOtpModal(null);
        setTimeout(() => onSuccess(getTargetUrl(loggedUser?.role || selectedRole)), 800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'अमान्य सत्यापन कोड। कृपया पुनः प्रयास करें।' : 'Invalid verification code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Resend Google Email OTP
  const handleResendGoogleModalOtp = async () => {
    if (!googleOtpModal?.email || googleOtpCooldown > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await googleResendOtp(googleOtpModal.email);
      setSuccessMsg(isHi ? 'नया सत्यापन कोड आपके ईमेल पर भेजा गया है।' : 'New verification code sent to your email.');
      setGoogleOtpCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'कोड दोबारा भेजने में विफल।' : 'Unable to resend code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full flex items-center justify-center p-3 sm:p-6 lg:p-10 text-white relative overflow-hidden bg-[#040E08]">
      
      {/* 🌾 Full-Page Scenic Agriculture Background Image */}
      <div 
        className="absolute inset-0 bg-center bg-cover bg-no-repeat pointer-events-none scale-105 opacity-35"
        style={{ backgroundImage: `url('/farm_landscape_preview.jpg')` }}
      />

      {/* Atmospheric Deep Emerald Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#030B06] via-[#05140A]/90 to-[#040E08]/95 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[380px] h-[380px] rounded-full bg-teal-500/10 blur-[110px] pointer-events-none" />

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN CONTAINER (Inspired by Reference Screenshots)            */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full max-w-6xl min-h-[640px] rounded-3xl border border-emerald-500/20 bg-[#07130C]/90 backdrop-blur-2xl shadow-2xl shadow-black/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: Agricultural Brand & Information Highlights (50% Desktop) */}
        {/* ======================================================================= */}
        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-emerald-900/60 relative overflow-hidden bg-gradient-to-br from-[#081810]/95 via-[#05120B]/90 to-[#030C07]/95">
          
          <div>
            {/* Top Brand Identity */}
            <div className="flex items-center gap-3.5 mb-6 sm:mb-8">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/70 border border-emerald-400/40">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-white font-mono flex items-center gap-1.5">
                  KISAN<span className="text-emerald-400">CONNECT</span>
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-emerald-300 uppercase font-mono">
                    SMART AGRICULTURAL SUPPLY NETWORK
                  </span>
                </div>
              </div>
            </div>

            {/* Main Headline */}
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-black leading-[1.15] tracking-tight text-white mb-4">
              Connecting Farmers.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                Powering Better Markets.
              </span>
            </h2>

            {/* Supporting Micro-copy */}
            <p className="text-sm sm:text-base text-emerald-100/70 leading-relaxed max-w-lg mb-8 font-medium">
              {isHi
                ? 'भारत का एकीकृत कृषि व्यापार मंच — पारदर्शी मंडी भाव, गाँव स्तर पर फसल एकत्रीकरण और प्रमाणित थोक खरीदारों से सीधा संपर्क।'
                : "India's unified agricultural trade network. Fair mandi pricing, batch aggregation, and direct wholesale procurement in real-time."}
            </p>

            {/* 3 Information Highlights / Stat Cards (Inspired by Reference Screenshot 1) */}
            <div className="space-y-3 mb-6">
              
              <div className="p-4 rounded-2xl bg-[#091B12]/80 border border-emerald-900/60 hover:border-emerald-500/50 transition-colors shadow-inner flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider mb-0.5">
                    {isHi ? 'सीधा बाजार संपर्क' : 'Fair Market Access'}
                  </h4>
                  <p className="text-xs text-emerald-200/60 leading-snug">
                    {isHi
                      ? 'प्रमाणित खाद्य प्रोसेसर और थोक खरीदारों से सीधा व्यापार। कोई बिचौलिया कटौती नहीं।'
                      : 'Connect directly with verified buyers & processors with zero hidden deductions.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#091B12]/80 border border-emerald-900/60 hover:border-emerald-500/50 transition-colors shadow-inner flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-cyan-400 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider mb-0.5">
                    {isHi ? 'भाव पारदर्शिता' : 'Price Transparency'}
                  </h4>
                  <p className="text-xs text-emerald-200/60 leading-snug">
                    {isHi
                      ? 'वास्तविक समय में एपीएमसी मंडी भाव और उचित एमएसपी बेंचमार्क इंटेलिजेंस।'
                      : 'Make confident selling decisions with real-time APMC mandi intelligence.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#091B12]/80 border border-emerald-900/60 hover:border-emerald-500/50 transition-colors shadow-inner flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-teal-400 shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider mb-0.5">
                    {isHi ? 'स्मार्ट आपूर्ति श्रृंखला' : 'Smart Supply Chain'}
                  </h4>
                  <p className="text-xs text-emerald-200/60 leading-snug">
                    {isHi
                      ? 'संकलन केंद्रों पर लॉट पूलिंग, कोल्ड स्टोरेज और शेड्यूल्ड परिवहन समन्वय।'
                      : 'Coordinate aggregation, quality verification, cold storage and optimized logistics.'}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Trust Badge */}
          <div className="pt-4 border-t border-emerald-950 flex items-center justify-between text-xs text-emerald-300/70 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isHi ? 'सुरक्षित प्रमाणीकरण • प्रमाणित कृषि उपयोगकर्ता' : 'Secure & encrypted connection • Verified agricultural users'}</span>
            </div>
            <span className="hidden sm:inline-block text-[11px] text-emerald-500/60 font-mono">KisanOS v2.4</span>
          </div>

        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: Authentication Panel (50% Desktop)                        */}
        {/* ======================================================================= */}
        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-[#08150E] relative">
          
          <div>
            {/* Top Row: Welcome Heading + Language Toggle */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {isHi ? 'वापसी पर स्वागत है' : 'Welcome back'}
                </h1>
                <p className="text-xs sm:text-sm text-emerald-200/60 mt-1 font-medium">
                  {isHi ? 'जारी रखने के लिए अपने किसानकनेक्ट पोर्टल में साइन इन करें।' : 'Sign in to your KisanConnect portal to continue.'}
                </p>
              </div>

              {/* Language Switcher (English | हिंदी) */}
              <div className="inline-flex items-center p-1 rounded-full bg-[#05110B] border border-emerald-900/70 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                      : 'text-emerald-400/60 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    language === 'hi'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                      : 'text-emerald-400/60 hover:text-white'
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>

            {/* 3 MANDATORY ACCOUNT ROLES: [ 🌾 Farmer ] [ 🏢 Buyer ] [ 📦 Aggregator ] */}
            <div className="mb-4">
              <label className="block text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 font-bold mb-2">
                {isHi ? 'अपनी भूमिका चुनें:' : 'SELECT YOUR ROLE:'}
              </label>

              <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#05110B] rounded-2xl border border-emerald-900/70 shadow-inner">
                
                {/* 1. Farmer */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('farmer')}
                  className={`min-h-[46px] py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedRole === 'farmer'
                      ? 'bg-[#0E2619] text-white border border-emerald-400 shadow-md shadow-emerald-950/60 font-black'
                      : 'text-emerald-400/60 hover:text-white hover:bg-emerald-950/30 border border-transparent'
                  }`}
                >
                  <span>🌾</span>
                  <span>{isHi ? 'किसान' : 'Farmer'}</span>
                </button>

                {/* 2. Buyer */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('dealer')}
                  className={`min-h-[46px] py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedRole === 'dealer'
                      ? 'bg-[#0E2619] text-white border border-emerald-400 shadow-md shadow-emerald-950/60 font-black'
                      : 'text-emerald-400/60 hover:text-white hover:bg-emerald-950/30 border border-transparent'
                  }`}
                >
                  <span>🏢</span>
                  <span>{isHi ? 'खरीदार' : 'Buyer'}</span>
                </button>

                {/* 3. Aggregator */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('aggregator')}
                  className={`min-h-[46px] py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedRole === 'aggregator'
                      ? 'bg-[#0E2619] text-white border border-emerald-400 shadow-md shadow-emerald-950/60 font-black'
                      : 'text-emerald-400/60 hover:text-white hover:bg-emerald-950/30 border border-transparent'
                  }`}
                >
                  <span>📦</span>
                  <span>{isHi ? 'एग्रीगेटर' : 'Aggregator'}</span>
                </button>

              </div>

              {/* DYNAMIC ROLE MICROCOPY (Section 4) */}
              <div className="mt-2.5 px-3 py-2 rounded-xl bg-[#0B1E13] border border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-200/90">
                <span className="text-emerald-400 font-bold">ℹ️</span>
                <span>
                  {isHi 
                    ? ROLE_CONFIG[selectedRole].microcopyHi 
                    : ROLE_CONFIG[selectedRole].microcopyEn
                  }
                </span>
              </div>
            </div>

            {/* GOOGLE SIGN-IN BUTTON (Section 10) */}
            <div className="mb-4">
              <GoogleAuthButton 
                onSuccess={handleGoogleSuccess} 
                onError={(err) => setErrorMsg(err)} 
                disabled={loading}
              />
            </div>

            {/* DIVIDER: OR CONTINUE WITH */}
            <div className="relative flex items-center justify-center mb-4">
              <div className="border-t border-emerald-900/60 w-full" />
              <span className="bg-[#08150E] px-3 text-[10px] font-mono tracking-widest text-emerald-400/60 uppercase whitespace-nowrap">
                {isHi ? 'या क्रेडेंशियल के साथ आगे बढ़ें' : 'OR CONTINUE WITH'}
              </span>
              <div className="border-t border-emerald-900/60 w-full" />
            </div>

            {/* METHOD TABS: [ Email & Password ] [ Phone / OTP ] (Inspired by Screenshot 1) */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#05110B] rounded-2xl border border-emerald-900/70 mb-4">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authMethod === 'email'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm font-black'
                    : 'text-emerald-400/60 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>{isHi ? 'ईमेल व पासवर्ड' : 'Email & Password'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authMethod === 'phone'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm font-black'
                    : 'text-emerald-400/60 hover:text-white'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span>{isHi ? 'फोन / ईमेल ओटीपी' : 'Phone / OTP'}</span>
              </button>
            </div>

            {/* Feedback Banners */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="flex-1">{errorMsg}</span>
                <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="flex-1">{successMsg}</span>
                <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* FORM 1: PRIMARY EMAIL + PASSWORD (Sections 5, 6, 7) */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailPasswordSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-1.5 font-bold">
                    {isHi ? 'ईमेल पता' : 'EMAIL ADDRESS'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={emailIdentifier}
                      onChange={(e) => setEmailIdentifier(e.target.value)}
                      placeholder={ROLE_CONFIG[selectedRole].emailPlaceholder}
                      required
                      autoComplete="username"
                      className="w-full min-h-[46px] pl-10 pr-4 py-2.5 bg-[#05110B] border border-emerald-900/70 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-800/60 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-1.5 font-bold">
                    {isHi ? 'पासवर्ड' : 'PASSWORD'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full min-h-[46px] pl-10 pr-11 py-2.5 bg-[#05110B] border border-emerald-900/70 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-800/60 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-emerald-400/60 hover:text-emerald-300 transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password Row (Sections 8 & 9) */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-emerald-300/70 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-emerald-800 bg-[#05110B] text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>{isHi ? 'मुझे याद रखें' : 'Remember me'}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer"
                  >
                    {isHi ? 'पासवर्ड भूल गए?' : 'Forgot password?'}
                  </button>
                </div>

                {/* Primary CTA Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/70 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isHi ? 'साइन इन हो रहा है...' : 'Signing in...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isHi ? `${ROLE_CONFIG[selectedRole].titleHi} के रूप में साइन इन करें →` : `Sign In as ${ROLE_CONFIG[selectedRole].titleEn} →`}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* FORM 2: SECONDARY PHONE / EMAIL OTP LOGIN */}
            {authMethod === 'phone' && (
              <form onSubmit={handleInlineOtpSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-1.5 font-bold">
                    {isHi ? 'ईमेल या 10-अंकीय मोबाइल नंबर' : 'REGISTERED EMAIL OR MOBILE'}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                        {phoneOrEmail.includes('@') ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </div>
                      <input
                        type="text"
                        value={phoneOrEmail}
                        onChange={(e) => setPhoneOrEmail(e.target.value)}
                        placeholder={isHi ? 'ईमेल या 10-अंकीय मोबाइल दर्ज करें' : 'user@example.com or mobile'}
                        required
                        className="w-full min-h-[46px] pl-10 pr-3 py-2.5 bg-[#05110B] border border-emerald-900/70 focus:border-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-800/60 outline-none transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendInlineOtp}
                      disabled={loading || inlineOtpCooldown > 0}
                      className="min-h-[46px] px-4 rounded-xl bg-emerald-900/70 hover:bg-emerald-800/80 text-emerald-200 hover:text-white font-bold text-xs uppercase tracking-wider border border-emerald-700/60 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {inlineOtpCooldown > 0
                        ? `${inlineOtpCooldown}s`
                        : inlineOtpSent
                          ? (isHi ? 'पुनः भेजें' : 'Resend')
                          : (isHi ? 'ओटीपी भेजें' : 'Send OTP')}
                    </button>
                  </div>
                </div>

                {inlineOtpSent && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
                    <span>
                      {isHi ? 'ओटीपी भेजा गया:' : 'OTP sent to:'}{' '}
                      <strong className="text-white">{phoneOrEmail}</strong>
                    </span>
                    {inlineOtpCooldown > 0 && (
                      <span className="font-mono text-emerald-400 text-[11px]">
                        {inlineOtpCooldown}s
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-1.5 font-bold">
                    {isHi ? '6-अंकीय ओटीपी कोड' : 'ENTER 6-DIGIT OTP'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={inlineOtpCode}
                    onChange={(e) => setInlineOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    required
                    className="w-full min-h-[46px] px-3.5 py-2.5 bg-[#05110B] border border-emerald-900/70 focus:border-emerald-500 rounded-xl text-base font-bold text-center tracking-widest text-white placeholder-emerald-800/60 outline-none transition-all font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || inlineOtpCode.length !== 6}
                  className="w-full min-h-[48px] mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/70 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isHi ? 'जांच जारी...' : 'Verifying...'}</span>
                    </>
                  ) : (
                    <span>{isHi ? `${ROLE_CONFIG[selectedRole].titleHi} में प्रवेश करें →` : `Verify OTP & Enter as ${ROLE_CONFIG[selectedRole].titleEn} →`}</span>
                  )}
                </button>
              </form>
            )}

          </div>

          {/* BOTTOM ACTIONS: Create Account + Official Access Link (Section 21) */}
          <div className="pt-6 mt-6 border-t border-emerald-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p className="text-emerald-200/70">
              {isHi ? 'क्या किसानकनेक्ट पर नए हैं?' : 'New to KisanConnect?'}{' '}
              <button
                type="button"
                onClick={() => onNavigate('/signup')}
                className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
              >
                {isHi ? 'खाता बनाएं' : 'Create account'}
              </button>
            </p>

            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="text-emerald-500/70 hover:text-emerald-300 font-mono text-[11px] uppercase tracking-wider cursor-pointer"
            >
              {isHi ? 'आधिकारिक पहुंच (Admin)' : 'OFFICIAL ACCESS'}
            </button>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* GOOGLE → BREVO 6-DIGIT EMAIL OTP MODAL (Reference Screenshot 3 Style)    */}
      {/* ========================================================================= */}
      {googleOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0A1812] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-emerald-800/80 relative text-white animate-in zoom-in-95 duration-150">
            
            {/* Close / Cancel Button */}
            <button
              type="button"
              onClick={() => setGoogleOtpModal(null)}
              className="absolute top-5 right-5 text-emerald-400/60 hover:text-white p-1 rounded-xl hover:bg-emerald-950/60 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header: Shield Icon + Title */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-900/80 to-teal-800/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {isHi ? 'अपना ईमेल पता सत्यापित करें' : 'Verify Your Email Address'}
                </h3>
                <p className="text-xs text-emerald-300/70 font-medium">
                  {isHi ? 'किसानकनेक्ट स्मार्ट सुरक्षा जांच' : 'KisanConnect Smart Security Check'}
                </p>
              </div>
            </div>

            {/* Target Email Notification Card (Screenshot 3 style) */}
            <div className="p-3.5 rounded-2xl bg-[#06140E] border border-emerald-900/80 mb-5">
              <p className="text-xs text-emerald-200/70 mb-1">
                {isHi ? 'हमने 6-अंकीय सत्यापन कोड भेजा है:' : 'We sent a 6-digit verification code to'}
              </p>
              <p className="text-sm font-mono font-bold text-teal-300 flex items-center gap-2 break-all">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{googleOtpModal.email}</span>
              </p>
            </div>

            {/* Inline Modal Errors */}
            {errorMsg && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {/* Form with 6 Separate Individual Digit Boxes (Screenshot 3 style) */}
            <form onSubmit={handleVerifyGoogleModalOtp}>
              <div className="mb-5">
                <label className="block text-center text-xs font-mono uppercase tracking-widest text-emerald-300/80 font-bold mb-3">
                  {isHi ? '6-अंकीय ओटीपी कोड दर्ज करें' : 'ENTER 6-DIGIT OTP CODE'}
                </label>

                {/* 6 Individual Input Boxes */}
                <div className="flex items-center justify-between gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
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
                      className={`w-11 h-14 sm:w-13 sm:h-16 rounded-xl border text-center font-mono text-xl sm:text-2xl font-black transition-all outline-none bg-[#05110B] text-white ${
                        digit
                          ? 'border-emerald-400 ring-2 ring-emerald-500/30'
                          : 'border-emerald-900/70 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
                      }`}
                      required
                    />
                  ))}
                </div>
              </div>

              {/* Resend OTP Row */}
              <div className="flex items-center justify-between text-xs mb-6 text-emerald-300/70">
                <span>{isHi ? 'कोड प्राप्त नहीं हुआ?' : "Didn't receive the code?"}</span>
                {googleOtpCooldown > 0 ? (
                  <span className="font-mono text-emerald-400/70">
                    {isHi ? `${googleOtpCooldown}s में पुनः भेजें` : `Resend in ${googleOtpCooldown}s`}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendGoogleModalOtp}
                    disabled={loading}
                    className="text-emerald-400 hover:text-white underline font-bold cursor-pointer transition-colors"
                  >
                    {isHi ? 'ओटीपी पुनः भेजें' : 'Resend OTP'}
                  </button>
                )}
              </div>

              {/* Action Buttons: Cancel and Verify */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGoogleOtpModal(null)}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#0D2117] hover:bg-[#122A1E] text-emerald-300 font-bold text-xs uppercase tracking-wider border border-emerald-900/70 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/70 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isHi ? 'जांच जारी...' : 'Verifying...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isHi ? 'सत्यापित करें व जारी रखें' : 'Verify & Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-5 pt-3.5 border-t border-emerald-950 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/60">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isHi ? 'Brevo द्वारा वास्तविक 6-अंकीय सुरक्षित ईमेल डिलीवरी' : 'Real 6-Digit Email Delivery via Brevo'}</span>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD ASSISTANCE MODAL (Section 9)                              */}
      {/* ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0A1812] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-emerald-800/80 relative text-white animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 text-emerald-400/60 hover:text-white p-1 rounded-xl hover:bg-emerald-950/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {isHi ? 'पासवर्ड सहायता' : 'Password Assistance'}
                </h3>
                <p className="text-xs text-emerald-300/70">
                  {isHi ? 'किसानकनेक्ट सुरक्षित लॉगिन' : 'KisanConnect Secure Recovery'}
                </p>
              </div>
            </div>

            <p className="text-xs text-emerald-200/80 leading-relaxed mb-4">
              {isHi
                ? 'यदि आप अपना पासवर्ड भूल गए हैं, तो आप पासवर्ड के बिना सीधे अपने पंजीकृत मोबाइल या ईमेल पर ओटीपी प्राप्त करके लॉगिन कर सकते हैं।'
                : 'If you forgot your password, you can sign in instantly without a password using the Phone / Email OTP tab or Google verification.'}
            </p>

            <div className="p-3 rounded-2xl bg-[#06140E] border border-emerald-900/80 text-xs text-emerald-300 mb-5">
              💡 {isHi ? 'त्वरित सलाह: "फोन / ईमेल ओटीपी" टैब चुनें और अपना नंबर/ईमेल दर्ज करें।' : 'Quick tip: Switch to the "Phone / OTP" tab to enter using a secure 6-digit verification code.'}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setAuthMethod('phone');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider"
              >
                {isHi ? 'ओटीपी लॉगिन पर जाएं' : 'Switch to OTP Login'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
