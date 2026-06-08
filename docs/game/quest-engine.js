/**
 * Clarity Quest — quest catalog + completion engine (G3)
 * AUTON 947d2fc5 — pure ESM, no dependencies.
 */

export const AUTON_ID = '947d2fc5';
const FETCH_TIMEOUT_MS = 8000;

const FALLBACK_QUESTS = [
  {
    id: 'forge-pump-daily',
    title: 'Morning Forge',
    tier: 'S',
    type: 'daily',
    phase_act: 1,
    act_slug: 'clearing',
    fun_description: 'Light the forge with a small pump—three listing shards count.',
    real_command_example:
      'python3 scripts/recurring_pump.py --count 3 --wall-art --update-status --auton 947d2fc5',
    steps: [
      { id: 'copy', label: 'Copy pump command', action: 'copy_command' },
      { id: 'run', label: 'Run in terminal or Hermes', action: 'attest' },
      { id: 'sync', label: 'Sync empire state', action: 'sync_hint' },
    ],
    reward_xp: 30,
    reward_shards: 3,
    unlock_type: 'always',
    completion_criteria: {
      type: 'attestation',
      export_on_complete: true,
      suggested_artifact: 'progress/game/quest-complete-forge-pump-daily.json',
    },
    tags: ['pump', 'daily', 'momentum'],
  },
];

function metricsFrom(player, empire) {
  return player?.empire_overlay?.metrics || empire?.metrics || {};
}

export function getQuest(id, quests) {
  if (!Array.isArray(quests)) return null;
  return quests.find((q) => q.id === id) || null;
}

export function isQuestUnlocked(quest, player, empire) {
  if (!quest) return false;
  const unlock = quest.unlock_type || 'always';
  if (unlock === 'always') return true;
  const m = metricsFrom(player, empire);
  if (unlock === 'metric') {
    const req = quest.unlock_requirements || {};
    if (req.batch_listings != null && (m.batch_listings || 0) < req.batch_listings) return false;
    if (req.assets_integrated != null && (m.assets_integrated || 0) < req.assets_integrated) return false;
    if (req.threshold != null && req.metric) {
      const val = m[req.metric] ?? 0;
      if (val < req.threshold) return false;
    }
    return true;
  }
  if (unlock === 'act_unlocked') {
    const acts = empire?.acts || player?.empire_overlay?.acts || [];
    const act = acts.find((a) => a.slug === quest.act_slug || String(a.id) === String(quest.phase_act));
    if (!act) return false;
    return !!act.unlocked;
  }
  if (unlock === 'boss_attestation') {
    const req = quest.unlock_requirements || {};
    if (req.batch_listings != null && (m.batch_listings || 0) < req.batch_listings) return false;
    if (req.assets_integrated != null && (m.assets_integrated || 0) < req.assets_integrated) return false;
    return true;
  }
  return true;
}

export function evaluateCriteria(quest, player, empire, options = {}) {
  const { stepDone = {}, attested = false } = options;
  const criteria = quest?.completion_criteria || { type: 'attestation' };
  const type = criteria.type || 'attestation';

  if (!isQuestUnlocked(quest, player, empire)) {
    return { ok: false, reason: 'Quest is still locked — sync empire state or meet act thresholds.' };
  }

  const steps = quest.steps || [];
  const attestSteps = steps.filter((s) => s.action === 'attest' || s.action === 'attest_boss');
  const allAttestStepsDone =
    attestSteps.length === 0 || attestSteps.every((s) => stepDone[s.id] === true);

  if (type === 'boss_attestation') {
    if (!attested) {
      return {
        ok: false,
        reason: 'Boss quests need your real attestation (Etsy upload / bundle) — tap “I attest & export recipe”.',
      };
    }
    if (!allAttestStepsDone) {
      return { ok: false, reason: 'Mark each boss step done after you complete the real action.' };
    }
    return { ok: true, reason: '' };
  }

  if (type === 'metric_threshold') {
    const m = metricsFrom(player, empire);
    const metric = criteria.metric || 'batch_listings';
    const threshold = criteria.threshold ?? 0;
    const val = m[metric] ?? 0;
    if (val < threshold) {
      return {
        ok: false,
        reason: `Sync first: ${metric} is ${val}; need ≥ ${threshold} from real ramp data.`,
      };
    }
    if (!attested && attestSteps.length) {
      return { ok: false, reason: 'Attest that you reviewed the metric, then complete.' };
    }
    return { ok: true, reason: '' };
  }

  if (type === 'legal_streak') {
    if (!attested) {
      return { ok: false, reason: 'Attest your legal streak day (real pump or batch with disclosure).' };
    }
    const need = criteria.streak_days ?? 1;
    const streak = player?.momentum_streak ?? 0;
    if (streak < need && need > 1) {
      return {
        ok: false,
        reason: `Momentum streak ${streak}; this quest celebrates ${need} legal-forge days — keep going calmly.`,
      };
    }
    return { ok: true, reason: '' };
  }

  if (type === 'companion') {
    const sig = criteria.signal || 'new_pump_ready';
    const cs = empire?.companion_signals || {};
    if (sig === 'new_pump_ready' && (cs.pump_runs_detected || 0) < 1) {
      return { ok: false, reason: 'Sync empire state — no pump run detected yet in companion signals.' };
    }
    if (sig === 'ci_status' && cs.ci_status !== 'green') {
      return { ok: false, reason: 'Sync when CI is green (companion_signals.ci_status).' };
    }
    if (!attested && attestSteps.length) {
      return { ok: false, reason: 'Attest you acted on the companion hint.' };
    }
    return { ok: true, reason: '' };
  }

  // attestation (default)
  if (!attested && !allAttestStepsDone) {
    return { ok: false, reason: 'Mark attest steps done or use the complete button to attest honestly.' };
  }
  return { ok: true, reason: '' };
}

