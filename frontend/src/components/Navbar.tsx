import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { UserRole } from '../types';
import { 
  Sprout, 
  Bell, 
  Menu, 
  X, 
  ArrowRight,
  Home,
  ChevronDown,
  Globe,
  Check,
  LogOut,
  User,
  ShieldCheck,
  UserPlus,
  Layers,
  TrendingUp,
  Coins,
  Award,
  Edit3,
  CheckCircle2,
  MapPin,
  Sparkles,
  FileText,
  Phone,
  Eye
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNotifications: () => void;
  onOpenGetStarted: (role?: 'farmer' | 'aggregator' | 'buyer') => void;
  onNavigate?: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentTab, 
  setCurrentTab, 
  onOpenNotifications,
  onOpenGetStarted,
  onNavigate
}) => {
  const { user, switchRole, unreadCount, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const isHi = language === 'hi';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);

  const langMenuRef = useRef<HTMLDivElement>(null);
  const roleSwitcherRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (roleSwitcherRef.current && !roleSwitcherRef.current.contains(event.target as Node)) {
        setRoleSwitcherOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        setLangMenuOpen(false);
        setRoleSwitcherOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch points balance for farmer
  useEffect(() => {
    if (user?.role === 'farmer') {
      api.getFarmerPoints()
        .then(res => {
          if (res?.success && typeof res.balance === 'number') {
            setPointsBalance(res.balance);
          }
        })
        .catch(() => {});
    }
  }, [user?.id, user?.role]);

  // Listen to points updates dispatched by actions
  useEffect(() => {
    const handlePointsUpdate = (e: any) => {
      if (typeof e.detail?.balance === 'number') {
        setPointsBalance(e.detail.balance);
      }
    };
    window.addEventListener('kisan-points-updated', handlePointsUpdate);
    return () => window.removeEventListener('kisan-points-updated', handlePointsUpdate);
  }, []);

  // Helper to get initials from user name
  const getInitials = (name?: string): string => {
    if (!name) return 'U';
    const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    if (!clean) return name.slice(0, 1).toUpperCase();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const rolesList: { role: UserRole; labelKey: string; icon: string; name: string; tab: string }[] = [
    { role: 'farmer', labelKey: 'roles.farmer', icon: '🌾', name: 'Ramesh (Agra)', tab: 'farmer' },
    { role: 'aggregator', labelKey: 'roles.aggregator', icon: '📦', name: 'Vikram (Hub)', tab: 'aggregator' },
    { role: 'buyer', labelKey: 'roles.buyer', icon: '🏢', name: 'FreshBites', tab: 'buyer' },
    { role: 'cold_storage', labelKey: 'roles.coldStorage', icon: '❄️', name: 'Imperial Cold', tab: 'storage' },
    { role: 'transporter', labelKey: 'roles.transporter', icon: '🚚', name: 'Kisan Freight', tab: 'transport' },
    { role: 'admin', labelKey: 'roles.admin', icon: '⚙️', name: 'SuperAdmin', tab: 'admin' },
  ];

  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
    setMobileMenuOpen(false);
  };

  const handleProfileItemClick = (tabOrSubTab: string, isEdit = false) => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
    if (user?.role === 'farmer') {
      const targetSub = tabOrSubTab === 'profile' ? 'overview' : tabOrSubTab;
      handleNav(`/profile?subtab=${targetSub}${isEdit ? '&edit=1' : ''}`);
    } else {
      if (tabOrSubTab === 'profile') {
        handleNav('/dashboard');
      } else {
        handleNav(`/${user?.role || 'dashboard'}`);
      }
    }
  };

  const isSubTabActive = (subTab: string) => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    const search = window.location.search;
    if (subTab === 'profile' || subTab === 'overview') {
      return (path === '/profile' && (!search.includes('subtab=') || search.includes('subtab=overview'))) || path === '/passport';
    }
    return search.includes(`subtab=${subTab}`) || path === `/${subTab}`;
  };

  const isPublicLanding = currentTab === 'landing';

  return (
    <header className="sticky top-0 z-50 bg-[#F7F5EF]/95 backdrop-blur-md border-b border-[#E5E0D5] shadow-2xs">
      

      {/* Main Public Navigation */}
      <div className="w-full max-w-[1920px] 2xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex items-center justify-between h-16 sm:h-18">
          
          {/* Brand Logo */}
          <div 
            onClick={() => setCurrentTab('landing')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
          >
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#315C45] flex items-center justify-center text-white shadow-xs group-hover:bg-[#264A37] transition-colors shrink-0">
              <Sprout className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-2xl font-black tracking-tight text-[#26332C]">
                  Kisan<span className="text-[#315C45]">Connect</span>
                </span>
                <span className="hidden xs:inline-block text-[10px] uppercase font-bold tracking-wider bg-[#EFECE4] text-[#315C45] px-2 py-0.5 rounded-full border border-[#D8D2C4]">
                  AgriTech
                </span>
              </div>
              <p className="text-[11px] text-[#637067] hidden sm:block font-normal">
                {t('navbar.brandTagline')}
              </p>
            </div>
          </div>

          {/* Public Home Link (Only when inside app/dashboard) */}
          {!isPublicLanding && (
            <nav className="hidden lg:flex items-center gap-5">
              <button
                type="button"
                onClick={() => setCurrentTab('landing')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFECE4] hover:bg-[#E5E0D5] text-[#26332C] text-xs font-bold transition-colors border border-[#E0DBD0] cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-[#315C45]" />
                <span>{t('navbar.publicHome')}</span>
              </button>
            </nav>
          )}

          {/* Right Action: Language Switcher + Authentication CTA */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Clearly Visible Globe-Icon Language Button in Header */}
            <div className="relative" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="min-h-[40px] sm:min-h-[46px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-[#EFECE4] text-[#26332C] font-black text-xs sm:text-sm border-2 border-[#D8D2C4] shadow-2xs flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-all hover:border-[#315C45]"
                aria-label={t('common.language')}
                aria-expanded={langMenuOpen}
              >
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-[#315C45] shrink-0" />
                <span className="font-extrabold">{language === 'hi' ? 'हिंदी' : 'English'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#5A6860] transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {langMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white border border-[#E5E0D5] shadow-xl p-1.5 z-50 animate-in fade-in duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[#71856B] uppercase tracking-wider border-b border-[#F0ECE1] mb-1">
                    {t('common.language')}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('hi');
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      language === 'hi'
                        ? 'bg-[#EEF5F2] text-[#315C45]'
                        : 'text-[#26332C] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌾</span>
                      <span>हिंदी</span>
                    </div>
                    {language === 'hi' && <Check className="w-4 h-4 text-[#315C45]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      language === 'en'
                        ? 'bg-[#EEF5F2] text-[#315C45]'
                        : 'text-[#26332C] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌐</span>
                      <span>English</span>
                    </div>
                    {language === 'en' && <Check className="w-4 h-4 text-[#315C45]" />}
                  </button>
                </div>
              )}
            </div>

            {/* Authentication & User State Actions */}
            {!user ? (
              <>
                {/* Logged Out: User Login */}
                <button
                  type="button"
                  onClick={() => handleNav('/login')}
                  className="hidden sm:inline-flex min-h-[40px] sm:min-h-[42px] px-3.5 sm:px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm shadow-xs transition-colors items-center gap-1.5 cursor-pointer border border-slate-700/60"
                >
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>{t('navbar.login')}</span>
                </button>

                {/* Logged Out: Sign Up Button */}
                <button
                  type="button"
                  onClick={() => handleNav('/signup')}
                  className="hidden sm:inline-flex min-h-[40px] sm:min-h-[42px] px-3.5 sm:px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm shadow-xs transition-colors items-center gap-1.5 cursor-pointer border border-slate-700/60"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>{t('navbar.signup')}</span>
                </button>
              </>
            ) : (
              <>
                {/* Logged In: Notification Bell (inside app) */}
                {!isPublicLanding && (
                  <button
                    type="button"
                    onClick={onOpenNotifications}
                    className="relative min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 flex items-center justify-center rounded-xl text-[#4A5750] hover:text-[#26332C] hover:bg-[#EFECE4] border border-[#E0DBD0] transition-colors cursor-pointer"
                    aria-label="Notifications"
                    title={t('navbar.notifications')}
                  >
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C58B4E] text-[10px] font-bold text-white ring-2 ring-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Admin Persona Switcher (SuperAdmin only) */}
                {user.role === 'admin' && (
                  <div className="relative" ref={roleSwitcherRef}>
                    <button
                      type="button"
                      onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                      className="min-h-[40px] sm:min-h-[44px] px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs bg-slate-900 text-white border-slate-700 hover:bg-slate-800"
                      aria-label="Admin Persona Switcher"
                      title={isHi ? 'व्यवस्थापक स्विच' : 'Admin Persona Switcher'}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <span>🛡️</span>
                        <span>Admin</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${roleSwitcherOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {roleSwitcherOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-[#E5E0D5] shadow-xl p-2 z-50 animate-in fade-in duration-150">
                        <div className="px-3 py-1.5 text-[10px] font-black text-[#71856B] uppercase tracking-wider border-b border-[#F0ECE1] mb-1.5 flex items-center justify-between">
                          <span>{isHi ? 'भूमिका बदलें' : 'Switch Persona'}</span>
                          <span className="text-[10px] text-stone-600 font-bold uppercase">Admin Only</span>
                        </div>

                        {/* USER ROLES SECTION */}
                        <div className="space-y-1 mb-2">
                          <div className="px-3 text-[10px] font-black uppercase text-stone-600">
                            {isHi ? 'उपयोगकर्ता भूमिकाएं' : 'User Roles'}
                          </div>
                          
                          {/* Farmer */}
                          <button
                            type="button"
                            onClick={async () => {
                              setRoleSwitcherOpen(false);
                              await switchRole('farmer');
                              setCurrentTab('dashboard');
                              handleNav('/dashboard');
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">🌾</span>
                              <div>
                                <div className="font-extrabold">{isHi ? 'किसान' : 'Farmer'}</div>
                                <div className="text-[10px] text-stone-600 font-medium">{isHi ? 'फसल लिस्टिंग और मंडी भाव' : 'Crop listings & mandi rates'}</div>
                              </div>
                            </div>
                          </button>

                          {/* Aggregator */}
                          <button
                            type="button"
                            onClick={async () => {
                              setRoleSwitcherOpen(false);
                              await switchRole('aggregator');
                              setCurrentTab('aggregator');
                              handleNav('/aggregator');
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">📦</span>
                              <div>
                                <div className="font-extrabold">{isHi ? 'एग्रीगेटर' : 'Aggregator'}</div>
                                <div className="text-[10px] text-stone-600 font-medium">{isHi ? 'लॉट पूलिंग और अनुबंध' : 'Batch pooling & dispatch'}</div>
                              </div>
                            </div>
                          </button>

                          {/* Buyer / Dealer */}
                          <button
                            type="button"
                            onClick={async () => {
                              setRoleSwitcherOpen(false);
                              await switchRole('buyer');
                              setCurrentTab('buyer');
                              handleNav('/buyer');
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">🏢</span>
                              <div>
                                <div className="font-extrabold">{isHi ? 'खरीदार (Buyer)' : 'Buyer'}</div>
                                <div className="text-[10px] text-stone-600 font-medium">{isHi ? 'थोक मांग और अनुबंध' : 'Factory supply & orders'}</div>
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* SEPARATE ADMIN SECTION */}
                        <div className="pt-2 border-t border-[#EAE5D8]">
                          <button
                            type="button"
                            onClick={async () => {
                              setRoleSwitcherOpen(false);
                              await switchRole('admin');
                              setCurrentTab('admin');
                              handleNav('/admin');
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between bg-slate-900 text-white font-black shadow-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <div>
                                <div className="font-extrabold">{isHi ? 'सुपरएडमिन कंसोल' : 'Admin Console'}</div>
                                <div className="text-[10px] text-slate-300 font-medium">{isHi ? 'अनुमोदन और ऑडिट लॉग' : 'Approvals & security logs'}</div>
                              </div>
                            </div>
                            <Check className="w-4 h-4 text-emerald-400" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TOP-RIGHT CIRCULAR AVATAR PROFILE MENU */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className="relative flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#315C45]/30 focus:outline-none transition-all cursor-pointer group select-none"
                    aria-label="User Profile Menu"
                    aria-expanded={profileMenuOpen}
                  >
                    {user.avatar || (user as any).profile_image || (user as any).profileImage ? (
                      <img
                        src={user.avatar || (user as any).profile_image || (user as any).profileImage}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-[#315C45] shadow-xs group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#315C45] to-[#1E3A2B] text-white flex items-center justify-center font-black text-sm tracking-wide shadow-xs border-2 border-[#E5E0D5] group-hover:border-[#315C45] group-hover:scale-105 transition-transform">
                        {getInitials(user.name)}
                      </div>
                    )}

                    {/* Online status indicator badge */}
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-2xs" />
                  </button>

                  {/* Urban EYE-Inspired Profile Dropdown Menu */}
                  {profileMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white border border-[#E5E0D5] shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right text-slate-800">
                      {/* 1. View Profile */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          handleNav('/profile');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                      >
                        <span>{isHi ? 'प्रोफाइल देखें (View Profile)' : 'View Profile'}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {user?.role === 'farmer' ? 'FARMER' : user?.role === 'buyer' ? 'BUYER' : user?.role === 'aggregator' ? 'AGGREGATOR' : 'USER'}
                        </span>
                      </button>

                      {/* 2. 'Get Started' tour */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onOpenGetStarted(user?.role === 'aggregator' ? 'aggregator' : user?.role === 'buyer' ? 'buyer' : 'farmer');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                      >
                        {isHi ? "'Get Started' टूर" : "'Get Started' tour"}
                      </button>

                      {/* 3. Privacy Policy */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setShowPrivacyModal(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                      >
                        {isHi ? 'गोपनीयता नीति (Privacy Policy)' : 'Privacy Policy'}
                      </button>

                      {/* 4. Accessibility */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setShowAccessibilityModal(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                      >
                        {isHi ? 'सुगमता (Accessibility)' : 'Accessibility'}
                      </button>

                      {/* 5. Settings */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          handleNav('/profile?subtab=overview&edit=1');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#26332C] hover:bg-[#FAF9F5] transition-colors cursor-pointer"
                      >
                        {isHi ? 'सेटिंग्स (Settings)' : 'Settings'}
                      </button>

                      {/* Divider */}
                      <div className="my-1 border-t border-[#F0ECE1]" />

                      {/* 6. Sign Out */}
                      <button
                        type="button"
                        onClick={async () => {
                          setProfileMenuOpen(false);
                          await logout();
                          handleNav('/');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between text-slate-700 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer group"
                      >
                        <span>{isHi ? 'साइन आउट (Sign Out)' : 'Sign Out'}</span>
                        <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-h-[44px] min-w-[44px] p-2.5 flex items-center justify-center rounded-xl text-[#4A5750] hover:bg-[#EFECE4] border border-[#E0DBD0] transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#E5E0D5] px-4 pt-3 pb-6 space-y-4 shadow-lg animate-in slide-in-from-top-4 duration-150">
          {/* Public Home Link (when inside dashboard) */}
          {!isPublicLanding && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('landing');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-[#26332C] hover:bg-[#EEF5F2] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4 text-[#315C45]" />
                <span>{t('navbar.publicHome')}</span>
              </button>
            </div>
          )}

          {/* Mobile Language Section with Globe Icon */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#637067] uppercase tracking-wider">
              <Globe className="w-4 h-4 text-[#315C45]" />
              <span>{t('common.language')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLanguage('hi');
                  setMobileMenuOpen(false);
                }}
                className={`py-3 px-3 rounded-xl text-sm font-black border-2 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer ${
                  language === 'hi'
                    ? 'bg-[#315C45] text-white border-[#315C45] shadow-xs'
                    : 'bg-white text-[#26332C] border-[#D8D2C4] hover:bg-[#EFECE4]'
                }`}
              >
                <span>🌾</span>
                <span>हिंदी</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  setMobileMenuOpen(false);
                }}
                className={`py-3 px-3 rounded-xl text-sm font-black border-2 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#315C45] text-white border-[#315C45] shadow-xs'
                    : 'bg-white text-[#26332C] border-[#D8D2C4] hover:bg-[#EFECE4]'
                }`}
              >
                <span>🌐</span>
                <span>English</span>
              </button>
            </div>
          </div>

          {/* Mobile Auth & Action Drawer */}
          <div className="pt-3 border-t border-[#E5E0D5] space-y-3">
            {!user ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleNav('/login')}
                  className="min-h-[48px] py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-slate-700/60"
                >
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>{t('navbar.login')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/signup')}
                  className="min-h-[48px] py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border border-slate-700/60"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>{t('navbar.signup')}</span>
                </button>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {user.avatar || (user as any).profile_image || (user as any).profileImage ? (
                        <img
                          src={user.avatar || (user as any).profile_image || (user as any).profileImage}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-[#315C45]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#315C45] to-[#1E3A2B] text-white flex items-center justify-center font-black text-xs shadow-2xs">
                          {getInitials(user.name)}
                        </div>
                      )}
                      <div>
                        <div className="font-extrabold text-sm text-[#26332C]">{user.name}</div>
                        <div className="text-xs text-[#637067] font-semibold">{t(`roles.${user.role}`) || user.role}</div>
                      </div>
                    </div>
                    {user.role === 'farmer' && pointsBalance !== null && (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <span>🪙</span>
                        <span>{pointsBalance} pts</span>
                      </span>
                    )}
                  </div>

                  {/* Mobile Profile & Quick Links */}
                  <div className="space-y-1.5 pt-2 border-t border-[#EAE5D8]">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleNav('/profile');
                      }}
                      className="w-full p-2.5 rounded-xl bg-white border border-[#D8D2C4] text-xs font-bold text-[#26332C] flex items-center justify-between cursor-pointer hover:bg-emerald-50"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#315C45]" />
                        <span>{isHi ? 'प्रोफाइल देखें (View Profile)' : 'View Profile'}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {user.role === 'farmer' ? 'FARMER' : user.role === 'buyer' ? 'BUYER' : user.role === 'aggregator' ? 'AGGREGATOR' : 'USER'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenGetStarted(user.role === 'aggregator' ? 'aggregator' : user.role === 'buyer' ? 'buyer' : 'farmer');
                      }}
                      className="w-full p-2.5 rounded-xl bg-white border border-[#D8D2C4] text-xs font-semibold text-[#26332C] flex items-center gap-2 cursor-pointer hover:bg-emerald-50"
                    >
                      <span>{isHi ? "'Get Started' टूर" : "'Get Started' tour"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowPrivacyModal(true);
                      }}
                      className="w-full p-2.5 rounded-xl bg-white border border-[#D8D2C4] text-xs font-semibold text-[#26332C] flex items-center gap-2 cursor-pointer hover:bg-emerald-50"
                    >
                      <span>{isHi ? 'गोपनीयता नीति (Privacy Policy)' : 'Privacy Policy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowAccessibilityModal(true);
                      }}
                      className="w-full p-2.5 rounded-xl bg-white border border-[#D8D2C4] text-xs font-semibold text-[#26332C] flex items-center gap-2 cursor-pointer hover:bg-emerald-50"
                    >
                      <span>{isHi ? 'सुगमता (Accessibility)' : 'Accessibility'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleNav('/profile?subtab=overview&edit=1');
                      }}
                      className="w-full p-2.5 rounded-xl bg-white border border-[#D8D2C4] text-xs font-semibold text-[#26332C] flex items-center gap-2 cursor-pointer hover:bg-emerald-50"
                    >
                      <span>{isHi ? 'सेटिंग्स (Settings)' : 'Settings'}</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Admin Section (Admin Only) */}
                {user.role === 'admin' && (
                  <div className="p-3 rounded-2xl bg-[#F7F5EF] border border-[#E5E0D5] space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-[#26332C]">
                      <span>{isHi ? 'भूमिका बदलें (Switch Persona)' : 'Switch Persona'}</span>
                      <span className="text-[10px] font-bold text-stone-600 uppercase">Admin Only</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          setMobileMenuOpen(false);
                          await switchRole('farmer');
                          setCurrentTab('dashboard');
                          handleNav('/dashboard');
                        }}
                        className="py-2 px-1.5 rounded-xl text-xs font-extrabold flex flex-col items-center gap-1 border bg-white text-[#26332C] border-[#D8D2C4]"
                      >
                        <span className="text-base">🌾</span>
                        <span>{isHi ? 'किसान' : 'Farmer'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setMobileMenuOpen(false);
                          await switchRole('aggregator');
                          setCurrentTab('aggregator');
                          handleNav('/aggregator');
                        }}
                        className="py-2 px-1.5 rounded-xl text-xs font-extrabold flex flex-col items-center gap-1 border bg-white text-[#26332C] border-[#D8D2C4]"
                      >
                        <span className="text-base">📦</span>
                        <span>{isHi ? 'एग्रीगेटर' : 'Aggregator'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setMobileMenuOpen(false);
                          await switchRole('buyer');
                          setCurrentTab('buyer');
                          handleNav('/buyer');
                        }}
                        className="py-2 px-1.5 rounded-xl text-xs font-extrabold flex flex-col items-center gap-1 border bg-white text-[#26332C] border-[#D8D2C4]"
                      >
                        <span className="text-base">🏢</span>
                        <span>{isHi ? 'खरीदार' : 'Buyer'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await switchRole('admin');
                        setCurrentTab('admin');
                        handleNav('/admin');
                      }}
                      className="w-full py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-between border bg-slate-900 text-white border-slate-900"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>{isHi ? 'व्यवस्थापक कंसोल' : 'Admin Console'}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                        Admin
                      </span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      logout();
                      handleNav('/');
                    }}
                    className="min-h-[48px] py-2.5 px-3 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-extrabold text-sm border border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('navbar.logout')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('/list-crop')}
                    className="min-h-[48px] py-2.5 px-3 rounded-xl bg-[#315C45] text-white font-extrabold text-sm shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t('navbar.listMyCrop')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-base text-slate-900">
                  {isHi ? 'गोपनीयता नीति (Privacy Policy)' : 'Privacy Policy & Data Security'}
                </h3>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <p>
                <strong>KisanConnect</strong> prioritizes the privacy, autonomy, and security of farmers and trade partners.
              </p>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1.5">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>{isHi ? 'किसान डेटा सुरक्षा' : 'Encrypted Farmer Credentials'}</span>
                </div>
                <p className="text-xs text-emerald-800">
                  {isHi 
                    ? 'आपकी भूमि विवरण, आधार सत्यापन, और बैंक विवरण 256-बिट एन्क्रिप्शन द्वारा सुरक्षित हैं।'
                    : 'Aadhaar hashes, land record IDs, and bank account details are stored in compliance with Digital Personal Data Protection standards.'}
                </p>
              </div>
              <p>
                {isHi
                  ? 'हम कभी भी आपका व्यक्तिगत फोन नंबर या वित्तीय विवरण तीसरे पक्ष के विज्ञापनदाताओं को नहीं बेचते हैं।'
                  : 'We never sell your phone number, crop pricing histories, or financial credentials to 3rd-party ad networks.'}
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isHi ? 'ठीक है (Got It)' : 'Got It'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accessibility Modal */}
      {showAccessibilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-base text-slate-900">
                  {isHi ? 'सुगमता सेटिंग्स (Accessibility)' : 'Accessibility Settings'}
                </h3>
              </div>
              <button
                onClick={() => setShowAccessibilityModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs sm:text-sm text-slate-600 space-y-3">
              <p>
                {isHi
                  ? 'KisanConnect को सभी किसानों के लिए सुगम और सरल बनाया गया है।'
                  : 'KisanConnect is designed with universal access principles for multi-lingual and non-tech-savvy users.'}
              </p>
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800">{isHi ? 'आवाज सहायता (Voice Narration)' : 'Voice Audio Assistance'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase">Active</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800">{isHi ? 'बड़ा टेक्स्ट और कंट्रास्ट' : 'High Contrast UI'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-700 uppercase">Default</span>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAccessibilityModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[#315C45] text-white font-bold text-xs hover:bg-[#254634] transition-colors cursor-pointer"
              >
                {isHi ? 'बंद करें (Close)' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </header>
  );
};

export default Navbar;
