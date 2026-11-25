import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, justReconnected } = useOnlineStatus();
  const { syncStatus } = useShop();
  const { language } = useLanguage();

  if (isOnline && !justReconnected && syncStatus !== 'offline') {
    return null;
  }

  const isOfflineState = !isOnline || syncStatus === 'offline';

  return (
    <div
      className={`fixed bottom-20 left-3 md:bottom-5 md:left-5 z-40 print:hidden max-w-[calc(100vw-9rem)] sm:max-w-md flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xl border backdrop-blur-md transition-all ${
        isOfflineState
          ? 'bg-amber-500 text-slate-950 border-amber-300'
          : syncStatus === 'syncing'
          ? 'bg-blue-600 text-white border-blue-400'
          : 'bg-emerald-600 text-white border-emerald-400'
      }`}
    >
      {isOfflineState ? (
        <>
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            {language === 'bn'
              ? 'অফলাইন মোড — ফোনে সেভ হচ্ছে, নেট এলে সিঙ্ক হবে'
              : 'Offline Mode — Saved locally, auto-syncs online'}
          </span>
        </>
      ) : syncStatus === 'syncing' ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{language === 'bn' ? 'অনলাইনে সিঙ্ক হচ্ছে...' : 'Back online — Syncing...'}</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'bn' ? 'অনলাইন সিঙ্ক সম্পন্ন!' : 'Back online — All synced!'}</span>
        </>
      )}
    </div>
  );
};
