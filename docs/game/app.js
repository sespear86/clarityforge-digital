/**
 * Clarity Quest: Empire Forge — G2 bootstrap (ESM)
 * AUTON 947d2fc5 — shell, router, localStorage, sync/export stubs for G5.
 */

const STORAGE_KEY = 'clarityforge_game_v1';
const AUTON_ID = '947d2fc5';
const FETCH_TIMEOUT_MS = 8000;
const RING_CIRCUMFERENCE = 327;

const DEFAULT_STATE = () => ({
  schema_version: '1',
  xp: 0,
  listing_shards: 0,
  momentum_streak: 0,
  momentum_grace_days_used: 0,
  last_forge_date: null,
  completed_quest_ids: [],
  illustrated_relic_ids: [],
  attestations: {
    etsy_first_upload: false,
    first_eight_crossing: false,
    ci_passed_today: false,
  },
  journal: [],
  settings: { focus_mode: false, sound_enabled: false },
  last_sync_at: null,
  empire_overlay: {},
});

/** @type {ReturnType<typeof DEFAULT_STATE>} */
let player = DEFAULT_STATE();
/** @type {object|null} */
let empire = null;
/** @type {object[]} */
let quests = [];
/** @type {string|null} */
let selectedQuestId = null;
/** @type {Record<string, boolean>} */
let stepDone = {};
/** @type {object|null} */
let lastQuestExport = null;

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadPlayer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      player = DEFAULT_STATE();
      return;
    }
    const parsed = JSON.parse(raw);
    player = { ...DEFAULT_STATE(), ...parsed, settings: { ...DEFAULT_STATE().settings, ...parsed.settings } };
  } catch {
    player = DEFAULT_STATE();
  }
}

function savePlayer() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
}

function toast(message) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  region.textContent = '';
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.appendChild(el);
  window.setTimeout(() => el.remove(), 3200);
}

function celebrate() {
  if (reducedMotion()) return;
  const layer = document.getElementById('celebrate-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const colors = ['#5c7a5e', '#8fa88a', '#e8e4f0', '#f8f5f0'];
  for (let i = 0; i < 12; i += 1) {
    const p = document.createElement('span');
    p.className = 'confetti';
    p.style.left = `${10 + Math.random() * 80}%`;
    p.style.top = `${Math.random() * 20}%`;
    p.style.background = colors[i % colors.length];
    layer.appendChild(p);
  }
  window.setTimeout(() => {
    layer.innerHTML = '';
  }, 1000);
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(t);
  }
}

function bootstrapQuestsCatalog() {
  const cmd =
    empire?.companion_signals?.next_recommended ||
    `python3 scripts/recurring_pump.py --count 3 --wall-art --update-status --auton ${AUTON_ID}`;
  return [
    {
      id: 'forge-pump-daily',
      title: 'Daily Forge Pump',
      tier: 'S',
      type: 'daily',
      phase_act: 1,
      act_slug: 'clearing',
      fun_description: 'Run a small, legal pump batch. Real listings only — no pretend uploads.',
      real_command_example: cmd,
      steps: [
        { id: 's1', label: 'Copy the pump command', action: 'copy_command', command: cmd },
        { id: 's2', label: 'Run it in your repo (terminal)', action: 'attest' },
        { id: 's3', label: 'Sync empire data here when done', action: 'sync_hint' },
      ],
      reward_xp: 15,
      reward_shards: 1,
      unlock_type: 'always',
      completion_criteria: {
        type: 'attestation',
        export_on_complete: true,
        suggested_artifact: 'progress/game/quest-complete-forge-pump-daily.json',
      },
      tags: ['pump', 'daily'],
    },
    {
      id: 'legal-oath-transparency',
      title: 'Oath of Transparency',
      tier: 'S',
      type: 'companion',
      phase_act: 1,
      act_slug: 'clearing',
      fun_description: 'Copy the short legal disclosure pointer — same SSOT as batch_asset_prompts.py.',
      real_command_example: 'See legal_disclosure_short in empire-state.json',
      steps: [
        {
          id: 's1',
          label: 'Copy short disclosure',
          action: 'copy_command',
          command: empire?.legal_disclosure_short || '(sync to load disclosure)',
        },
        { id: 's2', label: 'Confirm you will keep legal on every listing', action: 'attest' },
      ],
      reward_xp: 10,
      reward_shards: 0,
      unlock_type: 'always',
      completion_criteria: { type: 'attestation', export_on_complete: true },
      tags: ['legal'],
    },
    {
      id: 'rest-day-nurture',
      title: 'Rest Day Nurture',
      tier: 'S',
      type: 'daily',
      phase_act: 1,
      act_slug: 'clearing',
      fun_description: 'Legal review or xlsx tweak — preserves momentum without a full pump.',
      real_command_example: 'python3 scripts/build_command_center_xlsx.py',
      steps: [
        {
          id: 's1',
          label: 'Copy xlsx refresh command',
          action: 'copy_command',
          command: 'python3 scripts/build_command_center_xlsx.py',
        },
        { id: 's2', label: 'Attest gentle progress', action: 'attest' },
      ],
      reward_xp: 8,
      reward_shards: 0,
      unlock_type: 'always',
      completion_criteria: { type: 'attestation', export_on_complete: false },
      tags: ['rest', 'wellness'],
    },
  ];
}

