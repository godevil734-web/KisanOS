import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardAppearanceProvider, useDashboardAppearance } from './context/DashboardAppearanceContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LoginPage } from './components/LoginPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { SignUpPage } from './components/SignUpPage';
import { NotificationModal } from './components/NotificationModal';
import { RoleSelectModal } from './components/RoleSelectModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { HowItWorksPage } from './components/HowItWorksPage';
import { FarmerDashboard } from './components/FarmerDashboard';
import { AggregatorDashboard } from './components/AggregatorDashboard';
import { BuyerDashboard } from './components/BuyerDashboard';
import { ColdStorageDashboard } from './components/ColdStorageDashboard';
import { TransporterDashboard } from './components/TransporterDashboard';
import { MarketIntelligenceDashboard } from './components/MarketIntelligenceDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { LanguageGateModal } from './components/LanguageGateModal';
import { PendingApprovalBanner } from './components/PendingApprovalBanner';
import { DemoBanner } from './components/DemoBanner';
import { KisanSaathiWidget } from './components/KisanSaathiWidget';
import { FarmerProfilePage } from './components/FarmerProfilePage';
import { QuickTourModal } from './components/QuickTourModal';
import { FarmerDashboardPreview } from './components/FarmerDashboardPreview';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { appearance, refreshAppearance } = useDashboardAppearance();
  
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname + window.location.search;
    }
    return '/';
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Parse path and next query parameter
  const [pathnamePart, searchPart] = currentPath.split('?');
  const pathname = pathnamePart || '/';
  const searchParams = new URLSearchParams(searchPart || '');
  const nextParam = searchParams.get('next') || undefined;

  // Protected route redirects
  useEffect(() => {
    if (!loading && !user) {
      if (pathname === '/list-crop') {
        navigate('/login?next=/list-crop');
      } else if (pathname === '/dashboard' || pathname === '/profile' || pathname === '/passport' || pathname === '/fields' || pathname === '/crops' || pathname === '/sales' || pathname === '/kisan-points') {
        navigate(`/login?next=${pathname}`);
      } else if (pathname === '/aggregator') {
        navigate('/login?next=/aggregator');
      } else if (pathname === '/dealer') {
        navigate('/login?next=/dealer');
      } else if (pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/') || pathname === '/admin-appearance') {
        navigate('/admin-login');
      }
    } else if (!loading && user) {
      // Non-admin attempting to access admin routes
      if ((pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/') || pathname === '/admin-appearance') && user.role !== 'admin') {
        if (user.role === 'farmer') navigate('/dashboard');
        else if (user.role === 'aggregator') navigate('/aggregator');
        else if (user.role === 'buyer' || user.role === 'dealer') navigate('/buyer');
        else navigate('/');
      }
    }
  }, [loading, user, pathname]);

  // Redirect legacy /dashboard?tab=profile queries to standalone /profile page
  useEffect(() => {
    if (pathname === '/dashboard') {
      const tab = searchParams.get('tab');
      if (tab === 'profile' || tab === 'passport' || tab === 'activities' || tab === 'fields' || tab === 'crops' || tab === 'sales' || tab === 'points') {
        const sub = searchParams.get('subtab') || (tab === 'activities' ? 'passport' : tab === 'profile' ? 'overview' : tab);
        navigate(`/profile?subtab=${sub}`);
      }
    }
  }, [pathname, searchParams]);

  // Always ensure fresh active appearance setting from server when entering farmer routes
  useEffect(() => {
    if (pathname === '/dashboard' || pathname === '/farmer' || pathname === '/list-crop') {
      refreshAppearance();
    }
  }, [pathname, refreshAppearance]);

  // Unified Role Selection & Authentication Gateway States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'aggregator' | 'buyer'>('farmer');

  // Quick Tour Modal State
  const [isTourModalOpen, setIsTourModalOpen] = useState<boolean>(false);

  // Triggered by "Get Started →" or tour button
  const handleOpenGetStarted = (preferredRole?: 'farmer' | 'aggregator' | 'buyer') => {
    if (!user) {
      if (preferredRole) {
        setSelectedRole(preferredRole);
        setIsRoleModalOpen(false);
        setIsAuthModalOpen(true);
      } else {
        navigate('/signup');
      }
      return;
    }
    // Authenticated users never get prompted for login!
    setIsTourModalOpen(true);
  };

  // Grouped route definitions to prevent blank pages
  const isFarmerProfileRoute = pathname === '/profile' || pathname === '/passport' || pathname === '/fields' ||
    pathname === '/crops' || pathname === '/sales' || pathname === '/kisan-points';

  const isFarmerRoute = pathname === '/list-crop' || pathname === '/farmer' || pathname === '/dashboard' ||
    pathname === '/buyers' || pathname === '/listings' || pathname === '/offers' ||
    pathname === '/orders' || pathname === '/deals' || pathname === '/aggregator-info' || pathname === '/storage-farmer';

  const isPreviewRoute = pathname === '/preview-dashboard' || pathname === '/dashboard-preview' || pathname === '/preview-farmer-dashboard';

  const isAggregatorRoute = pathname === '/aggregator' || pathname === '/demand' || pathname === '/supply' ||
    pathname === '/procurement' || pathname === '/aggregation' || pathname === '/batches' || pathname === '/logistics' ||
    pathname === '/transactions';

  const isBuyerRoute = pathname === '/buyer' || pathname === '/dealer' || pathname === '/buyer-requirements' ||
    pathname === '/supply-discovery' || pathname === '/buyer-offers';

  // Derive currentTab from pathname
  let currentTab = 'landing';
  if (pathname === '/login') currentTab = 'login';
  else if (pathname === '/admin-login') currentTab = 'admin-login';
  else if (pathname === '/signup') currentTab = 'signup';
  else if (isFarmerProfileRoute || isFarmerRoute) currentTab = 'farmer';
  else if (isAggregatorRoute) currentTab = 'aggregator';
  else if (isBuyerRoute) currentTab = 'buyer';
  else if (pathname === '/storage') currentTab = 'storage';
  else if (pathname === '/transport') currentTab = 'transport';
  else if (pathname === '/intelligence') currentTab = 'intelligence';
  else if (pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/') || pathname === '/admin-appearance') currentTab = 'admin';
  else if (pathname === '/how-it-works') currentTab = 'how-it-works';
  else currentTab = 'landing';

  const handleSetCurrentTab = (tab: string) => {
    if (tab === 'landing') navigate('/');
    else if (tab === 'farmer') navigate('/dashboard');
    else if (tab === 'aggregator') navigate('/aggregator');
    else if (tab === 'buyer') navigate('/buyer');
    else navigate(`/${tab}`);
  };

  const isPublicView = pathname === '/' || pathname === '/how-it-works' || pathname === '/login' || pathname === '/signup' || pathname === '/admin-login';
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/admin-login';
  const isLegacyFarmer = isFarmerRoute && searchParams.get('legacy') === 'true';

  // Appearance theme routing: determine whether harvest theme is active in production or preview
  const isHarvestTheme = 
    appearance?.activeDesignId === 'harvest_standard' || 
    appearance?.activeDesignId === 'harvest_canvas' || 
    appearance?.theme === 'harvest_premium' ||
    appearance?.theme === 'harvest_canvas';
  const isHarvestProductionActive = isFarmerRoute && !isLegacyFarmer && isHarvestTheme;
  const isFullScreenView = isPreviewRoute || isHarvestProductionActive;
  const previewDesignParam = searchParams.get('design') || 'harvest_standard';

  return (
    <div className={`font-sans ${
      isFullScreenView
        ? 'h-screen h-[100dvh] overflow-hidden flex flex-col bg-[#F7F4E9] text-[#17251D]' 
        : `min-h-screen flex flex-col overflow-x-hidden bg-[#F7F5EF] text-[#26332C] ${isAuthPage ? 'watermark-farm-landscape' : 'watermark-india-map'}`
    }`}>
      {/* Demo Mode Global Banner */}
      {!isFullScreenView && <DemoBanner />}

      {/* Navigation Header */}
      {!isFarmerProfileRoute && !isFullScreenView && (
        <Navbar 
          currentTab={currentTab} 
          setCurrentTab={handleSetCurrentTab}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenGetStarted={handleOpenGetStarted}
          onNavigate={navigate}
        />
      )}

      {/* Pending Account Notice Banner */}
      {user?.status === 'pending' && <PendingApprovalBanner />}

      {/* Main Content Area */}
      <main className={`w-full relative z-10 ${
        isFullScreenView
          ? 'w-full flex-1 h-full overflow-hidden' 
          : isPublicView 
            ? 'flex-1' 
            : 'flex-1 w-full max-w-[1920px] 2xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-5 sm:py-7'
      }`}>
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#315C45] border-r-transparent" />
            <p className="mt-3 text-xs font-bold text-stone-500 uppercase tracking-wider">
              {t('common.connecting')}
            </p>
          </div>
        ) : (
          <>
            {pathname === '/login' && (
              <LoginPage 
                next={nextParam} 
                onSuccess={(target) => navigate(target)} 
                onNavigate={navigate} 
              />
            )}
            {pathname === '/admin-login' && (
              <AdminLoginPage 
                onSuccess={(target) => navigate(target)} 
                onNavigate={navigate} 
              />
            )}
            {pathname === '/signup' && (
              <SignUpPage 
                onSuccess={(target) => navigate(target)} 
                onNavigate={navigate} 
              />
            )}
            {pathname === '/' && (
              <LandingPage 
                onSelectTab={handleSetCurrentTab} 
                onOpenGetStarted={handleOpenGetStarted} 
                onNavigate={navigate}
              />
            )}
            {pathname === '/how-it-works' && (
              <HowItWorksPage 
                onSelectTab={handleSetCurrentTab}
                onOpenGetStarted={handleOpenGetStarted}
              />
            )}
            {isFarmerProfileRoute && (
              user && user.role !== 'farmer' && user.role !== 'admin' ? (
                <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border-2 border-amber-200 p-8 shadow-xs text-center space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl">
                    🌾
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                      किसान पोर्टल • Farmer Portal Only
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 mt-3">
                      किसान प्रोफाइल व पासपोर्ट (Farmer Profile & Passport)
                    </h2>
                    <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
                      आप वर्तमान में <strong>{user.name} ({user.role === 'buyer' || user.role === 'dealer' ? 'थोक खरीदार / Buyer' : user.role})</strong> के रूप में लॉगिन हैं। यह अनुभाग केवल पंजीकृत किसानों के लिए है।
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => navigate(user.role === 'aggregator' ? '/aggregator' : '/buyer')}
                      className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-sm shadow-xs transition-colors cursor-pointer"
                    >
                      {user.role === 'aggregator' ? '📦 एग्रीगेटर पोर्टल पर जाएं' : '🏢 अपने खरीदार पोर्टल पर जाएं'}
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                    >
                      होम पेज (Home)
                    </button>
                  </div>
                </div>
              ) : (
                <FarmerProfilePage onNavigate={navigate} />
              )
            )}

            {isFarmerRoute && (
              user && user.role !== 'farmer' && user.role !== 'admin' ? (
                <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border-2 border-amber-200 p-8 shadow-xs text-center space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl">
                    🌾
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                      किसान पोर्टल • Farmer Portal Only
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 mt-3">
                      किसान डैशबोर्ड (Farmer Dashboard)
                    </h2>
                    <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
                      आप वर्तमान में <strong>{user.name} ({user.role === 'buyer' || user.role === 'dealer' ? 'थोक खरीदार / Buyer' : user.role})</strong> के रूप में लॉगिन हैं। यह अनुभाग केवल पंजीकृत किसानों के लिए है।
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => navigate(user.role === 'aggregator' ? '/aggregator' : '/buyer')}
                      className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-sm shadow-xs transition-colors cursor-pointer"
                    >
                      {user.role === 'aggregator' ? '📦 एग्रीगेटर पोर्टल पर जाएं' : '🏢 अपने खरीदार पोर्टल पर जाएं'}
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                    >
                      होम पेज (Home)
                    </button>
                  </div>
                </div>
              ) : (
                isHarvestProductionActive ? (
                  <FarmerDashboardPreview 
                    onNavigate={navigate} 
                    onOpenNotifications={() => setIsNotificationsOpen(true)} 
                    isProductionMode={true} 
                    designVariant={appearance?.activeDesignId}
                  />
                ) : (
                  <FarmerDashboard 
                    onNavigate={navigate} 
                    onOpenNotifications={() => setIsNotificationsOpen(true)} 
                  />
                )
              )
            )}

            {isPreviewRoute && (
              previewDesignParam === 'classic_standard' ? (
                <div className="space-y-4 max-w-[1920px] mx-auto py-2">
                  <div className="bg-[#104B35] text-white px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold border border-[#37A86B]/30 shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-[#E6A52E] text-[#17251D] text-[10px] font-black uppercase tracking-wider">
                        PREVIEW MODE
                      </span>
                      <span className="font-extrabold text-sm">Classic — Original Dashboard</span>
                      <span className="text-[#37A86B] font-medium hidden sm:inline">
                        ({appearance?.activeDesignId === 'classic_standard' ? 'Currently Active in Production' : 'Preview Only • Not Active'})
                      </span>
                    </div>
                    <button
                      onClick={() => navigate('/admin?tab=appearance')}
                      className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#E8F1E5] text-[#104B35] font-black text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      ← Return to Appearance Manager
                    </button>
                  </div>
                  <FarmerDashboard onNavigate={navigate} onOpenNotifications={() => setIsNotificationsOpen(true)} />
                </div>
              ) : (
                <FarmerDashboardPreview 
                  onNavigate={navigate} 
                  onOpenNotifications={() => setIsNotificationsOpen(true)} 
                  isPreviewMode={true}
                  designVariant={previewDesignParam}
                  returnUrl={searchParams.get('from') === 'admin' ? '/admin?tab=appearance' : '/admin?tab=appearance'}
                  returnLabel="Return to Appearance Manager"
                />
              )
            )}

            {isAggregatorRoute && (
              user && user.role !== 'aggregator' && user.role !== 'admin' ? (
                <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border-2 border-amber-200 p-8 shadow-xs text-center space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-3xl">
                    📦
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                      पहुंच प्रतिबंधित • Aggregator Hub Only
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 mt-3">
                      संग्राहक हब (Aggregator Hub)
                    </h2>
                    <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
                      आप <strong>{user.name} ({user.role === 'farmer' ? 'किसान / Farmer' : user.role})</strong> के रूप में लॉगिन हैं। यह पोर्टल केवल स्थानीय संग्रहकर्ताओं व FPO ऑपरेटरों के लिए आरक्षित है।
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => navigate(user.role === 'farmer' ? '/dashboard' : '/buyer')}
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-xs transition-colors cursor-pointer"
                    >
                      {user.role === 'farmer' ? '🌾 अपने किसान डैशबोर्ड पर जाएं' : '🏢 खरीदार पोर्टल पर जाएं'}
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                    >
                      होम पेज (Home)
                    </button>
                  </div>
                </div>
              ) : (
                <AggregatorDashboard />
              )
            )}

            {isBuyerRoute && (
              user && user.role !== 'buyer' && user.role !== 'dealer' && user.role !== 'admin' ? (
                <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border-2 border-rose-200 p-8 shadow-xs text-center space-y-4 animate-fadeIn">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-3xl">
                    🚫
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                      पहुंच प्रतिबंधित • Access Restricted
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 mt-3">
                      थोक खरीदार पोर्टल (Buyer Portal)
                    </h2>
                    <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
                      आप वर्तमान में <strong>{user.name} ({user.role === 'farmer' ? 'किसान / Farmer' : user.role})</strong> के रूप में लॉगिन हैं। थोक खरीदार व डीलर पोर्टल केवल सत्यापित खरीदारों और खाद्य प्रसंस्करण कंपनियों के लिए उपलब्ध है।
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>🌾 अपने किसान डैशबोर्ड पर जाएं (Go to Farmer Dashboard)</span>
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                    >
                      होम पेज (Home)
                    </button>
                  </div>
                </div>
              ) : (
                <BuyerDashboard />
              )
            )}
            {pathname === '/storage' && <ColdStorageDashboard />}
            {pathname === '/transport' && <TransporterDashboard />}
            {pathname === '/intelligence' && <MarketIntelligenceDashboard />}
            {(pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/') || pathname === '/admin-appearance') && (
              user && user.role === 'admin' ? (
                <AdminDashboard onNavigate={navigate} />
              ) : (
                <AdminLoginPage 
                  onSuccess={(target) => navigate(target)} 
                  onNavigate={navigate} 
                />
              )
            )}
            {/* Fallback to prevent black/blank screens on any unmatched route */}
            {!isFarmerProfileRoute && !isFarmerRoute && !isPreviewRoute && !isAggregatorRoute && !isBuyerRoute && 
             pathname !== '/storage' && pathname !== '/transport' && pathname !== '/intelligence' && 
             !pathname.startsWith('/admin') && pathname !== '/admin-appearance' && pathname !== '/how-it-works' && 
             pathname !== '/login' && pathname !== '/signup' && pathname !== '/admin-login' && pathname !== '/' && (
              <LandingPage 
                onSelectTab={handleSetCurrentTab} 
                onOpenGetStarted={handleOpenGetStarted} 
                onNavigate={navigate}
              />
            )}
          </>
        )}
      </main>

      {/* Step 1: Role Selection Modal (Fallback) */}
      <RoleSelectModal 
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSelectRole={(r) => {
          setSelectedRole(r);
          setIsRoleModalOpen(false);
          setIsAuthModalOpen(true);
        }}
        initialRole={selectedRole}
      />

      {/* Step 2: Unified Authentication Modal (Fallback) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        selectedRole={selectedRole}
        onSwitchRole={() => {
          setIsAuthModalOpen(false);
          setIsRoleModalOpen(true);
        }}
        onAuthSuccess={(r) => {
          setIsAuthModalOpen(false);
          setIsRoleModalOpen(false);
          navigate(`/${r}`);
        }}
      />

      {/* Notification Modal Drawer */}
      <NotificationModal 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
      />

      {/* First-Visit Full-Screen Language Gate Picker */}
      <LanguageGateModal />

      {/* Floating On-Demand Role-Aware Kisan Saathi AI Assistant (Only on non-farmer routes, farmer dashboard has it built into sidebar) */}
      {!isFarmerRoute && !isPreviewRoute && (
        <KisanSaathiWidget 
          onNavigateTab={(tab, payload) => {
            const uRole = user?.role || 'farmer';
            if (uRole === 'farmer') {
              if (pathname !== '/dashboard' && pathname !== '/farmer') {
                navigate('/dashboard?tab=' + tab);
              }
              window.dispatchEvent(new CustomEvent('farmer-navigate-tab', { detail: { tab, ...payload } }));
            } else if (uRole === 'aggregator') {
              if (pathname !== '/aggregator') {
                navigate('/aggregator?tab=' + tab);
              }
              window.dispatchEvent(new CustomEvent('aggregator-navigate-tab', { detail: { tab, ...payload } }));
            } else if (uRole === 'buyer' || uRole === 'dealer') {
              if (pathname !== '/buyer' && pathname !== '/dealer') {
                navigate('/buyer?tab=' + tab);
              }
              window.dispatchEvent(new CustomEvent('buyer-navigate-tab', { detail: { tab, ...payload } }));
            } else {
              navigate('/' + tab);
            }
          }} 
        />
      )}

      {/* Layout-Specific Footer Rendering:
          - Public Landing Layout (/): Agricultural Landscape Banner + Full Marketing Footer
          - Public Informational (/how-it-works): Clean informational footer without repetitive banner
          - Authenticated Dashboards, Profile, and Focused Workflows (/list-crop, /dashboard, /profile, /aggregator, /buyer, /admin, etc.):
            Do NOT render the landing banner or marketing footer.
      */}
      {pathname === '/' && <Footer onSelectTab={handleSetCurrentTab} showLandscapeBanner={true} />}
      {pathname === '/how-it-works' && <Footer onSelectTab={handleSetCurrentTab} showLandscapeBanner={false} />}

      {/* Interactive Quick Tour Modal */}
      <QuickTourModal 
        isOpen={isTourModalOpen} 
        onClose={() => setIsTourModalOpen(false)} 
        onNavigate={navigate} 
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <DashboardAppearanceProvider>
          <MainApp />
        </DashboardAppearanceProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
