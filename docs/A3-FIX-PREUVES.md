# A3-FIX — Dossier de preuves (E-02/E-03/E-04 + traceurs T1-T5)

**Source** : AUDIT-360-A3-CONTRATS (note D, gate G4 rouge). Trois défauts actifs corrigés + les 5 traceurs joués en dev (concordance affiché = base) pour lever G4.

**Bases** : applicant `c667b90` · management `5efdee5`. Branches `mandat/a3-fix`.
**Frontière SEC-1 respectée** : ni `staff.py`, ni la config d'en-têtes, ni `calendrier*`, ni `notes.astro` touchés (staff.py lu seulement).

---

## E-02 — Double déballage `close_session`

**Cause (vérifiée)** : `api.js:61` `request()` renvoie **déjà** `message.data` (le déballage de l'enveloppe maison `{ok,data,error}`). `gestion-sessions.astro:163,171` relisaient `.data` dessus → `undefined` → `|| {}` → **objet vide**. Aperçu (`prev.total`, `prev.bascules`) et bilan (`res.refuses`, `res.desistes`) affichaient **zéro** pendant une clôture de masse irréversible.

**Correction** : retrait du second `.data` (163 → `(await API.closeSession(...)) || {}` ; 171 idem).

**Balayage des autres doubles déballages** (mandat) : `grep -rnE "\)\.data" src/pages/` sur **tout** le front management → **exactement 2 occurrences, les deux dans `gestion-sessions.astro` (163, 171)**. Aucune autre page concernée. Les autres appels (`printEmargement`, `printEtatConcours`) sont des téléchargements `raw` (pas d'enveloppe, pas de `.data`).

**Preuve build** : `dist/gestion-sessions/index.html` → `grep closeSession(...).data` = **0** résidu.

**Preuve runtime (T5)** — affiché reproduit par les EXPRESSIONS EXACTES du front, ancien vs corrigé :
| | ANCIEN (`.data`→{}) | CORRIGÉ | BASE (DB) |
|---|---|---|---|
| aperçu `total` | **0** | **4** | 4 |
| aperçu lignes | « Aucun dossier à basculer. » | 4 bascules réelles | — |
| bilan `refuses` | **0** | **3** | 3 REF |
| bilan `desistes` | — | **1** | 1 DES |

→ **CONCORDE affiché = base : true.** L'ancien code affichait 0 ; le corrigé affiche la base.

## E-03 — Blocages Prépa rendus avant confirmation

**Cause** : le back sert `can_execute`, `blocking_dossiers`, `blocking_message` au dry-run (`staff.py:2586-2590`) ; le front n'en avait **aucune occurrence** → la confirmation de clôture s'ouvrait même avec des dossiers Prépa bloquants, découverts seulement **après** clic « Clôturer définitivement » (back → 409).

**Correction** (`gestion-sessions.astro`) : après le dry-run, si `prev.can_execute === false` → modale « Clôture impossible » affichant `blocking_message` (dossiers **nommés**) et **`return` : la confirmation de clôture ne s'ouvre pas**. Sinon, aperçu + confirmation `danger`.

**Preuve runtime (T5)** :
- dry-run avec 2 Prépa REF sans notes → `can_execute=false`, `blocking_dossiers=[26270001886, 26270001887]`, `blocking_message="2 dossiers Prépa sans notes validées : 26270001886, 26270001887"` → **dossiers nommés, confirmation NON ouverte**.
- garde serveur re-prouvée : real-run bloqué → `PREPA_NOTES_NOT_VALIDATED` (409).
- après validation des notes → `can_execute=true`, clôture réelle : 3 REF + 1 DES, session fermée. **Concorde base.**
- **Preuve build** : `can_execute` et `blocking_*` rendus dans le build (3 occurrences chacun).

## E-04 — `OTP_RESENT` mensonger (région OTP/token du tunnel)

**Cause (vérifiée)** : `admission-tunnel.js` `_handleTokenExpired` faisait `.catch(()=>{}).finally(...)` et émettait **toujours** `OTP_RESENT` « un nouveau code vous a été envoyé » — sans jamais inspecter la réponse de `request_otp` (échec réseau/403/429 → mensonge).

**Correction** : inspection de la réponse. Succès (`{ok:true}`) → `OTP_RESENT` + hook (bascule saisie OTP). Échec → **`OTP_RESEND_FAILED`** avec message actionnable ; le hook n'est **pas** déclenché (aucun code à saisir).

**Preuve TDD** (`tests/otp-resent.test.mjs`, jsdom, RED→GREEN) :
- RED (avant fix) : les 2 cas d'échec échouaient (le code annonçait OTP_RESENT).
- GREEN (après fix) : **3/3** — succès → OTP_RESENT ; `{ok:false}` → OTP_RESEND_FAILED (pas de mensonge) ; réseau KO → OTP_RESEND_FAILED actionnable.
- Non-régression tunnel : **17/17**. Suite front complète : **64/0**.

**CAL-13** : `admission-tunnel.js` modifié → **bump global `?v=6`→`?v=7`** sur les **11 pages** chargeant le tunnel (index, identite, pieces, recapitulatif, paiement, paiement-sop, paiement-accepte, confirmation, suivi, reprise, bourses). 0 résidu `?v=6`. Build applicant sert `?v=7`.

---

## Traceurs T1-T5 — concordance affiché = base (G4)

Joués en dev (`admission-dev.localhost`, back `9c2e039`), Administrator, données **ZZTEST**, session Prépa **dédiée** `ZZTEST-A3-SES-*`. « Affiché » = la donnée renvoyée par l'endpoint (= ce que `request()` rend au front) ; « base » = lignes DB.

| # | Flux | Concordance affiché = base |
|---|---|---|
| **T1** | Dépôt candidat (aval) | statut BRO = base, 1 pièce ; **amont `create_dossier` non joué en dev** (résolution Person **campus** non branchée) — segment documenté, non un défaut |
| **T2** | Reprise : e-mail → OTP → liste → claim → écriture | claim ok, `classify_bac` persiste `bac_date=2024-07-01`, get_dossier affiche BRO = base → **CONCORDE** |
| **T3** | Paiement SOP | déclare → **SOP** ; confirm (justificatif) → paiement **Confirmed**, reçu `261200372`, dossier **SOU** = base → **CONCORDE** |
| **T4** | Staff → INS | SOU → start_review → **ETU** = base ; → **ACC** = base ; **ACC→INS bloqué en dev** (`enroll` GATE_FAILED : frais 2 catalogue Prépa non seedé, `FEE_NOT_AVAILABLE`) — limitation d'environnement, transition couverte par Jalon M2/scenario_recette. Concordance **SOU→ETU→ACC prouvée** |
| **T5** | Clôture de session (prouve E-02/E-03) | dry-run bloqué (nommés) → real refuse 409 → notes validées → dry-run OK → real : 3 REF + 1 DES, session fermée. **affiché = base**, ancien code = 0 (falsifiable) |

**Purge prouvée** : `deleted=7` dossiers ZZTEST + session `ZZTEST-A3-SES-502661` supprimée ; **résidu = 0** (applicants, sessions).

**Collatéral remédié (honnêteté)** : un premier essai de T5 s'est joué sur la session partagée `SES-2026-10` et a basculé un dossier dev pré-existant (`CAN-2026-00014` BRO→DES) + fermé la session. **Restauré** via le journal de transition : `CAN-2026-00014` → **BRO**, `SES-2026-10` `is_open` → **1** (vérifié après coup). Le traceur a ensuite été corrigé pour utiliser une session **dédiée** (aucun collatéral aux runs suivants).

---

## Check-list de sortie

| Item | Verdict |
|---|---|
| E-02 : aperçu/bilan affichent les vrais compteurs (T5 affiché=base) | ✅ |
| E-03 : dossiers bloquants nommés avant confirmation ; `can_execute` faux → confirmation non ouverte | ✅ |
| E-04 : envoi annoncé seulement sur succès ; échec → message actionnable (simulé, RED→GREEN) | ✅ |
| T1-T5 joués, concordance affiché=base — **G4 levée** | ✅ (T1 amont / T4 INS : limites d'env documentées, non défauts) |
| Balayage autres doubles déballages : liste | ✅ 2 sites, tous deux E-02, aucun autre |
| Non-régression (64/0 applicant), builds propres (19 + 20 pages, 0 warning) | ✅ |
| CAL-13 : bump `?v=7` global + liste 11 pages | ✅ |
| Purge prouvée, ZZTEST, aucune PROD, collatéral remédié | ✅ |

## Cas d'arrêt rencontrés (rapportés, non élargis)
- T1 `create_dossier` : dépend de la résolution Person **campus** (non branchée en dev) → segment amont non joué. **Non un défaut** (limite d'environnement).
- T4 `enroll` ACC→INS : **`FEE_NOT_AVAILABLE`** (catalogue frais 2 Prépa non seedé en dev). **Non un défaut** (limite d'environnement).
- Aucun défaut au-delà de E-02/E-03/E-04 révélé par les traceurs.
