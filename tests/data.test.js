// Tests de la logique des données. Lancer : node tests/data.test.js
'use strict';
const assert = require('assert');
const B = require('../js/data.js');

let n = 0, fails = 0;
function test(name, fn) { n++; try { fn(); console.log('  ✓ ' + name); } catch (e) { fails++; console.log('  ✗ ' + name + '\n      ' + e.message); } }
const fakeStore = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const DAY = 864e5, T0 = new Date(2026, 10, 16, 9, 0).getTime();
// fabrique une séance au jour d (0 = 16 nov.) avec des résultats [item, key, v, extra]
function ses(data, d, type, res) {
  const s = { id: T0 + d * DAY, type, start: T0 + d * DAY, end: T0 + d * DAY + 40 * 60e3,
    res: res.map(([item, key, v, x]) => Object.assign({ item, key, v }, x || {})) };
  data.sessions.push(s); return s;
}
const I = B.ITEM;

console.log('Stockage');
test('une sauvegarde vide se recharge à l\'identique', () => {
  const st = fakeStore(), d = B.blank(); d.manual[12] = 5; B.save(d, st);
  assert.deepStrictEqual(B.load(st), d);
});
test('un stockage vide ou d\'une autre version donne une base neuve', () => {
  const st = fakeStore(); assert.deepStrictEqual(B.load(st), B.blank());
  st.setItem(B.KEY, JSON.stringify({ v: 1, sessions: [1] })); assert.deepStrictEqual(B.load(st).sessions, []);
});
test('un JSON cassé ne fait pas planter l\'app', () => {
  const st = fakeStore(); st.setItem(B.KEY, '{pas du json'); assert.deepStrictEqual(B.load(st).sessions, []);
});

