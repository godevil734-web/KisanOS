import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Bell, Check, X, Sparkles, Layers, Truck, Warehouse } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead } = useAuth();
  const { t } = useLanguage();

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'MATCH':
        return <Sparkles className="h-4 w-4 text-emerald-600" />;
      case 'BATCH':
        return <Layers className="h-4 w-4 text-amber-600" />;
      case 'STORAGE':
        return <Warehouse className="h-4 w-4 text-cyan-600" />;
      case 'ORDER':
        return <Truck className="h-4 w-4 text-blue-600" />;
      default:
        return <Bell className="h-4 w-4 text-stone-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white text-stone-800 h-full shadow-2xl flex flex-col transform transition-all duration-300 border-l border-stone-200">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-stone-800 text-base">{t('notifications.title')}</h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              {notifications.length}
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Bell className="h-10 w-10 mx-auto text-stone-300 mb-2 stroke-1" />
              <p className="text-sm font-medium">{t('notifications.emptyTitle')}</p>
              <p className="text-xs text-stone-500 mt-1">{t('notifications.emptySubtitle')}</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  n.read
                    ? 'bg-white border-stone-200 opacity-75'
                    : 'bg-emerald-50/50 border-emerald-200 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-white border border-stone-200 shadow-2xs mt-0.5">
                      {getIcon(n.type)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{n.title}</h4>
                      <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-stone-400 mt-1 inline-block">
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className="p-1 rounded text-emerald-700 hover:bg-emerald-100 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-stone-200 bg-stone-50 text-center">
          <p className="text-[11px] text-stone-500">
            KisanConnect automated supply chain notification bus
          </p>
        </div>
      </div>
    </div>
  );
};