async function loadQuestsFromFile() {
  try {
    const q = await fetchWithTimeout('./data/quests.json');
    if (Array.isArray(q.quests) && q.quests.length) {
      quests = q.quests;
      return true;
    }
  } catch {
    /* offline or missing file */
  }
  return false;
}

/** Refresh only bootstrap quest rows; preserve full G3 catalog from quests.json. */
function mergeBootstrapQuests() {
  const boot = bootstrapQuestsCatalog();
  const bootIds = new Set(boot.map((q) => q.id));
  const preserved = quests.filter((q) => !bootIds.has(q.id));
  const mergedBoot = boot.map((bq) => {
    const existing = quests.find((q) => q.id === bq.id);
    return existing ? { ...existing, ...bq } : bq;
  });
  quests = [...preserved, ...mergedBoot];
  if (!quests.length) quests = bootstrapQuestsCatalog();
}

async function loadGameData() {
  try {
    empire = await fetchWithTimeout('./data/empire-state.json');
  } catch (e) {
    console.warn('empire-state fetch failed', e);
    empire = null;
  }
  const loaded = await loadQuestsFromFile();
  if (!loaded) quests = bootstrapQuestsCatalog();
  mergeBootstrapQuests();
  applyEmpireOverlay();
  renderAll();
}

function applyEmpireOverlay() {
  if (!empire) return;
  const overlay = {
    generated_at: empire.generated_at,
    metrics: empire.metrics,
    acts: empire.acts?.map((a) => ({ id: a.id, progress_pct: a.progress_pct, unlocked: a.unlocked })),
    pump_runs_detected: empire.metrics?.pump_runs_detected,
    legal_enforced_sample: empire.metrics?.legal_enforced_sample,
  };
  player.empire_overlay = { ...player.empire_overlay, ...overlay };
  savePlayer();
}

function empireScore() {
  const m = player.empire_overlay?.metrics || empire?.metrics;
  return m?.empire_score ?? 0;
}

function currentAct() {
  const acts = empire?.acts || [];
  const unlocked = acts.filter((a) => a.unlocked);
  return unlocked[unlocked.length - 1] || acts[0] || null;
}

function formatUnlock(req) {
  if (!req || req.type === 'always') return 'Always open';
  if (req.type === 'metric') {
    const parts = [];
    if (req.batch_listings != null) parts.push(`batch listings ≥ ${req.batch_listings}`);
    if (req.assets_integrated != null) parts.push(`assets ≥ ${req.assets_integrated}`);
    return parts.join(', ') || 'Metric threshold';
  }
  return JSON.stringify(req);
}

function updateHud() {
  const score = empireScore();
  const scoreEl = document.getElementById('empire-score-value');
  const ring = document.getElementById('empire-ring-progress');
  if (scoreEl) scoreEl.textContent = String(score);
  if (ring) {
    ring.style.setProperty('--score-pct', String(score));
    ring.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * score) / 100);
  }
  const mom = document.getElementById('momentum-value');
  if (mom) mom.textContent = String(player.momentum_streak);
  const grace = document.getElementById('momentum-grace');
  if (grace) {
    const show = player.momentum_grace_days_used < 3;
    grace.hidden = !show;
  }
  document.body.classList.toggle('focus-mode', !!player.settings.focus_mode);
}

