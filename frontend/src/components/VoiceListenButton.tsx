import React, { useState, useEffect } from 'react';
import { Volume2, Square, VolumeX } from 'lucide-react';
import { speechManager } from '../utils/speech';
import { useLanguage } from '../context/LanguageContext';

interface VoiceListenButtonProps {
  textHi: string;
  textEn: string;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const VoiceListenButton: React.FC<VoiceListenButtonProps> = ({
  textHi,
  textEn,
  label,
  size = 'sm',
  className = ''
}) => {
  const { language, t } = useLanguage();
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeText = language === 'hi' ? textHi : textEn;

  useEffect(() => {
    setIsSupported(speechManager.isSupported());
    const unsubscribe = speechManager.subscribe((isSpeaking, currentText) => {
      setIsPlaying(isSpeaking && (currentText === activeText || currentText === textHi || currentText === textEn));
    });
    return unsubscribe;
  }, [activeText, textHi, textEn]);

  if (!isSupported) {
    return null; // Graceful fallback: do not render anything if speech is not supported
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      speechManager.stop();
    } else {
      speechManager.speak(activeText, language === 'hi' ? 'hi' : 'en');
    }
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-[11px] gap-1',
    sm: 'px-2.5 py-1.2 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2'
  }[size];

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4'
  }[size];

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={isPlaying ? (t('voice.stop') || 'Stop') : (t('voice.listen') || 'Listen')}
      aria-label={isPlaying ? (t('voice.stop') || 'Stop') : (t('voice.listen') || 'Listen')}
      className={`inline-flex items-center font-bold rounded-xl transition-all select-none ${sizeClasses} ${
        isPlaying
          ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400 ring-offset-1 animate-pulse'
          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 hover:border-emerald-300'
      } ${className}`}
    >
      {isPlaying ? (
        <>
          <Square className={`${iconSizes} fill-current`} />
          <span>{t('voice.stop') || (language === 'hi' ? 'रोकें' : 'Stop')}</span>
        </>
      ) : (
        <>
          <Volume2 className={iconSizes} />
          <span>{label || t('voice.listen') || (language === 'hi' ? 'सुनें' : 'Listen')}</span>
        </>
      )}
    </button>
  );
};

export default VoiceListenButton;