console.log('Validation « 2 séances de suite »');
test('lancers : 2 séances réussies de suite = validé', () => {
  const d = B.blank();
  ses(d, 0, 'A', [[1, 'ft', 7], [1, 'ft', 7], [1, 'ft', 8]]);
  ses(d, 3, 'A', [[1, 'ft', 8], [1, 'ft', 6], [1, 'ft', 8]]); // moyenne 7,33
  assert.strictEqual(B.status(d, I(1)).st, 'ok');
});
test('lancers : réussi, raté, réussi = 1 sur 2, pas validé', () => {
  const d = B.blank();
  ses(d, 0, 'A', [[1, 'ft', 8], [1, 'ft', 8], [1, 'ft', 8]]);
  ses(d, 3, 'A', [[1, 'ft', 5], [1, 'ft', 5], [1, 'ft', 5]]);
  ses(d, 7, 'A', [[1, 'ft', 9], [1, 'ft', 9], [1, 'ft', 9]]);
  assert.strictEqual(B.status(d, I(1)).st, 'half');
});
test('lancers : 2 séries seulement ne valident pas le test', () => {
  const d = B.blank(); ses(d, 0, 'A', [[1, 'ft', 9], [1, 'ft', 9]]);
  assert.strictEqual(B.evalItem(I(1), d.sessions[0]).pass, false);
});
test('une séance B entre deux A ne casse pas la suite (seules les séances où l\'item est fait comptent)', () => {
  const d = B.blank();
  ses(d, 0, 'A', [[1, 'ft', 8], [1, 'ft', 8], [1, 'ft', 8]]);
  ses(d, 2, 'B', [[4, 'js', 5]]);
  ses(d, 4, 'A', [[1, 'ft', 7], [1, 'ft', 7], [1, 'ft', 7]]);
  assert.strictEqual(B.status(d, I(1)).st, 'ok');
});
test('validé reste validé même après une séance ratée', () => {
  const d = B.blank();
  ses(d, 0, 'B', [[4, 'js', 6]]); ses(d, 3, 'B', [[4, 'js', 5]]); ses(d, 7, 'B', [[4, 'js', 1]]);
  assert.strictEqual(B.status(d, I(4)).st, 'ok');
});
test('mi-distance : il faut 7/10 aux 3 spots', () => {
  const d = B.blank(); const s = ses(d, 0, 'A', [[2, 'face', 9], [2, 'g', 7], [2, 'd', 6]]);
  assert.strictEqual(B.evalItem(I(2), s).pass, false);
  const s2 = ses(d, 3, 'A', [[2, 'face', 7], [2, 'g', 7], [2, 'd', 7]]);
  assert.strictEqual(B.evalItem(I(2), s2).pass, true);
});
test('3 points : 2 spots à 3/10 = réussi, 1 seul spot = raté', () => {
  const d = B.blank();
  assert.strictEqual(B.evalItem(I(3), ses(d, 0, 'A', [[3, 'cg', 3], [3, 'face', 4]])).pass, true);
  assert.strictEqual(B.evalItem(I(3), ses(d, 3, 'A', [[3, 'cg', 5]])).pass, false);
});
test('3 points : 2 spots différents parmi les 5, les mêmes toute la journée', () => {
  const d = B.blank(), K = ['cg', 'ag', 'face', 'ad', 'cd'];
  const p = B.pick3pt(d, T0); assert.strictEqual(p.length, 2); assert.notStrictEqual(p[0], p[1]); assert.ok(p.every(k => K.includes(k)));
  assert.deepStrictEqual(B.pick3pt(d, T0 + 5 * 3600e3), p);                 // le brief et la séance tombent pareil
});
test('3 points : le tirage varie selon les jours (pas toujours corner G + face)', () => {
  const d = B.blank(), seen = new Set();
  for (let i = 0; i < 30; i++) seen.add(B.pick3pt(d, T0 + i * DAY).join('+'));
  assert.ok(seen.size >= 5, 'seulement ' + seen.size + ' combinaisons');
});
test('3 points : les spots déjà tirés laissent la place aux autres', () => {
  const d = B.blank(); ses(d, 0, 'A', [[3, 'cg', 2], [3, 'face', 2]]); ses(d, 3, 'A', [[3, 'ag', 2], [3, 'cd', 2]]);
  const p = B.pick3pt(d, T0 + 7 * DAY);
  assert.ok(p.includes('ad'), 'le 45° D, jamais tiré, doit passer : ' + p);
  assert.ok(!p.includes('ag') && !p.includes('cd'), 'pas les 2 de la dernière séance : ' + p);
});
test('3 points : l\'avancée ne compte que les spots déjà tirés', () => {
  const d = B.blank(); ses(d, 0, 'A', [[3, 'cg', 3], [3, 'face', 3]]);
  assert.strictEqual(B.progress(d, I(3)), 1);
});
test('layups : 9/10 des deux côtés', () => {
  const d = B.blank();
  assert.strictEqual(B.evalItem(I(9), ses(d, 0, 'A', [[9, 'd', 10], [9, 'g', 8]])).pass, false);
  assert.strictEqual(B.evalItem(I(9), ses(d, 3, 'A', [[9, 'd', 9], [9, 'g', 9]])).pass, true);
});

