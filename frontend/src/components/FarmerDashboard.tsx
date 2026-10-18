import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { FarmerListing, RequirementMatch, Order, Offer, Crop, BuyerRequirement, FarmActivity } from '../types';
import { 
  Sprout, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Warehouse, 
  Layers, 
  DollarSign, 
  HelpCircle, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown, 
  FileCheck, 
  AlertCircle,
  Calendar, 
  MapPin, 
  Scale, 
  Sparkles, 
  ArrowRight, 
  Info,
  PhoneCall,
  Mic,
  User,
  Search,
  Package,
  ShieldCheck,
  Home,
  Truck,
  Building2,
  Coins,
  X,
  Check,
  Activity,
  FileText,
  Droplets,
  Tractor,
  FlaskConical,
  ShieldAlert,
  Handshake,
  Landmark,
  Bell,
  LogOut,
  MoreVertical
} from 'lucide-react';
import { VoiceListenButton } from './VoiceListenButton';
import { VoiceSearchInput } from './VoiceSearchInput';
import { FarmTraceabilityModal } from './FarmTraceabilityModal';
import { FieldActivityLoggerModal } from './FieldActivityLoggerModal';
import { MandiPricesView } from './MandiPricesView';
import { FarmerProfileView } from './FarmerProfileView';

type Lang = 'hi' | 'hinglish' | 'en';

