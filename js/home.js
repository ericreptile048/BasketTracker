'use strict';
// Page Accueil : les 12 items en anneaux, la rangée des 26 séances, les boutons A / B, la reprise d'une séance en cours.
(function () {
  const { ICON, COL, miniRing, drawRings } = UI;
  const SUB = { A: 'Tir et finition', B: 'Dribble, finition, sprint' };

  function render(data, now = Date.now()) {
    // un item suivi (slalom) sans aucune séance : anneau vide, pas en pointillés
    const items = B.LIST12.map(it => { const S = B.status(data, it), p = B.progress(data, it);
      return { it, S, p: p === null && !(S.L && S.L.length) ? 0 : p }; });
    const ok = items.filter(x => x.S.st === 'ok').length, half = items.filter(x => x.S.st === 'half').length;
    const nx = B.nextType(data), other = nx === 'A' ? 'B' : 'A', done = B.doneToday(data, now);
    const S = B.sorted(data), last = S[S.length - 1];
    const date = new Date(now).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    let resume = '';
    if (data.current) {
      const c = data.current, min = Math.max(1, Math.round(B.elapsed(data, now) / 60000));
      resume = `<button class="resume" data-act="resume" style="--rc:${COL[c.type]}"><span class="rk">${c.type}</span>
        <span><b>Reprendre la séance ${c.type}</b><small>commencée il y a ${min} min · ${c.res.length} score${c.res.length > 1 ? 's' : ''} noté${c.res.length > 1 ? 's' : ''}</small></span>${ICON.chev}</button>`;
    }

    // la rangée des 26 séances, comme les pomos d'OmegaTracker
    const dots = Array.from({ length: B.TOTAL }, (_, i) => {
      const s = S[i];
      if (s) return `<i class="${s.type === 'A' ? 'a' : 'b'} pop wavable" style="animation-delay:${i * 40}ms"></i>`;
      return `<i class="${i === S.length ? 'next' : ''}" style="--nc:${COL[nx]}"></i>`;
    }).join('');

    const btn = (t, main) => `<button class="gob ${main ? 'main' : 'alt'}" data-act="seance" data-t="${t}" style="--kc:${COL[t]}">
      <span class="k">${t}</span><span><div class="t">${SUB[t]}</div><div class="s">${main ? 'la prochaine · ~40 min' : '~40 min'}</div></span>${main ? `<span class="ar">${ICON.chev}</span>` : ''}</button>`;
    const doneCard = done && last ? `<div class="gob done"><span class="k">${ICON.check}</span><span><div class="t">Séance ${last.type} faite aujourd'hui</div>
      <div class="s">${Math.round((last.end - last.start) / 60000)} min · la prochaine : ${nx}</div></span></div>` : '';

    return `<div class="page" style="--hc:${COL[nx]}"><div class="halo"></div>
    <header class="top"><div><div class="cap">${date}</div><h1>BasketTracker</h1></div><span class="badge">J-${B.daysLeft(now)}</span></header>
    ${resume}
    <div class="lab"><span>Les 12 items</span><span><b>${ok}</b> validé${ok > 1 ? 's' : ''} · <b>${half}</b> à 1 sur 2</span></div>
    <div class="items">${items.map(({ it, S, p }, i) => `<button class="it ${S.st === 'ok' ? 'ok' : ''} pop" style="animation-delay:${i * 35}ms" data-act="item" data-id="${it.id}">
      ${miniRing(p, S.st, i, COL[it.f])}<span>${it.short}</span></button>`).join('')}</div>
    <div class="lab"><span>Les ${B.TOTAL} séances jusqu'au 14 févr.</span><span><b>${S.length}</b>/${B.TOTAL}</span></div>
    <div class="card"><div class="pomos">${dots}</div><div class="note">2 par semaine · orange = A · bleu = B · le rond qui pulse = la prochaine</div></div>
    <div class="gos">${doneCard}${btn(nx, !done)}${btn(other, false)}</div></div>`;
  }
  function mounted() { drawRings(document.getElementById('view')); }

  // ---------- La carte d'un item : elle sort au-dessus de la tuile touchée ----------
  const f1 = UI.f1, fd = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const subLab = (it, k) => it.sub.find(x => x[0] === k)[1];
  // ---- jauges « bullet » : la barre = la dernière séance, ◆ or = le record, trait vert = l'objectif ----
  // paniers sur 10, ou réussis sur 10 pour les moves (stockés tels quels, comme dans Progrès) : même échelle partout
  // live = le record vient de la séance en cours (record provisoire, ◇ en pointillé)
  function bullet(it, lab, last, rec, i, live) {
    const sc = x => (x === null ? null : x / 10);
    const L = sc(last), R = sc(rec), G = it.g / 10, good = last !== null && last >= it.g;
    const val = last === null ? '<span class="bv none">—</span>' : `<span class="bv ${good ? 'ok' : ''}">${f1(last)}<small>/10</small></span>`;
    return `<div class="bl"><span class="bn">${lab}</span><span class="bt">
      ${L !== null ? `<i class="bf ${good ? 'ok' : ''}" style="width:${Math.max(3, L * 100)}%;animation-delay:${i * 70}ms"></i>` : ''}
      <i class="bg" style="left:${G * 100}%"></i>${R !== null ? `<i class="br ${live ? 'prov' : ''}" style="left:${R * 100}%;animation-delay:${200 + i * 70}ms"></i>` : ''}</span>${val}</div>`;
  }
  // temps suivis (slalom) : la courbe des séances, ◆ or au record, rond blanc à la dernière
  function spark(vals) {
    const W = 260, H = 54, n = vals.length, lo = Math.min(...vals), hi = Math.max(...vals);
    const X = i => (n === 1 ? W / 2 : 6 + i * (W - 12) / (n - 1)), Y = v => 8 + (hi === lo ? 0.5 : (hi - v) / (hi - lo)) * (H - 16); // plus rapide = plus bas
    const bi = vals.indexOf(lo);
    return `<svg class="sp" viewBox="0 0 ${W} ${H}"><polyline points="${vals.map((v, i) => X(i) + ',' + Y(v)).join(' ')}" fill="none" stroke="var(--pc)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${X(n - 1)}" cy="${Y(vals[n - 1])}" r="4.5" fill="var(--tx)"/><rect x="${X(bi) - 5}" y="${Y(lo) - 5}" width="10" height="10" fill="var(--gold)" transform="rotate(45 ${X(bi)} ${Y(lo)})"/></svg>`;
  }
  // les 2 pastilles « validé = 2 séances de suite »
  function two(L) {
    const p = L.slice(-2).map(x => x.e.pass); while (p.length < 2) p.unshift(null);
    return `<span class="two"><small>2 de suite</small>${p.map(x => `<i class="${x ? 'on' : x === false ? 'ko' : ''}">${x ? '✓' : ''}</i>`).join('')}</span>`;
  }
  function body(data, it) {
    const S = B.status(data, it), L = S.L || [], last = L[L.length - 1];
    const stTxt = { ok: 'validé ✓', half: '1 sur 2', todo: 'pas encore', track: 'suivi' }[S.st];
    let rows = '', foot = '';
    if (it.t === 'manual') rows = `<div class="pnote">${S.st === 'ok' ? 'Fait le ' + fd(S.when) + ' ✓' : 'À faire hors séance : la vidéo, puis les 3 occasions en 3 phrases.'}</div>`;
    else if (it.t === 'done') rows = `<div class="pnote">Faite <b>${L.length}</b> fois dans l'échauffement.</div>`;
    else if (it.t === 'time') {
      const vals = L.slice(-8).map(x => x.e.val), R = B.liveBest(data, it, it.key);
      rows = vals.length || R.live ? `${vals.length ? spark(vals) : ''}<div class="tk"><span><i class="dm ${R.live ? 'prov' : ''}"></i>${R.live ? 'record provisoire' : 'record'} <b>${f1(R.v)} s</b></span>${last ? `<span><i class="dl"></i>dernier <b>${f1(last.e.val)} s</b>${last.e.loss !== undefined ? ' · ' + last.e.loss + ' perte' + (last.e.loss > 1 ? 's' : '') : ''}</span>` : ''}</div>`
        : '<div class="pnote">Pas encore fait.</div>';
    } else {
      const subs = it.sub || [['_', it.short]];
      const lvl = it.t === 'lo' && S.st !== 'ok' ? (B.moveLevels(data, it).find(x => x.role === 'test') || {}).key : null;
      let anyLive = false;
      rows = subs.map(([k, lab], i) => {
        const key = k === '_' ? undefined : k, lastV = k === '_' ? (last ? Math.round(last.e.val * 10) / 10 : null) : B.lastSub(data, it, k);
        // le record : séances enregistrées + séance en cours (record provisoire).
        // Sans variante (lancers, jump stop) : la meilleure moyenne de séance, comme la valeur « dernière ».
        let R;
        if (k === '_') {
          const saved = L.length ? Math.max(...L.map(x => x.e.val)) : null, cur = data.current ? data.current.res.filter(r => r.item === it.id).map(r => r.v) : [];
          const cm = cur.length ? cur.reduce((a, b) => a + b, 0) / cur.length : null;
          R = cm !== null && (saved === null || cm > saved) ? { v: cm, live: true } : { v: saved, live: false };
        } else R = B.liveBest(data, it, key);
        if (R.live) anyLive = true;
        const name = it.t === 'lo' ? `<span class="lvn ${k === lvl ? 'cur' : ''}">${ICON[k]}</span>` : lab;
        return bullet(it, name, lastV, R.v === null ? null : Math.round(R.v * 10) / 10, i, R.live);
      }).join('');
      foot = `<div class="pft"><span class="lgd"><i class="lf"></i>dernière<i class="dm"></i>record${anyLive ? '<i class="dm prov"></i>provisoire' : ''}<i class="lg"></i>objectif</span>${two(L)}</div>`;
    }
    return { S, stTxt, html: rows + foot };
  }
  function pop(data, btn) {
    const grid = btn.closest('.items'), old = grid.querySelector('.ipop');
    const id = +btn.dataset.id;
    if (old) { const same = +old.dataset.id === id; old.remove(); grid.querySelectorAll('.it.sel').forEach(x => x.classList.remove('sel')); if (same) return; }
    const it = B.ITEM(id), I = body(data, it);
    const el = document.createElement('div'); el.className = 'ipop'; el.dataset.id = id;
    el.style.setProperty('--pc', I.S.st === 'ok' ? 'var(--gold)' : I.S.st === 'half' ? 'var(--warn)' : COL[it.f]);
    el.innerHTML = `<div class="ph"><b>${it.n}</b><span class="pst ${I.S.st}">${I.stTxt}</span></div>
      <div class="pg">Test : ${it.goal}</div>${I.html}<i class="arw"></i>`;
    grid.appendChild(el); btn.classList.add('sel');
    // posée au-dessus de la tuile (en dessous s'il n'y a pas la place), la flèche pointe vers son centre
    const gx = grid.getBoundingClientRect(), bx = btn.getBoundingClientRect(), cx = bx.left - gx.left + bx.width / 2;
    const above = bx.top - el.offsetHeight - 14 > 8;
    el.classList.toggle('below', !above);
    if (above) el.style.bottom = (gx.bottom - bx.top + 10) + 'px'; else el.style.top = (bx.bottom - gx.top + 10) + 'px';
    el.querySelector('.arw').style.left = (cx - 8) + 'px';
    el.style.transformOrigin = `${cx}px ${above ? '100%' : '0'}`;
  }
  function closePop() { document.querySelectorAll('.ipop').forEach(p => p.remove()); document.querySelectorAll('.it.sel').forEach(x => x.classList.remove('sel')); }

  window.Home = { render, mounted, pop, closePop };
})();
