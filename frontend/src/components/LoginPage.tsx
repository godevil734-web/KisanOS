import React, { useState, useEffect } from 'react';
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
  KeyRound,
  Shield,
  Building2
} from 'lucide-react';

interface LoginPageProps {
  next?: string;
  onSuccess: (target: string) => void;
  onNavigate: (path: string) => void;
}

export type StakeholderRole = 'farmer' | 'aggregator' | 'dealer';
type AuthTab = 'email' | 'phone';

const ROLE_DETAILS: Record<StakeholderRole, {
  titleEn: string;
  titleHi: string;
  icon: string;
  badgeEn: string;
  badgeHi: string;
  descEn: string;
  descHi: string;
  emailPlaceholder: string;
  emailLabelEn: string;
  emailLabelHi: string;
  submitEn: string;
  submitHi: string;
  defaultTab: AuthTab;
}> = {
  farmer: {
    titleEn: 'Farmer Portal',
    titleHi: 'किसान पोर्टल',
    icon: '🌾',
    badgeEn: 'Direct Mandi Discovery',
    badgeHi: 'सीधी मंडी खोज',
    descEn: 'Instant OTP login for crop listings, MSP updates & net mandi payments.',
    descHi: 'फसल लिस्टिंग, मंडी भाव और त्वरित भुगतान के लिए ओटीपी लॉगिन।',
    emailPlaceholder: '9876543210 or farmer@example.com',
    emailLabelEn: 'Mobile Number or Email',
    emailLabelHi: 'मोबाइल नंबर या ईमेल',
    submitEn: 'Sign In as Farmer →',
    submitHi: 'किसान पोर्टल में प्रवेश करें →',
    defaultTab: 'phone',
  },
  aggregator: {
    titleEn: 'Aggregator Hub',
    titleHi: 'आढ़ती / संकलन केंद्र',
    icon: '📦',
    badgeEn: 'Batch Pooling & Logistics',
    badgeHi: 'लॉट पूलिंग और लॉजिस्टिक्स',
    descEn: 'Consolidate farm harvests, book cold storage & dispatch scheduled transit.',
    descHi: 'गाँव स्तर पर फसल एकत्रीकरण, कोल्ड स्टोरेज व परिवहन समन्वय।',
    emailPlaceholder: 'aggregator@kisanconnect.in or mobile',
    emailLabelEn: 'Business Email or Mobile',
    emailLabelHi: 'बिजनेस ईमेल या मोबाइल नंबर',
    submitEn: 'Sign In as Aggregator →',
    submitHi: 'आढ़ती हब में प्रवेश करें →',
    defaultTab: 'email',
  },
  dealer: {
    titleEn: 'Bulk Dealer & Buyer',
    titleHi: 'थोक खरीदार व डीलर',
    icon: '🏢',
    badgeEn: 'Wholesale Procurement',
    badgeHi: 'थोक खरीद व अनुबंध',
    descEn: 'Purchase verified truckload batches directly from collection hubs.',
    descHi: 'प्रमाणित गुणवत्ता वाली थोक फसलों के अनुबंध व लॉट खरीद।',
    emailPlaceholder: 'dealer@freshbites.in or mobile',
    emailLabelEn: 'Company Email or Mobile',
    emailLabelHi: 'कंपनी ईमेल या मोबाइल नंबर',
    submitEn: 'Sign In as Bulk Dealer →',
    submitHi: 'थोक डीलर के रूप में लॉगिन करें →',
    defaultTab: 'email',
  },
};