console.log('Moves : niveaux immobile → marche → course (valeurs stockées = réussis sur 10)');
test('au début : seulement immobile, noté', () => {
  assert.deepStrictEqual(B.moveLevels(B.blank(), I(6)), [{ key: 'imm', role: 'test' }]);
});
test('immobile validé (2 × 10/10) : immobile en entretien, marche notée', () => {
  const d = B.blank(); ses(d, 0, 'B', [[6, 'imm', 10]]); ses(d, 3, 'B', [[6, 'imm', 10]]);
  assert.deepStrictEqual(B.moveLevels(d, I(6)), [{ key: 'imm', role: 'entretien' }, { key: 'walk', role: 'test' }]);
});
test('10, 8, 10 réussis : pas 2 de suite, le niveau n\'est pas validé', () => {
  const d = B.blank(); ses(d, 0, 'B', [[6, 'imm', 10]]); ses(d, 3, 'B', [[6, 'imm', 8]]); ses(d, 7, 'B', [[6, 'imm', 10]]);
  assert.strictEqual(B.subStatus(d, I(6), 'imm'), 'half');
});
test('tout validé : marche + course en entretien', () => {
  const d = B.blank();
  ses(d, 0, 'B', [[7, 'imm', 10], [7, 'walk', 10], [7, 'run', 10]]); ses(d, 3, 'B', [[7, 'imm', 10], [7, 'walk', 10], [7, 'run', 10]]);
  assert.deepStrictEqual(B.moveLevels(d, I(7)), [{ key: 'walk', role: 'entretien' }, { key: 'run', role: 'entretien' }]);
  assert.strictEqual(B.status(d, I(7)).st, 'ok');
});
test('le test du move = 10/10 en marche ET en course (l\'immobile ne compte pas)', () => {
  const d = B.blank();
  assert.strictEqual(B.evalItem(I(8), ses(d, 0, 'B', [[8, 'imm', 7], [8, 'walk', 10], [8, 'run', 10]])).pass, true);
  assert.strictEqual(B.evalItem(I(8), ses(d, 3, 'B', [[8, 'walk', 10]])).pass, false);
});
test('l\'objectif est atteignable : 10 réussis saisis → 10 stockés → test réussi', () => {
  const d = B.blank(); B.startSession(d, 'B', T0);
  B.record(d, { item: 6, key: 'imm', v: 10, s: 1 }); // ce qu'enregistre l'écran de saisie (10/10, 0 perte)
  const s = B.finishSession(d, T0 + 30 * 60e3);
  assert.strictEqual(s.res[0].v, 10); assert.strictEqual(B.subStatus(d, I(6), 'imm'), 'half');
});
test('les données du 19/11 (1, 4, 6 pertes tapées dans l\'ancien écran, stockées 10 − n) se lisent 9, 6, 4 réussis', () => {
  const d = B.blank(); B.startSession(d, 'B', T0);
  [[6, 1], [7, 4], [8, 6]].forEach(([item, loss], i) => B.record(d, { item, key: 'imm', v: 10 - loss, s: i + 1 }));
  B.finishSession(d, T0 + 30 * 60e3);
  assert.deepStrictEqual([6, 7, 8].map(id => B.lastSub(d, I(id), 'imm')), [9, 6, 4]);
  assert.deepStrictEqual([6, 7, 8].map(id => B.best(d, I(id), 'imm')), [9, 6, 4]);
});

console.log('Défense, ailier, sprints');
test('défense : faite à 2 séances = validée', () => {
  const d = B.blank(); ses(d, 0, 'A', [[11, 'def', 1]]);
  assert.strictEqual(B.status(d, I(11)).st, 'half');
  ses(d, 3, 'B', [[11, 'def', 1]]);
  assert.strictEqual(B.status(d, I(11)).st, 'ok');
});
test('ailier : validé à la main', () => {
  const d = B.blank(); assert.strictEqual(B.status(d, I(12)).st, 'todo');
  d.manual[12] = T0; assert.strictEqual(B.status(d, I(12)).st, 'ok');
});
test('sprints : records séparés par distance, le plus petit temps gagne', () => {
  const d = B.blank();
  ses(d, 0, 'B', [[13, 'half', 9.6], [13, 'half', 9.4], [13, 'half', 9.9]]);
  ses(d, 3, 'B', [[14, 'full', 18.2]]);
  assert.strictEqual(B.best(d, I(13), 'half'), 9.4);
  assert.strictEqual(B.best(d, I(14), 'full'), 18.2);
  assert.strictEqual(B.status(d, I(13)).st, 'track');
});
test('sprints : 1 demi + 2 entiers dans la même séance, les 3 gardés, chaque distance à part', () => {
  const d = B.blank(); const s = ses(d, 0, 'B', [[13, 'half', 9.0], [14, 'full', 18.4], [14, 'full', 17.9]]);
  assert.strictEqual(s.res.length, 3);
  assert.strictEqual(B.evalItem(I(13), s).val, 9.0);
  assert.deepStrictEqual(B.evalItem(I(14), s).all, [18.4, 17.9]);
  assert.strictEqual(B.evalItem(I(14), s).val, 17.9);
  assert.strictEqual(B.best(d, I(13), 'half'), 9.0); assert.strictEqual(B.best(d, I(14), 'full'), 17.9);
});
test('sprints : un nombre de séries variable (0 à 4) et de distances par séance ne casse rien', () => {
  const d = B.blank();
  ses(d, 0, 'B', [[13, 'half', 9.6]]);
  ses(d, 3, 'B', [[14, 'full', 18.0], [14, 'full', 18.5], [14, 'full', 17.6], [13, 'half', 9.9]]);
  ses(d, 7, 'B', [[4, 'js', 5]]);                                            // pas de sprint ce jour-là
  const s4 = ses(d, 10, 'B', [[13, 'half', 9.1], [13, 'half', 9.4]]);
  assert.deepStrictEqual(B.history(d, I(13)).map(x => x.e.val), [9.6, 9.9, 9.1]);
  assert.deepStrictEqual(B.history(d, I(14)).map(x => x.e.val), [17.6]);
  assert.strictEqual(B.isRecord(d, I(13), 'half', s4), true);
  assert.strictEqual(B.isRecord(d, I(14), 'full', s4), false);
});

