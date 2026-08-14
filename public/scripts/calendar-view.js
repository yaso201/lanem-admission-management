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

  function fullName(s) { return (s.programme_label || s.programme_code || '') + ' — ' + (s.label || s.session_code); }
  function pendingOf(s, field) { return (s.pending || []).filter(function (p) { return p.change_field === field; })[0]; }
  function stateOf(s) { return STATE[s.lifecycle_state] || STATE.Draft; }
  function ico(k) { return '<svg class="ico-sm" aria-hidden="true"><use href="#' + k + '"/></svg>'; }
  function badge(s) { const st = stateOf(s); return '<span class="ss ' + st.cls + '"><span class="d"></span>' + st.label + '</span>'; }

  window.EmelaCal = {
    MOIS: MOIS, JOURS: JOURS, STATE: STATE, DATE_FIELDS: DATE_FIELDS, EXAM_FIELDS: EXAM_FIELDS, MODE_UI: MODE_UI,
    toD: toD, toIso: toIso, fmt: fmt, dow: dow, fmtDow: fmtDow, shift: shift, days: days,
    mode: mode, fullName: fullName, pendingOf: pendingOf, stateOf: stateOf, badge: badge, ico: ico
  };
})();
