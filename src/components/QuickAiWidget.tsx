import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { AiChatContent } from './AiChatContent';

interface QuickAiWidgetProps {
  activeTab: string;
  onExpandFull: () => void;
}

export const QuickAiWidget: React.FC<QuickAiWidgetProps> = ({ activeTab, onExpandFull }) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Avoid duplicate chat panels when user is already on the dedicated AI Solver view
  if (activeTab === 'ai-assistant') {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 print:hidden flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-[calc(100vw-2rem)] sm:w-[420px] shadow-2xl rounded-2xl">
          <AiChatContent
            compact
            onExpandFull={() => {
              setIsOpen(false);
              onExpandFull();
            }}
            onCloseWidget={() => setIsOpen(false)}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`h-12 px-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer border ${
          isOpen
            ? 'bg-slate-900 border-slate-700 text-white hover:bg-slate-800'
            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 border-amber-300/60 shadow-orange-500/30'
        }`}
        title={
          language === 'bn'
            ? 'দ্রুত AI হিসাব ও প্রশ্ন সমাধান'
            : 'Quick AI Solver & Fast Chat'
        }
      >
        {isOpen ? (
          <>
            <X className="w-4 h-4" />
            <span>{language === 'bn' ? 'বন্ধ করুন' : 'Close AI'}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{language === 'bn' ? 'AI সমাধান' : 'AI Solver'}</span>
          </>
        )}
      </button>
    </div>
  );
};
