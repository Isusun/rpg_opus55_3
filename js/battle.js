'use strict';
// =============================================================
// 戦闘の進行と演出（BattleCore の結果を画面に見せる）
//  内部状態: start → input → execute → turnEnd → (victory | defeat | escape) → end
// =============================================================
const Battle = (() => {
  const B = { ctx: null, phase: 'none', dom: {} };

  // ---------- 戦闘ログ ----------
  const logSpeed = () => ({ slow: 1000, normal: 700, fast: 420, instant: 240 }[Settings.get('textSpeed')] || 700);
  let skipResolver = null;
  function logLine(text, cls) {
    const box = B.dom.log;
    const line = UI.el('div', 'line ' + (cls || ''), text);
    box.appendChild(line);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    UI.announce(text);
  }
  function wait(ms) {
    return new Promise((res) => {
      const t = setTimeout(() => { skipResolver = null; res(); }, ms);
      skipResolver = () => { clearTimeout(t); skipResolver = null; res(); };
    });
  }
  async function say(text, cls, mult) { logLine(text, cls); await wait(logSpeed() * (mult || 1)); }
  function waitOk() {
    return new Promise((res) => {
      B.dom.log.classList.add('prompt');
      B.okResolver = () => { B.dom.log.classList.remove('prompt'); B.okResolver = null; res(); };
    });
  }

  // ---------- DOM 構築 ----------
  function buildDom() {
    const ui = document.getElementById('ui');
    const root = UI.el('div', 'battleui');
    const party = UI.el('div', 'bparty');
    party.setAttribute('aria-label', TEXT.battle.partyLabel);
    const order = UI.el('div', 'border');
    order.setAttribute('aria-label', TEXT.battle.turnOrder);
    const tags = UI.el('div', 'etags');
    const info = UI.el('div', 'einfo');
    const bottom = UI.el('div', 'bottomwrap');
    const log = UI.el('div', 'win blog');
    log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
    log.addEventListener('click', () => { Input.markPointer(); B.onAction('ok'); });
    bottom.appendChild(log);
    root.append(party, order, info, tags, bottom);
    ui.appendChild(root);
    B.dom = { root, party, order, tags, info, log, bottom, cards: [], etags: [] };
    Game.party.forEach((c, i) => {
      const card = UI.el('div', 'pcard');
      card.innerHTML = '<div class="pn"><span class="cur" aria-hidden="true">▶</span><span class="nm"></span><span class="lv"></span></div>' +
        '<div class="bar hpbar"><i></i></div><div class="nums"><span class="hp"></span><span class="mp"></span></div><div class="chips"></div><div class="float"></div>';
      party.appendChild(card);
      B.dom.cards.push(card);
    });
  }
  function statusChips(s, extra) {
    const out = [];
    for (const k of ['poison', 'sleep', 'paralyze', 'seal']) if (s[k]) out.push(`<span class="chip st-${k}">${TEXT.status[k]}</span>`);
    return out.concat(extra || []).join('');
  }
  function buffChips(b) {
    const out = [];
    for (const k of ['atk', 'def']) {
      const v = b.buffs[k] || 0;
      if (v > 0) out.push(`<span class="chip buff">${TEXT.status[k + 'Up']}${v > 1 ? '×2' : ''}</span>`);
      if (v < 0) out.push(`<span class="chip debuff">${TEXT.status[k + 'Down']}</span>`);
    }
    if (b.charge) out.push(`<span class="chip buff">${TEXT.status.charge}</span>`);
    if (b.guard) out.push(`<span class="chip buff">${TEXT.status.guard}</span>`);
    return out;
  }
  function refresh() {
    const ctx = B.ctx;
    B.dom.root.style.setProperty('--bparty-h', B.dom.party.offsetHeight + 'px');
    ctx.party.forEach((b, i) => {
      const card = B.dom.cards[i];
      const c = b.ref, st = Party.stats(c);
      card.querySelector('.nm').textContent = c.name;
      card.querySelector('.lv').textContent = `${TEXT.stat.lv}${c.lv}`;
      card.querySelector('.hp').textContent = `${TEXT.stat.hp} ${c.hp}/${st.hp}`;
      card.querySelector('.mp').textContent = `${TEXT.stat.mp} ${c.mp}`;
      const r = c.hp / st.hp;
      const bar = card.querySelector('.hpbar i');
      bar.style.width = (r * 100).toFixed(1) + '%';
      card.classList.toggle('low', r > 0 && r <= 0.25);
      card.classList.toggle('dead', c.hp <= 0);
      const chips = c.hp <= 0 ? `<span class="chip st-dead">${TEXT.status.dead}</span>` : statusChips(c.status, buffChips(b));
      card.querySelector('.chips').innerHTML = chips || '';
    });
    // 敵の名札
    const tags = B.dom.tags;
    tags.innerHTML = '';
    B.dom.etags = [];
    const alive = ctx.enemies.filter(BattleCore.alive);
    ctx.enemies.forEach((e) => {
      const pos = Render.battle.enemyScreen(e);
      if (!pos || !BattleCore.alive(e)) return;
      const tag = UI.el('button', 'etag');
      tag.type = 'button';
      tag.tabIndex = -1;
      const r = e.hp / e.maxhp;
      let extra = [];
      if (e.prism) extra.push(e.prism.broken > 0 ? `<span class="chip buff">${TEXT.battle.enemyBrokenLabel}</span>` : `<span class="chip debuff">${TEXT.battle.enemyBarrierLabel}</span>`);
      tag.innerHTML = `<span class="en">${e.name}</span><span class="bar ebar"><i style="width:${(r * 100).toFixed(1)}%"></i></span><span class="chips">${statusChips(e.status, buffChips(e).concat(extra))}</span>`;
      tag.style.left = (pos.x / Render.app.screen.width * 100).toFixed(2) + '%';
      tag.style.top = Math.min(Render.app.screen.height - 60, pos.bottom + 4) + 'px';
      tag.addEventListener('click', (ev) => { ev.stopPropagation(); Input.markPointer(); if (B.targetPick) B.targetPick(e); });
      tags.appendChild(tag);
      B.dom.etags.push({ e, tag });
    });
    // 残数・プリズマ情報
    const prism = ctx.enemies.find((e) => e.prism && BattleCore.alive(e));
    let html = `<span class="left">${T('battle.enemiesLeft', { n: alive.length })}</span>`;
    if (prism) {
      const cfg = prism.def.prism, el = cfg.cycle[prism.prism.idx], nx = cfg.cycle[(prism.prism.idx + 1) % cfg.cycle.length];
      const col = DATA.ELEM_COLOR[el];
      html += `<span class="prism" style="--core:#${col[1].toString(16).padStart(6, '0')}"><span class="dot" aria-hidden="true"></span>${T('battle.prismCore', { color: col[0], elem: TEXT.elem[el], next: TEXT.elem[nx] })}${prism.prism.broken > 0 ? T('battle.brokenTurns', { label: TEXT.battle.enemyBrokenLabel, n: prism.prism.broken }) : ''}</span>`;
    }
    B.dom.info.innerHTML = html;
  }
  function setActive(b) {
    B.dom.cards.forEach((c, i) => c.classList.toggle('active', !!b && B.ctx.party[i] === b));
  }
  function floatOn(b, text, cls) {
    if (b.side === 'party') {
      const card = B.dom.cards[b.pos];
      const f = card.querySelector('.float');
      const s = UI.el('span', cls, text);
      f.appendChild(s);
      setTimeout(() => s.remove(), 1100);
      if (cls === 'dmg') { card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit'); }
    } else {
      Render.battle.number(b, text, cls === 'heal' ? 0x80ff9a : cls === 'crit' ? 0xffe060 : 0xffffff);
    }
  }
  function showOrder(list, curIdx) {
    const el = B.dom.order;
    el.innerHTML = `<span class="ot">${TEXT.battle.turnOrder}</span>` + list.map((o, i) => {
      const dead = !BattleCore.alive(o.b);
      return `<span class="oi ${o.b.side} ${i === curIdx ? 'now' : ''} ${i < curIdx || dead ? 'done' : ''}">${i === curIdx ? '▶' : ''}${o.b.name}</span>`;
    }).join('<span class="sep" aria-hidden="true">›</span>');
  }

  // ---------- 入力フェーズ ----------
  function invAdapter() {
    return { remove: (id) => Game.removeItem(id, 1), add: (id, n) => Game.addItem(id, n), count: (id) => Game.count(id) };
  }
  function battleSkills(c) {
    return Party.skills(c).map((id) => [id, DATA.SKILLS[id]]).filter(([, s]) => !s.fieldOnly);
  }
  function battleItems() {
    return Object.keys(Game.s.inv).filter((id) => DATA.ITEMS[id].type === 'use' && !DATA.ITEMS[id].fieldOnly && Game.count(id) > 0);
  }
  async function pickEnemy() {
    const alive = B.ctx.enemies.filter(BattleCore.alive);
    let h = null;
    h = UI.listWin({
      title: TEXT.battle.chooseTarget, cls: 'bsub', items: alive.map((e) => ({ label: e.name, value: e, right: statusText(e.status) })),
      onMove: (it) => Render.battle.setTarget(it && it.value),
      // 敵は横に並ぶので左右キーでも選べるようにする
      onLR: (d) => { if (h) { h.setIndex((h.index + d + alive.length) % alive.length); Sound.sfx('cursor'); } },
    });
    const p = h.choose();
    const tagPick = new Promise((res) => { B.targetPick = (e) => res({ value: e }); });
    Render.battle.setTarget(alive[0]);
    const r = await Promise.race([p, tagPick]);
    B.targetPick = null;
    h.close();
    Render.battle.setTarget(null);
    return r ? r.value : null;
  }
  function statusText(s) { return ['poison', 'sleep', 'paralyze', 'seal'].filter((k) => s[k]).map((k) => TEXT.status[k]).join(' '); }
  async function pickAlly(dead) {
    const list = B.ctx.party.filter((b) => (dead ? !BattleCore.alive(b) : BattleCore.alive(b)));
    if (!list.length) { UI.toast(TEXT.battle.noTarget); return null; }
    const r = await UI.list({ title: TEXT.battle.chooseAlly, cls: 'bsub', items: list.map((b) => ({ label: b.name, value: b, right: `${TEXT.stat.hp}${b.ref.hp}` })) });
    return r ? r.value : null;
  }
  async function pickTarget(type) {
    if (type === 'enemy') return (await pickEnemy()) || false;
    if (type === 'ally') return (await pickAlly(false)) || false;
    if (type === 'deadAlly') return (await pickAlly(true)) || false;
    return null; // 全体・自分・ランダムは選択不要
  }
  async function commandMenu(b, first) {
    const c = b.ref;
    const skills = battleSkills(c);
    const items = battleItems();
    const cmds = [
      { label: TEXT.cmd.attack, value: 'attack', desc: TEXT.battle.descAttack },
      { label: TEXT.cmd.skill, value: 'skill', disabled: !skills.length, whyDisabled: TEXT.battle.noSkills, desc: TEXT.battle.descSkill },
      { label: TEXT.cmd.guard, value: 'guard', desc: TEXT.battle.descGuard },
      { label: TEXT.cmd.item, value: 'item', disabled: !items.length, whyDisabled: TEXT.menu.noItems, desc: TEXT.battle.descItem },
      { label: TEXT.cmd.run, value: 'run', disabled: !first || !B.ctx.canRun, whyDisabled: !B.ctx.canRun ? TEXT.battle.runBoss : TEXT.battle.runLeaderOnly, desc: TEXT.battle.descRun },
    ];
    const narrow = window.innerWidth < 640 || window.innerHeight < 500;
    const h = UI.listWin({ title: T('battle.whoseTurn', { name: c.name }), cls: 'bcmd', items: cmds, start: B.lastCmd[b.pos] || 0, cancel: true, cols: narrow ? 2 : 1, desc: !narrow });
    for (;;) {
      const r = await h.choose();
      if (!r) { h.close(); return 'back'; }
      B.lastCmd[b.pos] = r.index;
      if (r.value === 'attack') {
        h.win.active = false;
        const t = await pickTarget('enemy');
        h.win.active = true;
        if (t === false) { h.win.focus(); continue; }
        h.close(); return { kind: 'attack', target: t };
      }
      if (r.value === 'guard') { h.close(); return { kind: 'guard' }; }
      if (r.value === 'run') { h.close(); return { kind: 'run' }; }
      if (r.value === 'skill') {
        h.win.active = false;
        const sealed = c.status.seal;
        const sr = await UI.list({
          title: `${TEXT.cmd.skill}（MP ${c.mp}）`, cls: 'bsub skills', items: skills.map(([id, s]) => {
            const noMp = (s.mp || 0) > c.mp, isSealed = sealed && s.kind === 'magic';
            return { label: s.name, value: id, right: `MP${s.mp || 0}`, desc: s.desc + (isSealed ? TEXT.battle.sealedNote : ''), disabled: noMp || isSealed, whyDisabled: isSealed ? TEXT.battle.sealed : TEXT.menu.notEnoughMp };
          }),
        });
        if (!sr) { h.win.active = true; h.win.focus(); continue; }
        const sk = DATA.SKILLS[sr.value];
        const t = await pickTarget(sk.target);
        h.win.active = true;
        if (t === false) { h.win.focus(); continue; }
        h.close(); return { kind: 'skill', skill: sr.value, target: t };
      }
      if (r.value === 'item') {
        h.win.active = false;
        const ir = await UI.list({ title: TEXT.cmd.item, cls: 'bsub', items: items.map((id) => ({ label: DATA.ITEMS[id].name, value: id, right: '×' + Game.count(id), desc: DATA.ITEMS[id].desc })) });
        if (!ir) { h.win.active = true; h.win.focus(); continue; }
        const it = DATA.ITEMS[ir.value];
        const t = await pickTarget(it.target === 'none' ? null : it.target);
        h.win.active = true;
        if (t === false) { h.win.focus(); continue; }
        h.close(); return { kind: 'item', item: ir.value, target: t };
      }
    }
  }
  async function inputPhase() {
    const party = B.ctx.party;
    const cmds = party.map(() => null);
    const able = party.map((b, i) => (BattleCore.canAct(b) ? i : -1)).filter((i) => i >= 0);
    if (!able.length) { await say(TEXT.battle.cantAct); return cmds; }
    let k = 0;
    while (k < able.length) {
      const b = party[able[k]];
      setActive(b);
      const r = await commandMenu(b, k === 0);
      if (r === 'back') { if (k > 0) k--; continue; }
      if (r.kind === 'run') return { run: true };
      cmds[able[k]] = r;
      k++;
    }
    setActive(null);
    return cmds;
  }

  // ---------- 演出 ----------
  const ELEM_SFX = { fire: 'fire', ice: 'ice', thunder: 'thunder', wind: 'wind', light: 'light', dark: 'dark', none: 'magic', heal: 'heal' };
  async function present(evs) {
    for (const ev of evs) {
      switch (ev.t) {
        case 'actor':
          if (ev.actor.side === 'party') setActive(ev.actor); else { setActive(null); Render.battle.enemyAct(ev.actor); }
          break;
        case 'msg': await say(ev.text); break;
        case 'fx':
          if (ev.kind === 'heal') Sound.sfx('heal');
          else if (ev.kind === 'slash') Sound.sfx(ev.elem && ev.elem !== 'none' ? ELEM_SFX[ev.elem] : 'hit');
          else Sound.sfx(ELEM_SFX[ev.elem] || 'magic');
          if (ev.target && ev.target.side === 'enemy') Render.battle.effect(ev.target, ev.elem === 'none' && ev.kind === 'slash' ? 'none' : ev.elem, ev.kind);
          break;
        case 'crit': Render.battle.flash(ev.side === 'party' ? 0xffffff : 0xff3030); Sound.sfx('crit'); await say(ev.text, 'crit', 0.7); break;
        case 'dmg':
          if (ev.target.side === 'enemy') { Render.battle.enemyHit(ev.target, ev.crit); floatOn(ev.target, ev.n, ev.crit ? 'crit' : 'dmg'); if (!ev.poison) Sound.sfx(ev.crit ? 'crit' : 'hit'); else Sound.sfx('poison'); }
          else { floatOn(ev.target, ev.n, 'dmg'); Sound.sfx(ev.poison ? 'poison' : 'hurt'); if (ev.n >= Party.stats(ev.target.ref).hp * 0.25) Render.shake(); }
          refresh();
          await say(ev.text, ev.target.side === 'party' ? 'hurt' : '');
          break;
        case 'miss': Sound.sfx('miss'); await say(ev.text); break;
        case 'nodmg': await say(ev.text); break;
        case 'heal': floatOn(ev.target, ev.n, 'heal'); refresh(); await say(ev.text, 'good'); break;
        case 'mpheal': refresh(); await say(ev.text, 'good'); break;
        case 'kill': Render.battle.enemyDie(ev.target); Sound.sfx('defeat'); await say(ev.text); refresh(); break;
        case 'down': Sound.sfx('hurt'); refresh(); await say(ev.text, 'hurt'); break;
        case 'revive': Sound.sfx('heal'); refresh(); await say(ev.text, 'good'); break;
        case 'status': Sound.sfx(ev.on ? 'status' : 'heal'); refresh(); await say(ev.text, ev.on ? 'hurt' : 'good'); break;
        case 'buff': if (!ev.end) Sound.sfx('buff'); refresh(); await say(ev.text); break;
        case 'prism': if (ev.broken) { Render.battle.flash(0xffffff); Sound.sfx('crit'); } refresh(); await say(ev.text, ev.broken ? 'good' : ''); break;
        case 'flee': Render.battle.enemyDie(ev.target); Sound.sfx('run'); refresh(); await say(ev.text); break;
        case 'escape': Sound.sfx('run'); await say(ev.text); break;
        case 'mp': refresh(); break;
        default: break;
      }
    }
  }

  // ---------- 終了処理 ----------
  async function victory(opts) {
    const ctx = B.ctx;
    const boss = ctx.enemies.find((e) => e.def.boss);
    Sound.stopBgm();
    Sound.sfx('victory');
    await say(boss ? T('battle.winBoss', { name: boss.def.name.replace(/（.*）/, '') }) : TEXT.battle.win, 'good');
    const rw = BattleCore.rewards(ctx);
    Game.s.gold = Math.min(9999999, Game.s.gold + rw.gold);
    if (rw.exp > 0) await say(T('battle.gainExp', { n: rw.exp }));
    if (rw.gold > 0) { Sound.sfx('coin'); await say(T('battle.gainGold', { n: rw.gold })); }
    for (const d of rw.drops) {
      if (Game.addItem(d, 1)) { Sound.sfx('item'); await say(T('battle.gainItem', { item: DATA.ITEMS[d].name }), 'good'); }
    }
    const members = ctx.party.filter(BattleCore.alive).map((b) => [b.ref, rw.exp]).concat(Game.reserve.map((c) => [c, Math.floor(rw.exp / 2)]));
    for (const [c, n] of members) {
      const ups = Party.gainExp(c, n);
      for (const u of ups) {
        Sound.sfx('levelup');
        const idx = ctx.party.findIndex((b) => b.ref === c);
        if (idx >= 0) { const card = B.dom.cards[idx]; card.classList.remove('lvup'); void card.offsetWidth; card.classList.add('lvup'); }
        refresh();
        await say(T('battle.levelUp', { name: c.name, lv: u.lv }), 'lv', 1.2);
        const diffs = Object.entries(u.diff).filter(([, v]) => v > 0).map(([k, v]) => `${TEXT.stat[k === 'hp' ? 'maxhp' : k === 'mp' ? 'maxmp' : k]}+${v}`);
        if (diffs.length) await say(diffs.join('　'), 'small', 0.9);
        for (const s of u.learned) await say(T('battle.learn', { name: c.name, skill: DATA.SKILLS[s].name }), 'lv', 1.1);
      }
    }
    await waitOk();
  }
  function cleanupStatuses() {
    for (const c of Game.s.roster) {
      delete c.status.sleep; delete c.status.paralyze; delete c.status.seal;
      if (c.hp <= 0) c.status = {};
    }
  }

  // ---------- メイン ----------
  B.run = async function (opts) {
    App.fsm.push('battle');
    B.phase = 'start';
    B.lastCmd = [];
    const prevBgm = Sound.want;
    Input.releaseAll();
    Sound.sfx('encounter');
    await Render.encounterFx();
    B.ctx = BattleCore.newCtx(Game.party, opts.enemies, { canRun: opts.canRun, inv: invAdapter() });
    buildDom();
    Render.battle.open(opts.bg || 'bg_plains', B.ctx.enemies);
    Sound.bgm(opts.boss ? 'boss' : 'battle');
    refresh();
    await Render.fade(false, 250);
    Render.battle.layout(); refresh();
    const first = B.ctx.enemies[0];
    const kinds = new Set(B.ctx.enemies.map((e) => e.def.id)).size;
    let appear;
    if (opts.boss) appear = T('battle.bossAppear', { name: first.def.name });
    else if (kinds > 1) appear = TEXT.battle.appearMixed;
    else appear = T(B.ctx.enemies.length > 1 ? 'battle.appearMany' : 'battle.appear', { name: first.def.name });
    await say(appear);
    let result = null;
    try {
      while (!result) {
        B.phase = 'input';
        BattleCore.beginTurn(B.ctx);
        refresh();
        const cmds = await inputPhase();
        B.phase = 'execute';
        let partyCmds = cmds;
        if (cmds.run) {
          partyCmds = B.ctx.party.map(() => null);
          if (BattleCore.tryRun(B.ctx)) { Sound.sfx('run'); await say(TEXT.battle.runOk); result = 'run'; break; }
          await say(TEXT.battle.runFail, 'hurt');
        }
        const order = BattleCore.turnOrder(B.ctx, partyCmds);
        for (let i = 0; i < order.length; i++) {
          const o = order[i];
          if (!BattleCore.alive(o.b)) continue;
          showOrder(order, i);
          let cmd = o.b.side === 'party' ? o.cmd : BattleCore.enemyChoose(B.ctx, o.b);
          if (o.b.side === 'party' && !cmd) {
            // 眠り・麻痺で入力できなかった仲間
            const s = o.b.ref.status;
            if (s.sleep || s.paralyze) await present(BattleCore.act(B.ctx, o.b, { kind: 'guard' }));
            continue;
          }
          await present(BattleCore.act(B.ctx, o.b, cmd));
          result = await checkEnd();
          if (result) break;
        }
        setActive(null);
        if (result) break;
        B.phase = 'turnEnd';
        await present(BattleCore.endTurn(B.ctx));
        result = await checkEnd();
        showOrder([], -1);
      }
      showOrder([], -1);
      if (result === 'win') { B.phase = 'victory'; await victory(opts); }
      else if (result === 'lose') { B.phase = 'defeat'; Sound.stopBgm(); await say(TEXT.battle.lose, 'hurt', 1.5); }
    } catch (err) {
      console.error(err);
      result = result || 'run';
    }
    cleanupStatuses();
    B.phase = 'end';
    await Render.fade(true, 250);
    Render.battle.close();
    UI.closeAll();
    if (B.dom.root) B.dom.root.remove();
    B.dom = {};
    B.ctx = null;
    App.fsm.pop();
    if (result !== 'lose') {
      Sound.bgm(prevBgm || (Field.map && Field.map.bgm) || 'field');
      Field.refreshParty();
      await Render.fade(false, 250);
    }
    return result;
  };
  async function checkEnd() {
    let r = BattleCore.checkEnd(B.ctx);
    if (r === 'phase') {
      const old = B.ctx.enemies.find((e) => e.hp <= 0 && e.def.nextPhase && !e.phased);
      await say(T('battle.phaseChange', { name: old.def.name }), '', 1.4);
      Render.battle.flash(0xa060ff);
      Sound.sfx('dark');
      const ne = BattleCore.nextPhase(B.ctx, old);
      Render.battle.swapEnemy(old, ne);
      refresh();
      await say(T('battle.bossAppear', { name: ne.def.name }), 'hurt', 1.2);
      r = null;
    }
    return r;
  }

  B.onAction = function (a) {
    if (B.okResolver && (a === 'ok' || a === 'cancel')) { B.okResolver(); return; }
    if ((a === 'ok' || a === 'cancel') && skipResolver) skipResolver();
  };
  B.relayout = function () { if (B.ctx) { Render.battle.layout(); refresh(); } };
  return B;
})();
