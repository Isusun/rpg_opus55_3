'use strict';
// =============================================================
// コア: ユーティリティ / 保存領域 / 設定 / ステートマシン / ゲーム状態 / セーブ
// =============================================================
const Util = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  chance: (p) => Math.random() < p,
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  weighted(list, wKey) {
    const tot = list.reduce((s, e) => s + (wKey ? e[wKey] : e[0]), 0);
    let r = Math.random() * tot;
    for (const e of list) { r -= wKey ? e[wKey] : e[0]; if (r <= 0) return e; }
    return list[list.length - 1];
  },
  wait: (ms) => new Promise((res) => setTimeout(res, ms)),
  isInt: (v) => typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v,
  fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  },
  sanitizeName(s) {
    s = String(s || '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').trim();
    return Array.from(s).slice(0, 6).join('');
  },
};

// ---------- 保存領域（localStorage が使えない環境ではメモリに退避） ----------
const Store = (() => {
  let ok = true;
  const mem = {};
  try { const k = '__st_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { ok = false; }
  return {
    get available() { return ok; },
    get(k) { try { return ok ? localStorage.getItem(k) : (mem[k] ?? null); } catch (e) { return mem[k] ?? null; } },
    set(k, v) {
      try { if (ok) { localStorage.setItem(k, v); return true; } } catch (e) { /* 容量不足など */ return false; }
      mem[k] = v; return false;
    },
    remove(k) { try { if (ok) localStorage.removeItem(k); } catch (e) { /* noop */ } delete mem[k]; },
  };
})();

// ---------- 設定 ----------
const Settings = (() => {
  const KEY = 'soratomoshi.settings';
  const DEF = { bgm: false, sfx: false, bgmVol: 0.5, sfxVol: 0.6, textSpeed: 'normal', motion: 'auto', touch: 'auto' };
  const ENUMS = { textSpeed: ['slow', 'normal', 'fast', 'instant'], motion: ['auto', 'reduce', 'full'], touch: ['auto', 'show', 'hide'] };
  let s = Object.assign({}, DEF);
  function load() {
    try {
      const raw = JSON.parse(Store.get(KEY) || '{}');
      if (raw && typeof raw === 'object') {
        for (const k of Object.keys(DEF)) {
          const v = raw[k];
          if (typeof DEF[k] === 'boolean' && typeof v === 'boolean') s[k] = v;
          else if (typeof DEF[k] === 'number' && typeof v === 'number' && Number.isFinite(v)) s[k] = Util.clamp(Math.round(v * 10) / 10, 0, 1);
          else if (ENUMS[k] && ENUMS[k].includes(v)) s[k] = v;
        }
      }
    } catch (e) { s = Object.assign({}, DEF); }
  }
  function save() { Store.set(KEY, JSON.stringify(s)); }
  load();
  const listeners = [];
  return {
    get: (k) => s[k],
    set(k, v) { s[k] = v; save(); listeners.forEach((f) => f(k, v)); },
    onChange(f) { listeners.push(f); },
    ENUMS,
    reduceMotion() {
      if (s.motion === 'reduce') return true;
      if (s.motion === 'full') return false;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },
  };
})();

// ---------- ステートマシン（スタック式） ----------
class StateMachine {
  constructor(transitions) {
    this.states = {};
    this.stack = [];
    this.transitions = transitions; // { from: [to...] }
    this.log = [];
  }
  register(name, st) { this.states[name] = st; st.name = name; }
  get current() { return this.stack[this.stack.length - 1] || null; }
  get currentName() { return this.current ? this.current.name : 'none'; }
  allowed(from, to) { return !from || (this.transitions[from] || []).includes(to); }
  _check(to) {
    if (!this.states[to]) throw new Error('unknown state ' + to);
    if (!this.allowed(this.currentName === 'none' ? null : this.currentName, to)) {
      console.warn(`state transition ${this.currentName} -> ${to} not in table`);
    }
    this.log.push(`${this.currentName}->${to}`);
    if (this.log.length > 50) this.log.shift();
  }
  /** 現在の状態を捨てて遷移 */
  change(to, params) {
    this._check(to);
    while (this.stack.length) { const s = this.stack.pop(); s.exit && s.exit(); }
    const st = this.states[to];
    this.stack.push(st);
    st.enter && st.enter(params);
  }
  /** 現在の状態の上に積む（戦闘・イベントなど） */
  push(to, params) {
    this._check(to);
    const cur = this.current;
    cur && cur.pause && cur.pause();
    const st = this.states[to];
    this.stack.push(st);
    st.enter && st.enter(params);
  }
  pop() {
    const st = this.stack.pop();
    st && st.exit && st.exit();
    const cur = this.current;
    if (cur) this.log.push(`${st ? st.name : '?'}->${cur.name}(pop)`);
    cur && cur.resume && cur.resume();
  }
  is(name) { return this.stack.some((s) => s.name === name); }
}

// ---------- パーティ／キャラクター ----------
const Party = {
  newChar(name, cls, lv, isHero) {
    lv = lv || 1;
    const c = {
      id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      name, cls, lv, exp: DATA.totalExpFor(lv), hp: 1, mp: 0,
      status: {}, equip: { weapon: null, armor: null, shield: null, acc: null }, bonus: {}, hero: !!isHero,
    };
    const starter = { warrior: ['copper_sword', 'travel_cloth', 'leather_shield'], knight: ['copper_sword', 'travel_cloth', 'leather_shield'],
      mage: ['wand', 'cloth'], priest: ['wand', 'cloth', 'leather_shield'], thief: ['dagger', 'travel_cloth'], monk: ['iron_claw', 'travel_cloth'] }[cls] || [];
    for (const it of starter) c.equip[DATA.ITEMS[it].type] = it;
    const st = Party.stats(c);
    c.hp = st.hp; c.mp = st.mp;
    return c;
  },
  baseStats(c) {
    const cl = DATA.CLASSES[c.cls];
    const o = {};
    for (const k of DATA.STAT_KEYS) o[k] = Math.floor(cl.base[k] + cl.grow[k] * (c.lv - 1) + (c.bonus[k] || 0));
    return o;
  },
  stats(c) {
    const o = Party.baseStats(c);
    for (const slot of ['weapon', 'armor', 'shield', 'acc']) {
      const it = c.equip[slot] && DATA.ITEMS[c.equip[slot]];
      if (!it) continue;
      for (const k of ['atk', 'def', 'int', 'agi', 'luk']) if (it[k]) o[k] += it[k];
    }
    for (const k of DATA.STAT_KEYS) o[k] = Util.clamp(o[k], 0, DATA.STAT_CAP);
    o.hp = Math.max(1, o.hp);
    return o;
  },
  resists(c) {
    const r = new Set(); const imm = new Set();
    for (const slot of ['weapon', 'armor', 'shield', 'acc']) {
      const it = c.equip[slot] && DATA.ITEMS[c.equip[slot]];
      if (!it) continue;
      if (it.resist) r.add(it.resist);
      (it.immune || []).forEach((s) => imm.add(s));
    }
    return { resist: r, immune: imm };
  },
  weaponElem(c) { const w = c.equip.weapon && DATA.ITEMS[c.equip.weapon]; return (w && w.elem) || 'none'; },
  skills(c) { return DATA.CLASSES[c.cls].skills.filter(([lv]) => lv <= c.lv).map(([, id]) => id); },
  canEquip(c, itemId) { const it = DATA.ITEMS[itemId]; return !!(it && it.eq && it.eq.includes(c.cls)); },
  alive(c) { return c.hp > 0; },
  clampHpMp(c) {
    const st = Party.stats(c);
    c.hp = Util.clamp(c.hp, 0, st.hp); c.mp = Util.clamp(c.mp, 0, st.mp);
  },
  fullHeal(c) { const st = Party.stats(c); c.hp = st.hp; c.mp = st.mp; c.status = {}; },
  /** 経験値加算。レベルアップ情報の配列を返す */
  gainExp(c, n) {
    const ups = [];
    if (c.lv >= DATA.LV_CAP) return ups;
    c.exp += n;
    while (c.lv < DATA.LV_CAP && c.exp >= DATA.totalExpFor(c.lv + 1)) {
      const before = Party.stats(c);
      const beforeSkills = new Set(Party.skills(c));
      c.lv++;
      const after = Party.stats(c);
      // 上がった最大値の分だけ現在値も回復
      c.hp = Math.min(after.hp, c.hp + (after.hp - before.hp));
      c.mp = Math.min(after.mp, c.mp + (after.mp - before.mp));
      const learned = Party.skills(c).filter((s) => !beforeSkills.has(s));
      const diff = {};
      for (const k of DATA.STAT_KEYS) diff[k] = after[k] - before[k];
      ups.push({ lv: c.lv, diff, learned });
    }
    if (c.lv >= DATA.LV_CAP) c.exp = Math.min(c.exp, DATA.totalExpFor(DATA.LV_CAP));
    return ups;
  },
  expToNext(c) { return c.lv >= DATA.LV_CAP ? 0 : DATA.totalExpFor(c.lv + 1) - c.exp; },
};

// ---------- ゲーム状態 ----------
const Game = {
  s: null,
  newState() {
    return {
      version: 1, map: 'lanta', x: 6, y: 5, dir: 'up', gold: 120, roster: [], party: [],
      inv: { herb: 4, antidote: 1, feather: 1 }, flags: {}, rocks: {}, lastTown: 'lanta', visited: ['lanta'],
      steps: 0, repel: 0, playTime: 0, encCounter: 20, savedAt: 0,
    };
  },
  get party() { return this.s.party.map((id) => this.s.roster.find((c) => c.id === id)).filter(Boolean); },
  get reserve() { return this.s.roster.filter((c) => !this.s.party.includes(c.id)); },
  flag(f) { return !!this.s.flags[f]; },
  setFlag(f, v) { if (v === false) delete this.s.flags[f]; else this.s.flags[f] = true; },
  has(item) { return (this.s.inv[item] || 0) > 0; },
  count(item) { return this.s.inv[item] || 0; },
  addItem(item, n) {
    n = n || 1;
    const cur = this.s.inv[item] || 0;
    const room = 99 - cur;
    const add = Math.max(0, Math.min(room, n));
    if (add > 0) this.s.inv[item] = cur + add;
    return add; // 実際に増えた数
  },
  removeItem(item, n) {
    n = n || 1;
    const cur = this.s.inv[item] || 0;
    if (cur < n) return false;
    if (cur - n <= 0) delete this.s.inv[item]; else this.s.inv[item] = cur - n;
    return true;
  },
  orbs() { let n = 0; for (let i = 1; i <= 6; i++) if (this.has('orb' + i)) n++; return n; },
  /** 条件式: 'flag' '!flag' 'item:x' 'orbs>=6' を & で連結 */
  cond(expr) {
    if (!expr) return true;
    return String(expr).split('&').every((t) => {
      t = t.trim();
      let neg = false;
      if (t.startsWith('!')) { neg = true; t = t.slice(1); }
      let v;
      if (t.startsWith('item:')) v = this.has(t.slice(5));
      else if (t.startsWith('orbs>=')) v = this.orbs() >= parseInt(t.slice(6), 10);
      else v = this.flag(t);
      return neg ? !v : v;
    });
  },
  avgLevel() { const p = this.party; return p.length ? p.reduce((s, c) => s + c.lv, 0) / p.length : 1; },
};

// ---------- セーブ／ロード（検証つき） ----------
const SaveSys = {
  KEY: (n) => 'soratomoshi.save.' + n,
  SLOTS: 3,
  write(n) {
    Game.s.savedAt = Date.now();
    const ok = Store.set(this.KEY(n), JSON.stringify(Game.s));
    return ok && Store.available;
  },
  /** スロットの概要（壊れていれば broken:true） */
  peek(n) {
    const raw = Store.get(this.KEY(n));
    if (!raw) return null;
    try {
      const s = this.sanitize(JSON.parse(raw));
      const hero = s.roster.find((c) => c.hero) || s.roster[0];
      return { ok: true, name: hero.name, lv: hero.lv, map: s.map, time: s.playTime, orbs: [1, 2, 3, 4, 5, 6].filter((i) => s.inv['orb' + i]).length, savedAt: s.savedAt };
    } catch (e) {
      return { ok: false, broken: true };
    }
  },
  load(n) {
    const raw = Store.get(this.KEY(n));
    if (!raw) throw new Error('empty');
    return this.sanitize(JSON.parse(raw));
  },
  remove(n) { Store.remove(this.KEY(n)); },
  /** 外部データを検証し、安全なゲーム状態を返す。致命的な不整合は例外 */
  sanitize(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('not object');
    if (d.version !== 1) throw new Error('version');
    const s = Game.newState();
    const mapsAll = MAPS.MAPS;
    if (!Array.isArray(d.roster) || d.roster.length === 0 || d.roster.length > DATA.ROSTER_MAX) throw new Error('roster');
    const ids = new Set();
    s.roster = d.roster.map((c) => {
      if (!c || typeof c !== 'object') throw new Error('char');
      if (!DATA.CLASSES[c.cls]) throw new Error('cls');
      if (typeof c.id !== 'string' || ids.has(c.id)) throw new Error('id');
      ids.add(c.id);
      const lv = Util.isInt(c.lv) ? Util.clamp(c.lv, 1, DATA.LV_CAP) : 1;
      const ch = {
        id: c.id, name: Util.sanitizeName(c.name) || '？', cls: c.cls, lv,
        exp: Util.isInt(c.exp) ? Util.clamp(c.exp, DATA.totalExpFor(lv), DATA.totalExpFor(Math.min(DATA.LV_CAP, lv + 1))) : DATA.totalExpFor(lv),
        hp: 0, mp: 0, status: {}, equip: { weapon: null, armor: null, shield: null, acc: null }, bonus: {}, hero: !!c.hero,
      };
      if (c.equip && typeof c.equip === 'object') {
        for (const slot of Object.keys(ch.equip)) {
          const it = c.equip[slot];
          if (it && DATA.ITEMS[it] && DATA.ITEMS[it].type === slot && DATA.ITEMS[it].eq.includes(ch.cls)) ch.equip[slot] = it;
        }
      }
      if (c.bonus && typeof c.bonus === 'object') {
        for (const k of DATA.STAT_KEYS) if (Util.isInt(c.bonus[k])) ch.bonus[k] = Util.clamp(c.bonus[k], 0, 99);
      }
      if (c.status && c.status.poison === true) ch.status.poison = true;
      const st = Party.stats(ch);
      ch.hp = Util.isInt(c.hp) ? Util.clamp(c.hp, 0, st.hp) : st.hp;
      ch.mp = Util.isInt(c.mp) ? Util.clamp(c.mp, 0, st.mp) : st.mp;
      return ch;
    });
    if (!s.roster.some((c) => c.hero)) s.roster[0].hero = true;
    s.party = Array.isArray(d.party) ? d.party.filter((id, i, a) => ids.has(id) && a.indexOf(id) === i).slice(0, DATA.PARTY_MAX) : [];
    if (!s.party.length) s.party = [s.roster[0].id];
    const hero = s.roster.find((c) => c.hero);
    if (!s.party.includes(hero.id)) { if (s.party.length >= DATA.PARTY_MAX) s.party.pop(); s.party.unshift(hero.id); }
    s.gold = Util.isInt(d.gold) ? Util.clamp(d.gold, 0, 9999999) : 0;
    s.inv = {};
    if (d.inv && typeof d.inv === 'object') {
      for (const [k, v] of Object.entries(d.inv)) if (DATA.ITEMS[k] && Util.isInt(v) && v > 0) s.inv[k] = Math.min(99, v);
    }
    s.flags = {};
    if (d.flags && typeof d.flags === 'object') for (const [k, v] of Object.entries(d.flags)) if (v === true && k.length < 80) s.flags[k] = true;
    s.rocks = {};
    s.lastTown = DATA.TOWNS[d.lastTown] ? d.lastTown : 'lanta';
    s.visited = Array.isArray(d.visited) ? d.visited.filter((t) => DATA.TOWNS[t]) : ['lanta'];
    if (!s.visited.includes('lanta')) s.visited.unshift('lanta');
    s.playTime = typeof d.playTime === 'number' && d.playTime >= 0 ? Math.min(d.playTime, 360000 * 10) : 0;
    s.steps = Util.isInt(d.steps) && d.steps >= 0 ? d.steps : 0;
    s.repel = Util.isInt(d.repel) ? Util.clamp(d.repel, 0, 200) : 0;
    s.encCounter = Util.isInt(d.encCounter) ? Util.clamp(d.encCounter, 1, 60) : 20;
    s.savedAt = Util.isInt(d.savedAt) ? d.savedAt : 0;
    s.dir = ['up', 'down', 'left', 'right'].includes(d.dir) ? d.dir : 'down';
    // 位置の検証（不正なら最後の町へ）
    const m = mapsAll[d.map];
    const okPos = m && Util.isInt(d.x) && Util.isInt(d.y) && d.x >= 0 && d.y >= 0 && d.x < m.w && d.y < m.h && !(MAPS.LEGEND[m.grid[d.y][d.x]] || {}).block;
    if (okPos) { s.map = d.map; s.x = d.x; s.y = d.y; }
    else { const t = SaveSys.townArrival(s.lastTown); s.map = t.map; s.x = t.x; s.y = t.y; }
    return s;
  },
  /** 町の入口（全滅時・帰り鳥の羽） */
  townArrival(townId) {
    const t = DATA.TOWNS[townId] || DATA.TOWNS.lanta;
    const map = MAPS.MAPS[townId];
    const e = map && map.entities.find((x) => x.mark === 'entry');
    if (e) return { map: townId, x: e.x, y: e.y };
    return { map: t.map, x: t.x, y: t.y };
  },
};

if (typeof module !== 'undefined') module.exports = { Util, StateMachine, Party, Game, SaveSys };