console.log('Records');
test('la 1re fois n\'est pas un record ; faire mieux en est un', () => {
  const d = B.blank(); const a = ses(d, 0, 'A', [[4, 'js', 4]]); const b = ses(d, 3, 'A', [[4, 'js', 6]]); const c = ses(d, 7, 'A', [[4, 'js', 5]]);
  assert.strictEqual(B.isRecord(d, I(4), 'js', a), false);
  assert.strictEqual(B.isRecord(d, I(4), 'js', b), true);
  assert.strictEqual(B.isRecord(d, I(4), 'js', c), false);
});
test('moves : plus de réussis = record ; temps : moins = record', () => {
  const d = B.blank(); ses(d, 0, 'B', [[6, 'run', 6], [5, 'gauche', 34.3]]); const s = ses(d, 3, 'B', [[6, 'run', 8], [5, 'gauche', 33.1]]);
  assert.strictEqual(B.isRecord(d, I(6), 'run', s), true);
  assert.strictEqual(B.isRecord(d, I(5), 'gauche', s), true);
});

console.log('Records provisoires (séance en cours)');
test('au 3e sprint, les 2 premiers de la séance comptent déjà (9 s puis 7,2 s)', () => {
  const d = B.blank(); ses(d, 0, 'B', [[13, 'half', 9.6]]);
  B.startSession(d, 'B', T0 + 3 * DAY);
  B.record(d, { item: 13, key: 'half', v: 9.0, s: 20 });
  assert.deepStrictEqual(B.liveBest(d, I(13), 'half'), { v: 9.0, live: true, saved: 9.6 });
  B.record(d, { item: 13, key: 'half', v: 7.2, s: 22 });
  assert.strictEqual(B.liveBest(d, I(13), 'half').v, 7.2);
  assert.strictEqual(B.liveLast(d, I(13), 'half'), 7.2);
  assert.strictEqual(B.best(d, I(13), 'half'), 9.6, 'rien n\'est écrit dans les vrais records avant la fin');
});
test('record provisoire : aucun record avant → la séance en cours le donne', () => {
  const d = B.blank(); B.startSession(d, 'B', T0); B.record(d, { item: 13, key: 'half', v: 9.0, s: 20 });
  assert.deepStrictEqual(B.liveBest(d, I(13), 'half'), { v: 9.0, live: true, saved: null });
});
test('record provisoire : moins bien que le record → le vrai record reste affiché', () => {
  const d = B.blank(); ses(d, 0, 'B', [[13, 'half', 8.0]]); B.startSession(d, 'B', T0 + DAY); B.record(d, { item: 13, key: 'half', v: 9.0, s: 20 });
  assert.deepStrictEqual(B.liveBest(d, I(13), 'half'), { v: 8.0, live: false, saved: 8.0 });
});
test('record provisoire : demi et entier ne se mélangent pas', () => {
  const d = B.blank(); B.startSession(d, 'B', T0); B.record(d, { item: 13, key: 'half', v: 7.2, s: 20 });
  assert.strictEqual(B.liveBest(d, I(14), 'full').v, null);
});
test('record provisoire : revenir à l\'étape précédente le recalcule', () => {
  const d = B.blank(); B.startSession(d, 'B', T0);
  B.record(d, { item: 13, key: 'half', v: 9.0, s: 20 }); d.current.step = 22; B.record(d, { item: 13, key: 'half', v: 7.2, s: 22 }); d.current.step = 23;
  B.stepBack(d); // retour à l'étape 22 : le 7,2 s disparaît
  assert.strictEqual(B.liveBest(d, I(13), 'half').v, 9.0);
});
test('record provisoire : une séance abandonnée ne laisse rien', () => {
  const d = B.blank(); ses(d, 0, 'B', [[13, 'half', 9.6]]); B.startSession(d, 'B', T0 + DAY); B.record(d, { item: 13, key: 'half', v: 7.2, s: 20 });
  B.abandon(d);
  assert.deepStrictEqual(B.liveBest(d, I(13), 'half'), { v: 9.6, live: false, saved: 9.6 });
});
test('record provisoire : moves en réussis, le plus haut gagne', () => {
  const d = B.blank(); ses(d, 0, 'B', [[6, 'imm', 6]]); B.startSession(d, 'B', T0 + DAY); B.record(d, { item: 6, key: 'imm', v: 9, s: 5 });
  assert.strictEqual(B.liveBest(d, I(6), 'imm').v, 9); assert.strictEqual(B.liveBest(d, I(6), 'imm').live, true);
});