function renderHome() {
  const act = currentAct();
  const summary = document.getElementById('home-act-summary');
  if (summary) {
    summary.textContent = act
      ? `You are in Act ${act.id}: ${act.name} (${act.progress_pct}% along this landmark).`
      : 'Sync to see your current act.';
  }
  const copy = document.getElementById('home-cta-copy');
  if (copy) {
    copy.textContent =
      empire?.companion_signals?.next_recommended ||
      'One small win at a time. No guilt if you rest.';
  }
}

function renderActMap() {
  const grid = document.getElementById('act-map-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!empire?.acts?.length) {
    const empty = document.createElement('div');
    empty.className = 'card calm-copy';
    empty.setAttribute('role', 'status');
    empty.textContent =
      'Act landmarks will appear after sync. Use Sync & Export to fetch empire-state.json, or paste ramp JSON when offline.';
    grid.appendChild(empty);
    return;
  }
  empire.acts.forEach((act) => {
    const li = document.createElement('article');
    li.className = `act-card${act.unlocked ? '' : ' is-locked'}`;
    li.setAttribute('role', 'listitem');
    li.innerHTML = `
      <h3>Act ${act.id}: ${act.name}</h3>
      <p class="calm-copy">Days ${act.plan_days}</p>
      <div class="progress-bar" aria-hidden="true"><div class="progress-fill" style="width:${act.progress_pct}%"></div></div>
      <p><strong>${act.progress_pct}%</strong> progress</p>
      ${act.unlocked ? '<p>Unlocked</p>' : `<p class="unlock-req">Unlock: ${formatUnlock(act.unlock_requirements)}</p>`}
    `;
    grid.appendChild(li);
  });
}

function renderQuestList() {
  const list = document.getElementById('quest-list');
  if (!list) return;
  list.innerHTML = '';
  quests.forEach((q) => {
    const li = document.createElement('li');
    li.className = 'quest-list-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    const done = player.completed_quest_ids.includes(q.id);
    btn.className = `${selectedQuestId === q.id ? 'is-selected' : ''}${done ? ' is-done' : ''}`;
    btn.textContent = done ? `✓ ${q.title}` : q.title;
    btn.addEventListener('click', () => selectQuest(q.id));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function selectQuest(id) {
  selectedQuestId = id;
  const q = quests.find((x) => x.id === id);
  const detail = document.getElementById('quest-detail');
  if (!q || !detail) return;
  detail.hidden = false;
  document.getElementById('quest-detail-title').textContent = q.title;
  document.getElementById('quest-detail-desc').textContent = q.fun_description || '';
  document.getElementById('quest-rewards').textContent = `Rewards: ${q.reward_xp || 0} XP, ${q.reward_shards || 0} shards`;
  const stepsEl = document.getElementById('quest-steps');
  stepsEl.innerHTML = '';
  (q.steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.className = `quest-step${stepDone[step.id] ? ' done' : ''}`;
    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = step.label;
    li.appendChild(label);
    const actions = document.createElement('div');
    actions.className = 'codex-actions';
    if (step.action === 'copy_command' && step.command) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary btn-copy';
      b.textContent = 'Copy command';
      b.addEventListener('click', () => copyText(step.command));
      actions.appendChild(b);
    }
    if (step.action === 'attest' || step.action === 'attest_boss') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary';
      b.textContent = 'Mark step done';
      b.addEventListener('click', () => {
        stepDone[step.id] = true;
        li.classList.add('done');
        toast('Step noted — honest attestation only.');
      });
      actions.appendChild(b);
    }
    if (step.action === 'sync_hint') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary';
      b.textContent = 'Go to Sync';
      b.addEventListener('click', () => navigate('sync'));
      actions.appendChild(b);
    }
    li.appendChild(actions);
    stepsEl.appendChild(li);
  });
  renderQuestList();
}

function completeQuest() {
  const q = quests.find((x) => x.id === selectedQuestId);
  if (!q) {
    toast('Select a quest first.');
    return;
  }
  if (player.completed_quest_ids.includes(q.id)) {
    toast('Already completed — nice work.');
    return;
  }
  player.completed_quest_ids.push(q.id);
  player.xp += q.reward_xp || 0;
  player.listing_shards += q.reward_shards || 0;
  bumpMomentum();
  player.journal.push({
    at: new Date().toISOString(),
    quest_id: q.id,
    note: `Completed ${q.title}`,
  });
  savePlayer();
  lastQuestExport = buildQuestCompleteExport(q);
  const dl = document.getElementById('download-quest-export-btn');
  if (dl) dl.disabled = false;
  celebrate();
  toast(`Quest complete: ${q.title}. +${q.reward_xp || 0} XP`);
  renderQuestList();
  updateHud();
}

