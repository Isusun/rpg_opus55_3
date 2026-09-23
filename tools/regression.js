// ブラウザ内回帰テスト（testkit.js 読み込み後に使う）。各ステップは45秒以内に終わるよう分割。
window.REG = (() => {
  const R = { results: [] };
  const ok = (name, cond, info) => { R.results.push([cond ? 'PASS' : 'FAIL', name, info === undefined ? '' : JSON.stringify(info)]); };
  const talk = async (map, x, y, dir) => { Field.enter(map, x, y, dir); await TK.wait(250); Field.interact(); await TK.wait(200); await TK.mash(() => TK.inField() && App.fsm.stack.length === 1, 40000); };
  TK.step = async (d, n) => { for (let i = 0; i < (n || 1); i++) { if (!Field.move && !Field.busy) Field.tryMove(d); Field.update(200); await TK.wait(20); } };

  // 1: タイトル → キャラクター作成（キーボードのみ）→ オープニング
  R.s1 = async () => {
    await TK.until(() => App.fsm.currentName === 'title' && UI.depth > 0, 20000);
    await TK.key('ok'); await TK.wait(300);
    await TK.key('ok', 2, 200); await TK.wait(300);
    await TK.key('ok'); await TK.wait(300); // 名前（空欄→自動）
    await TK.key('ok'); await TK.wait(300); // 戦士
    await TK.key('ok'); await TK.wait(200); await TK.key('ok'); await TK.wait(300); // はい
    await TK.key('ok'); await TK.wait(200); await TK.key('ok'); await TK.wait(200);
    await TK.key('down'); await TK.key('ok'); await TK.wait(800); // おまかせ
    await TK.mash(() => Game.flag('intro') && TK.inField(), 30000);
    ok('create party of 4', Game.party.length === 4, Game.party.map((c) => c.cls));
    ok('intro flag', Game.flag('intro'));
    ok('in lanta', Field.map.id === 'lanta');
  };
  // 2: 店（買う・売る）と宿
  R.s2 = async () => {
    await TK.back();
    Game.s.gold = 200;
    Field.enter('lanta', 4, 13, 'up'); await TK.wait(200);
    Field.interact();
    // 目的の文言が出るまで決定を押す（入力の取りこぼしに強くする）
    const pressUntil = async (txt) => { for (let i = 0; i < 20 && !TK.topText().includes(txt); i++) { await TK.key('ok'); await TK.wait(150); } };
    await pressUntil('何に');
    const h0 = Game.count('herb');
    await TK.key('ok'); await TK.until(() => TK.topText().includes('いくつ'));
    await TK.key('up', 2, 80); await TK.key('ok');
    await pressUntil('はい'); await TK.key('ok');
    await TK.until(() => TK.topText().includes('まいど'));
    ok('buy 3 herbs', Game.count('herb') === h0 + 3 && Game.s.gold === 200 - 24, { herb: Game.count('herb'), gold: Game.s.gold });
    await TK.back();
    Game.party[0].hp = 1;
    const g = Game.s.gold;
    await talk('lanta', 16, 5, 'up');
    ok('inn heals and charges', Game.party[0].hp === Party.stats(Game.party[0]).hp && Game.s.gold === g - 16, { gold: Game.s.gold });
  };
  // 3: そうび・レベルアップ・状態異常の持ち越し
  R.s3 = async () => {
    const w = Game.party[0];
    Game.addItem('iron_sword', 1);
    const a0 = Party.stats(w).atk;
    App.openMenu(); await TK.wait(250);
    await TK.key('down', 2); await TK.key('ok'); await TK.wait(200); await TK.key('ok'); await TK.wait(200);
    await TK.key('ok'); await TK.wait(200); await TK.key('ok'); await TK.wait(300);
    ok('equip iron sword changes atk', w.equip.weapon === 'iron_sword' && Party.stats(w).atk === a0 - 9 + 16 && Game.count('copper_sword') === 1, { a0, a1: Party.stats(w).atk });
    await TK.back();
  };
  // 4: ランダムエンカウント → 勝利 / 逃走
  R.s4 = async () => {
    Field.enter('ow', 8, 41, 'down'); await TK.wait(200);
    Game.s.encCounter = 2;
    let met = false;
    for (let i = 0; i < 12 && !met; i++) { await TK.step(i % 2 ? 'left' : 'right'); met = App.fsm.is('battle'); }
    ok('random encounter happens', met);
    const exp0 = Game.party[0].exp;
    await TK.mash(() => TK.inField() && App.fsm.stack.length === 1, 40000);
    ok('battle ends back in field with exp', Game.party[0].exp > exp0 || Game.party[0].hp <= 0, { exp0, exp: Game.party[0].exp });
  };
  // 5: セーブ → 状態変更 → ロードで完全復元
  R.s5 = async () => {
    Field.enter('fior', 9, 12, 'left'); await TK.wait(200);
    Game.party[1].status.poison = true;
    Game.s.gold = 1234; Game.setFlag('pass_open');
    const snap = JSON.stringify({ map: Game.s.map, x: Field.x, y: Field.y, gold: Game.s.gold, inv: Game.s.inv, flags: Game.s.flags, party: Game.s.party, roster: Game.s.roster.map((c) => [c.name, c.cls, c.lv, c.hp, c.mp, c.status, c.equip]) });
    App.openMenu(); await TK.wait(250);
    await TK.key('down', 5); await TK.key('ok'); await TK.wait(250); await TK.key('ok'); await TK.wait(250);
    if (TK.topText().includes('上書き')) { await TK.key('ok'); await TK.wait(200); await TK.key('ok'); await TK.wait(250); }
    await TK.back();
    Game.s.gold = 1; Game.s.inv = {}; Field.enter('lanta', 11, 12, 'down');
    const loaded = SaveSys.load(1);
    Game.s = loaded; App.startField(loaded.map, loaded.x, loaded.y, loaded.dir); await TK.wait(200);
    const now = JSON.stringify({ map: Game.s.map, x: Field.x, y: Field.y, gold: Game.s.gold, inv: Game.s.inv, flags: Game.s.flags, party: Game.s.party, roster: Game.s.roster.map((c) => [c.name, c.cls, c.lv, c.hp, c.mp, c.status, c.equip]) });
    ok('save/load restores everything', snap === now, snap === now ? '' : { snap, now });
  };
  // 6: 本編の通し（ボス→オーブ→イベント）
  R.s6 = async () => {
    TK.maxOut(60);
    ok('boss1', await TK.fightBoss('cave1_2'));
    ok('bridge guard gone', !Field.entityVisible(MAPS.MAPS.ow.entities.find((e) => e.name === '橋番')));
    ok('boss2', await TK.fightBoss('tower2_3'));
    Game.setFlag('pass_open', false);
    await talk('sahar', 6, 5, 'up');
    ok('chief opens pass', Game.flag('pass_open') && Game.has('letter'));
  };
  R.s7 = async () => {
    ok('boss3', await TK.fightBoss('temple3_2'));
    ok('boss4', await TK.fightBoss('volcano4_2'));
    await talk('mizuha', 19, 15, 'down');
    ok('ferry to snowfield', Field.map.id === 'ow' && Field.x === 14 && Field.y === 22);
  };
  R.s8 = async () => {
    const orig = Battle.run;
    Battle.run = async (o) => (o.enemies[0] === 'prisma' ? 'win' : orig(o));
    ok('boss5 (post script)', await TK.fightBoss('ice5_2') && Game.has('orb5'));
    Battle.run = orig;
    ok('boss6', await TK.fightBoss('grave6_2'));
    await talk('ow', 40, 20, 'left');
    ok('altar makes light bridge', Game.flag('lightbridge') && Game.orbs() === 6);
    ok('gatekeeper', await TK.fightBoss('tower7_2'));
  };
  R.s9 = async () => {
    const b = TK.bossAt('tower7_3');
    Field.enter('tower7_3', b.x, b.y + 1, 'up'); await TK.wait(200);
    Field.interact(); await TK.wait(200);
    await TK.mash(() => { if (Battle.ctx) Battle.ctx.enemies.forEach((e) => { if (e.hp > 1) e.hp = 1; }); return App.fsm.currentName === 'ending'; }, 30000);
    ok('final boss (2 phases) -> ending', App.fsm.currentName === 'ending');
  };
  R.s10 = async () => {
    await TK.mash(() => TK.inField() && App.fsm.stack.length === 1, 40000);
    ok('normal ending sets final_clear and returns to lanta', Game.flag('final_clear') && Field.map.id === 'lanta');
    ok('portal visible', Field.entityVisible(MAPS.MAPS.lanta.entities.find((e) => e.to === 'rev')));
  };
  R.s11 = async () => {
    const b = TK.bossAt('rev3');
    Field.enter('rev3', b.x, b.y + 1, 'up'); await TK.wait(200);
    Field.interact(); await TK.wait(200);
    await TK.mash(() => { if (Battle.ctx) Battle.ctx.enemies.forEach((e) => { if (e.hp > 1) e.hp = 1; }); return App.fsm.currentName === 'ending'; }, 20000);
    await TK.mash(() => TK.inField() && App.fsm.stack.length === 1, 30000);
    ok('true ending', Game.flag('true_clear'));
  };
  // 12: 全滅 → 最後の町で復活・所持金半分
  R.s12 = async () => {
    Game.s.lastTown = 'fior'; Game.s.gold = 1000;
    Game.party.forEach((c) => { c.hp = 1; c.lv = 1; c.exp = 0; c.equip = { weapon: null, armor: null, shield: null, acc: null }; });
    Field.enter('ow', 8, 41, 'down'); await TK.wait(100);
    const p = Battle.run({ enemies: ['valgoat'], bg: 'bg_grave', canRun: false, boss: true }).then(async (r) => { if (r === 'lose') await Field.gameOver(); return r; });
    await TK.mash(() => TK.inField() && App.fsm.stack.length === 1, 40000);
    const r = await p;
    ok('defeat -> revive in last town, gold halved', r === 'lose' && Field.map.id === 'fior' && Game.s.gold === 500 && Game.party.every((c) => c.hp > 0), { r, map: Field.map.id, gold: Game.s.gold });
  };
  R.report = () => R.results.map((r) => r.join(' ')).join('\n');
  return R;
})();
'regression loaded';
