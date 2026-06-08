/**
 * Empire sync — fetch, paste merge, overlay semantics (G5)
 * AUTON 947d2fc5 — player-authoritative fields never overwritten (DESIGN §3.5)
 */

export const FETCH_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), options.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(t);
  }
}

export function buildEmpireOverlay(empire) {
  if (!empire) return {};
  return {
    generated_at: empire.generated_at,
    metrics: empire.metrics,
    acts: empire.acts?.map((a) => ({
      id: a.id,
      progress_pct: a.progress_pct,
      unlocked: a.unlocked,
    })),
    pump_runs_detected: empire.metrics?.pump_runs_detected,
    legal_enforced_sample: empire.metrics?.legal_enforced_sample,
  };
}

export function applyEmpireOverlayToPlayer(player, empire) {
  const overlay = buildEmpireOverlay(empire);
  return {
    ...player,
    empire_overlay: { ...player.empire_overlay, ...overlay },
  };
}

export function applyPastedEmpirePayload(empireCurrent, player, data) {
  const looksLikeEmpire =
    Array.isArray(data.acts) ||
    Array.isArray(data.loot_deck) ||
    data.scenario_bands != null;

  if (looksLikeEmpire) {
    const empire = { ...(empireCurrent || {}), ...data };
    const updated = applyEmpireOverlayToPlayer(player, empire);
    return { refreshedEmpire: true, player: updated, empire };
  }

  let updated = { ...player };
  if (data.metrics) {
    updated.empire_overlay = {
      ...updated.empire_overlay,
      metrics: { ...updated.empire_overlay?.metrics, ...data.metrics },
      generated_at: data.generated_at || new Date().toISOString(),
    };
    if (data.acts) {
      updated.empire_overlay.acts = data.acts.map((a) => ({
        id: a.id,
        progress_pct: a.progress_pct,
        unlocked: a.unlocked,
      }));
    }
    return { refreshedEmpire: false, player: updated, empire: empireCurrent };
  }

  updated.empire_overlay = { ...updated.empire_overlay, ...data };
  return { refreshedEmpire: false, player: updated, empire: empireCurrent };
}

export async function syncFetchEmpire(empireUrl = './data/empire-state.json') {
  const data = await fetchWithTimeout(empireUrl);
  return { empire: data, syncedAt: new Date().toISOString() };
}