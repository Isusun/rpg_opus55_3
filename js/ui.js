'use strict';
// =============================================================
// UI: DOMによるウィンドウ群（メッセージ・選択リスト・数量・名前入力・トースト）
//  すべてのウィンドウはスタックで管理し、入力は最前面のウィンドウに渡す。
//  選択中の項目は実DOMフォーカス＋「▶」＋枠線で示す（色だけに頼らない）。
// =============================================================
const UI = (() => {
  let root, toastEl, liveEl;
  const stack = [];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function init() {
    root = document.getElementById('ui');
    toastEl = document.getElementById('toast');
    liveEl = document.getElementById('live');
  }
  function top() { return stack[stack.length - 1] || null; }
  function push(w) {
    const prev = top();
    if (prev && prev.el) prev.el.classList.add('inactive');
    stack.push(w);
    root.appendChild(w.el);
    w.focus && w.focus();
  }
  function remove(w) {
    const i = stack.indexOf(w);
    if (i >= 0) stack.splice(i, 1);
    if (w.el && w.el.parentNode) w.el.parentNode.removeChild(w.el);
    const t = top();
    if (t && t.el) { t.el.classList.remove('inactive'); t.focus && t.focus(); }
    else { const g = document.getElementById('game'); g && g.focus({ preventScroll: true }); }
  }
  function announce(text) { if (liveEl) { liveEl.textContent = ''; setTimeout(() => { liveEl.textContent = text; }, 30); } }

  // ---------- メッセージ ----------
  function typeDelay() { return { slow: 45, normal: 24, fast: 9, instant: 0 }[Settings.get('textSpeed')] ?? 24; }
  function message(text, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const w = { interactive: true };
      w.el = el('div', 'win msg ' + (opts.cls || ''));
      w.el.setAttribute('role', 'dialog');
      if (opts.speaker) { const sp = el('div', 'speaker', opts.speaker); w.el.appendChild(sp); }
      const body = el('div', 'msgbody');
      const more = el('div', 'more', '▼');
      more.setAttribute('aria-hidden', 'true');
      w.el.appendChild(body); w.el.appendChild(more);
      const chars = Array.from(text);
      let i = 0, timer = null, done = false;
      const d = typeDelay();
      function finish() { if (timer) clearInterval(timer); timer = null; body.textContent = text; done = true; w.el.classList.add('done'); }
      if (d === 0) finish();
      else {
        timer = setInterval(() => {
          i += 1;
          body.textContent = chars.slice(0, i).join('');
          if (i >= chars.length) finish();
        }, d);
      }
      announce((opts.speaker ? opts.speaker + '「' : '') + text + (opts.speaker ? '」' : ''));
      const close = () => {
        if (!done) { finish(); return; }
        Sound.sfx('cursor');
        if (!opts.keep) remove(w);
        else w.el.classList.add('kept');
        w.closeKept = () => remove(w);
        resolve(w);
      };
      w.onAction = (a) => { if (a === 'ok' || a === 'cancel') close(); };
      w.el.addEventListener('click', (e) => { e.stopPropagation(); Input.markPointer(); close(); });
      w.focus = () => w.el.focus({ preventScroll: true });
      w.el.tabIndex = -1;
      push(w);
      if (opts.auto) setTimeout(() => { if (stack.includes(w)) { finish(); close(); } }, opts.auto);
    });
  }

  // ---------- 選択リスト ----------
  function listWin(opts) {
    const w = { interactive: true, opts, index: 0, items: [] };
    w.el = el('div', 'win list ' + (opts.cls || ''));
    w.el.setAttribute('role', 'listbox');
    if (opts.title) {
      const t = el('div', 'wtitle', opts.title);
      w.el.appendChild(t);
      w.el.setAttribute('aria-label', opts.title);
    }
    const box = el('div', 'items');
    if (opts.cols && opts.cols > 1) box.style.gridTemplateColumns = `repeat(${opts.cols}, minmax(0, 1fr))`;
    w.el.appendChild(box);
    const descEl = opts.desc !== false ? el('div', 'desc') : null;
    if (descEl) w.el.appendChild(descEl);
    let resolver = null;
    w.active = true;

    function render(items) {
      w.items = items;
      box.innerHTML = '';
      if (!items.length) {
        const empty = el('div', 'empty', opts.empty || '');
        box.appendChild(empty);
      }
      items.forEach((it, i) => {
        const b = el('button', 'item' + (it.disabled ? ' disabled' : '') + (it.cls ? ' ' + it.cls : ''));
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.tabIndex = -1;
        const cur = el('span', 'cur', '▶'); cur.setAttribute('aria-hidden', 'true');
        const lab = el('span', 'lab', it.label);
        b.appendChild(cur); b.appendChild(lab);
        if (it.right !== undefined && it.right !== null && it.right !== '') b.appendChild(el('span', 'right', String(it.right)));
        if (it.disabled) b.setAttribute('aria-disabled', 'true');
        b.addEventListener('click', (e) => { e.stopPropagation(); Input.markPointer(); if (!w.active) return; select(i); choose(); });
        b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && w.active) select(i, true); });
        box.appendChild(b);
      });
      select(Util.clamp(w.index, 0, Math.max(0, items.length - 1)), true);
    }
    function select(i, silent) {
      if (!w.items.length) { if (descEl) descEl.textContent = opts.emptyDesc || ''; return; }
      const prev = w.index;
      w.index = i;
      Array.from(box.children).forEach((b, j) => { b.classList.toggle('sel', j === i); b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      const b = box.children[i];
      if (b && b.focus && top() === w) b.focus({ preventScroll: true });
      if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
      const it = w.items[i];
      if (descEl) descEl.textContent = (it && it.desc) || '';
      if (!silent && prev !== i) Sound.sfx('cursor');
      opts.onMove && opts.onMove(it, i);
    }
    function choose() {
      const it = w.items[w.index];
      if (!it) return;
      if (it.disabled) { Sound.sfx('buzz'); if (it.whyDisabled) toast(it.whyDisabled); return; }
      Sound.sfx('ok');
      if (resolver) { const r = resolver; resolver = null; r({ value: it.value, index: w.index, item: it }); }
    }
    function cancel() {
      if (opts.cancel === false) return;
      Sound.sfx('cancel');
      if (resolver) { const r = resolver; resolver = null; r(null); }
    }
    w.onAction = (a) => {
      if (!w.active) return;
      const n = w.items.length, cols = opts.cols || 1;
      if (a === 'ok') choose();
      else if (a === 'cancel' || (a === 'menu' && opts.menuCancels)) cancel();
      else if (!n) return;
      else if (a === 'up') select((w.index - cols + n) % n);
      else if (a === 'down') select((w.index + cols) % n);
      else if (a === 'left') { if (cols > 1) select((w.index - 1 + n) % n); else opts.onLR && opts.onLR(-1, w.items[w.index]); }
      else if (a === 'right') { if (cols > 1) select((w.index + 1) % n); else opts.onLR && opts.onLR(1, w.items[w.index]); }
    };
    w.focus = () => {
      const b = box.children[w.index];
      if (b && b.focus) b.focus({ preventScroll: true }); else w.el.focus({ preventScroll: true });
    };
    w.el.tabIndex = -1;
    w.index = opts.start || 0;
    render(opts.items || []);
    push(w);
    return {
      win: w,
      choose() { return new Promise((r) => { resolver = r; }); },
      update(items, keepIndex) { if (!keepIndex) w.index = 0; render(items); },
      setIndex(i) { select(i, true); },
      close() { remove(w); },
      get index() { return w.index; },
      el: w.el,
    };
  }
  async function list(opts) {
    const h = listWin(opts);
    const r = await h.choose();
    h.close();
    return r;
  }
  /** はい／いいえ など。text はメッセージとして表示し、選択肢を並べる */
  async function ask(text, options, opts) {
    opts = opts || {};
    const m = await message(text, { keep: true, speaker: opts.speaker });
    const r = await list({ items: options.map((o, i) => ({ label: o, value: i })), cls: 'choice', cancel: opts.cancel !== false, desc: false, start: opts.start || 0 });
    m.closeKept();
    return r ? r.value : (opts.cancelValue !== undefined ? opts.cancelValue : options.length - 1);
  }
  async function confirm(text, opts) {
    const v = await ask(text, [TEXT.common.yes, TEXT.common.no], Object.assign({ cancelValue: 1 }, opts || {}));
    return v === 0;
  }

  // ---------- 数量選択 ----------
  function number(opts) {
    return new Promise((resolve) => {
      const w = { interactive: true };
      let n = opts.min || 1;
      const max = Math.max(opts.min || 1, opts.max);
      w.el = el('div', 'win number ' + (opts.cls || ''));
      w.el.setAttribute('role', 'spinbutton');
      const t = el('div', 'wtitle', opts.title || '');
      const row = el('div', 'numrow');
      const minus = el('button', 'nbtn', '－'); minus.type = 'button'; minus.setAttribute('aria-label', TEXT.common.minus);
      const val = el('span', 'nval');
      const plus = el('button', 'nbtn', '＋'); plus.type = 'button'; plus.setAttribute('aria-label', TEXT.common.plus);
      const okb = el('button', 'nbtn okb', TEXT.common.ok); okb.type = 'button';
      const sub = el('div', 'desc');
      row.append(minus, val, plus, okb);
      w.el.append(t, row, sub);
      function draw() {
        val.textContent = '× ' + n;
        w.el.setAttribute('aria-valuenow', String(n));
        sub.textContent = opts.sub ? opts.sub(n) : '';
      }
      function set(v) { const nv = Util.clamp(v, opts.min || 1, max); if (nv !== n) Sound.sfx('cursor'); n = nv; draw(); }
      function done(v) { Sound.sfx(v === null ? 'cancel' : 'ok'); remove(w); resolve(v); }
      w.onAction = (a) => {
        if (a === 'up' || a === 'right') set(n + (a === 'right' ? 10 : 1));
        else if (a === 'down' || a === 'left') set(n - (a === 'left' ? 10 : 1));
        else if (a === 'ok') done(n);
        else if (a === 'cancel') done(null);
      };
      minus.addEventListener('click', (e) => { e.stopPropagation(); set(n - 1); });
      plus.addEventListener('click', (e) => { e.stopPropagation(); set(n + 1); });
      okb.addEventListener('click', (e) => { e.stopPropagation(); done(n); });
      w.focus = () => okb.focus({ preventScroll: true });
      draw();
      push(w);
    });
  }

  // ---------- 名前入力 ----------
  function nameInput(opts) {
    return new Promise((resolve) => {
      const w = { interactive: true };
      w.el = el('div', 'win nameinput');
      const t = el('div', 'wtitle', opts.title || TEXT.create.name);
      const inp = el('input', 'namefield');
      inp.type = 'text'; inp.maxLength = 12; inp.value = opts.value || ''; inp.placeholder = TEXT.create.namePlaceholder;
      inp.setAttribute('aria-label', TEXT.create.name); inp.autocomplete = 'off'; inp.spellcheck = false;
      const help = el('div', 'desc', TEXT.create.nameHelp);
      const row = el('div', 'btnrow');
      const rnd = el('button', 'nbtn', TEXT.create.random); rnd.type = 'button';
      const ok = el('button', 'nbtn okb', TEXT.create.decide); ok.type = 'button';
      row.append(rnd, ok);
      w.el.append(t, inp, row, help);
      let focusIdx = 0; // 0: 入力欄 1: おまかせ 2: けってい
      const els = [inp, rnd, ok];
      function focusAt(i) { focusIdx = (i + els.length) % els.length; els[focusIdx].focus({ preventScroll: true }); }
      function done(v) { remove(w); resolve(v); }
      function submit() { Sound.sfx('ok'); done(Util.sanitizeName(inp.value) || opts.fallback || Util.pick(DATA.NAME_POOL)); }
      rnd.addEventListener('click', (e) => { e.stopPropagation(); inp.value = Util.pick(DATA.NAME_POOL); Sound.sfx('cursor'); focusAt(2); });
      ok.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
      w.onAction = (a) => {
        if (a === 'ok') { if (document.activeElement === rnd) rnd.click(); else submit(); }
        else if (a === 'cancel') { if (opts.cancel) { Sound.sfx('cancel'); done(null); } }
        else if (a === 'down' || a === 'right') focusAt(focusIdx + 1);
        else if (a === 'up' || a === 'left') focusAt(focusIdx - 1);
      };
      w.focus = () => focusAt(focusIdx);
      push(w);
    });
  }

  // ---------- 非対話パネル ----------
  function panel(cls) {
    const e = el('div', 'win panel ' + (cls || ''));
    root.appendChild(e);
    return { el: e, close() { if (e.parentNode) e.parentNode.removeChild(e); } };
  }

  // ---------- トースト ----------
  let toastTimer = null;
  function toast(text, ms) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    announce(text);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 2200);
  }

  return {
    _stackPush: push, _stackRemove: remove,
    init, el, message, list, listWin, ask, confirm, number, nameInput, panel, toast, announce,
    handle(a, repeat) { const t = top(); if (t && t.onAction) { t.onAction(a, repeat); return true; } return false; },
    hasModal() { return stack.length > 0; },
    closeAll() { while (stack.length) remove(stack[stack.length - 1]); root.querySelectorAll('.panel').forEach((e) => e.remove()); },
    get depth() { return stack.length; },
  };
})();
