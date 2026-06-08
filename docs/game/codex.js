/**
 * Forge Codex — loot deck, legendary tab, niche filters, score viz (G4)
 * AUTON 947d2fc5 — ESM, sage/beige brand tokens via styles.css
 */

export const CODEX_TABS = { deck: 'deck', legendary: 'legendary' };

export function codexItemsFromEmpire(empire, tab) {
  if (!empire) return [];
  if (tab === CODEX_TABS.legendary) {
    return (empire.legendary_quests || []).map((p) => ({
      id: p.id,
      title: p.title,
      niche: (p.tags && p.tags[0]) || 'legendary',
      preview: `Bundle · ${p.price}`,
      prompt: p.includes?.join(', ') || p.title,
      kind: 'legendary',
      hero_asset: p.hero_asset || null,
    }));
  }
  return (empire.loot_deck || []).map((l) => ({
    id: l.id,
    title: l.title,
    niche: l.niche,
    preview: l.price,
    prompt: l.image_prompt_preview || l.title,
    kind: 'loot',
    hero_asset: l.hero_asset_hint || null,
  }));
}

export function uniqueNiches(items) {
  return [...new Set(items.map((i) => i.niche).filter(Boolean))].sort();
}

export function renderCodexScoreViz(container, empire, player) {
  if (!container) return;
  const m = player?.empire_overlay?.metrics || empire?.metrics || {};
  const score = m.empire_score ?? 0;
  const target = m.target_listings_day90 ?? 150;
  const batch = m.batch_listings ?? 0;
  const assets = m.assets_integrated ?? 0;
  container.innerHTML = `
    <div class="codex-score-viz card" role="status" aria-label="Empire score visualization">
      <h3 class="codex-score-title">Empire Score</h3>
      <p class="calm-copy"><strong>${score}</strong> / 100 — real listings + integrated assets vs day-90 target (${target}).</p>
      <div class="progress-bar" aria-hidden="true"><div class="progress-fill" style="width:${Math.min(100, score)}%"></div></div>
      <p class="calm-copy small-meta">batch_listings: ${batch} · assets_integrated: ${assets}</p>
    </div>
  `;
}

export function renderCodexGrid(grid, filterEl, ctx) {
  const {
    empire,
    player,
    tab = CODEX_TABS.deck,
    nicheFilter = '',
    onCopy = () => {},
    onMarkIllustrated = () => {},
  } = ctx;
  if (!grid) return;

  const items = codexItemsFromEmpire(empire, tab);

  if (filterEl && filterEl.options.length <= 1 && items.length) {
    uniqueNiches(items).forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n.replace(/-/g, ' ');
      filterEl.appendChild(opt);
    });
  }

  const filtered = nicheFilter ? items.filter((i) => i.niche === nicheFilter) : items;
  grid.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'calm-copy';
    empty.setAttribute('role', 'status');
    empty.textContent = empire
      ? 'No relics in this filter. Sync empire data or try All niches.'
      : 'Sync empire-state.json to load the Forge Codex deck.';
    grid.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'codex-card';
    card.setAttribute('role', 'listitem');
    const illustrated = (player?.illustrated_relic_ids || []).includes(item.id);
    card.innerHTML = `
      <div class="codex-card-inner">
        <span class="niche-tag">${item.niche}</span>
        <h4>${item.title}</h4>
        <p class="calm-copy">${item.preview}</p>
        ${item.hero_asset ? `<p class="small-meta">Hero: ${item.hero_asset}</p>` : ''}
        <p class="prompt-preview" hidden>${item.prompt || ''}</p>
      </div>
    `;
    const actions = document.createElement('div');
    actions.className = 'codex-actions';

    const flip = document.createElement('button');
    flip.type = 'button';
    flip.className = 'btn btn-secondary';
    flip.textContent = 'Flip card';
    flip.setAttribute('aria-expanded', 'false');
    flip.addEventListener('click', () => {
      const flipped = card.classList.toggle('is-flipped');
      flip.setAttribute('aria-expanded', flipped ? 'true' : 'false');
      const prev = card.querySelector('.prompt-preview');
      if (prev) prev.hidden = !flipped;
    });

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn-secondary btn-copy';
    copy.textContent = 'Copy prompt';
    copy.addEventListener('click', () => onCopy(item.prompt || item.title));

    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'btn btn-secondary';
    mark.textContent = illustrated ? 'Illustrated ✓' : 'Mark Illustrated';
    mark.setAttribute('aria-pressed', illustrated ? 'true' : 'false');
    mark.addEventListener('click', () => {
      if (!(player?.illustrated_relic_ids || []).includes(item.id)) {
        onMarkIllustrated(item.id);
        mark.textContent = 'Illustrated ✓';
        mark.setAttribute('aria-pressed', 'true');
      }
    });

    actions.append(flip, copy, mark);
    card.querySelector('.codex-card-inner').appendChild(actions);
    grid.appendChild(card);
  });
}

export function wireCodexUi({ tabButtons, nicheFilterEl, scoreVizEl, gridEl, getState, setTab, onRender }) {
  tabButtons.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.codexTab || CODEX_TABS.deck;
      setTab(id);
      tabButtons.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      const panel = document.getElementById('codex-panel');
      if (panel) panel.setAttribute('aria-labelledby', tab.id);
      onRender();
    });
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const idx = tabButtons.indexOf(tab);
      const next =
        e.key === 'ArrowRight'
          ? tabButtons[(idx + 1) % tabButtons.length]
          : tabButtons[(idx - 1 + tabButtons.length) % tabButtons.length];
      next.focus();
      next.click();
    });
  });

  nicheFilterEl?.addEventListener('change', onRender);

  return {
    refresh() {
      const { empire, player, tab, nicheFilter, onCopy, onMarkIllustrated } = getState();
      renderCodexScoreViz(scoreVizEl, empire, player);
      renderCodexGrid(gridEl, nicheFilterEl, {
        empire,
        player,
        tab,
        nicheFilter: nicheFilter || nicheFilterEl?.value || '',
        onCopy,
        onMarkIllustrated,
      });
    },
  };
}