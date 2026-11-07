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

// API Health & Site Monitor Endpoint
app.get('/api/health', async (_req, res) => {
  const results: Record<string, any> = {};

  // Check AniList GraphQL
  const annStart = Date.now();
  try {
    const aliRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ Page(perPage:1) { media(type:ANIME) { id } } }' }),
    });
    results.anilist = { ok: aliRes.ok, status: aliRes.status, latencyMs: Date.now() - annStart };
  } catch {
    results.anilist = { ok: false, status: 0, latencyMs: Date.now() - annStart };
  }

  // Check Jikan API
  const jikanStart = Date.now();
  try {
    const jikRes = await fetch('https://api.jikan.moe/v4/anime/1');
    results.jikan = { ok: jikRes.ok, status: jikRes.status, latencyMs: Date.now() - jikanStart };
  } catch {
    results.jikan = { ok: false, status: 0, latencyMs: Date.now() - jikanStart };
  }

  // Server performance metrics
  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
    },
    services: results,
  });
});

// Rate limiter map for username lookups: ip -> timestamps[]
const lookupRateLimits = new Map<string, number[]>();
const REGISTRY_PATH = path.resolve(__dirname, 'data', 'user-registry.json');

function getUserRegistry(): Record<string, string> {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read user registry:', err);
  }
  return {
    benilin40: 'benilin40@gmail.com',
    benilin76: 'benilin76@gmail.com',
    benilin: 'benilin40@gmail.com',
  };
}

function saveUserRegistry(registry: Record<string, string>): void {
  try {
    const dir = path.dirname(REGISTRY_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write user registry:', err);
  }
}

// Secure Username-to-Email Resolution Endpoint
app.post('/api/auth/resolve-username', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Sliding rate limit: max 15 lookups per 60 seconds per IP
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

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3 || cleanUsername.length > 50) {
    return res.status(400).json({
      success: false,
      error: 'Username must be between 3 and 50 alphanumeric characters.',
    });
  }

  const registry = getUserRegistry();
  const matchedEmail = registry[cleanUsername];

  if (!matchedEmail) {
    return res.status(404).json({
      success: false,
      error: 'No account found matching this username. Please sign in with your email address.',
    });
  }

  return res.json({
    success: true,
    email: matchedEmail,
  });
});

// Secure Username Registration Endpoint
app.post('/api/auth/record-username', (req, res) => {
  const { username, email } = req.body;
  if (!username || typeof username !== 'string' || !email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid username and email are required.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUsername.length < 3 || cleanUsername.length > 50 || !cleanEmail.includes('@')) {
    return res.status(400).json({ success: false, error: 'Invalid username or email format.' });
  }

  const registry = getUserRegistry();
  registry[cleanUsername] = cleanEmail;
  saveUserRegistry(registry);

  return res.json({ success: true });
});

// Real-Time Username Availability Checker Endpoint
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

  const registry = getUserRegistry();
  const exists = Boolean(registry[cleanUsername]);

  return res.json({
    success: true,
    available: !exists,
    message: exists ? 'This username is already taken.' : 'Username is available.',
  });
});

// Login Brute Force Protection Rate Limiting
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
    record.lockedUntil = now + 60000; // 1-minute lockout after 5 consecutive failures
  }
  failedAttempts.set(key, record);

  const remainingSeconds = Math.max(0, Math.ceil((record.lockedUntil - now) / 1000));
  return res.json({
    locked: remainingSeconds > 0,
    remainingSeconds,
    attempts: record.count,
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
