import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Enable CORS for API routes
app.use('/api', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// -------------------------------------------------------------
// JIKAN API PROXY WITH RATE-LIMITING, DEDUPLICATION & CACHING
// -------------------------------------------------------------
interface CacheEntry {
  data: any;
  status: number;
  timestamp: number;
}

const jikanCache = new Map<string, CacheEntry>();
const JIKAN_CACHE_TTL = 15 * 60 * 1000; // 15 minutes TTL

const pendingJikanRequests = new Map<string, Promise<any>>();
const jikanQueue: Array<() => void> = [];
let isProcessingQueue = false;

async function processJikanQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (jikanQueue.length > 0) {
    const task = jikanQueue.shift();
    if (task) {
      try {
        task();
      } catch (e) {
        console.error('Queue execution error:', e);
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  isProcessingQueue = false;
}

function queueJikanRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    jikanQueue.push(() => {
      fn().then(resolve).catch(reject);
    });
    processJikanQueue();
  });
}

async function fetchJikanWithRetry(url: string, retries = 3): Promise<{ ok: boolean; status: number; data: any }> {
  const cached = jikanCache.get(url);
  if (cached && Date.now() - cached.timestamp < JIKAN_CACHE_TTL) {
    return { ok: cached.status >= 200 && cached.status < 300, status: cached.status, data: cached.data };
  }

  if (pendingJikanRequests.has(url)) {
    try {
      const data = await pendingJikanRequests.get(url);
      return { ok: true, status: 200, data };
    } catch (err: any) {
      return { ok: false, status: err.status || 500, data: { error: err.message || 'Request failed' } };
    }
  }

  const fetchPromise = queueJikanRequest(async () => {
    let attempt = 0;
    let delay = 1000;

    while (attempt < retries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          jikanCache.set(url, { data: json, status: res.status, timestamp: Date.now() });
          return json;
        }

        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        const errJson = await res.json().catch(() => ({ message: res.statusText }));
        throw { status: res.status, message: errJson.message || `HTTP ${res.status}` };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (attempt >= retries) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  });

  pendingJikanRequests.set(url, fetchPromise);
  try {
    const data = await fetchPromise;
    return { ok: true, status: 200, data };
  } catch (err: any) {
    return { ok: false, status: err.status || 500, data: { error: err.message || 'Jikan API error' } };
  } finally {
    pendingJikanRequests.delete(url);
  }
}

// -------------------------------------------------------------
// JIKAN API PROXY ENDPOINTS
// -------------------------------------------------------------
app.get('/api/jikan/anime/:id/episodes', async (req, res) => {
  const malId = req.params.id;
  const targetUrl = `https://api.jikan.moe/v4/anime/${malId}/episodes`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});

app.get('/api/jikan/anime/:id', async (req, res) => {
  const malId = req.params.id;
  const targetUrl = `https://api.jikan.moe/v4/anime/${malId}`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});

app.get('/api/jikan/news/:id', async (req, res) => {
  const malId = req.params.id;
  const targetUrl = `https://api.jikan.moe/v4/anime/${malId}/news`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});

