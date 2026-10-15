import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { 
  FarmerDigitalProfile, 
  FarmerField, 
  FarmerCropRecord, 
  KisanPointsLedgerEntry, 
  Order, 
  FarmActivity,
  FarmerListing
} from '../types';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Layers, 
  Sprout, 
  Coins, 
  TrendingUp, 
  ShieldCheck, 
  Award, 
  CheckCircle2, 
  Plus, 
  Edit3, 
  Trash2, 
  Calendar, 
  Droplets, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  AlertCircle, 
  RotateCw, 
  X, 
  Check, 
  FileText, 
  ChevronRight, 
  Sparkles,
  Settings,
  Shield,
  Package,
  Globe,
  Sliders
} from 'lucide-react';
import { FarmTraceabilityModal } from './FarmTraceabilityModal';
import { FieldActivityLoggerModal } from './FieldActivityLoggerModal';

export type ProfileSection = 'overview' | 'passport' | 'fields' | 'crops' | 'sales' | 'points' | 'settings';

interface FarmerProfilePageProps {
  initialSubTab?: ProfileSection;
  onNavigate?: (path: string) => void;
}

export const FarmerProfilePage: React.FC<FarmerProfilePageProps> = ({
  initialSubTab,
  onNavigate
}) => {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const isHi = language === 'hi';

  // Read section from URL query or fallback
  const getInitialSection = (): ProfileSection => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('section') || params.get('subtab');
      if (s && ['overview', 'passport', 'fields', 'crops', 'sales', 'points', 'settings'].includes(s)) {
        return s as ProfileSection;
      }
      const p = window.location.pathname;
      if (p === '/passport') return 'passport';
      if (p === '/fields') return 'fields';
      if (p === '/crops') return 'crops';
      if (p === '/sales') return 'sales';
      if (p === '/kisan-points') return 'points';
    }
    return initialSubTab || 'overview';
  };

  const [activeSection, setActiveSection] = useState<ProfileSection>(getInitialSection);
  const [profile, setProfile] = useState<FarmerDigitalProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activitiesList, setActivitiesList] = useState<FarmActivity[]>([]);
  const [pointsLedger, setPointsLedger] = useState<KisanPointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Modals
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState<boolean>(false);
  const [editingField, setEditingField] = useState<FarmerField | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [editingCrop, setEditingCrop] = useState<FarmerCropRecord | null>(null);
  const [showTraceModal, setShowTraceModal] = useState<boolean>(false);
  const [showLoggerModal, setShowLoggerModal] = useState<boolean>(false);

  // Field Form State
  const [fieldForm, setFieldForm] = useState({
    name: '',
    areaAcres: '',
    village: '',
    district: '',
    state: '',
    ownershipStatus: 'owned' as 'owned' | 'leased',
    irrigationSource: 'borewell',
    soilType: 'alluvial',
    latitude: '',
    longitude: ''
  });

  // Crop Record Form State
  const [cropForm, setCropForm] = useState({
    fieldId: '',
    cropName: '',
    variety: '',
    season: 'Rabi' as 'Kharif' | 'Rabi' | 'Zaid',
    sowingDate: '',
    expectedHarvestDate: '',
    estimatedYield: '',
    yieldUnit: 'Quintals',
    actualHarvestedQuantity: '',
    quantityForSale: '',
    status: 'Growing' as 'Planned' | 'Growing' | 'Ready to Harvest' | 'Harvested' | 'Sold',
    notes: ''
  });

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    village: '',
    district: '',
    state: '',
    preferredLanguage: 'hi',
    avatarUrl: ''
  });

  // Banner Helper
  const showBanner = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 4000);
  };

  // Fetch full data
  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, ordersRes, activitiesRes, pointsRes] = await Promise.all([
        api.getFarmerProfile().catch(() => null),
        api.getOrders().catch(() => []),
        api.getActivities().catch(() => []),
        api.getFarmerPoints().catch(() => null)
      ]);

      if (profileRes && profileRes.success && profileRes.profile) {
        setProfile(profileRes.profile);
        setProfileForm({
          name: profileRes.profile.name || user?.name || '',
          village: profileRes.profile.village || '',
          district: profileRes.profile.district || '',
          state: profileRes.profile.state || '',
          preferredLanguage: profileRes.profile.preferredLanguage || 'hi',
          avatarUrl: profileRes.profile.avatarUrl || ''
        });
      }

      if (Array.isArray(ordersRes)) {
        setOrders(ordersRes);
      } else if (ordersRes && (ordersRes as any).orders) {
        setOrders((ordersRes as any).orders);
      }

      if (Array.isArray(activitiesRes)) {
        setActivitiesList(activitiesRes);
      }

      if (pointsRes && pointsRes.success && Array.isArray(pointsRes.ledger)) {
        setPointsLedger(pointsRes.ledger);
      }
    } catch (e) {
      console.error('Error loading farmer profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Sync popstate for browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setActiveSection(getInitialSection());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Section Change Handler
  const handleSelectSection = (section: ProfileSection) => {
    setActiveSection(section);
    const newUrl = `/profile?section=${section}`;
    window.history.pushState(null, '', newUrl);
  };

  const handleBackToDashboard = () => {
    if (onNavigate) onNavigate('/dashboard');
    else window.location.href = '/dashboard';
  };

  // -------------------------------------------------------------
  // FIELD HANDLERS
  // -------------------------------------------------------------
  const openAddField = () => {
    setEditingField(null);
    setFieldForm({
      name: '',
      areaAcres: '',
      village: profile?.village || '',
      district: profile?.district || '',
      state: profile?.state || 'Uttar Pradesh',
      ownershipStatus: 'owned',
      irrigationSource: 'borewell',
      soilType: 'alluvial',
      latitude: '',
      longitude: ''
    });
    setIsFieldModalOpen(true);
  };

  const openEditField = (f: FarmerField) => {
    setEditingField(f);
    setFieldForm({
      name: f.name,
      areaAcres: String(f.areaAcres),
      village: f.village || profile?.village || '',
      district: f.district || profile?.district || '',
      state: f.state || profile?.state || '',
      ownershipStatus: f.ownershipStatus || 'owned',
      irrigationSource: f.irrigationSource || 'borewell',
      soilType: f.soilType || 'alluvial',
      latitude: f.latitude ? String(f.latitude) : '',
      longitude: f.longitude ? String(f.longitude) : ''
    });
    setIsFieldModalOpen(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.name.trim()) return alert(isHi ? 'कृपया खेत का नाम दर्ज करें' : 'Field name is required');
    const acres = Number(fieldForm.areaAcres);
    if (isNaN(acres) || acres <= 0) return alert(isHi ? 'कृपया मान्य क्षेत्रफल (एकड़) दर्ज करें' : 'Valid acreage is required');
    if (!fieldForm.village.trim() || !fieldForm.district.trim() || !fieldForm.state.trim()) {
      return alert(isHi ? 'गाँव, जिला और राज्य आवश्यक हैं' : 'Village, district, and state are required');
    }

    try {
      const payload: any = {
        name: fieldForm.name.trim(),
        areaAcres: acres,
        village: fieldForm.village.trim(),
        district: fieldForm.district.trim(),
        state: fieldForm.state.trim(),
        ownershipStatus: fieldForm.ownershipStatus,
        irrigationSource: fieldForm.irrigationSource,
        soilType: fieldForm.soilType,
        latitude: fieldForm.latitude ? Number(fieldForm.latitude) : null,
        longitude: fieldForm.longitude ? Number(fieldForm.longitude) : null
      };

      if (editingField) {
        await api.updateFarmerField(editingField.id, payload);
        showBanner(isHi ? 'खेत की जानकारी सफलतापूर्वक अपडेट की गई!' : 'Field updated successfully!');
      } else {
        await api.addFarmerField(payload);
        showBanner(isHi ? 'नया खेत जोड़ा गया! +20 किसान पॉइंट्स अर्जित हुए।' : 'New field registered! +20 Kisan Points awarded.');
      }

      setIsFieldModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error saving field');
    }
  };

  const handleDeleteField = async (field: FarmerField) => {
    const confirmMsg = isHi
      ? `क्या आप वाकई "${field.name}" (${field.areaAcres} एकड़) को हटाना चाहते हैं?`
      : `Delete field "${field.name}" (${field.areaAcres} acres)?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteFarmerField(field.id);
      showBanner(isHi ? 'खेत हटा दिया गया।' : 'Field removed successfully.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting field');
    }
  };

  // -------------------------------------------------------------
  // CROP HANDLERS
  // -------------------------------------------------------------
  const openAddCrop = (defaultFieldId?: string) => {
    setEditingCrop(null);
    setCropForm({
      fieldId: defaultFieldId || (profile?.fields[0]?.id || ''),
      cropName: '',
      variety: '',
      season: 'Rabi',
      sowingDate: new Date().toISOString().split('T')[0],
      expectedHarvestDate: '',
      estimatedYield: '',
      yieldUnit: 'Quintals',
      actualHarvestedQuantity: '',
      quantityForSale: '',
      status: 'Growing',
      notes: ''
    });
    setIsCropModalOpen(true);
  };

  const openEditCrop = (crop: FarmerCropRecord) => {
    setEditingCrop(crop);
    setCropForm({
      fieldId: crop.fieldId || '',
      cropName: crop.cropName,
      variety: crop.variety || '',
      season: crop.season,
      sowingDate: crop.sowingDate ? crop.sowingDate.split('T')[0] : '',
      expectedHarvestDate: crop.expectedHarvestDate ? crop.expectedHarvestDate.split('T')[0] : '',
      estimatedYield: crop.estimatedYield ? String(crop.estimatedYield) : '',
      yieldUnit: crop.yieldUnit || 'Quintals',
      actualHarvestedQuantity: crop.actualHarvestedQuantity ? String(crop.actualHarvestedQuantity) : '',
      quantityForSale: crop.quantityForSale ? String(crop.quantityForSale) : '',
      status: crop.status || 'Growing',
      notes: crop.notes || ''
    });
    setIsCropModalOpen(true);
  };

  const handleSaveCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropForm.cropName.trim()) return alert(isHi ? 'कृपया फसल का नाम दर्ज करें' : 'Crop name is required');
    if (!cropForm.fieldId) return alert(isHi ? 'कृपया खेत चुनें' : 'Please select a field');

    try {
      const payload: any = {
        fieldId: cropForm.fieldId,
        cropName: cropForm.cropName.trim(),
        variety: cropForm.variety.trim(),
        season: cropForm.season,
        sowingDate: cropForm.sowingDate || new Date().toISOString(),
        expectedHarvestDate: cropForm.expectedHarvestDate || null,
        estimatedYield: Number(cropForm.estimatedYield) || 0,
        yieldUnit: cropForm.yieldUnit,
        actualHarvestedQuantity: Number(cropForm.actualHarvestedQuantity) || 0,
        quantityForSale: Number(cropForm.quantityForSale) || 0,
        status: cropForm.status,
        notes: cropForm.notes.trim()
      };

      if (editingCrop) {
        await api.updateFarmerCropRecord(editingCrop.id, payload);
        showBanner(isHi ? 'फसल रिकॉर्ड अपडेट हुआ!' : 'Crop record updated successfully!');
      } else {
        await api.addFarmerCropRecord(payload);
        showBanner(isHi ? 'नई फसल दर्ज की गई! +10 किसान पॉइंट्स अर्जित हुए।' : 'New crop record logged! +10 Kisan Points awarded.');
      }

      setIsCropModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error saving crop record');
    }
  };

  const handleDeleteCrop = async (crop: FarmerCropRecord) => {
    const confirmMsg = isHi
      ? `क्या आप फसल रिकॉर्ड "${crop.cropName}" को हटाना चाहते हैं?`
      : `Delete crop record "${crop.cropName}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteFarmerCropRecord(crop.id);
      showBanner(isHi ? 'फसल रिकॉर्ड हटा दिया गया।' : 'Crop record deleted.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting crop record');
    }
  };

  // -------------------------------------------------------------
  // PROFILE HANDLER
  // -------------------------------------------------------------
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateFarmerProfile(profileForm);
      showBanner(isHi ? 'प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई!' : 'Farmer profile updated successfully!');
      setIsEditProfileOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating profile');
    }
  };

  // Initials calculation
  const initials = useMemo(() => {
    const name = profile?.name || user?.name || 'Farmer';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [profile?.name, user?.name]);

  const navItems = [
    { id: 'overview', label: isHi ? 'प्रोफाइल सारांश' : 'Profile Overview', icon: User },
    { id: 'passport', label: isHi ? 'किसान पासपोर्ट' : 'Farmer Passport', icon: ShieldCheck, badge: 'NaLamKI' },
    { id: 'fields', label: isHi ? 'मेरे खेत' : 'My Fields', icon: Layers, count: profile?.fields?.length || 0 },
    { id: 'crops', label: isHi ? 'फसल रिकॉर्ड' : 'Crop Records', icon: Sprout, count: profile?.cropRecords?.length || 0 },
    { id: 'sales', label: isHi ? 'मेरी बिक्री' : 'My Sales', icon: TrendingUp, count: orders.length || profile?.metrics?.totalCompletedSales || 0 },
    { id: 'points', label: isHi ? 'किसान पॉइंट्स' : 'Kisan Points', icon: Coins, count: profile?.metrics?.kisanPointsBalance || (user as any)?.kisanPoints || 0, isPoints: true },
    { id: 'settings', label: isHi ? 'खाता सेटिंग्स' : 'Account Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-16 text-slate-800 animate-fadeIn max-w-[1600px] mx-auto">
      
      {/* 1. TOP HEADER & BREADCRUMB BAR */}
      <div className="bg-white rounded-2xl border border-[#E5E0D5] p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-colors border border-slate-200 shadow-2xs"
            title={isHi ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}
          >
            <ArrowLeft className="w-4 h-4 text-emerald-700" />
            <span>{isHi ? 'किसान डैशबोर्ड' : 'Back to Dashboard'}</span>
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-200" />

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span>KisanOS</span>
            <span>/</span>
            <span className="text-[#315C45] font-black">
              {navItems.find(n => n.id === activeSection)?.label}
            </span>
          </div>
        </div>

        {/* Action button in header if relevant */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {activeSection === 'fields' && (
            <button
              onClick={openAddField}
              className="px-3.5 py-1.5 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isHi ? '+ नया खेत जोड़ें' : '+ Add Field'}</span>
            </button>
          )}

          {activeSection === 'crops' && (
            <button
              onClick={() => openAddCrop()}
              className="px-3.5 py-1.5 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isHi ? '+ फसल दर्ज करें' : '+ Add Crop Record'}</span>
            </button>
          )}

          {activeSection === 'overview' && (
            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
              <span>{isHi ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Alert Banner */}
      {bannerMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
          <button onClick={() => setBannerMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. MAIN TWO-PANEL LAYOUT (LEFT SIDEBAR + MAIN CONTENT AREA) */}
      <div className="flex flex-col lg:flex-row items-start gap-6">

        {/* ------------------------------------------------------------- */}
        {/* LEFT SIDEBAR PANEL                                            */}
        {/* ------------------------------------------------------------- */}
        <aside className="w-full lg:w-72 shrink-0 space-y-4">
          
          {/* Top Farmer Profile Identity Card */}
          <div className="bg-white rounded-3xl p-5 border border-[#E5E0D5] shadow-xs space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                {profile?.avatarUrl || user?.avatar ? (
                  <img
                    src={profile?.avatarUrl || user?.avatar}
                    alt={profile?.name || user?.name}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#315C45]/20 ring-offset-2 shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#315C45] to-[#1E3A2B] text-white flex items-center justify-center font-black text-lg shadow-xs ring-2 ring-[#315C45]/20 ring-offset-2">
                    {initials}
                  </div>
                )}
                <div 
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center text-[10px] font-black shadow-xs" 
                  title="Verified Account"
                >
                  ✓
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black text-[#26332C] truncate">
                  {profile?.name || user?.name || 'किसान'}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#EEF5F2] text-[#315C45] border border-[#D5E5DC]">
                    🌾 {isHi ? 'पंजीकृत किसान' : 'Farmer'}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 mt-1 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{isHi ? 'सत्यापित खाता' : 'Verified Account'}</span>
                </div>
              </div>
            </div>

            {/* Registered Phone */}
            <div className="text-xs text-slate-600 font-medium pt-2 border-t border-slate-100 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800">{profile?.phone || user?.phone || '+91 98765 43210'}</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="bg-white rounded-3xl p-2.5 border border-[#E5E0D5] shadow-xs space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id as ProfileSection)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#315C45] text-white shadow-xs'
                      : 'text-[#26332C] hover:bg-[#FAF9F5] hover:text-[#315C45]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#315C45]'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {/* Badge / Count */}
                  {item.badge && (
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {typeof item.count === 'number' && (
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : item.isPoints 
                          ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                          : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.isPoints ? `${item.count} pts` : item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Sign Out from Profile */}
          <div className="bg-white rounded-2xl p-3 border border-[#E5E0D5] shadow-2xs">
            <button
              type="button"
              onClick={async () => {
                await logout();
                if (onNavigate) onNavigate('/');
                else window.location.href = '/';
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center justify-between cursor-pointer transition-colors"
            >
              <span>{isHi ? 'साइन आउट (Sign Out)' : 'Sign Out'}</span>
              <span className="text-slate-400 text-sm">↳</span>
            </button>
          </div>

        </aside>

        {/* ------------------------------------------------------------- */}
        {/* RIGHT MAIN CONTENT AREA (SHOWS ONLY SELECTED SECTION)          */}
        {/* ------------------------------------------------------------- */}
        <main className="flex-1 min-w-0 w-full space-y-6">

          {/* SECTION 1: PROFILE OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Profile Details Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    {profile?.avatarUrl || user?.avatar ? (
                      <img
                        src={profile?.avatarUrl || user?.avatar}
                        alt={profile?.name || user?.name}
                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#315C45]/20 ring-offset-2 shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#315C45] to-[#1E3A2B] text-white flex items-center justify-center font-black text-2xl shadow-xs ring-2 ring-[#315C45]/20 ring-offset-2">
                        {initials}
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#26332C]">
                        {profile?.name || user?.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{[profile?.village, profile?.district, profile?.state].filter(Boolean).join(', ') || 'Agra, Uttar Pradesh'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEditProfileOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors self-start sm:self-auto"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{isHi ? 'विवरण संपादित करें' : 'Edit Profile'}</span>
                  </button>
                </div>

                {/* Identity Verification Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                        {isHi ? 'आधार सत्यापन' : 'Aadhaar Identity'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{isHi ? 'सत्यापित' : 'Verified'}</span>
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800">XXXX-XXXX-4819</div>
                    <div className="text-[11px] text-emerald-700 font-medium">✓ UIDAI / AgriStack Link Active</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                        {isHi ? 'मोबाइल सत्यापन' : 'Mobile Verification'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{isHi ? 'सत्यापित' : 'Verified'}</span>
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-800">{profile?.phone || user?.phone || '+91 98765 43210'}</div>
                    <div className="text-[11px] text-emerald-700 font-medium">✓ 2FA OTP Verified</div>
                  </div>
                </div>

                {/* Profile Completion Progress */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-[#F2F8F5] border border-emerald-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <span>{isHi ? 'डिजिटल प्रोफाइल पूर्णता:' : 'Profile Completion Status:'}</span>
                    </div>
                    <span className="text-sm font-black text-[#315C45]">{profile?.completion?.percentage || 85}%</span>
                  </div>

                  <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-emerald-200">
                    <div 
                      className="h-full bg-[#315C45] rounded-full transition-all duration-500"
                      style={{ width: `${profile?.completion?.percentage || 85}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <span className="text-emerald-800 font-bold flex items-center gap-1">✓ व्यक्तिगत विवरण</span>
                    <span className="text-emerald-800 font-bold flex items-center gap-1">✓ आधार व मोबाइल</span>
                    <span className={`${profile?.fields?.length ? 'text-emerald-800 font-bold' : 'text-slate-400'} flex items-center gap-1`}>
                      {profile?.fields?.length ? '✓' : '○'} खेत पंजीकृत
                    </span>
                    <span className={`${profile?.cropRecords?.length ? 'text-emerald-800 font-bold' : 'text-slate-400'} flex items-center gap-1`}>
                      {profile?.cropRecords?.length ? '✓' : '○'} फसल रिकॉर्ड
                    </span>
                  </div>
                </div>

                {/* Account Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{isHi ? 'कुल भूमि' : 'Total Land'}</div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">{profile?.metrics?.totalCultivatedAcres || 12} एकड़</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{isHi ? 'पंजीकृत खेत' : 'Fields'}</div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">{profile?.fields?.length || 0}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{isHi ? 'किसान पॉइंट्स' : 'Kisan Points'}</div>
                    <div className="text-lg font-black text-amber-700 mt-0.5">{profile?.metrics?.kisanPointsBalance || (user as any)?.kisanPoints || 0} pts</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{isHi ? 'सक्रिय फसलें' : 'Active Crops'}</div>
                    <div className="text-lg font-black text-emerald-800 mt-0.5">{profile?.metrics?.activeCropsCount || 0}</div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* SECTION 2: FARMER PASSPORT */}
          {activeSection === 'passport' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-bold shadow-2xs">
                      📜
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-slate-900">
                          {isHi ? 'आधिकारिक किसान डिजिटल पासपोर्ट' : 'Official Farmer Digital Passport'}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                          NaLamKI Open Twin
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isHi ? 'पहचान, भूमि अभिलेख एवं फसल ट्रेसेबिलिटी का आधिकारिक प्रमाण' : 'Official verification proof of identity, land titles, and crop history'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTraceModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isHi ? 'पासपोर्ट प्रमाण पत्र' : 'View Certificate'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLoggerModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isHi ? 'खेत डायरी प्रविष्टि' : 'Log Activity'}</span>
                    </button>
                  </div>
                </div>

                {/* Passport Credential Card */}
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-[#193225] text-white rounded-3xl p-6 sm:p-7 shadow-md space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 bg-white/10 px-2.5 py-1 rounded-md border border-white/20">
                        CREDENTIAL ID: KC-PASSPORT-2026-0819
                      </span>
                      <h4 className="text-xl font-black mt-2">{profile?.name || user?.name}</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        {profile?.village || 'Khandauli'}, {profile?.district || 'Agra'}, {profile?.state || 'Uttar Pradesh'}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-2xl shadow-xs text-center shrink-0">
                      <div className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-mono font-bold">
                        QR CODE
                      </div>
                      <span className="text-[9px] font-black text-slate-700 block mt-1">VERIFIED TWIN</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">LAND PARCELS</span>
                      <span className="font-bold text-white">{profile?.fields?.length || 0} Registered Plots</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">TOTAL ACREAGE</span>
                      <span className="font-bold text-white">{profile?.metrics?.totalCultivatedAcres || 12} Acres</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">TRUST TIER</span>
                      <span className="font-bold text-emerald-300">Level 2 Verified Farmer</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">DIGITAL LEDGER</span>
                      <span className="font-bold text-amber-300">AgriStack Compliant</span>
                    </div>
                  </div>
                </div>

                {/* Farm Activity Diary / Traceability Feed */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                      <span>🌾 खेत डायरी एवं गतिविधियां (Farm Activity Log)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">
                        {activitiesList.length} Entries
                      </span>
                    </h4>
                  </div>

                  {activitiesList.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                      <p className="text-xs text-slate-600 font-medium">
                        {isHi ? 'अभी तक कोई खेत गतिविधि दर्ज नहीं हुई है।' : 'No farm activities logged yet in your digital diary.'}
                      </p>
                      <button
                        onClick={() => setShowLoggerModal(true)}
                        className="px-4 py-2 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white font-bold text-xs cursor-pointer shadow-xs"
                      >
                        {isHi ? '+ पहली गतिविधि दर्ज करें' : '+ Log First Activity'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activitiesList.slice(0, 6).map((act, i) => (
                        <div key={act.id || i} className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 font-black">
                              🌱
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block">{act.name || act.typeLabel || 'खेत गतिविधि'}</span>
                              <span className="text-[11px] text-slate-500">
                                {act.cropName || 'खेत'} • {new Date(act.startsAt || Date.now()).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            {act.status || 'Verified'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* SECTION 3: MY FIELDS */}
          {activeSection === 'fields' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>{isHi ? 'मेरे पंजीकृत खेत (My Fields)' : 'My Registered Fields'}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                        {profile?.fields?.length || 0}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isHi ? 'खेत का विवरण दर्ज करें और प्रति खेत +20 किसान पॉइंट्स अर्जित करें' : 'Manage registered parcels and earn +20 points per verified plot'}
                    </p>
                  </div>

                  <button
                    onClick={openAddField}
                    className="px-4 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isHi ? '+ नया खेत जोड़ें' : '+ Add New Field'}</span>
                  </button>
                </div>

                {/* Fields Grid / Empty State */}
                {(!profile?.fields || profile.fields.length === 0) ? (
                  <div className="p-12 rounded-3xl bg-[#FAF9F5] border-2 border-dashed border-[#D8D2C4] text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-bold">
                      🌾
                    </div>
                    <h4 className="font-black text-base text-slate-900">
                      {isHi ? 'कोई खेत पंजीकृत नहीं है' : 'No fields registered yet'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {isHi ? 'अपनी जमीन का विवरण जोड़ें। हर खेत जोड़ने पर आपको 20 किसान पॉइंट्स मिलेंगे।' : 'Add your first plot to track crop yield, irrigation, and earn 20 points.'}
                    </p>
                    <button
                      onClick={openAddField}
                      className="px-5 py-2.5 rounded-xl bg-[#315C45] text-white font-bold text-xs hover:bg-[#254634] shadow-xs cursor-pointer transition-colors"
                    >
                      {isHi ? '+ पहला खेत जोड़ें (+20 Pts)' : '+ Register First Field (+20 Pts)'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.fields.map((f) => (
                      <div key={f.id} className="p-5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] space-y-3 shadow-2xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-black text-base text-slate-900">{f.name}</h4>
                            <span className="text-xs text-slate-500">
                              {[f.village, f.district, f.state].filter(Boolean).join(', ')}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black">
                            {f.areaAcres} एकड़
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                          <div>
                            <span className="text-slate-400 text-[10px] block">स्वामित्व / Ownership:</span>
                            <span className="font-bold text-slate-700 capitalize">{f.ownershipStatus || 'Owned'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">सिंचाई / Irrigation:</span>
                            <span className="font-bold text-slate-700 capitalize">{f.irrigationSource || 'Borewell'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">मिट्टी / Soil:</span>
                            <span className="font-bold text-slate-700 capitalize">{f.soilType || 'Alluvial'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">वर्तमान फसल / Crop:</span>
                            <span className="font-bold text-emerald-700">{(f as any).currentCropName || 'परती (Fallow)'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            onClick={() => openEditField(f)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteField(f)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* SECTION 4: CROP RECORDS */}
          {activeSection === 'crops' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>{isHi ? 'फसल रिकॉर्ड (Crop Records)' : 'My Crop Records'}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                        {profile?.cropRecords?.length || 0}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isHi ? 'फसल की बुवाई, अनुमानित पैदावार और बिक्री रिकॉर्ड दर्ज करें (+10 किसान पॉइंट्स)' : 'Log crop cycles, estimated yields, and produce available for sale (+10 pts)'}
                    </p>
                  </div>

                  <button
                    onClick={() => openAddCrop()}
                    className="px-4 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isHi ? '+ फसल दर्ज करें' : '+ Add Crop Record'}</span>
                  </button>
                </div>

                {/* Crop Records Grid / Empty State */}
                {(!profile?.cropRecords || profile.cropRecords.length === 0) ? (
                  <div className="p-12 rounded-3xl bg-[#FAF9F5] border-2 border-dashed border-[#D8D2C4] text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-bold">
                      🌱
                    </div>
                    <h4 className="font-black text-base text-slate-900">
                      {isHi ? 'कोई फसल रिकॉर्ड दर्ज नहीं है' : 'No crop records logged yet'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {isHi ? 'अपनी वर्तमान या आने वाली फसल दर्ज करें और 10 किसान पॉइंट्स पाएं।' : 'Log your current sowing details to link produce directly with verified buyers.'}
                    </p>
                    <button
                      onClick={() => openAddCrop()}
                      className="px-5 py-2.5 rounded-xl bg-[#315C45] text-white font-bold text-xs hover:bg-[#254634] shadow-xs cursor-pointer transition-colors"
                    >
                      {isHi ? '+ फसल दर्ज करें (+10 Pts)' : '+ Log First Crop Record (+10 Pts)'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.cropRecords.map((crop) => (
                      <div key={crop.id} className="p-5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] space-y-3 shadow-2xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-black text-base text-slate-900">{crop.cropName}</h4>
                            <span className="text-xs text-slate-500">{crop.variety || 'Standard'} • {crop.season}</span>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black">
                            {crop.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                          <div>
                            <span className="text-slate-400 text-[10px] block">खेत / Field:</span>
                            <span className="font-bold text-slate-700">{crop.fieldName || 'खेत'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">बुवाई / Sown:</span>
                            <span className="font-bold text-slate-700">
                              {crop.sowingDate ? new Date(crop.sowingDate).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">अनुमानित पैदावार / Yield:</span>
                            <span className="font-bold text-slate-700">{crop.estimatedYield} {crop.yieldUnit || 'Quintals'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">बिक्री योग्य / For Sale:</span>
                            <span className="font-bold text-purple-700">{crop.quantityForSale || 0} {crop.yieldUnit || 'Quintals'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            onClick={() => openEditCrop(crop)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCrop(crop)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* SECTION 5: MY SALES */}
          {activeSection === 'sales' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>{isHi ? 'मेरी बिक्री व ऑर्डर इतिहास (My Sales)' : 'My Sales & Orders History'}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                        {orders.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isHi ? 'आपके द्वारा पूर्ण किए गए वास्तविक सौदों का विवरण' : 'Verified order fulfillments and commercial transactions'}
                    </p>
                  </div>
                </div>

                {/* Sales List / Empty State */}
                {orders.length === 0 ? (
                  <div className="p-12 rounded-3xl bg-[#FAF9F5] border-2 border-dashed border-[#D8D2C4] text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-bold">
                      📦
                    </div>
                    <h4 className="font-black text-base text-slate-900">
                      {isHi ? 'अभी तक कोई सौदा पूरा नहीं हुआ है' : 'No completed sales yet'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {isHi ? 'डैशबोर्ड से अपनी फसल लिस्ट करें और खरीदारों से सीधे ऑर्डर प्राप्त करें।' : 'List your harvest on the marketplace to connect with wholesale buyers and earn +50 points on your first deal.'}
                    </p>
                    <button
                      onClick={handleBackToDashboard}
                      className="px-5 py-2.5 rounded-xl bg-[#315C45] text-white font-bold text-xs hover:bg-[#254634] shadow-xs cursor-pointer transition-colors"
                    >
                      {isHi ? 'डैशबोर्ड पर जाएं' : 'Go to Marketplace'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((ord) => (
                      <div key={ord.id} className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3.5">
                          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-lg">
                            📦
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-sm">
                                {ord.cropName} • {ord.quantityTons} Tons
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                {ord.status}
                              </span>
                            </div>
                            <span className="text-slate-500 text-[11px] block mt-0.5">
                              {ord.buyerName || 'Verified Institutional Buyer'} • Order ID: {ord.id}
                            </span>
                          </div>
                        </div>

                        <div className="text-right sm:text-right">
                          <span className="text-base font-black text-slate-900 block">
                            ₹{Number(ord.totalAmount || (ord.unitPricePerKg * ord.quantityTons * 1000) || 0).toLocaleString()}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            ₹{ord.unitPricePerKg || 21}/kg • {ord.estimatedDeliveryDate || 'Completed'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* SECTION 6: KISAN POINTS */}
          {activeSection === 'points' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>{isHi ? 'किसान पॉइंट्स खाता एवं रिवॉर्ड्स' : 'Kisan Points & Rewards Ledger'}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isHi ? 'पारदर्शी पॉइंट्स बहीखाता एवं ट्रस्ट रेटिंग नियम' : 'Real-time points ledger and evidence-backed rewards'}
                    </p>
                  </div>
                </div>

                {/* Hero Balance Card */}
                <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-100">
                      {isHi ? 'उपलब्ध किसान पॉइंट्स' : 'Verified Kisan Points Balance'}
                    </span>
                    <div className="text-3xl sm:text-4xl font-black flex items-center gap-2">
                      <span>🪙</span>
                      <span>{profile?.metrics?.kisanPointsBalance || (user as any)?.kisanPoints || 0}</span>
                      <span className="text-lg font-bold text-amber-100">Points</span>
                    </div>
                  </div>

                  <div className="bg-white/20 backdrop-blur-xs p-3.5 rounded-2xl border border-white/20 text-xs">
                    <span className="text-amber-100 font-bold block text-[10px] uppercase">TRUST BADGE</span>
                    <span className="text-sm font-black text-white">⭐ Silver Verified Farmer</span>
                  </div>
                </div>

                {/* Points Earning Rules */}
                <div className="space-y-3">
                  <h4 className="font-black text-sm text-slate-800">
                    {isHi ? 'पॉइंट्स कैसे अर्जित करें (Earning Rules)' : 'How to Earn Kisan Points'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5]">
                      <span className="font-black text-amber-800 block text-base">+20 Pts</span>
                      <span className="font-bold text-slate-800 block mt-1">{isHi ? 'खेत पंजीकृत करें' : 'Register a Field'}</span>
                      <span className="text-[11px] text-slate-500">{isHi ? 'भू-अभिलेख और क्षेत्रफल सत्यापन' : 'Per verified land parcel'}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5]">
                      <span className="font-black text-amber-800 block text-base">+10 Pts</span>
                      <span className="font-bold text-slate-800 block mt-1">{isHi ? 'फसल चक्र दर्ज करें' : 'Log Crop Record'}</span>
                      <span className="text-[11px] text-slate-500">{isHi ? 'किस्म व पैदावार अनुमान' : 'Per active crop recorded'}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5]">
                      <span className="font-black text-amber-800 block text-base">+50 Pts</span>
                      <span className="font-bold text-slate-800 block mt-1">{isHi ? 'पहली सफल बिक्री' : 'First Completed Sale'}</span>
                      <span className="text-[11px] text-slate-500">{isHi ? 'खरीदार द्वारा पूर्ति पुष्टि' : 'Verified fulfillment confirmation'}</span>
                    </div>
                  </div>
                </div>

                {/* Ledger Audit Trail */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-black text-sm text-slate-800">
                    {isHi ? 'खाता विवरण बहीखाता (Transaction Statement)' : 'Points Audit Statement'}
                  </h4>

                  {(!pointsLedger || pointsLedger.length === 0) ? (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                      {isHi ? 'अभी तक कोई पॉइंट्स लेनदेन दर्ज नहीं हुआ है।' : 'No points transactions recorded yet.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pointsLedger.map((entry, idx) => (
                        <div key={entry.id || idx} className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{entry.reason || entry.description}</span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(entry.createdAt || Date.now()).toLocaleDateString()} • {entry.referenceType || 'System'}
                            </span>
                          </div>
                          <span className="font-black text-emerald-700 text-sm">
                            +{entry.points} Pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* SECTION 7: ACCOUNT SETTINGS */}
          {activeSection === 'settings' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E0D5] shadow-xs space-y-6">
                
                {/* Header */}
                <div className="pb-5 border-b border-slate-100">
                  <h3 className="text-lg font-black text-slate-900">
                    {isHi ? 'खाता सेटिंग्स एवं प्राथमिकताएं (Account Settings)' : 'Account Preferences & Security'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isHi ? 'अपनी भाषा, सुरक्षा और प्रोफाइल प्राथमिकताएं प्रबंधित करें' : 'Manage interface language, security preferences, and farmer credentials'}
                  </p>
                </div>

                {/* Language Preference */}
                <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                      {isHi ? 'पसंदीदा भाषा (Preferred Language)' : 'Preferred Language'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setLanguage('hi')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        language === 'hi' ? 'bg-[#315C45] text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      हिंदी (Hindi)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        language === 'en' ? 'bg-[#315C45] text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Security & Authentication Info */}
                <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E5E0D5] space-y-3 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Shield className="w-4 h-4 text-emerald-700" />
                    <span>{isHi ? 'सुरक्षा एवं प्रमाणीकरण' : 'Security & Session Info'}</span>
                  </div>
                  <div className="space-y-1.5 text-slate-600">
                    <div>पंजीकृत मोबाइल: <strong className="text-slate-800">{user?.phone || user?.email || '+91 98765 43210'}</strong></div>
                    <div>उपयोगकर्ता भूमिका: <strong className="text-slate-800 capitalize">{user?.role || 'Farmer'}</strong></div>
                    <div>खाता स्थिति: <span className="text-emerald-700 font-bold">सत्यापित व सक्रिय (Active)</span></div>
                  </div>
                </div>

                {/* Edit Profile Action */}
                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => setIsEditProfileOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#315C45] text-white font-bold text-xs hover:bg-[#254634] shadow-xs cursor-pointer transition-colors"
                  >
                    {isHi ? 'प्रोफ़ाइल जानकारी अपडेट करें' : 'Update Profile Details'}
                  </button>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>

      {/* ============================================================= */}
      {/* MODALS                                                        */}
      {/* ============================================================= */}

      {/* 1. EDIT PROFILE MODAL */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">
                {isHi ? 'प्रोफ़ाइल विवरण संपादित करें' : 'Edit Profile Information'}
              </h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isHi ? 'पूरा नाम (Full Name)' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isHi ? 'गाँव / कस्बा' : 'Village'}
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.village}
                    onChange={(e) => setProfileForm({ ...profileForm, village: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isHi ? 'जिला' : 'District'}
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.district}
                    onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isHi ? 'राज्य' : 'State'}
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.state}
                  onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600 font-semibold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white font-extrabold cursor-pointer shadow-xs"
                >
                  {isHi ? 'सहेजें (Save)' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD / EDIT FIELD MODAL */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">
                {editingField ? (isHi ? 'खेत विवरण संपादित करें' : 'Edit Field') : (isHi ? 'नया खेत जोड़ें (+20 Points)' : 'Add New Field (+20 Points)')}
              </h3>
              <button
                onClick={() => setIsFieldModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isHi ? 'खेत का नाम (उदा. बड़ा खेत, नहर वाला)' : 'Field Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="उदा. उत्तर वाला खेत"
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isHi ? 'क्षेत्रफल (एकड़ में)' : 'Area (Acres)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="2.5"
                    value={fieldForm.areaAcres}
                    onChange={(e) => setFieldForm({ ...fieldForm, areaAcres: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isHi ? 'स्वामित्व' : 'Ownership'}
                  </label>
                  <select
                    value={fieldForm.ownershipStatus}
                    onChange={(e) => setFieldForm({ ...fieldForm, ownershipStatus: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold bg-white"
                  >
                    <option value="owned">{isHi ? 'स्वयं का (Owned)' : 'Owned'}</option>
                    <option value="leased">{isHi ? 'पट्टे पर (Leased)' : 'Leased'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'गाँव' : 'Village'}</label>
                  <input
                    type="text"
                    required
                    value={fieldForm.village}
                    onChange={(e) => setFieldForm({ ...fieldForm, village: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'जिला' : 'District'}</label>
                  <input
                    type="text"
                    required
                    value={fieldForm.district}
                    onChange={(e) => setFieldForm({ ...fieldForm, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'राज्य' : 'State'}</label>
                  <input
                    type="text"
                    required
                    value={fieldForm.state}
                    onChange={(e) => setFieldForm({ ...fieldForm, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'सिंचाई साधन' : 'Irrigation'}</label>
                  <select
                    value={fieldForm.irrigationSource}
                    onChange={(e) => setFieldForm({ ...fieldForm, irrigationSource: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white"
                  >
                    <option value="borewell">बोरवेल (Borewell)</option>
                    <option value="canal">नहर (Canal)</option>
                    <option value="drip">ड्रिप सिंचाई (Drip)</option>
                    <option value="rainfed">वर्षा आधारित (Rainfed)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'मिट्टी का प्रकार' : 'Soil Type'}</label>
                  <select
                    value={fieldForm.soilType}
                    onChange={(e) => setFieldForm({ ...fieldForm, soilType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white"
                  >
                    <option value="alluvial">जलोढ़ (Alluvial)</option>
                    <option value="black">काली मिट्टी (Black)</option>
                    <option value="clay">चिकनी मिट्टी (Clay)</option>
                    <option value="sandy">बलुई मिट्टी (Sandy)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFieldModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white font-extrabold cursor-pointer shadow-xs"
                >
                  {editingField ? (isHi ? 'अपडेट करें' : 'Update') : (isHi ? 'सहेजें (+20 Pts)' : 'Save (+20 Pts)')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT CROP MODAL */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">
                {editingCrop ? (isHi ? 'फसल रिकॉर्ड संपादित करें' : 'Edit Crop Record') : (isHi ? 'नई फसल दर्ज करें (+10 Points)' : 'Add Crop Record (+10 Points)')}
              </h3>
              <button
                onClick={() => setIsCropModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCrop} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isHi ? 'खेत चुनें' : 'Select Field'}
                </label>
                <select
                  required
                  value={cropForm.fieldId}
                  onChange={(e) => setCropForm({ ...cropForm, fieldId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold bg-white"
                >
                  <option value="">{isHi ? '-- खेत चुनें --' : '-- Select Field --'}</option>
                  {profile?.fields.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.areaAcres} एकड़)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'फसल का नाम' : 'Crop Name'}</label>
                  <input
                    type="text"
                    required
                    placeholder="उदा. आलू (Potato)"
                    value={cropForm.cropName}
                    onChange={(e) => setCropForm({ ...cropForm, cropName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'किस्म / Variety' : 'Variety'}</label>
                  <input
                    type="text"
                    placeholder="उदा. कुफरी बहार"
                    value={cropForm.variety}
                    onChange={(e) => setCropForm({ ...cropForm, variety: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'सीजन' : 'Season'}</label>
                  <select
                    value={cropForm.season}
                    onChange={(e) => setCropForm({ ...cropForm, season: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white"
                  >
                    <option value="Rabi">रबी (Rabi)</option>
                    <option value="Kharif">खरीफ (Kharif)</option>
                    <option value="Zaid">जायद (Zaid)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'पैदावार (क्विंटल)' : 'Yield (Qt)'}</label>
                  <input
                    type="number"
                    value={cropForm.estimatedYield}
                    onChange={(e) => setCropForm({ ...cropForm, estimatedYield: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isHi ? 'स्थिति' : 'Status'}</label>
                  <select
                    value={cropForm.status}
                    onChange={(e) => setCropForm({ ...cropForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white"
                  >
                    <option value="Growing">खेत में खड़ी</option>
                    <option value="Ready to Harvest">कटाई के लिए तैयार</option>
                    <option value="Harvested">कटाई हो चुकी</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCropModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#315C45] hover:bg-[#254634] text-white font-extrabold cursor-pointer shadow-xs"
                >
                  {editingCrop ? (isHi ? 'अपडेट करें' : 'Update') : (isHi ? 'सहेजें (+10 Pts)' : 'Save (+10 Pts)')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. TRACEABILITY MODAL */}
      <FarmTraceabilityModal
        isOpen={showTraceModal}
        onClose={() => setShowTraceModal(false)}
        language={language === 'hi' ? 'hi' : 'en'}
      />

      {/* 5. ACTIVITY LOGGER MODAL */}
      <FieldActivityLoggerModal
        isOpen={showLoggerModal}
        onClose={() => setShowLoggerModal(false)}
        listings={[]}
        onActivityCreated={() => {
          showBanner(isHi ? 'खेत गतिविधि सफलतापूर्वक दर्ज की गई!' : 'Activity recorded!');
          loadData();
        }}
        language={language === 'hi' ? 'hi' : 'en'}
      />

    </div>
  );
};

export default FarmerProfilePage;
