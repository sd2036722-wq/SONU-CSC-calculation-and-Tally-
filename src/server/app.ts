import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
  getShopData,
  saveShopData,
  registerShopUser,
  loginShopUser,
} from './storage';
import { generateInitialData, generateCleanShopData } from '../data/defaults';
import { streamAiResponse, formatGeminiError } from './aiService';

export function createServer() {
  const app = express();
  const rootDir = process.cwd();
  const distDir = path.resolve(rootDir, 'dist');
  const publicDir = path.resolve(rootDir, 'public');

  app.use(express.json({ limit: '10mb' }));

  // Dedicated ZIP Download Route
  app.get('/api/download-project-zip', (_req, res) => {
    try {
      const scriptPath = path.resolve(rootDir, 'scripts', 'create_project_zip.py');
      const zipPath = path.resolve(publicDir, 'radhamadhab-online-center-full-website.zip');
      
      if (fs.existsSync(scriptPath)) {
        try {
          execSync('python3 scripts/create_project_zip.py', { cwd: rootDir, stdio: 'ignore' });
        } catch (e) {
          console.warn('Zip script generation warning:', e);
        }
      }

      if (fs.existsSync(zipPath)) {
        res.download(zipPath, 'radhamadhab-online-center-full-website.zip');
      } else {
        res.status(404).json({ error: 'Zip file not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate zip: ' + err.message });
    }
  });

  // Serve direct public zip and assets
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Helper to extract userId from request
  const extractUserId = (req: express.Request): string | undefined => {
    const queryUser = req.query.userId as string | undefined;
    if (queryUser) return queryUser;
    const headerUser = req.headers['x-user-id'] as string | undefined;
    if (headerUser) return headerUser;
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer token_')) {
      const raw = auth.replace('Bearer token_', '');
      const parts = raw.split('_');
      if (parts.length > 0) return parts[0];
    }
    if (req.body?.userId) return req.body.userId;
    return undefined;
  };

  // API Routes
  app.get('/api/data', (req, res) => {
    const userId = extractUserId(req);
    const data = getShopData(userId);
    res.json({ success: true, data });
  });

  app.post('/api/data', (req, res) => {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data payload' });
    }
    const userId = extractUserId(req);
    saveShopData(data, userId);
    res.json({ success: true, lastUpdated: new Date().toISOString() });
  });

  // New shopkeeper registration: Shop Name, Mobile, Password - NO OTP
  app.post('/api/auth/register', (req, res) => {
    const { shopName, mobile, password } = req.body;
    if (!shopName || !mobile || !password) {
      return res.status(400).json({ success: false, error: 'Shop Name, Mobile Number, and Password are required.' });
    }
    const result = registerShopUser(shopName, mobile, password);
    return res.status(result.success ? 200 : 400).json(result);
  });

  // Login using Mobile Number and Password only - NO OTP
  app.post('/api/auth/login', (req, res) => {
    const { mobile, password, email } = req.body;
    const mobileInput = mobile || email;
    if (!mobileInput || !password) {
      return res.status(400).json({ success: false, error: 'Mobile number and password are required.' });
    }
    const result = loginShopUser(mobileInput, password);
    return res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/backup/import', (req, res) => {
    const { backup } = req.body;
    if (!backup || !backup.shopSettings) {
      return res.status(400).json({ error: 'Invalid backup' });
    }
    saveShopData(backup);
    res.json({ success: true, message: 'Backup restored successfully' });
  });

  app.post('/api/reset', (req, res) => {
    const { mode } = req.body || {};
    const current = getShopData();
    const resetData = mode === 'demo' ? generateInitialData() : generateCleanShopData(current?.shopSettings);
    saveShopData(resetData);
    res.json({ success: true, data: resetData });
  });

  app.get('/api/status', (_req, res) => {
    const current = getShopData();
    res.json({
      status: 'online',
      shopName: current.shopSettings?.shopName || 'Radhamadhab Online Center',
      lastUpdated: current.lastUpdated,
      totalTransactions: current.transactions?.length || 0,
    });
  });

  app.post('/api/ai/chat-stream', async (req, res) => {
    const { messages, mode, language, shopContext } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one message.' });
    }

    let headersSent = false;
    try {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
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
        return res.status(formatted.status).json({ error: formatted.message });
      }
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        res.end();
      }
    }
  });

  // Serve frontend static assets from dist
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    app.get('*', (_req, res) => {
      res.send(`<!DOCTYPE html><html><body><h1>Application Initializing</h1><p>Building frontend assets...</p></body></html>`);
    });
  }

  return app;
}

export function startServer() {
  const app = createServer();
  const PORT = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Radhamadhab Online Center server running on port ${PORT}`);
  });

  const shutdown = () => {
    console.log('Shutting down server gracefully...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}
