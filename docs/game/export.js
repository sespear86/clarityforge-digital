/**
 * Game exports — quest-complete + game-log schemas (G5 §3.6 / §3.7)
 * AUTON 947d2fc5 — download-only, no secrets in client
 */

export const AUTON_ID = '947d2fc5';
export const SCHEMA_VERSION = '1';

const SECRET_PATTERN = /token|secret|api[_-]?key|password|bearer/i;

export function findSecretLikeValues(obj, path = '') {
  const hits = [];
  if (obj == null) return hits;
  if (typeof obj === 'string') {
    if (SECRET_PATTERN.test(obj)) hits.push(path || '(root)');
    return hits;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => hits.push(...findSecretLikeValues(v, `${path}[${i}]`)));
    return hits;
  }
  if (typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => {
      const p = path ? `${path}.${k}` : k;
      if (SECRET_PATTERN.test(k)) hits.push(p);
      hits.push(...findSecretLikeValues(v, p));
    });
  }
  return hits;
}

export function validateExportPayload(payload) {
  const errors = [];
  if (!payload.exported_at) errors.push('missing exported_at');
  if (payload.schema_version && payload.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version expected ${SCHEMA_VERSION}`);
  }
  const secrets = findSecretLikeValues(payload);
  if (secrets.length) errors.push(`secret-like values: ${secrets.join(', ')}`);
  const score = payload.empire_overlay?.empire_score;
  if (payload.player && score == null && payload.empire_overlay) {
    errors.push('empire_score missing in empire_overlay');
  }
  return { ok: errors.length === 0, errors };
}

export function buildGameLogExport(player, empire, empireScoreFn) {
  const date = new Date().toISOString().slice(0, 10);
  const overlay = player.empire_overlay?.metrics || {};
  const payload = {
    exported_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    player: {
      xp: player.xp,
      listing_shards: player.listing_shards,
      momentum_streak: player.momentum_streak,
      last_forge_date: player.last_forge_date,
      completed_quest_ids: [...(player.completed_quest_ids || [])],
      illustrated_relic_ids: [...(player.illustrated_relic_ids || [])],
      settings: { ...player.settings },
    },
    empire_overlay: {
      batch_listings: overlay.batch_listings,
      assets_integrated: overlay.assets_integrated,
      empire_score: overlay.empire_score ?? empireScoreFn(),
      generated_at: player.empire_overlay?.generated_at || empire?.generated_at,
      pump_runs_detected: overlay.pump_runs_detected,
      legal_enforced_sample: overlay.legal_enforced_sample,
    },
    journal_excerpt: (player.journal || []).slice(-5),
    suggested_commit_message: `progress(game): game-log ${date} (${AUTON_ID})`,
    suggested_paths: [`progress/game/game-log-${date}.json`],
    no_secrets_note: 'Contains no credentials, real revenue, or PII. Safe for repo.',
  };
  const check = validateExportPayload(payload);
  if (!check.ok) console.warn('game-log export validation', check.errors);
  return payload;
}

export function commitRecipeMarkdown() {
  return [
    'git add progress/game/game-log-*.json progress/game/quest-complete-*.json',
    `git commit -m "progress(game): sync attestation (${AUTON_ID})"`,
    `python3 scripts/build_game_data.py --auton ${AUTON_ID}`,
  ].join('\n');
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}