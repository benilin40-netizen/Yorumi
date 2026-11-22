// server.ts
import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";

// server/auth.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps, getApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var ROOT_DIR = fs.existsSync(path.resolve(__dirname, "package.json")) ? __dirname : fs.existsSync(path.resolve(__dirname, "..", "package.json")) ? path.resolve(__dirname, "..") : process.cwd();
function loadFirebaseAppletConfig() {
  try {
    const configPath = path.resolve(ROOT_DIR, "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return {
        projectId: parsed.projectId || process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0533950221",
        firestoreDatabaseId: parsed.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID
      };
    }
  } catch {
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0533950221",
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID
  };
}
var FIREBASE_CFG = loadFirebaseAppletConfig();
var FIREBASE_PROJECT_ID = FIREBASE_CFG.projectId;
var FIREBASE_DATABASE_ID = FIREBASE_CFG.firestoreDatabaseId;
var BOOTSTRAP_ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "benilin40@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);
var adminAppInitialized = false;
var adminHasCredentials = false;
var adminDbInstance = null;
function initFirebaseAdmin() {
  if (adminAppInitialized) return;
  adminAppInitialized = true;
  try {
    if (getApps().length > 0) {
      adminHasCredentials = true;
    } else {
      const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
      if (saEnv) {
        const jsonStr = saEnv.startsWith("{") ? saEnv : Buffer.from(saEnv, "base64").toString("utf-8");
        const serviceAccount = JSON.parse(jsonStr);
        initializeApp({
          credential: cert(serviceAccount),
          projectId: FIREBASE_PROJECT_ID
        });
        adminHasCredentials = true;
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
        initializeApp({
          credential: applicationDefault(),
          projectId: FIREBASE_PROJECT_ID
        });
        adminHasCredentials = true;
      }
    }
    if (adminHasCredentials && getApps().length > 0) {
      const app2 = getApp();
      adminDbInstance = FIREBASE_DATABASE_ID ? getAdminFirestore(app2, FIREBASE_DATABASE_ID) : getAdminFirestore(app2);
    }
  } catch (err) {
    console.warn("Firebase Admin SDK credentials not configured; using public JWKS token verification:", err.message);
    adminHasCredentials = false;
    adminDbInstance = null;
  }
}
initFirebaseAdmin();
function getServerFirestore() {
  return adminDbInstance;
}
function isAdminSdkReady() {
  return adminHasCredentials && adminDbInstance !== null;
}
var CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var cachedCerts = {};
var certsExpiresAt = 0;
async function fetchGooglePublicCerts() {
  if (Object.keys(cachedCerts).length > 0 && Date.now() < certsExpiresAt) {
    return cachedCerts;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5e3);
  try {
    const res = await fetch(CERT_URL, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public certs: HTTP ${res.status}`);
    }
    const certs = await res.json();
    const cc = res.headers.get("cache-control") || "";
    const match = cc.match(/max-age=(\d+)/);
    const maxAgeSec = match ? parseInt(match[1], 10) : 3600;
    cachedCerts = certs;
    certsExpiresAt = Date.now() + maxAgeSec * 1e3;
    return certs;
  } finally {
    clearTimeout(timer);
  }
}
function base64UrlDecode(segment) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((segment.length + 3) % 4);
  return Buffer.from(padded, "base64");
}
async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing authentication token.");
  }
  if (adminHasCredentials && getApps().length > 0) {
    try {
      const decoded = await getAuth(getApp()).verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: (decoded.email || "").toLowerCase(),
        email_verified: Boolean(decoded.email_verified),
        name: decoded.name,
        picture: decoded.picture,
        provider: decoded.firebase?.sign_in_provider
      };
    } catch (err) {
      const msg = String(err?.message || "");
      if (!msg.includes("credential") && !msg.includes("metadata") && !msg.includes("ENOTFOUND")) {
        throw new Error(err?.message || "Invalid Firebase authentication token.");
      }
    }
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed Firebase ID token.");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64).toString("utf-8"));
  const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported token signing algorithm.");
  }
  const certs = await fetchGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error("Token signing key not found or expired.");
  }
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureValid = verifier.verify(certPem, base64UrlDecode(signatureB64));
  if (!signatureValid) {
    throw new Error("Invalid token signature.");
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error("Token audience mismatch.");
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error("Token issuer mismatch.");
  }
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new Error("Authentication session expired. Please sign in again.");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 300) {
    throw new Error("Invalid token issued-at timestamp.");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Token missing subject UID.");
  }
  if (payload.firebase?.sign_in_provider === "anonymous") {
    throw new Error("Anonymous sessions cannot access protected account resources.");
  }
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : "",
    email_verified: Boolean(payload.email_verified),
    name: payload.name,
    picture: payload.picture,
    provider: payload.firebase?.sign_in_provider
  };
}
var REGISTRY_PATH = path.resolve(ROOT_DIR, "data", "user-registry.json");
var USERS_PATH = path.resolve(ROOT_DIR, "data", "users.json");
function sanitizeServerUser(raw) {
  return {
    id: String(raw.id || raw.uid || ""),
    uid: String(raw.uid || raw.id || ""),
    username: String(raw.username || "").toLowerCase(),
    displayName: String(raw.displayName || raw.username || "Yorumi Member"),
    email: String(raw.email || "").toLowerCase(),
    role: ["admin", "moderator", "vip", "member"].includes(raw.role) ? raw.role : "member",
    status: ["active", "suspended", "pending"].includes(raw.status) ? raw.status : "active",
    accountStatus: ["active", "suspended", "pending"].includes(raw.accountStatus || raw.status) ? raw.accountStatus || raw.status : "active",
    avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : void 0,
    bio: typeof raw.bio === "string" ? raw.bio : "",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    lastLoginAt: typeof raw.lastLoginAt === "number" ? raw.lastLoginAt : Date.now(),
    watchlistCount: typeof raw.watchlistCount === "number" ? raw.watchlistCount : 0,
    emailVerified: Boolean(raw.emailVerified)
  };
}
function readServerUsers() {
  try {
    if (fs.existsSync(USERS_PATH)) {
      const raw = fs.readFileSync(USERS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(sanitizeServerUser);
      }
    }
  } catch (err) {
    console.error("Failed to read server users:", err);
  }
  return [];
}
function writeServerUsers(users) {
  try {
    const dir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sanitized = users.map(sanitizeServerUser);
    fs.writeFileSync(USERS_PATH, JSON.stringify(sanitized, null, 2), "utf-8");
    const registry = {};
    sanitized.forEach((u) => {
      if (u.username && u.email) {
        registry[u.username.toLowerCase()] = u.email.toLowerCase();
      }
      if (u.email) {
        registry[u.email.toLowerCase()] = u.email.toLowerCase();
      }
    });
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write server users:", err);
  }
}
async function resolveAuthoritativeRole(tokenUser) {
  const users = readServerUsers();
  const matched = users.find(
    (u) => u.uid === tokenUser.uid || u.id === tokenUser.uid || tokenUser.email && u.email === tokenUser.email
  );
  let isAdmin = false;
  if (adminDbInstance) {
    try {
      const adminSnap = await adminDbInstance.collection("admins").doc(tokenUser.uid).get();
      if (adminSnap.exists) {
        isAdmin = true;
      }
    } catch {
    }
  }
  if (!isAdmin && tokenUser.email_verified && BOOTSTRAP_ADMIN_EMAILS.has(tokenUser.email)) {
    isAdmin = true;
  }
  if (!isAdmin && matched && matched.role === "admin" && tokenUser.email_verified && matched.email === tokenUser.email) {
    isAdmin = true;
  }
  const role = isAdmin ? "admin" : matched?.role && matched.role !== "admin" ? matched.role : "member";
  const status = matched?.status || "active";
  return { role, status, profile: matched || null };
}
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Missing Bearer token."
    });
  }
  const token = authHeader.slice(7).trim();
  try {
    const verified = await verifyFirebaseIdToken(token);
    const { role, status } = await resolveAuthoritativeRole(verified);
    if (status === "suspended") {
      return res.status(403).json({
        success: false,
        error: "This account has been suspended by an administrator."
      });
    }
    req.authUser = {
      ...verified,
      role,
      status
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err?.message || "Invalid or expired authentication token."
    });
  }
}
function requireAdmin(req, res, next) {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      error: "Authentication required."
    });
  }
  if (req.authUser.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Forbidden: verified administrator privileges required."
    });
  }
  if (!req.authUser.email_verified) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: verified email address required for administrator actions."
    });
  }
  return next();
}

// server.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var allowedOrigins = new Set(
  [
    process.env.APP_URL,
    ...(process.env.ALLOWED_ORIGINS || "").split(","),
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
  ].map((o) => (o || "").trim().replace(/\/$/, "")).filter(Boolean)
);
function isOriginAllowed(origin, hostHeader) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  if (allowedOrigins.has(normalized)) return true;
  if (hostHeader) {
    try {
      const originUrl = new URL(normalized);
      if (originUrl.host === hostHeader) return true;
    } catch {
      return false;
    }
  }
  return false;
}
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && isOriginAllowed(origin, host)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    if (origin && !isOriginAllowed(origin, host)) {
      return res.status(403).json({ success: false, error: "Origin not allowed by CORS policy." });
    }
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: "256kb" }));
app.use((err, _req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON request payload."
    });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Request payload exceeds maximum allowed size (256KB)."
    });
  }
  next(err);
});
var apiRateMap = /* @__PURE__ */ new Map();
function checkRateLimit(bucketKey, maxRequests, windowMs) {
  const now = Date.now();
  const recent = (apiRateMap.get(bucketKey) || []).filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) {
    apiRateMap.set(bucketKey, recent);
    return false;
  }
  recent.push(now);
  apiRateMap.set(bucketKey, recent);
  return true;
}
app.use("/api", (req, res, next) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(`global_${clientIp}`, 180, 6e4)) {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded. Please slow down and try again shortly."
    });
  }
  next();
});
var jikanCache = /* @__PURE__ */ new Map();
var JIKAN_CACHE_TTL = 15 * 60 * 1e3;
var pendingJikanRequests = /* @__PURE__ */ new Map();
var jikanQueue = [];
var isProcessingQueue = false;
async function processJikanQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (jikanQueue.length > 0) {
    const task = jikanQueue.shift();
    if (task) {
      try {
        task();
      } catch (e) {
        console.error("Jikan queue execution error:", e);
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  isProcessingQueue = false;
}
function queueJikanRequest(fn) {
  return new Promise((resolve, reject) => {
    jikanQueue.push(() => {
      fn().then(resolve).catch(reject);
    });
    processJikanQueue();
  });
}
async function fetchJikanWithRetry(url, retries = 3) {
  const cached = jikanCache.get(url);
  if (cached && Date.now() - cached.timestamp < JIKAN_CACHE_TTL) {
    return { ok: cached.status >= 200 && cached.status < 300, status: cached.status, data: cached.data };
  }
  if (pendingJikanRequests.has(url)) {
    try {
      const data = await pendingJikanRequests.get(url);
      return { ok: true, status: 200, data };
    } catch (err) {
      return { ok: false, status: err.status || 500, data: { error: err.message || "Request failed" } };
    }
  }
  const fetchPromise = queueJikanRequest(async () => {
    let attempt = 0;
    let delay = 1e3;
    while (attempt < retries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6e3);
      try {
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Yorumi-Anime-Platform/2.0"
          },
          signal: controller.signal
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
      } catch (err) {
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
  } catch (err) {
    return { ok: false, status: err.status || 502, data: { error: err.message || "Jikan API error" } };
  } finally {
    pendingJikanRequests.delete(url);
  }
}
function isValidNumericId(val) {
  return /^\d{1,10}$/.test(val);
}
app.get("/api/jikan/anime/:id/episodes", async (req, res) => {
  const malId = req.params.id;
  if (!isValidNumericId(malId)) {
    return res.status(400).json({ success: false, error: "Invalid MyAnimeList ID." });
  }
  const page = req.query.page && /^\d+$/.test(String(req.query.page)) ? `?page=${req.query.page}` : "";
  const targetUrl = `https://api.jikan.moe/v4/anime/${malId}/episodes${page}`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});
app.get("/api/jikan/anime/:id", async (req, res) => {
  const malId = req.params.id;
  if (!isValidNumericId(malId)) {
    return res.status(400).json({ success: false, error: "Invalid MyAnimeList ID." });
  }
  const targetUrl = `https://api.jikan.moe/v4/anime/${malId}`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});
app.get("/api/jikan/news/:id", async (req, res) => {
  const malId = req.params.id;
  if (!isValidNumericId(malId)) {
    return res.status(400).json({ success: false, error: "Invalid MyAnimeList ID." });
  }
  const targetUrl = `https://api.jikan.moe/v4/anime/${malId}/news`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});
app.get("/api/jikan/search", async (req, res) => {
  const query = req.query.q ? String(req.query.q).trim().slice(0, 120) : "";
  if (!query) {
    return res.status(400).json({ success: false, error: 'Search query "q" is required.' });
  }
  const targetUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=10`;
  const result = await fetchJikanWithRetry(targetUrl);
  return res.status(result.status).json(result.data);
});
var cachedHealthSnapshot = null;
async function probeFirestoreReal() {
  const start = Date.now();
  const db = getServerFirestore();
  if (db) {
    try {
      await Promise.race([
        db.collection("announcements").limit(1).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Admin probe timeout")), 3500))
      ]);
      return { status: "ok", httpStatus: 200, latencyMs: Date.now() - start };
    } catch (err) {
      const msg = String(err?.message || "");
      if (!msg.includes("PERMISSION_DENIED") && !msg.includes("UNAUTHENTICATED") && !msg.includes("metadata")) {
        return {
          status: "offline",
          httpStatus: 503,
          latencyMs: Date.now() - start,
          error: msg || "Firestore probe failed"
        };
      }
    }
  }
  const dbId = FIREBASE_DATABASE_ID || "(default)";
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_ID
  )}/databases/${encodeURIComponent(dbId)}/documents/announcements`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4e3);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.status < 500) {
      return { status: "ok", httpStatus: res.status, latencyMs: Date.now() - start };
    }
    return {
      status: "degraded",
      httpStatus: res.status,
      latencyMs: Date.now() - start,
      error: `HTTP ${res.status}`
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "offline",
      httpStatus: null,
      latencyMs: Date.now() - start,
      error: err?.name === "AbortError" ? "Timeout" : err?.message || "Unreachable"
    };
  }
}
async function probeAniListReal() {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const aliRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: "{ Page(perPage:1) { media(type:ANIME) { id } } }" }),
      signal: controller.signal
    });
    clearTimeout(timer);
    return {
      status: aliRes.ok ? "ok" : "degraded",
      httpStatus: aliRes.status,
      latencyMs: Date.now() - start,
      error: aliRes.ok ? void 0 : `HTTP ${aliRes.status}`
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "offline",
      httpStatus: null,
      latencyMs: Date.now() - start,
      error: err?.name === "AbortError" ? "Timeout" : err?.message || "Offline"
    };
  }
}
async function probeJikanReal() {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const jikRes = await fetch("https://api.jikan.moe/v4/top/anime?limit=1", {
      headers: { Accept: "application/json", "User-Agent": "Yorumi-Anime-Platform/2.0" },
      signal: controller.signal
    });
    clearTimeout(timer);
    return {
      status: jikRes.ok ? "ok" : "degraded",
      httpStatus: jikRes.status,
      latencyMs: Date.now() - start,
      error: jikRes.ok ? void 0 : `HTTP ${jikRes.status}`
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "degraded",
      httpStatus: null,
      latencyMs: Date.now() - start,
      error: err?.name === "AbortError" ? "Timeout reaching Jikan API" : err?.message || "Unreachable"
    };
  }
}
async function collectHealthSnapshot(forceFresh = false) {
  if (!forceFresh && cachedHealthSnapshot && Date.now() - cachedHealthSnapshot.timestamp < 3e4) {
    return cachedHealthSnapshot;
  }
  const [firestore, anilist, jikan] = await Promise.all([
    probeFirestoreReal(),
    probeAniListReal(),
    probeJikanReal()
  ]);
  cachedHealthSnapshot = {
    timestamp: Date.now(),
    firestore,
    anilist,
    jikan
  };
  return cachedHealthSnapshot;
}
app.get("/api/health", async (req, res) => {
  const forceFresh = req.query.fresh === "1";
  const snapshot = await collectHealthSnapshot(forceFresh);
  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());
  const externalApisOk = snapshot.anilist.status === "ok" && snapshot.jikan.status === "ok";
  const databaseOk = snapshot.firestore.status === "ok";
  const overallOk = databaseOk && externalApisOk;
  return res.status(databaseOk ? 200 : 503).json({
    status: overallOk ? "ok" : "degraded",
    application: "Yorumi",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    database: snapshot.firestore.status === "ok" ? "connected" : snapshot.firestore.status,
    adminSdkConfigured: isAdminSdkReady(),
    services: {
      firestore: snapshot.firestore,
      anilist: snapshot.anilist,
      jikan: snapshot.jikan
    },
    checks: {
      server: "ok",
      database: snapshot.firestore.status,
      externalApis: externalApisOk ? "ok" : "degraded"
    },
    uptimeSeconds,
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      rssMb: Math.round(memory.rss / (1024 * 1024) * 100) / 100,
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024) * 100) / 100,
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024) * 100) / 100
    }
  });
});
app.get("/api/health/ready", async (_req, res) => {
  const firestoreCheck = await probeFirestoreReal();
  const usersDirReadable = fs2.existsSync(path2.dirname(USERS_PATH));
  const ready = firestoreCheck.status === "ok" && usersDirReadable;
  return res.status(ready ? 200 : 503).json({
    ready,
    status: ready ? "ready" : "unavailable",
    application: "Yorumi",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    checks: {
      server: true,
      database: firestoreCheck.status === "ok",
      databaseLatencyMs: firestoreCheck.latencyMs,
      registry: usersDirReadable
    }
  });
});
var failedAttempts = /* @__PURE__ */ new Map();
app.post("/api/auth/resolve-username", (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(`resolve_${clientIp}`, 15, 6e4)) {
    return res.status(429).json({
      success: false,
      error: "Too many lookup requests. Please wait a minute or sign in using your email address."
    });
  }
  const { username } = req.body || {};
  if (!username || typeof username !== "string") {
    return res.status(400).json({ success: false, error: "Username must be provided." });
  }
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
  const stripped = cleanUsername.replace(/[^a-z0-9_]/g, "");
  if (stripped.length < 3) {
    return res.status(400).json({ success: false, error: "Invalid username format." });
  }
  const users = readServerUsers();
  const matched = users.find(
    (u) => u.username.toLowerCase() === cleanUsername || u.username.toLowerCase().replace(/[^a-z0-9_]/g, "") === stripped
  );
  if (!matched || !matched.email) {
    return res.status(404).json({
      success: false,
      error: "No account found matching this username. Please sign in with your email address."
    });
  }
  return res.json({
    success: true,
    email: matched.email
  });
});
app.post("/api/auth/check-username", (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(`check_user_${clientIp}`, 30, 6e4)) {
    return res.status(429).json({
      success: false,
      available: false,
      error: "Too many requests. Please wait a moment."
    });
  }
  const { username } = req.body || {};
  if (!username || typeof username !== "string") {
    return res.status(400).json({ success: false, available: false, error: "Username must be provided." });
  }
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (cleanUsername.length < 3 || cleanUsername.length > 50) {
    return res.status(400).json({
      success: false,
      available: false,
      error: "Username must be between 3 and 50 alphanumeric characters."
    });
  }
  const users = readServerUsers();
  const exists = users.some((u) => u.username.toLowerCase() === cleanUsername);
  return res.json({
    success: true,
    available: !exists,
    message: exists ? "This username is already taken." : "Username is available."
  });
});
app.post("/api/auth/check-login-lockout", (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const { identifier } = req.body || {};
  const key = `${clientIp}_${String(identifier || "").trim().toLowerCase()}`;
  const now = Date.now();
  const record = failedAttempts.get(key);
  if (record && record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1e3);
    return res.json({
      locked: true,
      remainingSeconds,
      error: `Too many unsuccessful sign-in attempts. Please wait ${remainingSeconds} seconds before trying again.`
    });
  }
  return res.json({ locked: false });
});
app.post("/api/auth/report-login-attempt", (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(`login_attempt_${clientIp}`, 30, 6e4)) {
    return res.status(429).json({ locked: true, remainingSeconds: 60, attempts: 5 });
  }
  const { success, identifier } = req.body || {};
  const key = `${clientIp}_${String(identifier || "").trim().toLowerCase()}`;
  const now = Date.now();
  if (success) {
    failedAttempts.delete(key);
    return res.json({ locked: false, attempts: 0 });
  }
  const record = failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 6e4;
  }
  failedAttempts.set(key, record);
  const remainingSeconds = Math.max(0, Math.ceil((record.lockedUntil - now) / 1e3));
  return res.json({
    locked: remainingSeconds > 0,
    remainingSeconds,
    attempts: record.count
  });
});
app.post("/api/auth/sync-profile", requireAuth, async (req, res) => {
  const authUser = req.authUser;
  const { username, displayName, bio, avatarUrl } = req.body || {};
  const users = readServerUsers();
  const now = Date.now();
  const { role, status } = await resolveAuthoritativeRole(authUser);
  const cleanUsername = typeof username === "string" && username.trim().length >= 3 ? username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 50) : "";
  const existingIdx = users.findIndex(
    (u) => u.uid === authUser.uid || u.id === authUser.uid || authUser.email && u.email === authUser.email
  );
  let savedUser;
  if (existingIdx >= 0) {
    const existing = users[existingIdx];
    savedUser = sanitizeServerUser({
      ...existing,
      id: authUser.uid,
      uid: authUser.uid,
      email: authUser.email || existing.email,
      username: cleanUsername || existing.username,
      displayName: typeof displayName === "string" && displayName.trim() ? displayName.trim().slice(0, 100) : existing.displayName,
      bio: typeof bio === "string" ? bio.trim().slice(0, 500) : existing.bio,
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl.slice(0, 500) : existing.avatarUrl || authUser.picture,
      role,
      status,
      accountStatus: status,
      emailVerified: authUser.email_verified,
      updatedAt: now,
      lastLoginAt: now
    });
    users[existingIdx] = savedUser;
  } else {
    const fallbackUsername = cleanUsername || (authUser.email ? authUser.email.split("@")[0] : "yorumi_user").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    savedUser = sanitizeServerUser({
      id: authUser.uid,
      uid: authUser.uid,
      username: fallbackUsername,
      displayName: typeof displayName === "string" && displayName.trim() ? displayName.trim().slice(0, 100) : authUser.name || fallbackUsername,
      email: authUser.email,
      role,
      status,
      accountStatus: status,
      bio: typeof bio === "string" ? bio.trim().slice(0, 500) : "Yorumi anime viewer and collector",
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl.slice(0, 500) : authUser.picture,
      emailVerified: authUser.email_verified,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      watchlistCount: 0
    });
    users.unshift(savedUser);
  }
  writeServerUsers(users);
  const serverDb = getServerFirestore();
  if (serverDb && role === "admin" && authUser.email_verified) {
    try {
      await serverDb.collection("admins").doc(authUser.uid).set(
        {
          userId: authUser.uid,
          email: authUser.email,
          role: "admin",
          createdAt: savedUser.createdAt
        },
        { merge: true }
      );
      await serverDb.collection("users").doc(authUser.uid).set(
        { role: "admin", updatedAt: now },
        { merge: true }
      );
    } catch {
    }
  }
  return res.json({
    success: true,
    user: savedUser
  });
});
app.get("/api/auth/me", requireAuth, async (req, res) => {
  const authUser = req.authUser;
  const { role, status, profile } = await resolveAuthoritativeRole(authUser);
  return res.json({
    success: true,
    user: sanitizeServerUser({
      ...profile || {},
      id: authUser.uid,
      uid: authUser.uid,
      email: authUser.email,
      displayName: profile?.displayName || authUser.name || authUser.email.split("@")[0],
      username: profile?.username || authUser.email.split("@")[0],
      role,
      status,
      emailVerified: authUser.email_verified
    }),
    isAdmin: role === "admin" && authUser.email_verified
  });
});
var ALLOWED_STREAM_HOSTS = /* @__PURE__ */ new Set([
  "jutsu.club",
  "www.jutsu.club",
  "cdn.jutsu.club",
  "aniflow.club",
  "www.aniflow.club"
]);
app.post("/api/stream/probe", requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, error: "Stream URL is required." });
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: "Invalid stream URL." });
  }
  if (parsed.protocol !== "https:" || !ALLOWED_STREAM_HOSTS.has(parsed.hostname)) {
    return res.status(400).json({ success: false, error: "Host not in verified streaming allowlist." });
  }
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const probeRes = await fetch(parsed.toString(), {
      method: "HEAD",
      signal: controller.signal
    });
    clearTimeout(timer);
    return res.json({
      success: true,
      reachable: probeRes.status < 500,
      httpStatus: probeRes.status,
      latencyMs: Date.now() - start,
      contentType: probeRes.headers.get("content-type") || "unknown"
    });
  } catch (err) {
    clearTimeout(timer);
    return res.json({
      success: true,
      reachable: false,
      httpStatus: null,
      latencyMs: Date.now() - start,
      error: err?.name === "AbortError" ? "Timeout" : err?.message || "Unreachable"
    });
  }
});
app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const serverDb = getServerFirestore();
  if (serverDb) {
    try {
      const snap = await serverDb.collection("users").limit(200).get();
      if (!snap.empty) {
        const firestoreUsers = snap.docs.map((d) => sanitizeServerUser({ id: d.id, ...d.data() }));
        return res.json({ success: true, users: firestoreUsers, source: "firestore" });
      }
    } catch {
    }
  }
  const users = readServerUsers();
  return res.json({ success: true, users, source: "server-registry" });
});
app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const { username, displayName, email, role, status, bio } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanUsername = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return res.status(400).json({ success: false, error: "A valid email address is required." });
  }
  if (cleanUsername.length < 3 || cleanUsername.length > 50) {
    return res.status(400).json({ success: false, error: "Username must be 3-50 alphanumeric characters." });
  }
  const users = readServerUsers();
  if (users.some((u) => u.email === cleanEmail || u.username === cleanUsername)) {
    return res.status(409).json({ success: false, error: "A user with that email or username already exists." });
  }
  const now = Date.now();
  const newUser = sanitizeServerUser({
    id: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    uid: `usr_${now}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    displayName: String(displayName || cleanUsername).trim().slice(0, 100),
    email: cleanEmail,
    role: role || "member",
    status: status || "active",
    bio: bio ? String(bio).trim().slice(0, 500) : "Yorumi member",
    createdAt: now,
    updatedAt: now,
    watchlistCount: 0
  });
  users.unshift(newUser);
  writeServerUsers(users);
  return res.status(201).json({ success: true, user: newUser });
});
app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  const { displayName, role, status, bio } = req.body || {};
  const users = readServerUsers();
  const idx = users.findIndex((u) => u.id === targetId || u.uid === targetId);
  if (idx < 0) {
    return res.status(404).json({ success: false, error: "User not found." });
  }
  const currentTarget = users[idx];
  const adminCount = users.filter((u) => u.role === "admin").length;
  if (currentTarget.role === "admin" && role && role !== "admin" && adminCount <= 1) {
    return res.status(400).json({ success: false, error: "Cannot demote the last remaining administrator." });
  }
  if (currentTarget.uid === req.authUser.uid && status === "suspended") {
    return res.status(400).json({ success: false, error: "You cannot suspend your own active admin account." });
  }
  const updated = sanitizeServerUser({
    ...currentTarget,
    displayName: typeof displayName === "string" && displayName.trim() ? displayName.trim().slice(0, 100) : currentTarget.displayName,
    role: role && ["admin", "moderator", "vip", "member"].includes(role) ? role : currentTarget.role,
    status: status && ["active", "suspended", "pending"].includes(status) ? status : currentTarget.status,
    accountStatus: status && ["active", "suspended", "pending"].includes(status) ? status : currentTarget.status,
    bio: typeof bio === "string" ? bio.trim().slice(0, 500) : currentTarget.bio,
    updatedAt: Date.now()
  });
  users[idx] = updated;
  writeServerUsers(users);
  const serverDb = getServerFirestore();
  if (serverDb) {
    try {
      await serverDb.collection("users").doc(updated.uid).set(
        {
          displayName: updated.displayName,
          role: updated.role,
          status: updated.status,
          accountStatus: updated.status,
          bio: updated.bio,
          updatedAt: updated.updatedAt
        },
        { merge: true }
      );
      if (updated.role === "admin") {
        await serverDb.collection("admins").doc(updated.uid).set({
          userId: updated.uid,
          email: updated.email,
          role: "admin",
          createdAt: updated.createdAt
        });
      } else {
        await serverDb.collection("admins").doc(updated.uid).delete();
      }
    } catch {
    }
  }
  return res.json({ success: true, user: updated });
});
app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  const users = readServerUsers();
  const target = users.find((u) => u.id === targetId || u.uid === targetId);
  if (!target) {
    return res.status(404).json({ success: false, error: "User not found." });
  }
  if (target.uid === req.authUser.uid) {
    return res.status(400).json({ success: false, error: "You cannot delete your own active administrator account." });
  }
  const adminCount = users.filter((u) => u.role === "admin").length;
  if (target.role === "admin" && adminCount <= 1) {
    return res.status(400).json({ success: false, error: "Cannot delete the last remaining administrator." });
  }
  writeServerUsers(users.filter((u) => u.id !== targetId && u.uid !== targetId));
  const serverDb = getServerFirestore();
  if (serverDb) {
    try {
      await serverDb.collection("users").doc(target.uid).delete();
      await serverDb.collection("admins").doc(target.uid).delete();
    } catch {
    }
  }
  return res.json({ success: true });
});
app.get("/api/admin/metrics", requireAuth, requireAdmin, async (_req, res) => {
  const snapshot = await collectHealthSnapshot(false);
  const users = readServerUsers();
  const memory = process.memoryUsage();
  return res.json({
    success: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    adminSdkConfigured: isAdminSdkReady(),
    cacheStats: {
      jikanEntries: jikanCache.size,
      jikanQueueDepth: jikanQueue.length
    },
    userCounts: {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      admins: users.filter((u) => u.role === "admin").length
    },
    services: {
      firestore: snapshot.firestore,
      anilist: snapshot.anilist,
      jikan: snapshot.jikan
    },
    memory: {
      rssMb: Math.round(memory.rss / (1024 * 1024) * 100) / 100,
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024) * 100) / 100,
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024) * 100) / 100
    }
  });
});
app.post("/api/admin/clear-cache", requireAuth, requireAdmin, (_req, res) => {
  const previousSize = jikanCache.size;
  jikanCache.clear();
  return res.json({
    success: true,
    clearedEntries: previousSize,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var ANNOUNCEMENTS_PATH = path2.resolve(__dirname2, "data", "announcements.json");
function readServerAnnouncements() {
  try {
    if (!fs2.existsSync(ANNOUNCEMENTS_PATH)) return [];
    const raw = fs2.readFileSync(ANNOUNCEMENTS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function writeServerAnnouncements(items) {
  try {
    const dir = path2.dirname(ANNOUNCEMENTS_PATH);
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    fs2.writeFileSync(ANNOUNCEMENTS_PATH, JSON.stringify(items, null, 2), "utf-8");
  } catch {
  }
}
app.get("/api/announcements", async (_req, res) => {
  const serverDb = getServerFirestore();
  if (serverDb) {
    try {
      const snap = await serverDb.collection("announcements").orderBy("createdAt", "desc").limit(20).get();
      if (!snap.empty) {
        const announcements2 = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return res.json({ success: true, announcements: announcements2, source: "firestore" });
      }
    } catch {
    }
  }
  const announcements = readServerAnnouncements().filter((a) => a.active);
  return res.json({ success: true, announcements, source: "server" });
});
app.post("/api/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  const { title, message, type } = req.body || {};
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ success: false, error: "Announcement title is required." });
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ success: false, error: "Announcement message is required." });
  }
  const validTypes = ["system", "release", "feature", "alert"];
  const announcementType = validTypes.includes(type) ? type : "system";
  const now = Date.now();
  const id = `ann_${now}_${Math.random().toString(36).substring(2, 6)}`;
  const announcement = {
    id,
    title: title.trim().slice(0, 150),
    message: message.trim().slice(0, 1e3),
    type: announcementType,
    createdAt: now,
    active: true,
    authorEmail: req.authUser?.email
  };
  const list = readServerAnnouncements();
  list.unshift(announcement);
  writeServerAnnouncements(list.slice(0, 50));
  const serverDb = getServerFirestore();
  if (serverDb) {
    try {
      await serverDb.collection("announcements").doc(id).set(announcement);
    } catch {
    }
  }
  return res.status(201).json({ success: true, announcement });
});
app.delete("/api/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const list = readServerAnnouncements();
  const filtered = list.filter((a) => a.id !== id);
  writeServerAnnouncements(filtered);
  const serverDb = getServerFirestore();
  if (serverDb) {
    try {
      await serverDb.collection("announcements").doc(id).delete();
    } catch {
    }
  }
  return res.json({ success: true });
});
app.post("/api/notifications/sync", requireAuth, async (req, res) => {
  const { subscribedIds, reminderIntervalMinutes = 30 } = req.body || {};
  if (!Array.isArray(subscribedIds) || subscribedIds.length === 0) {
    return res.json({ success: true, scheduledAlerts: [], message: "No subscribed anime IDs provided." });
  }
  const validIds = subscribedIds.map((id) => Number(id)).filter((n) => !Number.isNaN(n) && n > 0).slice(0, 50);
  if (validIds.length === 0) {
    return res.json({ success: true, scheduledAlerts: [] });
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  const leadSec = Math.max(5, Math.min(180, Number(reminderIntervalMinutes) || 30)) * 60;
  try {
    const query = `
      query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          airingSchedules(mediaId_in: $ids, notYetAired: true, sort: TIME) {
            id
            episode
            airingAt
            timeUntilAiring
            media {
              id
              title {
                english
                romaji
              }
              coverImage {
                large
              }
            }
          }
        }
      }
    `;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6e3);
    const aniRes = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids: validIds } }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!aniRes.ok) {
      return res.status(502).json({ success: false, error: `AniList schedule returned HTTP ${aniRes.status}` });
    }
    const json = await aniRes.json();
    const items = json?.data?.Page?.airingSchedules || [];
    const upcomingAlerts = items.map((item) => {
      const airingAt = item.airingAt;
      const mediaTitle = item.media?.title?.english || item.media?.title?.romaji || "Anime";
      const isImminent = airingAt - nowSec <= leadSec && airingAt >= nowSec;
      return {
        id: `airing_${item.media.id}_ep${item.episode}_${airingAt}`,
        animeId: item.media.id,
        animeTitle: mediaTitle,
        coverImage: item.media?.coverImage?.large,
        episodeNumber: item.episode,
        airingAtTimestamp: airingAt,
        timeUntilAiringSeconds: Math.max(0, airingAt - nowSec),
        isImminent
      };
    });
    return res.json({
      success: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      reminderLeadMinutes: reminderIntervalMinutes,
      alerts: upcomingAlerts
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed to sync airing schedules" });
  }
});
app.all("/api/*", (req, res) => {
  return res.status(404).json({
    error: "API Endpoint Not Found",
    path: req.originalUrl,
    status: 404,
    service: "yorumi"
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: "custom"
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';
        const indexFsPath = path2.resolve(__dirname2, "index.html");
        const fsPromises = await import("fs/promises");
        try {
          const fileContent = await fsPromises.readFile(indexFsPath, "utf-8");
          template = await vite.transformIndexHtml(url, fileContent);
        } catch {
        }
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path2.resolve(__dirname2, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path2.resolve(__dirname2, "dist", "index.html"));
    });
  }
  return app.listen(PORT, "0.0.0.0", () => {
    console.log(`YORUMI Server running on http://0.0.0.0:${PORT} (${process.env.NODE_ENV || "development"})`);
  });
}
if (process.env.YORUMI_NO_AUTOSTART !== "1") {
  startServer();
}
export {
  app,
  startServer
};
