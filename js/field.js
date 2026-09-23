'use strict';
// =============================================================
// フィールド: 移動・当たり判定・ギミック（押し岩／スイッチ／扉）・エンカウント・イベント実行
// =============================================================
const Field = (() => {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const STEP_MS = 150;
  const F = {
    map: null, x: 0, y: 0, dir: 'down', trail: [], move: null, bob: 0,
    rockPos: {}, npcPos: {}, npcTimers: {}, onWarpTile: false, busy: false,
  };

  // ---------- 状態参照 ----------
  F.entityVisible = (e) => {
    if (e.showIf && !Game.cond(e.showIf)) return false;
    if (e.hideIf && Game.cond(e.hideIf)) return false;
    if (e.type === 'boss' && Game.flag(e.flag)) return false;
    return true;
  };
  F.gateOpen = (e) => Game.cond(e.openIf);
  F.entityPos = (e) => {
    if (e.type === 'rock') return F.rockPos[e.uid] || { x: e.x, y: e.y };
    if (e.type === 'npc' && e.wander) return F.npcPos[e.uid] || { x: e.x, y: e.y };
    return { x: e.x, y: e.y };
  };
  F.switchPressed = (e) => {
    if (e.kind === 'toggle') return Game.flag(e.flag);
    if (Game.flag(e.flag)) return true;
    return false;
  };
  function entitiesAt(x, y) {
    return F.map.entities.filter((e) => { const p = F.entityPos(e); return p.x === x && p.y === y && F.entityVisible(e); });
  }
  function blocksMove(e) {
    switch (e.type) {
      case 'npc': case 'chest': case 'sign': case 'spring': case 'boss': case 'rock': return true;
      case 'door': return !Game.flag(e.flag);
      case 'gate': return !F.gateOpen(e);
      default: return false;
    }
  }
  function tileBlocked(x, y) {
    const m = F.map;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
    const L = MAPS.LEGEND[m.grid[y][x]] || { block: true };
    if (!L.block) return false;
    // 光の橋などで水上が通れる場合
    return !entitiesAt(x, y).some((e) => e.type === 'bridge');
  }
  function occupied(x, y, ignore) {
    if (tileBlocked(x, y)) return true;
    return entitiesAt(x, y).some((e) => e !== ignore && blocksMove(e));
  }

  // ---------- マップ入場 ----------
  F.arrivalPos = function (mapId, at) {
    const m = MAPS.MAPS[mapId];
    if (Array.isArray(at)) return { x: at[0], y: at[1] };
    const e = m.entities.find((q) => q.mark === at);
    return e ? { x: e.x, y: e.y } : { x: 1, y: 1 };
  };
  F.enter = function (mapId, x, y, dir) {
    const m = MAPS.MAPS[mapId];
    const prev = F.map;
    F.map = m;
    F.x = x; F.y = y; F.dir = dir || F.dir || 'down';
    F.move = null;
    F.trail = [];
    F.rockPos = {}; F.npcPos = {}; F.npcTimers = {};
    for (const e of m.entities) {
      if (e.type === 'rock') F.rockPos[e.uid] = { x: e.x, y: e.y };
      if (e.type === 'npc' && e.wander) { F.npcPos[e.uid] = { x: e.x, y: e.y }; F.npcTimers[e.uid] = Util.rand(800, 2500); }
    }
    Game.s.map = mapId; Game.s.x = x; Game.s.y = y; Game.s.dir = F.dir;
    if (m.town && DATA.TOWNS[mapId]) {
      Game.s.lastTown = mapId;
      if (!Game.s.visited.includes(mapId)) Game.s.visited.push(mapId);
    }
    F.onWarpTile = entitiesAt(x, y).some((e) => e.type === 'warp');
    Render.field.build(m);
    Render.field.syncEntities();
    F.refreshParty();
    Sound.bgm(m.bgm || 'field');
    if (!prev || prev.id !== m.id) UI.toast(m.name, 1800);
  };
  F.refreshParty = function () {
    Render.field.setParty(Game.party);
    F.placeActors();
    Render.field.updateCamera(true);
  };
  F.placeActors = function () {
    let lead = { x: F.x, y: F.y };
    if (F.move) {
      const k = Math.min(1, F.move.t / STEP_MS);
      lead = { x: F.move.fx + (F.x - F.move.fx) * k, y: F.move.fy + (F.y - F.move.fy) * k };
    }
    const trail = [];
    const n = Game.party.length - 1;
    for (let i = 0; i < n; i++) {
      const cur = F.trail[i] || { x: F.x, y: F.y, dir: F.dir };
      let p = { x: cur.x, y: cur.y, dir: cur.dir };
      if (F.move && F.move.trailFrom) {
        const from = F.move.trailFrom[i] || cur;
        const k = Math.min(1, F.move.t / STEP_MS);
        p = { x: from.x + (cur.x - from.x) * k, y: from.y + (cur.y - from.y) * k, dir: cur.dir };
      }
      trail.push(p);
    }
    Render.field.placeActors(lead, trail, F.dir, F.move ? F.bob : 0);
  };

  // ---------- 更新 ----------
  F.update = function (dt) {
    if (!F.map) return;
    // NPCのうろつき
    for (const e of F.map.entities) {
      if (!(e.type === 'npc' && e.wander) || !F.entityVisible(e)) continue;
      F.npcTimers[e.uid] -= dt;
      if (F.npcTimers[e.uid] <= 0) {
        F.npcTimers[e.uid] = Util.rand(1400, 3200);
        if (F.busy) continue;
        const p = F.npcPos[e.uid];
        const d = Util.pick(Object.keys(DIRS));
        const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1];
        if (Math.abs(nx - e.x) <= 2 && Math.abs(ny - e.y) <= 2 && !occupied(nx, ny, e) && !(nx === F.x && ny === F.y) &&
          !(F.move && nx === F.move.fx && ny === F.move.fy) && !F.map.entities.some((q) => q.type === 'warp' && q.x === nx && q.y === ny)) {
          Render.field.moveEntitySprite(e, p.x, p.y, nx, ny, 400);
          F.npcPos[e.uid] = { x: nx, y: ny };
          Render.field.faceEntity(e, d);
        }
      }
    }
    if (F.move) {
      F.move.t += dt;
      F.bob += dt / 70;
      if (F.move.t >= STEP_MS) {
        F.move = null;
        F.placeActors();
        Render.field.updateCamera();
        F.arrived();
      } else {
        F.placeActors();
        Render.field.updateCamera();
      }
      return;
    }
    if (F.busy || UI.hasModal()) { F.queued = null; return; }
    const d = Input.dir() || F.queued;
    F.queued = null;
    if (d) F.tryMove(d);
  };
  /** 短いキー入力（押してすぐ離す）でも1歩進めるように先行入力として保持 */
  F.tap = function (d) {
    if (F.busy || UI.hasModal()) return;
    if (F.move) { F.queued = d; return; }
    F.queued = null;
    F.tryMove(d);
  };

  F.tryMove = function (d) {
    F.dir = d; Game.s.dir = d;
    const nx = F.x + DIRS[d][0], ny = F.y + DIRS[d][1];
    const m = F.map;
    // 町の外へ
    if ((nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) && m.exit) {
      F.warp(m.exit.to, m.exit.x, m.exit.y, 'down');
      return;
    }
    const ents = entitiesAt(nx, ny);
    const rock = ents.find((e) => e.type === 'rock');
    if (rock) {
      if (!F.pushRock(rock, d)) { F.placeActors(); return; }
    }
    if (occupied(nx, ny)) { F.placeActors(); if (!F.bumpCd) { Sound.sfx('bump'); F.bumpCd = true; setTimeout(() => { F.bumpCd = false; }, 250); } return; }
    // 移動開始
    const trailFrom = F.trail.map((p) => Object.assign({}, p));
    F.trail.unshift({ x: F.x, y: F.y, dir: F.dir });
    F.trail.length = Math.min(F.trail.length, 3);
    F.move = { fx: F.x, fy: F.y, t: 0, trailFrom };
    F.x = nx; F.y = ny;
    Game.s.x = nx; Game.s.y = ny;
  };

  F.pushRock = function (rock, d) {
    const p = F.rockPos[rock.uid];
    const tx = p.x + DIRS[d][0], ty = p.y + DIRS[d][1];
    const blockers = entitiesAt(tx, ty).filter((e) => blocksMove(e) || e.type === 'warp');
    if (tileBlocked(tx, ty) || blockers.length) { Sound.sfx('bump'); UI.toast(TEXT.field.rockStuck, 1400); return false; }
    Sound.sfx('rock');
    Render.field.moveEntitySprite(rock, p.x, p.y, tx, ty, 180);
    F.rockPos[rock.uid] = { x: tx, y: ty };
    // 岩スイッチの判定
    const sw = F.map.entities.find((e) => e.type === 'switch' && e.kind === 'rock' && e.x === tx && e.y === ty);
    if (sw && !Game.flag(sw.flag)) {
      Game.setFlag(sw.flag);
      Sound.sfx('switch');
      UI.toast(TEXT.field.switchOn);
    }
    Render.field.syncEntities();
    return true;
  };

  // 1歩進み終わったときの処理
  F.arrived = function () {
    Game.s.steps++;
    const ents = entitiesAt(F.x, F.y);
    const warp = ents.find((e) => e.type === 'warp');
    if (warp && !F.onWarpTile) {
      const pos = F.arrivalPos(warp.to, warp.at);
      Sound.sfx('warp');
      F.warp(warp.to, pos.x, pos.y);
      return;
    }
    F.onWarpTile = !!warp;
    for (const sw of ents.filter((e) => e.type === 'switch')) {
      if (sw.kind === 'step' && !Game.flag(sw.flag)) { Game.setFlag(sw.flag); Sound.sfx('switch'); UI.toast(TEXT.field.switchOn); }
      else if (sw.kind === 'toggle') { Game.setFlag(sw.flag, !Game.flag(sw.flag)); Sound.sfx('switch'); UI.toast(TEXT.field.switchOn); }
    }
    Render.field.syncEntities();
    // 床ダメージ・毒
    const L = MAPS.LEGEND[F.map.grid[F.y][F.x]] || {};
    let hurt = false, poisoned = false;
    for (const c of Game.party) {
      if (c.hp <= 0) continue;
      const st = Party.stats(c);
      let dmg = 0;
      if (L.dmg === 'lava') dmg += Math.max(2, Math.floor(st.hp * 0.03));
      if (L.dmg === 'swamp') dmg += Math.max(1, Math.floor(st.hp * 0.015));
      if (c.status.poison) { dmg += Math.max(1, Math.floor(st.hp * 0.01)); poisoned = true; }
      if (dmg) { c.hp = Math.max(1, c.hp - dmg); hurt = true; }
    }
    if (hurt) {
      const f = document.getElementById('fade');
      f.classList.remove('hurtfx'); void f.offsetWidth; f.classList.add('hurtfx');
      Sound.sfx('poison');
      if (L.dmg === 'lava') UI.toast(TEXT.field.lavaStep, 900);
      else if (L.dmg === 'swamp') UI.toast(TEXT.field.swampStep, 900);
      else if (poisoned && Game.s.steps % 8 === 0) UI.toast(TEXT.field.poisonStep, 900);
    }
    // 灯よけ
    if (Game.s.repel > 0) {
      Game.s.repel--;
      if (Game.s.repel === 0) UI.toast(TEXT.field.repelOff);
    }
    // エンカウント
    const encId = typeof F.map.enc === 'function' ? F.map.enc(F.x, F.y, F.map.grid[F.y][F.x]) : F.map.enc;
    if (encId && DATA.ENCOUNTERS[encId]) {
      const dec = Game.s.repel > 0 ? 0.25 : (L.forest ? 1.4 : 1);
      Game.s.encCounter -= dec;
      if (Game.s.encCounter <= 0) {
        const rate = DATA.ENCOUNTERS[encId].rate;
        Game.s.encCounter = Util.randInt(rate[0], rate[1]);
        F.randomBattle(encId);
      }
    }
  };

  F.warp = async function (mapId, x, y, dir) {
    F.busy = true;
    Input.releaseAll();
    await Render.fade(true, 220);
    F.enter(mapId, x, y, dir || F.dir);
    await Render.fade(false, 220);
    F.busy = false;
  };

  F.randomBattle = async function (encId) {
    const tbl = DATA.ENCOUNTERS[encId];
    const g = Util.weighted(tbl.groups);
    F.busy = true;
    const res = await Battle.run({ enemies: g[1], bg: (F.map.bg) || tbl.bg, canRun: true });
    F.busy = false;
    if (res === 'lose') await F.gameOver();
  };

  // ---------- 調べる ----------
  /** タップされたマスへの反応: 自分なら 'menu'、隣の調べられる物なら向きを変えて 'ok' */
  F.tapTile = function (tx, ty) {
    if (F.busy || F.move) return null;
    if (tx === F.x && ty === F.y) return 'menu';
    const dx = tx - F.x, dy = ty - F.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1 || !F.map.grid[ty] || F.map.grid[ty][tx] === undefined) return null;
    const hasThing = entitiesAt(tx, ty).some((e) => ['npc', 'chest', 'door', 'gate', 'sign', 'spring', 'boss', 'rock'].includes(e.type)) ||
      (MAPS.LEGEND[F.map.grid[ty][tx]] || {}).counter;
    if (!hasThing) return null;
    F.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    F.placeActors();
    return 'ok';
  };
  F.facing = function () { return { x: F.x + DIRS[F.dir][0], y: F.y + DIRS[F.dir][1] }; };
  F.interact = async function () {
    if (F.busy || F.move) return;
    let { x, y } = F.facing();
    let ents = entitiesAt(x, y).filter((e) => e.type !== 'bridge' && e.type !== 'mark' && e.type !== 'warp');
    const L = F.map.grid[y] && MAPS.LEGEND[F.map.grid[y][x]];
    if (!ents.length && L && L.counter) {
      x += DIRS[F.dir][0]; y += DIRS[F.dir][1];
      ents = entitiesAt(x, y).filter((e) => e.type === 'npc');
    }
    const e = ents[0];
    if (!e) { return; }
    await F.runEvent(async () => {
      switch (e.type) {
        case 'npc':
          if (e.sprite && (e.sprite.startsWith('npc_'))) Render.field.faceEntity(e, x > F.x ? 'left' : 'right');
          await F.script(e.script || [['msg', '……']], e);
          break;
        case 'sign': await UI.message(e.text); break;
        case 'chest': await F.openChest(e); break;
        case 'door': await F.openDoor(e); break;
        case 'gate': await UI.message(TEXT.field.gateClosed); break;
        case 'spring':
          Game.party.forEach((c) => { if (c.hp > 0) { const st = Party.stats(c); c.hp = st.hp; c.mp = st.mp; } });
          Sound.sfx('heal');
          await UI.message(TEXT.field.springHeal);
          break;
        case 'boss': await F.bossEvent(e); break;
        case 'rock': await UI.message(TEXT.field.rock); break;
        default: break;
      }
    });
  };
  /** イベント実行中は EVENT 状態を積む */
  F.runEvent = async function (fn) {
    F.busy = true;
    Input.releaseAll();
    App.fsm.push('event');
    try { await fn(); }
    catch (err) { console.error(err); }
    finally {
      if (App.fsm.currentName === 'event') App.fsm.pop();
      F.busy = false;
      if (F.map) { Render.field.syncEntities(); F.refreshParty(); }
    }
  };

  F.openChest = async function (e) {
    if (Game.flag(e.flag)) { await UI.message(TEXT.field.chestEmpty); return; }
    if (e.mimic) {
      await UI.message(TEXT.field.mimic);
      const res = await Battle.run({ enemies: DATA.BOSS_GROUPS[e.mimic].enemies, bg: F.map.bg || 'bg_tower', canRun: false });
      if (res === 'lose') { await F.gameOver(); return; }
    }
    Sound.sfx('chest');
    if (e.gold) {
      Game.setFlag(e.flag);
      Game.s.gold = Math.min(9999999, Game.s.gold + e.gold);
      Render.field.syncEntities();
      await UI.message(T('field.chestGold', { n: e.gold }));
      return;
    }
    const it = DATA.ITEMS[e.item];
    const got = Game.addItem(e.item, e.qty || 1);
    if (got <= 0) { await UI.message(T('field.chestFull', { item: it.name })); return; }
    Game.setFlag(e.flag);
    Render.field.syncEntities();
    await UI.message(T('field.chestItem', { item: it.name + ((e.qty || 1) > 1 ? ` ×${got}` : '') }));
  };
  F.openDoor = async function (e) {
    const key = DATA.ITEMS[e.key];
    if (!Game.has(e.key)) { Sound.sfx('buzz'); await UI.message(T('field.locked', { key: key.name })); return; }
    Game.removeItem(e.key);
    Game.setFlag(e.flag);
    Sound.sfx('door');
    Render.field.syncEntities();
    await UI.message(T('field.unlocked', { key: key.name }));
  };
  F.bossEvent = async function (e) {
    await F.script(e.pre || [], e);
    const grp = DATA.BOSS_GROUPS[e.group];
    const res = await Battle.run({ enemies: grp.enemies, bg: grp.bg, canRun: false, boss: true, bgm: e.final || e.group === 'amnes' ? 'boss' : 'boss' });
    if (res === 'lose') { await F.gameOver(); return; }
    Game.setFlag(e.flag);
    Render.field.syncEntities();
    await F.script(e.post || [], e);
  };

  // ---------- 全滅 ----------
  F.gameOver = async function () {
    App.fsm.push('gameover');
    Sound.stopBgm();
    Sound.sfx('gameover');
    await Render.fade(true, 500);
    Render.battle.close();
    const town = DATA.TOWNS[Game.s.lastTown] || DATA.TOWNS.lanta;
    Game.s.gold = Math.floor(Game.s.gold / 2);
    Game.party.concat(Game.reserve).forEach((c) => Party.fullHeal(c));
    const arr = SaveSys.townArrival(Game.s.lastTown);
    F.enter(arr.map, arr.x, arr.y, 'up');
    await Render.fade(false, 400);
    await UI.message(TEXT.over.lose);
    await UI.message(T('over.revive', { town: town.name }));
    App.fsm.pop();
  };

  // ---------- スクリプト ----------
  function fmt(text) {
    const hero = Game.s.roster.find((c) => c.hero);
    return text.replace('{hero}', hero ? hero.name : '').replace('{orbsLeft}', String(6 - Game.orbs()));
  }
  F.script = async function (ops, ent) {
    for (const op of ops) {
      const [cmd, a, b, c] = op;
      switch (cmd) {
        case 'msg': await UI.message(fmt(a)); break;
        case 'say': await UI.message(fmt(b), { speaker: a }); break;
        case 'if': await F.script(Game.cond(a) ? b : (c || []), ent); break;
        case 'choice': {
          const i = await UI.ask(fmt(a), b.map((x) => x[0]), { speaker: ent && ent.name });
          await F.script(b[i] ? b[i][1] : [], ent);
          break;
        }
        case 'flag': Game.setFlag(a, b === undefined ? true : b); break;
        case 'item': {
          const it = DATA.ITEMS[a];
          Game.addItem(a, b || 1);
          if (!c) { Sound.sfx('item'); await UI.message(T('field.chestItem', { item: it.name })); }
          if (a === 'ferrypass') Game.setFlag('ferry_used');
          break;
        }
        case 'orb': {
          Game.addItem('orb' + a, 1);
          Sound.sfx('levelup');
          Render.shake();
          const f = document.getElementById('fade');
          f.classList.remove('orbfx'); void f.offsetWidth; f.classList.add('orbfx');
          await UI.message(T('field.chestItem', { item: DATA.ITEMS['orb' + a].name }) + T('field.orbCount', { n: Game.orbs() }));
          break;
        }
        case 'gold': Game.s.gold = Util.clamp(Game.s.gold + a, 0, 9999999); break;
        case 'shop': await Menus.shop(a); break;
        case 'inn': await Menus.inn(a); break;
        case 'guild': await Menus.guild(); break;
        case 'heal': Game.party.forEach((c) => Party.fullHeal(c)); break;
        case 'warp': Sound.sfx('warp'); await F.warp(a, b, c); break;
        case 'battle': {
          const grp = DATA.BOSS_GROUPS[a];
          const res = await Battle.run({ enemies: grp.enemies, bg: grp.bg, canRun: false, boss: true });
          if (res === 'lose') { await F.gameOver(); return; }
          break;
        }
        case 'sfx': Sound.sfx(a); break;
        case 'bgm': Sound.bgm(a); break;
        case 'wait': await Util.wait(Settings.reduceMotion() ? Math.min(a, 150) : a); break;
        case 'flash': {
          const f = document.getElementById('fade');
          f.classList.remove('orbfx'); void f.offsetWidth; f.classList.add('orbfx');
          break;
        }
        case 'ending': await Ending.play(a); return;
        default: console.warn('unknown script op', cmd);
      }
    }
  };

  // ---------- 帰り鳥の羽／トビカエリ ----------
  F.canReturn = () => !!(F.map && (F.map.outdoor || F.map.town));
  F.returnTo = async function () {
    if (!F.canReturn()) { await UI.message(TEXT.field.returnDungeon); return false; }
    const towns = Game.s.visited.filter((t) => DATA.TOWNS[t]);
    if (!towns.length) { await UI.message(TEXT.field.returnNone); return false; }
    const r = await UI.list({ title: TEXT.field.returnWhere, items: towns.map((t) => ({ label: DATA.TOWNS[t].name, value: t })), cls: 'mid' });
    if (!r) return false;
    const t = DATA.TOWNS[r.value];
    Sound.sfx('warp');
    await F.warp(t.map, t.x, t.y, 'down');
    return true;
  };

  return F;
})();