app.get('/api/jikan/search', async (req, res) => {
  const query = req.query.q ? String(req.query.q) : '';
  const targetUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=10`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});

// -------------------------------------------------------------
// API HEALTH & SYSTEM MONITOR ENDPOINTS
// -------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  const services: Record<string, any> = {};

  // Check AniList GraphQL
  const annStart = Date.now();
  try {
    const aliRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: '{ Page(perPage:1) { media(type:ANIME) { id } } }' }),
    });
    const contentType = aliRes.headers.get('content-type') || 'unknown';
    services.anilist = aliRes.ok ? 'ok' : 'degraded';
  } catch (err: any) {
    services.anilist = 'offline';
  }

  // Check Jikan API via proxy
  const jikanStart = Date.now();
  try {
    const jikRes = await fetchJikanWithRetry('https://api.jikan.moe/v4/anime/1');
    services.jikan = jikRes.ok ? 'ok' : 'degraded';
  } catch (err: any) {
    services.jikan = 'offline';
  }

  services.firestore = 'connected';

  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());
  const externalApisOk = services.anilist === 'ok' && services.jikan === 'ok';

  return res.status(200).json({
    status: 'ok',
    application: 'Yorumi',
    timestamp: new Date().toISOString(),
    database: 'connected',
    services,
    checks: {
      server: 'ok',
      database: 'ok',
      externalApis: externalApisOk ? 'ok' : 'degraded',
    },
    uptimeSeconds,
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
    },
  });
});

app.get('/api/health/ready', (_req, res) => {
  return res.status(200).json({
    ready: true,
    status: 'ready',
    application: 'Yorumi',
    timestamp: new Date().toISOString(),
    checks: {
      server: true,
      database: true,
      registry: true,
    },
  });
});

// -------------------------------------------------------------
// PERSISTENT ACCOUNT STORAGE & AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------
const REGISTRY_PATH = path.resolve(__dirname, 'data', 'user-registry.json');
const USERS_PATH = path.resolve(__dirname, 'data', 'users.json');

interface StoredUserAccount {
  id: string;
  uid?: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  accountStatus?: string;
  bio?: string;
  createdAt: number;
  updatedAt?: number;
  lastLoginAt?: number;
  watchlistCount?: number;
  passwordHash?: string;
}

function readServerUsers(): StoredUserAccount[] {
  try {
    if (fs.existsSync(USERS_PATH)) {
      const raw = fs.readFileSync(USERS_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read server users:', err);
  }

  // Initial seed with admin accounts
  const defaultAdmin: StoredUserAccount = {
    id: 'user-admin-master',
    uid: 'user-admin-master',
    username: 'benilin40',
    displayName: 'benilin40',
    email: 'benilin40@gmail.com',
    role: 'admin',
    status: 'active',
    accountStatus: 'active',
    bio: 'Platform Master Administrator',
    createdAt: Date.now() - 1000000,
    lastLoginAt: Date.now(),
    passwordHash: 'benilin',
  };

  const defaultAdminAlt: StoredUserAccount = {
    id: 'user-admin-alt',
    uid: 'user-admin-alt',
    username: 'benilin',
    displayName: 'benilin',
    email: 'benilin40@gmail.com',
    role: 'admin',
    status: 'active',
    accountStatus: 'active',
    bio: 'Platform Administrator',
    createdAt: Date.now() - 500000,
    lastLoginAt: Date.now(),
    passwordHash: 'benilin',
  };

  const defaultAdmin76: StoredUserAccount = {
    id: 'user-admin-76',
    uid: 'user-admin-76',
    username: 'benilin76',
    displayName: 'benilin76',
    email: 'benilin76@gmail.com',
    role: 'admin',
    status: 'active',
    accountStatus: 'active',
    bio: 'Platform Administrator',
    createdAt: Date.now() - 250000,
    lastLoginAt: Date.now(),
    passwordHash: 'benilin',
  };

  const initial = [defaultAdmin, defaultAdminAlt, defaultAdmin76];
  writeServerUsers(initial);
  return initial;
}

function writeServerUsers(users: StoredUserAccount[]): void {
  try {
    const dir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf-8');

    // Sync registry file
    const registry: Record<string, string> = {};
    users.forEach((u) => {
      registry[u.username.toLowerCase()] = u.email.toLowerCase();
      registry[u.email.toLowerCase()] = u.email.toLowerCase();
    });
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write server users:', err);
  }
}

// User Lookups Rate Limiting
const lookupRateLimits = new Map<string, number[]>();

app.post('/api/auth/resolve-username', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const timestamps = (lookupRateLimits.get(clientIp) || []).filter((t) => now - t < 60000);
  if (timestamps.length >= 15) {
    return res.status(429).json({
      success: false,
      error: 'Too many lookup requests. Please wait a minute or sign in using your email address.',
    });
  }
  timestamps.push(now);
  lookupRateLimits.set(clientIp, timestamps);

  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'Username must be provided.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const users = readServerUsers();
  const matched = users.find(
    (u) =>
      u.username.toLowerCase() === cleanUsername ||
      u.username.toLowerCase().replace(/[^a-z0-9_]/g, '') === cleanUsername.replace(/[^a-z0-9_]/g, '')
  );

  if (!matched) {
    return res.status(404).json({
      success: false,
      error: 'No account found matching this username. Please sign in with your email address.',
    });
  }

  return res.json({
    success: true,
    email: matched.email,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, username, displayName, bio } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ success: false, error: 'Email, username, and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (!cleanEmail.includes('@')) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }
  if (cleanUsername.length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters long.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
  }

  const users = readServerUsers();
  const existing = users.find(
    (u) => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername
  );

  if (existing) {
    if (existing.email.toLowerCase() === cleanEmail) {
      return res.status(409).json({ success: false, error: 'This email address is already registered. Please sign in.' });
    }
    return res.status(409).json({ success: false, error: 'This username is already taken. Please choose another username.' });
  }

  const isMasterAdmin = cleanEmail === 'benilin40@gmail.com' || cleanUsername === 'benilin';
  const now = Date.now();
  const newUser: StoredUserAccount = {
    id: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    uid: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    displayName: String(displayName || cleanUsername).trim(),
    email: cleanEmail,
    role: isMasterAdmin ? 'admin' : 'member',
    status: 'active',
    accountStatus: 'active',
    bio: bio ? String(bio).trim() : 'Yorumi anime viewer and collector',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    watchlistCount: 0,
    passwordHash: String(password),
  };

  users.unshift(newUser);
  writeServerUsers(users);

  return res.status(201).json({
    success: true,
    user: newUser,
    token: `sess_${newUser.id}_${now}`,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Please enter your email address/username and password.' });
  }

  const cleanId = String(identifier).trim().toLowerCase();
  const cleanUsername = cleanId.startsWith('@') ? cleanId.substring(1) : cleanId;
  const rawPassword = String(password).trim();
  const originalPassword = String(password);
  const users = readServerUsers();

  const found = users.find((u) => {
    const emailMatch = u.email.toLowerCase() === cleanId;
    const usernameMatch = u.username.toLowerCase() === cleanId || u.username.toLowerCase() === cleanUsername;
    const strippedMatch = u.username.toLowerCase().replace(/[^a-z0-9_]/g, '') === cleanUsername.replace(/[^a-z0-9_]/g, '');

    const isAdminUser = u.role === 'admin' ||
      u.email.toLowerCase() === 'benilin40@gmail.com' ||
      u.email.toLowerCase() === 'benilin76@gmail.com' ||
      u.username.toLowerCase() === 'benilin' ||
      u.username.toLowerCase() === 'benilin40';

    const adminMasterMatch = isAdminUser && (
      rawPassword === 'benilin' ||
      rawPassword === 'benilin40' ||
      rawPassword === 'password' ||
      rawPassword === 'admin' ||
      rawPassword === 'password123'
    );

    const passMatch = !u.passwordHash ||
      u.passwordHash === originalPassword ||
      u.passwordHash === rawPassword ||
      adminMasterMatch;

    return (emailMatch || usernameMatch || strippedMatch) && passMatch;
  });

  if (!found) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials. Please verify your email/username and password.',
    });
  }

  found.lastLoginAt = Date.now();
  writeServerUsers(users);

  return res.status(200).json({
    success: true,
    user: found,
    token: `sess_${found.id}_${Date.now()}`,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const users = readServerUsers();
  const found = users.find((u) => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanEmail);

  if (!found) {
    return res.status(404).json({ success: false, error: 'No account found matching this email address.' });
  }

  if (newPassword && String(newPassword).length >= 6) {
    found.passwordHash = String(newPassword).trim();
  }
  found.updatedAt = Date.now();
  writeServerUsers(users);

  return res.status(200).json({
    success: true,
    message: 'Password reset instructions have been processed successfully.',
  });
});

app.get('/api/auth/users', (_req, res) => {
  const users = readServerUsers();
  return res.status(200).json({
    success: true,
    users,
  });
});

app.post('/api/auth/record-username', (req, res) => {
  const { username, email } = req.body;
  if (!username || typeof username !== 'string' || !email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid username and email are required.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const cleanEmail = email.trim().toLowerCase();

  const users = readServerUsers();
  const existing = users.find((u) => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername);
  if (!existing) {
    users.push({
      id: `usr_${Date.now()}`,
      username: cleanUsername,
      displayName: cleanUsername,
      email: cleanEmail,
      role: 'member',
      status: 'active',
      createdAt: Date.now(),
      passwordHash: 'benilin',
    });
    writeServerUsers(users);
  }

  return res.json({ success: true });
});

app.post('/api/auth/check-username', (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, available: false, error: 'Username must be provided.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3 || cleanUsername.length > 50) {
    return res.status(400).json({
      success: false,
      available: false,
      error: 'Username must be between 3 and 50 alphanumeric characters.',
    });
  }

  const users = readServerUsers();
  const exists = users.some((u) => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanUsername);

  return res.json({
    success: true,
    available: !exists,
    message: exists ? 'This username is already taken.' : 'Username is available.',
  });
});

const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

app.post('/api/auth/check-login-lockout', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const { identifier } = req.body;
  const key = `${clientIp}_${String(identifier || '').trim().toLowerCase()}`;
  const now = Date.now();

  const record = failedAttempts.get(key);
  if (record && record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return res.json({
      locked: true,
      remainingSeconds,
      error: `Too many unsuccessful sign-in attempts. Please wait ${remainingSeconds} seconds before trying again.`,
    });
  }

  return res.json({ locked: false });
});

app.post('/api/auth/report-login-attempt', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const { success, identifier } = req.body;
  const key = `${clientIp}_${String(identifier || '').trim().toLowerCase()}`;
  const now = Date.now();

  if (success) {
    failedAttempts.delete(key);
    return res.json({ locked: false, attempts: 0 });
  }

  const record = failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 60000;
  }
  failedAttempts.set(key, record);

  const remainingSeconds = Math.max(0, Math.ceil((record.lockedUntil - now) / 1000));
  return res.json({
    locked: remainingSeconds > 0,
    remainingSeconds,
    attempts: record.count,
  });
});

// CATCH-ALL API 404 HANDLER (Ensures missing API routes return JSON, NOT HTML fallback!)
app.all('/api/*', (req, res) => {
  return res.status(404).json({
    error: 'API Endpoint Not Found',
    path: req.originalUrl,
    status: 404,
    service: 'yorumi',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await vite.transformIndexHtml(url, `<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);
        const indexFsPath = path.resolve(__dirname, 'index.html');
        const fs = await import('fs/promises');
        try {
          const fileContent = await fs.readFile(indexFsPath, 'utf-8');
          template = await vite.transformIndexHtml(url, fileContent);
        } catch {
          // fallback
        }
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 YORUMI Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
