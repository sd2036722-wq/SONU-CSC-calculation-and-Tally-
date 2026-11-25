import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Zap,
  Brain,
  Send,
  Square,
  Trash2,
  Copy,
  Check,
  ImagePlus,
  X,
  Calculator,
  HelpCircle,
  Store,
  AlertTriangle,
  Maximize2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useShop } from '../context/ShopContext';
import { formatCurrency } from '../lib/accounting';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageDataUrl?: string;
  imageMimeType?: string;
  timestamp: string;
  isError?: boolean;
}

const STORAGE_KEY = 'radhamadhab_ai_chat_v1';
const SYNC_EVENT = 'radhamadhab-ai-chat-updated';

function readStoredMessages(): AiChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredMessages(messages: AiChatMessage[]) {
  try {
    // Keep last 40 messages; omit oversized base64 thumbnails if needed to avoid quota overflow
    const trimmed = messages.slice(-40).map(m => ({
      ...m,
      imageDataUrl: m.imageDataUrl && m.imageDataUrl.length > 250000 ? undefined : m.imageDataUrl,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Pure React safe Markdown/Math response formatter (no dangerouslySetInnerHTML).
 */
function renderInlineTokens(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${keyIdx++}`} className="font-extrabold text-amber-300">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-700 font-mono text-[12px] text-emerald-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function FormattedAiMessage({ text }: { text: string }) {
  if (!text) return null;

  // Split out fenced code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed break-words">
      {segments.map((segment, segIdx) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const inner = segment.slice(3, -3).replace(/^[a-zA-Z0-9_-]*\n/, '');
          return (
            <pre
              key={`pre-${segIdx}`}
              className="p-3 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap"
            >
              {inner}
            </pre>
          );
        }

        const lines = segment.split('\n');
        return (
          <div key={`blk-${segIdx}`} className="space-y-1">
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={`sp-${lineIdx}`} className="h-1" />;
              }

              if (/^#{1,3}\s+/.test(trimmed)) {
                const headingText = trimmed.replace(/^#{1,3}\s+/, '');
                return (
                  <div key={`h-${lineIdx}`} className="font-bold text-amber-300 pt-1 text-sm">
                    {renderInlineTokens(headingText)}
                  </div>
                );
              }

              if (/^[-*•]\s+/.test(trimmed)) {
                const itemText = trimmed.replace(/^[-*•]\s+/, '');
                return (
                  <div key={`ul-${lineIdx}`} className="flex items-start gap-2 pl-1">
                    <span className="text-amber-400 font-bold mt-0.5">•</span>
                    <span className="flex-1">{renderInlineTokens(itemText)}</span>
                  </div>
                );
              }

              const numMatch = trimmed.match(/^(\d+[.)])\s+(.*)$/);
              if (numMatch) {
                return (
                  <div key={`ol-${lineIdx}`} className="flex items-start gap-2 pl-1">
                    <span className="text-blue-400 font-mono font-bold text-xs mt-0.5 shrink-0">
                      {numMatch[1]}
                    </span>
                    <span className="flex-1">{renderInlineTokens(numMatch[2])}</span>
                  </div>
                );
              }

              return <p key={`p-${lineIdx}`}>{renderInlineTokens(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

interface AiChatContentProps {
  compact?: boolean;
  onExpandFull?: () => void;
  onCloseWidget?: () => void;
}

export const AiChatContent: React.FC<AiChatContentProps> = ({
  compact = false,
  onExpandFull,
  onCloseWidget,
}) => {
  const { language } = useLanguage();
  const { todaySummary, totalYouWillGet, totalYouWillGive, shopSettings } = useShop();

  const [messages, setMessages] = useState<AiChatMessage[]>(() => readStoredMessages());
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [includeShopContext, setIncludeShopContext] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync across full view & floating drawer
  useEffect(() => {
    const handleSync = () => {
      if (!isStreaming) {
        setMessages(readStoredMessages());
      }
    };
    window.addEventListener(SYNC_EVENT, handleSync);
    return () => window.removeEventListener(SYNC_EVENT, handleSync);
  }, [isStreaming]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const buildShopContextString = useCallback(() => {
    if (!includeShopContext) return undefined;
    return [
      `Shop: ${shopSettings.shopName}`,
      `Date: ${todaySummary.date}`,
      `Cash in Hand: ${formatCurrency(todaySummary.closingCash)}`,
      `Bank Balance: ${formatCurrency(todaySummary.closingBank)}`,
      `Today Income: ${formatCurrency(todaySummary.todayIncome)}`,
      `Today Expense: ${formatCurrency(todaySummary.todayExpense)}`,
      `Today Net Profit: ${formatCurrency(todaySummary.todayNetProfit, true)}`,
      `Khata Receivable (You will get): ${formatCurrency(totalYouWillGet)}`,
      `Khata Payable (You will give): ${formatCurrency(totalYouWillGive)}`,
    ].join(' | ');
  }, [includeShopContext, shopSettings.shopName, todaySummary, totalYouWillGet, totalYouWillGive]);

  const quickPrompts = [
    {
      label: language === 'bn' ? 'দোকান বিল ও ছাড়' : 'Bill & % Discount',
      prompt:
        language === 'bn'
          ? '৩টি আইটেম দাম ৪৫০, ৩২০, ২৩০ টাকা, ১৮% GST যোগ করে ১০% ডিসকাউন্ট দিলে মোট কত হবে?'
          : '3 items cost ₹450, ₹320, ₹230. Add 18% GST and give 10% discount. What is the final bill?',
    },
    {
      label: language === 'bn' ? 'লাভ ও মার্জিন %' : 'Profit & Margin %',
      prompt:
        language === 'bn'
          ? 'কেনা দাম ৮৪০ টাকা আর বিক্রি দাম ১,০৫০ টাকা হলে লাভ ও মার্জিন শতাংশ কত?'
          : 'If cost price is ₹840 and selling price is ₹1,050, calculate exact profit amount and profit %.',
    },
    {
      label: language === 'bn' ? 'সুদ ও EMI হিসাব' : 'Interest & EMI',
      prompt:
        language === 'bn'
          ? '৫০,০০০ টাকা ১২% বার্ষিক সুদে ২৪ মাসের মাসিক EMI ও মোট সুদ কত হবে?'
          : 'Calculate monthly EMI and total interest for ₹50,000 loan at 12% annual interest for 24 months.',
    },
    {
      label: language === 'bn' ? 'জমি / একক পরিবর্তন' : 'Unit & Land Convert',
      prompt:
        language === 'bn'
          ? '১ বিঘা জমি = কত কাঠা ও কত বর্গফুট (West Bengal অনুযায়ী)?'
          : 'Convert 1 Bigha (West Bengal standard) into Katha, Decimal, and Square Feet.',
    },
    {
      label: language === 'bn' ? 'দ্রুত অংক সমাধান' : 'Solve Math Equation',
      prompt:
        language === 'bn'
          ? 'সমাধান করো: (25% of 1600) + (18 * 45) - (1260 / 6)'
          : 'Solve step by step: (25% of 1600) + (18 * 45) - (1260 / 6)',
    },
  ];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(language === 'bn' ? 'দয়া করে শুধু ছবি ফাইল বেছে নিন।' : 'Please select an image file.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setErrorMsg(
        language === 'bn'
          ? 'ছবির সাইজ ৬ MB-এর কম হতে হবে।'
          : 'Image size must be under 6 MB.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
      if (base64) {
        setErrorMsg(null);
        setPendingImage({
          dataUrl,
          base64,
          mimeType: file.type,
          name: file.name,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleClear = () => {
    handleStop();
    setMessages([]);
    setErrorMsg(null);
    writeStoredMessages([]);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const sendMessage = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt !== undefined ? overridePrompt : input).trim();
    if ((!textToSend && !pendingImage) || isStreaming) return;

    setErrorMsg(null);

    const userMsg: AiChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: textToSend || (language === 'bn' ? 'এই ছবিটির হিসাব/প্রশ্ন সমাধান করে দাও।' : 'Solve or explain this image.'),
      imageDataUrl: pendingImage?.dataUrl,
      imageMimeType: pendingImage?.mimeType,
      timestamp: new Date().toISOString(),
    };

    const imageForRequest = pendingImage;
    if (overridePrompt === undefined) {
      setInput('');
    }
    setPendingImage(null);

    const modelMsgId = `m_${Date.now() + 1}`;
    const placeholderModelMsg: AiChatMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      timestamp: new Date().toISOString(),
    };

    const historyForApi = [...messages.filter(m => !m.isError), userMsg].slice(-12).map(m => {
      const isCurrentUserMsg = m.id === userMsg.id;
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;

      if (isCurrentUserMsg && imageForRequest) {
        imageBase64 = imageForRequest.base64;
        imageMimeType = imageForRequest.mimeType;
      } else if (m.imageDataUrl && m.imageMimeType) {
        const idx = m.imageDataUrl.indexOf(',');
        if (idx >= 0) {
          imageBase64 = m.imageDataUrl.slice(idx + 1);
          imageMimeType = m.imageMimeType;
        }
      }

      return {
        role: m.role,
        text: m.text,
        imageBase64,
        imageMimeType,
      };
    });

    const nextWithUser = [...messages, userMsg, placeholderModelMsg];
    setMessages(nextWithUser);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedText = '';

    try {
      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          mode,
          language,
          shopContext: buildShopContextString(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let serverErr = `Server error (${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson?.error) serverErr = errJson.error;
        } catch {
          // keep default
        }
        throw new Error(serverErr);
      }

      if (!response.body) {
        throw new Error('Streaming response body is unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            let payload: any;
            try {
              payload = JSON.parse(jsonStr);
            } catch {
              continue;
            }
            if (payload.error) {
              throw new Error(payload.error);
            }
            if (typeof payload.text === 'string' && payload.text.length > 0) {
              accumulatedText += payload.text;
              setMessages(prev =>
                prev.map(m => (m.id === modelMsgId ? { ...m, text: accumulatedText } : m))
              );
            }
          }
        }
      }

      const finalMessages = [...messages, userMsg, { ...placeholderModelMsg, text: accumulatedText || 'Done.' }];
      setMessages(finalMessages);
      writeStoredMessages(finalMessages);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        const partialMessages = accumulatedText
          ? [...messages, userMsg, { ...placeholderModelMsg, text: accumulatedText }]
          : [...messages, userMsg];
        setMessages(partialMessages);
        writeStoredMessages(partialMessages);
      } else {
        const errMessage = err?.message || 'Failed to get AI response.';
        setErrorMsg(errMessage);
        const failedMessages = [
          ...messages,
          userMsg,
          {
            ...placeholderModelMsg,
            text: errMessage,
            isError: true,
          },
        ];
        setMessages(failedMessages);
        writeStoredMessages(failedMessages);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header Toolbar */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="w-4 h-4 text-slate-950" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white truncate">
              {language === 'bn'
                ? 'AI হিসাব সমাধান ও চ্যাট এজেন্ট'
                : 'AI Calculation Solver & Fast Q&A'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {language === 'bn'
                ? 'যে কোনো অংক, ব্যবসা হিসাব বা প্রশ্ন লিখুন — সাথে সাথে উত্তর পান'
                : 'Any math, shop calculation, bill photo, or question — instant answer'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Speed Mode Toggle */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setMode('fast')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                mode === 'fast'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title={language === 'bn' ? 'সবচেয়ে দ্রুত উত্তর' : 'Ultra-fast direct answer'}
            >
              <Zap className="w-3 h-3" />
              <span>{language === 'bn' ? 'দ্রুত' : 'Fast'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('deep')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                mode === 'deep'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title={language === 'bn' ? 'বিস্তারিত ধাপে ধাপে সমাধান' : 'Deep step-by-step math'}
            >
              <Brain className="w-3 h-3" />
              <span>{language === 'bn' ? 'বিস্তারিত' : 'Step-by-Step'}</span>
            </button>
          </div>

          {/* Live Shop Context Toggle */}
          <button
            type="button"
            onClick={() => setIncludeShopContext(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
              includeShopContext
                ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={
              language === 'bn'
                ? 'আজকের ক্যাশ, ব্যাংক ও খাতা হিসাব AI-কে জানান'
                : 'Include today’s Cash, Bank & Khata summary for shop questions'
            }
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {language === 'bn' ? 'দোকান ডাটা' : 'Shop Data'}
            </span>
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
              title={language === 'bn' ? 'চ্যাট মুছুন' : 'Clear Chat'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {compact && onExpandFull && (
            <button
              type="button"
              onClick={onExpandFull}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title={language === 'bn' ? 'বড় স্ক্রিনে খুলুন' : 'Open Full View'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {compact && onCloseWidget && (
            <button
              type="button"
              onClick={onCloseWidget}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-4 space-y-4 ${
          compact ? 'min-h-[280px] max-h-[420px]' : 'min-h-[380px] max-h-[calc(100vh-21rem)]'
        }`}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-blue-600/20 border border-amber-500/30 flex items-center justify-center">
              <Calculator className="w-7 h-7 text-amber-400" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="text-base font-bold text-white">
                {language === 'bn'
                  ? 'যেকোনো হিসাব বা প্রশ্ন করুন'
                  : 'Ask Any Calculation or Question'}
              </h4>
              <p className="text-xs text-slate-400">
                {language === 'bn'
                  ? 'অংক, GST, % ছাড়, সুদ, বিঘা-কাঠা, লাভ-ক্ষতি, ছবি থেকে বিল হিসাব বা যে কোনো সাধারণ প্রশ্ন।'
                  : 'Arithmetic, GST, discounts, interest/EMI, land conversions, profit margins, bill photo math, or any general question.'}
              </p>
            </div>

            <div className="w-full max-w-xl flex flex-wrap items-center justify-center gap-2 pt-1">
              {quickPrompts.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(chip.prompt)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : msg.isError
                      ? 'bg-rose-950/70 border border-rose-500/40 text-rose-200 rounded-bl-sm'
                      : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-sm'
                  }`}
                >
                  {msg.imageDataUrl && (
                    <img
                      src={msg.imageDataUrl}
                      alt="Uploaded problem"
                      className="max-h-48 rounded-xl mb-2 border border-white/20 object-contain"
                    />
                  )}

                  {isUser ? (
                    <p className="text-sm font-medium whitespace-pre-wrap break-words">{msg.text}</p>
                  ) : msg.text ? (
                    <FormattedAiMessage text={msg.text} />
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold py-0.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>{language === 'bn' ? 'হিসাব করছে...' : 'Solving fast...'}</span>
                    </div>
                  )}

                  {!isUser && msg.text && !msg.isError && (
                    <div className="mt-2 pt-1.5 border-t border-slate-700/70 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="text-[11px] font-semibold text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">
                              {language === 'bn' ? 'কপি হয়েছে' : 'Copied'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{language === 'bn' ? 'কপি' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pending Image Preview */}
      {pendingImage && (
        <div className="px-4 py-2 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={pendingImage.dataUrl}
              alt={pendingImage.name}
              className="w-11 h-11 rounded-lg object-cover border border-slate-700 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{pendingImage.name}</div>
              <div className="text-[11px] text-amber-400">
                {language === 'bn' ? 'ছবিটি হিসাব করার জন্য প্রস্তুত' : 'Photo attached for solving'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Composer Input Bar */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer shrink-0"
            title={
              language === 'bn'
                ? 'অংক বা বিলের ছবি আপলোড করুন'
                : 'Upload math / bill photo'
            }
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            placeholder={
              language === 'bn'
                ? 'অংক বা প্রশ্ন লিখুন (যেমন: 1850 এর 18% GST কত? বা যেকোনো প্রশ্ন)...'
                : 'Type any calculation or question (e.g. 18% GST on 1850, EMI, or ask anything)...'
            }
            className="flex-1 min-h-[42px] max-h-32 resize-y rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>{language === 'bn' ? 'থামান' : 'Stop'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() && !pendingImage}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-45 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>{language === 'bn' ? 'সমাধান' : 'Solve'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
