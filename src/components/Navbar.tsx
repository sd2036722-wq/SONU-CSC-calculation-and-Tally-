import React, { useState } from 'react';
import {
  RotateCcw,
  Cloud,
  CloudOff,
  Calendar,
  Wallet,
  Building2,
  LogOut,
  User,
  ShieldCheck,
  Check,
  Languages,
  Menu,
  X,
  LayoutDashboard,
  Receipt,
  Smartphone,
  ArrowRightLeft,
  ShoppingBag,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Download,
  FolderArchive,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, formatBengaliNumber, formatShopName } from '../lib/accounting';
import { getTodayDateString } from '../data/defaults';
import { InstallAppModal } from './InstallAppModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NavbarProps {
  onOpenOpeningBalance: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenOpeningBalance,
  activeTab,
  setActiveTab,
}) => {
  const {
    shopSettings,
    todaySummary,
    syncStatus,
    lastSyncTime,
    forceSync,
    dailyBalances,
    receipts,
    openReceiptHistoryModal,
  } = useShop();
  const { user, logout } = useAuth();
  const { language, setLanguage, toggleLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [syncingState, setSyncingState] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  const handleCornerAppDownloadClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setIsInstallModalOpen(true);
  };

  const todayStr = getTodayDateString();
  const hasTodayOpening = Boolean(dailyBalances[todayStr]);

  const getFormattedDate = () => {
    const now = new Date();
    if (language === 'bn') {
      const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
      const monthsBn = [
        'জানুয়ারী', 'ফেব্রুয়ারী', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
        'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
      ];
      const dayName = daysBn[now.getDay()];
      const dateNum = formatBengaliNumber(now.getDate());
      const monthName = monthsBn[now.getMonth()];
      const yearNum = formatBengaliNumber(now.getFullYear());
      return `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
    } else {
      return now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  };

  const handleManualSync = async () => {
    setSyncingState(true);
    await forceSync();
    setTimeout(() => setSyncingState(false), 600);
  };

  const getDisplayShopName = () => {
    const exactName = user?.shopName || shopSettings.shopName;
    if (exactName && exactName !== 'Radhamadhab Online Center' && exactName !== 'Radha Madhab Online Center') {
      if (
        language === 'bn' &&
        shopSettings.shopNameBn &&
        shopSettings.shopNameBn !== exactName &&
        shopSettings.shopNameBn !== 'রাধা মাধব অনলাইন সেন্টার'
      ) {
        return formatShopName(shopSettings.shopNameBn);
      }
      return formatShopName(exactName);
    }
    if (exactName) return formatShopName(exactName);
    return language === 'bn' ? 'অনলাইন সেন্টার' : 'Online Center';
  };

  const navMenuItems = [
    { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
    { id: 'transactions', label: t.navTransactions, icon: Receipt },
    { id: 'recharge', label: t.navRecharge, icon: Smartphone },
    { id: 'money-transfer', label: t.navMoneyTransfer, icon: ArrowRightLeft },
    { id: 'upi-qr', label: t.navUpiQr, icon: QrCode },
    { id: 'ai-assistant', label: t.navAiAgent, icon: Sparkles },
    { id: 'expenses', label: t.navExpenses, icon: ShoppingBag },
    { id: 'reports', label: t.navReports, icon: BarChart3 },
    { id: 'settings', label: t.navSettings, icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Mobile Menu Hamburger */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setShowMobileNav(!showMobileNav)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title="Navigation Menu"
            >
              {showMobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Shop Brand & Title */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer min-w-0"
            onClick={() => {
              setActiveTab('dashboard');
              setShowMobileNav(false);
            }}
          >
            <div className="w-12 h-10 sm:w-14 sm:h-11 rounded-xl bg-white p-0.5 flex items-center justify-center shadow-lg ring-2 ring-amber-400/50 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/Radhamadhab_Online_Center_Logo_68908320.png"
                alt={getDisplayShopName()}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-2xl tracking-tight text-amber-300 drop-shadow-sm truncate">
                  {getDisplayShopName()}
                </h1>
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {t.activeShop}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 font-medium truncate">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{getFormattedDate()}</span>
              </p>
            </div>
          </div>

          {/* Quick Balance Header Badges (Desktop & Tablet) */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-200 font-bold">{t.currentCash}</div>
                <div className="text-sm font-black text-emerald-300 font-mono">
                  {formatCurrency(todaySummary.closingCash)}
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-200 font-bold">{t.currentBank}</div>
                <div className="text-sm font-black text-blue-300 font-mono">
                  {formatCurrency(todaySummary.closingBank)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Controls: Clean responsive layout that fits mobile cleanly + prominent top-right App Install button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* AI Solver Quick Button (Desktop/Tablet; mobile has floating AI button + drawer) */}
            <button
              onClick={() => {
                setActiveTab('ai-assistant');
                setShowMobileNav(false);
              }}
              type="button"
              className={`hidden sm:flex px-2.5 py-1.5 rounded-lg text-xs font-bold border items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                activeTab === 'ai-assistant'
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
              title={t.navAiAgent}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px] font-bold">
                {language === 'bn' ? 'AI সমাধান' : 'AI Solver'}
              </span>
            </button>

            {/* Dark / Light Mode Toggle (Desktop/Tablet; mobile has inside drawer) */}
            <button
              onClick={toggleTheme}
              type="button"
              className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title={
                theme === 'dark'
                  ? language === 'en' ? 'Switch to Light Mode' : 'লাইট মোডে পরিবর্তন করুন'
                  : language === 'en' ? 'Switch to Dark Mode' : 'ডার্ক মোডে পরিবর্তন করুন'
              }
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline font-mono text-[11px]">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden md:inline font-mono text-[11px]">Dark</span>
                </>
              )}
            </button>

            {/* Receipt History Quick Button (Desktop/Tablet) */}
            <button
              onClick={openReceiptHistoryModal}
              type="button"
              className="hidden md:flex px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title={language === 'en' ? 'View Saved Receipts History' : 'সংরক্ষিত রসিদ ইতিহাস'}
            >
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[11px]">
                {language === 'en' ? 'Receipts' : 'রসিদ'}
              </span>
              {receipts && receipts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                  {receipts.length}
                </span>
              )}
            </button>

            {/* Language Selector Dropdown / Cycle button */}
            <div className="relative">
              <button
                onClick={toggleLanguage}
                type="button"
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-slate-700 flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                title={`Current: ${language === 'en' ? 'English' : language === 'bn' ? 'বাংলা' : 'Bilingual'}. Click to toggle language.`}
              >
                <Languages className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline font-mono text-[11px]">
                  {language === 'en' ? 'EN' : language === 'bn' ? 'বাংলা' : 'EN+BN'}
                </span>
                <span className="sm:hidden font-mono text-[10px]">
                  {language === 'en' ? 'EN' : language === 'bn' ? 'বাং' : 'দ্বি'}
                </span>
              </button>
            </div>

            {/* Opening Balance Quick Button */}
            <button
              onClick={onOpenOpeningBalance}
              type="button"
              className={`hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-semibold items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 ${
                hasTodayOpening
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold animate-pulse'
              }`}
              title={t.openingBalanceTitle}
            >
              {hasTodayOpening ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">{t.openingBalanceSet}:</span>
                  <span className="font-mono text-emerald-300 text-xs">
                    {formatCurrency(todaySummary.openingCash + todaySummary.openingBank)}
                  </span>
                </>
              ) : (
                <>
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.setOpeningBalance}</span>
                  <span className="sm:hidden">ব্যালেন্স</span>
                </>
              )}
            </button>

            {/* Sync Status Button */}
            <button
              onClick={handleManualSync}
              type="button"
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors relative cursor-pointer shrink-0"
              title={
                syncStatus === 'synced'
                  ? `${t.cloudSynced} (${lastSyncTime?.toLocaleTimeString() || 'Just now'})`
                  : syncStatus === 'syncing'
                  ? t.syncing
                  : t.offline
              }
            >
              {syncStatus === 'offline' ? (
                <CloudOff className="w-4 h-4 text-rose-400" />
              ) : (
                <Cloud className="w-4 h-4 text-emerald-400" />
              )}
              {syncingState && (
                <RotateCcw className="w-3 h-3 absolute -top-1 -right-1 text-amber-400 animate-spin" />
              )}
            </button>

            {/* Top-Right Corner Download / Install App Button (always prominent on phone & web) */}
            {!isInstalled && (
              <button
                onClick={handleCornerAppDownloadClick}
                type="button"
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-extrabold border border-emerald-300/50 flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0 active:scale-95"
                title={language === 'en' ? 'Download & Install Android / Web App' : 'ফোনে অ্যাপ ডাউনলোড ও ইনস্টল করুন'}
              >
                <Download className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="hidden sm:inline font-mono text-[11px] font-extrabold">
                  {language === 'en' ? 'Install App' : 'অ্যাপ ডাউনলোড'}
                </span>
                <span className="sm:hidden font-mono text-[11px] font-extrabold">
                  {language === 'en' ? 'App' : 'অ্যাপ'}
                </span>
              </button>
            )}

            {/* User Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                type="button"
                className="flex items-center gap-1.5 p-1.5 sm:px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
                  {user?.name?.[0]?.toUpperCase() || 'A'}
                </div>
              </button>

              {showProfileMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-slate-200"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-700">
                    <div className="font-semibold text-sm text-white">{user?.name}</div>
                    <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                    <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-400/20 text-amber-300">
                      {user?.role === 'owner' ? 'Owner (Shop Owner)' : 'Staff'}
                    </div>
                  </div>

                  <div className="px-4 py-2 border-b border-slate-700 space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Language:</div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${language === 'en' ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('bn')}
                        className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${language === 'bn' ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}
                      >
                        বাংলা
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('bi')}
                        className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${language === 'bi' ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}
                      >
                        EN+BN
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('settings')}
                    className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-slate-700/60 flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    {t.navSettings}
                  </button>

                  <button
                    onClick={logout}
                    className="w-full px-4 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {showMobileNav && (
        <div className="md:hidden bg-slate-950/95 border-b border-slate-800 p-4 space-y-2 animate-in slide-in-from-top duration-200">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {language === 'en' ? 'Shop Navigation' : 'দোকানের মেনু'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {navMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setShowMobileNav(false);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile Drawer Quick Tools: Opening Balance, Theme, Receipts */}
          <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMobileNav(false);
                onOpenOpeningBalance();
              }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{language === 'en' ? 'Balance' : 'ব্যালেন্স'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                toggleTheme();
              }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMobileNav(false);
                openReceiptHistoryModal();
              }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'en' ? 'Receipts' : 'রসিদ'}</span>
            </button>
          </div>

          {/* Mobile Drawer User Info & Logout Button */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-300 font-semibold truncate max-w-[180px]">
              {formatShopName(user?.shopName || user?.name || '')}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowMobileNav(false);
                logout();
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      )}
      {/* App Install Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </header>
  );
};
