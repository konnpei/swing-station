const ts = require('typescript');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
const { NextRequest } = require('next/server');
const auth = require('../lib/shopping-server.ts');
const alexa = require('../lib/alexa-shopping.ts');
const sdk = require('ask-sdk-express-adapter');
const shopping = require('../app/api/shopping/route.ts');
const session = require('../app/api/shopping/session/route.ts');
const endpoint = require('../app/api/alexa/shopping/route.ts');
const origin = 'https://family.example';
const req = (path, options = {}) => new NextRequest(origin + path, options);

test('SHOP fails closed; password sessions reject tampering, rotation, and cross-origin writes', async () => {
  delete process.env.SHOP_PASSWORD;
  assert.equal(auth.validPassword('anything'), false);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  assert.equal((await shopping.GET(req('/api/shopping'))).status, 503);
  process.env.SHOP_PASSWORD = 'test-only-random-password-123456';
  assert.equal((await shopping.GET(req('/api/shopping'))).status, 401);
  assert.equal(auth.validPassword('wrong'), false);
  const token = auth.createShopSession();
  const headers = { cookie: `${auth.SHOP_COOKIE}=${token}`, origin };
  assert.equal(auth.authorizedShop(req('/api/shopping', { headers })), true);
  assert.equal(auth.authorizedShop(req('/api/shopping', { headers: { cookie: `${auth.SHOP_COOKIE}=${token}bad` } })), false);
  const cross = await shopping.POST(req('/api/shopping', { method: 'POST', headers: { ...headers, origin: 'https://attacker.example' }, body: '{}' }));
  assert.equal(cross.status, 403);
  const login = await session.POST(req('/api/shopping/session', { method: 'POST', headers: { origin }, body: JSON.stringify({ password: process.env.SHOP_PASSWORD }) }));
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=strict/i);
  process.env.SHOP_PASSWORD = 'rotated-test-password-123456789';
  assert.equal(auth.authorizedShop(req('/api/shopping', { headers })), false);
});

test('Alexa rejects unsigned requests and dangerous certificate URLs before any insert', async () => {
  const raw = JSON.stringify({ request: { timestamp: new Date().toISOString(), type: 'LaunchRequest', requestId: 'test' } });
  const response = await endpoint.POST(req('/api/alexa/shopping', { method: 'POST', body: raw }));
  assert.equal(response.status, 400);
  for (const url of ['http://s3.amazonaws.com/echo.api/cert', 'https://evil.example/echo.api/cert', 'https://s3.amazonaws.com/echo.api/../evil/cert']) {
    await assert.rejects(alexa.verifyAlexa(raw, new Headers({ signaturecertchainurl: url, 'signature-256': 'YWJj' })));
  }
});

test('Verified signature still requires fresh timestamp, correct skill and allowed account', async () => {
  const original = sdk.SkillRequestSignatureVerifier.prototype.verify;
  let calls = 0;
  sdk.SkillRequestSignatureVerifier.prototype.verify = async () => { calls++; };
  process.env.ALEXA_SKILL_ID = 'test-skill';
  process.env.ALEXA_ALLOWED_USER_IDS = 'test-user';
  const headers = new Headers({ signaturecertchainurl: 'https://s3.amazonaws.com/echo.api/cert.pem', 'signature-256': 'YWJj' });
  const body = { context: { System: { application: { applicationId: 'test-skill' }, user: { userId: 'test-user' } } }, request: { timestamp: new Date().toISOString(), requestId: 'test', type: 'LaunchRequest' } };
  try {
    await alexa.verifyAlexa(JSON.stringify(body), headers);
    assert.equal(calls, 1);
    for (const timestamp of ['invalid', new Date(Date.now() - 151000).toISOString(), new Date(Date.now() + 151000).toISOString()]) {
      await assert.rejects(alexa.verifyAlexa(JSON.stringify({ ...body, request: { ...body.request, timestamp } }), headers));
    }
    process.env.ALEXA_SKILL_ID = 'other-skill';
    await assert.rejects(alexa.verifyAlexa(JSON.stringify(body), headers));
    process.env.ALEXA_SKILL_ID = 'test-skill';
    process.env.ALEXA_ALLOWED_USER_IDS = '';
    await assert.rejects(alexa.verifyAlexa(JSON.stringify(body), headers));
    process.env.ALEXA_ALLOWED_USER_IDS = 'test-user';
    const response = await endpoint.POST(req('/api/alexa/shopping', { method: 'POST', body: JSON.stringify(body), headers }));
    const data = await response.json();
    assert.equal(data.response.shouldEndSession, false);
    assert.ok(data.response.reprompt);
  } finally { sdk.SkillRequestSignatureVerifier.prototype.verify = original; }
});

test('Item parsing supports explicit lists without breaking Japanese product names', () => {
  assert.deepEqual(alexa.splitShoppingItems('牛乳、卵、ティッシュ'), ['牛乳', '卵', 'ティッシュ']);
  assert.deepEqual(alexa.splitShoppingItems('さとう'), ['さとう']);
  assert.deepEqual(alexa.splitShoppingItems('牛乳、牛乳'), ['牛乳']);
  assert.deepEqual(alexa.splitShoppingItems('a'.repeat(121)), []);
  assert.deepEqual(alexa.splitShoppingItems(''), []);
});
