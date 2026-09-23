'use strict';
// =============================================================
// メニュー群: タイトル／キャラクター作成／フィールドメニュー／店／宿／ギルド／セーブ・ロード／設定／エンディング
// =============================================================
const Menus = (() => {
  const M = {};
  const SLOT_NAMES = { weapon: TEXT.slot.weapon, armor: TEXT.slot.armor, shield: TEXT.slot.shield, acc: TEXT.slot.acc };
  const STAT_SHOW = ['atk', 'def', 'int', 'agi', 'luk'];

  // ---------- 共通表示 ----------
  function hpLine(c) {
    const st = Party.stats(c);
    return `${TEXT.stat.hp} ${c.hp}/${st.hp}　${TEXT.stat.mp} ${c.mp}/${st.mp}`;
  }
  function statusShort(c) {
    if (c.hp <= 0) return TEXT.status.dead;
    const s = ['poison', 'sleep', 'paralyze', 'seal'].filter((k) => c.status[k]).map((k) => TEXT.status[k]);
    return s.join(TEXT.menu.sep);
  }
  function memberItems(list, extra) {
    return list.map((c) => ({ label: `${c.name}`, right: `${DATA.CLASSES[c.cls].name} ${TEXT.stat.lv}${c.lv}`, value: c, desc: `${hpLine(c)}　${statusShort(c)}`, ...(extra ? extra(c) : {}) }));
  }
  function partyPanel(cls) {
    const p = UI.panel('partypanel ' + (cls || ''));
    const draw = () => {
      p.el.innerHTML = '';
      for (const c of Game.party) {
        const st = Party.stats(c);
        const row = UI.el('div', 'prow' + (c.hp <= 0 ? ' dead' : ''));
        row.innerHTML = `<div class="pn"><b></b><span class="cl"></span></div><div class="bar hpbar"><i style="width:${(c.hp / st.hp * 100).toFixed(1)}%"></i></div><div class="nums"></div><div class="chips"></div>`;
        row.querySelector('b').textContent = c.name;
        row.querySelector('.cl').textContent = `${DATA.CLASSES[c.cls].name} ${TEXT.stat.lv}${c.lv}`;
        row.querySelector('.nums').textContent = hpLine(c);
        row.querySelector('.chips').textContent = statusShort(c);
        p.el.appendChild(row);
      }
    };
    draw();
    p.draw = draw;
    return p;
  }
  function infoPanel() {
    const p = UI.panel('infopanel');
    const orbs = [1, 2, 3, 4, 5, 6].map((i) => (Game.has('orb' + i) ? `<span class="orb o${i}" title="${DATA.ITEMS['orb' + i].name}">●</span>` : '<span class="orb none">○</span>')).join('');
    p.el.innerHTML = `<div><span class="k">${TEXT.menu.gold}</span> <b>${Game.s.gold}G</b></div><div><span class="k">${TEXT.menu.location}</span> ${Field.map ? Field.map.name : ''}</div>` +
      `<div><span class="k">${TEXT.menu.playTime}</span> ${Util.fmtTime(Game.s.playTime)}</div><div><span class="k">${TEXT.menu.orbs}</span> ${orbs} ${Game.orbs()}/6</div>` +
      `<div class="obj"><span class="k">${TEXT.menu.objective}</span> ${MAPS.objective((i) => Game.has(i), (f) => Game.flag(f), Game.orbs())}</div>`;
    return p;
  }

  // =========================================================
  // タイトル
  // =========================================================
  M.title = async function () {
    UI.closeAll();
    const scr = document.getElementById('title');
    scr.classList.add('show');
    Sound.bgm('title');
    for (;;) {
      const any = [1, 2, 3].some((n) => SaveSys.peek(n));
      const r = await UI.list({
        cls: 'titlemenu', cancel: false, desc: false,
        items: [
          { label: TEXT.title.newGame, value: 'new' },
          { label: TEXT.title.load, value: 'load', disabled: !any, whyDisabled: TEXT.save.noData },
          { label: TEXT.title.settings, value: 'settings' },
          { label: TEXT.title.howto, value: 'howto' },
        ],
      });
      if (!r) continue;
      if (r.value === 'new') { scr.classList.remove('show'); App.fsm.change('create'); return; }
      if (r.value === 'load') { const ok = await M.loadMenu(); if (ok) { scr.classList.remove('show'); return; } }
      if (r.value === 'settings') await M.settings();
      if (r.value === 'howto') { for (const line of TEXT.howto) await UI.message(line, { cls: 'howto' }); }
    }
  };

  /** セーブスロット一覧（ロード・セーブ共通） */
  function slotItems() {
    return [1, 2, 3].map((n) => {
      const p = SaveSys.peek(n);
      let right = TEXT.save.empty;
      if (p && p.ok) right = T('save.summaryOrbs', { name: p.name, lv: p.lv, map: MAPS.MAPS[p.map] ? MAPS.MAPS[p.map].name : '', time: Util.fmtTime(p.time), orbs: p.orbs });
      else if (p && p.broken) right = TEXT.save.broken;
      return { label: T('save.slot', { n }), right, value: n, peek: p };
    });
  }
  M.loadMenu = async function () {
    for (;;) {
      const r = await UI.list({ title: TEXT.title.load, items: slotItems(), cls: 'mid saves' });
      if (!r) return false;
      const p = r.item.peek;
      if (!p) { await UI.message(TEXT.save.loadEmpty); continue; }
      if (p.broken) {
        const del = await UI.ask(TEXT.save.loadFailed, [TEXT.save.delete, TEXT.menu.back]);
        if (del === 0 && await UI.confirm(T('save.deleteConfirm', { n: r.value }))) SaveSys.remove(r.value);
        continue;
      }
      let st;
      try { st = SaveSys.load(r.value); } catch (e) { await UI.message(TEXT.save.loadFailed); continue; }
      Game.s = st;
      UI.closeAll();
      App.startField(st.map, st.x, st.y, st.dir);
      UI.toast(TEXT.save.loaded);
      return true;
    }
  };

  // =========================================================
  // キャラクター作成
  // =========================================================
  async function pickClass(title, start) {
    const panel = UI.panel('classpreview');
    const show = (id) => {
      const cl = DATA.CLASSES[id];
      const c = Party.newChar('', id, 1);
      const st = Party.stats(c);
      const eq = Object.values(c.equip).filter(Boolean).map((i) => DATA.ITEMS[i].name).join(TEXT.menu.sep);
      panel.el.innerHTML = `<div class="wtitle">${cl.name}　${TEXT.create.preview}</div><div class="cdesc"></div>` +
        `<div class="cstats">${DATA.STAT_KEYS.map((k) => `<span><i>${TEXT.stat[k === 'hp' ? 'maxhp' : k === 'mp' ? 'maxmp' : k]}</i>${st[k]}</span>`).join('')}</div>` +
        `<div class="ceq">${T('create.startEquip', { items: eq })}</div><div class="csk">${T('create.learnList', { list: cl.skills.slice(0, 4).map(([lv, s]) => `Lv${lv} ${DATA.SKILLS[s].name}`).join('／') })}</div>`;
      panel.el.querySelector('.cdesc').textContent = cl.desc;
      const img = UI.el('img', 'cimg'); img.alt = ''; img.src = App.imgSrc(cl.sprite);
      panel.el.prepend(img);
    };
    const r = await UI.list({
      title, cls: 'classlist', start: start || 0, desc: false,
      items: DATA.CLASS_ORDER.map((id) => ({ label: DATA.CLASSES[id].name, value: id })),
      onMove: (it) => it && show(it.value),
    });
    panel.close();
    return r ? r.value : null;
  }
  async function createMember(title, isHero, defaultCls) {
    for (;;) {
      const name = await UI.nameInput({ title: T('create.nameStep', { who: title }), fallback: Util.pick(DATA.NAME_POOL), cancel: !isHero });
      if (name === null) return null;
      const cls = await pickClass(T('create.classStep', { name }), DATA.CLASS_ORDER.indexOf(defaultCls || 'warrior'));
      if (!cls) continue;
      if (await UI.confirm(T('create.confirm', { name, cls: DATA.CLASSES[cls].name }))) return { name, cls };
    }
  }
  M.create = async function () {
    Game.s = Game.newState();
    document.getElementById('title').classList.add('show', 'creating');
    await UI.message(TEXT.create.heroTitle);
    const hero = await createMember(TEXT.create.heroLabel, true, 'warrior');
    const hc = Party.newChar(hero.name, hero.cls, 1, true);
    Game.s.roster.push(hc); Game.s.party.push(hc.id);
    const mode = await UI.ask(TEXT.create.partyIntro, [TEXT.create.modeSelf, TEXT.create.modeAuto, TEXT.create.modeSolo], { cancel: false });
    if (mode !== 2) {
      const rec = ['warrior', 'knight', 'priest', 'mage'].filter((c) => c !== hero.cls).slice(0, 3);
      const used = new Set([hc.name]);
      for (let i = 0; i < 3; i++) {
        let m = null;
        if (mode === 0) {
          const pick = await UI.ask(T('create.memberTitle', { n: i + 1 }), [TEXT.create.modeSelf, TEXT.create.skipRest], { cancel: false });
          if (pick === 0) m = await createMember(T('create.memberLabel', { n: i + 1 }), false, rec[i]);
          else { for (let k = i; k < 3; k++) addAuto(rec[k], used); break; }
        }
        if (!m) { if (mode === 1) addAuto(rec[i], used); continue; }
        const c = Party.newChar(m.name, m.cls, 1);
        used.add(m.name);
        Game.s.roster.push(c); Game.s.party.push(c.id);
      }
    }
    document.getElementById('title').classList.remove('show', 'creating');
    App.startField('lanta', 6, 6, 'up');
    await Util.wait(300);
    // オープニング: 長老の語り
    const elder = MAPS.MAPS.lanta.entities.find((e) => e.name === MAPS.STORY.elderName);
    await Field.runEvent(async () => {
      await UI.message(MAPS.STORY.opening);
      await Field.script(elder.script, elder);
      await UI.message(TEXT.menu.menuHint);
    });
  };
  function addAuto(cls, used) {
    let name = Util.pick(DATA.NAME_POOL.filter((n) => !used.has(n)));
    used.add(name);
    const c = Party.newChar(name, cls, 1);
    Game.s.roster.push(c); Game.s.party.push(c.id);
  }

  // =========================================================
  // フィールドメニュー
  // =========================================================
  M.fieldMenu = async function () {
    const pp = partyPanel('menuside');
    let info = infoPanel();
    const h = UI.listWin({
      cls: 'mainmenu', desc: false, menuCancels: true,
      items: [
        { label: TEXT.menu.status, value: 'status' }, { label: TEXT.menu.item, value: 'item' }, { label: TEXT.menu.equip, value: 'equip' },
        { label: TEXT.menu.skill, value: 'skill' }, { label: TEXT.menu.order, value: 'order' }, { label: TEXT.menu.save, value: 'save' },
        { label: TEXT.menu.settings, value: 'settings' }, { label: TEXT.menu.close, value: 'close' },
      ],
    });
    for (;;) {
      const r = await h.choose();
      if (!r || r.value === 'close') break;
      h.win.active = false;
      try {
        if (r.value === 'status') await M.statusScreen();
        if (r.value === 'item') { const done = await M.itemMenu(); if (done === 'warped') break; }
        if (r.value === 'equip') await M.equipMenu();
        if (r.value === 'skill') { const done = await M.skillMenu(); if (done === 'warped') break; }
        if (r.value === 'order') await M.orderMenu();
        if (r.value === 'save') await M.saveMenu();
        if (r.value === 'settings') await M.settings();
      } finally {
        h.win.active = true;
      }
      pp.draw(); info.close(); info = infoPanel();
      Field.refreshParty();
      h.win.focus();
    }
    h.close(); pp.close(); info.close();
  };

  M.statusScreen = async function () {
    const r = await UI.list({ title: TEXT.menu.status, items: memberItems(Game.s.roster.filter((c) => Game.s.party.includes(c.id)).concat(Game.reserve)), cls: 'sub' });
    if (!r) return;
    const all = Game.party.concat(Game.reserve);
    let idx = all.indexOf(r.value);
    const panel = UI.panel('statuswin');
    const draw = () => {
      const c = all[idx], st = Party.stats(c), base = Party.baseStats(c);
      const eq = Object.entries(c.equip).map(([k, v]) => `<div><i>${SLOT_NAMES[k]}</i>${v ? DATA.ITEMS[v].name : TEXT.menu.slotEmpty}</div>`).join('');
      const sk = Party.skills(c).map((s) => `<span>${DATA.SKILLS[s].name}</span>`).join('') || '<span>―</span>';
      const next = DATA.CLASSES[c.cls].skills.find(([lv]) => lv > c.lv);
      panel.el.innerHTML = `<div class="wtitle"><img alt="" src="${App.imgSrc(DATA.CLASSES[c.cls].sprite)}"><b class="nm"></b> ${DATA.CLASSES[c.cls].name} ${TEXT.stat.lv}${c.lv}${Game.s.party.includes(c.id) ? '' : TEXT.menu.reserveTag}</div>` +
        `<div class="sgrid"><div>${TEXT.stat.hp}</div><div>${c.hp} / ${st.hp}</div><div>${TEXT.stat.mp}</div><div>${c.mp} / ${st.mp}</div>` +
        STAT_SHOW.map((k) => `<div>${TEXT.stat[k]}</div><div>${st[k]}${st[k] !== base[k] ? ` <small>${T('menu.baseStat', { n: base[k] })}</small>` : ''}</div>`).join('') +
        `<div>${TEXT.stat.exp}</div><div>${c.exp}</div><div>${TEXT.stat.next}</div><div>${Party.expToNext(c)}</div><div>${TEXT.menu.statusLabel}</div><div>${statusShort(c) || TEXT.status.ok}</div></div>` +
        `<div class="seq">${eq}</div><div class="ssk"><i>${TEXT.menu.skillsLabel}</i>${sk}</div>` +
        `<div class="desc">${next ? T('menu.nextSkill', { lv: next[0], skill: DATA.SKILLS[next[1]].name }) : TEXT.menu.allSkills}</div>`;
      panel.el.querySelector('.nm').textContent = c.name;
    };
    draw();
    await new Promise((res) => {
      const w = { el: UI.el('div', 'hiddenwin'), interactive: true };
      w.onAction = (a) => {
        if (a === 'left' || a === 'up') { idx = (idx - 1 + all.length) % all.length; Sound.sfx('cursor'); draw(); }
        else if (a === 'right' || a === 'down') { idx = (idx + 1) % all.length; Sound.sfx('cursor'); draw(); }
        else if (a === 'ok' || a === 'cancel' || a === 'menu') { Sound.sfx('cancel'); UI._stackRemove(w); res(); }
      };
      panel.el.addEventListener('click', () => w.onAction('cancel'), { once: true });
      UI._stackPush(w);
    });
    panel.close();
  };

  // ---------- どうぐ ----------
  function invList(kind) {
    return Object.keys(Game.s.inv).filter((id) => {
      const t = DATA.ITEMS[id].type;
      return kind === 'key' ? t === 'key' : t !== 'key';
    }).map((id) => {
      const it = DATA.ITEMS[id];
      return { label: it.name, value: id, right: it.type === 'key' ? '' : '×' + Game.count(id), desc: it.desc || equipDesc(it) };
    });
  }
  function equipDesc(it) {
    if (!['weapon', 'armor', 'shield', 'acc'].includes(it.type)) return '';
    const parts = STAT_SHOW.filter((k) => it[k]).map((k) => `${TEXT.stat[k]}${it[k] > 0 ? '+' : ''}${it[k]}`);
    if (it.elem) parts.push(T('menu.elemAttr', { e: TEXT.elem[it.elem] }));
    if (it.resist) parts.push(T('menu.elemResist', { e: TEXT.elem[it.resist] }));
    if (it.immune) parts.push(T('menu.immuneTag', { s: it.immune.map((s) => TEXT.status[s]).join(TEXT.menu.sep) }));
    const who = DATA.CLASS_ORDER.filter((c) => it.eq.includes(c)).map((c) => DATA.CLASSES[c].name[0]).join('');
    return T('menu.equipSummary', { slot: SLOT_NAMES[it.type], parts: parts.join(' '), who });
  }
  M.itemMenu = async function () {
    const tab = await UI.list({ title: TEXT.menu.item, items: [{ label: TEXT.menu.consumables, value: 'use' }, { label: TEXT.menu.keyItems, value: 'key' }], cls: 'sub' });
    if (!tab) return;
    if (tab.value === 'key') {
      const items = invList('key');
      await UI.list({ title: TEXT.menu.keyItems, items: items.map((i) => Object.assign(i, { disabled: false })), cls: 'sub wide', empty: TEXT.menu.noKeyItems });
      return;
    }
    let start = 0;
    for (;;) {
      const items = invList('use');
      if (!items.length) { await UI.message(TEXT.menu.noItems); return; }
      const r = await UI.list({ title: TEXT.menu.consumables, items, cls: 'sub wide', start: Math.min(start, items.length - 1) });
      if (!r) return;
      start = r.index;
      const it = DATA.ITEMS[r.value];
      const act = await UI.list({ title: it.name, items: [{ label: it.type === 'use' ? TEXT.menu.use : TEXT.menu.equipTo, value: 'use' }, { label: TEXT.menu.discard, value: 'drop' }], cls: 'sub small' });
      if (!act) continue;
      if (act.value === 'drop') {
        if (await UI.confirm(T('menu.discardConfirm', { item: it.name }))) { Game.removeItem(r.value, 1); await UI.message(T('menu.discarded', { item: it.name })); }
        continue;
      }
      if (it.type !== 'use') { await M.equipMenu(); continue; }
      const res = await useItemField(r.value);
      if (res === 'warped') return 'warped';
    }
  };
  async function pickMember(title, filter) {
    const list = Game.party.filter(filter || (() => true));
    if (!list.length) { await UI.message(TEXT.menu.noEffect); return null; }
    const r = await UI.list({ title, items: memberItems(list), cls: 'sub' });
    return r ? r.value : null;
  }
  async function useItemField(id) {
    const it = DATA.ITEMS[id];
    if (it.battleOnly) { await UI.message(TEXT.menu.battleOnlyItem); return; }
    if (it.effect === 'return') {
      if (!Field.canReturn()) { await UI.message(TEXT.field.returnDungeon); return; }
      const ok = await Field.returnTo();
      if (ok) { Game.removeItem(id, 1); return 'warped'; }
      return;
    }
    if (it.effect === 'repel') { Game.removeItem(id, 1); Game.s.repel = 100; Sound.sfx('magic'); await UI.message(TEXT.field.repelOn); return; }
    const target = await pickMember(TEXT.menu.whoUse, it.target === 'deadAlly' ? (c) => c.hp <= 0 : null);
    if (!target) return;
    const msg = applyFieldEffect(it, target, it.pow);
    if (msg === null) { await UI.message(TEXT.menu.noEffect); return; }
    Game.removeItem(id, 1);
    await UI.message(msg);
  }
  /** フィールドでの効果適用（道具・スキル共通）。効果が無ければ null */
  function applyFieldEffect(eff, c, pow) {
    const st = Party.stats(c);
    switch (eff.effect) {
      case 'heal': {
        if (c.hp <= 0 || c.hp >= st.hp) return null;
        const n = Math.min(st.hp - c.hp, Math.round(pow));
        c.hp += n; Sound.sfx('heal');
        return T('battle.heal', { target: c.name, n });
      }
      case 'mp': {
        if (c.hp <= 0 || c.mp >= st.mp) return null;
        const n = Math.min(st.mp - c.mp, pow); c.mp += n; Sound.sfx('heal');
        return T('battle.healMp', { target: c.name, n });
      }
      case 'full': if (c.hp <= 0) return null; c.hp = st.hp; c.mp = st.mp; Sound.sfx('heal'); return T('menu.fullRestore', { name: c.name });
      case 'cure': {
        const had = eff.cures.filter((s) => c.status[s]);
        if (!had.length || c.hp <= 0) return null;
        had.forEach((s) => delete c.status[s]); Sound.sfx('heal');
        return T('battle.statusOff', { target: c.name, status: had.map((s) => TEXT.status[s]).join(TEXT.menu.sep) });
      }
      case 'revive': {
        if (c.hp > 0) return null;
        c.hp = Math.max(1, Math.floor(st.hp * eff.ratio)); c.status = {}; Sound.sfx('heal');
        return T('battle.revive', { target: c.name });
      }
      case 'seed': {
        c.bonus[eff.stat] = Math.min(99, (c.bonus[eff.stat] || 0) + eff.pow);
        Party.clampHpMp(c); Sound.sfx('levelup');
        return T('menu.seedUp', { name: c.name, stat: TEXT.stat[eff.stat === 'hp' ? 'maxhp' : eff.stat], n: eff.pow });
      }
      default: return null;
    }
  }

  // ---------- そうび ----------
  function diffText(c, slot, itemId) {
    const before = Party.stats(c);
    const save = c.equip[slot];
    c.equip[slot] = itemId;
    const after = Party.stats(c);
    c.equip[slot] = save;
    return STAT_SHOW.map((k) => {
      const d = after[k] - before[k];
      const mark = d > 0 ? '▲' : d < 0 ? '▼' : '';
      return d !== 0 ? `${TEXT.stat[k]} ${before[k]}→${after[k]}${mark}` : null;
    }).filter(Boolean).join('　') || TEXT.menu.noChange;
  }
  function equipItem(c, slot, itemId) {
    const old = c.equip[slot];
    if (itemId) {
      if (!Game.removeItem(itemId, 1)) return false;
    }
    if (old) Game.addItem(old, 1);
    c.equip[slot] = itemId || null;
    Party.clampHpMp(c);
    return true;
  }
  M.equipMenu = async function () {
    const c = await pickMember(TEXT.menu.whoEquip);
    if (!c) return;
    let sIdx = 0;
    for (;;) {
      const slots = Object.keys(SLOT_NAMES).map((k) => ({ label: SLOT_NAMES[k], right: c.equip[k] ? DATA.ITEMS[c.equip[k]].name : TEXT.menu.slotEmpty, value: k, desc: c.equip[k] ? equipDesc(DATA.ITEMS[c.equip[k]]) : '' }));
      const st = Party.stats(c);
      const r = await UI.list({ title: T('menu.equipTitle', { name: c.name, stats: STAT_SHOW.map((k) => `${TEXT.stat[k]}${st[k]}`).join(' ') }), items: slots, cls: 'sub wide', start: sIdx });
      if (!r) return;
      sIdx = r.index;
      const slot = r.value;
      const cands = Object.keys(Game.s.inv).filter((id) => DATA.ITEMS[id].type === slot && Party.canEquip(c, id));
      const items = cands.map((id) => ({ label: DATA.ITEMS[id].name, value: id, right: '×' + Game.count(id), desc: diffText(c, slot, id) }));
      if (c.equip[slot]) items.push({ label: TEXT.menu.unequip, value: '__none', desc: diffText(c, slot, null) });
      if (!items.length) { await UI.message(TEXT.menu.noEquipCandidates); continue; }
      const pick = await UI.list({ title: T('menu.chooseSlotItem', { slot: SLOT_NAMES[slot] }), items, cls: 'sub wide' });
      if (!pick) continue;
      const old = c.equip[slot];
      if (pick.value === '__none') {
        if (Game.count(old) >= 99) { await UI.message(TEXT.menu.bagFull); continue; }
        equipItem(c, slot, null); Sound.sfx('ok');
        UI.toast(T('menu.unequipped', { name: c.name, item: DATA.ITEMS[old].name }));
      } else {
        if (old && Game.count(old) >= 99) { await UI.message(TEXT.menu.bagFull); continue; }
        equipItem(c, slot, pick.value); Sound.sfx('ok');
        UI.toast(T('menu.equipped', { name: c.name, item: DATA.ITEMS[pick.value].name }));
      }
    }
  };

  // ---------- スキル ----------
  M.skillMenu = async function () {
    const c = await pickMember(TEXT.menu.whoCast, (m) => m.hp > 0);
    if (!c) return;
    for (;;) {
      const list = Party.skills(c).map((id) => [id, DATA.SKILLS[id]]);
      const fieldOk = (s) => s.field || s.fieldOnly;
      const items = list.map(([id, s]) => ({ label: s.name, value: id, right: `MP${s.mp || 0}`, desc: s.desc + (fieldOk(s) ? '' : TEXT.menu.battleOnlySkillTag), disabled: !fieldOk(s) || c.mp < (s.mp || 0), whyDisabled: !fieldOk(s) ? TEXT.menu.battleOnlySkill : TEXT.menu.notEnoughMp }));
      if (!items.length) { await UI.message(TEXT.menu.noFieldSkills); return; }
      const r = await UI.list({ title: `${c.name}（MP ${c.mp}）`, items, cls: 'sub wide' });
      if (!r) return;
      const sk = DATA.SKILLS[r.value];
      if (sk.effect === 'return') {
        if (!Field.canReturn()) { await UI.message(TEXT.field.returnDungeon); continue; }
        if (await Field.returnTo()) { c.mp -= sk.mp; return 'warped'; }
        continue;
      }
      if (sk.effect === 'repel') { c.mp -= sk.mp; Game.s.repel = 100; Sound.sfx('magic'); await UI.message(TEXT.field.repelOn); continue; }
      const st = Party.stats(c);
      const pow = (sk.pow || 0) + st.int * (sk.scale || 0.5);
      if (sk.target === 'allies') {
        const msgs = Game.party.map((m) => applyFieldEffect(sk, m, pow)).filter(Boolean);
        if (!msgs.length) { await UI.message(TEXT.menu.noEffect); continue; }
        c.mp -= sk.mp;
        for (const m of msgs) await UI.message(m);
        continue;
      }
      const t = await pickMember(TEXT.menu.whoUse, sk.target === 'deadAlly' ? (m) => m.hp <= 0 : null);
      if (!t) continue;
      const msg = applyFieldEffect(sk, t, pow);
      if (msg === null) { await UI.message(TEXT.menu.noEffect); continue; }
      c.mp -= sk.mp;
      await UI.message(msg);
    }
  };

  // ---------- 隊列 ----------
  M.orderMenu = async function () {
    if (Game.s.party.length < 2) { await UI.message(TEXT.menu.noOrderPartner); return; }
    await UI.message(TEXT.menu.orderHelp);
    for (;;) {
      const a = await UI.list({ title: TEXT.menu.orderFirst, items: memberItems(Game.party).map((it, i) => Object.assign(it, { label: `${i + 1}. ${it.label}` })), cls: 'sub' });
      if (!a) return;
      const b = await UI.list({ title: T('menu.orderSecond', { name: a.value.name }), items: memberItems(Game.party).map((it, i) => Object.assign(it, { label: `${i + 1}. ${it.label}`, disabled: it.value === a.value })), cls: 'sub', start: a.index });
      if (!b) continue;
      const p = Game.s.party;
      [p[a.index], p[b.index]] = [p[b.index], p[a.index]];
      Field.refreshParty();
      UI.toast(TEXT.menu.orderDone);
    }
  };

  // ---------- セーブ ----------
  M.saveMenu = async function () {
    if (!Store.available) { await UI.message(TEXT.save.storageUnavailable); return; }
    const r = await UI.list({ title: TEXT.menu.save, items: slotItems(), cls: 'sub saves' });
    if (!r) return;
    if (r.item.peek && !(await UI.confirm(T('save.confirmOverwrite', { n: r.value })))) return;
    Game.s.map = Field.map.id; Game.s.x = Field.x; Game.s.y = Field.y; Game.s.dir = Field.dir;
    const ok = SaveSys.write(r.value);
    Sound.sfx(ok ? 'save' : 'buzz');
    await UI.message(ok ? TEXT.save.saved : TEXT.save.failed);
  };

  // ---------- 設定 ----------
  M.settings = async function () {
    const volStr = (v) => `${Math.round(v * 100)}%`;
    const onOff = (v) => (v ? TEXT.settings.on : TEXT.settings.off);
    const rows = () => [
      { label: TEXT.settings.bgm, value: 'bgm', right: onOff(Settings.get('bgm')) },
      { label: TEXT.settings.bgmVol, value: 'bgmVol', right: volStr(Settings.get('bgmVol')) },
      { label: TEXT.settings.sfx, value: 'sfx', right: onOff(Settings.get('sfx')) },
      { label: TEXT.settings.sfxVol, value: 'sfxVol', right: volStr(Settings.get('sfxVol')) },
      { label: TEXT.settings.textSpeed, value: 'textSpeed', right: TEXT.settings[Settings.get('textSpeed')] },
      { label: TEXT.settings.motion, value: 'motion', right: TEXT.settings[Settings.get('motion')] },
      { label: TEXT.settings.touch, value: 'touch', right: TEXT.settings[Settings.get('touch')] },
      { label: TEXT.settings.close, value: 'close' },
    ].map((r) => Object.assign(r, { desc: TEXT.settings.help }));
    function change(key, dir) {
      if (key === 'bgm' || key === 'sfx') Settings.set(key, !Settings.get(key));
      else if (key === 'bgmVol' || key === 'sfxVol') Settings.set(key, Util.clamp(Math.round((Settings.get(key) + dir * 0.1) * 10) / 10, 0, 1));
      else if (Settings.ENUMS[key]) {
        const e = Settings.ENUMS[key]; const i = e.indexOf(Settings.get(key));
        Settings.set(key, e[(i + dir + e.length) % e.length]);
      }
      Sound.settingsChanged();
      if (key === 'touch') Input.updatePadVisibility();
      if (key === 'sfx' || key === 'sfxVol') Sound.sfx('ok');
    }
    let h;
    h = UI.listWin({
      title: TEXT.settings.title, cls: 'sub settings', items: rows(),
      onLR: (d, it) => { if (it && it.value !== 'close') { change(it.value, d); h.update(rows(), true); } },
    });
    for (;;) {
      const r = await h.choose();
      if (!r || r.value === 'close') break;
      // 決定（タップ）では値を順送り。音量は100%の次に0%へ戻る
      if ((r.value === 'bgmVol' || r.value === 'sfxVol') && Settings.get(r.value) >= 1) { Settings.set(r.value, 0); Sound.settingsChanged(); }
      else change(r.value, 1);
      h.update(rows(), true);
    }
    h.close();
  };

  // =========================================================
  // 店
  // =========================================================
  function whoCanEquip(itemId) {
    return Game.party.filter((c) => Party.canEquip(c, itemId));
  }
  M.shop = async function (shopId) {
    const shop = DATA.SHOPS[shopId];
    const gold = UI.panel('goldpanel');
    const drawGold = () => { gold.el.innerHTML = `<span class="k">${TEXT.menu.gold}</span> <b>${Game.s.gold}G</b>`; };
    drawGold();
    const welcome = await UI.message(shop.kind === 'gear' ? TEXT.shop.welcomeGear : TEXT.shop.welcomeItem, { keep: true });
    for (;;) {
      const r = await UI.list({ items: [{ label: TEXT.shop.buy, value: 'buy' }, { label: TEXT.shop.sell, value: 'sell' }, { label: TEXT.shop.leave, value: 'leave' }], cls: 'sub small shopcmd', desc: false });
      if (!r || r.value === 'leave') break;
      if (r.value === 'buy') await buyLoop(shop, drawGold);
      else await sellLoop(drawGold);
    }
    welcome.closeKept();
    gold.close();
    await UI.message(TEXT.shop.bye);
  };
  async function buyLoop(shop, drawGold) {
    const side = UI.panel('shopside');
    const showSide = (id) => {
      const it = DATA.ITEMS[id];
      if (!it || !['weapon', 'armor', 'shield', 'acc'].includes(it.type)) { side.el.innerHTML = `<div class="k">${TEXT.shop.owned.replace('{n}', Game.count(id))}</div>`; return; }
      side.el.innerHTML = Game.party.map((c) => {
        const can = Party.canEquip(c, id);
        const cur = c.equip[it.type] ? DATA.ITEMS[c.equip[it.type]].name : TEXT.menu.slotEmpty;
        return `<div class="srow ${can ? '' : 'no'}"><b></b> <span>${can ? diffText(c, it.type, id) : TEXT.shop.cantEquip}</span><small>${T('shop.nowEquipped', { item: cur })}</small></div>`;
      }).join('') + `<div class="k">${TEXT.shop.owned.replace('{n}', Game.count(id))}</div>`;
      side.el.querySelectorAll('.srow b').forEach((b, i) => { b.textContent = Game.party[i].name; });
    };
    let start = 0;
    for (;;) {
      const items = shop.items.map((id) => {
        const it = DATA.ITEMS[id];
        const eqTag = ['weapon', 'armor', 'shield', 'acc'].includes(it.type) ? (whoCanEquip(id).length ? '' : TEXT.shop.noOneCanEquip) : '';
        return { label: it.name + eqTag, value: id, right: it.price + 'G', desc: it.desc || equipDesc(it) };
      });
      const r = await UI.list({ title: TEXT.shop.what, items, cls: 'sub wide shoplist', start, onMove: (it) => it && showSide(it.value) });
      if (!r) break;
      start = r.index;
      const it = DATA.ITEMS[r.value];
      if (Game.s.gold < it.price) { Sound.sfx('buzz'); await UI.message(T('shop.noMoney', { n: it.price - Game.s.gold })); continue; }
      if (Game.count(r.value) >= 99) { Sound.sfx('buzz'); await UI.message(TEXT.shop.tooMany); continue; }
      const maxQ = Math.min(99 - Game.count(r.value), Math.floor(Game.s.gold / it.price));
      let q = 1;
      if (maxQ > 1) {
        q = await UI.number({ title: T('shop.howMany', { price: it.price }), min: 1, max: maxQ, sub: (n) => T('shop.total', { n: n * it.price }) });
        if (!q) continue;
      }
      if (!(await UI.confirm(T('shop.confirmBuy', { item: it.name, qty: q, n: q * it.price })))) continue;
      // 購入処理（残高と在庫を同時に更新）
      if (Game.s.gold < q * it.price) { await UI.message(T('shop.noMoney', { n: q * it.price - Game.s.gold })); continue; }
      const added = Game.addItem(r.value, q);
      Game.s.gold -= added * it.price;
      Sound.sfx('coin');
      drawGold(); showSide(r.value);
      await UI.message(TEXT.shop.thanks);
      if (['weapon', 'armor', 'shield', 'acc'].includes(it.type)) {
        const cands = whoCanEquip(r.value);
        if (cands.length && await UI.confirm(TEXT.shop.equipNow)) {
          const who = await UI.list({ title: TEXT.menu.whoEquip, items: cands.map((c) => ({ label: c.name, value: c, right: diffText(c, it.type, r.value) })), cls: 'sub wide' });
          if (who) { equipItem(who.value, it.type, r.value); UI.toast(T('menu.equipped', { name: who.value.name, item: it.name })); showSide(r.value); }
        }
      }
    }
    side.close();
  }
  function sellPrice(it) { return it.sell !== undefined ? it.sell : Math.floor((it.price || 0) / 2); }
  async function sellLoop(drawGold) {
    let start = 0;
    for (;;) {
      const ids = Object.keys(Game.s.inv).filter((id) => DATA.ITEMS[id].type !== 'key');
      if (!ids.length) { await UI.message(TEXT.shop.nothingToSell); return; }
      const items = ids.map((id) => { const it = DATA.ITEMS[id]; const p = sellPrice(it); return { label: it.name, value: id, right: `${p}G ×${Game.count(id)}`, disabled: p <= 0, whyDisabled: TEXT.shop.cantSell, desc: it.desc || equipDesc(it) }; });
      const r = await UI.list({ title: TEXT.shop.sell, items, cls: 'sub wide', start: Math.min(start, items.length - 1) });
      if (!r) return;
      start = r.index;
      const it = DATA.ITEMS[r.value];
      const p = sellPrice(it);
      let q = 1;
      if (Game.count(r.value) > 1) {
        q = await UI.number({ title: T('shop.howManySell', { item: it.name }), min: 1, max: Game.count(r.value), sub: (n) => T('shop.total', { n: n * p }) });
        if (!q) continue;
      }
      if (!(await UI.confirm(T('shop.confirmSell', { item: it.name, qty: q, n: q * p })))) continue;
      if (!Game.removeItem(r.value, q)) continue;
      Game.s.gold = Math.min(9999999, Game.s.gold + q * p);
      Sound.sfx('coin');
      drawGold();
      await UI.message(TEXT.shop.thanks);
    }
  }

  // ---------- 宿屋 ----------
  M.inn = async function (price) {
    const total = price * Game.party.length;
    const gold = UI.panel('goldpanel');
    gold.el.innerHTML = `<span class="k">${TEXT.menu.gold}</span> <b>${Game.s.gold}G</b>`;
    const yes = await UI.confirm(T('inn.ask', { price, total }), { speaker: TEXT.inn.speaker });
    if (!yes) { gold.close(); await UI.message(TEXT.inn.bye, { speaker: TEXT.inn.speaker }); return; }
    if (Game.s.gold < total) { gold.close(); Sound.sfx('buzz'); await UI.message(T('inn.noMoney', { n: total - Game.s.gold }), { speaker: TEXT.inn.speaker }); return; }
    Game.s.gold -= total;
    gold.el.innerHTML = `<span class="k">${TEXT.menu.gold}</span> <b>${Game.s.gold}G</b>`;
    await UI.message(TEXT.inn.rest, { speaker: TEXT.inn.speaker });
    Sound.stopBgm();
    Sound.sfx('inn');
    await Render.fade(true, 500);
    Game.s.roster.forEach((c) => Party.fullHeal(c));
    if (DATA.TOWNS[Field.map.id]) Game.s.lastTown = Field.map.id;
    await Util.wait(Settings.reduceMotion() ? 300 : 1300);
    Field.refreshParty();
    await Render.fade(false, 500);
    Sound.bgm(Field.map.bgm || 'town');
    gold.close();
    await UI.message(TEXT.inn.morning, { speaker: TEXT.inn.speaker });
  };

  // ---------- ギルド ----------
  M.guild = async function () {
    const welcome = await UI.message(TEXT.guild.welcome, { speaker: TEXT.guild.speaker, keep: true });
    const pp = partyPanel('menuside');
    for (;;) {
      const r = await UI.list({
        cls: 'sub guildmenu', desc: false,
        items: [{ label: TEXT.guild.create, value: 'create' }, { label: TEXT.guild.join, value: 'join' }, { label: TEXT.guild.leave, value: 'leave' }, { label: TEXT.guild.remove, value: 'remove' }, { label: TEXT.shop.leave, value: 'bye' }],
      });
      if (!r || r.value === 'bye') break;
      if (r.value === 'create') {
        if (Game.s.roster.length >= DATA.ROSTER_MAX) { await UI.message(T('guild.rosterFull', { n: DATA.ROSTER_MAX })); continue; }
        const name = await UI.nameInput({ title: TEXT.create.name, fallback: Util.pick(DATA.NAME_POOL), cancel: true });
        if (name === null) continue;
        const cls = await pickClass(T('create.classStep', { name }));
        if (!cls) continue;
        if (!(await UI.confirm(T('create.confirm', { name, cls: DATA.CLASSES[cls].name })))) continue;
        const hero = Game.s.roster.find((c) => c.hero);
        const lv = Math.max(1, Math.min(hero.lv, Math.floor(Game.avgLevel() * 0.9)));
        const c = Party.newChar(name, cls, lv);
        Game.s.roster.push(c);
        await UI.message(T('guild.created', { name, cls: DATA.CLASSES[cls].name }));
        if (lv > 1) await UI.message(T('guild.welcomeLv', { name, lv }));
        if (Game.s.party.length < DATA.PARTY_MAX && await UI.confirm(T('guild.askJoin', { name }))) { Game.s.party.push(c.id); await UI.message(T('guild.joined', { name })); }
      }
      if (r.value === 'join') {
        if (!Game.reserve.length) { await UI.message(TEXT.guild.noReserve); continue; }
        if (Game.s.party.length >= DATA.PARTY_MAX) { await UI.message(TEXT.guild.partyFull); continue; }
        const m = await UI.list({ title: TEXT.guild.join, items: memberItems(Game.reserve), cls: 'sub' });
        if (!m) continue;
        Game.s.party.push(m.value.id);
        await UI.message(T('guild.joined', { name: m.value.name }));
      }
      if (r.value === 'leave') {
        const cands = Game.party.filter((c) => !c.hero);
        if (!cands.length) { await UI.message(Game.party.length <= 1 ? TEXT.guild.cantLeaveLast : TEXT.guild.cantLeaveHero); continue; }
        const m = await UI.list({ title: TEXT.guild.leave, items: memberItems(cands), cls: 'sub' });
        if (!m) continue;
        Game.s.party = Game.s.party.filter((id) => id !== m.value.id);
        await UI.message(T('guild.left', { name: m.value.name }));
      }
      if (r.value === 'remove') {
        const cands = Game.reserve.filter((c) => !c.hero);
        if (!cands.length) { await UI.message(TEXT.guild.noRemovable); continue; }
        const m = await UI.list({ title: TEXT.guild.remove, items: memberItems(cands), cls: 'sub' });
        if (!m) continue;
        if (!(await UI.confirm(T('guild.removeConfirm', { name: m.value.name })))) continue;
        for (const it of Object.values(m.value.equip)) if (it) Game.addItem(it, 1);
        Game.s.roster = Game.s.roster.filter((c) => c !== m.value);
        await UI.message(T('guild.removed', { name: m.value.name }));
      }
      pp.draw();
      Field.refreshParty();
    }
    pp.close();
    welcome.closeKept();
    await UI.message(TEXT.guild.bye, { speaker: TEXT.guild.speaker });
  };

  return M;
})();

