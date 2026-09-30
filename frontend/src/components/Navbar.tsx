import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sprout, Menu, X, ArrowRight, LogIn, ArrowLeft } from 'lucide-react';
import { GetStartedModal } from './GetStartedModal';
import { LoginModal } from './LoginModal';
import { FarmerRegisterModal } from './FarmerRegisterModal';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenNotifications: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isGetStartedOpen, setIsGetStartedOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isFarmerRegisterOpen, setIsFarmerRegisterOpen] = useState(false);

  const handleScrollTo = (id: string) => {
    if (currentTab !== 'landing') {
      setCurrentTab('landing');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            
            {/* Brand Logo: KisanConnect */}
            <div 
              onClick={() => setCurrentTab('landing')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-tr from-emerald-800 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/10 group-hover:scale-105 transition-transform">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl sm:text-2xl font-black tracking-tight text-stone-900">
                    Kisan<span className="text-emerald-700">Connect</span>
                  </span>
                  <span className="text-[10px] uppercase font-black tracking-widest bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300">
                    AgriTech
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 hidden sm:block">From Farm to Market, Made Simple</p>
              </div>
            </div>

            {/* Desktop Navigation Links: How It Works | Farmers | Buyers */}
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => handleScrollTo('how-it-works')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                How It Works
              </button>

              <button
                onClick={() => handleScrollTo('for-farmers')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors flex items-center gap-1"
              >
                <span>Farmers</span>
                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">किसान</span>
              </button>

              <button
                onClick={() => handleScrollTo('for-buyers')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                Buyers
              </button>

              <button
                onClick={() => handleScrollTo('our-vision')}
                className="text-sm font-bold text-stone-600 hover:text-emerald-800 transition-colors"
              >
                Our Vision
              </button>
            </nav>

            {/* Right Action Buttons: Login & Start */}
            <div className="flex items-center gap-3">
              
              {/* Return to Landing if inside internal dashboard */}
              {currentTab !== 'landing' ? (
                <button
                  onClick={() => setCurrentTab('landing')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Public Home</span>
                </button>
              ) : null}

              {/* Login Button */}
              <button
                onClick={() => setIsLoginOpen(true)}
                className="text-xs sm:text-sm font-bold text-stone-700 hover:text-emerald-800 px-3.5 py-2 rounded-xl hover:bg-stone-100 transition-colors flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4 text-emerald-700" />
                <span>Login</span>
              </button>

              {/* Start Button */}
              <button
                onClick={() => setIsGetStartedOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-800/20 transition-all hover:scale-105 active:scale-95"
              >
                <span>Start</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Mobile Hamburger Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>

            </div>

          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-stone-200 px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-4 duration-200">
            <div className="space-y-1">
              <button
                onClick={() => handleScrollTo('how-it-works')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => handleScrollTo('for-farmers')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between"
              >
                <span>Farmers</span>
                <span className="text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold">🌾 किसान</span>
              </button>
              <button
                onClick={() => handleScrollTo('for-buyers')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between"
              >
                <span>Buyers</span>
                <span className="text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded font-bold">🏪 खरीदार</span>
              </button>
              <button
                onClick={() => handleScrollTo('our-vision')}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                Our Vision
              </button>
            </div>

            <div className="pt-2 border-t border-stone-200 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsGetStartedOpen(true);
                }}
                className="w-full py-3 rounded-xl bg-emerald-700 text-white font-black text-sm shadow-md flex items-center justify-center gap-2"
              >
                <span>Start (शुरू करें)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLoginOpen(true);
                }}
                className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-800 font-bold text-xs flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 text-emerald-700" />
                <span>Login (लॉगिन करें)</span>
              </button>
            </div>
          </div>
        )}

      </header>

      {/* 1. Get Started 2-Choice Modal */}
      <GetStartedModal 
        isOpen={isGetStartedOpen}
        onClose={() => setIsGetStartedOpen(false)}
        onSelectFarmer={() => setIsFarmerRegisterOpen(true)}
        onSelectBuyer={() => {
          setCurrentTab('buyer');
        }}
      />

      {/* 2. Login Modal */}
      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={(tab) => {
          setCurrentTab(tab);
        }}
        onSwitchToRegister={() => {
          setIsFarmerRegisterOpen(true);
        }}
      />

      {/* 3. Streamlined Farmer Registration Modal */}
      <FarmerRegisterModal 
        isOpen={isFarmerRegisterOpen}
        onClose={() => setIsFarmerRegisterOpen(false)}
        onSuccess={() => {
          setCurrentTab('farmer');
        }}
        onSwitchToLogin={() => {
          setIsLoginOpen(true);
        }}
      />
    </>
  );
};

export default Navbar;
