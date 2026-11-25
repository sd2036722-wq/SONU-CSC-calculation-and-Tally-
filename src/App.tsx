/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShopProvider, useShop } from './context/ShopContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './views/DashboardView';
import { TransactionsView } from './views/TransactionsView';
import { RechargeView } from './views/RechargeView';
import { MoneyTransferView } from './views/MoneyTransferView';
import { ExpensesView } from './views/ExpensesView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { KhataBookView } from './views/KhataBookView';
import { UpiQrGeneratorView } from './views/UpiQrGeneratorView';
import { AiAssistantView } from './views/AiAssistantView';
import { AuthView } from './views/AuthView';
import { OpeningBalanceModal } from './components/OpeningBalanceModal';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { ViewReceiptModal } from './components/modals/ViewReceiptModal';
import { GenerateReceiptModal } from './components/modals/GenerateReceiptModal';
import { ReceiptHistoryModal } from './components/modals/ReceiptHistoryModal';
import { QuickAiWidget } from './components/QuickAiWidget';
import { OfflineIndicator } from './components/OfflineIndicator';

function MainShopApp() {
  const { user, loading } = useAuth();
  const {
    isAddModalOpen,
    modalInitialType,
    modalInitialCategory,
    modalTransferDirection,
    closeAddModal,
    selectedReceipt,
    isReceiptModalOpen,
    closeReceiptModal,
    isGenerateReceiptModalOpen,
    prefillReceiptTxn,
    closeGenerateReceiptModal,
    isReceiptHistoryModalOpen,
    closeReceiptHistoryModal,
    openAddModal,
  } = useShop();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOpeningBalanceModalOpen, setIsOpeningBalanceModalOpen] = useState(false);

  // Global Keyboard Shortcuts for ultra-fast desktop/web billing workflow
  useEffect(() => {
    if (!user) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen) closeAddModal();
        if (isOpeningBalanceModalOpen) setIsOpeningBalanceModalOpen(false);
        return;
      }

      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'n') {
        e.preventDefault();
        openAddModal();
      } else if (k === 'd') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (k === 't') {
        e.preventDefault();
        setActiveTab('transactions');
      } else if (k === 'k') {
        e.preventDefault();
        setActiveTab('khata');
      } else if (k === 'a') {
        e.preventDefault();
        setActiveTab('ai-assistant');
      } else if (k === 's') {
        e.preventDefault();
        setActiveTab('settings');
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [user, isAddModalOpen, isOpeningBalanceModalOpen, closeAddModal, openAddModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-20 h-14 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg ring-2 ring-amber-400/40 animate-pulse mb-3 overflow-hidden">
          <img
            src="/assets/aistudio/Radhamadhab_Online_Center_Logo_68908320.png"
            alt="Radhamadhab Online Center"
            className="w-full h-full object-contain"
          />
        </div>
        <p className="text-sm font-semibold text-slate-300">রাধা মাধব অনলাইন সেন্টার লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onOpenOpeningBalance={() => setIsOpeningBalanceModalOpen(true)}
            setActiveTab={setActiveTab}
          />
        );
      case 'transactions':
        return <TransactionsView />;
      case 'khata':
        return <KhataBookView />;
      case 'recharge':
        return <RechargeView />;
      case 'money-transfer':
        return <MoneyTransferView />;
      case 'expenses':
        return <ExpensesView />;
      case 'reports':
        return <ReportsView />;
      case 'upi-qr':
        return <UpiQrGeneratorView />;
      case 'ai-assistant':
        return <AiAssistantView />;
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <DashboardView
            onOpenOpeningBalance={() => setIsOpeningBalanceModalOpen(true)}
            setActiveTab={setActiveTab}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        onOpenOpeningBalance={() => setIsOpeningBalanceModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0">
          {renderActiveView()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Opening Balance Modal */}
      <OpeningBalanceModal
        isOpen={isOpeningBalanceModalOpen}
        onClose={() => setIsOpeningBalanceModalOpen(false)}
      />

      {/* Global Quick Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        initialType={modalInitialType}
        initialCategory={modalInitialCategory}
        initialTransferDirection={modalTransferDirection}
      />

      {/* Global Receipt Viewer Modal */}
      <ViewReceiptModal
        isOpen={isReceiptModalOpen}
        receipt={selectedReceipt}
        onClose={closeReceiptModal}
      />

      {/* Global Generate Receipt Modal */}
      <GenerateReceiptModal
        isOpen={isGenerateReceiptModalOpen}
        onClose={closeGenerateReceiptModal}
        prefillTxn={prefillReceiptTxn}
      />

      {/* Global Saved Receipt History Modal */}
      <ReceiptHistoryModal
        isOpen={isReceiptHistoryModalOpen}
        onClose={closeReceiptHistoryModal}
      />

      {/* Floating Quick AI Calculation Solver & Fast Chat */}
      <QuickAiWidget
        activeTab={activeTab}
        onExpandFull={() => setActiveTab('ai-assistant')}
      />

      {/* Offline / Auto-Sync Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ShopProvider>
            <MainShopApp />
          </ShopProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
