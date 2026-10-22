import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { FarmerListing, Order, Offer } from '../types';
import { 
  Sprout, 
  Plus, 
  CheckCircle2, 
  Warehouse, 
  Users, 
  ChevronRight, 
  ChevronDown,
  MapPin, 
  ArrowRight, 
  Mic, 
  Search, 
  Package, 
  Home, 
  Landmark, 
  Menu, 
  X, 
  Bell, 
  PanelLeftClose, 
  PanelLeftOpen, 
  DollarSign, 
  Headphones, 
  MessageCircle, 
  Droplets, 
  CloudRain, 
  User
} from 'lucide-react';
import { MandiPricesView } from './MandiPricesView';
import { FarmerProfileView } from './FarmerProfileView';
import { farmerDashboardTranslations, DashboardLang } from '../i18n/farmerDashboardTranslations';

interface FarmerDashboardPreviewProps {
  onNavigate?: (path: string) => void;
  onOpenNotifications?: () => void;
  isProductionMode?: boolean;
  isPreviewMode?: boolean;
  returnUrl?: string;
  returnLabel?: string;
}

export const FarmerDashboardPreview: React.FC<FarmerDashboardPreviewProps> = ({ 
  onNavigate, 
  onOpenNotifications,
  isProductionMode = false,
  isPreviewMode,
  returnUrl,
  returnLabel
}) => {
  const { user } = useAuth();
  const actualIsPreview = isPreviewMode !== undefined ? isPreviewMode : !isProductionMode;
  const { language, setLanguage: setGlobalLang } = useLanguage();

  // Language state: synchronized with global language and persisted in localStorage
  const [lang, setLang] = useState<DashboardLang>(() => {
    try {
      const stored = localStorage.getItem('kc_preview_lang') || localStorage.getItem('kc_farmer_lang');
      if (stored === 'hi' || stored === 'hinglish' || stored === 'en') {
        return stored as DashboardLang;
      }
    } catch (e) {
      // localStorage unavailable
    }
    return language === 'hi' ? 'hi' : 'en';
  });

  const handleLangChange = (newLang: DashboardLang) => {
    setLang(newLang);
    try {
      localStorage.setItem('kc_preview_lang', newLang);
      localStorage.setItem('kc_farmer_lang', newLang);
    } catch (e) {
      console.warn('Failed to persist preview language:', e);
    }
    if (newLang === 'hi' || newLang === 'en') {
      setGlobalLang(newLang);
    }
  };

  // Get active translation dictionary
  const t = farmerDashboardTranslations[lang];

  // Desktop collapsible sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Keyboard shortcut Ctrl + B or Cmd + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    'home' | 'listings' | 'mandi_prices' | 'buyers' | 'offers' | 'orders' | 'storage' | 'pool' | 'profile'
  >('home');

  // Real backend data states with reference-accurate initial values
  const [listings, setListings] = useState<FarmerListing[]>([
    {
      id: 'listing-1',
      farmerId: user?.id || 'farmer-1',
      farmerName: user?.name || 'Aryan Singh',
      farmerPhone: user?.phone || '9876543210',
      farmerLocation: 'Agra, UP',
      cropId: 'crop-potato',
      cropName: 'Potato',
      variety: 'Kufri Jyoti • Grade A',
      grade: 'Grade A',
      quantityTons: 5,
      totalQuantityTons: 5,
      availableQuantityTons: 5,
      expectedPricePerKg: 20,
      listingType: 'AVAILABLE_NOW',
      availableDate: '2026-10-18',
      sizeMinMm: 45,
      sizeMaxMm: 65,
      moisturePercent: 12,
      defectsPercent: 2,
      storageRequirement: 'NONE',
      verificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      images: ['/dashboard/potatoes.jpg']
    },
    {
      id: 'listing-2',
      farmerId: user?.id || 'farmer-1',
      farmerName: user?.name || 'Aryan Singh',
      farmerPhone: user?.phone || '9876543210',
      farmerLocation: 'Agra, UP',
      cropId: 'crop-tomato',
      cropName: 'Tomato',
      variety: 'Hybrid • Grade A',
      grade: 'Grade A',
      quantityTons: 3,
      totalQuantityTons: 3,
      availableQuantityTons: 3,
      expectedPricePerKg: 12,
      listingType: 'AVAILABLE_NOW',
      availableDate: '2026-10-18',
      sizeMinMm: 40,
      sizeMaxMm: 60,
      moisturePercent: 14,
      defectsPercent: 1,
      storageRequirement: 'NONE',
      verificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      images: ['/dashboard/tomatoes.jpg']
    }
  ]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([
    {
      id: 'off-1',
      buyerId: 'b-1',
      buyerName: 'FreshBites Foods Pvt Ltd',
      sellerId: user?.id || 'farmer-1',
      sellerName: user?.name || 'Aryan Singh',
      cropName: 'Potato',
      quantityTons: 5,
      buyerOfferedPricePerKg: 18,
      status: 'PENDING',
      createdAt: '2026-10-15T10:00:00.000Z',
      message: 'Immediate procurement for processing facility in Agra'
    },
    {
      id: 'off-2',
      buyerId: 'b-2',
      buyerName: 'AgriHub Traders',
      sellerId: user?.id || 'farmer-1',
      sellerName: user?.name || 'Aryan Singh',
      cropName: 'Tomato',
      quantityTons: 3,
      buyerOfferedPricePerKg: 11.5,
      status: 'PENDING',
      createdAt: '2026-10-14T09:30:00.000Z',
      message: 'Direct farm gate pickup for Delhi NCR supply'
    }
  ]);

  // Search input & selected crop filter in hero banner
  const [bannerSearchQuery, setBannerSearchQuery] = useState('');
  const [bannerSelectedCrop, setBannerSelectedCrop] = useState<string>('');
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  // Set default banner crop title from translation
  useEffect(() => {
    if (!bannerSelectedCrop) {
      setBannerSelectedCrop(t.banner.selectCrop);
    }
  }, [t.banner.selectCrop, bannerSelectedCrop]);

  // Voice assistant modal
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Crop listings sub-filter: 'all' | 'active' | 'draft' | 'sold'
  const [listingFilterTab, setListingFilterTab] = useState<'all' | 'active' | 'draft' | 'sold'>('all');

  // Add produce wizard modal state
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardForm, setWizardForm] = useState({
    cropName: 'Potato',
    variety: 'Kufri Jyoti (3797)',
    customCropName: '',
    quantityValue: 50,
    quantityUnit: 'quintal' as 'quintal' | 'ton',
    expectedPricePerKg: 20,
    village: user?.village || 'Khanduali',
    tehsil: 'Etmadpur',
    district: user?.district || 'Agra'
  });
  const [wizardSuccessMessage, setWizardSuccessMessage] = useState<string | null>(null);

  // Fetch real data on mount with graceful fallback
  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      try {
        const [listingsRes, ordersRes, offersRes] = await Promise.allSettled([
          api.getListings(),
          api.getOrders(),
          api.getOffers()
        ]);

        if (!isMounted) return;

        if (listingsRes.status === 'fulfilled' && Array.isArray(listingsRes.value) && listingsRes.value.length > 0) {
          setListings(listingsRes.value);
        }
        if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
          setOrders(ordersRes.value);
        }
        if (offersRes.status === 'fulfilled' && Array.isArray(offersRes.value) && offersRes.value.length > 0) {
          setOffers(offersRes.value);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      }
    };

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileDrawerOpen(false);
        setIsCropDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigation handler
  const handleNavClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setIsMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit crop wizard
  const handleWizardSubmit = async () => {
    try {
      const qTons = wizardForm.quantityUnit === 'quintal' ? wizardForm.quantityValue / 10 : wizardForm.quantityValue;
      const payload = {
        cropName: wizardForm.cropName === 'Other' ? (wizardForm.customCropName || 'Other') : wizardForm.cropName,
        variety: wizardForm.variety,
        quantityTons: qTons,
        totalQuantityTons: qTons,
        availableQuantityTons: qTons,
        expectedPricePerKg: wizardForm.expectedPricePerKg,
        village: wizardForm.village,
        tehsil: wizardForm.tehsil,
        district: wizardForm.district,
        state: 'Uttar Pradesh'
      };

      const res = await api.createListing(payload);
      if (res && res.id) {
        setListings(prev => [res, ...prev]);
      }
      setWizardSuccessMessage(
        lang === 'hi' 
          ? 'आपकी फसल सफलतापूर्वक मंडी में सूचीबद्ध हो गई है!' 
          : lang === 'hinglish' 
            ? 'Aapki fasal successfully mandi me list ho gayi hai!' 
            : 'Your produce listing has been published successfully!'
      );
      setTimeout(() => {
        setShowAddWizard(false);
        setWizardStep(1);
        setWizardSuccessMessage(null);
        handleNavClick('listings');
      }, 1200);
    } catch (err) {
      console.error('Failed to create listing:', err);
      setShowAddWizard(false);
      setWizardStep(1);
    }
  };

  interface NavItem {
    id: 'home' | 'listings' | 'mandi_prices' | 'buyers' | 'offers' | 'orders' | 'storage' | 'pool' | 'profile' | 'kisan_saathi' | 'whatsapp';
    label: string;
    icon: any;
    badge: string | null;
    badgeColor: string;
  }

  interface NavSection {
    title: string;
    items: NavItem[];
  }

  // Pure single-language Sidebar navigation sections
  const navSections: NavSection[] = useMemo(() => [
    {
      title: t.nav.mainMenu,
      items: [
        { id: 'home', label: t.nav.home, icon: Home, badge: null, badgeColor: '' },
        { id: 'listings', label: t.nav.myProduce, icon: Sprout, badge: '4', badgeColor: 'bg-[#37A86B]/20 text-[#37A86B] font-bold border border-[#37A86B]/40' },
        { id: 'buyers', label: t.nav.findBuyers, icon: Search, badge: null, badgeColor: '' },
        { id: 'offers', label: t.nav.myOffers, icon: DollarSign, badge: '3', badgeColor: 'bg-[#E6A52E] text-[#17251D] font-black' },
        { id: 'orders', label: t.nav.myDeals, icon: Package, badge: null, badgeColor: '' },
      ]
    },
    {
      title: t.nav.features,
      items: [
        { id: 'mandi_prices', label: t.nav.mandiPrices, icon: Landmark, badge: 'LIVE', badgeColor: 'bg-[#37A86B] text-[#104B35] font-black' },
        { id: 'storage', label: t.nav.coldStorage, icon: Warehouse, badge: null, badgeColor: '' },
        { id: 'pool', label: t.nav.farmerPool, icon: Users, badge: null, badgeColor: '' },
      ]
    },
    {
      title: t.nav.support,
      items: [
        { id: 'kisan_saathi', label: t.nav.kisanSaathi, icon: Headphones, badge: 'AI', badgeColor: 'bg-teal-400 text-slate-950 font-black' },
        { id: 'profile', label: t.nav.profile, icon: User, badge: null, badgeColor: '' },
        { id: 'whatsapp', label: t.nav.whatsapp, icon: MessageCircle, badge: null, badgeColor: '' },
      ]
    }
  ], [t]);

  // Crop options for the search dropdown
  const cropDropdownOptions = useMemo(() => [
    { id: 'potato', name: t.crops.potato },
    { id: 'tomato', name: t.crops.tomato },
    { id: 'onion', name: t.crops.onion },
    { id: 'wheat', name: t.crops.wheat },
    { id: 'mustard', name: t.crops.mustard },
  ], [t]);

  const popularCropsList = useMemo(() => [
    t.crops.potato,
    t.crops.tomato,
    t.crops.onion,
    t.crops.wheat,
    t.crops.paddy,
    t.crops.maize,
  ], [t]);

  return (
    // HARVEST PREMIUM THEME - ISOLATED PREVIEW CONTAINER (Warm Ivory Canvas #F7F4E9 + Deep Green #104B35 Sidebar)
    <div className="harvest-premium-theme h-full h-[100dvh] w-full bg-[#F7F4E9] text-[#17251D] font-sans selection:bg-[#37A86B]/20 antialiased flex flex-row overflow-hidden">

      {/* ========================================================================= */}
      {/* 🌟 FULL-PAGE SLIDING SIDEBAR (Deep Agricultural Green #104B35) */}
      {/* ========================================================================= */}
      <aside 
        className={`hidden md:flex flex-col bg-[#104B35] border-r border-[#176B45]/40 transition-all duration-300 ease-in-out shrink-0 h-full select-none z-30 ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-[250px]'
        }`}
      >
        {/* Top Brand Header & Minimize/Expand Sidebar Button - h-16 (64px) matching top header */}
        <div className={`h-16 px-4 border-b border-[#176B45]/40 flex items-center shrink-0 ${isSidebarCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between'}`}>
          <div 
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title="KisanConnect"
          >
            <div className="h-9 w-9 rounded-xl bg-[#176B45] ring-1 ring-[#37A86B]/40 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0 font-bold">
              <Sprout className="h-5 w-5 text-[#E8F1E5]" />
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <div className="text-base font-black tracking-tight text-white flex items-center gap-1 leading-none">
                  <span>Kisan</span>
                  <span className="text-[#37A86B]">Connect</span>
                </div>
                <div className="text-[10px] text-[#37A86B] font-bold mt-1 tracking-wider uppercase flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#37A86B] animate-pulse" />
                  <span>{t.nav.liveFeed}</span>
                </div>
              </div>
            )}
          </div>

          {/* Minimize / Expand Toggle Button with Tooltip */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40 border border-[#176B45]/40 transition-all cursor-pointer relative group shrink-0"
            title={isSidebarCollapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
            aria-label={isSidebarCollapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-950 text-[#E8F1E5] text-[11px] font-bold rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl border border-[#176B45]">
              {isSidebarCollapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
            </div>
          </button>
        </div>

        {/* Categorized Nav Sections */}
        <nav className="flex-1 p-3 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-[#176B45]/50">
          {navSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="text-[10px] font-black tracking-wider text-[#37A86B] uppercase px-3 pt-1.5 pb-0.5">
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'kisan_saathi') {
                        alert(lang === 'hi' ? 'किसान साथी AI सहायक सक्रिय है।' : lang === 'hinglish' ? 'Kisan Saathi AI active hai.' : 'Kisan Saathi AI Assistant is active.');
                      } else if (item.id === 'whatsapp') {
                        window.open('https://wa.me/919876543210?text=Namaste%20KisanConnect', '_blank');
                      } else {
                        handleNavClick(item.id as any);
                      }
                    }}
                    className={`w-full flex items-center rounded-xl font-bold transition-all group relative cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2 text-xs'
                    } ${
                      isActive
                        ? 'bg-[#176B45] text-white shadow-xs font-black'
                        : 'text-[#E8F1E5]/80 hover:bg-[#176B45]/35 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 transition-transform ${
                        isActive ? 'text-white scale-105' : 'text-[#37A86B] group-hover:text-white'
                      }`} />
                      {!isSidebarCollapsed && (
                        <span className="tracking-wide truncate">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!isSidebarCollapsed && item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}

                    {/* Tooltip for collapsed mode */}
                    {isSidebarCollapsed && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 text-white text-xs font-bold rounded-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl border border-[#176B45]">
                        {item.label}
                        {item.badge ? ` (${item.badge})` : ''}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 📱 MOBILE NAVIGATION DRAWER (Deep Green #104B35) */}
      {/* ========================================================================= */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-[#104B35] text-white h-full flex flex-col border-r border-[#176B45]/40 z-10 shadow-2xl">
            <div className="h-16 px-4 border-b border-[#176B45]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#176B45] text-white flex items-center justify-center font-bold shadow-xs">
                  <Sprout className="h-4 w-4 text-[#E8F1E5]" />
                </div>
                <span className="font-black text-sm">KisanConnect</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-full text-[#E8F1E5]/80 hover:bg-[#176B45]/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navSections.flatMap(s => s.items).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      if (item.id === 'kisan_saathi') {
                        alert(lang === 'hi' ? 'किसान साथी AI सहायक सक्रिय है।' : lang === 'hinglish' ? 'Kisan Saathi AI active hai.' : 'Kisan Saathi AI Assistant is active.');
                      } else if (item.id === 'whatsapp') {
                        window.open('https://wa.me/919876543210?text=Namaste%20KisanConnect', '_blank');
                      } else {
                        handleNavClick(item.id as any);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      isActive ? 'bg-[#176B45] text-white shadow-xs' : 'text-[#E8F1E5]/80 hover:bg-[#176B45]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🧭 RIGHT COLUMN: FIXED TOP HEADER + SCROLLABLE MAIN CONTENT */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#F7F4E9] overflow-hidden">

        {/* Global Isolated Preview Mode Indicator Bar */}
        {actualIsPreview && (
          <div className="bg-[#104B35] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold border-b border-[#37A86B]/30 shrink-0 z-30">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#E6A52E] text-[#17251D] text-[10px] font-black uppercase tracking-wider">
                PREVIEW MODE
              </span>
              <span className="font-extrabold">
                Harvest Premium — Standard Layout
              </span>
              <span className="text-[#37A86B] text-[11px] hidden sm:inline">
                • Visual Theme Preview (Underlying Functionality & Data Intact)
              </span>
            </div>
            <button
              onClick={() => onNavigate ? onNavigate(returnUrl || '/admin?tab=appearance') : (window.location.href = returnUrl || '/admin?tab=appearance')}
              className="px-3 py-1 rounded-md bg-white hover:bg-[#E8F1E5] text-[#104B35] font-black text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1"
            >
              ← {returnLabel || (returnUrl?.includes('admin') ? 'Return to Appearance Manager' : 'Return to Dashboard')}
            </button>
          </div>
        )}

        {/* TOP HEADER - Exact Same Deep Green as Sidebar (#104B35) */}
        <header className="h-16 shrink-0 w-full bg-[#104B35] border-b border-[#176B45]/40 px-4 sm:px-6 flex items-center z-20 shadow-xs">
          <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between gap-3 sm:gap-4">

            {/* Left: Mobile Hamburger & Clean Dashboard Breadcrumb */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="md:hidden p-2 rounded-lg text-white hover:bg-[#176B45]/50 transition-colors cursor-pointer"
                aria-label="Open Navigation Drawer"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Breadcrumb / Clean Section Title */}
              <div className="flex items-center gap-2 sm:gap-2.5 text-xs">
                <span className="text-[#37A86B] font-extrabold tracking-wider uppercase text-[11px]">
                  {t.nav.overview}
                </span>
                <span className="text-white/40 font-bold">•</span>
                <span className="text-white font-black text-sm tracking-tight">
                  {t.nav.dashboard}
                </span>
              </div>
            </div>

            {/* Right: Return to Dashboard (Preview Mode), Language Tabs, Notifications, Profile */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              
              {/* Return Button (Only in Preview Mode) */}
              {actualIsPreview && (
                <button
                  onClick={() => onNavigate ? onNavigate(returnUrl || '/admin?tab=appearance') : (window.location.href = returnUrl || '/admin?tab=appearance')}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#176B45]/60 hover:bg-[#176B45] text-white font-bold text-xs border border-[#37A86B]/30 transition-colors cursor-pointer shadow-2xs shrink-0"
                  title="Return to Appearance Manager or Dashboard"
                >
                  <span>{returnLabel || (returnUrl?.includes('admin') ? '← UI/UX Manager' : t.nav.returnToCurrent)}</span>
                </button>
              )}

              {/* Language Selection: हिंदी | Hinglish | English */}
              <div className="flex items-center h-9 bg-[#0C3B29]/90 p-0.5 rounded-lg border border-[#176B45]/60 text-xs font-bold text-white shrink-0">
                <button
                  onClick={() => handleLangChange('hi')}
                  className={`h-7 px-2.5 rounded-md transition-all cursor-pointer flex items-center ${
                    lang === 'hi' ? 'bg-[#176B45] text-white font-black shadow-xs' : 'text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40'
                  }`}
                >
                  हिंदी
                </button>
                <button
                  onClick={() => handleLangChange('hinglish')}
                  className={`h-7 px-2.5 rounded-md transition-all cursor-pointer flex items-center ${
                    lang === 'hinglish' ? 'bg-[#176B45] text-white font-black shadow-xs' : 'text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40'
                  }`}
                >
                  Hinglish
                </button>
                <button
                  onClick={() => handleLangChange('en')}
                  className={`h-7 px-2.5 rounded-md transition-all cursor-pointer flex items-center ${
                    lang === 'en' ? 'bg-[#176B45] text-white font-black shadow-xs' : 'text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40'
                  }`}
                >
                  English
                </button>
              </div>

              {/* Notification Bell */}
              <button
                onClick={onOpenNotifications}
                className="h-9 w-9 rounded-lg bg-[#176B45]/50 hover:bg-[#176B45] border border-[#176B45]/80 text-white flex items-center justify-center relative transition-colors cursor-pointer shadow-xs shrink-0"
                title={t.nav.notifications}
              >
                <Bell className="h-4 w-4 text-white" />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#104B35]">
                  3
                </span>
              </button>

              {/* User Profile Avatar */}
              <div 
                onClick={() => handleNavClick('profile')}
                className="h-9 w-9 rounded-lg bg-[#176B45] text-white font-black text-xs flex items-center justify-center border border-[#37A86B]/40 cursor-pointer shadow-xs relative shrink-0 ring-2 ring-[#104B35] hover:bg-[#1c7e52] transition-colors"
                title={t.nav.profile}
              >
                AS
                <span className="h-2 w-2 rounded-full bg-[#37A86B] absolute -bottom-0.5 -right-0.5 ring-2 ring-[#104B35]" />
              </div>

            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* MAIN DASHBOARD CONTENT AREA - THE ONLY SCROLLABLE CONTAINER */}
        {/* ------------------------------------------------------------- */}
        <main className="flex-1 w-full overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 space-y-4 bg-[#F7F4E9] scroll-smooth">

          {/* ========================================================================= */}
          {/* TAB 1: HOME (COMPACT FIRST-SCREEN OVERVIEW WITH ALL 7 ACTION CARDS) */}
          {/* ========================================================================= */}
          {activeTab === 'home' && (
            <div className="space-y-3 sm:space-y-3.5 max-w-[1920px] mx-auto">

              {/* ------------------------------------------------------------- */}
              {/* 1. HERO BANNER - SLENDER, ATTRACTIVE AGRICULTURAL BANNER */}
              {/* ------------------------------------------------------------- */}
              <div className="relative rounded-xl overflow-hidden shadow-xs border border-[#E8DFC9] bg-gradient-to-r from-[#FFFDF9] via-[#FAF6ED] to-[#F2EFE4] text-[#17251D] p-4 sm:p-5">
                
                {/* Subtle Farm Landscape Background Illustration */}
                <div 
                  className="absolute inset-0 bg-cover bg-right sm:bg-center opacity-15 mix-blend-multiply pointer-events-none"
                  style={{ backgroundImage: "url('/dashboard/farm_landscape_banner.jpg')" }}
                />

                <div className="relative z-10 flex flex-col xl:flex-row items-center xl:items-start justify-between gap-4">

                  {/* Left: Farmer Holding Smartphone + Greeting & Crop Search Bar */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 w-full">
                    
                    {/* FARMER HOLDING PHONE THUMBNAIL */}
                    <div className="relative shrink-0">
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border-2 sm:border-3 border-white shadow-sm overflow-hidden bg-amber-100 ring-2 ring-[#37A86B]/30">
                        <img 
                          src="/dashboard/farmer_holding_phone.jpg" 
                          alt="Farmer" 
                          className="h-full w-full object-cover object-top scale-105"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-[#176B45] text-white p-0.5 rounded-full shadow-sm" title={t.banner.verifiedFarmer}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    {/* Greeting, Land details, and Banner Search Bar */}
                    <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h1 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-[#17251D] leading-tight">
                          {t.banner.greetingPrefix} {user?.name || 'Aryan Singh'}{t.banner.ji}
                        </h1>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8F1E5] border border-[#37A86B]/40 text-[#176B45] text-[10px] font-black uppercase tracking-wider">
                          {t.banner.verifiedFarmer}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5 text-xs text-[#657468] font-medium">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#176B45]" />
                          {user?.village || 'Khandauli'}, {user?.district || 'Agra'}, Uttar Pradesh
                        </span>
                        <span className="hidden sm:inline text-[#E5E0D5]">|</span>
                        <span>🌾 {user?.farmerProfile?.acres || 12} {t.banner.acresFarming}</span>
                      </div>

                      <p className="text-xs text-[#657468] leading-snug max-w-xl hidden sm:block">
                        {t.banner.tagline}
                      </p>

                      {/* Search & Filter Bar Inside Banner */}
                      <div className="pt-1 w-full max-w-xl">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white rounded-lg border border-[#A3D1A5] p-1 shadow-2xs gap-1.5">
                          
                          {/* Dropdown: फसल चुनें ⌄ */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsCropDropdownOpen(!isCropDropdownOpen)}
                              className="w-full sm:w-auto flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md bg-[#E8F1E5] hover:bg-[#d8e7d4] text-xs font-bold text-[#176B45] transition-colors cursor-pointer"
                            >
                              <span>🌾 {bannerSelectedCrop || t.banner.selectCrop}</span>
                              <ChevronDown className="h-3 w-3 text-[#176B45]" />
                            </button>

                            {isCropDropdownOpen && (
                              <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-[#E5E0D5] rounded-xl shadow-xl z-50 p-1 text-xs font-bold">
                                {cropDropdownOptions.map((c) => (
                                  <div
                                    key={c.id}
                                    onClick={() => {
                                      setBannerSelectedCrop(c.name);
                                      setBannerSearchQuery(c.name);
                                      setIsCropDropdownOpen(false);
                                    }}
                                    className="px-3 py-1.5 hover:bg-[#E8F1E5] rounded-lg cursor-pointer text-[#17251D]"
                                  >
                                    {c.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Input field with integrated mic button */}
                          <div className="flex-1 px-2 relative flex items-center">
                            <input
                              type="text"
                              placeholder={t.banner.searchProducePlaceholder}
                              value={bannerSearchQuery}
                              onChange={(e) => setBannerSearchQuery(e.target.value)}
                              className="w-full text-xs font-medium text-[#17251D] placeholder:text-[#657468] bg-transparent focus:outline-none pr-6"
                            />
                            <button
                              type="button"
                              onClick={() => setShowVoiceModal(true)}
                              className="absolute right-1.5 text-[#657468] hover:text-[#176B45] transition-colors cursor-pointer p-0.5"
                              title={t.nav.voiceSearch}
                            >
                              <Mic className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Green Action Button: Find Buyers → */}
                          <button
                            onClick={() => handleNavClick('buyers')}
                            className="px-4 py-1.5 rounded-md bg-[#176B45] hover:bg-[#104B35] text-white font-black text-xs shadow-xs flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
                          >
                            <span>{t.banner.findBuyersBtn}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Shortcuts row below search bar */}
                        <div className="pt-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-1 text-xs">
                          <span className="font-bold text-[#17251D] mr-0.5 text-[11px]">{t.banner.popularCropsLabel}</span>
                          {popularCropsList.map((crop) => (
                            <button
                              key={crop}
                              onClick={() => {
                                setBannerSelectedCrop(crop);
                                setBannerSearchQuery(crop);
                              }}
                              className="px-2.5 py-0.5 rounded-full bg-[#E8F1E5] hover:bg-[#d8e7d4] text-[#176B45] border border-[#37A86B]/30 text-[11px] font-bold shadow-2xs cursor-pointer transition-all"
                            >
                              {crop}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Right: Tagline card & Weather / Mandi rate widget */}
                  <div className="w-full xl:w-72 shrink-0 space-y-2">
                    
                    {/* Top Callout Box */}
                    <div 
                      onClick={() => handleNavClick('buyers')}
                      className="p-2.5 rounded-lg bg-white border border-[#E5E0D5] shadow-2xs hover:border-[#176B45]/50 transition-all cursor-pointer flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#E8F1E5] text-[#176B45] flex items-center justify-center shrink-0">
                          <Sprout className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-[#17251D] leading-tight">
                            {t.banner.calloutTitle}
                          </div>
                          <div className="text-[10px] text-[#657468] font-medium">
                            {t.banner.calloutSub}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#657468] shrink-0" />
                    </div>

                    {/* Bottom Weather & Mandi Rate Combined Card */}
                    <div className="p-2.5 rounded-lg bg-white border border-[#E5E0D5] shadow-2xs grid grid-cols-2 gap-2 divide-x divide-[#E5E0D5]">
                      
                      {/* Weather Info */}
                      <div className="space-y-0.5 pr-1">
                        <div className="text-[10px] font-bold text-[#17251D] flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#176B45]" />
                          <span>Agra, UP</span>
                        </div>
                        <div className="text-[9px] text-[#657468]">{t.banner.weatherLabel}</div>
                        <div className="flex items-center gap-1">
                          <span className="text-base">☀️</span>
                          <span className="text-sm font-black text-[#17251D]">28°C</span>
                        </div>
                        <div className="text-[9px] text-[#657468] font-medium">{t.banner.clearSky}</div>
                      </div>

                      {/* Mandi Rate Info */}
                      <div 
                        onClick={() => handleNavClick('mandi_prices')}
                        className="space-y-0.5 pl-2 cursor-pointer hover:bg-[#F7F4E9]/80 rounded-lg transition-colors"
                      >
                        <div className="text-[9px] font-bold text-[#657468]">{t.banner.mandiLabel}</div>
                        <div className="text-xs font-black text-[#E6A52E]">{t.crops.potato}</div>
                        <div className="text-xs font-black text-[#17251D]">
                          ₹2,000 <span className="text-[9px] text-[#657468] font-normal">{t.banner.perQuintal}</span>
                        </div>
                        <div className="text-[9px] font-bold text-[#37A86B] flex items-center gap-0.5">
                          <span>↑ {t.banner.trendUp}</span>
                          <ChevronRight className="h-2.5 w-2.5" />
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 2. RECTANGULAR STRUCTURED PANEL: ALL 7 ACTION CARDS */}
              {/* Row 1: 4 Main Action Cards */}
              {/* Row 2: 3 Secondary Action Cards */}
              {/* ------------------------------------------------------------- */}
              <div className="rounded-xl bg-white border border-[#E5E0D5] p-4 sm:p-5 shadow-xs space-y-3 sm:space-y-3.5">
                
                {/* ROW 1: 4 MAIN ACTION CARDS (Sell Produce, Find Buyers, My Offers, My Deals) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">

                  {/* CARD 1: SELL MY PRODUCE */}
                  <div
                    onClick={() => {
                      setWizardStep(1);
                      setShowAddWizard(true);
                    }}
                    className="group rounded-xl p-3.5 sm:p-4 bg-gradient-to-br from-[#E8F1E5]/70 via-[#E8F1E5]/30 to-white border border-[#A3D1A5] hover:border-[#176B45] shadow-2xs hover:shadow-xs transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[136px] sm:min-h-[140px] xl:min-h-[144px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-[#176B45] text-white flex items-center justify-center shadow-xs shrink-0">
                          <Sprout className="h-4.5 w-4.5" />
                        </div>
                        {t.actions.sellProduce.badge && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#37A86B]/15 text-[#104B35] border border-[#37A86B]/30 uppercase tracking-wide">
                            {t.actions.sellProduce.badge}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#176B45]/70 group-hover:text-[#176B45] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-end justify-between gap-2.5 mt-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm sm:text-[15px] font-black text-[#17251D] tracking-tight leading-snug">
                          {t.actions.sellProduce.title}
                        </h3>
                        <p className="text-xs text-[#657468] leading-relaxed mt-1">
                          {t.actions.sellProduce.desc}
                        </p>
                      </div>
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-lg overflow-hidden border border-[#A3D1A5] shadow-2xs bg-white shrink-0 mb-0.5">
                        <img 
                          src="/dashboard/combined_crops.jpg" 
                          alt="Sell Produce" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: FIND BUYERS */}
                  <div
                    onClick={() => handleNavClick('buyers')}
                    className="group rounded-xl p-3.5 sm:p-4 bg-gradient-to-br from-blue-50/70 via-sky-50/30 to-white border border-blue-200 hover:border-blue-400 shadow-2xs hover:shadow-xs transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[136px] sm:min-h-[140px] xl:min-h-[144px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Users className="h-4.5 w-4.5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-blue-700/60 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-end justify-between gap-2.5 mt-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm sm:text-[15px] font-black text-[#17251D] tracking-tight leading-snug">
                          {t.actions.findBuyers.title}
                        </h3>
                        <p className="text-xs text-[#657468] leading-relaxed mt-1">
                          {t.actions.findBuyers.desc}
                        </p>
                      </div>
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-lg overflow-hidden border border-blue-200/90 shadow-2xs bg-white shrink-0 mb-0.5">
                        <img 
                          src="/dashboard/tractor.jpg" 
                          alt="Find Buyers" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: MY OFFERS */}
                  <div
                    onClick={() => handleNavClick('offers')}
                    className="group rounded-xl p-3.5 sm:p-4 bg-gradient-to-br from-amber-50/80 via-yellow-50/30 to-white border border-amber-200 hover:border-[#E6A52E] shadow-2xs hover:shadow-xs transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[136px] sm:min-h-[140px] xl:min-h-[144px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-[#E6A52E] text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                          ₹
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white uppercase tracking-wide">
                          {t.actions.myOffers.badge}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-amber-700/60 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-end justify-between gap-2.5 mt-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm sm:text-[15px] font-black text-[#17251D] tracking-tight leading-snug">
                          {t.actions.myOffers.title}
                        </h3>
                        <p className="text-xs text-[#657468] leading-relaxed mt-1">
                          {t.actions.myOffers.desc}
                        </p>
                      </div>
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-lg overflow-hidden border border-amber-200/90 shadow-2xs bg-white shrink-0 mb-0.5">
                        <img 
                          src="/dashboard/grain_sack.jpg" 
                          alt="My Offers" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARD 4: MY DEALS */}
                  <div
                    onClick={() => handleNavClick('orders')}
                    className="group rounded-xl p-3.5 sm:p-4 bg-gradient-to-br from-purple-50/70 via-violet-50/30 to-white border border-purple-200 hover:border-purple-400 shadow-2xs hover:shadow-xs transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[136px] sm:min-h-[140px] xl:min-h-[144px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Package className="h-4.5 w-4.5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-purple-700/60 group-hover:text-purple-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-end justify-between gap-2.5 mt-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm sm:text-[15px] font-black text-[#17251D] tracking-tight leading-snug">
                          {t.actions.myDeals.title}
                        </h3>
                        <p className="text-xs text-[#657468] leading-relaxed mt-1">
                          {t.actions.myDeals.desc}
                        </p>
                      </div>
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-lg overflow-hidden border border-purple-200/90 shadow-2xs bg-white shrink-0 mb-0.5">
                        <img 
                          src="/dashboard/delivery_truck.jpg" 
                          alt="My Deals" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* ROW 2: 3 SECONDARY ACTION CARDS (Cold Storage, Farmer Pooling, Govt Mandi Prices) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">

                  {/* CARD 5: COLD STORAGE */}
                  <div
                    onClick={() => handleNavClick('storage')}
                    className="group rounded-xl p-3.5 sm:p-4 bg-gradient-to-br from-teal-50/70 via-cyan-50/30 to-white border border-teal-200 hover:border-teal-400 shadow-2xs hover:shadow-xs transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[136px] sm:min-h-[140px] xl:min-h-[144px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Warehouse className="h-4.5 w-4.5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-teal-700/60 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-end justify-between gap-2.5 mt-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm sm:text-[15px] font-black text-[#17251D] tracking-tight leading-snug">
                          {t.actions.coldStorage.title}
                        </h3>
                        <p className="text-xs text-[#657468] leading-relaxed mt-1">
                          {t.actions.coldStorage.desc}
                        </p>
                      </div>
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-lg overflow-hidden border border-teal-200/90 shadow-2xs bg-white shrink-0 mb-0.5">
                        <img 
                          src="/dashboard/cold_storage.jpg" 
                          alt="Cold Storage" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARD 6: POOL WITH OTHER FARMERS */}
                  <div
                    onClick={() => handleNavClick('pool')}
                    className="group rounded-xl p-3.5 sm:p-4 bg-gradient-to-br from-rose-50/70 via-pink-50/30 to-white border border-rose-200 hover:border-rose-400 shadow-2xs hover:shadow-xs transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[136px] sm:min-h-[140px] xl:min-h-[144px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Users className="h-4.5 w-4.5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-rose-700/60 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-end justify-between gap-2.5 mt-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm sm:text-[15px] font-black text-[#17251D] tracking-tight leading-snug">
                          {t.actions.poolFarmers.title}
                        </h3>
                        <p className="text-xs text-[#657468] leading-relaxed mt-1">
                          {t.actions.poolFarmers.desc}
                        </p>
                      </div>
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-lg overflow-hidden border border-rose-200/90 shadow-2xs bg-white shrink-0 mb-0.5">
                        <img 
                          src="/dashboard/farmers_pool.jpg" 
                          alt="Farmer Pooling" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARD 7: GOVT MANDI PRICES */}
                  <div
                    onClick={() => handleNavClick('mandi_prices')}
                    className="group rounded-xl p-3.5 sm:p-4 bg-gradient-to-br from-[#E8F1E5]/70 via-[#E8F1E5]/30 to-white border border-[#A3D1A5] hover:border-[#176B45] shadow-2xs hover:shadow-xs transition-all transform hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between min-h-[136px] sm:min-h-[140px] xl:min-h-[144px] sm:col-span-2 lg:col-span-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-[#104B35] text-white flex items-center justify-center shadow-xs shrink-0">
                          <Landmark className="h-4.5 w-4.5" />
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-[#104B35] border border-[#37A86B]/40 text-[#37A86B] text-[10px] font-bold flex items-center gap-1.5 shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#37A86B] animate-pulse" />
                          <span>{t.actions.govtMandi.badge}</span>
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#176B45]/70 group-hover:text-[#176B45] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-end justify-between gap-2.5 mt-2.5">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm sm:text-[15px] font-black text-[#17251D] tracking-tight leading-snug">
                          {t.actions.govtMandi.title}
                        </h3>
                        <p className="text-xs text-[#657468] leading-relaxed mt-1">
                          {t.actions.govtMandi.desc}
                        </p>
                      </div>
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-lg overflow-hidden border border-[#A3D1A5] shadow-2xs bg-white shrink-0 mb-0.5">
                        <img 
                          src="/dashboard/mandi_market.jpg" 
                          alt="Govt Mandi" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* ------------------------------------------------------------- */}
              {/* 3. PERFORMANCE STATISTICS STRIP (High-Value Deep Green #104B35) */}
              {/* ------------------------------------------------------------- */}
              <div className="rounded-xl bg-[#104B35] text-white p-3.5 sm:p-4 shadow-sm border border-[#176B45]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  
                  {/* Metric 1: Total Volume */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/10 border border-white/10 hover:border-[#37A86B]/40 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-[#176B45] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sprout className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-[#E8F1E5]/90 font-medium">{t.metrics.totalVolumeTitle}</div>
                      <div className="text-lg sm:text-xl font-black text-white leading-tight">200 Qtl</div>
                      <div className="text-[10px] text-[#37A86B] font-bold flex items-center gap-1.5 mt-0.5">
                        <span className="text-[#E8F1E5]/80">{t.metrics.activeCrops}</span>
                        <span className="text-[9px] bg-[#37A86B] text-slate-950 font-black px-1.5 py-0.2 rounded-full">{t.metrics.volumeTrend}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric 2: Interested Buyers */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/10 border border-white/10 hover:border-blue-400/40 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-blue-200/90 font-medium">{t.metrics.interestedBuyersTitle}</div>
                      <div className="text-lg sm:text-xl font-black text-white leading-tight">7</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-blue-200/80">{t.metrics.inLast7Days}</span>
                        <div className="flex items-center -space-x-1.5">
                          <span className="h-4 w-4 rounded-full bg-[#E6A52E] border border-[#104B35] text-[8px] font-black flex items-center justify-center text-slate-900">AS</span>
                          <span className="h-4 w-4 rounded-full bg-[#37A86B] border border-[#104B35] text-[8px] font-black flex items-center justify-center text-slate-900">RK</span>
                          <span className="h-4 w-4 rounded-full bg-blue-400 border border-[#104B35] text-[8px] font-black flex items-center justify-center text-slate-900">VK</span>
                          <span className="h-3.5 px-1 rounded-full bg-blue-500/80 text-white text-[7px] font-black flex items-center justify-center ml-0.5">
                            +4
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metric 3: Confirmed Deals */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/10 border border-white/10 hover:border-[#E6A52E]/40 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-[#E6A52E] text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                      🤝
                    </div>
                    <div>
                      <div className="text-[11px] text-amber-200/90 font-medium">{t.metrics.confirmedDealsTitle}</div>
                      <div className="text-lg sm:text-xl font-black text-white leading-tight">2</div>
                      <div className="text-[10px] text-amber-200/80 font-bold flex items-center gap-1.5 mt-0.5">
                        <span>{t.metrics.dealsVolume}</span>
                        <span className="text-[9px] bg-[#37A86B] text-slate-950 font-black px-1.5 py-0.2 rounded-full">{t.metrics.dealsTrend}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric 4: Projected Revenue */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/10 border border-white/10 hover:border-[#37A86B]/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#176B45] text-white flex items-center justify-center shrink-0 shadow-xs font-black text-sm">
                        ₹
                      </div>
                      <div>
                        <div className="text-[11px] text-[#E8F1E5]/90 font-medium">{t.metrics.projectedRevenueTitle}</div>
                        <div className="text-lg sm:text-xl font-black text-white leading-tight">₹4,00,000</div>
                        <div className="text-[10px] text-[#37A86B] font-medium mt-0.5">
                          {t.metrics.estimatedValue}
                        </div>
                      </div>
                    </div>

                    {/* Mini Blue Bar Chart Graphic */}
                    <div className="flex items-end gap-1 h-6 shrink-0 pl-2 pr-1">
                      <span className="w-1.5 h-2 bg-blue-500/50 rounded-xs" />
                      <span className="w-1.5 h-3.5 bg-blue-400/70 rounded-xs" />
                      <span className="w-1.5 h-4.5 bg-blue-400 rounded-xs" />
                      <span className="w-1.5 h-6 bg-blue-300 rounded-xs shadow-xs" />
                    </div>
                  </div>

                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 4. THREE LOWER CONTENT CARDS (Recent Crops, Offers, Info) */}
              {/* ------------------------------------------------------------- */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* COLUMN 1: RECENT CROP LISTINGS */}
                <div className="bg-white rounded-xl border border-[#E5E0D5] p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-2.5 mb-2.5">
                      <h3 className="text-sm font-black text-[#17251D]">
                        {t.recentListings.title}
                      </h3>
                      <button
                        onClick={() => handleNavClick('listings')}
                        className="text-xs font-bold text-[#176B45] hover:text-[#104B35] cursor-pointer"
                      >
                        {t.recentListings.viewAll}
                      </button>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 pb-2.5">
                      {[
                        { id: 'all', label: t.recentListings.tabAll },
                        { id: 'active', label: t.recentListings.tabActive },
                        { id: 'draft', label: t.recentListings.tabDraft },
                        { id: 'sold', label: t.recentListings.tabSold }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setListingFilterTab(tab.id as any)}
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                            listingFilterTab === tab.id
                              ? 'bg-[#176B45] text-white'
                              : 'bg-[#E8F1E5] text-[#176B45] hover:bg-[#d8e7d4]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Crop Rows */}
                    <div className="space-y-2.5">
                      {/* Row 1: Potato */}
                      <div className="p-2.5 rounded-lg border border-[#E5E0D5] flex items-center justify-between gap-2 hover:border-[#176B45]/50 transition-colors bg-[#F7F4E9]/40">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg overflow-hidden border border-[#E5E0D5] shrink-0">
                            <img src="/dashboard/potatoes.jpg" alt="Potato" className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#17251D]">{t.crops.potato}</div>
                            <div className="text-[10px] text-[#657468]">Kufri Jyoti • Grade A</div>
                            <div className="text-[9px] text-[#657468]/80">📍 Agra, UP</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-[#17251D]">50 Qtl (5 Tons)</div>
                          <div className="text-[10px] text-[#176B45] font-bold">₹2,000 / Qtl</div>
                          <span className="px-1.5 py-0.2 rounded-md bg-[#E8F1E5] text-[#176B45] text-[8px] font-black uppercase">
                            {t.recentListings.activeBadge}
                          </span>
                        </div>

                        <button
                          onClick={() => handleNavClick('listings')}
                          className="px-2 py-1 rounded-md bg-white border border-[#E5E0D5] text-[11px] font-bold text-[#17251D] hover:bg-[#F7F4E9] cursor-pointer"
                        >
                          {t.recentListings.manage}
                        </button>
                      </div>

                      {/* Row 2: Tomato */}
                      <div className="p-2.5 rounded-lg border border-[#E5E0D5] flex items-center justify-between gap-2 hover:border-[#176B45]/50 transition-colors bg-[#F7F4E9]/40">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg overflow-hidden border border-[#E5E0D5] shrink-0">
                            <img src="/dashboard/tomatoes.jpg" alt="Tomato" className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-[#17251D]">{t.crops.tomato}</div>
                            <div className="text-[10px] text-[#657468]">Hybrid • Grade A</div>
                            <div className="text-[9px] text-[#657468]/80">📍 Agra, UP</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-[#17251D]">30 Qtl (3 Tons)</div>
                          <div className="text-[10px] text-[#176B45] font-bold">₹1,200 / Qtl</div>
                          <span className="px-1.5 py-0.2 rounded-md bg-[#E8F1E5] text-[#176B45] text-[8px] font-black uppercase">
                            {t.recentListings.activeBadge}
                          </span>
                        </div>

                        <button
                          onClick={() => handleNavClick('listings')}
                          className="px-2 py-1 rounded-md bg-white border border-[#E5E0D5] text-[11px] font-bold text-[#17251D] hover:bg-[#F7F4E9] cursor-pointer"
                        >
                          {t.recentListings.manage}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#E5E0D5] mt-2.5">
                    <button
                      onClick={() => {
                        setWizardStep(1);
                        setShowAddWizard(true);
                      }}
                      className="w-full py-2 rounded-lg bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t.recentListings.addNewCrop}</span>
                    </button>
                  </div>
                </div>

                {/* COLUMN 2: LATEST BUYER OFFERS */}
                <div className="bg-white rounded-xl border border-[#E5E0D5] p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-2.5 mb-2.5">
                      <h3 className="text-sm font-black text-[#17251D] flex items-center gap-1">
                        <span>✨</span>
                        <span>{t.recentOffers.title}</span>
                      </h3>
                      <button
                        onClick={() => handleNavClick('offers')}
                        className="text-xs font-bold text-[#176B45] hover:text-[#104B35] cursor-pointer"
                      >
                        {t.recentOffers.viewAll}
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {/* Offer 1: FreshBites Foods */}
                      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-lg overflow-hidden border border-amber-200 shrink-0">
                              <img src="/dashboard/potatoes.jpg" alt="Buyer" className="h-full w-full object-cover" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-[#17251D] flex items-center gap-1">
                                <span>FreshBites Foods Pvt Ltd</span>
                                <span className="text-blue-600">✓</span>
                              </div>
                              <div className="text-[10px] text-[#657468]">
                                📍 Agra, UP • {t.crops.potato} • 50 Qtl
                              </div>
                              <div className="text-[9px] text-[#657468]/80">15 Oct 2026</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black uppercase">
                            {t.recentOffers.newBadge}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                          <div>
                            <div className="text-xs font-black text-[#176B45]">₹1,800 / Qtl</div>
                            <div className="text-[10px] text-[#657468]">(₹18/kg)</div>
                          </div>
                          <button
                            onClick={() => handleNavClick('offers')}
                            className="px-3 py-1 rounded-md bg-[#176B45] hover:bg-[#104B35] text-white font-black text-xs shadow-2xs cursor-pointer"
                          >
                            {t.recentOffers.reviewReply}
                          </button>
                        </div>
                      </div>

                      {/* Offer 2: AgriHub Traders */}
                      <div className="p-3 rounded-lg border border-[#E5E0D5] bg-[#F7F4E9]/40 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-lg overflow-hidden border border-[#E5E0D5] shrink-0">
                              <img src="/dashboard/tomatoes.jpg" alt="Buyer" className="h-full w-full object-cover" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-[#17251D] flex items-center gap-1">
                                <span>AgriHub Traders</span>
                                <span className="text-blue-600">✓</span>
                              </div>
                              <div className="text-[10px] text-[#657468]">
                                📍 Delhi • {t.crops.tomato} • 30 Qtl
                              </div>
                              <div className="text-[9px] text-[#657468]/80">14 Oct 2026</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#E5E0D5]">
                          <div>
                            <div className="text-xs font-black text-[#176B45]">₹1,150 / Qtl</div>
                            <div className="text-[10px] text-[#657468]">(₹11.5/kg)</div>
                          </div>
                          <button
                            onClick={() => handleNavClick('offers')}
                            className="px-3 py-1 rounded-md bg-[#176B45] hover:bg-[#104B35] text-white font-black text-xs shadow-2xs cursor-pointer"
                          >
                            {t.recentOffers.reviewReply}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#E5E0D5] mt-2.5">
                    <button
                      onClick={() => handleNavClick('buyers')}
                      className="w-full py-2 rounded-lg bg-[#E8F1E5] hover:bg-[#d8e7d4] text-[#176B45] border border-[#37A86B]/30 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>{t.recentOffers.findMoreBuyers}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* COLUMN 3: TODAY'S KEY MARKET INSIGHTS */}
                <div className="bg-white rounded-xl border border-[#E5E0D5] p-4 shadow-xs space-y-2.5">
                  <div className="border-b border-[#E5E0D5] pb-2">
                    <h3 className="text-sm font-black text-[#17251D] flex items-center gap-1.5">
                      <span>💡</span>
                      <span>{t.marketInsights.title}</span>
                    </h3>
                  </div>

                  {/* Weather Info Widget */}
                  <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">☀️</span>
                        <div>
                          <div className="text-xs font-black text-[#17251D]">Agra, Uttar Pradesh</div>
                          <div className="text-[10px] text-[#657468]">{t.banner.clearSky}</div>
                        </div>
                      </div>
                      <div className="text-base font-black text-[#17251D]">28°C</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60 text-[10px] text-[#657468]">
                      <div className="flex items-center gap-1">
                        <Droplets className="h-3 w-3 text-blue-500" />
                        <span>{t.marketInsights.humidity}: <strong>52%</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CloudRain className="h-3 w-3 text-cyan-500" />
                        <span>{t.marketInsights.rainChance}: <strong>5%</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Mandi Rates Widget */}
                  <div className="p-2.5 rounded-lg bg-[#E8F1E5]/60 border border-[#A3D1A5] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-[#17251D]">
                        {t.marketInsights.mandiTitle}
                      </div>
                      <span className="text-[9px] font-black text-[#104B35] bg-[#37A86B]/20 border border-[#37A86B]/30 px-2 py-0.5 rounded-full">
                        Agmarknet
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <div>
                        <div className="text-[10px] text-[#657468]">{t.marketInsights.modalPrice}</div>
                        <div className="text-sm font-black text-[#176B45]">₹2,000 / Qtl</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#37A86B] font-bold flex items-center gap-0.5">
                          {t.marketInsights.sinceYesterday}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Advice Callout */}
                  <div className="p-2.5 rounded-lg bg-[#104B35] text-white border border-[#176B45] space-y-1 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-[#37A86B] font-bold text-xs">
                      <span>🤖</span>
                      <span>{t.marketInsights.aiTitle}</span>
                    </div>
                    <p className="text-[11px] text-[#E8F1E5]/90 leading-relaxed">
                      {t.marketInsights.aiAdvice}
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MY CROPS / LISTINGS */}
          {/* ========================================================================= */}
          {activeTab === 'listings' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.listings.title}</h2>
                  <p className="text-xs text-[#657468]">{t.tabs.listings.subtitle}</p>
                </div>
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setShowAddWizard(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t.tabs.listings.addNewBtn}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map((l) => (
                  <div key={l.id} className="bg-white rounded-xl border border-[#E5E0D5] p-4.5 shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl overflow-hidden bg-[#FAF6ED] border border-[#E5E0D5]">
                          <img src="/dashboard/combined_crops.jpg" alt="Crop" className="h-full w-full object-cover" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-[#17251D]">{l.cropName}</h4>
                          <span className="text-xs text-[#657468]">{l.variety || 'Grade A'}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E8F1E5] text-[#104B35] text-[10px] font-black uppercase">
                        {t.recentListings.activeBadge}
                      </span>
                    </div>

                    <div className="bg-[#FAF6ED] p-2.5 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#657468]">{t.tabs.listings.colAvailableQty}:</span>
                        <span className="font-bold text-[#17251D]">{Number(l.totalQuantityTons ?? l.quantityTons ?? 0) * 10} Qtl</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#657468]">{t.tabs.listings.colExpectedPrice}:</span>
                        <span className="font-bold text-[#176B45]">₹{l.expectedPricePerKg}/kg (₹{Number(l.expectedPricePerKg) * 100}/Qtl)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#657468]">{t.tabs.listings.colLocation}:</span>
                        <span className="font-medium text-[#17251D]">📍 {l.farmerLocation || 'Agra, UP'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleNavClick('buyers')}
                        className="flex-1 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
                      >
                        {t.actions.findBuyers.title}
                      </button>
                      <button
                        onClick={() => handleNavClick('mandi_prices')}
                        className="px-3 py-2 rounded-xl bg-[#E8F1E5] hover:bg-[#d8e7d5] text-[#104B35] font-bold text-xs cursor-pointer transition-colors"
                      >
                        {t.actions.govtMandi.title}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: GOVERNMENT MANDI PRICES */}
          {/* ========================================================================= */}
          {activeTab === 'mandi_prices' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <div className="bg-white p-4 rounded-xl border border-[#E5E0D5] flex items-center justify-between shadow-xs">
                <div>
                  <h2 className="text-lg font-black text-[#17251D]">{t.tabs.listings.title}</h2>
                  <p className="text-xs text-[#657468]">Agmarknet & data.gov.in official feed</p>
                </div>
                <button
                  onClick={() => handleNavClick('home')}
                  className="text-xs font-bold text-[#176B45] hover:underline"
                >
                  ← {t.nav.home}
                </button>
              </div>
              <MandiPricesView
                user={user}
                lang={lang === 'hi' ? 'hi' : 'en'}
                farmerListings={listings}
                onFindBuyersForCrop={() => handleNavClick('buyers')}
                onListCrop={() => {
                  setWizardStep(1);
                  setShowAddWizard(true);
                }}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: FIND BUYERS */}
          {/* ========================================================================= */}
          {activeTab === 'buyers' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.buyers.title}</h2>
                  <p className="text-xs text-[#657468]">{t.tabs.buyers.subtitle}</p>
                </div>
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setShowAddWizard(true);
                  }}
                  className="px-4 py-2 bg-[#176B45] hover:bg-[#104B35] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  {t.tabs.listings.addNewBtn}
                </button>
              </div>

              {/* Verified Buyer Opportunity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'FreshBites Foods Pvt Ltd', crop: `${t.crops.potato} (Grade A)`, qty: '100 Qtl', rate: '₹18 - ₹20/kg', loc: 'Agra Ind Area (15 km)', badge: 'Verified Buyer' },
                  { name: 'ITC Agro Processing', crop: `${t.crops.potato} Kufri Jyoti`, qty: '500 Qtl', rate: '₹19.50/kg', loc: 'Mathura Hub (35 km)', badge: 'Bulk Processor' },
                  { name: 'APMC Agra Mandi Association', crop: `${t.crops.mustard} & ${t.crops.potato}`, qty: 'Open Lot', rate: 'Market Spot Rate', loc: 'Agra Mandi (12 km)', badge: 'Govt APMC' },
                  { name: 'Apex Retail Marts Ltd', crop: `${t.crops.tomato}`, qty: '20 Qtl', rate: '₹22/kg', loc: 'Noida Central DC', badge: 'Retail Chain' }
                ].map((b, idx) => (
                  <div key={idx} className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-[#E8F1E5] text-[#104B35] text-[10px] font-black uppercase">
                          {b.badge}
                        </span>
                        <h4 className="text-base font-black text-[#17251D] mt-1">{b.name}</h4>
                        <div className="text-xs text-[#657468]">📍 {b.loc}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#657468]">{t.tabs.buyers.offeringRate}</div>
                        <div className="text-sm font-black text-[#176B45]">{b.rate}</div>
                      </div>
                    </div>

                    <div className="bg-[#FAF6ED] p-2.5 rounded-xl text-xs flex justify-between">
                      <span className="text-[#657468]">{t.tabs.buyers.lookingFor}: <strong className="text-[#17251D]">{b.crop}</strong></span>
                      <span className="text-[#657468]">{t.tabs.buyers.demandQty}: <strong className="text-[#17251D]">{b.qty}</strong></span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleNavClick('offers')}
                        className="flex-1 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs text-center cursor-pointer transition-colors"
                      >
                        {t.tabs.buyers.sendProposal}
                      </button>
                      <button
                        onClick={() => alert(`1800-KISAN: ${b.name}`)}
                        className="px-3 py-2 rounded-xl border border-[#E5E0D5] text-[#17251D] font-bold text-xs cursor-pointer hover:bg-slate-50"
                      >
                        📞
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: MY OFFERS */}
          {/* ========================================================================= */}
          {activeTab === 'offers' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] flex items-center justify-between shadow-xs">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.offers.title}</h2>
                  <p className="text-xs text-[#657468]">{t.tabs.offers.subtitle}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                  {t.actions.myOffers.badge}
                </span>
              </div>

              <div className="space-y-3">
                {offers.map((off) => (
                  <div key={off.id} className="bg-white p-4.5 rounded-xl border-2 border-amber-200/80 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#FAF6ED] pb-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                          {t.tabs.offers.pendingReview}
                        </span>
                        <h4 className="text-base font-black text-[#17251D] mt-1">{off.buyerName}</h4>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-[#657468]">{t.tabs.offers.offeredRate}:</div>
                        <div className="text-lg font-black text-[#176B45]">₹{off.buyerOfferedPricePerKg}/kg (₹{Number(off.buyerOfferedPricePerKg) * 100}/Qtl)</div>
                      </div>
                    </div>

                    <p className="text-xs text-[#657468] bg-[#FAF6ED] p-2.5 rounded-xl italic">
                      "{off.message || 'Payment released within 48h after digital quality inspection.'}"
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => {
                          alert(lang === 'hi' ? 'सौदा स्वीकार किया गया!' : lang === 'hinglish' ? 'Sauda accept ho gaya!' : 'Deal accepted!');
                          handleNavClick('orders');
                        }}
                        className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
                      >
                        ✓ {t.tabs.offers.acceptOffer}
                      </button>
                      <button
                        onClick={() => alert(lang === 'hi' ? 'काउंटर ऑफर भेजा गया' : 'Counter-offer sent')}
                        className="px-4 py-2 rounded-xl bg-white border border-[#E5E0D5] text-[#17251D] font-bold text-xs cursor-pointer hover:bg-slate-50"
                      >
                        {t.tabs.offers.counterOffer}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: MY DEALS / ORDERS */}
          {/* ========================================================================= */}
          {activeTab === 'orders' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs">
                <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.orders.title}</h2>
                <p className="text-xs text-[#657468]">{t.tabs.orders.subtitle}</p>
              </div>

              <div className="text-center py-12 bg-white rounded-xl border border-[#E5E0D5] p-6 space-y-3 shadow-xs">
                <div className="text-4xl">📦</div>
                <h3 className="text-base font-bold text-[#17251D]">
                  {lang === 'hi' ? 'अभी कोई सक्रिय ऑर्डर ट्रांजिट में नहीं है' : lang === 'hinglish' ? 'Abhi koi active order transit me nahi hai' : 'No active orders in transit currently'}
                </h3>
                <p className="text-xs text-[#657468] max-w-sm mx-auto">
                  {lang === 'hi' 
                    ? 'जब खरीदार आपका ऑफर स्वीकार करेगा या आप ऑफर मंजूर करेंगे, तो यहाँ आपका पक्का सौदा और गाड़ी ट्रैकिंग दिखेगी।'
                    : lang === 'hinglish'
                      ? 'Jab buyer offer accept karega to yahan aapka pakka sauda aur gadi tracking dikhegi.'
                      : 'When a buyer confirms your bid or you accept an offer, your confirmed order and dispatch tracking will display here.'}
                </p>
                <button
                  onClick={() => handleNavClick('buyers')}
                  className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  {t.actions.findBuyers.title}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: COLD STORAGE */}
          {/* ========================================================================= */}
          {activeTab === 'storage' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] flex items-center justify-between shadow-xs">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.storage.title}</h2>
                  <p className="text-xs text-[#657468]">{t.tabs.storage.subtitle}</p>
                </div>
                <button
                  onClick={() => handleNavClick('home')}
                  className="text-xs font-bold text-[#176B45] hover:underline"
                >
                  ← {t.nav.home}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'Agra Imperial Cold Logistics', loc: 'Khandauli Road, Agra', capacity: '12,000 Bags Available', rate: '₹140 / bag (Full Season)', rating: '4.8 ★' },
                  { name: 'Mata Vaishno Cold Storage', loc: 'Etmadpur, Agra', capacity: '5,000 Bags Available', rate: '₹135 / bag (Full Season)', rating: '4.6 ★' }
                ].map((s, idx) => (
                  <div key={idx} className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl overflow-hidden bg-cyan-50 border border-[#E5E0D5]">
                        <img src="/dashboard/cold_storage.jpg" alt="Storage" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-[#17251D]">{s.name}</h4>
                        <div className="text-xs text-[#657468]">📍 {s.loc} • {s.rating}</div>
                      </div>
                    </div>
                    <div className="bg-[#FAF6ED] p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#657468]">{t.tabs.storage.availableCapacity}:</span>
                        <span className="font-bold text-[#176B45]">{s.capacity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#657468]">{t.tabs.storage.ratePerMonth}:</span>
                        <span className="font-bold text-[#17251D]">{s.rate}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => alert(`Connecting call to ${s.name}...`)}
                      className="w-full py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
                    >
                      {t.tabs.storage.bookSpace}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 8: FARMER POOLING */}
          {/* ========================================================================= */}
          {activeTab === 'pool' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs">
                <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.pool.title}</h2>
                <p className="text-xs text-[#657468]">{t.tabs.pool.subtitle}</p>
              </div>

              <div className="bg-gradient-to-br from-[#FFFDF9] to-[#FAF6ED] border border-[#E5E0D5] p-5 rounded-xl space-y-3.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl overflow-hidden shadow-xs border border-[#E5E0D5]">
                      <img src="/dashboard/farmers_pool.jpg" alt="Farmers Pool" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        Active Pool • Khandauli Cluster
                      </span>
                      <h4 className="text-base font-black text-[#17251D] mt-1">Vikram Singh (Agra Krishi Collective)</h4>
                      <p className="text-xs text-[#657468]">{t.crops.potato} (60T Bulk Contract) • 42T Committed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#657468]">{t.tabs.buyers.offeringRate}</div>
                    <div className="text-base font-black text-[#176B45]">₹20.50 / kg</div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-[#17251D] mb-1">
                    <span>42 Tons (70%)</span>
                    <span className="text-[#657468]">Target: 60 Tons</span>
                  </div>
                  <div className="w-full bg-[#E5E0D5]/50 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[#176B45] h-full rounded-full" style={{ width: '70%' }} />
                  </div>
                </div>

                <button
                  onClick={() => alert('Request sent to pool coordinator.')}
                  className="w-full py-2.5 rounded-xl bg-[#E6A52E] hover:bg-[#d09223] text-[#17251D] font-black text-xs shadow-xs cursor-pointer transition-colors"
                >
                  {t.tabs.pool.contributeCrop}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 9: PROFILE */}
          {/* ========================================================================= */}
          {activeTab === 'profile' && (
            <div className="space-y-4 max-w-[1920px] mx-auto">
              <FarmerProfileView 
                onNavigateTab={(tab) => {
                  if (tab === 'dashboard' || tab === 'home') handleNavClick('home');
                  else if (tab === 'listings') handleNavClick('listings');
                  else if (tab === 'buyers') handleNavClick('buyers');
                  else if (tab === 'offers') handleNavClick('offers');
                  else if (tab === 'orders') handleNavClick('orders');
                  else if (onNavigate) onNavigate('/' + tab);
                }} 
              />
            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 STEP-BY-STEP ADD PRODUCE WIZARD MODAL */}
      {/* ========================================================================= */}
      {showAddWizard && (
        <div className="fixed inset-0 z-50 bg-[#17251D]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto border border-[#E5E0D5] animate-fadeIn">
            
            <div className="flex items-center justify-between border-b border-[#FAF6ED] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#104B35] bg-[#E8F1E5] px-2.5 py-0.5 rounded-full">
                  Step {wizardStep} / 3
                </span>
                <h3 className="text-base sm:text-lg font-black text-[#17251D] mt-1">
                  {t.wizard.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddWizard(false);
                  setWizardStep(1);
                }}
                className="h-8 w-8 rounded-full bg-[#FAF6ED] text-[#657468] hover:bg-[#E8F1E5] flex items-center justify-center font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* STEP 1: Select Crop */}
            {wizardStep === 1 && (
              <div className="space-y-3.5">
                <div className="text-center space-y-0.5">
                  <h4 className="text-base font-black text-[#17251D]">{t.wizard.step1Title}</h4>
                  <p className="text-xs text-[#657468]">{t.wizard.cropSelect}:</p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'Potato', name: t.crops.potato, icon: '🥔' },
                    { id: 'Tomato', name: t.crops.tomato, icon: '🍅' },
                    { id: 'Mustard', name: t.crops.mustard, icon: '🌾' },
                    { id: 'Wheat', name: t.crops.wheat, icon: '🌾' }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setWizardForm({ ...wizardForm, cropName: c.id })}
                      className={`p-3.5 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        wizardForm.cropName === c.id
                          ? 'bg-[#E8F1E5] border-[#176B45] ring-2 ring-[#176B45]/20'
                          : 'bg-white border-[#E5E0D5] hover:border-[#37A86B]'
                      }`}
                    >
                      <span className="text-2xl">{c.icon}</span>
                      <span className="text-xs font-black text-[#17251D]">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Quantity & Location */}
            {wizardStep === 2 && (
              <div className="space-y-3.5">
                <div className="text-center space-y-0.5">
                  <h4 className="text-base font-black text-[#17251D]">{t.wizard.step2Title}</h4>
                </div>

                <div className="bg-[#FAF6ED] p-3.5 rounded-xl space-y-3 border border-[#E5E0D5]">
                  <div>
                    <label className="text-xs font-bold text-[#17251D] block mb-1">{t.wizard.quantity}:</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={wizardForm.quantityValue}
                        onChange={(e) => setWizardForm({ ...wizardForm, quantityValue: Number(e.target.value) })}
                        className="flex-1 px-3 py-2 rounded-xl border border-[#E5E0D5] text-base font-black text-center bg-white text-[#17251D]"
                      />
                      <select
                        value={wizardForm.quantityUnit}
                        onChange={(e) => setWizardForm({ ...wizardForm, quantityUnit: e.target.value as any })}
                        className="px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold bg-white text-[#17251D]"
                      >
                        <option value="quintal">Quintal (Qtl)</option>
                        <option value="ton">Tonne (Ton)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-xs font-bold text-[#17251D] block mb-1">Village:</label>
                      <input
                        type="text"
                        value={wizardForm.village}
                        onChange={(e) => setWizardForm({ ...wizardForm, village: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-[#E5E0D5] text-xs font-bold bg-white text-[#17251D]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#17251D] block mb-1">District:</label>
                      <input
                        type="text"
                        value={wizardForm.district}
                        onChange={(e) => setWizardForm({ ...wizardForm, district: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl border border-[#E5E0D5] text-xs font-bold bg-white text-[#17251D]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Price */}
            {wizardStep === 3 && (
              <div className="space-y-3.5">
                <div className="text-center space-y-0.5">
                  <h4 className="text-base font-black text-[#17251D]">{t.wizard.step3Title}</h4>
                </div>

                <div className="bg-[#FAF6ED] p-4 rounded-xl text-center space-y-2 border border-[#E5E0D5]">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-black text-[#17251D]">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      value={wizardForm.expectedPricePerKg}
                      onChange={(e) => setWizardForm({ ...wizardForm, expectedPricePerKg: Number(e.target.value) })}
                      className="w-28 px-3 py-1.5 rounded-xl border-2 border-[#176B45] text-xl font-black text-[#176B45] text-center bg-white"
                    />
                    <span className="text-sm font-bold text-[#657468]">/ kg</span>
                  </div>
                  <div className="text-xs text-[#657468]">
                    ₹{wizardForm.expectedPricePerKg * 100} / Quintal
                  </div>
                </div>

                {wizardSuccessMessage && (
                  <div className="p-2.5 bg-[#176B45] text-white rounded-xl text-xs font-bold text-center">
                    ✓ {wizardSuccessMessage}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Footer */}
            <div className="pt-3 border-t border-[#FAF6ED] flex items-center justify-between">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="px-4 py-2 rounded-xl bg-[#FAF6ED] hover:bg-[#E8F1E5] text-[#17251D] font-bold text-xs cursor-pointer transition-colors"
                >
                  ← {lang === 'hi' ? 'पीछे' : lang === 'hinglish' ? 'Peechhe' : 'Back'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddWizard(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAF6ED] hover:bg-slate-200 text-[#657468] font-bold text-xs cursor-pointer transition-colors"
                >
                  {t.wizard.cancel}
                </button>
              )}

              {wizardStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep + 1)}
                  className="px-5 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-black text-xs cursor-pointer transition-colors"
                >
                  {t.wizard.next} →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleWizardSubmit}
                  className="px-6 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-black text-xs shadow-xs cursor-pointer transition-colors"
                >
                  {t.wizard.submit} 🚀
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎤 VOICE ASSISTANT DEMO MODAL */}
      {/* ========================================================================= */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-[#17251D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 text-center space-y-3.5 shadow-2xl border border-[#E5E0D5] animate-fadeIn">
            <div className="h-14 w-14 rounded-full bg-[#E8F1E5] text-[#176B45] flex items-center justify-center mx-auto text-2xl animate-bounce">
              🎤
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase bg-[#E8F1E5] text-[#104B35] px-2.5 py-0.5 rounded-full">
                {t.voice.title}
              </span>
              <h3 className="text-base font-black text-[#17251D] mt-2">
                {t.voice.listening}
              </h3>
              <p className="text-xs text-[#657468] mt-1 leading-relaxed">
                {t.voice.trySaying}
              </p>
            </div>
            <button
              onClick={() => setShowVoiceModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
            >
              {t.voice.close}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
