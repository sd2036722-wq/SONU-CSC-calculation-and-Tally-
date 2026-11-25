import React from 'react';
import { Sparkles, Calculator, Zap, Receipt, Percent, HelpCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { AiChatContent } from '../components/AiChatContent';

export const AiAssistantView: React.FC = () => {
  const { language } = useLanguage();

  const capabilities = [
    {
      icon: Calculator,
      color: 'text-amber-400',
      title: language === 'bn' ? 'সব ধরনের অংক' : 'Instant Math Solver',
      desc:
        language === 'bn'
          ? 'যোগ-বিয়োগ, ভগ্নাংশ, বীজগণিত, জ্যামিতি'
          : 'Arithmetic, algebra, equations & bills',
    },
    {
      icon: Percent,
      color: 'text-emerald-400',
      title: language === 'bn' ? 'GST, সুদ ও মার্জিন' : 'GST, EMI & Profit %',
      desc:
        language === 'bn'
          ? 'দোকান লাভ-ক্ষতি, ছাড়, EMI ও ট্যাক্স হিসাব'
          : 'Discounts, margins, interest & tax',
    },
    {
      icon: Receipt,
      color: 'text-blue-400',
      title: language === 'bn' ? 'ছবি থেকে সমাধান' : 'Photo Math & Bills',
      desc:
        language === 'bn'
          ? 'খাতার অংক বা বিলের ছবি দিয়ে উত্তর পান'
          : 'Upload bill or notebook photo to solve',
    },
    {
      icon: HelpCircle,
      color: 'text-violet-400',
      title: language === 'bn' ? 'যেকোনো প্রশ্ন' : 'Fast General Q&A',
      desc:
        language === 'bn'
          ? 'বাংলা বা ইংরেজিতে যে কোনো প্রশ্নের দ্রুত উত্তর'
          : 'Ask any question in English or Bengali',
    },
  ];

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shrink-0">
            <Sparkles className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white">
                {language === 'bn'
                  ? 'AI হিসাব ও প্রশ্ন সমাধান এজেন্ট'
                  : 'AI Calculation Solver & Chat'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                <Zap className="w-3 h-3" />
                {language === 'bn' ? 'সুপার ফাস্ট' : 'Instant'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'দোকানের হিসাব, অংক, শতাংশ, GST বা যেকোনো প্রশ্ন লিখুন — সাথে সাথে সঠিক উত্তর পাবেন।'
                : 'Solve any shop calculation, math problem, photo bill, or ask any question and get instant answers.'}
            </p>
          </div>
        </div>
      </div>

      {/* Capability Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {capabilities.map((cap, i) => {
          const Icon = cap.icon;
          return (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5"
            >
              <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 shrink-0">
                <Icon className={`w-4 h-4 ${cap.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{cap.title}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{cap.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Interactive AI Chat */}
      <AiChatContent />
    </div>
  );
};
