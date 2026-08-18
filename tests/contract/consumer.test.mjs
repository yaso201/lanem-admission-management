/* CONTRAT-1 — Contrat CÔTÉ CONSOMMATEUR (management).
   Pour chaque endpoint consommé, les champs que le front LIT (source : AUDIT-360-A3 §2.1, file:line)
   doivent être GARANTIS par le schéma. Si le back cesse d'en servir un (schéma mis à jour), le champ
   consommé n'est plus au contrat → ROUGE. Rejeux E-01 (fantôme) et E-02 (double déballage) inclus.
   Lancement : node --test tests/contract/*.test.mjs (aucune modif de package.json). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSchema, pathInSchema, missingFromContract } from './check.mjs';

/* Champs consommés par le management, encodés depuis A3 §2.1 (fichier:ligne en commentaire). */
const CONSUMED = {
  'admin_config.get_config_health': [ // reglages.astro:63-78
    'campus.present', 'uf.present', 'fedapay.present', 'fedapay.mode',
    'hmac_secret.present', 'webhook_secret.present', 'smtp.present',
    'flags.developer_mode', 'flags.expose_dev_otp', 'flags.fedapay_mock',
  ],
  'admin_ops.get_ops_health': [ // exploitation.astro:72-98 (OBS-1)
    'uf_unreplicated', 'bridge_pending', 'pending_online_stale', 'orphan_refund_due',
    'underpaid_review', 'refused_terminal', 'email_queue_error', 'scheduled_job_failed_24h',
  ],
  'admin_referentiel.get_degraded_status': ['degraded_mode', 'manual_count', 'campus_count', 'total'], // reglages.astro:98-113
  'staff.whoami': ['user', 'full_name', 'roles', 'csrf_token'], // api.js:120-124
  'staff.stats_direction': ['par_statut', 'par_programme', 'encaisse_xof', 'sessions'], // tableau-direction.astro:132-165
};

for (const [id, consumed] of Object.entries(CONSUMED)) {
  test(`contrat consommateur — ${id} : tous les champs lus sont garantis`, () => {
    const schema = loadSchema(id);
    const missing = missingFromContract(schema, consumed);
    assert.deepEqual(missing, [], `champs lus mais NON garantis par le contrat : ${missing.join(', ')}`);
  });
}

/* ── Rejeu E-01 (fantôme) : le front lit fedapay.mode ; le contrat DOIT le garantir, et NE DOIT PAS
   contenir kkiapay (la forme d'origine). Sur l'ancien schéma kkiapay, `fedapay.mode` serait manquant. */
test('rejeu E-01 — fedapay garanti, kkiapay absent du contrat', () => {
  const s = loadSchema('admin_config.get_config_health');
  assert.ok(pathInSchema(s, 'fedapay.mode'), 'fedapay.mode doit être au contrat');
  assert.ok(!pathInSchema(s, 'kkiapay.mode'), 'kkiapay (fantôme) ne doit PAS être au contrat');
});

/* ── Rejeu E-02 (double déballage) : le consommateur corrigé lit data.total ; l'original lisait
   data.data.total. Le chemin double-déballé ne doit PAS exister dans le data-schéma. */
test('rejeu E-02 — close_session : total au contrat, data.total (double déballage) absent', () => {
  const s = loadSchema('staff.close_session');
  for (const good of ['total', 'bascules', 'can_execute']) assert.ok(pathInSchema(s, good), `${good} attendu`);
  assert.ok(!pathInSchema(s, 'data.total'), 'le chemin double-déballé data.total ne doit pas exister');
});