interface FarmerDashboardProps {
  currentRole?: string;
  onNavigate?: (path: string) => void;
  onOpenNotifications?: () => void;
}

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({ currentRole, onNavigate, onOpenNotifications }) => {
  const { user, logout, unreadCount } = useAuth();
  const { language, setLanguage: setGlobalLang } = useLanguage();

  // Language System: synchronized with global language, allows 'hinglish' locally
  const [lang, setLang] = useState<Lang>(() => {
    return language === 'hi' ? 'hi' : 'en';
  });

  useEffect(() => {
    setLang(language === 'hi' ? 'hi' : 'en');
  }, [language]);

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('kc_farmer_lang', newLang);
    if (newLang === 'hi' || newLang === 'en') {
      setGlobalLang(newLang);
    }
  };

  // Farmer Navigation Tabs: 'home' | 'listings' | 'mandi_prices' | 'buyers' | 'offers' | 'orders' | 'storage' | 'profile' | 'aggregator_info' | 'activities'
  const [activeTab, setActiveTab] = useState<'home' | 'listings' | 'mandi_prices' | 'buyers' | 'offers' | 'orders' | 'storage' | 'profile' | 'aggregator_info' | 'activities'>('home');
  const [profileSubTab, setProfileSubTab] = useState<'overview' | 'passport' | 'fields' | 'crops' | 'sales' | 'points'>('overview');

  // Backend Data
  const [listings, setListings] = useState<FarmerListing[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerFilter, setOfferFilter] = useState<'ALL' | 'RECEIVED' | 'SENT' | 'NEGOTIATING' | 'DEALS'>('ALL');
  const [storageFacilities, setStorageFacilities] = useState<any[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [selectedListingForTraceability, setSelectedListingForTraceability] = useState<FarmerListing | null>(null);
  const [showTraceabilityModal, setShowTraceabilityModal] = useState(false);
  const [showActivityLoggerModal, setShowActivityLoggerModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listingSearchQuery, setListingSearchQuery] = useState('');
  const [cropSubTab, setCropSubTab] = useState<'active' | 'dealed'>('active');

  // Selected Listing for Buyer Matches
  const [selectedListingForMatches, setSelectedListingForMatches] = useState<FarmerListing | null>(null);
  const [matchedBuyers, setMatchedBuyers] = useState<RequirementMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Separation of Active Listings vs Dealed / Sold Crops
  const isListingDealed = (l: FarmerListing) => {
    const total = Number(l.totalQuantityTons ?? l.quantityTons ?? 0);
    const confirmed = Number(l.confirmedQuantityTons ?? 0);
    const avail = Number(l.availableQuantityTons ?? (total - confirmed));
    const hasOrder = orders.some(o => (o.listingId === l.id || (o as any).listing_id === l.id) && o.status !== 'CANCELLED');
    return l.status === 'SOLD' || l.status === 'FULFILLED' || (confirmed > 0 && avail <= 0) || (hasOrder && avail <= 0);
  };

  const activeListings = useMemo(() => {
    return listings.filter(l => !isListingDealed(l));
  }, [listings, orders]);

  const dealedListings = useMemo(() => {
    return listings.filter(l => isListingDealed(l));
  }, [listings, orders]);

  // Match score explanation modal
  const [selectedMatchExplanation, setSelectedMatchExplanation] = useState<RequirementMatch | null>(null);

  // Find Buyers Filter & Interactive View states
  const [buyerFilterCrop, setBuyerFilterCrop] = useState<string>('All');
  const [buyerFilterVariety, setBuyerFilterVariety] = useState<string>('All');
  const [buyerFilterGrade, setBuyerFilterGrade] = useState<string>('All');
  const [buyerFilterDistance, setBuyerFilterDistance] = useState<number | null>(50);
  const [buyerFilterType, setBuyerFilterType] = useState<'all' | 'local' | 'bulk' | 'aggregator'>('all');
  const [buyerSortBy, setBuyerSortBy] = useState<'best_match' | 'nearest' | 'price' | 'date'>('best_match');
  const [buyerViewMode, setBuyerViewMode] = useState<'list' | 'map'>('list');
  const [mapSelectedMatch, setMapSelectedMatch] = useState<RequirementMatch | null>(null);

  // AI Buyer Guide state
  const [aiRecommendation, setAiRecommendation] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Storage decision calculator state
  const [scenarioParams, setScenarioParams] = useState({
    currentOfferPrice: 18.0,
    expectedFuturePrice: 22.5,
    months: 3,
    storageChargePerKgPerMonth: 0.45,
    handlingPerKg: 0.35
  });
  const [scenarioResult, setScenarioResult] = useState<any>(null);

  // Voice Assistant Demo Modal
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Profile Dropdown state
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------------------------------------------
  // STEP-BY-STEP ADD PRODUCE WIZARD STATE
  // -------------------------------------------------------------
  const [showAddWizard, setShowAddWizard] = useState(false);
  const hasTriggeredSellAction = useRef(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardSuccessMessage, setWizardSuccessMessage] = useState<string | null>(null);
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState(false);

  const initialListingState = {
    cropName: 'Potato',
    customCropName: '',
    variety: 'Kufri Jyoti',
    quantityValue: 50,
    quantityUnit: 'quintal' as 'quintal' | 'ton',
    harvestTiming: 'ready_now' as 'ready_now' | '1_week' | '15_days' | '1_month' | 'custom_date',
    availableDate: new Date().toISOString().split('T')[0],
    qualityGrade: 'Grade A', // 'Grade A' (अच्छी), 'Grade B' (सामान्य), 'Grade C' (कम)
    village: 'Khandauli',
    tehsil: 'Etmadpur',
    district: 'Agra',
    expectedPricePerKg: 20,
    sizeMinMm: 45,
    sizeMaxMm: 75,
    moisturePercent: 18,
    defectsPercent: 2.0,
    storageRequirement: 'NONE' as 'NONE' | 'COLD_STORAGE' | 'DRY_VENTILATED'
  };

  const [wizardForm, setWizardForm] = useState(initialListingState);

  // Common visual crop cards
  const standardCrops = [
    { id: 'Potato', nameHi: 'आलू', nameEn: 'Potato', icon: '🥔', defaultVariety: 'Kufri Jyoti' },
    { id: 'Onion', nameHi: 'प्याज', nameEn: 'Onion', icon: '🧅', defaultVariety: 'Nashik Red' },
    { id: 'Tomato', nameHi: 'टमाटर', nameEn: 'Tomato', icon: '🍅', defaultVariety: 'Himsona' },
    { id: 'Wheat', nameHi: 'गेहूं', nameEn: 'Wheat', icon: '🌾', defaultVariety: 'Sharbati' },
    { id: 'Maize', nameHi: 'मक्का', nameEn: 'Maize', icon: '🌽', defaultVariety: 'Yellow Corn' },
    { id: 'Mango', nameHi: 'आम', nameEn: 'Mango', icon: '🥭', defaultVariety: 'Dasheri' },
  ];

  // Fetch farmer data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, cropRes, ordRes, offRes, storageRes, actRes] = await Promise.all([
        api.getListings({ farmerId: user?.id || '' }),
        api.getCrops(),
        api.getOrders(),
        api.getOffers(),
        api.getStorageFacilities().catch(() => []),
        api.getActivities({ farmerId: user?.id || '' }).catch(() => [])
      ]);
      setListings(listRes);
      setCrops(cropRes);
      setOrders(ordRes);
      setOffers(offRes);
      setStorageFacilities(storageRes);
      setActivities(actRes || []);

      if (listRes.length > 0) {
        setSelectedListingForMatches(prev => {
          if (prev) {
            const foundStill = listRes.find(l => l.id === prev.id);
            if (foundStill) return foundStill;
          }
          const activeOnly = listRes.filter(l => {
            const total = Number(l.totalQuantityTons ?? l.quantityTons ?? 0);
            const confirmed = Number(l.confirmedQuantityTons ?? 0);
            const avail = Number(l.availableQuantityTons ?? (total - confirmed));
            return l.status !== 'SOLD' && l.status !== 'FULFILLED' && (avail > 0);
          });
          const initial = activeOnly.length > 0 ? activeOnly[0] : listRes[0];
          handleViewMatches(initial);
          return initial;
        });
      } else {
        // Fallback: If no listings yet, load market buyer requirements so "Find Buyers" is never blank
        loadGeneralRequirements();
      }
    } catch (err) {
      console.error('Error fetching farmer data:', err);
      loadGeneralRequirements();
    } finally {
      setLoading(false);
    }
  };

  const loadGeneralRequirements = async (listing?: FarmerListing) => {
    try {
      const allReqs = await api.getRequirements();
      if (allReqs && allReqs.length > 0) {
        const farmerQty = listing ? Number(listing.quantityTons || 8) : 8;
        const matches: RequirementMatch[] = allReqs.map((req: any, idx: number) => {
          const reqQty = Number(req.quantityTons || (req.requiredQuantityKg ? req.requiredQuantityKg / 1000 : 15));
          const isBulk = (req.buyerType === 'bulk' || reqQty >= 20);
          const minLotTons = req.minimumDirectFarmerLotKg !== undefined ? (req.minimumDirectFarmerLotKg / 1000) : (isBulk ? 20 : 0.25);
          const isDirect = !isBulk || farmerQty >= minLotTons;
          const score = listing && listing.cropName.toLowerCase() === (req.cropName || '').toLowerCase() ? 92 : Math.max(65, 85 - (idx % 4) * 5);
          const price = Number(req.offeredPricePerKg || 22);

          return {
            requirement: {
              ...req,
              cropId: req.cropId || `crop-${req.cropName || 'potato'}`,
              unit: req.unit || 'TON',
              requiredDate: req.requiredDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
              buyerType: isBulk ? 'bulk' : 'local',
              requiredQuantityKg: req.requiredQuantityKg ? Number(req.requiredQuantityKg) : reqQty * 1000,
              minimumDirectFarmerLotKg: minLotTons * 1000,
              aggregationAllowed: req.aggregationAllowed !== false,
              deliveryType: req.deliveryType === 'DELIVERY_TO_BUYER' || req.deliveryType === 'DIRECT_FARM' ? req.deliveryType : 'PICKUP_REQUIRED'
            },
            matchScore: score,
            isViable: true,
            distanceKm: req.distanceKm ?? (8 + (idx * 4)),
            eligibility: {
              eligible: isDirect,
              routeType: isDirect ? (isBulk ? 'direct_bulk' : 'direct_local') : 'aggregator_pooled',
              reason: isDirect ? 'Direct procurement eligible' : 'Quantity suitable for aggregation pool',
              minLotKg: minLotTons * 1000,
              farmerQuantityKg: farmerQty * 1000,
              aggregationAllowed: req.aggregationAllowed !== false
            },
            visibleToFarmer: true,
            breakdown: [],
            reasons: [],
            netRealization: {
              buyerPrice: price,
              transportCostPerKg: 0.8,
              loadingCostPerKg: 0.2,
              storageCostPerKg: 0,
              platformFeePerKg: 0.25,
              totalDeductions: 1.25,
              estimatedNetRealization: price - 1.25,
              isEstimate: true,
              disclaimer: 'Estimated net realization'
            }
          };
        });
        setMatchedBuyers(matches);
        return;
      }
    } catch (e) {
      console.error('Error fetching general requirements:', e);
    }

    // Default verified market buyers if API returns empty
    const defaultBuyers: RequirementMatch[] = [
      {
        requirement: {
          id: 'req-freshbites-demo',
          cropId: 'crop-potato',
          buyerId: 'buyer-freshbites',
          buyerName: 'Vikram Malhotra',
          buyerCompany: 'FreshBites Foods Pvt Ltd',
          cropName: 'Potato',
          variety: 'Chipsona-1 / Kufri Frysona',
          gradeRequired: 'Processing Grade A',
          unit: 'TON',
          requiredDate: '2026-10-28',
          quantityTons: 25,
          offeredPricePerKg: 24.50,
          deliveryType: 'PICKUP_REQUIRED',
          location: 'Industrial Area Phase 2, Gorakhpur',
          buyerType: 'bulk',
          minimumDirectFarmerLotKg: 20000,
          aggregationAllowed: true,
          status: 'OPEN'
        },
        matchScore: 94,
        isViable: true,
        distanceKm: 14,
        eligibility: {
          eligible: false,
          routeType: 'aggregator_pooled',
          reason: 'Lot size below bulk direct threshold, pooled through aggregator',
          minLotKg: 20000,
          farmerQuantityKg: 8000,
          aggregationAllowed: true
        },
        visibleToFarmer: true,
        breakdown: [],
        reasons: ['Bulk processing buyer requirement'],
        netRealization: {
          buyerPrice: 24.50,
          transportCostPerKg: 0.8,
          loadingCostPerKg: 0.2,
          storageCostPerKg: 0,
          platformFeePerKg: 0.25,
          totalDeductions: 1.25,
          estimatedNetRealization: 23.25,
          isEstimate: true,
          disclaimer: 'Estimated net realization'
        }
      },
      {
        requirement: {
          id: 'req-itc-demo',
          cropId: 'crop-wheat',
          buyerId: 'buyer-itc',
          buyerName: 'Amit Saxena',
          buyerCompany: 'ITC Agro Processing Hub',
          cropName: 'Wheat',
          variety: 'Sharbati / Lokwan',
          gradeRequired: 'Milling Grade A',
          unit: 'TON',
          requiredDate: '2026-10-30',
          quantityTons: 15,
          offeredPricePerKg: 27.80,
          deliveryType: 'DELIVERY_TO_BUYER',
          location: 'Agro Industrial Park, Barabanki',
          buyerType: 'bulk',
          minimumDirectFarmerLotKg: 10000,
          aggregationAllowed: true,
          status: 'OPEN'
        },
        matchScore: 89,
        isViable: true,
        distanceKm: 22,
        eligibility: {
          eligible: true,
          routeType: 'direct_bulk',
          reason: 'Direct delivery accepted',
          minLotKg: 10000,
          farmerQuantityKg: 10000,
          aggregationAllowed: true
        },
        visibleToFarmer: true,
        breakdown: [],
        reasons: ['Direct mill procurement'],
        netRealization: {
          buyerPrice: 27.80,
          transportCostPerKg: 1.0,
          loadingCostPerKg: 0.25,
          storageCostPerKg: 0,
          platformFeePerKg: 0.25,
          totalDeductions: 1.5,
          estimatedNetRealization: 26.30,
          isEstimate: true,
          disclaimer: 'Estimated net realization'
        }
      },
      {
        requirement: {
          id: 'req-mandi-demo',
          cropId: 'crop-potato',
          buyerId: 'buyer-mandi',
          buyerName: 'Radheshyam Gupta (Aadhati)',
          buyerCompany: 'Gupta Agri Traders (Mandi Yard)',
          cropName: 'Potato',
          variety: 'Pukhraj / Jyoti',
          gradeRequired: 'Grade B+',
          unit: 'TON',
          requiredDate: '2026-10-25',
          quantityTons: 5,
          offeredPricePerKg: 21.00,
          deliveryType: 'PICKUP_REQUIRED',
          location: 'Main APMC Mandi, Deoria',
          buyerType: 'local',
          minimumDirectFarmerLotKg: 500,
          aggregationAllowed: true,
          status: 'OPEN'
        },
        matchScore: 96,
        isViable: true,
        distanceKm: 6,
        eligibility: {
          eligible: true,
          routeType: 'direct_local',
          reason: 'Local trader pickup from farm gate',
          minLotKg: 500,
          farmerQuantityKg: 5000,
          aggregationAllowed: true
        },
        visibleToFarmer: true,
        breakdown: [],
        reasons: ['Local mandi trader'],
        netRealization: {
          buyerPrice: 21.00,
          transportCostPerKg: 0.5,
          loadingCostPerKg: 0.15,
          storageCostPerKg: 0,
          platformFeePerKg: 0.25,
          totalDeductions: 0.9,
          estimatedNetRealization: 20.10,
          isEstimate: true,
          disclaimer: 'Estimated net realization'
        }
      },
      {
        requirement: {
          id: 'req-apex-demo',
          cropId: 'crop-mustard',
          buyerId: 'buyer-apex',
          buyerName: 'Sunil Verma',
          buyerCompany: 'Apex Wholesale Agri Trade',
          cropName: 'Mustard',
          variety: 'Black Mustard (Rai)',
          gradeRequired: 'Oil Grade Premium',
          unit: 'TON',
          requiredDate: '2026-11-02',
          quantityTons: 8,
          offeredPricePerKg: 56.50,
          deliveryType: 'DELIVERY_TO_BUYER',
          location: 'Transport Nagar, Kanpur',
          buyerType: 'local',
          minimumDirectFarmerLotKg: 1000,
          aggregationAllowed: true,
          status: 'OPEN'
        },
        matchScore: 86,
        isViable: true,
        distanceKm: 31,
        eligibility: {
          eligible: true,
          routeType: 'direct_local',
          reason: 'Direct wholesale delivery',
          minLotKg: 1000,
          farmerQuantityKg: 8000,
          aggregationAllowed: true
        },
        visibleToFarmer: true,
        breakdown: [],
        reasons: ['Oil mill buyer'],
        netRealization: {
          buyerPrice: 56.50,
          transportCostPerKg: 1.2,
          loadingCostPerKg: 0.25,
          storageCostPerKg: 0,
          platformFeePerKg: 0.25,
          totalDeductions: 1.7,
          estimatedNetRealization: 54.80,
          isEstimate: true,
          disclaimer: 'Estimated net realization'
        }
      }
    ];

    setMatchedBuyers(defaultBuyers);
  };

  const handleCloseWizard = () => {
    setShowAddWizard(false);
    setWizardStep(1);
    setWizardSuccessMessage(null);
    if (window.location.pathname === '/list-crop' || window.location.search.includes('action=sell')) {
      if (onNavigate) {
        onNavigate('/dashboard');
      } else {
        window.history.replaceState({}, '', '/dashboard');
      }
    }
  };

  const handleNavigateTab = (tabId: typeof activeTab) => {
    setShowAddWizard(false);
    setActiveTab(tabId);
    if (window.location.pathname === '/list-crop') {
      if (onNavigate) {
        onNavigate('/dashboard');
      } else {
        window.history.replaceState({}, '', '/dashboard');
      }
    }
  };

  useEffect(() => {
    fetchData();
    runStorageCalculation();
  }, [user?.id]);

  // Check URL parameters and pathname ONCE on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const subParam = urlParams.get('subtab');
    const currentPath = window.location.pathname;

    if (['/profile', '/passport', '/fields', '/crops', '/sales', '/kisan-points'].includes(currentPath)) {
      const sub = currentPath === '/passport' ? 'passport' : currentPath === '/fields' ? 'fields' : currentPath === '/crops' ? 'crops' : currentPath === '/sales' ? 'sales' : currentPath === '/kisan-points' ? 'points' : 'overview';
      if (onNavigate) onNavigate(`/profile?subtab=${sub}`);
      else window.location.href = `/profile?subtab=${sub}`;
      return;
    }

    if (['profile', 'passport', 'activities', 'fields', 'crops', 'sales', 'points'].includes(tabParam || '')) {
      const sub = subParam || (tabParam === 'activities' || tabParam === 'passport' ? 'passport' : tabParam === 'points' ? 'points' : tabParam === 'profile' ? 'overview' : tabParam);
      if (onNavigate) onNavigate(`/profile?subtab=${sub}`);
      else window.location.href = `/profile?subtab=${sub}`;
      return;
    }

    if (currentPath === '/buyers') {
      setActiveTab('buyers');
    } else if (currentPath === '/listings') {
      setActiveTab('listings');
    } else if (currentPath === '/offers') {
      setActiveTab('offers');
    } else if (currentPath === '/orders' || currentPath === '/deals') {
      setActiveTab('orders');
    } else if (tabParam && ['home', 'listings', 'mandi_prices', 'buyers', 'offers', 'orders', 'storage', 'aggregator_info'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }

    // Trigger wizard only ONCE on mount if route is /list-crop or action=sell
    if (!hasTriggeredSellAction.current && (currentPath === '/list-crop' || urlParams.get('action') === 'sell')) {
      hasTriggeredSellAction.current = true;
      setWizardStep(1);
      setShowAddWizard(true);
    }
  }, [onNavigate]);

  // Separate tab navigation event listener
  useEffect(() => {
    const handleTabNav = (e: any) => {
      if (e.detail?.tab === 'profile' || ['fields', 'crops', 'sales', 'points', 'passport', 'activities'].includes(e.detail?.tab)) {
        const sub = e.detail?.subTab || (e.detail?.tab === 'activities' ? 'passport' : e.detail?.tab === 'points' ? 'points' : e.detail?.tab === 'profile' ? 'overview' : e.detail?.tab);
        const url = `/profile?subtab=${sub}${e.detail?.edit ? '&edit=1' : ''}`;
        if (onNavigate) {
          onNavigate(url);
        } else {
          window.location.href = url;
        }
        return;
      } else if (e.detail?.tab) {
        handleNavigateTab(e.detail.tab);
      }

      if (e.detail?.cropName) {
        setBuyerFilterCrop(e.detail.cropName);
        const matchL = activeListings.find(l => l.cropName.toLowerCase() === e.detail.cropName.toLowerCase());
        if (matchL) {
          handleViewMatches(matchL);
        }
      }
      if (e.detail?.filter) {
        if (e.detail.filter === 'nearest') setBuyerSortBy('nearest');
        else if (e.detail.filter === 'price') setBuyerSortBy('price');
        else if (e.detail.filter === 'best_match') setBuyerSortBy('best_match');
      }
      if (e.detail?.openOffer && e.detail?.requirementId) {
        const targetReq = matchedBuyers.find(m => m.requirement?.id === e.detail.requirementId)?.requirement;
        if (targetReq) {
          const activeListing = selectedListingForMatches || activeListings[0] || listings[0];
          setMakeOfferModal({
            isOpen: true,
            requirement: targetReq,
            listing: activeListing,
            quantityTons: activeListing ? Math.min(Number(activeListing.quantityTons), Number(targetReq.quantityTons || 10)) : 5,
            offeredPricePerKg: Number(targetReq.offeredPricePerKg || 20),
            deliveryTerms: 'EX_FARM',
            message: '',
            isSubmitting: false
          });
        }
      }
    };

    window.addEventListener('farmer-navigate-tab', handleTabNav);
    return () => window.removeEventListener('farmer-navigate-tab', handleTabNav);
  }, [matchedBuyers, activeListings, listings, selectedListingForMatches, onNavigate]);

  const handleMarkListingSold = async (listingId: string) => {
    if (!window.confirm(lang === 'hi' ? 'क्या आप इस फसल को "सौदा हो चुका (Dealed / Sold)" के रूप में अलग सेक्शन में ले जाना चाहते हैं?' : 'Move this crop listing to Dealed / Sold section?')) return;
    try {
      await api.updateListingStatus(listingId, 'SOLD');
      await fetchData();
    } catch (err) {
      alert('Error updating status: ' + (err as Error).message);
    }
  };

  const handleReactivateListing = async (listingId: string) => {
    try {
      await api.updateListingStatus(listingId, 'ACTIVE');
      await fetchData();
    } catch (err) {
      alert('Error reactivating listing: ' + (err as Error).message);
    }
  };

  const handleViewMatches = async (listing: FarmerListing) => {
    setSelectedListingForMatches(listing);
    setLoadingMatches(true);
    setAiRecommendation(null);
    setAiError(null);
    try {
      const res = await api.getListingMatches(listing.id);
      if (res && res.matches && res.matches.length > 0) {
        setMatchedBuyers(res.matches);
      } else {
        await loadGeneralRequirements(listing);
      }
    } catch (err) {
      console.error('Error getting matches:', err);
      await loadGeneralRequirements(listing);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleAskAiBuyerGuide = async () => {
    const activeListing = selectedListingForMatches || listings[0];
    if (!activeListing) {
      alert(lang === 'hi' ? 'कृपया पहले अपनी फसल चुनें।' : 'Please select your produce listing first.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.getAiBuyerRecommendation({
        listingId: activeListing.id,
        cropName: activeListing.cropName,
        variety: activeListing.variety,
        quantityTons: activeListing.quantityTons,
        grade: activeListing.grade,
        expectedPricePerKg: activeListing.expectedPricePerKg,
        location: activeListing.farmerLocation || user?.location || 'Kushinagar, UP',
        latitude: activeListing.latitude || user?.latitude || 26.740,
        longitude: activeListing.longitude || user?.longitude || 83.889,
        language: lang === 'en' ? 'en' : 'hi'
      });

      if (res.available === false && res.fallbackMessage && (!res.recommendations || res.recommendations.length === 0)) {
        setAiError(res.fallbackMessage);
      } else {
        setAiError(null);
      }
      setAiRecommendation(res);
    } catch (err: any) {
      console.warn('AI recommendation fetch error, fallback active:', err);
      setAiError(null);
    } finally {
      setAiLoading(false);
    }
  };

  const [makeOfferModal, setMakeOfferModal] = useState<{
    isOpen: boolean;
    requirement: any | null;
    listing: any | null;
    quantityTons: number;
    offeredPricePerKg: number;
    deliveryTerms: string;
    message: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    requirement: null,
    listing: null,
    quantityTons: 5,
    offeredPricePerKg: 20,
    deliveryTerms: 'Farm Gate Pickup',
    message: '',
    isSubmitting: false
  });

  const [counterModal, setCounterModal] = useState<{
    isOpen: boolean;
    offer: any | null;
    counterPricePerKg: number;
    counterQuantityTons: number;
    pickupTerms: string;
    targetDate: string;
    message: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    offer: null,
    counterPricePerKg: 0,
    counterQuantityTons: 0,
    pickupTerms: 'Farm Gate Pickup',
    targetDate: '',
    message: '',
    isSubmitting: false
  });

  const openMakeOfferModal = (buyerReq: any, listing?: any) => {
    const currentList = listing || selectedListingForMatches || listings[0];
    const reqQty = Number(buyerReq.quantityTons || 0);
    const listQty = Number(currentList?.quantityTons || 0);
    const initialQty = (listQty > 0 && reqQty > 0) ? Math.min(listQty, reqQty) : (listQty || reqQty || 5);
    const initialPrice = Number(buyerReq.offeredPricePerKg || currentList?.expectedPricePerKg || 22);

    setMakeOfferModal({
      isOpen: true,
      requirement: buyerReq,
      listing: currentList,
      quantityTons: initialQty,
      offeredPricePerKg: initialPrice,
      deliveryTerms: buyerReq.deliveryType === 'PICKUP_REQUIRED' ? 'Farm Gate Pickup' : 'Mandi Delivery',
      message: 'हमारी उपज उच्च गुणवत्ता की है और हम तुरंत डिलीवरी के लिए तैयार हैं।',
      isSubmitting: false
    });
  };

  const handleSendOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!makeOfferModal.requirement) return;
    setMakeOfferModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.createOffer({
        requirementId: makeOfferModal.requirement.id,
        listingId: makeOfferModal.listing?.id,
        buyerId: makeOfferModal.requirement.buyerId,
        buyerName: makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName,
        sellerId: user?.id,
        sellerName: user?.name,
        cropName: makeOfferModal.listing?.cropName || makeOfferModal.requirement.cropName,
        variety: makeOfferModal.listing?.variety || makeOfferModal.requirement.variety,
        quantityTons: makeOfferModal.quantityTons,
        offeredPricePerKg: makeOfferModal.offeredPricePerKg,
        deliveryTerms: makeOfferModal.deliveryTerms,
        message: makeOfferModal.message
      });

      alert(lang === 'hi' 
        ? `${makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName} को आपका सौदा प्रस्ताव भेज दिया गया है!` 
        : `Offer sent successfully to ${makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName}!`);
      
      setMakeOfferModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
      setActiveTab('offers');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setMakeOfferModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleJoinAggregatorBatch = (customListing?: any) => {
    const currentList = customListing || selectedListingForMatches || listings[0];
    const aggregatorReq = {
      id: 'req-agg-kushinagar',
      buyerId: 'usr-agg-1',
      buyerCompany: 'विक्रम सिंह (कुशीनगर एग्रीगेटर हब / FPO)',
      buyerName: 'Vikram Singh',
      cropName: currentList?.cropName || 'Potato',
      variety: currentList?.variety || 'Kufri Jyoti',
      quantityTons: 60,
      offeredPricePerKg: 20.50,
      deliveryType: 'PICKUP_REQUIRED',
      location: 'कुशीनगर हब (12 km)',
      isAggregator: true
    };
    openMakeOfferModal(aggregatorReq, currentList);
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterModal.offer) return;
    setCounterModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.counterOffer(counterModal.offer.id, {
        counterPricePerKg: counterModal.counterPricePerKg,
        counterQuantityTons: counterModal.counterQuantityTons,
        pickupTerms: counterModal.pickupTerms,
        deliveryTerms: counterModal.pickupTerms,
        targetDate: counterModal.targetDate,
        message: counterModal.message
      });
      alert(lang === 'hi' ? 'जवाबी प्रस्ताव भेज दिया गया है!' : 'Counter offer sent successfully!');
      setCounterModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCounterModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      await api.acceptOffer(offerId);
      alert(lang === 'hi' 
        ? 'सौदा पक्का हो गया! आपका ऑर्डर दर्ज हो गया है और एस्क्रो भुगतान सुरक्षित है।' 
        : lang === 'hinglish' 
        ? 'Sauda pakka ho gaya! Order confirm ho gaya hai aur payment safe hai.' 
        : 'Offer Accepted! Deal is confirmed and escrow secured.');
      await fetchData();
      setActiveTab('orders');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleRejectOffer = async (offerId: string, reason?: string) => {
    try {
      await api.rejectOffer(offerId, reason);
      alert(lang === 'hi' ? 'प्रस्ताव अस्वीकृत कर दिया गया।' : 'Offer rejected.');
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const runStorageCalculation = async () => {
    try {
      const res = await api.calculateStorageScenario({
        currentOfferPricePerKg: scenarioParams.currentOfferPrice,
        expectedFuturePricePerKg: scenarioParams.expectedFuturePrice,
        storageDurationMonths: scenarioParams.months,
        storageChargePerMonthPerKg: scenarioParams.storageChargePerKgPerMonth
      });
      setScenarioResult(res);
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Step-by-Step Produce Listing
  const handleWizardSubmit = async () => {
    try {
      // Calculate quantity in Tons for backend compatibility
      const quantityInTons = wizardForm.quantityUnit === 'quintal' 
        ? Number((wizardForm.quantityValue / 10).toFixed(2)) 
        : Number(wizardForm.quantityValue);

      // Resolve harvest timing
      let calculatedDate = wizardForm.availableDate;
      const today = new Date();
      if (wizardForm.harvestTiming === 'ready_now') {
        calculatedDate = today.toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '1_week') {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        calculatedDate = d.toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '15_days') {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        calculatedDate = d.toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '1_month') {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        calculatedDate = d.toISOString().split('T')[0];
      }

      const isFuture = wizardForm.harvestTiming !== 'ready_now';
      const actualCropName = wizardForm.cropName === 'Other' && wizardForm.customCropName 
        ? wizardForm.customCropName 
        : wizardForm.cropName;

      const payload = {
        cropName: actualCropName,
        variety: wizardForm.variety || 'Standard',
        quantityTons: quantityInTons > 0 ? quantityInTons : 5,
        listingType: isFuture ? 'FUTURE_HARVEST' : 'AVAILABLE_NOW',
        availableDate: calculatedDate,
        harvestDate: calculatedDate,
        grade: wizardForm.qualityGrade,
        sizeMinMm: wizardForm.sizeMinMm,
        sizeMaxMm: wizardForm.sizeMaxMm,
        moisturePercent: wizardForm.moisturePercent,
        defectsPercent: wizardForm.defectsPercent,
        expectedPricePerKg: Number(wizardForm.expectedPricePerKg),
        storageRequirement: wizardForm.storageRequirement,
        farmerLocation: `${wizardForm.village}, ${wizardForm.tehsil}, ${wizardForm.district}`
      };

      const created = await api.createListing(payload);
      setWizardSuccessMessage(lang === 'hi' 
        ? 'आपका माल बाजार में दिखने लगा है! हम आपको खरीदार के ऑफर दिखाएंगे।' 
        : lang === 'hinglish' 
        ? 'Aapka maal market mein dikhne laga hai! Hum aapko buyer offers dikhayenge.' 
        : 'Your produce is now listed in the market! We will show you matching buyer offers.');
      
      await fetchData();
      
      // Auto-load matches for newly created listing
      if (created && created.id) {
        handleViewMatches(created);
      }

      setTimeout(() => {
        handleCloseWizard();
        handleNavigateTab('buyers');
      }, 1500);

    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Translations dictionary
  const t = {
    greeting: lang === 'hi' ? 'नमस्ते' : lang === 'hinglish' ? 'Namaste' : 'Hello',
    whatToDo: lang === 'hi' ? 'आज आप क्या करना चाहते हैं?' : lang === 'hinglish' ? 'Aaj aap kya karna chahte hain?' : 'What would you like to do today?',
    verifiedFarmer: lang === 'hi' ? 'सत्यापित किसान' : lang === 'hinglish' ? 'Verified Kisan' : 'Verified Farmer',
    sellProduce: lang === 'hi' ? 'मेरा माल बेचें' : lang === 'hinglish' ? 'Mera Maal Bechein' : 'Sell My Produce',
    sellProduceSub: lang === 'hi' ? 'अपनी फसल की जानकारी दें' : lang === 'hinglish' ? 'Apni fasal ki jankari dein' : 'Add details to sell your crop',
    findBuyers: lang === 'hi' ? 'खरीदार देखें' : lang === 'hinglish' ? 'Buyer Dekho' : 'Find Buyers',
    findBuyersSub: lang === 'hi' ? 'कौन आपकी फसल खरीद रहा है?' : lang === 'hinglish' ? 'Kaun aapki fasal kharid raha hai?' : 'Who is buying your crop?',
    myOffers: lang === 'hi' ? 'मेरे ऑफर' : lang === 'hinglish' ? 'Mere Offer' : 'My Offers',
    myOffersSub: lang === 'hi' ? 'कितने रुपये के ऑफर मिले हैं?' : lang === 'hinglish' ? 'Kitne rupaye ke offer mile hain?' : 'Check price offers received',
    myDeals: lang === 'hi' ? 'मेरे सौदे' : lang === 'hinglish' ? 'Mere Saude' : 'My Deals',
    myDealsSub: lang === 'hi' ? 'मेरे चल रहे और पुराने ऑर्डर' : lang === 'hinglish' ? 'Mere chal rahe aur purane order' : 'Ongoing & completed orders',
    storage: lang === 'hi' ? 'भंडारण / कोल्ड स्टोर' : lang === 'hinglish' ? 'Cold Storage' : 'Cold Storage',
    storageSub: lang === 'hi' ? 'फसल सुरक्षित रखने की जगह देखें' : lang === 'hinglish' ? 'Fasal rakhne ki jagah dekhein' : 'Find storage space nearby',
    poolWithFarmers: lang === 'hi' ? 'कई किसान मिलकर बेचें' : lang === 'hinglish' ? 'Kai Kisan Milkar Bechein' : 'Pool with Other Farmers',
    poolWithFarmersSub: lang === 'hi' ? 'कम माल है? आसपास के किसानों के साथ मिलकर 60 टन का बड़ा ऑर्डर बनाएं' : lang === 'hinglish' ? 'Kam maal hai? Doosre kisano ke sath milkar 60 ton ka order banayein' : 'Pool small lots into 60T bulk industrial contracts',
    myCrops: lang === 'hi' ? 'मेरा माल' : lang === 'hinglish' ? 'Mera Maal' : 'My Crops',
    profile: lang === 'hi' ? 'प्रोफाइल' : lang === 'hinglish' ? 'Profile' : 'Profile',
    home: lang === 'hi' ? 'होम' : lang === 'hinglish' ? 'Home' : 'Home'
  };

  const pendingOffersCount = offers.filter(o => 
    (o.direction === 'RECEIVED' && o.status === 'PENDING') || 
    (o.status === 'COUNTERED' && (o.lastActionRole === 'buyer' || o.counterBy === 'buyer'))
  ).length;
  const activeOrdersCount = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;

  // User initials helper
  const getInitials = (name?: string) => {
    if (!name) return 'AS';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // 1. Total Produce Listed (Quintals = Tons * 10)
  const totalProduceTons = activeListings.reduce((sum, l) => {
    const q = Number(l.totalQuantityTons ?? l.quantityTons ?? 0);
    return sum + (isNaN(q) ? 0 : q);
  }, 0);
  const totalProduceQuintals = totalProduceTons > 0 ? (totalProduceTons * 10) : (listings.length > 0 ? listings.reduce((s, l) => s + (Number(l.quantityTons || 0) * 10), 0) : 50);
  const activeProduceCount = activeListings.length > 0 ? activeListings.length : 1;

  // 2. Buyers Interested
  const interestedBuyersCount = offers.length > 0 ? new Set(offers.map(o => o.buyerName || o.buyerId)).size : 3;

  // 3. Confirmed Deals
  const confirmedDeals = orders.filter(o => o.status !== 'CANCELLED');
  const confirmedDealsCount = confirmedDeals.length;
  const soldQuintals = confirmedDeals.reduce((sum, o) => sum + (Number(o.quantityTons || 0) * 10), 0);

  // 4. Potential Earnings (₹)
  const potentialEarningsCalculated = activeListings.reduce((sum, l) => {
    const tons = Number(l.availableQuantityTons ?? l.totalQuantityTons ?? l.quantityTons ?? 0);
    const priceKg = Number(l.expectedPricePerKg ?? 0);
    return sum + (tons * 1000 * priceKg);
  }, 0);
  const potentialEarnings = potentialEarningsCalculated > 0 ? potentialEarningsCalculated : 100000;

  // Recent listing for display
  const recentListing = activeListings[0] || listings[0] || null;

  // Latest buyer offer for display
  const latestOffer = offers[0] || null;

  // Market intelligence suggestions carousel state
  const [suggestionIndex, setSuggestionIndex] = useState<number>(0);
  const suggestions = [
    {
      id: 1,
      image: '/dashboard/potatoes.jpg',
      title: 'आलू का भाव इस सप्ताह स्थिर है।',
      description: 'आगरा मंडी में आलू का औसत भाव ₹1,800 – ₹2,200 / क्विंटल चल रहा है। यदि गुणवत्ता अच्छी है तो अभी बेचने पर अच्छा मूल्य मिल सकता है।',
      actionLabel: 'आज के मंडी भाव देखें →',
      tabTarget: 'mandi_prices'
    },
    {
      id: 2,
      image: '/dashboard/cold_storage.jpg',
      title: 'कोल्ड स्टोरेज में स्थान सीमित',
      description: 'आगरा व आसपास के कोल्ड स्टोर 85% भर चुके हैं। बेहतर ऑफ-सीजन भाव के लिए अभी अपनी फसल का स्थान बुक करें।',
      actionLabel: 'कोल्ड स्टोरेज खोजें →',
      tabTarget: 'storage'
    },
    {
      id: 3,
      image: '/dashboard/farmers_pool.jpg',
      title: 'सामूहिक बिक्री से अधिक मुनाफा',
      description: 'आसपास के किसान मिलकर 60 टन का बड़ा लॉट बना रहे हैं। समूह में बेचने से ट्रांसपोर्ट खर्च 30% तक कम होता है।',
      actionLabel: 'किसानों के साथ जुड़ें →',
      tabTarget: 'aggregator_info'
    }
  ];
  const currentSuggestion = suggestions[suggestionIndex] || suggestions[0];

  const RupeeIcon = ({ className }: { className?: string }) => (
    <span className={`inline-flex items-center justify-center font-black text-sm leading-none ${className}`}>₹</span>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 pb-20 relative z-10 font-sans">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: KisanConnect Brand, Voice, Language, Notifications, Avatar */}
      {/* ========================================================================= */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Brand Logo & Tagline */}
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-600 group-hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs transition-colors">
              <Sprout className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center">
                <span>Kisan</span><span className="text-emerald-700">Connect</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block -mt-0.5">
                From Farm to Market, Made Simple
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Voice Assistance Button: "बोलकर बताएं" */}
            <button
              onClick={() => setShowVoiceModal(true)}
              className="px-3 sm:px-4 py-2 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm border border-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="बोलकर बताएं"
            >
              <Mic className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold">बोलकर बताएं</span>
            </button>

            {/* Language Selector Pill */}
            <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-full border border-slate-200 text-xs font-bold">
              <button
                onClick={() => handleLangChange('hi')}
                className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer ${
                  lang === 'hi' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिंदी
              </button>
              <button
                onClick={() => handleLangChange('hinglish')}
                className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer ${
                  lang === 'hinglish' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hinglish
              </button>
              <button
                onClick={() => handleLangChange('en')}
                className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer ${
                  lang === 'en' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
            </div>

            {/* Notifications Bell */}
            <button
              onClick={() => {
                if (onOpenNotifications) {
                  onOpenNotifications();
                } else {
                  window.dispatchEvent(new CustomEvent('open-notifications'));
                }
              }}
              className="relative p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="सूचनाएं"
            >
              <Bell className="h-5 w-5" />
              {(unreadCount > 0 || pendingOffersCount > 0) && (
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {/* Farmer Profile Avatar Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-emerald-300 transition-all cursor-pointer"
              >
                <div className="h-9 w-9 rounded-full bg-[#1C3829] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(user?.name || 'Aryan Singh')}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500 hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <div className="font-extrabold text-sm text-slate-900">{user?.name || 'Aryan Singh'}</div>
                    <div className="text-xs text-slate-500">{user?.phone || user?.email || 'Khanduali, Agra'}</div>
                    <div className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>प्रमाणित किसान (Verified)</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      if (onNavigate) onNavigate('/profile');
                      else setActiveTab('profile');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    <span>मेरी प्रोफाइल (Farmer Profile)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                  >
                    <LogOut className="h-4 w-4 text-rose-500" />
                    <span>लॉग आउट (Logout)</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. NAVIGATION BAR: 8 Tabs matching the reference screenshot */}
      {/* ========================================================================= */}
      <nav className="w-full bg-white border-b border-slate-200 sticky top-[61px] z-30 shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-2 flex-nowrap">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'listings', label: `My Crops (${activeListings.length || 1})`, icon: Sprout },
              { id: 'mandi_prices', label: 'Mandi Prices', icon: Landmark },
              { id: 'buyers', label: 'Find Buyers', icon: Search },
              { id: 'offers', label: 'My Offers', count: pendingOffersCount || 3, icon: RupeeIcon },
              { id: 'orders', label: 'My Deals', icon: Package },
              { id: 'storage', label: 'Cold Storage', icon: Warehouse },
              { id: 'aggregator_info', label: 'Pool with Other Farmers', icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleNavigateTab(tab.id as any)}
                  className={`flex items-center gap-2 py-2 px-3.5 rounded-full text-xs font-bold transition-all relative shrink-0 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#15803D] text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white ml-0.5">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 3. MAIN DASHBOARD CONTAINER */}
      {/* ========================================================================= */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 space-y-6">
        
        {/* ========================================================================= */}
        {/* 🏠 TAB 1: HOME SCREEN */}
        {/* ========================================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* 3.1 WELCOME BANNER & TODAY'S SUGGESTION GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
              
              {/* LEFT: FARMER WELCOME BANNER */}
              <div className="lg:col-span-7 xl:col-span-8 relative rounded-3xl overflow-hidden shadow-xs border border-emerald-100 bg-[#E8F5E9] p-4 sm:p-6 flex flex-col justify-between min-h-[210px]">
                {/* Scenic Farm Landscape Background */}
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-85 pointer-events-none"
                  style={{ backgroundImage: "url('/dashboard/farm_landscape_banner.jpg')" }}
                />
                {/* Soft gradient wash across left so text remains ultra-legible */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-white/30 pointer-events-none" />

                {/* Banner Content Container */}
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 h-full">
                  
                  {/* Left: Mascot & Farmer Details */}
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="relative shrink-0">
                      <img
                        src="/dashboard/farmer_mascot_new.png"
                        alt="Farmer Mascot"
                        className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover shadow-sm border-2 border-white bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                          नमस्ते, {user?.name || 'Aryan Singh'} जी! 👋
                        </h1>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Verified Farmer</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700 font-medium">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-500" />
                          <span>{user?.location || 'Khanduali, Agra, Uttar Pradesh'}</span>
                        </div>
                        <span className="text-slate-400">•</span>
                        <div className="flex items-center gap-1">
                          <Sprout className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{user?.farmerProfile?.acres || 12} एकड़ खेती</span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 max-w-xl font-medium pt-0.5">
                        KisanConnect के साथ अपनी फसल का सही दाम पाएं और सीधे खरीदारों से जुड़ें।
                      </p>

                      <button
                        onClick={() => {
                          setWizardStep(1);
                          setShowAddWizard(true);
                        }}
                        className="mt-2.5 px-4 sm:px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer w-fit"
                      >
                        <span>मेरी फसल बेचें</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Far-Right Slogan */}
                  <div className="hidden xl:flex flex-col items-end text-right pr-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug max-w-[170px]">
                      अच्छा दाम, सही खरीदार, आपकी मेहनत का सही मूल्य 🍃
                    </p>
                  </div>

                </div>
              </div>

              {/* RIGHT: आज का सुझाव (TODAY'S SUGGESTION) */}
              <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💡</span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">आज का सुझाव</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab(currentSuggestion.tabTarget as any)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>सभी सुझाव देखें</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex items-start gap-3">
                  <img
                    src={currentSuggestion.image}
                    alt="Suggestion Produce"
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                      {currentSuggestion.title}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {currentSuggestion.description}
                    </p>
                  </div>
                </div>

                {/* Action Button & Carousel Controls */}
                <div className="pt-1 space-y-2">
                  <button
                    onClick={() => setActiveTab(currentSuggestion.tabTarget as any)}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>{currentSuggestion.actionLabel}</span>
                  </button>

                  {/* Carousel Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setSuggestionIndex((prev) => (prev === 0 ? suggestions.length - 1 : prev - 1))}
                      className="h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs transition-colors cursor-pointer"
                      title="पिछला सुझाव"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    {/* Dots */}
                    <div className="flex items-center gap-1.5">
                      {suggestions.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSuggestionIndex(idx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            suggestionIndex === idx ? 'w-5 bg-emerald-600' : 'w-2 bg-slate-200 hover:bg-slate-300'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => setSuggestionIndex((prev) => (prev === suggestions.length - 1 ? 0 : prev + 1))}
                      className="h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs transition-colors cursor-pointer"
                      title="अगला सुझाव"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* 3.2 SEVEN PRIMARY ACTION CARDS */}
            <div className="space-y-4">
              
              {/* Row 1: Four Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Card 1: मेरी फसल बेचें / Sell My Produce */}
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setShowAddWizard(true);
                  }}
                  className="p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] hover:border-emerald-500 hover:shadow-md transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden min-h-[145px]"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Sprout className="h-6 w-6" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-emerald-100/60 flex items-center justify-center text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 pr-14">
                    <div className="text-base font-black text-slate-900 leading-tight">मेरी फसल बेचें</div>
                    <div className="text-xs font-bold text-slate-600">Sell My Produce</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      अपनी फसल की जानकारी डालें, मात्रा और भाव बताएं
                    </div>
                  </div>
                  {/* Bottom right potato thumbnail */}
                  <img
                    src="/dashboard/potatoes.jpg"
                    alt="Produce"
                    className="absolute -bottom-2 -right-2 h-16 w-16 object-cover rounded-xl opacity-90 group-hover:scale-105 transition-transform"
                  />
                </button>

                {/* Card 2: खरीदार खोजें / Find Buyers */}
                <button
                  onClick={() => handleNavigateTab('buyers')}
                  className="p-5 rounded-2xl bg-[#F0F9FF] border border-[#BAE6FD] hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden min-h-[145px]"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-11 w-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Search className="h-6 w-6" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-blue-100/60 flex items-center justify-center text-blue-700 group-hover:translate-x-0.5 transition-transform">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 pr-14">
                    <div className="text-base font-black text-slate-900 leading-tight">खरीदार खोजें</div>
                    <div className="text-xs font-bold text-slate-600">Find Buyers</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      स्थानीय, प्रोसेसिंग और बड़े खरीदारों से जुड़ें
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 text-blue-300 opacity-60 text-4xl">
                    👥
                  </div>
                </button>

                {/* Card 3: मेरे ऑफर / My Offers */}
                <button
                  onClick={() => handleNavigateTab('offers')}
                  className="p-5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] hover:border-amber-500 hover:shadow-md transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden min-h-[145px]"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-11 w-11 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-black text-2xl shadow-2xs">
                      ₹
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-black shadow-xs">
                      {pendingOffersCount || 3}
                    </span>
                  </div>
                  <div className="mt-3 pr-14">
                    <div className="text-base font-black text-slate-900 leading-tight">मेरे ऑफर</div>
                    <div className="text-xs font-bold text-slate-600">My Offers</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      आए हुए ऑफर देखें और जवाब दें
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 text-amber-300 opacity-60 text-4xl font-black">
                    ₹
                  </div>
                </button>

                {/* Card 4: मेरे सौदे / My Deals */}
                <button
                  onClick={() => handleNavigateTab('orders')}
                  className="p-5 rounded-2xl bg-[#FAF5FF] border border-[#E9D5FF] hover:border-purple-500 hover:shadow-md transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden min-h-[145px]"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-11 w-11 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-purple-100/60 flex items-center justify-center text-purple-700 group-hover:translate-x-0.5 transition-transform">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 pr-14">
                    <div className="text-base font-black text-slate-900 leading-tight">मेरे सौदे</div>
                    <div className="text-xs font-bold text-slate-600">My Deals</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      पक्के हुए सौदे और डिलीवरी का स्टेटस देखें
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 text-purple-300 opacity-60 text-4xl">
                    🚚
                  </div>
                </button>

              </div>

              {/* Row 2: Three Wider Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Card 5: कोल्ड स्टोरेज / Cold Storage */}
                <button
                  onClick={() => setActiveTab('storage')}
                  className="p-5 rounded-2xl bg-[#F0F9FF] border border-[#BAE6FD] hover:border-cyan-500 hover:shadow-md transition-all text-left flex items-center justify-between group cursor-pointer relative overflow-hidden min-h-[140px]"
                >
                  <div className="space-y-1.5 max-w-[62%] z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                        <Warehouse className="h-5 w-5" />
                      </div>
                      <div className="h-7 w-7 rounded-full bg-cyan-100/60 flex items-center justify-center text-cyan-700 group-hover:translate-x-0.5 transition-transform">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-base font-black text-slate-900 leading-tight">कोल्ड स्टोरेज</div>
                    <div className="text-xs font-bold text-slate-600">Cold Storage</div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      पास के कोल्ड स्टोरेज खोजें और रेट व उपलब्धता देखें
                    </div>
                  </div>
                  <img
                    src="/dashboard/cold_storage.jpg"
                    alt="Cold Storage Facility"
                    className="absolute right-0 bottom-0 top-0 w-36 sm:w-44 object-cover object-left opacity-90 group-hover:scale-105 transition-transform"
                  />
                </button>

                {/* Card 6: अन्य किसानों के साथ मिलकर बेचें / Pool with Other Farmers */}
                <button
                  onClick={() => setActiveTab('aggregator_info')}
                  className="p-5 rounded-2xl bg-[#FFF1F2] border border-[#FECDD3] hover:border-rose-400 hover:shadow-md transition-all text-left flex items-center justify-between group cursor-pointer relative overflow-hidden min-h-[140px]"
                >
                  <div className="space-y-1.5 max-w-[62%] z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div className="h-7 w-7 rounded-full bg-rose-100/60 flex items-center justify-center text-rose-700 group-hover:translate-x-0.5 transition-transform">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-base font-black text-slate-900 leading-tight">अन्य किसानों के साथ मिलकर बेचें</div>
                    <div className="text-xs font-bold text-slate-600">Pool with Other Farmers</div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      कम मात्रा को मिलाकर बड़ी डिमांड पूरी करें
                    </div>
                  </div>
                  <img
                    src="/dashboard/farmers_pool.jpg"
                    alt="Farmers Pool"
                    className="absolute right-0 bottom-0 top-0 w-36 sm:w-44 object-cover object-left opacity-90 group-hover:scale-105 transition-transform"
                  />
                </button>

                {/* Card 7: सरकारी मंडी भाव / Govt Mandi Prices */}
                <button
                  onClick={() => setActiveTab('mandi_prices')}
                  className="p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] hover:border-emerald-500 hover:shadow-md transition-all text-left flex items-center justify-between group cursor-pointer relative overflow-hidden min-h-[140px]"
                >
                  <div className="space-y-1.5 max-w-[62%] z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div className="h-7 w-7 rounded-full bg-emerald-100/60 flex items-center justify-center text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-base font-black text-slate-900 leading-tight">सरकारी मंडी भाव</div>
                    <div className="text-xs font-bold text-slate-600">Govt Mandi Prices</div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      ताजा थोक मंडी भाव देखें (Agmarknet / data.gov.in)
                    </div>
                  </div>
                  <img
                    src="/dashboard/mandi_market.jpg"
                    alt="Mandi Market"
                    className="absolute right-0 bottom-0 top-0 w-36 sm:w-44 object-cover object-left opacity-90 group-hover:scale-105 transition-transform"
                  />
                </button>

              </div>

            </div>

            {/* 3.3 FARMER SUMMARY STATISTICS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                
                {/* Metric 1: Total Produce Listed */}
                <div className="flex items-center gap-3.5 pt-2 lg:pt-0 lg:px-4 first:pt-0 first:px-0">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Sprout className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">कुल सूचीबद्ध मात्रा</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                      {totalProduceQuintals} Qtl
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {activeProduceCount} सक्रिय फसल
                    </div>
                  </div>
                </div>

                {/* Metric 2: Buyers Interested */}
                <div className="flex items-center gap-3.5 pt-2 lg:pt-0 lg:px-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Search className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">रुचि दिखाने वाले खरीदार</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                      {interestedBuyersCount}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      नई रुचि इस महीने
                    </div>
                  </div>
                </div>

                {/* Metric 3: Confirmed Deals */}
                <div className="flex items-center gap-3.5 pt-2 lg:pt-0 lg:px-4">
                  <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <Handshake className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">पक्के हुए सौदे</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                      {confirmedDealsCount}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {soldQuintals} Qtl बेचा गया
                    </div>
                  </div>
                </div>

                {/* Metric 4: Potential Earnings */}
                <div className="flex items-center gap-3.5 pt-2 lg:pt-0 lg:px-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">संभावित कमाई (सक्रिय फसल से)</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">
                      ₹{potentialEarnings.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      अनुमानित मूल्य
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 3.4 TWO-COLUMN SECTION: RECENT LISTINGS & LATEST OFFERS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Left Column: Recent Crop Listings (हाल की फसल सूची) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900">
                    हाल की फसल सूची (Recent Crop Listings)
                  </h3>
                  <button 
                    onClick={() => setActiveTab('listings')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>सभी देखें</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {recentListing ? (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src="/dashboard/potatoes.jpg" 
                        alt="Crop" 
                        className="h-14 w-14 rounded-xl object-cover border border-slate-200 shrink-0" 
                      />
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {recentListing.cropName || 'Potato'}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {recentListing.variety || 'Kufri Jyoti'} • {recentListing.grade || 'Grade A'}
                        </div>
                        <div className="text-xs text-slate-700 font-semibold mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{recentListing.farmerLocation || user?.location || 'Agra, UP'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-black text-slate-900">
                          {(Number(recentListing.quantityTons ?? recentListing.totalQuantityTons ?? 5)) * 10} Qtl
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          ({Number(recentListing.quantityTons ?? recentListing.totalQuantityTons ?? 5)} Tons)
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="text-sm font-black text-emerald-700">
                          ₹{((Number(recentListing.expectedPricePerKg || 20)) * 100).toLocaleString('en-IN')}/Qtl
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          (₹{recentListing.expectedPricePerKg || 20}/kg)
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                        Active
                      </span>

                      <button
                        onClick={() => setActiveTab('listings')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                    कोई फसल नहीं मिली। 
                    <button
                      onClick={() => { setWizardStep(1); setShowAddWizard(true); }}
                      className="ml-2 font-bold text-emerald-700 underline"
                    >
                      नई फसल जोड़ें
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Latest Buyer Offers (नए खरीदारों के ऑफर) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h3 className="text-base font-extrabold text-slate-900">
                      नए खरीदारों के ऑफर (Latest Buyer Offers)
                    </h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('offers')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>सभी देखें</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img 
                        src="/dashboard/potatoes.jpg" 
                        alt="Offer Produce" 
                        className="h-14 w-14 rounded-xl object-cover border border-amber-200" 
                      />
                      <span className="absolute -top-2 -left-2 bg-amber-400 text-amber-950 font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-xs">
                        नया ऑफर
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-sm">
                        <span>{latestOffer?.buyerName || 'FreshBites Foods Pvt Ltd'}</span>
                        <CheckCircle2 className="h-4 w-4 text-blue-600 fill-blue-100" />
                      </div>
                      <div className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>{latestOffer?.buyerLocation || 'Agra, UP'}</span>
                        <span>•</span>
                        <span>{latestOffer?.cropName || 'Potato'}</span>
                        <span>•</span>
                        <span>{((latestOffer?.quantityTons || 5)) * 10} Qtl</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {latestOffer?.createdAt ? new Date(latestOffer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '15 Oct 2026'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-black text-slate-900">
                        ₹{(((latestOffer?.buyerOfferedPricePerKg || 18)) * 100).toLocaleString('en-IN')}/Qtl
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        (₹{latestOffer?.buyerOfferedPricePerKg || 18}/kg)
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('offers')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                    >
                      <span>देखें और जवाब दें</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* 3.5 COMPACT BOTTOM BANNER */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                  🌱
                </div>
                <div>
                  <div className="text-sm font-black text-white">
                    सीधे खरीदार, बिना बिचौलिए, पूरा भुगतान
                  </div>
                  <div className="text-xs text-emerald-200 mt-0.5">
                    KisanConnect पर हर किसान को अपनी उपज का सही व पारदर्शी मूल्य मिलता है।
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setWizardStep(1); setShowAddWizard(true); }}
                className="px-4 py-2 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-black shadow-xs transition-colors cursor-pointer shrink-0"
              >
                + नई फसल सूचीबद्ध करें
              </button>
            </div>

          </div>
        )}

      {/* ========================================================================= */}
      {/* 🌾 TAB 2: MY CROPS / LISTINGS (मेरा माल) */}
      {/* ========================================================================= */}
      {activeTab === 'listings' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                मेरा माल (Mere Paas Kitna Maal Hai)
              </h2>
              <p className="text-xs text-slate-500">
                {cropSubTab === 'active' 
                  ? `बाजार में बिक्री के लिए उपलब्ध सक्रिय फसलें (${activeListings.length})` 
                  : `सौदा हो चुकी / पूर्ण बिकी फसलें (${dealedListings.length})`}
              </p>
            </div>
            <button
              onClick={() => {
                setWizardStep(1);
                setShowAddWizard(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>नया माल जोड़ें (Add Crop)</span>
            </button>
          </div>

          {/* Sub-tab Switcher: Active Listings vs Dealed / Sold Crops */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setCropSubTab('active')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                cropSubTab === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>🌱 सक्रिय फसलें (Active Produce)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                cropSubTab === 'active' ? 'bg-white text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {activeListings.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCropSubTab('dealed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                cropSubTab === 'dealed'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>🤝 सौदा हो चुकी फसलें (Dealed & Sold)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                cropSubTab === 'dealed' ? 'bg-white text-indigo-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {dealedListings.length}
              </span>
            </button>
          </div>

          {/* Assisted Voice Search Bar */}
          {listings.length > 0 && (
            <div className="max-w-md">
              <VoiceSearchInput 
                value={listingSearchQuery}
                onChange={setListingSearchQuery}
                placeholder={lang === 'hi' ? 'फसल, किस्म या गाँव खोजें (जैसे आलू, गेहूं)...' : 'Search crop, variety or village...'}
              />
            </div>
          )}

          {/* SECTION 1: ACTIVE LISTINGS */}
          {cropSubTab === 'active' && (
            <>
              {activeListings.length === 0 ? (
                <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
                  <div className="text-4xl">🌾</div>
                  <h3 className="text-base font-bold text-slate-800">वर्तमान में कोई सक्रिय फसल नहीं है</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {dealedListings.length > 0
                      ? 'आपकी दर्ज फसलों के सौदे पक्के हो चुके हैं ("सौदा हो चुकी फसलें" टैब देखें)। नया माल जोड़ने के लिए नीचे क्लिक करें।'
                      : 'अपनी तैयार फसल या खेत में खड़ी फसल की जानकारी दें ताकि खरीदार आपसे संपर्क कर सकें।'}
                  </p>
                  <button
                    onClick={() => {
                      setWizardStep(1);
                      setShowAddWizard(true);
                    }}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
                  >
                    + नया माल जोड़ें (Add Crop)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 2xl:gap-5">
                  {activeListings
                    .filter(l => {
                      if (!listingSearchQuery.trim()) return true;
                      const q = listingSearchQuery.toLowerCase();
                      return l.cropName.toLowerCase().includes(q) ||
                        l.variety.toLowerCase().includes(q) ||
                        l.farmerLocation.toLowerCase().includes(q) ||
                        l.grade.toLowerCase().includes(q);
                    })
                    .map((list) => {
                      const isFuture = list.listingType === 'FUTURE_HARVEST';
                      const totalTons = Number(list.totalQuantityTons ?? list.quantityTons ?? 0);
                      const reservedTons = Number(list.reservedQuantityTons ?? 0);
                      const confirmedTons = Number(list.confirmedQuantityTons ?? 0);
                      const availTons = Number(list.availableQuantityTons ?? (totalTons - reservedTons - confirmedTons));
                      const isOnHold = list.status === 'RESERVED' || (availTons <= 0 && reservedTons > 0);

                      return (
                        <div 
                          key={list.id}
                          className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  isOnHold
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : isFuture
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}>
                                  {isOnHold
                                    ? '🔒 प्रस्ताव आरक्षित (On Hold)'
                                    : isFuture
                                    ? '⏳ खड़ी फसल (Pre-harvest)'
                                    : '✓ बिक्री के लिए तैयार (Active)'}
                                </span>
                                <h3 className="text-lg font-black text-slate-900 mt-1">
                                  {list.cropName} <span className="text-xs font-medium text-slate-500">({list.variety})</span>
                                </h3>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                <div>
                                  <div className="text-base font-black text-emerald-700">₹{list.expectedPricePerKg}</div>
                                  <span className="text-[10px] text-slate-400">उम्मीद भाव / किलो</span>
                                </div>
                                <VoiceListenButton
                                  size="xs"
                                  textHi={`${list.cropName} (${list.variety}), कुल मात्रा ${totalTons} टन, उपलब्ध ${availTons} टन, उम्मीद भाव ₹${list.expectedPricePerKg} प्रति किलो, ग्रेड ${list.grade}, स्थान ${list.farmerLocation}।`}
                                  textEn={`${list.cropName} ${list.variety}, total quantity ${totalTons} tons, available ${availTons} tons, expected price ₹${list.expectedPricePerKg} per kg, grade ${list.grade}, location ${list.farmerLocation}.`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <div>
                                <span className="text-slate-400 text-[10px] block">कुल मात्रा (Total):</span>
                                <span className="font-extrabold text-slate-800">
                                  {totalTons * 10} क्विंटल ({totalTons} टन)
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">उपलब्ध माल (Available):</span>
                                <span className={`font-black ${availTons > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {availTons} टन ({availTons * 10} क्विंटल)
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">गुणवत्ता (Grade):</span>
                                <span className="font-bold text-slate-800">{list.grade}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">तैयार तारीख:</span>
                                <span className="font-medium text-slate-700">{list.availableDate}</span>
                              </div>
                            </div>

                            {/* Stock availability status chips */}
                            {(reservedTons > 0 || confirmedTons > 0) && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                                {reservedTons > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 font-bold flex items-center gap-1">
                                    <span>🔒 {reservedTons} टन</span>
                                    <span className="font-normal text-[10px]">ऑफर पर होल्ड (Reserved)</span>
                                  </span>
                                )}
                                {confirmedTons > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200 font-bold flex items-center gap-1">
                                    <span>✓ {confirmedTons} टन</span>
                                    <span className="font-normal text-[10px]">सौदा पक्का (Dealed)</span>
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                              <span>📍 {list.farmerLocation}</span>
                              <span className="font-bold text-emerald-700">✓ बाजार में सक्रिय</span>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedListingForTraceability(list);
                                  setShowTraceabilityModal(true);
                                }}
                                className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                <span>{lang === 'hi' ? '📜 फसल प्रमाण पत्र' : '📜 Digital Passport'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedListingForTraceability(list);
                                  setShowActivityLoggerModal(true);
                                }}
                                className="py-2 px-2.5 rounded-xl bg-[#FAF9F5] hover:bg-white text-[#1C2B23] border border-[#D8D2C4] font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{lang === 'hi' ? '✍️ डायरी लिखें' : '✍️ Log Work'}</span>
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                handleViewMatches(list);
                                setBuyerFilterCrop('All');
                                handleNavigateTab('buyers');
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 border border-emerald-200 cursor-pointer"
                            >
                              <Search className="h-3.5 w-3.5 text-emerald-600" />
                              <span>इसके खरीदार देखें (See Matching Buyers)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMarkListingSold(list.id)}
                              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                              title="इस फसल का सौदा पक्का होने पर अलग सेक्शन में ले जाएं"
                            >
                              <Handshake className="h-3.5 w-3.5 text-indigo-600" />
                              <span>{lang === 'hi' ? '🤝 सौदा पक्का दर्ज करें (Move to Dealed)' : '🤝 Move to Dealed / Sold'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}

          {/* SECTION 2: DEALED & SOLD CROPS */}
          {cropSubTab === 'dealed' && (
            <>
              {dealedListings.length === 0 ? (
                <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
                  <div className="text-4xl">🤝</div>
                  <h3 className="text-base font-bold text-slate-800">अभी कोई सौदा पक्का नहीं हुआ है</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    जैसे ही किसी खरीदार के साथ आपका सौदा तय होता है या आप खुद सौदा पक्का दर्ज करते हैं, वह फसल यहां अलग सेक्शन में दिखाई देगी।
                  </p>
                  <button
                    onClick={() => setCropSubTab('active')}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
                  >
                    सक्रिय फसलें देखें (View Active Crops)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 2xl:gap-5">
                  {dealedListings
                    .filter(l => {
                      if (!listingSearchQuery.trim()) return true;
                      const q = listingSearchQuery.toLowerCase();
                      return l.cropName.toLowerCase().includes(q) ||
                        l.variety.toLowerCase().includes(q) ||
                        l.farmerLocation.toLowerCase().includes(q) ||
                        l.grade.toLowerCase().includes(q);
                    })
                    .map((list) => {
                      const totalTons = Number(list.totalQuantityTons ?? list.quantityTons ?? 0);
                      const confirmedTons = Number(list.confirmedQuantityTons ?? totalTons);
                      const linkedOrder = orders.find(o => (o.listingId === list.id || (o as any).listing_id === list.id) && o.status !== 'CANCELLED');

                      return (
                        <div 
                          key={list.id}
                          className="bg-slate-50 rounded-2xl border-2 border-indigo-200 p-5 shadow-xs hover:border-indigo-400 transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border bg-indigo-100 text-indigo-900 border-indigo-300 flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="h-3 w-3 text-indigo-700" />
                                  <span>✓ सौदा पक्का (Deal Done / Sold)</span>
                                </span>
                                <h3 className="text-lg font-black text-slate-900 mt-1.5">
                                  {list.cropName} <span className="text-xs font-medium text-slate-500">({list.variety})</span>
                                </h3>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-black text-indigo-900">
                                  ₹{linkedOrder?.agreedPricePerKg || list.expectedPricePerKg}
                                </div>
                                <span className="text-[10px] text-slate-400">तय भाव / किलो</span>
                              </div>
                            </div>

                            {/* Deal & Order details box */}
                            <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-[11px]">बिका हुआ माल (Sold):</span>
                                <span className="font-extrabold text-slate-900">
                                  {confirmedTons * 10} क्विंटल ({confirmedTons} टन)
                                </span>
                              </div>

                              {linkedOrder ? (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500 text-[11px]">सौदा ID:</span>
                                    <span className="font-mono font-bold text-indigo-700">
                                      {linkedOrder.orderNumber}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500 text-[11px]">खरीदार (Buyer):</span>
                                    <span className="font-bold text-slate-800">
                                      {linkedOrder.buyerName}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500 text-[11px]">कुल सौदा मूल्य:</span>
                                    <span className="font-black text-emerald-700">
                                      ₹{Number(linkedOrder.totalAmount || linkedOrder.produceTotal || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400">सुरक्षा:</span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                                      🛡️ एस्क्रो सुरक्षित (Escrow Locked)
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-[11px] text-slate-500 italic pt-1">
                                  ✓ यह फसल किसान द्वारा सौदा पक्का होने पर आर्काइव की गई है।
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                              <span>📍 {list.farmerLocation}</span>
                              <span className="text-indigo-800 font-bold">ग्रेड {list.grade}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                            {linkedOrder ? (
                              <button
                                type="button"
                                onClick={() => setActiveTab('orders')}
                                className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                              >
                                <Package className="h-3.5 w-3.5" />
                                <span>सौदा देखें (View Deal)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveTab('orders')}
                                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <span>सौदे देखें</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleReactivateListing(list.id)}
                              className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              title="इस फसल को वापस सक्रिय फसलों की सूची में ले जाएं"
                            >
                              <span>↩️ पुनः सक्रिय करें</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔎 TAB 3: BUYER DISCOVERY (मेरी फसल कौन खरीदेगा?) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 🔎 TAB 3: BUYER DISCOVERY (मेरी फसल कौन खरीदेगा?) */}
      {/* ========================================================================= */}
      {activeTab === 'buyers' && (() => {
        const activeListing = selectedListingForMatches || listings[0];
        const farmerQtyTons = activeListing ? Number(activeListing.quantityTons) : 8.0;
        const farmerQtyKg = farmerQtyTons * 1000;

        // Apply filters & sorting
        const displayedMatches = matchedBuyers.filter(m => {
          const req = m.requirement;
          if (buyerFilterCrop !== 'All' && req.cropName.toLowerCase() !== buyerFilterCrop.toLowerCase()) {
            return false;
          }
          if (buyerFilterVariety !== 'All' && req.variety?.toLowerCase() !== buyerFilterVariety.toLowerCase()) {
            return false;
          }
          if (buyerFilterGrade !== 'All' && req.gradeRequired?.toLowerCase() !== buyerFilterGrade.toLowerCase()) {
            return false;
          }
          if (buyerFilterDistance !== null && (m.distanceKm ?? 999) > buyerFilterDistance) {
            return false;
          }
          const bType = req.buyerType || (req.quantityTons >= 20 ? 'bulk' : 'local');
          if (buyerFilterType === 'local' && bType !== 'local') return false;
          if (buyerFilterType === 'bulk' && bType !== 'bulk') return false;
          if (buyerFilterType === 'aggregator') {
            const isAgg = m.eligibility?.routeType === 'aggregator_pooled' || req.aggregationAllowed === true;
            if (!isAgg) return false;
          }
          return true;
        }).sort((a, b) => {
          if (buyerSortBy === 'best_match') return b.matchScore - a.matchScore;
          if (buyerSortBy === 'nearest') return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
          if (buyerSortBy === 'price') return (b.requirement.offeredPricePerKg || 0) - (a.requirement.offeredPricePerKg || 0);
          if (buyerSortBy === 'date') return new Date(a.requirement.requiredDate || '').getTime() - new Date(b.requirement.requiredDate || '').getTime();
          return 0;
        });

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Header & Listing Selection */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    मेरी फसल कौन खरीदेगा? (Find Buyers)
                  </h2>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    {displayedMatches.length} सक्रिय अवसर
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  स्थानीय आढ़ती (Local Traders), प्रोसेसिंग उद्योग (Bulk Buyers) और संग्राहक नेटवर्क
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(activeListings.length > 0 || listings.length > 0) && (
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-600">आपकी फसल:</span>
                    <select
                      value={activeListing?.id || ''}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const found = activeListings.find(l => l.id === targetId) || listings.find(l => l.id === targetId);
                        if (found) {
                          handleViewMatches(found);
                          setBuyerFilterCrop('All');
                        }
                      }}
                      className="text-xs font-black text-emerald-800 bg-transparent outline-none cursor-pointer"
                    >
                      {activeListings.length > 0 ? (
                        <>
                          <optgroup label="── सक्रिय फसलें (Active Produce) ──">
                            {activeListings.map(l => (
                              <option key={l.id} value={l.id}>
                                {l.cropName} ({l.availableQuantityTons ?? l.quantityTons}T उपलब्ध) - {l.grade || 'Grade A'}
                              </option>
                            ))}
                          </optgroup>
                          {dealedListings.length > 0 && (
                            <optgroup label="── सौदा हो चुकी फसलें (Dealed / Sold) ──">
                              {dealedListings.map(l => (
                                <option key={l.id} value={l.id}>
                                  {l.cropName} ({l.quantityTons}T) - ✓ बिका हुआ (Sold)
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      ) : (
                        listings.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.cropName} ({l.quantityTons}T) - {l.grade || 'Grade A'}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* View Mode Toggle: [List View] [Map View] */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    onClick={() => setBuyerViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      buyerViewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📋 List View
                  </button>
                  <button
                    onClick={() => setBuyerViewMode('map')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      buyerViewMode === 'map'
                        ? 'bg-white text-emerald-800 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🗺️ Map View
                  </button>
                </div>
              </div>
            </div>

            {/* AI BUYER GUIDE COMPONENT */}
            <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-emerald-500/30 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✨</span>
                    <h3 className="text-sm font-black text-emerald-300">
                      AI Buyer Guide — {lang === 'hi' ? 'मेरे लिए सबसे सही खरीदार कौन सा है?' : 'Which buyer is best suited for your crop?'}
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                      Decision Support
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {activeListing
                      ? `विश्लेषण: ${activeListing.cropName} (${activeListing.quantityTons} टन / ${activeListing.quantityTons * 10} क्विंटल) • स्थान: ${activeListing.farmerLocation || user?.location || 'कुशीनगर'}`
                      : 'अपनी फसल के अनुकूल सबसे सही खरीदार व रास्ते की तुरंत सलाह पाएं।'}
                  </p>
                </div>

                <button
                  onClick={handleAskAiBuyerGuide}
                  disabled={aiLoading}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 cursor-pointer"
                >
                  <Sparkles className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {aiLoading 
                      ? (lang === 'hi' ? 'आपकी फसल, दूरी और खरीदार की जरूरत देख रहे हैं...' : 'Analyzing crop, distance, and buyer demand...')
                      : (lang === 'hi' ? 'मेरे लिए बेहतर खरीदार बताएं' : 'Find my best buyer options')
                    }
                  </span>
                </button>
              </div>

              {/* AI Guide Result / Graceful Fallback Notice */}
              {aiError && (
                <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-amber-300 shrink-0" />
                    <span>{aiError} सामान्य खरीदार सूची और दूरी के नतीजे पूरी तरह सक्रिय हैं।</span>
                  </div>
                  <button onClick={() => setAiError(null)} className="text-amber-400 font-bold hover:underline text-[11px] cursor-pointer">
                    हटाएं
                  </button>
                </div>
              )}

              {aiRecommendation && (
                <div className="mt-4 bg-white/10 rounded-2xl p-4 sm:p-5 border border-white/15 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs border-b border-white/10 pb-2.5">
                    <span className="font-extrabold text-emerald-300 text-sm">
                      {aiRecommendation.summaryTitle || (lang === 'hi' ? 'सुझाए गए प्रमुख विकल्प (Recommended Options)' : 'Top Recommended Options')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      AI-assisted recommendation • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-black/20 p-3 rounded-xl border border-white/5">
                    {aiRecommendation.summary || aiRecommendation.explanation}
                  </p>

                  {Array.isArray(aiRecommendation.recommendations) && aiRecommendation.recommendations.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {aiRecommendation.recommendations.slice(0, 2).map((rec: any, rIdx: number) => {
                        const isBest = rIdx === 0;
                        const isAgg = rec.route === 'AGGREGATOR' || rec.recommendedRoute === 'aggregator';
                        const isLocal = rec.route === 'LOCAL_DIRECT' || rec.recommendedRoute === 'direct';

                        return (
                          <div 
                            key={rIdx} 
                            className={`rounded-2xl p-4 border text-xs flex flex-col justify-between ${
                              isBest 
                                ? 'bg-gradient-to-br from-emerald-950/90 to-slate-900 border-emerald-400/40 shadow-lg' 
                                : 'bg-gradient-to-br from-slate-900/90 to-indigo-950/80 border-slate-700/60 shadow-md'
                            }`}
                          >
                            <div className="space-y-2">
                              {/* Option Badge & Match Score */}
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                  isBest 
                                    ? 'bg-emerald-400 text-emerald-950 font-black' 
                                    : 'bg-amber-400 text-amber-950 font-black'
                                }`}>
                                  {isBest ? `BEST MATCH — ${rec.matchScore || 93}%` : `MATCH — ${rec.matchScore || 87}%`}
                                </span>
                                <span className="text-xs font-bold text-emerald-300">
                                  {rec.distanceKm ? `${rec.distanceKm} km away` : 'Near you'}
                                </span>
                              </div>

                              {/* Buyer Name & Supply Match */}
                              <div>
                                <h4 className="text-sm font-black text-white">{rec.buyerName}</h4>
                                <p className="text-[11px] text-slate-300 mt-0.5">
                                  {activeListing 
                                    ? (lang === 'hi' ? `आपकी ${activeListing.quantityTons}T फसल के अनुकूल।` : `Suitable for your ${activeListing.quantityTons}T supply.`)
                                    : 'सत्यापित खरीदार मांग'}
                                  {rec.requiredQuantityTons && (
                                    <span className="text-emerald-300 font-bold ml-1.5">• मांग: {rec.requiredQuantityTons}T</span>
                                  )}
                                  {rec.offeredPricePerKg && (
                                    <span className="text-emerald-300 font-bold ml-1.5">• भाव: ₹{rec.offeredPricePerKg}/kg</span>
                                  )}
                                </p>
                              </div>

                              {/* WHY? Section */}
                              <div className="bg-black/25 rounded-xl p-2.5 border border-white/5 space-y-1">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                                  WHY? (कारण):
                                </span>
                                {Array.isArray(rec.reasons) && rec.reasons.length > 0 ? (
                                  <ul className="text-[11px] text-slate-200 space-y-1">
                                    {rec.reasons.map((rs: string, rsIdx: number) => (
                                      <li key={rsIdx} className="flex items-start gap-1.5">
                                        <span className="text-emerald-400">•</span>
                                        <span>{rs}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[11px] text-slate-200 leading-snug">
                                    "{rec.reason}"
                                  </p>
                                )}
                              </div>

                              {/* Recommended Route */}
                              <div className="text-[11px] flex items-center gap-1.5 font-bold pt-1">
                                <span className="text-slate-400">अनुशंसित मार्ग:</span>
                                <span className={isAgg ? 'text-amber-300' : 'text-emerald-300'}>
                                  {isAgg ? 'Aggregator के जरिए' : isLocal ? 'सीधा स्थानीय खरीदार (Direct Local)' : 'सीधा थोक सौदा (Direct Bulk)'}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-white/10">
                              <button
                                type="button"
                                onClick={() => {
                                  // Find requirement or scroll to buyer list
                                  window.scrollTo({ top: 800, behavior: 'smooth' });
                                }}
                                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                              >
                                [View Buyer]
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const targetMatch = matchedBuyers.find(m => m.requirement?.id === rec.buyerId);
                                  const targetReq = targetMatch?.requirement || {
                                    id: rec.buyerId,
                                    buyerName: rec.buyerName,
                                    buyerCompany: rec.buyerName,
                                    cropName: activeListing?.cropName || 'Potato',
                                    quantityTons: rec.requiredQuantityTons || 10,
                                    offeredPricePerKg: rec.offeredPricePerKg || 20
                                  };
                                  setMakeOfferModal({
                                    isOpen: true,
                                    requirement: targetReq,
                                    listing: activeListing,
                                    quantityTons: activeListing ? Math.min(Number(activeListing.quantityTons), Number(targetReq.quantityTons || 10)) : 5,
                                    offeredPricePerKg: Number(rec.offeredPricePerKg || targetReq.offeredPricePerKg || 20),
                                    deliveryTerms: 'EX_FARM',
                                    message: '',
                                    isSubmitting: false
                                  });
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-[11px] font-black transition-all cursor-pointer shadow-xs"
                              >
                                [Make Offer]
                              </button>

                              {isAgg && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('aggregator_info')}
                                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 rounded-lg text-[11px] font-black transition-all cursor-pointer shadow-xs"
                                >
                                  [View Aggregator Options]
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 italic pt-1">
                    * AI केवल निर्णय सहायता के लिए है। KisanConnect का सत्यापन इंजन ही वास्तविक पात्रता का अंतिम आधार है।
                  </div>
                </div>
              )}
            </div>

            {/* INTERACTIVE FILTERS & DISTANCE SLIDER */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                {/* Buyer Type Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <span className="text-slate-500 mr-1 text-[11px]">खरीदार प्रकार:</span>
                  {[
                    { id: 'all', label: 'All Buyers (सभी)' },
                    { id: 'local', label: 'Local Buyers (स्थानीय आढ़ती)' },
                    { id: 'bulk', label: 'Bulk Buyers (थोक खरीदार)' },
                    { id: 'aggregator', label: 'Aggregator Opportunities (संग्राहक)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setBuyerFilterType(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        buyerFilterType === tab.id
                          ? 'bg-slate-900 text-white shadow-xs font-extrabold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sort Option */}
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="text-slate-500 text-[11px]">क्रमबद्ध करें:</span>
                  <select
                    value={buyerSortBy}
                    onChange={(e) => setBuyerSortBy(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-slate-800 text-xs font-bold outline-none"
                  >
                    <option value="best_match">Best Match (सर्वोत्तम मिलान)</option>
                    <option value="nearest">Nearest (सबसे पास)</option>
                    <option value="price">Best Price (अधिकतम भाव)</option>
                    <option value="date">Soonest (जल्दी तारीख)</option>
                  </select>
                </div>
              </div>

              {/* Distance Filter Pills (5 km, 10 km, 25 km, 50 km, 100 km, Any) */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  अधिकतम दूरी (Distance):
                </span>
                {[
                  { label: '5 km', val: 5 },
                  { label: '10 km', val: 10 },
                  { label: '25 km', val: 25 },
                  { label: '50 km', val: 50 },
                  { label: '100 km', val: 100 },
                  { label: 'Any Distance', val: null }
                ].map(opt => (
                  <button
                    key={String(opt.val)}
                    onClick={() => setBuyerFilterDistance(opt.val)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      buyerFilterDistance === opt.val
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN CONTENT AREA */}
            {loadingMatches ? (
              <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <Sparkles className="h-8 w-8 mx-auto animate-spin text-emerald-600 mb-2" />
                <p className="text-sm font-bold text-slate-700">अनुकूल खरीदार खोजे जा रहे हैं...</p>
                <p className="text-xs text-slate-400 mt-1">दूरी, गुणवत्ता व मात्रा नियमों की जांच जारी है</p>
              </div>
            ) : displayedMatches.length === 0 ? (
              <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
                <div className="text-4xl">🔍</div>
                <h3 className="text-base font-bold text-slate-800">चुने गए फ़िल्टर पर कोई खरीदार नहीं मिला</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  दूरी सीमा बढ़ाकर <strong>50 km या 100 km</strong> चुनें, या पास के संग्राहक के साथ अपनी फसल पूल करें।
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setBuyerFilterDistance(null);
                      setBuyerFilterType('all');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                  >
                    फ़िल्टर साफ़ करें (Clear Filters)
                  </button>
                  <button
                    onClick={() => setActiveTab('aggregator_info')}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs"
                  >
                    संग्राहक से जुड़ें
                  </button>
                </div>
              </div>
            ) : buyerViewMode === 'map' ? (
              /* MAP VIEW INTERACTIVE CONTAINER */
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      🗺️ पास के खरीदार व संग्रहण केंद्र (Nearby Buyers Map)
                    </h3>
                    <p className="text-xs text-slate-500">
                      आपके खेत के चारों ओर सक्रिय मांग केंद्र (दूरी व प्रकार के अनुसार)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1 text-blue-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block"></span> Local Buyer
                    </span>
                    <span className="flex items-center gap-1 text-purple-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block"></span> Bulk Buyer
                    </span>
                    <span className="flex items-center gap-1 text-amber-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block"></span> Collection Point
                    </span>
                  </div>
                </div>

                {/* Simulated Geolocation Radar Canvas */}
                <div className="relative w-full h-80 sm:h-96 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-2xl border border-slate-700 overflow-hidden flex items-center justify-center p-4">
                  {/* Radar Circles */}
                  <div className="absolute h-24 w-24 rounded-full border border-emerald-500/20 pointer-events-none"></div>
                  <div className="absolute h-48 w-48 rounded-full border border-emerald-500/20 pointer-events-none"></div>
                  <div className="absolute h-72 w-72 rounded-full border border-emerald-500/20 pointer-events-none"></div>
                  <span className="absolute bottom-3 left-4 text-[10px] text-slate-400 font-mono">
                    📍 केंद्र: {user?.location || 'कुशीनगर (Kushinagar)'} • रेंज: {buyerFilterDistance ? `${buyerFilterDistance} km` : '100 km'}
                  </span>

                  {/* Center Farmer Point */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="h-5 w-5 rounded-full bg-emerald-500 border-2 border-white shadow-lg animate-ping absolute"></div>
                    <div className="h-5 w-5 rounded-full bg-emerald-500 border-2 border-white shadow-lg relative z-10 flex items-center justify-center text-[9px] text-white font-black">
                      🌾
                    </div>
                    <span className="mt-1 px-2 py-0.5 rounded bg-slate-900/90 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                      आपका खेत ({farmerQtyTons}T {activeListing?.cropName || 'Potato'})
                    </span>
                  </div>

                  {/* Buyer Pins Scattered deterministically around center */}
                  {displayedMatches.map((m, idx) => {
                    const req = m.requirement;
                    const bType = req.buyerType || (req.quantityTons >= 20 ? 'bulk' : 'local');
                    const dist = m.distanceKm ?? (idx * 15 + 8);
                    
                    // Angle and distance translation for map layout
                    const angle = (idx * (360 / Math.max(displayedMatches.length, 1)) * Math.PI) / 180;
                    const radius = Math.min(130, Math.max(35, (dist / 100) * 125));
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;

                    const pinColor = bType === 'local' ? 'bg-blue-500 text-blue-100' : 'bg-purple-600 text-purple-100';

                    return (
                      <button
                        key={m.requirement.id}
                        onClick={() => setMapSelectedMatch(m)}
                        style={{
                          transform: `translate(${x}px, ${y}px)`
                        }}
                        className={`absolute z-20 flex flex-col items-center group cursor-pointer transition-transform hover:scale-110`}
                        title={`${req.buyerName} - ${dist} km`}
                      >
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border border-white/60 shadow-md flex items-center gap-1 ${pinColor}`}>
                          <span>{bType === 'local' ? '🏪' : '🏭'}</span>
                          <span>{dist} km</span>
                        </div>
                        <span className="text-[9px] text-slate-300 font-bold bg-slate-950/80 px-1 rounded mt-0.5 max-w-[90px] truncate">
                          {req.buyerName}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Marker Detail Card */}
                {mapSelectedMatch && (() => {
                  const m = mapSelectedMatch;
                  const req = m.requirement;
                  const nr = m.netRealization;
                  const bType = req.buyerType || (req.quantityTons >= 20 ? 'bulk' : 'local');
                  const minLot = (req.minimumDirectFarmerLotKg || 0) / 1000;
                  const isDirectEligible = bType === 'local' || farmerQtyTons >= minLot;

                  return (
                    <div className="p-4 bg-slate-50 border-2 border-emerald-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                            bType === 'local' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {bType === 'local' ? 'LOCAL BUYER' : 'BULK BUYER'}
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm">{req.buyerCompany || req.buyerName}</span>
                          <span className="text-xs text-slate-500">• {m.distanceKm ?? 8} km away</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          फसल: <strong>{req.cropName} ({req.variety})</strong> • मांग: <strong>{req.quantityTons} टन</strong> • भाव: <strong>₹{req.offeredPricePerKg}/kg</strong>
                        </div>
                        {!isDirectEligible && (
                          <div className="text-[11px] text-amber-700 font-semibold mt-1">
                            ⚠️ आपकी मात्रा ({farmerQtyTons}T) न्यूनतम सीधे खरीद लॉट ({minLot}T) से कम है। संग्राहक के जरिए आपूर्ति की जा सकती है।
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isDirectEligible ? (
                          <button
                            onClick={() => openMakeOfferModal(req, activeListing)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs"
                          >
                            सौदा भेजें (Make Offer)
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveTab('aggregator_info')}
                            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs"
                          >
                            संग्राहक से जुड़ें (Sell Via Aggregator)
                          </button>
                        )}
                        <button
                          onClick={() => setMapSelectedMatch(null)}
                          className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-slate-600 font-bold text-xs"
                        >
                          बंद करें
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : displayedMatches.length === 0 ? (
              /* EMPTY FILTER STATE */
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 sm:p-12 text-center space-y-4">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-3xl">
                  🔍
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    चयनित फिल्टर के अनुसार कोई खरीदार नहीं मिला
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    No buyers match your selected filters. Reset filters to see all available market buyers.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setBuyerFilterCrop('All');
                    setBuyerFilterVariety('All');
                    setBuyerFilterGrade('All');
                    setBuyerFilterType('all');
                    setBuyerFilterDistance(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  सभी खरीदार देखें (Reset All Filters)
                </button>
              </div>
            ) : (
              /* LIST VIEW INTERACTIVE CARDS */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 2xl:gap-5">
                {displayedMatches.map((matchItem, idx) => {
                  const req = matchItem.requirement;
                  const nr = matchItem.netRealization;
                  const bType = req.buyerType || (req.quantityTons >= 20 ? 'bulk' : 'local');
                  const minLotTons = req.minimumDirectFarmerLotKg !== undefined 
                    ? req.minimumDirectFarmerLotKg / 1000 
                    : (bType === 'bulk' ? 20 : 0.25);
                  const minLotKg = minLotTons * 1000;
                  
                  // Check eligibility
                  const isBulk = bType === 'bulk';
                  const isEligibleDirect = !isBulk || farmerQtyTons >= minLotTons;
                  const isAggregatorOpportunity = isBulk && farmerQtyTons < minLotTons && req.aggregationAllowed !== false;

                  return (
                    <div
                      key={req.id || idx}
                      className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4"
                    >
                      {/* Card Header */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                isBulk
                                  ? 'bg-purple-100 text-purple-900 border-purple-200'
                                  : 'bg-blue-100 text-blue-900 border-blue-200'
                              }`}>
                                {isBulk ? 'BULK BUYER' : 'LOCAL BUYER'}
                              </span>
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                {req.deliveryType === 'PICKUP_REQUIRED' ? '🚜 खेत से उठाएंगे' : '🚚 डिलीवरी'}
                              </span>
                            </div>

                            <h4 className="text-base font-extrabold text-slate-900 mt-1">
                              {req.buyerCompany || req.buyerName}
                            </h4>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{req.location || 'स्थानीय मंडी'}</span>
                              <strong className="text-slate-700 font-extrabold">
                                • {matchItem.distanceKm ?? 8} km away
                              </strong>
                            </div>
                          </div>

                          {/* Match Score Badge */}
                          <div className="text-right shrink-0">
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black inline-flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-emerald-600" />
                              <span>{matchItem.matchScore}% अनुकूल</span>
                            </span>
                            <div className="mt-1">
                              <VoiceListenButton
                                size="xs"
                                textHi={`${req.buyerCompany || req.buyerName} को ${req.quantityTons} टन ${req.cropName} चाहिए। ऑफर भाव ₹${req.offeredPricePerKg} प्रति किलो है।`}
                                textEn={`${req.buyerCompany || req.buyerName} needs ${req.quantityTons} tons of ${req.cropName}. Offer price is ₹${req.offeredPricePerKg} per kg.`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Demand Details Strip */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[11px] text-slate-500 block">फसल व किस्म:</span>
                            <span className="font-extrabold text-slate-900">{req.cropName} ({req.variety || 'Standard'})</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">गुणवत्ता (Grade):</span>
                            <span className="font-extrabold text-slate-900">{req.gradeRequired || 'Grade A'}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">कुल जरूरत (Required):</span>
                            <span className="font-extrabold text-slate-900">
                              {req.quantityTons} Ton ({req.quantityTons * 10} क्विंटल)
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">न्यूनतम सीधा लॉट (Min Lot):</span>
                            <span className="font-extrabold text-slate-900">
                              {minLotTons >= 1 ? `${minLotTons} Ton` : `${minLotKg} kg`}
                            </span>
                          </div>
                        </div>

                        {/* Price & Realization Box */}
                        <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200/80 text-xs flex items-center justify-between">
                          <div>
                            <span className="text-[11px] text-slate-600 block">खरीदार का संकेतक भाव:</span>
                            <span className="text-base font-black text-slate-900">
                              ₹{req.offeredPricePerKg ? Number(req.offeredPricePerKg).toFixed(2) : '20.00'}/kg
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-emerald-800 font-bold block">खर्च बाद हाथ में (Net in hand):</span>
                            <span className="text-sm font-extrabold text-emerald-700">
                              ₹{nr?.estimatedNetRealization ? Number(nr.estimatedNetRealization).toFixed(2) : Number(req.offeredPricePerKg - 1.25).toFixed(2)}/kg
                            </span>
                          </div>
                        </div>

                        {/* Quantity Eligibility Warning / Status Banner */}
                        {isBulk && !isEligibleDirect && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-amber-800">
                              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                              <span>सीधे थोक खरीद के लिए मात्रा कम है</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-amber-800">
                              आपकी मात्रा: <strong>{farmerQtyTons} Ton</strong> • खरीदार का न्यूनतम नियम: <strong>{minLotTons} Ton</strong>
                              <br />
                              "Your quantity is below the buyer's direct procurement minimum."
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                        <button
                          onClick={() => setSelectedMatchExplanation(matchItem)}
                          className="text-xs font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          हिसाब समझें (Details)
                        </button>

                        {isEligibleDirect ? (
                          <button
                            onClick={() => openMakeOfferModal(req, activeListing)}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            सौदा भेजें (Make Offer)
                          </button>
                        ) : isAggregatorOpportunity ? (
                          <button
                            onClick={() => {
                              setActiveTab('aggregator_info');
                            }}
                            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            संग्राहक के जरिए बेचें (Sell Through Aggregator)
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">मात्रा सीमा लागू</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 💰 TAB 4: MY OFFERS (मेरे ऑफर) */}
      {/* ========================================================================= */}
      {activeTab === 'offers' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                मेरे ऑफर व बातचीत (My Offers & Negotiations)
              </h2>
              <p className="text-xs text-slate-500">
                खरीदारों द्वारा भेजे गए सीधे प्रस्ताव और जारी बातचीत का हिसाब
              </p>
            </div>
            <button
              onClick={() => handleNavigateTab('buyers')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>नया खरीदार खोजें (Find Buyers)</span>
            </button>
          </div>

          {/* Filter Pills: [All] [Received] [Sent] [Negotiating] [Deals] */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            {[
              { id: 'ALL', label: 'सभी ऑफर (All)', count: offers.length },
              { id: 'RECEIVED', label: 'खरीदार से प्राप्त (Received)', count: offers.filter(o => o.direction === 'RECEIVED' && o.status === 'PENDING').length },
              { id: 'SENT', label: 'भेजे गए (Sent)', count: offers.filter(o => o.direction === 'SENT' && o.status === 'PENDING').length },
              { id: 'NEGOTIATING', label: 'बातचीत में (Negotiating)', count: offers.filter(o => o.status === 'COUNTERED').length },
              { id: 'DEALS', label: 'पक्के सौदे (Deals)', count: offers.filter(o => o.status === 'ACCEPTED').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setOfferFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  offerFilter === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  offerFilter === tab.id ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {(() => {
            const filteredOffers = offers.filter(off => {
              if (offerFilter === 'RECEIVED') return off.direction === 'RECEIVED' && off.status === 'PENDING';
              if (offerFilter === 'SENT') return off.direction === 'SENT' && off.status === 'PENDING';
              if (offerFilter === 'NEGOTIATING') return off.status === 'COUNTERED';
              if (offerFilter === 'DEALS') return off.status === 'ACCEPTED';
              return true;
            });

            if (filteredOffers.length === 0) {
              return (
                <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
                  <div className="text-4xl">💰</div>
                  <h3 className="text-base font-bold text-slate-800">इस श्रेणी में कोई ऑफर नहीं है</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    खरीदार देखें और सीधे मांग के अनुसार अपनी फसल का प्रस्ताव भेजें।
                  </p>
                  <button
                    onClick={() => handleNavigateTab('buyers')}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                  >
                    खरीदार देखें और खुद ऑफर भेजें
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredOffers.map((off) => {
                  const effectivePrice = (off.status === 'COUNTERED' && off.counterPricePerKg)
                    ? off.counterPricePerKg
                    : (off.offeredPricePerKg || off.buyerOfferedPricePerKg || off.farmerExpectedPricePerKg || 0);
                  const effectiveQty = (off.status === 'COUNTERED' && off.counterQuantityTons)
                    ? off.counterQuantityTons
                    : off.quantityTons;
                  const totalAmount = Math.round(effectivePrice * effectiveQty * 1000);

                  const isIncoming = off.direction === 'RECEIVED';
                  const isOutgoing = off.direction === 'SENT';
                  const isNegotiating = off.status === 'COUNTERED';
                  const isAccepted = off.status === 'ACCEPTED';
                  const isRejected = off.status === 'REJECTED';
                  const isBuyerTurn = isNegotiating && (off.lastActionRole === 'farmer' || off.counterBy === 'farmer');
                  const isFarmerTurn = isNegotiating && (off.lastActionRole === 'buyer' || off.counterBy === 'buyer');

                  return (
                    <div 
                      key={off.id}
                      className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-2.5 flex-1">
                        {/* Header Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{off.buyerName}</span>
                          
                          {isAccepted && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✓ स्वीकृत सौदा (Deal Confirmed)
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              ✕ अस्वीकृत (Declined)
                            </span>
                          )}
                          {isNegotiating && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              🔄 बातचीत में (Negotiating • दौर {off.negotiationHistory?.length || 2})
                            </span>
                          )}
                          {!isNegotiating && !isAccepted && !isRejected && isIncoming && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              📩 खरीदार का सीधा ऑफर (BUYER OFFER RECEIVED)
                            </span>
                          )}
                          {!isNegotiating && !isAccepted && !isRejected && isOutgoing && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                              ⏳ आपका भेजा गया ऑफर (OFFER SENT)
                            </span>
                          )}
                        </div>

                        {/* Price & Quantity Details */}
                        <div className="text-lg font-black text-emerald-700">
                          ₹{effectivePrice} / किलो
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            (कुल रकम: <strong>₹{totalAmount.toLocaleString()}</strong>)
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          मात्रा: <strong>{effectiveQty * 10} क्विंटल ({effectiveQty} टन)</strong> • {off.cropName} {off.variety ? `(${off.variety})` : ''}
                        </div>

                        {/* Logistics & Dates */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span>🚚 शर्तें: <strong>{off.pickupTerms || off.deliveryTerms || 'Farm Gate Pickup'}</strong></span>
                          {off.targetDate && <span>📅 डिलीवरी: <strong>{off.targetDate}</strong></span>}
                          <span>🕒 {new Date(off.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* Buyer Counter Offer Details Box */}
                        {isFarmerTurn && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 space-y-1">
                            <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                              <span>⚠️ खरीदार ने नया भाव/मात्रा प्रस्तावित की है (Buyer Counter):</span>
                            </div>
                            <div className="flex items-center gap-2 font-bold text-slate-800">
                              <span className="bg-amber-200 px-2 py-0.5 rounded text-amber-950">₹{off.counterPricePerKg}/किग्रा</span>
                              <span className="bg-amber-200 px-2 py-0.5 rounded text-amber-950">{off.counterQuantityTons} टन</span>
                            </div>
                            {(off.counterMessage || off.message) && (
                              <p className="italic text-slate-600 bg-white p-2 rounded border border-amber-100">
                                "{off.counterMessage || off.message}"
                              </p>
                            )}
                          </div>
                        )}

                        {/* Farmer Counter Waiting for Buyer */}
                        {isBuyerTurn && (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900">
                            ⏳ आपने नया प्रस्ताव भेजा है (₹{off.counterPricePerKg}/kg, {off.counterQuantityTons}T)। खरीदार के उत्तर की प्रतीक्षा है।
                          </div>
                        )}

                        {/* Negotiation Trail */}
                        {off.negotiationHistory && off.negotiationHistory.length > 1 && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 text-[11px]">
                            <span className="font-bold text-slate-600 block">बातचीत का क्रम (Trail):</span>
                            {off.negotiationHistory.map((h: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-slate-500">
                                <span>दौर {h.round}: {h.byRole === 'buyer' ? 'खरीदार' : 'किसान'}</span>
                                <span className="font-bold text-slate-700">₹{h.pricePerKg}/kg • {h.quantityTons}T</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Normal initial message if no counters */}
                        {off.message && !isNegotiating && (
                          <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                            "{off.message}"
                          </p>
                        )}
                      </div>

                      {/* Action Buttons Column */}
                      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                        {/* Case 1: Buyer countered -> Farmer can Accept, Counter Again, or Decline */}
                        {isFarmerTurn && (
                          <>
                            <button
                              onClick={() => handleAcceptOffer(off.id)}
                              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="h-4 w-4" />
                              <span>स्वीकार करें (Accept Counter)</span>
                            </button>
                            <button
                              onClick={() => setCounterModal({
                                isOpen: true,
                                offer: off,
                                counterPricePerKg: off.counterPricePerKg || effectivePrice,
                                counterQuantityTons: off.counterQuantityTons || effectiveQty,
                                pickupTerms: off.pickupTerms || off.deliveryTerms || 'Farm Gate Pickup',
                                targetDate: off.targetDate || '',
                                message: '',
                                isSubmitting: false
                              })}
                              className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                            >
                              नया भाव दें (Counter Again)
                            </button>
                            <button
                              onClick={() => handleRejectOffer(off.id, 'Farmer declined buyer counter')}
                              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                            >
                              मना करें (Decline)
                            </button>
                          </>
                        )}

                        {/* Case 2: Farmer created pending offer -> waiting for buyer */}
                        {off.status === 'PENDING' && isOutgoing && (
                          <div className="flex items-center gap-2">
                            <div className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              <span>खरीदार के निर्णय की प्रतीक्षा है (Waiting for Buyer)</span>
                            </div>
                            <button
                              onClick={() => handleRejectOffer(off.id, 'Farmer withdrew offer')}
                              className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-rose-600 font-bold text-xs hover:bg-rose-50 cursor-pointer"
                              title="प्रस्ताव वापस लें"
                            >
                              वापस लें (Withdraw)
                            </button>
                          </div>
                        )}

                        {/* Case 3: Buyer created pending offer to farmer -> farmer can Accept, Counter, or Decline */}
                        {off.status === 'PENDING' && isIncoming && (
                          <>
                            <button
                              onClick={() => handleAcceptOffer(off.id)}
                              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="h-4 w-4" />
                              <span>स्वीकार करें (Accept Offer)</span>
                            </button>
                            <button
                              onClick={() => setCounterModal({
                                isOpen: true,
                                offer: off,
                                counterPricePerKg: effectivePrice,
                                counterQuantityTons: effectiveQty,
                                pickupTerms: off.pickupTerms || off.deliveryTerms || 'Farm Gate Pickup',
                                targetDate: off.targetDate || '',
                                message: '',
                                isSubmitting: false
                              })}
                              className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                            >
                              नया भाव दें (Negotiate)
                            </button>
                            <button
                              onClick={() => handleRejectOffer(off.id)}
                              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                            >
                              मना करें (Decline)
                            </button>
                          </>
                        )}

                        {/* Case 4: Accepted */}
                        {off.status === 'ACCEPTED' && (
                          <button
                            onClick={() => setActiveTab('orders')}
                            className="px-4 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-300"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>सौदा देखें (View Active Deal)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 TAB 5: MY DEALS / ORDERS (मेरे सौदे) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              मेरे सौदे (Mere Chal Rahe Aur Purane Order)
            </h2>
            <p className="text-xs text-slate-500">
              सौदा तय होने से लेकर बैंक में पैसे आने तक का पूरा हिसाब
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
              <div className="text-4xl">📦</div>
              <h3 className="text-base font-bold text-slate-800">अभी कोई सक्रिय सौदा नहीं है</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                जब खरीदार आपका ऑफर स्वीकार करेगा, तो यहाँ आपका पक्का ऑर्डर और गाड़ी की जानकारी दिखेगी।
              </p>
              <button
                onClick={() => handleNavigateTab('buyers')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
              >
                खरीदार देखें
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((ord) => {
                const isCompleted = ord.status === 'COMPLETED';
                const isInTransit = ord.status === 'IN_TRANSIT';

                return (
                  <div 
                    key={ord.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs space-y-4"
                  >
                    {/* Top Order Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{ord.orderNumber}</span>
                          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                            खरीदार: {ord.buyerName}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">दिनांक: {new Date(ord.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isInTransit
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isCompleted ? '✓ भुगतान पूरा (Completed)' : isInTransit ? '🚚 रास्ते में है (In Transit)' : '🟡 सौदा तय (Confirmed)'}
                        </span>
                        <span className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          <span>सुरक्षित एस्क्रो</span>
                        </span>
                      </div>
                    </div>

                    {/* Order Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">फसल:</span>
                        <span className="font-bold text-slate-800">{ord.quantityTons * 10} क्विंटल {ord.cropName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">तय भाव:</span>
                        <span className="font-bold text-slate-800">₹{ord.unitPricePerKg} / किलो</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">कुल रकम:</span>
                        <span className="font-black text-emerald-700 text-sm">₹{ord.produceTotal.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">गाड़ी / ट्रांसपोर्ट:</span>
                        <span className="font-medium text-slate-700">{ord.transporterName || 'Kisan Express'}</span>
                      </div>
                    </div>

                    {/* Visual 5-Step Order Timeline */}
                    <div className="pt-2">
                      <div className="text-xs font-bold text-slate-500 mb-2">सौदा प्रगति (Deal Progress):</div>
                      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                          1. सौदा तय ✓
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          ord.status !== 'CREATED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          2. माल तैयार
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          isInTransit || isCompleted ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          3. उठान / रवाना
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          isCompleted ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          4. फैक्ट्री पहुंच
                        </div>
                        <div className={`p-2 rounded-lg font-bold border ${
                          isCompleted ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          5. बैंक में पैसा
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🏠 TAB 6: COLD STORAGE & PRESERVATION (भंडारण) */}
      {/* ========================================================================= */}
      {activeTab === 'storage' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              कोल्ड स्टोरेज (Fasal Rakhne Ki Jagah Dekhein)
            </h2>
            <p className="text-xs text-slate-500">
              दाम कम है? फसल सुरक्षित रखें और भाव बढ़ने पर बाद में बेचें।
            </p>
          </div>

          {/* Simple Simulator: Sell Now vs Store */}
          <div className="bg-white rounded-2xl border-2 border-cyan-300 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">❄️</span>
              <h3 className="text-base font-black text-slate-900">
                मुनाफा जांचें: अभी बेचें या कोल्ड स्टोर में रखें?
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  आज का भाव (₹/kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={scenarioParams.currentOfferPrice}
                  onChange={(e) => setScenarioParams({ ...scenarioParams, currentOfferPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  भविष्य में अनुमानित भाव (₹/kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={scenarioParams.expectedFuturePrice}
                  onChange={(e) => setScenarioParams({ ...scenarioParams, expectedFuturePrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-cyan-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  स्टोरेज का समय
                </label>
                <select
                  value={scenarioParams.months}
                  onChange={(e) => setScenarioParams({ ...scenarioParams, months: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  <option value={1}>1 महीना</option>
                  <option value={2}>2 महीने</option>
                  <option value={3}>3 महीने (मानक)</option>
                  <option value={6}>6 महीने</option>
                </select>
              </div>
            </div>

            {scenarioResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">विकल्प 1: आज बेचने पर</span>
                  <div className="text-xl font-black text-slate-900">
                    ₹{scenarioResult.currentOfferPricePerKg.toFixed(2)} / किलो
                  </div>
                  <div className="text-[11px] text-slate-500">तुरंत भुगतान, कोई किराया नहीं</div>
                </div>

                <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-800 uppercase text-[10px]">विकल्प 2: कोल्ड स्टोर में रखने पर</span>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      +{scenarioResult.netGainOrLossPerKg > 0 ? `₹${scenarioResult.netGainOrLossPerKg}/kg फायदा` : 'कम फायदा'}
                    </span>
                  </div>
                  <div className="text-xl font-black text-cyan-900">
                    ₹{scenarioResult.estimatedFutureNetRealization.toFixed(2)} / किलो
                  </div>
                  <div className="text-[11px] text-cyan-800 font-semibold">
                    💡 {scenarioResult.recommendation}
                  </div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400">
              *सलाह: यह अनुमान है, भविष्य की बाजार कीमत पर निर्भर करता है।
            </div>
          </div>

          {/* Cold Storage Facilities List */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">पास के उपलब्ध कोल्ड स्टोरेज (Nearby Facilities)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">आगरा इम्पीरियल कोल्ड लॉजिस्टिक्स</h4>
                      <p className="text-xs text-slate-500">आगरा बाईपास रोड • 8 km दूर</p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      खाली जगह: 2,400 टन
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    किराया: <strong>₹0.45 प्रति किलो / महीना</strong> • डिजिटल पर्ची उपलब्ध
                  </div>
                </div>
                <button
                  onClick={() => alert('कोल्ड स्टोर बुकिंग अनुरोध दर्ज हुआ। Imperial Cold आपसे संपर्क करेगा।')}
                  className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                >
                  जगह बुक करें (Book Space)
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">मथुरा कोल्ड चेन हब</h4>
                      <p className="text-xs text-slate-500">मथुरा रोड • 18 km दूर</p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      खाली जगह: 1,800 टन
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    किराया: <strong>₹0.40 प्रति किलो / महीना</strong> • आलू व प्याज भंडारण
                  </div>
                </div>
                <button
                  onClick={() => alert('कोल्ड स्टोर बुकिंग अनुरोध दर्ज हुआ। Mathura Hub आपसे संपर्क करेगा।')}
                  className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                >
                  जगह बुक करें (Book Space)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🤝 TAB 7: AGGREGATOR EXPLANATION (कई किसान मिलकर बेचें) */}
      {/* ========================================================================= */}
      {activeTab === 'aggregator_info' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-amber-300 shadow-sm space-y-6 animate-fadeIn">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              कई किसान मिलकर बेचें (Kai Kisan Milkar Bechein)
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              संग्राहक (Aggregator) क्यों जरूरी है?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              अगर आपका माल कम है, तो आसपास के दूसरे किसानों के साथ मिलकर बड़ी मात्रा में बेचा जा सकता है।
            </p>
          </div>

          {/* Simple Visual Explanation */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 text-xs sm:text-sm">
            <div className="font-bold text-amber-900">सरल उदाहरण (Simple Example):</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="block text-slate-500 text-[10px]">आपका माल</span>
                <span className="text-amber-800 text-base">15 टन</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="block text-slate-500 text-[10px]">किसान B (सुरेश)</span>
                <span className="text-amber-800 text-base">20 टन</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="block text-slate-500 text-[10px]">किसान C (महेंद्र)</span>
                <span className="text-amber-800 text-base">25 टन</span>
              </div>
              <div className="bg-amber-600 text-white p-3 rounded-xl border border-amber-700">
                <span className="block text-amber-200 text-[10px]">कुल बल्क बैच</span>
                <span className="text-white text-base">60 टन ट्रकलोड</span>
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed text-xs">
              फैक्ट्रियों (जैसे चिप्स कंपनी) को 60 से 100 टन का पूरा ट्रक चाहिए होता है। स्थानीय संग्राहक (Aggregator) आपके गाँव से माल उठाता है, गुणवत्ता जांचता है और कंपनी से <strong>₹1.50 से ₹2.50 प्रति किलो ज्यादा भाव</strong> दिलवाता है।
            </p>
          </div>

          {/* Local Aggregator Card */}
          <div className="border border-slate-200 p-5 rounded-2xl bg-slate-50 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-700">आपके इलाके में उपलब्ध संग्राहक</span>
                <h4 className="text-base font-black text-slate-900">विक्रम सिंह (आगरा कृषि कलेक्टिव्स)</h4>
                <div className="text-xs text-slate-500">📍 12 km दूर • आगरा-मथुरा क्षेत्र • 4.9★ रेटिंग</div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                सत्यापित आढ़ती
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">मांग:</span>
                <span className="font-bold text-slate-900">आलू चिप्सोना (60 टन बैच बना रहे हैं)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ऑफर भाव:</span>
                <span className="font-black text-emerald-700">₹20.50 / किलो (खेत से सीधा उठान)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => handleJoinAggregatorBatch()}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>मुझे इस बैच में शामिल होना है (Join Batch & Make Offer)</span>
              </button>
              <button
                onClick={() => handleNavigateTab('buyers')}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                सीधे खरीदार को बेचना है
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 👤 TAB: UNIFIED FARMER PROFILE, PASSPORT, FIELDS & CROP RECORDS */}
      {/* ========================================================================= */}
      {(activeTab === 'profile' || activeTab === 'activities') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent" />
          <p className="text-sm font-bold text-slate-600">
            {lang === 'hi' ? 'किसान प्रोफाइल व पासपोर्ट पेज पर ले जाया जा रहा है...' : 'Navigating to Farmer Profile & Passport page...'}
          </p>
          <div>
            <button
              onClick={() => onNavigate ? onNavigate('/profile') : (window.location.href = '/profile')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              {lang === 'hi' ? 'प्रोफाइल पेज खोलें' : 'Open Profile Page'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🏛️ TAB: OFFICIAL GOVERNMENT MANDI PRICES (सरकारी मंडी भाव) */}
      {/* ========================================================================= */}
      {activeTab === 'mandi_prices' && (
        <MandiPricesView
          user={user}
          lang={lang === 'hi' ? 'hi' : 'en'}
          farmerListings={listings}
          onFindBuyersForCrop={(cropName) => {
            setBuyerFilterCrop(cropName);
            handleNavigateTab('buyers');
          }}
          onListCrop={(cropName, modalPrice) => {
            setWizardForm(prev => ({
              ...prev,
              cropName: cropName || 'Potato',
              customCropName: cropName || '',
              expectedPricePerKg: modalPrice ? Math.round(modalPrice / 100) : prev.expectedPricePerKg
            }));
            setWizardStep(1);
            setShowAddWizard(true);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom on phones) */}
      {/* ========================================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1 flex items-center justify-around">
        <button
          onClick={() => handleNavigateTab('home')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center ${
            activeTab === 'home' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Home className="h-5 w-5 mb-0.5" />
          <span>{t.home}</span>
        </button>

        <button
          onClick={() => handleNavigateTab('listings')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center ${
            activeTab === 'listings' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Sprout className="h-5 w-5 mb-0.5" />
          <span>{t.myCrops}</span>
        </button>

        <button
          onClick={() => handleNavigateTab('mandi_prices')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center ${
            activeTab === 'mandi_prices' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Landmark className="h-5 w-5 mb-0.5" />
          <span>{lang === 'hi' ? 'मंडी भाव' : 'Mandi'}</span>
        </button>

        {/* Central Add Crop Button */}
        <button
          onClick={() => {
            setWizardStep(1);
            setShowAddWizard(true);
          }}
          className="flex flex-col items-center justify-center -mt-5 h-12 w-12 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold"
          title="फसल बेचें"
        >
          <Plus className="h-6 w-6" />
        </button>

        <button
          onClick={() => handleNavigateTab('buyers')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center ${
            activeTab === 'buyers' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Search className="h-5 w-5 mb-0.5" />
          <span>{t.findBuyers}</span>
        </button>

        <button
          onClick={() => handleNavigateTab('orders')}
          className={`flex flex-col items-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all min-h-[44px] justify-center relative ${
            activeTab === 'orders' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <Package className="h-5 w-5 mb-0.5" />
          <span>{t.myDeals}</span>
          {activeOrdersCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-600" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 5. STEP-BY-STEP ADD PRODUCE WIZARD MODAL (MERA MAAL BECHEIN) */}
      {/* ========================================================================= */}
      {showAddWizard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto border border-slate-100">
            
            {/* Wizard Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  कदम {wizardStep} / 6 (Step {wizardStep} of 6)
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  अपना माल बेचें (Apna Maal Bechein)
                </h3>
              </div>
              <button
                onClick={handleCloseWizard}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(wizardStep / 6) * 100}%` }}
              />
            </div>

            {/* STEP 1: कौन सी फसल है? */}
            {wizardStep === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    कौन सी फसल बेचना चाहते हैं?
                  </h4>
                  <p className="text-xs text-slate-500">नीचे अपनी फसल चुनें:</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {standardCrops.map((c) => {
                    const isSelected = wizardForm.cropName === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setWizardForm({
                            ...wizardForm,
                            cropName: c.id,
                            variety: c.defaultVariety
                          });
                        }}
                        className={`p-3.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 min-h-[95px] ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-3xl">{c.icon}</span>
                        <div className="text-xs font-black text-slate-900">
                          {c.nameHi} <span className="text-[10px] text-slate-500 block font-normal">({c.nameEn})</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Other Crop Option */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setWizardForm({ ...wizardForm, cropName: 'Other' })}
                    className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      wizardForm.cropName === 'Other'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    ➕ अन्य फसल (Other Crop)
                  </button>
                  {wizardForm.cropName === 'Other' && (
                    <input
                      type="text"
                      placeholder="फसल का नाम लिखें (e.g. सरसो / Mustard)"
                      value={wizardForm.customCropName}
                      onChange={(e) => setWizardForm({ ...wizardForm, customCropName: e.target.value })}
                      className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: आपके पास कितना माल है? */}
            {wizardStep === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आपके पास कितना माल है?
                  </h4>
                  <p className="text-xs text-slate-500">मात्रा और इकाई (Unit) बताएं:</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={wizardForm.quantityValue}
                      onChange={(e) => setWizardForm({ ...wizardForm, quantityValue: Math.max(1, Number(e.target.value)) })}
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 text-xl font-black text-slate-900 text-center bg-white"
                    />
                    <select
                      value={wizardForm.quantityUnit}
                      onChange={(e) => setWizardForm({ ...wizardForm, quantityUnit: e.target.value as any })}
                      className="px-3 py-3 rounded-xl border-2 border-slate-300 text-sm font-bold bg-white text-slate-800"
                    >
                      <option value="quintal">क्विंटल (Quintal)</option>
                      <option value="ton">टन (Tonne)</option>
                    </select>
                  </div>

                  {/* Quick Addition Chips */}
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-semibold">तुरंत जोड़ें:</span>
                    {[5, 10, 25, 50, 100].map((addVal) => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => setWizardForm({ ...wizardForm, quantityValue: wizardForm.quantityValue + addVal })}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        +{addVal}
                      </button>
                    ))}
                  </div>

                  <div className="text-center text-xs text-slate-500 pt-1">
                    {wizardForm.quantityUnit === 'quintal' 
                      ? `${wizardForm.quantityValue} क्विंटल = ${(wizardForm.quantityValue / 10).toFixed(1)} टन` 
                      : `${wizardForm.quantityValue} टन = ${wizardForm.quantityValue * 10} क्विंटल`}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: माल कब तैयार होगा? */}
            {wizardStep === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आपका माल कब तैयार होगा?
                  </h4>
                  <p className="text-xs text-slate-500">उठान के लिए उपयुक्त समय चुनें:</p>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'ready_now', labelHi: '🟢 अभी तैयार है (Ready Now)', desc: 'माल कट चुका है, तुरंत उठान चाहिए' },
                    { id: '1_week', labelHi: '🟡 1 हफ्ते में (In 1 Week)', desc: 'कटाई चल रही है, 7 दिन में तैयार' },
                    { id: '15_days', labelHi: '🟠 15 दिन में (In 15 Days)', desc: 'दो हफ्ते बाद उठान के लिए' },
                    { id: '1_month', labelHi: '🔵 1 महीने में (In 1 Month)', desc: 'खेत में खड़ी फसल का पहले से सौदा' },
                    { id: 'custom_date', labelHi: '📅 खुद तारीख चुनें (Pick Date)', desc: 'निश्चित तारीख' },
                  ].map((timing) => {
                    const isSelected = wizardForm.harvestTiming === timing.id;
                    return (
                      <div
                        key={timing.id}
                        onClick={() => setWizardForm({ ...wizardForm, harvestTiming: timing.id as any })}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-600 font-bold text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-extrabold text-sm">{timing.labelHi}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{timing.desc}</div>
                        </div>
                        <input
                          type="radio"
                          name="harvestTiming"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-emerald-600 h-4 w-4"
                        />
                      </div>
                    );
                  })}

                  {wizardForm.harvestTiming === 'custom_date' && (
                    <div className="pt-2">
                      <input
                        type="date"
                        value={wizardForm.availableDate}
                        onChange={(e) => setWizardForm({ ...wizardForm, availableDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: फसल की किस्म और गुणवत्ता */}
            {wizardStep === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    फसल की किस्म और गुणवत्ता
                  </h4>
                  <p className="text-xs text-slate-500">Variety और Quality बताएं:</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      फसल की किस्म (Variety):
                    </label>
                    <input
                      type="text"
                      value={wizardForm.variety}
                      onChange={(e) => setWizardForm({ ...wizardForm, variety: e.target.value })}
                      placeholder="उदा. Kufri Jyoti / Chipsona / Sharbati"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      फसल की गुणवत्ता (Quality):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { grade: 'Grade A', label: '🟢 अच्छी', sub: 'प्रीमियम / साफ' },
                        { grade: 'Grade B', label: '🟡 सामान्य', sub: 'स्टैंडर्ड' },
                        { grade: 'Grade C', label: '🔴 कम', sub: 'प्रोसेसिंग' }
                      ].map((q) => {
                        const isSelected = wizardForm.qualityGrade === q.grade;
                        return (
                          <button
                            key={q.grade}
                            type="button"
                            onClick={() => setWizardForm({ ...wizardForm, qualityGrade: q.grade })}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-sm font-black text-slate-900">{q.label}</div>
                            <div className="text-[10px] text-slate-500">{q.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Advanced Specs Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSpecs(!showAdvancedSpecs)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedSpecs ? 'rotate-180' : ''}`} />
                      <span>और जानकारी (साइज़, नमी - वैकल्पिक)</span>
                    </button>

                    {showAdvancedSpecs && (
                      <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">साइज़ मिन (mm):</label>
                          <input
                            type="number"
                            value={wizardForm.sizeMinMm}
                            onChange={(e) => setWizardForm({ ...wizardForm, sizeMinMm: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block">साइज़ मैक्स (mm):</label>
                          <input
                            type="number"
                            value={wizardForm.sizeMaxMm}
                            onChange={(e) => setWizardForm({ ...wizardForm, sizeMaxMm: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: आपका माल कहाँ है? (Location) */}
            {wizardStep === 5 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आपका माल कहाँ रखा है?
                  </h4>
                  <p className="text-xs text-slate-500">गाड़ी पिकअप के लिए जगह बताएं:</p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">गाँव (Village):</label>
                      <input
                        type="text"
                        value={wizardForm.village}
                        onChange={(e) => setWizardForm({ ...wizardForm, village: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">तहसील (Tehsil):</label>
                      <input
                        type="text"
                        value={wizardForm.tehsil}
                        onChange={(e) => setWizardForm({ ...wizardForm, tehsil: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">जिला (District):</label>
                      <input
                        type="text"
                        value={wizardForm.district}
                        onChange={(e) => setWizardForm({ ...wizardForm, district: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWizardForm({
                        ...wizardForm,
                        village: 'Khandauli',
                        tehsil: 'Etmadpur',
                        district: 'Agra'
                      });
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span>मेरी प्रोफाइल की लोकेशन भरें (Use Profile Location)</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: उम्मीद की कीमत (Expected Price) & Confirmation */}
            {wizardStep === 6 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="text-center space-y-1">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    आप कितने रुपये में बेचना चाहते हैं?
                  </h4>
                  <p className="text-xs text-slate-500">आपकी उम्मीद की कीमत (Expected Rate):</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-black text-slate-700">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      value={wizardForm.expectedPricePerKg}
                      onChange={(e) => setWizardForm({ ...wizardForm, expectedPricePerKg: Number(e.target.value) })}
                      className="w-32 px-3 py-2.5 rounded-xl border-2 border-slate-300 text-2xl font-black text-emerald-700 text-center bg-white"
                    />
                    <span className="text-base font-bold text-slate-700">/ किलो</span>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                    💡 <strong>सलाह:</strong> यह आपकी उम्मीद की कीमत है। खरीदार इससे थोड़ा अलग ऑफर भी दे सकता है। अंतिम फैसला हमेशा आपका होगा।
                  </div>
                </div>

                {/* Final Summary Card before submission */}
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 space-y-2 text-xs">
                  <div className="font-extrabold text-emerald-950 text-sm border-b border-emerald-200 pb-1.5 flex justify-between">
                    <span>दर्ज होने वाली जानकारी:</span>
                    <span>✓ तैयार</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-emerald-900">
                    <div>फसल: <strong>{wizardForm.cropName === 'Other' ? wizardForm.customCropName : wizardForm.cropName} ({wizardForm.variety})</strong></div>
                    <div>मात्रा: <strong>{wizardForm.quantityValue} {wizardForm.quantityUnit === 'quintal' ? 'क्विंटल' : 'टन'}</strong></div>
                    <div>जगह: <strong>{wizardForm.village}, {wizardForm.district}</strong></div>
                    <div>उम्मीद भाव: <strong>₹{wizardForm.expectedPricePerKg}/kg</strong></div>
                  </div>
                </div>

                {wizardSuccessMessage && (
                  <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold text-center animate-bounce">
                    ✓ {wizardSuccessMessage}
                  </div>
                )}
              </div>
            )}

            {/* Wizard Navigation Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>पीछे (Back)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseWizard}
                  className="py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  रद्द करें (Cancel)
                </button>
              )}

              {wizardStep < 6 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep + 1)}
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs"
                >
                  <span>आगे बढ़ें (Next)</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleWizardSubmit}
                  className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5"
                >
                  <span>मेरा माल बाजार में डालें 🚀</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VOICE ASSISTANT DEMO MODAL */}
      {/* ========================================================================= */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
              🎤
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                जल्द आ रहा है (Coming Soon)
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                बोलकर बताएं (Voice Input)
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                भविष्य में आप सिर्फ बोल सकेंगे: <br />
                <strong className="text-slate-800">"मेरे पास 50 क्विंटल आलू है, ₹20 भाव चाहिए"</strong> <br />
                और KisanConnect आपकी फसल अपने आप दर्ज कर देगा।
              </p>
            </div>
            <button
              onClick={() => setShowVoiceModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              समझ गया (Close)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TRANSPARENT MATCH BREAKDOWN MODAL */}
      {/* ========================================================================= */}
      {selectedMatchExplanation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {selectedMatchExplanation.matchScore}% अनुकूलता का हिसाब
                </h3>
                <p className="text-xs text-slate-500">
                  यह खरीदार आपकी फसल के लिए क्यों सही है:
                </p>
              </div>
              <button 
                onClick={() => setSelectedMatchExplanation(null)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {selectedMatchExplanation.breakdown.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{item.factor}</span>
                    <span className="text-[10px] text-slate-400 ml-2">(अधिकतम {item.weight}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full rounded-full" 
                        style={{ width: `${(item.earned / item.weight) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-emerald-800 w-8 text-right">
                      {item.earned}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
              <span className="text-xs font-bold text-emerald-950 block">मुख्य कारण (Compatibility Reasons):</span>
              <ul className="text-xs text-emerald-900 space-y-0.5">
                {selectedMatchExplanation.reasons.map((r, i) => (
                  <li key={i}>✓ {r}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setSelectedMatchExplanation(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              बंद करें (Close)
            </button>
          </div>
        </div>
      )}

      {/* NaLamKI Farm Traceability Modal */}
      <FarmTraceabilityModal
        isOpen={showTraceabilityModal}
        onClose={() => {
          setShowTraceabilityModal(false);
          setSelectedListingForTraceability(null);
        }}
        listingId={selectedListingForTraceability?.id}
        initialListing={selectedListingForTraceability || undefined}
        farmerId={user?.id}
        language={lang === 'hi' ? 'hi' : 'en'}
      />

      {/* Field Activity Logger Modal */}
      <FieldActivityLoggerModal
        isOpen={showActivityLoggerModal}
        onClose={() => setShowActivityLoggerModal(false)}
        listings={listings}
        onActivityCreated={() => fetchData()}
        language={lang === 'hi' ? 'hi' : 'en'}
      />

      {/* ========================================================================= */}
      {/* 🤝 MAKE OFFER MODAL (Farmer -> Buyer) */}
      {/* ========================================================================= */}
      {makeOfferModal.isOpen && makeOfferModal.requirement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  🤝
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    सौदा प्रस्ताव भेजें (Make Direct Offer)
                  </h3>
                  <p className="text-xs text-slate-500">
                    खरीदार: <span className="font-bold text-slate-700">{makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMakeOfferModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Produce & Requirement Facts Card */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">फसल और किस्म:</span>
                <span className="font-extrabold text-slate-900">
                  {makeOfferModal.listing?.cropName || makeOfferModal.requirement.cropName} ({makeOfferModal.listing?.variety || makeOfferModal.requirement.variety})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">आपकी उपलब्ध मात्रा (Listing):</span>
                <span className="font-extrabold text-emerald-700">
                  {makeOfferModal.listing?.quantityTons || 'N/A'} टन ({Number(makeOfferModal.listing?.quantityTons || 0) * 10} क्विंटल)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">खरीदार की मांग (Demand):</span>
                <span className="font-extrabold text-blue-800">
                  {makeOfferModal.requirement.quantityTons} टन (संकेतक भाव: ₹{makeOfferModal.requirement.offeredPricePerKg}/किग्रा)
                </span>
              </div>
            </div>

            <form onSubmit={handleSendOfferSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    प्रस्तावित मात्रा (Tons) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={makeOfferModal.listing ? Number(makeOfferModal.listing.quantityTons) : 1000}
                    required
                    value={makeOfferModal.quantityTons}
                    onChange={(e) => setMakeOfferModal({ ...makeOfferModal, quantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    = {Math.round(makeOfferModal.quantityTons * 10)} क्विंटल
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    आपका भाव (₹/kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={makeOfferModal.offeredPricePerKg}
                    onChange={(e) => setMakeOfferModal({ ...makeOfferModal, offeredPricePerKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    = ₹{Math.round(makeOfferModal.offeredPricePerKg * 100)} / क्विंटल
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  डिलीवरी की शर्तें (Delivery Terms)
                </label>
                <select
                  value={makeOfferModal.deliveryTerms}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, deliveryTerms: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs bg-white"
                >
                  <option value="Farm Gate Pickup">खेत से उठान (Farm Gate Pickup)</option>
                  <option value="Mandi Delivery">मंडी केंद्र पर डिलीवरी (Mandi Delivery)</option>
                  <option value="Direct Processing Plant">खरीदार प्रोसेसिंग प्लांट (Direct Factory)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  खरीदार के लिए संदेश / विवरण (Message)
                </label>
                <textarea
                  rows={2}
                  value={makeOfferModal.message}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, message: e.target.value })}
                  placeholder="उदा. ग्रेड-A छांटी हुई फसल, सूखी बोरियों में पैक..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Live Escrow Total Value */}
              <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase tracking-wider">
                    अनुमानित कुल सौदा मूल्य (Total Value)
                  </span>
                  <div className="text-lg font-black text-emerald-950">
                    ₹{Math.round(makeOfferModal.quantityTons * 1000 * makeOfferModal.offeredPricePerKg).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 font-black px-2 py-0.5 rounded-full">
                    🛡️ सुरक्षित एस्क्रो
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMakeOfferModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={makeOfferModal.isSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {makeOfferModal.isSubmitting ? (
                    <span>भेजा जा रहा है...</span>
                  ) : (
                    <>
                      <span>प्रस्ताव भेजें (Submit Offer)</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔄 COUNTER OFFER MODAL (Farmer -> Buyer) */}
      {/* ========================================================================= */}
      {counterModal.isOpen && counterModal.offer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg">
                  🔄
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    जवाबी प्रस्ताव दें (Counter Offer)
                  </h3>
                  <p className="text-xs text-slate-500">
                    खरीदार: <span className="font-bold text-slate-700">{counterModal.offer.buyerName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCounterModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Negotiation History Trail if exists */}
            {counterModal.offer.negotiationHistory && counterModal.offer.negotiationHistory.length > 0 && (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2 text-xs">
                <span className="font-extrabold text-[11px] text-slate-600 uppercase tracking-wider block">
                  बातचीत का इतिहास (Negotiation Trail)
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {counterModal.offer.negotiationHistory.map((h: any, idx: number) => (
                    <div key={idx} className="bg-white p-2 rounded-xl border border-slate-100 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className={h.byRole === 'buyer' ? 'text-blue-700' : 'text-emerald-700'}>
                          दौर {h.round}: {h.byRole === 'buyer' ? 'खरीदार (Buyer)' : 'किसान (Farmer)'}
                        </span>
                        <span>₹{h.pricePerKg}/kg • {h.quantityTons}T</span>
                      </div>
                      {h.notes && <p className="text-slate-500 italic">"{h.notes}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleCounterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    संशोधित मात्रा (Tons) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={counterModal.counterQuantityTons}
                    onChange={(e) => setCounterModal({ ...counterModal, counterQuantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    नया भाव (₹/kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={counterModal.counterPricePerKg}
                    onChange={(e) => setCounterModal({ ...counterModal, counterPricePerKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    पिकअप / डिलीवरी शर्तें
                  </label>
                  <select
                    value={counterModal.pickupTerms}
                    onChange={(e) => setCounterModal({ ...counterModal, pickupTerms: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Farm Gate Pickup">Farm Gate Pickup (खेत से उठाव)</option>
                    <option value="Buyer to Arrange Transport">Buyer Arranges Transport (खरीदार का वाहन)</option>
                    <option value="Farmer Delivery to Facility">Farmer Delivery to Facility (फ़ैक्टरी डिलीवरी)</option>
                    <option value="Mandi Delivery">Mandi Delivery (मंडी सुपुर्दगी)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    अपेक्षित डिलीवरी तारीख
                  </label>
                  <input
                    type="date"
                    value={counterModal.targetDate}
                    onChange={(e) => setCounterModal({ ...counterModal, targetDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  संदेश (Message / Reason)
                </label>
                <textarea
                  rows={2}
                  value={counterModal.message}
                  onChange={(e) => setCounterModal({ ...counterModal, message: e.target.value })}
                  placeholder="उदा. न्यूनतम ₹22/किलो से कम में संभव नहीं है..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-900 block uppercase">
                    संशोधित कुल सौदा (New Total)
                  </span>
                  <div className="text-lg font-black text-amber-950">
                    ₹{Math.round(counterModal.counterQuantityTons * 1000 * counterModal.counterPricePerKg).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCounterModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={counterModal.isSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {counterModal.isSubmitting ? 'भेजा जा रहा है...' : 'जवाबी प्रस्ताव भेजें (Send Counter)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default FarmerDashboard;
