import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

process.env.YORUMI_NO_AUTOSTART = '1';

let appInstance: any;
let server: http.Server;
let baseUrl: string;

test.before(async () => {
  const mod = await import('../server.js');
  appInstance = mod.app;
  await new Promise<void>((resolve) => {
    server = appInstance.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('GET /api/health returns 200 JSON with Yenime/AniEmbed/Kuroko providers', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const contentType = res.headers.get('content-type') || '';
  assert.match(contentType, /application\/json/i);

  const data = await res.json();
  assert.equal(data.status, 'online');
  assert.ok(typeof data.uptimeSeconds === 'number');
  assert.ok(Array.isArray(data.providers));
  const ids = data.providers.map((p: any) => p.id);
  assert.deepEqual(ids, ['yenime', 'aniembed', 'kuroko']);
});

test('GET /api/auth/me returns 200 { user: null, isAdmin: false } when logged out', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user, null);
  assert.equal(data.isAdmin, false);
});

test('Protected user and admin routes return 401 JSON when unauthenticated', async () => {
  const adminRes = await fetch(`${baseUrl}/api/admin/overview`);
  assert.equal(adminRes.status, 401);
  const adminJson = await adminRes.json();
  assert.ok(typeof adminJson.error === 'string');

  const progressRes = await fetch(`${baseUrl}/api/user/progress`);
  assert.equal(progressRes.status, 401);

  const watchlistRes = await fetch(`${baseUrl}/api/user/watchlist`);
  assert.equal(watchlistRes.status, 401);
});

test('POST /api/analytics/track accepts valid events gracefully', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: 'test_ping',
      anilist_id: 21,
      episode_number: 1,
      provider_id: 'yenime',
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(typeof data.ok, 'boolean');
});

test('GET /api/sources/:anilistId/:episode returns only Yenime, AniEmbed, Kuroko builders', async () => {
  const res = await fetch(`${baseUrl}/api/sources/21/1?mode=aniembed&lang=sub&autoplay=1&t=42`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.selected);
  assert.equal(data.selected.id, 'aniembed');
  assert.match(data.selected.url, /aniembed\.se\/e\/21\/1\?lang=sub&autoplay=1&t=42/);
});

test('Unknown /api route returns 404 JSON instead of HTML', async () => {
  const res = await fetch(`${baseUrl}/api/nonexistent-endpoint-check`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.match(data.error, /not found/i);
});
