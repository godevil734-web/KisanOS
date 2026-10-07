import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Minus, 
  Trash2, 
  Send, 
  Sparkles, 
  ArrowRight, 
  Store,
  Sprout,
  Tag,
  Warehouse,
  Users,
  AlertCircle,
  CheckCircle2,
  MapPin,
  TrendingUp,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { KisanSaathiMessage, KisanSaathiAction } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface KisanSaathiWidgetProps {
  onNavigateTab?: (tab: string, payload?: any) => void;
  onNavigate?: (path: string, tab?: string, payload?: any) => void;
}

export const KisanSaathiWidget: React.FC<KisanSaathiWidgetProps> = ({ onNavigateTab, onNavigate }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isHi = language === 'hi' || language === 'hinglish';
  const role = (user?.role || 'farmer').toLowerCase();

  // Strictly on-demand: NEVER open automatically on load or dashboard entry
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // Generate role-specific initial actions
  const getInitialActions = (userRole: string): KisanSaathiAction[] => {
    if (userRole === 'aggregator') {
      return [
        { label: isHi ? 'Buyer Demand देखें' : 'Buyer Demand', actionType: 'navigate_demand', tab: 'demand' },
        { label: isHi ? 'Farmer Supply देखें' : 'Farmer Supply', actionType: 'navigate_supply', tab: 'supply' },
        { label: isHi ? 'Aggregation Batches' : 'Aggregation Batches', actionType: 'navigate_aggregation', tab: 'aggregation' },
        { label: isHi ? 'Procurement Plans' : 'Procurement Plans', actionType: 'navigate_procurement', tab: 'procurement' },
        { label: isHi ? 'Storage & Logistics' : 'Storage & Logistics', actionType: 'navigate_logistics', tab: 'logistics' },
        { label: isHi ? 'Transactions' : 'Transactions', actionType: 'navigate_transactions', tab: 'transactions' },
        { label: isHi ? 'कुछ और पूछें' : 'Ask Anything', actionType: 'custom_prompt' }
      ];
    }
    if (userRole === 'buyer' || userRole === 'dealer') {
      return [
        { label: isHi ? 'मेरी Requirements' : 'My Requirements', actionType: 'navigate_requirements', tab: 'requirements' },
        { label: isHi ? 'Farmers खोजें' : 'Find Farmers', actionType: 'navigate_supply_discovery', tab: 'supply_discovery' },
        { label: isHi ? 'Offers देखें' : 'View Offers', actionType: 'navigate_offers', tab: 'offers' },
        { label: isHi ? 'Negotiations' : 'Negotiations', actionType: 'navigate_offers', tab: 'offers' },
        { label: isHi ? 'Deals' : 'Deals', actionType: 'navigate_orders', tab: 'orders' },
        { label: isHi ? 'Procurement Status' : 'Procurement Status', actionType: 'procurement_status' },
        { label: isHi ? 'कुछ और पूछें' : 'Ask Anything', actionType: 'custom_prompt' }
      ];
    }
    // Farmer (Default)
    return [
      { label: isHi ? 'मेरे खरीदार देखें' : 'Find Buyers', actionType: 'farmer_find_buyers' },
      { label: isHi ? 'मेरी फसल देखें' : 'My Crops', actionType: 'navigate_crops', tab: 'listings' },
      { label: isHi ? 'मेरे ऑफर देखें' : 'My Offers', actionType: 'navigate_offers', tab: 'offers' },
      { label: isHi ? 'मेरे सौदे देखें' : 'My Deals', actionType: 'navigate_deals', tab: 'orders' },
      { label: isHi ? 'कोल्ड स्टोरेज देखें' : 'Cold Storage', actionType: 'navigate_storage', tab: 'storage' },
      { label: isHi ? 'कई किसानों के साथ बेचें' : 'Pool with Farmers', actionType: 'navigate_aggregator', tab: 'aggregator_info' },
      { label: isHi ? 'कुछ और पूछें' : 'Ask Anything', actionType: 'custom_prompt' }
    ];
  };

  // Generate role-specific initial greeting
  const getInitialGreeting = (userRole: string): string => {
    const name = user?.name ? ` ${user.name}` : '';
    if (userRole === 'aggregator') {
      return isHi
        ? `नमस्ते${name}! मैं Kisan Saathi हूँ, KisanConnect का AI सहायक।\n\nमैं खरीदार मांग (Demand), किसान आपूर्ति (Supply), एकत्रीकरण बैच और प्रोक्योरमेंट योजना में आपकी मदद कर सकता हूँ।`
        : `Hello${name}! I am Kisan Saathi, KisanConnect's AI Assistant.\n\nI can help you monitor buyer demand, assemble farmer supply batches, and structure procurement plans.`;
    }
    if (userRole === 'buyer' || userRole === 'dealer') {
      return isHi
        ? `नमस्ते${name}! मैं Kisan Saathi हूँ, KisanConnect का AI सहायक।\n\nमैं गुणवत्ता-सत्यापित किसानों से सीधी आपूर्ति खोजने, बोलियां लगाने, और खरीद पूरी करने में आपकी मदद कर सकता हूँ।`
        : `Hello${name}! I am Kisan Saathi, KisanConnect's AI Assistant.\n\nI can help you discover verified farmer supply lots, structure offers, and manage procurement fulfillment.`;
    }
    return isHi
      ? `नमस्ते${name}! मैं Kisan Saathi हूँ, KisanConnect का AI सहायक।\n\nमैं buyer खोजने, अपनी फसल बेचने, offers समझने और कोल्ड स्टोरेज में आपकी मदद कर सकता हूँ।`
      : `Hello${name}! I am Kisan Saathi, KisanConnect's AI Assistant.\n\nI can help you discover matching buyers, understand price offers, book cold storage, and navigate KisanConnect.`;
  };

  const [messages, setMessages] = useState<KisanSaathiMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: getInitialGreeting(role),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: getInitialActions(role)
    }
  ]);

  // Update initial message when user role changes
  useEffect(() => {
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        text: getInitialGreeting(role),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: getInitialActions(role)
      }
    ]);
  }, [user?.role, user?.name, isHi]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isLoading]);

  const handleActionClick = (action: KisanSaathiAction) => {
    if (action.actionType === 'custom_prompt') {
      inputRef.current?.focus();
      return;
    }

    if (action.actionType === 'farmer_find_buyers') {
      handleSendMessage('मेरे खरीदार देखें');
      return;
    }

    if (action.actionType === 'procurement_status') {
      handleSendMessage('Procurement Status');
      return;
    }

    if (action.actionType === 'select_crop') {
      const crop = action.payload?.cropName || action.label;
      handleSendMessage(crop);
      return;
    }

    if (action.actionType === 'show_nearest_buyers') {
      handleSendMessage('सबसे पास के खरीदार');
      return;
    }

    if (action.actionType === 'show_best_price_buyers') {
      handleSendMessage('सबसे अच्छे दाम');
      return;
    }

    if (action.actionType === 'filter_buyers') {
      if (action.payload?.filter === 'nearest') handleSendMessage('सबसे पास के खरीदार');
      else if (action.payload?.filter === 'price') handleSendMessage('सबसे अच्छे दाम');
      else if (action.payload?.filter === 'best_match') handleSendMessage('Best Match');
      return;
    }

    if (action.actionType === 'buyer_direct_farmers') {
      handleSendMessage('Direct Farmers');
      return;
    }

    // Role-safe navigation handler
    if (action.tab) {
      if (onNavigateTab) {
        onNavigateTab(action.tab, action.payload);
      }

      // Dispatch appropriate custom event
      if (role === 'farmer') {
        window.dispatchEvent(new CustomEvent('farmer-navigate-tab', { detail: { tab: action.tab, ...action.payload } }));
        if (action.actionType === 'make_offer' && action.payload?.requirementId) {
          window.dispatchEvent(new CustomEvent('farmer-open-offer-modal', { detail: action.payload }));
        }
      } else if (role === 'aggregator') {
        window.dispatchEvent(new CustomEvent('aggregator-navigate-tab', { detail: { tab: action.tab, ...action.payload } }));
      } else if (role === 'buyer' || role === 'dealer') {
        window.dispatchEvent(new CustomEvent('buyer-navigate-tab', { detail: { tab: action.tab, ...action.payload } }));
        if (action.actionType === 'make_offer' && action.payload?.listingId) {
          window.dispatchEvent(new CustomEvent('buyer-open-offer-modal', { detail: action.payload }));
        }
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: KisanSaathiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    setApiNotice(null);

    try {
      const historyPayload = messages.slice(-4).map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await api.sendKisanSaathiMessage({
        message: text,
        history: historyPayload
      });

      if (res.available === false && res.fallbackMessage) {
        setApiNotice(res.fallbackMessage);
      }

      const botMsg: KisanSaathiMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: res.reply || (isHi ? 'माफ़ कीजिए, मैं समझ नहीं पाया। कृपया दोबारा प्रयास करें।' : 'Sorry, could not process request. Please try again.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: res.actions || [],
        cards: res.cards || []
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      // Deterministic client-side fallback if server connection dropped
      const fallbackActions = getInitialActions(role);
      const fallbackMsg: KisanSaathiMessage = {
        id: `bot-fallback-${Date.now()}`,
        role: 'assistant',
        text: isHi 
          ? 'डेटा लोड नहीं हो पाया। आप सीधे नीचे दिए गए मुख्य विकल्पों से आगे बढ़ सकते हैं।' 
          : 'Data could not load. You can directly browse the primary options below.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: fallbackActions
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        text: getInitialGreeting(role),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: getInitialActions(role)
      }
    ]);
    setApiNotice(null);
  };

  return (
    <>
      {/* Floating Trigger Button: Role-Aware Kisan Saathi */}
      {!isOpen && (
        <button
          id="kisan-saathi-fab"
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          aria-label="Kisan Saathi AI Assistant"
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-full px-4 py-2.5 shadow-2xl hover:shadow-emerald-900/40 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-3 border-2 border-emerald-400/40 focus:outline-none focus:ring-4 focus:ring-emerald-400/30 group cursor-pointer"
        >
          <div className="relative flex items-center justify-center">
            <div className="h-7 w-7 rounded-full bg-emerald-700/80 flex items-center justify-center text-emerald-200 group-hover:scale-110 transition-transform">
              <Bot className="h-4 w-4 text-emerald-100" />
            </div>
            {/* Online Green Pulsing Indicator */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-emerald-950"></span>
            </span>
          </div>
          <div className="text-left">
            <div className="text-xs font-black tracking-wide text-white leading-tight flex items-center gap-1.5">
              <span>Kisan Saathi</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-mono font-bold">
                {role === 'aggregator' ? 'AGG' : role === 'buyer' || role === 'dealer' ? 'BUYER' : 'AI'}
              </span>
            </div>
            <div className="text-[10px] text-emerald-300/80 font-medium leading-none">
              {role === 'aggregator' 
                ? (isHi ? 'संग्राहक हब सहायक' : 'Aggregator Hub Assistant')
                : role === 'buyer' || role === 'dealer'
                ? (isHi ? 'थोक खरीद सहायक' : 'Procurement Assistant')
                : (isHi ? 'आपका KisanConnect सहायक' : 'Your Agri AI Partner')}
            </div>
          </div>
        </button>
      )}

      {/* Minimized Docked Tab */}
      {isOpen && isMinimized && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-900 text-white rounded-2xl px-4 py-3 shadow-2xl border border-emerald-500/30 flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
            <Bot className="h-5 w-5 text-emerald-300" />
            <div>
              <div className="text-xs font-black text-white">Kisan Saathi</div>
              <div className="text-[10px] text-emerald-300 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Online • {role.toUpperCase()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 border-l border-emerald-700 pl-2">
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 hover:bg-emerald-800 rounded text-emerald-200 transition-colors text-xs font-bold cursor-pointer"
              title="Expand"
            >
              {isHi ? 'खोलें' : 'Open'}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-emerald-800 rounded text-emerald-300 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Kisan Saathi Conversational Drawer / Modal */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-4 right-4 z-50 w-[94vw] sm:w-[440px] max-w-[460px] h-[85vh] sm:h-[650px] max-h-[720px] bg-[#fbfdfa] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-emerald-700/20 animate-fadeIn font-sans">
          
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 text-white flex items-center justify-between border-b border-emerald-700/50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-200 border border-white/10 shrink-0">
                <Bot className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black tracking-tight text-white">Kisan Saathi</h3>
                  <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-400/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded-full border border-emerald-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {role.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/90 font-medium">
                  {role === 'aggregator'
                    ? (isHi ? 'संग्राहक हब सहायक' : 'Aggregator Assistant')
                    : role === 'buyer' || role === 'dealer'
                    ? (isHi ? 'थोक खरीद सहायक' : 'Procurement Assistant')
                    : (isHi ? 'आपका KisanConnect सहायक' : 'Your KisanConnect Assistant')}
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-200 hover:text-white transition-colors cursor-pointer"
                title={isHi ? 'चैट साफ़ करें' : 'Clear Chat'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-200 hover:text-white transition-colors cursor-pointer"
                title={isHi ? 'छोटा करें' : 'Minimize'}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-200 hover:text-white transition-colors cursor-pointer"
                title={isHi ? 'बंद करें' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Fallback Notice Banner */}
          {apiNotice && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 py-2 text-[11px] text-amber-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>{apiNotice}</span>
              </div>
              <button 
                onClick={() => setApiNotice(null)} 
                className="text-amber-800 font-bold hover:underline text-[10px] ml-2 cursor-pointer"
              >
                {isHi ? 'हटाएं' : 'Dismiss'}
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-[#fbfdfa] via-white to-[#f4f7f2]">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                      isUser
                        ? 'bg-emerald-800 text-white rounded-br-xs font-medium'
                        : 'bg-white text-slate-800 border border-emerald-900/10 rounded-bl-xs shadow-slate-200/50'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-slate-100 text-[10px] font-black text-emerald-800">
                        <span>🌾 Kisan Saathi</span>
                        <span className="text-[9px] font-normal text-slate-400">({role})</span>
                      </div>
                    )}
                    <div className="whitespace-pre-line text-xs font-normal">
                      {m.text}
                    </div>

                    {/* Rich Cards Section (e.g., Buyer cards, Farmer cards, Batch cards) */}
                    {!isUser && Array.isArray(m.cards) && m.cards.length > 0 && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                        {m.cards.map((c, cIdx) => (
                          <div 
                            key={cIdx} 
                            className="bg-slate-50 hover:bg-emerald-50/50 rounded-xl p-2.5 border border-slate-200 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <h4 className="text-xs font-black text-slate-900">{c.title}</h4>
                                {c.subtitle && (
                                  <p className="text-[10px] text-slate-500 font-medium">{c.subtitle}</p>
                                )}
                              </div>
                              {c.badge && (
                                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                                  {c.badge}
                                </span>
                              )}
                            </div>

                            {(c.quantity || c.price) && (
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold text-slate-700">
                                {c.quantity && <span>मात्रा: <strong className="text-emerald-800">{c.quantity}</strong></span>}
                                {c.price && <span>भाव: <strong className="text-emerald-800">{c.price}</strong></span>}
                              </div>
                            )}

                            {Array.isArray(c.details) && c.details.length > 0 && (
                              <div className="mt-1.5 text-[10px] text-slate-600 space-y-0.5">
                                {c.details.map((d, dIdx) => (
                                  <div key={dIdx}>• {d}</div>
                                ))}
                              </div>
                            )}

                            {Array.isArray(c.actions) && c.actions.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-200/60">
                                {c.actions.map((act, aIdx) => (
                                  <button
                                    key={aIdx}
                                    type="button"
                                    onClick={() => handleActionClick(act)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                      act.label.includes('ऑफर') || act.label.includes('Offer') || act.label.includes('Plan')
                                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                                    }`}
                                  >
                                    [{act.label}]
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {m.timestamp}
                  </span>

                  {/* Render Action Buttons */}
                  {!isUser && Array.isArray(m.actions) && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[92%]">
                      {m.actions.map((act, actIdx) => (
                        <button
                          key={actIdx}
                          type="button"
                          onClick={() => handleActionClick(act)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-900 border border-emerald-300/80 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                        >
                          {act.tab === 'buyers' && <Store className="h-3 w-3 text-emerald-700" />}
                          {act.tab === 'listings' && <Sprout className="h-3 w-3 text-emerald-700" />}
                          {act.tab === 'offers' && <Tag className="h-3 w-3 text-emerald-700" />}
                          {act.tab === 'storage' && <Warehouse className="h-3 w-3 text-emerald-700" />}
                          {act.tab === 'aggregator_info' && <Users className="h-3 w-3 text-emerald-700" />}
                          {act.tab === 'demand' && <TrendingUp className="h-3 w-3 text-emerald-700" />}
                          {act.tab === 'procurement' && <FileText className="h-3 w-3 text-emerald-700" />}
                          <span>{act.label}</span>
                          <ArrowRight className="h-2.5 w-2.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-2 px-1">
                <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 animate-spin">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-emerald-900">
                  {isHi ? 'Kisan Saathi सोच रहा है...' : 'Kisan Saathi is thinking...'}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggested Prompts Bar (Contextual per Role) */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-[10px] font-bold text-slate-500 shrink-0">सुझाव:</span>
            {role === 'farmer' && (
              <>
                <button
                  onClick={() => handleSendMessage('मेरे खरीदार देखें')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  मेरे खरीदार देखें
                </button>
                <button
                  onClick={() => handleSendMessage('Mere paas 8 ton aloo hai, kisko bechu?')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  8 ton आलू किसको बेचूं?
                </button>
                <button
                  onClick={() => handleSendMessage('पास का खरीदार?')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  पास का खरीदार?
                </button>
                <button
                  onClick={() => handleSendMessage('Cold Storage')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  Cold Storage
                </button>
              </>
            )}
            {role === 'aggregator' && (
              <>
                <button
                  onClick={() => handleSendMessage('मुझे potato की demand दिखाओ')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  Potato की Demand
                </button>
                <button
                  onClick={() => handleSendMessage('मेरे पास के farmers की potato supply दिखाओ')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  पास के Farmers की Supply
                </button>
                <button
                  onClick={() => handleSendMessage('50 ton potato की demand fulfill करनी है')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  50T Demand Fulfill
                </button>
              </>
            )}
            {(role === 'buyer' || role === 'dealer') && (
              <>
                <button
                  onClick={() => handleSendMessage('मुझे 20 ton potato चाहिए')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  20 Ton Potato चाहिए
                </button>
                <button
                  onClick={() => handleSendMessage('पास के किसान खोजें')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  पास के किसान खोजें
                </button>
                <button
                  onClick={() => handleSendMessage('Procurement Status')}
                  className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
                >
                  Procurement Status
                </button>
              </>
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                role === 'aggregator'
                  ? (isHi ? "पूछें: 'मुझे potato की demand दिखाओ'" : "Ask: 'Show potato buyer demand'")
                  : role === 'buyer' || role === 'dealer'
                  ? (isHi ? "पूछें: 'मुझे 20 ton potato चाहिए'" : "Ask: 'I need 20 tons of potatoes'")
                  : (isHi ? "पूछें: '8 ton आलू किसको बेचूं?'" : "Ask: 'I have 8T potatoes, who to sell to?'")
              }
              maxLength={1000}
              className="flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="h-9 w-9 rounded-xl bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-emerald-800 cursor-pointer shrink-0 shadow-xs"
              title={isHi ? 'संदेश भेजें' : 'Send message'}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

        </div>
      )}
    </>
  );
};

export default KisanSaathiWidget;
