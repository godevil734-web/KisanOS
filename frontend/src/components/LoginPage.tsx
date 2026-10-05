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
  Shield
} from 'lucide-react';

interface LoginPageProps {
  next?: string;
  onSuccess: (target: string) => void;
  onNavigate: (path: string) => void;
}

type AuthTab = 'email' | 'phone';

export const LoginPage: React.FC<LoginPageProps> = ({ next, onSuccess, onNavigate }) => {
  const { loginWithOtp, sendOtp, loginWithPassword, googleInit, googleVerifyOtp, googleRegister, googleResendOtp } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const isHi = language === 'hi';

  const [authTab, setAuthTab] = useState<AuthTab>('email');

  // Email form state
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone / OTP form state
  const [phone, setPhone] = useState('9876543210');
  const [otpCode, setOtpCode] = useState('123456');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtpChip, setDemoOtpChip] = useState<string | null>(null);

  // Google 2FA Email OTP state (Existing User Sign In)
  const [googleOtpState, setGoogleOtpState] = useState<{
    tempToken: string;
    maskedEmail: string;
    email: string;
    demoOtp?: string;
    user: any;
  } | null>(null);

  // Google Email OTP state (New User Sign Up)
  const [googleRegisterState, setGoogleRegisterState] = useState<{
    googleProfile: { googleId: string; email: string; name: string; picture?: string };
    maskedEmail: string;
    demoOtp?: string;
  } | null>(null);
  const [googleRegisterRole, setGoogleRegisterRole] = useState<'farmer' | 'aggregator' | 'dealer'>('farmer');
  const [googleRegisterPassword, setGoogleRegisterPassword] = useState('');
  const [googleOtpCode, setGoogleOtpCode] = useState('123456');
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

  // Cooldown effect for resend email OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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
      // Normal login without hardcoding expectedRole allows Farmer/Buyer/Aggregator
      const loggedUser = await loginWithPassword(emailIdentifier.trim(), password);
      onSuccess(getTargetUrl(loggedUser?.role || 'farmer'));
    } catch (err: any) {
      console.error('[Login] Error:', err);
      setErrorMsg(
        err?.message || (isHi ? 'अमान्य ईमेल या पासवर्ड।' : 'Invalid email or password.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Phone: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg(isHi ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await sendOtp(cleanPhone);
      setOtpSent(true);
      if (res.demoOtp) {
        setDemoOtpChip(res.demoOtp);
        setOtpCode(res.demoOtp);
      }
      setSuccessMsg(isHi ? 'ओटीपी सफलतापूर्वक भेजा गया!' : 'OTP sent successfully to your mobile!');
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'ओटीपी भेजने में विफल।' : 'Failed to send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  // Phone: Verify OTP & Sign In
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg(isHi ? 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।' : 'Please enter your 10-digit mobile number.');
      return;
    }
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया 6 अंकों का ओटीपी दर्ज करें।' : 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithOtp(cleanPhone, otpCode.trim());
      onSuccess(getTargetUrl(loggedUser?.role || 'farmer'));
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
          demoOtp: res.demoOtp,
          user: res.user
        });
        if (res.demoOtp) {
          setGoogleOtpCode(res.demoOtp);
        }
        setSuccessMsg(isHi ? `Google खाता मिला! सत्यापन कोड ${res.maskedEmail || res.email} पर भेजा गया है।` : `Google account found! Verification code sent to ${res.maskedEmail || res.email}.`);
      } else if (res.status === 'REGISTER_REQUIRED') {
        setGoogleOtpState(null);
        setGoogleRegisterState({
          googleProfile: res.googleProfile || googleData,
          maskedEmail: res.maskedEmail || res.email,
          demoOtp: res.demoOtp
        });
        if (res.demoOtp) {
          setGoogleOtpCode(res.demoOtp);
        }
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
      const res = await googleResendOtp(targetEmail);
      if (res.demoOtp) setGoogleOtpCode(res.demoOtp);
      setSuccessMsg(isHi ? 'नया कोड भेजा गया है।' : 'A new code has been sent to your email.');
      setResendCooldown(30);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend code');
    }
  };

  // Demo autofill helper
  const handleAutoFill = (role: 'farmer' | 'aggregator' | 'buyer') => {
    setErrorMsg(null);
    if (role === 'farmer') {
      setAuthTab('phone');
      setPhone('9876543210');
      setOtpCode('123456');
    } else if (role === 'aggregator') {
      setAuthTab('email');
      setEmailIdentifier('vikram@aggregator.in');
      setPassword('password123');
    } else if (role === 'buyer') {
      setAuthTab('email');
      setEmailIdentifier('dealer@freshbites.in');
      setPassword('password123');
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full flex items-center justify-center p-3 sm:p-6 lg:p-10 bg-[#07120D] text-white relative overflow-hidden">
      
      {/* Background ambient lighting & subtle tech grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(74, 222, 128, 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(74, 222, 128, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px'
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

      {/* Main Split-Screen Container */}
      <div className="relative z-10 w-full max-w-6xl min-h-[620px] rounded-3xl border border-emerald-900/60 bg-[#0A1711]/90 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* ========================================================================= */}
        {/* LEFT SIDE (~50% width on Desktop): Brand & Value Proposition Panel        */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-emerald-900/60 relative overflow-hidden bg-gradient-to-br from-[#0B1B13] via-[#08150F] to-[#050E0A]">
          
          {/* Subtle background crop watermark */}
          <div 
            className="absolute inset-0 opacity-[0.04] bg-center bg-cover pointer-events-none"
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
            {/* Top Row: Language Selector Pill */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {isHi ? 'वापसी पर स्वागत है' : 'Welcome back'}
                </h1>
                <p className="text-xs sm:text-sm text-emerald-200/60 mt-1 font-medium">
                  {isHi ? 'अपने किसानकनेक्ट खाते में साइन इन करें' : 'Sign in to your KisanConnect account to continue.'}
                </p>
              </div>

              {/* Language Switcher Pill */}
              <div className="inline-flex items-center p-1 rounded-full bg-[#08150E] border border-emerald-900/60 text-xs font-bold">
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

                {googleOtpState.demoOtp && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center justify-between text-xs text-amber-200">
                    <span>{isHi ? 'डेमो ईमेल कोड:' : 'Demo verification code:'}</span>
                    <code className="bg-amber-900/60 px-2 py-0.5 rounded font-mono font-bold text-amber-300">{googleOtpState.demoOtp}</code>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-1.5">
                    {isHi ? '6-अंकीय सत्यापन कोड' : '6-Digit Verification Code'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={googleOtpCode}
                    onChange={(e) => setGoogleOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
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
                    placeholder="123456"
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
                <div className="mb-5">
                  <GoogleAuthButton 
                    onSuccess={handleGoogleSuccess} 
                    onError={(err) => setErrorMsg(err)} 
                  />
                </div>

                {/* Divider: OR CONTINUE WITH */}
                <div className="relative flex items-center justify-center mb-6">
                  <div className="border-t border-emerald-900/60 w-full" />
                  <span className="bg-[#0B1711] px-3 text-[11px] font-mono tracking-widest text-emerald-300/50 uppercase whitespace-nowrap">
                    {isHi ? 'या इनके माध्यम से साइन इन करें' : 'OR CONTINUE WITH'}
                  </span>
                  <div className="border-t border-emerald-900/60 w-full" />
                </div>

                {/* 2. Tabs: [ Email Login ] [ Phone / OTP ] */}
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#08150E] rounded-2xl border border-emerald-900/60 mb-6">
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
                    <span>{isHi ? 'ईमेल लॉगिन' : 'Email Login'}</span>
                  </button>

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
                    <Phone className="w-4 h-4" />
                    <span>{isHi ? 'मोबाइल / ओटीपी' : 'Phone / OTP'}</span>
                  </button>
                </div>

                {/* 3. Form: EMAIL LOGIN */}
                {authTab === 'email' && (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                        {isHi ? 'ईमेल या मोबाइल नंबर' : 'EMAIL ADDRESS'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={emailIdentifier}
                          onChange={(e) => setEmailIdentifier(e.target.value)}
                          placeholder="citizen@example.com / username"
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

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[48px] mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <span>{loading ? (isHi ? 'साइन इन जारी...' : 'Signing in...') : (isHi ? 'साइन इन करें →' : 'Sign In →')}</span>
                    </button>
                  </form>
                )}

                {/* 4. Form: PHONE / OTP LOGIN */}
                {authTab === 'phone' && (
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                        {isHi ? '10-अंकीय मोबाइल नंबर' : 'PHONE NUMBER'}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                            <Phone className="w-4 h-4" />
                          </div>
                          <input
                            type="tel"
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="9876543210"
                            required
                            className="w-full min-h-[48px] pl-10 pr-3 py-2.5 bg-[#08150E] border border-emerald-900/60 focus:border-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-900 outline-none transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendOtp()}
                          disabled={loading}
                          className="min-h-[48px] px-4 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 hover:text-white font-bold text-xs uppercase tracking-wider border border-emerald-700/60 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {otpSent ? (isHi ? 'पुनः भेजें' : 'Resend') : (isHi ? 'ओटीपी भेजें' : 'Send OTP')}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80">
                          {isHi ? '6-अंकीय ओटीपी कोड' : 'OTP CODE'}
                        </label>
                        {demoOtpChip && (
                          <span className="text-[11px] text-emerald-400 font-mono">
                            Demo OTP: <strong className="text-white underline">{demoOtpChip}</strong>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        required
                        className="w-full min-h-[48px] px-3.5 py-2.5 bg-[#08150E] border border-emerald-900/60 focus:border-emerald-500 rounded-xl text-base font-bold text-center tracking-widest text-white placeholder-emerald-900 outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="w-full min-h-[48px] mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      <span>{loading ? (isHi ? 'सत्यापन जारी...' : 'Verifying...') : (isHi ? 'ओटीपी सत्यापित करें और प्रवेश करें →' : 'Verify OTP & Enter →')}</span>
                    </button>
                  </form>
                )}

                {/* 5. 1-Click Fast Demo Credentials Pill Assistant */}
                <div className="mt-5 p-3 rounded-2xl bg-emerald-950/30 border border-emerald-900/40">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/80 mb-1.5 flex items-center justify-between">
                    <span>{isHi ? 'परीक्षण हेतु 1-क्लिक ऑटो-फिल:' : 'Quick Demo Logins (1-Click):'}</span>
                    <span className="text-emerald-500">Auto-fills credentials</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAutoFill('farmer')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 text-xs font-semibold border border-emerald-800/40 transition-colors cursor-pointer"
                    >
                      🌾 Farmer (Ramesh)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAutoFill('aggregator')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 text-xs font-semibold border border-emerald-800/40 transition-colors cursor-pointer"
                    >
                      📦 Aggregator (Vikram)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAutoFill('buyer')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 text-xs font-semibold border border-emerald-800/40 transition-colors cursor-pointer"
                    >
                      🏢 Buyer (FreshBites)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM ACTIONS: Create Account + OFFICIAL ACCESS LINK                      */}
          {/* ========================================================================= */}
          <div className="mt-8 pt-5 border-t border-emerald-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            
            {/* New to KisanConnect? Create Account */}
            <div className="text-emerald-200/70">
              <span>{isHi ? 'नया खाता बनाना चाहते हैं?' : 'New to KisanConnect?'} </span>
              <button
                type="button"
                onClick={() => onNavigate('/signup')}
                className="text-emerald-400 hover:text-emerald-300 font-extrabold underline cursor-pointer ml-1"
              >
                {isHi ? 'खाता बनाएं' : 'Create account'}
              </button>
            </div>

            {/* PART 3: Subtle OFFICIAL ACCESS Link */}
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
