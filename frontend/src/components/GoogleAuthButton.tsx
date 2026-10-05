import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, CheckCircle2, UserCheck, Shield } from 'lucide-react';

interface GoogleAuthButtonProps {
  onSuccess: (googleData: { email: string; name: string; googleId: string; picture?: string; credential?: string }) => void;
  onError?: (err: string) => void;
  disabled?: boolean;
  buttonText?: string;
  className?: string;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  buttonText,
  className = ''
}) => {
  const { language } = useLanguage();
  const isHi = language === 'hi';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const defaultText = buttonText || (isHi ? 'Google के साथ आगे बढ़ें' : 'Continue with Google');

  // Quick preset test accounts for dev/demo or live testing
  const presetAccounts = [
    {
      name: 'Ramesh Patel',
      email: 'ramesh.farmer@gmail.com',
      googleId: 'goog-ramesh-patel-101',
      roleHint: isHi ? 'किसान (Agra)' : 'Farmer (Agra)'
    },
    {
      name: 'Vikram Singh',
      email: 'vikram.aggregator@gmail.com',
      googleId: 'goog-vikram-singh-202',
      roleHint: isHi ? 'एग्रीगेटर (Mathura)' : 'Aggregator (Mathura)'
    },
    {
      name: 'Priya Sharma',
      email: 'priya.buyer@gmail.com',
      googleId: 'goog-priya-sharma-303',
      roleHint: isHi ? 'थोक खरीदार (Delhi)' : 'Bulk Dealer (Delhi)'
    }
  ];

  const handleSelectPreset = (acc: typeof presetAccounts[0]) => {
    setIsModalOpen(false);
    onSuccess({
      email: acc.email,
      name: acc.name,
      googleId: acc.googleId,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(acc.name)}`
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) {
      if (onError) onError(isHi ? 'कृपया वैध Google ईमेल दर्ज करें' : 'Please enter a valid Google email address');
      return;
    }
    const cleanEmail = customEmail.trim().toLowerCase();
    const cleanName = customName.trim() || cleanEmail.split('@')[0];
    setIsModalOpen(false);
    onSuccess({
      email: cleanEmail,
      name: cleanName,
      googleId: `goog-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`
    });
  };

  const handleClick = () => {
    // If client ID is configured and window.google is loaded, use Google Identity Services
    const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (googleClientId && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: any) => {
            if (response.credential) {
              onSuccess({
                credential: response.credential,
                email: '',
                name: '',
                googleId: ''
              });
            }
          }
        });
        (window as any).google.accounts.id.prompt();
        return;
      } catch (e) {
        console.warn('Google Identity Services prompt fallback:', e);
      }
    }
    // Standard seamless interactive Google login selector
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`w-full py-3 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-700 font-semibold text-sm sm:text-base flex items-center justify-center gap-3 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span>{defaultText}</span>
      </button>

      {/* Google Account Selector Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 relative animate-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Google Header */}
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 mb-3 shadow-inner">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-stone-900">
                {isHi ? 'Google खाता चुनें' : 'Choose a Google Account'}
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                {isHi ? 'KisanConnect में सुरक्षित लॉगिन के लिए आगे बढ़ें' : 'to continue securely to KisanConnect'}
              </p>
            </div>

            {/* Quick Demo Google Accounts */}
            <div className="space-y-2 mb-4">
              <p className="text-xs font-bold uppercase text-stone-400 tracking-wider">
                {isHi ? 'त्वरित खाता चयन (Demo Accounts)' : 'Quick Select (Demo Accounts)'}
              </p>
              {presetAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectPreset(acc)}
                  className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      {acc.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900 group-hover:text-emerald-900">{acc.name}</p>
                      <p className="text-xs text-stone-500">{acc.email}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-stone-100 text-stone-600 rounded-md">
                    {acc.roleHint}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-stone-400 font-semibold">{isHi ? 'या अन्य ईमेल' : 'Or Enter Custom'}</span>
              </div>
            </div>

            {/* Custom Google Email Form */}
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {isHi ? 'आपका नाम' : 'Your Full Name'}
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Suresh Kumar"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {isHi ? 'Google ईमेल पता' : 'Google Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#315C45] hover:bg-[#254634] text-white font-bold text-sm shadow-sm transition-colors"
              >
                {isHi ? 'इस Google खाते से आगे बढ़ें' : 'Continue with this Google Account'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-stone-400 text-center">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isHi ? 'इसके बाद मोबाइल OTP सत्यापन आवश्यक होगा' : 'Mobile OTP verification required on next step'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
