'use strict';
// =============================================================
// マップ・イベント・シナリオ定義
//  地形記号（LEGEND）と、マップごとの配置記号（marks）でマップを表す。
//  スクリプトは配列の命令列（FieldEvents が解釈する）。
// =============================================================
const MAPS = (() => {
  // ---------- 地形凡例 ----------
  // tile: 地面テクスチャ / obj: 上に置くオブジェクト / block: 通行不可 / dmg: 踏むとダメージ
  const LEGEND = {
    '.': { tile: 'grass' },
    ':': { tile: 'dirt' },
    's': { tile: 'sand' },
    'n': { tile: 'snow' },
    '~': { tile: 'water', block: true, water: true },
    'p': { tile: 'swamp', dmg: 'swamp' },
    'L': { tile: 'lava', dmg: 'lava' },
    '_': { tile: 'cobble' },
    'w': { tile: 'wood' },
    'o': { tile: 'stonefloor' },
    '#': { tile: 'stonewall', block: true, wall: true },
    'B': { tile: 'brick', block: true, wall: true },
    'i': { tile: 'ice' },
    'r': { tile: 'carpet' },
    '=': { tile: 'bridge' },
    ' ': { tile: null, block: true },
    'f': { tile: 'grass', obj: 'obj_tree', forest: true },
    'T': { tile: 'grass', obj: 'obj_tree', block: true },
    'P': { tile: 'snow', obj: 'obj_pine', block: true },
    'M': { tile: 'grass', obj: 'obj_mountain', block: true },
    'N': { tile: 'snow', obj: 'obj_mountain', block: true },
    'F': { tile: null, obj: 'obj_fence', block: true },
    'C': { tile: 'wood', obj: 'obj_counter', block: true, counter: true },
    'K': { tile: 'wood', obj: 'obj_bookshelf', block: true },
    'W': { tile: null, obj: 'obj_well', block: true },
    'S': { tile: null, obj: 'obj_statue', block: true },
    'b': { tile: null, obj: 'obj_barrel', block: true },
    'h': { tile: null, obj: 'obj_brazier', block: true },
    'c': { tile: 'sand', obj: 'obj_cactus', block: true },
    'l': { tile: 'sand', obj: 'obj_palm', block: true },
    'g': { tile: null, obj: 'obj_grave', block: true },
    'y': { tile: null, obj: 'obj_flowers' },
    'k': { tile: null, obj: 'obj_crystal', block: true },
    'e': { tile: 'wood', obj: 'obj_bed', block: true },
  };

  // ---------- 描画用ユーティリティ ----------
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function grid(w, h, ch) { return Array.from({ length: h }, () => Array(w).fill(ch)); }
  function rect(g, x0, y0, x1, y1, ch) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = ch;
  }
  function scatter(g, x0, y0, x1, y1, ch, dens, seed, onlyOn) {
    const r = rng(seed);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (r() < dens && (!onlyOn || g[y][x] === onlyOn)) g[y][x] = ch;
    }
  }
  function hline(g, x0, x1, y, ch) { rect(g, Math.min(x0, x1), y, Math.max(x0, x1), y, ch); }
  function vline(g, x, y0, y1, ch) { rect(g, x, Math.min(y0, y1), x, Math.max(y0, y1), ch); }
  function clear(g, x, y, r, ch) { rect(g, x - r, y - r, x + r, y + r, ch); }
  function toRows(g) { return g.map((r) => r.join('')); }
  function flip(rows) { return rows.slice().reverse().map((r) => r.split('').reverse().join('')); }

  const M = {};

  // =========================================================
  // フィールド（表ソラ） 64x48
  // =========================================================
  (function buildOverworld() {
    const g = grid(64, 48, '~');
    // --- 北西: 雪原（地域D）
    rect(g, 2, 2, 26, 23, 'n');
    rect(g, 27, 2, 29, 23, 'N');
    scatter(g, 2, 2, 26, 22, 'P', 0.1, 7, 'n');
    rect(g, 15, 18, 19, 20, 'p');
    rect(g, 2, 2, 3, 23, 'N');
    // --- 北東: 海岸（地域C）
    rect(g, 30, 2, 55, 23, '.');
    scatter(g, 30, 2, 55, 23, 'f', 0.08, 11, '.');
    rect(g, 31, 2, 39, 9, 'M');
    rect(g, 32, 3, 38, 8, 'L');
    vline(g, 35, 5, 9, ':');
    rect(g, 36, 11, 44, 19, '~');
    rect(g, 39, 14, 41, 16, '.');
    rect(g, 56, 2, 61, 23, '~');
    rect(g, 58, 7, 60, 11, '.');
    hline(g, 55, 57, 9, '=');
    // --- 中央山脈と峠
    rect(g, 30, 24, 61, 26, 'M');
    // --- 南西: 草原（地域A）
    rect(g, 2, 27, 23, 46, '.');
    scatter(g, 2, 28, 23, 46, 'f', 0.1, 21, '.');
    rect(g, 14, 28, 22, 33, 'f');
    rect(g, 2, 27, 23, 27, 'M');
    rect(g, 24, 27, 25, 46, '~');
    hline(g, 24, 25, 38, '=');
    // --- 南東: 平原と砂漠（地域B）
    rect(g, 26, 27, 61, 46, '.');
    rect(g, 26, 27, 61, 27, 'M');
    scatter(g, 26, 28, 43, 46, 'f', 0.07, 31, '.');
    rect(g, 36, 30, 40, 33, 'M');
    rect(g, 28, 30, 31, 32, 'p');
    rect(g, 44, 28, 61, 46, 's');
    scatter(g, 44, 28, 61, 46, 'c', 0.05, 41, 's');
    vline(g, 49, 24, 27, ':');
    // 道
    hline(g, 9, 23, 40, ':'); vline(g, 23, 38, 40, ':');
    hline(g, 26, 32, 38, ':'); vline(g, 32, 38, 42, ':');
    hline(g, 32, 49, 36, ':'); vline(g, 49, 28, 36, ':');
    // アイコン周囲をならす
    const pts = [[8, 40, '.'], [18, 30, 'f'], [32, 42, '.'], [53, 42, 's'], [58, 31, 's'], [53, 20, '.'], [47, 21, '.'], [10, 15, 'n'], [5, 5, 'n'], [22, 5, 'n'], [14, 22, 'n'], [40, 20, '.']];
    for (const [x, y, c] of pts) clear(g, x, y, 1, c);
    g[40][8] = '.'; g[30][18] = '.'; g[42][32] = '.'; g[42][53] = 's'; g[31][58] = 's'; g[20][53] = '.';
    g[15][10] = 'n'; g[5][5] = 'n'; g[5][22] = 'n'; g[23][14] = 'n'; g[15][40] = '.'; g[4][35] = ':';
    rect(g, 40, 17, 40, 19, '~');
    rect(g, 2, 24, 26, 24, '~');
    // 海岸線をでこぼこにして自然な形にする（道・橋・施設の周囲は残す）
    const keep = new Set();
    for (const [x, y] of pts) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) keep.add((x + dx) + ',' + (y + dy));
    const r2 = rng(1234);
    const roughen = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
        if (edge > 1) continue;
        const c = g[y][x];
        if (c === '~' || c === ':' || c === '=' || keep.has(x + ',' + y)) continue;
        const nearSea = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (g[y + dy] || [])[x + dx] === '~');
        if (!nearSea) continue;
        if (r2() < (edge === 0 ? 0.45 : 0.18)) g[y][x] = '~';
      }
    };
    roughen(2, 2, 26, 23); roughen(30, 2, 55, 23); roughen(2, 28, 23, 46); roughen(26, 28, 61, 46);
    M.ow = {
      id: 'ow', name: 'ソラの大地', tiles: toRows(g), ground: '.', bgm: 'field', outdoor: true,
      enc: (x, y, ch) => {
        if (y >= 27) {
          if (x < 24) return 'fieldA';
          return ch === 's' ? 'desert' : 'fieldB';
        }
        if (x < 30) return 'fieldD';
        return 'fieldC';
      },
      entities: [
        { type: 'warp', x: 8, y: 40, sprite: 'obj_town', to: 'lanta', at: 'entry', town: 'lanta', label: 'ランタ村' },
        { type: 'warp', x: 18, y: 30, sprite: 'obj_cave', to: 'cave1_1', at: '<', label: 'ささやきの森洞' },
        { type: 'warp', x: 32, y: 42, sprite: 'obj_town', to: 'fior', at: 'entry', town: 'fior', label: 'フィオルの町' },
        { type: 'warp', x: 53, y: 42, sprite: 'obj_town', to: 'sahar', at: 'entry', town: 'sahar', label: '砂の都サハルナ' },
        { type: 'warp', x: 58, y: 31, sprite: 'obj_tower', to: 'tower2_1', at: '<', label: '砂塵の塔' },
        { type: 'warp', x: 53, y: 20, sprite: 'obj_town', to: 'mizuha', at: 'entry', town: 'mizuha', label: '港町ミズハ' },
        { type: 'warp', x: 59, y: 9, sprite: 'obj_tower', to: 'temple3_1', at: '<', label: '沈みの神殿', tint: 0x88ccff },
        { type: 'warp', x: 35, y: 4, sprite: 'obj_cave', to: 'volcano4_1', at: '<', label: '焔の火口', tint: 0xff9a70 },
        { type: 'warp', x: 10, y: 15, sprite: 'obj_town', to: 'shirane', at: 'entry', town: 'shirane', label: '雪の里シラネ' },
        { type: 'warp', x: 5, y: 5, sprite: 'obj_cave', to: 'ice5_1', at: '<', label: '氷晶の洞', tint: 0xaee6ff },
        { type: 'warp', x: 22, y: 5, sprite: 'obj_castle', to: 'grave6_1', at: '<', label: '月影の墓所', tint: 0xb0b0ff },
        { type: 'warp', x: 40, y: 15, sprite: 'obj_castle', to: 'tower7_1', at: '<', label: '蝕の塔' },
        {
          type: 'npc', x: 14, y: 23, sprite: 'obj_boat', name: '渡し舟', script: [
            ['choice', '渡し舟だ。港町ミズハへ戻りますか？', [['はい', [['sfx', 'warp'], ['warp', 'ow', 53, 21]]], ['いいえ', []]]],
          ],
        },
        {
          type: 'npc', x: 24, y: 38, sprite: 'npc_guard', name: '橋番', hideIf: 'item:orb1', script: [
            ['say', '橋番', 'この先の平原は 魔物が強い。見習いを 通すわけにはいかん。'],
            ['say', '橋番', '北の森の洞窟で 光るものが落ちたと聞く。それを持って来られたら 認めてやろう。'],
          ],
        },
        {
          type: 'npc', x: 49, y: 26, sprite: 'obj_rubble', name: '落石', hideIf: 'pass_open', script: [
            ['msg', '大きな落石が 山道をふさいでいる。人の手を借りないと どかせそうにない。'],
            ['msg', '（砂の都サハルナの族長なら 人手を出してくれるかもしれない）'],
          ],
        },
        {
          type: 'npc', x: 39, y: 20, sprite: 'obj_altar', name: '星見の祭壇', script: [
            ['if', 'lightbridge', [['msg', '祭壇の上で 六つのオーブが 静かに輝いている。']],
              [['if', 'orbs>=6', [
                ['msg', '六つのオーブを 祭壇に捧げた……'],
                ['sfx', 'magic'], ['flash'], ['wait', 400],
                ['msg', 'オーブの光が 湖の上に伸び、光の橋が かかった！'],
                ['flag', 'lightbridge'],
                ['msg', '湖の中央に そびえる蝕の塔へ 渡れるようになった。'],
              ], [
                ['msg', '古い祭壇だ。六つのくぼみがある。'],
                ['msg', '（オーブを六つ集めて ここに捧げれば 何かが起こりそうだ）'],
              ]]]],
          ],
        },
        { type: 'bridge', x: 40, y: 17, showIf: 'lightbridge' },
        { type: 'bridge', x: 40, y: 18, showIf: 'lightbridge' },
        { type: 'bridge', x: 40, y: 19, showIf: 'lightbridge' },
        { type: 'sign', x: 10, y: 39, text: '北東：ささやきの森洞　東：フィオルの町（橋を渡る）' },
        { type: 'sign', x: 48, y: 37, text: '北：山道（ミズハ方面）　東：砂の都サハルナ' },
      ],
    };
  })();

  // =========================================================
  // 裏ソラ 32x24
  // =========================================================
  (function buildReverse() {
    const g = grid(32, 24, ' ');
    rect(g, 2, 2, 29, 21, '.');
    scatter(g, 2, 2, 29, 21, 'f', 0.12, 99, '.');
    rect(g, 14, 2, 16, 13, 'M');
    rect(g, 15, 9, 15, 9, ':');
    rect(g, 20, 14, 26, 18, 'p');
    for (const [x, y] of [[9, 11], [24, 6], [5, 18], [15, 9]]) clear(g, x, y, 1, '.');
    g[9][15] = ':';
    M.rev = {
      id: 'rev', name: '裏ソラ', tiles: toRows(g), ground: '.', bgm: 'reverse', outdoor: true, tint: 0xc4a0ff, enc: () => 'reverse',
      entities: [
        { type: 'warp', x: 9, y: 11, sprite: 'obj_town', to: 'sakasa', at: 'entry', town: 'sakasa', label: 'サカサ村', tint: 0xd0b0ff },
        { type: 'warp', x: 24, y: 6, sprite: 'obj_castle', to: 'rev1', at: '<', label: '逆さ灯の迷宮', tint: 0xffe0a0 },
        { type: 'warp', x: 5, y: 18, sprite: 'obj_portal', to: 'lanta', at: 'portal', label: 'ランタ村への裂け目' },
        { type: 'sign', x: 10, y: 13, text: '――さかさ村へ ようこそ。灯の裏側、影の住まう地。' },
      ],
    };
  })();

  // =========================================================
  // 町（共通レイアウトを町ごとに装飾・配置替え）
  // =========================================================
  function building(g, x, y, w, h, floor, doorX) {
    rect(g, x, y, x + w - 1, y + h - 1, 'B');
    rect(g, x + 1, y + 1, x + w - 2, y + h - 2, floor);
    g[y + h - 1][doorX] = floor;
  }
  function makeTown(o) {
    const W = 24, H = 18;
    const g = grid(W, H, o.ground);
    rect(g, 0, 0, W - 1, 0, o.border); rect(g, 0, H - 1, W - 1, H - 1, o.border);
    rect(g, 0, 0, 0, H - 1, o.border); rect(g, W - 1, 0, W - 1, H - 1, o.border);
    g[H - 1][11] = o.ground; g[H - 1][12] = o.ground;
    // 長老／族長の家（左上）
    building(g, 2, 2, 8, 6, 'w', 5);
    g[3][3] = 'K'; g[3][4] = 'K'; g[3][8] = 'e';
    // 宿屋（右上）
    building(g, 14, 2, 8, 5, 'w', 17);
    rect(g, 15, 4, 16, 4, 'C'); g[3][20] = 'e'; g[4][20] = 'e';
    // 道具屋（左下）
    building(g, 2, 10, 6, 5, 'w', 4); g[12][4] = 'C'; g[12][3] = 'C'; g[12][5] = 'C';
    // 武器防具屋（右下）
    building(g, 16, 10, 6, 5, 'w', 18); g[12][17] = 'C'; g[12][18] = 'C'; g[12][19] = 'C';
    // 広場
    vline(g, 11, 8, 16, o.path); vline(g, 12, 8, 16, o.path);
    hline(g, 5, 18, 8, o.path);
    g[10][11] = 'W';
    for (const [x, y] of o.deco || []) g[y][x] = o.decoCh || 'y';
    (o.extra || (() => {}))(g);
    const ents = [
      { type: 'npc', x: 16, y: 3, sprite: 'npc_woman', name: '宿屋', script: [['inn', o.inn]] },
      { type: 'npc', x: 4, y: 11, sprite: 'npc_merchant', name: 'どうぐ屋', script: [['shop', o.id + '_item']] },
      { type: 'npc', x: 18, y: 11, sprite: 'npc_merchant', name: '武器と防具の店', script: [['shop', o.id + '_gear']] },
      { type: 'npc', x: 13, y: 7, sprite: 'npc_sage', name: '灯守ギルド', script: [['guild']] },
      { type: 'mark', x: 11, y: 16, mark: 'entry' },
    ].concat(o.npcs || []);
    M[o.id] = {
      id: o.id, name: o.name, tiles: toRows(g), ground: o.ground, bgm: o.bgm || 'town', town: true, tint: o.tint,
      exit: o.exit, entities: ents,
    };
  }

  makeTown({
    id: 'lanta', name: 'ランタ村', ground: '.', border: 'T', path: '_', inn: 4, exit: { to: 'ow', x: 8, y: 40 },
    deco: [[2, 9], [3, 9], [20, 8], [21, 8], [8, 15], [15, 15]],
    npcs: [
      {
        type: 'npc', x: 6, y: 4, sprite: 'npc_elder', name: '長老トウジ', script: [
          ['if', 'final_clear', [
            ['say', '長老トウジ', '空に天灯が戻った。……じゃが 広場に開いた裂け目は 閉じぬままじゃ。'],
            ['say', '長老トウジ', 'あの向こうは「裏ソラ」。灯の影が 集まる場所と 言い伝えにある。'],
          ], [['if', 'lightbridge', [
            ['say', '長老トウジ', '光の橋がかかったか！ 蝕の塔の頂に ヨミガラスがおる。'],
            ['say', '長老トウジ', '塔の中は 強い魔物ばかりじゃ。宿で休み、万全で挑むのじゃぞ。'],
          ], [['if', 'orbs>=6', [
            ['say', '長老トウジ', '六つすべて 集めたか！ 大したものじゃ。'],
            ['say', '長老トウジ', 'ミズハの西、湖のほとりに「星見の祭壇」がある。そこにオーブを捧げるのじゃ。'],
          ], [['if', 'item:orb1', [
            ['say', '長老トウジ', '風のオーブを 取り戻したか。よくやった！'],
            ['say', '長老トウジ', '橋番にはもう話を通しておいた。東の平原を越え、フィオルの町を訪ねるとよい。'],
            ['say', '長老トウジ', 'オーブは あと{orbsLeft}つ。各地の町で 話を聞くのじゃぞ。'],
          ], [
            ['say', '長老トウジ', '昨夜、空の天灯が 砕け散った。空はこのとおり 薄闇に沈んでおる。'],
            ['say', '長老トウジ', '蝕の魔「ヨミガラス」の仕業じゃ。天灯のかけら――六つのオーブは 大地に散った。'],
            ['say', '長老トウジ', '灯守の見習いであるお主らに 頼みたい。まずは北東の「ささやきの森洞」へ。緑の光が落ちたそうじゃ。'],
            ['say', '長老トウジ', '宿屋・どうぐ屋・武器屋は この村にもある。準備を整えてから 出発するのじゃぞ。'],
            ['flag', 'intro'],
          ]]]]]]]],
        ],
      },
      { type: 'npc', x: 8, y: 13, sprite: 'npc_child', name: '子ども', wander: true, script: [['say', '子ども', 'ねえ知ってる？ 岩は 押すと動くんだって。塔で 困ったら 押してみて！']] },
      { type: 'npc', x: 14, y: 9, sprite: 'npc_man', name: '村人', wander: true, script: [['say', '村人', '宝箱には 鍵が入っていることもある。鍵のかかった扉は 調べれば開けられるぞ。']] },
      { type: 'npc', x: 19, y: 15, sprite: 'npc_woman', name: '村人', script: [['say', '村人', 'ギルドでは 仲間の登録や 入れ替えができるわ。先頭に立つ人ほど 魔物に狙われやすいのよ。']] },
      { type: 'npc', x: 3, y: 16, sprite: 'npc_guard', name: '見張り', script: [['say', '見張り', '毒は 戦いが終わっても 残る。毒消し草か 宿屋で 治すんだ。']] },
      { type: 'sign', x: 10, y: 16, text: 'ランタ村 ― 灯台と灯守の村' },
      {
        type: 'warp', x: 12, y: 5, sprite: 'obj_portal', to: 'rev', at: [5, 17], showIf: 'final_clear', label: '裏ソラへの裂け目',
      },
      { type: 'mark', x: 12, y: 6, mark: 'portal' },
    ],
  });

  makeTown({
    id: 'fior', name: 'フィオルの町', ground: '_', border: 'T', path: ':', inn: 8, exit: { to: 'ow', x: 32, y: 42 },
    deco: [[1, 9], [2, 9], [3, 9], [20, 9], [21, 9], [22, 9], [9, 15], [14, 15]],
    npcs: [
      { type: 'npc', x: 6, y: 5, sprite: 'npc_elder', name: '町長', script: [
        ['if', 'item:orb2', [['say', '町長', '地のオーブを取り戻したとは！ サハルナの族長にも 知らせてあげなされ。']],
          [['say', '町長', '東の砂漠の奥に 砂の都サハルナがある。その北東の「砂塵の塔」に 黄金の光が落ちたそうだ。'],
            ['say', '町長', '砂漠の魔物は 毒を使う。毒消し草を 多めに持っていきなさい。']]],
      ] },
      { type: 'npc', x: 9, y: 12, sprite: 'npc_man', name: '旅人', wander: true, script: [['say', '旅人', '塔の仕掛けは 床のスイッチだ。全部踏めば 柵が開くって話さ。']] },
      { type: 'npc', x: 15, y: 13, sprite: 'npc_child', name: '子ども', wander: true, script: [['say', '子ども', '魔物にも 苦手な属性があるんだよ。「弱点を突いた！」って出たら 大当たり！']] },
      { type: 'npc', x: 20, y: 16, sprite: 'npc_woman', name: '町の人', script: [['say', '町の人', '銀色に光るプルを見た？ すぐ逃げちゃうけど、倒せば経験値がたくさんもらえるの。']] },
    ],
  });

  makeTown({
    id: 'sahar', name: '砂の都サハルナ', ground: 's', border: 'l', path: '_', inn: 14, exit: { to: 'ow', x: 53, y: 42 },
    deco: [[2, 9], [21, 9], [9, 15], [14, 15]], decoCh: 'c',
    npcs: [
      { type: 'npc', x: 6, y: 4, sprite: 'npc_elder', name: '族長ラザン', script: [
        ['if', 'pass_open', [['say', '族長ラザン', '北の山道は通れるようにしてある。港町ミズハは その先だ。']],
          [['if', 'item:orb2', [
            ['say', '族長ラザン', 'おお……砂塵の塔の魔物を 退けたのか！ これで都も安心だ。'],
            ['say', '族長ラザン', '礼に 北の山道の落石を 取り除かせよう。その先には 港町ミズハがある。'],
            ['item', 'letter'], ['flag', 'pass_open'],
            ['say', '族長ラザン', 'この書状があれば 関所も通れる。気をつけてな。'],
          ], [
            ['say', '族長ラザン', '北東の砂塵の塔に 巨大なサソリの王が 住みついた。都の者は 近寄れん。'],
            ['say', '族長ラザン', 'お主らが 退けてくれるなら、北の山道を 開いてやろう。'],
          ]]]],
      ] },
      { type: 'npc', x: 9, y: 13, sprite: 'npc_man', name: '商人', wander: true, script: [['say', '商人', '命の灯は 倒れた仲間を 生き返らせる。高いが 一つは持っておきな。']] },
      { type: 'npc', x: 15, y: 9, sprite: 'npc_guard', name: '衛兵', script: [['say', '衛兵', 'サソリの王は 氷に弱いらしい。砂漠の熱い魔物は たいてい そうだ。']] },
    ],
  });

  makeTown({
    id: 'mizuha', name: '港町ミズハ', ground: '_', border: 'T', path: 'w', inn: 20, exit: { to: 'ow', x: 53, y: 20 },
    deco: [[9, 15], [14, 15]], decoCh: 'b',
    extra: (g) => { rect(g, 20, 15, 22, 16, '~'); },
    npcs: [
      { type: 'npc', x: 6, y: 4, sprite: 'npc_elder', name: '町長', script: [
        ['say', '町長', '東の海に 沈みの神殿、西の山に 焔の火口がある。どちらにも 光が落ちたそうだ。'],
        ['say', '町長', '北の雪原へ渡るには 荒れた海を越えねばならん。水と炎、二つのオーブの加護が要るだろう。'],
      ] },
      { type: 'npc', x: 19, y: 16, sprite: 'npc_sailor', name: '船乗り', script: [
        ['if', 'item:orb3&item:orb4', [
          ['say', '船乗り', '水と炎のオーブ……！ それがあれば 北の海も 渡れるぞ。'],
          ['choice', '北の雪原へ 渡るかい？', [['はい', [['item', 'ferrypass', 1, true], ['sfx', 'warp'], ['warp', 'ow', 14, 22]]], ['いいえ', [['say', '船乗り', 'いつでも 声をかけてくれ。']]]]],
        ], [
          ['say', '船乗り', '北の海は 氷と嵐で 船が出せないんだ。'],
          ['say', '船乗り', '水のオーブと 炎のオーブ、二つがそろえば 海も静まるはずさ。'],
        ]],
      ] },
      { type: 'npc', x: 9, y: 12, sprite: 'npc_woman', name: '町の人', wander: true, script: [['say', '町の人', '神殿の中の柵は スイッチを踏むたびに 開いたり閉じたりするそうよ。']] },
      { type: 'npc', x: 14, y: 12, sprite: 'npc_man', name: '漁師', wander: true, script: [['say', '漁師', '火口の溶岩は 踏むと熱いぞ。HPに気をつけて 進むんだな。']] },
      { type: 'npc', x: 12, y: 3, sprite: 'npc_sage', name: '学者', script: [['say', '学者', 'この店の 属性の石は どんな職業でも 使える。弱点を突く手段として 覚えておくといい。']] },
    ],
  });

  makeTown({
    id: 'shirane', name: '雪の里シラネ', ground: 'n', border: 'P', path: ':', inn: 28, exit: { to: 'ow', x: 10, y: 15 }, bgm: 'town',
    deco: [[9, 15], [14, 15], [2, 9], [21, 9]], decoCh: 'k',
    npcs: [
      { type: 'npc', x: 6, y: 4, sprite: 'npc_elder', name: '里長', script: [
        ['say', '里長', '北西の「氷晶の洞」、北東の「月影の墓所」。残る二つの光は そこへ落ちた。'],
        ['say', '里長', '氷晶の洞の番人プリズマは、体の結晶で ほとんどの攻撃を はじくという。'],
        ['say', '里長', '胸のコアの色が 弱点を示し、ターンごとに 移ろう。その時の弱点属性で 攻めるのじゃ。'],
      ] },
      { type: 'npc', x: 9, y: 12, sprite: 'npc_child', name: '子ども', wander: true, script: [['say', '子ども', 'プリズマのコアは 次に何色になるか わかるんだって！ 画面をよく見てね。']] },
      { type: 'npc', x: 15, y: 13, sprite: 'npc_guard', name: '里の衛士', script: [['say', '里の衛士', '墓所の黒騎士は 光に弱い。そして しびれと封印を使う。目覚めの鈴か 万能薬を用意しろ。']] },
      { type: 'npc', x: 20, y: 16, sprite: 'npc_woman', name: '里の人', script: [['say', '里の人', '洞窟の岩を 床のスイッチの上に 押して乗せると 柵が開くの。変な所に押しこんでも、一度外に出れば 元に戻るわ。']] },
    ],
  });

  makeTown({
    id: 'sakasa', name: 'サカサ村', ground: '.', border: 'T', path: '_', inn: 40, exit: { to: 'rev', x: 9, y: 11 }, bgm: 'reverse', tint: 0xc4a0ff,
    deco: [[2, 9], [3, 9], [20, 8], [21, 8]],
    npcs: [
      { type: 'npc', x: 6, y: 4, sprite: 'npc_elder', name: '影の長老', script: [
        ['say', '影の長老', 'ようこそ、灯の裏側へ。ここは 消えた灯の 影が集まる村。'],
        ['say', '影の長老', '東の「逆さ灯の迷宮」の奥に、無灯王アムネスがおる。すべての灯を 消し去ろうとする者じゃ。'],
        ['say', '影の長老', 'ヨミガラスを操っていたのも あやつ。王は 光も闇も 半ば受け流す。力と数で 押し切るしかあるまい。'],
      ] },
      { type: 'npc', x: 9, y: 13, sprite: 'npc_child', name: '影の子', wander: true, script: [['say', '影の子', 'この世界では 何もかも 逆さまなの。迷宮の形も、きっとね。']] },
      { type: 'npc', x: 15, y: 13, sprite: 'npc_man', name: '影の旅人', script: [['say', '影の旅人', 'アムネスは 追いつめられると 三度 動くようになる。回復を 切らさないことだ。']] },
    ],
  });

  // =========================================================
  // ダンジョン
  // =========================================================
  function dungeon(id, name, rows, o) {
    M[id] = Object.assign({ id, name, tiles: rows, ground: 'o', bgm: 'dungeon', indoor: true, entities: [] }, o);
  }
  const chest = (item, qty) => ({ type: 'chest', item, qty: qty || 1 });
  const goldChest = (n) => ({ type: 'chest', gold: n });
  const up = (to, at) => ({ type: 'warp', sprite: 'obj_stairs_up', to, at });
  const down = (to, at) => ({ type: 'warp', sprite: 'obj_stairs_down', to, at });
  const exitTo = (x, y) => ({ type: 'warp', sprite: 'obj_stairs_up', to: 'ow', at: [x, y] });

  // ---- ささやきの森洞
  dungeon('cave1_1', 'ささやきの森洞 B1', [
    '####################',
    '#1ooo#ooooooo#oooo2#',
    '#ooo##o#####o#o#####',
    '#oooooo#ooo#ooooooo#',
    '###o####o#o####o####',
    '#ooooo#oo#oooo#oooD#',
    '#o###o#o##o##o#o##>#',
    '#oooooooo#oooooooo##',
    '#o######o#o######o##',
    '#<oooo#ooooo#ooooo##',
    '####################',
  ], {
    enc: 'cave1', tint: 0xd8c0a0, bg: 'bg_cave', marks: {
      '<': exitTo(18, 30), '>': down('cave1_2', '<'), '1': chest('herb', 3), '2': chest('key_forest'),
      'D': { type: 'door', key: 'key_forest' },
    },
  });
  dungeon('cave1_2', 'ささやきの森洞 B2', [
    '####################',
    '#<ooo#########ooo3##',
    '#ooo#ooooooooo#o####',
    '##o##o#######o#o####',
    '#ooooo#ooZoo#ooo####',
    '#o###o#ooooo#o######',
    '#o#+oo#ooooo#oooooo#',
    '#o####ooooooooo###o#',
    '#oooooooooooooo#ooo#',
    '####################',
  ], {
    enc: 'cave1', tint: 0xd8c0a0, bg: 'bg_cave', marks: {
      '<': up('cave1_1', '>'), '3': chest('seed_life'), '+': { type: 'spring' },
      'Z': {
        type: 'boss', sprite: 'b_wolf', group: 'ookiba', pre: [['msg', 'グルルル……。巨大な狼が 緑に光る玉を 守っている！']],
        post: [['msg', '森の主は 静かに 森の奥へ 帰っていった……'], ['orb', 1], ['msg', '長老に 報告しに戻ろう。（メニューの「どうぐ」→「帰り鳥の羽」でも帰れる）']],
      },
    },
  });

  // ---- 砂塵の塔
  dungeon('tower2_1', '砂塵の塔 1F', [
    '##################',
    '#4ooo#oooooo#oo>##',
    '#oooo#oooooo#ooo##',
    '#oooooooOoooGooo##',
    '#oooo#oooooo#ooo##',
    '##o###oooxoo######',
    '#ooooooooooooooo5#',
    '#o######oo######o#',
    '#oooooooooooooooo#',
    '########<#########',
  ], {
    enc: 'tower2', tint: 0xf0d8a8, bg: 'bg_desert', marks: {
      '<': exitTo(58, 31), '>': up('tower2_2', '<'), '4': chest('herb2', 2), '5': chest('water'),
      'O': { type: 'rock' }, 'x': { type: 'switch', kind: 'rock', flag: 'sw_t2a' }, 'G': { type: 'gate', openIf: 'sw_t2a' },
    },
  });
  dungeon('tower2_2', '砂塵の塔 2F', [
    '##################',
    '#xooooooooo#oooox#',
    '#oooooo#ooooooooo#',
    '###oo#######oo####',
    '#oooooo#<oooooooo#',
    '#o###oo#oo###oo#o#',
    '#ooo#oo#oo#6ooo#o#',
    '###o###oooo#####o#',
    '#xoo#>oGooooooooo#',
    '##################',
  ], {
    enc: 'tower2', tint: 0xf0d8a8, bg: 'bg_desert', marks: {
      '<': down('tower2_1', '>'), '>': up('tower2_3', '<'), '6': chest('swift_ring'),
      'x': [{ type: 'switch', kind: 'step', flag: 'sw_t2b' }, { type: 'switch', kind: 'step', flag: 'sw_t2c' }, { type: 'switch', kind: 'step', flag: 'sw_t2d' }],
      'G': { type: 'gate', openIf: 'sw_t2b&sw_t2c&sw_t2d' },
    },
  });
  dungeon('tower2_3', '砂塵の塔 3F', [
    '################',
    '#ooo##oooo##ooo#',
    '#o+o##oZoo##o7o#',
    '#ooo##oooo##ooo#',
    '##o###oooo###o##',
    '#oooooooooooooo#',
    '#######<########',
  ], {
    enc: null, tint: 0xf0d8a8, bg: 'bg_desert', marks: {
      '<': down('tower2_2', '>'), '+': { type: 'spring' }, '7': chest('lifelamp'),
      'Z': {
        type: 'boss', sprite: 'b_scorpion', group: 'zaraam', pre: [['msg', 'カシャ、カシャ……。王冠をかぶった 巨大なサソリが 黄金の玉を抱えている！']],
        post: [['orb', 2], ['msg', 'サハルナの族長に 知らせに行こう。']],
      },
    },
  });

  // ---- 沈みの神殿（踏むたびに切り替わるスイッチ）
  dungeon('temple3_1', '沈みの神殿 1F', [
    '####################',
    '#8ooooooooooo##o>o##',
    '#oooooooooooo##ooo##',
    '#oooo#ooo##oo##ooo##',
    '####o###########G###',
    '#ooooooooooooo#oooo#',
    '#ooooooooooooo#oooo#',
    '#oooooooxoooooAoooo#',
    '#ooo###########ooxo#',
    '#ooo###########oooo#',
    '##<#################',
  ], {
    enc: 'temple3', tint: 0xa8d0ff, bg: 'bg_temple', marks: {
      '<': exitTo(59, 9), '>': up('temple3_2', '<'), '8': chest('water', 2),
      'x': [{ type: 'switch', kind: 'toggle', flag: 'sw_t3' }, { type: 'switch', kind: 'toggle', flag: 'sw_t3', behindGate: true }],
      'A': { type: 'gate', openIf: 'sw_t3' }, 'G': { type: 'gate', openIf: '!sw_t3' },
    },
  });
  dungeon('temple3_2', '沈みの神殿 2F', [
    '################',
    '#9oo#oooooo#ooo#',
    '#ooo#ooZooo#o+o#',
    '#ooo#oooooo#ooo#',
    '##o###oooo###o##',
    '#oooooooooooooo#',
    '#######<########',
  ], {
    enc: null, tint: 0xa8d0ff, bg: 'bg_temple', marks: {
      '<': down('temple3_1', '>'), '+': { type: 'spring' }, '9': chest('mirror_shield'),
      'Z': {
        type: 'boss', sprite: 'b_serpent', group: 'mizuchi', pre: [['msg', '水の底から 巨大な蛇が 鎌首をもたげた！']],
        post: [['orb', 3]],
      },
    },
  });

  // ---- 焔の火口（溶岩ダメージ・鍵扉）
  dungeon('volcano4_1', '焔の火口 1F', [
    '####################',
    '#<oooLLLLooooo#oo>o#',
    '#oooLLLLLLoooo#oooo#',
    '#ooLLooLLLLooo#oooo#',
    '#oLLoaoLLLoooo###D##',
    '#oLLLLLLLLLLooooooo#',
    '#oooooooLLLLLLLLLoq#',
    '####################',
  ], {
    enc: 'volcano4', tint: 0xffc0a0, bg: 'bg_volcano', marks: {
      '<': exitTo(35, 4), '>': up('volcano4_2', '<'), 'a': chest('key_fire'), 'q': chest('herb3', 2),
      'D': { type: 'door', key: 'key_fire' },
    },
  });
  dungeon('volcano4_2', '焔の火口 2F', [
    '##################',
    '#LLLooooooooLLL+o#',
    '#LLoooooZooooLLoo#',
    '#LoooooooooooooLo#',
    '#LLooooooooooLLLu#',
    '#LLLLLoooooLLLLLL#',
    '########<#########',
  ], {
    enc: null, tint: 0xffc0a0, bg: 'bg_volcano', marks: {
      '<': down('volcano4_1', '>'), '+': { type: 'spring' }, 'u': chest('seed_str'),
      'Z': {
        type: 'boss', sprite: 'b_dragon', group: 'borganos', pre: [['msg', '溶岩の中から 一本角の竜が 姿を現した！']],
        post: [['orb', 4], ['msg', '水と炎のオーブがそろったら、ミズハの船乗りを 訪ねよう。']],
      },
    },
  });

  // ---- 氷晶の洞（岩をスイッチへ）
  dungeon('ice5_1', '氷晶の洞 B1', [
    '####################',
    '#<ooo#oooooooooo#>o#',
    '#ooooooooooooooo#oo#',
    '#ooo#ooOoooOoooo#oo#',
    '#ooo#oooooooooooGoo#',
    '#ooo#ooooxoooxoo#oo#',
    '#ooo#ooooooooooo#oo#',
    '#ooooooooooooooo####',
    '#v#oooooooooooooooz#',
    '####################',
  ], {
    enc: 'ice5', ground: 'i', tint: 0xd8f0ff, bg: 'bg_snow', marks: {
      '<': exitTo(5, 5), '>': down('ice5_2', '<'), 'v': chest('panacea', 2), 'z': chest('awake_charm'),
      'O': { type: 'rock' },
      'x': [{ type: 'switch', kind: 'rock', flag: 'sw_i5a' }, { type: 'switch', kind: 'rock', flag: 'sw_i5b' }],
      'G': { type: 'gate', openIf: 'sw_i5a&sw_i5b' },
    },
  });
  dungeon('ice5_2', '氷晶の洞 B2', [
    '################',
    '#oo+#oooooo#ooA#',
    '#ooo#ooZooo#ooo#',
    '#ooo#oooooo#ooo#',
    '##o###oooo###o##',
    '#oooooooooooooo#',
    '#######<########',
  ], {
    enc: null, ground: 'i', tint: 0xd8f0ff, bg: 'bg_snow', marks: {
      '<': up('ice5_1', '>'), '+': { type: 'spring' }, 'A': chest('seed_agi'),
      'Z': {
        type: 'boss', sprite: 'b_prism', group: 'prisma', pre: [
          ['msg', '結晶の巨人が 目を覚ました！ 胸のコアが 七色に揺らめいている……'],
          ['msg', '（ヒント：コアが示す「弱点属性」以外の攻撃は 障壁ではじかれる。弱点で2回攻めると 障壁が砕ける）'],
        ],
        post: [['orb', 5]],
      },
    },
  });

  // ---- 月影の墓所
  dungeon('grave6_1', '月影の墓所 1F', [
    '####################',
    '#<oogoooogooo#oo>o##',
    '#ooogoooogooo#oooo##',
    '#ogoooogoooog#oooo##',
    '#oooogooooooo##D####',
    '#gooooooogoooooooox#',
    '###G################',
    '#5oomo##############',
    '####################',
  ], {
    enc: 'grave6', tint: 0xc8c0e8, bg: 'bg_grave', marks: {
      '<': exitTo(22, 5), '>': up('grave6_2', '<'), 'm': chest('key_grave'), '5': chest('lantern_knife'),
      'x': { type: 'switch', kind: 'step', flag: 'sw_g6' }, 'G': { type: 'gate', openIf: 'sw_g6' },
      'D': { type: 'door', key: 'key_grave' },
    },
  });
  dungeon('grave6_2', '月影の墓所 2F', [
    '##################',
    '#g+og#oooooo#goo3#',
    '#oooo#ooZooo#oooo#',
    '#oooo#oooooo#oooo#',
    '##oo###oooo###oo##',
    '#oooooooooooooooo#',
    '########<#########',
  ], {
    enc: null, tint: 0xc8c0e8, bg: 'bg_grave', marks: {
      '<': down('grave6_1', '>'), '+': { type: 'spring' }, '3': chest('lantern_shield'),
      'Z': {
        type: 'boss', sprite: 'b_knight', group: 'valgoat', pre: [['say', '黒騎士', '……灯守か。この墓所の眠りを 乱す者は 斬る。']],
        post: [['say', '黒騎士', '見事……。我が主も かつては 灯を守る者だった……'], ['orb', 6], ['msg', 'オーブが六つそろった！ ミズハの西、湖のほとりの祭壇へ向かおう。']],
      },
    },
  });

  // ---- 蝕の塔
  dungeon('tower7_1', '蝕の塔 1F', [
    '####################',
    '#1ooo#ooooooooo#o>o#',
    '#oooo#ooooooooo#ooo#',
    '#oooo#oo#####oo#ooo#',
    '#oooooox#####oo##G##',
    '#oooo#ooooooooooooo#',
    '#o2oo#oooooo3oooooo#',
    '#oooo#ooooooooooooo#',
    '##########<#########',
  ], {
    enc: 'tower7', ground: 'r', tint: 0xd0b8e8, bg: 'bg_tower', bgm: 'lastdungeon', marks: {
      '<': exitTo(40, 16), '>': up('tower7_2', '<'), '1': chest('lantern_sword'), '2': chest('lantern_staff'),
      '3': { type: 'chest', item: 'lantern_claw', mimic: 'mimic' },
      'x': { type: 'switch', kind: 'step', flag: 'sw_t7' }, 'G': { type: 'gate', openIf: 'sw_t7' },
    },
  });
  dungeon('tower7_2', '蝕の塔 2F', [
    '##################',
    '#4oooooooooooooo5#',
    '#oooo########oooo#',
    '#oooo#oo>ooo#oooo#',
    '#oooo#oooooo#oooo#',
    '#oo+o###Z####oooo#',
    '#oooooooooooooooo#',
    '########<#########',
  ], {
    enc: 'tower7', ground: 'r', tint: 0xd0b8e8, bg: 'bg_tower', bgm: 'lastdungeon', marks: {
      '<': down('tower7_1', '>'), '>': up('tower7_3', '<'), '4': chest('lantern_armor'), '5': chest('lantern_robe'), '+': { type: 'spring' },
      'Z': {
        type: 'boss', sprite: 'b_knight', tint: 0x9977ff, group: 'gatekeeper', pre: [['say', '影の騎士', '墓守の……影。主の元へは 行かせぬ。']],
        post: [['msg', '影の騎士は 霧となって消えた。上への階段が 見える。']],
      },
    },
  });
  dungeon('tower7_3', '蝕の塔 頂上', [
    '################',
    '#oooooooooooooo#',
    '#ooooooZooooooo#',
    '#oooooooooooooo#',
    '###oooooooooo###',
    '#+ooooooooooooo#',
    '#######<########',
  ], {
    enc: null, ground: 'r', tint: 0xd0b8e8, bg: 'bg_tower', bgm: 'lastdungeon', marks: {
      '<': down('tower7_2', '>'), '+': { type: 'spring' },
      'Z': {
        type: 'boss', sprite: 'b_yomi1', group: 'yomigarasu', final: true, pre: [
          ['say', 'ヨミガラス', 'よくぞ来た、灯守の雛鳥ども。天灯など 無くとも、世界は 静かな闇に 満たされる。'],
          ['say', 'ヨミガラス', 'その小さな灯ごと、我が翼で 覆い尽くしてくれよう！'],
        ],
        post: [['ending', 'normal']],
      },
    },
  });

  // ---- 逆さ灯の迷宮（表の洞窟の「逆さま」）
  dungeon('rev1', '逆さ灯の迷宮 1F', flip(M.cave1_1.tiles), {
    enc: 'reverseD', tint: 0xb898e8, bg: 'bg_reverse', bgm: 'reverse', marks: {
      '<': { type: 'warp', sprite: 'obj_stairs_up', to: 'rev', at: [24, 7] }, '>': down('rev2', '<'), '1': chest('herb3', 3), '2': chest('key_rev'),
      'D': { type: 'door', key: 'key_rev' },
    },
  });
  dungeon('rev2', '逆さ灯の迷宮 2F', flip(M.ice5_1.tiles), {
    enc: 'reverseD', tint: 0xb898e8, bg: 'bg_reverse', bgm: 'reverse', marks: {
      '<': up('rev1', '>'), '>': down('rev3', '<'), 'v': chest('elixir', 2), 'z': chest('seed_str'),
      'O': { type: 'rock' },
      'x': [{ type: 'switch', kind: 'rock', flag: 'sw_r2a' }, { type: 'switch', kind: 'rock', flag: 'sw_r2b' }],
      'G': { type: 'gate', openIf: 'sw_r2a&sw_r2b' },
    },
  });
  dungeon('rev3', '逆さ灯の迷宮 最深部', [
    '################',
    '#oooooooooooooo#',
    '#ooooooZooooooo#',
    '#oooooooooooooo#',
    '###oooooooooo###',
    '#+ooooooooooooo#',
    '#######<########',
  ], {
    enc: null, tint: 0xb898e8, bg: 'bg_reverse', bgm: 'reverse', marks: {
      '<': up('rev2', '>'), '+': { type: 'spring' },
      'Z': {
        type: 'boss', sprite: 'b_amnes', group: 'amnes', pre: [
          ['say', '無灯王アムネス', '……灯は いつか消える。ならば 最初から 灯さなければよい。'],
          ['say', '無灯王アムネス', 'ヨミガラスは よく働いた。お前たちの灯も ここで 消してあげよう。'],
        ],
        post: [['ending', 'true']],
      },
    },
  });

  // ---------- マップ整形（行長そろえ・記号→エンティティ化） ----------
  const warnings = [];
  function normalize(map) {
    const w = Math.max(...map.tiles.map((r) => r.length));
    map.tiles.forEach((r, i) => { if (r.length !== w) warnings.push(`${map.id}: row ${i} length ${r.length} != ${w}`); });
    const padCh = map.id === 'ow' ? '~' : (map.town ? 'T' : '#');
    const rows = map.tiles.map((r) => r.padEnd(w, padCh));
    map.w = w; map.h = rows.length;
    map.entities = map.entities || [];
    const markCount = {};
    const grid2 = rows.map((r, y) => r.split('').map((ch, x) => {
      if (map.marks && map.marks[ch] !== undefined) {
        let spec = map.marks[ch];
        if (Array.isArray(spec)) {
          const i = markCount[ch] || 0; markCount[ch] = i + 1;
          spec = spec[Math.min(i, spec.length - 1)];
        }
        map.entities.push(Object.assign({ x, y, mark: ch }, JSON.parse(JSON.stringify(spec))));
        return map.ground;
      }
      if (!LEGEND[ch]) warnings.push(`${map.id}: unknown char '${ch}' at ${x},${y}`);
      return ch;
    }));
    // 記号は ground に置換済み。ボス等の関数は無いので JSON 複製で問題なし
    map.grid = grid2;
    // 宝箱・ボス等に一意のフラグIDを振る
    map.entities.forEach((e, i) => {
      e.uid = `${map.id}:${e.mark || e.type}:${e.x},${e.y}`;
      if (e.type === 'chest' && !e.flag) e.flag = 'chest_' + e.uid;
      if (e.type === 'door' && !e.flag) e.flag = 'door_' + e.uid;
      if (e.type === 'boss' && !e.flag) e.flag = 'boss_' + e.group;
      if (e.type === 'rock' && !e.id) e.id = 'rock' + i;
    });
    delete map.tiles;
  }
  Object.values(M).forEach(normalize);

  /** 現在の目的（メニューに表示するヒント） */
  function objective(has, flag, orbs) {
    if (flag('true_clear')) return '無灯王を倒し、すべての灯が戻った。自由に旅を続けよう。';
    if (flag('final_clear')) return 'ランタ村の広場に開いた裂け目から 裏ソラへ。逆さ灯の迷宮の奥を目指そう。';
    if (flag('lightbridge')) return '湖の中央の蝕の塔を登り、頂上のヨミガラスを倒そう。';
    if (orbs >= 6) return 'ミズハの西、湖のほとりの「星見の祭壇」にオーブを捧げよう。';
    if (has('orb3') && has('orb4')) {
      if (!flag('ferry_used') && !has('orb5') && !has('orb6')) return 'ミズハの船乗りに話し、北の雪原へ渡ろう。';
      return '雪原の「氷晶の洞」（北西）と「月影の墓所」（北東）でオーブを取り戻そう。雪の里シラネで話を聞くのもよい。';
    }
    if (flag('pass_open')) return '港町ミズハを拠点に、東の「沈みの神殿」と西の「焔の火口」でオーブを探そう。';
    if (has('orb2')) return '砂の都サハルナの族長ラザンに 報告しよう。';
    if (has('orb1')) return '橋を渡って東へ。フィオルの町、そして砂の都サハルナを訪ねよう。';
    if (flag('intro')) return 'ランタ村の北東「ささやきの森洞」で 緑の光（オーブ）を探そう。';
    return 'ランタ村の長老トウジの家（左上）を訪ねよう。';
  }

  // ---------- 物語テキスト（オープニング・エンディング） ----------
  const STORY = {
    elderName: '長老トウジ',
    opening: '――ランタ村。灯台の灯りだけが 夜空の代わりに 村を照らしている。',
    endingNormal: {
      before: ['ヨミガラスの体が 黒い羽となって 崩れ落ちていく……', '六つのオーブが 塔の頂から 空へ昇っていく。砕けた天灯が ひとつ、またひとつと 灯りを取り戻した。'],
      after: ['ランタ村に帰った {names}を、村人たちが 灯台の灯りで 迎えた。', '長老トウジ「よくぞ戻った、灯守 {hero}。お主らは 本物の灯守じゃ。」'],
      credits: ['#ソラトモシ ～六灯の旅路～', '', '#灯守', '{names}', '', '#企画・シナリオ・プログラム', 'Studio Hoshiakari', '', '#グラフィック', 'gpt-image-2 生成アセット', '', '#音楽・効果音', 'WebAudio シンセサイザー', '', '#Special Thanks', 'あそんでくれた あなた'],
      epilogue: ['ランタ村の広場に 紫の裂け目が 口を開けている……。（裏ソラへ行けるようになった）'],
    },
    endingTrue: {
      before: ['無灯王アムネスは 静かに 崩れていく……', '無灯王アムネス「……そうか。消えるから こそ、灯は あたたかいのか……」'],
      after: ['裏ソラに 小さな灯が ともりはじめた。影たちの村にも やがて朝が来るだろう。'],
      credits: ['#ソラトモシ ～六灯の旅路～', '#TRUE ENDING', '', '{names}', '', '裏ソラにも 灯は ともる。', '', '#Thank you for playing!'],
      epilogue: [],
    },
  };

  return { LEGEND, MAPS: M, warnings, objective, STORY };
})();

if (typeof module !== 'undefined') module.exports = MAPS;
