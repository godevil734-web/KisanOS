import React from 'react';
import { AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const PendingApprovalBanner: React.FC = () => {
  const { language } = useLanguage();
  const isHindi = language === 'hi';

  return (
    <div 
      id="pending-approval-banner" 
      className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-900 shadow-xs"
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded">
                {isHindi ? 'मंज़ूरी लंबित' : 'Pending Verification'}
              </span>
              <p className="text-xs sm:text-sm font-semibold text-amber-950">
                {isHindi
                  ? 'खाता व्यवस्थापक की मंज़ूरी के लिए लंबित है। आप ब्राउज़ कर सकते हैं, लेकिन सत्यापित होने तक बैच नहीं बना सकते या ऑफ़र नहीं दे सकते।'
                  : 'Account pending admin approval. You can browse, but cannot create batches / make offers until verified.'}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center text-xs font-medium text-amber-800 bg-amber-100/70 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-700" />
          {isHindi ? 'केवल देखने की अनुमति' : 'Read-only access'}
        </div>
      </div>
    </div>
  );
};
