'use strict';
// Outils d'écran partagés : icônes, toast, anneaux, barre du bas.
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');

  // Couleurs : une par type d'écran (DESIGN.md)
  const COL = { A: 'var(--ball)', B: 'var(--blue)', tir: 'var(--ball)', drib: 'var(--blue)', fin: 'var(--ok)', sprint: 'var(--ko)', gen: 'var(--vio)',
    brief: 'var(--gold)', warm: 'var(--vio)', ok: 'var(--ok)', white: 'var(--tx)' };

  const svg = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    home: svg('<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    prog: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'),
    gear: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
    play: '<svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    // niveaux des moves (icônes Lucide, licence ISC) : escargot, tortue, lapin
    imm: svg('<path d="M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0"/><circle cx="10" cy="13" r="8"/><path d="M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6"/><path d="M18 3 19.1 5.2"/><path d="M22 3 20.9 5.2"/>'),
    walk: svg('<path d="m12 10 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a8 8 0 1 0-16 0v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3l2-4h4Z"/><path d="M4.82 7.9 8 10"/><path d="M15.18 7.9 12 10"/><path d="M16.93 10H20a2 2 0 0 1 0 4H2"/>'),
    run: svg('<path d="M13 16a3 3 0 0 1 2.24 5"/><path d="M18 12h.01"/><path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3"/><path d="M20 8.54V4a2 2 0 1 0-4 0v3"/><path d="M7.612 12.524a3 3 0 1 0-1.6 4.3"/>'),
  };

  let tt;
  function toast(msg, ms = 2400) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms);
  }

  // Mini-anneau d'un item (accueil). p = 0..1, ou null (suivi, sans objectif) · fc = la couleur de sa famille (doré une fois validé)
  function miniRing(p, st, i, fc) {
    const r = 19, c = 2 * Math.PI * r, col = st === 'ok' ? 'var(--gold)' : fc || 'var(--ball)';
    const off = c * (1 - (p === null ? 0 : p));
    return `<svg viewBox="0 0 46 46" style="transform:rotate(-90deg)"><circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--card-hi)" stroke-width="5"/>
      <circle class="arc" cx="23" cy="23" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${p === null ? '3 6' : c}"
       stroke-dashoffset="${p === null ? 0 : c}" data-off="${off}" style="transition-delay:${300 + i * 40}ms"/>
      ${st === 'ok' ? '<path d="M16 23.5l5 5 9-10" fill="none" stroke="var(--gold)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="rotate(90 23 23)"/>' : ''}</svg>`;
  }
  // Lance les anneaux une fois dans la page (setTimeout : un double requestAnimationFrame ne suffit pas quand la page est en arrière-plan)
  function drawRings(scope = document) { setTimeout(() => scope.querySelectorAll('.arc[data-off]').forEach(e => e.style.strokeDashoffset = e.dataset.off), 60); }

  // ---------- Barre du bas ----------
  const TABS = [['home', 'Accueil', ICON.home], ['progres', 'Progrès', ICON.prog], ['reglages', 'Réglages', ICON.gear]];
  function bar() {
    $('#bar').innerHTML = `<div class="row"><div class="cap3">${TABS.map(([k, l, ic]) =>
      `<button class="tab" data-go="${k}" aria-label="${l}">${ic}<span>${l}</span></button>`).join('')}</div>
      <button class="go" id="gobtn" aria-label="Prochaine séance"></button></div>`;
  }
  // page active + couleur (Accueil = prochaine séance, Progrès = famille, Réglages = blanc) + état du GO
  function setBar(page, color, done) {
    const b = $('#bar'); b.classList.toggle('hide', page === 'seance');
    $$('#bar .tab').forEach(t => t.classList.toggle('on', t.dataset.go === page));
    b.style.setProperty('--gc', color);
    const g = $('#gobtn'); g.classList.toggle('done', !!done); g.innerHTML = done ? ICON.check : ICON.play;
    g.setAttribute('aria-label', done ? 'Séance du jour faite' : 'Ouvrir la prochaine séance');
  }

  // la vague des pastilles toutes les 4 s (OmegaTracker)
  setInterval(() => {
    $$('.wavable').forEach((b, i) => { b.classList.remove('wave', 'pop'); b.style.animationDelay = (i * 55) + 'ms'; void b.offsetWidth; b.classList.add('wave'); });
  }, 4000);

  // ---------- thème : sombre, clair, ou auto (suit l'iPhone) ----------
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  let themeSet = 'dark';
  function applyTheme(t, fade) {
    themeSet = t || 'dark';
    if (fade) { const h = document.documentElement; h.classList.add('fade'); setTimeout(() => h.classList.remove('fade'), 450); }
    const light = themeSet === 'light' || (themeSet === 'auto' && mq && mq.matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = light ? '#F2F2F7' : '#161618';
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (themeSet === 'auto') applyTheme('auto'); });

  window.UI = { $, $$, f1, COL, ICON, toast, miniRing, drawRings, bar, setBar, applyTheme };
})();
