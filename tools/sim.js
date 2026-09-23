// 戦闘バランス検証シミュレータ: 各段階の想定レベル・装備でボス／雑魚と自動対戦させ勝率を出す
global.TEXT = require('../js/text.js').TEXT;
global.T = require('../js/text.js').T;
global.DATA = require('../js/data.js');
const core = require('../js/core.js');
global.Util = core.Util; global.Party = core.Party;
const BC = require('../js/battle_core.js');
const D = DATA;

const GEAR = {
  1: { warrior: ['copper_sword', 'travel_cloth', 'leather_shield'], knight: ['copper_sword', 'travel_cloth', 'leather_shield'], mage: ['wand', 'cloth'], priest: ['wand', 'travel_cloth', 'leather_shield'], thief: ['dagger', 'travel_cloth'], monk: ['iron_claw', 'travel_cloth'] },
  2: { warrior: ['iron_sword', 'leather_armor', 'iron_shield'], knight: ['iron_sword', 'leather_armor', 'iron_shield'], mage: ['oak_staff', 'silk_robe'], priest: ['oak_staff', 'silk_robe', 'iron_shield'], thief: ['moth_knife', 'leather_armor'], monk: ['steel_claw', 'leather_armor'] },
  3: { warrior: ['steel_sword', 'iron_armor', 'steel_shield'], knight: ['steel_lance', 'iron_armor', 'steel_shield'], mage: ['sorcerer_staff', 'magic_robe'], priest: ['sorcerer_staff', 'magic_robe', 'steel_shield'], thief: ['desert_dagger', 'sand_garb'], monk: ['bone_claw', 'sand_garb'] },
  4: { warrior: ['tide_sword', 'steel_armor', 'mirror_shield'], knight: ['knight_lance', 'steel_armor', 'mirror_shield'], mage: ['tide_staff', 'sage_robe'], priest: ['tide_staff', 'sage_robe', 'mirror_shield'], thief: ['azure_knife', 'ninja_garb'], monk: ['oni_claw', 'ninja_garb'] },
  5: { warrior: ['frost_sword', 'silver_armor', 'silver_shield'], knight: ['holy_lance', 'silver_armor', 'silver_shield'], mage: ['frost_staff', 'moon_robe'], priest: ['frost_staff', 'moon_robe', 'silver_shield'], thief: ['moon_dagger', 'leopard_garb'], monk: ['tiger_claw', 'leopard_garb'] },
  6: { warrior: ['lantern_sword', 'lantern_armor', 'lantern_shield'], knight: ['lantern_sword', 'lantern_armor', 'silver_shield'], mage: ['lantern_staff', 'lantern_robe'], priest: ['frost_staff', 'moon_robe', 'silver_shield'], thief: ['lantern_knife', 'leopard_garb'], monk: ['lantern_claw', 'lantern_robe'] },
  7: { warrior: ['star_sword', 'star_armor', 'star_shield'], knight: ['star_lance', 'star_armor', 'star_shield'], mage: ['star_staff', 'star_robe'], priest: ['star_staff', 'star_robe', 'star_shield'], thief: ['star_knife', 'star_garb'], monk: ['star_claw', 'star_garb'] },
};
function mkParty(classes, lv, tier) {
  return classes.map((cls, i) => {
    const c = Party.newChar('P' + i, cls, lv);
    c.equip = { weapon: null, armor: null, shield: null, acc: null };
    for (const it of GEAR[tier][cls]) c.equip[D.ITEMS[it].type] = it;
    Party.fullHeal(c);
    return c;
  });
}
function mkInv(items) {
  const inv = Object.assign({}, items);
  return { remove(id) { if ((inv[id] || 0) > 0) { inv[id]--; return true; } return false; }, add() { return 1; }, count: (id) => inv[id] || 0 };
}
function aiParty(ctx, b) {
  const c = b.ref, sk = Party.skills(c).map((id) => [id, D.SKILLS[id]]).filter(([, s]) => (s.mp || 0) <= c.mp && !s.fieldOnly);
  const alive = ctx.party.filter(BC.alive);
  const dead = ctx.party.filter((q) => !BC.alive(q));
  const hurt = alive.filter((q) => BC.hp(q) < BC.maxHp(q) * 0.6);
  const foes = ctx.enemies.filter(BC.alive);
  const sealed = c.status.seal;
  const usable = sk.filter(([, s]) => !(s.kind === 'magic' && sealed));
  // 蘇生
  const rev = usable.find(([, s]) => s.effect === 'revive');
  if (dead.length && rev) return { kind: 'skill', skill: rev[0], target: dead[0] };
  if (dead.length && ctx.inv.count('lifelamp') && (c.cls === 'priest' || !ctx.party.some((q) => q.ref.cls === 'priest' && BC.alive(q)))) return { kind: 'item', item: 'lifelamp', target: dead[0] };
  // 回復
  const heals = usable.filter(([, s]) => s.effect === 'heal');
  if (hurt.length >= 2) { const all = heals.filter(([, s]) => s.target === 'allies').pop(); if (all) return { kind: 'skill', skill: all[0] }; }
  if (hurt.length) {
    const one = heals.filter(([, s]) => s.target === 'ally').pop();
    if (one) return { kind: 'skill', skill: one[0], target: hurt[0] };
    if (BC.hp(b) < BC.maxHp(b) * 0.35 && ctx.inv.count('herb3')) return { kind: 'item', item: 'herb3', target: b };
  }
  const tgt = foes.slice().sort((a, b2) => BC.hp(a) - BC.hp(b2))[0];
  if (!tgt) return { kind: 'guard' };
  // プリズマ: 現在の弱点を狙う
  if (tgt.prism) {
    const weak = tgt.def.prism.cycle[tgt.prism.idx];
    if (tgt.prism.broken === 0) {
      const s = usable.filter(([, q]) => q.effect === 'dmg' && q.elem === weak).pop();
      if (s) return { kind: 'skill', skill: s[0], target: tgt };
      const stone = 'stone_' + weak;
      if (ctx.inv.count(stone)) return { kind: 'item', item: stone, target: tgt };
      return { kind: 'guard' };
    }
  }
  const dmgSk = usable.filter(([, s]) => s.effect === 'dmg');
  let best = null, bestV = 0;
  for (const [id, s] of dmgSk) {
    const em = BC.elemMult(tgt, s.elem).m;
    const n = s.target === 'enemies' ? foes.length : s.hits || 1;
    const v = (s.kind === 'magic' ? (s.pow + BC.stat(b, 'int') * (s.scale || 1)) : Math.max(1, BC.stat(b, 'atk') / 2 - BC.stat(tgt, 'def') / 4) * (s.mult || 1)) * Math.max(0, em) * n / (1 + (s.mp || 0) / 40) * (s.recoil ? 0.6 : 1);
    if (v > bestV) { bestV = v; best = id; }
  }
  const atkV = Math.max(1, BC.stat(b, 'atk') / 2 - BC.stat(tgt, 'def') / 4);
  if (best && bestV > atkV * 1.15) return { kind: 'skill', skill: best, target: tgt };
  return { kind: 'attack', target: tgt };
}
function fight(chars, enemyIds, inv, maxTurns) {
  const ctx = BC.newCtx(chars, enemyIds, { canRun: false, inv: mkInv(inv || {}) });
  for (let t = 0; t < (maxTurns || 60); t++) {
    BC.beginTurn(ctx);
    const cmds = ctx.party.map((b) => (BC.canAct(b) ? aiParty(ctx, b) : null));
    for (const o of BC.turnOrder(ctx, cmds)) {
      if (!BC.alive(o.b)) continue;
      const cmd = o.b.side === 'party' ? o.cmd : BC.enemyChoose(ctx, o.b);
      if (!cmd) { BC.act(ctx, o.b, { kind: 'none' }); continue; }
      BC.act(ctx, o.b, cmd);
      let r = BC.checkEnd(ctx);
      if (r === 'phase') { BC.nextPhase(ctx, ctx.enemies.find((e) => e.hp <= 0 && e.def.nextPhase && !e.phased)); r = null; }
      if (r) return { r, turns: t + 1, hpLeft: chars.reduce((s, c) => s + c.hp, 0) / chars.reduce((s, c) => s + Party.stats(c).hp, 0) };
    }
    BC.endTurn(ctx);
    const r = BC.checkEnd(ctx);
    if (r === 'phase') { BC.nextPhase(ctx, ctx.enemies.find((e) => e.hp <= 0 && e.def.nextPhase && !e.phased)); continue; }
    if (r) return { r, turns: t + 1, hpLeft: 0 };
  }
  return { r: 'timeout', turns: maxTurns };
}
function trial(label, classes, lv, tier, enemyIds, inv, n) {
  n = n || 200;
  let win = 0, turns = 0, hpl = 0;
  for (let i = 0; i < n; i++) {
    const p = mkParty(classes, lv, tier);
    const r = fight(p, enemyIds, inv);
    if (r.r === 'win') { win++; turns += r.turns; hpl += r.hpLeft; }
  }
  console.log(`${label.padEnd(28)} Lv${String(lv).padStart(2)} win ${(win / n * 100).toFixed(0).padStart(3)}%  turns ${(win ? turns / win : 0).toFixed(1).padStart(5)}  hpLeft ${(win ? hpl / win * 100 : 0).toFixed(0)}%`);
  return win / n;
}
const STD = ['warrior', 'knight', 'mage', 'priest'];
const ALT = ['warrior', 'thief', 'monk', 'priest'];
const inv = (k) => ({ herb3: k, lifelamp: 2, stone_fire: 8, stone_ice: 8, stone_thunder: 8, stone_wind: 8, stone_light: 8 });
const bosses = [
  ['ookiba', 6, 1, { herb3: 0 }], ['zaraam', 11, 2, inv(0)], ['mizuchi', 15, 3, inv(2)], ['borganos', 18, 4, inv(3)],
  ['prisma', 21, 5, inv(3)], ['valgoat', 24, 5, inv(4)], ['gatekeeper', 27, 6, inv(4)], ['yomigarasu', 29, 6, inv(6)], ['amnes', 42, 7, inv(10)],
];
const arg = process.argv[2];
for (const [id, lv, tier, iv] of bosses) {
  if (arg && arg !== id) continue;
  for (const d of [-3, 0, 2]) trial(`${id} std`, STD, lv + d, tier, [id], iv, 150);
  trial(`${id} alt`, ALT, lv, tier, [id], iv, 150);
}
console.log('--- 雑魚戦（HP残量が多いほど楽）');
const zones = [['fieldA', 2, 1], ['fieldA', 4, 1], ['cave1', 5, 1], ['fieldB', 7, 2], ['desert', 9, 2], ['tower2', 10, 2], ['fieldC', 13, 3], ['temple3', 14, 3], ['volcano4', 16, 3], ['fieldD', 19, 4], ['ice5', 20, 4], ['grave6', 23, 5], ['tower7', 27, 6], ['reverse', 34, 7], ['reverseD', 38, 7]];
if (!arg) for (const [z, lv, tier] of zones) {
  const tbl = D.ENCOUNTERS[z];
  let win = 0, hpl = 0, n = 0, turns = 0;
  for (const [, g] of tbl.groups) for (let i = 0; i < 40; i++) {
    const p = mkParty(STD, lv, tier);
    const r = fight(p, g, { herb3: 0 });
    n++; if (r.r === 'win') { win++; hpl += r.hpLeft; turns += r.turns; }
  }
  const gs = tbl.groups.filter(([, g]) => !g.some((id) => D.ENEMIES[id].metal)); const expPer = gs.reduce((s, [, g]) => s + g.reduce((a, id) => a + D.ENEMIES[id].exp, 0), 0) / gs.length;
  console.log(`${z.padEnd(10)} Lv${lv} win ${(win / n * 100).toFixed(0)}%  hpLeft ${(hpl / win * 100).toFixed(0)}%  turns ${(turns / win).toFixed(1)}  exp/battle ${expPer.toFixed(0)}  battles/level ${(D.expToNext(lv) / expPer).toFixed(1)}`);
}
