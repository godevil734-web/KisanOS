import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  
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
      } else if (pathname === '/dashboard') {
        navigate('/login?next=/dashboard');
      } else if (pathname === '/aggregator') {
        navigate('/login?next=/aggregator');
      } else if (pathname === '/dealer') {
        navigate('/login?next=/dealer');
      } else if (pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/')) {
        navigate('/admin-login');
      }
    } else if (!loading && user) {
      // Non-admin attempting to access admin routes
      if ((pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/')) && user.role !== 'admin') {
        if (user.role === 'farmer') navigate('/dashboard');
        else if (user.role === 'aggregator') navigate('/aggregator');
        else if (user.role === 'buyer' || user.role === 'dealer') navigate('/buyer');
        else navigate('/');
      }
    }
  }, [loading, user, pathname]);

  // Unified Role Selection & Authentication Gateway States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'aggregator' | 'buyer'>('farmer');

  // Triggered by "Get Started →"
  const handleOpenGetStarted = (preferredRole?: 'farmer' | 'aggregator' | 'buyer') => {
    if (!user) {
      navigate('/signup');
      return;
    }
    if (preferredRole) {
      setSelectedRole(preferredRole);
      setIsRoleModalOpen(false);
      setIsAuthModalOpen(true);
    } else {
      setIsRoleModalOpen(true);
      setIsAuthModalOpen(false);
    }
  };

  // Derive currentTab from pathname
  let currentTab = 'landing';
  if (pathname === '/login') currentTab = 'login';
  else if (pathname === '/admin-login') currentTab = 'admin-login';
  else if (pathname === '/signup') currentTab = 'signup';
  else if (pathname === '/list-crop' || pathname === '/farmer' || pathname === '/dashboard') currentTab = 'farmer';
  else if (pathname === '/aggregator') currentTab = 'aggregator';
  else if (pathname === '/buyer' || pathname === '/dealer') currentTab = 'buyer';
  else if (pathname === '/storage') currentTab = 'storage';
  else if (pathname === '/transport') currentTab = 'transport';
  else if (pathname === '/intelligence') currentTab = 'intelligence';
  else if (pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/')) currentTab = 'admin';
  else if (pathname === '/how-it-works') currentTab = 'how-it-works';
  else currentTab = 'landing';

  const handleSetCurrentTab = (tab: string) => {
    if (tab === 'landing') navigate('/');
    else navigate(`/${tab}`);
  };

  const isPublicView = pathname === '/' || pathname === '/how-it-works' || pathname === '/login' || pathname === '/signup' || pathname === '/admin-login';
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/admin-login';

  return (
    <div className={`min-h-screen flex flex-col bg-[#F7F5EF] font-sans text-[#26332C] overflow-x-hidden ${isAuthPage ? 'watermark-farm-landscape' : 'watermark-india-map'}`}>
      {/* Demo Mode Global Banner */}
      <DemoBanner />

      {/* Navigation Header */}
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={handleSetCurrentTab}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenGetStarted={handleOpenGetStarted}
        onNavigate={navigate}
      />

      {/* Pending Account Notice Banner */}
      {user?.status === 'pending' && <PendingApprovalBanner />}

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${isPublicView ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
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
            {(pathname === '/list-crop' || pathname === '/dashboard' || pathname === '/farmer') && (
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
                <FarmerDashboard />
              )
            )}

            {pathname === '/aggregator' && (
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

            {(pathname === '/buyer' || pathname === '/dealer') && (
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
            {(pathname === '/admin' || pathname === '/admin-dashboard' || pathname.startsWith('/admin/')) && (
              user && user.role === 'admin' ? (
                <AdminDashboard />
              ) : (
                <AdminLoginPage 
                  onSuccess={(target) => navigate(target)} 
                  onNavigate={navigate} 
                />
              )
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

      {/* Floating On-Demand Kisan Saathi AI Farmer Assistant */}
      <KisanSaathiWidget 
        onNavigateTab={(tab) => {
          if (user?.role === 'farmer') {
            handleSetCurrentTab(tab);
          } else {
            navigate(`/${tab}`);
          }
        }} 
      />

      {/* Footer */}
      <Footer onSelectTab={handleSetCurrentTab} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
