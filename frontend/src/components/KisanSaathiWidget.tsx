import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Minus, 
  Trash2, 
  Send, 
  Sparkles, 
  ArrowRight, 
  RotateCcw,
  Store,
  Sprout,
  Tag,
  Warehouse,
  Users,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { KisanSaathiMessage, KisanSaathiAction } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface KisanSaathiWidgetProps {
  onNavigateTab?: (tab: string) => void;
}

export const KisanSaathiWidget: React.FC<KisanSaathiWidgetProps> = ({ onNavigateTab }) => {
  const { language } = useLanguage();
  const isHi = language === 'hi' || language === 'hinglish';

  // Strictly on-demand: NEVER open automatically on load or dashboard entry
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // Initial welcome message per requirement section 13
  const initialGreeting = isHi
    ? "नमस्ते! मैं Kisan Saathi हूँ, KisanConnect का AI सहायक।\n\nमैं buyer खोजने, offers समझने, storage और KisanConnect इस्तेमाल करने में आपकी मदद कर सकता हूँ।"
    : "Hello! I am Kisan Saathi, KisanConnect's AI Assistant.\n\nI can help you discover matching buyers, understand price offers, book cold storage, and navigate KisanConnect.";

  const [messages, setMessages] = useState<KisanSaathiMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        { label: isHi ? 'Buyer खोजें' : 'Find Buyers', actionType: 'navigate_buyers', tab: 'buyers' },
        { label: isHi ? 'मेरी फसल' : 'My Crops', actionType: 'navigate_crops', tab: 'listings' },
        { label: isHi ? 'मेरे Offers' : 'My Offers', actionType: 'navigate_offers', tab: 'offers' },
        { label: isHi ? 'Cold Storage' : 'Cold Storage', actionType: 'navigate_storage', tab: 'storage' },
        { label: isHi ? 'कुछ और पूछें' : 'Ask Anything', actionType: 'custom_prompt' }
      ]
    }
  ]);

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

    if (action.tab) {
      if (onNavigateTab) {
        onNavigateTab(action.tab);
      }
      // Broadcast custom event so any active dashboard views switch instantly
      window.dispatchEvent(new CustomEvent('farmer-navigate-tab', { detail: { tab: action.tab } }));
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
        actions: res.actions || []
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setApiNotice(isHi ? 'AI सहायक फ़िलहाल अनुपलब्ध है।' : 'AI assistant temporarily unavailable.');
      const fallbackMsg: KisanSaathiMessage = {
        id: `bot-fallback-${Date.now()}`,
        role: 'assistant',
        text: isHi 
          ? 'किसान साथी फ़िलहाल व्यस्त है। आप सीधे मुख्य मेनू से अपनी फसल, खरीदार व ऑफर्स देख सकते हैं।' 
          : 'Kisan Saathi is temporarily busy. You can directly browse crops, buyers, and offers from the main menu.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: isHi ? 'Buyer खोजें' : 'Find Buyers', actionType: 'navigate_buyers', tab: 'buyers' },
          { label: isHi ? 'मेरी फसल' : 'My Crops', actionType: 'navigate_crops', tab: 'listings' },
          { label: isHi ? 'मेरे Offers' : 'My Offers', actionType: 'navigate_offers', tab: 'offers' },
          { label: isHi ? 'Cold Storage' : 'Cold Storage', actionType: 'navigate_storage', tab: 'storage' }
        ]
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
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: isHi ? 'Buyer खोजें' : 'Find Buyers', actionType: 'navigate_buyers', tab: 'buyers' },
          { label: isHi ? 'मेरी फसल' : 'My Crops', actionType: 'navigate_crops', tab: 'listings' },
          { label: isHi ? 'मेरे Offers' : 'My Offers', actionType: 'navigate_offers', tab: 'offers' },
          { label: isHi ? 'Cold Storage' : 'Cold Storage', actionType: 'navigate_storage', tab: 'storage' },
          { label: isHi ? 'कुछ और पूछें' : 'Ask Anything', actionType: 'custom_prompt' }
        ]
      }
    ]);
    setApiNotice(null);
  };

  return (
    <>
      {/* Floating Trigger Button: Replaces the generic Help button with Kisan Saathi */}
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
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-mono font-bold">AI</span>
            </div>
            <div className="text-[10px] text-emerald-300/80 font-medium leading-none">
              {isHi ? 'आपका KisanConnect सहायक' : 'Your Agri AI Partner'}
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
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 border-l border-emerald-700 pl-2">
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 hover:bg-emerald-800 rounded text-emerald-200 transition-colors text-xs font-bold"
              title="Expand"
            >
              खोलें
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-emerald-800 rounded text-emerald-300 hover:text-white transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Kisan Saathi Conversational Drawer / Modal */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-4 right-4 z-50 w-[94vw] sm:w-[420px] max-w-[450px] h-[85vh] sm:h-[640px] max-h-[700px] bg-[#fbfdfa] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-emerald-700/20 animate-fadeIn font-sans">
          
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
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/90 font-medium">
                  {isHi ? 'आपका KisanConnect सहायक' : 'Your KisanConnect Assistant'}
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-200 hover:text-white transition-colors"
                title={isHi ? 'चैट साफ़ करें' : 'Clear Chat'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-200 hover:text-white transition-colors"
                title={isHi ? 'छोटा करें' : 'Minimize'}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-emerald-200 hover:text-white transition-colors"
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
                className="text-amber-800 font-bold hover:underline text-[10px] ml-2"
              >
                हटाएं
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
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                      isUser
                        ? 'bg-emerald-800 text-white rounded-br-xs font-medium'
                        : 'bg-white text-slate-800 border border-emerald-900/10 rounded-bl-xs shadow-slate-200/50'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-slate-100 text-[10px] font-black text-emerald-800">
                        <span>🌾 Kisan Saathi</span>
                      </div>
                    )}
                    <div className="whitespace-pre-line text-xs font-normal">
                      {m.text}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {m.timestamp}
                  </span>

                  {/* Render Action Buttons Grounded in Backend Modules */}
                  {!isUser && Array.isArray(m.actions) && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
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

          {/* Quick Suggested Prompts Bar */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-[10px] font-bold text-slate-500 shrink-0">सुझाव:</span>
            <button
              onClick={() => handleSendMessage('Mere paas 8 ton aloo hai, kisko bechu?')}
              className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
            >
              8 ton आलू किसको बेचूं?
            </button>
            <button
              onClick={() => handleSendMessage('Sabse paas buyer kaun hai?')}
              className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
            >
              पास का खरीदार?
            </button>
            <button
              onClick={() => handleSendMessage('Cold storage chahiye')}
              className="shrink-0 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-900 px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
            >
              Cold Storage
            </button>
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
              placeholder={isHi ? "पूछें: '8 ton आलू किसको बेचूं?'" : "Ask: 'I have 8T potatoes, who to sell to?'"}
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
