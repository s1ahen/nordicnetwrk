/* ─────────────────────────────────────────────
   NORDIC NETWORK — Gallery Script
   School + Team + Player filtering · URL state
───────────────────────────────────────────── */

(() => {
  'use strict';

  /* ── STATE ── */
  let allPhotos  = [];
  let allPlayers = [];
  let playerMap  = {};       // number → { name, school, team }
  let filtered   = [];

  let activeMatch   = 'all';
  let activeSchool  = '';    // '' = all
  let activeTeam    = '';    // '' = all
  let activePlayers = [];    // array of numbers

  let modalIndex  = 0;
  let suggFocIdx  = -1;

  /* ── DOM ── */
  const grid          = document.getElementById('gallery-grid');
  const photoCount    = document.getElementById('photo-count');
  const matchTabsEl   = document.getElementById('match-tabs');
  const skeletonEl    = document.getElementById('skeleton-overlay');
  const emptyState    = document.getElementById('empty-state');
  const clearBtnEmpty = document.getElementById('clear-btn-empty');
  const header        = document.getElementById('site-header');
  const backToTop     = document.getElementById('back-to-top');
  const activePills   = document.getElementById('active-pills');
  const galleryHeading= document.getElementById('gallery-heading');
  const galleryCount  = document.getElementById('gallery-count');

  /* search */
  const schoolSelect  = document.getElementById('school-select');
  const teamSelect    = document.getElementById('team-select');
  const playerSearch  = document.getElementById('player-search');
  const suggestions   = document.getElementById('search-suggestions');
  const searchBtn     = document.getElementById('search-btn');
  const searchChips   = document.getElementById('search-chips');
  const iconSearch    = searchBtn.querySelector('.icon-search');
  const iconClear     = searchBtn.querySelector('.icon-clear');

  /* share */
  const shareBtn      = document.getElementById('share-btn');
  const shareLabel    = shareBtn.querySelector('.share-label');
  const shareConfirm  = shareBtn.querySelector('.share-confirm');

  /* modal */
  const overlay      = document.getElementById('modal-overlay');
  const modalImg     = document.getElementById('modal-img');
  const modalClose   = document.getElementById('modal-close');
  const modalPrev    = document.getElementById('modal-prev');
  const modalNext    = document.getElementById('modal-next');
  const modalDl      = document.getElementById('modal-download');
  const modalCtr     = document.getElementById('modal-counter');
  const modalPlayers = document.getElementById('modal-players');

  /* ── INIT ── */
  async function init() {
    try {
      const [pr, pl] = await Promise.all([fetch('photos.json'), fetch('players.json')]);
      if (!pr.ok) throw new Error('photos.json ' + pr.status);
      if (!pl.ok) throw new Error('players.json ' + pl.status);
      allPhotos  = await pr.json();
      allPlayers = await pl.json();
    } catch (err) {
      skeletonEl.classList.add('hidden');
      grid.innerHTML = `<p style="color:var(--text-secondary);padding:40px 0;text-align:center">
        Could not load data: ${err.message}</p>`;
      return;
    }

    allPlayers.forEach(p => { playerMap[p.number] = { name: p.name, school: p.school, team: p.team }; });

    skeletonEl.classList.add('hidden');
    buildSchoolDropdown();
    buildMatchTabs();
    readURLState();      // apply any shared link params
    applyFilters();
  }

  /* ── SCHOOL DROPDOWN ── */
  function buildSchoolDropdown() {
    const schools = [...new Set(allPlayers.map(p => p.school).filter(Boolean))].sort();
    schoolSelect.innerHTML = '<option value="">All schools</option>';
    schools.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      schoolSelect.appendChild(o);
    });
  }

  /* ── TEAM DROPDOWN — depends on selected school ── */
  function buildTeamDropdown(school) {
    const pool = school
      ? allPlayers.filter(p => p.school === school)
      : allPlayers;
    const teams = [...new Set(pool.map(p => p.team).filter(Boolean))].sort();

    teamSelect.innerHTML = '<option value="">All teams</option>';
    teams.forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      teamSelect.appendChild(o);
    });
    // restore selection if still valid
    if (activeTeam && teams.includes(activeTeam)) teamSelect.value = activeTeam;
    else { activeTeam = ''; }
  }

  /* ── MATCH TABS ── */
  function buildMatchTabs() {
    const matches = ['all', ...new Set(allPhotos.map(p => p.match).filter(Boolean))];
    matchTabsEl.innerHTML = '';
    matches.forEach(match => {
      const count = match === 'all' ? allPhotos.length : allPhotos.filter(p => p.match === match).length;
      const btn = document.createElement('button');
      btn.className = 'match-tab' + (match === activeMatch ? ' active' : '');
      btn.innerHTML = `${match === 'all' ? 'All Photos' : match}<span class="tab-count">${count}</span>`;
      btn.addEventListener('click', () => {
        activeMatch = match;
        document.querySelectorAll('.match-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        galleryHeading.textContent = match === 'all' ? 'All Photos' : match;
        pushURLState();
        applyFilters();
      });
      matchTabsEl.appendChild(btn);
    });
  }

  /* ── URL STATE ── */
  function pushURLState() {
    const p = new URLSearchParams();
    if (activeMatch !== 'all') p.set('match', activeMatch);
    if (activeSchool) p.set('school', activeSchool);
    if (activeTeam)   p.set('team', activeTeam);
    if (activePlayers.length) p.set('players', activePlayers.join(','));
    const url = p.toString() ? `${location.pathname}?${p}` : location.pathname;
    history.replaceState(null, '', url);
  }

  function readURLState() {
    const p = new URLSearchParams(location.search);
    if (p.get('match')) {
      activeMatch = p.get('match');
      document.querySelectorAll('.match-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.match === activeMatch ||
          (activeMatch !== 'all' && btn.textContent.startsWith(activeMatch)));
      });
      galleryHeading.textContent = activeMatch === 'all' ? 'All Photos' : activeMatch;
    }
    if (p.get('school')) {
      activeSchool = p.get('school');
      schoolSelect.value = activeSchool;
      buildTeamDropdown(activeSchool);
    }
    if (p.get('team')) {
      activeTeam = p.get('team');
      teamSelect.value = activeTeam;
    }
    if (p.get('players')) {
      activePlayers = p.get('players').split(',').map(Number).filter(n => !isNaN(n));
    }
    updateSearchBtnState();
  }

  /* ── AUTOCOMPLETE ── */
  function playerPool() {
    return allPlayers.filter(p => {
      if (activeSchool && p.school !== activeSchool) return false;
      if (activeTeam   && p.team   !== activeTeam)   return false;
      if (activePlayers.includes(p.number))           return false;
      return true;
    });
  }

  function showSuggestions(q) {
    q = q.trim().toLowerCase();
    if (!q) { hideSugg(); return; }
    const results = playerPool().filter(p =>
      p.name.toLowerCase().includes(q) || String(p.number).startsWith(q)
    ).slice(0, 8);
    if (!results.length) { hideSugg(); return; }

    suggestions.innerHTML = '';
    results.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item'; li.dataset.i = i;
      li.innerHTML = `
        <span class="sug-num">#${p.number}</span>
        <span class="sug-name">${esc(p.name)}</span>
        <span class="sug-meta">${esc(p.school)} · ${esc(p.team)}</span>`;
      li.addEventListener('mousedown', e => { e.preventDefault(); selectPlayer(p.number); });
      suggestions.appendChild(li);
    });
    suggFocIdx = -1;
    suggestions.removeAttribute('hidden');
  }

  function hideSugg() { suggestions.setAttribute('hidden', ''); suggFocIdx = -1; }

  function moveFocus(dir) {
    const items = suggestions.querySelectorAll('.suggestion-item');
    if (!items.length) return;
    items[suggFocIdx]?.classList.remove('focused');
    suggFocIdx = (suggFocIdx + dir + items.length) % items.length;
    items[suggFocIdx].classList.add('focused');
    items[suggFocIdx].scrollIntoView({ block: 'nearest' });
  }

  function selectPlayer(num) {
    if (!activePlayers.includes(num)) activePlayers.push(num);
    playerSearch.value = '';
    hideSugg();
    updateSearchBtnState();
    pushURLState();
    applyFilters();
  }

  /* ── SEARCH BTN ── */
  function updateSearchBtnState() {
    const has = activeSchool || activeTeam || activePlayers.length;
    iconSearch.toggleAttribute('hidden', !!has);
    iconClear.toggleAttribute('hidden', !has);
  }

  function clearAllFilters() {
    activeSchool = ''; activeTeam = ''; activePlayers = [];
    schoolSelect.value = ''; teamSelect.value = '';
    playerSearch.value = '';
    buildTeamDropdown('');
    hideSugg();
    updateSearchBtnState();
    pushURLState();
    applyFilters();
  }

  /* ── CHIPS ── */
  function renderChips() {
    searchChips.innerHTML = '';
    if (activeSchool) searchChips.appendChild(makeChip(activeSchool, 'school', () => {
      activeSchool = ''; schoolSelect.value = '';
      activeTeam = ''; buildTeamDropdown('');
      activePlayers = activePlayers.filter(n => true); // keep players
      updateSearchBtnState(); pushURLState(); applyFilters();
    }));
    if (activeTeam) searchChips.appendChild(makeChip(activeTeam, 'team', () => {
      activeTeam = ''; teamSelect.value = '';
      updateSearchBtnState(); pushURLState(); applyFilters();
    }));
    activePlayers.forEach(num => {
      const info = playerMap[num];
      const label = info ? `#${num} ${info.name}` : `#${num}`;
      searchChips.appendChild(makeChip(label, 'player', () => {
        activePlayers = activePlayers.filter(n => n !== num);
        updateSearchBtnState(); pushURLState(); applyFilters();
      }));
    });
  }

  function makeChip(label, type, fn) {
    const d = document.createElement('div');
    d.className = `chip chip--${type}`;
    d.innerHTML = `${esc(label)}<button class="chip-remove" aria-label="Remove">✕</button>`;
    d.querySelector('.chip-remove').addEventListener('click', fn);
    return d;
  }

  /* ── PILLS ── */
  function renderPills() {
    activePills.innerHTML = '';
    if (activeSchool) activePills.appendChild(makePill(activeSchool, 'school', () => {
      activeSchool = ''; schoolSelect.value = '';
      activeTeam = ''; buildTeamDropdown('');
      updateSearchBtnState(); pushURLState(); applyFilters();
    }));
    if (activeTeam) activePills.appendChild(makePill(activeTeam, 'team', () => {
      activeTeam = ''; teamSelect.value = '';
      updateSearchBtnState(); pushURLState(); applyFilters();
    }));
    activePlayers.forEach(num => {
      const info = playerMap[num];
      const label = info ? `#${num} ${info.name}` : `#${num}`;
      activePills.appendChild(makePill(label, 'player', () => {
        activePlayers = activePlayers.filter(n => n !== num);
        updateSearchBtnState(); pushURLState(); applyFilters();
      }));
    });
  }

  function makePill(label, type, fn) {
    const s = document.createElement('span');
    s.className = `active-pill${type === 'school' ? ' active-pill--school' : ''}`;
    s.innerHTML = `${esc(label)}<button aria-label="Remove">✕</button>`;
    s.querySelector('button').addEventListener('click', fn);
    return s;
  }

  /* ── APPLY FILTERS ── */
  function applyFilters() {
    let pool = activeMatch === 'all'
      ? allPhotos
      : allPhotos.filter(p => p.match === activeMatch);

    if (activeSchool) {
      pool = pool.filter(p => (p.numbers || []).some(n => playerMap[n]?.school === activeSchool));
    }
    if (activeTeam) {
      pool = pool.filter(p => (p.numbers || []).some(n => playerMap[n]?.team === activeTeam));
    }
    if (activePlayers.length) {
      pool = pool.filter(p => activePlayers.every(n => (p.numbers || []).includes(n)));
    }

    filtered = pool;
    renderGallery();
    renderChips();
    renderPills();
    updateCount();
  }

  function updateCount() {
    const n = filtered.length, total = allPhotos.length;
    photoCount.textContent = `${n} photo${n !== 1 ? 's' : ''}`;
    galleryCount.textContent = n === total ? `${n} photos` : `${n} of ${total} photos`;
  }

  /* ── RENDER ── */
  function renderGallery() {
    grid.innerHTML = '';
    if (filtered.length === 0) { emptyState.hidden = false; return; }
    emptyState.hidden = true;
    const frag = document.createDocumentFragment();
    filtered.forEach((photo, idx) => frag.appendChild(buildCard(photo, idx)));
    grid.appendChild(frag);
    initLazyLoad();
  }

  function buildCard(photo, idx) {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.style.animationDelay = `${Math.min(idx * 28, 380)}ms`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Open photo');

    /* tags only on card */
    const tagsHTML = (photo.numbers || []).map(n => {
      const hl = activePlayers.includes(n) ? ' highlighted' : '';
      return `<span class="player-tag${hl}">#${n}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="card-img-wrap loading" data-src="${photo.path}">
        <img alt="" loading="lazy" />
        <div class="card-overlay">
          <div class="overlay-zoom">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7"/>
            </svg>
          </div>
        </div>
      </div>
      ${tagsHTML ? `<div class="card-meta"><div class="card-tags">${tagsHTML}</div></div>` : ''}
    `;

    card.addEventListener('click', () => openModal(idx));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(idx); });
    return card;
  }

  /* ── LAZY LOAD ── */
  function initLazyLoad() {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const wrap = entry.target, img = wrap.querySelector('img'), src = wrap.dataset.src;
        if (!src) return;
        img.src = src;
        const done = () => { wrap.classList.remove('loading'); obs.unobserve(wrap); };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    }, { rootMargin: '200px 0px' });
    document.querySelectorAll('.card-img-wrap[data-src]').forEach(el => io.observe(el));
  }

  /* ── MODAL ── */
  function openModal(idx) {
    modalIndex = idx; renderModal();
    overlay.removeAttribute('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.classList.add('modal-open');
    modalClose.focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.setAttribute('hidden', ''), { once: true });
    document.body.classList.remove('modal-open');
  }

  function renderModal() {
    const photo = filtered[modalIndex]; if (!photo) return;
    modalImg.classList.remove('loaded'); modalImg.src = '';
    modalCtr.textContent = `${modalIndex + 1} / ${filtered.length}`;

    modalPlayers.innerHTML = (photo.numbers || []).map(n => {
      const info = playerMap[n];
      return `<div class="modal-player-chip">
        <span class="player-tag">#${n}</span>
        ${info ? `<span class="chip-name">${esc(info.name)}</span>
                  <span class="chip-team">${esc(info.team)}</span>
                  <span class="chip-school">${esc(info.school)}</span>` : ''}
      </div>`;
    }).join('');

    modalDl.href = photo.path;
    modalDl.download = photo.path.split('/').pop();
    const img = new Image();
    img.onload  = () => { modalImg.src = img.src; modalImg.classList.add('loaded'); };
    img.onerror = () => { modalImg.src = photo.path; modalImg.classList.add('loaded'); };
    img.src = photo.path;
    modalPrev.disabled = modalIndex === 0;
    modalNext.disabled = modalIndex === filtered.length - 1;
  }

  function stepModal(d) {
    const n = modalIndex + d;
    if (n < 0 || n >= filtered.length) return;
    modalIndex = n; renderModal();
  }

  /* ── TOUCH SWIPE ── */
  let tx = null;
  overlay.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) stepModal(dx < 0 ? 1 : -1);
    tx = null;
  });

  /* ── SHARE ── */
  shareBtn.addEventListener('click', () => {
    pushURLState();
    navigator.clipboard.writeText(location.href).then(() => {
      shareLabel.setAttribute('hidden', '');
      shareConfirm.removeAttribute('hidden');
      setTimeout(() => {
        shareConfirm.setAttribute('hidden', '');
        shareLabel.removeAttribute('hidden');
      }, 2000);
    });
  });

  /* ── EVENTS ── */
  schoolSelect.addEventListener('change', () => {
    activeSchool = schoolSelect.value;
    activeTeam = '';
    activePlayers = activePlayers.filter(n => !activeSchool || playerMap[n]?.school === activeSchool);
    buildTeamDropdown(activeSchool);
    updateSearchBtnState(); pushURLState(); applyFilters();
  });

  teamSelect.addEventListener('change', () => {
    activeTeam = teamSelect.value;
    activePlayers = activePlayers.filter(n => !activeTeam || playerMap[n]?.team === activeTeam);
    updateSearchBtnState(); pushURLState(); applyFilters();
  });

  playerSearch.addEventListener('input', e => showSuggestions(e.target.value));
  playerSearch.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const f = suggestions.querySelector('.suggestion-item.focused');
      if (f) { selectPlayer(parseInt(f.querySelector('.sug-num').textContent.slice(1))); }
      else { const n = parseInt(playerSearch.value); if (!isNaN(n) && playerMap[n]) selectPlayer(n); }
    } else if (e.key === 'Escape') hideSugg();
  });
  playerSearch.addEventListener('blur', () => setTimeout(hideSugg, 150));

  searchBtn.addEventListener('click', () => { if (activeSchool || activeTeam || activePlayers.length) clearAllFilters(); });
  clearBtnEmpty.addEventListener('click', clearAllFilters);

  modalClose.addEventListener('click', closeModal);
  modalPrev.addEventListener('click', () => stepModal(-1));
  modalNext.addEventListener('click', () => stepModal(1));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  document.addEventListener('keydown', e => {
    if (overlay.hasAttribute('hidden')) return;
    if (e.key === 'Escape')     closeModal();
    if (e.key === 'ArrowLeft')  stepModal(-1);
    if (e.key === 'ArrowRight') stepModal(1);
  });

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
    backToTop.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  init();
})();