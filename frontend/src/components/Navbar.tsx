import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { 
  Sprout, 
  Layers, 
  Warehouse, 
  Truck, 
  ShoppingBag, 
  BarChart3, 
  ShieldCheck, 
  Bell, 
  Menu, 
  X, 
  ArrowRight,
  UserPlus,
  Home,
  ChevronDown
} from 'lucide-react';
import { RoleSelectModal } from './RoleSelectModal';
import { RegisterModal } from './RegisterModal';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNotifications: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenNotifications }) => {
  const { user, switchRole, unreadCount } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerRole, setRegisterRole] = useState<UserRole>('farmer');
  const [showPersonaDrawer, setShowPersonaDrawer] = useState(false);

  const rolesList: { role: UserRole; label: string; icon: string; name: string; tab: string }[] = [
    { role: 'farmer', label: 'Farmer', icon: '🌾', name: 'Ramesh (Agra)', tab: 'farmer' },
    { role: 'aggregator', label: 'Aggregator', icon: '📦', name: 'Vikram (Hub)', tab: 'aggregator' },
    { role: 'buyer', label: 'Big Buyer', icon: '🏢', name: 'FreshBites', tab: 'buyer' },
    { role: 'cold_storage', label: 'Cold Storage', icon: '❄️', name: 'Imperial Cold', tab: 'storage' },
    { role: 'transporter', label: 'Transporter', icon: '🚚', name: 'Kisan Freight', tab: 'transport' },
    { role: 'admin', label: 'Admin', icon: '⚙️', name: 'SuperAdmin', tab: 'admin' },
  ];

  const handleRoleSelect = async (role: 'farmer' | 'aggregator' | 'buyer') => {
    await switchRole(role);
    setCurrentTab(role);
  };

  const handleScrollTo = (id: string) => {
    if (currentTab !== 'landing') {
      setCurrentTab('landing');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const handleOpenRegister = (role: UserRole = 'farmer') => {
    setRegisterRole(role);
    setIsRegisterOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
        
        {/* Top Demo Tester & Persona Bar (Discreet, high-utility for reviewers & multi-sided testing) */}
        <div className="bg-stone-900 text-stone-300 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-stone-200">KisanConnect Multi-Sided Network:</span>
            <span className="text-[11px] text-stone-400 hidden sm:inline">Active Persona: <strong className="text-white">{user?.name || 'Visitor'}</strong> ({user?.role || 'Guest'})</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            <div className="flex items-center gap-1">
              {rolesList.map((r) => {
                const isActive = user?.role === r.role && currentTab === r.tab;
                return (
                  <button
                    key={r.role}
                    onClick={async () => {
                      await switchRole(r.role);
                      setCurrentTab(r.tab);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white font-bold shadow-xs ring-1 ring-emerald-300 scale-105'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white'
                    }`}
                    title={`Switch to ${r.label} persona`}
                  >
                    <span>{r.icon}</span>
                    <span className="font-semibold">{r.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Register */}
            <button
              onClick={() => handleOpenRegister('farmer')}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-xs transition-transform hover:scale-105"
            >
              <UserPlus className="h-3 w-3" />
              <span>Register</span>
            </button>
          </div>
        </div>

        {/* Main Clean Public Navigation (Section 13) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            
            {/* Brand Logo */}
            <div 
              onClick={() => setCurrentTab('landing')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-800 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/10 group-hover:scale-105 transition-transform">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl sm:text-2xl font-black tracking-tight text-stone-900">
                    Kisan<span className="text-emerald-700">Connect</span>
                  </span>
                  <span className="text-[10px] uppercase font-black tracking-widest bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300">
                    AgriTech
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 hidden sm:block">From Farm to Market, Made Simple</p>
              </div>
            </div>

            {/* Desktop Navigation Links (Section 13: How It Works, For Farmers, For Aggregators, For Buyers, About) */}
            <nav className="hidden lg:flex items-center gap-6">
              <button
                onClick={() => handleScrollTo('how-it-works')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                How It Works
              </button>

              <button
                onClick={() => handleScrollTo('role-farmer')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                For Farmers
              </button>

              <button
                onClick={() => handleScrollTo('role-aggregator')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                For Aggregators
              </button>

              <button
                onClick={() => handleScrollTo('role-buyer')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                For Buyers
              </button>

              <button
                onClick={() => handleScrollTo('trust-values')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                About
              </button>

              {/* Back to Home if inside dashboard */}
              {currentTab !== 'landing' && (
                <button
                  onClick={() => setCurrentTab('landing')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors"
                >
                  <Home className="w-3.5 h-3.5 text-stone-500" />
                  <span>Public Home</span>
                </button>
              )}
            </nav>

            {/* Right Action: Get Started CTA + Notification Bell */}
            <div className="flex items-center gap-3">
              
              {/* Notification Bell */}
              <button
                onClick={onOpenNotifications}
                className="relative p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Primary CTA (Section 13) */}
              <button
                onClick={() => setIsRoleModalOpen(true)}
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all hover:scale-105 active:scale-95"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Mobile Hamburger Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-stone-200 px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-4 duration-200">
            <div className="space-y-1">
              <button
                onClick={() => handleScrollTo('how-it-works')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => handleScrollTo('role-farmer')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                For Farmers (🌾 किसान)
              </button>
              <button
                onClick={() => handleScrollTo('role-aggregator')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                For Aggregators (📦 संग्राहक)
              </button>
              <button
                onClick={() => handleScrollTo('role-buyer')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                For Buyers (🏢 थोक खरीदार)
              </button>
              <button
                onClick={() => handleScrollTo('trust-values')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                About & Values
              </button>
            </div>

            <div className="pt-2 border-t border-stone-200 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsRoleModalOpen(true);
                }}
                className="w-full py-3 rounded-xl bg-emerald-700 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
              >
                <span>Get Started (शुरू करें)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenRegister('farmer');
                }}
                className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-800 font-bold text-xs flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-emerald-700" />
                <span>नया खाता बनाएं (Register)</span>
              </button>
            </div>
          </div>
        )}

      </header>

      {/* Role Selection Modal */}
      <RoleSelectModal 
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSelectRole={handleRoleSelect}
        onOpenRegister={handleOpenRegister}
      />

      {/* Register Modal */}
      <RegisterModal 
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialRole={registerRole}
        onSuccessRoleSelect={(role, tab) => {
          setCurrentTab(tab);
        }}
      />
    </>
  );
};

export default Navbar;
