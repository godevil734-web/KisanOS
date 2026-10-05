import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { GoogleAuthButton } from './GoogleAuthButton';
import { Sprout, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, KeyRound, Phone, Mail, Lock, User } from 'lucide-react';

interface LoginPageProps {
  next?: string;
  onSuccess: (target: string) => void;
  onNavigate: (path: string) => void;
}

type LoginMode = 'user' | 'admin';
type LoginTab = 'farmer' | 'aggregator' | 'dealer';
type FarmerAuthMode = 'otp' | 'password';

export const LoginPage: React.FC<LoginPageProps> = ({ next, onSuccess, onNavigate }) => {
  const { loginWithOtp, sendOtp, loginWithPassword, googleInit, googleVerifyOtp, googleRegister, googleResendOtp } = useAuth();
  const { t, language } = useLanguage();
  const isHi = language === 'hi';

  // Read URL search params for deep linking to role/mode
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlTab = queryParams.get('tab') || queryParams.get('role');
  const urlMode = queryParams.get('mode');
  const isInitialAdmin = urlMode === 'admin' || urlTab === 'admin';

  const [loginMode, setLoginMode] = useState<LoginMode>(isInitialAdmin ? 'admin' : 'user');
  const [activeTab, setActiveTab] = useState<LoginTab>(
    urlTab === 'aggregator' ? 'aggregator' : (urlTab === 'dealer' || urlTab === 'buyer') ? 'dealer' : 'farmer'
  );
  const [farmerAuthMode, setFarmerAuthMode] = useState<FarmerAuthMode>('otp');
  const [farmerPassword, setFarmerPassword] = useState('');
  
  // Admin credentials state
  const [adminIdentifier, setAdminIdentifier] = useState('admin@kisanconnect.in');
  const [adminPassword, setAdminPassword] = useState('ChangeMe@Admin2026');

  // Farmer OTP form states
  const [phone, setPhone] = useState('9876543210'); // Pre-filled with demo for seamless testing
  const [otpCode, setOtpCode] = useState('123456');
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtpChip, setDemoOtpChip] = useState<string | null>(null);

  // Business password form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

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

  // Status and error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const getTargetUrl = (role: string) => {
    if (next) return next;
    if (role === 'farmer') return '/dashboard';
    if (role === 'aggregator') return '/aggregator';
    if (role === 'dealer' || role === 'buyer') return '/dealer';
    if (role === 'admin') return '/admin';
    return '/dashboard';
  };

  // Handle Tab Switch
  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (tab === 'aggregator') {
      setIdentifier('vikram@aggregator.in');
      setPassword('password123');
    } else if (tab === 'dealer') {
      setIdentifier('dealer@freshbites.in');
      setPassword('password123');
    } else {
      setPhone('9876543210');
      setOtpCode('123456');
    }
  };

  // Farmer: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg(isHi ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number');
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
      setSuccessMsg(isHi ? 'ओटीपी सफलतापूर्वक भेजा गया' : 'OTP sent successfully to your mobile');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Farmer: Verify OTP and Login
  const handleFarmerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg(isHi ? 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें' : 'Please enter your 10-digit mobile number');
      return;
    }
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया 6 अंकों का ओटीपी दर्ज करें' : 'Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithOtp(cleanPhone, otpCode.trim(), 'farmer');
      onSuccess(getTargetUrl(loggedUser?.role || 'farmer'));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'लॉगिन विफल रहा' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  // Farmer: Password Login
  const handleFarmerPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg(isHi ? 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें' : 'Please enter your 10-digit mobile number');
      return;
    }
    if (!farmerPassword) {
      setErrorMsg(isHi ? 'कृपया अपना पासवर्ड दर्ज करें' : 'Please enter your password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithPassword(cleanPhone, farmerPassword, 'farmer');
      onSuccess(getTargetUrl(loggedUser?.role || 'farmer'));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'लॉगिन विफल रहा' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  // Aggregator / Dealer: Password Login
  const handleBusinessLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg(isHi ? 'कृपया ईमेल/मोबाइल और पासवर्ड दर्ज करें' : 'Please enter your email/mobile and password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithPassword(identifier.trim(), password, activeTab);
      onSuccess(getTargetUrl(loggedUser?.role || activeTab));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'लॉगिन विफल रहा' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  // Administrator: Password Login (Dedicated Admin section)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminIdentifier.trim() || !adminPassword) {
      setErrorMsg(isHi ? 'कृपया व्यवस्थापक ईमेल और पासवर्ड दर्ज करें' : 'Please enter administrator email and password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await loginWithPassword(adminIdentifier.trim(), adminPassword, 'admin');
      onSuccess(getTargetUrl(loggedUser?.role || 'admin'));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'व्यवस्थापक लॉगिन विफल रहा' : 'Admin login failed'));
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

  // Resend Email OTP
  const handleResendGoogleEmailOtp = async () => {
    const targetEmail = googleOtpState?.email || googleRegisterState?.googleProfile?.email;
    if (!targetEmail || resendCooldown > 0) return;
    try {
      const res = await googleResendOtp(targetEmail);
      if (res.demoOtp) setGoogleOtpCode(res.demoOtp);
      setSuccessMsg(isHi ? 'नया सत्यापन कोड भेजा गया है।' : 'A new verification code has been sent to your Google email.');
      setResendCooldown(30);
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'कोड दोबारा भेजने में विफल' : 'Failed to resend code'));
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

  // Google Email OTP Verification for Existing User
  const handleGoogleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOtpState) return;
    if (!googleOtpCode || googleOtpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया ईमेल पर भेजा गया 6 अंकों का कोड दर्ज करें' : 'Please enter the 6-digit email verification code');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await googleVerifyOtp(googleOtpState.tempToken, googleOtpCode.trim());
      onSuccess(getTargetUrl(loggedUser?.role || 'farmer'));
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'सत्यापन कोड अमान्य है' : 'Email verification code is invalid'));
    } finally {
      setLoading(false);
    }
  };

  // Google Email OTP Verification & Quick Registration for New User
  const handleGoogleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleRegisterState) return;
    if (!googleOtpCode || googleOtpCode.trim().length !== 6) {
      setErrorMsg(isHi ? 'कृपया Google ईमेल पर भेजा गया 6 अंकों का कोड दर्ज करें' : 'Please enter the 6-digit email verification code');
      return;
    }
    if (googleRegisterPassword && googleRegisterPassword.length < 6) {
      setErrorMsg(isHi ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए' : 'Password must be at least 6 characters long');
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
        setTimeout(() => {
          onSuccess(getTargetUrl(googleRegisterRole));
        }, 1500);
      } else {
        onSuccess(getTargetUrl(res.user?.role || googleRegisterRole));
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isHi ? 'पंजीकरण विफल रहा' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4 max-w-xl mx-auto animate-in fade-in duration-150">
      
      {/* Return Notice (if coming from "List My Crop" or protected route) */}
      {next === '/list-crop' && (
        <div className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-[#EEF5F2] border-2 border-[#C5DDD2] text-[#1E3A2B] flex items-center gap-3 shadow-2xs">
          <Sprout className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[#1E3A2B]" />
          <div>
            <div className="font-extrabold text-sm sm:text-base">
              {isHi ? 'अपनी फसल लिस्ट करने के लिए लॉगिन करें' : 'Log in to list your harvest'}
            </div>
            <div className="text-xs text-[#2B3B32] font-medium">
              {isHi ? 'लॉगिन के तुरंत बाद आप सीधे फसल फॉर्म पर पहुंच जाएंगे।' : 'You will be redirected straight to the listing form after login.'}
            </div>
          </div>
        </div>
      )}

      {/* Main Login Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-[#D8D2C4] shadow-md">
        
        {/* Title & Subtitle */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 shadow-xs mb-3">
            {loginMode === 'admin' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <KeyRound className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1C2B23]">
            {googleOtpState
              ? (isHi ? 'Google ईमेल सत्यापन' : 'Google Email Verification')
              : googleRegisterState
              ? (isHi ? 'Google से नया खाता बनाएं' : 'Complete Google Sign Up')
              : loginMode === 'admin'
              ? (isHi ? 'व्यवस्थापक कंसोल लॉगिन' : 'Admin Portal Login')
              : (isHi ? 'किसानकनेक्ट में लॉगिन करें' : 'Log In to KisanConnect')}
          </h1>
          <p className="text-sm sm:text-base text-[#2B3B32] mt-1 font-medium">
            {googleOtpState
              ? (isHi ? `आपके Google ईमेल (${googleOtpState.maskedEmail}) पर भेजा गया सत्यापन कोड दर्ज करें` : `Enter the verification code sent to your Google email (${googleOtpState.maskedEmail})`)
              : googleRegisterState
              ? (isHi ? `अपनी भूमिका चुनें और ${googleRegisterState.maskedEmail} पर भेजा गया 6-अंकीय कोड दर्ज करें` : `Select your role and enter the 6-digit code sent to ${googleRegisterState.maskedEmail}`)
              : loginMode === 'admin'
              ? (isHi ? 'सुपरएडमिन सत्यापन, ऑडिट एवं सुरक्षा प्रबंधन हेतु प्रवेश करें' : 'Access platform oversight, stakeholder approvals, and audit logs')
              : (isHi ? 'अपनी भूमिका चुनें और अपने खाते में प्रवेश करें' : 'Select your role and access your account')}
          </p>
        </div>

        {/* GOOGLE EMAIL OTP VERIFICATION VIEW (EXISTING USER SIGN IN) */}
        {googleOtpState ? (
          <form onSubmit={handleGoogleVerifyOtpSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                {isHi ? 'प्रमाणित Google खाता' : 'Verified Google Account'}
              </p>
              <p className="text-sm font-black text-emerald-950">
                {googleOtpState.user?.name || 'User'} ({googleOtpState.maskedEmail})
              </p>
            </div>

            {googleOtpState.demoOtp && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black px-2 py-0.5 rounded bg-amber-200 text-amber-950 uppercase tracking-wider">
                    DEMO OTP
                  </span>
                  <span className="text-xs text-amber-900 font-bold">
                    {isHi ? 'परीक्षण हेतु ईमेल कोड:' : 'Test verification code:'}
                  </span>
                </div>
                <code className="text-base font-black text-amber-950 tracking-widest bg-white px-2.5 py-0.5 rounded border border-amber-300">
                  {googleOtpState.demoOtp}
                </code>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-black text-[#1C2B23] uppercase tracking-wider">
                  {isHi ? 'Google ईमेल पर भेजा गया 6-अंकीय कोड' : '6-Digit Email Verification Code'}
                </label>
                <button
                  type="button"
                  onClick={handleResendGoogleEmailOtp}
                  disabled={resendCooldown > 0}
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
                placeholder="123456"
                className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-black text-lg text-center tracking-widest text-[#1C2B23] outline-none transition-colors"
                required
              />
              <p className="text-[11px] text-[#5A6860] mt-1 font-medium text-center">
                {isHi ? 'Google लॉगिन पूरा करने के लिए ईमेल पर भेजा गया कोड सत्यापित करें।' : 'Enter the code sent to your Google email to verify and complete sign-in.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || googleOtpCode.length !== 6}
              className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? (isHi ? 'जांच जारी...' : 'Verifying...') : (isHi ? 'ईमेल सत्यापित करें और प्रवेश करें' : 'Verify Email & Enter')}</span>
              <ArrowRight className="w-5 h-5 text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setGoogleOtpState(null);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-800 text-center"
            >
              {isHi ? '← वापस सामान्य लॉगिन पर जाएं' : '← Back to Standard Login'}
            </button>
          </form>
        ) : googleRegisterState ? (
          /* GOOGLE EMAIL OTP REGISTRATION VIEW (NEW USER SIGN UP) */
          <form onSubmit={handleGoogleRegisterSubmit} className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                {isHi ? 'नया Google खाता लिंक हो रहा है' : 'Linking New Google Account'}
              </p>
              <p className="text-sm font-black text-emerald-950">
                {googleRegisterState.googleProfile?.name || 'User'} ({googleRegisterState.maskedEmail})
              </p>
            </div>

            {googleRegisterState.demoOtp && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black px-2 py-0.5 rounded bg-amber-200 text-amber-950 uppercase tracking-wider">
                    DEMO OTP
                  </span>
                  <span className="text-xs text-amber-900 font-bold">
                    {isHi ? 'परीक्षण हेतु ईमेल कोड:' : 'Test verification code:'}
                  </span>
                </div>
                <code className="text-base font-black text-amber-950 tracking-widest bg-white px-2.5 py-0.5 rounded border border-amber-300">
                  {googleRegisterState.demoOtp}
                </code>
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className="block text-xs sm:text-sm font-black text-[#1C2B23] uppercase tracking-wider mb-2">
                {isHi ? 'अपनी भूमिका चुनें' : 'Select Your Role'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGoogleRegisterRole('farmer')}
                  className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black border-2 transition-all cursor-pointer ${
                    googleRegisterRole === 'farmer'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  🌾 {isHi ? 'किसान' : 'Farmer'}
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleRegisterRole('aggregator')}
                  className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black border-2 transition-all cursor-pointer ${
                    googleRegisterRole === 'aggregator'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  🏢 {isHi ? 'एग्रीगेटर' : 'Aggregator'}
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleRegisterRole('dealer')}
                  className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black border-2 transition-all cursor-pointer ${
                    googleRegisterRole === 'dealer'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  🏪 {isHi ? 'व्यापारी' : 'Dealer'}
                </button>
              </div>
            </div>

            {/* 6-Digit Email OTP Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs sm:text-sm font-black text-[#1C2B23] uppercase tracking-wider">
                  {isHi ? 'Google ईमेल पर भेजा गया 6-अंकीय कोड' : '6-Digit Email Verification Code'}
                </label>
                <button
                  type="button"
                  onClick={handleResendGoogleEmailOtp}
                  disabled={resendCooldown > 0}
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
                placeholder="123456"
                className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-black text-lg text-center tracking-widest text-[#1C2B23] outline-none transition-colors"
                required
              />
              <p className="text-[11px] text-[#5A6860] mt-1 font-medium text-center">
                {isHi ? 'खाता सक्रिय करने के लिए ईमेल पर प्राप्त कोड दर्ज करें।' : 'Enter the code received on your Google email to activate your account.'}
              </p>
            </div>

            {/* Optional Password for Direct Login */}
            <div>
              <label className="block text-xs sm:text-sm font-black text-[#1C2B23] uppercase tracking-wider mb-1.5">
                {isHi ? 'पासवर्ड बनाएं (वैकल्पिक)' : 'Create Password (Optional)'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={googleRegisterPassword}
                  onChange={(e) => setGoogleRegisterPassword(e.target.value)}
                  placeholder={isHi ? 'भविष्य में पासवर्ड से लॉगिन करने हेतु' : 'For direct password login without Google'}
                  className="w-full min-h-[48px] px-3.5 pl-10 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white text-sm text-[#1C2B23] outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-[#5A6860] mt-1">
                {isHi ? 'पासवर्ड सेट करने पर आप ईमेल/पासवर्ड से भी सीधे लॉगिन कर सकेंगे।' : 'Setting a password allows you to log in with email/password directly without Google.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || googleOtpCode.length !== 6}
              className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? (isHi ? 'पंजीकरण जारी...' : 'Registering...') : (isHi ? 'ईमेल सत्यापित करें और खाता बनाएं' : 'Verify Email & Create Account')}</span>
              <ArrowRight className="w-5 h-5 text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setGoogleRegisterState(null);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-800 text-center"
            >
              {isHi ? '← वापस सामान्य लॉगिन पर जाएं' : '← Back to Standard Login'}
            </button>
          </form>
        ) : (
          <>
            {/* Top Primary Mode Toggle: User Login vs Admin Login */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#FAF9F5] rounded-2xl border border-[#D8D2C4] mb-6 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('user');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`min-h-[46px] py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  loginMode === 'user'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-[#4A5750] hover:text-[#26332C] hover:bg-white'
                }`}
              >
                <User className={`w-4 h-4 ${loginMode === 'user' ? 'text-emerald-400' : 'text-[#4A5750]'}`} />
                <span>{isHi ? 'उपयोगकर्ता लॉगिन' : 'User Login'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginMode('admin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setAdminIdentifier('godevil344@gmail.com');
                  setAdminPassword('Aryan@123');
                }}
                className={`min-h-[46px] py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  loginMode === 'admin'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-[#4A5750] hover:text-[#26332C] hover:bg-white'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${loginMode === 'admin' ? 'text-emerald-400' : 'text-[#4A5750]'}`} />
                <span>{isHi ? 'व्यवस्थापक (Admin)' : 'Admin Login'}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-900 font-black">
                  PORTAL
                </span>
              </button>
            </div>

            {/* Error / Alert Banner */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-900 text-xs sm:text-sm font-bold flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-700 mt-0.5" />
                <div>
                  <span>{errorMsg}</span>
                  {errorMsg.includes('Admin') && loginMode !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode('admin');
                        setErrorMsg(null);
                      }}
                      className="block mt-1 text-xs underline font-extrabold text-slate-900 cursor-pointer"
                    >
                      {isHi ? 'व्यवस्थापक (Admin) लॉगिन पर जाएं →' : 'Switch to Admin Login →'}
                    </button>
                  )}
                  {errorMsg.includes('Farmer') && (loginMode !== 'user' || activeTab !== 'farmer') && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode('user');
                        handleTabChange('farmer');
                      }}
                      className="block mt-1 text-xs underline font-extrabold text-[#1E3A2B] cursor-pointer"
                    >
                      {isHi ? 'किसान टैब पर जाएं →' : 'Switch to Farmer tab →'}
                    </button>
                  )}
                  {errorMsg.includes('Aggregator') && (loginMode !== 'user' || activeTab !== 'aggregator') && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode('user');
                        handleTabChange('aggregator');
                      }}
                      className="block mt-1 text-xs underline font-extrabold text-[#1E3A2B] cursor-pointer"
                    >
                      {isHi ? 'एग्रीगेटर टैब पर जाएं →' : 'Switch to Aggregator tab →'}
                    </button>
                  )}
                  {(errorMsg.includes('Big Dealer') || errorMsg.includes('Dealer') || errorMsg.includes('Buyer')) && (loginMode !== 'user' || activeTab !== 'dealer') && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode('user');
                        handleTabChange('dealer');
                      }}
                      className="block mt-1 text-xs underline font-extrabold text-[#1E3A2B] cursor-pointer"
                    >
                      {isHi ? 'खरीदार (Buyer) टैब पर जाएं →' : 'Switch to Buyer tab →'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Success Banner */}
            {successMsg && !errorMsg && (
              <div className="mb-5 p-3 rounded-xl bg-[#EEF5F2] border border-[#C5DDD2] text-[#1E3A2B] text-xs sm:text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1E3A2B]" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* MODE 1: USER LOGIN (FARMER / AGGREGATOR / BUYER) */}
            {loginMode === 'user' ? (
              <>
                {/* 3 User Role Tabs (Farmer / Aggregator / Buyer) */}
                <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#FAF9F5] rounded-2xl border border-[#D8D2C4] mb-6">
                  <button
                    type="button"
                    onClick={() => handleTabChange('farmer')}
                    className={`min-h-[48px] py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'farmer'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-[#2B3B32] hover:bg-white'
                    }`}
                  >
                    <span>🌾</span>
                    <span>{isHi ? 'किसान' : 'Farmer'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange('aggregator')}
                    className={`min-h-[48px] py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'aggregator'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-[#2B3B32] hover:bg-white'
                    }`}
                  >
                    <span>📦</span>
                    <span>{isHi ? 'एग्रीगेटर' : 'Aggregator'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange('dealer')}
                    className={`min-h-[48px] py-2.5 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                      activeTab === 'dealer'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-[#2B3B32] hover:bg-white'
                    }`}
                  >
                    <span>🏢</span>
                    <span>{isHi ? 'खरीदार (Buyer)' : 'Buyer'}</span>
                  </button>
                </div>

                {/* TAB 1: FARMER (Allows Mobile OTP OR Password Login) */}
                {activeTab === 'farmer' && (
                  <div>
                    {/* Farmer Auth Toggle (Mobile OTP vs Password) */}
                    <div className="flex rounded-xl bg-stone-100 p-1 mb-4 border border-stone-200">
                      <button
                        type="button"
                        onClick={() => {
                          setFarmerAuthMode('otp');
                          setErrorMsg(null);
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          farmerAuthMode === 'otp' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        📱 {isHi ? 'मोबाइल OTP से लॉगिन' : 'Mobile OTP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFarmerAuthMode('password');
                          setErrorMsg(null);
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          farmerAuthMode === 'password' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        🔒 {isHi ? 'पासवर्ड से लॉगिन' : 'Password Login'}
                      </button>
                    </div>

                    {farmerAuthMode === 'otp' ? (
                      <form onSubmit={handleFarmerLogin} className="space-y-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                            {isHi ? 'मोबाइल नंबर (10 अंक)' : 'Mobile Number (10 digits)'}
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                                <Phone className="w-4 h-4" />
                              </div>
                              <input
                                type="tel"
                                maxLength={10}
                                value={phone}
                                onChange={(e) => {
                                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                                  setErrorMsg(null);
                                }}
                                placeholder="9876543210"
                                className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-base text-[#1C2B23] outline-none transition-colors"
                                required
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSendOtp()}
                              disabled={loading || phone.length !== 10}
                              className="min-h-[48px] px-4 rounded-xl bg-[#EEF5F2] hover:bg-[#1E3A2B] text-[#1E3A2B] hover:text-white border border-[#C5DDD2] font-black text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {otpSent ? (isHi ? 'पुनः भेजें' : 'Resend OTP') : (isHi ? 'ओटीपी भेजें' : 'Send OTP')}
                            </button>
                          </div>
                        </div>

                        {/* Clear DEMO OTP helper chip */}
                        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black px-2 py-0.5 rounded bg-amber-200 text-amber-950 uppercase tracking-wider">
                              DEMO OTP
                            </span>
                            <span className="text-xs text-amber-900 font-bold">
                              {isHi ? 'परीक्षण हेतु कोड:' : 'Fixed test code:'}
                            </span>
                          </div>
                          <code className="text-base font-black text-amber-950 tracking-widest bg-white px-2.5 py-0.5 rounded border border-amber-300">
                            123456
                          </code>
                        </div>

                        {/* OTP Input */}
                        <div>
                          <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                            {isHi ? 'ओटीपी कोड (6 अंक)' : 'Enter 6-Digit OTP'}
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-black text-lg text-center tracking-widest text-[#1C2B23] outline-none transition-colors"
                            required
                          />
                          <p className="text-[11px] text-[#5A6860] mt-1 font-medium">
                            {isHi ? 'ओटीपी 5 मिनट के लिए वैध है (अधिकतम 5 प्रयास)।' : 'Valid for 5 minutes (max 5 attempts).'}
                          </p>
                        </div>

                        {/* Verify & Login Button */}
                        <button
                          type="submit"
                          disabled={loading || otpCode.length !== 6}
                          className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <span>{loading ? (isHi ? 'जांच जारी...' : 'Verifying...') : (isHi ? 'सत्यापित करें व लॉगिन करें' : 'Verify & Log In')}</span>
                          <ArrowRight className="w-5 h-5 text-emerald-400" />
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleFarmerPasswordLogin} className="space-y-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                            {isHi ? 'पंजीकृत मोबाइल नंबर' : 'Registered Mobile Number'}
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                              <Phone className="w-4 h-4" />
                            </div>
                            <input
                              type="tel"
                              maxLength={10}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              placeholder="9876543210"
                              className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none transition-colors"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                            {isHi ? 'साइनअप पर बनाया गया पासवर्ड' : 'Password created during Sign Up'}
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type="password"
                              value={farmerPassword}
                              onChange={(e) => setFarmerPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none transition-colors"
                              required
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading || !farmerPassword || phone.length !== 10}
                          className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <span>{loading ? (isHi ? 'लॉगिन जारी...' : 'Logging In...') : (isHi ? 'पासवर्ड से लॉगिन करें' : 'Log In with Password')}</span>
                          <ArrowRight className="w-5 h-5 text-emerald-400" />
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* TAB 2 & 3: AGGREGATOR / BIG DEALER (BUYER) (Password Login) */}
                {(activeTab === 'aggregator' || activeTab === 'dealer') && (
                  <form onSubmit={handleBusinessLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                        {isHi ? 'ईमेल या मोबाइल नंबर' : 'Email or Mobile Number'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder={activeTab === 'aggregator' ? 'vikram@aggregator.in' : 'dealer@freshbites.in'}
                          className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                        {isHi ? 'पासवर्ड' : 'Password'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-[#1E3A2B] bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    {/* Quick Demo Credential Helper */}
                    <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-[#D8D2C4] text-xs font-semibold text-[#2B3B32]">
                      <span className="font-bold text-[#1E3A2B]">{isHi ? 'डेमो खाता:' : 'Demo Account:'}</span>{' '}
                      {activeTab === 'aggregator' ? 'vikram@aggregator.in / password123' : 'dealer@freshbites.in / password123'}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>{loading ? (isHi ? 'लॉगिन जारी...' : 'Logging In...') : (isHi ? 'लॉगिन करें' : 'Log In')}</span>
                      <ArrowRight className="w-5 h-5 text-emerald-400" />
                    </button>
                  </form>
                )}

                {/* Google Authentication Divider & Button */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#D8D2C4]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-[#5A6860] font-black tracking-wider">
                      {isHi ? 'या Google से सुरक्षित प्रवेश' : 'Or secure sign-in with Google'}
                    </span>
                  </div>
                </div>

                <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={(err) => setErrorMsg(err)}
                  disabled={loading}
                />
              </>
            ) : (
              /* MODE 2: ADMIN LOGIN (SEPARATE ADMIN SECTION) */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shadow-inner">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        {isHi ? 'किसानकनेक्ट व्यवस्थापक पोर्टल' : 'KisanConnect Admin Console'}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {isHi ? 'सुपरएडमिन सत्यापन एवं ऑडिट लॉग पहुंच' : 'SuperAdmin verification, audit & stakeholder oversight'}
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Admin Portal
                  </span>
                </div>

                {/* Admin Demo Credential Helper Chip */}
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black px-2 py-0.5 rounded bg-amber-200 text-amber-950 uppercase tracking-wider">
                      ADMIN DEMO
                    </span>
                    <span className="text-xs text-amber-900 font-bold">
                      {isHi ? 'व्यवस्थापक खाता:' : 'Admin account:'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminIdentifier('godevil344@gmail.com');
                      setAdminPassword('Aryan@123');
                    }}
                    className="text-xs font-mono font-black text-amber-950 bg-white px-2.5 py-1 rounded border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                    title={isHi ? 'क्रेडेंशियल भरें' : 'Fill credentials'}
                  >
                    godevil344@gmail.com
                  </button>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                      {isHi ? 'व्यवस्थापक ईमेल' : 'Administrator Email'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={adminIdentifier}
                        onChange={(e) => setAdminIdentifier(e.target.value)}
                        placeholder="admin@kisanconnect.in"
                        className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-slate-800 bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-black text-[#1C2B23] mb-1.5 uppercase tracking-wider">
                      {isHi ? 'व्यवस्थापक पासवर्ड' : 'Administrator Password'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6860]">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full min-h-[48px] pl-10 pr-3.5 rounded-xl border-2 border-[#D8D2C4] focus:border-slate-800 bg-white font-extrabold text-sm sm:text-base text-[#1C2B23] outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !adminIdentifier || !adminPassword}
                    className="w-full min-h-[48px] py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-sm transition-all hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>{loading ? (isHi ? 'प्रमाणीकरण जारी...' : 'Authenticating...') : (isHi ? 'व्यवस्थापक के रूप में लॉगिन करें' : 'Log In as Administrator')}</span>
                    <ArrowRight className="w-5 h-5 text-emerald-400" />
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Footer Link: Go to Sign Up / Switch Mode */}
        <div className="mt-6 pt-5 border-t border-[#EAE5D8] text-center space-y-2">
          {loginMode === 'user' ? (
            <>
              <p className="text-sm font-semibold text-[#2B3B32]">
                {isHi ? 'नया खाता बनाना चाहते हैं?' : "Don't have an account yet?"}{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/signup')}
                  className="text-slate-900 hover:underline font-extrabold cursor-pointer ml-1"
                >
                  {isHi ? 'साइन अप करें →' : 'Sign Up →'}
                </button>
              </p>
              <p className="text-xs text-[#5A6860]">
                {isHi ? 'प्रशासनिक पहुंच के लिए:' : 'For platform administrators:'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('admin');
                    setErrorMsg(null);
                  }}
                  className="text-slate-800 font-extrabold underline hover:text-black cursor-pointer"
                >
                  {isHi ? 'व्यवस्थापक लॉगिन पोर्टल →' : 'Admin Login Portal →'}
                </button>
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-[#2B3B32]">
              {isHi ? 'सामान्य उपयोगकर्ता हैं?' : 'Looking for standard user account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setLoginMode('user');
                  setErrorMsg(null);
                }}
                className="text-slate-900 hover:underline font-extrabold cursor-pointer ml-1"
              >
                {isHi ? '← उपयोगकर्ता लॉगिन पर जाएं' : '← Switch to User Login'}
              </button>
            </p>
          )}
        </div>

      </div>

    </div>
  );
};
