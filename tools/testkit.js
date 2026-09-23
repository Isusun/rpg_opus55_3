// ブラウザ内テスト用ヘルパー（開発時のみ javascript_tool から読み込む。ゲーム本体からは読み込まない）
window.TK = (() => {
  const K = {};
  const CODES = { ok: 'Enter', cancel: 'Escape', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', menu: 'KeyM' };
  K.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  K.key = async (a, n, gap) => {
    for (let i = 0; i < (n || 1); i++) {
      const code = CODES[a] || a;
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Enter' ? 'Enter' : code, bubbles: true }));
      await K.wait(15);
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
      await K.wait(gap || 60);
    }
  };
  K.until = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > (ms || 8000)) throw new Error('timeout: ' + fn); await K.wait(40); } };
  K.topText = () => { const w = document.querySelectorAll('#ui .win:not(.panel)'); return w.length ? w[w.length - 1].textContent : ''; };
  K.party = (lv, classes) => {
    UI.closeAll();
    Game.s = Game.newState();
    (classes || ['warrior', 'knight', 'priest', 'mage']).forEach((c, i) => { const ch = Party.newChar(['ユウ', 'ナギ', 'ハル', 'ホタル'][i], c, lv || 1, i === 0); Game.s.roster.push(ch); Game.s.party.push(ch.id); });
    document.getElementById('title').classList.remove('show');
  };
  K.go = (map, x, y, dir) => { App.startField(map, x, y, dir || 'down'); };
  /** メッセージを読み進めて、リストが出るか何も無くなるまで */
  K.drain = async (max) => {
    for (let i = 0; i < (max || 30); i++) {
      await K.wait(80);
      const w = document.querySelectorAll('#ui .win.msg:not(.kept)');
      if (!w.length) return;
      await K.key('ok', 2, 40);
    }
  };
  /** 条件を満たすまで決定キーを連打（戦闘・会話を自動で進める） */
  K.mash = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > (ms || 120000)) throw new Error('mash timeout'); await K.key('ok', 1, 70); } };
  /** キャンセル連打でフィールドまで戻る */
  K.back = async () => { for (let i = 0; i < 40 && !(K.inField() && App.fsm.stack.length === 1); i++) { await K.key('cancel', 1, 60); await K.wait(60); } };
  K.inField = () => App.fsm.currentName === 'field' && !Field.busy && !UI.hasModal();
  K.maxOut = (lv) => {
    for (const c of Game.party) {
      c.lv = lv; c.exp = DATA.totalExpFor(lv);
      const best = { warrior: ['star_sword', 'star_armor', 'star_shield', 'star_ring'], knight: ['star_lance', 'star_armor', 'star_shield', 'star_ring'], priest: ['star_staff', 'star_robe', 'star_shield', 'star_ring'], mage: ['star_staff', 'star_robe', null, 'star_ring'], thief: ['star_knife', 'star_garb', null, 'star_ring'], monk: ['star_claw', 'star_garb', null, 'star_ring'] }[c.cls];
      ['weapon', 'armor', 'shield', 'acc'].forEach((s, i) => { c.equip[s] = best[i]; });
      Party.fullHeal(c);
    }
    Field.refreshParty();
  };
  K.bossAt = (mapId) => MAPS.MAPS[mapId].entities.find((e) => e.type === 'boss');
  /** ボスの手前に移動して調べる → 戦闘を連打で進める */
  K.fightBoss = async (mapId) => {
    const b = K.bossAt(mapId);
    Field.enter(mapId, b.x, b.y + 1, 'up');
    await K.wait(300);
    Game.party.forEach((c) => Party.fullHeal(c));
    Field.interact();
    await K.wait(300);
    await K.mash(() => K.inField() && App.fsm.stack.length === 1, 240000);
    return Game.flag(b.flag);
  };
  return K;
})();
'testkit loaded';