function bumpMomentum() {
  const today = new Date().toISOString().slice(0, 10);
  if (player.last_forge_date === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);
  if (player.last_forge_date === y) {
    player.momentum_streak += 1;
  } else if (player.last_forge_date) {
    const gap = daysBetween(player.last_forge_date, today);
    if (gap <= 4 && player.momentum_grace_days_used < 3) {
      player.momentum_grace_days_used += 1;
      player.momentum_streak += 1;
    } else if (gap === 1) {
      player.momentum_streak += 1;
    } else {
      player.momentum_streak = 1;
    }
  } else {
    player.momentum_streak = 1;
  }
  player.last_forge_date = today;
}

function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.round((d2 - d1) / 86400000);
}

function buildQuestCompleteExport(q) {
  const date = new Date().toISOString().slice(0, 10);
  return {
    exported_at: new Date().toISOString(),
    auton: AUTON_ID,
    quest_id: q.id,
    player_xp_delta: q.reward_xp || 0,
    suggested_commit_message: `progress(game): quest-complete ${q.id} (${AUTON_ID})`,
    suggested_files: [q.completion_criteria?.suggested_artifact || `progress/game/quest-complete-${q.id}-${date}.json`],
    commit_recipe_markdown: [
      '1. Download this JSON',
      '2. git add progress/game/quest-complete-*.json',
      '3. git commit -m "progress(game): quest attestation"',
      '4. Optional: grok_com_github push_files',
    ].join('\n'),
    mcp_snippet_hint: 'push_files for progress/game/',
    append_journal_path: 'progress/game/',
  };
}

function buildGameLogExport() {
  const date = new Date().toISOString().slice(0, 10);
  const overlay = player.empire_overlay?.metrics || {};
  return {
    exported_at: new Date().toISOString(),
    schema_version: '1',
    player: {
      xp: player.xp,
      listing_shards: player.listing_shards,
      momentum_streak: player.momentum_streak,
      last_forge_date: player.last_forge_date,
      completed_quest_ids: [...player.completed_quest_ids],
      illustrated_relic_ids: [...player.illustrated_relic_ids],
      settings: { ...player.settings },
    },
    empire_overlay: {
      batch_listings: overlay.batch_listings,
      assets_integrated: overlay.assets_integrated,
      empire_score: overlay.empire_score ?? empireScore(),
      generated_at: player.empire_overlay?.generated_at || empire?.generated_at,
      pump_runs_detected: overlay.pump_runs_detected,
      legal_enforced_sample: overlay.legal_enforced_sample,
    },
    journal_excerpt: player.journal.slice(-5),
    suggested_commit_message: `progress(game): game-log ${date} (${AUTON_ID})`,
    suggested_paths: [`progress/game/game-log-${date}.json`],
    no_secrets_note: 'Contains no credentials, real revenue, or PII. Safe for repo.',
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function updateCommitRecipe() {
  const pre = document.getElementById('commit-recipe');
  if (!pre) return;
  pre.textContent = [
    'git add progress/game/game-log-*.json progress/game/quest-complete-*.json',
    `git commit -m "progress(game): sync attestation (${AUTON_ID})"`,
    'python3 scripts/build_game_data.py --auton ' + AUTON_ID,
  ].join('\n');
}

function renderLedger() {
  const bands = document.getElementById('ledger-bands');
  if (!bands || !empire?.scenario_bands) return;
  const b = empire.scenario_bands;
  bands.innerHTML = `
    <div class="band-card"><span>Base</span><strong>${b.base}</strong><small>listings</small></div>
    <div class="band-card"><span>Aggressive</span><strong>${b.aggressive}</strong><small>listings</small></div>
    <div class="band-card"><span>Moonshot</span><strong>${b.moonshot}</strong><small>listings</small></div>
  `;
}

let codexTab = 'deck';

function renderCodex() {
  const grid = document.getElementById('codex-grid');
  const filter = document.getElementById('codex-niche-filter');
  if (!grid) return;
  const nicheVal = filter?.value || '';
  let items = [];
  if (codexTab === 'legendary') {
    items = (empire?.legendary_quests || []).map((p) => ({
      id: p.id,
      title: p.title,
      niche: (p.tags && p.tags[0]) || 'legendary',
      preview: `Bundle · ${p.price}`,
      prompt: p.includes?.join(', ') || p.title,
      kind: 'legendary',
    }));
  } else {
    items = (empire?.loot_deck || []).map((l) => ({
      id: l.id,
      title: l.title,
      niche: l.niche,
      preview: l.price,
      prompt: l.image_prompt_preview,
      kind: 'loot',
    }));
  }
  if (filter && filter.options.length <= 1) {
    const niches = [...new Set(items.map((i) => i.niche).filter(Boolean))].sort();
    niches.forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n.replace(/-/g, ' ');
      filter.appendChild(opt);
    });
  }
  const filtered = nicheVal ? items.filter((i) => i.niche === nicheVal) : items;
  grid.innerHTML = '';
  filtered.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'codex-card';
    card.setAttribute('role', 'listitem');
    const illustrated = player.illustrated_relic_ids.includes(item.id);
    card.innerHTML = `
      <div class="codex-card-inner">
        <span class="niche-tag">${item.niche}</span>
        <h4>${item.title}</h4>
        <p class="calm-copy">${item.preview}</p>
        <p class="prompt-preview" hidden>${item.prompt || ''}</p>
      </div>
    `;
    const actions = document.createElement('div');
    actions.className = 'codex-actions';
    const flip = document.createElement('button');
    flip.type = 'button';
    flip.className = 'btn btn-secondary';
    flip.textContent = 'Flip card';
    flip.addEventListener('click', () => {
      card.classList.toggle('is-flipped');
      const prev = card.querySelector('.prompt-preview');
      if (prev) prev.hidden = !card.classList.contains('is-flipped');
    });
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn-secondary';
    copy.textContent = 'Copy prompt';
    copy.addEventListener('click', () => copyText(item.prompt || item.title));
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'btn btn-secondary';
    mark.textContent = illustrated ? 'Illustrated ✓' : 'Mark Illustrated';
    mark.addEventListener('click', () => {
      if (!player.illustrated_relic_ids.includes(item.id)) {
        player.illustrated_relic_ids.push(item.id);
        savePlayer();
        mark.textContent = 'Illustrated ✓';
        toast('Relic marked illustrated.');
      }
    });
    actions.append(flip, copy, mark);
    card.querySelector('.codex-card-inner').appendChild(actions);
    grid.appendChild(card);
  });
}

