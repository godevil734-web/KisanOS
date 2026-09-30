import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SubscriptionPlan, User, Crop, UserRole } from '../types';
import { 
  ShieldCheck, 
  Users, 
  Settings, 
  DollarSign, 
  Sprout, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Edit3, 
  Save,
  BarChart2,
  Database,
  Plus,
  Search,
  Layers,
  ShoppingBag,
  Warehouse,
  Truck,
  Filter,
  Check,
  Eye
} from 'lucide-react';
import { RegisterModal } from './RegisterModal';
import { useAuth } from '../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const { user, switchRole } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'users' | 'plans' | 'crops'>('users');
  const [loading, setLoading] = useState(true);

  // Sub-section filter inside Stakeholder Directory ('all' | 'farmer' | 'aggregator' | 'buyer' | 'cold_storage' | 'transporter')
  const [selectedRoleSection, setSelectedRoleSection] = useState<'all' | UserRole>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Register Modal state inside Admin
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerInitialRole, setRegisterInitialRole] = useState<UserRole>('farmer');

  // Edit plan modal or inline
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, plansRes, cropsRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getSubscriptionPlans(),
        api.getCrops()
      ]);
      setStats(statsRes);
      setUsersList(usersRes);
      setPlans(plansRes);
      setCrops(cropsRes);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user?.role]);

  const handleToggleVerify = async (userId: string) => {
    try {
      await api.toggleUserVerify(userId);
      await fetchData();
    } catch (err) {
      alert('Error toggling verification: ' + (err as Error).message);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    try {
      await api.updateSubscriptionPlan(editingPlan.id, editingPlan);
      alert('Subscription Plan updated successfully!');
      setEditingPlan(null);
      await fetchData();
    } catch (err) {
      alert('Error updating plan: ' + (err as Error).message);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Are you sure you want to reset all mock data to the default realistic seed database?')) return;
    try {
      await api.resetDemoData();
      alert('System demo data successfully restored.');
      await fetchData();
    } catch (e) {
      alert('Error resetting demo: ' + (e as Error).message);
    }
  };

  // Grouped user lists
  const farmers = usersList.filter(u => u.role === 'farmer');
  const aggregators = usersList.filter(u => u.role === 'aggregator');
  const buyers = usersList.filter(u => u.role === 'buyer');
  const coldStorages = usersList.filter(u => u.role === 'cold_storage');
  const transporters = usersList.filter(u => u.role === 'transporter');
  const admins = usersList.filter(u => u.role === 'admin');

  // Filter by search query
  const filterBySearch = (list: User[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.location.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      (u.farmerProfile?.farmName && u.farmerProfile.farmName.toLowerCase().includes(q)) ||
      (u.aggregatorProfile?.businessName && u.aggregatorProfile.businessName.toLowerCase().includes(q)) ||
      (u.buyerProfile?.companyName && u.buyerProfile.companyName.toLowerCase().includes(q))
    );
  };

  if (user && user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-lg text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-3xl mx-auto mb-4 shadow-md">
          🛡️
        </div>
        <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-full mb-3">
          सुपरएडमिन अधिकार आवश्यक (Admin Access Required)
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
          प्लेटफ़ॉर्म प्रशासन और उपयोगकर्ता अनुभाग
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          आप वर्तमान में <strong>{user.name}</strong> ({user.role}) के खाते में हैं। किसान, कोल्ड स्टोरेज, संग्राहक और खरीदार के अलग-अलग वर्गीकृत सेक्शन्स देखने व नए उपयोगकर्ताओं को सत्यापित करने के लिए सुपरएडमिन मोड में जाएं।
        </p>
        <button
          onClick={() => switchRole('admin')}
          className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-md inline-flex items-center justify-center gap-2"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>सुपरएडमिन मोड सक्रिय करें (Switch to SuperAdmin)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-xs">
            ⚙️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                Platform Administration & Governance
              </h1>
              <span className="text-[11px] bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-bold">
                HQ SuperAdmin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              प्रशासनिक नियंत्रण: किसान, संग्राहक, खरीदार, कोल्ड स्टोरेज व ट्रांसपोर्टर का अलग-अलग प्रबंधन।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRegisterInitialRole('farmer');
              setIsRegisterOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>नया खाता जोड़ें (Register User)</span>
          </button>

          <button
            onClick={handleResetDemo}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Database className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'users', label: `स्टेकहोल्डर डायरेक्टरी (${usersList.length})`, icon: Users },
          { id: 'overview', label: 'प्लेटफॉर्म मैट्रिक्स (KPIs)', icon: BarChart2 },
          { id: 'plans', label: 'सब्सक्रिप्शन प्लान्स', icon: DollarSign },
          { id: 'crops', label: `फसल सूची (${crops.length})`, icon: Sprout }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveAdminTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-slate-900 text-slate-900 bg-slate-100/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 📋 TAB 1: SECTIONED STAKEHOLDER DIRECTORY (FARMER, AGGREGATOR, BUYER, ETC.) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'users' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Section Filter Pills + Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Role Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedRoleSection('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedRoleSection === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                सभी वर्ग ({usersList.length})
              </button>

              <button
                onClick={() => setSelectedRoleSection('farmer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedRoleSection === 'farmer'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span>🌾 किसान</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-black">{farmers.length}</span>
              </button>

              <button
                onClick={() => setSelectedRoleSection('aggregator')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedRoleSection === 'aggregator'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span>📦 संग्राहक / आढ़ती</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-black">{aggregators.length}</span>
              </button>

              <button
                onClick={() => setSelectedRoleSection('buyer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedRoleSection === 'buyer'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                <span>🏭 बड़ा खरीदार</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-black">{buyers.length}</span>
              </button>

              <button
                onClick={() => setSelectedRoleSection('cold_storage')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedRoleSection === 'cold_storage'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                }`}
              >
                <span>❄️ कोल्ड स्टोर</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-black">{coldStorages.length}</span>
              </button>

              <button
                onClick={() => setSelectedRoleSection('transporter')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedRoleSection === 'transporter'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                }`}
              >
                <span>🚚 ट्रांसपोर्टर</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-black">{transporters.length}</span>
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="नाम, फोन या शहर खोजें..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* 1. 🌾 SECTION: FARMERS (किसान वर्ग) */}
          {/* ============================================================ */}
          {(selectedRoleSection === 'all' || selectedRoleSection === 'farmer') && (
            <div className="bg-white rounded-2xl border-2 border-emerald-300 overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🌾</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      किसान वर्ग अनुभाग (Farmers Section)
                    </h3>
                    <p className="text-xs text-slate-500">
                      पंजीकृत किसानों की सूची, कुल जमीन, फसलें व सत्यापन स्थिति ({farmers.length} किसान)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRegisterInitialRole('farmer');
                    setIsRegisterOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold text-xs flex items-center gap-1 self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>नया किसान जोड़ें</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-50/70 text-emerald-900 font-bold border-b border-emerald-200">
                    <tr>
                      <th className="p-3">किसान का नाम व फोन</th>
                      <th className="p-3">गाँव व जिला</th>
                      <th className="p-3">खेत का नाम व जमीन</th>
                      <th className="p-3">उगाई जाने वाली फसलें</th>
                      <th className="p-3">पूरे सौदे</th>
                      <th className="p-3">सत्यापन स्थिति</th>
                      <th className="p-3 text-right">सत्यापन कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(farmers).map((u) => (
                      <tr key={u.id} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500">{u.phone}</span>
                        </td>
                        <td className="p-3 text-slate-600">{u.location}</td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 block">
                            {u.farmerProfile?.farmName || `${u.name} Farm`}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {u.farmerProfile?.acres || 5} एकड़ • {u.farmerProfile?.irrigationType || 'Tube well'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(u.farmerProfile?.cropsGrown || ['Potato', 'Wheat']).map((c, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-black text-slate-800">{u.completedOrders} ऑर्डर</td>
                        <td className="p-3">
                          {u.verified ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              सत्यापित
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 font-medium text-xs">
                              <XCircle className="h-4 w-4" />
                              असत्यापित
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleVerify(u.id)}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                              u.verified
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {u.verified ? 'रद्द करें' : 'सत्यापित करें'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. 📦 SECTION: AGGREGATORS (संग्राहक / आढ़ती वर्ग) */}
          {/* ============================================================ */}
          {(selectedRoleSection === 'all' || selectedRoleSection === 'aggregator') && (
            <div className="bg-white rounded-2xl border-2 border-amber-300 overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📦</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      संग्राहक एवं आढ़ती अनुभाग (Aggregators Section)
                    </h3>
                    <p className="text-xs text-slate-500">
                      गाँव से माल संकलन करने वाले पंजीकृत आढ़ती, कार्यक्षेत्र, दायरा व क्षमता ({aggregators.length} संग्राहक)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRegisterInitialRole('aggregator');
                    setIsRegisterOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold text-xs flex items-center gap-1 self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>नया संग्राहक जोड़ें</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-50/70 text-amber-900 font-bold border-b border-amber-200">
                    <tr>
                      <th className="p-3">व्यवसाय / हब का नाम</th>
                      <th className="p-3">संचालक व फोन</th>
                      <th className="p-3">कार्यक्षेत्र क्लस्टर</th>
                      <th className="p-3">दायरा व क्षमता</th>
                      <th className="p-3">सब्सक्रिप्शन स्थिति</th>
                      <th className="p-3">सत्यापन स्थिति</th>
                      <th className="p-3 text-right">सत्यापन कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(aggregators).map((u) => (
                      <tr key={u.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">
                            {u.aggregatorProfile?.businessName || `${u.name} Agro Hub`}
                          </span>
                          <span className="text-[10px] text-slate-500">{u.location}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500">{u.phone}</span>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">
                          {u.aggregatorProfile?.operatingRegion || 'Agra - Mathura Cluster'}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">
                            {u.aggregatorProfile?.maxAggregationCapacityTons || 60} टन बैच क्षमता
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {u.aggregatorProfile?.serviceRadiusKm || 50} km पिकअप दायरा
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.aggregatorProfile?.subscriptionStatus === 'ACTIVE' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.aggregatorProfile?.subscriptionStatus || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.verified ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              सत्यापित
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 font-medium text-xs">
                              <XCircle className="h-4 w-4" />
                              असत्यापित
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleVerify(u.id)}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                              u.verified
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                          >
                            {u.verified ? 'रद्द करें' : 'सत्यापित करें'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 3. 🏭 SECTION: BIG BUYERS (बड़ा खरीदार वर्ग) */}
          {/* ============================================================ */}
          {(selectedRoleSection === 'all' || selectedRoleSection === 'buyer') && (
            <div className="bg-white rounded-2xl border-2 border-blue-300 overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🏭</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      बड़ा खरीदार एवं औद्योगिक अनुभाग (Big Buyers Section)
                    </h3>
                    <p className="text-xs text-slate-500">
                      थोक खरीदार, फ़ूड प्रोसेसर्स, सुपरमार्केट व एक्सपोर्टर्स ({buyers.length} खरीदार)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRegisterInitialRole('buyer');
                    setIsRegisterOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-100 text-blue-800 hover:bg-blue-200 font-bold text-xs flex items-center gap-1 self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>नया खरीदार जोड़ें</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-50/70 text-blue-900 font-bold border-b border-blue-200">
                    <tr>
                      <th className="p-3">कंपनी व ब्रांड का नाम</th>
                      <th className="p-3">प्रोक्योरमेंट लीड व फोन</th>
                      <th className="p-3">व्यवसाय प्रकार</th>
                      <th className="p-3">वार्षिक मांग व जीएसटी</th>
                      <th className="p-3">पूरे ऑर्डर</th>
                      <th className="p-3">सत्यापन स्थिति</th>
                      <th className="p-3 text-right">सत्यापन कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(buyers).map((u) => (
                      <tr key={u.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">
                            {u.buyerProfile?.companyName || u.name}
                          </span>
                          <span className="text-[10px] text-slate-500">{u.location}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500">{u.phone}</span>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">
                          {u.buyerProfile?.businessType || 'Food Processor'}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-blue-800 block">
                            {u.buyerProfile?.annualDemandTons || 2000} टन / वर्ष
                          </span>
                          <span className="text-[10px] text-slate-400">
                            GST: {u.buyerProfile?.gstNumber || '07AAACP0000A1Z5'}
                          </span>
                        </td>
                        <td className="p-3 font-black text-slate-800">{u.completedOrders} ऑर्डर</td>
                        <td className="p-3">
                          {u.verified ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              सत्यापित
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 font-medium text-xs">
                              <XCircle className="h-4 w-4" />
                              असत्यापित
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleVerify(u.id)}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                              u.verified
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {u.verified ? 'रद्द करें' : 'सत्यापित करें'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. ❄️ SECTION: COLD STORAGE (कोल्ड स्टोरेज वर्ग) */}
          {/* ============================================================ */}
          {(selectedRoleSection === 'all' || selectedRoleSection === 'cold_storage') && (
            <div className="bg-white rounded-2xl border-2 border-cyan-300 overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">❄️</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      कोल्ड स्टोरेज अनुभाग (Cold Storage Section)
                    </h3>
                    <p className="text-xs text-slate-500">
                      पंजीकृत कोल्ड स्टोरेज गोदाम, कुल व उपलब्ध क्षमता और किराया दर ({coldStorages.length} स्टोरेज)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRegisterInitialRole('cold_storage');
                    setIsRegisterOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-cyan-100 text-cyan-800 hover:bg-cyan-200 font-bold text-xs flex items-center gap-1 self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>नया कोल्ड स्टोर जोड़ें</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cyan-50/70 text-cyan-900 font-bold border-b border-cyan-200">
                    <tr>
                      <th className="p-3">फैसिलिटी का नाम</th>
                      <th className="p-3">संचालक व फोन</th>
                      <th className="p-3">स्थान</th>
                      <th className="p-3">भंडारण क्षमता</th>
                      <th className="p-3">सत्यापन स्थिति</th>
                      <th className="p-3 text-right">सत्यापन कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(coldStorages).map((u) => (
                      <tr key={u.id} className="hover:bg-cyan-50/20 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500">Imperial Cold Hub</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500">{u.phone}</span>
                        </td>
                        <td className="p-3 text-slate-600">{u.location}</td>
                        <td className="p-3 font-bold text-cyan-800">
                          10,000 टन क्षमता (2,400T उपलब्ध)
                        </td>
                        <td className="p-3">
                          {u.verified ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              सत्यापित
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 font-medium text-xs">
                              <XCircle className="h-4 w-4" />
                              असत्यापित
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleVerify(u.id)}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                              u.verified
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-cyan-600 text-white hover:bg-cyan-700'
                            }`}
                          >
                            {u.verified ? 'रद्द करें' : 'सत्यापित करें'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 5. 🚚 SECTION: TRANSPORTERS (ट्रांसपोर्टर वर्ग) */}
          {/* ============================================================ */}
          {(selectedRoleSection === 'all' || selectedRoleSection === 'transporter') && (
            <div className="bg-white rounded-2xl border-2 border-purple-300 overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🚚</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      ट्रांसपोर्ट एवं लॉजिस्टिक्स अनुभाग (Transporters Section)
                    </h3>
                    <p className="text-xs text-slate-500">
                      कृषि माल ढुलाई फ्लीट, गाड़ियां व रूट्स ({transporters.length} ट्रांसपोर्टर)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setRegisterInitialRole('transporter');
                    setIsRegisterOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-800 hover:bg-purple-200 font-bold text-xs flex items-center gap-1 self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>नया ट्रांसपोर्टर जोड़ें</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-purple-50/70 text-purple-900 font-bold border-b border-purple-200">
                    <tr>
                      <th className="p-3">एजेंसी का नाम</th>
                      <th className="p-3">संचालक व फोन</th>
                      <th className="p-3">स्थान</th>
                      <th className="p-3">फ्लीट गाड़ियां</th>
                      <th className="p-3">सत्यापन स्थिति</th>
                      <th className="p-3 text-right">सत्यापन कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(transporters).map((u) => (
                      <tr key={u.id} className="hover:bg-purple-50/20 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500">Kisan Express Freight</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500">{u.phone}</span>
                        </td>
                        <td className="p-3 text-slate-600">{u.location}</td>
                        <td className="p-3 font-semibold text-purple-900">
                          Canter 6T, Tata 22T, Bolero 2T (Agra - Delhi Route)
                        </td>
                        <td className="p-3">
                          {u.verified ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              सत्यापित
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-400 font-medium text-xs">
                              <XCircle className="h-4 w-4" />
                              असत्यापित
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleVerify(u.id)}
                            className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                              u.verified
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                          >
                            {u.verified ? 'रद्द करें' : 'सत्यापित करें'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 📊 TAB 2: OVERVIEW & METRICS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'overview' && stats && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Total GMV Transacted</span>
              <div className="text-2xl font-black text-slate-900 mt-1">₹{stats.totalGmv?.toLocaleString() || '18,40,000'}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Active Listings</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{stats.activeListings || 6}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Bulk Batches</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{stats.activeBatches || 3}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Total Stakeholders</span>
              <div className="text-2xl font-black text-blue-600 mt-1">{usersList.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💵 TAB 3: AGGREGATOR SUBSCRIPTION PLANS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'plans' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Aggregator Subscription Pricing & Limits (Admin Configurable)
              </h3>
              <p className="text-xs text-slate-500">Business rules and pricing are never hardcoded and can be tuned dynamically.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                    {p.badge}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Monthly Subscription Fee:</span>
                    <strong className="text-slate-900">₹{p.monthlyPrice}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Batches:</span>
                    <strong className="text-slate-900">{p.maxActiveBatches} concurrent</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Farmers:</span>
                    <strong className="text-slate-900">{p.maxFarmers} farmers</strong>
                  </div>
                </div>

                <button
                  onClick={() => setEditingPlan(p)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Plan Pricing & Rules</span>
                </button>
              </div>
            ))}
          </div>

          {/* Edit Plan Modal */}
          {editingPlan && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Edit {editingPlan.name} Plan</h3>
                  <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>
                <form onSubmit={handleSavePlan} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Monthly Price (₹)</label>
                    <input
                      type="number"
                      value={editingPlan.monthlyPrice}
                      onChange={(e) => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setEditingPlan(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold">Save Plan</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌾 TAB 4: CROP CATALOGUE */}
      {/* ========================================================================= */}
      {activeAdminTab === 'crops' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Multi-Crop Supported Commodities ({crops.length})</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {crops.map((c) => (
              <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="text-sm font-bold text-slate-900">{c.name}</div>
                <div className="text-[10px] text-slate-500 uppercase">{c.category}</div>
                <div className="text-[11px] text-slate-600 truncate">{c.varieties?.join(', ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Universal Registration Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialRole={registerInitialRole}
        onSuccessRoleSelect={() => {
          fetchData();
        }}
      />

    </div>
  );
};

export default AdminDashboard;
