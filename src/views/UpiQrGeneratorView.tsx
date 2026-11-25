import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  QrCode,
  Download,
  Share2,
  Printer,
  ExternalLink,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  Check,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  Building2,
  Store,
  Copy,
  Sparkles,
  Smartphone,
  CreditCard,
  X,
  Camera,
  Upload,
  Layers,
  CheckCircle2,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UpiAccount } from '../types';
import { formatCurrency, formatShopName } from '../lib/accounting';
import { getTodayDateString } from '../data/defaults';

export const UpiQrGeneratorView: React.FC = () => {
  const { user } = useAuth();
  const {
    shopSettings,
    updateShopSettings,
    addTransaction,
    categories,
    khataParties,
    addKhataEntry,
  } = useShop();
  const { language } = useLanguage();

  const effectiveShopName = formatShopName(user?.shopName || shopSettings.shopName || 'My Shop');
  const storageKey = user?.id ? `radhamadhab_upi_accounts_v2_${user.id}` : 'radhamadhab_upi_accounts_v2_guest';

  // Accounts state (starts empty [] -> Saved Accounts (0) until user saves an account)
  const [accounts, setAccounts] = useState<UpiAccount[]>(() => {
    if (Array.isArray(shopSettings.upiAccounts)) {
      return shopSettings.upiAccounts;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    const defaultAcc = accounts.find(a => a.isDefault) || accounts[0];
    return defaultAcc?.id || '';
  });

  // Sync accounts when user or remote shopSettings updates
  useEffect(() => {
    if (Array.isArray(shopSettings.upiAccounts)) {
      setAccounts(shopSettings.upiAccounts);
      setSelectedAccountId(prev => {
        if (prev && shopSettings.upiAccounts!.some(a => a.id === prev)) return prev;
        const def = shopSettings.upiAccounts!.find(a => a.isDefault) || shopSettings.upiAccounts![0];
        return def?.id || '';
      });
    } else {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setAccounts(parsed);
            const def = parsed.find((a: UpiAccount) => a.isDefault) || parsed[0];
            setSelectedAccountId(def?.id || '');
            return;
          }
        }
      } catch {
        // ignore
      }
      setAccounts([]);
      setSelectedAccountId('');
    }
  }, [user?.id, shopSettings.upiAccounts, storageKey]);

  // Active account
  const activeAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0] || null;

  // Account creation / edit form state (UPI ID box is always clear by default for new entries)
  const [inputMode, setInputMode] = useState<'manual' | 'scan' | 'upload'>('manual');
  const [formShopName, setFormShopName] = useState(effectiveShopName);
  const [formUpiId, setFormUpiId] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isEditingFormVisible, setIsEditingFormVisible] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Keep default shop name updated when user/shopSettings loads and not editing
  useEffect(() => {
    if (!editingAccountId && !formUpiId) {
      setFormShopName(effectiveShopName);
    }
  }, [effectiveShopName, editingAccountId, formUpiId]);

  // Amount & Note state
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Record Payment to Accounts State
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [recordAmount, setRecordAmount] = useState('');
  const [recordCategory, setRecordCategory] = useState('Digital Service');
  const [recordPaymentMethod, setRecordPaymentMethod] = useState<'bank' | 'cash'>('bank');
  const [recordNote, setRecordNote] = useState('');
  const [recordKhataPartyId, setRecordKhataPartyId] = useState('');

  // QR rendering state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [upiUri, setUpiUri] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);

  // Camera Scanning State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Persist accounts to shop profile and user-scoped localStorage
  const persistAccounts = (newAccounts: UpiAccount[], activeUpi?: string) => {
    setAccounts(newAccounts);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newAccounts));
    } catch {
      // ignore
    }
    const primaryUpi =
      activeUpi !== undefined
        ? activeUpi
        : newAccounts.find(a => a.id === selectedAccountId)?.upiId ||
          newAccounts.find(a => a.isDefault)?.upiId ||
          newAccounts[0]?.upiId ||
          '';
    updateShopSettings({
      upiAccounts: newAccounts,
      upiId: primaryUpi,
    });
  };

  // Clean UPI ID validation
  const isValidUpiId = (upi: string): boolean => {
    if (!upi) return false;
    const clean = upi.trim();
    const regex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$/;
    return regex.test(clean);
  };

  // Helper to extract UPI details from standard URI
  const parseUpiUri = (rawText: string) => {
    try {
      const clean = rawText.trim();
      let queryStr = clean;
      if (clean.startsWith('upi://pay?')) {
        queryStr = clean.slice('upi://pay?'.length);
      } else if (clean.includes('?')) {
        queryStr = clean.split('?')[1];
      }
      const params = new URLSearchParams(queryStr);
      const pa = params.get('pa');
      const pn = params.get('pn');
      const am = params.get('am');

      if (pa) {
        setFormUpiId(pa);
        if (pn) setFormShopName(pn);
        if (am) setAmount(am);
        showToast(`QR detected! UPI ID: ${pa}`);
        setInputMode('manual');
        return true;
      }
    } catch (e) {
      console.error('Failed to parse UPI URI', e);
    }
    return false;
  };

  const previewUpiId = (formUpiId.trim() || activeAccount?.upiId || '').trim();
  const previewShopName = (
    formUpiId.trim()
      ? formShopName.trim() || effectiveShopName
      : activeAccount?.shopName || formShopName.trim() || effectiveShopName
  ).trim();

  // Generate UPI Payment URI and QR code
  useEffect(() => {
    const cleanUpi = previewUpiId;
    const cleanName = previewShopName;

    if (!cleanUpi) {
      setQrError('Add a UPI account to create your QR');
      setQrDataUrl('');
      setUpiUri('');
      return;
    }

    if (!isValidUpiId(cleanUpi)) {
      setQrError('Invalid UPI ID format. Expected format: name@bank');
      setQrDataUrl('');
      setUpiUri('');
      return;
    }

    setQrError(null);

    // Build compliant UPI URI
    const params = new URLSearchParams();
    params.set('pa', cleanUpi);
    params.set('pn', cleanName);
    params.set('cu', 'INR');

    const cleanAmount = parseFloat(amount);
    if (!isNaN(cleanAmount) && cleanAmount > 0) {
      const formattedAm = cleanAmount % 1 === 0 ? cleanAmount.toString() : cleanAmount.toFixed(2);
      params.set('am', formattedAm);
    }

    if (note && note.trim()) {
      params.set('tn', note.trim());
    }

    const generatedUri = `upi://pay?${params.toString()}`;
    setUpiUri(generatedUri);

    // Generate high-resolution QR code data URL
    QRCode.toDataURL(generatedUri, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(url => {
        setQrDataUrl(url);
      })
      .catch(err => {
        console.error('Failed to generate QR code', err);
        setQrError('Failed to generate QR code image.');
      });
  }, [previewUpiId, previewShopName, amount, note]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Quick Amount Handlers
  const handleSetQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleClearAmount = () => {
    setAmount('');
    showToast('Amount cleared. Reusable Shop QR is active.');
  };

  // Reset / Cancel Form
  const handleCancelForm = () => {
    setEditingAccountId(null);
    setFormShopName(effectiveShopName);
    setFormUpiId('');
    setFormError(null);
    setInputMode('manual');
    stopCamera();
  };

  // Save Account (Create or Update)
  const handleSaveAccount = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUpi = formUpiId.trim();
    const cleanName = formatShopName(formShopName.trim()) || effectiveShopName;

    if (!cleanUpi) {
      setFormError('UPI ID is mandatory. Please enter a valid UPI ID.');
      return;
    }

    if (!isValidUpiId(cleanUpi)) {
      setFormError('Invalid UPI ID (e.g. mobile@upi, name@okaxis, shop@paytm).');
      return;
    }

    if (editingAccountId) {
      // Update existing
      const updated = accounts.map(a => {
        if (a.id === editingAccountId) {
          return {
            ...a,
            shopName: cleanName,
            upiId: cleanUpi,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });
      persistAccounts(updated, cleanUpi);
      setEditingAccountId(null);
      setFormShopName(effectiveShopName);
      setFormUpiId('');
      showToast('UPI Account updated and saved to shop profile.');
    } else {
      // Check for duplicate UPI ID
      const existing = accounts.find(a => a.upiId.toLowerCase() === cleanUpi.toLowerCase());
      if (existing) {
        setSelectedAccountId(existing.id);
        setFormShopName(effectiveShopName);
        setFormUpiId('');
        showToast('Account already exists and is now selected.');
      } else {
        const newAcc: UpiAccount = {
          id: `acc_${Date.now()}`,
          shopName: cleanName,
          upiId: cleanUpi,
          isDefault: accounts.length === 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updated = [newAcc, ...accounts];
        setSelectedAccountId(newAcc.id);
        persistAccounts(updated, cleanUpi);
        setFormShopName(effectiveShopName);
        setFormUpiId('');
        showToast('New UPI Account saved to shop profile successfully.');
      }
    }

    setFormError(null);
    setInputMode('manual');
  };

  // Delete Account (allows deleting down to 0 accounts)
  const handleDeleteAccount = (accId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = accounts.filter(a => a.id !== accId);
    if (editingAccountId === accId) {
      setEditingAccountId(null);
      setFormShopName(effectiveShopName);
      setFormUpiId('');
    }
    let nextId = selectedAccountId;
    if (selectedAccountId === accId || !filtered.some(a => a.id === selectedAccountId)) {
      const nextAcc = filtered.find(a => a.isDefault) || filtered[0];
      nextId = nextAcc ? nextAcc.id : '';
      setSelectedAccountId(nextId);
    }
    const nextUpi = filtered.find(a => a.id === nextId)?.upiId || '';
    persistAccounts(filtered, nextUpi);
    showToast('UPI Account deleted from shop profile.');
  };

  // Open Record Payment Modal
  const handleOpenRecordPayment = () => {
    setRecordAmount(amount || '');
    setRecordNote(note || `UPI QR Payment (${previewUpiId || 'UPI'})`);
    setIsRecordPaymentModalOpen(true);
  };

  // Confirm Record Payment to Accounts
  const handleConfirmRecordPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amt = parseFloat(recordAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount greater than 0');
      return;
    }
    const cleanUpi = activeAccount?.upiId || formUpiId || 'UPI';

    // 1. Add Transaction to shop accounting
    const txnType = recordPaymentMethod === 'bank' ? 'bank_in' : 'cash_in';
    const linkedParty = recordKhataPartyId ? khataParties.find(p => p.id === recordKhataPartyId) : undefined;
    addTransaction({
      date: getTodayDateString(),
      time: new Date().toTimeString().slice(0, 5),
      type: txnType,
      category: recordCategory || 'Digital Service',
      serviceName: 'UPI Payment QR',
      amount: amt,
      paymentMethod: recordPaymentMethod,
      customerName: linkedParty?.name,
      customerMobile: linkedParty?.mobile,
      note: recordNote.trim() || `UPI QR Payment received (${cleanUpi})`,
    });

    // 2. If Khata party is linked, credit customer ledger (you_got)
    if (recordKhataPartyId) {
      const party = khataParties.find(p => p.id === recordKhataPartyId);
      if (party) {
        addKhataEntry({
          partyId: party.id,
          type: 'you_got',
          amount: amt,
          date: getTodayDateString(),
          time: new Date().toTimeString().slice(0, 5),
          note: `Paid via UPI QR (${cleanUpi})`,
          paymentMethod: recordPaymentMethod,
        });
      }
    }

    setIsRecordPaymentModalOpen(false);
    showToast(`₹${amt} saved to ${recordPaymentMethod === 'bank' ? 'Bank Balance' : 'Cash Balance'}!`);
  };

  // Start Live Camera QR Scanner
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Start frame scanning loop
      const scanCanvas = document.createElement('canvas');
      const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

      scanIntervalRef.current = window.setInterval(() => {
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA || !scanCtx) {
          return;
        }
        scanCanvas.width = videoRef.current.videoWidth;
        scanCanvas.height = videoRef.current.videoHeight;
        scanCtx.drawImage(videoRef.current, 0, 0, scanCanvas.width, scanCanvas.height);
        const imgData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const success = parseUpiUri(code.data);
          if (success) {
            stopCamera();
          }
        }
      }, 300);
    } catch (err: any) {
      console.error('Camera access error', err);
      setCameraError('Camera access denied or unavailable. Please enter UPI ID manually or upload an image.');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Handle Upload QR Image File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          const success = parseUpiUri(code.data);
          if (!success) {
            // Check if plain UPI ID was encoded
            if (isValidUpiId(code.data.trim())) {
              setFormUpiId(code.data.trim());
              showToast(`UPI ID found: ${code.data.trim()}`);
              setInputMode('manual');
            } else {
              showToast('Scanned QR data: ' + code.data);
            }
          }
        } else {
          showToast('Could not detect a QR code in this image. Please enter manually.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input value
    e.target.value = '';
  };

  // Copy UPI ID
  const handleCopyUpiId = () => {
    const upi = previewUpiId;
    if (!upi) return;
    navigator.clipboard.writeText(upi);
    setCopiedUpi(true);
    showToast('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 1800);
  };

  // Download Standee PNG (AkPrintHub Reference Card)
  const handleDownloadQrPng = async () => {
    if (!qrDataUrl) return;
    setIsGeneratingDownload(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1450;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top Header Gradient (AkPrintHub signature purple-blue)
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 240);
      grad.addColorStop(0, '#5b45ff');
      grad.addColorStop(0.5, '#7c3aed');
      grad.addColorStop(1, '#2563eb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, 240);

      // Header Texts
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BHIM UPI PAYMENT LOCK QR', canvas.width / 2, 75);

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 48px sans-serif';
      const shopDisplayName = previewShopName || effectiveShopName;
      ctx.fillText(shopDisplayName.toUpperCase(), canvas.width / 2, 140);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = '600 24px sans-serif';
      ctx.fillText('SCAN & PAY USING ANY UPI APP', canvas.width / 2, 190);

      // Card Box
      const cardX = 90;
      const cardY = 280;
      const cardW = 820;
      const cardH = 830;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 36);
      ctx.fill();
      ctx.stroke();

      // Amount Badge
      const numAmt = parseFloat(amount);
      if (!isNaN(numAmt) && numAmt > 0) {
        ctx.fillStyle = '#ecfdf5';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 250, cardY + 30, 500, 75, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#047857';
        ctx.font = '900 36px sans-serif';
        ctx.fillText(`🔒 AMOUNT LOCKED: ₹${numAmt.toLocaleString('en-IN')}`, canvas.width / 2, cardY + 80);
      } else {
        ctx.fillStyle = '#eff6ff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 240, cardY + 30, 480, 75, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1d4ed8';
        ctx.font = '900 32px sans-serif';
        ctx.fillText('⚡ REUSABLE SHOP PAYMENT QR', canvas.width / 2, cardY + 80);
      }

      // Draw QR Code
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise(res => {
        qrImg.onload = res;
      });

      const qrSize = 520;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = cardY + 140;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // UPI ID below QR
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`UPI ID: ${previewUpiId}`, canvas.width / 2, cardY + 720);

      // Supported Apps Strip
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 1150, canvas.width, 170);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('ACCEPTED THROUGH ALL MAJOR UPI APPS', canvas.width / 2, 1195);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('Google Pay   ·   PhonePe   ·   Paytm   ·   BHIM   ·   Cred   ·   Amazon Pay', canvas.width / 2, 1260);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '500 20px sans-serif';
      ctx.fillText('Direct Bank Account Transfer  •  Verified Merchant  •  Zero Gateway Fee', canvas.width / 2, 1380);

      const standeeUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${shopDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-upi-payment-qr.png`;
      link.href = standeeUrl;
      link.click();
      showToast('Payment Standee PNG downloaded successfully!');
    } catch (err) {
      console.error('Download error', err);
      const link = document.createElement('a');
      link.download = 'upi-payment-qr.png';
      link.href = qrDataUrl;
      link.click();
      showToast('QR Code PNG downloaded.');
    } finally {
      setIsGeneratingDownload(false);
    }
  };

  // Share QR
  const handleShareQr = async () => {
    if (!upiUri) return;
    const shopDisplayName = previewShopName || effectiveShopName;
    const shareText = `Pay to ${shopDisplayName} via UPI (${previewUpiId})${
      amount ? ` for ₹${amount}` : ''
    }. Payment Link: ${upiUri}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `UPI Payment - ${shopDisplayName}`,
          text: shareText,
          url: upiUri,
        });
        showToast('Shared successfully!');
        return;
      } catch {
        // cancelled, fallback to copy
      }
    }
    navigator.clipboard.writeText(shareText);
    showToast('Payment details copied to clipboard to share!');
  };

  // Print Standee
  const handlePrintQr = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 border border-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for QR Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Camera Scanner Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span>Scan Physical QR Standee</span>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cameraError ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {cameraError}
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square border-2 border-indigo-500/50 flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                <div className="absolute inset-8 border-2 border-dashed border-amber-400 rounded-xl pointer-events-none animate-pulse" />
                <div className="absolute bottom-3 left-0 right-0 text-[11px] font-bold text-white/90 bg-black/60 py-1">
                  Point camera at any UPI QR Standee
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={stopCamera}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Close Scanner
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          TOP HEADER: AkPrintHub Style "Payment Lock QR"
          ======================================================== */}
      <div className="text-center space-y-2.5 pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-black uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>FREE BROWSER TOOL</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Payment Lock QR
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          Select a UPI ID, enter an amount and create a scan-ready payment QR instantly.
        </p>
      </div>

      {/* ========================================================
          TWO-COLUMN MAIN SECTION (AkPrintHub Layout)
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================
            LEFT COLUMN (5 Cols): Live payment QR Card
            ======================================================== */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden transition-all">
          {/* Purple-Blue Gradient Header matching screenshot */}
          <div className="bg-gradient-to-r from-[#5b45ff] via-[#7042f4] to-[#1e70eb] px-5 py-4 flex items-center justify-between text-white shadow-sm">
            <span className="font-extrabold text-sm tracking-wide">Live payment QR</span>
            <button
              type="button"
              onClick={() => {
                setEditingAccountId(null);
                setFormShopName(effectiveShopName);
                setFormUpiId('');
                setIsEditingFormVisible(true);
                setInputMode('manual');
              }}
              className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white font-black text-[10px] uppercase tracking-wider backdrop-blur-sm transition-all cursor-pointer"
            >
              ADD ACCOUNT
            </button>
          </div>

          {/* Card Body */}
          <div className="p-6 sm:p-7 text-center space-y-4">
            {/* Title & Dash */}
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {previewShopName || effectiveShopName}
              </h2>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {previewUpiId || '—'}
              </div>
            </div>

            {/* Square QR Container (white card with soft shadow) */}
            <div className="bg-white p-5 rounded-3xl shadow-md border border-slate-100 max-w-[320px] mx-auto min-h-[300px] flex flex-col items-center justify-center relative">
              {qrDataUrl && previewUpiId ? (
                <div className="space-y-2">
                  <div className="relative">
                    <img
                      src={qrDataUrl}
                      alt="UPI Payment QR"
                      className="w-56 h-56 sm:w-60 sm:h-60 object-contain mx-auto rounded-lg"
                    />
                    {/* Small Center UPI Badge */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-xl bg-white p-1 shadow-md border border-slate-200 flex items-center justify-center">
                        <div className="w-full h-full rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-black text-white text-[10px] font-mono">
                          UPI
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Amount Lock indicator badge */}
                  {amount && parseFloat(amount) > 0 ? (
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>Locked: {formatCurrency(parseFloat(amount))}</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                      <Unlock className="w-3 h-3 text-blue-600" />
                      <span>Scan & Pay any amount</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty state matching the reference screenshot exactly */
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="grid grid-cols-2 gap-1.5 opacity-30">
                    <div className="w-4 h-4 rounded-sm bg-slate-900 dark:bg-slate-700" />
                    <div className="w-4 h-4 rounded-sm bg-slate-900 dark:bg-slate-700" />
                    <div className="w-4 h-4 rounded-sm bg-slate-900 dark:bg-slate-700" />
                    <div className="w-4 h-4 rounded-sm bg-slate-900 dark:bg-slate-700" />
                  </div>
                  <p className="text-xs font-semibold text-slate-400 max-w-[180px]">
                    Add a UPI account to create your QR
                  </p>
                </div>
              )}
            </div>

            {/* 3 Action Buttons matching AkPrintHub */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadQrPng}
                disabled={!qrDataUrl || isGeneratingDownload}
                className="py-2 px-2.5 rounded-xl bg-[#ede9fe] hover:bg-[#ddd6fe] text-[#6d28d9] dark:bg-indigo-950/70 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0 text-[#6d28d9] dark:text-indigo-400" />
                <span className="text-[11px] font-black leading-tight text-center">
                  Download<br />PNG
                </span>
              </button>

              <button
                type="button"
                onClick={handleShareQr}
                disabled={!upiUri}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="text-xs">Share</span>
              </button>

              <button
                type="button"
                onClick={handlePrintQr}
                disabled={!qrDataUrl}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="text-xs">Print</span>
              </button>
            </div>

            {/* Full-width "Open in UPI app" Button matching reference screenshot */}
            <div className="pt-1">
              {upiUri ? (
                <a
                  href={upiUri}
                  className="w-full py-3 px-4 rounded-xl bg-slate-400 hover:bg-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all no-underline cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open in UPI app</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl bg-slate-300 dark:bg-slate-800 text-slate-500 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open in UPI app</span>
                </button>
              )}
            </div>

            {/* Record Received Payment to Accounts Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenRecordPayment}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>
                  {language === 'en'
                    ? amount && parseFloat(amount) > 0
                      ? `Save ₹${amount} to Bank Accounts`
                      : 'Save Payment to Bank Accounts'
                    : amount && parseFloat(amount) > 0
                      ? `₹${amount} অ্যাকাউন্টে জমা রেকর্ড করুন`
                      : 'অ্যাকাউন্টে টাকা জমা রেকর্ড করুন'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN (7 Cols): Your UPI accounts & Amount Card
            ======================================================== */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 transition-all">
          {/* Top Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
              Your UPI accounts
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingAccountId(null);
                setFormShopName(effectiveShopName);
                setFormUpiId('');
                setIsEditingFormVisible(true);
                setInputMode('manual');
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add new account</span>
            </button>
          </div>

          {/* Segmented Mode Selector: Manual | Scan QR | Upload QR */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setInputMode('manual');
                stopCamera();
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                inputMode === 'manual'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Manual</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInputMode('scan');
                startCamera();
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                inputMode === 'scan'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan QR</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInputMode('upload');
                stopCamera();
                fileInputRef.current?.click();
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                inputMode === 'upload'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload QR</span>
            </button>
          </div>

          {/* Form Fields: Shop / receiver name & UPI ID */}
          <form onSubmit={handleSaveAccount} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Shop / receiver name
              </label>
              <input
                type="text"
                value={formShopName}
                onChange={e => {
                  const input = e.target;
                  const start = input.selectionStart;
                  setFormShopName(formatShopName(input.value));
                  if (start !== null) {
                    requestAnimationFrame(() => {
                      try { input.setSelectionRange(start, start); } catch {}
                    });
                  }
                }}
                placeholder="Your Shop Name"
                className="w-full px-4 py-2.5 rounded-xl border border-indigo-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                UPI ID
              </label>
              <input
                type="text"
                value={formUpiId}
                onChange={e => setFormUpiId(e.target.value)}
                placeholder="9876543210@upi"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            {/* Save account & Cancel buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleSaveAccount()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#5b45ff] hover:bg-[#4a34ea] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-95"
              >
                {editingAccountId ? 'Update account' : 'Save account'}
              </button>

              <button
                type="button"
                onClick={handleCancelForm}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs sm:text-sm transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Saved Accounts Switcher List (always visible, starts at 0) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Saved Accounts ({accounts.length})
            </div>
            {accounts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {accounts.map(acc => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setEditingAccountId(null);
                        setFormShopName(effectiveShopName);
                        setFormUpiId('');
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{acc.shopName}</span>
                      <span className="font-mono text-[11px] opacity-75">({acc.upiId})</span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingAccountId(acc.id);
                          setFormShopName(acc.shopName);
                          setFormUpiId(acc.upiId);
                          setInputMode('manual');
                        }}
                        className="hover:text-indigo-500 p-0.5 cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={e => handleDeleteAccount(acc.id, e)}
                        className="hover:text-rose-500 p-0.5 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No saved UPI accounts yet. Enter a UPI ID above and click Save account.
              </p>
            )}
          </div>

          {/* Amount (optional) Section matching reference screenshot */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Amount (optional)
              </span>
              {amount && (
                <button
                  type="button"
                  onClick={handleClearAmount}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Clear amount
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="₹ 0.00"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            {/* Quick Amount Pills: ₹10, ₹50, ₹100, ₹200, ₹500 */}
            <div className="grid grid-cols-5 gap-2">
              {[10, 50, 100, 200, 500].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetQuickAmount(val)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    amount === val.toString()
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ₹{val}
                </button>
              ))}
            </div>
          </div>

          {/* Green Security Notice matching reference screenshot */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 leading-relaxed">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Your UPI ID and name are saved only in this browser. No payment details are sent to the server to generate the QR.
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          BOTTOM CARD: "How to use" matching reference screenshot
          ======================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 transition-all">
        <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
          How to use
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
            <div className="w-6 h-6 rounded-full bg-[#5b45ff] text-white flex items-center justify-center font-bold text-xs">
              1
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              Add the receiver name and a valid UPI ID.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
            <div className="w-6 h-6 rounded-full bg-[#5b45ff] text-white flex items-center justify-center font-bold text-xs">
              2
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              Enter an amount for fixed payment, or leave it blank for a reusable shop QR.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
            <div className="w-6 h-6 rounded-full bg-[#5b45ff] text-white flex items-center justify-center font-bold text-xs">
              3
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              Download, share or print the QR and test it once with ₹1.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          RECORD RECEIVED PAYMENT TO ACCOUNTS MODAL
          ======================================================== */}
      {isRecordPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-900 dark:text-white animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                    {language === 'en' ? 'Record Payment in Shop Accounts' : 'দোকানের অ্যাকাউন্টে জমা রেকর্ড করুন'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {activeAccount?.shopName} • {activeAccount?.upiId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRecordPayment} className="space-y-3.5">
              {/* Amount */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'en' ? 'Received Amount (₹)' : 'প্রাপ্ত টাকার পরিমাণ (₹)'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={recordAmount}
                  onChange={e => setRecordAmount(e.target.value)}
                  placeholder="₹ 0.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              {/* Account Destination: Bank (Default) vs Cash */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'en' ? 'Deposit Into Account' : 'কোন অ্যাকাউন্টে জমা হবে'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordPaymentMethod('bank')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      recordPaymentMethod === 'bank'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Bank Account (UPI)' : 'ব্যাংক অ্যাকাউন্ট (UPI)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      recordPaymentMethod === 'cash'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Cash Box' : 'নগদ ক্যাশ বাক্স'}</span>
                  </button>
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'en' ? 'Category' : 'ক্যাটেগরি'}
                </label>
                <select
                  value={recordCategory}
                  onChange={e => setRecordCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                >
                  <option value="Digital Service">Digital Service / অনলাইন সার্ভিস</option>
                  <option value="Xerox">Xerox / জেরক্স</option>
                  <option value="Print">Print / প্রিন্ট</option>
                  <option value="Photo">Photo / ফটো</option>
                  <option value="Recharge">Mobile Recharge / রিচার্জ</option>
                  <option value="Money Transfer">Money Transfer / মানি ট্রান্সফার</option>
                  <option value="Lamination">Lamination / লেমিনেশন</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.nameBn ? `(${c.nameBn})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Khata Customer Link */}
              {khataParties && khataParties.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === 'en' ? 'Link to Khata Customer (Optional)' : 'খাতাবুক গ্রাহকের সাথে লিংক (ঐচ্ছিক)'}
                  </label>
                  <select
                    value={recordKhataPartyId}
                    onChange={e => setRecordKhataPartyId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none"
                  >
                    <option value="">{language === 'en' ? 'None (Direct Shop Income)' : 'কোনটি নয় (সরাসরি দোকানের আয়)'}</option>
                    {khataParties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.mobile ? `(+91 ${p.mobile})` : ''} — {language === 'en' ? 'Due' : 'বাকি'}: ₹{p.currentBalance}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'en' ? 'Note / Description' : 'মন্তব্য'}
                </label>
                <input
                  type="text"
                  value={recordNote}
                  onChange={e => setRecordNote(e.target.value)}
                  placeholder="e.g. Customer paid via PhonePe QR"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
                >
                  {language === 'en' ? 'Save & Update Balance' : 'জমা করুন ও ব্যালেন্স আপডেট করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
