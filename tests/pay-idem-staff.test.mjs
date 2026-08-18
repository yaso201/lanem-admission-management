import assert from 'node:assert/strict';
import { test, before } from 'node:test';

/* PAY-IDEM (faille 16) — initiation staff : initiateOnlinePayment DOIT envoyer une clé
   d'idempotence STABLE PAR INTENTION (dossier : feeType : online : amount), mémorisée en
   sessionStorage, rejouée sur réessai, neuve si l'identité change.
   api.js est une IIFE liée à `window` (window.EmelaAPI = API). On mocke les globals AVANT
   l'import, on capture le corps POST via fetch. request() est async → on await l'appel. */

let API;
const _session = new Map();
let _bodies = [];

function mkResponse() {
  return {
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ message: { ok: true, data: {} } }),
  };
}

before(async () => {
  globalThis.window = {
    EMELA_API_BASE: 'http://test.localhost',
    sessionStorage: {
      getItem: (k) => (_session.has(k) ? _session.get(k) : null),
      setItem: (k, v) => { _session.set(k, String(v)); },
      removeItem: (k) => { _session.delete(k); },
    },
    location: { pathname: '/dossier' },
    crypto: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2, 10) },
  };
  globalThis.sessionStorage = globalThis.window.sessionStorage;
  globalThis.fetch = async (url, init) => {
    _bodies.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
    return mkResponse();
  };
  _session.set('emela_csrf', 'CSRF');
  await import('../public/scripts/api.js');
  API = globalThis.window.EmelaAPI;
});

function withNow(ms, fn) { const real = Date.now; Date.now = () => ms; try { return fn(); } finally { Date.now = real; } }

async function initiate(ms, id, feeType, acompte) {
  _bodies = [];
  const real = Date.now; Date.now = () => ms;
  try { await API.initiateOnlinePayment(id, feeType, acompte); }
  finally { Date.now = real; }
  return _bodies[_bodies.length - 1].body.idempotency_key;
}

const MIN = 60 * 1000;

test('initiation staff : une clé d’idempotence EST envoyée', async () => {
  _session.clear(); _session.set('emela_csrf', 'CSRF');
  const k = await initiate(1000, 'CAN-1', 'application', 0);
  assert.ok(k, 'le corps POST doit porter idempotency_key');
  assert.match(k, /^pay-/);
});

test('réessai de la même intention → même clé', async () => {
  _session.clear(); _session.set('emela_csrf', 'CSRF');
  const k1 = await initiate(1000, 'CAN-1', 'application', 0);
  const k2 = await initiate(3000, 'CAN-1', 'application', 0);
  assert.equal(k1, k2);
});

test('feeType différent → clé neuve', async () => {
  _session.clear(); _session.set('emela_csrf', 'CSRF');
  const appli = await initiate(1000, 'CAN-1', 'application', 0);
  const enroll = await initiate(1000, 'CAN-1', 'enrollment', 5000);
  assert.notEqual(appli, enroll);
});

test('montant différent → clé neuve', async () => {
  _session.clear(); _session.set('emela_csrf', 'CSRF');
  const a = await initiate(1000, 'CAN-1', 'enrollment', 5000);
  const b = await initiate(1000, 'CAN-1', 'enrollment', 9000);
  assert.notEqual(a, b);
});

test('dossier différent → clé neuve', async () => {
  _session.clear(); _session.set('emela_csrf', 'CSRF');
  const a = await initiate(1000, 'CAN-A', 'application', 0);
  const b = await initiate(1000, 'CAN-B', 'application', 0);
  assert.notEqual(a, b);
});

test('la clé survit au rechargement (sessionStorage) et expire à 30 min', async () => {
  _session.clear(); _session.set('emela_csrf', 'CSRF');
  const k0 = await initiate(0, 'CAN-1', 'application', 0);
  assert.ok(_session.get('emela.staff.payintent').includes(k0), 'clé persistée en sessionStorage');
  const k29 = await initiate(29 * MIN, 'CAN-1', 'application', 0);
  assert.equal(k0, k29, 'à 29 min → même clé (survit au rechargement)');
  const k31 = await initiate(31 * MIN, 'CAN-1', 'application', 0);
  assert.notEqual(k0, k31, 'à 31 min → clé neuve (fenêtre expirée)');
});
