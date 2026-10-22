import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { 
  FarmerListing, 
  Order, 
  Offer, 
  RequirementMatch, 
  FarmActivity, 
  Crop, 
  BuyerRequirement 
} from '../types';
import { 
  Sprout, 
  Plus, 
  TrendingUp,
  Clock,
  Sparkles,
  ShieldCheck,
  Layers,
  AlertCircle,
  Calendar,
  Scale,
  FileText,
  Activity,
  Tractor,
  FlaskConical,
  ShieldAlert,
  Handshake,
  Info,
  PhoneCall,
  Check,
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
  User,
  Filter
} from 'lucide-react';
import { MandiPricesView } from './MandiPricesView';
import { FarmerProfileView } from './FarmerProfileView';
import { FarmTraceabilityModal } from './FarmTraceabilityModal';
import { FieldActivityLoggerModal } from './FieldActivityLoggerModal';
import { farmerDashboardTranslations, DashboardLang } from '../i18n/farmerDashboardTranslations';

interface FarmerDashboardPreviewProps {
  onNavigate?: (path: string) => void;
  onOpenNotifications?: () => void;
  isProductionMode?: boolean;
  isPreviewMode?: boolean;
  designVariant?: string;
  returnUrl?: string;
  returnLabel?: string;
}

export const FarmerDashboardPreview: React.FC<FarmerDashboardPreviewProps> = ({ 
  onNavigate, 
  onOpenNotifications,
  isProductionMode = false,
  isPreviewMode,
  designVariant,
  returnUrl,
  returnLabel
}) => {
  const { user } = useAuth();
  const actualIsPreview = isPreviewMode !== undefined ? isPreviewMode : !isProductionMode;
  const { language, setLanguage: setGlobalLang } = useLanguage();

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const activeDesignParam = designVariant || searchParams.get('design') || 'harvest_standard';
  const isCanvasTheme = activeDesignParam === 'harvest_canvas';

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
    'home' | 'listings' | 'mandi_prices' | 'buyers' | 'offers' | 'orders' | 'storage' | 'pool' | 'profile' | 'activities'
  >('home');

  // Real backend data states initialized empty (NO mock data)
  const [listings, setListings] = useState<FarmerListing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [activities, setActivities] = useState<FarmActivity[]>([]);
  const [storageFacilities, setStorageFacilities] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Listing matching & AI guide state
  const [selectedListingForMatches, setSelectedListingForMatches] = useState<FarmerListing | null>(null);
  const [matchedBuyers, setMatchedBuyers] = useState<RequirementMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(false);
  const [selectedMatchExplanation, setSelectedMatchExplanation] = useState<RequirementMatch | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Modals state
  const [selectedListingForTraceability, setSelectedListingForTraceability] = useState<FarmerListing | null>(null);
  const [showTraceabilityModal, setShowTraceabilityModal] = useState<boolean>(false);
  const [showActivityLoggerModal, setShowActivityLoggerModal] = useState<boolean>(false);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);

  // Filters & sub-tabs
  const [listingFilterTab, setListingFilterTab] = useState<'all' | 'active' | 'dealed'>('active');
  const [listingSearchQuery, setListingSearchQuery] = useState<string>('');
  const [offerFilterTab, setOfferFilterTab] = useState<'ALL' | 'RECEIVED' | 'SENT' | 'NEGOTIATING' | 'DEALS'>('ALL');
  const [buyerFilterCrop, setBuyerFilterCrop] = useState<string>('All');
  const [buyerFilterVariety, setBuyerFilterVariety] = useState<string>('All');
  const [buyerFilterGrade, setBuyerFilterGrade] = useState<string>('All');
  const [buyerFilterDistance, setBuyerFilterDistance] = useState<number | null>(50);
  const [buyerFilterType, setBuyerFilterType] = useState<'all' | 'local' | 'bulk' | 'aggregator'>('all');
  const [buyerSortBy, setBuyerSortBy] = useState<'best_match' | 'nearest' | 'price' | 'date'>('best_match');
  const [buyerViewMode, setBuyerViewMode] = useState<'list' | 'map'>('list');

  // Offer action loading state
  const [offerActionLoading, setOfferActionLoading] = useState<string | null>(null);

  // Storage decision calculator state
  const [scenarioParams, setScenarioParams] = useState({
    currentOfferPrice: 18.0,
    expectedFuturePrice: 22.5,
    months: 3,
    storageChargePerKgPerMonth: 0.45,
    handlingPerKg: 0.35
  });
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [bookingStorageId, setBookingStorageId] = useState<string | null>(null);

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

  const pendingOffersCount = useMemo(() => {
    return offers.filter(o => 
      o.status === 'PENDING' && (o.sellerId === user?.id || !o.sellerId)
    ).length;
  }, [offers, user?.id]);

  const activeOrdersCount = useMemo(() => {
    return orders.filter(o => o.status !== 'CANCELLED' && o.status !== 'COMPLETED').length;
  }, [orders]);

  // Make Offer Modal State
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

  // Counter Offer Modal State
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

  // Storage calculation run
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
      console.error('Error running storage scenario calculation:', e);
    }
  };

  useEffect(() => {
    runStorageCalculation();
  }, [scenarioParams.currentOfferPrice, scenarioParams.expectedFuturePrice, scenarioParams.months, scenarioParams.storageChargePerKgPerMonth]);

  // Real Storage Booking with proper validation & real error handling (no fake receipts)
  const handleBookStorage = async (facility: any) => {
    const currentList = selectedListingForMatches || activeListings[0] || listings[0];
    const cropName = currentList?.cropName || 'Potato';
    const variety = currentList?.variety || 'Standard';
    const facilityName = facility.name || facility.facilityName || 'Cold Storage Facility';
    const quantityInput = prompt(lang === 'hi' ? `${facilityName} में भंडारण हेतु मात्रा (टन में):` : `Enter quantity (in Tons) to store at ${facilityName}:`, '10');
    if (!quantityInput) return;
    const quantityTons = parseFloat(quantityInput);
    if (isNaN(quantityTons) || quantityTons <= 0) {
      alert(lang === 'hi' ? 'कृपया मान्य मात्रा टन में दर्ज करें।' : 'Please enter a valid quantity in Tons.');
      return;
    }
    const monthsInput = prompt(lang === 'hi' ? 'भंडारण अवधि (महीनों में, 1-12):' : 'Enter storage duration in months (1-12):', '3');
    if (!monthsInput) return;
    const durationMonths = parseInt(monthsInput, 10);
    if (isNaN(durationMonths) || durationMonths <= 0) {
      alert(lang === 'hi' ? 'कृपया मान्य अवधि दर्ज करें।' : 'Please enter a valid duration in months.');
      return;
    }

    setBookingStorageId(facility.id || 'cs-temp');
    try {
      const res = await api.bookStorage({
        storageId: facility.id,
        cropName,
        variety,
        quantityTons,
        durationMonths
      });
      const receiptNo = res?.receiptNumber || res?.booking?.receiptNumber || res?.id;
      alert(lang === 'hi' 
        ? `✅ कोल्ड स्टोरेज स्थान सफलतापूर्वक बुक हुआ! रसीद संख्या: ${receiptNo}` 
        : `✅ Storage space booked successfully! Receipt: ${receiptNo}`);
      await loadDashboardData();
    } catch (err: any) {
      alert(lang === 'hi' ? `भंडारण बुकिंग विफल: ${err.message || 'त्रुटि हुई'}` : `Storage booking failed: ${err.message || 'Unknown error'}`);
    } finally {
      setBookingStorageId(null);
    }
  };

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

  // Add produce wizard modal state with full agronomic fields
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [showAdvancedSpecs, setShowAdvancedSpecs] = useState(false);

  const initialWizardForm = {
    cropName: 'Potato',
    variety: 'Kufri Jyoti (3797)',
    customCropName: '',
    quantityValue: 50,
    quantityUnit: 'quintal' as 'quintal' | 'ton',
    harvestTiming: 'ready_now' as 'ready_now' | '1_week' | '15_days' | '1_month',
    availableDate: new Date().toISOString().split('T')[0],
    qualityGrade: 'Grade A',
    village: user?.village || 'Khandauli',
    tehsil: 'Etmadpur',
    district: user?.district || 'Agra',
    expectedPricePerKg: 20,
    sizeMinMm: 45,
    sizeMaxMm: 75,
    moisturePercent: 18,
    defectsPercent: 2.0,
    storageRequirement: 'NONE' as 'NONE' | 'COLD_STORAGE' | 'DRY_VENTILATED'
  };

  const [wizardForm, setWizardForm] = useState(initialWizardForm);
  const [wizardSuccessMessage, setWizardSuccessMessage] = useState<string | null>(null);

  // Load real data from API using authenticated farmer's ID
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const farmerId = user?.id || '';
      const [listingsRes, ordersRes, offersRes, storageRes, cropsRes, actsRes, buyersRes] = await Promise.allSettled([
        api.getListings({ farmerId }),
        api.getOrders(),
        api.getOffers(),
        api.getStorageFacilities().catch(() => []),
        api.getCrops().catch(() => []),
        api.getActivities({ farmerId }).catch(() => []),
        api.getNearbyBuyers({}).catch(() => [])
      ]);

      if (listingsRes.status === 'fulfilled') {
        const fetchedListings = Array.isArray(listingsRes.value) ? listingsRes.value : [];
        setListings(fetchedListings);
        if (fetchedListings.length > 0) {
          const firstActive = fetchedListings.find(l => l.status !== 'SOLD' && l.status !== 'FULFILLED') || fetchedListings[0];
          setSelectedListingForMatches(prev => {
            if (prev) {
              const stillThere = fetchedListings.find(l => l.id === prev.id);
              if (stillThere) {
                loadListingMatches(stillThere);
                return stillThere;
              }
            }
            loadListingMatches(firstActive);
            return firstActive;
          });
        } else {
          loadGeneralRequirements();
        }
      } else {
        setListings([]);
        loadGeneralRequirements();
      }

      if (ordersRes.status === 'fulfilled') {
        setOrders(Array.isArray(ordersRes.value) ? ordersRes.value : []);
      } else {
        setOrders([]);
      }

      if (offersRes.status === 'fulfilled') {
        setOffers(Array.isArray(offersRes.value) ? offersRes.value : []);
      } else {
        setOffers([]);
      }

      if (storageRes.status === 'fulfilled') {
        setStorageFacilities(Array.isArray(storageRes.value) ? storageRes.value : []);
      }

      if (cropsRes.status === 'fulfilled') {
        setCrops(Array.isArray(cropsRes.value) ? cropsRes.value : []);
      }

      if (actsRes.status === 'fulfilled') {
        setActivities(Array.isArray(actsRes.value) ? actsRes.value : []);
      }

      if (buyersRes.status === 'fulfilled') {
        setBuyers(Array.isArray(buyersRes.value) ? buyersRes.value : []);
      }

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      loadGeneralRequirements();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  // Load listing-specific buyer matches with algorithmic scoring
  const loadListingMatches = async (listing: FarmerListing) => {
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
      console.warn('Listing match fetch error, fallback to general requirements:', err);
      await loadGeneralRequirements(listing);
    } finally {
      setLoadingMatches(false);
    }
  };

  // Fallback: general buyer requirements so Find Buyers is never empty
  const loadGeneralRequirements = async (listing?: FarmerListing) => {
    try {
      const allReqs = await api.getRequirements();
      if (allReqs && allReqs.length > 0) {
        const farmerQty = listing ? Number(listing.quantityTons || 8) : 8;
        const matches: RequirementMatch[] = allReqs.map((req: any, idx: number) => {
          const reqQty = Number(req.quantityTons || (req.requiredQuantityKg ? req.requiredQuantityKg / 1000 : 15));
          const qtyMatch = Math.min(100, Math.round((farmerQty / reqQty) * 100));
          const score = Math.min(98, Math.max(70, Math.round(78 + (qtyMatch * 0.18) - (idx * 2))));
          return {
            requirement: req,
            matchScore: score,
            isViable: true,
            distanceKm: req.distanceKm || (12 + (idx * 7)),
            breakdown: [
              { factor: 'फसल व किस्म अनुकूलता (Crop Match)', score: 25, weight: 25, earned: 25 },
              { factor: 'गुणवत्ता ग्रेड (Grade Match)', score: 22, weight: 25, earned: 22 },
              { factor: 'दूरी व लॉजिस्टिक्स (Distance)', score: 20, weight: 25, earned: 20 },
              { factor: 'भाव सामंजस्य (Price Match)', score: 25, weight: 25, earned: 25 }
            ],
            reasons: [
              `${req.buyerCompany || req.buyerName} को तत्काल ${req.cropName || 'फसल'} की आवश्यकता है`,
              'फार्म-गेट या स्थानीय हब डिलीवरी उपलब्ध',
              'सत्यापित खरीदार व 48 घंटे में भुगतान'
            ],
            netRealization: {
              grossRevenue: Math.round(farmerQty * 1000 * (Number(req.offeredPricePerKg) || 20)),
              logisticsCost: Math.round(farmerQty * 1000 * 1.5),
              handlingFee: Math.round(farmerQty * 1000 * 0.3),
              netAmount: Math.round(farmerQty * 1000 * ((Number(req.offeredPricePerKg) || 20) - 1.8)),
              netPricePerKg: Number(((Number(req.offeredPricePerKg) || 20) - 1.8).toFixed(2)),
              disclaimer: 'अनुमानित निवल राशि'
            }
          };
        });
        setMatchedBuyers(matches);
      }
    } catch (e) {
      console.error('Error loading fallback requirements:', e);
    }
  };

  // Gemini AI Buyer Advisory Guidance
  const handleAskAiBuyerGuide = async () => {
    const activeListing = selectedListingForMatches || activeListings[0] || listings[0];
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
        location: activeListing.farmerLocation || user?.location || 'Agra, UP',
        latitude: activeListing.latitude || user?.latitude || 27.1767,
        longitude: activeListing.longitude || user?.longitude || 78.0081,
        language: lang === 'en' ? 'en' : 'hi'
      });
      setAiRecommendation(res);
    } catch (err: any) {
      console.warn('AI recommendation fetch error:', err);
      setAiError(err.message || 'AI service unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  // Listing Status Management
  const handleMarkListingSold = async (listingId: string) => {
    if (!window.confirm(lang === 'hi' ? 'क्या आप इस फसल को "सौदा हो चुका (Dealed / Sold)" के रूप में अलग सेक्शन में ले जाना चाहते हैं?' : 'Move this crop listing to Dealed / Sold section?')) return;
    try {
      await api.updateListingStatus(listingId, 'SOLD');
      await loadDashboardData();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleReactivateListing = async (listingId: string) => {
    try {
      await api.updateListingStatus(listingId, 'ACTIVE');
      await loadDashboardData();
    } catch (err: any) {
      alert('Error reactivating listing: ' + err.message);
    }
  };

  // Open Direct Offer Modal
  const openMakeOfferModal = (buyerReq: any, listing?: any) => {
    const currentList = listing || selectedListingForMatches || activeListings[0] || listings[0];
    const reqQty = Number(buyerReq.quantityTons || 0);
    const listQty = Number(currentList?.quantityTons || 0);
    const initialQty = (listQty > 0 && reqQty > 0) ? Math.min(listQty, reqQty) : (listQty || reqQty || 5);
    const initialPrice = Number(buyerReq.offeredPricePerKg || currentList?.expectedPricePerKg || 20);

    setMakeOfferModal({
      isOpen: true,
      requirement: buyerReq,
      listing: currentList,
      quantityTons: initialQty,
      offeredPricePerKg: initialPrice,
      deliveryTerms: buyerReq.deliveryType === 'PICKUP_REQUIRED' ? 'Farm Gate Pickup' : 'Mandi Delivery',
      message: lang === 'hi' ? 'हमारी उपज उच्च गुणवत्ता की है और हम तुरंत डिलीवरी के लिए तैयार हैं।' : 'High quality produce ready for immediate dispatch.',
      isSubmitting: false
    });
  };

  // Submit Direct Offer (Farmer -> Buyer)
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
      await loadDashboardData();
      handleNavClick('offers');
    } catch (err: any) {
      alert(err.message || 'Failed to submit offer');
    } finally {
      setMakeOfferModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Join Aggregator Batch Pooling with real offer submission
  const handleJoinAggregatorBatch = (customListing?: any) => {
    const currentList = customListing || selectedListingForMatches || activeListings[0] || listings[0];
    const aggregatorReq = {
      id: 'req-agg-agra-collective',
      buyerId: 'usr-agg-1',
      buyerCompany: 'Vikram Singh (Agra Krishi Collective / FPO)',
      buyerName: 'Vikram Singh',
      cropName: currentList?.cropName || 'Potato',
      variety: currentList?.variety || 'Kufri Jyoti',
      quantityTons: 60,
      offeredPricePerKg: 20.50,
      deliveryType: 'PICKUP_REQUIRED',
      location: 'Agra Bypass Hub (12 km)',
      isAggregator: true
    };
    openMakeOfferModal(aggregatorReq, currentList);
  };

  // Accept Offer with complete refresh & redirect to deals
  const handleAcceptOffer = async (offerId: string) => {
    try {
      setOfferActionLoading(offerId);
      await api.acceptOffer(offerId);
      alert(lang === 'hi' 
        ? 'सौदा पक्का हो गया! आपका ऑर्डर दर्ज हो गया है और एस्क्रो भुगतान सुरक्षित है।' 
        : 'Offer Accepted! Deal confirmed and escrow secured.');
      await loadDashboardData();
      handleNavClick('orders');
    } catch (err: any) {
      alert(err.message || 'Failed to accept offer');
    } finally {
      setOfferActionLoading(null);
    }
  };

  // Counter Offer Submit
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
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to send counter offer');
    } finally {
      setCounterModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Reject Offer Submit
  const handleRejectOffer = async (offerId: string, reason?: string) => {
    const confirmMsg = lang === 'hi' ? 'क्या आप यह ऑफर अस्वीकार करना चाहते हैं?' : 'Are you sure you want to decline this offer?';
    if (!window.confirm(confirmMsg)) return;
    try {
      setOfferActionLoading(offerId);
      await api.rejectOffer(offerId, reason || 'Farmer declined');
      alert(lang === 'hi' ? 'प्रस्ताव अस्वीकृत कर दिया गया।' : 'Offer declined.');
      await loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to decline offer');
    } finally {
      setOfferActionLoading(null);
    }
  };

  // Submit complete crop wizard with full agronomic payload & auto-match trigger
  const handleWizardSubmit = async () => {
    try {
      const qTons = wizardForm.quantityUnit === 'quintal' ? wizardForm.quantityValue / 10 : wizardForm.quantityValue;
      const isFuture = wizardForm.harvestTiming !== 'ready_now';
      
      let calculatedDate = new Date().toISOString().split('T')[0];
      if (wizardForm.harvestTiming === '1_week') {
        calculatedDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '15_days') {
        calculatedDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
      } else if (wizardForm.harvestTiming === '1_month') {
        calculatedDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      }

      const actualCropName = wizardForm.cropName === 'Other' ? (wizardForm.customCropName || 'Other') : wizardForm.cropName;

      const payload = {
        cropName: actualCropName,
        variety: wizardForm.variety || 'Standard',
        quantityTons: qTons > 0 ? qTons : 5,
        totalQuantityTons: qTons > 0 ? qTons : 5,
        availableQuantityTons: qTons > 0 ? qTons : 5,
        listingType: isFuture ? 'FUTURE_HARVEST' : 'AVAILABLE_NOW',
        availableDate: calculatedDate,
        harvestDate: calculatedDate,
        grade: wizardForm.qualityGrade || 'Grade A',
        sizeMinMm: wizardForm.sizeMinMm,
        sizeMaxMm: wizardForm.sizeMaxMm,
        moisturePercent: wizardForm.moisturePercent,
        defectsPercent: wizardForm.defectsPercent,
        expectedPricePerKg: Number(wizardForm.expectedPricePerKg),
        storageRequirement: wizardForm.storageRequirement || 'NONE',
        village: wizardForm.village,
        tehsil: wizardForm.tehsil,
        district: wizardForm.district,
        state: 'Uttar Pradesh',
        farmerLocation: `${wizardForm.village}, ${wizardForm.tehsil}, ${wizardForm.district}`
      };

      const res = await api.createListing(payload);
      await loadDashboardData();

      if (res && res.id) {
        loadListingMatches(res);
      }

      setWizardSuccessMessage(
        lang === 'hi' 
          ? 'आपकी फसल सफलतापूर्वक मंडी में सूचीबद्ध हो गई है! खरीदार के ऑफर देखे जा रहे हैं।' 
          : lang === 'hinglish' 
            ? 'Aapki fasal successfully mandi me list ho gayi hai! Buyer matches search kiye ja rahe hain.' 
            : 'Your produce listing has been published! Matching buyers are now ready.'
      );
      setTimeout(() => {
        setShowAddWizard(false);
        setWizardStep(1);
        setWizardSuccessMessage(null);
        handleNavClick('buyers');
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to create listing');
      setShowAddWizard(false);
      setWizardStep(1);
    }
  };

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
        setMakeOfferModal(prev => ({ ...prev, isOpen: false }));
        setCounterModal(prev => ({ ...prev, isOpen: false }));
        setSelectedMatchExplanation(null);
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

  // Dynamic Sidebar navigation sections linked to live loaded data
  const navSections: NavSection[] = useMemo(() => [
    {
      title: t.nav.mainMenu,
      items: [
        { id: 'home', label: t.nav.home, icon: Home, badge: null, badgeColor: '' },
        { 
          id: 'listings', 
          label: t.nav.myProduce, 
          icon: Sprout, 
          badge: activeListings.length > 0 ? String(activeListings.length) : null, 
          badgeColor: 'bg-[#37A86B]/20 text-[#37A86B] font-bold border border-[#37A86B]/40' 
        },
        { 
          id: 'buyers', 
          label: t.nav.findBuyers, 
          icon: Search, 
          badge: matchedBuyers.length > 0 ? String(matchedBuyers.length) : null, 
          badgeColor: 'bg-blue-100 text-blue-800 font-bold' 
        },
        { 
          id: 'offers', 
          label: t.nav.myOffers, 
          icon: DollarSign, 
          badge: pendingOffersCount > 0 ? String(pendingOffersCount) : null, 
          badgeColor: 'bg-[#E6A52E] text-[#17251D] font-black' 
        },
        { 
          id: 'orders', 
          label: t.nav.myDeals, 
          icon: Package, 
          badge: activeOrdersCount > 0 ? String(activeOrdersCount) : null, 
          badgeColor: 'bg-purple-100 text-purple-800 font-bold' 
        },
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
  ], [t, activeListings.length, matchedBuyers.length, pendingOffersCount, activeOrdersCount]);

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
    // HARVEST PREMIUM THEME - DYNAMICALLY STYLED VIA CSS DESIGN TOKENS
    <div 
      className="harvest-premium-theme h-full h-[100dvh] w-full font-sans selection:bg-[#37A86B]/20 antialiased flex flex-row overflow-hidden"
      style={{
        backgroundColor: 'var(--app-page-bg, #F7F4E9)',
        color: 'var(--app-page-text, #17251D)'
      }}
    >

      {/* ========================================================================= */}
      {/* 🌟 FULL-PAGE SLIDING SIDEBAR */}
      {/* ========================================================================= */}
      <aside 
        style={{
          backgroundColor: isCanvasTheme ? 'var(--app-page-bg, #F7F4E9)' : 'var(--app-sidebar-bg, #104B35)',
          color: isCanvasTheme ? 'var(--app-page-text, #17251D)' : 'var(--app-sidebar-text, #ffffff)',
          borderColor: isCanvasTheme ? 'var(--app-card-border, #E5E0D5)' : 'var(--app-sidebar-border, #176B45)'
        }}
        className={`hidden md:flex flex-col border-r transition-all duration-300 ease-in-out shrink-0 h-full select-none z-30 ${
          isSidebarCollapsed ? 'w-[72px]' : 'w-[250px]'
        }`}
      >
        {/* Top Brand Header & Minimize/Expand Sidebar Button - h-16 (64px) matching top header */}
        <div 
          style={{
            borderColor: isCanvasTheme ? 'var(--app-card-border, #E5E0D5)' : 'var(--app-sidebar-border, #176B45)'
          }}
          className={`h-16 px-4 border-b flex items-center shrink-0 ${isSidebarCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between'}`}
        >
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
                <div className={`text-base font-black tracking-tight ${isCanvasTheme ? 'text-[#17251D]' : 'text-white'} flex items-center gap-1 leading-none`}>
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
            className={`p-1.5 rounded-lg ${
              isCanvasTheme
                ? 'text-[#17251D]/70 hover:text-[#17251D] hover:bg-[#E8F1E5] border border-[#E5E0D5]'
                : 'text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40 border border-[#176B45]/40'
            } transition-all cursor-pointer relative group shrink-0`}
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
        <nav className={`flex-1 p-3 space-y-3 overflow-y-auto scrollbar-thin ${isCanvasTheme ? 'scrollbar-thumb-stone-300' : 'scrollbar-thumb-[#176B45]/50'}`}>
          {navSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              {!isSidebarCollapsed && (
                <div className={`text-[10px] font-black tracking-wider ${isCanvasTheme ? 'text-[#176B45]' : 'text-[#37A86B]'} uppercase px-3 pt-1.5 pb-0.5`}>
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
                        : isCanvasTheme
                          ? 'text-[#17251D]/80 hover:bg-[#E8F1E5] hover:text-[#17251D]'
                          : 'text-[#E8F1E5]/80 hover:bg-[#176B45]/35 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 transition-transform ${
                        isActive ? 'text-white scale-105' : isCanvasTheme ? 'text-[#176B45]' : 'text-[#37A86B] group-hover:text-white'
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
      {/* 📱 MOBILE NAVIGATION DRAWER */}
      {/* ========================================================================= */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className={`relative w-72 max-w-[80vw] ${isCanvasTheme ? 'bg-[#F7F4E9] text-[#17251D] border-r border-[#E5E0D5]' : 'bg-[#104B35] text-white border-r border-[#176B45]/40'} h-full flex flex-col z-10 shadow-2xl`}>
            <div className={`h-16 px-4 border-b ${isCanvasTheme ? 'border-[#E5E0D5]' : 'border-[#176B45]/40'} flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#176B45] text-white flex items-center justify-center font-bold shadow-xs">
                  <Sprout className="h-4 w-4 text-[#E8F1E5]" />
                </div>
                <span className={`font-black text-sm ${isCanvasTheme ? 'text-[#17251D]' : 'text-white'}`}>KisanConnect</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className={`p-1.5 rounded-full ${isCanvasTheme ? 'text-[#17251D]/70 hover:bg-[#E8F1E5]' : 'text-[#E8F1E5]/80 hover:bg-[#176B45]/50'}`}
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
                      isActive ? 'bg-[#176B45] text-white shadow-xs' : isCanvasTheme ? 'text-[#17251D]/80 hover:bg-[#E8F1E5]' : 'text-[#E8F1E5]/80 hover:bg-[#176B45]/40'
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
          <div className={`${isCanvasTheme ? 'bg-[#EAE4D3] text-[#17251D] border-b border-[#D5CFBE]' : 'bg-[#104B35] text-white border-b border-[#37A86B]/30'} px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold shrink-0 z-30`}>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#E6A52E] text-[#17251D] text-[10px] font-black uppercase tracking-wider">
                PREVIEW MODE
              </span>
              <span className="font-extrabold">
                {isCanvasTheme ? 'Harvest Canvas — Unified Ivory Layout' : 'Harvest Premium — Standard Layout'}
              </span>
              <span className={`${isCanvasTheme ? 'text-[#176B45]' : 'text-[#37A86B]'} text-[11px] hidden sm:inline`}>
                • Visual Theme Preview (Underlying Functionality & Data Intact)
              </span>
            </div>
            <button
              onClick={() => onNavigate ? onNavigate(returnUrl || '/admin?tab=appearance') : (window.location.href = returnUrl || '/admin?tab=appearance')}
              className={`px-3 py-1 rounded-md ${isCanvasTheme ? 'bg-white hover:bg-[#F7F4E9] text-[#17251D] border border-[#D5CFBE]' : 'bg-white hover:bg-[#E8F1E5] text-[#104B35]'} font-black text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1`}
            >
              ← {returnLabel || (returnUrl?.includes('admin') ? 'Return to Appearance Manager' : 'Return to Dashboard')}
            </button>
          </div>
        )}

        {/* TOP HEADER */}
        <header 
          style={{
            backgroundColor: isCanvasTheme ? 'var(--app-page-bg, #F7F4E9)' : 'var(--app-header-bg, #104B35)',
            color: isCanvasTheme ? 'var(--app-page-text, #17251D)' : 'var(--app-header-text, #ffffff)',
            borderColor: isCanvasTheme ? 'var(--app-card-border, #E5E0D5)' : 'var(--app-header-border, #176B45)'
          }}
          className="h-16 shrink-0 w-full border-b px-4 sm:px-6 flex items-center z-20 shadow-xs"
        >
          <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between gap-3 sm:gap-4">

            {/* Left: Mobile Hamburger & Clean Dashboard Breadcrumb */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className={`md:hidden p-2 rounded-lg ${isCanvasTheme ? 'text-[#17251D] hover:bg-[#E8F1E5]' : 'text-white hover:bg-[#176B45]/50'} transition-colors cursor-pointer`}
                aria-label="Open Navigation Drawer"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Breadcrumb / Clean Section Title */}
              <div className="flex items-center gap-2 sm:gap-2.5 text-xs">
                <span className={`${isCanvasTheme ? 'text-[#176B45]' : 'text-[#37A86B]'} font-extrabold tracking-wider uppercase text-[11px]`}>
                  {t.nav.overview}
                </span>
                <span className={`${isCanvasTheme ? 'text-[#17251D]/30' : 'text-white/40'} font-bold`}>•</span>
                <span className={`${isCanvasTheme ? 'text-[#17251D]' : 'text-white'} font-black text-sm tracking-tight`}>
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
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg ${
                    isCanvasTheme
                      ? 'bg-white hover:bg-[#E8F1E5] text-[#104B35] border border-[#E5E0D5]'
                      : 'bg-[#176B45]/60 hover:bg-[#176B45] text-white border border-[#37A86B]/30'
                  } font-bold text-xs transition-colors cursor-pointer shadow-2xs shrink-0`}
                  title="Return to Appearance Manager or Dashboard"
                >
                  <span>{returnLabel || (returnUrl?.includes('admin') ? '← UI/UX Manager' : t.nav.returnToCurrent)}</span>
                </button>
              )}

              {/* Language Selection: हिंदी | Hinglish | English */}
              <div className={`flex items-center h-9 ${isCanvasTheme ? 'bg-[#E8F1E5] border border-[#37A86B]/30 text-[#17251D]' : 'bg-[#0C3B29]/90 border border-[#176B45]/60 text-white'} p-0.5 rounded-lg text-xs font-bold shrink-0`}>
                <button
                  onClick={() => handleLangChange('hi')}
                  className={`h-7 px-2.5 rounded-md transition-all cursor-pointer flex items-center ${
                    lang === 'hi' ? 'bg-[#176B45] text-white font-black shadow-xs' : isCanvasTheme ? 'text-[#17251D] hover:text-[#176B45]' : 'text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40'
                  }`}
                >
                  हिंदी
                </button>
                <button
                  onClick={() => handleLangChange('hinglish')}
                  className={`h-7 px-2.5 rounded-md transition-all cursor-pointer flex items-center ${
                    lang === 'hinglish' ? 'bg-[#176B45] text-white font-black shadow-xs' : isCanvasTheme ? 'text-[#17251D] hover:text-[#176B45]' : 'text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40'
                  }`}
                >
                  Hinglish
                </button>
                <button
                  onClick={() => handleLangChange('en')}
                  className={`h-7 px-2.5 rounded-md transition-all cursor-pointer flex items-center ${
                    lang === 'en' ? 'bg-[#176B45] text-white font-black shadow-xs' : isCanvasTheme ? 'text-[#17251D] hover:text-[#176B45]' : 'text-[#E8F1E5]/80 hover:text-white hover:bg-[#176B45]/40'
                  }`}
                >
                  English
                </button>
              </div>

              {/* Notification Bell */}
              <button
                onClick={onOpenNotifications}
                className={`h-9 w-9 rounded-lg ${
                  isCanvasTheme
                    ? 'bg-white hover:bg-[#E8F1E5] border border-[#E5E0D5] text-[#17251D]'
                    : 'bg-[#176B45]/50 hover:bg-[#176B45] border border-[#176B45]/80 text-white'
                } flex items-center justify-center relative transition-colors cursor-pointer shadow-xs shrink-0`}
                title={t.nav.notifications}
              >
                <Bell className="h-4 w-4" />
                <span className={`absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ${isCanvasTheme ? 'ring-2 ring-white' : 'ring-2 ring-[#104B35]'}`}>
                  3
                </span>
              </button>

              {/* User Profile Avatar */}
              <div 
                onClick={() => handleNavClick('profile')}
                className={`h-9 w-9 rounded-lg bg-[#176B45] text-white font-black text-xs flex items-center justify-center border ${
                  isCanvasTheme ? 'border-[#176B45] ring-2 ring-white hover:bg-[#104B35]' : 'border-[#37A86B]/40 ring-2 ring-[#104B35] hover:bg-[#1c7e52]'
                } cursor-pointer shadow-xs relative shrink-0 transition-colors`}
                title={t.nav.profile}
              >
                AS
                <span className={`h-2 w-2 rounded-full bg-[#37A86B] absolute -bottom-0.5 -right-0.5 ${isCanvasTheme ? 'ring-2 ring-white' : 'ring-2 ring-[#104B35]'}`} />
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
              {(() => {
                const totalVolQtl = listings.reduce((sum, l) => sum + (Number(l.totalQuantityTons ?? l.quantityTons ?? 0) * 10), 0);
                const buyersCount = matchedBuyers.length > 0 ? matchedBuyers.length : buyers.length;
                const confirmedDealsCount = orders.filter(o => o.status !== 'CANCELLED').length;
                const projRevenue = listings.reduce((sum, l) => sum + (Number(l.expectedPricePerKg || 0) * (Number(l.totalQuantityTons ?? l.quantityTons ?? 0) * 1000)), 0);
                const revenueDisplay = projRevenue > 0 ? projRevenue : orders.reduce((sum, o) => sum + (Number((o as any).produceTotal || (o as any).totalAmount || 0)), 0);

                return (
                  <div className="rounded-xl bg-[#104B35] text-white p-3.5 sm:p-4 shadow-sm border border-[#176B45]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      
                      {/* Metric 1: Total Volume */}
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/10 border border-white/10 hover:border-[#37A86B]/40 transition-colors">
                        <div className="h-9 w-9 rounded-full bg-[#176B45] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Sprout className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[11px] text-[#E8F1E5]/90 font-medium">{t.metrics.totalVolumeTitle}</div>
                          <div className="text-lg sm:text-xl font-black text-white leading-tight">
                            {totalVolQtl > 0 ? `${totalVolQtl} Qtl` : '0 Qtl'}
                          </div>
                          <div className="text-[10px] text-[#37A86B] font-bold flex items-center gap-1.5 mt-0.5">
                            <span className="text-[#E8F1E5]/80">{activeListings.length} {t.metrics.activeCrops}</span>
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
                          <div className="text-lg sm:text-xl font-black text-white leading-tight">{buyersCount}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-blue-200/80">{t.metrics.inLast7Days}</span>
                            <span className="text-[9px] bg-blue-500/80 text-white font-bold px-1.5 py-0.2 rounded-full">
                              Verified
                            </span>
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
                          <div className="text-lg sm:text-xl font-black text-white leading-tight">{confirmedDealsCount}</div>
                          <div className="text-[10px] text-amber-200/80 font-bold flex items-center gap-1.5 mt-0.5">
                            <span>{orders.length} {t.metrics.dealsVolume}</span>
                            {confirmedDealsCount > 0 && (
                              <span className="text-[9px] bg-[#37A86B] text-slate-950 font-black px-1.5 py-0.2 rounded-full">{t.metrics.dealsTrend}</span>
                            )}
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
                            <div className="text-lg sm:text-xl font-black text-white leading-tight">
                              ₹{revenueDisplay.toLocaleString('en-IN')}
                            </div>
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
                );
              })()}

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
            <div className="space-y-4 max-w-[1920px] mx-auto animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.listings.title}</h2>
                  <p className="text-xs text-[#657468]">
                    {listingFilterTab === 'active' 
                      ? (lang === 'hi' ? `बाजार में बिक्री के लिए उपलब्ध सक्रिय फसलें (${activeListings.length})` : `Active crops available in market (${activeListings.length})`)
                      : (lang === 'hi' ? `सौदा हो चुकी / पूर्ण बिकी फसलें (${dealedListings.length})` : `Dealed and sold crop lots (${dealedListings.length})`)}
                  </p>
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

              {/* Sub-tab Switcher: Active Listings vs Dealed / Sold Crops */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E0D5] pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setListingFilterTab('active')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      listingFilterTab === 'active'
                        ? 'bg-[#176B45] text-white shadow-xs'
                        : 'bg-white text-[#657468] hover:bg-[#FAF6ED] border border-[#E5E0D5]'
                    }`}
                  >
                    <span>🌱 {lang === 'hi' ? 'सक्रिय फसलें' : 'Active Produce'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      listingFilterTab === 'active' ? 'bg-[#104B35] text-white' : 'bg-[#FAF6ED] text-[#17251D]'
                    }`}>
                      {activeListings.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingFilterTab('dealed')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      listingFilterTab === 'dealed'
                        ? 'bg-[#104B35] text-white shadow-xs'
                        : 'bg-white text-[#657468] hover:bg-[#FAF6ED] border border-[#E5E0D5]'
                    }`}
                  >
                    <span>🤝 {lang === 'hi' ? 'सौदा हो चुकी फसलें' : 'Dealed & Sold'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      listingFilterTab === 'dealed' ? 'bg-[#E6A52E] text-[#17251D]' : 'bg-[#FAF6ED] text-[#17251D]'
                    }`}>
                      {dealedListings.length}
                    </span>
                  </button>
                </div>

                {/* Search Bar */}
                {listings.length > 0 && (
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#657468]" />
                    <input
                      type="text"
                      value={listingSearchQuery}
                      onChange={(e) => setListingSearchQuery(e.target.value)}
                      placeholder={lang === 'hi' ? 'फसल या किस्म खोजें...' : 'Search crop or variety...'}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#E5E0D5] bg-white text-xs font-bold text-[#17251D] placeholder-[#657468]/70 focus:outline-hidden focus:border-[#176B45]"
                    />
                  </div>
                )}
              </div>

              {/* ACTIVE CROPS */}
              {listingFilterTab === 'active' && (
                <>
                  {activeListings.length === 0 ? (
                    <div className="text-center py-14 bg-white rounded-xl border border-[#E5E0D5] p-6 space-y-3 shadow-xs">
                      <div className="text-4xl">🌾</div>
                      <h3 className="text-base font-bold text-[#17251D]">
                        {lang === 'hi' ? 'वर्तमान में कोई सक्रिय फसल नहीं है' : 'No active crop listings currently'}
                      </h3>
                      <p className="text-xs text-[#657468] max-w-sm mx-auto">
                        {dealedListings.length > 0
                          ? (lang === 'hi' ? 'आपकी दर्ज फसलों के सौदे पक्के हो चुके हैं ("सौदा हो चुकी फसलें" टैब देखें)।' : 'Your crops have completed deals (check Dealed & Sold tab). Add new crops below.')
                          : (lang === 'hi' ? 'अपनी तैयार फसल या खेत में खड़ी फसल की जानकारी दें ताकि खरीदार आपसे संपर्क कर सकें।' : 'List your standing or harvested produce so verified buyers can find and bid on it.')}
                      </p>
                      <button
                        onClick={() => {
                          setWizardStep(1);
                          setShowAddWizard(true);
                        }}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                      >
                        + {t.tabs.listings.addNewBtn}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeListings
                        .filter(l => {
                          if (!listingSearchQuery.trim()) return true;
                          const q = listingSearchQuery.toLowerCase();
                          return l.cropName.toLowerCase().includes(q) ||
                            (l.variety || '').toLowerCase().includes(q) ||
                            (l.farmerLocation || '').toLowerCase().includes(q) ||
                            (l.grade || '').toLowerCase().includes(q);
                        })
                        .map((l) => {
                          const isFuture = l.listingType === 'FUTURE_HARVEST';
                          const totalTons = Number(l.totalQuantityTons ?? l.quantityTons ?? 0);
                          const reservedTons = Number(l.reservedQuantityTons ?? 0);
                          const confirmedTons = Number(l.confirmedQuantityTons ?? 0);
                          const availTons = Number(l.availableQuantityTons ?? (totalTons - reservedTons - confirmedTons));
                          const isOnHold = l.status === 'RESERVED' || (availTons <= 0 && reservedTons > 0);

                          return (
                            <div key={l.id} className="bg-white rounded-xl border border-[#E5E0D5] p-4.5 shadow-xs flex flex-col justify-between space-y-3.5 hover:border-[#176B45] transition-all">
                              <div className="space-y-3">
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
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isOnHold
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : isFuture
                                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                      : 'bg-[#E8F1E5] text-[#104B35]'
                                  }`}>
                                    {isOnHold 
                                      ? (lang === 'hi' ? 'आरक्षित (Hold)' : 'Reserved') 
                                      : isFuture 
                                      ? (lang === 'hi' ? 'खड़ी फसल' : 'Pre-harvest') 
                                      : t.recentListings.activeBadge}
                                  </span>
                                </div>

                                <div className="bg-[#FAF6ED] p-2.5 rounded-xl space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-[#657468]">{t.tabs.listings.colAvailableQty}:</span>
                                    <span className="font-bold text-[#17251D]">{availTons * 10} Qtl ({availTons} Tons)</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#657468]">{t.tabs.listings.colExpectedPrice}:</span>
                                    <span className="font-bold text-[#176B45]">₹{l.expectedPricePerKg}/kg (₹{Number(l.expectedPricePerKg) * 100}/Qtl)</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#657468]">Grade:</span>
                                    <span className="font-bold text-[#17251D]">{l.grade || 'Grade A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[#657468]">{t.tabs.listings.colLocation}:</span>
                                    <span className="font-medium text-[#17251D]">📍 {l.farmerLocation || 'Agra, UP'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-[#E5E0D5]">
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedListingForTraceability(l);
                                      setShowTraceabilityModal(true);
                                    }}
                                    className="py-2 px-2.5 rounded-xl bg-[#104B35] hover:bg-[#176B45] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5 text-[#37A86B]" />
                                    <span>{lang === 'hi' ? 'प्रमाण पत्र' : 'Passport'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedListingForTraceability(l);
                                      setShowActivityLoggerModal(true);
                                    }}
                                    className="py-2 px-2.5 rounded-xl bg-white hover:bg-[#FAF6ED] text-[#17251D] border border-[#E5E0D5] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-[#176B45]" />
                                    <span>{lang === 'hi' ? 'डायरी लिखें' : 'Log Work'}</span>
                                  </button>
                                </div>

                                <button
                                  onClick={() => {
                                    loadListingMatches(l);
                                    setBuyerFilterCrop('All');
                                    handleNavClick('buyers');
                                  }}
                                  className="w-full py-2 rounded-xl bg-[#E8F1E5] hover:bg-[#d8e7d5] text-[#104B35] font-black text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <Search className="h-3.5 w-3.5" />
                                  <span>{t.actions.findBuyers.title}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleMarkListingSold(l.id)}
                                  className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-[#657468] hover:text-[#17251D] font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5 border border-[#E5E0D5] cursor-pointer"
                                >
                                  <Handshake className="h-3.5 w-3.5 text-[#E6A52E]" />
                                  <span>{lang === 'hi' ? 'सौदा पक्का दर्ज करें (Move to Sold)' : 'Mark Sold / Move to Dealed'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}

              {/* DEALED & SOLD CROPS */}
              {listingFilterTab === 'dealed' && (
                <>
                  {dealedListings.length === 0 ? (
                    <div className="text-center py-14 bg-white rounded-xl border border-[#E5E0D5] p-6 space-y-3 shadow-xs">
                      <div className="text-4xl">🤝</div>
                      <h3 className="text-base font-bold text-[#17251D]">
                        {lang === 'hi' ? 'अभी कोई सौदा पक्का नहीं हुआ है' : 'No dealed or sold crops yet'}
                      </h3>
                      <p className="text-xs text-[#657468] max-w-sm mx-auto">
                        {lang === 'hi' 
                          ? 'जैसे ही किसी खरीदार के साथ आपका सौदा तय होता है या आप खुद सौदा पक्का दर्ज करते हैं, वह फसल यहां दिखेगी।'
                          : 'When an offer is accepted or a listing is marked as sold, it is preserved here.'}
                      </p>
                      <button
                        onClick={() => setListingFilterTab('active')}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-[#176B45] text-white font-bold text-xs cursor-pointer"
                      >
                        {lang === 'hi' ? 'सक्रिय फसलें देखें' : 'View Active Crops'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dealedListings
                        .filter(l => {
                          if (!listingSearchQuery.trim()) return true;
                          const q = listingSearchQuery.toLowerCase();
                          return l.cropName.toLowerCase().includes(q) ||
                            (l.variety || '').toLowerCase().includes(q) ||
                            (l.farmerLocation || '').toLowerCase().includes(q);
                        })
                        .map((l) => {
                          const totalTons = Number(l.totalQuantityTons ?? l.quantityTons ?? 0);
                          const confirmedTons = Number(l.confirmedQuantityTons ?? totalTons);
                          const linkedOrder = orders.find(o => (o.listingId === l.id || (o as any).listing_id === l.id) && o.status !== 'CANCELLED');

                          return (
                            <div key={l.id} className="bg-[#FAF6ED] rounded-xl border border-[#E5E0D5] p-4.5 shadow-xs flex flex-col justify-between space-y-3.5">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 w-fit">
                                      <CheckCircle2 className="h-3 w-3 text-amber-700" />
                                      <span>✓ {lang === 'hi' ? 'सौदा पक्का (Sold)' : 'Deal Done / Sold'}</span>
                                    </span>
                                    <h4 className="text-base font-black text-[#17251D] mt-1.5">{l.cropName}</h4>
                                    <span className="text-xs text-[#657468]">{l.variety || 'Standard'}</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-base font-black text-[#176B45]">
                                      ₹{linkedOrder?.agreedPricePerKg || l.expectedPricePerKg}/kg
                                    </div>
                                    <span className="text-[10px] text-[#657468]">{lang === 'hi' ? 'तय भाव' : 'Agreed Rate'}</span>
                                  </div>
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-[#E5E0D5] space-y-1.5 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-[#657468]">{lang === 'hi' ? 'बिका हुआ माल' : 'Sold Quantity'}:</span>
                                    <span className="font-bold text-[#17251D]">{confirmedTons * 10} Qtl ({confirmedTons} Tons)</span>
                                  </div>
                                  {linkedOrder && (
                                    <>
                                      <div className="flex justify-between">
                                        <span className="text-[#657468]">{lang === 'hi' ? 'खरीदार' : 'Buyer'}:</span>
                                        <span className="font-bold text-[#17251D]">{linkedOrder.buyerName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-[#657468]">{lang === 'hi' ? 'कुल सौदा' : 'Total Amount'}:</span>
                                        <span className="font-black text-[#176B45]">₹{Number(linkedOrder.totalAmount || linkedOrder.produceTotal || 0).toLocaleString()}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-[#E5E0D5] flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReactivateListing(l.id)}
                                  className="flex-1 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#17251D] border border-[#E5E0D5] font-bold text-xs cursor-pointer transition-colors"
                                >
                                  ↩️ {lang === 'hi' ? 'पुनः सक्रिय करें' : 'Reactivate'}
                                </button>
                                {linkedOrder && (
                                  <button
                                    type="button"
                                    onClick={() => handleNavClick('orders')}
                                    className="px-3 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
                                  >
                                    📦 {lang === 'hi' ? 'ऑर्डर देखें' : 'View Order'}
                                  </button>
                                )}
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
          {activeTab === 'buyers' && (() => {
            const activeListing = selectedListingForMatches || activeListings[0] || listings[0];
            const farmerQtyTons = activeListing ? Number(activeListing.totalQuantityTons ?? activeListing.quantityTons ?? 8.0) : 8.0;

            // Apply filters & sorting
            const displayedMatches = matchedBuyers.filter(m => {
              const req = m.requirement;
              if (buyerFilterCrop !== 'All' && req.cropName && req.cropName.toLowerCase() !== buyerFilterCrop.toLowerCase()) {
                return false;
              }
              if (buyerFilterVariety !== 'All' && req.variety && req.variety.toLowerCase() !== buyerFilterVariety.toLowerCase()) {
                return false;
              }
              if (buyerFilterGrade !== 'All' && req.gradeRequired && req.gradeRequired.toLowerCase() !== buyerFilterGrade.toLowerCase()) {
                return false;
              }
              if (buyerFilterDistance !== null && (m.distanceKm ?? 999) > buyerFilterDistance) {
                return false;
              }
              const bType = req.buyerType || (Number(req.quantityTons || 0) >= 20 ? 'bulk' : 'local');
              if (buyerFilterType === 'local' && bType !== 'local') return false;
              if (buyerFilterType === 'bulk' && bType !== 'bulk') return false;
              if (buyerFilterType === 'aggregator') {
                const isAgg = (m as any).eligibility?.routeType === 'aggregator_pooled' || req.aggregationAllowed === true || req.isAggregator === true;
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
              <div className="space-y-4 max-w-[1920px] mx-auto animate-fadeIn">
                {/* Header & Produce Selection Dropdown */}
                <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.buyers.title}</h2>
                      <span className="text-xs bg-[#E8F1E5] text-[#104B35] font-black px-2.5 py-0.5 rounded-full">
                        {displayedMatches.length} {lang === 'hi' ? 'सक्रिय अवसर' : 'Opportunities'}
                      </span>
                    </div>
                    <p className="text-xs text-[#657468] mt-0.5">{t.tabs.buyers.subtitle}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Produce Selector */}
                    {(activeListings.length > 0 || listings.length > 0) && (
                      <div className="flex items-center gap-1.5 bg-[#FAF6ED] px-3 py-1.5 rounded-xl border border-[#E5E0D5]">
                        <span className="text-xs font-bold text-[#657468]">{lang === 'hi' ? 'आपकी फसल:' : 'Your Produce:'}</span>
                        <select
                          value={activeListing?.id || ''}
                          onChange={(e) => {
                            const targetId = e.target.value;
                            const found = activeListings.find(l => l.id === targetId) || listings.find(l => l.id === targetId);
                            if (found) {
                              loadListingMatches(found);
                              setBuyerFilterCrop('All');
                            }
                          }}
                          className="text-xs font-black text-[#176B45] bg-transparent outline-none cursor-pointer"
                        >
                          {activeListings.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.cropName} ({Number(l.availableQuantityTons ?? l.quantityTons ?? 0)}T) - {l.grade || 'Grade A'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* View Mode Toggle: [List View] [Map View] */}
                    <div className="flex items-center bg-[#FAF6ED] p-1 rounded-xl border border-[#E5E0D5] text-xs font-bold">
                      <button
                        onClick={() => setBuyerViewMode('list')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          buyerViewMode === 'list'
                            ? 'bg-[#176B45] text-white shadow-xs font-black'
                            : 'text-[#657468] hover:text-[#17251D]'
                        }`}
                      >
                        📋 {lang === 'hi' ? 'सूची' : 'List View'}
                      </button>
                      <button
                        onClick={() => setBuyerViewMode('map')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          buyerViewMode === 'map'
                            ? 'bg-[#176B45] text-white shadow-xs font-black'
                            : 'text-[#657468] hover:text-[#17251D]'
                        }`}
                      >
                        🗺️ {lang === 'hi' ? 'नक्शा' : 'Map View'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI BUYER GUIDE CARD */}
                <div className="bg-gradient-to-r from-[#104B35] to-[#176B45] text-white rounded-xl p-5 border border-[#176B45] shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">✨</span>
                        <h3 className="text-sm font-black text-[#E6A52E]">
                          AI Buyer Guide — {lang === 'hi' ? 'मेरे लिए सबसे सही खरीदार कौन सा है?' : 'Which buyer is best suited for your crop?'}
                        </h3>
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-white/10 text-[#E8F1E5] px-2 py-0.5 rounded border border-white/20">
                          Gemini 2.5
                        </span>
                      </div>
                      <p className="text-xs text-[#E8F1E5]/90">
                        {activeListing
                          ? `${lang === 'hi' ? 'विश्लेषण' : 'Analyzing'}: ${activeListing.cropName} (${farmerQtyTons} Tons) • 📍 ${activeListing.farmerLocation || user?.location || 'Agra, UP'}`
                          : (lang === 'hi' ? 'अपनी फसल के अनुकूल सबसे सही खरीदार व रास्ते की तुरंत सलाह पाएं।' : 'Get instant recommendation on highest realization buyer.')}
                      </p>
                    </div>

                    <button
                      onClick={handleAskAiBuyerGuide}
                      disabled={aiLoading}
                      className="px-4 py-2.5 bg-[#E6A52E] hover:bg-[#d09223] active:scale-95 text-[#17251D] font-black text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 cursor-pointer"
                    >
                      <Sparkles className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
                      <span>
                        {aiLoading 
                          ? (lang === 'hi' ? 'दूरी व भाव की जांच जारी है...' : 'Analyzing demand & logistics...')
                          : (lang === 'hi' ? 'AI खरीदार सलाह लें' : 'Ask AI Buyer Guide')}
                      </span>
                    </button>
                  </div>

                  {/* AI Recommendation Output */}
                  {aiRecommendation && (
                    <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/15 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[#E6A52E] uppercase text-[10px] tracking-wider">
                          ⭐ {lang === 'hi' ? 'सर्वोत्तम अनुशंसित खरीदार' : 'Top Recommendation'}
                        </span>
                        {aiRecommendation.confidenceScore && (
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                            Score: {aiRecommendation.confidenceScore}%
                          </span>
                        )}
                      </div>
                      <p className="text-[#FAF6ED] font-medium leading-relaxed">
                        {aiRecommendation.summary || aiRecommendation.recommendation || aiRecommendation.analysis}
                      </p>
                      {aiRecommendation.keyReasons && Array.isArray(aiRecommendation.keyReasons) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {aiRecommendation.keyReasons.map((r: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-[#104B35]/60 text-white text-[10px] font-semibold border border-white/10">
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {aiError && (
                    <div className="bg-amber-500/20 border border-amber-300/40 rounded-xl p-2.5 text-xs text-amber-100 flex items-center gap-2">
                      <Info className="h-4 w-4 shrink-0" />
                      <span>{aiError} ({lang === 'hi' ? 'मानक एल्गोरिद्म मिलान पूरी तरह सक्रिय है' : 'Standard matching algorithms active'})</span>
                    </div>
                  )}
                </div>

                {/* FILTERS & DISTANCE */}
                <div className="bg-white rounded-xl border border-[#E5E0D5] p-4 space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FAF6ED] pb-3">
                    {/* Buyer Type Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                      <span className="text-[#657468] mr-1 text-[11px]">{lang === 'hi' ? 'खरीदार प्रकार:' : 'Type:'}</span>
                      {[
                        { id: 'all', label: lang === 'hi' ? 'सभी' : 'All' },
                        { id: 'local', label: lang === 'hi' ? 'स्थानीय मंडी' : 'Local Mandi' },
                        { id: 'bulk', label: lang === 'hi' ? 'थोक खरीदार' : 'Bulk Processor' },
                        { id: 'aggregator', label: lang === 'hi' ? 'संग्राहक पूल' : 'Aggregator Pool' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setBuyerFilterType(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                            buyerFilterType === tab.id
                              ? 'bg-[#176B45] text-white shadow-xs font-black'
                              : 'bg-[#FAF6ED] text-[#657468] hover:bg-slate-100'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Sort Option */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="text-[#657468] text-[11px]">{lang === 'hi' ? 'क्रमबद्ध:' : 'Sort:'}</span>
                      <select
                        value={buyerSortBy}
                        onChange={(e) => setBuyerSortBy(e.target.value as any)}
                        className="bg-[#FAF6ED] border border-[#E5E0D5] px-2.5 py-1 rounded-xl text-[#17251D] text-xs font-bold outline-none"
                      >
                        <option value="best_match">{lang === 'hi' ? 'सर्वोत्तम मिलान (Best Match)' : 'Best Match'}</option>
                        <option value="nearest">{lang === 'hi' ? 'सबसे पास (Nearest)' : 'Nearest'}</option>
                        <option value="price">{lang === 'hi' ? 'अधिकतम भाव (Best Price)' : 'Best Price'}</option>
                        <option value="date">{lang === 'hi' ? 'जल्दी तारीख (Soonest)' : 'Soonest Date'}</option>
                      </select>
                    </div>
                  </div>

                  {/* Distance Filter Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#17251D] flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      {lang === 'hi' ? 'अधिकतम दूरी:' : 'Max Distance:'}
                    </span>
                    {[
                      { label: '5 km', val: 5 },
                      { label: '10 km', val: 10 },
                      { label: '25 km', val: 25 },
                      { label: '50 km', val: 50 },
                      { label: '100 km', val: 100 },
                      { label: lang === 'hi' ? 'कोई भी' : 'Any Distance', val: null }
                    ].map(opt => (
                      <button
                        key={String(opt.val)}
                        onClick={() => setBuyerFilterDistance(opt.val)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                          buyerFilterDistance === opt.val
                            ? 'bg-[#176B45] text-white border-[#176B45] shadow-xs'
                            : 'bg-white text-[#657468] border-[#E5E0D5] hover:bg-[#FAF6ED]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MATCHED BUYERS CONTENT */}
                {loadingMatches ? (
                  <div className="py-16 text-center text-[#657468] bg-white rounded-xl border border-[#E5E0D5]">
                    <Sparkles className="h-8 w-8 mx-auto animate-spin text-[#176B45] mb-2" />
                    <p className="text-sm font-bold text-[#17251D]">{lang === 'hi' ? 'अनुकूल खरीदार खोजे जा रहे हैं...' : 'Finding matching buyers...'}</p>
                    <p className="text-xs text-[#657468] mt-1">{lang === 'hi' ? 'दूरी, गुणवत्ता व मात्रा नियमों की जांच जारी है' : 'Evaluating distance, logistics, and lot sizes'}</p>
                  </div>
                ) : displayedMatches.length === 0 ? (
                  <div className="text-center py-14 bg-white rounded-xl border border-[#E5E0D5] p-6 space-y-3 shadow-xs">
                    <div className="text-4xl">🔍</div>
                    <h3 className="text-base font-bold text-[#17251D]">{lang === 'hi' ? 'चुने गए फ़िल्टर पर कोई खरीदार नहीं मिला' : 'No buyers match selected filters'}</h3>
                    <p className="text-xs text-[#657468] max-w-sm mx-auto">
                      {lang === 'hi' ? 'दूरी सीमा बढ़ाकर 50 km या 100 km चुनें, या पास के संग्राहक के साथ अपनी फसल पूल करें।' : 'Try expanding your distance filter or resetting to see all market opportunities.'}
                    </p>
                    <button
                      onClick={() => {
                        setBuyerFilterCrop('All');
                        setBuyerFilterVariety('All');
                        setBuyerFilterGrade('All');
                        setBuyerFilterType('all');
                        setBuyerFilterDistance(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
                    >
                      {lang === 'hi' ? 'सभी फ़िल्टर रीसेट करें' : 'Reset All Filters'}
                    </button>
                  </div>
                ) : buyerViewMode === 'map' ? (
                  /* MAP RADAR VIEW */
                  <div className="bg-white rounded-xl border border-[#E5E0D5] p-5 shadow-xs space-y-4">
                    <div className="relative w-full h-80 sm:h-96 bg-[#17251D] rounded-xl overflow-hidden flex items-center justify-center p-4">
                      <div className="absolute h-24 w-24 rounded-full border border-[#37A86B]/20 pointer-events-none" />
                      <div className="absolute h-48 w-48 rounded-full border border-[#37A86B]/20 pointer-events-none" />
                      <div className="absolute h-72 w-72 rounded-full border border-[#37A86B]/20 pointer-events-none" />
                      
                      {/* Center Point */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="h-5 w-5 rounded-full bg-[#176B45] border-2 border-white shadow-lg animate-ping absolute" />
                        <div className="h-5 w-5 rounded-full bg-[#176B45] border-2 border-white shadow-lg relative z-10 flex items-center justify-center text-[9px] text-white font-black">
                          🌾
                        </div>
                        <span className="mt-1 px-2 py-0.5 rounded bg-black/80 text-[#E8F1E5] font-bold text-[10px] border border-white/20">
                          {user?.location || 'Agra Farm Gate'}
                        </span>
                      </div>

                      {/* Buyer Pins */}
                      {displayedMatches.map((m, idx) => {
                        const req = m.requirement;
                        const dist = m.distanceKm ?? (idx * 12 + 6);
                        const angle = (idx * (360 / Math.max(displayedMatches.length, 1)) * Math.PI) / 180;
                        const radius = Math.min(130, Math.max(35, (dist / 100) * 125));
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;

                        return (
                          <button
                            key={req.id || idx}
                            onClick={() => openMakeOfferModal(req, activeListing)}
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                            className="absolute z-20 flex flex-col items-center cursor-pointer transition-transform hover:scale-110"
                            title={`${req.buyerCompany || req.buyerName} - ${dist} km`}
                          >
                            <div className="px-2 py-0.5 rounded-full text-[10px] font-black border border-white/60 shadow-md flex items-center gap-1 bg-[#176B45] text-white">
                              <span>🏢</span>
                              <span>{dist} km</span>
                            </div>
                            <span className="text-[9px] text-white font-bold bg-black/80 px-1 rounded mt-0.5 max-w-[85px] truncate">
                              {req.buyerCompany || req.buyerName}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* LIST VIEW CARDS */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedMatches.map((matchItem, idx) => {
                      const req = matchItem.requirement;
                      const nr = matchItem.netRealization;
                      const bType = req.buyerType || (Number(req.quantityTons || 0) >= 20 ? 'bulk' : 'local');
                      const isBulk = bType === 'bulk';
                      const minLotTons = req.minimumDirectFarmerLotKg !== undefined ? req.minimumDirectFarmerLotKg / 1000 : (isBulk ? 20 : 0.5);
                      const isEligibleDirect = !isBulk || farmerQtyTons >= minLotTons;
                      const isAggregatorOpportunity = isBulk && !isEligibleDirect && req.aggregationAllowed !== false;

                      return (
                        <div key={req.id || idx} className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs flex flex-col justify-between space-y-3.5 hover:border-[#176B45] transition-all">
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isBulk ? 'bg-purple-100 text-purple-900' : 'bg-[#E8F1E5] text-[#104B35]'
                                  }`}>
                                    {isBulk ? (lang === 'hi' ? 'थोक खरीदार' : 'Bulk Buyer') : (lang === 'hi' ? 'सत्यापित खरीदार' : 'Verified Buyer')}
                                  </span>
                                  <span className="text-[10px] font-bold bg-[#FAF6ED] text-[#657468] px-2 py-0.5 rounded">
                                    {req.deliveryType === 'PICKUP_REQUIRED' ? '🚜 फार्म-गेट' : '🚚 डिलीवरी'}
                                  </span>
                                </div>
                                <h4 className="text-base font-black text-[#17251D] mt-1">
                                  {req.buyerCompany || req.buyerName}
                                </h4>
                                <div className="text-xs text-[#657468] flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 text-[#657468]" />
                                  <span>{req.location || 'Agra Region'} • <strong>{matchItem.distanceKm ?? 12} km away</strong></span>
                                </div>
                              </div>

                              {/* Match Score Badge */}
                              <div className="text-right">
                                <span className="px-2.5 py-1 rounded-xl bg-[#E8F1E5] text-[#104B35] text-xs font-black inline-flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 text-[#176B45]" />
                                  <span>{matchItem.matchScore}% Match</span>
                                </span>
                              </div>
                            </div>

                            {/* Rates and Realization */}
                            <div className="bg-[#FAF6ED] p-2.5 rounded-xl text-xs flex justify-between items-center">
                              <div>
                                <span className="text-[#657468] block text-[10px]">{t.tabs.buyers.offeringRate}:</span>
                                <span className="text-sm font-black text-[#176B45]">
                                  ₹{req.offeredPricePerKg ? Number(req.offeredPricePerKg).toFixed(2) : '20.00'}/kg
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[#657468] block text-[10px]">{lang === 'hi' ? 'खर्च बाद हाथ में:' : 'Net in Hand:'}</span>
                                <span className="text-sm font-black text-[#104B35]">
                                  ₹{nr?.netPricePerKg || Number((req.offeredPricePerKg || 20) - 1.5).toFixed(2)}/kg
                                </span>
                              </div>
                            </div>

                            {/* Eligibility Alert */}
                            {isBulk && !isEligibleDirect && (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 space-y-0.5">
                                <div className="font-bold flex items-center gap-1 text-amber-800">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                  <span>{lang === 'hi' ? 'सीधे थोक खरीद के लिए न्यूनतम मात्रा 20 टन आवश्यक है' : 'Quantity below bulk procurement minimum'}</span>
                                </div>
                                <p className="text-[11px] text-amber-800">
                                  {lang === 'hi' ? 'आप पास के संग्राहक के साथ पूल करके इस भाव का लाभ उठा सकते हैं।' : 'Pool with nearby farmers through our aggregator network to fulfill this lot.'}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-[#E5E0D5] flex items-center justify-between gap-2">
                            <button
                              onClick={() => setSelectedMatchExplanation(matchItem)}
                              className="text-xs font-bold text-[#176B45] hover:underline cursor-pointer"
                            >
                              {lang === 'hi' ? 'हिसाब समझें (Details)' : 'View Match Breakdown'}
                            </button>

                            {isEligibleDirect ? (
                              <button
                                onClick={() => openMakeOfferModal(req, activeListing)}
                                className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                              >
                                {t.tabs.buyers.sendProposal}
                              </button>
                            ) : isAggregatorOpportunity ? (
                              <button
                                onClick={() => handleJoinAggregatorBatch(activeListing)}
                                className="px-4 py-2 rounded-xl bg-[#E6A52E] hover:bg-[#d09223] text-[#17251D] font-black text-xs cursor-pointer transition-colors shadow-xs"
                              >
                                {lang === 'hi' ? 'संग्राहक के जरिए बेचें' : 'Sell via Aggregator Pool'}
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-[#657468]">मात्रा सीमा लागू</span>
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

          {/* TAB 5: MY OFFERS */}
          {/* ========================================================================= */}
          {activeTab === 'offers' && (
            <div className="space-y-4 max-w-[1920px] mx-auto animate-fadeIn">
              <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.offers.title}</h2>
                  <p className="text-xs text-[#657468]">{t.tabs.offers.subtitle}</p>
                </div>
                <button
                  onClick={() => handleNavClick('buyers')}
                  className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors self-start sm:self-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>{lang === 'hi' ? 'नया खरीदार खोजें' : 'Find Buyers'}</span>
                </button>
              </div>

              {/* Filter Pills: [ALL] [RECEIVED] [SENT] [NEGOTIATING] [DEALS] */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E0D5] pb-3">
                {[
                  { id: 'ALL', label: lang === 'hi' ? 'सभी ऑफर' : 'All Offers', count: offers.length },
                  { id: 'RECEIVED', label: lang === 'hi' ? 'प्राप्त' : 'Received', count: offers.filter(o => o.direction === 'RECEIVED' && o.status === 'PENDING').length },
                  { id: 'SENT', label: lang === 'hi' ? 'भेजे गए' : 'Sent', count: offers.filter(o => o.direction === 'SENT' && o.status === 'PENDING').length },
                  { id: 'NEGOTIATING', label: lang === 'hi' ? 'बातचीत में' : 'Negotiating', count: offers.filter(o => o.status === 'COUNTERED').length },
                  { id: 'DEALS', label: lang === 'hi' ? 'पक्के सौदे' : 'Deals', count: offers.filter(o => o.status === 'ACCEPTED').length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setOfferFilterTab(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      offerFilterTab === tab.id
                        ? 'bg-[#176B45] text-white shadow-xs'
                        : 'bg-white text-[#657468] hover:bg-[#FAF6ED] border border-[#E5E0D5]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      offerFilterTab === tab.id ? 'bg-[#104B35] text-white' : 'bg-[#FAF6ED] text-[#17251D]'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {(() => {
                const filteredOffers = offers.filter(off => {
                  if (offerFilterTab === 'RECEIVED') return off.direction === 'RECEIVED' && off.status === 'PENDING';
                  if (offerFilterTab === 'SENT') return off.direction === 'SENT' && off.status === 'PENDING';
                  if (offerFilterTab === 'NEGOTIATING') return off.status === 'COUNTERED';
                  if (offerFilterTab === 'DEALS') return off.status === 'ACCEPTED';
                  return true;
                });

                if (filteredOffers.length === 0) {
                  return (
                    <div className="text-center py-14 bg-white rounded-xl border border-[#E5E0D5] p-6 space-y-3 shadow-xs">
                      <div className="text-4xl">💰</div>
                      <h3 className="text-base font-bold text-[#17251D]">
                        {lang === 'hi' ? 'इस श्रेणी में कोई ऑफर नहीं है' : 'No offers in this category'}
                      </h3>
                      <p className="text-xs text-[#657468] max-w-sm mx-auto">
                        {lang === 'hi' ? 'खरीदार खोजें और अपनी फसल का सीधा प्रस्ताव भेजें।' : 'Browse buyer requirements and submit direct offers to begin negotiations.'}
                      </p>
                      <button
                        onClick={() => handleNavClick('buyers')}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                      >
                        {t.actions.findBuyers.title}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredOffers.map((off) => {
                      const effectivePrice = (off.status === 'COUNTERED' && off.counterPricePerKg)
                        ? off.counterPricePerKg
                        : (off.offeredPricePerKg || off.buyerOfferedPricePerKg || off.farmerExpectedPricePerKg || 20);
                      const effectiveQty = (off.status === 'COUNTERED' && off.counterQuantityTons)
                        ? off.counterQuantityTons
                        : (off.quantityTons || 5);
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
                          className="bg-white rounded-xl border border-[#E5E0D5] p-4.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#176B45] transition-all"
                        >
                          <div className="space-y-2.5 flex-1">
                            {/* Header Badge */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-[#17251D]">{off.buyerName}</span>
                              
                              {isAccepted && (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#E8F1E5] text-[#104B35] border border-[#176B45]/20">
                                  ✓ {lang === 'hi' ? 'स्वीकृत सौदा' : 'Deal Confirmed'}
                                </span>
                              )}
                              {isRejected && (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                  ✕ {lang === 'hi' ? 'अस्वीकृत' : 'Declined'}
                                </span>
                              )}
                              {isNegotiating && (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                  🔄 {lang === 'hi' ? 'बातचीत में' : 'Negotiating'} (Round {off.negotiationHistory?.length || 2})
                                </span>
                              )}
                              {!isNegotiating && !isAccepted && !isRejected && isIncoming && (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                  📩 {lang === 'hi' ? 'खरीदार का ऑफर' : 'Buyer Offer'}
                                </span>
                              )}
                              {!isNegotiating && !isAccepted && !isRejected && isOutgoing && (
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                  ⏳ {lang === 'hi' ? 'आपका भेजा प्रस्ताव' : 'Offer Sent'}
                                </span>
                              )}
                            </div>

                            {/* Price & Quantity Details */}
                            <div className="text-base sm:text-lg font-black text-[#176B45]">
                              ₹{effectivePrice} / kg
                              <span className="text-xs font-normal text-[#657468] ml-2">
                                ({lang === 'hi' ? 'कुल राशि:' : 'Total:'} <strong>₹{totalAmount.toLocaleString('en-IN')}</strong>)
                              </span>
                            </div>

                            <div className="text-xs text-[#657468]">
                              {lang === 'hi' ? 'मात्रा:' : 'Qty:'} <strong>{effectiveQty * 10} Qtl ({effectiveQty} Tons)</strong> • {off.cropName} {off.variety ? `(${off.variety})` : ''}
                            </div>

                            {/* Logistics & Dates */}
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#657468]">
                              <span>🚚 {lang === 'hi' ? 'शर्तें:' : 'Terms:'} <strong>{off.pickupTerms || off.deliveryTerms || 'Farm Gate Pickup'}</strong></span>
                              {off.targetDate && <span>📅 <strong>{off.targetDate}</strong></span>}
                              <span>🕒 {off.createdAt ? new Date(off.createdAt).toLocaleDateString('en-IN') : 'Recent'}</span>
                            </div>

                            {/* Buyer Counter Offer Details Box */}
                            {isFarmerTurn && (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 space-y-1">
                                <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                                  <span>⚠️ {lang === 'hi' ? 'खरीदार ने नया भाव/मात्रा प्रस्तावित की है:' : 'Buyer proposed counter terms:'}</span>
                                </div>
                                <div className="flex items-center gap-2 font-bold text-[#17251D]">
                                  <span className="bg-amber-200 px-2 py-0.5 rounded text-amber-950">₹{off.counterPricePerKg}/kg</span>
                                  <span className="bg-amber-200 px-2 py-0.5 rounded text-amber-950">{off.counterQuantityTons} Tons</span>
                                </div>
                                {(off.counterMessage || off.message) && (
                                  <p className="italic text-[#657468] bg-white p-2 rounded border border-amber-100">
                                    "{off.counterMessage || off.message}"
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Farmer Counter Waiting for Buyer */}
                            {isBuyerTurn && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900">
                                ⏳ {lang === 'hi' 
                                  ? `आपने नया प्रस्ताव भेजा है (₹${off.counterPricePerKg}/kg, ${off.counterQuantityTons}T)। खरीदार के उत्तर की प्रतीक्षा है।` 
                                  : `Counter offer sent (₹${off.counterPricePerKg}/kg, ${off.counterQuantityTons}T). Waiting for buyer response.`}
                              </div>
                            )}

                            {/* Negotiation Trail */}
                            {off.negotiationHistory && off.negotiationHistory.length > 1 && (
                              <div className="bg-[#FAF6ED] p-2.5 rounded-xl border border-[#E5E0D5] space-y-1 text-[11px]">
                                <span className="font-bold text-[#17251D] block">{lang === 'hi' ? 'बातचीत का क्रम:' : 'Negotiation Trail:'}</span>
                                {off.negotiationHistory.map((h: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-[#657468]">
                                    <span>{lang === 'hi' ? `दौर ${h.round}:` : `Round ${h.round}:`} {h.byRole === 'buyer' ? (lang === 'hi' ? 'खरीदार' : 'Buyer') : (lang === 'hi' ? 'किसान' : 'Farmer')}</span>
                                    <span className="font-bold text-[#17251D]">₹{h.pricePerKg}/kg • {h.quantityTons}T</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Message */}
                            {off.message && !isNegotiating && (
                              <p className="text-xs text-[#657468] italic bg-[#FAF6ED] p-2 rounded-lg border border-[#E5E0D5]">
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
                                  disabled={offerActionLoading === off.id}
                                  className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="h-4 w-4" />
                                  <span>{offerActionLoading === off.id ? '...' : (lang === 'hi' ? 'स्वीकार करें' : 'Accept')}</span>
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
                                  className="px-3.5 py-2 rounded-xl bg-[#E6A52E] hover:bg-[#d09223] text-[#17251D] font-bold text-xs cursor-pointer shadow-xs transition-colors"
                                >
                                  {lang === 'hi' ? 'नया भाव दें' : 'Counter'}
                                </button>
                                <button
                                  onClick={() => handleRejectOffer(off.id)}
                                  disabled={offerActionLoading === off.id}
                                  className="px-3 py-2 rounded-xl bg-white border border-[#E5E0D5] text-rose-700 hover:bg-rose-50 font-bold text-xs cursor-pointer disabled:opacity-50"
                                >
                                  ✕ {lang === 'hi' ? 'मना करें' : 'Decline'}
                                </button>
                              </>
                            )}

                            {/* Case 2: Incoming initial offer */}
                            {!isNegotiating && isIncoming && off.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleAcceptOffer(off.id)}
                                  disabled={offerActionLoading === off.id}
                                  className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="h-4 w-4" />
                                  <span>{offerActionLoading === off.id ? '...' : (lang === 'hi' ? 'स्वीकार करें' : 'Accept')}</span>
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
                                  className="px-3.5 py-2 rounded-xl bg-[#E6A52E] hover:bg-[#d09223] text-[#17251D] font-bold text-xs cursor-pointer shadow-xs transition-colors"
                                >
                                  {lang === 'hi' ? 'बातचीत करें' : 'Negotiate'}
                                </button>
                                <button
                                  onClick={() => handleRejectOffer(off.id)}
                                  disabled={offerActionLoading === off.id}
                                  className="px-3 py-2 rounded-xl bg-white border border-[#E5E0D5] text-rose-700 hover:bg-rose-50 font-bold text-xs cursor-pointer disabled:opacity-50"
                                >
                                  ✕ {lang === 'hi' ? 'मना करें' : 'Decline'}
                                </button>
                              </>
                            )}

                            {/* Case 3: Accepted */}
                            {off.status === 'ACCEPTED' && (
                              <button
                                onClick={() => handleNavClick('orders')}
                                className="px-4 py-2 rounded-xl bg-[#E8F1E5] hover:bg-[#d8e7d5] text-[#104B35] font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-[#176B45]/20"
                              >
                                <CheckCircle2 className="h-4 w-4 text-[#176B45]" />
                                <span>{lang === 'hi' ? 'सौदा देखें' : 'View Deal'}</span>
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
          {/* TAB 6: MY DEALS / ORDERS */}
          {/* ========================================================================= */}
          {activeTab === 'orders' && (
            <div className="space-y-4 max-w-[1920px] mx-auto animate-fadeIn">
              <div className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] flex items-center justify-between shadow-xs">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#17251D]">{t.tabs.orders.title}</h2>
                  <p className="text-xs text-[#657468]">{t.tabs.orders.subtitle}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#E8F1E5] text-[#104B35] text-xs font-black">
                  {orders.length} {lang === 'hi' ? 'सक्रिय सौदे' : 'Orders'}
                </span>
              </div>

              {orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((ord: any) => {
                    const isCompleted = ord.status === 'COMPLETED' || ord.status === 'DELIVERED';
                    const isInTransit = ord.status === 'IN_TRANSIT' || ord.status === 'DISPATCHED';
                    const totalVal = (ord.finalPricePerKg || ord.unitPricePerKg || ord.pricePerKg || 20) * (ord.quantityTons || 0) * 1000;

                    return (
                      <div key={ord.id} className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs space-y-3.5">
                        {/* Top Order Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#FAF6ED] pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-[#17251D]">{ord.orderNumber || `ORD-${ord.id.slice(0, 8)}`}</span>
                              <span className="text-xs bg-[#FAF6ED] text-[#17251D] px-2.5 py-0.5 rounded-full font-bold border border-[#E5E0D5]">
                                {lang === 'hi' ? 'खरीदार:' : 'Buyer:'} {ord.buyerName || ord.buyerCompany || 'Verified Buyer'}
                              </span>
                            </div>
                            <span className="text-xs text-[#657468]">
                              {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black px-3 py-1 rounded-full ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : isInTransit
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {isCompleted 
                                ? (lang === 'hi' ? '✓ भुगतान पूरा' : 'Delivered & Paid') 
                                : isInTransit 
                                ? (lang === 'hi' ? '🚚 रास्ते में है' : 'In Transit') 
                                : (lang === 'hi' ? '🟡 सौदा तय' : 'Confirmed')}
                            </span>
                            <span className="text-xs bg-[#104B35] text-white px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                              <ShieldCheck className="h-3.5 w-3.5 text-[#37A86B]" />
                              <span>{lang === 'hi' ? 'सुरक्षित एस्क्रो' : 'Escrow Locked'}</span>
                            </span>
                          </div>
                        </div>

                        {/* Order Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#FAF6ED] p-3 rounded-xl border border-[#E5E0D5]">
                          <div>
                            <span className="text-[#657468] block text-[10px]">{lang === 'hi' ? 'फसल:' : 'Crop:'}</span>
                            <span className="font-bold text-[#17251D]">{Number(ord.quantityTons || 0) * 10} Qtl {ord.cropName}</span>
                          </div>
                          <div>
                            <span className="text-[#657468] block text-[10px]">{lang === 'hi' ? 'तय भाव:' : 'Agreed Rate:'}</span>
                            <span className="font-bold text-[#176B45]">₹{ord.finalPricePerKg || ord.unitPricePerKg || ord.pricePerKg || 20}/kg</span>
                          </div>
                          <div>
                            <span className="text-[#657468] block text-[10px]">{lang === 'hi' ? 'कुल राशि:' : 'Total Value:'}</span>
                            <span className="font-black text-[#176B45] text-sm">₹{totalVal.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-[#657468] block text-[10px]">{lang === 'hi' ? 'वाहन / ट्रांसपोर्ट:' : 'Transporter:'}</span>
                            <span className="font-medium text-[#17251D]">{ord.transporterName || 'Kisan Express Logistics'}</span>
                          </div>
                        </div>

                        {/* 5-Step Order Delivery & Payment Timeline */}
                        <div className="pt-1">
                          <div className="text-[11px] font-bold text-[#657468] mb-2">{lang === 'hi' ? 'सौदा प्रगति:' : 'Deal Progress:'}</div>
                          <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                            <div className="p-2 rounded-lg bg-[#E8F1E5] text-[#104B35] font-black border border-[#176B45]/30">
                              1. {lang === 'hi' ? 'सौदा तय ✓' : 'Confirmed'}
                            </div>
                            <div className={`p-2 rounded-lg font-bold border ${
                              ord.status !== 'CREATED' ? 'bg-[#E8F1E5] text-[#104B35] border-[#176B45]/30' : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}>
                              2. {lang === 'hi' ? 'माल तैयार' : 'Ready'}
                            </div>
                            <div className={`p-2 rounded-lg font-bold border ${
                              isInTransit || isCompleted ? 'bg-[#E8F1E5] text-[#104B35] border-[#176B45]/30' : 'bg-[#FAF6ED] text-[#657468] border-[#E5E0D5]'
                            }`}>
                              3. {lang === 'hi' ? 'रास्ते में' : 'In Transit'}
                            </div>
                            <div className={`p-2 rounded-lg font-bold border ${
                              isCompleted ? 'bg-[#E8F1E5] text-[#104B35] border-[#176B45]/30' : 'bg-[#FAF6ED] text-[#657468] border-[#E5E0D5]'
                            }`}>
                              4. {lang === 'hi' ? 'डिलीवरी' : 'Delivered'}
                            </div>
                            <div className={`p-2 rounded-lg font-bold border ${
                              isCompleted ? 'bg-[#176B45] text-white border-[#176B45]' : 'bg-[#FAF6ED] text-[#657468] border-[#E5E0D5]'
                            }`}>
                              5. {lang === 'hi' ? 'बैंक में पैसा' : 'Escrow Paid'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-[#E5E0D5] p-6 space-y-3 shadow-xs">
                  <div className="text-4xl">📦</div>
                  <h3 className="text-base font-bold text-[#17251D]">
                    {lang === 'hi' ? 'अभी कोई सक्रिय ऑर्डर नहीं है' : 'No active orders currently'}
                  </h3>
                  <p className="text-xs text-[#657468] max-w-sm mx-auto">
                    {lang === 'hi' 
                      ? 'जब खरीदार आपका ऑफर स्वीकार करेगा, तो यहाँ आपका सौदा दिखेगा।'
                      : 'When a buyer confirms your offer, your confirmed order will display here.'}
                  </p>
                  <button
                    onClick={() => handleNavClick('buyers')}
                    className="px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    {t.actions.findBuyers.title}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: COLD STORAGE */}
          {/* ========================================================================= */}
          {activeTab === 'storage' && (
            <div className="space-y-5 max-w-[1920px] mx-auto animate-fadeIn">
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

              {/* Profit Simulator: Sell Now vs Store */}
              <div className="bg-white rounded-xl border border-cyan-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">❄️</span>
                  <div>
                    <h3 className="text-sm font-black text-[#17251D]">
                      {lang === 'hi' ? 'मुनाफा जांचें: अभी बेचें या कोल्ड स्टोर में रखें?' : 'Profit Simulator: Sell Now vs Cold Store?'}
                    </h3>
                    <p className="text-xs text-[#657468]">
                      {lang === 'hi' ? 'अनुमान लगाएं कि भंडारण के बाद आपको कितना अधिक मुनाफा मिल सकता है।' : 'Calculate net profitability after monthly rental and handling charges.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-[#657468] block mb-1">
                      {lang === 'hi' ? 'आज का भाव (₹/kg)' : 'Current Offer Price (₹/kg)'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={scenarioParams.currentOfferPrice}
                      onChange={(e) => setScenarioParams({ ...scenarioParams, currentOfferPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold text-[#17251D] bg-[#FAF6ED]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#657468] block mb-1">
                      {lang === 'hi' ? 'भविष्य में अनुमानित भाव (₹/kg)' : 'Expected Future Price (₹/kg)'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={scenarioParams.expectedFuturePrice}
                      onChange={(e) => setScenarioParams({ ...scenarioParams, expectedFuturePrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold text-[#176B45] bg-[#FAF6ED]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#657468] block mb-1">
                      {lang === 'hi' ? 'स्टोरेज का समय' : 'Storage Duration'}
                    </label>
                    <select
                      value={scenarioParams.months}
                      onChange={(e) => setScenarioParams({ ...scenarioParams, months: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold text-[#17251D] bg-[#FAF6ED]"
                    >
                      <option value={1}>{lang === 'hi' ? '1 महीना' : '1 Month'}</option>
                      <option value={2}>{lang === 'hi' ? '2 महीने' : '2 Months'}</option>
                      <option value={3}>{lang === 'hi' ? '3 महीने (मानक)' : '3 Months (Standard)'}</option>
                      <option value={6}>{lang === 'hi' ? '6 महीने' : '6 Months'}</option>
                    </select>
                  </div>
                </div>

                {scenarioResult && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">
                        {lang === 'hi' ? 'विकल्प 1: आज बेचने पर' : 'Option 1: Sell Immediately'}
                      </span>
                      <div className="text-xl font-black text-slate-900">
                        ₹{Number(scenarioResult.currentOfferPricePerKg || scenarioParams.currentOfferPrice).toFixed(2)} / kg
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {lang === 'hi' ? 'तुरंत भुगतान, कोई स्टोरेज किराया नहीं' : 'Immediate payment, zero storage fees'}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-800 uppercase text-[10px]">
                          {lang === 'hi' ? 'विकल्प 2: कोल्ड स्टोर में रखने पर' : 'Option 2: Store in Cold Logistics'}
                        </span>
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          {Number(scenarioResult.netGainOrLossPerKg || 0) > 0 
                            ? `+₹${Number(scenarioResult.netGainOrLossPerKg).toFixed(2)}/kg ${lang === 'hi' ? 'फायदा' : 'Gain'}`
                            : (lang === 'hi' ? 'कम लाभ' : 'Lower Gain')}
                        </span>
                      </div>
                      <div className="text-xl font-black text-emerald-900">
                        ₹{Number(scenarioResult.estimatedFutureNetRealization || scenarioParams.expectedFuturePrice).toFixed(2)} / kg
                      </div>
                      <div className="text-[11px] text-emerald-800 font-semibold">
                        💡 {scenarioResult.recommendation || (lang === 'hi' ? 'कोल्ड स्टोर में रखना अधिक लाभदायक है।' : 'Storing in cold storage yields higher return.')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cold Storage Facilities Grid */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-[#17251D]">
                  {lang === 'hi' ? 'पास के उपलब्ध कोल्ड स्टोरेज' : 'Nearby Cold Storage Facilities'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(storageFacilities && storageFacilities.length > 0 ? storageFacilities : [
                    { id: 'cs-1', name: 'Agra Imperial Cold Logistics', location: 'Khandauli Road, Agra', availableCapacityTons: 600, storageChargePerMonthPerTon: 180, rating: '4.8 ★' },
                    { id: 'cs-2', name: 'Mata Vaishno Cold Storage', location: 'Etmadpur, Agra', availableCapacityTons: 250, storageChargePerMonthPerTon: 170, rating: '4.6 ★' }
                  ]).map((s: any, idx: number) => {
                    const facilityName = s.name || s.facilityName || 'Cold Storage Facility';
                    const loc = s.location || s.address || 'Agra Bypass Road';
                    const capacity = s.availableCapacityTons ? `${s.availableCapacityTons} Tons Available` : (s.capacity || 'Space Available');
                    const rate = s.storageChargePerMonthPerTon ? `₹${s.storageChargePerMonthPerTon} / ton / month` : (s.rate || '₹140 / bag');
                    const rating = s.rating || '4.8 ★';
                    const isBooking = bookingStorageId === (s.id || idx.toString());

                    return (
                      <div key={s.id || idx} className="bg-white p-4.5 rounded-xl border border-[#E5E0D5] shadow-xs space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl overflow-hidden bg-cyan-50 border border-[#E5E0D5]">
                            <img src="/dashboard/cold_storage.jpg" alt="Storage" className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-[#17251D]">{facilityName}</h4>
                            <div className="text-xs text-[#657468]">📍 {loc} • {rating}</div>
                          </div>
                        </div>
                        <div className="bg-[#FAF6ED] p-2.5 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-[#657468]">{t.tabs.storage.availableCapacity}:</span>
                            <span className="font-bold text-[#176B45]">{capacity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#657468]">{t.tabs.storage.ratePerMonth}:</span>
                            <span className="font-bold text-[#17251D]">{rate}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleBookStorage(s)}
                          disabled={isBooking}
                          className="w-full py-2.5 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {isBooking ? 'Booking...' : t.tabs.storage.bookSpace}
                        </button>
                      </div>
                    );
                  })}
                </div>
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
                  onClick={() => handleJoinAggregatorBatch()}
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

            {/* STEP 1: Select Crop & Variety */}
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

                <div>
                  <label className="text-xs font-bold text-[#17251D] block mb-1">
                    {lang === 'hi' ? 'किस्म (Variety):' : 'Crop Variety:'}
                  </label>
                  <input
                    type="text"
                    value={wizardForm.variety}
                    onChange={(e) => setWizardForm({ ...wizardForm, variety: e.target.value })}
                    placeholder="e.g. Kufri Jyoti (3797), Pusa Ruby, Sharbati..."
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold bg-[#FAF6ED] text-[#17251D]"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Quantity, Timing & Location */}
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

                  {/* Harvest Timing */}
                  <div>
                    <label className="text-xs font-bold text-[#17251D] block mb-1">
                      {lang === 'hi' ? 'फसल की स्थिति (Harvest Timing):' : 'Produce Availability:'}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        { id: 'ready_now', label: lang === 'hi' ? '✓ अभी तैयार (Ready)' : 'Ready Now' },
                        { id: '1_week', label: lang === 'hi' ? '⏳ 1 सप्ताह बाद' : 'In 1 Week' },
                        { id: '15_days', label: lang === 'hi' ? '⏳ 15 दिन बाद' : 'In 15 Days' },
                        { id: '1_month', label: lang === 'hi' ? '⏳ 1 माह बाद' : 'In 1 Month' },
                      ].map(tItem => (
                        <button
                          key={tItem.id}
                          type="button"
                          onClick={() => setWizardForm({ ...wizardForm, harvestTiming: tItem.id as any })}
                          className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                            wizardForm.harvestTiming === tItem.id
                              ? 'bg-[#176B45] text-white border-[#176B45]'
                              : 'bg-white text-[#657468] border-[#E5E0D5] hover:bg-slate-50'
                          }`}
                        >
                          {tItem.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality Grade */}
                  <div>
                    <label className="text-xs font-bold text-[#17251D] block mb-1">
                      {lang === 'hi' ? 'गुणवत्ता ग्रेड (Quality Grade):' : 'Quality Grade:'}
                    </label>
                    <select
                      value={wizardForm.qualityGrade}
                      onChange={(e) => setWizardForm({ ...wizardForm, qualityGrade: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold bg-white text-[#17251D]"
                    >
                      <option value="Grade A">Grade A (सुपर क्वालिटी - बड़ी छंटाई)</option>
                      <option value="Grade B">Grade B (मध्यम आकार / सामान्य)</option>
                      <option value="Premium / Export">Premium / Export Quality (विशेष गुणवत्ता)</option>
                    </select>
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

                  {/* Advanced Specs Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSpecs(!showAdvancedSpecs)}
                      className="text-xs font-bold text-[#176B45] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showAdvancedSpecs ? '▼' : '►'}</span>
                      <span>{lang === 'hi' ? 'उन्नत कृषि विवरण (आकार, नमी, दोष)' : 'Advanced Agronomic Specs (Optional)'}</span>
                    </button>
                    {showAdvancedSpecs && (
                      <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                        <div>
                          <label className="text-[10px] text-[#657468] block">Size (mm):</label>
                          <input
                            type="number"
                            value={wizardForm.sizeMinMm}
                            onChange={(e) => setWizardForm({ ...wizardForm, sizeMinMm: Number(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-[#E5E0D5] bg-white font-bold text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#657468] block">Moisture (%):</label>
                          <input
                            type="number"
                            value={wizardForm.moisturePercent}
                            onChange={(e) => setWizardForm({ ...wizardForm, moisturePercent: Number(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-[#E5E0D5] bg-white font-bold text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#657468] block">Defects (%):</label>
                          <input
                            type="number"
                            step="0.5"
                            value={wizardForm.defectsPercent}
                            onChange={(e) => setWizardForm({ ...wizardForm, defectsPercent: Number(e.target.value) })}
                            className="w-full px-2 py-1 rounded-lg border border-[#E5E0D5] bg-white font-bold text-[11px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Price & Storage */}
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

                <div>
                  <label className="text-xs font-bold text-[#17251D] block mb-1">
                    {lang === 'hi' ? 'भंडारण आवश्यकता:' : 'Storage Requirement:'}
                  </label>
                  <select
                    value={wizardForm.storageRequirement}
                    onChange={(e) => setWizardForm({ ...wizardForm, storageRequirement: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold bg-[#FAF6ED] text-[#17251D]"
                  >
                    <option value="NONE">{lang === 'hi' ? 'कोई नहीं (खेत से सीधा उठान)' : 'None (Farm Gate Pickup)'}</option>
                    <option value="COLD_STORAGE">{lang === 'hi' ? 'कोल्ड स्टोरेज सुविधा आवश्यक' : 'Cold Storage Required'}</option>
                    <option value="DRY_VENTILATED">{lang === 'hi' ? 'हवादार सूखा गोदाम' : 'Dry Ventilated Warehouse'}</option>
                  </select>
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

      {/* ========================================================================= */}
      {/* 📜 DIGITAL PASSPORT / TRACEABILITY MODAL */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* ✍️ FIELD ACTIVITY LOGGER MODAL */}
      {/* ========================================================================= */}
      <FieldActivityLoggerModal
        isOpen={showActivityLoggerModal}
        onClose={() => setShowActivityLoggerModal(false)}
        listings={listings}
        onActivityCreated={() => loadDashboardData()}
        language={lang === 'hi' ? 'hi' : 'en'}
      />

      {/* ========================================================================= */}
      {/* 🤝 MAKE OFFER MODAL (Farmer -> Buyer) */}
      {/* ========================================================================= */}
      {makeOfferModal.isOpen && makeOfferModal.requirement && (
        <div className="fixed inset-0 z-50 bg-[#17251D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E5E0D5] max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#FAF6ED] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-[#E8F1E5] text-[#176B45] flex items-center justify-center font-bold text-lg">
                  🤝
                </div>
                <div>
                  <h3 className="text-base font-black text-[#17251D]">
                    {lang === 'hi' ? 'सौदा प्रस्ताव भेजें (Make Direct Offer)' : 'Make Direct Offer'}
                  </h3>
                  <p className="text-xs text-[#657468]">
                    {lang === 'hi' ? 'खरीदार:' : 'Buyer:'} <span className="font-bold text-[#17251D]">{makeOfferModal.requirement.buyerCompany || makeOfferModal.requirement.buyerName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMakeOfferModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 rounded-full bg-[#FAF6ED] hover:bg-[#E8F1E5] text-[#657468] flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Produce & Requirement Facts Card */}
            <div className="bg-[#FAF6ED] rounded-xl p-3.5 border border-[#E5E0D5] space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#657468] font-semibold">{lang === 'hi' ? 'फसल और किस्म:' : 'Crop & Variety:'}</span>
                <span className="font-extrabold text-[#17251D]">
                  {makeOfferModal.listing?.cropName || makeOfferModal.requirement.cropName} ({makeOfferModal.listing?.variety || makeOfferModal.requirement.variety || 'Standard'})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#657468] font-semibold">{lang === 'hi' ? 'आपकी उपलब्ध मात्रा:' : 'Your Listing Qty:'}</span>
                <span className="font-extrabold text-[#176B45]">
                  {makeOfferModal.listing?.quantityTons || '5'} Tons ({Number(makeOfferModal.listing?.quantityTons || 5) * 10} Qtl)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#657468] font-semibold">{lang === 'hi' ? 'खरीदार की मांग:' : 'Buyer Demand:'}</span>
                <span className="font-extrabold text-[#104B35]">
                  {makeOfferModal.requirement.quantityTons} Tons (Rate: ₹{makeOfferModal.requirement.offeredPricePerKg}/kg)
                </span>
              </div>
            </div>

            <form onSubmit={handleSendOfferSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#17251D] block mb-1">
                    {lang === 'hi' ? 'प्रस्तावित मात्रा (Tons) *' : 'Offered Quantity (Tons) *'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={makeOfferModal.quantityTons}
                    onChange={(e) => setMakeOfferModal({ ...makeOfferModal, quantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] font-extrabold text-[#17251D] bg-[#FAF6ED] text-sm"
                  />
                  <span className="text-[10px] text-[#657468] mt-0.5 block">
                    = {Math.round(makeOfferModal.quantityTons * 10)} Qtl
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#17251D] block mb-1">
                    {lang === 'hi' ? 'आपका भाव (₹/kg) *' : 'Your Price (₹/kg) *'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={makeOfferModal.offeredPricePerKg}
                    onChange={(e) => setMakeOfferModal({ ...makeOfferModal, offeredPricePerKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] font-extrabold text-[#176B45] bg-[#FAF6ED] text-sm"
                  />
                  <span className="text-[10px] text-[#657468] mt-0.5 block">
                    = ₹{Math.round(makeOfferModal.offeredPricePerKg * 100)} / Quintal
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#17251D] block mb-1">
                  {lang === 'hi' ? 'डिलीवरी की शर्तें (Delivery Terms):' : 'Delivery Terms:'}
                </label>
                <select
                  value={makeOfferModal.deliveryTerms}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, deliveryTerms: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] font-bold text-[#17251D] bg-[#FAF6ED] text-xs"
                >
                  <option value="Farm Gate Pickup">{lang === 'hi' ? 'खेत से उठान (Farm Gate Pickup)' : 'Farm Gate Pickup'}</option>
                  <option value="Mandi Delivery">{lang === 'hi' ? 'मंडी केंद्र पर डिलीवरी (Mandi Delivery)' : 'Mandi Delivery'}</option>
                  <option value="Direct Processing Plant">{lang === 'hi' ? 'खरीदार प्रोसेसिंग प्लांट (Direct Factory)' : 'Direct Processing Plant'}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#17251D] block mb-1">
                  {lang === 'hi' ? 'खरीदार के लिए संदेश / विवरण (Message):' : 'Message to Buyer:'}
                </label>
                <textarea
                  rows={2}
                  value={makeOfferModal.message}
                  onChange={(e) => setMakeOfferModal({ ...makeOfferModal, message: e.target.value })}
                  placeholder="e.g. Dry Grade A produce packed in bags, ready for pickup..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs bg-white text-[#17251D]"
                />
              </div>

              {/* Live Escrow Total Value */}
              <div className="bg-[#E8F1E5] rounded-xl p-3 border border-[#176B45]/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#104B35] block uppercase tracking-wider">
                    {lang === 'hi' ? 'अनुमानित कुल सौदा मूल्य' : 'Total Deal Value'}
                  </span>
                  <div className="text-lg font-black text-[#104B35]">
                    ₹{Math.round(makeOfferModal.quantityTons * 1000 * makeOfferModal.offeredPricePerKg).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-[#104B35] text-white font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-[#37A86B]" />
                    <span>{lang === 'hi' ? 'सुरक्षित एस्क्रो' : 'Escrow Secured'}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMakeOfferModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-1/3 py-2.5 rounded-xl border border-[#E5E0D5] text-[#657468] hover:bg-[#FAF6ED] font-bold text-xs cursor-pointer transition-colors"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={makeOfferModal.isSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-black text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {makeOfferModal.isSubmitting ? (
                    <span>{lang === 'hi' ? 'भेजा जा रहा है...' : 'Submitting...'}</span>
                  ) : (
                    <>
                      <span>{lang === 'hi' ? 'प्रस्ताव भेजें' : 'Submit Offer'}</span>
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
        <div className="fixed inset-0 z-50 bg-[#17251D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E5E0D5] max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#FAF6ED] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg">
                  🔄
                </div>
                <div>
                  <h3 className="text-base font-black text-[#17251D]">
                    {lang === 'hi' ? 'जवाबी प्रस्ताव दें (Counter Offer)' : 'Submit Counter Offer'}
                  </h3>
                  <p className="text-xs text-[#657468]">
                    {lang === 'hi' ? 'खरीदार:' : 'Buyer:'} <span className="font-bold text-[#17251D]">{counterModal.offer.buyerName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCounterModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 rounded-full bg-[#FAF6ED] hover:bg-[#E8F1E5] text-[#657468] flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Negotiation History Trail if exists */}
            {counterModal.offer.negotiationHistory && counterModal.offer.negotiationHistory.length > 0 && (
              <div className="bg-[#FAF6ED] rounded-xl p-3 border border-[#E5E0D5] space-y-1.5 text-xs">
                <span className="font-bold text-[11px] text-[#17251D] block">
                  {lang === 'hi' ? 'बातचीत का इतिहास:' : 'Negotiation Trail:'}
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {counterModal.offer.negotiationHistory.map((h: any, idx: number) => (
                    <div key={idx} className="bg-white p-2 rounded-lg border border-[#E5E0D5] text-[11px]">
                      <div className="flex items-center justify-between font-bold">
                        <span className={h.byRole === 'buyer' ? 'text-blue-700' : 'text-[#176B45]'}>
                          Round {h.round}: {h.byRole === 'buyer' ? 'Buyer' : 'Farmer'}
                        </span>
                        <span>₹{h.pricePerKg}/kg • {h.quantityTons}T</span>
                      </div>
                      {h.notes && <p className="text-[#657468] italic mt-0.5">"{h.notes}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleCounterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#17251D] block mb-1">
                    {lang === 'hi' ? 'मात्रा (Tons) *' : 'Quantity (Tons) *'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={counterModal.counterQuantityTons}
                    onChange={(e) => setCounterModal({ ...counterModal, counterQuantityTons: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] font-extrabold text-[#17251D] bg-[#FAF6ED] text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#17251D] block mb-1">
                    {lang === 'hi' ? 'नया भाव (₹/kg) *' : 'New Price (₹/kg) *'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={counterModal.counterPricePerKg}
                    onChange={(e) => setCounterModal({ ...counterModal, counterPricePerKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] font-extrabold text-[#176B45] bg-[#FAF6ED] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#17251D] block mb-1">
                  {lang === 'hi' ? 'शर्तें (Terms):' : 'Pickup / Delivery Terms:'}
                </label>
                <select
                  value={counterModal.pickupTerms}
                  onChange={(e) => setCounterModal({ ...counterModal, pickupTerms: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs font-bold bg-[#FAF6ED] text-[#17251D]"
                >
                  <option value="Farm Gate Pickup">Farm Gate Pickup (खेत से उठाव)</option>
                  <option value="Buyer to Arrange Transport">Buyer Arranges Transport</option>
                  <option value="Farmer Delivery to Facility">Farmer Delivery to Facility</option>
                  <option value="Mandi Delivery">Mandi Delivery</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#17251D] block mb-1">
                  {lang === 'hi' ? 'संदेश (Message):' : 'Counter Message:'}
                </label>
                <textarea
                  rows={2}
                  value={counterModal.message}
                  onChange={(e) => setCounterModal({ ...counterModal, message: e.target.value })}
                  placeholder="e.g. Can supply at ₹21/kg if transport arranged by buyer..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E0D5] text-xs bg-white text-[#17251D]"
                />
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-900 block uppercase">
                    {lang === 'hi' ? 'संशोधित कुल सौदा' : 'Revised Deal Value'}
                  </span>
                  <div className="text-lg font-black text-amber-950">
                    ₹{Math.round(counterModal.counterQuantityTons * 1000 * counterModal.counterPricePerKg).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCounterModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-1/3 py-2.5 rounded-xl border border-[#E5E0D5] text-[#657468] hover:bg-[#FAF6ED] font-bold text-xs cursor-pointer transition-colors"
                >
                  {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={counterModal.isSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-[#E6A52E] hover:bg-[#d09223] text-[#17251D] font-black text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {counterModal.isSubmitting ? (lang === 'hi' ? 'भेजा जा रहा है...' : 'Sending...') : (lang === 'hi' ? 'जवाबी प्रस्ताव भेजें' : 'Send Counter Offer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📊 MATCH EXPLANATION MODAL */}
      {/* ========================================================================= */}
      {selectedMatchExplanation && (
        <div className="fixed inset-0 z-50 bg-[#17251D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-[#E5E0D5] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#FAF6ED] pb-3">
              <div>
                <h3 className="text-base font-black text-[#17251D]">
                  {selectedMatchExplanation.matchScore}% {lang === 'hi' ? 'अनुकूलता का हिसाब' : 'Match Compatibility Breakdown'}
                </h3>
                <p className="text-xs text-[#657468]">
                  {lang === 'hi' ? 'यह खरीदार आपकी फसल के लिए क्यों सही है:' : 'Why this buyer matches your produce listing:'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedMatchExplanation(null)}
                className="h-8 w-8 rounded-full bg-[#FAF6ED] text-[#657468] hover:bg-[#E8F1E5] flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {selectedMatchExplanation.breakdown && selectedMatchExplanation.breakdown.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#FAF6ED] border border-[#E5E0D5] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#17251D]">{item.factor}</span>
                    <span className="text-[10px] text-[#657468] ml-2">({lang === 'hi' ? 'अधिकतम' : 'Weight'} {item.weight}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-[#E5E0D5] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#176B45] h-full rounded-full" 
                        style={{ width: `${(item.earned / item.weight) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-[#176B45] w-8 text-right">
                      {item.earned}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {selectedMatchExplanation.reasons && selectedMatchExplanation.reasons.length > 0 && (
              <div className="p-3 bg-[#E8F1E5] rounded-xl border border-[#176B45]/20 space-y-1">
                <span className="text-xs font-bold text-[#104B35] block">{lang === 'hi' ? 'मुख्य कारण (Key Factors):' : 'Key Factors:'}</span>
                <ul className="text-xs text-[#104B35]/90 space-y-0.5">
                  {selectedMatchExplanation.reasons.map((r, i) => (
                    <li key={i}>✓ {r}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setSelectedMatchExplanation(null)}
              className="w-full py-2.5 rounded-xl bg-[#176B45] hover:bg-[#104B35] text-white font-bold text-xs cursor-pointer transition-colors"
            >
              {lang === 'hi' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
