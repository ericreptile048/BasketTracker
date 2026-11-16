'use strict';
// Basket — la logique des données. Aucun accès à l'écran ici : ce fichier tourne aussi dans node pour les tests (tests/data.test.js).
// Tout reste dans le téléphone (localStorage). Aucune requête réseau.
(function (root) {
  const KEY = 'basket.v2';
  const GOAL = new Date(2027, 1, 14);          // dimanche 14 février 2027
  const START = new Date(2026, 10, 16);        // lundi 16 novembre 2026, début du programme
  const TOTAL = 26;                            // 2 séances par semaine sur 13 semaines

  // ---------- Les 12 items (liste fermée, note du vault) + le sprint suivi ----------
  // t : 'hi' = paniers sur 10 (seuil g) · 'lo' = pertes sur 10 (0 = réussi) · 'time' = chrono suivi · 'done' = fait/pas fait · 'manual'
  // sub : les variantes (spots, côtés, niveaux). need : les variantes qui comptent pour le test.
  const MOVES = [['imm', 'immobile'], ['walk', 'marche'], ['run', 'course']];
  const ITEMS = [
    { id: 1, n: 'Lancers francs', short: 'Lancers', f: 'tir', t: 'hi', g: 7, goal: '7/10 (moyenne des 3 séries)' },
    { id: 2, n: 'Mi-distance', short: 'Mi-distance', f: 'tir', t: 'hi', g: 7, goal: '7/10 à chacun des 3 spots',
      sub: [['face', 'face'], ['g', '45° G'], ['d', '45° D']] },
    { id: 3, n: '3 points', short: '3 points', f: 'tir', t: 'hi', g: 3, goal: '3/10 à chaque spot (4 = bonus)',
      sub: [['cg', 'corner G'], ['ag', '45° G'], ['face', 'face'], ['ad', '45° D'], ['cd', 'corner D']] },
    { id: 4, n: 'Jump stop + tir', short: 'Jump stop', f: 'tir', t: 'hi', g: 5, goal: '5/10' },
    { id: 5, n: 'Slalom main faible', short: 'Slalom', f: 'drib', t: 'time', goal: 'suivi : meilleur temps et pertes' },
    { id: 6, n: 'Crossover', short: 'Crossover', f: 'drib', t: 'lo', goal: '0 perte en marchant et en courant', sub: MOVES, need: ['walk', 'run'] },
    { id: 7, n: 'Entre les jambes', short: 'Entre jambes', f: 'drib', t: 'lo', goal: '0 perte en marchant et en courant', sub: MOVES, need: ['walk', 'run'] },
    { id: 8, n: 'Derrière le dos', short: 'Derrière dos', f: 'drib', t: 'lo', goal: '0 perte en marchant et en courant', sub: MOVES, need: ['walk', 'run'] },
    { id: 9, n: 'Layup balle en main', short: 'Layup main', f: 'fin', t: 'hi', g: 9, goal: '9/10 de chaque côté', sub: [['d', 'droite'], ['g', 'gauche']] },
    { id: 10, n: 'Layup vitesse de jeu', short: 'Layup vitesse', f: 'fin', t: 'hi', g: 9, goal: '9/10 de chaque côté', sub: [['d', 'droite'], ['g', 'gauche']] },
    { id: 11, n: 'Défense', short: 'Défense', f: 'gen', t: 'done', goal: '1 min de pas chassés dans l\'échauffement, 2 séances' },
    { id: 12, n: 'Règles et rôle d\'ailier', short: 'Ailier', f: 'gen', t: 'manual', goal: 'la vidéo d\'1 h, puis les 3 occasions de l\'ailier en 3 phrases' },
    { id: 13, n: 'Sprint demi-terrain', short: 'Sprint ½', f: 'sprint', t: 'time', m: 28, key: 'half', goal: 'suivi : aller-retour ~28 m' },
    { id: 14, n: 'Sprint terrain entier', short: 'Sprint entier', f: 'sprint', t: 'time', m: 56, key: 'full', goal: 'suivi : aller-retour ~56 m' },
  ];
  const ITEM = id => ITEMS.find(i => i.id === id);
  const LIST12 = ITEMS.filter(i => i.id <= 12);

  // ---------- Stockage ----------
  const blank = () => ({ v: 2, sessions: [], current: null, manual: {}, settings: { sound: true, wake: true, dist: 'half', theme: 'dark' }, lastExport: null });
  let mem = null; // repli si localStorage est indisponible (tests node, navigation privée)
  function load(store) {
    let d = null;
    try { d = JSON.parse((store || root.localStorage).getItem(KEY)); } catch (e) { d = mem; }
    const b = blank();
    if (!d || d.v !== 2) return b;
    return Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}), manual: d.manual || {} });
  }
  function save(data, store) {
    try { (store || root.localStorage).setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { mem = JSON.parse(JSON.stringify(data)); return false; }
  }

  // ---------- Lecture d'une séance ----------
  const sorted = data => data.sessions.slice().sort((a, b) => a.start - b.start);
  const entries = (s, id, key) => s.res.filter(r => r.item === id && (key === undefined || r.key === key));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

  // Le résultat d'un item dans une séance : { val, pass, subs } ou null si l'item n'a pas été fait.
  function evalItem(it, s) {
    if (it.t === 'manual') return null;
    if (it.t === 'done') { const e = entries(s, it.id); return e.length ? { val: 1, pass: true } : null; }
    if (it.t === 'time') {
      const e = entries(s, it.id); if (!e.length) return null;
      const b = e.reduce((x, y) => (y.v < x.v ? y : x));
      return { val: b.v, pass: null, loss: b.loss, all: e.map(x => x.v) };
    }
    if (it.sub) {
      const subs = {};
      it.sub.forEach(([k]) => { const e = entries(s, it.id, k); if (e.length) subs[k] = e[e.length - 1].v; });
      const keys = Object.keys(subs); if (!keys.length) return null;
      let pass;
      if (it.t === 'lo') pass = it.need.every(k => subs[k] === 0);
      else if (it.id === 3) pass = keys.length >= 2 && keys.every(k => subs[k] >= it.g);     // 2 spots par séance, en rotation
      else pass = it.sub.every(([k]) => subs[k] !== undefined && subs[k] >= it.g);
      const vals = keys.map(k => subs[k]);
      return { val: it.t === 'lo' ? (subs.walk ?? 10) + (subs.run ?? 10) : mean(vals), pass, subs };
    }
    const e = entries(s, it.id); if (!e.length) return null;
    const a = e.map(x => x.v), m = mean(a);
    return { val: m, pass: it.id === 1 ? a.length >= 3 && m >= it.g : m >= it.g, all: a };
  }

  // Validé = test réussi à 2 séances différentes de suite (parmi les séances où l'item a été fait). Une fois validé, ça reste.
  function twoInARow(passes) {
    for (let i = 0; i + 1 < passes.length; i++) if (passes[i] && passes[i + 1]) return i + 1;
    return -1;
  }
  function history(data, it) { return sorted(data).map(s => ({ s, e: evalItem(it, s) })).filter(x => x.e); }
  function status(data, it) {
    if (it.t === 'manual') return data.manual[it.id] ? { st: 'ok', when: data.manual[it.id] } : { st: 'todo' };
    const L = history(data, it);
    if (it.t === 'time') return { st: 'track', L };
    const i = twoInARow(L.map(x => x.e.pass));
    if (i >= 0) return { st: 'ok', when: L[i].s.start, L };
    return { st: L.length && L[L.length - 1].e.pass ? 'half' : 'todo', L };
  }
  // Le statut d'une variante (un niveau de move, un spot, un côté), même règle des 2 de suite.
  function subStatus(data, it, key) {
    const ok = sorted(data).map(s => entries(s, it.id, key)).filter(e => e.length).map(e => {
      const v = e[e.length - 1].v; return it.t === 'lo' ? v === 0 : v >= it.g; });
    if (twoInARow(ok) >= 0) return 'ok';
    return ok.length && ok[ok.length - 1] ? 'half' : 'todo';
  }
  // Le dernier score connu d'une variante.
  function lastSub(data, it, key) {
    const S = sorted(data);
    for (let i = S.length - 1; i >= 0; i--) { const e = entries(S[i], it.id, key); if (e.length) return e[e.length - 1].v; }
    return null;
  }

  // Moves : le niveau en cours = le premier niveau pas encore validé.
  // En séance : les niveaux validés = 1 série d'entretien, le niveau en cours = la série notée, rien au-dessus.
  // Tout validé : marche + course à chaque séance pour garder.
  function moveLevels(data, it) {
    const st = it.sub.map(([k]) => subStatus(data, it, k));
    const cur = st.findIndex(x => x !== 'ok');
    if (cur < 0) return [{ key: 'walk', role: 'entretien' }, { key: 'run', role: 'entretien' }];
    return it.sub.slice(0, cur + 1).map(([k], i) => ({ key: k, role: i === cur ? 'test' : 'entretien' }));
  }

  // Avancée vers l'objectif, de 0 à 1 (les anneaux de l'accueil). null = item suivi sans objectif.
  function progress(data, it) {
    const S = status(data, it);
    if (S.st === 'ok') return 1;
    if (it.t === 'manual') return 0;
    if (it.t === 'time') return null;
    if (it.t === 'done') return S.L.length && S.L[S.L.length - 1].e.pass ? 0.5 : 0;
    // moves : un tiers par niveau (immobile, marche, course) ; le niveau en cours compte pour ses réussies sur 10
    if (it.t === 'lo') { const lv = it.sub.map(([k]) => subStatus(data, it, k)), cur = lv.findIndex(x => x !== 'ok');
      if (cur < 0) return 1;
      const v = lastSub(data, it, it.sub[cur][0]); return (cur + (v === null ? 0 : (10 - v) / 10)) / it.sub.length; }
    if (it.id === 3) { // 3 points : la moyenne des spots déjà tirés (on n'en tire que 2 sur 5 par séance)
      const v = it.sub.map(([k]) => lastSub(data, it, k)).filter(x => x !== null);
      return v.length ? mean(v.map(x => Math.min(1, x / it.g))) : 0; }
    if (it.sub) return mean(it.sub.map(([k]) => { const v = lastSub(data, it, k); return v === null ? 0 : Math.min(1, v / it.g); }));
    if (!S.L.length) return 0;
    return Math.min(1, S.L[S.L.length - 1].e.val / it.g);
  }

  // L'avancée telle qu'elle était juste après une date (pour les courbes : où j'en étais à chaque séance).
  function progressAt(data, it, t) { return progress(Object.assign({}, data, { sessions: data.sessions.filter(s => s.start <= t) }), it); }
  // Les items travaillés dans une séance A ou B (ceux qui ont un objectif chiffré).
  const TYPE_ITEMS = { A: [1, 2, 3, 9], B: [4, 6, 7, 8, 10] };

  // Les records : le meilleur score d'une variante (ou de l'item), et si une séance en a battu un.
  function best(data, it, key, before) {
    const hi = it.t === 'hi', vals = [];
    sorted(data).forEach(s => { if (before !== undefined && s.start >= before) return;
      entries(s, it.id, key).forEach(e => vals.push(e.v)); });
    if (!vals.length) return null;
    return hi ? Math.max(...vals) : Math.min(...vals);
  }
  function isRecord(data, it, key, s) {
    const prev = best(data, it, key, s.start); if (prev === null) return false; // la 1re fois n'est pas un record
    const e = entries(s, it.id, key); if (!e.length) return false;
    const v = it.t === 'hi' ? Math.max(...e.map(x => x.v)) : Math.min(...e.map(x => x.v));
    return it.t === 'hi' ? v > prev : v < prev;
  }

  // ---------- Le programme ----------
  const dayKey = t => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  function nextType(data) { const S = sorted(data); return S.length && S[S.length - 1].type === 'A' ? 'B' : 'A'; }
  function doneToday(data, now = Date.now()) { return data.sessions.some(s => dayKey(s.start) === dayKey(now)); }
  function daysLeft(now = Date.now()) { return Math.max(0, Math.ceil((GOAL - new Date(now).setHours(0, 0, 0, 0)) / 864e5)); }
  // 3 points : 2 spots parmi 5. Les moins récemment tirés passent d'abord ; entre égaux, tirage au hasard.
  // Le hasard dépend du jour : le brief et la séance qui démarre juste après tombent sur les mêmes spots.
  function pick3pt(data, now = Date.now()) {
    const keys = ITEM(3).sub.map(x => x[0]), last = {};
    keys.forEach(k => last[k] = 0);
    sorted(data).forEach(s => entries(s, 3).forEach(e => { if (e.key in last) last[e.key] = s.start; }));
    let seed = dayKey(now) % 2147483647;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647, r = {};
    keys.forEach(k => r[k] = rnd());
    return keys.slice().sort((a, b) => last[a] - last[b] || r[a] - r[b]).slice(0, 2).sort((a, b) => keys.indexOf(a) - keys.indexOf(b));
  }

  // ---------- La séance en cours (survit à un refresh) ----------
  // Tout est daté en heures absolues : après un refresh ou si iOS tue l'app, on reprend au bon endroit avec le bon temps.
  function startSession(data, type, now = Date.now()) {
    // ws / wt / wp : le temps de l'échauffement en cours, son début, sa pause · rt : le début d'un repos
    data.current = { type, start: now, step: 0, res: [], spots: type === 'A' ? pick3pt(data, now) : [], ws: 0, wt: null, wp: null, rt: null };
    return data.current;
  }
  function record(data, entry) { if (data.current) data.current.res.push(entry); }
  function elapsed(data, now = Date.now()) { return data.current ? now - data.current.start : 0; }
  function finishSession(data, now = Date.now()) {
    const c = data.current; if (!c) return null;
    data.current = null;
    if (!c.res.length) return null; // rien de noté : rien n'est gardé
    const s = { id: c.start, type: c.type, start: c.start, end: now, res: c.res };
    data.sessions.push(s);
    return s;
  }
  function abandon(data) { data.current = null; }

  // ---------- Le déroulé d'une séance (note du vault) ----------
  // L'échauffement : 6 temps ; les minutés s'enchaînent seuls, les autres se valident d'un tap. La défense est dedans.
  const WARM = [
    { k: 'foot', n: 'Petit footing', s: 120, tip: 'tranquille, pour monter en température' },
    { k: 'arms', n: 'Bras et épaules', s: 60, tip: 'cercles de bras, doucement' },
    { k: 'legs', n: 'Chevilles et hanches', s: 60, tip: 'rotations, sans forcer' },
    { k: 'def', n: 'Pas chassés défensifs', s: 60, tip: 'position basse, entre 2 repères (largeur de la raquette)' },
    { k: 'acc', n: '3 accélérations', tip: 'demi-terrain, à 70 %, retour en marchant' },
    { k: 'close', n: '20 tirs près du panier', tip: 'pour régler la mire' },
  ];
  const SEC = { tir: 'Tir', drib: 'Dribble', fin: 'Finition', sprint: 'Sprint', gen: 'Échauffement' };
  // Les étapes d'une séance. Calculées depuis les séances déjà enregistrées (pas la séance en cours) :
  // la liste est donc la même avant et après un refresh.
  function buildSteps(data, c) {
    const S = [{ kind: 'warm', sec: 'Échauffement', f: 'warm', title: 'Échauffement' }];
    const sc = (id, key, title, sub, x) => S.push(Object.assign({ kind: 'score', item: id, key, sec: SEC[ITEM(id).f], f: ITEM(id).f, title, sub, lo: ITEM(id).t === 'lo' }, x || {}));
    const lab = (id, k) => ITEM(id).sub.find(x => x[0] === k)[1];
    if (c.type === 'A') {
      for (let i = 1; i <= 3; i++) sc(1, 'ft', 'Lancers francs', `Série <b>${i}/3</b> · routine : 2 dribbles, souffle, tir`);
      ITEM(2).sub.forEach(([k, l], i) => sc(2, k, 'Mi-distance · ' + l, `Spot <b>${i + 1}/3</b> · entre la raquette et la ligne à 3 points · 10 tirs`));
      c.spots.forEach((k, i) => sc(3, k, '3 points · ' + lab(3, k), `Spot <b>${i + 1}/2</b> · 10 tirs`));
      sc(9, 'd', 'Layup · main droite', '10 layups balle en main · pied de saut <b>gauche</b>');
      sc(9, 'g', 'Layup · main gauche', '10 layups balle en main · pied de saut <b>droit</b>');
    } else {
      for (let i = 1; i <= 4; i++) S.push({ kind: 'chrono', item: 5, key: 'slalom', sec: 'Dribble', f: 'drib', title: 'Slalom main faible', n: i,
        sub: `Aller-retour <b>${i}/4</b> · 5 bouteilles, sans regarder le ballon` });
      [6, 7, 8].forEach(id => moveLevels(data, ITEM(id)).forEach(l => sc(id, l.key, ITEM(id).n, (l.role === 'test'
        ? `<b>${cap(lab(id, l.key))}</b> · niveau en cours · 10 répétitions, tête haute`
        : `<b>${cap(lab(id, l.key))}</b> · entretien · 10 répétitions`), { role: l.role })));
      sc(10, 'd', 'Layup vitesse · main droite', '2-3 dribbles depuis la ligne à 3 points, puis 2 pas · pied de saut <b>gauche</b>');
      sc(10, 'g', 'Layup vitesse · main gauche', '2-3 dribbles depuis la ligne à 3 points, puis 2 pas · pied de saut <b>droit</b>');
      sc(4, 'js', 'Jump stop + tir', '2-3 dribbles, arrêt à deux pieds (un seul « toc »), tir · 10 tirs');
      for (let i = 1; i <= 3; i++) {
        S.push({ kind: 'chrono', sprint: true, sec: 'Sprint', f: 'sprint', title: 'Sprint ' + i + ' / 3', n: i });
        if (i < 3) S.push({ kind: 'rest', s: 90, sec: 'Sprint', f: 'sprint', title: 'Repos', sub: 'Récupère, le sprint suivant arrive.' });
      }
    }
    S.push({ kind: 'end' });
    return S;
  }
  const cap = s => s[0].toUpperCase() + s.slice(1);
  // Revenir d'une étape : on enlève ce qui a été noté à cette étape et après.
  function stepBack(data) {
    const c = data.current; if (!c || !c.step) return false;
    c.step--; c.res = c.res.filter(r => r.s === undefined || r.s < c.step); c.ws = 0; c.wt = null; c.rt = null;
    return true;
  }

  // ---------- Export / import ----------
  function exportJSON(data, now = Date.now()) {
    return JSON.stringify({ app: 'basket', v: 2, exported: new Date(now).toISOString(), sessions: data.sessions, manual: data.manual, settings: data.settings });
  }
  function importJSON(data, txt) {
    const d = JSON.parse(txt);
    if (d.app !== 'basket' || d.v !== 2 || !Array.isArray(d.sessions)) throw new Error('format');
    data.sessions = d.sessions; data.manual = d.manual || {}; data.settings = Object.assign(blank().settings, d.settings || {});
    return data.sessions.length;
  }

  const B = { KEY, GOAL, START, TOTAL, ITEMS, ITEM, LIST12, MOVES, blank, load, save, sorted, entries, evalItem, history, status, subStatus,
    lastSub, moveLevels, progress, best, isRecord, nextType, doneToday, daysLeft, pick3pt, startSession, record, elapsed,
    finishSession, abandon, exportJSON, importJSON, dayKey, WARM, buildSteps, stepBack, progressAt, TYPE_ITEMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = B; else root.B = B;
})(typeof window !== 'undefined' ? window : globalThis);
