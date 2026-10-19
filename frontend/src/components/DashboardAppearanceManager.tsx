import React, { useState } from 'react';
import { 
  Palette, 
  CheckCircle2, 
  Eye, 
  RotateCcw, 
  Sparkles, 
  AlertTriangle, 
  Layout, 
  Layers, 
  ShieldCheck, 
  Check, 
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { useDashboardAppearance } from '../context/DashboardAppearanceContext';
import { useLanguage } from '../context/LanguageContext';
import { DashboardDesign } from '../types';

interface DashboardAppearanceManagerProps {
  onNavigate: (path: string) => void;
}

export const DashboardAppearanceManager: React.FC<DashboardAppearanceManagerProps> = ({ onNavigate }) => {
  const { appearance, designs, isSaving, activateDesign, restoreClassic } = useDashboardAppearance();
  const { t, language } = useLanguage();
  const isHi = language === 'hi';

  // Modal dialog states
  const [confirmActivationDesign, setConfirmActivationDesign] = useState<DashboardDesign | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeDesignId = appearance?.activeDesignId || 'classic_standard';
  const isClassicActive = activeDesignId === 'classic_standard';

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 6000);
  };

  const handleConfirmActivate = async () => {
    if (!confirmActivationDesign) return;
    try {
      const success = await activateDesign(confirmActivationDesign.id);
      if (success) {
        showFeedback(
          'success',
          isHi 
            ? `सफलतापूर्वक "${confirmActivationDesign.name}" को सभी किसानों के लिए सक्रिय कर दिया गया है!` 
            : `Successfully activated "${confirmActivationDesign.name}" for all farmer accounts!`
        );
      } else {
        showFeedback(
          'error',
          isHi ? 'डिज़ाइन सक्रिय करने में विफलता हुई।' : 'Failed to activate the selected design.'
        );
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Operation failed');
    } finally {
      setConfirmActivationDesign(null);
    }
  };

  const handleConfirmRestore = async () => {
    try {
      const success = await restoreClassic();
      if (success) {
        showFeedback(
          'success',
          isHi
            ? 'मूल क्लासिक डैशबोर्ड (Classic Original Dashboard) सफलतापूर्वक बहाल कर दिया गया है!'
            : 'Classic — Original Dashboard has been successfully restored as the active design!'
        );
      } else {
        showFeedback(
          'error',
          isHi ? 'मूल डैशबोर्ड बहाल करने में विफलता हुई।' : 'Failed to restore classic original design.'
        );
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Operation failed');
    } finally {
      setConfirmRestoreOpen(false);
    }
  };

  const handlePreview = (design: DashboardDesign) => {
    // Open preview route with design query parameter and return destination
    const previewUrl = `/preview-dashboard?design=${design.id}&from=admin`;
    onNavigate(previewUrl);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ========================================================================= */}
      {/* 🌟 HEADER & CONTROL BANNER */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-purple-700 uppercase tracking-wider mb-0.5">
              <span>Settings</span>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span>Dashboard Appearance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
                <Palette className="h-5 w-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {isHi ? 'सेटिंग्स: डैशबोर्ड रूप-रंग' : 'Settings → Dashboard Appearance'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              {isHi
                ? 'सभी पंजीकृत किसान खातों के लिए डैशबोर्ड का दृश्य थीम और लेआउट नियंत्रित करें। फसल सूची, सौदे, कीमतें और मुख्य व्यापारिक कार्यप्रणाली पूरी तरह सुरक्षित रहती है।'
                : 'Control the visual theme and layout of the Farmer Dashboard for all registered farmers. Underlying marketplace data, crop listings, deals, and logic remain 100% intact.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => setConfirmRestoreOpen(true)}
              disabled={isClassicActive || isSaving}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
                isClassicActive
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 hover:border-amber-400'
              }`}
              title={isClassicActive ? 'Classic design is already active' : 'Restore original Classic dashboard'}
              id="appearance-restore-classic-btn"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{isHi ? 'मूल क्लासिक बहाल करें' : 'Restore Classic'}</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                : 'bg-rose-50 text-rose-900 border border-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Live Active Status Strip */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
            </span>
            <span className="text-slate-500">{isHi ? 'वर्तमान सक्रिय डिज़ाइन:' : 'Currently Active in Production:'}</span>
            <span className="font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
              {designs.find(d => d.id === activeDesignId)?.name || 'Classic — Original Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            <span>Theme: <strong>{appearance?.theme || 'classic'}</strong></span>
            <span>•</span>
            <span>Layout: <strong>{appearance?.layout || 'standard'}</strong></span>
            {appearance?.updatedAt && (
              <>
                <span>•</span>
                <span>{isHi ? 'अंतिम अद्यतन:' : 'Updated:'} {new Date(appearance.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🎨 DESIGN CARDS GRID */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Layout className="h-4 w-4 text-slate-500" />
            <span>{isHi ? 'उपलब्ध डैशबोर्ड डिज़ाइन' : 'Available Dashboard Designs'} ({designs.length})</span>
          </h3>
          <span className="text-xs text-slate-500">
            {isHi ? 'सक्रिय करने से पहले पूर्वावलोकन करें' : 'Preview before activating'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {designs.map((design) => {
            const isActive = design.id === activeDesignId;
            const isHarvest = design.theme === 'harvest_premium';

            return (
              <div
                key={design.id}
                className={`bg-white rounded-2xl border-2 transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xs ${
                  isActive
                    ? 'border-emerald-600 ring-2 ring-emerald-500/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Card Mockup Thumbnail Header */}
                  <div
                    className={`h-40 relative p-4 flex flex-col justify-between border-b ${
                      isHarvest
                        ? 'bg-gradient-to-br from-[#FFFDF9] via-[#FAF6ED] to-[#F2EFE4] border-[#E5E0D5]'
                        : 'bg-gradient-to-br from-[#F7F5EF] via-[#FAF7F0] to-[#EAE6D9] border-slate-200'
                    }`}
                  >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 shadow-2xs text-slate-800 border border-slate-200">
                          {design.layoutName}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isHarvest
                            ? 'bg-[#104B35] text-white'
                            : 'bg-[#315C45] text-white'
                        }`}>
                          {design.themeName}
                        </span>
                      </div>

                      {isActive ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs">
                          <Check className="h-3.5 w-3.5" />
                          <span>{isHi ? 'सक्रिय उत्पादन' : 'Active in Production'}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200/90 text-slate-700">
                          {isHi ? 'पूर्वावलोकन उपलब्ध' : 'Available Preview'}
                        </span>
                      )}
                    </div>

                    {/* Miniature UI Mockup Wireframe Preview */}
                    <div className="bg-white/90 backdrop-blur-xs rounded-xl p-3 border border-slate-200/80 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-12 rounded-sm ${isHarvest ? 'bg-[#176B45]' : 'bg-[#315C45]'}`} />
                          <div className="h-2 w-16 bg-slate-200 rounded-sm" />
                        </div>
                        <div className="flex gap-1">
                          <div className={`h-2.5 w-6 rounded-sm ${isHarvest ? 'bg-[#E6A52E]' : 'bg-amber-400'}`} />
                          <div className="h-2.5 w-6 bg-slate-200 rounded-sm" />
                        </div>
                      </div>

                      {/* Mockup Action Cards Strip */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-6 rounded-md border flex items-center justify-center text-[8px] font-bold ${
                              isHarvest
                                ? 'bg-[#FAF6ED] border-[#E5E0D5] text-[#104B35]'
                                : 'bg-[#F7F5EF] border-slate-200 text-[#315C45]'
                            }`}
                          >
                            Card {i}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-base sm:text-lg font-black text-slate-900">
                          {design.name}
                        </h4>
                        {design.isDefault && (
                          <span className="text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                            Default Baseline
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {design.description}
                      </p>
                    </div>

                    {/* Feature Highlights */}
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        {isHi ? 'मुख्य विशेषताएं' : 'Key Specifications'}
                      </span>
                      {design.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-700">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {/* Palette Chips */}
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">
                        {isHi ? 'रंग पैलेट' : 'Curated Color Palette'}
                      </span>
                      <div className="flex items-center gap-2">
                        {isHarvest ? (
                          <>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="h-3.5 w-3.5 rounded-full bg-[#F7F4E9] border border-slate-300" />
                              <span>Ivory #F7F4E9</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="h-3.5 w-3.5 rounded-full bg-[#104B35]" />
                              <span>Deep #104B35</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="h-3.5 w-3.5 rounded-full bg-[#176B45]" />
                              <span>Primary #176B45</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="h-3.5 w-3.5 rounded-full bg-[#E6A52E]" />
                              <span>Amber #E6A52E</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="h-3.5 w-3.5 rounded-full bg-[#F7F5EF] border border-slate-300" />
                              <span>Ivory #F7F5EF</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="h-3.5 w-3.5 rounded-full bg-[#315C45]" />
                              <span>Green #315C45</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="h-3.5 w-3.5 rounded-full bg-amber-500" />
                              <span>Amber</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between gap-3 mt-2">
                  <button
                    onClick={() => handlePreview(design)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer bg-white shadow-2xs"
                  >
                    <Eye className="h-4 w-4 text-slate-500" />
                    <span>{isHi ? 'पूर्ण पूर्वावलोकन' : 'Preview Design'}</span>
                  </button>

                  {isActive ? (
                    <div 
                      id={`status-active-design-${design.id}`}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs flex items-center justify-center gap-1.5"
                    >
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{isHi ? 'सक्रिय (Active)' : 'Active'}</span>
                    </div>
                  ) : (
                    <button
                      id={`btn-activate-design-${design.id}`}
                      onClick={() => setConfirmActivationDesign(design)}
                      disabled={isSaving}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{isHi ? 'थीम सक्रिय करें' : 'Activate Theme'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 FUTURE EXTENSIBILITY NOTICE */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-xl bg-slate-200 text-slate-700 mt-0.5">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
              {isHi ? 'भविष्य की विस्तारशीलता (Future Themes & Layouts)' : 'Future Extensibility Architecture'}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              {isHi
                ? 'थीम (Theme) और लेआउट (Layout) को स्वतंत्र रूप से अलग रखा गया है। नए थीम्स (उदा. Light Green, White) और लेआउट्स (उदा. Compact) बिना किसी कोड रिफैक्टरिंग के जोड़े जा सकते हैं।'
                : 'Theme and Layout are decoupled. Future combinations (e.g., Harvest + Compact, Light Green + Standard) register dynamically without touching business logic.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold shrink-0 self-end sm:self-auto">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Server Authorization Enforced</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ⚠️ CONFIRM ACTIVATION MODAL */}
      {/* ========================================================================= */}
      {confirmActivationDesign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {isHi ? 'डैशबोर्ड डिज़ाइन सक्रिय करें?' : 'Activate Dashboard Design?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isHi ? 'यह बदलाव सभी पंजीकृत किसानों के लिए लागू होगा।' : 'This change applies to all registered farmer accounts.'}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="h-4 w-4 text-amber-700 shrink-0" />
                <span>{isHi ? 'ध्यान दें:' : 'Important Notice:'}</span>
              </div>
              <p className="leading-relaxed">
                {isHi
                  ? `आप "${confirmActivationDesign.name}" को लाइव किसान पोर्टल के लिए सक्रिय करने जा रहे हैं। सभी किसानों के उत्पाद, सौदे, फसल भाव और प्रोफाइल डेटा सुरक्षित और अपरिवर्तित रहेंगे।`
                  : `You are about to activate "${confirmActivationDesign.name}" for the live farmer portal. All farmer listings, offers, deals, mandi prices, and profiles remain completely untouched.`}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmActivationDesign(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmActivate}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {isSaving ? (
                  <span>{isHi ? 'सक्रिय हो रहा है...' : 'Activating...'}</span>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{isHi ? 'हाँ, सक्रिय करें' : 'Confirm & Activate'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ⚠️ CONFIRM RESTORE CLASSIC MODAL */}
      {/* ========================================================================= */}
      {confirmRestoreOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {isHi ? 'मूल क्लासिक डैशबोर्ड बहाल करें?' : 'Restore Classic Original Dashboard?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isHi ? 'उत्पादन रूप-रंग मूल डिज़ाइन पर वापस लौट जाएगा।' : 'Reverts production appearance to the original design.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <p className="leading-relaxed">
                {isHi
                  ? 'यह क्रिया "Classic — Original Dashboard" को सक्रिय डिज़ाइन के रूप में पुनर्स्थापित करेगी। सभी किसान डेटा और कार्यप्रणाली अपरिवर्तित रहेगी।'
                  : 'This action will reactivate the original Classic dashboard design. All farmer records, crop listings, deals, and settings are preserved.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmRestoreOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {isSaving ? (
                  <span>{isHi ? 'बहाल हो रहा है...' : 'Restoring...'}</span>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>{isHi ? 'हाँ, क्लासिक बहाल करें' : 'Restore Classic'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
