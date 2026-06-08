/**
 * Clarity Quest: Empire Forge — G2 shell + G3 quest engine (ESM)
 * AUTON 947d2fc5 — shell, router, localStorage, sync/export stubs for G5.
 */

import * as QuestEngine from './quest-engine.js';
import { CODEX_TABS, wireCodexUi } from './codex.js';
import {
  fetchWithTimeout,
  applyEmpireOverlayToPlayer,
  applyPastedEmpirePayload,
  syncFetchEmpire,
} from './sync.js';
import {
  buildGameLogExport,
  commitRecipeMarkdown,
  downloadJson,
  validateExportPayload,
} from './export.js';

const STORAGE_KEY = 'clarityforge_game_v1';
const AUTON_ID = '947d2fc5';
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
/** Per-quest step attestation: questId -> stepId -> done (isolates shared step ids across quests). */
/** @type {Record<string, Record<string, boolean>>} */
let questStepDone = {};
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

/** @type {{ refresh: () => void } | null} */
let codexController = null;

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
  quests = await QuestEngine.loadQuestsCatalog('./data/quests.json');
  return quests.length > 0;
}

const BOOTSTRAP_OVERLAY_IDS = new Set([
  'forge-pump-daily',
  'legal-oath-transparency',
  'rest-day-nurture',
]);

/** Overlay only live empire/bootstrap fields onto catalog rows — never clobber criteria, rewards, or steps structure. */
function overlayDynamicBootstrapFields(catalogQuest, bootstrapQuest) {
  const q = { ...catalogQuest, steps: (catalogQuest.steps || []).map((s) => ({ ...s })) };
  if (catalogQuest.id === 'forge-pump-daily') {
    const cmd = bootstrapQuest.real_command_example;
    if (cmd) {
      q.real_command_example = cmd;
      q.steps = q.steps.map((step) =>
        step.action === 'copy_command' ? { ...step, command: cmd } : step,
      );
    }
  } else if (catalogQuest.id === 'legal-oath-transparency') {
    const bootCopy = bootstrapQuest.steps?.find((s) => s.action === 'copy_command');
    if (bootCopy?.command) {
      q.steps = q.steps.map((step) =>
        step.action === 'copy_command' ? { ...step, command: bootCopy.command } : step,
      );
    }
    if (empire?.legal_disclosure_short) {
      q.real_command_example = bootstrapQuest.real_command_example;
    }
  } else if (catalogQuest.id === 'rest-day-nurture') {
    const bootCopy = bootstrapQuest.steps?.find((s) => s.action === 'copy_command');
    if (bootCopy?.command) {
      q.steps = q.steps.map((step) =>
        step.action === 'copy_command' ? { ...step, command: bootCopy.command } : step,
      );
    }
  }
  return q;
}

/** Refresh dynamic overlays on bootstrap-linked ids; preserve full G3 catalog from quests.json. */
function mergeBootstrapQuests() {
  const bootById = new Map(bootstrapQuestsCatalog().map((q) => [q.id, q]));
  if (!quests.length) {
    quests = bootstrapQuestsCatalog();
    return;
  }
  quests = quests.map((q) => {
    if (!BOOTSTRAP_OVERLAY_IDS.has(q.id)) return q;
    const bq = bootById.get(q.id);
    return bq ? overlayDynamicBootstrapFields(q, bq) : q;
  });
}

function getStepDoneForQuest(questId) {
  return questStepDone[questId] || {};
}

async function loadGameData() {
  try {
    empire = await fetchWithTimeout('./data/empire-state.json');
  } catch (e) {
    console.warn('empire-state fetch failed', e);
    empire = null;
  }
  await loadQuestsFromFile();
  mergeBootstrapQuests();
  applyEmpireOverlay();
  renderAll();
}

