'use strict';
// Démarrage, navigation entre les pages, sauvegarde.
(function () {
  const { $, COL, toast, bar, setBar } = UI;
  const Q = new URLSearchParams(location.search);
  const DEMO = Q.has('demo'); // ?demo = fausses séances pour juger l'écran ; rien n'est sauvegardé

  let data = DEMO ? demoData() : B.load();
  const save = () => { if (!DEMO && !B.save(data)) toast('Sauvegarde impossible : exporte tes données (Réglages)', 4000); };
  if (!DEMO && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- Pages ----------
  const soon = (t, s) => `<div class="page"><div class="halo"></div><header class="top"><h1>${t}</h1></header><div class="soon"><b>Bientôt</b>${s}</div></div>`;
  const PAGES = {
    home: { render: () => Home.render(data), mounted: Home.mounted, color: () => COL[B.nextType(data)] },
    progres: { render: () => Progres.render(), color: () => Progres.color() },
    reglages: { render: () => Reglages.render(), color: () => COL.white },
    seance: { render: () => Seance.render(), mounted: Seance.mounted, color: () => COL.brief },
  };
  let page = null;
  function go(p, push = true) {
    if (!PAGES[p]) p = 'home';
    if (page === 'seance' && p !== 'seance') Seance.leave();
    if (page === 'progres' && p !== 'progres') Progres.leave();
    if (page === 'reglages' && p !== 'reglages') Reglages.leave();
    const P = PAGES[p], v = $('#view');
    v.innerHTML = P.render(); window.scrollTo(0, 0);
    setBar(p, P.color(), B.doneToday(data) && !data.current); // une séance en cours : le GO la reprend
    if (P.mounted) P.mounted();
    if (push && page !== p) history.replaceState(null, '', '#' + p + (DEMO ? '' : ''));
    page = p;
  }

  // ---------- Actions ----------
  function openSeance(type) {
    // le bouton ouvre le brief : rien ne démarre (ni chrono ni sauvegarde) avant « C'est parti »
    Seance.open(type); go('seance');
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (e.target.closest('#gobtn')) {
      if (data.current) return go('seance');
      if (B.doneToday(data)) return toast('Séance du jour faite ✓ La prochaine : ' + B.nextType(data));
      return openSeance(B.nextType(data));
    }
    const a = e.target.closest('[data-act]');
    if (!e.target.closest('.ipop') && !(a && a.dataset.act === 'item')) Home.closePop(); // toucher ailleurs ferme la carte
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'seance') return openSeance(a.dataset.t);
    if (act === 'resume') return go('seance');
    if (act === 'item') return Home.pop(data, a);
  });
  window.addEventListener('hashchange', () => go(location.hash.slice(1), false));

  // ---------- Démo ----------
  function demoData() {
    const d = B.blank(), DAY = 864e5, t0 = new Date().setHours(9, 0, 0, 0) - 21 * DAY; // 6 séances sur les 3 dernières semaines
    const plan = [
      ['A', [[1, 'ft', 5], [1, 'ft', 6], [1, 'ft', 5], [2, 'face', 5], [2, 'g', 4], [2, 'd', 3], [3, 'cg', 1], [3, 'face', 2], [9, 'd', 8], [9, 'g', 7], [11, 'def', 1]]],
      ['B', [[5, 'slalom', 24.1, { loss: 3 }], [6, 'imm', 1], [7, 'imm', 3], [8, 'imm', 4], [10, 'd', 6], [10, 'g', 5], [4, 'js', 3], [13, 'half', 9.6], [11, 'def', 1]]],
      ['A', [[1, 'ft', 7], [1, 'ft', 7], [1, 'ft', 8], [2, 'face', 7], [2, 'g', 6], [2, 'd', 5], [3, 'cd', 3], [3, 'cg', 2], [9, 'd', 9], [9, 'g', 9], [11, 'def', 1]]],
      ['B', [[5, 'slalom', 22.4, { loss: 2 }], [6, 'imm', 0], [7, 'imm', 1], [8, 'imm', 2], [10, 'd', 8], [10, 'g', 7], [4, 'js', 5], [13, 'half', 9.2], [11, 'def', 1]]],
      ['A', [[1, 'ft', 8], [1, 'ft', 7], [1, 'ft', 7], [2, 'face', 7], [2, 'g', 7], [2, 'd', 6], [3, 'face', 3], [3, 'cd', 3], [9, 'd', 9], [9, 'g', 10], [11, 'def', 1]]],
      ['B', [[5, 'slalom', 20.9, { loss: 1 }], [6, 'imm', 0], [6, 'walk', 2], [7, 'imm', 0], [8, 'imm', 1], [10, 'd', 9], [10, 'g', 8], [4, 'js', 4], [14, 'full', 17.8], [11, 'def', 1]]],
    ];
    plan.forEach(([type, res], i) => { const st = t0 + [0, 4, 7, 11, 14, 18][i] * DAY;
      d.sessions.push({ id: st, type, start: st, end: st + (38 + i) * 60e3, res: res.map(([item, key, v, x]) => Object.assign({ item, key, v }, x || {})) }); });
    if (Q.has('today')) { const s = d.sessions[d.sessions.length - 1]; s.start = s.id = Date.now() - 3 * 3600e3; s.end = s.start + 41 * 60e3; }
    if (Q.has('cours')) { B.startSession(d, 'A', Date.now() - 18 * 60e3); B.record(d, { item: 1, key: 'ft', v: 7 }); }
    return d;
  }

  UI.applyTheme(Q.get('theme') || data.settings.theme); // ?theme=light pour tester
  bar();
  window.App = { get data() { return data; }, save, go };
  Seance.init(App); Progres.init(App); Reglages.init(App);
  // une séance en cours (refresh, iOS qui a tué l'app) : on y retourne directement
  go(data.current ? 'seance' : (location.hash.slice(1) || 'home'), false);
  // hors ligne : seulement en ligne (GitHub Pages), pas en local où le cache masquerait les modifs
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !LOCAL && !DEMO) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