console.log('Avancée (anneaux de l\'accueil)');
test('rien de fait = 0 ; validé = 1 ; suivi = null', () => {
  const d = B.blank(); assert.strictEqual(B.progress(d, I(1)), 0); assert.strictEqual(B.progress(d, I(5)), null);
  ses(d, 0, 'B', [[4, 'js', 5]]); ses(d, 3, 'B', [[4, 'js', 5]]); assert.strictEqual(B.progress(d, I(4)), 1);
});
test('mi-distance : moyenne des spots, plafonnée à l\'objectif', () => {
  const d = B.blank(); ses(d, 0, 'A', [[2, 'face', 10], [2, 'g', 7], [2, 'd', 0]]);
  assert.ok(Math.abs(B.progress(d, I(2)) - 2 / 3) < 1e-9);
});
test('move : un tiers par niveau, le niveau en cours compte pour ses réussies', () => {
  const d = B.blank(); ses(d, 0, 'B', [[6, 'imm', 10]]);
  assert.ok(Math.abs(B.progress(d, I(6)) - 1 / 3) < 1e-9);              // immobile 10/10 une fois : 1/3
  ses(d, 3, 'B', [[6, 'imm', 10], [6, 'walk', 8]]);
  assert.ok(Math.abs(B.progress(d, I(6)) - (1 + 0.8) / 3) < 1e-9);      // immobile validé + marche 8/10
});

test('avancée à une date : on ne voit que les séances d\'avant', () => {
  const d = B.blank(); const a = ses(d, 0, 'B', [[4, 'js', 2]]); const b = ses(d, 3, 'B', [[4, 'js', 4]]);
  assert.ok(Math.abs(B.progressAt(d, I(4), a.start) - 0.4) < 1e-9);
  assert.ok(Math.abs(B.progressAt(d, I(4), b.start) - 0.8) < 1e-9);
});

console.log('Programme');
test('alternance A / B, A au début', () => {
  const d = B.blank(); assert.strictEqual(B.nextType(d), 'A');
  ses(d, 0, 'A', [[1, 'ft', 5]]); assert.strictEqual(B.nextType(d), 'B');
  ses(d, 3, 'B', [[4, 'js', 5]]); assert.strictEqual(B.nextType(d), 'A');
});
test('séance du jour faite', () => {
  const d = B.blank(); ses(d, 0, 'A', [[1, 'ft', 5]]);
  assert.strictEqual(B.doneToday(d, T0 + 5 * 3600e3), true);
  assert.strictEqual(B.doneToday(d, T0 + DAY), false);
});
test('J-91 le 15 novembre 2026', () => { assert.strictEqual(B.daysLeft(new Date(2026, 10, 15, 22, 0).getTime()), 91); });

console.log('Séance en cours : reprise après un refresh');
test('l\'état survit à un rechargement, le temps se recalcule', () => {
  const st = fakeStore(); let d = B.blank();
  B.startSession(d, 'A', T0); d.current.step = 5; B.record(d, { item: 1, key: 'ft', v: 7 }); B.save(d, st);
  d = B.load(st); // « refresh »
  assert.strictEqual(d.current.step, 5);
  assert.strictEqual(d.current.res.length, 1);
  assert.strictEqual(B.elapsed(d, T0 + 18 * 60e3), 18 * 60e3);
});
test('terminer une séance l\'enregistre ; une séance vide n\'est pas gardée', () => {
  const d = B.blank(); B.startSession(d, 'B', T0); B.record(d, { item: 4, key: 'js', v: 6 });
  const s = B.finishSession(d, T0 + 41 * 60e3);
  assert.strictEqual(d.sessions.length, 1); assert.strictEqual(s.end - s.start, 41 * 60e3); assert.strictEqual(d.current, null);
  B.startSession(d, 'A', T0 + DAY); assert.strictEqual(B.finishSession(d), null); assert.strictEqual(d.sessions.length, 1);
});
test('abandonner ne garde rien', () => {
  const d = B.blank(); B.startSession(d, 'A', T0); B.record(d, { item: 1, key: 'ft', v: 7 }); B.abandon(d);
  assert.strictEqual(d.current, null); assert.strictEqual(d.sessions.length, 0);
});
test('séance A : les 2 spots de 3 points sont fixés au départ', () => {
  const d = B.blank(); const sp = B.startSession(d, 'A', T0).spots; assert.strictEqual(sp.length, 2); assert.deepStrictEqual(sp, B.pick3pt(B.blank(), T0));
  assert.deepStrictEqual(B.startSession(d, 'B', T0).spots, []);
});

