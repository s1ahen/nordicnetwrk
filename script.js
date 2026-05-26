/* ─────────────────────────────────────────────
   NORDIC NETWORK — Gallery Script
   Loads from photos.json · pure vanilla JS
───────────────────────────────────────────── */

(() => {
  'use strict';

  /* ── STATE ─────────────────────────────────── */
  let allPhotos  = [];
  let filtered   = [];
  let activeNum  = null;
  let modalIndex = 0;

  /* ── DOM REFS ───────────────────────────────── */
  const grid            = document.getElementById('gallery-grid');
  const filterInput     = document.getElementById('player-filter');
  const filterClear     = document.getElementById('filter-clear');
  const photoCount      = document.getElementById('photo-count');
  const activeFilterBar = document.getElementById('active-filter-bar');
  const activeFilterLbl = document.getElementById('active-filter-label');
  const clearBtnBanner  = document.getElementById('clear-btn-banner');
  const emptyState      = document.getElementById('empty-state');
  const emptyStateNum   = document.getElementById('empty-state-number');
  const clearBtnEmpty   = document.getElementById('clear-btn-empty');
  const header          = document.getElementById('site-header');

  /* modal refs */
  const overlay      = document.getElementById('modal-overlay');
  const modalImg     = document.getElementById('modal-img');
  const modalTags    = document.getElementById('modal-tags');
  const modalClose   = document.getElementById('modal-close');
  const modalPrev    = document.getElementById('modal-prev');
  const modalNext    = document.getElementById('modal-next');
  const modalDl      = document.getElementById('modal-download');
  const modalCtr     = document.getElementById('modal-counter');

  /* ── INIT ───────────────────────────────────── */
  async function init() {
    try {
      const res = await fetch('photos.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allPhotos = await res.json();
    } catch (err) {
      grid.innerHTML = `<p style="color:var(--text-secondary);grid-column:1/-1;padding:40px 0;text-align:center">
        Could not load <code>photos.json</code>. Make sure it exists in the same directory.<br>
        <small style="opacity:.5">${err.message}</small>
      </p>`;
      return;
    }
    filtered = [...allPhotos];
    renderGallery();
    updateCount();
  }

  /* ── RENDER ─────────────────────────────────── */
  function renderGallery() {
    grid.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.hidden = false;
      emptyStateNum.textContent = `#${activeNum}`;
      return;
    }
    emptyState.hidden = true;

    const fragment = document.createDocumentFragment();
    filtered.forEach((photo, idx) => fragment.appendChild(buildCard(photo, idx)));
    grid.appendChild(fragment);
    initLazyLoad();
  }

  function buildCard(photo, idx) {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.style.animationDelay = `${Math.min(idx * 40, 400)}ms`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Open photo');

    const tagHTML = (photo.numbers || [])
      .map(n => `<span class="player-tag">#${n}</span>`)
      .join('');

    card.innerHTML = `
      <div class="card-img-wrap loading" data-src="${photo.path}">
        <img alt="" loading="lazy" />
        <div class="card-overlay">
          <div class="overlay-zoom">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7"/>
            </svg>
          </div>
        </div>
      </div>
      ${tagHTML ? `<div class="card-meta"><div class="card-numbers">${tagHTML}</div></div>` : ''}
    `;

    card.addEventListener('click', () => openModal(idx));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(idx); });

    return card;
  }

  /* ── LAZY LOAD ──────────────────────────────── */
  function initLazyLoad() {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const wrap = entry.target;
        const img  = wrap.querySelector('img');
        const src  = wrap.dataset.src;
        if (!src) return;
        img.src = src;
        img.addEventListener('load',  () => { wrap.classList.remove('loading'); obs.unobserve(wrap); }, { once: true });
        img.addEventListener('error', () => { wrap.classList.remove('loading'); obs.unobserve(wrap); }, { once: true });
      });
    }, { rootMargin: '200px 0px' });

    document.querySelectorAll('.card-img-wrap[data-src]').forEach(el => io.observe(el));
  }

  /* ── FILTERING ──────────────────────────────── */
  function applyFilter(numStr) {
    const raw = numStr.trim();

    if (raw === '') {
      activeNum = null;
      filtered  = [...allPhotos];
      activeFilterBar.hidden = true;
    } else {
      const n = parseInt(raw, 10);
      if (isNaN(n)) return;
      activeNum = n;
      filtered  = allPhotos.filter(p => (p.numbers || []).includes(n));
      activeFilterLbl.textContent = `#${n}`;
      activeFilterBar.hidden = false;
      emptyStateNum.textContent  = `#${n}`;
    }

    filterClear.classList.toggle('visible', raw !== '');
    renderGallery();
    updateCount();
  }

  function clearFilter() {
    filterInput.value = '';
    applyFilter('');
    filterInput.focus();
  }

  /* ── COUNT ──────────────────────────────────── */
  function updateCount() {
    const total = filtered.length;
    photoCount.textContent = total === 1 ? '1 photo' : `${total} photos`;
  }

  /* ── MODAL ──────────────────────────────────── */
  function openModal(idx) {
    modalIndex = idx;
    renderModal();
    overlay.removeAttribute('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.classList.add('modal-open');
    modalClose.focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => {
      overlay.setAttribute('hidden', '');
    }, { once: true });
    document.body.classList.remove('modal-open');
  }

  function renderModal() {
    const photo = filtered[modalIndex];
    if (!photo) return;

    modalImg.classList.remove('loaded');
    modalImg.src = '';

    modalCtr.textContent = `${modalIndex + 1} / ${filtered.length}`;

    modalTags.innerHTML = (photo.numbers || [])
      .map(n => `<span class="player-tag">#${n}</span>`)
      .join('');

    modalDl.href     = photo.path;
    modalDl.download = photo.path.split('/').pop();

    const img = new Image();
    img.onload  = () => { modalImg.src = img.src; modalImg.classList.add('loaded'); };
    img.onerror = () => { modalImg.src = photo.path; modalImg.classList.add('loaded'); };
    img.src = photo.path;

    modalPrev.disabled = modalIndex === 0;
    modalNext.disabled = modalIndex === filtered.length - 1;
  }

  function stepModal(delta) {
    const next = modalIndex + delta;
    if (next < 0 || next >= filtered.length) return;
    modalIndex = next;
    renderModal();
  }

  /* ── TOUCH SWIPE ────────────────────────────── */
  let touchStartX = null;
  overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) stepModal(dx < 0 ? 1 : -1);
    touchStartX = null;
  });

  /* ── EVENTS ─────────────────────────────────── */
  filterInput.addEventListener('input',  e => applyFilter(e.target.value));
  filterClear.addEventListener('click',  clearFilter);
  clearBtnBanner.addEventListener('click', clearFilter);
  clearBtnEmpty.addEventListener('click',  clearFilter);

  modalClose.addEventListener('click', closeModal);
  modalPrev.addEventListener('click',  () => stepModal(-1));
  modalNext.addEventListener('click',  () => stepModal(1));

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (overlay.hasAttribute('hidden')) return;
    if (e.key === 'Escape')     closeModal();
    if (e.key === 'ArrowLeft')  stepModal(-1);
    if (e.key === 'ArrowRight') stepModal(1);
  });

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  /* ── KICK OFF ───────────────────────────────── */
  init();

})();