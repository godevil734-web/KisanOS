import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, ArrowLeft, AlertCircle, Fingerprint } from 'lucide-react';

interface AdminLoginPageProps {
  onSuccess: (target: string) => void;
  onNavigate: (path: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onSuccess, onNavigate }) => {
  const { user, loginWithPassword } = useAuth();
  const { language } = useLanguage();
  const isHi = language === 'hi';

  const [adminEmail, setAdminEmail] = useState('godevil344@gmail.com');
  const [adminPassword, setAdminPassword] = useState('Aryan@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already authenticated as admin, automatically redirect to /admin
  useEffect(() => {
    if (user && user.role === 'admin') {
      onSuccess('/admin');
    }
  }, [user, onSuccess]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      setErrorMsg(isHi ? 'कृपया व्यवस्थापक ईमेल और पासवर्ड दर्ज करें' : 'Please enter admin email and password');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Authenticate with expectedRole 'admin'
      const loggedUser = await loginWithPassword(adminEmail.trim(), adminPassword, 'admin');
      
      if (loggedUser?.role !== 'admin') {
        setErrorMsg(isHi ? 'पहुंच अस्वीकृत। केवल अधिकृत व्यवस्थापकों के लिए।' : 'Access denied. Authorized admin credentials required.');
        return;
      }

      onSuccess('/admin');
    } catch (err: any) {
      console.error('[AdminLogin] Error:', err);
      // Safe, generic security message
      setErrorMsg(
        err?.message?.includes('ROLE_MISMATCH')
          ? (isHi ? 'पहुंच अस्वीकृत: यह खाता व्यवस्थापक विशेषाधिकार नहीं रखता।' : 'Access denied: This account does not have administrator privileges.')
          : (isHi ? 'अमान्य क्रेडेंशियल्स। कृपया अपनी जानकारी जांचें।' : 'Invalid admin credentials. Access denied.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden bg-[#07120D] text-white">
      {/* Ambient background tech grid & subtle glows */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(74, 222, 128, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(74, 222, 128, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px'
        }}
      />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[90px] pointer-events-none" />

      {/* Main Command Center Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0D1E16]/85 backdrop-blur-xl border border-emerald-900/60 rounded-3xl p-6 sm:p-9 shadow-2xl shadow-emerald-950/40">
        
        {/* Glowing Agriculture / Security Shield Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-5 flex items-center justify-center">
            {/* Outer animated halo ring */}
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-emerald-500/30 via-cyan-500/20 to-emerald-400/30 blur-md" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#132A1F] to-[#0A1810] border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-white font-mono">
            COMMAND CENTER
          </h1>
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
              {isHi ? 'केवल अधिकृत व्यवस्थापक' : 'Secure Access Only'}
            </span>
          </div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Admin Login Form */}
        <form onSubmit={handleAdminAuth} className="space-y-5">
          {/* Admin Email / ID */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
              {isHi ? 'व्यवस्थापक ईमेल' : 'Admin Email'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@kisanconnect.in"
                required
                autoComplete="email"
                className="w-full min-h-[48px] pl-10 pr-4 py-2.5 bg-[#08150E]/80 border border-emerald-900/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-800 outline-none transition-all"
              />
            </div>
          </div>

          {/* Admin Password */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
              {isHi ? 'सुरक्षा पासवर्ड' : 'Password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/60">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                className="w-full min-h-[48px] pl-10 pr-11 py-2.5 bg-[#08150E]/80 border border-emerald-900/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-sm font-medium text-white placeholder-emerald-800 outline-none transition-all"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[50px] mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <Fingerprint className="w-4 h-4 text-emerald-200" />
            <span>{loading ? (isHi ? 'प्रमाणीकरण जारी...' : 'Authenticating...') : (isHi ? 'प्रवेश करें' : 'AUTHENTICATE')}</span>
          </button>
        </form>

        {/* Return to Normal Portal Link */}
        <div className="mt-6 pt-5 border-t border-emerald-900/40 text-center">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400/70 hover:text-emerald-300 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>{isHi ? 'वापस किसानकनेक्ट पोर्टल पर जाएं' : 'Return to KisanConnect'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default AdminLoginPage;