function renderLegal() {
  const el = document.getElementById('legal-footer-text');
  if (el && empire?.legal_footer) {
    el.textContent = empire.legal_footer.slice(0, 400) + (empire.legal_footer.length > 400 ? '…' : '');
  }
}

function renderSyncMeta() {
  const el = document.getElementById('last-sync-display');
  if (el) {
    el.textContent = player.last_sync_at
      ? `Last synced: ${player.last_sync_at}`
      : 'Last synced: never';
  }
}

function renderAll() {
  updateHud();
  renderHome();
  renderActMap();
  renderQuestList();
  renderLedger();
  renderCodex();
  renderLegal();
  renderSyncMeta();
  updateCommitRecipe();
}

function applyPastedEmpirePayload(data) {
  const looksLikeEmpire =
    Array.isArray(data.acts) ||
    Array.isArray(data.loot_deck) ||
    data.scenario_bands != null;
  if (looksLikeEmpire) {
    empire = { ...(empire || {}), ...data };
    applyEmpireOverlay();
    return true;
  }
  if (data.metrics) {
    player.empire_overlay = {
      ...player.empire_overlay,
      metrics: { ...player.empire_overlay?.metrics, ...data.metrics },
      generated_at: data.generated_at || new Date().toISOString(),
    };
    if (data.acts) {
      player.empire_overlay.acts = data.acts.map((a) => ({
        id: a.id,
        progress_pct: a.progress_pct,
        unlocked: a.unlocked,
      }));
    }
    return false;
  }
  player.empire_overlay = { ...player.empire_overlay, ...data };
  return false;
}

async function syncFetch() {
  try {
    const data = await fetchWithTimeout('./data/empire-state.json');
    empire = data;
    player.last_sync_at = new Date().toISOString();
    applyEmpireOverlay();
    await loadQuestsFromFile();
    mergeBootstrapQuests();
    savePlayer();
    renderAll();
    toast('Empire state synced.');
  } catch {
    toast('Fetch failed — try paste sync or run locally.');
  }
}

