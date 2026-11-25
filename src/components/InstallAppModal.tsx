import React from 'react';
import {
  Smartphone,
  Download,
  CheckCircle,
  Share,
  Monitor,
  X,
  WifiOff,
  Zap,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../context/LanguageContext';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const { language } = useLanguage();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        onClose();
      }
    }
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900 dark:text-white animate-in fade-in zoom-in-95 my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-14 h-10 rounded-xl bg-white p-0.5 flex items-center justify-center shadow-md ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden shrink-0">
              <img
                src="/assets/aistudio/Radhamadhab_Online_Center_Logo_68908320.png"
                alt="Radhamadhab Online Center"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                {language === 'bn'
                  ? 'মোবাইল ও Web অ্যাপ ইনস্টল করুন'
                  : 'Install Android & Web App'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'bn'
                  ? 'অফলাইন ও অনলাইন দুইভাবেই দ্রুত চলে'
                  : 'Works seamlessly Offline & Online'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Capabilities Strip */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-400">
              <Smartphone className="w-4 h-4" />
              <span>{language === 'bn' ? 'Android মোবাইল অ্যাপ' : 'Android Mobile App'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              {language === 'bn'
                ? 'ফোন হোম স্ক্রিনে ১-ট্যাপে আসল অ্যাপের মতো ইনস্টল হয়ে যাবে।'
                : 'Installs directly onto your Android phone app drawer & home screen.'}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-400">
              <Monitor className="w-4 h-4" />
              <span>{language === 'bn' ? 'Web ও ডেস্কটপ ভার্সন' : 'Web & PC Version'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              {language === 'bn'
                ? 'ব্রাউজার বা পিসি অ্যাপে শর্টকাট কী (Alt+N, Ctrl+Enter) দিয়ে দ্রুত কাজ।'
                : 'Runs in browser or Desktop App with rapid keyboard shortcuts.'}
            </p>
          </div>
        </div>

        {/* Offline + Online Readiness */}
        <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-700 dark:text-slate-200 font-medium">
            {language === 'bn'
              ? 'ইন্টারনেট ছাড়াই লেনদেন, খাতাবুক ও হিসাব চলবে — নেট ফিরলেই অটো-সিঙ্ক হবে।'
              : 'Works offline without internet — all entries queue locally and auto-sync online.'}
          </span>
        </div>

        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
              {language === 'bn'
                ? 'অ্যাপটি ইতিমধ্যে আপনার ডিভাইসে ইনস্টল করা আছে!'
                : 'Standalone App Already Installed!'}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {language === 'bn'
                ? 'আপনার হোম স্ক্রিন বা অ্যাপ ড্রয়ার থেকে এটি সরাসরি অফলাইন ও অনলাইনে চালু করতে পারবেন।'
                : 'Launch anytime from your home screen or desktop app drawer, offline or online.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {isInstallable && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>
                  {language === 'bn'
                    ? '১-ক্লিকে ফোনে অ্যাপ ইনস্টল করুন'
                    : '1-Tap Install App on Phone / PC'}
                </span>
              </button>
            )}

            {isInIframe && !isInstallable && (
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>
                  {language === 'bn'
                    ? 'ফোনে ইনস্টল করতে সরাসরি Chrome-এ খুলুন'
                    : 'Open Direct Link in Chrome to Install'}
                </span>
              </a>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="font-bold text-xs flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>
                  {language === 'bn'
                    ? 'Android / Desktop Chrome-এ ইনস্টল করার নিয়ম:'
                    : 'How to Install on Android Chrome:'}
                </span>
              </div>
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
                <li>
                  {language === 'bn'
                    ? 'উপরের সবুজ "ইনস্টল" বাটনে চাপুন অথবা Chrome মেনু (⋮) খুলুন'
                    : 'Tap the Install button above or open Chrome menu (⋮)'}
                </li>
                <li>
                  {language === 'bn'
                    ? '"Install app" বা "Add to Home screen" নির্বাচন করে Install চাপুন'
                    : 'Select "Install app" or "Add to Home screen" and tap Install'}
                </li>
                <li>
                  {language === 'bn'
                    ? 'সাথে সাথে ফোনের অ্যাপ ড্রয়ারে আইকন চলে আসবে — অফলাইনেও কাজ করবে!'
                    : 'App installs directly on your phone and works offline & online!'}
                </li>
              </ol>
            </div>

            {isIOS && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="font-bold text-xs flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Share className="w-4 h-4 text-blue-500" />
                  <span>{language === 'en' ? 'iPhone / iPad (Safari):' : 'আইফোন / আইপ্যাড (Safari):'}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {language === 'bn'
                    ? 'Safari Share বাটনে চাপুন → "Add to Home Screen" নির্বাচন করুন।'
                    : 'Tap Share in Safari → Scroll and tap "Add to Home Screen".'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fast Work Shortcuts Hint */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5 font-semibold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            {language === 'bn' ? 'দ্রুত কী শর্টকাট (PC):' : 'Fast PC Shortcuts:'}
          </span>
          <span className="font-mono font-bold text-amber-500 dark:text-amber-300">
            Alt+N • Alt+K • Alt+A • Ctrl+Enter
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
        >
          {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
        </button>
      </div>
    </div>
  );
};
