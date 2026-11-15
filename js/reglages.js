'use strict';
// Page Réglages : bips, écran allumé, thème, et les données (stats, export, import, tout effacer).
(function () {
  const { $, toast } = UI;
  let A = null, persisted = null;
  const D = () => A.data;
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const IC = {
    snd: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8.5a5 5 0 0 1 0 7"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    up: svg('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
    down: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
    bin: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  };
  const CHEV = '<svg class="chev" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1l6 6-6 6"/></svg>';
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { persisted = p; }).catch(() => {});

  function ago(t) {
    if (!t) return 'jamais';
    const d = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
    return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`;
  }
  // les records battus, toutes séances confondues
  function countRecords(d) {
    let n = 0;
    d.sessions.forEach(s => { const seen = new Set(); s.res.forEach(r => { const k = r.item + '/' + r.key; if (seen.has(k)) return; seen.add(k);
      const it = B.ITEM(r.item); if (it && it.t !== 'done' && B.isRecord(d, it, r.key, s)) n++; }); });
    return n;
  }

  function render() {
    const d = D(), st = d.settings, min = d.sessions.reduce((a, s) => a + (s.end - s.start) / 60000, 0);
    const tot = min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}` : `${Math.round(min)} min`;
    const old = d.lastExport ? (Date.now() - d.lastExport) / 864e5 : (d.sessions.length ? 99 : 0);
    const safe = persisted === false
      ? '<div class="safe warnl"><i></i>Le navigateur peut vider la sauvegarde : ajoute l\'app à l\'écran d\'accueil et exporte de temps en temps</div>'
      : '<div class="safe"><i></i>Sauvegarde gardée sur ce téléphone</div>';
    return `<div class="page" style="--hc:var(--sx)"><div class="halo"></div><div class="cap">BasketTracker · v1</div><h1>Réglages</h1>
      <div class="gt">Séances</div>
      <div class="grp">
        <div class="ri"><span class="ic" style="--c:var(--vio)">${IC.snd}</span><div class="tx"><b>Bips</b><small>Minuteurs et GO</small></div>
          <button class="snd" data-ract="test"><span class="eq"><i></i><i></i><i></i></span>Tester</button><button class="sw ${st.sound ? 'on' : ''}" data-ract="sound" aria-label="Bips"></button></div>
        <div class="ri"><span class="ic" style="--c:var(--gold)">${IC.sun}</span><div class="tx"><b>Écran toujours allumé</b><small>Pendant une séance</small></div>
          <button class="sw ${st.wake ? 'on' : ''}" data-ract="wake" aria-label="Écran allumé"></button></div>
      </div>
      <div class="gt">Apparence</div>
      <div class="grp" style="animation-delay:.06s">
        <div class="ri"><span class="ic" style="--c:#3A3A40">${IC.moon}</span><div class="tx"><b>Thème</b></div></div>
        <div class="blk"><div class="seg" style="grid-template-columns:repeat(3,1fr)"><div class="pill" style="width:calc((100% - 6px)/3);transform:translateX(${['dark', 'light', 'auto'].indexOf(st.theme || 'dark') * 100}%)"></div>
          ${[['dark', 'Sombre'], ['light', 'Clair'], ['auto', 'Auto']].map(([k, l]) => `<button data-ract="theme" data-k="${k}" class="${(st.theme || 'dark') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <p class="hint2">Auto suit le réglage de l'iPhone (clair le jour, sombre le soir si tu l'as réglé comme ça).</p></div>
      </div>
      <div class="gt">Mes données</div>
      <div class="grp" style="animation-delay:.12s">
        <div class="stats"><div><b>${d.sessions.length}</b><span>séances</span></div><div><b>${tot}</b><span>de basket</span></div><div><b>${countRecords(d)}</b><span>records 🏆</span></div></div>
        ${safe}
        <button class="ri" data-ract="export"><span class="ic" style="--c:var(--blue)">${IC.up}</span><div class="tx"><b>Exporter la sauvegarde</b>
          <small class="${old > 14 ? 'late' : ''}">Dernier export : ${ago(d.lastExport)}</small></div>${CHEV}</button>
        <button class="ri" data-ract="import"><span class="ic" style="--c:var(--ok)">${IC.down}</span><div class="tx"><b>Importer une sauvegarde</b><small>Remplace les données actuelles</small></div>${CHEV}</button>
        <button class="ri danger" data-ract="del"><span class="ic" style="--c:var(--ko)">${IC.bin}</span><div class="tx"><b>Tout effacer</b><small>Repartir de zéro</small></div></button>
      </div>
      <input type="file" id="rfile" accept=".json,application/json" hidden>
      <div class="foot">12 items · validés en 2 séances de suite<br>Objectif : dimanche 14 février 2027</div></div>`;
  }
  function refresh() { $('#view').innerHTML = render(); }

  // ---------- son ----------
  let ac = null;
  function beep(f, t) {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state !== 'running') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(.25, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + t + .18); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + .2); } catch (e) {}
  }

  // ---------- export / import ----------
  async function exportData() {
    const d = D(), txt = B.exportJSON(d), name = `baskettracker-${new Date().toISOString().slice(0, 10)}.json`;
    const done = () => { d.lastExport = Date.now(); A.save(); refresh(); toast(name + ' prêt ✓'); };
    try {
      const f = new File([txt], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return done(); }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); done();
  }
  function importFile(f) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const d = D(), tmp = B.blank();
      try { B.importJSON(tmp, r.result); } catch (e) { return toast('Fichier non reconnu : il faut une sauvegarde exportée par BasketTracker', 4000); }
      if (!confirm(`Importer ${tmp.sessions.length} séance${tmp.sessions.length > 1 ? 's' : ''} ? Ça remplace les ${d.sessions.length} actuelles.`)) return;
      d.sessions = tmp.sessions; d.manual = tmp.manual; d.settings = tmp.settings; d.current = null; A.save(); refresh();
      toast(`${tmp.sessions.length} séance${tmp.sessions.length > 1 ? 's' : ''} importée${tmp.sessions.length > 1 ? 's' : ''} ✓`);
    };
    r.readAsText(f);
  }

  // ---------- tout effacer : il faut maintenir 1,5 s ----------
  function askDelete() {
    const d = D(), bk = document.createElement('div'), sh = document.createElement('div');
    bk.className = 'qback'; sh.className = 'qsheet';
    sh.innerHTML = `<div class="grab"></div><h3>Tout effacer ?</h3><p>Les ${d.sessions.length} séances disparaissent de ce téléphone.<br>Exporte d'abord si tu veux les garder.</p>
      <button class="big-btn hold" id="hold"><i></i><span>Maintenir pour effacer</span></button><button class="big-btn ghost" data-ract="dclose">Annuler</button>`;
    document.body.append(bk, sh); requestAnimationFrame(() => { bk.classList.add('on'); sh.classList.add('on'); });
    bk.onclick = closeDel;
    const h = sh.querySelector('#hold'); let ht;
    h.addEventListener('pointerdown', () => { h.classList.add('go'); ht = setTimeout(() => {
      Object.assign(d, B.blank()); A.save(); closeDel(); refresh(); toast('Tout est effacé'); }, 1500); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => h.addEventListener(ev, () => { clearTimeout(ht); h.classList.remove('go'); }));
  }
  function closeDel() { document.querySelectorAll('.qsheet,.qback').forEach(e => e.remove()); }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-ract]'); if (!a || !A) return;
    const d = D();
    switch (a.dataset.ract) {
      case 'sound': d.settings.sound = !d.settings.sound; a.classList.toggle('on', d.settings.sound); return A.save();
      case 'wake': d.settings.wake = !d.settings.wake; a.classList.toggle('on', d.settings.wake); return A.save();
      case 'test': a.classList.add('play'); [0, .6, 1.2].forEach(t => beep(880, t)); beep(1320, 1.8); setTimeout(() => a.classList.remove('play'), 2100);
        if (!d.settings.sound) toast('Les bips sont coupés pendant les séances'); return;
      case 'theme': { d.settings.theme = a.dataset.k; A.save(); UI.applyTheme(d.settings.theme, true);
        const i = ['dark', 'light', 'auto'].indexOf(a.dataset.k); a.parentElement.querySelector('.pill').style.transform = `translateX(${i * 100}%)`;
        a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === a)); return; }
      case 'export': return exportData();
      case 'import': { const f = $('#rfile'); f.value = ''; f.onchange = ev => importFile(ev.target.files[0]); return f.click(); }
      case 'del': return askDelete();
      case 'dclose': return closeDel();
    }
  });

  window.Reglages = { init(api) { A = api; }, render, leave() { closeDel(); } };
})();
