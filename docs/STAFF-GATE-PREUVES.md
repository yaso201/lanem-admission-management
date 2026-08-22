# STAFF-GATE — Dossier de preuves

**Lot** : redirection des pages staff non authentifiées (front management).
**Branche** : `mandat/staff-gate` — worktree `admission/worktrees/staff-gate`.
**Base** : `272779b` (tag `v1.0.0`, tête PROD `origin/main` du dépôt `yaso201/lanem-admission-management`).
**Protocole** : DEC-L (recon → pause unique validée → exécution continue → ce rapport). **Arrêt au push.**
**Baseline** : back non touché (aucun fichier back au write-set). Suite front management **27 / 0 / 0**.

---

## 1. Cause exacte (confirmée en recon, plus fine que le constat)

Le front est **statique** (`astro.config.mjs` : aucun adapter — « tout le runtime est côté client »). Sur chaque page protégée, `shell.js` appelle `whoami()` au `DOMContentLoaded`. Deux défauts se cumulaient :

1. **Le 403 « nu » n'était jamais reconnu.** Dans `api.js`, `authError()` ne renvoie `true` que pour un `401`, un `exc_type` précis (`SessionExpired|AuthenticationError|CSRFTokenError|PermissionError: You do not have enough permissions`) ou un `403 + CSRF`. Un visiteur **sans session** reçoit un `403` générique (`PermissionError` « Not permitted ») → `authError` = `false` → `request()` lève `HTTP_403` → le `catch` de `boot()` faisait `return` **silencieux** → **aucune redirection**, la page restait rendue. **Ce n'est pas une fuite** (aucune donnée servie, l'audit A2 tient), mais une **exposition de structure**.
2. **Même le chemin qui marchait (401) redirigeait trop tard** : après `DOMContentLoaded`, donc **après** le rendu → clignotement.

## 2. Conception retenue (cloak + reveal, pilotés par le garde)

Front statique ⇒ pas de redirection serveur possible ; la session est un appel réseau async ⇒ on ne peut pas *savoir* avant de peindre. Donc **on masque avant de peindre, on tranche au verdict** :

- **Cloak** : `Layout.astro` pose en tête de `<head>` `<style is:inline id="auth-cloak">body{visibility:hidden!important}</style>`. `is:inline` est **obligatoire** — sinon Astro scope le style (`body` → `body[data-astro-cid]`) et l'extrait dans le bundle CSS : le cloak ne s'appliquerait jamais.
- **Verdict dans `shell.js` `boot()`** :
  - **session valide** → `applyRole()` (rôle + nav filtrée) puis `reveal()` (retire le cloak) → la page apparaît **déjà dans son état final** ;
  - **échec d'auth** (tout `whoami` non-réseau : 401/403/…) → `gotoLogin({next})` : redirection `/connexion?next=<page>`, **cloak maintenu** → la structure **ne s'affiche jamais** (cœur du lot) ;
  - **panne réseau** (DEC-F) → **pas de déconnexion** : carte bloquante « Réessayer » affichée `visibility:visible` par-dessus le cloak (le body reste masqué → **pas de fuite**).
- **`reveal()` s'exécute AVANT le chargement des données de page** (`onEmelaRole` déplacé après `reveal()`) : une erreur de données ne peut plus laisser la page masquée.
- **`next` validé aux deux bouts** (`safeNextPath`) : émission (`gotoLogin` construit le `next`) **et** réception (`connexion.astro` avant de rediriger). N'accepte qu'un chemin relatif de **même origine** ; rejette `//host`, `https://evil`, `javascript:`, antislash, et `/connexion` (anti-boucle).
- **Sans failsafe — choix assumé, documenté dans le code** (à côté du cloak dans `Layout.astro`). Un révélateur temporisé serait un contournement (bloquer `shell.js` suffirait à voir la structure). Scripts non chargés ⇒ **page blanche** (panne visible, remontée par OBS-1).

## 3. Write-set (conforme au mandat — 6 fichiers + 2 tests)

```
 public/_headers              |  7 +++++-      CSP : + static.cloudflareinsights.com (script-src, Report-Only)
 public/scripts/api.js        | 39 +++++++++-- gotoLogin + safeNextPath (helper unique), authError→gotoLogin(next)
 public/scripts/shell.js      | 54 ++++++++++- reveal/showNetworkRetry, boot restructuré, reveal avant onEmelaRole
 src/layouts/BareLayout.astro |  4 +++-        api.js ?v=4→?v=5 (connexion consomme safeNextPath)
 src/layouts/Layout.astro     | 22 +++++++---  cloak is:inline + rationale no-failsafe ; api.js ?v=5, shell.js ?v=1
 src/pages/connexion.astro    |  5 +++-        lit+valide ?next=, redirige dessus sinon accueil rôle
 tests/staff-gate-page.test.mjs   (nouveau)   preuve pleine page jsdom (falsifiable via MGMT_DIST_ROOT)
 tests/staff-gate-guard.test.mjs  (nouveau)   preuve unitaire safeNextPath/gotoLogin (open-redirect)
```

**Aucun fichier back. Aucun fichier applicant.** `api.js` : strictement le helper unique de redirection (justifié — évite deux implémentations divergentes entre `shell.js` et `api.js`). Aucun endpoint touché (DEC-A : le serveur reste l'autorité).

## 4. Inventaire des pages — **toutes couvertes** (check-list point 6)

Vérifié sur le **dist construit** (présence de `#auth-cloak`). Frontière **structurelle** : `Layout` = protégé, `BareLayout`/aucun = public.

| Page | Layout | Cloak | Statut |
|---|---|---|---|
| espace-administratif | Layout | ✅ | **protégée** |
| cockpit-responsable | Layout | ✅ | **protégée** |
| tableau-direction | Layout | ✅ | **protégée** |
| liste-dossiers | Layout | ✅ | **protégée** |
| dossier | Layout | ✅ | **protégée** |
| calendrier | Layout | ✅ | **protégée** |
| calendrier-duplication | Layout | ✅ | **protégée** |
| calendrier-session | Layout | ✅ | **protégée** |
| calendrier-validations | Layout | ✅ | **protégée** |
| notes | Layout | ✅ | **protégée** |
| gestion-sessions | Layout | ✅ | **protégée** |
| personnel | Layout | ✅ | **protégée** |
| exploitation | Layout | ✅ | **protégée** |
| reglages | Layout | ✅ | **protégée** |
| connexion | BareLayout | — | publique |
| mot-de-passe-oublie | BareLayout | — | publique |
| reinitialisation | BareLayout | — | publique |
| update-password | BareLayout | — | publique |
| 404 | BareLayout | — | publique |
| index | aucun | — | publique (stub `location.replace('/connexion')`, `<body>` vide) |

**14 protégées, 6 publiques, 0 incohérence** (vérification automatique : aucun `MISMATCH`). La classe est fermée : toute page héritant de `Layout` est gardée **par construction**.

## 5. Preuve par falsifiabilité (RED sur l'ancien build → GREEN sur le nouveau)

Le dist pristine de `272779b` a été archivé **avant** toute modification. Le test pleine page pointe ce dist via `MGMT_DIST_ROOT`.

**RED — même test, dist `272779b` (pré-lot)** :
```
✖ sans session (espace-administratif) : body MASQUÉ + redirection /connexion tentée
✖ sans session (liste-dossiers)       : body MASQUÉ + redirection /connexion tentée
✖ sans session (tableau-direction)    : body MASQUÉ + redirection /connexion tentée
✔ avec session : body RÉVÉLÉ, aucune redirection, rôle serveur appliqué   (invariant)
✖ panne réseau : PAS de redirection, carte Réessayer visible, structure masquée
✔ /connexion : publique — body visible, aucun whoami, aucune redirection   (invariant)
```
→ Sur l'ancien build : la structure **s'affiche** (`body` visible), **aucune** redirection, **aucune** carte réseau. Le défaut est bien celui que le test détecte.

**GREEN — même test, dist du worktree (post-lot)** :
```
✔ sans session (espace-administratif) : body MASQUÉ + redirection /connexion tentée
✔ sans session (liste-dossiers)       : body MASQUÉ + redirection /connexion tentée
✔ sans session (tableau-direction)    : body MASQUÉ + redirection /connexion tentée
✔ avec session : body RÉVÉLÉ, aucune redirection, rôle serveur appliqué
✔ panne réseau : PAS de redirection, carte Réessayer visible, structure toujours masquée
✔ /connexion : publique — body visible, aucun whoami, aucune redirection
```

**Vérité visuelle** : les assertions portent sur `getComputedStyle(body).visibility` (`hidden`/`visible`), jamais sur une propriété DOM. `body` masqué ⇒ header, nav, cartes (tous descendants) masqués (visibility hérite). La redirection est captée par le `jsdomError` « navigation to another Document » ; le cloak reste posé pendant la navigation → **zéro clignotement**.

## 6. Preuve unitaire — validation open-redirect (check-list point 3)

`tests/staff-gate-guard.test.mjs` (fenêtre mockée) — **8/8 ✔** :
- `safeNextPath` **accepte** `/liste-dossiers`, `/notes?session=S1`, `/dossier#x` ;
- **rejette** `https://evil.com`, `http://localhost.evil.com/`, `//evil.com`, `/\evil.com`, `javascript:alert(1)`, `data:…`, `/connexion`, `/connexion?…`, vide/null ;
- `gotoLogin({next:'/liste-dossiers?filter=SOU'})` → `/connexion?next=%2Fliste-dossiers%3Ffilter%3DSOU` ;
- `expired:true` → `…&expire=1` ;
- **next hostile abandonné** : `gotoLogin({next:'https://evil.com'})` → `/connexion` **nu** (jamais l'URL externe) ;
- déjà sur `/connexion` → **aucune** navigation (anti-boucle, DEC-E) ;
- verrou de ré-entrée : deux appels → **une** seule navigation.

## 7. CSP (DEC-G)

Avant : `script-src 'self' 'unsafe-inline'`
Après : `script-src 'self' 'unsafe-inline' static.cloudflareinsights.com` — **toujours `Content-Security-Policy-Report-Only`** (non bloquant). Vérifié dans `dist/_headers` (servi par Cloudflare Pages).
*Note hors périmètre* : `beacon.min.js` émet ensuite vers `cloudflareinsights.com` (violation `connect-src`) — signalée dans `_headers`, à intégrer au lot « CSP bloquante ».

## 8. Check-list de sortie

| # | Exigence | Statut |
|---|---|---|
| 1 | Sans session : structure **ne s'affiche pas, même brièvement** | ✅ `body` `hidden` + redirection, cloak maintenu (RED→GREEN, 3 pages) |
| 2 | Avec session : comportement **strictement inchangé** | ✅ révélé, aucun saut, rôle serveur appliqué ; seule différence = quelques ms masquées avant `whoami` (déjà requis pour peupler la page) |
| 3 | Retour à la page + **URL absolue rejetée** | ✅ `?next=` validé aux deux bouts ; open-redirect rejeté (8/8 unitaires) |
| 4 | Panne réseau : message, **pas de déconnexion** | ✅ carte « Réessayer », aucune redirection, structure masquée |
| 5 | `/connexion` accessible, **aucune boucle** | ✅ publique (pas de cloak, pas de `whoami`), `gotoLogin` no-op sur `/connexion` |
| 6 | **Toutes** les pages couvertes | ✅ 14/14 protégées cloakées, 6 publiques propres, 0 incohérence |
| 7 | CSP : `static.cloudflareinsights.com`, **Report-Only** | ✅ vérifié dans `dist/_headers` |
| 8 | Build propre · jsdom vert · `?v=` bumpé | ✅ 0 avertissement · 27/27 · api.js `?v=5`, shell.js `?v=1` |

## 9. Notes & dettes

- **Dette fermée** : `shell.js` était servi **sans** paramètre de cache (comme `ui.js` avant A11Y-1) → versionné `?v=1`. À bumper à toute modif désormais.
- **Note (hors périmètre)** : `connect-src` du beacon Cloudflare — pour le lot CSP bloquante.
- **Invariants** : `git add` nominatif · jetons uniquement · CAL-13 respecté (api.js `?v=5` dans Layout **et** BareLayout ; shell.js `?v=1`) · build sans avertissement · jsdom pleine page · **aucun changement back** · aucune écriture PROD.
- `jsdom` installé en `--no-save` (node_modules non copié au worktree, précédent établi) → `package.json` inchangé.

**Fusion et déploiement appartiennent à l'architecte. Ce lot s'arrête au commit sur `mandat/staff-gate`.**
