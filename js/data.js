'use strict';
// =============================================================
// ゲームデータ定義（職業・スキル・アイテム・敵・隊列・店）
// =============================================================
const DATA = (() => {
  const LV_CAP = 60;
  const STAT_CAP = 999;
  const STAT_KEYS = ['hp', 'mp', 'atk', 'def', 'int', 'agi', 'luk'];

  // ---------- 職業 ----------
  const CLASSES = {
    warrior: {
      name: '戦士', sprite: 'hero_warrior', desc: 'HPと攻撃力が高い前衛。強力な物理技で敵をなぎ倒す。',
      base: { hp: 30, mp: 4, atk: 13, def: 8, int: 2, agi: 6, luk: 4 },
      grow: { hp: 8.5, mp: 1.2, atk: 2.7, def: 1.6, int: 0.5, agi: 1.3, luk: 0.8 },
      crit: 0, skills: [[3, 'konshin'], [6, 'nagi'], [9, 'touki'], [12, 'kabuto'], [15, 'enjin'], [20, 'sutemi'], [26, 'rekkuu'], [32, 'haou']],
    },
    knight: {
      name: '騎士', sprite: 'hero_knight', desc: '守備力に優れた盾役。仲間をかばい、光の剣技と回復も使える。',
      base: { hp: 28, mp: 6, atk: 11, def: 11, int: 4, agi: 4, luk: 4 },
      grow: { hp: 8, mp: 1.6, atk: 2.3, def: 2.0, int: 0.9, agi: 1.0, luk: 0.8 },
      crit: 0, skills: [[2, 'kabau'], [4, 'seiken'], [8, 'tate'], [11, 'iyashi'], [14, 'kiyome'], [18, 'sabaki'], [22, 'joheki'], [28, 'seikouken']],
    },
    mage: {
      name: '魔法使い', sprite: 'hero_mage', desc: '多彩な属性魔法の使い手。打たれ弱いが、弱点を突けば大ダメージ。',
      base: { hp: 16, mp: 14, atk: 5, def: 4, int: 13, agi: 7, luk: 6 },
      grow: { hp: 5, mp: 4.2, atk: 1.0, def: 0.9, int: 3.0, agi: 1.5, luk: 1.0 },
      crit: 0, skills: [[1, 'hibana'], [3, 'shimo'], [5, 'nemuri'], [8, 'homura'], [9, 'tobikaeri'], [11, 'ikazuchi'], [13, 'fuuin'], [16, 'fubuki'], [20, 'raimei'], [24, 'gurenka'], [30, 'hoshifuru'], [36, 'yamiyo']],
    },
    priest: {
      name: '僧侶', sprite: 'hero_priest', desc: '回復と補助の要。光の祈りで闇の魔物にも強い。',
      base: { hp: 20, mp: 12, atk: 7, def: 6, int: 10, agi: 5, luk: 8 },
      grow: { hp: 6, mp: 3.6, atk: 1.4, def: 1.2, int: 2.4, agi: 1.2, luk: 1.2 },
      crit: 0, skills: [[1, 'iyashi'], [3, 'kiyome'], [5, 'hikarinoya'], [7, 'mamori'], [9, 'tobikaeri'], [10, 'iyashinowa'], [14, 'yomigaeri'], [17, 'ooiyashi'], [21, 'seikou'], [27, 'megumi'], [34, 'akari']],
    },
    thief: {
      name: '盗賊', sprite: 'hero_thief', desc: '素早さと運が高い。先手の風技、毒や麻痺、ぬすむで戦いを有利に運ぶ。',
      base: { hp: 22, mp: 5, atk: 9, def: 6, int: 5, agi: 12, luk: 12 },
      grow: { hp: 6.5, mp: 1.5, atk: 2.0, def: 1.2, int: 1.0, agi: 2.4, luk: 2.0 },
      crit: 0.03, skills: [[2, 'nusumu'], [3, 'shippu'], [5, 'dokuba'], [7, 'shinobi'], [9, 'kagenui'], [12, 'renzoku'], [16, 'kamaitachi'], [21, 'kyusho'], [27, 'midarekaze']],
    },
    monk: {
      name: '武闘家', sprite: 'hero_monk', desc: '会心の一撃が出やすい拳の達人。気をためた一撃は強烈。',
      base: { hp: 26, mp: 4, atk: 12, def: 6, int: 3, agi: 11, luk: 7 },
      grow: { hp: 7.5, mp: 1.2, atk: 2.6, def: 1.3, int: 0.7, agi: 2.2, luk: 1.2 },
      crit: 0.08, skills: [[3, 'seiken_fist'], [5, 'kiai'], [8, 'senpu'], [12, 'hisho'], [15, 'meisou'], [19, 'hyakuretsu'], [23, 'raijin'], [30, 'mugen']],
    },
  };
  const CLASS_ORDER = ['warrior', 'knight', 'mage', 'priest', 'thief', 'monk'];

  // ---------- 経験値 ----------
  function expToNext(lv) { return Math.floor(10 * Math.pow(lv, 1.8) + 10); }
  function totalExpFor(lv) { let s = 0; for (let i = 1; i < lv; i++) s += expToNext(i); return s; }

  // ---------- スキル ----------
  // kind: magic（魔力依存・封印で使用不可） / tech（攻撃力依存）
  // effect: dmg / heal / buff / status / revive / cure / cover / charge / steal / return / repel / selfheal / wall
  // target: enemy / enemies / ally / allies / self / deadAlly / none
  const S = (o) => o;
  const SKILLS = {
    // 魔法使い
    hibana: S({ name: 'ヒバナ', kind: 'magic', mp: 2, effect: 'dmg', elem: 'fire', target: 'enemy', pow: 10, scale: 0.9, desc: '敵1体に火の呪文' }),
    shimo: S({ name: 'シモツキ', kind: 'magic', mp: 3, effect: 'dmg', elem: 'ice', target: 'enemy', pow: 14, scale: 0.9, desc: '敵1体に氷の呪文' }),
    nemuri: S({ name: 'ネムリビ', kind: 'magic', mp: 4, effect: 'status', status: 'sleep', rate: 0.65, target: 'enemies', desc: '敵全体を眠らせる' }),
    homura: S({ name: 'ホムラ', kind: 'magic', mp: 6, effect: 'dmg', elem: 'fire', target: 'enemies', pow: 16, scale: 0.7, desc: '敵全体に火の呪文' }),
    ikazuchi: S({ name: 'イカヅチ', kind: 'magic', mp: 5, effect: 'dmg', elem: 'thunder', target: 'enemy', pow: 30, scale: 1.0, desc: '敵1体に雷の呪文' }),
    fuuin: S({ name: 'フウイン', kind: 'magic', mp: 4, effect: 'status', status: 'seal', rate: 0.6, target: 'enemies', desc: '敵全体の呪文を封じる' }),
    fubuki: S({ name: 'フブキ', kind: 'magic', mp: 10, effect: 'dmg', elem: 'ice', target: 'enemies', pow: 36, scale: 0.8, desc: '敵全体に氷の呪文' }),
    raimei: S({ name: 'ライメイ', kind: 'magic', mp: 14, effect: 'dmg', elem: 'thunder', target: 'enemies', pow: 50, scale: 0.9, desc: '敵全体に雷の呪文' }),
    gurenka: S({ name: 'グレンカ', kind: 'magic', mp: 16, effect: 'dmg', elem: 'fire', target: 'enemy', pow: 90, scale: 1.4, desc: '敵1体に強力な火の呪文' }),
    hoshifuru: S({ name: 'ホシフル', kind: 'magic', mp: 30, effect: 'dmg', elem: 'none', target: 'enemies', pow: 110, scale: 1.2, desc: '敵全体に星の雨を降らせる' }),
    yamiyo: S({ name: 'ヤミヨ', kind: 'magic', mp: 24, effect: 'dmg', elem: 'dark', target: 'enemy', pow: 180, scale: 1.6, desc: '敵1体に闇の呪文' }),
    tobikaeri: S({ name: 'トビカエリ', kind: 'magic', mp: 6, effect: 'return', target: 'none', fieldOnly: true, desc: '一度訪れた町へ帰る（屋外のみ）' }),
    // 僧侶
    iyashi: S({ name: 'イヤシ', kind: 'magic', mp: 3, effect: 'heal', target: 'ally', pow: 28, scale: 0.8, field: true, desc: '味方1人のHPを回復' }),
    kiyome: S({ name: 'キヨメ', kind: 'magic', mp: 3, effect: 'cure', cures: ['poison', 'sleep', 'paralyze', 'seal'], target: 'ally', field: true, desc: '味方1人の状態異常を治す' }),
    hikarinoya: S({ name: 'ヒカリノヤ', kind: 'magic', mp: 4, effect: 'dmg', elem: 'light', target: 'enemy', pow: 18, scale: 0.9, desc: '敵1体に光の矢' }),
    mamori: S({ name: 'マモリノウタ', kind: 'magic', mp: 6, effect: 'buff', stat: 'def', target: 'allies', desc: '味方全員の守備力を上げる' }),
    iyashinowa: S({ name: 'イヤシノワ', kind: 'magic', mp: 9, effect: 'heal', target: 'allies', pow: 40, scale: 0.7, field: true, desc: '味方全員のHPを回復' }),
    yomigaeri: S({ name: 'ヨミガエリ', kind: 'magic', mp: 12, effect: 'revive', ratio: 0.5, target: 'deadAlly', field: true, desc: '戦闘不能の仲間をHP半分で生き返らせる' }),
    ooiyashi: S({ name: 'オオイヤシ', kind: 'magic', mp: 8, effect: 'heal', target: 'ally', pow: 160, scale: 1.2, field: true, desc: '味方1人のHPを大きく回復' }),
    seikou: S({ name: 'セイコウ', kind: 'magic', mp: 14, effect: 'dmg', elem: 'light', target: 'enemies', pow: 60, scale: 0.9, desc: '敵全体に聖なる光' }),
    megumi: S({ name: 'ヒカリノメグミ', kind: 'magic', mp: 22, effect: 'heal', target: 'allies', pow: 200, scale: 1.2, field: true, desc: '味方全員のHPを大きく回復' }),
    akari: S({ name: 'ヨミノアカリ', kind: 'magic', mp: 40, effect: 'revive', ratio: 1.0, target: 'deadAlly', field: true, desc: '戦闘不能の仲間を完全に生き返らせる' }),
    // 戦士
    konshin: S({ name: '渾身斬り', kind: 'tech', mp: 2, effect: 'dmg', target: 'enemy', mult: 1.6, hit: 0.85, desc: '命中はやや低いが強力な一撃' }),
    nagi: S({ name: '薙ぎ払い', kind: 'tech', mp: 4, effect: 'dmg', target: 'enemies', mult: 0.75, desc: '敵全体を斬りつける' }),
    touki: S({ name: '闘気', kind: 'tech', mp: 3, effect: 'buff', stat: 'atk', target: 'self', desc: '自分の攻撃力を上げる' }),
    kabuto: S({ name: '兜割り', kind: 'tech', mp: 4, effect: 'dmg', target: 'enemy', mult: 1.1, debuff: 'def', desc: '攻撃しつつ敵の守備力を下げる' }),
    enjin: S({ name: '炎刃', kind: 'tech', mp: 5, effect: 'dmg', elem: 'fire', target: 'enemy', mult: 1.3, desc: '火の力をまとった斬撃' }),
    sutemi: S({ name: '捨て身斬り', kind: 'tech', mp: 6, effect: 'dmg', target: 'enemy', mult: 2.6, recoil: 0.15, desc: '反動を受けるが絶大な一撃' }),
    rekkuu: S({ name: '烈空斬', kind: 'tech', mp: 10, effect: 'dmg', target: 'enemies', mult: 1.2, desc: '敵全体に真空の刃' }),
    haou: S({ name: '覇王斬', kind: 'tech', mp: 14, effect: 'dmg', target: 'enemy', mult: 3.2, desc: '最強の剣技' }),
    // 騎士
    kabau: S({ name: 'かばう', kind: 'tech', mp: 0, effect: 'cover', target: 'ally', priority: 3, desc: 'このターン、仲間1人への単体攻撃を代わりに受ける' }),
    seiken: S({ name: '聖なる剣', kind: 'tech', mp: 4, effect: 'dmg', elem: 'light', target: 'enemy', mult: 1.3, desc: '光の力を宿した斬撃' }),
    tate: S({ name: '盾の構え', kind: 'tech', mp: 6, effect: 'buff', stat: 'def', target: 'allies', desc: '味方全員の守備力を上げる' }),
    sabaki: S({ name: '光の裁き', kind: 'tech', mp: 10, effect: 'dmg', elem: 'light', target: 'enemies', mult: 0.9, desc: '敵全体に光の剣閃' }),
    joheki: S({ name: '城壁の誓い', kind: 'tech', mp: 8, effect: 'wall', target: 'self', priority: 3, desc: 'このターン、仲間全員への単体攻撃を代わりに受け、被ダメージを半減' }),
    seikouken: S({ name: '聖光剣', kind: 'tech', mp: 12, effect: 'dmg', elem: 'light', target: 'enemy', mult: 2.4, desc: '聖なる光の大斬撃' }),
    // 盗賊
    nusumu: S({ name: 'ぬすむ', kind: 'tech', mp: 0, effect: 'steal', target: 'enemy', desc: '敵からどうぐを盗む' }),
    shippu: S({ name: '疾風斬り', kind: 'tech', mp: 2, effect: 'dmg', elem: 'wind', target: 'enemy', mult: 1.1, priority: 2, desc: '風のように先手を取る斬撃' }),
    dokuba: S({ name: '毒の刃', kind: 'tech', mp: 3, effect: 'dmg', target: 'enemy', mult: 0.9, addStatus: 'poison', rate: 0.8, desc: '毒を与える斬撃' }),
    shinobi: S({ name: '忍び足', kind: 'tech', mp: 4, effect: 'repel', target: 'none', fieldOnly: true, desc: 'しばらく魔物に出会いにくくなる' }),
    kagenui: S({ name: '影縫い', kind: 'tech', mp: 4, effect: 'status', status: 'paralyze', rate: 0.6, target: 'enemy', desc: '敵1体をしびれさせる' }),
    renzoku: S({ name: '連続斬り', kind: 'tech', mp: 5, effect: 'dmg', target: 'enemy', mult: 0.8, hits: 2, desc: '1体に2回斬りつける' }),
    kamaitachi: S({ name: 'カマイタチ', kind: 'tech', mp: 8, effect: 'dmg', elem: 'wind', target: 'enemies', mult: 0.9, desc: '敵全体に風の刃' }),
    kyusho: S({ name: '急所突き', kind: 'tech', mp: 8, effect: 'dmg', target: 'enemy', mult: 1.5, instakill: 0.25, desc: '雑魚は一撃で倒すことがある' }),
    midarekaze: S({ name: '乱れ風', kind: 'tech', mp: 14, effect: 'dmg', elem: 'wind', target: 'random', mult: 0.75, hits: 4, desc: 'ランダムな敵に4回の風の刃' }),
    // 武闘家
    seiken_fist: S({ name: '正拳突き', kind: 'tech', mp: 2, effect: 'dmg', target: 'enemy', mult: 1.3, critBonus: 0.4, desc: '会心が出やすい突き' }),
    kiai: S({ name: '気合ため', kind: 'tech', mp: 0, effect: 'charge', target: 'self', desc: '次の攻撃の威力が2倍以上になる' }),
    senpu: S({ name: '旋風脚', kind: 'tech', mp: 5, effect: 'dmg', elem: 'wind', target: 'enemies', mult: 0.8, desc: '敵全体に風の蹴り' }),
    hisho: S({ name: '飛翔膝', kind: 'tech', mp: 5, effect: 'dmg', target: 'enemy', mult: 1.8, desc: '跳び上がっての膝蹴り' }),
    meisou: S({ name: '瞑想', kind: 'tech', mp: 4, effect: 'selfheal', ratio: 0.35, target: 'self', desc: '自分のHPを回復し状態異常を治す' }),
    hyakuretsu: S({ name: '百裂拳', kind: 'tech', mp: 10, effect: 'dmg', target: 'random', mult: 0.6, hits: 4, desc: 'ランダムな敵に4回の拳' }),
    raijin: S({ name: '雷神拳', kind: 'tech', mp: 8, effect: 'dmg', elem: 'thunder', target: 'enemy', mult: 1.8, desc: '雷をまとった拳' }),
    mugen: S({ name: '無限拳', kind: 'tech', mp: 16, effect: 'dmg', target: 'enemy', mult: 3.4, critBonus: 0.2, desc: '極めた拳の奥義' }),
    // ---- 敵専用 ----
    e_bite: S({ name: 'かみつき', kind: 'tech', effect: 'dmg', target: 'enemy', mult: 1.3 }),
    e_poison: S({ name: '毒の牙', kind: 'tech', effect: 'dmg', target: 'enemy', mult: 1.0, addStatus: 'poison', rate: 0.6 }),
    e_spore: S({ name: '眠りの胞子', kind: 'magic', effect: 'status', status: 'sleep', rate: 0.45, target: 'enemy' }),
    e_sporeAll: S({ name: '眠りの粉', kind: 'magic', effect: 'status', status: 'sleep', rate: 0.35, target: 'enemies' }),
    e_song: S({ name: '眠りの歌', kind: 'magic', effect: 'status', status: 'sleep', rate: 0.3, target: 'enemies' }),
    e_para: S({ name: 'しびれ針', kind: 'tech', effect: 'dmg', target: 'enemy', mult: 0.8, addStatus: 'paralyze', rate: 0.35 }),
    e_paraAll: S({ name: 'しびれの霧', kind: 'magic', effect: 'status', status: 'paralyze', rate: 0.25, target: 'enemies' }),
    e_seal: S({ name: '封じの歌', kind: 'magic', effect: 'status', status: 'seal', rate: 0.5, target: 'enemies' }),
    e_poisonAll: S({ name: '毒の霧', kind: 'magic', effect: 'status', status: 'poison', rate: 0.6, target: 'enemies' }),
    e_fire: S({ name: '火の粉', kind: 'magic', effect: 'dmg', elem: 'fire', target: 'enemy', pow: 12, scale: 0.6 }),
    e_fireBreath: S({ name: '火の息', kind: 'magic', effect: 'dmg', elem: 'fire', target: 'enemies', pow: 14, scale: 0.5 }),
    e_ice: S({ name: '氷の礫', kind: 'magic', effect: 'dmg', elem: 'ice', target: 'enemy', pow: 22, scale: 0.6 }),
    e_iceBreath: S({ name: '凍える息', kind: 'magic', effect: 'dmg', elem: 'ice', target: 'enemies', pow: 26, scale: 0.5 }),
    e_thunder: S({ name: '雷撃', kind: 'magic', effect: 'dmg', elem: 'thunder', target: 'enemies', pow: 30, scale: 0.5 }),
    e_wind: S({ name: 'つむじ風', kind: 'magic', effect: 'dmg', elem: 'wind', target: 'enemies', pow: 10, scale: 0.5 }),
    e_dark: S({ name: '闇の波動', kind: 'magic', effect: 'dmg', elem: 'dark', target: 'enemies', pow: 40, scale: 0.6 }),
    e_heal: S({ name: '癒しの光', kind: 'magic', effect: 'heal', target: 'ally', pow: 40, scale: 0.8 }),
    e_drain: S({ name: '吸血', kind: 'tech', effect: 'dmg', target: 'enemy', mult: 1.0, drain: 0.5 }),
    e_roar: S({ name: '雄叫び', kind: 'tech', effect: 'debuff', stat: 'atk', target: 'enemies' }),
    e_charge: S({ name: '力をためる', kind: 'tech', effect: 'charge', target: 'self' }),
    e_harden: S({ name: '身を固める', kind: 'tech', effect: 'buff', stat: 'def', target: 'self' }),
    e_sweep: S({ name: 'なぎ払い', kind: 'tech', effect: 'dmg', target: 'enemies', mult: 0.7 }),
    e_crush: S({ name: '痛恨の一撃', kind: 'tech', effect: 'dmg', target: 'enemy', mult: 2.0 }),
    e_flee: S({ name: 'にげだした', kind: 'tech', effect: 'flee', target: 'self' }),
    e_tail: S({ name: '尾の一撃', kind: 'tech', effect: 'dmg', target: 'enemies', mult: 0.8 }),
    e_eclipse: S({ name: '蝕の炎', kind: 'magic', effect: 'dmg', elem: 'dark', target: 'enemies', pow: 40, scale: 0.5 }),
    e_void: S({ name: '無明の波', kind: 'magic', effect: 'dmg', elem: 'dark', target: 'enemies', pow: 60, scale: 0.5 }),
    e_voidStar: S({ name: '消灯', kind: 'magic', effect: 'dmg', elem: 'none', target: 'enemies', pow: 95, scale: 0.5 }),
    e_dispel: S({ name: '凍てつく闇', kind: 'magic', effect: 'dispel', target: 'enemies' }),
    e_prism: S({ name: '七彩の光', kind: 'magic', effect: 'dmg', elem: 'light', target: 'enemies', pow: 44, scale: 0.5 }),
    e_whirl: S({ name: '大渦', kind: 'magic', effect: 'dmg', elem: 'ice', target: 'enemies', pow: 34, scale: 0.5 }),
    e_sand: S({ name: '砂嵐', kind: 'magic', effect: 'dmg', elem: 'wind', target: 'enemies', pow: 24, scale: 0.5 }),
  };

  // ---------- アイテム ----------
  const ALL = ['warrior', 'knight', 'mage', 'priest', 'thief', 'monk'];
  const HEAVY = ['warrior', 'knight'];
  const SWORD = ['warrior', 'knight', 'thief'];
  const STAFF = ['mage', 'priest'];
  const DAGGER = ['thief', 'mage'];
  const LIGHTA = ['warrior', 'knight', 'thief', 'monk', 'priest'];
  const ROBE = ['mage', 'priest'];
  const AGILE = ['thief', 'monk'];
  const SHIELD = ['warrior', 'knight', 'priest'];
  const I = (o) => o;
  const ITEMS = {
    // 消費アイテム
    herb: I({ name: '薬草', type: 'use', price: 8, effect: 'heal', pow: 30, target: 'ally', desc: 'HPを約30回復' }),
    herb2: I({ name: '上薬草', type: 'use', price: 40, effect: 'heal', pow: 90, target: 'ally', desc: 'HPを約90回復' }),
    herb3: I({ name: '霊薬草', type: 'use', price: 160, effect: 'heal', pow: 250, target: 'ally', desc: 'HPを約250回復' }),
    water: I({ name: '魔法の水', type: 'use', price: 120, effect: 'mp', pow: 25, target: 'ally', desc: 'MPを25回復' }),
    water2: I({ name: '聖なる水', type: 'use', price: 480, effect: 'mp', pow: 80, target: 'ally', desc: 'MPを80回復' }),
    elixir: I({ name: '天灯のしずく', type: 'use', price: 0, sell: 600, effect: 'full', target: 'ally', desc: 'HPとMPを全回復（非売品）' }),
    antidote: I({ name: '毒消し草', type: 'use', price: 10, effect: 'cure', cures: ['poison'], target: 'ally', desc: '毒を治す' }),
    wakeherb: I({ name: '目覚まし草', type: 'use', price: 30, effect: 'cure', cures: ['sleep', 'paralyze'], target: 'ally', desc: '眠りと麻痺を治す' }),
    panacea: I({ name: '万能薬', type: 'use', price: 120, effect: 'cure', cures: ['poison', 'sleep', 'paralyze', 'seal'], target: 'ally', desc: 'すべての状態異常を治す' }),
    lifelamp: I({ name: '命の灯', type: 'use', price: 300, effect: 'revive', ratio: 0.5, target: 'deadAlly', desc: '戦闘不能の仲間をHP半分で生き返らせる' }),
    feather: I({ name: '帰り鳥の羽', type: 'use', price: 25, effect: 'return', target: 'none', fieldOnly: true, desc: '一度訪れた町へ帰る（屋外のみ）' }),
    incense: I({ name: '灯よけの香', type: 'use', price: 40, effect: 'repel', target: 'none', fieldOnly: true, desc: 'しばらく魔物に出会いにくくなる' }),
    smoke: I({ name: 'けむり玉', type: 'use', price: 60, effect: 'escape', target: 'none', battleOnly: true, desc: '戦闘から必ず逃げられる（ボス戦を除く）' }),
    stone_fire: I({ name: '火炎石', type: 'use', price: 50, effect: 'dmg', elem: 'fire', pow: 60, target: 'enemy', battleOnly: true, desc: '敵1体に火の60ダメージ' }),
    stone_ice: I({ name: '氷晶石', type: 'use', price: 50, effect: 'dmg', elem: 'ice', pow: 60, target: 'enemy', battleOnly: true, desc: '敵1体に氷の60ダメージ' }),
    stone_thunder: I({ name: '雷光石', type: 'use', price: 50, effect: 'dmg', elem: 'thunder', pow: 60, target: 'enemy', battleOnly: true, desc: '敵1体に雷の60ダメージ' }),
    stone_wind: I({ name: '旋風石', type: 'use', price: 50, effect: 'dmg', elem: 'wind', pow: 60, target: 'enemy', battleOnly: true, desc: '敵1体に風の60ダメージ' }),
    stone_light: I({ name: '聖光石', type: 'use', price: 50, effect: 'dmg', elem: 'light', pow: 60, target: 'enemy', battleOnly: true, desc: '敵1体に光の60ダメージ' }),
    seed_str: I({ name: 'ちからの実', type: 'use', price: 0, sell: 200, effect: 'seed', stat: 'atk', pow: 3, target: 'ally', desc: '攻撃力が永久に3上がる（非売品）' }),
    seed_agi: I({ name: 'はやての実', type: 'use', price: 0, sell: 200, effect: 'seed', stat: 'agi', pow: 3, target: 'ally', desc: '素早さが永久に3上がる（非売品）' }),
    seed_life: I({ name: 'いのちの実', type: 'use', price: 0, sell: 200, effect: 'seed', stat: 'hp', pow: 8, target: 'ally', desc: '最大HPが永久に8上がる（非売品）' }),

    // 大事なもの
    key_forest: I({ name: '森の鍵', type: 'key', desc: 'ささやきの森洞の扉を開ける鍵' }),
    key_fire: I({ name: '焔の鍵', type: 'key', desc: '焔の火口の扉を開ける鍵' }),
    key_grave: I({ name: '墓所の鍵', type: 'key', desc: '月影の墓所の扉を開ける鍵' }),
    key_rev: I({ name: '逆さの鍵', type: 'key', desc: '逆さ灯の迷宮の扉を開ける鍵' }),
    letter: I({ name: '族長の書状', type: 'key', desc: '山道の関所を通るための書状' }),
    ferrypass: I({ name: '渡し舟の手形', type: 'key', desc: 'ミズハの渡し舟で北の雪原へ渡れる' }),
    orb1: I({ name: '風のオーブ', type: 'key', orb: 1, desc: '緑に輝く天灯のかけら' }),
    orb2: I({ name: '地のオーブ', type: 'key', orb: 2, desc: '黄金に輝く天灯のかけら' }),
    orb3: I({ name: '水のオーブ', type: 'key', orb: 3, desc: '青く輝く天灯のかけら' }),
    orb4: I({ name: '炎のオーブ', type: 'key', orb: 4, desc: '赤く輝く天灯のかけら' }),
    orb5: I({ name: '星のオーブ', type: 'key', orb: 5, desc: '白く輝く天灯のかけら' }),
    orb6: I({ name: '月のオーブ', type: 'key', orb: 6, desc: '紫に輝く天灯のかけら' }),

    // ---- 武器 ----
    club: I({ name: '樫のこん棒', type: 'weapon', price: 20, atk: 4, eq: ALL }),
    copper_sword: I({ name: '銅の剣', type: 'weapon', price: 100, atk: 9, eq: SWORD }),
    dagger: I({ name: '短剣', type: 'weapon', price: 70, atk: 7, eq: DAGGER }),
    wand: I({ name: '見習いの杖', type: 'weapon', price: 70, atk: 4, int: 3, eq: STAFF }),
    iron_claw: I({ name: '鉄の爪', type: 'weapon', price: 130, atk: 10, eq: ['monk'] }),
    iron_sword: I({ name: '鉄の剣', type: 'weapon', price: 350, atk: 16, eq: SWORD }),
    iron_axe: I({ name: '鉄の斧', type: 'weapon', price: 480, atk: 21, agi: -3, eq: ['warrior'] }),
    moth_knife: I({ name: '毒蛾のナイフ', type: 'weapon', price: 420, atk: 13, eq: DAGGER, onHit: 'poison' }),
    oak_staff: I({ name: '樫の杖', type: 'weapon', price: 380, atk: 8, int: 8, eq: STAFF }),
    steel_claw: I({ name: '鋼の爪', type: 'weapon', price: 460, atk: 18, eq: ['monk'] }),
    steel_sword: I({ name: '鋼の剣', type: 'weapon', price: 900, atk: 26, eq: SWORD }),
    battle_axe: I({ name: '戦斧', type: 'weapon', price: 1200, atk: 32, agi: -4, eq: ['warrior'] }),
    steel_lance: I({ name: '鋼の槍', type: 'weapon', price: 1000, atk: 29, eq: ['knight'] }),
    desert_dagger: I({ name: '砂漠のダガー', type: 'weapon', price: 800, atk: 22, agi: 3, eq: DAGGER }),
    sorcerer_staff: I({ name: '魔導士の杖', type: 'weapon', price: 1000, atk: 12, int: 14, eq: STAFF }),
    bone_claw: I({ name: '竜骨の爪', type: 'weapon', price: 1000, atk: 28, eq: ['monk'] }),
    tide_sword: I({ name: '海鳴りの剣', type: 'weapon', price: 2200, atk: 38, eq: SWORD }),
    wave_axe: I({ name: '大波の斧', type: 'weapon', price: 2700, atk: 46, agi: -5, eq: ['warrior'] }),
    knight_lance: I({ name: '騎士の槍', type: 'weapon', price: 2500, atk: 43, eq: ['knight'] }),
    azure_knife: I({ name: '碧のナイフ', type: 'weapon', price: 2000, atk: 34, agi: 4, eq: DAGGER }),
    tide_staff: I({ name: '潮騒の杖', type: 'weapon', price: 2400, atk: 18, int: 22, eq: STAFF }),
    oni_claw: I({ name: '鬼神の爪', type: 'weapon', price: 2600, atk: 42, eq: ['monk'] }),
    frost_sword: I({ name: '氷刃の剣', type: 'weapon', price: 4200, atk: 52, eq: SWORD, elem: 'ice' }),
    avalanche_axe: I({ name: '雪崩の斧', type: 'weapon', price: 5000, atk: 62, agi: -5, eq: ['warrior'] }),
    holy_lance: I({ name: '聖騎士の槍', type: 'weapon', price: 5000, atk: 58, eq: ['knight'], elem: 'light' }),
    moon_dagger: I({ name: '月影のダガー', type: 'weapon', price: 4000, atk: 48, agi: 6, eq: DAGGER }),
    frost_staff: I({ name: '氷霊の杖', type: 'weapon', price: 4400, atk: 26, int: 32, eq: STAFF }),
    tiger_claw: I({ name: '白虎の爪', type: 'weapon', price: 4800, atk: 58, eq: ['monk'] }),
    // 宝箱産（天灯シリーズ）
    lantern_sword: I({ name: '天灯の剣', type: 'weapon', price: 0, sell: 4000, atk: 74, eq: SWORD, elem: 'light' }),
    lantern_staff: I({ name: '天灯の杖', type: 'weapon', price: 0, sell: 4000, atk: 34, int: 46, eq: STAFF }),
    lantern_claw: I({ name: '天灯の爪', type: 'weapon', price: 0, sell: 4000, atk: 76, eq: ['monk'] }),
    lantern_knife: I({ name: '天灯の短刀', type: 'weapon', price: 0, sell: 4000, atk: 66, agi: 10, eq: DAGGER }),
    // 裏世界
    star_sword: I({ name: '星砕きの剣', type: 'weapon', price: 12000, atk: 98, eq: SWORD }),
    star_axe: I({ name: '星割りの斧', type: 'weapon', price: 13000, atk: 112, agi: -6, eq: ['warrior'] }),
    star_lance: I({ name: '星穿ちの槍', type: 'weapon', price: 12500, atk: 104, eq: ['knight'] }),
    star_staff: I({ name: '星詠みの杖', type: 'weapon', price: 12000, atk: 44, int: 64, eq: STAFF }),
    star_knife: I({ name: '流星の短刀', type: 'weapon', price: 11000, atk: 88, agi: 14, eq: DAGGER }),
    star_claw: I({ name: '星辰の爪', type: 'weapon', price: 12500, atk: 102, eq: ['monk'] }),

    // ---- よろい ----
    cloth: I({ name: '布の服', type: 'armor', price: 15, def: 3, eq: ALL }),
    travel_cloth: I({ name: '旅人の服', type: 'armor', price: 60, def: 6, eq: ALL }),
    leather_armor: I({ name: '皮の鎧', type: 'armor', price: 240, def: 11, eq: LIGHTA }),
    silk_robe: I({ name: '絹のローブ', type: 'armor', price: 280, def: 8, int: 3, eq: ROBE }),
    iron_armor: I({ name: '鉄の鎧', type: 'armor', price: 900, def: 20, agi: -2, eq: HEAVY }),
    sand_garb: I({ name: '砂の衣', type: 'armor', price: 800, def: 16, agi: 4, eq: AGILE }),
    magic_robe: I({ name: '魔法の法衣', type: 'armor', price: 850, def: 14, int: 6, eq: ROBE }),
    steel_armor: I({ name: '鋼の鎧', type: 'armor', price: 2000, def: 30, agi: -2, eq: HEAVY }),
    ninja_garb: I({ name: '忍び装束', type: 'armor', price: 1900, def: 24, agi: 8, eq: AGILE }),
    sage_robe: I({ name: '賢者のローブ', type: 'armor', price: 2000, def: 22, int: 10, eq: ROBE }),
    silver_armor: I({ name: '白銀の鎧', type: 'armor', price: 4200, def: 42, eq: HEAVY, resist: 'ice' }),
    leopard_garb: I({ name: '雪豹の衣', type: 'armor', price: 4000, def: 34, agi: 10, eq: AGILE, resist: 'ice' }),
    moon_robe: I({ name: '月光のローブ', type: 'armor', price: 4000, def: 30, int: 14, eq: ROBE, resist: 'dark' }),
    lantern_armor: I({ name: '天灯の鎧', type: 'armor', price: 0, sell: 4000, def: 56, eq: HEAVY, resist: 'dark' }),
    lantern_robe: I({ name: '天灯の法衣', type: 'armor', price: 0, sell: 4000, def: 44, int: 18, eq: ROBE.concat(AGILE), resist: 'dark' }),
    star_armor: I({ name: '星鎧', type: 'armor', price: 11000, def: 76, eq: HEAVY, resist: 'dark' }),
    star_garb: I({ name: '星影の衣', type: 'armor', price: 10000, def: 62, agi: 14, eq: AGILE, resist: 'dark' }),
    star_robe: I({ name: '星詠みの法衣', type: 'armor', price: 10000, def: 58, int: 22, eq: ROBE, resist: 'dark' }),

    // ---- たて ----
    leather_shield: I({ name: '皮の盾', type: 'shield', price: 50, def: 3, eq: SHIELD }),
    iron_shield: I({ name: '鉄の盾', type: 'shield', price: 360, def: 8, eq: SHIELD }),
    steel_shield: I({ name: '鋼の盾', type: 'shield', price: 800, def: 14, eq: SHIELD }),
    mirror_shield: I({ name: '水鏡の盾', type: 'shield', price: 1900, def: 20, eq: SHIELD, resist: 'fire' }),
    silver_shield: I({ name: '白銀の盾', type: 'shield', price: 3600, def: 28, eq: SHIELD, resist: 'ice' }),
    lantern_shield: I({ name: '天灯の盾', type: 'shield', price: 0, sell: 3000, def: 36, eq: SHIELD, resist: 'dark' }),
    star_shield: I({ name: '星の盾', type: 'shield', price: 9000, def: 48, eq: SHIELD, resist: 'dark' }),

    // ---- アクセサリー ----
    charm: I({ name: 'お守り', type: 'acc', price: 80, luk: 6, def: 1, eq: ALL }),
    swift_ring: I({ name: '疾風の腕輪', type: 'acc', price: 600, agi: 10, eq: ALL }),
    guard_ring: I({ name: '守りの指輪', type: 'acc', price: 1500, def: 10, eq: ALL }),
    wisdom_ring: I({ name: '知恵の指輪', type: 'acc', price: 1800, int: 12, eq: ALL }),
    power_ring: I({ name: '剛力の指輪', type: 'acc', price: 1800, atk: 12, eq: ALL }),
    awake_charm: I({ name: '目覚めの鈴', type: 'acc', price: 2400, luk: 4, eq: ALL, immune: ['sleep', 'paralyze'], desc: '眠りと麻痺を防ぐ' }),
    antidote_charm: I({ name: '毒よけの護符', type: 'acc', price: 900, luk: 2, eq: ALL, immune: ['poison'], desc: '毒を防ぐ' }),
    star_ring: I({ name: '星の指輪', type: 'acc', price: 9000, atk: 10, def: 10, int: 10, agi: 10, eq: ALL }),
  };

  // ---------- 敵 ----------
  // 敵ステータスはレベルと倍率から算出（全体の難度カーブを一定に保つため）
  function enemyStats(lv, m) {
    m = m || {};
    const hp = Math.round((16 + 9.5 * lv + 0.25 * lv * lv) * (m.hp || 1));
    return {
      hp, mp: 999,
      atk: Math.round((10 + 4.6 * lv) * (m.atk || 1)),
      def: Math.round((3 + 2.5 * lv) * (m.def || 1)),
      int: Math.round((6 + 3.0 * lv) * (m.int || 1)),
      agi: Math.round((4 + 2.4 * lv) * (m.agi || 1)),
      luk: Math.round((3 + 1.0 * lv)),
      exp: Math.round(expToNext(lv) / 6 * (m.exp || 1)),
      gold: Math.round((4 + 2.4 * lv) * (m.gold || 1)),
    };
  }
  const ENEMIES = {};
  function E(id, name, sprite, lv, o) {
    o = o || {};
    const st = enemyStats(lv, o.m);
    ENEMIES[id] = Object.assign({
      id, name, sprite, lv, weak: [], resist: [], immune: [], absorb: [], statusResist: {},
      ai: [{ act: 'attack', w: 1 }], acts: 1, drop: null, steal: null, tint: null, boss: false,
    }, st, o, { m: undefined });
    if (o.stats) Object.assign(ENEMIES[id], o.stats);
  }
  // ---- 草原（ランタ周辺） Lv1-4
  E('aopuru', 'アオプル', 'e1_0', 1, { weak: ['fire'], m: { hp: 0.9, atk: 0.8 }, drop: ['herb', 0.12] });
  E('togenezumi', 'トゲネズミ', 'e1_1', 2, { m: { atk: 0.9 }, ai: [{ act: 'attack', w: 4 }, { act: 'e_bite', w: 1 }], drop: ['herb', 0.1] });
  E('tsutsuki', 'ツツキドリ', 'e1_2', 2, { weak: ['thunder'], resist: ['wind'], m: { hp: 0.8, agi: 1.4, atk: 0.85 } });
  E('nemuridake', 'ネムリダケ', 'e1_3', 3, { weak: ['fire'], m: { hp: 1.0, atk: 0.8 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_spore', w: 1 }], drop: ['wakeherb', 0.12] });
  E('dokuimo', 'ドクイモ', 'e1_4', 3, { weak: ['fire'], m: { hp: 1.1, agi: 0.6, atk: 0.9 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_poison', w: 1 }], drop: ['antidote', 0.2] });
  // ---- ささやきの森洞 Lv3-5
  E('kibakomori', 'キバコウモリ', 'e1_5', 4, { weak: ['light'], m: { hp: 0.85, agi: 1.5, atk: 0.9 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_drain', w: 1 }] });
  E('ishikoron', 'イシコロン', 'e1_6', 5, { weak: ['thunder'], resist: ['fire', 'wind'], m: { hp: 1.2, def: 1.6, agi: 0.5 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_harden', w: 1 }], drop: ['herb', 0.2] });
  // ---- 平原・砂漠 Lv5-10
  E('akapuru', 'アカプル', 'e1_0', 5, { tint: 0xff7766, weak: ['ice'], resist: ['fire'], ai: [{ act: 'attack', w: 3 }, { act: 'e_fire', w: 1 }], drop: ['herb', 0.15] });
  E('kazenoko', 'カゼノコ', 'e2_1', 6, { weak: ['fire'], absorb: ['wind'], m: { hp: 0.8, agi: 1.5 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_wind', w: 1 }] });
  E('yoroigani', 'ヨロイガニ', 'e2_2', 7, { weak: ['thunder'], resist: ['fire'], m: { def: 1.7, agi: 0.6 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_harden', w: 1 }], drop: ['herb2', 0.1] });
  E('sunahebi', 'スナヘビ', 'e1_7', 7, { weak: ['ice'], m: { agi: 1.2 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_poison', w: 1 }], drop: ['antidote', 0.25] });
  E('kurosasori', 'クロサソリ', 'e1_8', 8, { weak: ['ice'], m: { def: 1.3 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_para', w: 1 }], drop: ['wakeherb', 0.15] });
  E('houtai', 'ホウタイ坊', 'e2_0', 8, { weak: ['fire', 'light'], m: { hp: 1.3, agi: 0.7 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_bite', w: 1 }], drop: ['herb2', 0.1] });
  E('ginpuru', 'ギンプル', 'e1_0', 8, { tint: 0xd8e4ff, resist: ['fire', 'ice', 'thunder', 'wind', 'light', 'dark'], statusResist: { sleep: 1, poison: 1, paralyze: 1, seal: 1 }, m: { hp: 0.35, def: 9, agi: 2.4, exp: 8, gold: 4 }, ai: [{ act: 'attack', w: 1 }, { act: 'e_flee', w: 2 }], metal: true });
  // ---- 砂塵の塔 Lv9-11
  E('ishigargo', 'イシガーゴ', 'e2_3', 10, { weak: ['thunder'], resist: ['wind'], m: { def: 1.4 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_harden', w: 1 }], drop: ['herb2', 0.15] });
  E('aobi', 'アオビ', 'e2_4', 9, { weak: ['ice'], absorb: ['fire'], m: { hp: 0.8, agi: 1.2 }, ai: [{ act: 'attack', w: 1 }, { act: 'e_fire', w: 2 }], drop: ['water', 0.08] });
  // ---- 海岸（ミズハ周辺） Lv11-14
  E('gyojin', 'ギョジン兵', 'e2_5', 12, { weak: ['thunder'], resist: ['ice'], ai: [{ act: 'attack', w: 3 }, { act: 'e_crush', w: 1 }], drop: ['herb2', 0.15] });
  E('shibirekurage', 'シビレクラゲ', 'e2_6', 12, { weak: ['thunder', 'fire'], m: { hp: 0.9 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_para', w: 1 }], drop: ['wakeherb', 0.2] });
  E('utagaeru', 'ウタガエル', 'e2_7', 11, { weak: ['ice'], m: { hp: 1.2 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_song', w: 1 }], drop: ['wakeherb', 0.15] });
  E('honotokage', 'ホノオトカゲ', 'e2_8', 13, { weak: ['ice'], absorb: ['fire'], ai: [{ act: 'attack', w: 2 }, { act: 'e_fireBreath', w: 1 }], drop: ['herb2', 0.1] });
  // ---- 沈みの神殿 Lv13-15
  E('suirei', 'スイレイ', 'e3_2', 14, { weak: ['thunder'], absorb: ['ice'], ai: [{ act: 'attack', w: 1 }, { act: 'e_ice', w: 2 }], drop: ['water', 0.1] });
  // ---- 焔の火口 Lv15-17
  E('magmapuru', 'マグマプル', 'e3_0', 15, { weak: ['ice'], absorb: ['fire'], m: { hp: 1.1 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_fire', w: 1 }], drop: ['herb2', 0.15] });
  E('homuraoni', 'ホムラオニ', 'e3_1', 16, { weak: ['ice'], resist: ['fire'], m: { hp: 1.3, atk: 1.1, agi: 0.8 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_crush', w: 1 }, { act: 'e_charge', w: 1 }], drop: ['seed_str', 0.03] });
  // ---- 雪原 Lv17-21
  E('yukiookami', 'ユキオオカミ', 'e3_3', 17, { weak: ['fire'], resist: ['ice'], m: { agi: 1.3 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_bite', w: 1 }], drop: ['herb2', 0.15] });
  E('yukidaruma', 'ユキダルマ兵', 'e3_5', 18, { weak: ['fire'], absorb: ['ice'], m: { hp: 1.2, def: 1.2 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_iceBreath', w: 1 }], drop: ['herb3', 0.05] });
  E('hyouga', 'ヒョウガ', 'e3_6', 18, { weak: ['fire'], resist: ['ice'], m: { hp: 0.9, agi: 1.3 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_sporeAll', w: 1 }], drop: ['wakeherb', 0.2] });
  E('koorimajo', 'コオリマジョ', 'e3_4', 20, { weak: ['fire'], absorb: ['ice'], m: { hp: 0.9, int: 1.2 }, ai: [{ act: 'attack', w: 1 }, { act: 'e_ice', w: 2 }, { act: 'e_seal', w: 1 }, { act: 'e_heal', w: 1, ifAllyHurt: true }], drop: ['water', 0.15] });
  E('hyouseki', 'ヒョウセキ', 'e1_6', 21, { tint: 0x9fd8ff, weak: ['fire', 'thunder'], resist: ['ice', 'wind'], m: { hp: 1.3, def: 1.5, agi: 0.5 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_harden', w: 1 }], drop: ['herb3', 0.08] });
  // ---- 月影の墓所 Lv22-24
  E('gaikotsu', 'ガイコツ剣士', 'e3_7', 22, { weak: ['light', 'fire'], resist: ['dark'], ai: [{ act: 'attack', w: 3 }, { act: 'e_crush', w: 1 }], drop: ['herb3', 0.08] });
  E('bourei', 'ボウレイ', 'e3_8', 23, { weak: ['light'], absorb: ['dark'], m: { hp: 0.9, agi: 1.2 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_drain', w: 2 }, { act: 'e_seal', w: 1 }], drop: ['water', 0.15] });
  E('utsuroyoroi', 'ウツロヨロイ', 'e4_0', 24, { weak: ['thunder', 'light'], m: { hp: 1.2, def: 1.4, agi: 0.8 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_para', w: 1 }, { act: 'e_heal', w: 1, ifAllyHurt: true }], drop: ['seed_life', 0.04] });
  // ---- 蝕の塔 Lv25-28
  E('kagema', 'カゲマ', 'e4_1', 26, { weak: ['light'], absorb: ['dark'], ai: [{ act: 'attack', w: 2 }, { act: 'e_dark', w: 1 }], drop: ['herb3', 0.1] });
  E('yamiwyvern', 'ヤミワイバーン', 'e4_2', 27, { weak: ['light', 'ice'], resist: ['dark'], m: { hp: 1.3, atk: 1.05 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_fireBreath', w: 1 }, { act: 'e_tail', w: 1 }], drop: ['seed_agi', 0.04] });
  E('hitotsume', 'ヒトツメ', 'e4_3', 26, { weak: ['light', 'thunder'], m: { hp: 0.9 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_sporeAll', w: 1 }, { act: 'e_seal', w: 1 }], drop: ['water2', 0.05] });
  E('zenmai', 'ゼンマイフクロウ', 'e4_8', 25, { weak: ['thunder'], resist: ['wind'], m: { agi: 1.4 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_wind', w: 1 }], drop: ['herb3', 0.1] });
  E('kamitsukibako', 'カミツキバコ', 'e4_7', 28, { weak: ['thunder'], m: { hp: 2.0, atk: 1.2, agi: 1.3, exp: 3, gold: 6 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_crush', w: 1 }], acts: 2, drop: ['elixir', 0.5] });
  // ---- 裏世界 Lv32-40
  E('sakasatenshi', 'サカサテンシ', 'e4_4', 33, { weak: ['dark'], resist: ['light'], ai: [{ act: 'attack', w: 2 }, { act: 'e_prism', w: 1 }, { act: 'e_heal', w: 1, ifAllyHurt: true }], drop: ['herb3', 0.15] });
  E('kagefutago', 'カゲフタゴ', 'e4_5', 34, { weak: ['light'], absorb: ['dark'], m: { agi: 1.3 }, acts: 2, ai: [{ act: 'attack', w: 2 }, { act: 'e_dark', w: 1 }], drop: ['water2', 0.08] });
  E('utsurokimera', 'ウツロキメラ', 'e4_6', 36, { weak: ['light'], resist: ['fire', 'ice'], m: { hp: 1.4 }, ai: [{ act: 'attack', w: 2 }, { act: 'e_fireBreath', w: 1 }, { act: 'e_iceBreath', w: 1 }], drop: ['seed_str', 0.06] });
  E('yamioni', 'ヤミオニ', 'e3_1', 35, { tint: 0x8866cc, weak: ['light'], resist: ['dark'], m: { hp: 1.4, atk: 1.1 }, ai: [{ act: 'attack', w: 3 }, { act: 'e_crush', w: 1 }], drop: ['herb3', 0.12] });
  E('kurookami', 'クロオオカミ', 'e3_3', 33, { tint: 0x7755aa, weak: ['light'], m: { agi: 1.4 }, acts: 2, ai: [{ act: 'attack', w: 3 }, { act: 'e_bite', w: 1 }], drop: ['seed_agi', 0.05] });
  E('kuromajo', 'ヨミマジョ', 'e3_4', 37, { tint: 0xaa77dd, weak: ['light'], absorb: ['dark'], ai: [{ act: 'e_dark', w: 2 }, { act: 'e_seal', w: 1 }, { act: 'e_iceBreath', w: 1 }], drop: ['water2', 0.1] });
  E('platinpuru', 'ハクギンプル', 'e1_0', 34, { tint: 0xfff4c0, resist: ['fire', 'ice', 'thunder', 'wind', 'light', 'dark'], statusResist: { sleep: 1, poison: 1, paralyze: 1, seal: 1 }, m: { hp: 0.3, def: 6, agi: 2.2, exp: 8, gold: 4 }, ai: [{ act: 'attack', w: 1 }, { act: 'e_flee', w: 2 }], metal: true });

  // ---- ボス ----
  function B(id, name, sprite, o) {
    ENEMIES[id] = Object.assign({
      id, name, sprite, boss: true, weak: [], resist: [], immune: [], absorb: [], acts: 1, drop: null, steal: null, tint: null,
      statusResist: { sleep: 0.85, paralyze: 0.85, seal: 0.5, poison: 0.3 }, luk: 10, mp: 999,
    }, o);
  }
  B('ookiba', '森の主オオキバ', 'b_wolf', { lv: 7, hp: 520, atk: 40, def: 14, int: 20, agi: 22, exp: 260, gold: 150, weak: ['fire'], resist: ['wind'],
    ai: [{ act: 'attack', w: 4 }, { act: 'e_bite', w: 2 }, { act: 'e_roar', w: 1 }], scale: 1.3 });
  B('zaraam', '甲殻王ザラーム', 'b_scorpion', { lv: 12, hp: 1100, atk: 62, def: 34, int: 40, agi: 30, exp: 900, gold: 400, weak: ['ice'], resist: ['fire', 'wind'],
    ai: [{ act: 'attack', w: 3 }, { act: 'e_poison', w: 2 }, { act: 'e_sand', w: 2 }, { act: 'e_harden', w: 1 }], scale: 1.35 });
  B('mizuchi', '深淵蛇ミズチ', 'b_serpent', { lv: 16, hp: 1350, atk: 70, def: 42, int: 56, agi: 44, exp: 1800, gold: 700, weak: ['thunder'], absorb: ['ice'],
    acts: 1, ai: [{ act: 'attack', w: 3 }, { act: 'e_whirl', w: 2 }, { act: 'e_song', w: 1 }, { act: 'e_tail', w: 1 }], scale: 1.4 });
  B('borganos', '炎角竜ボルガノス', 'b_dragon', { lv: 18, hp: 2100, atk: 80, def: 50, int: 60, agi: 40, exp: 2600, gold: 900, weak: ['ice'], absorb: ['fire'],
    acts: 2, ai: [{ act: 'attack', w: 3 }, { act: 'e_fireBreath', w: 2 }, { act: 'e_tail', w: 1 }, { act: 'e_charge', w: 1 }], scale: 1.45 });
  B('prisma', '七彩晶の番人プリズマ', 'b_prism', { lv: 22, hp: 2600, atk: 92, def: 60, int: 80, agi: 46, exp: 4200, gold: 1300,
    prism: { cycle: ['ice', 'thunder', 'wind', 'light', 'fire'], crackNeed: 2, breakTurns: 2 },
    statusResist: { sleep: 1, paralyze: 1, seal: 0.8, poison: 1 },
    acts: 1, ai: [{ act: 'attack', w: 3 }, { act: 'e_prism', w: 2 }, { act: 'e_harden', w: 1 }], scale: 1.4 });
  B('valgoat', '墓守の黒騎士ヴァルゴート', 'b_knight', { lv: 25, hp: 3200, atk: 108, def: 72, int: 80, agi: 58, exp: 6000, gold: 1800, weak: ['light'], resist: ['dark', 'ice'],
    acts: 2, ai: [{ act: 'attack', w: 4 }, { act: 'e_sweep', w: 2 }, { act: 'e_para', w: 1 }, { act: 'e_seal', w: 1 }, { act: 'e_dark', w: 1 }], scale: 1.4 });
  B('gatekeeper', '蝕の門番ヴァルゴート・影', 'b_knight', { lv: 27, hp: 3800, atk: 128, def: 78, int: 90, agi: 62, exp: 6500, gold: 2000, weak: ['light'], resist: ['dark'], tint: 0x9977ff,
    acts: 2, ai: [{ act: 'attack', w: 4 }, { act: 'e_sweep', w: 2 }, { act: 'e_dark', w: 1 }, { act: 'e_seal', w: 1 }], scale: 1.4 });
  B('yomigarasu', '蝕王ヨミガラス', 'b_yomi1', { lv: 30, hp: 2500, atk: 112, def: 70, int: 80, agi: 70, exp: 0, gold: 0, weak: ['light'], resist: ['dark', 'fire'],
    statusResist: { sleep: 1, paralyze: 1, seal: 0.9, poison: 0.6 },
    acts: 2, ai: [{ act: 'attack', w: 3 }, { act: 'e_eclipse', w: 2 }, { act: 'e_iceBreath', w: 1 }, { act: 'e_seal', w: 1 }, { act: 'e_heal', w: 1, ifSelfHurt: true }], scale: 1.45,
    nextPhase: 'yomigarasu2' });
  B('yomigarasu2', '蝕王ヨミガラス（真の姿）', 'b_yomi2', { lv: 32, hp: 3000, atk: 120, def: 74, int: 86, agi: 76, exp: 20000, gold: 5000, weak: ['light'], resist: ['dark'],
    statusResist: { sleep: 1, paralyze: 1, seal: 1, poison: 0.8 },
    acts: 2, ai: [{ act: 'attack', w: 3 }, { act: 'e_eclipse', w: 2 }, { act: 'e_crush', w: 1 }, { act: 'e_dispel', w: 1 }, { act: 'e_paraAll', w: 1 }], scale: 1.55 });
  B('amnes', '無灯王アムネス', 'b_amnes', { lv: 48, hp: 7000, atk: 162, def: 100, int: 80, agi: 110, exp: 60000, gold: 20000, weak: [], resist: ['dark', 'light'],
    statusResist: { sleep: 1, paralyze: 1, seal: 1, poison: 1 },
    acts: 2, ai: [{ act: 'attack', w: 4 }, { act: 'e_void', w: 2 }, { act: 'e_voidStar', w: 1 }, { act: 'e_dispel', w: 1 }, { act: 'e_seal', w: 1 }, { act: 'e_poisonAll', w: 1 }], scale: 1.55,
    rage: { below: 0.3, acts: 3 } });

  // ---------- 敵グループ（出現テーブル） ----------
  // rate: 次のエンカウントまでの歩数範囲 / groups: [重み, [敵ID...]]
  const ENCOUNTERS = {
    fieldA: { bg: 'bg_plains', rate: [18, 30], groups: [[4, ['aopuru', 'aopuru']], [3, ['aopuru', 'togenezumi']], [3, ['tsutsuki']], [2, ['togenezumi', 'tsutsuki']], [3, ['nemuridake']], [3, ['dokuimo', 'aopuru']], [2, ['aopuru', 'aopuru', 'aopuru']]] },
    cave1: { bg: 'bg_cave', rate: [16, 26], groups: [[3, ['kibakomori', 'kibakomori']], [3, ['ishikoron']], [2, ['nemuridake', 'dokuimo']], [2, ['kibakomori', 'nemuridake']], [2, ['ishikoron', 'kibakomori']], [1, ['dokuimo', 'dokuimo', 'togenezumi']]] },
    fieldB: { bg: 'bg_plains', rate: [18, 30], groups: [[3, ['akapuru', 'akapuru']], [3, ['kazenoko', 'akapuru']], [2, ['yoroigani']], [2, ['kazenoko', 'kazenoko']], [2, ['yoroigani', 'akapuru']], [2, ['utagaeru']], [1, ['akapuru', 'akapuru', 'kazenoko']]] },
    desert: { bg: 'bg_desert', rate: [18, 30], groups: [[3, ['sunahebi', 'sunahebi']], [3, ['kurosasori']], [2, ['houtai', 'sunahebi']], [2, ['kurosasori', 'houtai']], [1, ['ginpuru']], [2, ['houtai', 'houtai']]] },
    tower2: { bg: 'bg_desert', rate: [16, 26], groups: [[3, ['ishigargo']], [3, ['aobi', 'aobi']], [2, ['houtai', 'aobi']], [2, ['kurosasori', 'ishigargo']], [1, ['ginpuru', 'aobi']], [2, ['aobi', 'houtai', 'sunahebi']]] },
    fieldC: { bg: 'bg_plains', rate: [18, 30], groups: [[3, ['gyojin']], [3, ['shibirekurage', 'shibirekurage']], [2, ['utagaeru', 'gyojin']], [2, ['honotokage']], [2, ['gyojin', 'shibirekurage']], [1, ['ginpuru', 'ginpuru']]] },
    temple3: { bg: 'bg_temple', rate: [16, 26], groups: [[3, ['suirei', 'suirei']], [3, ['gyojin', 'shibirekurage']], [2, ['suirei', 'gyojin']], [2, ['shibirekurage', 'shibirekurage', 'suirei']], [2, ['utagaeru', 'suirei']]] },
    volcano4: { bg: 'bg_volcano', rate: [16, 26], groups: [[3, ['magmapuru', 'magmapuru']], [3, ['homuraoni']], [2, ['honotokage', 'magmapuru']], [2, ['homuraoni', 'honotokage']], [2, ['magmapuru', 'magmapuru', 'honotokage']]] },
    fieldD: { bg: 'bg_snow', rate: [18, 30], groups: [[3, ['yukiookami', 'yukiookami']], [3, ['yukidaruma']], [2, ['hyouga', 'yukiookami']], [2, ['koorimajo']], [2, ['yukidaruma', 'hyouga']], [1, ['ginpuru', 'ginpuru', 'ginpuru']]] },
    ice5: { bg: 'bg_snow', rate: [16, 26], groups: [[3, ['koorimajo', 'hyouga']], [3, ['hyouseki']], [2, ['yukidaruma', 'koorimajo']], [2, ['hyouseki', 'hyouga']], [2, ['hyouga', 'hyouga', 'yukiookami']]] },
    grave6: { bg: 'bg_grave', rate: [16, 26], groups: [[3, ['gaikotsu', 'gaikotsu']], [3, ['bourei', 'gaikotsu']], [2, ['utsuroyoroi']], [2, ['bourei', 'bourei']], [2, ['utsuroyoroi', 'bourei']]] },
    tower7: { bg: 'bg_tower', rate: [16, 26], groups: [[3, ['kagema', 'kagema']], [3, ['yamiwyvern']], [2, ['hitotsume', 'kagema']], [2, ['zenmai', 'zenmai', 'hitotsume']], [2, ['yamiwyvern', 'zenmai']], [2, ['kagema', 'hitotsume', 'zenmai']]] },
    reverse: { bg: 'bg_reverse', rate: [18, 30], groups: [[3, ['sakasatenshi', 'kurookami']], [3, ['yamioni']], [2, ['kagefutago']], [2, ['kurookami', 'kurookami']], [1, ['platinpuru']], [2, ['kuromajo', 'yamioni']]] },
    reverseD: { bg: 'bg_reverse', rate: [16, 26], groups: [[3, ['utsurokimera']], [3, ['kagefutago', 'sakasatenshi']], [2, ['kuromajo', 'kuromajo']], [2, ['yamioni', 'utsurokimera']], [1, ['platinpuru', 'platinpuru']], [2, ['kurookami', 'kagefutago']]] },
  };

  const BOSS_GROUPS = {
    ookiba: { enemies: ['ookiba'], bg: 'bg_cave' },
    zaraam: { enemies: ['zaraam'], bg: 'bg_desert' },
    mizuchi: { enemies: ['mizuchi'], bg: 'bg_temple' },
    borganos: { enemies: ['borganos'], bg: 'bg_volcano' },
    prisma: { enemies: ['prisma'], bg: 'bg_snow' },
    valgoat: { enemies: ['valgoat'], bg: 'bg_grave' },
    gatekeeper: { enemies: ['gatekeeper'], bg: 'bg_tower' },
    yomigarasu: { enemies: ['yomigarasu'], bg: 'bg_tower' },
    amnes: { enemies: ['amnes'], bg: 'bg_reverse' },
    mimic: { enemies: ['kamitsukibako'], bg: 'bg_tower', boss: false, noEscape: true },
  };

  // ---------- 店 ----------
  const SHOPS = {
    lanta_item: { kind: 'item', items: ['herb', 'antidote', 'wakeherb', 'feather', 'incense'] },
    lanta_gear: { kind: 'gear', items: ['club', 'dagger', 'wand', 'copper_sword', 'iron_claw', 'cloth', 'travel_cloth', 'leather_shield', 'charm'] },
    fior_item: { kind: 'item', items: ['herb', 'herb2', 'antidote', 'wakeherb', 'feather', 'incense', 'smoke', 'water'] },
    fior_gear: { kind: 'gear', items: ['iron_sword', 'iron_axe', 'moth_knife', 'oak_staff', 'steel_claw', 'leather_armor', 'silk_robe', 'iron_shield', 'swift_ring'] },
    sahar_item: { kind: 'item', items: ['herb', 'herb2', 'antidote', 'wakeherb', 'water', 'lifelamp', 'feather', 'smoke', 'antidote_charm'] },
    sahar_gear: { kind: 'gear', items: ['steel_sword', 'battle_axe', 'steel_lance', 'desert_dagger', 'sorcerer_staff', 'bone_claw', 'iron_armor', 'sand_garb', 'magic_robe', 'steel_shield'] },
    mizuha_item: { kind: 'item', items: ['herb2', 'herb3', 'panacea', 'water', 'lifelamp', 'feather', 'stone_fire', 'stone_ice', 'stone_thunder', 'stone_wind', 'stone_light'] },
    mizuha_gear: { kind: 'gear', items: ['tide_sword', 'wave_axe', 'knight_lance', 'azure_knife', 'tide_staff', 'oni_claw', 'steel_armor', 'ninja_garb', 'sage_robe', 'mirror_shield', 'guard_ring'] },
    shirane_item: { kind: 'item', items: ['herb2', 'herb3', 'panacea', 'water', 'lifelamp', 'feather', 'stone_fire', 'stone_ice', 'stone_thunder', 'stone_wind', 'stone_light'] },
    shirane_gear: { kind: 'gear', items: ['frost_sword', 'avalanche_axe', 'holy_lance', 'moon_dagger', 'frost_staff', 'tiger_claw', 'silver_armor', 'leopard_garb', 'moon_robe', 'silver_shield', 'wisdom_ring', 'power_ring', 'awake_charm'] },
    sakasa_item: { kind: 'item', items: ['herb3', 'water2', 'panacea', 'lifelamp', 'feather', 'incense', 'stone_light'] },
    sakasa_gear: { kind: 'gear', items: ['star_sword', 'star_axe', 'star_lance', 'star_staff', 'star_knife', 'star_claw', 'star_armor', 'star_garb', 'star_robe', 'star_shield', 'star_ring'] },
  };

  // 帰り鳥の羽で戻れる町（マップIDと到着位置）
  const TOWNS = {
    lanta: { name: 'ランタ村', map: 'ow', x: 8, y: 40 },
    fior: { name: 'フィオルの町', map: 'ow', x: 32, y: 42 },
    sahar: { name: '砂の都サハルナ', map: 'ow', x: 53, y: 42 },
    mizuha: { name: '港町ミズハ', map: 'ow', x: 53, y: 20 },
    shirane: { name: '雪の里シラネ', map: 'ow', x: 10, y: 15 },
    sakasa: { name: 'サカサ村', map: 'rev', x: 9, y: 11 },
  };

  const NAME_POOL = ['アキラ', 'ミオ', 'ソウタ', 'ヒナ', 'レン', 'ユイ', 'カイ', 'ナギ', 'トワ', 'リツ', 'サクヤ', 'ホタル', 'イブキ', 'セナ', 'ハル', 'ルカ', 'コハク', 'ツムギ'];
  const ROSTER_MAX = 8;
  const PARTY_MAX = 4;
  const ORB_COLORS = ['緑', '黄金', '青', '赤', '白', '紫'];
  const ELEM_COLOR = { fire: ['赤', 0xff5a3c], ice: ['水色', 0x7fd8ff], thunder: ['黄', 0xffe14a], wind: ['緑', 0x6ee07a], light: ['白', 0xffffff], dark: ['紫', 0x9a5cff], none: ['無色', 0xcccccc] };

  return {
    LV_CAP, STAT_CAP, STAT_KEYS, CLASSES, CLASS_ORDER, SKILLS, ITEMS, ENEMIES, ENCOUNTERS, BOSS_GROUPS, SHOPS, TOWNS,
    NAME_POOL, ROSTER_MAX, PARTY_MAX, ORB_COLORS, ELEM_COLOR, expToNext, totalExpFor, enemyStats,
  };
})();

if (typeof module !== 'undefined') module.exports = DATA;
