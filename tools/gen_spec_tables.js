// specification.md 用のデータ一覧表を data.js から生成する（node tools/gen_spec_tables.js > tools/spec_tables.md）
global.TEXT = require('../js/text.js').TEXT;
const D = require('../js/data.js');
const E = TEXT.elem;
const out = [];
const p = (s) => out.push(s);
const elems = (a) => (a && a.length ? a.map((e) => E[e]).join('・') : '―');

p('### 職業と習得スキル');
p('| 職業 | 特徴 | Lv1 HP/MP/攻/守/魔/速/運 | 習得スキル（習得Lv） |');
p('|---|---|---|---|');
for (const id of D.CLASS_ORDER) {
  const c = D.CLASSES[id], b = c.base;
  p(`| ${c.name} | ${c.desc} | ${b.hp}/${b.mp}/${b.atk}/${b.def}/${b.int}/${b.agi}/${b.luk} | ${c.skills.map(([lv, s]) => `${D.SKILLS[s].name}(${lv})`).join('、')} |`);
}
p('');
p('### スキル（呪文・技）');
p('| 名前 | 種別 | MP | 対象 | 属性 | 効果 |');
p('|---|---|---|---|---|---|');
const TG = { enemy: '敵1体', enemies: '敵全体', random: 'ランダム', ally: '味方1人', allies: '味方全員', self: '自分', deadAlly: '戦闘不能の味方', none: '―' };
for (const [id, s] of Object.entries(D.SKILLS)) {
  if (id.startsWith('e_')) continue;
  p(`| ${s.name} | ${s.kind === 'magic' ? '呪文' : '技'} | ${s.mp || 0} | ${TG[s.target] || s.target} | ${s.elem ? E[s.elem] : '―'} | ${s.desc || ''} |`);
}
p('');
p('### 消費アイテム');
p('| 名前 | 価格 | 効果 |');
p('|---|---|---|');
for (const it of Object.values(D.ITEMS)) if (it.type === 'use') p(`| ${it.name} | ${it.price ? it.price + 'G' : '非売品'} | ${it.desc} |`);
p('');
p('### 大事なもの');
p('| 名前 | 説明 |');
p('|---|---|');
for (const it of Object.values(D.ITEMS)) if (it.type === 'key') p(`| ${it.name} | ${it.desc} |`);
p('');
const SL = { weapon: '武器', armor: 'よろい', shield: 'たて', acc: 'アクセ' };
p('### そうび品');
p('| 種類 | 名前 | 価格 | 能力 | そうびできる職業 |');
p('|---|---|---|---|---|');
for (const it of Object.values(D.ITEMS)) {
  if (!SL[it.type]) continue;
  const st = ['atk', 'def', 'int', 'agi', 'luk'].filter((k) => it[k]).map((k) => `${TEXT.stat[k]}${it[k] > 0 ? '+' : ''}${it[k]}`);
  if (it.elem) st.push(`${E[it.elem]}属性`);
  if (it.resist) st.push(`${E[it.resist]}耐性`);
  if (it.immune) st.push(it.immune.map((s) => TEXT.status[s]).join('・') + '無効');
  p(`| ${SL[it.type]} | ${it.name} | ${it.price ? it.price + 'G' : '宝箱'} | ${st.join(' ')} | ${D.CLASS_ORDER.filter((c) => it.eq.includes(c)).map((c) => D.CLASSES[c].name).join('・')} |`);
}
p('');
p('### 店の品ぞろえ');
const SHOPN = { lanta: 'ランタ村', fior: 'フィオルの町', sahar: '砂の都サハルナ', mizuha: '港町ミズハ', shirane: '雪の里シラネ', sakasa: 'サカサ村（裏）' };
p('| 町 | どうぐ屋 | 武器と防具の店 |');
p('|---|---|---|');
for (const [t, n] of Object.entries(SHOPN)) p(`| ${n} | ${D.SHOPS[t + '_item'].items.map((i) => D.ITEMS[i].name).join('、')} | ${D.SHOPS[t + '_gear'].items.map((i) => D.ITEMS[i].name).join('、')} |`);
p('');
p('### 敵（雑魚）');
p('| 名前 | Lv | HP | 攻 | 守 | 速 | 弱点 | 耐性/吸収 | 主な行動 | EXP | G |');
p('|---|---|---|---|---|---|---|---|---|---|---|');
for (const e of Object.values(D.ENEMIES)) {
  if (e.boss) continue;
  const acts = e.ai.map((a) => (a.act === 'attack' ? '攻撃' : D.SKILLS[a.act].name)).join('・');
  p(`| ${e.name} | ${e.lv} | ${e.hp} | ${e.atk} | ${e.def} | ${e.agi} | ${elems(e.weak)} | ${elems(e.resist.concat(e.absorb.map((x) => x + '*')).map((x) => x.replace('*', ''))) } | ${acts} | ${e.exp} | ${e.gold} |`);
}
p('');
p('### ボス');
p('| 名前 | 場所 | HP | 行動回数 | 弱点 | 耐性/吸収 | 特徴 |');
p('|---|---|---|---|---|---|---|');
const WHERE = { ookiba: 'ささやきの森洞 B2', zaraam: '砂塵の塔 3F', mizuchi: '沈みの神殿 2F', borganos: '焔の火口 2F', prisma: '氷晶の洞 B2', valgoat: '月影の墓所 2F', gatekeeper: '蝕の塔 2F', yomigarasu: '蝕の塔 頂上', yomigarasu2: '（第2形態）', amnes: '逆さ灯の迷宮 最深部（裏ボス）' };
for (const e of Object.values(D.ENEMIES)) {
  if (!e.boss) continue;
  const acts = e.ai.map((a) => (a.act === 'attack' ? '攻撃' : D.SKILLS[a.act].name)).join('・');
  let note = acts;
  if (e.prism) note = '弱点属性がターンごとに 氷→雷→風→光→火 と移り変わる。弱点以外はほぼ無効。弱点で2回攻撃すると障壁が砕け、2ターンの間 全攻撃が1.3倍';
  if (e.nextPhase) note += '／倒すと真の姿に変身';
  if (e.rage) note += `／HP${e.rage.below * 100}%以下で${e.rage.acts}回行動`;
  p(`| ${e.name} | ${WHERE[e.id] || ''} | ${e.hp} | ${e.acts} | ${elems(e.weak)} | ${elems(e.resist.concat(e.absorb))} | ${note} |`);
}
console.log(out.join('\n'));
