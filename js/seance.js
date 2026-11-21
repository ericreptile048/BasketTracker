'use strict';
// La séance guidée : brief, échauffement, scores (colonne de 10 ronds), dribble par niveaux, chronos, repos, bilan.
// Tout ce qui compte est sauvé à chaque action dans data.current : un refresh ou iOS qui tue l'app reprend au bon endroit.
(function () {
  const { $, COL, ICON, f1, toast } = UI;
  let A = null;            // { data, save, go } fourni par app.js
  let pend = 'A';          // la séance du brief (avant « C'est parti »)
  let T = [];              // minuteurs de l'écran courant
  const clean = () => { T.forEach(t => { clearInterval(t); clearTimeout(t); }); T = []; document.querySelectorAll('.stop,.goflash,.qsheet,.qback').forEach(e => e.remove()); };
  const D = () => A.data;
  const X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const CHK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  // ---------- son et écran allumé ----------
  let ac = null;
  function initAudio() {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state !== 'running') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(); g.gain.value = 0; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .01); } catch (e) {}
  }
  function snd(f, d = .1, v = .25, type = 'triangle') {
    if (!ac || !D().settings.sound) return;
    try { if (ac.state !== 'running') ac.resume(); const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (e) {}
  }
  const BIP = { tick: () => snd(440, .06, .15), count: () => snd(880, .15, .3, 'square'), go: () => snd(1320, .6, .35, 'square'), end: () => snd(660, .5, .3, 'square'), ok: () => snd(990, .25, .25) };
  let wl = null;
  async function wake() { if (!D().settings.wake || !('wakeLock' in navigator)) return; try { wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
  function unwake() { try { wl && wl.release(); } catch (e) {} wl = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && A && D().current) { wake(); if (ac) ac.resume(); } });

  // compteur de temps de la séance : calculé depuis l'heure de début sauvegardée
  setInterval(() => { const e = document.getElementById('sel'); if (e && D().current) e.textContent = '⏱ ' + mmss(Math.floor(B.elapsed(D()) / 1000)); }, 1000);

  // ---------- en-tête : segments façon stories + halo de couleur ----------
  function head(st, idx, n, color) {
    const segs = Array.from({ length: n }, (_, i) => `<i class="${i < idx ? 'd' : i === idx ? 'c' : ''}"></i>`).join('');
    const el = D().current ? `<span class="el" id="sel">⏱ ${mmss(Math.floor(B.elapsed(D()) / 1000))}</span>` : '';
    return `<div class="sh" style="--sc:${color}"><div class="prog">${segs}</div><div class="row"><span class="pill3"><i></i>${st.sec}${D().current ? ` · ${idx + 1}/${n}` : ''}</span>${el}
      <button class="x2" data-sact="${D().current ? 'quit' : 'close'}" aria-label="Quitter">${X}</button></div><div class="ttl">${st.title}</div></div>`;
  }
  const colOf = st => COL[st.f] || COL.brief;

  // ---------- 1. Brief (rien ne démarre avant « C'est parti ») ----------
  function brief(type) {
    const d = D(), fake = { type, spots: type === 'A' ? B.pick3pt(d) : [] }, S = B.buildSteps(d, fake);
    // un bloc par exercice, avec son record exact (seuls les chiffres en vert)
    const blocks = []; S.forEach(s => { if (!s.item || blocks.find(b => b.item === s.item)) return; blocks.push({ item: s.item, f: s.f, n: S.filter(x => x.item === s.item).length }); });
    if (type === 'B') blocks.push({ sprint: true, f: 'sprint', n: 3 });
    const recTxt = b => {
      if (b.sprint) { const h = B.best(d, B.ITEM(13), 'half'), fu = B.best(d, B.ITEM(14), 'full');
        return h === null && fu === null ? 'pas encore de record' : [h !== null ? `½ terrain <em>${f1(h)} s</em>` : '', fu !== null ? `entier <em>${f1(fu)} s</em>` : ''].filter(Boolean).join(' · '); }
      const it = B.ITEM(b.item);
      if (it.t === 'time') { const v = B.best(d, it, it.key); return v === null ? 'pas encore de record' : `record <em>${f1(v)} s</em>`; }
      if (it.sub) { const keys = S.filter(x => x.item === b.item).map(x => x.key); const parts = [...new Set(keys)].map(k => {
          const v = B.best(d, it, k); if (v === null) return null; const l = it.sub.find(x => x[0] === k)[1];
          return it.t === 'lo' ? `<span class="lvi">${ICON[k]}<em>${v}/10</em></span>` : `${l} <em>${v}</em>`; }).filter(Boolean);
        return parts.length ? (it.t === 'lo' ? 'record ' + parts.join('') : 'record ' + parts.join(' · ')) : 'pas encore de record'; }
      const v = B.best(d, it); return v === null ? 'pas encore de record' : `record <em>${v}/10</em>`;
    };
    const qty = b => b.sprint ? '3 × aller-retour' : b.item === 5 ? '3 × 3 allers-retours' : b.item === 15 ? '1 × 3 allers-retours' : b.item === 1 ? '3 × 10' : b.item === 3 ? '2 spots × 10'
      : b.item === 2 ? '3 spots × 10' : [9, 10].includes(b.item) ? '10 + 10' : B.ITEM(b.item).t === 'lo' ? `${b.n} série${b.n > 1 ? 's' : ''}` : '10 tirs';
    const name = b => b.sprint ? 'Sprints' : B.ITEM(b.item).n;
    return `<div class="screen">${head({ sec: 'Séance ' + type, title: type === 'A' ? 'Tir et finition' : 'Dribble, finition, sprint' }, 0, 1, COL.brief)}
      <p class="sub">~40 min · ${blocks.length} exercices${type === B.nextType(d) ? ' · <b>la prochaine de l\'alternance</b>' : ''}</p>
      <div class="warm"><h4>Échauffement <span>~10 min</span></h4><ul>${B.WARM.map(w => `<li>${w.n}</li>`).join('')}</ul></div>
      <div class="steps">${blocks.map((b, i) => `<div class="st" style="--c:${COL[b.f]};animation-delay:${i * 60}ms"><i></i><div><b>${name(b)}</b><small>${recTxt(b)}</small></div><span>${qty(b)}</span></div>`).join('')}</div>
      <div class="cta"><button class="big-btn" style="--sc:${COL.brief}" data-sact="start" data-t="${type}"><span>C'est parti</span></button>
      <button class="big-btn ghost" data-sact="swap" style="margin-top:10px">Faire plutôt la séance ${type === 'A' ? 'B' : 'A'}</button></div></div>`;
  }

  // ---------- les étapes ----------
  const steps = () => B.buildSteps(D(), D().current);
  function show() {
    clean(); window.scrollTo(0, 0); result.on = false;
    const c = D().current, v = $('#view');
    if (!c) { v.innerHTML = brief(pend); return; }
    const S = steps(), st = S[c.step];
    if (!st || st.kind === 'end') return finish();
    const n = S.length - 1;
    v.innerHTML = ({ warm: vWarm, score: vScore, chrono: vChrono, rest: vRest })[st.kind](st, c.step, n);
    ({ warm: mWarm, score: mScore, chrono: mChrono, rest: mRest })[st.kind](st);
  }
  function next() { const c = D().current; c.step++; c.ws = 0; c.wt = null; c.wp = null; c.rt = null; A.save(); show(); }

  // ---------- 2. Échauffement : anneau qui se vide, liste qui se coche ----------
  function vWarm(st, idx, n) {
    return `<div class="screen" style="--sc:${COL.warm}">${head(st, idx, n, COL.warm)}
      <div class="ringbox" id="rb"><svg viewBox="0 0 260 260"><circle class="tr" cx="130" cy="130" r="118"/><circle class="ar" id="ar" cx="130" cy="130" r="118"/></svg>
      <div><div class="t" id="tt"></div><div class="tl" id="tl"></div></div></div>
      <div class="wl" id="wl"></div>
      <div class="ctrl"><button class="big-btn ghost" data-sact="wpause" id="wp">Pause</button><button class="big-btn ghost" data-sact="wnext" id="wn">Passer →</button></div></div>`;
  }
  function mWarm() {
    const c = D().current, W = B.WARM, R = 118, C = 2 * Math.PI * R, ar = $('#ar'); ar.style.strokeDasharray = C;
    if (!(c.ws >= 0)) c.ws = 0;
    let lastS = null;
    const paintList = () => { $('#wl').innerHTML = W.map((w, i) => `<div class="${i < c.ws ? 'done' : i === c.ws ? 'cur' : ''}"><span class="ck">${i < c.ws ? CHK : ''}</span>${w.n}${w.s ? ` <small>${w.s / 60} min</small>` : ''}</div>`).join(''); };
    const enter = () => { // début d'un temps de l'échauffement
      const w = W[c.ws]; paintList(); $('#tl').textContent = w.tip; lastS = null;
      if (w.s && !c.wt && !c.wp) { c.wt = Date.now(); A.save(); }
      $('#wn').textContent = w.s ? 'Passer →' : 'Fait ✓'; $('#wn').classList.toggle('okb', !w.s); $('#wp').style.visibility = w.s ? '' : 'hidden';
      if (!w.s) { $('#tt').innerHTML = '<span class="tap">à toi</span>'; ar.style.strokeDashoffset = 0; }
    };
    const tick = () => {
      const w = W[c.ws]; if (!w || !w.s) return;
      const used = c.wp != null ? c.wp : Date.now() - c.wt, left = Math.max(0, w.s * 1000 - used), s = Math.ceil(left / 1000);
      ar.style.strokeDashoffset = C * (1 - left / (w.s * 1000));
      if (s !== lastS) { lastS = s; $('#tt').textContent = mmss(s); if (s <= 3 && s > 0 && c.wp == null) { BIP.count(); beat('#rb'); } }
      if (left <= 0 && c.wp == null) advance();
    };
    const advance = () => {
      const w = W[c.ws]; if (w.k === 'def' && !c.res.some(r => r.item === 11)) B.record(D(), { item: 11, key: 'def', v: 1, s: D().current.step }); // la défense est faite
      BIP.end(); c.ws++; c.wt = null; c.wp = null; A.save();
      if (c.ws >= W.length) return next();
      enter();
    };
    mWarm.advance = advance;
    enter(); tick(); T.push(setInterval(tick, 200));
  }

  // ---------- mini-carte : un demi-terrain vu de haut, le panier en haut, l'endroit où se placer qui pulse ----------
  // échelle : 20 px = 1 m. Panier à 1,575 m de la ligne de fond, raquette 4,9 m × 5,8 m, ligne à 3 points à 6,75 m (6,6 m dans les corners).
  const SPOT = {
    '1/ft': { p: [150, 116], l: 'ligne des lancers francs' },
    // mi-distance : entre la raquette et la ligne à 3 points (~5,5 m), pour ne pas se confondre avec le lancer franc
    '2/face': { p: [150, 134], l: 'face' }, '2/g': { p: [80, 104], l: '45° gauche' }, '2/d': { p: [220, 104], l: '45° droite' },
    // 3 points : 5 positions juste derrière la ligne (corners, 45°, face)
    '3/cg': { p: [9, 18], l: 'corner gauche' }, '3/ag': { p: [46, 136], l: '45° gauche' }, '3/face': { p: [150, 178], l: 'face' },
    '3/ad': { p: [254, 136], l: '45° droite' }, '3/cd': { p: [291, 18], l: 'corner droit' },
    '4/js': { path: 'M150 178 L150 112', p: [150, 112], l: 'dribble, arrêt, tir' },
    '9/d': { path: 'M236 112 Q214 64 162 38', p: [236, 112], l: 'côté droit, 2 pas' }, '9/g': { path: 'M64 112 Q86 64 138 38', p: [64, 112], l: 'côté gauche, 2 pas' },
    '10/d': { path: 'M258 172 Q236 96 162 38', p: [258, 172], l: 'depuis la ligne à 3 points' }, '10/g': { path: 'M42 172 Q64 96 138 38', p: [42, 172], l: 'depuis la ligne à 3 points' },
  };
  // Jump stop : il sert partout, pas seulement aux lancers. Même distance du panier que la ligne des lancers (80 px = 4 m),
  // direction au hasard (de −75° à +75° autour de l'axe), départ 3,3 m plus loin sur la même ligne.
  // Le hasard dépend du début de la séance : un refresh garde la même position.
  function jumpSpot() {
    const c = D().current, seed = c ? c.start : Math.floor(Date.now() / 864e5);
    const r = (Math.sin(seed % 100000 * 12.9898) * 43758.5453) % 1, a = (Math.abs(r) * 150 - 75) * Math.PI / 180;
    const pt = d => [150 + d * Math.sin(a), 32 + d * Math.cos(a)].map(x => Math.round(x));
    const [x1, y1] = pt(146), [x2, y2] = pt(80);
    return { path: `M${x1} ${y1} L${x2} ${y2}`, p: [x2, y2], l: 'dribble, arrêt, tir', ball: true };
  }
  function courtMap(st) {
    const s = st.item === 4 ? jumpSpot() : SPOT[st.item + '/' + st.key]; if (!s) return '';
    const L = 'stroke="var(--mut)" stroke-width="2.5" fill="none"';
    // un vrai demi-terrain (15 m × 14 m) : carré, sans fond, juste les lignes et l'indicateur
    return `<svg class="map" viewBox="-4 -4 308 292" aria-label="${s.l}">
      <rect x="0" y="0" width="300" height="280" rx="3" ${L}/><path d="M114 280a36 36 0 0 1 72 0" ${L}/>
      <rect x="101" y="0" width="98" height="116" ${L}/><path d="M114 116a36 36 0 0 0 72 0" ${L}/><path d="M114 116a36 36 0 0 1 72 0" ${L} stroke-dasharray="6 6"/>
      <path d="M18 0V60A135 135 0 0 0 282 60V0" ${L}/><path d="M136 24h28" stroke="var(--sx)" stroke-width="3.5"/><circle cx="150" cy="32" r="8" stroke="var(--ball)" stroke-width="3" fill="none"/>
      ${s.path ? `<path class="mpath" d="${s.path}" stroke="var(--sc)" stroke-width="4" stroke-linecap="round" fill="none" stroke-dasharray="7 7"/>` : ''}
      <circle class="mping" cx="${s.p[0]}" cy="${s.p[1]}" r="12" fill="var(--sc)"/><circle cx="${s.p[0]}" cy="${s.p[1]}" r="11" fill="var(--sc)" stroke="var(--bg)" stroke-width="3"/>
      ${s.ball ? `<circle r="7" fill="var(--ball)" stroke="var(--bg)" stroke-width="2"><animateMotion dur="1.8s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.7;1" calcMode="linear" path="${s.path}"/></circle>` : ''}
    </svg>`;
  }

  // ---------- 3. Score : colonne de 10 ronds, de haut en bas ----------
  // Moves : on saisit et on enregistre les réussis sur 10 (les ronds touchés = les répétitions sans perte), comme partout ailleurs.
  let SC = null;
  // le record affiché pendant l'exo : celui des séances enregistrées, ou celui de la séance en cours s'il est meilleur
  const recBadge = (r, fmt) => r.v === null ? 'pas encore de record'
    : r.live ? `record provisoire : ${fmt(r.v)} <i class="prov">cette séance</i>` : `record : ${fmt(r.v)}`;
  function vScore(st, idx, n) {
    const it = B.ITEM(st.item), lo = st.lo, rec = B.liveBest(D(), it, st.key), col = colOf(st), map = courtMap(st);
    const recTxt = recBadge(rec, v => `${f1(v)}/10${lo ? ' réussis' : ''}`);
    const icon = lo ? `<span class="lvbig">${ICON[st.key]}</span>` : '';
    return `<div class="screen" style="--sc:${col}">${head(st, idx, n, col)}
      <p class="sub">${icon}${st.sub}</p>
      <div class="scorewrap ${map ? 'withmap' : ''}"><div class="score">${map ? `<div class="mapbox">${map}</div>` : ''}<div class="n" id="sn"><span class="q">?</span><small>/10</small></div>
        <div class="lbl" id="sl">${lo ? 'Combien de réussis sans perte ?' : 'Touche le rond de ton score'}</div><span class="best ${rec.live ? 'live' : ''}">${recTxt}</span>
        <div><button class="zero ${lo ? 'good' : ''}" data-sact="zero">${lo ? '10/10, 0 perte ✓' : '0 panier'}</button></div></div>
        <div class="col" id="col">${Array.from({ length: 10 }, (_, i) => `<div class="r" data-n="${i + 1}">${i + 1}</div>`).join('')}</div></div>
      <div class="cta"><button class="big-btn" id="val" style="opacity:.35"><div class="fill" id="fill"></div><span id="vl">Valider</span></button></div></div>`;
  }
  function mScore(st) {
    SC = null; const col = $('#col');
    const pick = e => { const el = document.elementFromPoint(e.clientX, e.clientY), r = el && el.closest('.r'); if (r && +r.dataset.n !== SC) setScore(st, +r.dataset.n); };
    col.addEventListener('pointerdown', e => { initAudio(); col.setPointerCapture(e.pointerId); pick(e); });
    col.addEventListener('pointermove', e => { if (e.buttons) pick(e); });
    mScore.set = () => setScore(st, st.lo ? 10 : 0); // le bouton : 10/10 sans perte (moves) ou 0 panier
  }
  // n = les ronds touchés : des paniers (tirs) ou des réussis (moves)
  function setScore(st, n) {
    const old = SC || 0, it = B.ITEM(st.item), lo = st.lo; SC = n;
    document.querySelectorAll('.r').forEach((r, i) => { const on = i < n; r.classList.toggle('on', on);
      if (on && i >= old) { r.style.animationDelay = ((i - old) * 28) + 'ms'; r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); } });
    const good = n >= it.g, loss = 10 - n;
    $('#sn').innerHTML = n + '<small>/10</small>'; $('#sn').style.color = good ? 'var(--ok)' : '';
    $('#sl').textContent = good ? (lo ? 'Parfait, 0 perte ✓' : 'Test réussi ✓') : (lo ? `${loss} perte${loss > 1 ? 's' : ''} · objectif 10/10` : `Objectif : ${it.g}/10`);
    // le bouton se remplit en 1,5 s puis valide tout seul ; retoucher la colonne relance
    T.forEach(t => clearTimeout(t)); T = [];
    if (n > old) for (let k = old; k < n; k++) T.push(setTimeout(() => snd(420 + k * 55, .09, .18), (k - old) * 28));
    const b = $('#val'), f = $('#fill'); b.style.opacity = 1;
    f.style.transition = 'none'; f.style.width = '0'; void f.offsetWidth; f.style.transition = 'width 1.5s linear'; f.style.width = '100%';
    $('#vl').textContent = `Valider ${n}/10 · auto`;
    b.onclick = () => commit(st, n);
    T.push(setTimeout(() => commit(st, n), 1500));
  }
  function commit(st, n) {
    T.forEach(t => clearTimeout(t)); T = [];
    B.record(D(), { item: st.item, key: st.key, v: n, s: D().current.step }); BIP.ok(); // tirs : paniers · moves : réussis
    $('#vl').textContent = 'Enregistré ✓';
    const rs = [...document.querySelectorAll('.r.on')]; rs.forEach((r, i) => { r.classList.remove('wave', 'pop'); r.style.animationDelay = (i * 45) + 'ms'; void r.offsetWidth; r.classList.add('wave'); });
    setTimeout(next, 650);
  }

  // ---------- 4. Chrono : slalom et sprints (le téléphone reste au départ, tout est en aller-retour) ----------
  const DIST = { half: { n: 'Demi-terrain', m: 28, to: 'la ligne du milieu', item: 13 }, full: { n: 'Terrain entier', m: 56, to: 'la ligne de fond opposée', item: 14 } };
  function vChrono(st, idx, n) {
    const col = colOf(st), d = D();
    let top = '';
    if (st.sprint) {
      const k = d.settings.dist, ds = DIST[k], it = B.ITEM(ds.item), rec = B.liveBest(d, it, k), last = B.liveLast(d, it, k);
      // les sprints déjà courus dans cette séance, chacun avec sa distance (demi et entier ne se mélangent pas)
      const done = d.current ? d.current.res.filter(r => r.item === 13 || r.item === 14) : [];
      const doneTxt = done.length ? `<p class="sdone">Cette séance : ${done.map(r => `${r.key === 'half' ? '½' : 'entier'} <b>${f1(r.v)} s</b>`).join(' · ')}</p>` : '';
      top = `<p class="sub">Le téléphone reste <b>sur la ligne de fond</b>. GO : tu cours jusqu'à <b>${ds.to}</b>, tu reviens, tu tapes <b>STOP</b>.</p>
        <div class="dseg" id="dseg"><div class="pill" style="transform:translateX(${k === 'full' ? 100 : 0}%)"></div>${Object.entries(DIST).map(([kk, x]) =>
          `<button data-sact="dist" data-k="${kk}" class="${kk === k ? 'on' : ''}"><b>${x.n}</b><small>aller-retour · ~${x.m} m</small></button>`).join('')}</div>
        <div class="tagline"><span class="${rec.live ? 'live' : ''}">${rec.live ? 'record provisoire' : 'record'}<b>${rec.v === null ? '—' : f1(rec.v) + ' s'}</b></span><span>dernier<b>${last === null ? '—' : f1(last) + ' s'}</b></span>
        <span>vitesse<b>${rec.v === null ? '—' : f1(ds.m / rec.v * 3.6) + ' km/h'}</b></span></div>${doneTxt}`;
    } else {
      // slalom : main droite (temps seul) ou main gauche (temps + pertes)
      const rec = B.liveBest(d, B.ITEM(st.item), st.key), left = st.key === 'gauche';
      top = `<p class="sub">${st.sub}. Pose le téléphone <b>au départ</b> : tu reviens taper STOP.</p>
        <div class="tagline"><span class="${rec.live ? 'live' : ''}">${rec.live ? 'record provisoire' : 'record'}<b>${rec.v === null ? '—' : f1(rec.v) + ' s'}</b></span><span>main<b>${left ? 'gauche' : 'droite'}</b></span><span>${left ? 'pertes<b>notées après</b>' : 'pertes<b>non notées</b>'}</span></div>`;
    }
    return `<div class="screen" style="--sc:${col}">${head(st, idx, n, col)}${top}
      <div class="ringbox sm" id="crb"><svg viewBox="0 0 260 260"><circle class="tr" cx="130" cy="130" r="118"/><circle class="ar" id="car" cx="130" cy="130" r="118"/></svg>
      <div><div class="t" id="ct">GO</div><div class="tl" id="cl">prêt quand tu l'es</div></div></div>
      <div class="cta"><button class="big-btn" data-sact="launch" id="lch"><span>Lancer</span></button></div></div>`;
  }
  function mChrono() {}
  function launch() {
    initAudio(); const st = steps()[D().current.step];
    $('#lch').style.opacity = .35; $('#lch').disabled = true; const ds = $('#dseg'); if (ds) { ds.style.pointerEvents = 'none'; ds.style.opacity = .5; }
    const R = 118, C = 2 * Math.PI * R, ar = $('#car'); ar.style.strokeDasharray = C; ar.style.strokeDashoffset = 0;
    let s = 5; // 5 s en tout : 5-4 en place, 3-2-1 prêt, GO
    const tick = () => {
      if (s > 0) { $('#ct').textContent = s; $('#cl').textContent = s > 3 ? 'en place…' : 'prêt'; if (s > 3) BIP.tick(); else { BIP.count(); beat('#crb'); } }
      ar.style.strokeDashoffset = C * (1 - s / 5);
      if (s === 0) return go(st);
      s--; T.push(setTimeout(tick, 1000));
    };
    tick();
  }
  function go(st) {
    BIP.go();
    const f = document.createElement('div'); f.className = 'goflash'; f.textContent = 'GO'; document.body.appendChild(f);
    const t0 = performance.now();
    const sp = document.createElement('div'); sp.className = 'stop'; sp.innerHTML = '<div class="tm" id="stm">0,00</div><div class="lb">STOP</div><div class="hint">touche n\'importe où</div>';
    T.push(setTimeout(() => { document.body.appendChild(sp); f.remove(); }, 450));
    const it = setInterval(() => { const e = document.getElementById('stm'); if (e) e.textContent = ((performance.now() - t0) / 1000).toFixed(2).replace('.', ','); }, 33); T.push(it);
    sp.addEventListener('pointerdown', e => {
      e.preventDefault(); const ms = performance.now() - t0; if (ms < 800) return; // anti double-tap
      clearInterval(it); BIP.ok(); sp.remove(); result(st, Math.round(ms) / 1000);
    });
  }
  function result(st, v) {
    const idx = D().current.step, n = steps().length - 1, col = colOf(st);
    let info = '', loss = '';
    // comparé au record provisoire : les séries déjà courues dans la séance comptent
    const recInfo = (r, v) => r.v === null ? 'premier chrono' : `${r.live ? 'record provisoire' : 'record'} ${f1(r.v)} s${v < r.v ? ' · <b class="gold">🏆 nouveau record provisoire</b>' : ''}`;
    if (st.sprint) { const k = D().settings.dist, ds = DIST[k], rec = B.liveBest(D(), B.ITEM(ds.item), k);
      info = `${ds.n} · <b>${f1(ds.m / v * 3.6)} km/h</b> · ${recInfo(rec, v)}`; }
    else { const rec = B.liveBest(D(), B.ITEM(st.item), st.key); info = recInfo(rec, v);
      // main gauche : les pertes de balle sur les 3 allers-retours (0 à 10+)
      if (st.key === 'gauche') loss = `<p class="lbl2">Pertes de balle ?</p><div class="losses">${Array.from({ length: 11 }, (_, i) => `<button data-sact="loss" data-v="${i}" class="${i === 0 ? 'good' : ''}">${i}${i === 10 ? '+' : ''}</button>`).join('')}</div>`; }
    const auto = !loss; // sprint et main droite : rien à noter, on continue tout seul
    $('#view').innerHTML = `<div class="screen" style="--sc:${col}">${head(st, idx, n, col)}
      <div class="res"><div class="ck"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <div class="tm">${v.toFixed(2).replace('.', ',')} s</div><p class="sub">${info}</p></div>${loss}
      <div class="cta">${auto ? '<button class="big-btn" id="val"><div class="fill" id="fill"></div><span id="vl">Continuer · auto</span></button>' : ''}</div></div>`;
    result.v = v; result.st = st; result.on = true; // « Refaire (faux départ) » passe par la croix
    if (auto) { const f = $('#fill'); void f.offsetWidth; f.style.transition = 'width 3s linear'; f.style.width = '100%';
      const done = () => saveChrono(st, v); $('#val').onclick = done; T.push(setTimeout(done, 3000)); }
  }
  function saveChrono(st, v, loss) {
    T.forEach(t => clearTimeout(t)); T = [];
    if (st.sprint) { const k = D().settings.dist; B.record(D(), { item: DIST[k].item, key: k, v, s: D().current.step }); }
    else B.record(D(), Object.assign({ item: st.item, key: st.key, v, s: D().current.step }, loss === undefined ? {} : { loss }));
    next();
  }

  // ---------- 5. Repos entre deux sprints ----------
  function vRest(st, idx, n) {
    return `<div class="screen" style="--sc:${COL.sprint}">${head(st, idx, n, COL.sprint)}<p class="sub">${st.sub}</p>
      <div class="ringbox" id="rb"><svg viewBox="0 0 260 260"><circle class="tr" cx="130" cy="130" r="118"/><circle class="ar" id="ar" cx="130" cy="130" r="118"/></svg>
      <div><div class="t" id="tt"></div><div class="tl">de repos</div></div></div>
      <div class="ctrl one"><button class="big-btn ghost" data-sact="skip">Passer →</button></div></div>`;
  }
  function mRest(st) {
    const c = D().current; if (!c.rt) { c.rt = Date.now(); A.save(); }
    const C = 2 * Math.PI * 118, ar = $('#ar'); ar.style.strokeDasharray = C; let lastS = null;
    const tick = () => { const left = Math.max(0, st.s * 1000 - (Date.now() - c.rt)), s = Math.ceil(left / 1000);
      ar.style.strokeDashoffset = C * (1 - left / (st.s * 1000));
      if (s !== lastS) { lastS = s; $('#tt').textContent = mmss(s); if (s <= 3 && s > 0) { BIP.count(); beat('#rb'); } }
      if (left <= 0) { BIP.end(); next(); } };
    tick(); T.push(setInterval(tick, 200));
  }

  // ---------- 6. Fin : bilan, records, items validés ----------
  function finish() {
    clean(); unwake();
    const d = D(), before = B.LIST12.map(it => B.status(d, it).st);
    const s = B.finishSession(d); A.save();
    if (!s) { A.go('home'); return; }
    const gained = B.LIST12.filter((it, i) => before[i] !== 'ok' && B.status(d, it).st === 'ok');
    const recs = []; const seen = new Set();
    s.res.forEach(r => { const k = r.item + '/' + r.key; if (seen.has(k)) return; seen.add(k); const it = B.ITEM(r.item);
      if (it.t !== 'done' && B.isRecord(d, it, r.key, s)) recs.push({ it, r }); });
    const min = Math.round((s.end - s.start) / 60000);
    $('#view').innerHTML = `<div class="screen fin" style="--sc:var(--ok)"><div class="halo" style="--hc:var(--ok)"></div>
      <div class="res"><div class="ck big"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <div class="ttl">Séance ${s.type} faite</div><p class="sub">${min} min · ${s.res.length} score${s.res.length > 1 ? 's' : ''} noté${s.res.length > 1 ? 's' : ''}</p></div>
      ${gained.length ? `<div class="won">${gained.map(it => `<div><span>✓</span><b>${it.n}</b><small>validé !</small></div>`).join('')}</div>` : ''}
      ${recs.length ? `<div class="recs"><h4>🏆 ${recs.length} record${recs.length > 1 ? 's' : ''}</h4>${recs.map(({ it, r }) => `<div><span>${it.n}${it.sub ? ' · ' + it.sub.find(x => x[0] === r.key)[1] : ''}</span><b>${it.t === 'time' ? f1(B.best(d, it, r.key)) + ' s' : B.best(d, it, r.key) + '/10' + (it.t === 'lo' ? ' réussis' : '')}</b></div>`).join('')}</div>`
        : '<p class="sub" style="text-align:center">Pas de record cette fois. La régularité, c\'est ça qui valide.</p>'}
      ${typeChart(d, s.type)}
      <div class="cta"><button class="big-btn" data-go="home"><span>Accueil</span></button></div></div>`;
    UI.setBar('seance', 'var(--ok)', true);
  }
  // Le mini-graphe du bilan : l'avancée (% de l'objectif) de chaque exercice de la séance A ou B, séance après séance.
  function typeChart(d, type) {
    const S = B.sorted(d).filter(s => s.type === type).slice(-8); if (S.length < 2) return '';
    const shade = (c, k) => k ? `color-mix(in srgb,${c} ${100 - k * 28}%,#fff)` : c, cnt = {};
    const ser = B.TYPE_ITEMS[type].map(id => { const it = B.ITEM(id), k = cnt[it.f] = (cnt[it.f] ?? -1) + 1;
      return { it, c: shade(COL[it.f], k), v: S.map(s => Math.round(B.progressAt(d, it, s.start) * 100)) }; });
    const W = 330, H = 150, pl = 30, pr = 12, pt = 12, pb = 20, n = S.length;
    const X = i => pl + i * (W - pl - pr) / (n - 1), Y = p => pt + (100 - p) / 100 * (H - pt - pb);
    let g = `<line x1="${pl}" y1="${Y(100)}" x2="${W - pr}" y2="${Y(100)}" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="5 5"/>
      <text x="${W - pr}" y="${Y(100) - 4}" font-size="10.5" fill="var(--ok)" text-anchor="end" font-weight="600">objectif</text>`;
    [0, 50].forEach(p => g += `<line x1="${pl}" y1="${Y(p)}" x2="${W - pr}" y2="${Y(p)}" stroke="var(--line)"/><text x="${pl - 6}" y="${Y(p) + 4}" font-size="10.5" fill="var(--mut)" text-anchor="end">${p}%</text>`);
    ser.forEach((s, k) => { g += `<path class="cl" style="animation-delay:${k * .12}s" stroke="${s.c}" d="${s.v.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p).toFixed(1)).join(' ')}"/>
      <circle class="cp" style="animation-delay:${.9 + k * .12}s" cx="${X(n - 1)}" cy="${Y(s.v[n - 1])}" r="4.5" fill="${s.c}" stroke="var(--card)" stroke-width="2"/>`; });
    const fd = t => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    [0, n - 1].forEach(i => g += `<text x="${X(i)}" y="${H - 4}" font-size="10.5" fill="var(--mut)" text-anchor="${i ? 'end' : 'start'}">${fd(S[i].start)}</text>`);
    return `<div class="tchart"><h4>Séance ${type} · tes ${n} dernières</h4><svg viewBox="0 0 ${W} ${H}">${g}</svg>
      <div class="chips">${ser.map(s => `<span class="chip"><i style="background:${s.c}"></i>${s.it.short} <b>${s.v[n - 1]}%</b></span>`).join('')}</div></div>`;
  }

  // ---------- quitter ----------
  function quit() {
    const bk = document.createElement('div'); bk.className = 'qback'; const sh = document.createElement('div'); sh.className = 'qsheet';
    // tout s'arrête pendant que la feuille est ouverte (rien ne se valide dessous)
    T.forEach(t => { clearInterval(t); clearTimeout(t); }); T = [];
    const c = D().current, extra = result.on ? '<button class="big-btn ghost" data-sact="redo">↺ Refaire le chrono (faux départ)</button>'
      : c && c.step > 0 ? '<button class="big-btn ghost" data-sact="back">← Revenir à l\'étape précédente</button>' : '';
    sh.innerHTML = `<div class="grab"></div><h3>Pause</h3><p>Ce qui est noté reste gardé tant que tu n'abandonnes pas.</p>${extra}
      <button class="big-btn" data-sact="qfinish"><span>Terminer et enregistrer</span></button>
      <button class="big-btn ghost" data-sact="qlater">Reprendre plus tard</button>
      <button class="big-btn ghost danger" data-sact="qdrop">Abandonner (rien n'est gardé)</button>
      <button class="big-btn ghost" data-sact="qclose">Continuer la séance</button>`;
    document.body.append(bk, sh); requestAnimationFrame(() => { bk.classList.add('on'); sh.classList.add('on'); });
    bk.onclick = () => { closeQuit(); if (!result.on) show(); };
  }
  function closeQuit() { document.querySelectorAll('.qsheet,.qback').forEach(e => e.remove()); }
  function beat(sel) { const b = $(sel); if (!b) return; b.classList.remove('beat'); void b.offsetWidth; b.classList.add('beat'); }

  // ---------- actions ----------
  let dropArmed = 0;
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-sact]'); if (!a || !A) return;
    const c = D().current, k = a.dataset.sact;
    switch (k) {
      case 'start': initAudio(); B.startSession(D(), a.dataset.t); A.save(); wake(); return show();
      case 'swap': pend = pend === 'A' ? 'B' : 'A'; return show();
      case 'close': return A.go('home');
      case 'wpause': { const w = B.WARM[c.ws]; if (!w || !w.s) return;
        if (c.wp == null) { c.wp = Date.now() - c.wt; a.textContent = 'Reprendre'; } else { c.wt = Date.now() - c.wp; c.wp = null; a.textContent = 'Pause'; } A.save(); return; }
      case 'wnext': return mWarm.advance && mWarm.advance();
      case 'zero': return mScore.set && mScore.set(0);
      case 'back': if (B.stepBack(D())) { A.save(); show(); } return;
      case 'launch': return launch();
      case 'dist': D().settings.dist = a.dataset.k; A.save(); return show();
      case 'redo': return show();
      case 'loss': return saveChrono(result.st, result.v, +a.dataset.v);
      case 'skip': return next();
      case 'quit': return quit();
      case 'qclose': closeQuit(); if (!result.on) show(); return; // l'écran repart (minuteurs recalculés depuis l'heure)
      case 'qlater': closeQuit(); clean(); unwake(); return A.go('home');
      case 'qfinish': closeQuit(); return finish();
      case 'qdrop':
        if (Date.now() - dropArmed > 3000) { dropArmed = Date.now(); a.textContent = 'Touche encore pour abandonner'; return; }
        closeQuit(); clean(); unwake(); B.abandon(D()); A.save(); toast('Séance abandonnée'); return A.go('home');
    }
  });

  window.Seance = {
    init(api) { A = api; },
    open(type) { pend = type; },
    render() { return '<div class="screen"></div>'; },
    mounted() { if (D().current) { initAudio(); wake(); } show(); },
    leave() { clean(); },
  };
})();
