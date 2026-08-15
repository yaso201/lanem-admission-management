/* GESTION-CALENDRIER — helpers de rendu partagés par les 4 écrans calendrier.
   À DÉPOSER dans : fronts/apps/management/public/scripts/calendar-view.js
   À charger dans les pages calendrier via <script is:inline src="/scripts/calendar-view.js"></script>
   (après api.js/ui.js du Layout, avant le script de page).

   Ce fichier ne contient AUCUNE règle métier : les règles arrivent du serveur dans
   `session.policies` (calendar_rules.field_policies). Il ne fait que formater et étiqueter. */
(function () {
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

  function toD(x) { if (x instanceof Date) return new Date(x.getTime()); const p = String(x).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function toIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmt(x) { if (!x) return '—'; const d = toD(x); return d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear(); }
  function dow(x) { return x ? JOURS[toD(x).getDay()] : ''; }
  function fmtDow(x) { return x ? dow(x) + ' ' + fmt(x) : '—'; }
  function shift(x, n) { const d = toD(x); d.setDate(d.getDate() + n); return toIso(d); }
  function days(a, b) { return Math.round((toD(b) - toD(a)) / 86400000); }

  /* CAL-11 : les valeurs de pending sont des CHAÎNES typées par champ (date ISO, heure
     "7:30:00"/"07:45" — str(timedelta) serveur peut omettre le zéro de tête —, salle libre).
     Un formateur de date sur une heure rend « NaN undefined » : dispatch par fieldname.
     UNE implémentation, trois consommateurs (cartes validations, fiche session, modale).
     La salle sort BRUTE : c'est l'APPELANT qui échappe (esc). */
  const DATE_KEYS = { opens_on: 1, closes_on: 1, exam_date: 1, bac_results_date: 1 };
  const TIME_KEYS = { exam_call_time: 1, exam_start_time: 1 };
  function fmtTime(v) {
    if (!v) return '—';
    const p = String(v).split(':');
    return String(p[0] || '0').padStart(2, '0') + ':' + String(p[1] || '00').padStart(2, '0');
  }
  function fmtVal(field, v) {
    if (v === null || v === undefined || v === '') return '—';
    if (DATE_KEYS[field]) return fmtDow(v);
    if (TIME_KEYS[field]) return fmtTime(v);
    return String(v);
  }

  /* CAL-02 : filtre/recherche CLIENT (22 sessions, tout est déjà servi par calendar_list).
     norm : insensible casse ET accents (NFD, diacritiques strippés). */
  function norm(x) {
    return String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  /* Prédicat de filtre — pur : q sur libellé+code, programme exact, état lifecycle exact.
     Filtrer « Open » INCLUT les échues : la nuance reste un badge, pas un état (FIX-1). */
  function sessionMatches(s, flt) {
    if (!flt) return true;
    if (flt.q && norm(s.label + ' ' + s.session_code).indexOf(norm(flt.q)) === -1) return false;
    if (flt.prog && s.programme_code !== flt.prog) return false;
    if (flt.state && s.lifecycle_state !== flt.state) return false;
    return true;
  }
  /* CAL-02 : ouverture EFFECTIVE d'une année d'accordéon. openAA = état UTILISATEUR (base,
     jamais écrasé par le filtre) ; openFlt = calque TRANSITOIRE pendant un filtre (défaut :
     ouvert), vidé à chaque changement de filtre et au reset → l'accordéon de base est
     restitué à l'identique en sortie de filtre. */
  function effectiveOpen(ay, filtersActive, openAA, openFlt) {
    if (!filtersActive) return !!openAA[ay];
    return openFlt[ay] !== undefined ? !!openFlt[ay] : true;
  }

  /* Les trois états du lifecycle (§2). `display_status` du serveur (brouillon/a_venir/echue/
     fermee) est une NUANCE d'affichage : il ne remplace pas le badge d'état. */
  const STATE = {
    Draft: { label: 'Brouillon', cls: 'ss--bro', pub: false },
    Open: { label: 'Ouverte', cls: 'ss--ouv', pub: true },
    Closed: { label: 'Fermée', cls: 'ss--fer', pub: true }
  };

  /* Les quatre dates, dans l'ordre d'affichage — fieldnames du doctype Admission Session. */
  const DATE_FIELDS = [
    { k: 'opens_on', label: 'Ouverture des dépôts', short: 'Ouverture' },
    { k: 'closes_on', label: 'Clôture des dépôts', short: 'Clôture' },
    { k: 'exam_date', label: 'Épreuve écrite', short: 'Épreuve' },
    { k: 'bac_results_date', label: 'Résultats du bac', short: 'Résultats bac' }
  ];
  const EXAM_FIELDS = [
    { k: 'exam_call_time', label: 'Heure d’appel', type: 'time' },
    { k: 'exam_start_time', label: 'Début des épreuves', type: 'time' },
    { k: 'exam_room', label: 'Salle', type: 'text' }
  ];

  /* Mode d'un champ, dérivé de la politique SERVEUR — jamais recalculé ici. */
  function mode(policy) {
    if (!policy || !policy.editable) return 'locked';
    if (policy.constraint === 'extend_only') return 'extend';
    if (policy.constraint === 'postpone_only') return 'postpone';
    return 'free';
  }
  const MODE_UI = {
    locked: { tag: 'Verrouillé', tagCls: 'fld-tag--lock', icon: 'i-lock', whyCls: 'why--locked' },
    extend: { tag: 'Validation Direction', tagCls: 'fld-tag--val', icon: 'i-arrowright', whyCls: 'why--bound' },
    postpone: { tag: 'Validation Direction', tagCls: 'fld-tag--val', icon: 'i-warning', whyCls: 'why--warn' },
    free: { tag: 'Sans validation', tagCls: 'fld-tag--free', icon: 'i-checkcircle', whyCls: 'why--free' }
  };

  /* DEC-C : mot d'état d'un champ pour le panneau des règles — mapping de PRÉSENTATION pur
     (patron MODE_UI), 100 % dérivé de la structure servie (editable/constraint/validation/
     reissue). AUCUNE règle écrite ici : si le serveur change une policy, le panneau suit. */
  function ruleWord(p) {
    const m = mode(p);
    if (m === 'locked') return 'Verrouillé';
    if (m === 'extend') return 'Prolongeable · validation Direction';
    if (m === 'postpone') return 'Reportable · validation Direction';
    return (p && p.requires_validation ? 'Modifiable · validation Direction' : 'Libre, sans validation');
  }

  /* DEC-C : hôtes de DÉVELOPPEMENT — le bloc « Détails techniques » n'est RENDU que là
     (pas masqué : absent du DOM en prod). Hygiène UX, pas sécurité : les policies sont déjà
     servies au client par l'API. Un futur env recette dédié s'ajoute ICI, nulle part ailleurs. */
  function isDevHost() {
    const h = (typeof location !== 'undefined' && location.hostname) || '';
    return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
  }

  function fullName(s) { return (s.programme_label || s.programme_code || '') + ' — ' + (s.label || s.session_code); }
  function pendingOf(s, field) { return (s.pending || []).filter(function (p) { return p.change_field === field; })[0]; }
  function stateOf(s) { return STATE[s.lifecycle_state] || STATE.Draft; }
  function ico(k) { return '<svg class="ico-sm" aria-hidden="true"><use href="#' + k + '"/></svg>'; }
  /* CAL-03 : `display_status` du serveur ne sert QUE la nuance « échue » (Open à date de clôture
     dépassée, avant le passage du job nocturne). Les états restent rendus depuis lifecycle_state
     — pas de double source d'affichage. Une Closed échue reste « Fermée » (badge déjà juste). */
  function isEchue(s) { return s.lifecycle_state === 'Open' && s.display_status === 'echue'; }
  function badge(s) {
    const st = stateOf(s);
    if (isEchue(s)) return '<span class="ss ss--ech"><span class="d"></span>' + st.label + ' — échue</span>';
    return '<span class="ss ' + st.cls + '"><span class="d"></span>' + st.label + '</span>';
  }

  window.EmelaCal = {
    MOIS: MOIS, JOURS: JOURS, STATE: STATE, DATE_FIELDS: DATE_FIELDS, EXAM_FIELDS: EXAM_FIELDS, MODE_UI: MODE_UI,
    toD: toD, toIso: toIso, fmt: fmt, dow: dow, fmtDow: fmtDow, shift: shift, days: days,
    fmtTime: fmtTime, fmtVal: fmtVal, isEchue: isEchue,
    ruleWord: ruleWord, isDevHost: isDevHost,
    norm: norm, sessionMatches: sessionMatches, effectiveOpen: effectiveOpen,
    mode: mode, fullName: fullName, pendingOf: pendingOf, stateOf: stateOf, badge: badge, ico: ico
  };
})();
