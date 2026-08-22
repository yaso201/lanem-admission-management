import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdomPkg from 'jsdom';

const { JSDOM, VirtualConsole } = jsdomPkg;

/* STAFF-GATE — test PLEINE PAGE (jsdom) du garde de redirection, sur les pages CONSTRUITES.
   Vérité VISUELLE : les assertions portent sur le style CALCULÉ (getComputedStyle), jamais
   sur la seule propriété DOM (leçon E2E vérité visuelle). Les scripts réels (api/ui/shell)
   s'exécutent ; seul fetch est stubé (aucun serveur).

   CŒUR (check-list point 1) : sans session, la STRUCTURE NE S'AFFICHE PAS — body masqué
   (cloak) ET redirection tentée. Le cloak reste posé pendant la navigation → zéro clignotement.

   FALSIFIABILITÉ : MGMT_DIST_ROOT surchargeable. Pointer le dist de 272779b (SANS cloak)
   doit faire ÉCHOUER les scénarios « sans session / réseau » (RED) ; le dist du worktree
   les fait passer (GREEN). Prouver l'échec sur l'ancien build distingue un test d'une
   constatation. */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.MGMT_DIST_ROOT || path.join(HERE, '..', 'dist');

/* jsdom ≥29 n'a plus ResourceLoader : les scripts LOCAUX du dist sont INLINÉS avant parse
   (mêmes octets que la page servie, zéro réseau). Le cloak, lui, est un <style> INLINE de
   la page → présent tel quel dans le HTML. */
function inline(html, file, re, { required } = {}) {
  const code = fs.readFileSync(path.join(DIST, 'scripts', file), 'utf8');
  const out = html.replace(re, () => '<script>' + code + '</scr' + 'ipt>');
  // assert.ok(false, msg) n'imprime que le message (pas les 55k octets du HTML).
  if (required) assert.ok(out !== html, 'motif d’inlining introuvable pour ' + file + ' (format de balise changé ?)');
  return out;
}
function loadPageHtml(route) {
  let html = fs.readFileSync(path.join(DIST, route, 'index.html'), 'utf8');
  html = inline(html, 'api.js', /<script[^>]*src="\/scripts\/api\.js(?:\?v=\d+)?"[^>]*>\s*<\/script>/, { required: true });
  html = inline(html, 'ui.js', /<script[^>]*src="\/scripts\/ui\.js(?:\?v=\d+)?"[^>]*>\s*<\/script>/, { required: true });
  // shell.js n'est chargé QUE par Layout (pages protégées) ; BareLayout (connexion…) ne l'a pas.
  html = inline(html, 'shell.js', /<script[^>]*src="\/scripts\/shell\.js(?:\?v=\d+)?"[^>]*>\s*<\/script>/, { required: false });
  assert.ok(!/src="\/scripts\//.test(html), 'un script externe /scripts/ n’a pas été inliné');
  return html;
}

function tick(n = 12) {
  return n === 0 ? Promise.resolve()
    : new Promise((r) => setTimeout(r, 0)).then(() => tick(n - 1));
}

/* Réponses de whoami par scénario. `whoami` = staffCall → request() non-raw. */
const WHOAMI_403_NU = { // 403 « nu » : exactement le constat (aucun exc_type/CSRF reconnu par authError)
  ok: false, status: 403,
  headers: { get: () => 'application/json' },
  json: async () => ({ exception: 'Not permitted' }),
};
function whoamiOk(roles) {
  return {
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    // objet « me » nu (sans enveloppe {ok}) → request() le renvoie tel quel
    json: async () => ({ message: { user: 'agent@lanem.bj', full_name: 'Agent Test', roles, csrf_token: 'CSRF' } }),
  };
}
const BENIGN = { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ message: {} }) };

