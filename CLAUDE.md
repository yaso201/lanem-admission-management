# lanem-admission-management — consignes pour les agents

**Rôle :** back-office staff admission : Astro 5 statique (`@emela/management` 1.0.0), Cloudflare
**Domaine propriétaire :** admission · **Bench :** —
**Branche principale :** `main` — on n'y pousse jamais directement : tout passe par une demande de fusion.
**Registres du domaine (corpus `si-lanem-corpus`) :** `admission/DEC-ADMISSION.md` · `admission/CORRECTIONS-ADMISSION.md`
· transverse : `_commun/M02-Registre-Decisions.md` · banc : `campus/gestion-contruction/BANC-DEV.md`

## 1. Avant d'écrire une ligne

1. **Pas de mandat, pas de code.** Un mandat est un fichier `MANDAT-<ID>.md` lu **sur GitHub**
   (`si-lanem-corpus/_commun/mandats/`), jamais un texte collé dans la conversation (DEC-ORG-01).
2. **Write-set = contrat.** Tu n'écris que dans les chemins listés par le mandat. Besoin d'un autre fichier :
   **STOP**, demande d'extension à l'architecte (DEC-ORG-04). Un garde-fou refuse l'écriture hors write-set.
3. **Cinq phases, deux pauses.** Reconnaissance (lecture seule) → Plan → ⏸️ PAUSE 1 → Exécution →
   ⏸️ PAUSE 2 (= la demande de fusion) → Vérification → Rapport.
4. **Branche `mandat/<ID>`**, une demande de fusion vers `main`. Tu ne fusionnes jamais toi-même (DEC-ORG-03),
   et tu ne supprimes aucune branche distante : fusion et suppression des branches fusionnées sont des gestes de
   la MOA, sauf si le mandat dit autre chose (V-LEARN-MEP30-05, V-LEARN-MEP30-06).
5. **Fin de session = tout est poussé.** Un commit qui ne quitte pas la machine n'existe pas (DEC-ORG-02).
   C'est ainsi que le back M1/M1c a été perdu le 22/10/2026.
6. **Avant la phase 1 : `gh auth status`.** Si tu ne peux pas écrire sur GitHub, STOP tout de suite, pas à la
   pause 1 (V-LEARN-MEP30-01).
7. **Le rapport vit sur sa branche du corpus dès la phase 1**, jamais dans un brouillon local : un brouillon de
   session s'efface d'un jour à l'autre (V-LEARN-MEP30-03).

## 2. Secrets — DEC-346 (`_commun/PROCEDURE-SECRETS.md`)

- Tu ne reçois **jamais** de mot de passe. Pour prouver un clic : tu te fabriques une **clé d'API Frappe**
  sur un compte de test `rf-g-*`, tu la révoques en fin de vague, et tu inscris les deux gestes à `BANC-DEV.md`
  (date, compte, mandat — **jamais la valeur**).
- Aucun secret dans un commit, un rapport, un message. Un secret commité est **réputé compromis** : STOP, incident.
- Aucun accès recette / production depuis un banc de développement.

## 3. Ce dépôt

| Élément | Valeur constatée |
|---|---|
| Apps / paquets | `package.json` : `@emela/management` ; `astro` ; `@emela/design-system` (vendoré) · `wrangler.jsonc` (assets `dist`) |
| Suites de tests | `npm test` (`node --test tests/*.test.mjs`) (constatée, non exécutée) · `tests/contract/consumer.test.mjs` : {{À CONSTATER}} (hors du glob de `npm test`) |
| Baseline de référence | à re-mesurer (MEP-11) — aucune baseline valide au 10/11/2026 |
| Dépendances inter-dépôts | appelle `admission-lanem-api` (`admission.api.staff.*`, `calendar*`, `admin_*`, `account.*`, `health.*` ; session Frappe native `/api/method/login`) · `PUBLIC_API_BASE` au build · schémas de contrat copiés du back |
| Pièges connus | DEC-331 (la version suit le back) · DEC-275 (session Frappe native ; sécurité côté serveur) · DEC-264 (authentification locale, pas d'OIDC) · DEC-308 (le front n'énonce que ce que le serveur porte) · DEC-262 (cloisonnement livré débranché) · ADM-DEBT-14 (polices non chargées) · ADM-DEBT-69 (`PUBLIC_API_BASE`, CORS, test en vrai navigateur) |

## 4. Règles apprises (à respecter sans les redécouvrir)

**Tous les dépôts**
- V-LEARN-MEP30-04 · pour relever les règles d'un `.gitignore`, lire aussi les négations `!` placées plus bas

**Fronts**
- jetons de design : le système du dépôt, sans en mélanger un autre — `--ink-*` / `--sand-*` de `@emela/design-system` (alias `--ln-*`)
- aucune **nouvelle** ressource externe (3G Bénin) ; écarts existants : aucun dans le code ; la CSP (`public/_headers`) autorise `static.cloudflareinsights.com`
- un acte = un bouton branché **prouvé par clic** depuis la version servie, jamais par lecture du code

## 5. Le rapport

Format standard (Reconnaissance · Plan · Exécution · Audits automatiques · Vérifications · Tests · Anomalies ·
Apprentissages). Compteurs **exacts** et comparés à la baseline ; « préexistant » distingué de « causé ».
Il se dépose dans le corpus, **par demande de fusion**, au chemin fixé par le mandat.

**Commits** : identité git habituelle du dépôt. Par défaut, garde la ligne de co-auteur de ton outil : on doit
savoir qu'un agent a écrit. Un mandat qui fixe un message exact dit s'il la veut (`VERDICT-MANDAT-ZERO-PC2.md` §3).

## 6. Interdits

Pousser sur `main` · fusionner · supprimer une branche distante · écrire hors write-set · stocker ou
afficher un secret · toucher la production · réécrire l'historique (`--force`) · déclarer une gate close
(c'est l'architecte).
