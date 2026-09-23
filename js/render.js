'use strict';
// =============================================================
// 描画: PixiJS v8 によるフィールド／戦闘シーン描画とアセット読み込み
// =============================================================
const Render = (() => {
  const TILE = 32;
  const TEX = {};
  const tileCache = {};
  let app = null, stageEl = null;
  let scale = 2;
  let missing = [];
  const R = { TILE, TEX, get app() { return app; }, get scale() { return scale; } };

  // ---------- 初期化 ----------
  R.init = async function () {
    stageEl = document.getElementById('stage');
    app = new PIXI.Application();
    await app.init({ resizeTo: stageEl, background: '#05060d', antialias: false, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: 'webgl' });
    app.canvas.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(app.canvas);
    R.fieldRoot = new PIXI.Container();
    R.battleRoot = new PIXI.Container();
    R.battleRoot.visible = false;
    app.stage.addChild(R.fieldRoot, R.battleRoot);
    app.ticker.add((t) => R.tick(t.deltaMS));
    window.addEventListener('resize', () => R.resize());
    R.resize();
  };

  /** 画像を読み込む。http配信ならファイルから、file:// なら埋め込みデータから。失敗時は代替画像を生成 */
  R.loadAssets = async function (onProgress) {
    const list = window.ASSET_MANIFEST || [];
    const isHttp = /^https?:$/.test(location.protocol);
    const bundle = window.ASSET_BUNDLE || {};
    let done = 0;
    const loadOne = async (a) => {
      const srcs = [];
      if (isHttp) srcs.push(a.src);
      if (bundle[a.alias]) srcs.push(bundle[a.alias]);
      for (const src of srcs) {
        try {
          const tex = await PIXI.Assets.load({ alias: a.alias + '#' + srcs.indexOf(src), src, parser: 'loadTextures' });
          if (tex && tex.source) { TEX[a.alias] = tex; break; }
        } catch (e) { /* 次の読み込み元を試す */ }
      }
      if (!TEX[a.alias]) missing.push(a.alias);
      done++;
      onProgress && onProgress(done / list.length);
    };
    // 同時読み込み数を制限
    const queue = list.slice();
    const workers = Array.from({ length: 8 }, async () => { while (queue.length) await loadOne(queue.shift()); });
    await Promise.all(workers);
    return missing;
  };
  R.missing = () => missing;

  /** 代替テクスチャ（読み込み失敗時でも止まらないように） */
  function fallbackTex(name) {
    const g = new PIXI.Graphics();
    const col = name.startsWith('tile_') ? 0x556070 : name.startsWith('b_') ? 0x8844aa : name.startsWith('e') ? 0xaa4466 : 0x888888;
    const size = name.startsWith('tile_') ? 256 : 96;
    g.rect(0, 0, size, size).fill(col);
    g.rect(size * 0.2, size * 0.2, size * 0.6, size * 0.6).stroke({ width: 4, color: 0xffffff });
    const t = app.renderer.generateTexture(g);
    TEX[name] = t;
    return t;
  }
  R.tex = function (name) { return TEX[name] || fallbackTex(name); };

  /** 4x4 周期の継ぎ目なし地形テクスチャから (x,y) に対応する部分を切り出す */
  R.tileTex = function (tile, x, y) {
    const key = tile + ':' + (x & 3) + ':' + (y & 3);
    if (tileCache[key]) return tileCache[key];
    const base = R.tex('tile_' + tile);
    const s = base.width / 4;
    const t = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle((x & 3) * s, (y & 3) * s, s, s) });
    tileCache[key] = t;
    return t;
  };

  R.resize = function () {
    if (!app) return;
    app.resize();
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    const wide = R.field.map && R.field.map.outdoor;
    scale = Util.clamp(Math.min(w / ((wide ? 17 : 13) * TILE), h / ((wide ? 12 : 9) * TILE)), 1, 3.2);
    R.fieldRoot.scale.set(scale);
    if (R.field.map) R.field.updateCamera(true);
    if (R.battleRoot.visible) R.battle.layout();
  };

  // =========================================================
  // フィールド
  // =========================================================
  const F = R.field = {
    map: null, world: null, tiles: null, objs: null, entSprites: {}, water: [],
    player: null, followers: [], waterPhase: 0, waterTimer: 0,
  };
  F.build = function (map) {
    R.fieldRoot.removeChildren();
    const changedKind = !F.map || !!F.map.outdoor !== !!map.outdoor;
    F.map = map;
    if (changedKind) setTimeout(() => R.resize(), 0);
    F.water = [];
    F.entSprites = {};
    F.world = new PIXI.Container();
    F.tiles = new PIXI.Container();
    F.objs = new PIXI.Container();
    F.objs.sortableChildren = true;
    F.world.addChild(F.tiles, F.objs);
    R.fieldRoot.addChild(F.world);
    const tint = map.tint || 0xffffff;
    const shadow = new PIXI.Graphics();
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const ch = map.grid[y][x];
        const L = MAPS.LEGEND[ch] || {};
        let tile = L.tile;
        if (tile === null || tile === undefined) tile = (MAPS.LEGEND[map.ground] || {}).tile;
        if (ch === ' ') continue;
        if (tile) {
          const sp = new PIXI.Sprite(R.tileTex(tile, x, y));
          sp.width = TILE; sp.height = TILE; sp.x = x * TILE; sp.y = y * TILE; sp.tint = tint;
          F.tiles.addChild(sp);
          if (tile === 'water') F.water.push({ sp, x, y });
          if (tile === 'lava') F.water.push({ sp, x, y, lava: true });
        }
        if (L.obj) {
          const o = new PIXI.Sprite(R.tex(L.obj));
          const big = L.obj === 'obj_mountain' || L.obj === 'obj_tree' || L.obj === 'obj_pine';
          const sz = big ? TILE * 1.12 : TILE;
          o.anchor.set(0.5, 1); o.width = sz; o.height = sz;
          o.x = x * TILE + TILE / 2; o.y = y * TILE + TILE + (big ? 1 : 0); o.zIndex = y * 10 + 1; o.tint = tint;
          F.objs.addChild(o);
        }
        // 壁の下に影を落として奥行きを出す
        if (!L.wall && y > 0) {
          const up = MAPS.LEGEND[map.grid[y - 1][x]] || {};
          if (up.wall) shadow.rect(x * TILE, y * TILE, TILE, 6).fill({ color: 0x000000, alpha: 0.35 });
        }
      }
    }
    F.tiles.addChild(shadow);
    F.player = null; F.followers = [];
  };
  function entTexture(e) {
    switch (e.type) {
      case 'chest': return Game.flag(e.flag) ? 'obj_chest_open' : 'obj_chest';
      case 'door': return 'obj_irondoor';
      case 'gate': return 'obj_gate';
      case 'switch': return Field.switchPressed(e) ? 'obj_switch_on' : 'obj_switch';
      case 'rock': return 'obj_rock';
      case 'spring': return 'obj_spring';
      case 'sign': return 'obj_sign';
      case 'bridge': return 'tile_bridge';
      default: return e.sprite || null;
    }
  }
  /** エンティティの表示を状態に合わせて更新（生成も兼ねる） */
  F.syncEntities = function () {
    const map = F.map;
    for (const e of map.entities) {
      const vis = Field.entityVisible(e);
      let sp = F.entSprites[e.uid];
      const texName = entTexture(e);
      if (!texName) continue;
      if (!sp) {
        if (e.type === 'bridge') {
          sp = new PIXI.Sprite(R.tileTex('bridge', e.x, e.y));
          sp.width = TILE; sp.height = TILE; sp.tint = 0xfff0a0;
          sp.x = e.x * TILE; sp.y = e.y * TILE; sp.zIndex = -1;
          sp.isBridge = true;
        } else {
          sp = new PIXI.Sprite(R.tex(texName));
          sp.anchor.set(0.5, 1);
          const isChar = texName.startsWith('npc_') || texName.startsWith('hero_');
          const isBoss = e.type === 'boss';
          const isIcon = ['obj_town', 'obj_cave', 'obj_tower', 'obj_castle'].includes(texName) && map.outdoor;
          const size = isBoss ? TILE * 1.7 : isChar ? TILE * 1.1 : isIcon ? TILE * 1.35 : TILE;
          sp.width = size; sp.height = size;
          sp.baseX = e.x * TILE + TILE / 2; sp.baseY = e.y * TILE + TILE + (isChar ? -1 : 0);
          sp.x = sp.baseX; sp.y = sp.baseY;
          sp.zIndex = e.y * 10 + (e.type === 'switch' ? 0 : 5);
          if (e.tint) sp.tint = e.tint;
          else if (map.tint && !isChar) sp.tint = map.tint;
          sp.isChar = isChar;
        }
        sp.texName = texName;
        F.objs.addChild(sp);
        F.entSprites[e.uid] = sp;
      }
      if (sp.texName !== texName && !sp.isBridge) {
        const w = sp.width, h = sp.height;
        sp.texture = R.tex(texName); sp.width = w; sp.height = h; sp.texName = texName;
      }
      if (e.type === 'rock' || e.type === 'npc' && e.wander) {
        const p = Field.entityPos(e);
        sp.baseX = p.x * TILE + TILE / 2; sp.baseY = p.y * TILE + TILE - (sp.isChar ? 1 : 0);
        if (!sp.moving) { sp.x = sp.baseX; sp.y = sp.baseY; }
        sp.zIndex = p.y * 10 + 5;
      }
      // 開いた扉・開いた柵は非表示
      let show = vis;
      if (e.type === 'door' && Game.flag(e.flag)) show = false;
      if (e.type === 'gate' && Field.gateOpen(e)) show = false;
      sp.visible = show;
    }
  };
  /** 指定エンティティの向きを変える（NPCが話しかけられたとき） */
  F.faceEntity = function (e, dir) {
    const sp = F.entSprites[e.uid];
    if (sp && sp.isChar) sp.scale.x = Math.abs(sp.scale.x) * (dir === 'left' ? -1 : 1);
  };
  F.moveEntitySprite = function (e, fromX, fromY, toX, toY, ms) {
    const sp = F.entSprites[e.uid];
    if (!sp) return;
    sp.moving = { fx: fromX * TILE + TILE / 2, fy: fromY * TILE + TILE, tx: toX * TILE + TILE / 2, ty: toY * TILE + TILE, t: 0, ms };
  };

  function charSprite(texName) {
    const sp = new PIXI.Sprite(R.tex(texName));
    sp.anchor.set(0.5, 1);
    sp.width = TILE * 1.15; sp.height = TILE * 1.15;
    return sp;
  }
  /** 隊列（先頭＋後続）スプライトを作る */
  F.setParty = function (members) {
    for (const s of [F.player].concat(F.followers)) if (s && s.parent) s.parent.removeChild(s);
    F.followers = [];
    if (!members.length) return;
    F.player = charSprite(DATA.CLASSES[members[0].cls].sprite);
    F.objs.addChild(F.player);
    for (let i = 1; i < members.length; i++) {
      const sp = charSprite(DATA.CLASSES[members[i].cls].sprite);
      sp.alpha = members[i].hp > 0 ? 1 : 0.45;
      F.objs.addChild(sp);
      F.followers.push(sp);
    }
    F.player.alpha = members[0].hp > 0 ? 1 : 0.45;
  };
  /** 画面上の論理座標（タイル単位の実数）で先頭と後続を配置 */
  F.placeActors = function (lead, trail, dir, bob) {
    if (!F.player) return;
    const place = (sp, p, d, i) => {
      sp.x = p.x * TILE + TILE / 2;
      sp.y = p.y * TILE + TILE - 1 - (bob ? Math.abs(Math.sin(bob + i)) * 1.5 : 0);
      sp.zIndex = Math.round(p.y * 10) + 6 - i * 0.1;
      const sx = Math.abs(sp.scale.x);
      if (d === 'left') sp.scale.x = -sx; else if (d === 'right') sp.scale.x = sx;
    };
    place(F.player, lead, dir, 0);
    F.followers.forEach((sp, i) => { const t = trail[i] || lead; place(sp, t, t.dir || dir, i + 1); });
  };
  /** 先頭キャラの画面上の位置（タップ移動の基準） */
  F.playerScreen = function () {
    if (!F.player || !F.world || !R.fieldRoot.visible) return null;
    return { x: (F.world.x + F.player.x) * scale, y: (F.world.y + F.player.y - TILE / 2) * scale };
  };
  /** 画面座標 → マップのマス */
  F.screenToTile = function (sx, sy) {
    if (!F.world) return null;
    return { x: Math.floor((sx / scale - F.world.x) / TILE), y: Math.floor((sy / scale - F.world.y) / TILE) };
  };
  F.updateCamera = function (instant) {
    if (!F.map || !F.player) return;
    const vw = stageEl.clientWidth / scale, vh = stageEl.clientHeight / scale;
    const mw = F.map.w * TILE, mh = F.map.h * TILE;
    let cx = F.player.x - vw / 2, cy = F.player.y - TILE / 2 - vh / 2;
    cx = mw <= vw ? -(vw - mw) / 2 : Util.clamp(cx, 0, mw - vw);
    cy = mh <= vh ? -(vh - mh) / 2 : Util.clamp(cy, 0, mh - vh);
    F.world.x = -Math.round(cx * scale) / scale;
    F.world.y = -Math.round(cy * scale) / scale;
  };
  F.tick = function (dt) {
    if (!F.map) return;
    F.waterTimer += dt;
    if (F.waterTimer > 650) {
      F.waterTimer = 0; F.waterPhase = (F.waterPhase + 1) & 3;
      for (const w of F.water) w.sp.texture = R.tileTex(w.lava ? 'lava' : 'water', w.x + F.waterPhase, w.y + (w.lava ? 0 : F.waterPhase));
    }
    for (const sp of Object.values(F.entSprites)) {
      if (sp.moving) {
        const m = sp.moving; m.t += dt;
        const k = Math.min(1, m.t / m.ms);
        sp.x = m.fx + (m.tx - m.fx) * k; sp.y = m.fy + (m.ty - m.fy) * k;
        if (k >= 1) sp.moving = null;
      }
      if (sp.isBridge && sp.visible) sp.alpha = 0.85 + Math.sin(performance.now() / 300) * 0.15;
    }
  };

  // =========================================================
  // 戦闘
  // =========================================================
  const B = R.battle = { bg: null, enemies: [], fx: null, nums: [] };
  B.open = function (bgName, enemies) {
    R.fieldRoot.visible = false;
    R.battleRoot.visible = true;
    R.battleRoot.removeChildren();
    B.marker = null;
    B.bg = new PIXI.Sprite(R.tex(bgName));
    B.dim = new PIXI.Graphics();
    B.enemyLayer = new PIXI.Container();
    B.fx = new PIXI.Container();
    R.battleRoot.addChild(B.bg, B.dim, B.enemyLayer, B.fx);
    B.enemies = enemies.map((en) => {
      const sp = new PIXI.Sprite(R.tex(en.def.sprite));
      sp.anchor.set(0.5, 1);
      if (en.def.tint) sp.tint = en.def.tint;
      B.enemyLayer.addChild(sp);
      return { en, sp, t: Math.random() * 6 };
    });
    B.layout();
  };
  B.close = function () {
    R.battleRoot.visible = false;
    R.battleRoot.removeChildren();
    R.fieldRoot.visible = true;
    B.enemies = []; B.nums = [];
  };
  B.layout = function () {
    const w = app.screen.width, h = app.screen.height;
    if (!B.bg) return;
    const s = Math.max(w / B.bg.texture.width, h / B.bg.texture.height);
    B.bg.scale.set(s); B.bg.x = (w - B.bg.texture.width * s) / 2; B.bg.y = (h - B.bg.texture.height * s) / 2;
    B.dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.18 });
    const alive = B.enemies;
    const n = alive.length;
    const topUi = document.getElementById('ui').querySelector('.bparty');
    const partyH = topUi ? topUi.getBoundingClientRect().height : 90;
    const bottomUi = document.getElementById('ui').querySelector('.bottomwrap');
    const bottomH = bottomUi ? bottomUi.getBoundingClientRect().height : h * 0.3;
    const reserve = w < 640 ? Math.max(bottomH, 200) : h < 500 ? Math.max(bottomH, 110) : bottomH;
    const areaTop = partyH + 30, areaBot = h - reserve - 30;
    const areaH = Math.max(80, areaBot - areaTop);
    const baseY = areaTop + areaH * 0.92;
    alive.forEach((o, i) => {
      const boss = o.en.def.boss;
      const maxW = (w * 0.92) / Math.max(1, n);
      let size = boss ? Math.min(areaH * 1.05, w * 0.7) * (o.en.def.scale ? o.en.def.scale / 1.45 : 1) : Math.min(areaH * 0.8, 190);
      size = Math.min(size, maxW * (boss ? 1.1 : 1.05));
      const tw = o.sp.texture.width, th = o.sp.texture.height;
      const k = size / Math.max(tw, th);
      o.sp.scale.set(k);
      o.baseScale = k;
      o.x = w / 2 + (i - (n - 1) / 2) * Math.min(maxW, size * 1.05);
      o.y = baseY;
      o.sp.x = o.x; o.sp.y = o.y;
      o.size = size;
    });
  };
  /** 敵のスクリーン座標（DOMの名札配置用） */
  B.enemyScreen = function (en) {
    const o = B.enemies.find((q) => q.en === en);
    if (!o) return null;
    return { x: o.x, top: o.y - o.size, bottom: o.y, size: o.size };
  };
  B.enemyHit = function (en, crit) {
    const o = B.enemies.find((q) => q.en === en);
    if (!o) return;
    o.hit = { t: 0, crit };
  };
  B.enemyDie = function (en) {
    const o = B.enemies.find((q) => q.en === en);
    if (o) o.dying = { t: 0 };
  };
  B.enemyReplace = function (en, spriteName, tint) {
    const o = B.enemies.find((q) => q.en === en);
    if (!o) return;
    o.sp.texture = R.tex(spriteName);
    o.sp.tint = tint || 0xffffff;
    o.sp.alpha = 1; o.dying = null;
    B.layout();
  };
  B.swapEnemy = function (oldEn, newEn) {
    const o = B.enemies.find((q) => q.en === oldEn);
    if (!o) return;
    o.en = newEn;
    o.sp.texture = R.tex(newEn.def.sprite);
    o.sp.alpha = 1; o.dying = null; o.hit = null;
    B.layout();
  };
  B.enemyAct = function (en) {
    const o = B.enemies.find((q) => q.en === en);
    if (o) o.act = { t: 0 };
  };
  B.setTarget = function (en) { B.enemies.forEach((o) => { o.targeted = o.en === en; }); };
  function drawMarker(o, t) {
    if (!B.marker) {
      B.marker = new PIXI.Graphics().poly([-12, 0, 12, 0, 0, 14]).fill(0xffd84a).stroke({ width: 3, color: 0x000000 });
      B.fx.addChild(B.marker);
    }
    B.marker.visible = !!o;
    if (o) { B.marker.x = o.x; B.marker.y = o.y - o.size - 18 + (Settings.reduceMotion() ? 0 : Math.sin(t * 6) * 4); }
  }
  /** ダメージ数値のポップアップ */
  B.number = function (en, text, color) {
    const o = B.enemies.find((q) => q.en === en);
    if (!o) return;
    const t = new PIXI.Text({ text: String(text), style: { fontFamily: 'system-ui, sans-serif', fontSize: Math.max(22, Math.min(40, app.screen.width / 22)), fontWeight: '900', fill: color || 0xffffff, stroke: { color: 0x000000, width: 5 } } });
    t.anchor.set(0.5);
    t.x = o.x + Util.rand(-12, 12); t.y = o.y - o.size * 0.5;
    B.fx.addChild(t);
    B.nums.push({ t, life: 0, y0: t.y });
  };
  /** 属性エフェクト */
  B.effect = function (en, elem, kind) {
    const o = en ? B.enemies.find((q) => q.en === en) : null;
    const cx = o ? o.x : app.screen.width / 2, cy = o ? o.y - o.size * 0.5 : app.screen.height * 0.4;
    const col = { fire: 0xff6a2a, ice: 0x9fe6ff, thunder: 0xfff050, wind: 0x8cf09a, light: 0xffffff, dark: 0xa060ff, none: 0xffffff, heal: 0x80ffb0 }[elem] || 0xffffff;
    const g = new PIXI.Graphics();
    B.fx.addChild(g);
    const reduce = Settings.reduceMotion();
    const parts = [];
    if (kind === 'slash') {
      g.moveTo(cx - 50, cy - 50).lineTo(cx + 50, cy + 50).stroke({ width: 6, color: col, alpha: 0.95 });
      g.moveTo(cx - 44, cy - 56).lineTo(cx + 56, cy + 44).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
    } else {
      const n = reduce ? 6 : 16;
      for (let i = 0; i < n; i++) parts.push({ a: (i / n) * Math.PI * 2, r: 4, v: Util.rand(1.5, 3.5) });
    }
    B.nums.push({ g, parts, cx, cy, col, life: 0, fx: true, kind });
  };
  B.flash = function (color) {
    if (Settings.reduceMotion()) return;
    const g = new PIXI.Graphics().rect(0, 0, app.screen.width, app.screen.height).fill({ color: color || 0xffffff, alpha: 0.5 });
    B.fx.addChild(g);
    B.nums.push({ g, life: 0, flash: true });
  };
  B.tick = function (dt) {
    const reduce = Settings.reduceMotion();
    for (const o of B.enemies) {
      o.t += dt / 1000;
      let x = o.x, y = o.y, alpha = o.en.hp > 0 || !o.dying ? 1 : o.sp.alpha;
      if (!reduce && o.en.hp > 0) y += Math.sin(o.t * 2) * 2;
      if (o.hit) {
        o.hit.t += dt;
        const k = o.hit.t / 320;
        if (!reduce) x += Math.sin(o.hit.t / 18) * 8 * (1 - k);
        alpha = Math.floor(o.hit.t / 60) % 2 ? 0.35 : 1;
        if (k >= 1) o.hit = null;
      }
      if (o.act) {
        o.act.t += dt;
        const k = o.act.t / 260;
        o.sp.scale.set(o.baseScale * (1 + Math.sin(Math.min(1, k) * Math.PI) * 0.08));
        if (k >= 1) { o.act = null; o.sp.scale.set(o.baseScale); }
      }
      if (o.dying) {
        o.dying.t += dt;
        const k = Math.min(1, o.dying.t / 450);
        alpha = 1 - k;
        if (!reduce) y += k * 16;
      } else if (o.en.hp <= 0) alpha = 0;
      o.sp.x = x; o.sp.y = y; o.sp.alpha = alpha;
      let tint = o.en.def.tint || 0xffffff;
      if (o.en.prism) {
        // コアの弱点属性の色で結晶全体をほんのり染める（文字表示と併用）
        const c = DATA.ELEM_COLOR[o.en.def.prism.cycle[o.en.prism.idx]][1];
        const mix = (sh) => Math.round((((c >> sh) & 255) + 255 * 1.2) / 2.2) << sh;
        tint = o.en.prism.broken > 0 ? 0xffffff : (mix(16) | mix(8) | mix(0));
      }
      o.sp.tint = tint;
    }
    const tgt = B.enemies.find((o) => o.targeted && o.en.hp > 0);
    drawMarker(tgt, performance.now() / 1000);
    B.nums = B.nums.filter((n) => {
      n.life += dt;
      if (n.t) {
        n.t.y = n.y0 - Math.min(1, n.life / 300) * 26;
        n.t.alpha = n.life > 900 ? Math.max(0, 1 - (n.life - 900) / 300) : 1;
        if (n.life > 1200) { n.t.destroy(); return false; }
      } else if (n.flash) {
        n.g.alpha = Math.max(0, 1 - n.life / 180);
        if (n.life > 180) { n.g.destroy(); return false; }
      } else if (n.fx) {
        const k = n.life / 520;
        if (n.kind === 'slash') n.g.alpha = 1 - k;
        else {
          n.g.clear();
          for (const p of n.parts) {
            const r = p.r + p.v * n.life / 16;
            n.g.circle(n.cx + Math.cos(p.a) * r, n.cy + Math.sin(p.a) * r * 0.8, Math.max(1, 7 * (1 - k))).fill({ color: n.col, alpha: 1 - k });
          }
          n.g.circle(n.cx, n.cy, 30 * k + 6).stroke({ width: 3, color: n.col, alpha: 1 - k });
        }
        if (k >= 1) { n.g.destroy(); return false; }
      }
      return true;
    });
  };

  R.tick = function (dt) {
    dt = Math.min(dt, 100);
    if (R.battleRoot.visible) B.tick(dt);
    else F.tick(dt);
    if (R.onTick) R.onTick(dt);
  };

  // ---------- 画面遷移（DOMオーバーレイ） ----------
  R.fade = function (toBlack, ms) {
    const f = document.getElementById('fade');
    ms = Settings.reduceMotion() ? Math.min(ms || 250, 120) : (ms || 250);
    f.style.transitionDuration = ms + 'ms';
    f.classList.toggle('on', !!toBlack);
    return Util.wait(ms + 20);
  };
  R.encounterFx = async function () {
    const f = document.getElementById('fade');
    if (!Settings.reduceMotion()) {
      f.classList.add('flashfx');
      await Util.wait(360);
      f.classList.remove('flashfx');
    }
    await R.fade(true, 220);
  };
  R.shake = function () {
    if (Settings.reduceMotion()) return;
    const g = document.getElementById('game');
    g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
  };

  return R;
})();
