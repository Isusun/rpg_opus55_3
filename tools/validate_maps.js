// マップ検証: 行長・未知記号・到達可能性・ワープ先の妥当性
const { T } = require('../js/text.js');
global.TEXT = require('../js/text.js').TEXT;
const DATA = require('../js/data.js');
const MAPS = require('../js/maps.js');
const M = MAPS.MAPS;
let errors = 0;
for (const w of MAPS.warnings) { console.log('WARN', w); errors++; }
function blockedTile(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  const L = MAPS.LEGEND[map.grid[y][x]];
  return !L || L.block;
}
const BLOCK_ENT = new Set(['npc', 'chest', 'sign', 'spring', 'boss', 'door', 'gate', 'rock']);
function bfs(map, starts, opts) {
  const seen = new Set();
  const q = [...starts];
  const entAt = {};
  for (const e of map.entities) {
    if (e.type === 'bridge') continue;
    (entAt[e.x + ',' + e.y] = entAt[e.x + ',' + e.y] || []).push(e);
  }
  const bridges = new Set(map.entities.filter((e) => e.type === 'bridge').map((e) => e.x + ',' + e.y));
  const reached = new Set();
  for (const s of q) { seen.add(s[0] + ',' + s[1]); (entAt[s[0] + ',' + s[1]] || []).forEach((e) => reached.add(e)); }
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k)) continue;
      const ents = entAt[k] || [];
      ents.forEach((e) => reached.add(e));
      let blocked = blockedTile(map, nx, ny) && !(opts.bridges && bridges.has(k));
      for (const e of ents) {
        if (!BLOCK_ENT.has(e.type)) continue;
        if (opts.open && ['door', 'gate', 'boss', 'rock'].includes(e.type)) continue;
        if (e.type === 'rock' || (e.type === 'boss' && opts.flags)) continue;
        if (e.type === 'gate' && opts.flags && e.openIf.split('&').every((f) => f.startsWith('!') ? true : opts.flags.has(f))) continue;
        if (e.type === 'door' && opts.keys && opts.keys.has(e.key)) continue;
        if (e.hideIf && opts.hideAll) continue;
        blocked = true;
      }
      if (e => 0, blocked) continue;
      seen.add(k);
      if (ents.some((e) => e.type === 'warp') && !opts.throughWarps) continue;
      q.push([nx, ny]);
    }
  }
  return reached;
}
function arrivals(map) {
  const s = [];
  for (const e of map.entities) if (e.type === 'warp' || e.type === 'mark') s.push([e.x, e.y]);
  return s;
}
for (const map of Object.values(M)) {
  // ワープ先の妥当性
  for (const e of map.entities) {
    if (e.type === 'warp') {
      const t = M[e.to];
      if (!t) { console.log('ERR', map.id, 'warp to unknown', e.to); errors++; continue; }
      let pos = null;
      if (Array.isArray(e.at)) pos = e.at;
      else { const m = t.entities.find((x) => x.mark === e.at); if (m) pos = [m.x, m.y]; }
      if (!pos) { console.log('ERR', map.id, 'warp mark missing', e.to, e.at); errors++; continue; }
      if (blockedTile(t, pos[0], pos[1])) { console.log('ERR', map.id, '->', e.to, 'arrival blocked', pos); errors++; }
    }
    if (e.type === 'chest' && e.item && !DATA.ITEMS[e.item]) { console.log('ERR', map.id, 'bad item', e.item); errors++; }
    if (e.type === 'boss' && !DATA.BOSS_GROUPS[e.group]) { console.log('ERR', map.id, 'bad group', e.group); errors++; }
    if (e.sprite && typeof e.sprite === 'string') {
      const fs = require('fs');
      if (!fs.existsSync(__dirname + '/../assets/img/' + e.sprite + '.png')) { console.log('ERR', map.id, 'missing sprite', e.sprite); errors++; }
    }
  }
  if (map.exit) {
    const t = M[map.exit.to];
    if (!t || blockedTile(t, map.exit.x, map.exit.y) && !t.entities.some((e) => e.x === map.exit.x && e.y === map.exit.y)) { console.log('ERR', map.id, 'exit bad'); errors++; }
  }
  // 到達可能性（全ギミック解決後）
  const starts = arrivals(map);
  const reached = bfs(map, starts, { open: true, bridges: true, hideAll: true });
  for (const e of map.entities) {
    if (['mark', 'bridge'].includes(e.type)) continue;
    if (!reached.has(e)) { console.log('UNREACHABLE', map.id, e.type, e.mark || e.label || e.name || '', e.x, e.y); errors++; }
  }
  // ギミック未解決時: スイッチ・鍵の宝箱に届くか
  const st2 = map.entities.filter((e) => e.mark === '<' || e.mark === 'entry').map((e) => [e.x, e.y]);
  const flags = new Set(), keys = new Set();
  let r2;
  for (let it = 0; it < 6; it++) {
    r2 = bfs(map, st2.length ? st2 : starts.slice(0, 1), { open: false, hideAll: false, flags, keys });
    for (const e of r2) { if (e.type === 'switch') flags.add(e.flag); if (e.type === 'chest' && e.item) keys.add(e.item); }
  }
  for (const e of map.entities) {
    if (map.id !== 'ow' && (e.type === 'warp' || e.type === 'boss') && !r2.has(e)) { console.log('SOLVE-UNREACHABLE', map.id, e.type, e.mark, e.x, e.y); errors++; }
    if ((e.type === 'switch' && !e.behindGate) || (e.type === 'chest' && e.item && DATA.ITEMS[e.item].type === 'key')) {
      if (!r2.has(e)) { console.log('GATED', map.id, e.type, e.item || e.flag, e.x, e.y); errors++; }
    }
  }
}
// エンカウントテーブルの敵ID
for (const [k, v] of Object.entries(DATA.ENCOUNTERS)) for (const [, g] of v.groups) for (const id of g) if (!DATA.ENEMIES[id]) { console.log('ERR enc', k, id); errors++; }
for (const e of Object.values(DATA.ENEMIES)) {
  const fs = require('fs');
  if (!fs.existsSync(__dirname + '/../assets/img/' + e.sprite + '.png')) { console.log('ERR enemy sprite', e.id, e.sprite); errors++; }
  for (const a of e.ai) if (a.act !== 'attack' && !DATA.SKILLS[a.act]) { console.log('ERR ai', e.id, a.act); errors++; }
}
for (const c of Object.values(DATA.CLASSES)) for (const [, s] of c.skills) if (!DATA.SKILLS[s]) { console.log('ERR skill', s); errors++; }
for (const s of Object.values(DATA.SHOPS)) for (const i of s.items) if (!DATA.ITEMS[i]) { console.log('ERR shop item', i); errors++; }
console.log(errors ? `${errors} problems` : 'maps OK');
process.exit(errors ? 1 : 0);
