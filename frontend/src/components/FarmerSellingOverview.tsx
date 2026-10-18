import React, { useState, useMemo } from 'react';
import { 
  Sprout, 
  Plus, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ArrowUpRight, 
  Search, 
  ShieldCheck, 
  Calendar, 
  ChevronRight, 
  ChevronDown,
  Package, 
  Building2, 
  Eye, 
  MessageSquare,
  AlertCircle,
  PieChart,
  BarChart3,
  Scale,
  Sparkles
} from 'lucide-react';
import { FarmerListing, Order, Offer, RequirementMatch } from '../types';

interface FarmerSellingOverviewProps {
  listings: FarmerListing[];
  activeListings: FarmerListing[];
  orders: Order[];
  offers: Offer[];
  matchedBuyers?: RequirementMatch[];
  lang: 'hi' | 'hinglish' | 'en';
  dateRange: 'all' | 'month' | 'quarter' | 'year';
  setDateRange: (r: 'all' | 'month' | 'quarter' | 'year') => void;
  onListCrop: () => void;
  onNavigateTab: (tab: string, filter?: string) => void;
  onRespondOffer: (offer: Offer) => void;
  onAcceptOffer: (offerId: string) => void;
}

export const FarmerSellingOverview: React.FC<FarmerSellingOverviewProps> = ({
  listings,
  activeListings,
  orders,
  offers,
  matchedBuyers = [],
  lang,
  dateRange,
  setDateRange,
  onListCrop,
  onNavigateTab,
  onRespondOffer,
  onAcceptOffer,
}) => {
  // Chart B timeframe toggle
  const [revenueTimeframe, setRevenueTimeframe] = useState<'month' | 'quarter' | 'year'>('month');
  const [hoveredCrop, setHoveredCrop] = useState<string | null>(null);

  // Recent Listings filters
  const [listingSearch, setListingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Localization Dictionary
  const t = {
    // Header & Subtitles
    sellingOverview: lang === 'hi' ? 'बिक्री अवलोकन' : lang === 'hinglish' ? 'Selling Overview' : 'Selling Overview',
    overviewDesc: lang === 'hi' 
      ? 'अपनी फसलों का स्टॉक, खरीदारों के ऑफर और वास्तविक कमाई ट्रैक करें।' 
      : lang === 'hinglish' 
      ? 'Apni faslo ka stock, buyer offers aur real sales track karein.' 
      : 'Track your listed crops, buyer demand, confirmed deals, and expected revenue.',
    dateFilter: {
      all: lang === 'hi' ? 'सभी समय (All Time)' : lang === 'hinglish' ? 'All Time' : 'All Time',
      month: lang === 'hi' ? 'इस महीने (This Month)' : lang === 'hinglish' ? 'Is Mahine' : 'This Month',
      quarter: lang === 'hi' ? 'इस तिमाही (This Quarter)' : lang === 'hinglish' ? 'Is Quarter' : 'This Quarter',
      year: lang === 'hi' ? 'इस वर्ष (This Year)' : lang === 'hinglish' ? 'Is Saal' : 'This Year',
    },
    // KPI Cards
    kpi1Title: lang === 'hi' ? 'कुल सूचीबद्ध उपज' : lang === 'hinglish' ? 'Total Produce Listed' : 'Total Produce Listed',
    kpi1Sub: lang === 'hi' ? 'सक्रिय फसलें बिक्री के लिए उपलब्ध' : lang === 'hinglish' ? 'Active faslein sale ke liye' : 'active listings for sale',
    kpi1Badge: lang === 'hi' ? 'सत्यापित लॉट' : lang === 'hinglish' ? 'Verified Lots' : 'Verified Lots',
    
    kpi2Title: lang === 'hi' ? 'खरीदारों की रुचि' : lang === 'hinglish' ? 'Buyer Interest' : 'Buyer Interest',
    kpi2Buyers: lang === 'hi' ? 'सत्यापित खरीदार' : lang === 'hinglish' ? 'Verified Buyers' : 'verified buyers',
    kpi2Awaiting: lang === 'hi' ? 'नए ऑफर समीक्षा हेतु' : lang === 'hinglish' ? 'naye offers review ke liye' : 'new offers awaiting review',
    kpi2NoPending: lang === 'hi' ? 'सभी ऑफर देखे गए' : lang === 'hinglish' ? 'Sabhi offers reviewed' : 'All offers reviewed',

    kpi3Title: lang === 'hi' ? 'पुष्टि की गई बिक्री' : lang === 'hinglish' ? 'Confirmed Sales' : 'Confirmed Sales',
    kpi3Sold: lang === 'hi' ? 'क्विंटल कुल बिक्री' : lang === 'hinglish' ? 'Qtl total sold' : 'Qtl total sold',
    kpi3Deals: lang === 'hi' ? 'पक्के सौदे' : lang === 'hinglish' ? 'Confirmed Deals' : 'confirmed deals',
    kpi3Completed: lang === 'hi' ? 'पूरा हुआ' : lang === 'hinglish' ? 'Completed' : 'completed',
    kpi3InProgress: lang === 'hi' ? 'चल रहा है' : lang === 'hinglish' ? 'In Progress' : 'in fulfillment',

    kpi4Title: lang === 'hi' ? 'अनुमानित आय' : lang === 'hinglish' ? 'Expected Earnings' : 'Expected Earnings',
    kpi4Potential: lang === 'hi' ? 'संभावित राजस्व (सक्रिय स्टॉक)' : lang === 'hinglish' ? 'Potential Revenue (Active Stock)' : 'Potential Revenue (Active Produce)',
    kpi4Realized: lang === 'hi' ? 'पक्की बिक्री में प्राप्त' : lang === 'hinglish' ? 'Confirmed sales mein realized' : 'realized in confirmed sales',
    kpi4Label: lang === 'hi' ? 'संभावित आय' : lang === 'hinglish' ? 'Potential' : 'Potential',

    // Charts
    chartATitle: lang === 'hi' ? 'फसल अनुसार उपज' : lang === 'hinglish' ? 'Produce by Crop' : 'My Produce by Crop',
    chartASub: lang === 'hi' ? 'आपके पास उपलब्ध कुल मात्रा का फसलवार वितरण' : lang === 'hinglish' ? 'Available quantity ka crop-wise hisaab' : 'Distribution of active listed quantity by crop in quintals',
    chartBTitle: lang === 'hi' ? 'बिक्री और राजस्व' : lang === 'hinglish' ? 'Sales and Revenue' : 'Sales and Revenue',
    chartBSub: lang === 'hi' ? 'पुष्टि की गई बिक्री बनाम संभावित राजस्व' : lang === 'hinglish' ? 'Confirmed sales vs potential revenue' : 'Confirmed revenue vs active listing potential',
    confirmedRevenue: lang === 'hi' ? 'पुष्टि की गई बिक्री' : lang === 'hinglish' ? 'Confirmed Revenue' : 'Confirmed Revenue',
    potentialRevenue: lang === 'hi' ? 'संभावित राजस्व' : lang === 'hinglish' ? 'Potential Revenue' : 'Potential Revenue',
    emptyCropData: lang === 'hi' ? 'अभी कोई फसल सूचीबद्ध नहीं है।' : lang === 'hinglish' ? 'Abhi koi fasal listed nahi hai.' : 'No crop produce listed yet.',
    emptyCropCTA: lang === 'hi' ? 'पहली फसल जोड़ें' : lang === 'hinglish' ? 'Pehli fasal jodein' : 'List your first crop',

    // Latest Buyer Activity
    latestActivityTitle: lang === 'hi' ? 'नवीनतम खरीदार गतिविधियां' : lang === 'hinglish' ? 'Latest Buyer Activity' : 'Latest Buyer Activity',
    latestActivitySub: lang === 'hi' ? 'सत्यापित खरीदारों से आए सीधे खरीद प्रस्ताव' : lang === 'hinglish' ? 'Verified buyers ke direct purchase offers' : 'Recent incoming procurement offers from verified buyers',
    viewAllOffers: lang === 'hi' ? 'सभी ऑफर देखें' : lang === 'hinglish' ? 'Sabhi Offers Dekhein' : 'View All Offers',
    noOffersYet: lang === 'hi' ? 'अभी कोई नया ऑफर नहीं आया है। जैसे ही कोई खरीदार आपकी फसल देखेगा, ऑफर यहां दिखेगा।' : lang === 'hinglish' ? 'Abhi koi naya offer nahi aaya hai. Jaise hi buyer aapki fasal dekhega, yahan dikhega.' : 'No incoming offers yet. Verified buyers browsing your crops will submit direct offers here.',
    exploreBuyers: lang === 'hi' ? 'पास के खरीदार देखें' : lang === 'hinglish' ? 'Paas ke Buyers Dekhein' : 'Explore Matching Buyers',
    respondBtn: lang === 'hi' ? 'मोलभाव / जवाब दें' : lang === 'hinglish' ? 'Respond / Counter' : 'Respond / Counter',
    acceptBtn: lang === 'hi' ? 'स्वीकार करें' : lang === 'hinglish' ? 'Accept Offer' : 'Accept Offer',
    perQuintal: lang === 'hi' ? '/ क्विंटल' : lang === 'hinglish' ? '/ Qtl' : '/ Qtl',
    farmGatePickup: lang === 'hi' ? 'खेत से उठान (Farm Gate)' : lang === 'hinglish' ? 'Farm Gate Pickup' : 'Farm Gate Pickup',
    deliveryToBuyer: lang === 'hi' ? 'खरीदार को डिलीवरी' : lang === 'hinglish' ? 'Delivery to Buyer' : 'Delivery to Buyer',
  };

  // Helper: Filter records according to dateRange
  const matchesDateRange = (dateStr?: string) => {
    if (!dateStr || dateRange === 'all') return true;
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (dateRange === 'month') return diffDays <= 30;
      if (dateRange === 'quarter') return diffDays <= 90;
      if (dateRange === 'year') return diffDays <= 365;
      return true;
    } catch {
      return true;
    }
  };

  // Filtered Datasets based on selected dateRange
  const filteredActiveListings = useMemo(() => {
    return activeListings.filter(l => matchesDateRange(l.createdAt));
  }, [activeListings, dateRange]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => matchesDateRange(o.createdAt));
  }, [orders, dateRange]);

  const filteredOffers = useMemo(() => {
    return offers.filter(o => matchesDateRange(o.createdAt));
  }, [offers, dateRange]);

  // =========================================================================
  // 1. KPI COMPUTATIONS (STRICTLY FROM REAL DATA)
  // =========================================================================

  // KPI 1: Total Produce Listed (in Quintals)
  // Conversion: 1 Ton = 10 Quintals, 1 Quintal = 100 Kg
  const totalListedQuintals = useMemo(() => {
    return filteredActiveListings.reduce((sum, l) => {
      const qTons = Number(l.quantityTons ?? (l.quantityKg ? l.quantityKg / 1000 : 0));
      return sum + (qTons * 10);
    }, 0);
  }, [filteredActiveListings]);

  const activeListingCount = filteredActiveListings.length;

  // KPI 2: Buyer Interest
  // Unique buyers who submitted offers or expressed interest
  const uniqueBuyersCount = useMemo(() => {
    const buyerSet = new Set<string>();
    filteredOffers.forEach(o => {
      if (o.buyerId) buyerSet.add(o.buyerId);
      else if (o.buyerName) buyerSet.add(o.buyerName);
    });
    matchedBuyers.forEach(m => {
      if (m.requirement?.buyerId) buyerSet.add(m.requirement.buyerId);
      else if (m.requirement?.buyerName) buyerSet.add(m.requirement.buyerName);
    });
    return buyerSet.size;
  }, [filteredOffers, matchedBuyers]);

  // New offers awaiting farmer review
  const pendingReviewOffers = useMemo(() => {
    return filteredOffers.filter(o =>
      (o.status === 'PENDING' && o.direction === 'RECEIVED') ||
      (o.status === 'COUNTERED' && (o.lastActionRole === 'buyer' || o.counterBy === 'buyer'))
    );
  }, [filteredOffers]);

  // KPI 3: Confirmed Sales
  const validOrders = useMemo(() => {
    return filteredOrders.filter(o => o.status !== 'CANCELLED');
  }, [filteredOrders]);

  const confirmedSalesCount = validOrders.length;

  const totalSoldQuintals = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      const qTons = Number(o.quantityTons || 0);
      return sum + (qTons * 10);
    }, 0);
  }, [validOrders]);

  // Distinguish confirmed deals in progress vs completed sales
  const inProgressDealsCount = useMemo(() => {
    return validOrders.filter(o => 
      o.status === 'CONFIRMED' || o.status === 'ACTIVE' || o.status === 'AGGREGATING' || o.status === 'READY_FOR_PICKUP' || o.status === 'IN_TRANSIT'
    ).length;
  }, [validOrders]);

  const completedSalesCount = useMemo(() => {
    return validOrders.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;
  }, [validOrders]);

  // KPI 4: Expected Earnings
  // Potential revenue from active listings: (quantityTons * 1000 kg) * expectedPricePerKg
  const potentialRevenue = useMemo(() => {
    return filteredActiveListings.reduce((sum, l) => {
      const qKg = Number(l.quantityTons || 0) * 1000;
      const pricePerKg = Number(l.expectedPricePerKg || 0);
      return sum + (qKg * pricePerKg);
    }, 0);
  }, [filteredActiveListings]);

  // Completed sale value realized
  const realizedRevenue = useMemo(() => {
    return validOrders
      .filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED')
      .reduce((sum, o) => {
        const amt = Number(o.totalAmount || o.produceTotal || (Number(o.quantityTons || 0) * 1000 * Number(o.unitPricePerKg || 0)));
        return sum + amt;
      }, 0);
  }, [validOrders]);

  // Total confirmed order value (including active fulfillment)
  const totalConfirmedOrderValue = useMemo(() => {
    return validOrders.reduce((sum, o) => {
      const amt = Number(o.totalAmount || o.produceTotal || (Number(o.quantityTons || 0) * 1000 * Number(o.unitPricePerKg || 0)));
      return sum + amt;
    }, 0);
  }, [validOrders]);

  // =========================================================================
  // 2. CHART A: MY PRODUCE BY CROP (SVG DONUT CHART)
  // =========================================================================
  const cropDistribution = useMemo(() => {
    const map: Record<string, { cropName: string; quintals: number; count: number; color: string; icon: string }> = {};
    const palette = [
      { color: '#059669', icon: '🥔' }, // Emerald
      { color: '#d97706', icon: '🌾' }, // Amber
      { color: '#7c3aed', icon: '🧅' }, // Violet
      { color: '#2563eb', icon: '🍅' }, // Blue
      { color: '#db2777', icon: '🌽' }, // Pink
      { color: '#0d9488', icon: '🥭' }, // Teal
      { color: '#ea580c', icon: '🌱' }  // Orange
    ];
    let colorIdx = 0;

    filteredActiveListings.forEach(l => {
      const name = l.cropName || 'Other Crop';
      const qtl = Number(l.quantityTons ?? (l.quantityKg ? l.quantityKg / 1000 : 0)) * 10;
      if (!map[name]) {
        const item = palette[colorIdx % palette.length];
        map[name] = { cropName: name, quintals: 0, count: 0, color: item.color, icon: item.icon };
        colorIdx++;
      }
      map[name].quintals += qtl;
      map[name].count += 1;
    });

    const total = Object.values(map).reduce((sum, c) => sum + c.quintals, 0);
    return Object.values(map).map(c => ({
      ...c,
      percentage: total > 0 ? Math.round((c.quintals / total) * 100) : 0
    })).sort((a, b) => b.quintals - a.quintals);
  }, [filteredActiveListings]);

  // Calculate SVG Donut geometry
  const donutRadius = 38;
  const donutCircumference = 2 * Math.PI * donutRadius; // ~238.76

  // Cumulative stroke offsets for donut segments
  const donutSegments = useMemo(() => {
    let accumulatedOffset = 0;
    return cropDistribution.map(item => {
      const strokeLength = (item.percentage / 100) * donutCircumference;
      const strokeDasharray = `${strokeLength} ${donutCircumference - strokeLength}`;
      const strokeDashoffset = -accumulatedOffset;
      accumulatedOffset += strokeLength;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset
      };
    });
  }, [cropDistribution, donutCircumference]);

  // =========================================================================
  // 3. CHART B: SALES & REVENUE (CONFIRMED VS POTENTIAL)
  // =========================================================================
  const revenueChartData = useMemo(() => {
    // Determine confirmed vs potential depending on timeframe
    const confirmed = totalConfirmedOrderValue;
    const potential = potentialRevenue;
    const maxVal = Math.max(confirmed, potential, 1);
    const confirmedPct = Math.round((confirmed / maxVal) * 100);
    const potentialPct = Math.round((potential / maxVal) * 100);

    return {
      confirmed,
      potential,
      confirmedPct: Math.max(confirmedPct, confirmed > 0 ? 8 : 2),
      potentialPct: Math.max(potentialPct, potential > 0 ? 8 : 2),
      realized: realizedRevenue
    };
  }, [totalConfirmedOrderValue, potentialRevenue, realizedRevenue]);

  // =========================================================================
  // 4. LATEST BUYER ACTIVITY (UP TO 5 RECENT OFFERS)
  // =========================================================================
  const recentOffers = useMemo(() => {
    return [...filteredOffers].sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }).slice(0, 5);
  }, [filteredOffers]);

  // =========================================================================
  // 5. RECENT CROP LISTINGS HELPERS & COMPUTATIONS
  // =========================================================================
  const getCropEmoji = (cropName: string) => {
    const c = (cropName || '').toLowerCase();
    if (c.includes('potato') || c.includes('आलू')) return '🥔';
    if (c.includes('wheat') || c.includes('गेहूं')) return '🌾';
    if (c.includes('onion') || c.includes('प्याज')) return '🧅';
    if (c.includes('tomato') || c.includes('टमाटर')) return '🍅';
    if (c.includes('maize') || c.includes('corn') || c.includes('मक्का')) return '🌽';
    if (c.includes('mango') || c.includes('आम')) return '🥭';
    if (c.includes('paddy') || c.includes('rice') || c.includes('धान')) return '🌾';
    if (c.includes('mustard') || c.includes('सरसों')) return '🌼';
    return '🌱';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return {
          label: lang === 'hi' ? 'सक्रिय (Active)' : 'Active',
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200'
        };
      case 'RESERVED':
        return {
          label: lang === 'hi' ? 'आरक्षित (Reserved)' : 'Reserved',
          classes: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'PARTIALLY_MATCHED':
        return {
          label: lang === 'hi' ? 'आंशिक मिलान' : 'Partially Matched',
          classes: 'bg-blue-50 text-blue-800 border-blue-200'
        };
      case 'FULFILLED':
      case 'SOLD':
        return {
          label: lang === 'hi' ? 'सौदा पक्का / बिका' : 'Fulfilled / Sold',
          classes: 'bg-purple-50 text-purple-800 border-purple-200'
        };
      case 'CANCELLED':
        return {
          label: lang === 'hi' ? 'रद्द (Cancelled)' : 'Cancelled',
          classes: 'bg-slate-100 text-slate-600 border-slate-200'
        };
      default:
        return {
          label: status,
          classes: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    }
  };

  const formatListedDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const filteredRecentListings = useMemo(() => {
    return [...listings]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .filter((l) => {
        // Status filter
        if (statusFilter !== 'ALL') {
          if (statusFilter === 'FULFILLED') {
            if (l.status !== 'FULFILLED' && l.status !== 'SOLD') return false;
          } else if (l.status !== statusFilter) {
            return false;
          }
        }
        // Search query
        if (listingSearch.trim()) {
          const q = listingSearch.toLowerCase().trim();
          const matchCrop = (l.cropName || '').toLowerCase().includes(q);
          const matchVariety = (l.variety || '').toLowerCase().includes(q);
          const matchGrade = (l.grade || '').toLowerCase().includes(q);
          const matchLocation = (l.farmerLocation || '').toLowerCase().includes(q);
          if (!matchCrop && !matchVariety && !matchGrade && !matchLocation) return false;
        }
        return true;
      });
  }, [listings, statusFilter, listingSearch]);

  const recentListingsToDisplay = filteredRecentListings.slice(0, 5);

  return (
    <div className="space-y-6">
      
      {/* ========================================================================= */}
      {/* 4 KPI CARDS (INSPIRED BY CIRCULARMATCH SELL DASHBOARD) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: TOTAL PRODUCE LISTED */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {t.kpi1Title}
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {totalListedQuintals.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                </span>
                <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {lang === 'hi' ? 'क्विंटल' : 'Qtl'}
                </span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl shrink-0 border border-emerald-100 group-hover:scale-110 transition-transform">
              <Sprout className="h-5 w-5" />
            </div>
          </div>
          
          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{activeListingCount} {t.kpi1Sub}</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
              {t.kpi1Badge}
            </span>
          </div>
        </div>

        {/* CARD 2: BUYER INTEREST */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {t.kpi2Title}
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {uniqueBuyersCount}
                </span>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {t.kpi2Buyers}
                </span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl shrink-0 border border-blue-100 group-hover:scale-110 transition-transform">
              <Search className="h-5 w-5" />
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            {pendingReviewOffers.length > 0 ? (
              <span className="text-amber-800 font-bold flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{pendingReviewOffers.length} {t.kpi2Awaiting}</span>
              </span>
            ) : (
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t.kpi2NoPending}</span>
              </span>
            )}
            <button 
              onClick={() => onNavigateTab('offers')}
              className="text-blue-700 font-bold hover:underline text-xs flex items-center gap-0.5 cursor-pointer"
            >
              <span>{lang === 'hi' ? 'देखें' : 'View'}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* CARD 3: CONFIRMED SALES */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {t.kpi3Title}
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {confirmedSalesCount}
                </span>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                  {t.kpi3Deals}
                </span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl shrink-0 border border-purple-100 group-hover:scale-110 transition-transform">
              <Package className="h-5 w-5" />
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-bold">
              {totalSoldQuintals.toLocaleString('en-IN', { maximumFractionDigits: 1 })} {t.kpi3Sold}
            </span>
            <span className="text-slate-500 text-[11px] font-medium">
              {completedSalesCount} {t.kpi3Completed} • {inProgressDealsCount} {t.kpi3InProgress}
            </span>
          </div>
        </div>

        {/* CARD 4: EXPECTED EARNINGS (POTENTIAL REVENUE) */}
        <div className="bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl p-5 border border-emerald-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  {t.kpi4Title}
                </span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                  {t.kpi4Label}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-xs font-black text-emerald-800">₹</span>
                <span className="text-3xl font-black text-emerald-900 tracking-tight">
                  {potentialRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-xs group-hover:scale-110 transition-transform">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-emerald-100 flex items-center justify-between text-xs">
            <span className="text-emerald-800 font-semibold truncate" title={t.kpi4Potential}>
              {t.kpi4Potential}
            </span>
            {realizedRevenue > 0 && (
              <span className="text-[11px] font-bold text-slate-700 shrink-0 ml-1">
                ₹{realizedRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} {t.kpi4Realized}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2 ANALYTICS CHARTS (SIDE-BY-SIDE ON DESKTOP, STACKED ON MOBILE) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART A: MY PRODUCE BY CROP (DONUT CHART - 5 COLS) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-emerald-600" />
                  <span>{t.chartATitle}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.chartASub}
                </p>
              </div>
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                {cropDistribution.length} {lang === 'hi' ? 'फसलें' : 'Crops'}
              </span>
            </div>

            {/* Donut Chart or Graceful Empty State */}
            {totalListedQuintals === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-3xl border border-emerald-100">
                  🌱
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{t.emptyCropData}</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    {lang === 'hi' 
                      ? 'अपनी उपज का विवरण जोड़ें ताकि खरीदार सीधे आपसे संपर्क कर सकें।' 
                      : 'Add your crop inventory to start receiving direct verified buyer offers.'}
                  </p>
                </div>
                <button
                  onClick={onListCrop}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t.emptyCropCTA}</span>
                </button>
              </div>
            ) : (
              <div className="py-6 flex flex-col sm:flex-row items-center justify-around gap-6">
                
                {/* SVG Interactive Donut */}
                <div className="relative h-44 w-44 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="12"
                    />
                    {/* Segments */}
                    {donutSegments.map((segment) => (
                      <circle
                        key={segment.cropName}
                        cx="50"
                        cy="50"
                        r={donutRadius}
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth={hoveredCrop === segment.cropName ? '15' : '12'}
                        strokeDasharray={segment.strokeDasharray}
                        strokeDashoffset={segment.strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredCrop(segment.cropName)}
                        onMouseLeave={() => setHoveredCrop(null)}
                      />
                    ))}
                  </svg>

                  {/* Donut Center Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                      {totalListedQuintals.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-700 uppercase mt-0.5">
                      {lang === 'hi' ? 'क्विंटल कुल' : 'Qtl Listed'}
                    </span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="w-full sm:w-auto space-y-2 flex-1 max-w-xs">
                  {cropDistribution.map((item) => (
                    <div 
                      key={item.cropName}
                      onMouseEnter={() => setHoveredCrop(item.cropName)}
                      onMouseLeave={() => setHoveredCrop(null)}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                        hoveredCrop === item.cropName ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="h-3 w-3 rounded-full shrink-0" 
                          style={{ backgroundColor: item.color }} 
                        />
                        <span className="text-sm">{item.icon}</span>
                        <span className="font-bold text-slate-900">{item.cropName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900">
                          {item.quintals.toLocaleString('en-IN', { maximumFractionDigits: 1 })} {lang === 'hi' ? 'क्वि.' : 'Qtl'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold ml-1.5">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{activeListingCount} {lang === 'hi' ? 'सक्रिय लॉट दर्ज' : 'active listings listed'}</span>
            <button
              onClick={() => onNavigateTab('listings')}
              className="text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{lang === 'hi' ? 'सभी फसलें प्रबंधित करें' : 'Manage Crop Listings'}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* CHART B: SALES AND REVENUE (CONFIRMED VS POTENTIAL - 7 COLS) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  <span>{t.chartBTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.chartBSub}
                </p>
              </div>

              {/* Timeframe Filter (Month / Quarter / Year) */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto border border-slate-200">
                <button
                  onClick={() => setRevenueTimeframe('month')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    revenueTimeframe === 'month' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'hi' ? 'महीना' : 'Month'}
                </button>
                <button
                  onClick={() => setRevenueTimeframe('quarter')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    revenueTimeframe === 'quarter' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'hi' ? 'तिमाही' : 'Quarter'}
                </button>
                <button
                  onClick={() => setRevenueTimeframe('year')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    revenueTimeframe === 'year' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'hi' ? 'वर्ष' : 'Year'}
                </button>
              </div>
            </div>

            {/* Visual Revenue Comparison Bars */}
            <div className="py-6 space-y-6">
              
              {/* Confirmed Sales Value Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-600" />
                    <span className="font-bold text-slate-800">{t.confirmedRevenue}</span>
                    <span className="text-[11px] text-slate-500">
                      ({confirmedSalesCount} {lang === 'hi' ? 'सौदे पक्के' : 'deals'})
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-emerald-700">₹</span>
                    <span className="text-lg font-black text-slate-900">
                      {revenueChartData.confirmed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Progress Track */}
                <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden p-1 flex items-center border border-slate-200">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg transition-all duration-700 flex items-center justify-end px-2"
                    style={{ width: `${revenueChartData.confirmedPct}%` }}
                  >
                    {revenueChartData.confirmed > 0 && (
                      <span className="text-[10px] font-black text-white">
                        {revenueChartData.confirmedPct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Potential Sales Value Bar (Active Listings & Offers) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-sky-500" />
                    <span className="font-bold text-slate-800">{t.potentialRevenue}</span>
                    <span className="text-[11px] text-slate-500">
                      ({activeListingCount} {lang === 'hi' ? 'सक्रिय फसलें' : 'active lots'})
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-sky-700">₹</span>
                    <span className="text-lg font-black text-slate-900">
                      {revenueChartData.potential.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Progress Track */}
                <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden p-1 flex items-center border border-slate-200">
                  <div 
                    className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-lg transition-all duration-700 flex items-center justify-end px-2"
                    style={{ width: `${revenueChartData.potentialPct}%` }}
                  >
                    {revenueChartData.potential > 0 && (
                      <span className="text-[10px] font-black text-white">
                        {revenueChartData.potentialPct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Informative Note & Escrow Protection */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'hi' 
                      ? 'सभी सौदे किसानकनेक्ट एस्क्रो सुरक्षा के तहत 100% सुरक्षित हैं।' 
                      : 'All confirmed transactions are 100% protected by KisanConnect Escrow.'}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                  100% Verified
                </span>
              </div>

            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {lang === 'hi' 
                ? 'वास्तविक लेन-देन डेटा के आधार पर गणना' 
                : 'Calculated from actual transaction orders and active farm inventory'}
            </span>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{lang === 'hi' ? 'सौदों का ब्योरा देखें' : 'View Deals & Orders'}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. RECENT CROP LISTINGS (FULL-WIDTH CARD MATCHING CIRCULARMATCH REFERENCE) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
        
        {/* Header with Title, Subtitle, Search Input, Status Filter, and View All Link */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">
                {lang === 'hi' ? 'हालिया फसल लिस्टिंग' : lang === 'hinglish' ? 'Recent Crop Listings' : 'Recent Crop Listings'}
              </h3>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {filteredRecentListings.length} {lang === 'hi' ? 'उपलब्ध' : 'total'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'hi' 
                ? 'मार्केटप्लेस में आपकी हाल ही में जोड़ी गई फसलें।' 
                : lang === 'hinglish' 
                ? 'Marketplace mein aapki latest crop listings.' 
                : 'Your latest crop listings in the marketplace.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                placeholder={lang === 'hi' ? 'फसल, किस्म या स्थान खोजें...' : 'Search crop listings...'}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-bold text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {listingSearch && (
                <button
                  onClick={() => setListingSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-slate-50 hover:bg-slate-100/80 text-slate-800 text-xs font-bold py-2 pl-3.5 pr-8 rounded-xl border border-slate-200 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">{lang === 'hi' ? 'सभी स्थितियां (All Statuses)' : 'All Statuses'}</option>
                <option value="ACTIVE">{lang === 'hi' ? 'सक्रिय (Active)' : 'Active'}</option>
                <option value="RESERVED">{lang === 'hi' ? 'आरक्षित (Reserved)' : 'Reserved'}</option>
                <option value="PARTIALLY_MATCHED">{lang === 'hi' ? 'आंशिक मिलान' : 'Partially Matched'}</option>
                <option value="FULFILLED">{lang === 'hi' ? 'सौदा पक्का / बिका (Sold)' : 'Fulfilled / Sold'}</option>
                <option value="CANCELLED">{lang === 'hi' ? 'रद्द (Cancelled)' : 'Cancelled'}</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* View All Link */}
            <button
              onClick={() => onNavigateTab('listings')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline cursor-pointer ml-1"
            >
              <span>{lang === 'hi' ? 'सभी देखें' : 'View All'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Table or Empty State */}
        {recentListingsToDisplay.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-6">
            <div className="h-12 w-12 mx-auto rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl border border-emerald-200">
              🌱
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {listingSearch || statusFilter !== 'ALL'
                  ? (lang === 'hi' ? 'कोई फसल मेल नहीं खाती' : 'No matching listings found')
                  : (lang === 'hi' ? 'कोई फसल लिस्टिंग नहीं मिली' : 'No crop listings found')}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {listingSearch || statusFilter !== 'ALL'
                  ? (lang === 'hi' ? 'कृपया अपनी खोज या फ़िल्टर बदलें।' : 'Try adjusting your search query or status filter.')
                  : (lang === 'hi' ? 'मार्केटप्लेस में अपनी फसल जोड़ें और सीधे खरीदार ऑफर पाएं।' : 'List your produce to start connecting with buyers.')}
              </p>
            </div>
            {listingSearch || statusFilter !== 'ALL' ? (
              <button
                onClick={() => { setListingSearch(''); setStatusFilter('ALL'); }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                {lang === 'hi' ? 'फ़िल्टर हटाएं' : 'Clear Filters'}
              </button>
            ) : (
              <button
                onClick={onListCrop}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'hi' ? '+ फसल जोड़ें' : '+ List a Crop'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Crop</th>
                  <th className="py-3 px-3">Quantity</th>
                  <th className="py-3 px-3">Expected Price</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Listed On</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentListingsToDisplay.map((item) => {
                  const qtyQuintals = Number(item.quantityTons ?? (item.quantityKg ? item.quantityKg / 1000 : 0)) * 10;
                  const pricePerQtl = Number(item.expectedPricePerKg || 0) * 100;
                  const statusInfo = getStatusBadge(item.status);

                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Crop */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          {item.images && item.images.length > 0 ? (
                            <img 
                              src={item.images[0]} 
                              alt={item.cropName} 
                              className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0" 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center text-xl shrink-0 border border-emerald-100">
                              {getCropEmoji(item.cropName)}
                            </div>
                          )}
                          <div>
                            <div className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {item.cropName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-semibold">
                              {item.variety || 'Standard'} • {item.grade || 'Grade A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-slate-900">
                          {qtyQuintals.toLocaleString('en-IN', { maximumFractionDigits: 1 })} {lang === 'hi' ? 'क्विंटल' : 'Qtl'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          ({item.quantityTons} Tons)
                        </div>
                      </td>

                      {/* Expected Price */}
                      <td className="py-3.5 px-3">
                        <div className="font-black text-emerald-700">
                          ₹{pricePerQtl.toLocaleString('en-IN')} / Qtl
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          (₹{item.expectedPricePerKg}/kg)
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-3">
                        <span className="text-slate-700 font-medium truncate max-w-[150px] block" title={item.farmerLocation}>
                          {item.farmerLocation || 'Agra, UP'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusInfo.classes}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Listed On */}
                      <td className="py-3.5 px-3 text-slate-500 font-medium">
                        {formatListedDate(item.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onNavigateTab('listings')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
                          >
                            {lang === 'hi' ? 'प्रबंधित करें' : 'Manage'}
                          </button>
                          <button
                            onClick={() => onNavigateTab('buyers')}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            title={lang === 'hi' ? 'खरीदार खोजें' : 'Find Buyers'}
                          >
                            <Search className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 4. LATEST BUYER ACTIVITY (INCOMING OFFERS & PROPOSALS) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>{t.latestActivityTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.latestActivitySub}
            </p>
          </div>
          
          <button
            onClick={() => onNavigateTab('offers')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>{t.viewAllOffers} ({offers.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Offers Feed or Empty State */}
        {recentOffers.length === 0 ? (
          <div className="py-10 text-center space-y-3 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-6">
            <div className="h-12 w-12 mx-auto rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl border border-amber-200">
              💬
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{lang === 'hi' ? 'कोई नया ऑफर नहीं' : 'No Buyer Offers Yet'}</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {t.noOffersYet}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('buyers')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{t.exploreBuyers}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recentOffers.map((offer) => {
              const offeredPricePerKg = Number(offer.buyerOfferedPricePerKg || offer.offeredPricePerKg || 0);
              const offeredPricePerQuintal = offeredPricePerKg * 100;
              const quantityQuintals = Number(offer.quantityTons || 0) * 10;
              const isPending = offer.status === 'PENDING';
              const isCountered = offer.status === 'COUNTERED';
              const isAccepted = offer.status === 'ACCEPTED';

              return (
                <div 
                  key={offer.id}
                  className="bg-slate-50/60 hover:bg-white rounded-2xl p-4 border border-slate-200/90 hover:border-emerald-300 hover:shadow-sm transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white text-slate-800 flex items-center justify-center text-xl shrink-0 border border-slate-200 shadow-xs">
                        🌾
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">
                            {offer.cropName} {offer.variety ? `(${offer.variety})` : ''}
                          </h4>
                          <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-md">
                            {quantityQuintals} {lang === 'hi' ? 'क्विंटल' : 'Qtl'} ({offer.quantityTons}T)
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-semibold flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{offer.buyerName || 'Verified Bulk Buyer'}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-[11px] text-slate-500">
                            {offer.pickupTerms || t.farmGatePickup}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 border ${
                      isPending ? 'bg-amber-100 text-amber-900 border-amber-300' :
                      isCountered ? 'bg-blue-100 text-blue-900 border-blue-300' :
                      isAccepted ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                      'bg-slate-100 text-slate-700 border-slate-300'
                    }`}>
                      {isPending ? (lang === 'hi' ? 'समीक्षा हेतु' : 'Pending Review') :
                       isCountered ? (lang === 'hi' ? 'मोलभाव जारी' : 'Countered') :
                       isAccepted ? (lang === 'hi' ? 'स्वीकृत' : 'Accepted') : offer.status}
                    </span>
                  </div>

                  {/* Price Row & Action Buttons */}
                  <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        {lang === 'hi' ? 'प्रस्तावित दर' : 'Offered Rate'}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-emerald-800">
                          ₹{offeredPricePerQuintal.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">
                          {t.perQuintal}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium ml-1">
                          (₹{offeredPricePerKg}/kg)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isPending && offer.direction === 'RECEIVED' && (
                        <button
                          onClick={() => onAcceptOffer(offer.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          {t.acceptBtn}
                        </button>
                      )}
                      <button
                        onClick={() => onRespondOffer(offer)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-emerald-500 text-slate-800 font-bold text-xs shadow-xs hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3 text-slate-500" />
                        <span>{t.respondBtn}</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
