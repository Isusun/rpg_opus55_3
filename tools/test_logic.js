// ロジック単体テスト（node tools/test_logic.js）
global.TEXT = require('../js/text.js').TEXT;
global.T = require('../js/text.js').T;
global.DATA = require('../js/data.js');
const core = require('../js/core.js');
global.Util = core.Util; global.Party = core.Party;
const BC = require('../js/battle_core.js');
const { Party } = core;
let fails = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log('FAIL:', msg); } }

// ---- 装備とステータス
{
  const c = Party.newChar('A', 'mage', 1);
  const base = Party.stats(c);
  ok(base.hp > 0 && base.int > 0, 'mage base stats');
  c.equip.weapon = 'sorcerer_staff';
  const s2 = Party.stats(c);
  ok(s2.int === Party.baseStats(c).int + 14 && s2.atk === Party.baseStats(c).atk + 12, 'weapon adds int/atk');
  const w = Party.newChar('B', 'warrior', 1);
  w.equip.weapon = 'battle_axe'; // 素早さ -4
  ok(Party.stats(w).agi >= 0, 'agi never negative');
  w.lv = 60; w.bonus.hp = 99; w.equip.acc = 'star_ring';
  const s3 = Party.stats(w);
  ok(Object.values(s3).every((v) => v <= DATA.STAT_CAP && v >= 0), 'stats within cap');
  ok(!Party.canEquip(Party.newChar('C', 'mage', 1), 'battle_axe'), 'mage cannot equip axe');
}
// ---- レベルアップとスキル習得
{
  const c = Party.newChar('P', 'priest', 1);
  const before = Party.stats(c);
  const ups = Party.gainExp(c, DATA.totalExpFor(5) - c.exp);
  ok(c.lv === 5 && ups.length === 4, 'leveled to 5 with 4 level-ups');
  ok(Party.stats(c).hp > before.hp, 'hp grows on level up');
  const learned = ups.flatMap((u) => u.learned);
  ok(learned.includes('kiyome') && learned.includes('hikarinoya'), 'learned priest skills at 3 and 5');
  ok(Party.skills(c).includes('iyashi'), 'has lv1 skill');
  const cap = Party.newChar('Q', 'warrior', 60);
  ok(Party.gainExp(cap, 999999).length === 0 && cap.lv === 60, 'no level beyond cap');
}
// ---- 状態異常
{
  const p = [Party.newChar('W', 'warrior', 10), Party.newChar('M', 'mage', 10)];
  const ctx = BC.newCtx(p, ['aopuru'], { canRun: true });
  const [bw, bm] = ctx.party;
  // 眠り: 行動スキップ
  p[0].status.sleep = true; bw.statusTurns.sleep = 2;
  let ev = BC.act(ctx, bw, { kind: 'attack', target: ctx.enemies[0] });
  ok(ev.some((e) => e.text && e.text.includes('眠っている')) && ctx.enemies[0].hp === ctx.enemies[0].maxhp, 'sleep skips action');
  BC.endTurn(ctx); ok(p[0].status.sleep, 'sleep lasts 2 turns (1 left)');
  BC.endTurn(ctx); ok(!p[0].status.sleep, 'sleep wears off');
  // 毒: ターン終了でダメージ
  p[1].status.poison = true;
  const hp0 = p[1].hp;
  ev = BC.endTurn(ctx);
  ok(p[1].hp < hp0 && ev.some((e) => e.poison), 'poison damages at turn end');
  // 封印: 呪文が使えない
  p[1].status.seal = true; bm.statusTurns.seal = 3;
  const mp0 = p[1].mp;
  ev = BC.act(ctx, bm, { kind: 'skill', skill: 'hibana', target: ctx.enemies[0] });
  ok(ev.some((e) => e.text === TEXT.battle.sealed) && p[1].mp === mp0, 'seal blocks magic without MP loss');
  // 麻痺: 行動不能
  p[1].status.paralyze = true; bm.statusTurns.paralyze = 1;
  ok(!BC.canAct(bm), 'paralyzed cannot act');
  BC.endTurn(ctx); ok(!p[1].status.paralyze, 'paralysis wears off');
  // 回復: キヨメ
  p[0].status.poison = true;
  const pc = Party.newChar('H', 'priest', 5);
  const ctx2 = BC.newCtx([p[0], pc], ['aopuru'], {});
  BC.act(ctx2, ctx2.party[1], { kind: 'skill', skill: 'kiyome', target: ctx2.party[0] });
  ok(!p[0].status.poison, 'kiyome cures poison');
}
// ---- 属性相性・会心
{
  const m = Party.newChar('M', 'mage', 10);
  const ctx = BC.newCtx([m], ['aopuru', 'aobi'], {});
  ok(BC.elemMult(ctx.enemies[0], 'fire').tag === 'weak', 'aopuru weak to fire');
  ok(BC.elemMult(ctx.enemies[1], 'fire').tag === 'absorb', 'aobi absorbs fire');
  const hp1 = ctx.enemies[1].hp; ctx.enemies[1].hp = 1;
  BC.act(ctx, ctx.party[0], { kind: 'skill', skill: 'hibana', target: ctx.enemies[1] });
  ok(ctx.enemies[1].hp > 1 && ctx.enemies[1].hp <= hp1, 'absorb heals');
}
// ---- 逃走と勝利報酬
{
  const t = Party.newChar('T', 'thief', 30);
  const ctx = BC.newCtx([t], ['aopuru'], { canRun: true });
  let ran = 0; for (let i = 0; i < 50; i++) { ctx.runTries = 0; if (BC.tryRun(ctx)) ran++; }
  ok(ran > 30, 'fast thief usually escapes');
  const ctxB = BC.newCtx([t], ['ookiba'], { canRun: false });
  ok(!BC.tryRun(ctxB), 'cannot run from boss');
  ctx.enemies[0].hp = 0;
  ok(BC.checkEnd(ctx) === 'win', 'win when all enemies down');
  const rw = BC.rewards(ctx);
  ok(rw.exp === DATA.ENEMIES.aopuru.exp && rw.gold === DATA.ENEMIES.aopuru.gold, 'rewards match enemy data');
  const ctxL = BC.newCtx([t], ['aopuru'], {}); t.hp = 0;
  ok(BC.checkEnd(ctxL) === 'lose', 'lose when party down');
}
// ---- プリズマ（弱点パズル）
{
  const m = Party.newChar('M', 'mage', 25);
  const ctx = BC.newCtx([m], ['prisma'], {});
  const pr = ctx.enemies[0];
  const weak = pr.def.prism.cycle[pr.prism.idx];
  ok(weak === 'ice', 'prism starts weak to ice');
  const hp0 = pr.hp;
  BC.act(ctx, ctx.party[0], { kind: 'skill', skill: 'hibana', target: pr });
  const dFire = hp0 - pr.hp;
  const hp1 = pr.hp;
  BC.act(ctx, ctx.party[0], { kind: 'skill', skill: 'shimo', target: pr });
  const dIce = hp1 - pr.hp;
  ok(dIce > dFire * 4, 'weak element passes barrier, others blocked');
  BC.act(ctx, ctx.party[0], { kind: 'skill', skill: 'shimo', target: pr });
  ok(pr.prism.broken > 0, 'two weak hits break barrier');
  BC.endTurn(ctx);
  ok(pr.def.prism.cycle[pr.prism.idx] === 'thunder', 'core rotates each turn');
}
// ---- 形態変化
{
  const w = Party.newChar('W', 'warrior', 30);
  const ctx = BC.newCtx([w], ['yomigarasu'], {});
  ctx.enemies[0].hp = 0;
  ok(BC.checkEnd(ctx) === 'phase', 'final boss has second phase');
  BC.nextPhase(ctx, ctx.enemies[0]);
  ok(ctx.enemies[0].def.id === 'yomigarasu2' && ctx.enemies[0].hp > 0 && BC.checkEnd(ctx) === null, 'phase 2 active');
}
// ---- セーブデータ検証
{
  const { Game, SaveSys } = core;
  global.MAPS = require('../js/maps.js');
  Game.s = Game.newState();
  const c = Party.newChar('ユウ', 'warrior', 3, true); Game.s.roster.push(c); Game.s.party.push(c.id);
  const round = SaveSys.sanitize(JSON.parse(JSON.stringify(Game.s)));
  ok(round.roster[0].name === 'ユウ' && round.map === 'lanta', 'sanitize keeps valid data');
  let threw = false; try { SaveSys.sanitize({ version: 1, roster: 'x' }); } catch (e) { threw = true; }
  ok(threw, 'sanitize rejects broken data');
}
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