// =============================================================
// エンディング
// =============================================================
const Ending = (() => {
  const E = {};
  async function credits(lines, finalText) {
    const el = document.getElementById('credits');
    el.innerHTML = '';
    const inner = UI.el('div', 'roll');
    for (const l of lines) inner.appendChild(UI.el('p', l.startsWith('#') ? 'h' : '', l.replace(/^#/, '')));
    inner.appendChild(UI.el('p', 'fin', finalText));
    el.appendChild(inner);
    el.classList.add('show');
    const reduce = Settings.reduceMotion();
    el.classList.toggle('static', reduce);
    await Util.wait(reduce ? 400 : 200);
    await new Promise((res) => {
      const done = () => { clearTimeout(t); UI._stackRemove(w); res(); };
      const w = { el: UI.el('div', 'hiddenwin'), interactive: true, onAction: (a) => { if (a === 'ok' || a === 'cancel') done(); } };
      const t = setTimeout(done, reduce ? 60000 : 26000);
      el.addEventListener('click', done, { once: true });
      UI._stackPush(w);
    });
    el.classList.remove('show');
  }
  E.play = async function (kind) {
    App.fsm.push('ending');
    Sound.bgm('ending');
    const hero = Game.s.roster.find((c) => c.hero);
    const names = Game.party.map((c) => c.name).join('、');
    const st = MAPS.STORY[kind === 'normal' ? 'endingNormal' : 'endingTrue'];
    const fill = (t) => t.replace('{names}', names).replace('{hero}', hero ? hero.name : '');
    for (const line of st.before) await UI.message(fill(line));
    Game.setFlag(kind === 'normal' ? 'final_clear' : 'true_clear');
    await Render.fade(true, 800);
    for (const line of st.after) await UI.message(fill(line));
    await credits(st.credits.map(fill), kind === 'normal' ? TEXT.ending.theEnd : TEXT.ending.trueEnd);
    if (kind === 'normal') await UI.message(TEXT.ending.toBeContinued);
    const arr = SaveSys.townArrival('lanta');
    Field.enter(arr.map, arr.x, arr.y, 'up');
    await Render.fade(false, 600);
    if (await UI.confirm(kind === 'normal' ? TEXT.ending.saveClear : TEXT.ending.saveTrue)) await Menus.saveMenu();
    for (const line of st.epilogue) await UI.message(fill(line));
    if (App.fsm.currentName === 'ending') App.fsm.pop();
  };
  return E;
})();
