// token-radar-01 v1 dashboard renderer
(function() {
  const radar = window.RADAR;
  if (!radar) {
    document.body.innerHTML = '<div style="color:red;padding:20px;">Error: window.RADAR not loaded.</div>';
    return;
  }

  let state = {
    search: '',
    category: '',
    chain: '',
    watchlistOnly: false,
    sort: 'rank',
    activeTab: 'board',
    selectedSlug: null
  };

  // Populate category and chain filters
  const categories = new Set();
  const chains = new Set();
  radar.rows.forEach(r => {
    if (r.category) categories.add(r.category);
    if (r.chains) r.chains.forEach(c => chains.add(c));
  });

  const catSelect = document.getElementById('category-filter');
  Array.from(categories).sort().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  const chainSelect = document.getElementById('chain-filter');
  Array.from(chains).sort().forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = ch;
    chainSelect.appendChild(opt);
  });

  function renderIntegrityStrip() {
    const strip = document.getElementById('integrity-strip');
    strip.innerHTML = `
      <span>📐 Total Protocols: <strong>${radar.stats.total_protocols}</strong> (Ranked: ${radar.stats.ranked_size} | Excluded: ${radar.stats.excluded_size} | Live: ${radar.stats.live_size})</span>
      <span>🛡️ Watchlist Coverage: <strong>${radar.stats.watchlist_size}/${radar.stats.watchlist_size}</strong> (100%)</span>
      <span>⚙️ Model: <strong>${radar.selected_spec}</strong></span>
      <span>📅 As Of: <strong>${radar.as_of}</strong></span>
    `;
  }

  function renderKpiStrip() {
    const kpi = document.getElementById('kpi-strip');
    const totalImplied = radar.rows.reduce((acc, r) => acc + r.implied_value_usd, 0);
    const goCount = radar.rows.filter(r => r.verdict === 'GO').length;
    const avgTvl = Math.round(radar.rows.reduce((acc, r) => acc + r.tvl_usd, 0) / radar.rows.length);

    kpi.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-title">Total Implied Value</div>
        <div class="kpi-value">$${(totalImplied / 1e9).toFixed(2)}B</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">GO Verdict Protocols</div>
        <div class="kpi-value">${goCount} Opportunities</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Average Ranked TVL</div>
        <div class="kpi-value">$${(avgTvl / 1e6).toFixed(1)}M</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">LOO RMSE / Validation R&sup2;</div>
        <div class="kpi-value">${radar.validation.loo_rmse.toFixed(3)} / ${(radar.validation.loo_r2 * 100).toFixed(1)}%</div>
      </div>
    `;
  }

  function renderTop10Strip() {
    const top10 = document.getElementById('top10-strip');
    const topRows = radar.rows.slice(0, 10);
    top10.innerHTML = topRows.map(r => `
      <div class="top10-card" data-slug="${r.slug}">
        <div class="top10-rank">#${r.rank}</div>
        <div class="top10-name" title="${r.name}">${r.name}</div>
        <div class="top10-val">$${(r.implied_value_usd / 1e6).toFixed(1)}M</div>
      </div>
    `).join('');

    top10.querySelectorAll('.top10-card').forEach(card => {
      card.addEventListener('click', () => {
        state.selectedSlug = card.getAttribute('data-slug');
        renderModal();
      });
    });
  }

  function renderBoardTable() {
    const tbody = document.getElementById('board-tbody');
    let filtered = radar.rows.filter(r => {
      if (state.search) {
        const q = state.search.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchSlug = r.slug.toLowerCase().includes(q);
        const matchChain = r.chains && r.chains.some(c => c.toLowerCase().includes(q));
        if (!matchName && !matchSlug && !matchChain) return false;
      }
      if (state.category && r.category !== state.category) return false;
      if (state.chain && (!r.chains || !r.chains.includes(state.chain))) return false;
      if (state.watchlistOnly && !radar.watchlist.includes(r.slug)) return false;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (state.sort === 'implied-desc') return b.implied_value_usd - a.implied_value_usd;
      if (state.sort === 'tvl-desc') return b.tvl_usd - a.tvl_usd;
      if (state.sort === 'growth-desc') return (b.change_7d ?? 0) - (a.change_7d ?? 0);
      if (state.sort === 'age-desc') return (b.age_days ?? 0) - (a.age_days ?? 0);
      return a.rank - b.rank;
    });

    tbody.innerHTML = filtered.map(r => {
      const vClass = r.verdict === 'GO' ? 'verdict-go' : r.verdict === 'MARGINAL' ? 'verdict-marginal' : 'verdict-skip';
      const changeStr = r.change_7d !== null ? `${r.change_7d > 0 ? '+' : ''}${r.change_7d.toFixed(1)}%` : 'N/A';
      const changeCol = (r.change_7d ?? 0) >= 0 ? '#4ade80' : '#ef4444';
      return `
        <tr data-slug="${r.slug}">
          <td><strong>#${r.rank}</strong></td>
          <td><strong>${r.name}</strong><br><small style="color:var(--text-dim);">${r.slug}</small></td>
          <td>${r.category || 'Unknown'}</td>
          <td>$${(r.tvl_usd / 1e6).toFixed(1)}M</td>
          <td style="color:${changeCol};">${changeStr}</td>
          <td>${r.age_days !== null ? r.age_days + 'd' : 'N/A'}</td>
          <td><strong>$${r.implied_value_usd.toLocaleString()}</strong></td>
          <td>${r.token_odds_pct}%</td>
          <td>$${r.expected_value_usd.toLocaleString()}</td>
          <td><span class="${vClass}">${r.verdict}</span></td>
          <td><button class="btn" data-slug="${r.slug}">Inspect</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr, button.btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const slug = el.getAttribute('data-slug') || el.closest('tr').getAttribute('data-slug');
        if (slug) {
          state.selectedSlug = slug;
          renderModal();
        }
      });
    });
  }

  function renderLiveTable() {
    const tbody = document.getElementById('live-tbody');
    tbody.innerHTML = radar.live.map(l => `
      <tr>
        <td><strong>${l.name}</strong></td>
        <td><small style="color:var(--text-dim);">${l.slug}</small></td>
        <td>${l.category || 'Unknown'}</td>
        <td>${l.chains ? l.chains.join(', ') : ''}</td>
        <td>$${(l.tvl_usd / 1e6).toFixed(1)}M</td>
        <td><strong>$${l.mcap_usd ? (l.mcap_usd / 1e6).toFixed(1) + 'M' : 'N/A'}</strong></td>
        <td>${l.change_7d !== null ? l.change_7d.toFixed(1) + '%' : 'N/A'}</td>
      </tr>
    `).join('');
  }

  function renderExcludedTable() {
    const tbody = document.getElementById('excluded-tbody');
    tbody.innerHTML = radar.excluded.map(ex => `
      <tr>
        <td><strong>${ex.name}</strong></td>
        <td><small style="color:var(--text-dim);">${ex.slug}</small></td>
        <td>${ex.category || 'Unknown'}</td>
        <td>$${(ex.tvl_usd / 1e6).toFixed(1)}M</td>
        <td style="color:var(--accent-amber);">${ex.reason}</td>
      </tr>
    `).join('');
  }

  function renderMethodView() {
    const container = document.getElementById('method-container');
    container.innerHTML = `
      <p class="section-desc">${radar.negative_growth_explanation}</p>
      <p class="section-desc"><strong>Verdict Rule:</strong> ${radar.verdict_rule}</p>
      <div class="method-grid">
        <div class="method-card">
          <h3>Validation Metrics</h3>
          <div class="detail-grid" style="margin-top:10px;">
            <div class="detail-item">Leave-One-Out RMSE: <strong>${radar.validation.loo_rmse.toFixed(4)}</strong></div>
            <div class="detail-item">Leave-One-Out R&sup2;: <strong>${(radar.validation.loo_r2 * 100).toFixed(1)}%</strong></div>
            <div class="detail-item">Split-Half R&sup2;: <strong>${(radar.validation.split_half_r2 * 100).toFixed(1)}%</strong></div>
            <div class="detail-item">Walk-Forward R&sup2;: <strong>${(radar.validation.walk_forward_r2 * 100).toFixed(1)}%</strong></div>
            <div class="detail-item">In-Sample R&sup2;: <strong>${(radar.validation.in_sample_r2 * 100).toFixed(1)}%</strong></div>
          </div>
        </div>
        <div class="method-card">
          <h3>Model Specifications Comparison</h3>
          <table class="radar-table" style="margin-top:10px;">
            <thead><tr><th>Specification</th><th>LOO RMSE</th><th>LOO R&sup2;</th><th>Walk-Forward R&sup2;</th></tr></thead>
            <tbody>
              ${radar.specs_comparison.map(s => `
                <tr ${s.name === radar.selected_spec ? 'style="background:#13331a;"' : ''}>
                  <td>${s.name}</td>
                  <td>${s.loo_rmse.toFixed(4)}</td>
                  <td>${(s.loo_r2 * 100).toFixed(1)}%</td>
                  <td>${(s.walk_r2 * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderModal() {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('modal-content');
    const row = radar.rows.find(r => r.slug === state.selectedSlug);
    if (!row) return;

    content.innerHTML = `
      <button class="modal-close" id="close-modal">&times;</button>
      <h2>#${row.rank} · ${row.name} (${row.slug})</h2>
      <p class="section-desc">Category: <strong>${row.category || 'Unknown'}</strong> | Chains: <strong>${row.chains ? row.chains.join(', ') : 'N/A'}</strong> | TVL: <strong>$${(row.tvl_usd / 1e6).toFixed(1)}M</strong></p>
      
      <div class="detail-section">
        <h3>Valuation Decomposition & 80% Confidence Interval</h3>
        <div class="detail-grid">
          <div class="detail-item">Implied Value: <strong>$${row.implied_value_usd.toLocaleString()}</strong></div>
          <div class="detail-item">80% Interval: <strong>$${row.interval_low_usd.toLocaleString()} &ndash; $${row.interval_high_usd.toLocaleString()}</strong></div>
          <div class="detail-item">Token Odds P(launch): <strong>${row.token_odds_pct}%</strong></div>
          <div class="detail-item">Expected Airdrop Value (EV): <strong>$${row.expected_value_usd.toLocaleString()}</strong></div>
          <div class="detail-item">Verdict: <span class="${row.verdict === 'GO' ? 'verdict-go' : row.verdict === 'MARGINAL' ? 'verdict-marginal' : 'verdict-skip'}">${row.verdict}</span></div>
          <div class="detail-item">Protocol Age: <strong>${row.age_days !== null ? row.age_days + ' days' : 'N/A'}</strong></div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Model Decomposition (${row.model.spec_name})</h3>
        <p class="section-desc">Log10 contributions (additive in log space; multiplicative factors 10<sup>term</sup>):</p>
        <div class="detail-grid">
          <div class="detail-item">Intercept: <strong>${row.model.components.intercept.toFixed(4)}</strong> (&times;${Math.pow(10, row.model.components.intercept).toFixed(2)})</div>
          <div class="detail-item">TVL Term: <strong>${row.model.components.tvl_term.toFixed(4)}</strong> (&times;${Math.pow(10, row.model.components.tvl_term).toFixed(2)})</div>
          <div class="detail-item">Category Term: <strong>${row.model.components.category_term.toFixed(4)}</strong> (&times;${Math.pow(10, row.model.components.category_term).toFixed(2)})</div>
          <div class="detail-item">7d Change Term: <strong>${row.model.components.change_term.toFixed(4)}</strong> (&times;${Math.pow(10, row.model.components.change_term).toFixed(2)})</div>
          <div class="detail-item">Age Term: <strong>${row.model.components.age_term.toFixed(4)}</strong> (&times;${Math.pow(10, row.model.components.age_term).toFixed(2)})</div>
          ${row.model.components.interaction_term !== undefined ? `<div class="detail-item">Interaction Term: <strong>${row.model.components.interaction_term.toFixed(4)}</strong> (&times;${Math.pow(10, row.model.components.interaction_term).toFixed(2)})</div>` : ''}
          <div class="detail-item">Fitted Log10 (Sum): <strong>${row.model.fitted_log.toFixed(4)}</strong></div>
          <div class="detail-item">Implied Value (10<sup>fitted</sup>): <strong>$${row.implied_value_usd.toLocaleString()}</strong></div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Actionable 6-Step Farming Plan</h3>
        <div style="margin-top:10px;">
          ${row.farm_steps.map((step, idx) => `
            <div class="farm-step-item"><strong>Step ${idx+1}:</strong> ${step.replace(/^Step \d+: /, '')}</div>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    document.getElementById('close-modal').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  // Event Listeners for Controls
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderBoardTable();
  });
  document.getElementById('category-filter').addEventListener('change', (e) => {
    state.category = e.target.value;
    renderBoardTable();
  });
  document.getElementById('chain-filter').addEventListener('change', (e) => {
    state.chain = e.target.value;
    renderBoardTable();
  });
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderBoardTable();
  });

  const watchlistBtn = document.getElementById('watchlist-toggle-btn');
  watchlistBtn.addEventListener('click', () => {
    state.watchlistOnly = !state.watchlistOnly;
    watchlistBtn.classList.toggle('active', state.watchlistOnly);
    watchlistBtn.textContent = state.watchlistOnly ? 'Showing Watchlist (40/40)' : 'Watchlist Only (40/40)';
    renderBoardTable();
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      document.getElementById(`tab-${tab}`).classList.add('active');
      state.activeTab = tab;
      if (tab === 'method') renderMethodView();
      if (tab === 'live') renderLiveTable();
      if (tab === 'excluded') renderExcludedTable();
    });
  });

  // Initial render
  renderIntegrityStrip();
  renderKpiStrip();
  renderTop10Strip();
  renderBoardTable();
  renderLiveTable();
  renderExcludedTable();

  // Handle hash routing (#p=slug, #q=search, #category=cat)
  if (window.location.hash.startsWith('#p=')) {
    const slug = window.location.hash.slice(3);
    if (radar.rows.some(r => r.slug === slug)) {
      state.selectedSlug = slug;
      renderModal();
    }
  } else if (window.location.hash.startsWith('#q=')) {
    const q = decodeURIComponent(window.location.hash.slice(3));
    state.search = q;
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = q;
    renderBoardTable();
  } else if (window.location.hash.startsWith('#category=')) {
    const cat = decodeURIComponent(window.location.hash.slice(10));
    state.category = cat;
    const catSelect = document.getElementById('category-filter');
    if (catSelect) catSelect.value = cat;
    renderBoardTable();
  }
})();