export const LoginPage: React.FC<LoginPageProps> = ({ next, onSuccess, onNavigate }) => {
  const { loginWithOtp, sendOtp, loginWithPassword, googleInit, googleVerifyOtp, googleRegister, googleResendOtp } = useAuth();
  const { t, language, setLanguage } = useLanguage();
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
  const [authTab, setAuthTab] = useState<AuthTab>(ROLE_DETAILS[initialRole].defaultTab);

  // Email form state
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone / Email OTP form state
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Google 2FA Email OTP state (Existing User Sign In)
  const [googleOtpState, setGoogleOtpState] = useState<{
    tempToken: string;
    maskedEmail: string;
    email: string;
    user: any;
  } | null>(null);

  // Google Email OTP state (New User Sign Up)
  const [googleRegisterState, setGoogleRegisterState] = useState<{
    googleProfile: { googleId: string; email: string; name: string; picture?: string };
    maskedEmail: string;
  } | null>(null);
  const [googleRegisterRole, setGoogleRegisterRole] = useState<'farmer' | 'aggregator' | 'dealer'>(initialRole);
  const [googleRegisterPassword, setGoogleRegisterPassword] = useState('');
  const [googleOtpCode, setGoogleOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getTargetUrl = (role: string) => {
    if (next) return next;
    if (role === 'farmer') return '/dashboard';
    if (role === 'aggregator') return '/aggregator';
    if (role === 'dealer' || role === 'buyer') return '/buyer';
    if (role === 'admin') return '/admin';
    return '/dashboard';
  };

  // Switch stakeholder role and adapt default authentication method
  const handleRoleSelect = (role: StakeholderRole) => {
    setSelectedRole(role);
    setGoogleRegisterRole(role);
    setAuthTab(ROLE_DETAILS[role].defaultTab);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Cooldown effect for resend email OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Cooldown effect for phone/email OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // Email / Password Login Submit
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailIdentifier.trim() || !password) {
      setErrorMsg(isHi ? 'कृपया अपना ईमेल या मोबाइल नंबर और पासवर्ड दर्ज करें।' : 'Please enter your email or mobile and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Pass selectedRole so backend validates credentials against the chosen persona
      const loggedUser = await loginWithPassword(emailIdentifier.trim(), password, selectedRole);
      onSuccess(getTargetUrl(loggedUser?.role || selectedRole));
    } catch (err: any) {
      console.error('[Login] Error:', err);
      setErrorMsg(
        err?.message || (isHi ? 'अमान्य क्रेडेंशियल्स।' : 'Invalid credentials.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Send OTP (Email or Phone)
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        setErrorMsg(isHi ? 'कृपया 10 अंकों का वैध मोबाइल नंबर या ईमेल दर्ज करें।' : 'Please enter a valid 10-digit mobile number or email address.');
        return;
      }
    }

    if (otpCooldown > 0) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      await sendOtp(identifier);
      setOtpSent(true);
      setOtpCooldown(60);
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

  // Verify OTP & Sign In
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = phoneOrEmail.trim();
    if (!identifier) {
      setErrorMsg(isHi ? 'कृपया अपना ईमेल या मोबाइल नंबर दर्ज करें।' : 'Please enter your email or mobile number.');
      return;
    }
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया 6 अंकों का ओटीपी दर्ज करें।' : 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithOtp(identifier, otpCode.trim(), selectedRole);
      onSuccess(getTargetUrl(loggedUser?.role || selectedRole));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'लॉगिन विफल रहा।' : 'Login failed. Invalid or expired OTP.'));
    } finally {
      setLoading(false);
    }
  };

  // Google Authentication Initiation
  const handleGoogleSuccess = async (googleData: { email: string; name: string; googleId: string; picture?: string; credential?: string }) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await googleInit(googleData.credential ? { credential: googleData.credential } : { googleUser: googleData });
      if (res.status === 'OTP_REQUIRED') {
        setGoogleRegisterState(null);
        setGoogleOtpState({
          tempToken: res.tempToken,
          maskedEmail: res.maskedEmail || res.email,
          email: res.email,
          user: res.user
        });
        setGoogleOtpCode('');
        setResendCooldown(60);
        setSuccessMsg(isHi ? `Google खाता मिला! सत्यापन कोड ${res.maskedEmail || res.email} पर भेजा गया है।` : `Google account found! Verification code sent to ${res.maskedEmail || res.email}.`);
      } else if (res.status === 'REGISTER_REQUIRED') {
        setGoogleOtpState(null);
        setGoogleRegisterState({
          googleProfile: res.googleProfile || googleData,
          maskedEmail: res.maskedEmail || res.email,
        });
        setGoogleOtpCode('');
        setResendCooldown(60);
        setSuccessMsg(isHi ? `नया खाता! सत्यापन कोड ${res.maskedEmail || res.email} पर भेजा गया है।` : `New account! Verification code sent to ${res.maskedEmail || res.email}.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'Google लॉगिन विफल रहा' : 'Google login failed'));
    } finally {
      setLoading(false);
    }
  };

  // Google Verify OTP
  const handleGoogleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOtpState) return;
    if (!googleOtpCode || googleOtpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया 6 अंकों का कोड दर्ज करें' : 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await googleVerifyOtp(googleOtpState.tempToken, googleOtpCode.trim());
      onSuccess(getTargetUrl(loggedUser?.role || 'farmer'));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'सत्यापन कोड अमान्य है' : 'Verification code is invalid'));
    } finally {
      setLoading(false);
    }
  };

  // Google Register Submit
  const handleGoogleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleRegisterState) return;
    if (!googleOtpCode || googleOtpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया 6 अंकों का कोड दर्ज करें' : 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        googleId: googleRegisterState.googleProfile.googleId,
        email: googleRegisterState.googleProfile.email,
        name: googleRegisterState.googleProfile.name,
        avatarUrl: googleRegisterState.googleProfile.picture,
        code: googleOtpCode.trim(),
        password: googleRegisterPassword || undefined,
        role: googleRegisterRole
      };

      if (googleRegisterRole === 'farmer') {
        payload.villageDistrict = 'Agra, UP';
        payload.mainCrops = ['potato'];
      } else {
        payload.businessName = `${googleRegisterRole === 'aggregator' ? 'Aggregator' : 'Buyer'} Enterprise`;
        payload.contactPerson = googleRegisterState.googleProfile.name;
        payload.city = 'Agra, UP';
      }

      const res = await googleRegister(payload);
      if (res.status === 'pending') {
        setSuccessMsg(res.message || (isHi ? 'पंजीकरण सबमिट हुआ! अनुमोदन की प्रतीक्षा है।' : 'Registration submitted! Waiting for approval.'));
        setTimeout(() => onSuccess(getTargetUrl(googleRegisterRole)), 1500);
      } else {
        onSuccess(getTargetUrl(res.user?.role || googleRegisterRole));
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'पंजीकरण विफल रहा' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendGoogleEmailOtp = async () => {
    const targetEmail = googleOtpState?.email || googleRegisterState?.googleProfile?.email;
    if (!targetEmail || resendCooldown > 0) return;
    try {
      await googleResendOtp(targetEmail);
      setSuccessMsg(isHi ? 'नया कोड भेजा गया है।' : 'A new code has been sent to your email.');
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend code');
    }
  };


  return (
    <div className="min-h-[calc(100vh-72px)] w-full flex items-center justify-center p-3 sm:p-6 lg:p-10 text-white relative overflow-hidden bg-[#05110B]">
      
      {/* 🌾 Full-Page Scenic Agriculture Background Image (High Visibility) */}
      <div 
        className="absolute inset-0 bg-center bg-cover bg-no-repeat pointer-events-none scale-105"
        style={{ backgroundImage: `url('/farm_landscape_preview.jpg')` }}
      />

      {/* Balanced semi-transparent overlay: farm landscape clearly visible, text contrast preserved */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05110B]/60 via-[#07160F]/45 to-[#05110B]/70 backdrop-blur-[1px] pointer-events-none" />

      {/* Subtle tech ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] rounded-full bg-cyan-500/15 blur-[100px] pointer-events-none" />

      {/* Main Split-Screen Container with glassmorphism */}
      <div className="relative z-10 w-full max-w-6xl min-h-[620px] rounded-3xl border border-emerald-500/30 bg-[#0A1711]/75 backdrop-blur-2xl shadow-2xl shadow-black/70 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* ========================================================================= */}
        {/* LEFT SIDE (~50% width on Desktop): Brand & Value Proposition Panel        */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-emerald-900/60 relative overflow-hidden bg-gradient-to-br from-[#0B1B13]/70 via-[#08150F]/60 to-[#050E0A]/70">
          
          {/* Subtle background crop watermark in left panel */}
          <div 
            className="absolute inset-0 opacity-20 bg-center bg-cover pointer-events-none"
            style={{ backgroundImage: `url('/farm_landscape_preview.jpg')` }}
          />

          <div>
            {/* Top Brand Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
                  KISAN<span className="text-emerald-400">CONNECT</span>
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-emerald-300 uppercase font-mono">
                    SMART AGRICULTURAL SUPPLY NETWORK
                  </span>
                </div>
              </div>
            </div>

            {/* Main Headline */}
            <h2 className="text-2xl sm:text-4xl lg:text-[42px] font-black leading-[1.18] tracking-tight text-white mt-4 sm:mt-6 mb-4">
              Connecting Farmers.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                Powering Better Markets.
              </span>
            </h2>

            {/* Supporting Text */}
            <p className="text-sm sm:text-base text-emerald-100/70 leading-relaxed max-w-lg mb-8 font-medium">
              {isHi
                ? 'किसानों को सीधे खरीदारों, पारदर्शी मंडी भाव, संकलन केंद्रों और सुगम आपूर्ति तंत्र से जोड़ें — सब कुछ एक ही मंच पर।'
                : 'Connect farmers with buyers, aggregation, storage and smarter supply-chain decisions — all in one place.'}
            </p>

            {/* Compact Feature / Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-900/50 hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-1.5 text-emerald-400">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    {isHi ? 'सीधा खरीदार संपर्क' : 'Direct Buyer Connections'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/60 leading-snug">
                  {isHi ? 'प्रमाणित खाद्य प्रोसेसर और थोक खरीदारों से सीधा अनुबंध।' : 'Verified food processors, FMCG buyers & retail aggregators.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-900/50 hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-1.5 text-cyan-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    {isHi ? 'पारदर्शी भाव' : 'Transparent Offers'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/60 leading-snug">
                  {isHi ? 'वास्तविक मंडी भाव व परिवहन कटौती के बाद स्पष्ट आय।' : 'Guaranteed mandi rate transparency & net farm-gate earnings.'}
                </p>
              </div>

              <div className="sm:col-span-2 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-900/50 hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center gap-2.5 mb-1.5 text-emerald-400">
                  <Boxes className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    {isHi ? 'स्मार्ट आपूर्ति समन्वय' : 'Smart Supply Coordination'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/60 leading-snug">
                  {isHi ? 'गाँव स्तर पर लॉट पूलिंग, कोल्ड स्टोरेज और फ्रेट शेड्यूलिंग।' : 'Hub-level batch aggregation, cold storage booking & optimized transit.'}
                </p>
              </div>

            </div>
          </div>

          {/* Bottom Security / Trust Line */}
          <div className="pt-4 border-t border-emerald-900/40 flex items-center justify-between text-xs text-emerald-300/80 font-medium">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Farmer-first • Transparent • Data-driven</span>
            </div>
            <span className="hidden sm:inline-block text-[11px] text-emerald-400/50 font-mono">v2.4 AgriOS</span>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT SIDE (~50% width on Desktop): Authentication Form Card              */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-[#0B1711] relative">
          
          <div>
            {/* Top Row: Welcome Header & Language Selector Pill */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {isHi ? 'वापसी पर स्वागत है' : 'Welcome back'}
                </h1>
                <p className="text-xs sm:text-sm text-emerald-200/60 mt-1 font-medium">
                  {isHi ? 'लॉगिन करने के लिए अपनी भूमिका चुनें' : 'Select your role to sign in to KisanConnect.'}
                </p>
              </div>

              {/* Language Switcher Pill */}
              <div className="inline-flex items-center p-1 rounded-full bg-[#08150E] border border-emerald-900/60 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-300/60 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                    language === 'hi'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-300/60 hover:text-white'
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>

            {/* STAKEHOLDER ROLE SELECTOR: Farmer, Aggregator, Bulk Dealer */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 font-bold">
                  {isHi ? 'खाता प्रकार चुनें (भूमिका):' : 'SELECT ACCOUNT ROLE:'}
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 font-bold">
                  {isHi ? ROLE_DETAILS[selectedRole].badgeHi : ROLE_DETAILS[selectedRole].badgeEn}
                </span>
              </div>

              {/* 3 Role Selection Tabs (Clean & Modern, No Circular Dots) */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#08150E]/80 rounded-2xl border border-emerald-900/60 shadow-inner">
                
                {/* Farmer Option */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('farmer')}
                  className={`min-h-[48px] py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer relative ${
                    selectedRole === 'farmer'
                      ? 'bg-emerald-900/50 text-emerald-200 border border-emerald-400/60 shadow-sm'
                      : 'text-emerald-400/60 hover:text-white hover:bg-emerald-950/40 border border-transparent'
                  }`}
                >
                  <span className="text-base leading-none">🌾</span>
                  <span className="tracking-tight text-center">{isHi ? 'किसान' : 'Farmer'}</span>
                </button>

                {/* Aggregator Option */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('aggregator')}
                  className={`min-h-[48px] py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer relative ${
                    selectedRole === 'aggregator'
                      ? 'bg-emerald-900/50 text-emerald-200 border border-emerald-400/60 shadow-sm'
                      : 'text-emerald-400/60 hover:text-white hover:bg-emerald-950/40 border border-transparent'
                  }`}
                >
                  <span className="text-base leading-none">📦</span>
                  <span className="tracking-tight text-center">{isHi ? 'आढ़ती' : 'Aggregator'}</span>
                </button>

                {/* Bulk Dealer Option */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('dealer')}
                  className={`min-h-[48px] py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer relative ${
                    selectedRole === 'dealer'
                      ? 'bg-emerald-900/50 text-emerald-200 border border-emerald-400/60 shadow-sm'
                      : 'text-emerald-400/60 hover:text-white hover:bg-emerald-950/40 border border-transparent'
                  }`}
                >
                  <span className="text-base leading-none">🏢</span>
                  <span className="tracking-tight text-center">{isHi ? 'थोक डीलर' : 'Bulk Dealer'}</span>
                </button>

              </div>
            </div>

            {/* Error & Success Notification Banners */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && !errorMsg && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs sm:text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* GOOGLE EMAIL OTP VERIFICATION SUB-VIEWS (WHEN GOOGLE 2FA IS TRIGGERED) */}
            {googleOtpState ? (
              <form onSubmit={handleGoogleVerifyOtpSubmit} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-center">
                  <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1">
                    {isHi ? 'प्रमाणित Google खाता' : 'Verified Google Account'}
                  </p>
                  <p className="text-sm font-bold text-white">
                    {googleOtpState.user?.name || 'User'} ({googleOtpState.maskedEmail})
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80">
                      {isHi ? '6-अंकीय सत्यापन कोड' : '6-Digit Verification Code'}
                    </label>
                    <button
                      type="button"
                      onClick={handleResendGoogleEmailOtp}
                      disabled={resendCooldown > 0 || loading}
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline font-mono disabled:opacity-50 cursor-pointer"
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
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-emerald-900/60 focus:border-emerald-500 bg-[#08150E] font-black text-lg text-center tracking-widest text-white outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || googleOtpCode.length !== 6}
                  className="w-full min-h-[48px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider transition-all cursor-pointer"
                >
                  {loading ? (isHi ? 'जांच जारी...' : 'Verifying...') : (isHi ? 'कोड सत्यापित करें' : 'Verify & Continue')}
                </button>

                <button
                  type="button"
                  onClick={() => setGoogleOtpState(null)}
                  className="w-full py-2 text-xs font-semibold text-emerald-400/60 hover:text-emerald-300 text-center"
                >
                  ← {isHi ? 'वापस सामान्य लॉगिन पर जाएं' : 'Back to Standard Login'}
                </button>
              </form>
            ) : googleRegisterState ? (
              <form onSubmit={handleGoogleRegisterSubmit} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-center">
                  <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1">
                    {isHi ? 'नया Google खाता लिंक हो रहा है' : 'Linking New Google Account'}
                  </p>
                  <p className="text-sm font-bold text-white">
                    {googleRegisterState.googleProfile?.name} ({googleRegisterState.maskedEmail})
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                    {isHi ? 'अपनी भूमिका चुनें' : 'Select Your Role'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setGoogleRegisterRole('farmer')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        googleRegisterRole === 'farmer'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-[#08150E] text-emerald-300/70 border-emerald-900/60'
                      }`}
                    >
                      🌾 {isHi ? 'किसान' : 'Farmer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoogleRegisterRole('aggregator')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        googleRegisterRole === 'aggregator'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-[#08150E] text-emerald-300/70 border-emerald-900/60'
                      }`}
                    >
                      📦 {isHi ? 'एग्रीगेटर' : 'Aggregator'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoogleRegisterRole('dealer')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        googleRegisterRole === 'dealer'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-[#08150E] text-emerald-300/70 border-emerald-900/60'
                      }`}
                    >
                      🏢 {isHi ? 'खरीदार' : 'Buyer'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-1.5">
                    {isHi ? 'ईमेल सत्यापन कोड' : 'Email Verification Code'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={googleOtpCode}
                    onChange={(e) => setGoogleOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-emerald-900/60 focus:border-emerald-500 bg-[#08150E] font-black text-lg text-center tracking-widest text-white outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || googleOtpCode.length !== 6}
                  className="w-full min-h-[48px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider transition-all cursor-pointer"
                >
                  {loading ? (isHi ? 'खाता बन रहा है...' : 'Creating...') : (isHi ? 'सत्यापित करें और खाता बनाएं' : 'Verify & Create Account')}
                </button>
              </form>
            ) : (
              <>
                {/* 1. Continue with Google Button */}
                <div className="mb-4">
                  <GoogleAuthButton 
                    onSuccess={handleGoogleSuccess} 
                    onError={(err) => setErrorMsg(err)} 
                  />
                </div>

                {/* Divider: OR CONTINUE WITH */}
                <div className="relative flex items-center justify-center mb-5">
                  <div className="border-t border-emerald-900/60 w-full" />
                  <span className="bg-[#0B1711] px-3 text-[11px] font-mono tracking-widest text-emerald-300/50 uppercase whitespace-nowrap">
                    {isHi ? 'या क्रेडेंशियल दर्ज करें' : 'OR CONTINUE WITH'}
                  </span>
                  <div className="border-t border-emerald-900/60 w-full" />
                </div>

                {/* 2. Method Tabs: [ Email Login ] [ Phone / OTP ] */}
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#08150E] rounded-2xl border border-emerald-900/60 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('phone');
                      setErrorMsg(null);
                    }}
                    className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authTab === 'phone'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-300/70 hover:text-white'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>{isHi ? 'ईमेल / फोन ओटीपी' : 'Email / Mobile OTP'}</span>
                    {selectedRole === 'farmer' && (
                      <span className="text-[9px] font-mono bg-emerald-900/80 text-emerald-200 px-1.5 py-0.5 rounded">FAST</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('email');
                      setErrorMsg(null);
                    }}
                    className={`min-h-[42px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      authTab === 'email'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-300/70 hover:text-white'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>{isHi ? 'ईमेल व पासवर्ड' : 'Email & Password'}</span>
                  </button>
                </div>

                {/* 3. Form: EMAIL / PASSWORD LOGIN */}
                {authTab === 'email' && (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                        {isHi ? ROLE_DETAILS[selectedRole].emailLabelHi : ROLE_DETAILS[selectedRole].emailLabelEn}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={emailIdentifier}
                          onChange={(e) => setEmailIdentifier(e.target.value)}
                          placeholder={ROLE_DETAILS[selectedRole].emailPlaceholder}
                          required
                          autoComplete="username"
                          className="w-full min-h-[48px] pl-10 pr-4 py-2.5 bg-[#08150E] border border-emerald-900/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-900 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
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
                          className="w-full min-h-[48px] pl-10 pr-11 py-2.5 bg-[#08150E] border border-emerald-900/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-900 outline-none transition-all"
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

                    {/* Quick Demo Autofill Pill */}
                    <div className="pt-1">
                      {selectedRole === 'aggregator' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailIdentifier('aggregator@kisanconnect.in');
                            setPassword('password123');
                          }}
                          className="w-full py-1.5 px-3 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 rounded-xl text-left text-xs text-amber-300 font-medium flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span>✨ Demo Aggregator: <strong>Vikram Singh (Kushinagar Hub)</strong></span>
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded">AUTOFILL</span>
                        </button>
                      )}
                      {selectedRole === 'dealer' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailIdentifier('vikram@freshbites.com');
                            setPassword('password123');
                          }}
                          className="w-full py-1.5 px-3 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/40 rounded-xl text-left text-xs text-blue-300 font-medium flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span>✨ Demo Bulk Dealer: <strong>FreshBites Foods (Vikram Mehta)</strong></span>
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded">AUTOFILL</span>
                        </button>
                      )}
                      {selectedRole === 'farmer' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailIdentifier('farmer@kisanconnect.in');
                            setPassword('password123');
                          }}
                          className="w-full py-1.5 px-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 rounded-xl text-left text-xs text-emerald-300 font-medium flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span>✨ Demo Farmer: <strong>Ramesh Patel (Kushinagar)</strong></span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">AUTOFILL</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[48px] mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <span>
                        {loading 
                          ? (isHi ? 'साइन इन जारी...' : 'Signing in...') 
                          : (isHi ? ROLE_DETAILS[selectedRole].submitHi : ROLE_DETAILS[selectedRole].submitEn)}
                      </span>
                    </button>
                  </form>
                )}

                {/* 4. Form: EMAIL / PHONE OTP LOGIN */}
                {authTab === 'phone' && (
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                        {isHi ? 'ईमेल या 10-अंकीय मोबाइल नंबर' : 'EMAIL OR MOBILE NUMBER'}
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
                            className="w-full min-h-[48px] pl-10 pr-3 py-2.5 bg-[#08150E] border border-emerald-900/60 focus:border-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-800/60 outline-none transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendOtp()}
                          disabled={loading || otpCooldown > 0}
                          className="min-h-[48px] px-4 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 hover:text-white font-bold text-xs uppercase tracking-wider border border-emerald-700/60 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {otpCooldown > 0
                            ? (isHi ? `${otpCooldown}s में पुनः भेजें` : `Resend in ${otpCooldown}s`)
                            : otpSent
                              ? (isHi ? 'पुनः भेजें' : 'Resend OTP')
                              : (isHi ? 'ओटीपी भेजें' : 'Send OTP')}
                        </button>
                      </div>

                      {/* Quick Helper Identifier Pills */}
                      <div className="pt-1.5 flex flex-wrap gap-2">
                        {selectedRole === 'aggregator' && (
                          <button
                            type="button"
                            onClick={() => { setPhoneOrEmail('aggregator@kisanconnect.in'); }}
                            className="text-[11px] text-amber-300 hover:text-amber-200 underline font-mono cursor-pointer"
                          >
                            Demo: aggregator@kisanconnect.in
                          </button>
                        )}
                        {selectedRole === 'dealer' && (
                          <button
                            type="button"
                            onClick={() => { setPhoneOrEmail('vikram@freshbites.com'); }}
                            className="text-[11px] text-blue-300 hover:text-blue-200 underline font-mono cursor-pointer"
                          >
                            Demo: vikram@freshbites.com
                          </button>
                        )}
                        {selectedRole === 'farmer' && (
                          <button
                            type="button"
                            onClick={() => { setPhoneOrEmail('farmer@kisanconnect.in'); }}
                            className="text-[11px] text-emerald-300 hover:text-emerald-200 underline font-mono cursor-pointer"
                          >
                            Demo: farmer@kisanconnect.in
                          </button>
                        )}
                      </div>
                    </div>

                    {otpSent && (
                      <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
                        <span>
                          {isHi ? 'ओटीपी भेजा गया:' : 'OTP sent to:'}{' '}
                          <strong className="text-white">{phoneOrEmail}</strong>
                        </span>
                        {otpCooldown > 0 && (
                          <span className="font-mono text-emerald-400 text-[11px]">
                            {otpCooldown}s
                          </span>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80">
                          {isHi ? '6-अंकीय ओटीपी कोड' : 'ENTER 6-DIGIT OTP'}
                        </label>
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="• • • • • •"
                        required
                        className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#08150E] border border-emerald-900/60 focus:border-emerald-500 rounded-xl text-base font-bold text-center tracking-widest text-white placeholder-emerald-800/60 outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="w-full min-h-[48px] mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <span>
                        {loading 
                          ? (isHi ? 'सत्यापन जारी...' : 'Verifying...') 
                          : (isHi ? `${ROLE_DETAILS[selectedRole].titleHi} में प्रवेश करें →` : `Verify OTP & Enter as ${ROLE_DETAILS[selectedRole].titleEn} →`)}
                      </span>
                    </button>
                  </form>
                )}

              </>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM ACTIONS: Create Account + OFFICIAL ACCESS LINK                      */}
          {/* ========================================================================= */}
          <div className="mt-8 pt-5 border-t border-emerald-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            
            {/* New to KisanConnect? Create Account with selected role pre-populated */}
            <div className="text-emerald-200/70">
              <span>{isHi ? 'नया खाता बनाना चाहते हैं?' : 'New to KisanConnect?'} </span>
              <button
                type="button"
                onClick={() => onNavigate(`/signup?role=${selectedRole}`)}
                className="text-emerald-400 hover:text-emerald-300 font-extrabold underline cursor-pointer ml-1"
              >
                {isHi ? `${ROLE_DETAILS[selectedRole].titleHi} खाता बनाएं` : `Register as ${ROLE_DETAILS[selectedRole].titleEn}`}
              </button>
            </div>

            {/* Subtle OFFICIAL ACCESS Link */}
            <button
              type="button"
              onClick={() => onNavigate('/admin-login')}
              className="text-[11px] font-mono tracking-wider uppercase text-emerald-400/60 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-emerald-950/40"
              title="Restricted platform governance and administrative oversight"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400/70" />
              <span>OFFICIAL ACCESS</span>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
};

export default LoginPage;
