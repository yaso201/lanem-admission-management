import assert from 'node:assert/strict';
import { test } from 'node:test';

/* STAFF-GATE — test UNITAIRE (fenêtre mockée, motif pay-idem-staff) de la brique SÉCURITÉ du
   garde : safeNextPath (validation open-redirect, aux deux bouts) et gotoLogin (URL de retour +
   verrou anti-boucle). api.js est une IIFE liée à `window` ; on mocke les globals AVANT l'import.
   Le verrou de ré-entrée gotoLogin est un état de module → on ré-importe (cache-bust ?fresh=) pour
   repartir d'un module propre à chaque scénario qui navigue. */

function mkWindow(loc) {
  const store = new Map();
  const location = { origin: 'http://localhost', pathname: '/espace-administratif', search: '', href: '', ...loc };
  const window = {
    EMELA_API_BASE: 'http://test.localhost',
    location,
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  globalThis.window = window;
  globalThis.sessionStorage = window.sessionStorage;
  return window;
}
let _n = 0;
async function freshApi(loc) {
  const window = mkWindow(loc);
  await import('../public/scripts/api.js?fresh=' + (_n++));
  return { API: window.EmelaAPI, window };
}

/* ---------- safeNextPath : validation open-redirect (le cœur sécurité) ---------- */
test('safeNextPath : chemins relatifs de même origine ACCEPTÉS', async () => {
  const { API } = await freshApi();
  assert.equal(API.safeNextPath('/liste-dossiers'), '/liste-dossiers');
  assert.equal(API.safeNextPath('/notes?session=S1'), '/notes?session=S1');
  assert.equal(API.safeNextPath('/dossier#x'), '/dossier#x');
});

test('safeNextPath : URL absolues et vecteurs open-redirect REJETÉS', async () => {
  const { API } = await freshApi();
  for (const evil of [
    'https://evil.com',
    'https://evil.com/liste-dossiers',
    'http://localhost.evil.com/',   // suffixe trompeur, origine différente
    '//evil.com',                   // protocole-relatif
    '/\\evil.com',                  // antislash → // pour les schémas spéciaux
    'javascript:alert(1)',
    'data:text/html,x',
  ]) {
    assert.equal(API.safeNextPath(evil), null, 'doit rejeter : ' + evil);
  }
});

test('safeNextPath : /connexion lui-même REJETÉ (anti-boucle) + entrées vides', async () => {
  const { API } = await freshApi();
  assert.equal(API.safeNextPath('/connexion'), null);
  assert.equal(API.safeNextPath('/connexion?next=/x'), null);
  assert.equal(API.safeNextPath(''), null);
  assert.equal(API.safeNextPath(null), null);
  assert.equal(API.safeNextPath(undefined), null);
});

/* ---------- gotoLogin : URL de retour + garde de boucle ---------- */
test('gotoLogin : construit /connexion?next=<chemin validé, encodé>', async () => {
  const { API, window } = await freshApi({ pathname: '/liste-dossiers', search: '?filter=SOU' });
  API.gotoLogin({ next: '/liste-dossiers?filter=SOU' });
  assert.equal(window.location.href, '/connexion?next=%2Fliste-dossiers%3Ffilter%3DSOU');
});

test('gotoLogin : drapeau expire ajouté quand demandé', async () => {
  const { API, window } = await freshApi({ pathname: '/notes' });
  API.gotoLogin({ next: '/notes', expired: true });
  assert.equal(window.location.href, '/connexion?next=%2Fnotes&expire=1');
});

test('gotoLogin : un next hostile est ABANDONNÉ (retour /connexion nu, jamais l’URL externe)', async () => {
  const { API, window } = await freshApi({ pathname: '/reglages' });
  API.gotoLogin({ next: 'https://evil.com' });
  assert.equal(window.location.href, '/connexion');   // pas de ?next= vers l'extérieur
});

test('gotoLogin : déjà sur /connexion → aucune navigation (pas de boucle, DEC-E)', async () => {
  const { API, window } = await freshApi({ pathname: '/connexion' });
  API.gotoLogin({ next: '/espace-administratif' });
  assert.equal(window.location.href, '', 'aucune redirection depuis /connexion');
});

test('gotoLogin : verrou de ré-entrée — deux appels, une seule navigation', async () => {
  const { API, window } = await freshApi({ pathname: '/dossier' });
  API.gotoLogin({ next: '/dossier' });
  const first = window.location.href;
  window.location.href = 'SENTINEL';               // un 2e appel ne doit PAS réécrire
  API.gotoLogin({ next: '/autre' });
  assert.equal(window.location.href, 'SENTINEL', 'le 2e appel est ignoré (verrou)');
  assert.equal(first, '/connexion?next=%2Fdossier');
});
