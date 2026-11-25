import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  getShopData,
  saveShopData,
  registerShopUser,
  loginShopUser,
} from './src/server/storage';
import { generateInitialData, generateCleanShopData } from './src/data/defaults';
import { AppDataPayload } from './src/types';
import { streamAiResponse, formatGeminiError } from './src/server/aiService';

export function shopApiPlugin(): Plugin {
  return {
    name: 'shop-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        // Dedicated ZIP Download Route
        if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/download-project-zip') {
          try {
            const scriptPath = path.resolve(process.cwd(), 'scripts', 'create_project_zip.py');
            const zipPath = path.resolve(process.cwd(), 'public', 'radhamadhab-online-center-full-website.zip');
            
            // Re-generate fresh zip if script exists
            if (fs.existsSync(scriptPath)) {
              try {
                execSync('python3 scripts/create_project_zip.py', { cwd: process.cwd(), stdio: 'ignore' });
              } catch (e) {
                console.warn('Zip script generation warning:', e);
              }
            }

            if (fs.existsSync(zipPath)) {
              const fileBuffer = fs.readFileSync(zipPath);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/zip');
              res.setHeader('Content-Disposition', 'attachment; filename="radhamadhab-online-center-full-website.zip"');
              res.setHeader('Content-Length', fileBuffer.length.toString());
              res.end(fileBuffer);
              return;
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Zip file not found' }));
              return;
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to generate zip: ' + err.message }));
            return;
          }
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // Helper to parse JSON body
        const readBody = (callback: (body: any) => void) => {
          let data = '';
          req.on('data', chunk => {
            data += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = data ? JSON.parse(data) : {};
              callback(parsed);
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
          });
        };

        // Helper to extract userId from headers, query, or body
        const extractUserId = (body?: any): string | undefined => {
          const queryUser = url.searchParams.get('userId');
          if (queryUser) return queryUser;
          const headerUser = req.headers['x-user-id'];
          if (typeof headerUser === 'string' && headerUser) return headerUser;
          const auth = req.headers['authorization'];
          if (typeof auth === 'string' && auth.startsWith('Bearer token_')) {
            const raw = auth.replace('Bearer token_', '');
            const parts = raw.split('_');
            if (parts.length > 0) return parts[0];
          }
          if (body?.userId) return body.userId;
          return undefined;
        };

        // 1. GET /api/data (Per-user private shop data)
        if (req.method === 'GET' && pathname === '/api/data') {
          const userId = extractUserId();
          const shopData = getShopData(userId);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: shopData }));
          return;
        }

        // 2. POST /api/data (Per-user sync)
        if (req.method === 'POST' && pathname === '/api/data') {
          readBody((body: { data: AppDataPayload; userId?: string }) => {
            if (!body || !body.data) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing data payload' }));
              return;
            }
            const userId = extractUserId(body);
            saveShopData(body.data, userId);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, lastUpdated: new Date().toISOString() }));
          });
          return;
        }

        // 3. POST /api/auth/register (New shopkeeper registration: Shop Name, Mobile, Password - NO OTP)
        if (req.method === 'POST' && pathname === '/api/auth/register') {
          readBody((body: { shopName?: string; mobile?: string; password?: string }) => {
            if (!body?.shopName || !body?.mobile || !body?.password) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Shop Name, Mobile Number, and Password are required.' }));
              return;
            }
            const result = registerShopUser(body.shopName, body.mobile, body.password);
            res.statusCode = result.success ? 200 : 400;
            res.end(JSON.stringify(result));
          });
          return;
        }

        // 4. POST /api/auth/login (Login using Mobile Number and Password only - NO OTP)
        if (req.method === 'POST' && pathname === '/api/auth/login') {
          readBody((body: { mobile?: string; password?: string; email?: string }) => {
            const mobileInput = body.mobile || body.email;
            if (!mobileInput || !body.password) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Mobile number and password are required.' }));
              return;
            }
            const result = loginShopUser(mobileInput, body.password);
            res.statusCode = result.success ? 200 : 400;
            res.end(JSON.stringify(result));
          });
          return;
        }

        // 4. GET /api/status
        if (req.method === 'GET' && pathname === '/api/status') {
          const current = getShopData();
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'online',
            shopName: current.shopSettings.shopName,
            lastUpdated: current.lastUpdated,
            totalTransactions: current.transactions.length,
          }));
          return;
        }

        // 5. POST /api/backup/import
        if (req.method === 'POST' && pathname === '/api/backup/import') {
          readBody((body: { backup: AppDataPayload }) => {
            if (!body || !body.backup || !body.backup.shopSettings) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid backup structure' }));
              return;
            }
            saveShopData(body.backup);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Backup successfully restored' }));
          });
          return;
        }

        // 6. POST /api/reset
        if (req.method === 'POST' && pathname === '/api/reset') {
          readBody((body: { mode?: 'clean' | 'demo' }) => {
            const current = getShopData();
            const resetData = body?.mode === 'demo'
              ? generateInitialData()
              : generateCleanShopData(current?.shopSettings);
            saveShopData(resetData);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data: resetData }));
          });
          return;
        }

        // 7. POST /api/ai/chat-stream (Fast Gemini AI Calculation Solver & Chat)
        if (req.method === 'POST' && pathname === '/api/ai/chat-stream') {
          readBody(async (body: any) => {
            const { messages, mode, language, shopContext } = body || {};
            if (!Array.isArray(messages) || messages.length === 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Please provide at least one message.' }));
              return;
            }

            let headersSent = false;
            try {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-transform');
              res.setHeader('Connection', 'keep-alive');
              (res as any).flushHeaders?.();
              headersSent = true;

              await streamAiResponse({ messages, mode, language, shopContext }, text => {
                if (!res.writableEnded) {
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
              });

              if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
              }
            } catch (err: any) {
              const formatted = formatGeminiError(err);
              if (!headersSent) {
                res.statusCode = formatted.status;
                res.end(JSON.stringify({ error: formatted.message }));
              } else if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
                res.end();
              }
            }
          });
          return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'API route not found' }));
      });
    },
  };
}
