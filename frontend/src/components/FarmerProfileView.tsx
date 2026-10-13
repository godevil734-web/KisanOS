import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { 
  FarmerDigitalProfile, 
  FarmerField, 
  FarmerCropRecord, 
  KisanPointsLedgerEntry 
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
  ArrowRight, 
  AlertCircle, 
  RotateCw, 
  X, 
  Check, 
  FileText, 
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface FarmerProfileViewProps {
  initialSubTab?: 'overview' | 'fields' | 'crops' | 'sales' | 'points';
  onNavigateTab?: (tab: string) => void;
  onOpenListingWizard?: () => void;
}

export const FarmerProfileView: React.FC<FarmerProfileViewProps> = ({
  initialSubTab = 'overview',
  onNavigateTab,
  onOpenListingWizard
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isHi = language === 'hi';

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'fields' | 'crops' | 'sales' | 'points'>(initialSubTab);
  const [profile, setProfile] = useState<FarmerDigitalProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal States
  const [isFieldModalOpen, setIsFieldModalOpen] = useState<boolean>(false);
  const [editingField, setEditingField] = useState<FarmerField | null>(null);

  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [editingCrop, setEditingCrop] = useState<FarmerCropRecord | null>(null);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);

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

  // Fetch full digital profile
  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFarmerProfile();
      if (res && res.success && res.profile) {
        setProfile(res.profile);
        setProfileForm({
          name: res.profile.name || '',
          village: res.profile.village || '',
          district: res.profile.district || '',
          state: res.profile.state || '',
          preferredLanguage: res.profile.preferredLanguage || 'hi',
          avatarUrl: res.profile.avatarUrl || ''
        });
      } else {
        setError('Could not load profile records.');
      }
    } catch (err: any) {
      console.error('Error fetching farmer profile:', err);
      setError(err.message || 'Failed to connect to profile server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Flash banner helper
  const showBanner = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // -----------------------------------------------------------
  // FIELD ACTIONS
  // -----------------------------------------------------------
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

  const openEditField = (field: FarmerField) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      areaAcres: String(field.areaAcres),
      village: field.village,
      district: field.district,
      state: field.state,
      ownershipStatus: field.ownershipStatus,
      irrigationSource: field.irrigationSource,
      soilType: field.soilType || 'alluvial',
      latitude: field.latitude ? String(field.latitude) : '',
      longitude: field.longitude ? String(field.longitude) : ''
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
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Error saving field');
    }
  };

  const handleDeleteField = async (field: FarmerField) => {
    const confirmMsg = isHi
      ? `क्या आप वाकई "${field.name}" (${field.areaAcres} एकड़) को हटाना चाहते हैं?`
      : `Are you sure you want to delete field "${field.name}" (${field.areaAcres} acres)?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteFarmerField(field.id);
      showBanner(isHi ? 'खेत रिकॉर्ड हटा दिया गया।' : 'Field removed successfully.');
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Error deleting field');
    }
  };

  // -----------------------------------------------------------
  // CROP RECORD ACTIONS
  // -----------------------------------------------------------
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
      status: crop.status,
      notes: crop.notes || ''
    });
    setIsCropModalOpen(true);
  };

  const handleSaveCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropForm.cropName.trim()) return alert(isHi ? 'कृपया फसल का नाम दर्ज करें' : 'Crop name is required');

    try {
      const payload: any = {
        fieldId: cropForm.fieldId || null,
        cropName: cropForm.cropName.trim(),
        variety: cropForm.variety.trim(),
        season: cropForm.season,
        sowingDate: cropForm.sowingDate || null,
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
        showBanner(isHi ? 'फसल रिकॉर्ड सफलतापूर्वक अपडेट किया गया!' : 'Crop record updated successfully!');
      } else {
        await api.addFarmerCropRecord(payload);
        showBanner(isHi ? 'नई फसल दर्ज की गई! +10 किसान पॉइंट्स अर्जित हुए।' : 'New crop record logged! +10 Kisan Points awarded.');
      }

      setIsCropModalOpen(false);
      fetchProfile();
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
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Error deleting crop record');
    }
  };

  // -----------------------------------------------------------
  // PROFILE ACTIONS
  // -----------------------------------------------------------
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateFarmerProfile(profileForm);
      showBanner(isHi ? 'प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई!' : 'Farmer profile updated successfully!');
      setIsEditProfileOpen(false);
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Error updating profile');
    }
  };

  // User initials calculation
  const initials = useMemo(() => {
    const name = profile?.name || user?.name || 'Farmer';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [profile?.name, user?.name]);

  if (loading && !profile) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-[#315C45] border-r-transparent" />
        <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
          {isHi ? 'डिजिटल प्रोफ़ाइल लोड हो रही है...' : 'Loading Farmer Digital Profile...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-sm font-bold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-amber-700 hover:text-amber-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HERO: FARMER IDENTITY & SUMMARY BANNER                  */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E0D5] shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#EEF5F2] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-60" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-6">
            {/* Circular Avatar */}
            <div className="relative shrink-0">
              {profile?.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name} 
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-md ring-2 ring-[#315C45]" 
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#315C45] text-white font-black text-2xl sm:text-3xl flex items-center justify-center border-4 border-white shadow-md ring-2 ring-[#315C45]">
                  {initials}
                </div>
              )}
              <div 
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center text-xs shadow-xs" 
                title={isHi ? 'सत्यापित किसान खाता' : 'Verified Farmer'}
              >
                ✓
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#26332C]">
                  {profile?.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EEF5F2] text-[#315C45] border border-[#CDE0D7]">
                  {isHi ? 'पंजीकृत किसान' : 'Registered Farmer'}
                </span>
                {profile?.trust && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>{profile.trust.trustBadge}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-[#5A6860] font-medium">
                {profile?.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#315C45]" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {(profile?.village || profile?.district) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#315C45]" />
                    <span>{[profile.village, profile.district, profile.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span>🌐</span>
                  <span>{profile?.preferredLanguage === 'hi' ? 'हिंदी (Hindi)' : 'English'}</span>
                </div>
              </div>

              {/* Verified Identity Status Pill */}
              <div className="flex items-center gap-2 pt-1 text-xs text-emerald-800">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold">
                  {isHi 
                    ? 'आधार व मोबाइल नंबर सत्यापित (Aadhaar & Mobile Verified)' 
                    : 'Aadhaar & Mobile Number Verified'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Points summary pill */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            {/* Kisan Points Balance Card */}
            <div 
              onClick={() => setActiveSubTab('points')}
              className="px-4 py-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 cursor-pointer hover:border-amber-400 transition-all shadow-2xs group flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-xs group-hover:scale-105 transition-transform">
                🪙
              </div>
              <div>
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                  {isHi ? 'किसान पॉइंट्स' : 'Kisan Points'}
                </div>
                <div className="text-lg font-black text-amber-950 flex items-center gap-1">
                  <span>{profile?.metrics.kisanPointsBalance || 0}</span>
                  <span className="text-xs font-bold text-amber-700">Pts</span>
                </div>
              </div>
            </div>

            {/* Edit Profile Button */}
            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="px-4 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Edit3 className="w-4 h-4 text-slate-600" />
              <span>{isHi ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Profile Completion Gauge */}
        <div className="mt-6 pt-5 border-t border-[#EFECE4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex-1 w-full max-w-md">
            <div className="flex items-center justify-between font-bold text-[#26332C] mb-1.5">
              <span>{isHi ? 'डिजिटल प्रोफ़ाइल पूर्णता:' : 'Profile Completion:'}</span>
              <span className="text-[#315C45] font-black">{profile?.completion.percentage || 0}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-[#315C45] rounded-full transition-all duration-500"
                style={{ width: `${profile?.completion.percentage || 0}%` }}
              />
            </div>
          </div>
          <div className="text-slate-500 text-[11px]">
            {profile?.completion.percentage === 100 ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                {isHi ? 'पूर्ण प्रोफ़ाइल - सभी पॉइंट्स अर्जित हैं' : '100% Complete - Full verification active'}
              </span>
            ) : (
              <span>
                {isHi 
                  ? '💡 खेत व फसल रिकॉर्ड जोड़कर प्रोफ़ाइल 100% पूरी करें और 10 पॉइंट्स बोनस पाएं' 
                  : '💡 Add fields & crop records to reach 100% and earn +10 bonus points'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUBTABS NAVIGATION BAR                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E0DBD0] scrollbar-none">
        {[
          { id: 'overview', label: isHi ? 'सारांश (Overview)' : 'Overview', icon: FileText },
          { id: 'fields', label: `${isHi ? 'मेरे खेत' : 'My Fields'} (${profile?.fields.length || 0})`, icon: Layers },
          { id: 'crops', label: `${isHi ? 'फसल रिकॉर्ड' : 'Crop Records'} (${profile?.cropRecords.length || 0})`, icon: Sprout },
          { id: 'sales', label: `${isHi ? 'मेरी बिक्री' : 'My Sales'} (${profile?.metrics.totalCompletedSales || 0})`, icon: TrendingUp },
          { id: 'points', label: `${isHi ? 'किसान पॉइंट्स' : 'Kisan Points'} (${profile?.metrics.kisanPointsBalance || 0})`, icon: Coins }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#315C45] text-white shadow-xs'
                  : 'bg-white text-[#5A6860] hover:text-[#26332C] hover:bg-[#EFECE4] border border-[#E5E0D5]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#315C45]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: OVERVIEW SUMMARY                                    */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isHi ? 'कुल जमीन' : 'Total Land'}</div>
              <div className="text-xl font-black text-slate-900">{profile?.metrics.totalCultivatedAcres || 0}</div>
              <div className="text-[11px] text-emerald-700 font-semibold">{isHi ? 'एकड़ पंजीकृत' : 'Acres Registered'}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isHi ? 'खेतों की संख्या' : 'My Fields'}</div>
              <div className="text-xl font-black text-slate-900">{profile?.metrics.registeredFieldsCount || 0}</div>
              <div className="text-[11px] text-slate-500">{isHi ? 'सक्रिय खेत' : 'Active plots'}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isHi ? 'सक्रिय फसलें' : 'Active Crops'}</div>
              <div className="text-xl font-black text-emerald-700">{profile?.metrics.activeCropsCount || 0}</div>
              <div className="text-[11px] text-slate-500">{isHi ? 'खेत में खड़ी' : 'Growing / Ready'}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isHi ? 'बिक्री योग्य उपज' : 'Available for Sale'}</div>
              <div className="text-xl font-black text-slate-900">{profile?.metrics.totalAvailableForSaleTons || 0}</div>
              <div className="text-[11px] text-purple-700 font-semibold">{isHi ? 'क्विंटल / टन' : 'Metric Tonnes'}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isHi ? 'सफल सौदे' : 'Completed Sales'}</div>
              <div className="text-xl font-black text-emerald-700">{profile?.metrics.totalCompletedSales || 0}</div>
              <div className="text-[11px] text-emerald-600 font-semibold">{isHi ? 'पूरे हुए ऑर्डर' : 'Fulfilled Orders'}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isHi ? 'किसान पॉइंट्स' : 'Kisan Points'}</div>
              <div className="text-xl font-black text-amber-600">{profile?.metrics.kisanPointsBalance || 0}</div>
              <div className="text-[11px] text-amber-700 font-semibold">{isHi ? 'रिवॉर्ड बैलेंस' : 'Verified points'}</div>
            </div>
          </div>

          {/* Trust Score & Verification Engine Card */}
          {profile?.trust && (
            <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-[#1D3A2B] text-white rounded-3xl p-6 sm:p-8 shadow-md">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-emerald-300 border border-white/20">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{isHi ? 'सत्यापित साक्ष्य आधारित ट्रस्ट स्कोर' : 'Evidence-Backed Farmer Trust Rating'}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black">
                    {profile.trust.trustBadge}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isHi 
                      ? 'यह ट्रस्ट स्कोर आपके वास्तविक सफल सौदों, समय पर डिलीवरी दर और वास्तविक खरीदार समीक्षाओं पर आधारित है। इसे किसी काल्पनिक डेटा या केवल पॉइंट्स से नहीं मापा जाता।' 
                      : 'This trust rating is computed directly from completed transactions, fulfillment rate, and verified buyer reviews. It represents commercial credibility across KisanConnect.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
                  <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center">
                    <div className="text-[10px] text-slate-300 uppercase font-bold">{isHi ? 'ट्रस्ट स्कोर' : 'Trust Score'}</div>
                    <div className="text-2xl font-black text-emerald-300 mt-1">{profile.trust.trustScore}/100</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center">
                    <div className="text-[10px] text-slate-300 uppercase font-bold">{isHi ? 'पूर्ति दर' : 'Fulfillment'}</div>
                    <div className="text-2xl font-black text-white mt-1">{profile.trust.fulfillmentRate}%</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center">
                    <div className="text-[10px] text-slate-300 uppercase font-bold">{isHi ? 'रेटिंग' : 'Rating'}</div>
                    <div className="text-2xl font-black text-amber-300 mt-1">★ {profile.trust.averageRating}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center">
                    <div className="text-[10px] text-slate-300 uppercase font-bold">{isHi ? 'कुल बिक्री' : 'Sold Volume'}</div>
                    <div className="text-2xl font-black text-white mt-1">{profile.trust.totalQuantitySoldTons} T</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={openAddField}
              className="p-5 rounded-2xl bg-white hover:bg-[#EEF5F2] border-2 border-dashed border-[#CDE0D7] hover:border-[#315C45] text-left transition-all group cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#EEF5F2] text-[#315C45] flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="font-black text-sm text-[#26332C]">{isHi ? 'नया खेत जोड़ें' : 'Register New Field'}</div>
              <div className="text-xs text-slate-500 mt-1">{isHi ? 'एकड़, सिंचाई और मिट्टी का विवरण (+20 Pts)' : 'Add acreage & irrigation (+20 Pts)'}</div>
            </button>

            <button
              onClick={() => openAddCrop()}
              className="p-5 rounded-2xl bg-white hover:bg-[#EEF5F2] border-2 border-dashed border-[#CDE0D7] hover:border-[#315C45] text-left transition-all group cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#EEF5F2] text-[#315C45] flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                <Sprout className="w-5 h-5" />
              </div>
              <div className="font-black text-sm text-[#26332C]">{isHi ? 'फसल रिकॉर्ड दर्ज करें' : 'Log Crop Record'}</div>
              <div className="text-xs text-slate-500 mt-1">{isHi ? 'खेत से जुड़ी फसल, बुवाई व कटाई (+10 Pts)' : 'Link crop to registered field (+10 Pts)'}</div>
            </button>

            <button
              onClick={() => {
                if (onOpenListingWizard) onOpenListingWizard();
                else if (onNavigateTab) onNavigateTab('listings');
              }}
              className="p-5 rounded-2xl bg-gradient-to-br from-[#315C45] to-[#203D2E] text-white text-left transition-all hover:shadow-md cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold mb-3">
                <ArrowRight className="w-5 h-5" />
              </div>
              <div className="font-black text-sm">{isHi ? 'मंडी में फसल बेचें' : 'Create Produce Listing'}</div>
              <div className="text-xs text-slate-200 mt-1">{isHi ? 'खरीदारों से सीधे जुड़ें' : 'Match with factory & bulk buyers'}</div>
            </button>
          </div>

          {/* Two-Column Split: Fields preview and Crop records preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fields List Preview */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#315C45]" />
                  <span>{isHi ? 'पंजीकृत खेत (My Fields)' : 'Registered Fields'}</span>
                </h4>
                <button
                  onClick={() => setActiveSubTab('fields')}
                  className="text-xs font-bold text-[#315C45] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{isHi ? 'सभी देखें' : 'View All'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {profile?.fields.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">{isHi ? 'कोई खेत पंजीकृत नहीं है।' : 'No fields registered yet.'}</p>
                  <button
                    onClick={openAddField}
                    className="px-4 py-2 rounded-xl bg-[#315C45] text-white text-xs font-bold shadow-xs hover:bg-[#264A37] cursor-pointer"
                  >
                    + {isHi ? 'खेत जोड़ें' : 'Add Field'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile?.fields.slice(0, 3).map((f) => (
                    <div key={f.id} className="p-4 rounded-2xl bg-slate-50 hover:bg-[#EEF5F2] border border-slate-200 transition-colors flex items-center justify-between">
                      <div>
                        <div className="font-black text-sm text-slate-900">{f.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {[f.village, f.district].filter(Boolean).join(', ')} • {f.irrigationSource}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-[#315C45]">{f.areaAcres} {isHi ? 'एकड़' : 'Acres'}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">{f.ownershipStatus}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Crop Records Preview */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-emerald-600" />
                  <span>{isHi ? 'सक्रिय फसल रिकॉर्ड (Active Crops)' : 'Active Crop Records'}</span>
                </h4>
                <button
                  onClick={() => setActiveSubTab('crops')}
                  className="text-xs font-bold text-[#315C45] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{isHi ? 'सभी देखें' : 'View All'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {profile?.cropRecords.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <Sprout className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">{isHi ? 'कोई फसल रिकॉर्ड दर्ज नहीं है।' : 'No crop records logged yet.'}</p>
                  <button
                    onClick={() => openAddCrop()}
                    className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow-xs hover:bg-emerald-800 cursor-pointer"
                  >
                    + {isHi ? 'फसल दर्ज करें' : 'Log Crop Record'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile?.cropRecords.slice(0, 3).map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 transition-colors flex items-center justify-between">
                      <div>
                        <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                          <span>{c.cropName}</span>
                          {c.variety && <span className="text-xs font-bold text-slate-500">({c.variety})</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.season} • {c.fieldName ? `खेत: ${c.fieldName}` : 'सामान्य खेत'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {c.status}
                        </span>
                        <div className="text-xs text-slate-600 font-bold mt-1">
                          {c.estimatedYield} {c.yieldUnit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: MY FIELDS (खेत प्रबंधन)                              */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'fields' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isHi ? 'मेरे पंजीकृत खेत (My Farm Fields)' : 'My Registered Farm Fields'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isHi 
                  ? `कुल पंजीकृत रकबा: ${profile?.metrics.totalCultivatedAcres || 0} एकड़ (${profile?.fields.length || 0} खेत)` 
                  : `Total Cultivated Area: ${profile?.metrics.totalCultivatedAcres || 0} Acres across ${profile?.fields.length || 0} registered plots.`}
              </p>
            </div>
            <button
              onClick={openAddField}
              className="px-5 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-black shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isHi ? 'नया खेत जोड़ें (+20 Pts)' : 'Add Field (+20 Pts)'}</span>
            </button>
          </div>

          {profile?.fields.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 shadow-xs">
              <Layers className="w-16 h-16 text-slate-300 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">
                {isHi ? 'अभी तक कोई खेत पंजीकृत नहीं किया गया है' : 'No Fields Registered Yet'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isHi 
                  ? 'अपने अलग-अलग खेतों (प्लाट/खसरा) को क्षेत्रफल, गाँव और सिंचाई साधन के साथ दर्ज करें। प्रत्येक खेत जोड़ने पर 20 किसान पॉइंट्स मिलते हैं।' 
                  : 'Add your individual farm plots with area, location, and irrigation details. Earn 20 Kisan Points for each registered field.'}
              </p>
              <button
                onClick={openAddField}
                className="px-6 py-3 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
              >
                + {isHi ? 'पहला खेत जोड़ें' : 'Register First Field'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile?.fields.map((f) => (
                <div key={f.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-[#315C45] transition-all space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black text-base text-slate-900">{f.name}</h4>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{[f.village, f.district, f.state].filter(Boolean).join(', ')}</span>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-[#EEF5F2] text-[#315C45] border border-[#CDE0D7] shrink-0">
                        {f.areaAcres} {isHi ? 'एकड़' : 'Acres'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">{isHi ? 'स्वामित्व' : 'Ownership'}</div>
                        <div className="font-bold text-slate-800 capitalize mt-0.5">{f.ownershipStatus === 'owned' ? (isHi ? 'खुद का (Owned)' : 'Owned') : (isHi ? 'पट्टे पर (Leased)' : 'Leased')}</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">{isHi ? 'सिंचाई' : 'Irrigation'}</div>
                        <div className="font-bold text-slate-800 capitalize mt-0.5">{f.irrigationSource}</div>
                      </div>
                      {f.soilType && (
                        <div className="p-2.5 bg-slate-50 rounded-xl col-span-2">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{isHi ? 'मिट्टी का प्रकार' : 'Soil Type'}</div>
                          <div className="font-bold text-slate-800 capitalize mt-0.5">{f.soilType}</div>
                        </div>
                      )}
                    </div>

                    {/* Disclaimer Pill: Self-Declared */}
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{isHi ? 'स्व-घोषित रकबा (फील्ड वेरिफिकेशन प्रतीक्षारत)' : 'Self-declared area (Awaiting field verification)'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => openAddCrop(f.id)}
                      className="text-xs font-bold text-[#315C45] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isHi ? 'इस खेत में फसल जोड़ें' : 'Log Crop Here'}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditField(f)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
                        title={isHi ? 'संपादित करें' : 'Edit'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteField(f)}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                        title={isHi ? 'हटाएं' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: MY CROP RECORDS (फसल रिकॉर्ड)                        */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'crops' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isHi ? 'फसल रिकॉर्ड (My Crop Cultivation Records)' : 'My Crop Cultivation Records'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isHi 
                  ? 'खेतों से जुड़ी फसलों की बुवाई, अनुमानित पैदावार और बिक्री योग्य मात्रा का सटीक प्रबंधन।' 
                  : 'Track crops associated with your fields, expected yield, and verified quantities for market sale.'}
              </p>
            </div>
            <button
              onClick={() => openAddCrop()}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isHi ? 'फसल रिकॉर्ड दर्ज करें (+10 Pts)' : 'Add Crop Record (+10 Pts)'}</span>
            </button>
          </div>

          {profile?.cropRecords.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 shadow-xs">
              <Sprout className="w-16 h-16 text-slate-300 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">
                {isHi ? 'कोई फसल रिकॉर्ड दर्ज नहीं है' : 'No Crop Records Logged Yet'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isHi 
                  ? 'अपने खेतों में बोई गई फसलें दर्ज करें। इससे थोक खरीदारों को आपकी आपूर्ति का समय पर पूर्वानुमान मिलता है।' 
                  : 'Record crops sown across your fields. This enables accurate supply matching with verified commercial buyers.'}
              </p>
              <button
                onClick={() => openAddCrop()}
                className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
              >
                + {isHi ? 'पहली फसल दर्ज करें' : 'Log First Crop'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile?.cropRecords.map((c) => (
                <div key={c.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-500 transition-all space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-base text-slate-900">{c.cropName}</h4>
                          {c.variety && (
                            <span className="text-xs font-bold text-slate-500">({c.variety})</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.season} • {c.fieldName ? `📍 ${c.fieldName} (${c.fieldAcres || ''} एकड़)` : 'खेत अनिर्दिष्ट'}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                        c.status === 'Growing' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        c.status === 'Ready to Harvest' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        c.status === 'Harvested' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    {/* Quantities breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                        <div className="text-[10px] text-slate-400 font-bold">{isHi ? 'अनुमानित' : 'Estimated'}</div>
                        <div className="font-black text-slate-800 mt-0.5">{c.estimatedYield}</div>
                        <div className="text-[9px] text-slate-400">{c.yieldUnit}</div>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                        <div className="text-[10px] text-slate-400 font-bold">{isHi ? 'वास्तविक कटाई' : 'Harvested'}</div>
                        <div className="font-black text-slate-800 mt-0.5">{c.actualHarvestedQuantity || '0'}</div>
                        <div className="text-[9px] text-slate-400">{c.yieldUnit}</div>
                      </div>
                      <div className="p-2.5 bg-emerald-50 rounded-xl text-center border border-emerald-200">
                        <div className="text-[10px] text-emerald-700 font-bold">{isHi ? 'बिक्री योग्य' : 'For Sale'}</div>
                        <div className="font-black text-emerald-800 mt-0.5">{c.quantityForSale || '0'}</div>
                        <div className="text-[9px] text-emerald-600">{c.yieldUnit}</div>
                      </div>
                    </div>

                    {/* Harvest Timeline */}
                    <div className="text-xs text-slate-500 space-y-1 pt-1">
                      {c.sowingDate && (
                        <div className="flex items-center justify-between">
                          <span>{isHi ? 'बुवाई तिथि:' : 'Sown Date:'}</span>
                          <span className="font-bold text-slate-700">{c.sowingDate.split('T')[0]}</span>
                        </div>
                      )}
                      {c.expectedHarvestDate && (
                        <div className="flex items-center justify-between">
                          <span>{isHi ? 'अनुमानित कटाई:' : 'Harvest Date:'}</span>
                          <span className="font-bold text-emerald-700">{c.expectedHarvestDate.split('T')[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (onOpenListingWizard) onOpenListingWizard();
                        else if (onNavigateTab) onNavigateTab('listings');
                      }}
                      className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{isHi ? 'मंडी में लिस्ट करें' : 'List for Sale'}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditCrop(c)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
                        title={isHi ? 'संपादित करें' : 'Edit'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCrop(c)}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                        title={isHi ? 'हटाएं' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB 4: MY SALES & COMPLETED DEALS                           */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'sales' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isHi ? 'मेरी बिक्री और सफल सौदे (Sales & Order History)' : 'My Sales & Order History'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isHi 
                  ? `सत्यापित बिक्री: ${profile?.metrics.totalCompletedSales || 0} ऑर्डर (${profile?.metrics.totalVerifiedQuantitySoldTons || 0} टन कुल मात्रा)` 
                  : `Verified Sales: ${profile?.metrics.totalCompletedSales || 0} completed orders (${profile?.metrics.totalVerifiedQuantitySoldTons || 0} Metric Tonnes total).`}
              </p>
            </div>
            {profile?.metrics.totalSalesRevenue ? (
              <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-black">
                {isHi ? 'कुल राजस्व: ' : 'Total Revenue: '}₹{profile.metrics.totalSalesRevenue.toLocaleString('en-IN')}
              </div>
            ) : null}
          </div>

          {profile?.recentSales.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4 shadow-xs">
              <TrendingUp className="w-16 h-16 text-slate-300 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">
                {isHi ? 'अभी तक कोई पूर्ण बिक्री दर्ज नहीं हुई है' : 'No Completed Sales Yet'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isHi 
                  ? 'जब खरीदार आपके प्रस्ताव को स्वीकार करेंगे और एस्क्रो भुगतान के साथ ऑर्डर पूरा होगा, तब वह ऑर्डर यहाँ दर्ज होगा और पहली बिक्री पर 50 किसान पॉइंट्स मिलेंगे।' 
                  : 'Completed orders fulfilled through platform escrow will appear here. First completed sale awards +50 Kisan Points.'}
              </p>
              <button
                onClick={() => {
                  if (onNavigateTab) onNavigateTab('buyers');
                }}
                className="px-6 py-3 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
              >
                {isHi ? 'थोक खरीदार खोजें' : 'Find Wholesale Buyers'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {profile?.recentSales.map((sale: any) => (
                <div key={sale.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-emerald-500 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900">{sale.cropName}</span>
                      {sale.variety && <span className="text-xs font-bold text-slate-500">({sale.variety})</span>}
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                        {sale.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {isHi ? 'खरीदार:' : 'Buyer:'} <strong className="text-slate-700">{sale.buyerName}</strong> • {isHi ? 'ऑर्डर #' : 'Order #'}{sale.orderNumber || sale.id}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto text-right">
                    <div>
                      <div className="text-xs text-slate-500">{sale.quantityTons} {isHi ? 'टन' : 'Tons'}</div>
                      <div className="text-xs font-bold text-slate-700">₹{sale.unitPricePerKg || sale.agreedPricePerKg}/kg</div>
                    </div>
                    <div>
                      <div className="text-base font-black text-emerald-700">
                        ₹{(sale.produceTotal || sale.totalAmount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-600">
                        {sale.paymentStatus || 'COMPLETED'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB 5: KISAN POINTS & AUDIT LEDGER                         */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'points' && (
        <div className="space-y-6">
          {/* Points Header Banner */}
          <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1 max-w-lg">
              <div className="text-xs uppercase font-black text-amber-200 tracking-wider">
                {isHi ? 'पारदर्शी किसान पॉइंट्स लेजर' : 'Transparent Kisan Points Ledger'}
              </div>
              <h3 className="text-2xl sm:text-3xl font-black">
                {profile?.metrics.kisanPointsBalance || 0} <span className="text-base font-bold text-amber-100">Kisan Points</span>
              </h3>
              <p className="text-xs text-amber-100 leading-relaxed pt-1">
                {isHi 
                  ? 'किसान पॉइंट्स आपकी सक्रियता, पूर्ण खेत रिकॉर्ड और समय पर डिलीवरी की पहचान हैं। यह अंक सर्वर-साइड लेजर में सुरक्षित रहते हैं।' 
                  : 'Kisan Points recognize active digital record keeping, certified farming practices, and on-time commercial order fulfillment.'}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center shrink-0 w-full sm:w-auto">
              <div className="text-[10px] uppercase font-bold text-amber-100">{isHi ? 'किसान स्तर' : 'Farmer Tier'}</div>
              <div className="text-lg font-black text-white mt-0.5">
                {profile?.trust?.trustBadge || 'Active Farmer'}
              </div>
              <div className="text-[11px] text-amber-200 mt-1">
                ✓ {isHi ? 'सत्यापित लेजर' : 'Audited Server Ledger'}
              </div>
            </div>
          </div>

          {/* Points Rules Explanation Grid */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>{isHi ? 'पॉइंट्स कैसे अर्जित करें (Points Rules)' : 'How to Earn Kisan Points'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{isHi ? 'प्रोफ़ाइल पूर्णता' : 'Profile Completion'}</span>
                  <span className="font-black text-amber-600">+10 Pts</span>
                </div>
                <p className="text-[11px] text-slate-500">{isHi ? 'गाँव, जिला और आवश्यक व्यक्तिगत जानकारी भरने पर।' : 'Once upon completing personal & farm location profile.'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{isHi ? 'खेत पंजीकरण' : 'Register Field'}</span>
                  <span className="font-black text-amber-600">+20 Pts</span>
                </div>
                <p className="text-[11px] text-slate-500">{isHi ? 'प्रत्येक नए खेत और रकबे का विवरण जोड़ने पर।' : 'Awarded per eligible field with verified acreage.'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{isHi ? 'फसल रिकॉर्ड' : 'Log Crop Record'}</span>
                  <span className="font-black text-amber-600">+10 Pts</span>
                </div>
                <p className="text-[11px] text-slate-500">{isHi ? 'खेत से जुड़ी नई फसल की बुवाई दर्ज करने पर।' : 'Awarded per complete crop cultivation record.'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{isHi ? 'पहली सफल बिक्री' : 'First Completed Sale'}</span>
                  <span className="font-black text-amber-600">+50 Pts</span>
                </div>
                <p className="text-[11px] text-slate-500">{isHi ? 'मंच पर पहला सत्यापित ऑर्डर सफलतापूर्वक पूरा करने पर।' : 'Awarded when your first commercial deal is delivered.'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{isHi ? 'आगामी सफल बिक्री' : 'Subsequent Completed Sales'}</span>
                  <span className="font-black text-amber-600">+20 Pts</span>
                </div>
                <p className="text-[11px] text-slate-500">{isHi ? 'प्रत्येक नए सफल और सत्यापित ऑर्डर पर।' : 'Awarded per subsequent fulfilled escrow order.'}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{isHi ? 'समय पर डिलीवरी' : 'On-Time Fulfillment'}</span>
                  <span className="font-black text-amber-600">+10 Pts</span>
                </div>
                <p className="text-[11px] text-slate-500">{isHi ? 'अनुमानित तिथि पर या उससे पहले डिलीवरी पूरा करने पर।' : 'Bonus awarded for delivery on or before promised date.'}</p>
              </div>
            </div>
          </div>

          {/* Points Ledger Table Component */}
          <PointsLedgerSection userId={user?.id} isHi={isHi} />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL: ADD / EDIT FIELD                                    */}
      {/* ------------------------------------------------------------- */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#315C45]" />
                <span>{editingField ? (isHi ? 'खेत संपादित करें' : 'Edit Field') : (isHi ? 'नया खेत जोड़ें' : 'Register Field')}</span>
              </h3>
              <button onClick={() => setIsFieldModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isHi ? 'खेत का नाम / पहचान *' : 'Field Name / Identifier *'}</label>
                <input
                  type="text"
                  required
                  placeholder={isHi ? 'उदा. उत्तर वाला खेत, खसरा 42' : 'e.g. North Plot #1, Khasra 42'}
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'क्षेत्रफल (एकड़) *' : 'Area in Acres *'}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    required
                    placeholder="2.5"
                    value={fieldForm.areaAcres}
                    onChange={(e) => setFieldForm({ ...fieldForm, areaAcres: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'स्वामित्व स्थिति *' : 'Ownership Status *'}</label>
                  <select
                    value={fieldForm.ownershipStatus}
                    onChange={(e) => setFieldForm({ ...fieldForm, ownershipStatus: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] font-medium bg-white"
                  >
                    <option value="owned">{isHi ? 'खुद का (Owned)' : 'Owned'}</option>
                    <option value="leased">{isHi ? 'पट्टे पर (Leased)' : 'Leased'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'गाँव *' : 'Village *'}</label>
                  <input
                    type="text"
                    required
                    value={fieldForm.village}
                    onChange={(e) => setFieldForm({ ...fieldForm, village: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'जिला *' : 'District *'}</label>
                  <input
                    type="text"
                    required
                    value={fieldForm.district}
                    onChange={(e) => setFieldForm({ ...fieldForm, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'राज्य *' : 'State *'}</label>
                  <input
                    type="text"
                    required
                    value={fieldForm.state}
                    onChange={(e) => setFieldForm({ ...fieldForm, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'सिंचाई साधन' : 'Irrigation Source'}</label>
                  <select
                    value={fieldForm.irrigationSource}
                    onChange={(e) => setFieldForm({ ...fieldForm, irrigationSource: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] bg-white"
                  >
                    <option value="borewell">{isHi ? 'नलकूप / ट्यूबवेल (Borewell)' : 'Borewell / Tubewell'}</option>
                    <option value="canal">{isHi ? 'नहर (Canal)' : 'Canal'}</option>
                    <option value="drip">{isHi ? 'ड्रिप सिंचाई (Drip)' : 'Drip Irrigation'}</option>
                    <option value="sprinkler">{isHi ? 'फव्वारा (Sprinkler)' : 'Sprinkler'}</option>
                    <option value="rainfed">{isHi ? 'वर्षा आधारित (Rainfed)' : 'Rainfed'}</option>
                    <option value="other">{isHi ? 'अन्य (Other)' : 'Other'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'मिट्टी का प्रकार' : 'Soil Type'}</label>
                  <select
                    value={fieldForm.soilType}
                    onChange={(e) => setFieldForm({ ...fieldForm, soilType: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] bg-white"
                  >
                    <option value="alluvial">{isHi ? 'जलोढ़ (Alluvial)' : 'Alluvial'}</option>
                    <option value="black">{isHi ? 'काली मिट्टी (Black)' : 'Black Soil'}</option>
                    <option value="red">{isHi ? 'लाल मिट्टी (Red)' : 'Red Soil'}</option>
                    <option value="loamy">{isHi ? 'दोमट (Loamy)' : 'Loamy'}</option>
                    <option value="sandy">{isHi ? 'बलुई (Sandy)' : 'Sandy'}</option>
                    <option value="clay">{isHi ? 'चिकनी मिट्टी (Clay)' : 'Clay'}</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                ℹ️ {isHi 
                  ? 'दर्ज किया गया रकबा स्व-घोषित रूप में सहेजा जाएगा। डिजिटल सत्यापन के बाद इसका ट्रस्ट स्कोर बढ़ेगा।' 
                  : 'Acreage is recorded as self-declared. Verification badges are awarded upon documentation validation.'}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFieldModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white font-black shadow-xs cursor-pointer"
                >
                  {editingField ? (isHi ? 'अपडेट करें' : 'Update Field') : (isHi ? 'सहेजें (+20 Pts)' : 'Save Field (+20 Pts)')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. MODAL: ADD / EDIT CROP RECORD                              */}
      {/* ------------------------------------------------------------- */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" />
                <span>{editingCrop ? (isHi ? 'फसल रिकॉर्ड संपादित करें' : 'Edit Crop Record') : (isHi ? 'फसल रिकॉर्ड दर्ज करें' : 'Log Crop Record')}</span>
              </h3>
              <button onClick={() => setIsCropModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCrop} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'फसल का नाम *' : 'Crop Name *'}</label>
                  <input
                    type="text"
                    required
                    placeholder={isHi ? 'उदा. आलू, गेहूँ, सरसों' : 'e.g. Potato, Wheat, Mustard'}
                    value={cropForm.cropName}
                    onChange={(e) => setCropForm({ ...cropForm, cropName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'किस्म / वैरायटी' : 'Variety'}</label>
                  <input
                    type="text"
                    placeholder={isHi ? 'उदा. कुफरी ज्योति' : 'e.g. Kufri Jyoti'}
                    value={cropForm.variety}
                    onChange={(e) => setCropForm({ ...cropForm, variety: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'संबंधित खेत' : 'Associated Field'}</label>
                  <select
                    value={cropForm.fieldId}
                    onChange={(e) => setCropForm({ ...cropForm, fieldId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] bg-white font-medium"
                  >
                    <option value="">{isHi ? '-- कोई खेत चुनें --' : '-- Select Field --'}</option>
                    {profile?.fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.areaAcres} एकड़)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'फसल सत्र *' : 'Season *'}</label>
                  <select
                    value={cropForm.season}
                    onChange={(e) => setCropForm({ ...cropForm, season: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] bg-white font-medium"
                  >
                    <option value="Rabi">{isHi ? 'रबी (Rabi - शीतकालीन)' : 'Rabi (Winter)'}</option>
                    <option value="Kharif">{isHi ? 'खरीफ (Kharif - मानसूनी)' : 'Kharif (Monsoon)'}</option>
                    <option value="Zaid">{isHi ? 'जायद (Zaid - ग्रीष्मकालीन)' : 'Zaid (Summer)'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'बुवाई तिथि' : 'Sowing Date'}</label>
                  <input
                    type="date"
                    value={cropForm.sowingDate}
                    onChange={(e) => setCropForm({ ...cropForm, sowingDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'अनुमानित कटाई तिथि' : 'Expected Harvest'}</label>
                  <input
                    type="date"
                    value={cropForm.expectedHarvestDate}
                    onChange={(e) => setCropForm({ ...cropForm, expectedHarvestDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              {/* Quantities Section */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'अनुमानित पैदावार' : 'Est. Yield'}</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="100"
                    value={cropForm.estimatedYield}
                    onChange={(e) => setCropForm({ ...cropForm, estimatedYield: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'वास्तविक कटाई' : 'Harvested'}</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={cropForm.actualHarvestedQuantity}
                    onChange={(e) => setCropForm({ ...cropForm, actualHarvestedQuantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'बिक्री योग्य मात्रा' : 'For Sale'}</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="80"
                    value={cropForm.quantityForSale}
                    onChange={(e) => setCropForm({ ...cropForm, quantityForSale: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-400 focus:outline-none focus:border-[#315C45] bg-emerald-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'इकाई (Unit)' : 'Yield Unit'}</label>
                  <select
                    value={cropForm.yieldUnit}
                    onChange={(e) => setCropForm({ ...cropForm, yieldUnit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] bg-white"
                  >
                    <option value="Quintals">{isHi ? 'क्विंटल (Quintals)' : 'Quintals'}</option>
                    <option value="Metric Tonnes">{isHi ? 'मीट्रिक टन (Metric Tonnes)' : 'Metric Tonnes'}</option>
                    <option value="Kg">{isHi ? 'किलोग्राम (Kg)' : 'Kg'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'फसल की वर्तमान स्थिति' : 'Crop Status'}</label>
                  <select
                    value={cropForm.status}
                    onChange={(e) => setCropForm({ ...cropForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] bg-white"
                  >
                    <option value="Planned">{isHi ? 'योजनाबद्ध (Planned)' : 'Planned'}</option>
                    <option value="Growing">{isHi ? 'खेत में खड़ी / बढ़ रही (Growing)' : 'Growing'}</option>
                    <option value="Ready to Harvest">{isHi ? 'कटाई के लिए तैयार (Ready)' : 'Ready to Harvest'}</option>
                    <option value="Harvested">{isHi ? 'कटाई हो चुकी (Harvested)' : 'Harvested'}</option>
                    <option value="Sold">{isHi ? 'बिक चुकी (Sold)' : 'Sold'}</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCropModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow-xs cursor-pointer"
                >
                  {editingCrop ? (isHi ? 'अपडेट करें' : 'Update Record') : (isHi ? 'दर्ज करें (+10 Pts)' : 'Save Record (+10 Pts)')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 10. MODAL: EDIT FARMER PROFILE DETAILS                        */}
      {/* ------------------------------------------------------------- */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-[#315C45]" />
                <span>{isHi ? 'किसान प्रोफ़ाइल विवरण संपादित करें' : 'Edit Farmer Profile'}</span>
              </h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isHi ? 'पूरा नाम *' : 'Full Name *'}</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'गाँव' : 'Village'}</label>
                  <input
                    type="text"
                    value={profileForm.village}
                    onChange={(e) => setProfileForm({ ...profileForm, village: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'जिला' : 'District'}</label>
                  <input
                    type="text"
                    value={profileForm.district}
                    onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'राज्य' : 'State'}</label>
                  <input
                    type="text"
                    value={profileForm.state}
                    onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'पसंदीदा भाषा' : 'Language'}</label>
                  <select
                    value={profileForm.preferredLanguage}
                    onChange={(e) => setProfileForm({ ...profileForm, preferredLanguage: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45] bg-white font-medium"
                  >
                    <option value="hi">हिंदी (Hindi)</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isHi ? 'फ़ोटो URL' : 'Avatar URL'}</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={profileForm.avatarUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-[#315C45]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#315C45] hover:bg-[#264A37] text-white font-black shadow-xs cursor-pointer"
                >
                  {isHi ? 'सहेजें' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// CHRONOLOGICAL KISAN POINTS LEDGER TABLE SUB-COMPONENT
// -------------------------------------------------------------
const PointsLedgerSection: React.FC<{ userId?: string; isHi: boolean }> = ({ userId, isHi }) => {
  const [ledger, setLedger] = useState<KisanPointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLedger() {
      try {
        const res = await api.getFarmerPoints();
        if (res && res.success) {
          setLedger(res.ledger || []);
        }
      } catch (e) {
        console.warn('Error loading points ledger:', e);
      } finally {
        setLoading(false);
      }
    }
    loadLedger();
  }, [userId]);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading points ledger...</div>;
  }

  if (ledger.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-slate-500 text-xs">
        {isHi ? 'लेजर में अभी कोई प्रविष्टि नहीं है। प्रोफ़ाइल पूरा करके या खेत जोड़कर पॉइंट्स अर्जित करें!' : 'No points transactions recorded yet. Complete profile or register a field to earn points!'}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700 font-bold">
        <span>{isHi ? 'पॉइंट्स लेनदेन इतिहास (Points Transaction Ledger)' : 'Points Transaction Ledger'}</span>
        <span className="text-slate-500 font-normal">{ledger.length} {isHi ? 'प्रविष्टियां' : 'entries'}</span>
      </div>

      <div className="divide-y divide-slate-100">
        {ledger.map((entry) => (
          <div key={entry.id} className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  {entry.reason}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(entry.createdAt).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium">{entry.description}</p>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                <span>+{entry.points}</span>
                <span className="text-[10px]">Pts</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
