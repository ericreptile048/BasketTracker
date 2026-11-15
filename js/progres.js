'use strict';
// Page Progrès : Par famille (Tir · Dribble · Finition · Sprint · Général) ou Par séance (cartes en barres), fiche d'un item.
(function () {
  const { $, $$, COL, ICON, f1, toast } = UI;
  let A = null, M = 0, F = 'gen', SPD = 'half';
  const D = () => A.data;
  const FAMS = { tir: ['Tir', [1, 2, 3, 4]], drib: ['Dribble', [5, 6, 7, 8]], fin: ['Finition', [9, 10]], sprint: ['Sprint', [13, 14]], gen: ['Général', []] };
  const shade = (c, k) => (k ? `color-mix(in srgb,${c} ${100 - k * 26}%,#fff)` : c);
  const fd = t => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const color = () => (M === 1 ? 'var(--gold)' : F === 'gen' ? COL.gen : COL[F]);

  // ---------- graphe en lignes (SVG fait main, tracé animé) ----------
  // séries { c, v:[...], xs:[index sur l'axe], dots, dc } · lo/hi : bornes de l'axe Y (lo en bas)
  function chart(series, { lo = 0, hi = 100, goal = null, goalTxt = 'objectif', H = 190, n, dates, yl = '', fmt = v => Math.round(v) + '%' } = {}) {
    const W = 330, pl = 34, pr = 14, pt = yl ? 22 : 14, pb = 22;
    const X = i => (n === 1 ? (pl + W - pr) / 2 : pl + i * (W - pl - pr) / (n - 1)), Y = y => pt + (hi - y) / ((hi - lo) || 1) * (H - pt - pb);
    let g = yl ? `<text x="4" y="11" font-size="11" fill="var(--sx)" font-weight="600">${yl}</text>` : '';
    [lo, (lo + hi) / 2].forEach(y => g += `<line x1="${pl}" y1="${Y(y)}" x2="${W - pr}" y2="${Y(y)}" stroke="var(--line)"/><text x="${pl - 7}" y="${Y(y) + 4}" font-size="11" fill="var(--mut)" text-anchor="end">${fmt(y)}</text>`);
    if (goal !== null) g += `<line x1="${pl}" y1="${Y(goal)}" x2="${W - pr}" y2="${Y(goal)}" stroke="var(--ok)" stroke-width="1.6" stroke-dasharray="5 5"/><text x="${W - pr}" y="${Y(goal) - 6}" font-size="11.5" fill="var(--ok)" text-anchor="end" font-weight="600">${goalTxt}</text>`;
    series.forEach((s, k) => {
      const xs = s.xs || s.v.map((_, i) => i), d = s.v.map((y, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(y).toFixed(1)).join(' ');
      if (s.v.length > 1) g += `<path class="cl" style="animation-delay:${k * .12}s" stroke="${s.c}" d="${d}"/>`;
      (s.dots || [s.v.length - 1]).forEach(i => g += `<circle class="cp" style="animation-delay:${.8 + k * .12 + i * .03}s" cx="${X(xs[i])}" cy="${Y(s.v[i])}" r="${s.r || 5}" fill="${s.dc ? s.dc[i] : s.c}" stroke="var(--card)" stroke-width="2"/>`);
    });
    if (dates && n) [...new Set([0, Math.floor((n - 1) / 2), n - 1])].forEach(i => g += `<text x="${X(i)}" y="${H - 5}" font-size="11" fill="var(--mut)" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${dates[i]}</text>`);
    return `<svg class="pch" viewBox="0 0 ${W} ${H}">${g}</svg>`;
  }
  function spark(vals, c, lowGood) {
    if (vals.length < 2) vals = [vals[0], vals[0]];
    const lo = Math.min(...vals), hi = Math.max(...vals), W = 64, H = 26;
    const P = vals.map((y, i) => `${(i * (W - 4) / (vals.length - 1) + 2).toFixed(1)},${((hi - y) / ((hi - lo) || 1) * (H - 6) + 3).toFixed(1)}`).join(' ');
    return `<svg width="${W}" height="${H}" class="spk"><polyline points="${P}" fill="none" stroke="${c}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // ---------- les valeurs d'un item ----------
  const stTxt = st => ({ ok: 'validé ✓', half: '1 sur 2', todo: 'pas encore', track: 'suivi' }[st]);
  const pill = st => `<span class="stt ${st}">${stTxt(st)}</span>`;
  const subLab = (it, k) => it.sub.find(x => x[0] === k)[1];
  // ce qu'une séance a donné pour un item, en texte court (seuls les chiffres en vert)
  function evTxt(it, e) {
    if (!e) return '—';
    if (it.t === 'done') return 'faite';
    if (it.t === 'time') return `<em>${f1(e.val)}</em> s${e.loss !== undefined ? ` · ${e.loss} perte${e.loss > 1 ? 's' : ''}` : ''}`;
    if (it.t === 'lo') return `<span class="lvs">${it.sub.filter(([k]) => e.subs[k] !== undefined).map(([k]) => `<span class="lv ${e.subs[k] === 0 ? 'ok' : ''}">${ICON[k]}<b>${10 - e.subs[k]}</b></span>`).join('')}</span>`;
    if (it.sub) return it.sub.filter(([k]) => e.subs[k] !== undefined).map(([k, l]) => `${l} <em>${e.subs[k]}</em>`).join(' · ');
    return `<em>${f1(e.val)}</em>/10`;
  }
  // le record affiché sur une ligne
  function recTxt(d, it, S) {
    if (it.t === 'manual') return S.st === 'ok' ? '✓' : '—';
    if (it.t === 'done') return `${S.L.length}<span> fois</span>`;
    if (it.t === 'time') { const b = S.L.length ? Math.min(...S.L.map(x => x.e.val)) : null; return b === null ? '—' : `${f1(b)}<span> s</span>`; }
    if (it.sub) { const ok = it.sub.filter(([k]) => B.subStatus(d, it, k) === 'ok').length; return `${ok}<span>/${it.sub.length} ${it.t === 'lo' ? 'niveaux' : it.id === 9 || it.id === 10 ? 'côtés' : 'spots'}</span>`; }
    const b = S.L.length ? Math.max(...S.L.map(x => x.e.val)) : null; return b === null ? '—' : `${f1(b)}<span>/10</span>`;
  }

  // ---------- Par famille ----------
  function famSeries(d, ids, S) { return ids.map(id => B.ITEM(id)).filter(it => it.t !== 'time').map(it => S.map(s => Math.round(B.progressAt(d, it, s.start) * 100))); }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  function vFamily() {
    const d = D(), S = B.sorted(d), n = S.length, dates = S.map(s => fd(s.start));
    const tabs = `<div class="seg pseg" id="fam" style="grid-template-columns:repeat(5,1fr)"><div class="pill" style="width:calc((100% - 6px)/5);transform:translateX(${Object.keys(FAMS).indexOf(F) * 100}%)"></div>
      ${Object.entries(FAMS).map(([k, [l]]) => `<button data-pf="${k}" class="${k === F ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    let head = '', ch = '', chips = '', rows = '', lab = 'Détail';
    if (F === 'gen') {
      const fams = ['tir', 'drib', 'fin'], ser = fams.map(f => ({ f, c: COL[f], v: S.map((_, j) => Math.round(mean(famSeries(d, FAMS[f][1], S).map(v => v[j])))) }));
      const now = Math.round(mean(ser.map(s => s.v[n - 1]))), ok = B.LIST12.filter(it => B.status(d, it).st === 'ok').length;
      head = `<div class="big">${now}<small>%</small></div><p>de l'objectif, toutes familles<br><b>${ok}/12</b> items validés · J-${B.daysLeft()}</p>`;
      ch = chart(ser.map(s => ({ c: s.c, v: s.v })), { goal: 100, n, dates });
      chips = ser.map(s => `<span class="chip"><i style="background:${s.c}"></i>${FAMS[s.f][0]} <b>${s.v[n - 1]}%</b></span>`).join('');
      lab = 'Les familles';
      const half = B.best(d, B.ITEM(13), 'half');
      rows = ser.map((s, i) => { const its = FAMS[s.f][1].map(B.ITEM), okf = its.filter(it => B.status(d, it).st === 'ok').length;
        return `<button class="prow frow" style="--c:${s.c};animation-delay:${i * 50}ms" data-pf="${s.f}"><i></i><div><b>${FAMS[s.f][0]}</b><small>${its.length} items · ${okf} validé${okf > 1 ? 's' : ''}</small></div><span class="pc">${s.v[n - 1]}%</span></button>`; }).join('')
        + `<button class="prow frow" style="--c:${COL.sprint};animation-delay:150ms" data-pf="sprint"><i></i><div><b>Sprint</b><small>2 distances · suivi</small></div><span class="pc">${half === null ? '—' : f1(half) + '<small> s</small>'}</span></button>`
        + rowsFor(d, [11, 12], 4);
    } else if (F === 'sprint') {
      return tabs + vSprint(d);
    } else {
      const ids = FAMS[F][1], c = COL[F], its = ids.map(B.ITEM), pits = its.filter(it => it.t !== 'time');
      const sv = famSeries(d, ids, S), now = Math.round(mean(sv.map(v => v[n - 1]))), okn = its.filter(it => B.status(d, it).st === 'ok').length;
      head = `<div class="big">${now}<small>%</small></div><p>de l'objectif en moyenne<br><b>${okn}/${its.length}</b> items validés</p>`;
      ch = chart(sv.map((v, k) => ({ c: shade(c, k), v })), { goal: 100, n, dates });
      chips = pits.map((it, k) => `<span class="chip"><i style="background:${shade(c, k)}"></i>${it.short} <b>${sv[k][n - 1]}%</b></span>`).join('');
      rows = rowsFor(d, ids, 0);
    }
    return `${tabs}<div class="famhead">${head}</div><div class="card">${ch}<div class="chips">${chips}</div></div>
      <div class="lab"><span>${lab}</span><span>touche pour la fiche</span></div><div class="prows">${rows}</div>`;
  }
  function rowsFor(d, ids, k0) {
    return ids.map((id, i) => {
      const it = B.ITEM(id), S = B.status(d, it), L = S.L || [], last = L[L.length - 1], c = COL[it.f];
      // moves : la moyenne des réussites des niveaux faits ce jour-là (plus haut = mieux)
      const vals = L.map(x => it.t === 'lo' ? mean(Object.values(x.e.subs).map(v => 10 - v)) : x.e.val);
      const sp = L.length > 1 && it.t !== 'done' ? spark(vals.slice(-8), c, it.t === 'time') : '<span class="spk"></span>';
      const det = it.t === 'manual' ? (S.st === 'ok' ? 'fait' : 'à faire hors séance') : last ? (it.t === 'lo' ? evTxt(it, last.e) : 'dernier ' + evTxt(it, last.e)) : 'pas encore fait';
      return `<button class="prow" style="--c:${c};animation-delay:${(k0 + i) * 40}ms" data-pi="${id}"><i></i><div><b>${it.n}</b><small>${det}</small></div>${sp}
        <div class="rec"><strong>${recTxt(d, it, S)}</strong>${pill(S.st)}</div></button>`;
    }).join('');
  }
  // Sprint : 2 cartes (demi-terrain / terrain entier), on touche une carte pour voir sa courbe en secondes
  function vSprint(d) {
    const cards = [['half', 13, 'Demi-terrain'], ['full', 14, 'Terrain entier']].map(([k, id, l], j) => {
      const it = B.ITEM(id), L = B.history(d, it), b = L.length ? Math.min(...L.map(x => x.e.val)) : null;
      return `<button class="spcard ${k === SPD ? 'on' : ''}" data-ps="${k}" style="--oc:${shade(COL.sprint, j)}"><span class="spn">${l}</span>
        <div class="spb">${b === null ? '—' : f1(b)}<small>${b === null ? '' : ' s'}</small></div><span class="spm">${b === null ? 'pas encore' : f1(it.m / b * 3.6) + ' km/h · ' + L.length + ' séance' + (L.length > 1 ? 's' : '')}</span></button>`;
    }).join('');
    const it = B.ITEM(SPD === 'half' ? 13 : 14), L = B.history(d, it), S = B.sorted(d);
    let ch = '<p class="empty">Pas encore de sprint sur cette distance.</p>';
    if (L.length) {
      const v = L.map(x => x.e.val), xs = L.map(x => S.indexOf(x.s));
      ch = chart([{ c: shade(COL.sprint, SPD === 'half' ? 0 : 1), v, xs, dots: v.map((_, i) => i), r: 5 }],
        { lo: Math.min(...v) - .6, hi: Math.max(...v) + .6, n: S.length, dates: S.map(s => fd(s.start)), yl: 'secondes', fmt: f1 });
    }
    return `<div class="spc">${cards}</div><div class="card">${ch}</div>
      <div class="lab"><span>Détail</span><span>touche pour la fiche</span></div><div class="prows">${rowsFor(d, [13, 14], 0)}</div>`;
  }

  // ---------- Par séance : une carte par séance, une barre par exercice ----------
  function sesRows(d, s) {
    const out = [];
    B.ITEMS.forEach(it => {
      if (it.t === 'manual' || it.t === 'done') return;
      const e = B.evalItem(it, s); if (!e) return;
      const L = B.history(d, it), j = L.findIndex(x => x.s === s), prev = j > 0 ? L[j - 1].e : null;
      const keys = [...new Set(s.res.filter(r => r.item === it.id).map(r => r.key))];
      const pr = keys.some(k => B.isRecord(d, it, k, s));
      // la valeur à comparer : plus haut = mieux (les pertes et les temps sont retournés)
      const score = x => it.t === 'time' ? -x.val : it.t === 'lo' ? mean(Object.values(x.subs).map(v => 10 - v)) : x.val;
      const dlt = prev ? Math.round((score(e) - score(prev)) * 10) / 10 : 0;
      const p = it.t === 'time' ? null : Math.round(B.progressAt(d, it, s.start) * 100);
      const big = it.t === 'time' ? f1(e.val) + '<small> s</small>' : it.t === 'lo' ? (() => { const top = ['run', 'walk', 'imm'].find(k => e.subs[k] !== undefined); return `<span class="lvi">${ICON[top]}</span>${10 - e.subs[top]}<small>/10</small>`; })() : f1(e.val) + '<small>/10</small>';
      out.push({ it, pr, dlt, p, big });
    });
    return out;
  }
  function vFeed() {
    const d = D(), S = B.sorted(d).slice().reverse();
    const last = S[0], recs = last ? sesRows(d, last).filter(r => r.pr) : [];
    const banner = recs.length ? `<div class="banner"><span class="tro">🏆</span><div><b>${recs.length} record${recs.length > 1 ? 's' : ''} à la dernière séance</b><span>${recs.map(r => r.it.short).join(' · ')}</span></div></div>` : '';
    return banner + `<div class="feed">${S.map((s, i) => {
      const R = sesRows(d, s), min = Math.round((s.end - s.start) / 60000);
      return `<div class="sc" style="--sc:${COL[s.type]};animation-delay:${i * 60}ms"><div class="hd"><span class="bdg">${s.type}</span>
        <div class="t"><b>Séance ${s.type}</b><small>${s.type === 'A' ? 'Tir et finition' : 'Dribble, finition, sprint'}</small></div><div class="m"><b>${min} min</b><small>${fd(s.start)}</small></div></div>
        <div class="bars">${R.map((r, k) => `<div class="fbr ${r.pr ? 'pr' : ''}" style="--c:${COL[r.it.f]}"><span class="nm">${r.pr ? '🏆 ' : ''}${r.it.short}</span>
          <span class="tr">${r.p === null ? '' : `<i style="width:${Math.max(4, r.p)}%;animation-delay:${k * 60}ms"></i>`}</span>
          <span class="vl">${r.big}<span class="dlt ${!r.dlt ? 'eq' : r.dlt > 0 ? 'up' : 'dn'}">${!r.dlt ? '=' : (r.dlt > 0 ? '+' : '−') + f1(Math.abs(r.dlt))}</span></span></div>`).join('')}</div></div>`;
    }).join('')}</div>`;
  }

  // ---------- la page ----------
  function render() {
    const d = D();
    if (!d.sessions.length) return `<div class="page"><div class="halo" style="--hc:${COL.gen}"></div><header class="top"><h1>Progrès</h1></header>
      <div class="soon"><b>Pas encore de séance</b>Les courbes apparaissent après ta première séance.<br><br><button class="badge" data-go="home">← Accueil</button></div></div>`;
    return `<div class="page" style="--hc:${color()}"><div class="halo" id="phalo"></div><div class="cap">${d.sessions.length} séance${d.sessions.length > 1 ? 's' : ''}</div><h1>Progrès</h1>
      <div class="seg pseg" id="mode" style="grid-template-columns:1fr 1fr;margin:14px 0"><div class="pill" style="width:calc((100% - 6px)/2);transform:translateX(${M * 100}%)"></div>
        <button data-pm="0" class="${M === 0 ? 'on' : ''}">Par famille</button><button data-pm="1" class="${M === 1 ? 'on' : ''}">Par séance</button></div>
      <section id="pbody">${M === 0 ? vFamily() : vFeed()}</section></div>`;
  }
  function refresh() {
    const v = $('#view'); v.innerHTML = render(); UI.setBar('progres', color(), B.doneToday(D()) && !D().current);
  }

  // ---------- fiche d'un item (feuille iOS qui monte) ----------
  function openItem(id) {
    const d = D(), it = B.ITEM(id), S = B.status(d, it), L = S.L || [], c = COL[it.f], F2 = { tir: 'Tir', drib: 'Dribble', fin: 'Finition', sprint: 'Sprint', gen: 'Jeu et corps' }[it.f];
    let body = '';
    if (it.t === 'manual') {
      body = `<p class="pnote">${it.goal}.</p><button class="big-btn ${S.st === 'ok' ? 'ghost' : ''}" style="--sc:var(--ok);margin-top:14px" data-pman="1"><span>${S.st === 'ok' ? 'Annuler : pas encore fait' : 'C\'est fait ✓'}</span></button>`;
    } else if (it.sub) {
      body = `<div class="obj">${it.sub.map(([k, l], j) => {
        const v = B.history(d, it).map(x => x.e.subs[k]).filter(x => x !== undefined), st = B.subStatus(d, it, k), lo = it.t === 'lo', col = shade(c, j);
        const best = v.length ? (lo ? Math.min(...v) : Math.max(...v)) : null, u = x => lo ? (10 - x) + '/10' : x + '/10';
        return `<div class="ob" style="--oc:${col};animation-delay:${j * 70}ms"><div class="oh"><i></i><div class="ot"><b>${lo ? ICON[k] : ''}${cap(l)}</b><small>${lo && k === 'imm' ? 'avant le test · objectif 10/10' : 'objectif : ' + (lo ? '10/10' : it.g + '/10')}</small></div>
          <div class="on"><span>🏆 <b>${best === null ? '—' : u(best)}</b></span><span>dernier ${v.length ? u(v[v.length - 1]) : '—'}</span></div>${lo && k === 'imm' ? '' : pill(st)}</div>
          ${v.length ? chart([{ c: col, v: lo ? v.map(x => 10 - x) : v, dots: v.map((_, i) => i), r: 4.5, dc: v.map(x => (lo ? x === 0 : x >= it.g) ? 'var(--ok)' : col) }], { lo: 0, hi: 10, goal: lo ? 10 : it.g, goalTxt: 'objectif', H: 120, n: v.length, yl: lo ? 'réussies /10' : 'paniers /10', fmt: v => Math.round(v) }) : '<p class="empty">pas encore fait</p>'}</div>`;
      }).join('')}</div>`;
    } else {
      const v = L.map(x => x.e.val), time = it.t === 'time';
      const best = v.length ? (time ? Math.min(...v) : Math.max(...v)) : null;
      const k3 = time && it.m ? `<div class="kpi"><b>${best === null ? '—' : f1(it.m / best * 3.6)}</b><span>km/h max</span></div>`
        : `<div class="kpi"><b style="color:${S.st === 'ok' ? 'var(--ok)' : S.st === 'half' ? 'var(--warn)' : 'var(--tx)'}">${S.st === 'ok' ? '✓' : S.st === 'half' ? '1/2' : S.st === 'track' ? '—' : '0/2'}</b><span>${stTxt(S.st)}</span></div>`;
      const fmtv = x => it.t === 'done' ? '✓' : time ? f1(x) + ' s' : f1(x) + '/10';
      body = `<div class="kpis"><div class="kpi gold"><b>${best === null ? '—' : it.t === 'done' ? L.length : fmtv(best)}</b><span>${it.t === 'done' ? 'fois' : '🏆 record'}</span></div>
        <div class="kpi"><b>${v.length ? fmtv(v[v.length - 1]) : '—'}</b><span>dernier</span></div>${k3}</div>
        ${v.length && it.t !== 'done' ? `<div class="card">${chart([{ c, v, dots: v.map((_, i) => i), r: 5.5, dc: L.map(x => x.e.pass === true ? 'var(--ok)' : x.e.pass === false ? 'var(--ko)' : c) }],
          time ? { lo: Math.min(...v) - .6, hi: Math.max(...v) + .6, n: v.length, dates: L.map(x => fd(x.s.start)), yl: 'secondes', fmt: f1, H: 200 }
            : { lo: 0, hi: 10, goal: it.g, goalTxt: 'objectif ' + it.g + '/10', n: v.length, dates: L.map(x => fd(x.s.start)), fmt: v => Math.round(v), H: 200 })}</div>` : ''}`;
    }
    const two = L.slice(-2).map(x => x.e.pass);
    const valid = it.t === 'time' || it.t === 'manual' ? '' : `<div class="lab"><span>Validé = 2 séances réussies de suite</span>${pill(S.st)}</div>
      <div class="valid">${[0, 1].map(i => { const p = two.length === 2 ? two[i] : i === 1 ? two[0] : undefined; return `<i class="${p ? 'on' : ''}">${p ? '✓' : ''}</i>`; }).join('')}<span>les 2 dernières séances</span></div>`;
    // historique : chaque valeur comparée à la séance d'avant ; blanc = pareil ou nouveau, bleu = mieux, rouge = moins bien, ✓ vert = réussi
    const hist = L.length && it.t !== 'manual' ? `<div class="lab"><span>Séances</span><span class="leg"><span><i style="background:var(--blue)"></i>mieux</span><span><i style="background:var(--ko)"></i>moins bien</span><span><i style="background:var(--tx)"></i>pareil</span></span></div>
      <div class="hist">${L.map((x, j) => ({ x, j })).reverse().map(({ x, j }) => `<div><span>${fd(x.s.start)} ${x.e.pass ? '<span class="ck">✓</span>' : ''}</span><b>${histVal(it, L, j)}</b></div>`).join('')}</div>` : '';
    const sh = $('#psheet'); sh.style.setProperty('--c', c);
    sh.innerHTML = `<div class="grab"></div><div class="fam">${F2}</div><h2>${it.n}</h2><div class="goal">Test : ${it.goal}</div>${body}${valid}${hist}`;
    $('#pback').classList.add('on'); sh.classList.add('on'); sh.scrollTop = 0;
  }
  // une valeur de l'historique, colorée par rapport à la séance d'avant (même variante)
  function histVal(it, L, j) {
    const e = L[j].e, p = j > 0 ? L[j - 1].e : null;
    const cls = (a, b, lowGood) => (b === undefined || b === null || a === b ? '' : (lowGood ? a < b : a > b) ? 'up' : 'dn');
    if (it.t === 'done') return 'faite';
    if (it.t === 'lo') return `<span class="lvs">${it.sub.filter(([k]) => e.subs[k] !== undefined).map(([k]) => { const v = e.subs[k];
      return `<span class="lv ${v === 0 ? 'ok' : cls(v, p && p.subs[k], true)}">${ICON[k]}<b>${10 - v}</b></span>`; }).join('')}</span>`;
    if (it.sub) return it.sub.filter(([k]) => e.subs[k] !== undefined).map(([k, l]) => `<span class="lb">${l}</span> <span class="dv ${cls(e.subs[k], p && p.subs[k])}">${e.subs[k]}</span>`).join(' · ');
    if (it.t === 'time') return `<span class="dv ${cls(e.val, p && p.val, true)}">${f1(e.val)} s</span>${it.m ? ` <span class="lb">· ${f1(it.m / e.val * 3.6)} km/h</span>` : e.loss !== undefined ? ` <span class="lb">· ${e.loss} perte${e.loss > 1 ? 's' : ''}</span>` : ''}`;
    return `<span class="dv ${cls(Math.round(e.val * 10), p && Math.round(p.val * 10))}">${f1(e.val)}/10</span>`;
  }
  function closeItem() { $('#pback').classList.remove('on'); $('#psheet').classList.remove('on'); }

  // ---------- actions ----------
  document.addEventListener('click', e => {
    if (!A || !document.getElementById('pbody') && !e.target.closest('#psheet')) return;
    const t = e.target;
    const pm = t.closest('[data-pm]'); if (pm) { M = +pm.dataset.pm; return refresh(); }
    const pf = t.closest('[data-pf]'); if (pf) { F = pf.dataset.pf; M = 0; return refresh(); }
    const ps = t.closest('[data-ps]'); if (ps) { SPD = ps.dataset.ps; return refresh(); }
    const pi = t.closest('[data-pi]'); if (pi) return openItem(+pi.dataset.pi);
    if (t.closest('[data-pman]')) { const d = D(); if (d.manual[12]) delete d.manual[12]; else d.manual[12] = Date.now(); A.save(); toast(d.manual[12] ? 'Ailier : validé ✓' : 'Ailier : remis à faire'); openItem(12); return refresh(); }
    if (t.id === 'pback') return closeItem();
  });
  // tirer la feuille vers le bas pour la fermer
  let y0 = null;
  document.addEventListener('touchstart', e => { const s = e.target.closest('#psheet'); y0 = s && s.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  document.addEventListener('touchmove', e => { if (y0 !== null && e.touches[0].clientY - y0 > 70) { closeItem(); y0 = null; } }, { passive: true });

  window.Progres = {
    init(api) { A = api; },
    render,
    color,
    mounted() { /* rien : tout est en CSS */ },
    leave() { closeItem(); },
  };
})();