console.log('Déroulé des séances');
test('séance A : échauffement, 3 lancers, 3 mi-distance, 2 spots à 3 points, 2 layups, fin', () => {
  const d = B.blank(), c = B.startSession(d, 'A', T0), S = B.buildSteps(d, c);
  assert.deepStrictEqual(S.map(s => s.kind + (s.item ? ':' + s.item + (s.key ? '/' + s.key : '') : '')),
    ['warm', 'score:1/ft', 'score:1/ft', 'score:1/ft', 'score:2/face', 'score:2/g', 'score:2/d', 'score:3/' + c.spots[0], 'score:3/' + c.spots[1], 'score:9/d', 'score:9/g', 'end']);
});
test('séance B au début : slalom 1 droite + 3 gauche, chaque move en immobile seulement, layups, jump stop, 3 sprints et 2 repos', () => {
  const d = B.blank(), c = B.startSession(d, 'B', T0), S = B.buildSteps(d, c);
  const moves = S.filter(s => [6, 7, 8].includes(s.item));
  assert.deepStrictEqual(moves.map(s => s.key + ':' + s.role), ['imm:test', 'imm:test', 'imm:test']);
  assert.deepStrictEqual(S.filter(s => s.item === 5 || s.item === 15).map(s => s.item + '/' + s.key), ['15/droite', '5/gauche', '5/gauche', '5/gauche']);
  assert.strictEqual(S.filter(s => s.sprint).length, 3);
  assert.strictEqual(S.filter(s => s.kind === 'rest').length, 2);
  assert.strictEqual(S[S.length - 1].kind, 'end');
});
test('séance B : un move dont l\'immobile est validé demande immobile (entretien) puis marche (noté)', () => {
  const d = B.blank(); ses(d, 0, 'B', [[6, 'imm', 10]]); ses(d, 3, 'B', [[6, 'imm', 10]]);
  const S = B.buildSteps(d, B.startSession(d, 'B', T0 + 7 * DAY));
  assert.deepStrictEqual(S.filter(s => s.item === 6).map(s => s.key + ':' + s.role), ['imm:entretien', 'walk:test']);
});
test('les étapes ne changent pas après un refresh au milieu de la séance', () => {
  const st = fakeStore(); let d = B.blank(); ses(d, 0, 'B', [[7, 'imm', 10]]);
  const c = B.startSession(d, 'B', T0 + DAY); const before = JSON.stringify(B.buildSteps(d, c));
  c.step = 6; B.record(d, { item: 7, key: 'imm', v: 10, s: 5 }); B.save(d, st); d = B.load(st);
  assert.strictEqual(JSON.stringify(B.buildSteps(d, d.current)), before);
});
test('revenir d\'une étape enlève le score noté à cette étape', () => {
  const d = B.blank(); B.startSession(d, 'A', T0);
  B.record(d, { item: 1, key: 'ft', v: 6, s: 1 }); d.current.step = 2; B.record(d, { item: 1, key: 'ft', v: 8, s: 2 }); d.current.step = 3;
  assert.strictEqual(B.stepBack(d), true); assert.strictEqual(d.current.step, 2);
  assert.deepStrictEqual(d.current.res.map(r => r.v), [6]);
});

