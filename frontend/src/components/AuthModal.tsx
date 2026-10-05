import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  X, 
  ArrowRight, 
  Sparkles, 
  Phone, 
  Lock, 
  User as UserIcon, 
  MapPin, 
  Building2,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRole: 'farmer' | 'aggregator' | 'buyer';
  onSwitchRole: () => void;
  onAuthSuccess: (role: 'farmer' | 'aggregator' | 'buyer') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  selectedRole,
  onSwitchRole,
  onAuthSuccess,
}) => {
  const { login, register, switchRole } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('Agra, UP');

  // Role-specific fields
  const [farmName, setFarmName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [companyName, setCompanyName] = useState('');

  if (!isOpen) return null;

  const roleMeta = {
    farmer: {
      name: t('roles.farmer'),
      icon: '🌾',
      badge: 'Farm to Market',
      demoUser: 'Ramesh (Agra Farmer)',
      roleFieldLabel: 'Farm / Harvest Name',
      roleFieldPlaceholder: 'e.g. Verma Agri Farm',
      color: '#315C45',
      bgPill: 'bg-[#EFECE4] text-[#315C45] border-[#D8D2C4]',
    },
    aggregator: {
      name: t('roles.aggregator'),
      icon: '📦',
      badge: 'Hub & Village Aggregation',
      demoUser: 'Vikram (Hub Aggregator)',
      roleFieldLabel: 'Aggregation Hub / Cluster',
      roleFieldPlaceholder: 'e.g. Braj Agri Collection Hub',
      color: '#C58B4E',
      bgPill: 'bg-[#FDF8F0] text-[#C58B4E] border-[#EFE5D3]',
    },
    buyer: {
      name: t('roles.buyer'),
      icon: '🏢',
      badge: 'Bulk Procurement & Processing',
      demoUser: 'FreshBites (Procurement Buyer)',
      roleFieldLabel: 'Company / Enterprise Name',
      roleFieldPlaceholder: 'e.g. FreshBites Food Processing Ltd',
      color: '#536B78',
      bgPill: 'bg-[#EEF3F6] text-[#415D6D] border-[#D5E1E6]',
    },
  }[selectedRole];

  // 1-Click Fast Demo Login
  const handleQuickDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await switchRole(selectedRole);
      onAuthSuccess(selectedRole);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to start demo session');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone && !name) {
      setError('Please enter your phone number or email');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // In demo environment, authenticating with selected role
      await switchRole(selectedRole);
      onAuthSuccess(selectedRole);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setError('Please provide your name and phone number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const regData: any = {
        name,
        phone,
        password,
        role: selectedRole,
        location,
      };
      if (selectedRole === 'farmer') {
        regData.farmerDetails = { farmName: farmName || 'Kisan Krishi Farm', acres: 5 };
      } else if (selectedRole === 'aggregator') {
        regData.aggregatorDetails = { businessName: businessName || 'Agri Collection Center' };
      } else if (selectedRole === 'buyer') {
        regData.buyerDetails = { companyName: companyName || 'Commercial Foods Inc' };
      }

      await register(regData);
      onAuthSuccess(selectedRole);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-md bg-white/95 backdrop-blur-sm text-[#26332C] rounded-2xl shadow-2xl border border-[#E5E0D5] overflow-hidden flex flex-col max-h-[92vh] watermark-farm-landscape"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-5 pb-4 bg-[#FAF9F5] border-b border-[#E5E0D5]">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={onSwitchRole}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#637067] hover:text-[#26332C] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Role</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#637067] hover:text-[#26332C] hover:bg-[#EFECE4] transition-colors"
              title={t('common.close')}
              aria-label={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleMeta.bgPill}`}>
              <span>{roleMeta.icon}</span>
              <span>{roleMeta.name}</span>
            </span>
            <span className="text-[11px] text-[#637067]">{roleMeta.badge}</span>
          </div>

          <h2 className="text-xl font-extrabold text-[#26332C] tracking-tight">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="text-xs text-[#5A6860] mt-0.5">
            {mode === 'login'
              ? `Enter your details to access your ${roleMeta.name} dashboard.`
              : `Register to begin buying or selling as a ${roleMeta.name}.`}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 mt-3 bg-[#EFECE4] rounded-xl border border-[#E0DBD0]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#26332C] shadow-2xs'
                  : 'text-[#637067] hover:text-[#26332C]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-[#26332C] shadow-2xs'
                  : 'text-[#637067] hover:text-[#26332C]'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {/* Quick Demo Access Bar */}
          <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E5E0D5] flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-[#26332C] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#C58B4E]" />
                <span>Fast Demo Access</span>
              </div>
              <div className="text-[10px] text-[#637067]">
                Instant 1-click test entry as {roleMeta.demoUser}
              </div>
            </div>

            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={loading}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>Explore Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#4A5750] mb-1">
                  Phone Number or Email
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-[#637067]" />
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D8D2C4] focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A5750] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#637067]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D8D2C4] focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Continue to {roleMeta.name} Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="text-xs text-[#5A6860] hover:text-[#26332C]"
                >
                  New to KisanConnect? <strong className="text-[#315C45]">Create an account</strong>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#4A5750] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-[#637067]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D8D2C4] focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A5750] mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-[#637067]" />
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D8D2C4] focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A5750] mb-1">
                  {roleMeta.roleFieldLabel}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-[#637067]" />
                  <input
                    type="text"
                    placeholder={roleMeta.roleFieldPlaceholder}
                    value={
                      selectedRole === 'farmer'
                        ? farmName
                        : selectedRole === 'aggregator'
                        ? businessName
                        : companyName
                    }
                    onChange={(e) => {
                      if (selectedRole === 'farmer') setFarmName(e.target.value);
                      else if (selectedRole === 'aggregator') setBusinessName(e.target.value);
                      else setCompanyName(e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D8D2C4] focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A5750] mb-1">
                  Operating Location (Mandi / District)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-[#637067]" />
                  <input
                    type="text"
                    placeholder="e.g. Khandauli, Agra, UP"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D8D2C4] focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A5750] mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#637067]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D8D2C4] focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Create {roleMeta.name} Account & Enter</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-xs text-[#5A6860] hover:text-[#26332C]"
                >
                  Already registered? <strong className="text-[#315C45]">Sign in</strong>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};

export default AuthModal;