/* whoami: 'ok:<roles>' | '403' | 'network'. Toute autre requête → réponse bénigne. */
function loadPage(route, { url, whoami }) {
  const navAttempts = [];
  const fetchLog = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (/navigation/i.test(String(e && e.message))) navAttempts.push(String(e.message)); });
  const dom = new JSDOM(loadPageHtml(route), {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // Le garde est le SEUL objet du test. On NEUTRALISE le hook de données de page
      // (onEmelaRole → list_dossiers, stats… sans backend réel) : verrou non inscriptible →
      // l'affectation de la page est ignorée, applyRole appelle un no-op. Ces chargements sont
      // hors périmètre (OBS-1 les remonte en prod) et ne doivent pas fausser les assertions.
      Object.defineProperty(window, 'onEmelaRole', { value: () => {}, writable: false, configurable: false });
      window.addEventListener('error', (e) => e.preventDefault());
      window.addEventListener('unhandledrejection', (e) => e.preventDefault());
      window.fetch = (target, opts) => {
        const s = String(target);
        fetchLog.push({ url: s, body: opts && opts.body ? opts.body : null });
        if (/staff\.whoami/.test(s)) {
          if (whoami === 'network') return Promise.reject(new TypeError('Failed to fetch'));
          if (whoami === '403') return Promise.resolve(WHOAMI_403_NU);
          if (whoami && whoami.indexOf('ok:') === 0) return Promise.resolve(whoamiOk(whoami.slice(3).split(',')));
        }
        return Promise.resolve(BENIGN);
      };
    },
  });
  return { window: dom.window, document: dom.window.document, navAttempts, fetchLog };
}

const vis = (w, el) => w.getComputedStyle(el).visibility;
const PROTECTED = ['espace-administratif', 'liste-dossiers', 'tableau-direction'];

/* ---------- CŒUR : sans session, la structure ne s'affiche pas ---------- */
for (const route of PROTECTED) {
  test(`sans session (${route}) : body MASQUÉ + redirection /connexion tentée`, async () => {
    const ctx = loadPage(route, { url: 'http://localhost/' + route, whoami: '403' });
    await tick();
    // body masqué ⇒ header, nav, cartes (tous descendants) masqués aussi (visibility hérite).
    assert.equal(vis(ctx.window, ctx.document.body), 'hidden',
      'la structure NE DOIT PAS s’afficher (cloak maintenu, zéro clignotement)');
    assert.ok(ctx.navAttempts.length > 0, 'une redirection vers /connexion doit être tentée');
  });
}

/* ---------- avec session : révélé, aucun saut, rôle appliqué ---------- */
test('avec session : body RÉVÉLÉ, aucune redirection, rôle serveur appliqué', async () => {
  const ctx = loadPage('espace-administratif', { url: 'http://localhost/espace-administratif', whoami: 'ok:Admission SM' });
  await tick();
  assert.equal(vis(ctx.window, ctx.document.body), 'visible', 'session valide → page révélée');
  assert.equal(ctx.navAttempts.length, 0, 'aucune redirection pour un utilisateur authentifié (DEC-H)');
  assert.equal(ctx.document.body.getAttribute('data-role'), 'sm', 'rôle serveur (SM) appliqué');
  assert.equal(ctx.document.getElementById('auth-cloak'), null, 'le cloak est retiré à la révélation');
});

/* ---------- panne réseau (DEC-F) : pas de déconnexion, carte « Réessayer », structure toujours masquée ---------- */
test('panne réseau : PAS de redirection, carte Réessayer visible, structure toujours masquée', async () => {
  const ctx = loadPage('espace-administratif', { url: 'http://localhost/espace-administratif', whoami: 'network' });
  await tick();
  assert.equal(ctx.navAttempts.length, 0, 'un échec RÉSEAU ne doit JAMAIS déconnecter (DEC-F)');
  const card = ctx.document.getElementById('auth-neterr');
  assert.ok(card, 'une carte de reconnexion doit s’afficher');
  assert.equal(vis(ctx.window, card), 'visible', 'la carte est visible par-dessus le cloak');
  assert.equal(vis(ctx.window, ctx.document.body), 'hidden', 'la structure reste masquée (pas de fuite)');
  assert.match(card.textContent, /Réessayer/);
});

/* ---------- /connexion publique : aucun cloak, aucun whoami, aucune boucle ---------- */
test('/connexion : publique — body visible, aucun appel whoami, aucune redirection', async () => {
  const ctx = loadPage('connexion', { url: 'http://localhost/connexion', whoami: '403' });
  await tick();
  assert.equal(vis(ctx.window, ctx.document.body), 'visible', '/connexion ne doit jamais être masquée');
  assert.equal(ctx.document.getElementById('auth-cloak'), null, '/connexion (BareLayout) ne porte pas le cloak');
  assert.ok(!ctx.fetchLog.some((c) => /staff\.whoami/.test(c.url)), '/connexion n’appelle pas whoami (pas de garde → pas de boucle)');
  assert.equal(ctx.navAttempts.length, 0, 'aucune redirection depuis /connexion');
});
