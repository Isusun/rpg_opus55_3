'use strict';
// =============================================================
// アプリ本体: ステートマシンの定義・起動処理・入力の振り分け・異常時の復帰
// =============================================================
const App = (() => {
  const A = {};
  // 状態遷移表（スタック式: push で上に積み、pop で戻る）
  A.fsm = new StateMachine({
    boot: ['title'],
    title: ['create', 'field', 'title'],
    create: ['field', 'event'],
    field: ['event', 'menu', 'battle', 'title', 'field', 'gameover', 'ending'],
    event: ['battle', 'gameover', 'ending', 'event', 'field', 'title'],
    menu: ['event', 'field', 'title'],
    battle: ['field', 'event', 'title'],
    gameover: ['field'],
    ending: ['field', 'title'],
  });

  // ---------- 各状態 ----------
  A.fsm.register('boot', {});
  A.fsm.register('title', { enter() { Menus.title().catch(A.recover); }, onAction() {} });
  A.fsm.register('create', { enter() { Menus.create().catch(A.recover); }, onAction() {} });
  A.fsm.register('field', {
    update(dt) { Field.update(dt); },
    onAction(a) {
      if (['up', 'down', 'left', 'right'].includes(a)) { Field.tap(a); return; }
      if (Field.busy || Field.move) return;
      if (a === 'ok') Field.interact();
      else if (a === 'cancel' || a === 'menu') A.openMenu();
    },
  });
  A.fsm.register('event', { update(dt) { Field.update(dt); }, onAction() {} });
  A.fsm.register('menu', { onAction() {} });
  A.fsm.register('battle', { onAction(a) { Battle.onAction(a); } });
  A.fsm.register('gameover', { onAction() {} });
  A.fsm.register('ending', { onAction() {} });

  A.openMenu = async function () {
    Input.releaseAll();
    A.fsm.push('menu');
    Sound.sfx('ok');
    try { await Menus.fieldMenu(); } catch (e) { console.error(e); }
    if (A.fsm.currentName === 'menu') A.fsm.pop();
  };

  A.startField = function (mapId, x, y, dir) {
    UI.closeAll();
    A.fsm.change('field');
    Field.enter(mapId, x, y, dir);
    Render.fade(false, 300);
  };

  /** 画像の参照先（DOMの <img> 用） */
  A.imgSrc = function (alias) {
    if (/^https?:$/.test(location.protocol)) return `assets/img/${alias}.png`;
    return (window.ASSET_BUNDLE && window.ASSET_BUNDLE[alias]) || '';
  };

  /** 想定外のエラーから安全に復帰する */
  let recovering = false;
  A.recover = function (err) {
    console.error(err);
    if (recovering) return;
    recovering = true;
    try {
      UI.closeAll();
      Render.battle.close();
      document.querySelectorAll('.battleui').forEach((e) => e.remove());
      Field.busy = false;
      if (Game.s && Field.map) {
        while (A.fsm.stack.length > 1) A.fsm.pop();
        if (A.fsm.currentName !== 'field') A.fsm.change('field');
        Render.fade(false, 100);
        UI.toast(TEXT.common.unknownError, 3000);
      } else {
        A.fsm.change('title');
      }
    } catch (e2) { console.error(e2); }
    setTimeout(() => { recovering = false; }, 500);
  };

  // ---------- 起動 ----------
  A.boot = async function () {
    UI.init();
    const loading = document.getElementById('loading');
    const bar = document.getElementById('loadbar');
    A.fsm.change('boot');
    if (typeof PIXI === 'undefined') {
      loading.querySelector('.lt').textContent = TEXT.title.loadFailedPixi;
      return;
    }
    try {
      await Render.init();
    } catch (e) {
      console.error(e);
      loading.querySelector('.lt').textContent = TEXT.common.webglFailed;
      return;
    }
    const missing = await Render.loadAssets((p) => { bar.style.width = (p * 100).toFixed(0) + '%'; });
    loading.classList.add('hide');
    setTimeout(() => loading.remove(), 400);
    const tl = document.getElementById('title');
    tl.querySelector('h1').textContent = TEXT.game.title;
    tl.querySelector('.logo p').textContent = TEXT.game.subtitle;
    tl.querySelector('.copy').textContent = TEXT.game.copyright;
    const tsrc = /^https?:$/.test(location.protocol) ? 'assets/img/title.jpg' : (window.ASSET_BUNDLE && window.ASSET_BUNDLE.title) || '';
    if (tsrc) document.getElementById('title').style.backgroundImage = `url("${tsrc}")`;
    const applyMotion = () => {
      document.body.classList.toggle('motion-reduce', Settings.get('motion') === 'reduce');
      document.body.classList.toggle('motion-full', Settings.get('motion') === 'full');
    };
    applyMotion();
    Settings.onChange(applyMotion);
    Input.bindPad();
    Input.bindStageTouch(() => Render.field.playerScreen(), () => A.fsm.currentName === 'field' && !UI.hasModal() && !Field.busy,
      (sx, sy) => { const t = Render.field.screenToTile(sx, sy); return t ? Field.tapTile(t.x, t.y) : null; });
    Input.updatePadVisibility();
    window.matchMedia && window.matchMedia('(pointer: coarse)').addEventListener('change', () => Input.updatePadVisibility());
    Input.setHandler((a, repeat) => {
      if (UI.handle(a, repeat)) return;
      if (repeat) return;
      const st = A.fsm.current;
      if (st && st.onAction) st.onAction(a);
    });
    Render.onTick = (dt) => {
      if (Game.s && ['field', 'event', 'menu', 'battle'].includes(A.fsm.currentName)) Game.s.playTime += dt / 1000;
      const st = A.fsm.current;
      if (st && st.update) { try { st.update(dt); } catch (e) { A.recover(e); } }
    };
    window.addEventListener('resize', () => { if (A.fsm.is('battle')) Battle.relayout(); });
    if (missing.length) UI.toast(TEXT.common.assetFallback, 4000);
    if (!Store.available) UI.toast(TEXT.save.storageUnavailable, 5000);
    document.getElementById('game').addEventListener('pointerdown', () => { Sound.unlock(); });
    A.fsm.change('title');
  };

  window.addEventListener('error', (e) => { if (A.fsm.currentName !== 'boot') A.recover(e.error || e.message); });
  window.addEventListener('unhandledrejection', (e) => { A.recover(e.reason); });
  return A;
})();

window.addEventListener('DOMContentLoaded', () => { App.boot(); });