function syncPaste() {
  const ta = document.getElementById('sync-paste');
  if (!ta?.value.trim()) {
    toast('Paste JSON first.');
    return;
  }
  try {
    const data = JSON.parse(ta.value);
    const refreshedEmpire = applyPastedEmpirePayload(data);
    if (refreshedEmpire) mergeBootstrapQuests();
    player.last_sync_at = new Date().toISOString();
    savePlayer();
    renderAll();
    toast(refreshedEmpire ? 'Empire data merged from paste.' : 'Overlay merged from paste.');
  } catch {
    toast('Invalid JSON.');
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => toast('Copied to clipboard.'),
    () => toast('Copy failed — select manually.'),
  );
}

function navigate(route) {
  const hash = route.startsWith('#') ? route : `#${route}`;
  if (location.hash !== hash) location.hash = hash;
  else applyRoute(route.replace('#', ''));
}

function applyRoute(route) {
  const r = route || 'home';
  document.querySelectorAll('.view').forEach((v) => {
    const active = v.dataset.view === r;
    v.classList.toggle('is-active', active);
    v.hidden = !active;
  });
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.route === r);
  });
  if (r === 'codex') renderCodex();
  if (r === 'quests' && selectedQuestId) selectQuest(selectedQuestId);
}

function wireEvents() {
  window.addEventListener('hashchange', () => {
    applyRoute((location.hash || '#home').slice(1));
  });

  document.getElementById('home-forge-cta')?.addEventListener('click', () => {
    navigate('quests');
    const first = quests.find((q) => q.id === 'forge-pump-daily') || quests[0];
    if (first) selectQuest(first.id);
  });
  document.getElementById('home-sync-btn')?.addEventListener('click', () => {
    navigate('sync');
    syncFetch();
  });
  document.getElementById('home-export-btn')?.addEventListener('click', () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`game-log-${date}.json`, buildGameLogExport());
    toast('Game log downloaded.');
  });
  document.getElementById('quest-complete-btn')?.addEventListener('click', completeQuest);
  document.getElementById('sync-fetch-btn')?.addEventListener('click', syncFetch);
  document.getElementById('sync-paste-btn')?.addEventListener('click', syncPaste);
  document.getElementById('download-game-log-btn')?.addEventListener('click', () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`game-log-${date}.json`, buildGameLogExport());
  });
  document.getElementById('download-quest-export-btn')?.addEventListener('click', () => {
    if (!lastQuestExport) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`quest-complete-${lastQuestExport.quest_id}-${date}.json`, lastQuestExport);
  });
  document.getElementById('setting-focus-mode')?.addEventListener('change', (e) => {
    player.settings.focus_mode = e.target.checked;
    savePlayer();
    updateHud();
  });
  document.getElementById('setting-sound')?.addEventListener('change', (e) => {
    player.settings.sound_enabled = e.target.checked;
    savePlayer();
  });
  document.getElementById('reset-local-btn')?.addEventListener('click', () => {
    if (window.confirm('Reset all local progress? Export first if you need a backup.')) {
      localStorage.removeItem(STORAGE_KEY);
      player = DEFAULT_STATE();
      stepDone = {};
      savePlayer();
      renderAll();
      toast('Local progress reset.');
    }
  });
  document.querySelectorAll('[data-copy-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-copy-target');
      const pre = document.getElementById(id);
      if (pre) copyText(pre.textContent);
    });
  });
  document.querySelectorAll('[data-codex-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      codexTab = tab.dataset.codexTab;
      document.querySelectorAll('[data-codex-tab]').forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      const panel = document.getElementById('codex-panel');
      if (panel) panel.setAttribute('aria-labelledby', tab.id);
      renderCodex();
    });
  });
  // Arrow-key tab roving: deferred to G6 full keyboard smoke (DESIGN §11).
  document.getElementById('codex-niche-filter')?.addEventListener('change', renderCodex);

  const sm = document.getElementById('setting-focus-mode');
  const ss = document.getElementById('setting-sound');
  if (sm) sm.checked = player.settings.focus_mode;
  if (ss) ss.checked = player.settings.sound_enabled;
}

async function init() {
  loadPlayer();
  wireEvents();
  applyRoute((location.hash || '#home').slice(1) || 'home');
  await loadGameData();
}

init();