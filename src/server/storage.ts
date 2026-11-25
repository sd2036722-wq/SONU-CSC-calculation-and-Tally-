import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AppDataPayload, UserProfile } from '../types';
import { generateInitialData, generateCleanShopData } from '../data/defaults';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'shop_data.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface UserAccount {
  id: string;
  shopName: string;
  mobile: string;
  passwordHash: string;
  salt: string;
  role: 'owner' | 'staff';
  createdAt: string;
}

// Normalize phone to clean 10 digits
export function cleanMobile(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(-10);
}

// Secure hash function using Node.js crypto
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const hash = hashPassword(password, salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return hash === storedHash;
  }
}

// Ensure directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load all users from disk
export function getAllUsers(): UserAccount[] {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading users.json:', e);
    return [];
  }
}

// Save users list to disk
export function saveAllUsers(users: UserAccount[]): boolean {
  ensureDataDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving users.json:', e);
    return false;
  }
}

export function findUserByMobile(mobile: string): UserAccount | undefined {
  const normalized = cleanMobile(mobile);
  return getAllUsers().find(u => cleanMobile(u.mobile) === normalized);
}

export function findUserById(id: string): UserAccount | undefined {
  return getAllUsers().find(u => u.id === id);
}

// Register a new shopkeeper with exact Shop Name, Mobile, and Password
export function registerShopUser(
  shopName: string,
  mobile: string,
  password: string
): { success: boolean; user?: UserProfile; token?: string; shopData?: AppDataPayload; error?: string } {
  const rawName = shopName?.trim();
  const trimmedName = rawName ? rawName.replace(/(^|\s)\S/g, ch => ch.toUpperCase()) : '';
  const normalizedMobile = cleanMobile(mobile);

  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: 'Please enter a valid Shop Name (at least 2 characters).' };
  }

  if (!normalizedMobile || normalizedMobile.length !== 10) {
    return { success: false, error: 'Please enter a valid 10-digit Mobile Number.' };
  }

  if (!password || password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long.' };
  }

  const existing = findUserByMobile(normalizedMobile);
  if (existing) {
    return {
      success: false,
      error: `Mobile number ${normalizedMobile} is already registered to "${existing.shopName}". Please login instead.`,
    };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const newUserId = 'user_' + normalizedMobile + '_' + Date.now().toString(36);

  const newAccount: UserAccount = {
    id: newUserId,
    shopName: trimmedName,
    mobile: normalizedMobile,
    salt,
    passwordHash,
    role: 'owner',
    createdAt: new Date().toISOString(),
  };

  const users = getAllUsers();
  users.push(newAccount);
  saveAllUsers(users);

  // Initialize private shop data for this new user with their exact registered shop name & mobile!
  const initialShopData = generateCleanShopData({
    shopName: trimmedName,
    shopNameBn: trimmedName,
    ownerName: trimmedName,
    phone: normalizedMobile,
    email: `${normalizedMobile}@shop.local`,
    address: '',
    gstinOrReg: '',
    receiptFooterMessage: `Thank you for visiting ${trimmedName}! Please visit again.`,
    upiId: '',
  });

  saveShopData(initialShopData, newUserId);

  const userProfile: UserProfile = {
    id: newAccount.id,
    name: newAccount.shopName,
    shopName: newAccount.shopName,
    email: `${normalizedMobile}@shop.local`,
    phone: newAccount.mobile,
    role: newAccount.role,
    createdAt: newAccount.createdAt,
    token: `token_${newAccount.id}_${crypto.randomBytes(16).toString('hex')}`,
  };

  return {
    success: true,
    user: userProfile,
    token: userProfile.token,
    shopData: initialShopData,
  };
}

// Login with Mobile Number and Password
export function loginShopUser(
  mobile: string,
  password: string
): { success: boolean; user?: UserProfile; token?: string; shopData?: AppDataPayload; error?: string } {
  const normalizedMobile = cleanMobile(mobile);

  if (!normalizedMobile || normalizedMobile.length !== 10) {
    return { success: false, error: 'Please enter a valid 10-digit Mobile Number.' };
  }

  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  const userAccount = findUserByMobile(normalizedMobile);
  if (!userAccount) {
    return {
      success: false,
      error: 'No account found with this Mobile Number. Please click "Register" to create an account.',
    };
  }

  const isValid = verifyPassword(password, userAccount.salt, userAccount.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Incorrect password. Please verify and try again.' };
  }

  // Ensure their private shop data exists and has their exact registered shop name & phone
  const userData = getShopData(userAccount.id);
  let needsSave = false;
  if (userData.shopSettings.shopName !== userAccount.shopName) {
    userData.shopSettings.shopName = userAccount.shopName;
    userData.shopSettings.shopNameBn = userData.shopSettings.shopNameBn || userAccount.shopName;
    needsSave = true;
  }
  if (!userData.shopSettings.phone || userData.shopSettings.phone !== userAccount.mobile) {
    userData.shopSettings.phone = userAccount.mobile;
    needsSave = true;
  }
  if (needsSave) {
    saveShopData(userData, userAccount.id);
  }

  const userProfile: UserProfile = {
    id: userAccount.id,
    name: userAccount.shopName,
    shopName: userAccount.shopName,
    email: `${normalizedMobile}@shop.local`,
    phone: userAccount.mobile,
    role: userAccount.role,
    createdAt: userAccount.createdAt,
    token: `token_${userAccount.id}_${crypto.randomBytes(16).toString('hex')}`,
  };

  return {
    success: true,
    user: userProfile,
    token: userProfile.token,
    shopData: userData,
  };
}

// Helper to determine user-specific data file path
function getUserDataFilePath(userId?: string): string {
  ensureDataDir();
  if (!userId || userId === 'default') {
    return DATA_FILE;
  }
  // Sanitize userId for safe filename
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `user_data_${safeId}.json`);
}

// Retrieve shop data for a specific user (multi-tenant data separation)
export function getShopData(userId?: string): AppDataPayload {
  ensureDataDir();
  const filePath = getUserDataFilePath(userId);

  try {
    if (!fs.existsSync(filePath)) {
      // If user-specific file does not exist yet
      if (userId && userId !== 'default') {
        const userAccount = findUserById(userId);
        const initial = generateCleanShopData({
          shopName: userAccount?.shopName || 'Online Center',
          shopNameBn: userAccount?.shopName || 'অনলাইন সেন্টার',
          ownerName: userAccount?.shopName || 'Shop Owner',
          phone: userAccount?.mobile || '',
        }, userId);
        fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');
        return initial;
      }

      // Default shop_data.json
      const initial = generateInitialData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as AppDataPayload;

    if (!parsed.khataParties) {
      parsed.khataParties = [];
      parsed.khataEntries = [];
      saveShopData(parsed, userId);
    }

    // Ensure shopName matches registered user account if user exists
    if (userId) {
      const userAccount = findUserById(userId);
      if (userAccount && userAccount.shopName && parsed.shopSettings) {
        parsed.shopSettings.shopName = userAccount.shopName;
      }
    }

    return parsed;
  } catch (err) {
    console.error(`Error reading ${filePath}, falling back to initial data:`, err);
    return generateInitialData();
  }
}

// Save shop data for a specific user
export function saveShopData(data: AppDataPayload, userId?: string): boolean {
  ensureDataDir();
  const filePath = getUserDataFilePath(userId);

  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    // Also update main DATA_FILE if default user
    if (!userId || userId === 'default') {
      if (filePath !== DATA_FILE) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
      }
    }

    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}
