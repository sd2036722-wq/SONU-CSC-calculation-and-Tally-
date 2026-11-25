import { AppDataPayload, UserProfile } from '../types';
import { generateInitialData, generateCleanShopData, DEFAULT_CATEGORIES, DEFAULT_SHOP_SETTINGS } from '../data/defaults';
import { formatShopName } from './accounting';

const AUTH_STORAGE_KEY = 'radhamadhab_auth_v2';
const OFFLINE_CREDS_KEY = 'radhamadhab_offline_creds_v1';
const getStorageKey = (userId?: string) => `radhamadhab_shop_data_${userId || 'default'}`;
const getPendingSyncKey = (userId?: string) => `radhamadhab_pending_sync_${userId || 'default'}`;

export class ApiClient {
  private static localDataCache: Record<string, AppDataPayload> = {};
  private static isSyncing = false;
  private static pendingSyncData: { data: AppDataPayload; userId?: string } | null = null;

  public static hasPendingSync(userId?: string): boolean {
    try {
      return localStorage.getItem(getPendingSyncKey(userId)) === '1';
    } catch {
      return false;
    }
  }

  public static setPendingSync(userId: string | undefined, pending: boolean): void {
    try {
      const key = getPendingSyncKey(userId);
      if (pending) {
        localStorage.setItem(key, '1');
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
  }

  private static cacheOfflineCredential(mobile: string, password: string | undefined, user: UserProfile): void {
    if (!mobile || !password) return;
    try {
      const raw = localStorage.getItem(OFFLINE_CREDS_KEY);
      const map: Record<string, { password: string; user: UserProfile }> = raw ? JSON.parse(raw) : {};
      map[mobile.trim()] = { password, user };
      localStorage.setItem(OFFLINE_CREDS_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  private static tryOfflineLogin(mobile: string, password?: string): UserProfile | null {
    if (!mobile || !password) return null;
    try {
      const raw = localStorage.getItem(OFFLINE_CREDS_KEY);
      if (!raw) return null;
      const map: Record<string, { password: string; user: UserProfile }> = JSON.parse(raw);
      const entry = map[mobile.trim()];
      if (entry && entry.password === password) {
        return entry.user;
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Helper to ensure full categories & settings compatibility
  private static sanitizePayload(data: AppDataPayload, fallbackShopName?: string, fallbackMobile?: string): AppDataPayload {
    if (!data) return generateInitialData();
    const existingCatIds = new Set((data.categories || []).map(c => c.id));
    const missingCats = DEFAULT_CATEGORIES.filter(c => !existingCatIds.has(c.id));
    const mergedCats = missingCats.length > 0 ? [...(data.categories || []), ...missingCats] : (data.categories || []);

    const fallbackSettings = fallbackShopName
      ? {
          ...DEFAULT_SHOP_SETTINGS,
          shopName: fallbackShopName,
          shopNameBn: fallbackShopName,
          ownerName: fallbackShopName,
          phone: fallbackMobile || '',
          email: fallbackMobile ? `${fallbackMobile}@shop.local` : '',
          address: '',
          receiptFooterMessage: `Thank you for visiting ${fallbackShopName}! Please visit again.`,
          upiId: '',
        }
      : DEFAULT_SHOP_SETTINGS;

    const mergedSettings = { ...fallbackSettings, ...(data.shopSettings || {}) };

    // When registered shop name exists, automatically ensure shop settings reflect this user's shop info
    if (fallbackShopName) {
      if (
        !mergedSettings.shopName ||
        mergedSettings.shopName === 'Radhamadhab Online Center' ||
        mergedSettings.shopName === 'Radha Madhab Online Center' ||
        mergedSettings.shopName === 'Online Center' ||
        mergedSettings.shopName.trim() === ''
      ) {
        mergedSettings.shopName = fallbackShopName;
        mergedSettings.shopNameBn = fallbackShopName;
      }
      if (!mergedSettings.ownerName || mergedSettings.ownerName === 'Arabindu D.' || mergedSettings.ownerName === 'Shop Owner') {
        mergedSettings.ownerName = fallbackShopName;
      }
      if (fallbackMobile && (!mergedSettings.phone || mergedSettings.phone === '9876543210')) {
        mergedSettings.phone = fallbackMobile;
      }
      if (
        !mergedSettings.receiptFooterMessage ||
        mergedSettings.receiptFooterMessage.includes('Radhamadhab') ||
        mergedSettings.receiptFooterMessage.includes('Radha Madhab')
      ) {
        mergedSettings.receiptFooterMessage = `Thank you for visiting ${fallbackShopName}! Please visit again.`;
      }
    }

    return {
      ...data,
      categories: mergedCats,
      shopSettings: mergedSettings,
      dailyBalances: data.dailyBalances || {},
      transactions: data.transactions || [],
      receipts: data.receipts || [],
      khataParties: data.khataParties || [],
      khataEntries: data.khataEntries || [],
    };
  }

  // Read local cache first per user
  public static getLocalData(userId?: string, shopName?: string, mobile?: string): AppDataPayload {
    const key = getStorageKey(userId);
    if (this.localDataCache[key]) {
      return this.localDataCache[key];
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        const clean = this.sanitizePayload(parsed, shopName, mobile);
        this.localDataCache[key] = clean;
        return clean;
      }
    } catch (e) {
      console.warn('Could not read from localStorage', e);
    }

    const initial = shopName
      ? generateCleanShopData({
          shopName,
          shopNameBn: shopName,
          ownerName: shopName,
          phone: mobile || '',
          email: mobile ? `${mobile}@shop.local` : '',
          receiptFooterMessage: `Thank you for visiting ${shopName}! Please visit again.`,
        })
      : generateInitialData();
    this.saveLocalData(initial, userId);
    return initial;
  }

  // Save to local cache per user
  public static saveLocalData(data: AppDataPayload, userId?: string): void {
    const key = getStorageKey(userId);
    const clean = this.sanitizePayload(data);
    this.localDataCache[key] = clean;
    try {
      localStorage.setItem(key, JSON.stringify(clean));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }

  // Fetch full data from server with local fallback
  public static async fetchRemoteData(
    userId?: string,
    token?: string,
    shopName?: string,
    mobile?: string
  ): Promise<{ data: AppDataPayload; isOnline: boolean }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = userId ? `/api/data?userId=${encodeURIComponent(userId)}` : '/api/data';
      const headers: Record<string, string> = {};
      if (userId) headers['x-user-id'] = userId;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const cleanRemote = this.sanitizePayload(json.data, shopName, mobile);
          this.saveLocalData(cleanRemote, userId);
          return { data: cleanRemote, isOnline: true };
        }
      }
    } catch (err) {
      // offline or server unavailable
    }
    return { data: this.getLocalData(userId, shopName, mobile), isOnline: false };
  }

  // Push local updates to server with guaranteed offline queue & retry
  public static async syncToServer(data: AppDataPayload, userId?: string, token?: string): Promise<boolean> {
    this.saveLocalData(data, userId);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setPendingSync(userId, true);
      return false;
    }

    if (this.isSyncing) {
      this.pendingSyncData = { data, userId };
      this.setPendingSync(userId, true);
      return true;
    }

    this.isSyncing = true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userId) headers['x-user-id'] = userId;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = userId ? `/api/data?userId=${encodeURIComponent(userId)}` : '/api/data';
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      this.isSyncing = false;

      if (res.ok) {
        this.setPendingSync(userId, false);
      } else {
        this.setPendingSync(userId, true);
      }

      // If another save occurred during this sync, run it now
      if (this.pendingSyncData) {
        const next = this.pendingSyncData;
        this.pendingSyncData = null;
        return this.syncToServer(next.data, next.userId, token);
      }

      return res.ok;
    } catch (err) {
      this.isSyncing = false;
      this.setPendingSync(userId, true);
      return false;
    }
  }

  // Register a new shopkeeper with exact Shop Name, Mobile, and Password (No OTP)
  public static async register(
    shopName: string,
    mobile: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopName, mobile, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const formattedUser: UserProfile = {
          ...data.user,
          shopName: formatShopName(data.user.shopName || data.user.name || ''),
          name: formatShopName(data.user.name || data.user.shopName || ''),
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(formattedUser));
        this.cacheOfflineCredential(mobile, password, formattedUser);
        if (data.shopData) {
          this.saveLocalData(data.shopData, formattedUser.id);
        } else {
          const cleanName = formattedUser.shopName || formatShopName(shopName);
          const initial = generateCleanShopData({
            shopName: cleanName,
            shopNameBn: cleanName,
            ownerName: formattedUser.name || cleanName,
            phone: formattedUser.phone || mobile,
            email: formattedUser.email || `${mobile}@shop.local`,
            receiptFooterMessage: `Thank you for visiting ${cleanName}! Please visit again.`,
          });
          this.saveLocalData(initial, formattedUser.id);
        }
        return { success: true, user: formattedUser };
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: 'Network error during registration: ' + err.message };
    }
  }

  // Login using Mobile Number and Password only (No OTP) — supports offline cached login
  public static async login(
    mobile: string,
    password?: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success && data.user) {
        const formattedUser: UserProfile = {
          ...data.user,
          shopName: formatShopName(data.user.shopName || data.user.name || ''),
          name: formatShopName(data.user.name || data.user.shopName || ''),
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(formattedUser));
        this.cacheOfflineCredential(mobile, password, formattedUser);
        if (data.shopData && !this.hasPendingSync(formattedUser.id)) {
          this.saveLocalData(data.shopData, formattedUser.id);
        }
        return { success: true, user: formattedUser };
      }
      return { success: false, error: data.error || 'Invalid mobile number or password' };
    } catch (err: any) {
      const offlineUser = this.tryOfflineLogin(mobile, password);
      if (offlineUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(offlineUser));
        return { success: true, user: offlineUser };
      }
      return { success: false, error: 'Offline: Connect once online or use previously signed-in credentials.' };
    }
  }

  public static getStoredUser(): UserProfile | null {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          return {
            ...parsed,
            shopName: formatShopName(parsed.shopName || parsed.name || ''),
            name: formatShopName(parsed.name || parsed.shopName || ''),
          };
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  public static logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('radhamadhab_') || key.startsWith('shop_data_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      // ignore
    }
    this.localDataCache = {};
  }
}
