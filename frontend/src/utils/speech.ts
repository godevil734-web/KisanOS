// frontend/src/utils/speech.ts
// Pure client-side Web Speech Synthesis & Recognition manager for Western UP Farmer context

type SpeechListener = (isSpeaking: boolean, currentText: string | null) => void;

class BrowserSpeechManager {
  private listeners: Set<SpeechListener> = new Set();
  private isSpeakingState = false;
  private currentTextState: string | null = null;
  private voicesLoaded = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.voicesLoaded = true;
      };
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isRecognitionSupported(): boolean {
    return typeof window !== 'undefined' && (
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    );
  }

  public subscribe(listener: SpeechListener): () => void {
    this.listeners.add(listener);
    listener(this.isSpeakingState, this.currentTextState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.isSpeakingState, this.currentTextState));
  }

  public stop(): void {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn('Speech cancellation error:', e);
    }
    this.isSpeakingState = false;
    this.currentTextState = null;
    this.notify();
  }

  public speak(text: string, lang: 'hi' | 'en' = 'hi'): void {
    if (!this.isSupported()) return;

    this.stop();

    if (!text || !text.trim()) return;

    try {
      const cleanText = text.replace(/[*_#•]/g, ' ').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const targetLang = lang === 'hi' ? 'hi-IN' : 'en-US';
      utterance.lang = targetLang;
      utterance.rate = 0.95; // Slightly slower, clear cadence for rural comprehension
      utterance.pitch = 1.0;

      // Attempt to pick a natural regional voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const langPrefix = lang === 'hi' ? 'hi' : 'en';
        const matchedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix));
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      utterance.onstart = () => {
        this.isSpeakingState = true;
        this.currentTextState = text;
        this.notify();
      };

      utterance.onend = () => {
        this.isSpeakingState = false;
        this.currentTextState = null;
        this.notify();
      };

      utterance.onerror = (e) => {
        // Interrupted/canceled error is normal when user clicks stop
        this.isSpeakingState = false;
        this.currentTextState = null;
        this.notify();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
      this.isSpeakingState = false;
      this.currentTextState = null;
      this.notify();
    }
  }

  public isCurrentlySpeakingText(text: string): boolean {
    return this.isSpeakingState && this.currentTextState === text;
  }
}

export const speechManager = new BrowserSpeechManager();
