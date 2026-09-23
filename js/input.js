'use strict';
// =============================================================
// 入力: キーボード／タッチボタンを共通アクション（up/down/left/right/ok/cancel/menu）に変換
// =============================================================
const Input = (() => {
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'ok', NumpadEnter: 'ok', Space: 'ok', KeyZ: 'ok',
    Escape: 'cancel', KeyX: 'cancel', Backspace: 'cancel',
    KeyM: 'menu', Tab: 'menu',
  };
  const held = { up: false, down: false, left: false, right: false };
  const order = []; // 最後に押した方向を優先
  let handler = null;
  let touchDir = null; // 画面タップ／長押しによる移動方向
  let lastInputType = 'key';

  function press(a) {
    if (['up', 'down', 'left', 'right'].includes(a)) {
      held[a] = true;
      const i = order.indexOf(a); if (i >= 0) order.splice(i, 1); order.push(a);
    }
    Sound.unlock();
    if (handler) {
      try { handler(a); } catch (e) { console.error(e); App.recover(e); }
    }
  }
  function release(a) {
    if (held[a] !== undefined) {
      held[a] = false;
      const i = order.indexOf(a); if (i >= 0) order.splice(i, 1);
    }
  }
  function releaseAll() { for (const k of Object.keys(held)) held[k] = false; order.length = 0; touchDir = null; }

  function isTextField(el) { return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'); }

  window.addEventListener('keydown', (e) => {
    lastInputType = 'key';
    const a = KEYMAP[e.code] || (e.key === 'Enter' ? 'ok' : null);
    if (isTextField(document.activeElement)) {
      // 名前入力中は Enter / Escape / 上下 のみゲームへ
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!e.repeat) press(e.key === 'Enter' ? 'ok' : e.key === 'Escape' ? 'cancel' : (e.key === 'ArrowUp' ? 'up' : 'down'));
      }
      return;
    }
    if (!a) return;
    e.preventDefault();
    if (e.repeat) {
      // 方向キーのリピートはメニュー操作用に通す（フィールド移動は held を参照）
      if (['up', 'down', 'left', 'right'].includes(a) && handler) { try { handler(a, true); } catch (err) { console.error(err); } }
      return;
    }
    press(a);
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) release(a);
  });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  // ---- タッチパッド ----
  function bindPad() {
    const pad = document.getElementById('pad');
    const repeatTimers = {};
    pad.querySelectorAll('[data-act]').forEach((btn) => {
      const a = btn.dataset.act;
      const down = (e) => {
        e.preventDefault();
        lastInputType = 'touch';
        btn.classList.add('on');
        press(a);
        if (['up', 'down', 'left', 'right'].includes(a)) {
          clearInterval(repeatTimers[a]);
          let n = 0;
          repeatTimers[a] = setInterval(() => { n++; if (n > 3 && handler) { try { handler(a, true); } catch (err) { console.error(err); } } }, 110);
        }
      };
      const up = (e) => {
        e.preventDefault();
        btn.classList.remove('on');
        release(a);
        clearInterval(repeatTimers[a]);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  function updatePadVisibility() {
    const mode = Settings.get('touch');
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const show = mode === 'show' || (mode === 'auto' && (coarse || 'ontouchstart' in window && navigator.maxTouchPoints > 0));
    document.body.classList.toggle('pad-on', !!show);
    if (typeof Render !== 'undefined' && Render.resize) Render.resize();
  }

  return {
    setHandler(h) { handler = h; },
    dir() { return order.length ? order[order.length - 1] : touchDir; },
    /** フィールドを直接タップ／長押しして歩く（タッチボタン非表示でも移動できるように） */
    bindStageTouch(getPlayerScreenPos, canWalk, onTapTile) {
      const stage = document.getElementById('stage');
      const calc = (e) => {
        const p = getPlayerScreenPos();
        if (!p) return null;
        const r = stage.getBoundingClientRect();
        const dx = e.clientX - r.left - p.x, dy = e.clientY - r.top - p.y;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return null;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      };
      let active = false;
      stage.addEventListener('pointerdown', (e) => {
        if (!canWalk()) return;
        lastInputType = 'touch';
        const p = getPlayerScreenPos();
        const r = stage.getBoundingClientRect();
        // 自分をタップ → メニュー／隣のマスをタップ → その方向を向いて調べる
        const special = p && onTapTile ? onTapTile(e.clientX - r.left, e.clientY - r.top) : null;
        if (special && handler) { try { handler(special); } catch (err) { console.error(err); } return; }
        active = true;
        touchDir = calc(e);
        if (touchDir && handler) { try { handler(touchDir); } catch (err) { console.error(err); } }
      });
      stage.addEventListener('pointermove', (e) => { if (active) touchDir = calc(e); });
      const end = () => { active = false; touchDir = null; };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', end);
      stage.addEventListener('pointerleave', end);
    },
    held,
    releaseAll,
    bindPad,
    updatePadVisibility,
    get lastType() { return lastInputType; },
    markPointer() { lastInputType = 'pointer'; },
  };
})();