function applyEmpireOverlay() {
  if (!empire) return;
  player = applyEmpireOverlayToPlayer(player, empire);
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
  const done = player.completed_quest_ids.includes(q.id);
  const isBoss = q.type === 'boss' || q.completion_criteria?.type === 'boss_attestation';
  let bossNotice = document.getElementById('quest-boss-notice');
  if (!bossNotice) {
    bossNotice = document.createElement('p');
    bossNotice.id = 'quest-boss-notice';
    bossNotice.className = 'calm-copy boss-notice';
    const completeBtn = document.getElementById('quest-complete-btn');
    detail.insertBefore(bossNotice, completeBtn);
  }
  bossNotice.hidden = !isBoss;
  if (isBoss) {
    bossNotice.textContent =
      'Attest real action (Etsy upload / bundle) — this is user-only. Export recipe only; no fake Etsy complete.';
  }
  const completeBtn = document.getElementById('quest-complete-btn');
  if (completeBtn) {
    completeBtn.disabled = done;
    completeBtn.textContent = done
      ? 'Completed'
      : isBoss
        ? 'I attest & export recipe'
        : 'I completed this';
  }
  const stepsEl = document.getElementById('quest-steps');
  stepsEl.innerHTML = '';
  const stepsState = getStepDoneForQuest(id);
  (q.steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.className = `quest-step${stepsState[step.id] ? ' done' : ''}`;
    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = step.label;
    li.appendChild(label);
    const actions = document.createElement('div');
    actions.className = 'codex-actions';
    const cmdText = step.command || q.real_command_example || '';
    if (step.action === 'copy_command' && cmdText) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary btn-copy';
      b.textContent = 'Copy command';
      b.addEventListener('click', () => copyText(cmdText));
      actions.appendChild(b);
    }
    if (step.action === 'attest' || step.action === 'attest_boss') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary';
      b.textContent = 'Mark step done';
      b.addEventListener('click', () => {
        if (!questStepDone[id]) questStepDone[id] = {};
        questStepDone[id][step.id] = true;
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
  const res = QuestEngine.completeQuest(selectedQuestId, {
    player,
    empire,
    quests,
    stepDone: getStepDoneForQuest(selectedQuestId),
    attested: true,
  });
  if (!res.success) {
    toast(res.reason || 'Could not complete quest.');
    return;
  }
  player = res.playerUpdated;
  savePlayer();
  lastQuestExport = res.exportPayload || null;
  const dl = document.getElementById('download-quest-export-btn');
  if (dl) dl.disabled = !lastQuestExport;
  if (lastQuestExport) {
    const date = new Date().toISOString().slice(0, 10);
    validateExportPayload(lastQuestExport);
    downloadJson(`quest-complete-${lastQuestExport.quest_id}-${date}.json`, lastQuestExport);
  }
  celebrate();
  const momNote =
    q.type === 'daily' || (q.tags || []).includes('momentum')
      ? ` Momentum: ${player.momentum_streak}.`
      : '';
  toast(`Quest complete: ${q.title}. +${res.xpDelta || 0} XP.${momNote}`);
  renderQuestList();
  if (selectedQuestId) selectQuest(selectedQuestId);
  updateHud();
}

function gameLogPayload() {
  return buildGameLogExport(player, empire, empireScore);
}

function updateCommitRecipe() {
  const pre = document.getElementById('commit-recipe');
  if (!pre) return;
  pre.textContent = commitRecipeMarkdown();
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

let codexTab = CODEX_TABS.deck;

function renderCodex() {
  codexController?.refresh();
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

async function syncFetch() {
  try {
    const { empire: data, syncedAt } = await syncFetchEmpire('./data/empire-state.json');
    empire = data;
    player.last_sync_at = syncedAt;
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
    const result = applyPastedEmpirePayload(empire, player, data);
    player = result.player;
    if (result.empire) empire = result.empire;
    if (result.refreshedEmpire) mergeBootstrapQuests();
    player.last_sync_at = new Date().toISOString();
    savePlayer();
    renderAll();
    toast(result.refreshedEmpire ? 'Empire data merged from paste.' : 'Overlay merged from paste.');
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
    downloadJson(`game-log-${date}.json`, gameLogPayload());
    toast('Game log downloaded.');
  });
  document.getElementById('quest-complete-btn')?.addEventListener('click', completeQuest);
  document.getElementById('sync-fetch-btn')?.addEventListener('click', syncFetch);
  document.getElementById('sync-paste-btn')?.addEventListener('click', syncPaste);
  document.getElementById('download-game-log-btn')?.addEventListener('click', () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`game-log-${date}.json`, gameLogPayload());
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
      questStepDone = {};
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
  const tabButtons = [...document.querySelectorAll('[data-codex-tab]')];
  codexController = wireCodexUi({
    tabButtons,
    nicheFilterEl: document.getElementById('codex-niche-filter'),
    scoreVizEl: document.getElementById('codex-score-viz'),
    gridEl: document.getElementById('codex-grid'),
    getState: () => ({
      empire,
      player,
      tab: codexTab,
      onCopy: copyText,
      onMarkIllustrated: (id) => {
        if (!player.illustrated_relic_ids.includes(id)) {
          player.illustrated_relic_ids.push(id);
          savePlayer();
          toast('Relic marked illustrated.');
        }
      },
    }),
    setTab: (id) => {
      codexTab = id;
    },
    onRender: renderCodex,
  });

  const navLinks = [...document.querySelectorAll('.nav-link')];
  navLinks.forEach((link, idx) => {
    link.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next =
        e.key === 'ArrowRight'
          ? navLinks[(idx + 1) % navLinks.length]
          : navLinks[(idx - 1 + navLinks.length) % navLinks.length];
      next.focus();
    });
  });

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