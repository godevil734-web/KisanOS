import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, MicOff, X, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface VoiceSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const VoiceSearchInput: React.FC<VoiceSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  id = 'crop-search-input'
}) => {
  const { language, t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [showNotice, setShowNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = 
      (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const handleStartListening = () => {
    const SpeechRecognition = 
      (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

    if (!SpeechRecognition) {
      const msg = t('voice.voiceSearchNotSupported') || 
        (language === 'hi' ? 'इस ब्राउज़र पर आवाज़ से खोज समर्थित नहीं है, कृपया लिखकर खोजें।' : 'Voice search not supported on this browser, please type.');
      setShowNotice(msg);
      setTimeout(() => setShowNotice(null), 4000);
      return;
    }

    try {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setShowNotice(t('voice.speakPrompt') || (language === 'hi' ? 'कृपया फसल का नाम बोलें...' : 'Please speak crop name...'));
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          // Clean punctuation and set value
          const clean = transcript.replace(/[.,]/g, '').trim();
          onChange(clean);
        }
        setIsListening(false);
        setShowNotice(null);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setShowNotice(language === 'hi' ? 'माइक्रोफ़ोन की अनुमति नहीं मिली।' : 'Microphone permission denied.');
        } else {
          setShowNotice(t('voice.voiceSearchNotSupported') || 'Voice search not supported on this browser, please type.');
        }
        setTimeout(() => setShowNotice(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
        setShowNotice(null);
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
      setShowNotice(t('voice.voiceSearchNotSupported') || 'Voice search not supported on this browser, please type.');
      setTimeout(() => setShowNotice(null), 4000);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center w-full">
        <Search className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none" />
        
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t('voice.voiceSearchPlaceholder') || (language === 'hi' ? 'फसल खोजें (जैसे आलू, गेहूं)...' : 'Search crops (e.g. Potato, Wheat)...')}
          className={`w-full pl-9 pr-16 py-2 rounded-xl border text-xs font-medium bg-white transition-all outline-hidden ${
            isListening 
              ? 'border-amber-400 ring-2 ring-amber-200' 
              : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
          }`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleStartListening}
            title={t('voice.voiceSearchTooltip') || (language === 'hi' ? 'बोलकर फसल खोजें' : 'Click to speak crop name')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-xs'
                : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {isListening ? (
              <Mic className="h-3.5 w-3.5 fill-current animate-bounce" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Floating Speech Status / Error Notification Tooltip */}
      {showNotice && (
        <div className="absolute left-0 right-0 -bottom-8 z-30 flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg animate-fadeIn">
          <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
          <span className="truncate">{showNotice}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceSearchInput;