console.log('Migration (21/11) : ancien slalom en archive');
// une sauvegarde d'avant le 21/11 : pas de « mig », slalom en item 5 / clé « slalom », moves déjà en réussis (10 − saisie)
const OLD = () => ({ v: 2, sessions: [{ id: T0, type: 'B', start: T0, end: T0 + 32 * 60e3, res: [
  { item: 5, key: 'slalom', v: 11.2, loss: 1, s: 1 }, { item: 5, key: 'slalom', v: 10.3, loss: 0, s: 2 },
  { item: 6, key: 'imm', v: 9, s: 5 }, { item: 7, key: 'imm', v: 6, s: 6 }, { item: 8, key: 'imm', v: 4, s: 7 }, { item: 13, key: 'half', v: 7.2, s: 12 }] }],
  current: null, manual: {}, settings: {} });
test('l\'ancien slalom passe en archive (item 16), les temps et pertes tels quels', () => {
  const st = fakeStore(); st.setItem(B.KEY, JSON.stringify(OLD())); const d = B.load(st);
  assert.strictEqual(d.mig, B.MIG);
  assert.deepStrictEqual(d.sessions[0].res.filter(r => r.item === 16).map(r => [r.v, r.loss]), [[11.2, 1], [10.3, 0]]);
  assert.strictEqual(B.history(d, I(5)).length, 0, 'le nouveau slalom repart de zéro');
  assert.strictEqual(B.best(d, I(16), 'slalom'), 10.3);
});
test('migration : les moves et le sprint ne bougent pas', () => {
  const st = fakeStore(); st.setItem(B.KEY, JSON.stringify(OLD())); const d = B.load(st);
  assert.deepStrictEqual([6, 7, 8].map(id => B.lastSub(d, I(id), 'imm')), [9, 6, 4]);
  assert.strictEqual(B.best(d, I(13), 'half'), 7.2);
});
test('migration : une seule fois (un nouveau slalom gauche n\'est jamais déplacé)', () => {
  const st = fakeStore(); st.setItem(B.KEY, JSON.stringify(OLD())); let d = B.load(st);
  ses(d, 5, 'B', [[5, 'gauche', 33.0, { loss: 2 }]]); B.save(d, st); d = B.load(st);
  assert.strictEqual(B.history(d, I(5)).length, 1); assert.strictEqual(B.history(d, I(16)).length, 1);
});
test('migration : une séance en cours d\'avant la mise à jour est migrée aussi', () => {
  const o = OLD(); o.current = { type: 'B', start: T0 + DAY, step: 3, res: [{ item: 5, key: 'slalom', v: 10.0, s: 1 }], spots: [] };
  const st = fakeStore(); st.setItem(B.KEY, JSON.stringify(o));
  assert.strictEqual(B.load(st).current.res[0].item, 16);
});
test('migration : un vieil export JSON importé est migré', () => {
  const d = B.blank(), o = OLD(); o.app = 'basket';
  B.importJSON(d, JSON.stringify(o));
  assert.strictEqual(d.sessions[0].res[0].item, 16); assert.strictEqual(d.mig, B.MIG);
});
test('slalom droite et gauche : records séparés', () => {
  const d = B.blank(); ses(d, 0, 'B', [[15, 'droite', 27.0], [5, 'gauche', 33.5, { loss: 2 }], [5, 'gauche', 32.8, { loss: 3 }], [5, 'gauche', 34.0, { loss: 1 }]]);
  assert.strictEqual(B.best(d, I(15), 'droite'), 27.0); assert.strictEqual(B.best(d, I(5), 'gauche'), 32.8);
  assert.strictEqual(B.evalItem(I(5), d.sessions[0]).loss, 3); // la perte affichée est celle du meilleur passage
});

console.log('Export / import');
test('export puis import redonne les mêmes séances', () => {
  const d = B.blank(); ses(d, 0, 'A', [[1, 'ft', 7]]); d.manual[12] = T0;
  const e = B.blank(); assert.strictEqual(B.importJSON(e, B.exportJSON(d)), 1);
  assert.deepStrictEqual(e.sessions, d.sessions); assert.deepStrictEqual(e.manual, d.manual);
});
test('un fichier qui n\'est pas une sauvegarde est refusé sans rien casser', () => {
  const d = B.blank(); ses(d, 0, 'A', [[1, 'ft', 7]]);
  assert.throws(() => B.importJSON(d, '{"app":"autre"}')); assert.throws(() => B.importJSON(d, 'nope'));
  assert.strictEqual(d.sessions.length, 1);
});

console.log(`\n${n - fails}/${n} tests OK`);
process.exit(fails ? 1 : 0);
