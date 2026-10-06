import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SubscriptionPlan, User, Crop, UserRole, AuditLogEntry } from '../types';
import { 
  ShieldCheck, 
  Users, 
  DollarSign, 
  Sprout, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  BarChart2,
  Database,
  Plus,
  Search,
  Filter,
  Eye,
  Clock,
  Ban,
  Check,
  FileText,
  AlertTriangle,
  ChevronRight,
  Trash2,
  CheckSquare
} from 'lucide-react';
import { RegisterModal } from './RegisterModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const AdminDashboard: React.FC = () => {
  const { user, switchRole } = useAuth();
  const { t, language } = useLanguage();
  const isHi = language === 'hi';
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState('all');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'approvals' | 'users' | 'audit' | 'plans' | 'crops'>('approvals');
  const [loading, setLoading] = useState(true);

  // Sub-section filter inside Stakeholder Directory ('all' | 'farmer' | 'aggregator' | 'buyer' | 'cold_storage' | 'transporter')
  const [selectedRoleSection, setSelectedRoleSection] = useState<'all' | UserRole>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Register Modal state inside Admin
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerInitialRole, setRegisterInitialRole] = useState<UserRole>('farmer');

  // Edit plan modal
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  // Privacy: revealed phone numbers map { [userId]: phone }
  const [revealedPhones, setRevealedPhones] = useState<Record<string, string>>({});

  // Confirm block/unblock modal
  const [confirmModal, setConfirmModal] = useState<{ type: 'block' | 'unblock'; targetUser: User } | null>(null);

  // Reject modal
  const [rejectModalUser, setRejectModalUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Delete user confirmation state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Multi-selection states for Pending Approvals & Stakeholder Directory
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    isOpen: boolean;
    ids: string[];
    source: 'pending' | 'users';
  }>({ isOpen: false, ids: [], source: 'users' });

  // Toggle selection for pending approval
  const toggleSelectPending = (id: string) => {
    setSelectedPendingIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllPending = () => {
    if (selectedPendingIds.length === pendingApprovals.length) {
      setSelectedPendingIds([]);
    } else {
      setSelectedPendingIds(pendingApprovals.map(p => p.id));
    }
  };

  const handleBulkApprovePending = async () => {
    if (selectedPendingIds.length === 0) return;
    setBulkLoading(true);
    try {
      await api.bulkApproveUsers(selectedPendingIds);
      alert(isHi ? `${selectedPendingIds.length} खाते सफलतापूर्वक स्वीकृत किए गए।` : `${selectedPendingIds.length} accounts approved successfully.`);
      setSelectedPendingIds([]);
      await fetchData();
    } catch (err: any) {
      alert('Error approving users: ' + (err?.message || 'Failed'));
    } finally {
      setBulkLoading(false);
    }
  };

  // Toggle selection for stakeholder user
  const toggleSelectUser = (id: string) => {
    if (id === user?.id) return; // Prevent selecting self
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectUsersInList = (list: User[]) => {
    const selectable = list.filter(u => u.id !== user?.id).map(u => u.id);
    const allSelected = selectable.length > 0 && selectable.every(id => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !selectable.includes(id)));
    } else {
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...selectable])));
    }
  };

  const handleBulkApproveUsers = async () => {
    if (selectedUserIds.length === 0) return;
    setBulkLoading(true);
    try {
      await api.bulkApproveUsers(selectedUserIds);
      alert(isHi ? `${selectedUserIds.length} खाते सफलतापूर्वक स्वीकृत व सक्रिय किए गए।` : `${selectedUserIds.length} accounts approved and verified.`);
      setSelectedUserIds([]);
      await fetchData();
    } catch (err: any) {
      alert('Error approving users: ' + (err?.message || 'Failed'));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExecuteBulkDelete = async () => {
    const { ids, source } = bulkDeleteModal;
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      await api.bulkDeleteUsers(ids);
      alert(isHi ? `${ids.length} खाते सफलतापूर्वक हटा दिए गए।` : `${ids.length} accounts permanently removed.`);
      setBulkDeleteModal({ isOpen: false, ids: [], source: 'users' });
      if (source === 'pending') {
        setSelectedPendingIds(prev => prev.filter(id => !ids.includes(id)));
      } else {
        setSelectedUserIds(prev => prev.filter(id => !ids.includes(id)));
      }
      await fetchData();
    } catch (err: any) {
      alert('Error deleting accounts: ' + (err?.message || 'Failed'));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!deleteConfirmUser) return;
    setDeleting(true);
    try {
      await api.deleteUser(deleteConfirmUser.id);
      alert(
        isHi 
          ? `उपयोगकर्ता "${deleteConfirmUser.name || 'खाता'}" को सफलतापूर्वक हटा दिया गया है।` 
          : `User "${deleteConfirmUser.name || 'Account'}" has been permanently removed.`
      );
      setDeleteConfirmUser(null);
      await fetchData();
    } catch (err: any) {
      alert('Error removing user: ' + (err?.message || 'Failed to delete user'));
    } finally {
      setDeleting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, plansRes, cropsRes, pendingRes, auditRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getSubscriptionPlans(),
        api.getCrops(),
        api.getPendingApprovals(),
        api.getAuditLogs({ limit: 50, action: auditFilter === 'all' ? undefined : auditFilter })
      ]);
      setStats(statsRes);
      setUsersList(usersRes);
      setPlans(plansRes);
      setCrops(cropsRes);
      setPendingApprovals(pendingRes);
      setAuditLogs(auditRes);
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

  const handleAuditFilterChange = async (action: string) => {
    setAuditFilter(action);
    try {
      const res = await api.getAuditLogs({ limit: 50, action: action === 'all' ? undefined : action });
      setAuditLogs(res);
    } catch (err) {
      console.error('Error fetching audit logs with filter:', err);
    }
  };

  const handleToggleVerify = async (userId: string) => {
    try {
      await api.toggleUserVerify(userId);
      await fetchData();
    } catch (err) {
      alert('Error toggling verification: ' + (err as Error).message);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await api.approveUser(userId);
      await fetchData();
    } catch (err) {
      alert('Error approving user: ' + (err as Error).message);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalUser) return;
    try {
      await api.rejectUser(rejectModalUser.id, rejectReason.trim() || undefined);
      setRejectModalUser(null);
      setRejectReason('');
      await fetchData();
    } catch (err) {
      alert('Error rejecting user: ' + (err as Error).message);
    }
  };

  const handleBlockUnblockConfirm = async () => {
    if (!confirmModal) return;
    try {
      if (confirmModal.type === 'block') {
        await api.blockUser(confirmModal.targetUser.id);
      } else {
        await api.unblockUser(confirmModal.targetUser.id);
      }
      setConfirmModal(null);
      await fetchData();
    } catch (err) {
      alert(`Error updating user status: ` + (err as Error).message);
    }
  };

  const handleRevealPhone = async (userId: string) => {
    try {
      const res = await api.revealUserPhone(userId);
      setRevealedPhones(prev => ({ ...prev, [userId]: res.phone }));
    } catch (err) {
      alert('Error revealing phone: ' + (err as Error).message);
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
  const admins = usersList.filter(u => u.role === 'admin');
  const farmers = usersList.filter(u => u.role === 'farmer');
  const aggregators = usersList.filter(u => u.role === 'aggregator');
  const buyers = usersList.filter(u => u.role === 'buyer' || u.role === 'dealer');
  const coldStorages = usersList.filter(u => u.role === 'cold_storage');
  const transporters = usersList.filter(u => u.role === 'transporter');

  const handleMakeAdmin = async (targetUser: User) => {
    const confirmed = window.confirm(
      isHi 
        ? `क्या आप वास्तव में "${targetUser.name}" (${targetUser.email || targetUser.phone}) को व्यवस्थापक (Admin) का पूर्ण अधिकार देना चाहते हैं?` 
        : `Are you sure you want to grant full Administrator privileges to "${targetUser.name}" (${targetUser.email || targetUser.phone})?`
    );
    if (!confirmed) return;
    try {
      await api.makeUserAdmin(targetUser.id);
      alert(isHi ? `${targetUser.name} को सफलतापूर्वक एडमिन बना दिया गया है।` : `${targetUser.name} has been promoted to Admin successfully.`);
      await fetchData();
    } catch (err) {
      alert('Error promoting user to admin: ' + (err as Error).message);
    }
  };

  // Filter by search query with defensive null-safety
  const filterBySearch = (list: User[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(u => {
      if (!u) return false;
      const name = String(u.name || '').toLowerCase();
      const location = String(u.location || (u as any).villageDistrict || '').toLowerCase();
      const phone = String(revealedPhones[u.id] || (u as any).phoneMasked || u.phone || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const farmName = String(u.farmerProfile?.farmName || '').toLowerCase();
      const businessName = String(u.aggregatorProfile?.businessName || u.buyerProfile?.companyName || (u as any).businessName || '').toLowerCase();
      const companyName = String(u.buyerProfile?.companyName || '').toLowerCase();
      return (
        name.includes(q) ||
        location.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        farmName.includes(q) ||
        businessName.includes(q) ||
        companyName.includes(q)
      );
    });
  };

  // Masked phone renderer with privacy reveal button and safe null handling
  const renderPhoneCell = (u: User) => {
    if (!u) return null;
    const revealed = revealedPhones[u.id];
    const rawPhone = revealed || (u as any).phoneMasked || u.phone;
    if (!rawPhone) {
      return (
        <span className="font-mono text-[11px] text-slate-400 italic">
          {u?.email || '—'}
        </span>
      );
    }
    const phoneStr = String(rawPhone);
    const isMasked = !revealed && (phoneStr.includes('•') || phoneStr.includes('*'));
    const displayPhone = revealed 
      ? phoneStr 
      : ((u as any).phoneMasked || (phoneStr.length > 4 ? '•••••• ' + phoneStr.slice(-4) : phoneStr));

    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="font-mono text-[11px] text-slate-600">{displayPhone}</span>
        {isMasked && (
          <button
            onClick={() => handleRevealPhone(u.id)}
            title={t('admin.revealPhone') || 'Reveal'}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center text-[10px] gap-0.5 cursor-pointer"
          >
            <Eye className="h-3 w-3" />
            <span className="text-[10px]">{t('admin.revealPhone') || 'Reveal'}</span>
          </button>
        )}
      </div>
    );
  };

  // Status badge renderer
  const renderStatusBadge = (u: User) => {
    const st = u.status || (u.verified ? 'active' : 'pending');
    if (st === 'blocked') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
          Blocked
        </span>
      );
    }
    if (st === 'rejected') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
          Rejected
        </span>
      );
    }
    if (st === 'pending') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
        Active
      </span>
    );
  };

  // User Actions renderer (Verify + Block/Unblock)
  const renderUserActions = (u: User) => {
    const isBlocked = u.status === 'blocked';
    const isCurrentAdmin = u.role === 'admin';
    return (
      <div className="flex items-center justify-end gap-1.5 flex-wrap">
        {isCurrentAdmin ? (
          <span className="px-2 py-0.5 rounded-lg font-bold text-[11px] bg-purple-100 text-purple-900 border border-purple-200 inline-flex items-center gap-1 shadow-xs">
            <span>🛡️</span>
            <span>{isHi ? 'व्यवस्थापक' : 'Admin'}</span>
          </span>
        ) : (
          <button
            onClick={() => handleMakeAdmin(u)}
            title={isHi ? 'इस खाते को एडमिन बनाएं' : 'Promote this user to Admin'}
            className="px-2.5 py-1 rounded-lg font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white transition-colors inline-flex items-center gap-1 shadow-xs"
          >
            <span>🛡️</span>
            <span>{isHi ? 'एडमिन बनाएं' : 'Make Admin'}</span>
          </button>
        )}

        <button
          onClick={() => handleToggleVerify(u.id)}
          className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${
            u.verified
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {u.verified ? 'रद्द करें' : 'सत्यापित'}
        </button>

        {isBlocked ? (
          <button
            onClick={() => setConfirmModal({ type: 'unblock', targetUser: u })}
            className="px-2.5 py-1 rounded-lg font-bold text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors cursor-pointer"
          >
            {t('admin.unblockBtn') || 'Unblock'}
          </button>
        ) : (
          <button
            onClick={() => setConfirmModal({ type: 'block', targetUser: u })}
            className="px-2.5 py-1 rounded-lg font-bold text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            {t('admin.blockBtn') || 'Block'}
          </button>
        )}

        {/* Remove / Delete User Button (Admin cannot delete themselves) */}
        {u.id !== user?.id && (
          <button
            type="button"
            onClick={() => setDeleteConfirmUser(u)}
            title={isHi ? 'उपयोगकर्ता हटाएं' : 'Remove user'}
            className="p-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all cursor-pointer shadow-2xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
          आप वर्तमान में <strong>{user.name}</strong> ({user.role}) के खाते में हैं।
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

  const pendingCount = stats?.pendingCount ?? pendingApprovals.length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-xs shrink-0">
            ⚙️
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                Platform Administration & Governance
              </h1>
              <span className="text-[11px] bg-slate-900 text-white px-2.5 py-0.5 rounded-full font-bold">
                HQ SuperAdmin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              प्रशासनिक नियंत्रण: खाते स्वीकृति, सत्यापन, सुरक्षा लॉग व मैट्रिक्स।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setRegisterInitialRole('farmer');
              setIsRegisterOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>नया खाता जोड़ें</span>
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

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto scrollbar-none">
        {[
          { 
            id: 'approvals', 
            label: t('admin.tabApprovals') || 'Pending Approvals', 
            icon: Clock,
            badge: pendingCount
          },
          { 
            id: 'users', 
            label: `${t('admin.tabUsers') || 'Stakeholders'} (${usersList.length})`, 
            icon: Users 
          },
          { 
            id: 'overview', 
            label: t('admin.tabOverview') || 'Overview', 
            icon: BarChart2 
          },
          { 
            id: 'audit', 
            label: t('admin.tabAudit') || 'Audit Log', 
            icon: FileText 
          },
          { 
            id: 'plans', 
            label: t('admin.tabPlans') || 'Plans', 
            icon: DollarSign 
          },
          { 
            id: 'crops', 
            label: `${t('admin.tabCrops') || 'Crops'} (${crops.length})`, 
            icon: Sprout 
          }
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
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ⏳ TAB 1: PENDING APPROVALS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'approvals' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>{t('admin.tabApprovals') || 'Pending Approvals'}</span>
                {pendingApprovals.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-bold">
                    {pendingApprovals.length} pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                {isHi 
                  ? 'नए एग्रीगेटर, डीलर व बिजनेस खातों की समीक्षा करें और एक साथ स्वीकृत या हटाएं।' 
                  : 'Review and approve new aggregator, dealer, and business registrations before platform access.'}
              </p>
            </div>
          </div>

          {pendingApprovals.length > 0 && (
            <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pendingApprovals.length > 0 && selectedPendingIds.length === pendingApprovals.length}
                    onChange={selectAllPending}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    {selectedPendingIds.length === pendingApprovals.length 
                      ? (isHi ? 'सभी अचयनित करें' : 'Deselect All') 
                      : (isHi ? 'सभी मार्क करें (Select All)' : 'Mark All')}
                  </span>
                </label>
                {selectedPendingIds.length > 0 && (
                  <span className="text-[11px] font-black bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {selectedPendingIds.length} {isHi ? 'चयनित (Marked)' : 'selected'}
                  </span>
                )}
              </div>

              {selectedPendingIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={bulkLoading}
                    onClick={handleBulkApprovePending}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isHi ? `स्वीकृत करें (${selectedPendingIds.length})` : `Approve Selected (${selectedPendingIds.length})`}</span>
                  </button>

                  <button
                    type="button"
                    disabled={bulkLoading}
                    onClick={() => setBulkDeleteModal({ isOpen: true, ids: selectedPendingIds, source: 'pending' })}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{isHi ? `हटाएं (${selectedPendingIds.length})` : `Delete Selected (${selectedPendingIds.length})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPendingIds([])}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    {isHi ? 'रद्द करें' : 'Clear'}
                  </button>
                </div>
              )}
            </div>
          )}

          {pendingApprovals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {t('admin.noPending') || 'No pending accounts requiring approval.'}
              </h3>
              <p className="text-xs text-slate-500">
                All aggregator and dealer accounts are currently reviewed and up to date.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingApprovals.map((p) => {
                const businessName = p.aggregatorProfile?.businessName || p.buyerProfile?.companyName || p.farmerProfile?.farmName || p.name;
                const signupDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent';
                const isSelected = selectedPendingIds.includes(p.id);

                return (
                  <div 
                    key={p.id} 
                    className={`bg-white rounded-2xl border transition-all p-5 shadow-xs flex flex-col justify-between space-y-4 ${
                      isSelected ? 'border-amber-500 ring-2 ring-amber-400/30 bg-amber-50/10' : 'border-amber-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectPending(p.id)}
                            className="h-4 w-4 mt-1 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              {p.role}
                            </span>
                            <h3 className="text-base font-bold text-slate-900 mt-1">
                              {businessName}
                            </h3>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {signupDate}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Contact Person</span>
                          <span className="font-semibold text-slate-800">{p.name}</span>
                          {renderPhoneCell(p)}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Location / City</span>
                          <span className="font-semibold text-slate-800">{p.location || 'Agra, UP'}</span>
                          {p.aggregatorProfile?.operatingRegion && (
                            <span className="text-[10px] text-slate-500 block truncate">
                              {p.aggregatorProfile.operatingRegion}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Check className="h-4 w-4" />
                        <span>{t('admin.approveBtn') || 'Approve'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setRejectModalUser(p);
                          setRejectReason('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>{t('admin.rejectBtn') || 'Reject'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmUser(p)}
                        title={isHi ? 'खाता स्थायी रूप से हटाएं' : 'Permanently remove account'}
                        className="p-2 rounded-xl text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📋 TAB 2: SECTIONED STAKEHOLDER DIRECTORY */}
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
                <span>🏭 खरीदार / डीलर</span>
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

              <button
                onClick={() => setSelectedRoleSection('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedRoleSection === 'admin'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                <span>🛡️ व्यवस्थापक</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-black">{admins.length}</span>
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

          {/* Bulk Action Bar for Stakeholders Directory */}
          {selectedUserIds.length > 0 && (
            <div className="sticky top-4 z-30 bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <span className="h-7 w-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs">
                  {selectedUserIds.length}
                </span>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-white block">
                    {isHi ? `${selectedUserIds.length} खाते मार्क किए गए (Selected)` : `${selectedUserIds.length} accounts marked`}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {isHi ? 'एक साथ स्वीकृत/सत्यापित करें या स्थायी रूप से हटाएं' : 'Bulk approve/verify or delete selected accounts'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={handleBulkApproveUsers}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                  <span>{isHi ? `स्वीकृत करें (${selectedUserIds.length})` : `Approve (${selectedUserIds.length})`}</span>
                </button>

                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => setBulkDeleteModal({ isOpen: true, ids: selectedUserIds, source: 'users' })}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 text-rose-200" />
                  <span>{isHi ? `हटाएं (${selectedUserIds.length})` : `Delete (${selectedUserIds.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  {isHi ? 'चयन हटाएं' : 'Clear'}
                </button>
              </div>
            </div>
          )}

          {/* 0. PLATFORM ADMINISTRATORS */}
          {(selectedRoleSection === 'all' || selectedRoleSection === 'admin') && (
            <div className="bg-white rounded-2xl border-2 border-purple-300 overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      प्लेटफ़ॉर्म व्यवस्थापक अनुभाग (Platform Administrators)
                    </h3>
                    <p className="text-xs text-slate-500">
                      सिस्टम व यूज़र मैनेजमेंट विशेषाधिकार वाले सुपरएडमिन ({admins.length} व्यवस्थापक)
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-purple-50/70 text-purple-900 font-bold border-b border-purple-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filterBySearch(admins).filter(u => u.id !== user?.id).length > 0 &&
                            filterBySearch(admins).filter(u => u.id !== user?.id).every(u => selectedUserIds.includes(u.id))
                          }
                          onChange={() => toggleSelectUsersInList(filterBySearch(admins))}
                          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          title={isHi ? "सभी चुनें" : "Select all"}
                        />
                      </th>
                      <th className="p-3">व्यवस्थापक का नाम</th>
                      <th className="p-3">ईमेल व संपर्क</th>
                      <th className="p-3">भूमिका</th>
                      <th className="p-3">स्थिति</th>
                      <th className="p-3">सत्यापन</th>
                      <th className="p-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(admins).map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr key={u.id} className={`transition-colors ${isSelected ? 'bg-purple-100/50' : 'hover:bg-purple-50/20'}`}>
                          <td className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              disabled={u.id === user?.id}
                              checked={isSelected}
                              onChange={() => toggleSelectUser(u.id)}
                              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:opacity-20"
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{u.name || 'Unnamed'}</span>
                            <span className="text-[10px] text-purple-700 font-semibold">{u.location || 'Central Admin'}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{u.email}</span>
                            {renderPhoneCell(u)}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Super Admin
                            </span>
                          </td>
                          <td className="p-3">{renderStatusBadge(u)}</td>
                          <td className="p-3">
                            <span className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              सत्यापित
                            </span>
                          </td>
                          <td className="p-3 text-right">{renderUserActions(u)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 1. FARMERS */}
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
                      पंजीकृत किसानों की सूची ({farmers.length} किसान)
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-emerald-50/70 text-emerald-900 font-bold border-b border-emerald-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filterBySearch(farmers).filter(u => u.id !== user?.id).length > 0 &&
                            filterBySearch(farmers).filter(u => u.id !== user?.id).every(u => selectedUserIds.includes(u.id))
                          }
                          onChange={() => toggleSelectUsersInList(filterBySearch(farmers))}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title={isHi ? "सभी चुनें" : "Select all"}
                        />
                      </th>
                      <th className="p-3">किसान का नाम व फोन</th>
                      <th className="p-3">गाँव व जिला</th>
                      <th className="p-3">खेत का नाम व जमीन</th>
                      <th className="p-3">स्थिति</th>
                      <th className="p-3">सत्यापन</th>
                      <th className="p-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(farmers).map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr key={u.id} className={`transition-colors ${isSelected ? 'bg-emerald-100/50' : 'hover:bg-emerald-50/20'}`}>
                          <td className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              disabled={u.id === user?.id}
                              checked={isSelected}
                              onChange={() => toggleSelectUser(u.id)}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-20"
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{u.name || 'Unnamed'}</span>
                            {renderPhoneCell(u)}
                          </td>
                          <td className="p-3 text-slate-600">{u.location || '—'}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800 block">
                              {u.farmerProfile?.farmName || `${u.name || 'Unnamed'} Farm`}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {u.farmerProfile?.acres || 5} एकड़
                            </span>
                          </td>
                          <td className="p-3">{renderStatusBadge(u)}</td>
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
                          <td className="p-3 text-right">{renderUserActions(u)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. AGGREGATORS */}
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
                      गाँव से माल संकलन करने वाले पंजीकृत आढ़ती ({aggregators.length} संग्राहक)
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-amber-50/70 text-amber-900 font-bold border-b border-amber-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filterBySearch(aggregators).filter(u => u.id !== user?.id).length > 0 &&
                            filterBySearch(aggregators).filter(u => u.id !== user?.id).every(u => selectedUserIds.includes(u.id))
                          }
                          onChange={() => toggleSelectUsersInList(filterBySearch(aggregators))}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          title={isHi ? "सभी चुनें" : "Select all"}
                        />
                      </th>
                      <th className="p-3">व्यवसाय / हब का नाम</th>
                      <th className="p-3">संचालक व फोन</th>
                      <th className="p-3">कार्यक्षेत्र</th>
                      <th className="p-3">स्थिति</th>
                      <th className="p-3">सत्यापन</th>
                      <th className="p-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(aggregators).map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr key={u.id} className={`transition-colors ${isSelected ? 'bg-amber-100/50' : 'hover:bg-amber-50/20'}`}>
                          <td className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              disabled={u.id === user?.id}
                              checked={isSelected}
                              onChange={() => toggleSelectUser(u.id)}
                              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-20"
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">
                              {u.aggregatorProfile?.businessName || `${u.name || 'Unnamed'} Agro Hub`}
                            </span>
                            <span className="text-[10px] text-slate-500">{u.location || '—'}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{u.name || 'Unnamed'}</span>
                            {renderPhoneCell(u)}
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {u.aggregatorProfile?.operatingRegion || 'Agra Cluster'}
                          </td>
                          <td className="p-3">{renderStatusBadge(u)}</td>
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
                          <td className="p-3 text-right">{renderUserActions(u)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. BUYERS & DEALERS */}
          {(selectedRoleSection === 'all' || selectedRoleSection === 'buyer') && (
            <div className="bg-white rounded-2xl border-2 border-blue-300 overflow-hidden shadow-xs space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🏭</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      बड़ा खरीदार एवं डीलर अनुभाग (Big Buyers & Dealers)
                    </h3>
                    <p className="text-xs text-slate-500">
                      थोक खरीदार, फ़ूड प्रोसेसर्स व एक्सपोर्टर्स ({buyers.length} खरीदार)
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-blue-50/70 text-blue-900 font-bold border-b border-blue-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filterBySearch(buyers).filter(u => u.id !== user?.id).length > 0 &&
                            filterBySearch(buyers).filter(u => u.id !== user?.id).every(u => selectedUserIds.includes(u.id))
                          }
                          onChange={() => toggleSelectUsersInList(filterBySearch(buyers))}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title={isHi ? "सभी चुनें" : "Select all"}
                        />
                      </th>
                      <th className="p-3">कंपनी व ब्रांड का नाम</th>
                      <th className="p-3">प्रोक्योरमेंट लीड व फोन</th>
                      <th className="p-3">व्यवसाय प्रकार</th>
                      <th className="p-3">स्थिति</th>
                      <th className="p-3">सत्यापन</th>
                      <th className="p-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(buyers).map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr key={u.id} className={`transition-colors ${isSelected ? 'bg-blue-100/50' : 'hover:bg-blue-50/20'}`}>
                          <td className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              disabled={u.id === user?.id}
                              checked={isSelected}
                              onChange={() => toggleSelectUser(u.id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-20"
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">
                              {u.buyerProfile?.companyName || u.name}
                            </span>
                            <span className="text-[10px] text-slate-500">{u.location || '—'}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{u.name || 'Unnamed'}</span>
                            {renderPhoneCell(u)}
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {u.buyerProfile?.businessType || 'Food Processor'}
                          </td>
                          <td className="p-3">{renderStatusBadge(u)}</td>
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
                          <td className="p-3 text-right">{renderUserActions(u)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. COLD STORAGE */}
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
                      पंजीकृत कोल्ड स्टोरेज गोदाम ({coldStorages.length} स्टोरेज)
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-cyan-50/70 text-cyan-900 font-bold border-b border-cyan-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filterBySearch(coldStorages).filter(u => u.id !== user?.id).length > 0 &&
                            filterBySearch(coldStorages).filter(u => u.id !== user?.id).every(u => selectedUserIds.includes(u.id))
                          }
                          onChange={() => toggleSelectUsersInList(filterBySearch(coldStorages))}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          title={isHi ? "सभी चुनें" : "Select all"}
                        />
                      </th>
                      <th className="p-3">फैसिलिटी का नाम</th>
                      <th className="p-3">संचालक व फोन</th>
                      <th className="p-3">स्थान</th>
                      <th className="p-3">स्थिति</th>
                      <th className="p-3">सत्यापन</th>
                      <th className="p-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(coldStorages).map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr key={u.id} className={`transition-colors ${isSelected ? 'bg-cyan-100/50' : 'hover:bg-cyan-50/20'}`}>
                          <td className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              disabled={u.id === user?.id}
                              checked={isSelected}
                              onChange={() => toggleSelectUser(u.id)}
                              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer disabled:opacity-20"
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{u.name || 'Unnamed'}</span>
                            <span className="text-[10px] text-slate-500">Imperial Cold Hub</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{u.name || 'Unnamed'}</span>
                            {renderPhoneCell(u)}
                          </td>
                          <td className="p-3 text-slate-600">{u.location || '—'}</td>
                          <td className="p-3">{renderStatusBadge(u)}</td>
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
                          <td className="p-3 text-right">{renderUserActions(u)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. TRANSPORTERS */}
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
                      कृषि माल ढुलाई फ्लीट ({transporters.length} ट्रांसपोर्टर)
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-purple-50/70 text-purple-900 font-bold border-b border-purple-200">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filterBySearch(transporters).filter(u => u.id !== user?.id).length > 0 &&
                            filterBySearch(transporters).filter(u => u.id !== user?.id).every(u => selectedUserIds.includes(u.id))
                          }
                          onChange={() => toggleSelectUsersInList(filterBySearch(transporters))}
                          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          title={isHi ? "सभी चुनें" : "Select all"}
                        />
                      </th>
                      <th className="p-3">एजेंसी का नाम</th>
                      <th className="p-3">संचालक व फोन</th>
                      <th className="p-3">स्थान</th>
                      <th className="p-3">स्थिति</th>
                      <th className="p-3">सत्यापन</th>
                      <th className="p-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filterBySearch(transporters).map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr key={u.id} className={`transition-colors ${isSelected ? 'bg-purple-100/50' : 'hover:bg-purple-50/20'}`}>
                          <td className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              disabled={u.id === user?.id}
                              checked={isSelected}
                              onChange={() => toggleSelectUser(u.id)}
                              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:opacity-20"
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{u.name || 'Unnamed'}</span>
                            <span className="text-[10px] text-slate-500">Kisan Express Freight</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{u.name || 'Unnamed'}</span>
                            {renderPhoneCell(u)}
                          </td>
                          <td className="p-3 text-slate-600">{u.location || '—'}</td>
                          <td className="p-3">{renderStatusBadge(u)}</td>
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
                          <td className="p-3 text-right">{renderUserActions(u)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📊 TAB 3: OVERVIEW & STATS (30-DAY SIGNUP CHART + STATUS + ROLE) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Total GMV Transacted</span>
              <div className="text-2xl font-black text-slate-900 mt-1">₹{stats?.totalGmv?.toLocaleString() || '18,40,000'}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Active Listings</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{stats?.activeListings ?? 6}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Bulk Batches</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{stats?.activeBatches ?? 3}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 block">Total Stakeholders</span>
              <div className="text-2xl font-black text-blue-600 mt-1">{usersList.length}</div>
            </div>
          </div>

          {/* 30-Day Signup Trend Mini Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t('admin.signupTrendHeading') || '30-Day Signup Trend'}
                </h3>
                <p className="text-xs text-slate-500">Daily registrations over the last 30 days</p>
              </div>
              <span className="text-xs font-bold text-slate-600 px-2.5 py-1 bg-slate-100 rounded-lg">
                Last 30 Days
              </span>
            </div>

            {stats?.signupTrend && stats.signupTrend.length > 0 ? (
              <div className="pt-4">
                {/* SVG Bar Chart */}
                <div className="h-36 w-full flex items-end gap-1.5 border-b border-slate-200 pb-2">
                  {(() => {
                    const maxCount = Math.max(...stats.signupTrend.map((d: any) => d.count), 5);
                    return stats.signupTrend.map((d: any, idx: number) => {
                      const heightPercent = Math.max(8, Math.round((d.count / maxCount) * 100));
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center group relative h-full justify-end"
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-7 hidden group-hover:flex px-1.5 py-0.5 bg-slate-900 text-white text-[10px] rounded font-bold whitespace-nowrap z-10">
                            {d.date}: {d.count} signups
                          </div>
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t transition-all ${
                              d.count > 0 
                                ? 'bg-emerald-500 hover:bg-emerald-600' 
                                : 'bg-slate-100'
                            }`}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                  <span>30 days ago</span>
                  <span>15 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-400 text-xs">
                No signup trend data available
              </div>
            )}
          </div>

          {/* Counts by Role and by Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                {t('admin.statusBreakdown') || 'Users by Status'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-xs font-semibold text-emerald-800 block">Active</span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">
                    {stats?.statusCounts?.active ?? usersList.filter(u => u.status === 'active' || (!u.status && u.verified)).length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <span className="text-xs font-semibold text-amber-800 block">Pending</span>
                  <div className="text-xl font-black text-amber-700 mt-0.5">
                    {stats?.statusCounts?.pending ?? pendingApprovals.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
                  <span className="text-xs font-semibold text-rose-800 block">Blocked</span>
                  <div className="text-xl font-black text-rose-700 mt-0.5">
                    {stats?.statusCounts?.blocked ?? usersList.filter(u => u.status === 'blocked').length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-xs font-semibold text-slate-700 block">Rejected</span>
                  <div className="text-xl font-black text-slate-800 mt-0.5">
                    {stats?.statusCounts?.rejected ?? usersList.filter(u => u.status === 'rejected').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Role Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                {t('admin.roleBreakdown') || 'Users by Role'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {['farmer', 'aggregator', 'dealer', 'buyer', 'cold_storage', 'transporter'].map((r) => {
                  const count = stats?.roleCounts?.[r] ?? usersList.filter(u => u.role === r).length;
                  return (
                    <div key={r} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-400 capitalize block">{r.replace('_', ' ')}</span>
                      <strong className="text-sm font-bold text-slate-800">{count}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📜 TAB 4: AUDIT LOG */}
      {/* ========================================================================= */}
      {activeAdminTab === 'audit' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                {t('admin.tabAudit') || 'Audit Log'}
              </h2>
              <p className="text-xs text-slate-500">
                Complete audit trail of admin actions: approvals, rejections, blocks, plan updates, and privacy reveals.
              </p>
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={auditFilter}
                onChange={(e) => handleAuditFilterChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-700"
              >
                <option value="all">{t('admin.filterAll') || 'All Actions'}</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="block">Block</option>
                <option value="unblock">Unblock</option>
                <option value="verify">Verify</option>
                <option value="plan_update">Plan Update</option>
                <option value="reveal_phone">Reveal Phone</option>
                <option value="reset_demo">Reset Demo</option>
              </select>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {t('admin.noAuditLogs') || 'No audit log records found.'}
              </h3>
              <p className="text-xs text-slate-500">
                Admin actions will appear here as they are performed.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Admin</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Target User</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => {
                      const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleString() : '-';
                      let badgeColor = 'bg-slate-100 text-slate-800';
                      if (log.action === 'approve') badgeColor = 'bg-emerald-100 text-emerald-800';
                      if (log.action === 'reject') badgeColor = 'bg-rose-100 text-rose-800';
                      if (log.action === 'block') badgeColor = 'bg-rose-100 text-rose-800 font-black';
                      if (log.action === 'unblock') badgeColor = 'bg-emerald-100 text-emerald-800';
                      if (log.action === 'reveal_phone') badgeColor = 'bg-amber-100 text-amber-800';
                      if (log.action === 'verify') badgeColor = 'bg-blue-100 text-blue-800';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 whitespace-nowrap text-slate-500 text-[11px]">
                            {dateStr}
                          </td>
                          <td className="p-3 whitespace-nowrap font-semibold text-slate-800">
                            {log.adminName || log.adminId}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-700">
                            {log.targetUserName || log.targetUserId || '-'}
                          </td>
                          <td className="p-3 text-slate-500 max-w-xs truncate text-[11px]">
                            {log.details ? JSON.stringify(log.details) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💵 TAB 5: PLANS */}
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
      {/* 🌾 TAB 6: CROPS */}
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

      {/* Reject Reason Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {t('admin.rejectBtn') || 'Reject'} Account: {rejectModalUser.name}
              </h3>
              <button 
                onClick={() => setRejectModalUser(null)} 
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Please provide an optional reason for rejecting this account. The user will be notified upon login attempt.
              </p>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason (Optional)</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('admin.rejectReasonPlaceholder') || 'Reason for rejection (optional)'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setRejectModalUser(null)} 
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleRejectConfirm} 
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Block / Unblock */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className={`p-2 rounded-xl ${confirmModal.type === 'block' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {confirmModal.type === 'block' ? (t('admin.confirmBlockTitle') || 'Block Account') : 'Unblock Account'}
                </h3>
                <span className="text-xs text-slate-500">{confirmModal.targetUser.name} ({confirmModal.targetUser.role})</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.type === 'block' 
                ? (t('admin.confirmBlockMsg') || 'Are you sure you want to block this user? They will not be able to log in or use the platform.')
                : (t('admin.confirmUnblockMsg') || 'Are you sure you want to unblock this user?')}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setConfirmModal(null)} 
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleBlockUnblockConfirm} 
                className={`px-4 py-2 rounded-xl font-bold text-xs text-white ${
                  confirmModal.type === 'block' 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmModal.type === 'block' ? 'Block Account' : 'Unblock Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Users Confirmation Modal */}
      {bulkDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border-2 border-rose-300">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isHi ? `${bulkDeleteModal.ids.length} उपयोगकर्ताओं को स्थायी रूप से हटाएं?` : `Permanently Delete ${bulkDeleteModal.ids.length} Users?`}
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {isHi ? 'बल्क विलोपन (Bulk Removal)' : 'Bulk Account Deletion'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isHi
                ? `क्या आप वाकई चयनित ${bulkDeleteModal.ids.length} खातों को स्थायी रूप से हटाना चाहते हैं? उनकी सभी संबंधित लिस्टिंग, आवश्यकताएं, सौदे और सूचनाएं तुरंत हटा दी जाएंगी।`
                : `Are you sure you want to permanently delete all ${bulkDeleteModal.ids.length} selected accounts? All associated listings, buyer requirements, deals, and records will be deleted immediately.`}
            </p>

            {/* List preview of selected accounts */}
            <div className="max-h-48 overflow-y-auto rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 divide-y divide-slate-100">
              {(bulkDeleteModal.source === 'pending' ? pendingApprovals : usersList)
                .filter(u => bulkDeleteModal.ids.includes(u.id))
                .map(u => (
                  <div key={u.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{u.name || 'Unnamed'}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{u.phone || u.email || '—'}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {u.role}
                    </span>
                  </div>
                ))}
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-[11px] font-bold text-rose-800">
              ⚠️ {isHi ? 'यह कार्रवाई पूर्ववत नहीं की जा सकती (Irreversible Action)।' : 'This action is irreversible and recorded in the audit trail.'}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button 
                type="button" 
                disabled={bulkLoading}
                onClick={() => setBulkDeleteModal({ isOpen: false, ids: [], source: 'users' })} 
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </button>
              <button 
                type="button" 
                disabled={bulkLoading}
                onClick={handleExecuteBulkDelete} 
                className="px-4 py-2 rounded-xl font-black text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{bulkLoading ? (isHi ? 'हटाया जा रहा है...' : 'Deleting...') : (isHi ? `पुष्टि करें (हटाएं ${bulkDeleteModal.ids.length})` : `Confirm Delete (${bulkDeleteModal.ids.length})`)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove / Delete User Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border-2 border-rose-300">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isHi ? 'उपयोगकर्ता स्थायी रूप से हटाएं?' : 'Permanently Remove User?'}
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {deleteConfirmUser.name || 'Unnamed'} ({deleteConfirmUser.role})
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isHi
                ? `क्या आप वाकई "${deleteConfirmUser.name || 'इस खाते'}" (${deleteConfirmUser.role}) को स्थायी रूप से हटाना चाहते हैं? उनकी सभी सक्रिय लिस्टिंग/मांग रद्द हो जाएंगी और उनका खाता हमेशा के लिए समाप्त हो जाएगा।`
                : `Are you sure you want to permanently remove "${deleteConfirmUser.name || 'this account'}" (${deleteConfirmUser.role})? This will cancel their active listings/requirements and revoke all access immediately.`}
            </p>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-[11px] font-bold text-rose-800">
              ⚠️ {isHi ? 'यह कार्रवाई पूर्ववत नहीं की जा सकती (Cannot be undone)।' : 'This action is irreversible and recorded in the audit trail.'}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button 
                type="button" 
                disabled={deleting}
                onClick={() => setDeleteConfirmUser(null)} 
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </button>
              <button 
                type="button" 
                disabled={deleting}
                onClick={handleDeleteUserConfirm} 
                className="px-4 py-2 rounded-xl font-black text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deleting ? (isHi ? 'हटाया जा रहा है...' : 'Removing...') : (isHi ? 'पुष्टि करें (हटाएं)' : 'Confirm Remove')}</span>
              </button>
            </div>
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
