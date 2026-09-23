'use strict';
// =============================================================
// 戦闘ロジック（描画に依存しない純粋な計算部）
//  行動を実行すると「イベント列」を返し、演出側（Battle）がそれを順に見せる。
//  バランス検証用に Node.js からも読み込める。
// =============================================================
const BattleCore = (() => {
  const U = (typeof Util !== 'undefined') ? Util : require('./core.js').Util;
  const D = (typeof DATA !== 'undefined') ? DATA : require('./data.js');
  const P = (typeof Party !== 'undefined') ? Party : require('./core.js').Party;
  const TT = (typeof T !== 'undefined') ? T : require('./text.js').T;
  const TX = (typeof TEXT !== 'undefined') ? TEXT : require('./text.js').TEXT;

  const BUFF_MULT = { '-2': 0.55, '-1': 0.75, '0': 1, '1': 1.3, '2': 1.6 };
  const POS_WEIGHT = [4, 3, 2.2, 1.6];

  function makeParty(chars) {
    return chars.map((c, i) => ({ side: 'party', ref: c, name: c.name, pos: i, buffs: {}, buffTurns: {}, guard: false, cover: null, wall: false, charge: false, statusTurns: {} }));
  }
  function makeEnemies(ids) {
    const counts = {};
    ids.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    const seen = {};
    return ids.map((id, i) => {
      const def = D.ENEMIES[id];
      seen[id] = (seen[id] || 0) + 1;
      const suffix = counts[id] > 1 ? 'ABCDEFG'[seen[id] - 1] : '';
      const e = { side: 'enemy', def, id, name: def.name + suffix, hp: def.hp, maxhp: def.hp, pos: i, buffs: {}, buffTurns: {}, status: {}, statusTurns: {}, guard: false, charge: false, acts: def.acts || 1 };
      if (def.prism) e.prism = { idx: 0, cracks: 0, broken: 0 };
      return e;
    });
  }

  // ---------- 参照 ----------
  const hp = (b) => (b.side === 'party' ? b.ref.hp : b.hp);
  const setHp = (b, v) => { if (b.side === 'party') b.ref.hp = v; else b.hp = v; };
  const maxHp = (b) => (b.side === 'party' ? P.stats(b.ref).hp : b.maxhp);
  const alive = (b) => hp(b) > 0 && !b.fled;
  const status = (b) => (b.side === 'party' ? b.ref.status : b.status);
  function stat(b, k) {
    let v = b.side === 'party' ? P.stats(b.ref)[k] : b.def[k];
    if (k === 'atk' || k === 'def') v *= BUFF_MULT[String(b.buffs[k] || 0)];
    return Math.max(0, v);
  }
  function canAct(b) {
    if (!alive(b)) return false;
    const s = status(b);
    return !s.sleep && !s.paralyze;
  }
  function elemMult(target, elem) {
    if (!elem || elem === 'none') return { m: 1, tag: null };
    if (target.side === 'enemy') {
      const d = target.def;
      if (d.absorb.includes(elem)) return { m: -1, tag: 'absorb' };
      if (d.immune.includes(elem)) return { m: 0, tag: 'immune' };
      if (d.weak.includes(elem)) return { m: 1.5, tag: 'weak' };
      if (d.resist.includes(elem)) return { m: 0.5, tag: 'resist' };
      return { m: 1, tag: null };
    }
    const r = P.resists(target.ref);
    if (r.resist.has(elem)) return { m: 0.6, tag: 'resist' };
    return { m: 1, tag: null };
  }

  // ---------- 状態異常 ----------
  function statusChance(target, st, rate) {
    if (target.side === 'enemy') {
      const r = (target.def.statusResist && target.def.statusResist[st]) || 0;
      return rate * (1 - r);
    }
    const im = P.resists(target.ref).immune;
    if (im.has(st)) return 0;
    return rate * (1 - Math.min(0.5, P.stats(target.ref).luk / 400));
  }
  function inflict(target, st, rate, ev) {
    if (!alive(target)) return false;
    const s = status(target);
    const label = TX.status[st];
    if (s[st]) { ev.push({ t: 'msg', text: TT('battle.statusAlready', { target: target.name, status: label }) }); return false; }
    if (!U.chance(statusChance(target, st, rate))) { ev.push({ t: 'msg', text: TT('battle.statusResist', { target: target.name }) }); return false; }
    s[st] = true;
    target.statusTurns[st] = st === 'sleep' ? U.randInt(2, 4) : st === 'paralyze' ? U.randInt(2, 3) : st === 'seal' ? U.randInt(3, 5) : 0;
    ev.push({ t: 'status', target, st, on: true, text: TT('battle.statusOn', { target: target.name, status: label }) });
    return true;
  }
  function cure(target, list, ev) {
    const s = status(target);
    let any = false;
    for (const st of list) if (s[st]) { delete s[st]; delete target.statusTurns[st]; any = true; ev.push({ t: 'status', target, st, on: false, text: TT('battle.statusOff', { target: target.name, status: TX.status[st] }) }); }
    return any;
  }

  // ---------- ダメージ ----------
  function applyDamage(target, n, ev, info) {
    if (target.prism) n = prismFilter(target, info.elem, n, ev);
    n = Math.max(0, Math.round(n));
    if (info.absorb) {
      const mx = maxHp(target);
      const h = Math.min(n, mx - hp(target));
      setHp(target, hp(target) + h);
      ev.push({ t: 'msg', text: TT('battle.absorb', { target: target.name }) });
      ev.push({ t: 'heal', target, n: h, text: TT('battle.heal', { target: target.name, n: h }) });
      return 0;
    }
    if (n <= 0) { ev.push({ t: 'nodmg', target, text: TT('battle.noDamage', { target: target.name }) }); return 0; }
    const nh = Math.max(0, hp(target) - n);
    setHp(target, nh);
    const key = target.side === 'party' ? 'battle.damageTaken' : 'battle.damage';
    ev.push({ t: 'dmg', target, n, crit: info.crit, weak: info.tag === 'weak', elem: info.elem, text: TT(key, { target: target.name, n }) });
    // 眠りは攻撃で覚めることがある
    const s = status(target);
    if (nh > 0 && s.sleep && U.chance(0.5)) { delete s.sleep; delete target.statusTurns.sleep; ev.push({ t: 'status', target, st: 'sleep', on: false, text: TT('battle.wakeUp', { target: target.name }) }); }
    if (nh <= 0) killed(target, ev);
    return n;
  }
  function killed(target, ev) {
    if (target.side === 'party') {
      target.ref.status = {};
      target.statusTurns = {}; target.buffs = {}; target.charge = false;
      ev.push({ t: 'down', target, text: TT('battle.allyDown', { target: target.name }) });
    } else {
      ev.push({ t: 'kill', target, text: TT('battle.defeated', { target: target.name }) });
    }
  }
  function prismFilter(target, elem, n, ev) {
    const pr = target.prism, cfg = target.def.prism;
    const weak = cfg.cycle[pr.idx];
    if (pr.broken > 0) return n * 1.3;
    if (elem === weak) {
      pr.cracks++;
      if (pr.cracks >= cfg.crackNeed) {
        pr.cracks = 0; pr.broken = cfg.breakTurns + 1;
        ev.push({ t: 'prism', target, text: TX.battle.prismBreak, broken: true });
        return n * 1.3;
      }
      ev.push({ t: 'prism', target, text: TT('battle.prismCrack', { n: cfg.crackNeed - pr.cracks }) });
      return n;
    }
    ev.push({ t: 'prism', target, text: TX.battle.prismBarrier });
    return n * 0.08;
  }
  function physical(att, tgt, mult, opt, ev) {
    opt = opt || {};
    const aAtk = stat(att, 'atk') * (att.charge ? 2.2 : 1);
    const hitRate = (opt.hit || 1) * (1 - U.clamp(0.03 + (stat(tgt, 'agi') - stat(att, 'agi')) / 500, 0, 0.12));
    if (!status(tgt).sleep && !status(tgt).paralyze && !U.chance(hitRate)) {
      ev.push({ t: 'miss', target: tgt, text: TT('battle.miss', { target: tgt.name }) });
      return 0;
    }
    let base = aAtk / 2 - stat(tgt, 'def') / 4;
    base = Math.max(base, aAtk / 14 * U.rand(0.6, 1));
    let dmg = base * U.rand(0.88, 1.12) * mult;
    let crit = false;
    const critRate = att.side === 'party'
      ? 1 / 32 + P.stats(att.ref).luk / 1400 + D.CLASSES[att.ref.cls].crit + (opt.critBonus || 0)
      : (att.def.boss ? 0 : 1 / 64);
    if (U.chance(critRate) && !(tgt.def && tgt.def.metal && att.side === 'enemy')) {
      crit = true;
      dmg = Math.max(dmg * 1.6, aAtk * 0.62 * mult) * U.rand(0.95, 1.05);
      ev.push({ t: 'crit', side: att.side, text: att.side === 'party' ? TX.battle.crit : TX.battle.critEnemy });
    }
    if (tgt.def && tgt.def.metal) dmg = crit ? U.randInt(2, 4) : U.chance(0.55) ? 1 : 0;
    const el = opt.elem || 'none';
    const em = elemMult(tgt, el);
    if (em.tag === 'weak') ev.push({ t: 'msg', text: TX.battle.weak });
    if (em.tag === 'resist' && tgt.side === 'enemy') ev.push({ t: 'msg', text: TX.battle.resist });
    if (em.tag === 'immune') { ev.push({ t: 'msg', text: TT('battle.immune', { target: tgt.name }) }); return 0; }
    if (em.m > 0) dmg *= em.m;
    if (tgt.guard) dmg *= 0.5;
    if (tgt.wallShield) dmg *= 0.5;
    if (att.charge && !opt.keepCharge) att.charge = false;
    return applyDamage(tgt, dmg, ev, { crit, tag: em.tag, elem: el, absorb: em.m < 0 });
  }
  function magical(att, tgt, sk, ev, powOverride) {
    const pow = powOverride !== undefined ? powOverride : sk.pow + stat(att, 'int') * (sk.scale || 1);
    let dmg = pow * U.rand(0.9, 1.1);
    const em = elemMult(tgt, sk.elem);
    if (tgt.def && tgt.def.metal) dmg = U.chance(0.3) ? 1 : 0;
    if (em.tag === 'weak') ev.push({ t: 'msg', text: TX.battle.weak });
    if (em.tag === 'resist' && tgt.side === 'enemy') ev.push({ t: 'msg', text: TX.battle.resist });
    if (em.tag === 'immune') { ev.push({ t: 'msg', text: TT('battle.immune', { target: tgt.name }) }); return 0; }
    if (em.m > 0) dmg *= em.m;
    if (tgt.guard) dmg *= 0.7;
    return applyDamage(tgt, dmg, ev, { crit: false, tag: em.tag, elem: sk.elem, absorb: em.m < 0 });
  }
  function heal(tgt, n, ev) {
    if (!alive(tgt)) return 0;
    const mx = maxHp(tgt);
    const h = Math.max(0, Math.min(mx - hp(tgt), Math.round(n)));
    setHp(tgt, hp(tgt) + h);
    ev.push({ t: 'heal', target: tgt, n: h, text: TT('battle.heal', { target: tgt.name, n: h }) });
    return h;
  }
  function buff(tgt, k, d, ev) {
    const cur = tgt.buffs[k] || 0;
    const nv = U.clamp(cur + d, -2, 2);
    const label = TX.stat[k];
    if (nv === cur) { ev.push({ t: 'msg', text: TT('battle.statusResist', { target: tgt.name }) }); return; }
    tgt.buffs[k] = nv; tgt.buffTurns[k] = 5;
    ev.push({ t: 'buff', target: tgt, k, up: d > 0, text: TT(d > 0 ? 'battle.buff' : 'battle.debuff', { target: tgt.name, stat: label }) });
  }

  // ---------- 対象 ----------
  function aliveOf(list) { return list.filter(alive); }
  function pickPartyTarget(ctx) {
    const cands = ctx.party.filter(alive);
    if (!cands.length) return null;
    const w = cands.map((b) => POS_WEIGHT[b.pos] || 1);
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }
  /** かばう: 単体攻撃の対象を騎士に差し替え */
  function coverRedirect(ctx, tgt, ev) {
    if (tgt.side !== 'party') return tgt;
    const wall = ctx.party.find((b) => b.wall && alive(b) && b !== tgt);
    if (wall) { ev.push({ t: 'msg', text: TT('battle.covered', { name: wall.name, target: tgt.name }) }); return wall; }
    const cov = ctx.party.find((b) => b.cover === tgt && alive(b) && canAct(b));
    if (cov) { ev.push({ t: 'msg', text: TT('battle.covered', { name: cov.name, target: tgt.name }) }); return cov; }
    return tgt;
  }
  function resolveTargets(ctx, actor, targetType, chosen) {
    const foes = actor.side === 'party' ? ctx.enemies : ctx.party;
    const friends = actor.side === 'party' ? ctx.party : ctx.enemies;
    switch (targetType) {
      case 'enemy': {
        if (actor.side === 'enemy') return [pickPartyTarget(ctx)].filter(Boolean);
        if (chosen && alive(chosen)) return [chosen];
        const a = aliveOf(foes); return a.length ? [a[0]] : [];
      }
      case 'enemies': return aliveOf(foes);
      case 'random': return aliveOf(foes);
      case 'ally': {
        if (actor.side === 'enemy') {
          const hurt = aliveOf(friends).sort((a, b) => hp(a) / maxHp(a) - hp(b) / maxHp(b));
          return hurt.slice(0, 1);
        }
        if (chosen && alive(chosen)) return [chosen];
        return [];
      }
      case 'allies': return aliveOf(friends);
      case 'self': return [actor];
      case 'deadAlly': return chosen && !alive(chosen) ? [chosen] : [];
      default: return [];
    }
  }

  // ---------- 行動 ----------
  /**
   * cmd: { kind: 'attack'|'skill'|'item'|'guard'|'run'|'cover', skill, item, target }
   * 戻り値: イベント配列
   */
  function act(ctx, actor, cmd) {
    const ev = [];
    if (!alive(actor)) return ev;
    const s = status(actor);
    if (s.sleep) { ev.push({ t: 'msg', text: TT('battle.asleep', { name: actor.name }), actor }); return ev; }
    if (s.paralyze) { ev.push({ t: 'msg', text: TT('battle.paralyzed', { name: actor.name }), actor }); return ev; }
    ev.push({ t: 'actor', actor });
    switch (cmd.kind) {
      case 'attack': {
        let tgts = resolveTargets(ctx, actor, 'enemy', cmd.target);
        if (!tgts.length) break;
        ev.push({ t: 'msg', text: TT('battle.attack', { name: actor.name }) });
        let tgt = actor.side === 'enemy' ? coverRedirect(ctx, tgts[0], ev) : tgts[0];
        const elem = actor.side === 'party' ? P.weaponElem(actor.ref) : 'none';
        ev.push({ t: 'fx', target: tgt, kind: 'slash', elem });
        physical(actor, tgt, 1, { elem }, ev);
        if (actor.side === 'party' && alive(tgt) && actor.ref.equip.weapon && D.ITEMS[actor.ref.equip.weapon].onHit === 'poison') {
          if (U.chance(0.25)) inflict(tgt, 'poison', 1, ev);
        }
        break;
      }
      case 'guard':
        actor.guard = true;
        ev.push({ t: 'msg', text: TT('battle.guard', { name: actor.name }) });
        break;
      case 'skill': {
        const sk = D.SKILLS[cmd.skill];
        const cost = sk.mp || 0;
        const mpNow = actor.side === 'party' ? actor.ref.mp : Infinity;
        ev.push({ t: 'msg', text: TT(sk.kind === 'magic' ? 'battle.useSkill' : 'battle.useTech', { name: actor.name, skill: sk.name }) });
        if (sk.kind === 'magic' && s.seal) { ev.push({ t: 'msg', text: TX.battle.sealed }); break; }
        if (mpNow < cost) { ev.push({ t: 'msg', text: TX.battle.noMp }); break; }
        if (actor.side === 'party') actor.ref.mp -= cost;
        ev.push({ t: 'mp', actor });
        useSkill(ctx, actor, sk, cmd.target, ev);
        break;
      }
      case 'item': {
        const it = D.ITEMS[cmd.item];
        if (!ctx.inv || !ctx.inv.remove(cmd.item)) { ev.push({ t: 'msg', text: TT('battle.useItem', { name: actor.name, item: it.name }) }); ev.push({ t: 'msg', text: TX.battle.itemGone }); break; }
        ev.push({ t: 'msg', text: TT('battle.useItem', { name: actor.name, item: it.name }) });
        useItem(ctx, actor, it, cmd.target, ev);
        break;
      }
      case 'flee':
        actor.fled = true;
        ev.push({ t: 'flee', target: actor, text: TT('battle.fled', { name: actor.name }) });
        break;
      default: break;
    }
    return ev;
  }

  function useSkill(ctx, actor, sk, chosen, ev) {
    const tgts = resolveTargets(ctx, actor, sk.target, chosen);
    switch (sk.effect) {
      case 'dmg': {
        const hits = sk.hits || 1;
        const random = sk.target === 'random';
        for (let h = 0; h < hits; h++) {
          const pool = random ? aliveOf(actor.side === 'party' ? ctx.enemies : ctx.party) : tgts.filter(alive);
          const list = random ? (pool.length ? [U.pick(pool)] : []) : pool;
          for (let t of list) {
            if (sk.target === 'enemy' && actor.side === 'enemy') t = coverRedirect(ctx, t, ev);
            ev.push({ t: 'fx', target: t, kind: sk.kind === 'tech' ? 'slash' : 'burst', elem: sk.elem || 'none' });
            if (sk.instakill && t.side === 'enemy' && !t.def.boss && U.chance(sk.instakill)) {
              setHp(t, 0); ev.push({ t: 'msg', text: TX.battle.instakill }); killed(t, ev); continue;
            }
            let dealt;
            if (sk.kind === 'tech') dealt = physical(actor, t, sk.mult || 1, { elem: sk.elem, hit: sk.hit, critBonus: sk.critBonus, keepCharge: h < hits - 1 }, ev);
            else dealt = magical(actor, t, sk, ev);
            if (sk.drain && dealt > 0) heal(actor, dealt * sk.drain, ev);
            if (sk.recoil && dealt > 0) { const r = Math.max(1, Math.round(dealt * sk.recoil)); applyDamage(actor, Math.min(r, hp(actor) - 1), ev, {}); }
            if (sk.debuff && alive(t)) buff(t, sk.debuff, -1, ev);
            if (sk.addStatus && alive(t)) inflict(t, sk.addStatus, sk.rate || 0.5, ev);
          }
        }
        if (actor.charge) actor.charge = false;
        break;
      }
      case 'heal': {
        if (!tgts.length) { ev.push({ t: 'msg', text: TX.menu.noEffect }); break; }
        ev.push({ t: 'fx', target: null, kind: 'heal', elem: 'heal', party: actor.side === 'party' });
        for (const t of tgts) heal(t, (sk.pow + stat(actor, 'int') * (sk.scale || 0.5)) * U.rand(0.9, 1.1), ev);
        break;
      }
      case 'revive': {
        const t = tgts[0];
        if (!t) { ev.push({ t: 'msg', text: TX.menu.noEffect }); break; }
        setHp(t, Math.max(1, Math.floor(maxHp(t) * sk.ratio)));
        ev.push({ t: 'revive', target: t, text: TT('battle.revive', { target: t.name }) });
        break;
      }
      case 'cure':
        for (const t of tgts) if (!cure(t, sk.cures, ev)) ev.push({ t: 'msg', text: TX.menu.noEffect });
        break;
      case 'buff':
        for (const t of tgts) buff(t, sk.stat, 1, ev);
        break;
      case 'debuff':
        for (const t of tgts) buff(t, sk.stat, -1, ev);
        break;
      case 'status':
        for (const t of tgts) inflict(t, sk.status, sk.rate || 0.5, ev);
        break;
      case 'cover': {
        const t = tgts[0];
        if (!t || t === actor) { ev.push({ t: 'msg', text: TX.menu.noEffect }); break; }
        actor.cover = t;
        ev.push({ t: 'msg', text: TT('battle.cover', { name: actor.name, target: t.name }) });
        break;
      }
      case 'wall':
        actor.wall = true; actor.wallShield = true;
        ev.push({ t: 'msg', text: TT('battle.wall', { name: actor.name }) });
        break;
      case 'charge':
        actor.charge = true;
        ev.push({ t: 'msg', text: TT('battle.charge', { name: actor.name }) });
        break;
      case 'selfheal':
        heal(actor, maxHp(actor) * sk.ratio, ev);
        cure(actor, ['poison', 'seal'], ev);
        break;
      case 'steal': {
        const t = tgts[0];
        const pool = t && !t.def.boss ? (t.def.steal || t.def.drop) : null;
        if (t && !t.stolen && pool && U.chance(0.45 + P.stats(actor.ref).luk / 500)) {
          t.stolen = true;
          const got = ctx.inv ? ctx.inv.add(pool[0], 1) : 1;
          ev.push({ t: 'msg', text: got ? TT('battle.steal', { name: actor.name, item: D.ITEMS[pool[0]].name }) : TX.battle.stealFail });
        } else ev.push({ t: 'msg', text: TX.battle.stealFail });
        break;
      }
      case 'dispel':
        for (const t of tgts) { t.buffs = {}; t.buffTurns = {}; t.charge = false; }
        ev.push({ t: 'msg', text: TX.battle.dispel });
        break;
      case 'flee':
        actor.fled = true;
        ev.push({ t: 'flee', target: actor, text: TT('battle.fled', { name: actor.name }) });
        break;
      default: break;
    }
  }

  function useItem(ctx, actor, it, chosen, ev) {
    const tg = it.target === 'enemy' ? resolveTargets(ctx, actor, 'enemy', chosen) : it.target === 'deadAlly' ? resolveTargets(ctx, actor, 'deadAlly', chosen) : resolveTargets(ctx, actor, 'ally', chosen);
    const t = tg[0];
    switch (it.effect) {
      case 'heal': if (t) { ev.push({ t: 'fx', target: null, kind: 'heal', elem: 'heal', party: true }); heal(t, it.pow * U.rand(0.95, 1.05), ev); } else ev.push({ t: 'msg', text: TX.menu.noEffect }); break;
      case 'mp': if (t) { const mx = P.stats(t.ref).mp; const n = Math.min(mx - t.ref.mp, it.pow); t.ref.mp += n; ev.push({ t: 'mpheal', target: t, n, text: TT('battle.healMp', { target: t.name, n }) }); } break;
      case 'full': if (t) { const st = P.stats(t.ref); heal(t, st.hp, ev); t.ref.mp = st.mp; ev.push({ t: 'mpheal', target: t, n: 0, text: TT('battle.healMp', { target: t.name, n: TX.battle.allMp }) }); } break;
      case 'cure': if (t && !cure(t, it.cures, ev)) ev.push({ t: 'msg', text: TX.menu.noEffect }); break;
      case 'revive':
        if (t) { setHp(t, Math.max(1, Math.floor(maxHp(t) * it.ratio))); ev.push({ t: 'revive', target: t, text: TT('battle.revive', { target: t.name }) }); }
        else ev.push({ t: 'msg', text: TX.menu.noEffect });
        break;
      case 'dmg':
        if (t) { ev.push({ t: 'fx', target: t, kind: 'burst', elem: it.elem }); magical(actor, t, { elem: it.elem }, ev, it.pow); }
        break;
      case 'escape':
        if (ctx.canRun) { ctx.escaped = true; ev.push({ t: 'escape', text: TX.battle.runOk }); }
        else ev.push({ t: 'msg', text: TX.battle.runBoss });
        break;
      default: ev.push({ t: 'msg', text: TX.menu.noEffect });
    }
  }

  // ---------- 敵の思考 ----------
  function enemyChoose(ctx, e) {
    const opts = e.def.ai.filter((a) => {
      if (a.ifAllyHurt) return ctx.enemies.some((q) => alive(q) && q.hp < q.maxhp * 0.5);
      if (a.ifSelfHurt) return e.hp < e.maxhp * 0.45;
      return true;
    });
    const a = U.weighted(opts.length ? opts : [{ act: 'attack', w: 1 }], 'w');
    if (a.act === 'attack') return { kind: 'attack' };
    const sk = D.SKILLS[a.act];
    if (sk.effect === 'flee') return { kind: 'flee' };
    if (sk.effect === 'charge' && e.charge) return { kind: 'attack' };
    return { kind: 'skill', skill: a.act };
  }

  // ---------- ターン ----------
  function priorityOf(b, cmd) {
    if (!cmd) return 0;
    if (cmd.kind === 'guard') return 3;
    if (cmd.kind === 'skill') { const sk = D.SKILLS[cmd.skill]; return sk.priority || 0; }
    return 0;
  }
  /** 行動順を決める（素早さ×乱数＋優先度） */
  function turnOrder(ctx, partyCmds) {
    const list = [];
    ctx.party.forEach((b, i) => { if (alive(b)) list.push({ b, cmd: partyCmds[i] || null, sp: stat(b, 'agi') * U.rand(0.75, 1.1) + priorityOf(b, partyCmds[i]) * 1000 }); });
    ctx.enemies.forEach((e) => {
      if (!alive(e)) return;
      let acts = e.acts;
      if (e.def.rage && e.hp < e.maxhp * e.def.rage.below) acts = e.def.rage.acts;
      for (let k = 0; k < acts; k++) list.push({ b: e, cmd: null, sp: stat(e, 'agi') * U.rand(0.75, 1.1) * (k === 0 ? 1 : 0.55 - k * 0.1) });
    });
    list.sort((a, b) => b.sp - a.sp);
    return list;
  }
  function beginTurn(ctx) {
    for (const b of ctx.party.concat(ctx.enemies)) { b.guard = false; b.cover = null; b.wall = false; b.wallShield = false; }
  }
  /** ターン終了処理: 毒・状態の自然回復・強化の終了・プリズマのコア変化 */
  function endTurn(ctx) {
    const ev = [];
    for (const b of ctx.party.concat(ctx.enemies)) {
      if (!alive(b)) continue;
      const s = status(b);
      if (s.poison) {
        const mx = maxHp(b);
        const n = Math.max(1, Math.min(b.side === 'enemy' && b.def.boss ? 120 : 9999, Math.floor(mx / (b.side === 'party' ? 12 : 14))));
        setHp(b, Math.max(0, hp(b) - n));
        ev.push({ t: 'dmg', target: b, n, poison: true, text: TT('battle.poisonTick', { name: b.name, n }) });
        if (hp(b) <= 0) { killed(b, ev); continue; }
      }
      for (const st of ['sleep', 'paralyze', 'seal']) {
        if (!s[st]) continue;
        b.statusTurns[st] = (b.statusTurns[st] || 1) - 1;
        if (b.statusTurns[st] <= 0) {
          delete s[st]; delete b.statusTurns[st];
          ev.push({ t: 'status', target: b, st, on: false, text: st === 'sleep' ? TT('battle.wakeUp', { target: b.name }) : TT('battle.statusOff', { target: b.name, status: TX.status[st] }) });
        }
      }
      for (const k of Object.keys(b.buffTurns)) {
        b.buffTurns[k]--;
        if (b.buffTurns[k] <= 0) { delete b.buffTurns[k]; delete b.buffs[k]; ev.push({ t: 'buff', target: b, k, end: true, text: TT('battle.buffEnd', { target: b.name, stat: TX.stat[k] }) }); }
      }
      if (b.prism) {
        const cfg = b.def.prism;
        if (b.prism.broken > 0) {
          b.prism.broken--;
          if (b.prism.broken === 0) ev.push({ t: 'prism', target: b, text: TX.battle.prismReform });
        }
        b.prism.idx = (b.prism.idx + 1) % cfg.cycle.length;
        b.prism.cracks = 0;
        const el = cfg.cycle[b.prism.idx];
        ev.push({ t: 'prism', target: b, text: TT('battle.prismShift', { color: D.ELEM_COLOR[el][0], elem: TX.elem[el] }) });
      }
    }
    ctx.turn++;
    return ev;
  }
  function checkEnd(ctx) {
    if (ctx.escaped) return 'run';
    if (!ctx.party.some(alive)) return 'lose';
    if (!ctx.enemies.some(alive)) {
      // 形態変化するボス
      const ph = ctx.enemies.find((e) => e.hp <= 0 && e.def.nextPhase && !e.phased);
      if (ph) return 'phase';
      return 'win';
    }
    return null;
  }
  function nextPhase(ctx, e) {
    const def = D.ENEMIES[e.def.nextPhase];
    e.phased = true;
    const ne = makeEnemies([def.id])[0];
    ne.pos = e.pos;
    const i = ctx.enemies.indexOf(e);
    ctx.enemies[i] = ne;
    return ne;
  }
  /** 逃走判定 */
  function tryRun(ctx) {
    if (!ctx.canRun) return false;
    const pa = ctx.party.filter(alive).reduce((s, b) => s + stat(b, 'agi'), 0) / Math.max(1, ctx.party.filter(alive).length);
    const ea = ctx.enemies.filter(alive).reduce((s, b) => s + stat(b, 'agi'), 0) / Math.max(1, ctx.enemies.filter(alive).length);
    const p = U.clamp(0.55 + (pa - ea) / 120 + ctx.runTries * 0.15, 0.25, 0.95);
    ctx.runTries++;
    return U.chance(p);
  }
  function rewards(ctx) {
    let exp = 0, gold = 0; const drops = [];
    for (const e of ctx.enemies) {
      if (e.fled || e.hp > 0) continue;
      exp += e.def.exp; gold += e.def.gold;
      if (e.def.drop && U.chance(e.def.drop[1])) drops.push(e.def.drop[0]);
    }
    return { exp, gold, drops };
  }
  function newCtx(chars, enemyIds, opts) {
    return { party: makeParty(chars), enemies: makeEnemies(enemyIds), turn: 1, canRun: !!(opts && opts.canRun), runTries: 0, escaped: false, inv: opts && opts.inv };
  }

  return {
    newCtx, act, endTurn, beginTurn, turnOrder, enemyChoose, checkEnd, nextPhase, tryRun, rewards,
    alive, canAct, stat, hp, maxHp, status, resolveTargets, elemMult,
  };
})();

if (typeof module !== 'undefined') module.exports = BattleCore;