export function bumpMomentum(player, options = {}) {
  const updated = { ...player };
  const today = new Date().toISOString().slice(0, 10);
  if (updated.last_forge_date === today) return updated;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);

  if (options.restDay) {
    if (updated.last_forge_date && updated.last_forge_date !== today) {
      const gap = daysBetween(updated.last_forge_date, today);
      if (gap > 1 && updated.momentum_grace_days_used < 3) {
        updated.momentum_grace_days_used += 1;
      } else if (gap > 1 && updated.momentum_streak < 1) {
        updated.momentum_streak = 1;
      }
    } else if (!updated.last_forge_date) {
      updated.momentum_streak = 1;
    }
    updated.last_forge_date = today;
    return updated;
  }

  if (updated.last_forge_date === y) {
    updated.momentum_streak += 1;
  } else if (updated.last_forge_date) {
    const gap = daysBetween(updated.last_forge_date, today);
    if (gap <= 4 && updated.momentum_grace_days_used < 3) {
      updated.momentum_grace_days_used += 1;
      updated.momentum_streak += 1;
    } else if (gap === 1) {
      updated.momentum_streak += 1;
    } else {
      updated.momentum_streak = 1;
    }
  } else {
    updated.momentum_streak = 1;
  }
  updated.last_forge_date = today;
  return updated;
}

function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.round((d2 - d1) / 86400000);
}

export function buildQuestCompleteExport(quest, xpDelta) {
  const date = new Date().toISOString().slice(0, 10);
  const artifact =
    quest.completion_criteria?.suggested_artifact ||
    `progress/game/quest-complete-${quest.id}-${date}.json`;
  const filename = artifact.includes('/') ? artifact.split('/').pop() : artifact;
  return {
    exported_at: new Date().toISOString(),
    auton: AUTON_ID,
    quest_id: quest.id,
    player_xp_delta: xpDelta ?? quest.reward_xp ?? 0,
    suggested_commit_message: `feat(game): complete quest ${quest.id}`,
    suggested_files: [artifact.startsWith('progress/') ? artifact : `progress/game/${filename}`],
    commit_recipe_markdown: [
      '1. Download this JSON',
      `2. git add progress/game/quest-complete-${quest.id}-*.json`,
      `3. git commit -m "feat(game): complete quest ${quest.id}"`,
      '4. Optional: grok_com_github push_files for progress/game/',
    ].join('\n'),
    mcp_snippet_hint: 'push_files for progress/game/ — no secrets in client exports',
    append_journal_path: 'progress/game/',
  };
}

export function completeQuest(questId, ctx) {
  const {
    player,
    empire,
    quests = [],
    stepDone = {},
    attested = false,
  } = ctx;

  const quest = getQuest(questId, quests);
  if (!quest) {
    return { success: false, reason: 'Quest not found.' };
  }
  if (player.completed_quest_ids?.includes(questId)) {
    return { success: false, reason: 'Already completed.' };
  }

  const evalResult = evaluateCriteria(quest, player, empire, { stepDone, attested });
  if (!evalResult.ok) {
    return { success: false, reason: evalResult.reason };
  }

  let updated = {
    ...player,
    completed_quest_ids: [...(player.completed_quest_ids || []), questId],
    xp: (player.xp || 0) + (quest.reward_xp || 0),
    listing_shards: (player.listing_shards || 0) + (quest.reward_shards || 0),
    journal: [...(player.journal || [])],
    attestations: { ...(player.attestations || {}) },
  };

  const momentumQuest =
    quest.type === 'daily' ||
    quest.id === 'rest-day-nurture' ||
    (quest.tags || []).includes('momentum');
  if (momentumQuest) {
    updated = bumpMomentum(updated, { restDay: quest.id === 'rest-day-nurture' });
  }

  if (quest.id === 'market-crossing-first-8') {
    updated.attestations.first_eight_crossing = true;
  }
  if (quest.id === 'market-crossing-etsy') {
    updated.attestations.etsy_first_upload = true;
  }

  const journalEntry = {
    at: new Date().toISOString(),
    quest_id: questId,
    note: `Completed ${quest.title}`,
  };
  updated.journal.push(journalEntry);

  let exportPayload = null;
  const criteria = quest.completion_criteria || {};
  if (criteria.export_on_complete) {
    exportPayload = buildQuestCompleteExport(quest, quest.reward_xp || 0);
  }

  return {
    success: true,
    reason: '',
    xpDelta: quest.reward_xp || 0,
    shardsDelta: quest.reward_shards || 0,
    exportPayload,
    journalEntry,
    playerUpdated: updated,
  };
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function loadQuestsCatalog(url = './data/quests.json') {
  try {
    const data = await fetchWithTimeout(url);
    if (Array.isArray(data) && data.length) return data;
    if (Array.isArray(data?.quests) && data.quests.length) return data.quests;
  } catch {
    /* offline or missing */
  }
  return [...FALLBACK_QUESTS];
}