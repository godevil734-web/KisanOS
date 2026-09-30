import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { NotificationModal } from './components/NotificationModal';
import { LandingPage } from './components/LandingPage';
import { FarmerDashboard } from './components/FarmerDashboard';
import { AggregatorDashboard } from './components/AggregatorDashboard';
import { BuyerDashboard } from './components/BuyerDashboard';
import { ColdStorageDashboard } from './components/ColdStorageDashboard';
import { TransporterDashboard } from './components/TransporterDashboard';
import { MarketIntelligenceDashboard } from './components/MarketIntelligenceDashboard';
import { AdminDashboard } from './components/AdminDashboard';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5] font-sans text-stone-800">
      {/* Navigation Header with Role Switcher */}
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${currentTab === 'landing' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-agri-600 border-r-transparent" />
            <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Connecting to KisanConnect Network...
            </p>
          </div>
        ) : (
          <>
            {currentTab === 'landing' && <LandingPage onSelectTab={setCurrentTab} />}
            {currentTab === 'farmer' && <FarmerDashboard />}
            {currentTab === 'aggregator' && <AggregatorDashboard />}
            {currentTab === 'buyer' && <BuyerDashboard />}
            {currentTab === 'storage' && <ColdStorageDashboard />}
            {currentTab === 'transport' && <TransporterDashboard />}
            {currentTab === 'intelligence' && <MarketIntelligenceDashboard />}
            {currentTab === 'admin' && <AdminDashboard />}
          </>
        )}
      </main>

      {/* Notification Modal Drawer */}
      <NotificationModal 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
      />

      {/* Footer */}
      <Footer onSelectTab={setCurrentTab} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
