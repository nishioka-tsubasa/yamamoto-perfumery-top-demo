/* 山本香料 トップページ デモ ／ 動きの制御
   01 香りの軌跡（スクロールで線を描く） 02 香りの霞 03 香り立ち（写真）
   04 香りの粒 05 見出しの現れ方 06 香りのノート表示
   スマホは 01 と 02 だけを動かす（演出ガイドの決めごと）。 */
(function () {
  'use strict';
  var d = document, root = d.documentElement, W = window;
  var anim = root.classList.contains('js');           // 動きを減らす設定の人は false
  var mq = W.matchMedia('(min-width:768px)');
  var pc = d.querySelector('.yp'), sp = d.querySelector('.sp');
  var noteEl = d.querySelector('.note');
  var S = { k: 1, mode: '', vh: W.innerHeight };
  var trails = { pc: null, sp: null };
  var trailOn = !anim;
  var secs = { pc: [], sp: [] };
  var plx = [], motes = [];

  function q(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 画面幅に合わせた倍率 ---------- */
  function layout() {
    var w = root.clientWidth || W.innerWidth, isPC = mq.matches;
    S.mode = isPC ? 'pc' : 'sp';
    S.k = isPC ? Math.min(w, 1920) / 1440 : w / 390;
    S.vh = W.innerHeight;
    root.style.setProperty('--k', S.k.toFixed(5));
    if (!isPC) { var h = sp.offsetHeight; if (h) root.style.setProperty('--sph', h); }
    var el = isPC ? pc : sp;
    secs[S.mode] = q(el, '.sec').map(function (s) {
      return { el: s, name: s.getAttribute('data-sec'), tone: s.getAttribute('data-tone'), top: s.offsetTop, h: s.offsetHeight };
    });
    if (isPC) { plx.forEach(function (p) { var s = secOf(p.el); p.top = s.offsetTop; p.h = s.offsetHeight; }); placeNote(); }
    ensureTrail();
    tick();
  }
  function secOf(el) { while (el && !(el.classList && el.classList.contains('sec'))) el = el.parentNode; return el; }

  /* ---------- 01 香りの軌跡 ---------- */
  function Line(path, lag) {
    this.el = path; this.len = path.getTotalLength(); this.cur = 0; this.lag = lag || 0; this.curY = -1;
    var n = Math.max(8, Math.ceil(this.len / 5)), L = new Float32Array(n + 1), Y = new Float32Array(n + 1), m = -1e9;
    for (var i = 0; i <= n; i++) { var l = this.len * i / n, p = path.getPointAtLength(l); if (p.y > m) m = p.y; L[i] = l; Y[i] = m; }
    this.n = n; this.L = L; this.Y = Y; this.pts = []; this.tips = [];
  }
  Line.prototype.lenAt = function (y) {
    var Y = this.Y, n = this.n;
    if (y <= Y[0]) return 0;
    if (y >= Y[n]) return this.len;
    var lo = 0, hi = n;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (Y[mid] <= y) lo = mid; else hi = mid; }
    var t = Y[hi] > Y[lo] ? (y - Y[lo]) / (Y[hi] - Y[lo]) : 0;
    return this.L[lo] + (this.L[hi] - this.L[lo]) * t;
  };
  Line.prototype.yAt = function (len) { return this.Y[clamp(Math.round(len / this.len * this.n), 0, this.n)]; };

  function Trail(svg) {
    var self = this; this.lines = []; this.wisps = [];
    q(svg, '.ln').forEach(function (p, i) {
      var l = new Line(p, i ? 110 : 0), key = p.getAttribute('data-line');
      l.tips = q(svg, '.tip[data-line="' + key + '"]');
      l.pts = q(svg, '.pt[data-line="' + key + '"]').map(function (c) { return { el: c, y: parseFloat(c.getAttribute('cy')), on: false }; });
      if (anim) { p.style.strokeDasharray = l.len + ' ' + l.len; p.style.strokeDashoffset = l.len; }
      self.lines.push(l);
    });
    q(svg, '.wisp').forEach(function (p) {
      var len = p.getTotalLength(), y0 = p.getPointAtLength(0).y;
      if (anim) { p.style.strokeDasharray = len + ' ' + len; p.style.strokeDashoffset = len; }
      self.wisps.push({ el: p, len: len, y: y0, on: false });
    });
  }
  Trail.prototype.update = function (yT, dt) {
    var moving = false, a = 1 - Math.exp(-dt * 4.4);
    for (var i = 0; i < this.lines.length; i++) {
      var l = this.lines[i], target = yT < 0 ? 0 : l.lenAt(yT - l.lag), diff = target - l.cur;
      if (Math.abs(diff) < .5) l.cur = target; else { l.cur += diff * a; moving = true; }
      l.el.style.strokeDashoffset = (l.len - l.cur).toFixed(1);
      l.curY = l.cur > 0 ? l.yAt(l.cur) : -1;
      var show = l.cur > 2 && l.cur < l.len - 2;
      if (l.tips.length) {
        var p = l.el.getPointAtLength(l.cur);
        for (var t = 0; t < l.tips.length; t++) {
          var tp = l.tips[t]; tp.setAttribute('cx', p.x.toFixed(1)); tp.setAttribute('cy', p.y.toFixed(1));
          if (tp.__on !== show) { tp.__on = show; tp.classList.toggle('on', show); }
        }
      }
      for (var j = 0; j < l.pts.length; j++) { var pt = l.pts[j], on = l.curY >= pt.y + 4; if (on !== pt.on) { pt.on = on; pt.el.classList.toggle('on', on); } }
    }
    var main = this.lines[0];
    for (var w = 0; w < this.wisps.length; w++) {
      var ws = this.wisps[w], won = main.cur > 2 && (main.curY >= ws.y - 2 || main.cur >= main.len - 2);
      if (won !== ws.on) { ws.on = won; ws.el.style.strokeDashoffset = won ? 0 : ws.len; }
    }
    return moving;
  };
  function ensureTrail() {
    var m = S.mode;
    if (trails[m] || !anim) return;
    var svg = (m === 'pc' ? pc : sp).querySelector('.trail');
    if (!svg) return;
    trails[m] = new Trail(svg);
    if (m === 'pc') makeMotes(trails.pc);
  }

  /* ---------- 04 香りの粒（PCのみ） ---------- */
  function toneAt(y) { var list = secs.pc; for (var i = 0; i < list.length; i++) if (y < list[i].top + list[i].h) return list[i].tone; return 'light'; }
  function makeMotes(trail) {
    var box = d.createElement('div'); box.className = 'motes'; box.setAttribute('aria-hidden', 'true'); pc.appendChild(box);
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    trail.lines.forEach(function (l, li) {
      var step = li ? 780 : 560;
      for (var s = 240 + li * 320; s < l.len - 160; s += step) {
        var p = l.el.getPointAtLength(s), x = clamp(p.x + (rnd() * 2 - 1) * 34, 10, 1430), y = p.y + (rnd() * 2 - 1) * 18, sz = (2 + rnd() * 2.4).toFixed(1);
        var dark = toneAt(y) === 'dark', el = d.createElement('i');
        el.className = 'mote';
        el.style.cssText = 'left:' + x.toFixed(0) + 'px;top:' + y.toFixed(0) + 'px;width:' + sz + 'px;height:' + sz + 'px;--mx:' + ((rnd() * 2 - 1) * 26).toFixed(0) + 'px;--md:' + (-rnd() * 9).toFixed(1) + 's;--mo:' + (dark ? '.9' : '.7') + ';color:' + (dark ? '#fff' : (rnd() > .5 ? '#8E86BE' : '#7C9E8B'));
        box.appendChild(el); motes.push({ el: el, y: y, line: l, on: false });
      }
    });
  }

  /* ---------- 06 香りのノート表示（PCのみ） ---------- */
  var note = null;
  function placeNote() {
    if (!noteEl) return;
    if (!note) note = { labels: q(noteEl, '.nl'), slots: q(noteEl, '.slot'), bars: q(noteEl, '.bar'), dot: noteEl.querySelector('.dot'), phase: -1 };
    note.pos = note.slots.map(function (s) { return s.offsetTop; });
    note.h = noteEl.offsetHeight;
    note.items = q(noteEl, '.nl,.bar').map(function (el) { return { el: el, c: el.offsetTop + el.offsetHeight / 2, light: null }; });
    note.items.push({ el: note.dot, c: 0, light: null, dot: true });
    note.phase = -1;
  }
  function noteTone(y) {
    var list = secs.pc;
    for (var i = 0; i < list.length; i++) if (y < list[i].top + list[i].h) return list[i].name === 'recruit' || list[i].tone === 'light';
    return true;
  }
  function updateNote(yc, sy, vh, k) {
    if (!note || !secs.pc.length) return;
    var a = byName('lineup'), b = byName('recruit'); if (!a || !b) return;
    var phase = yc < a.top ? 0 : yc < b.top ? 1 : 2;
    if (phase !== note.phase) {
      note.phase = phase;
      note.labels.forEach(function (l, i) { l.classList.toggle('on', i === phase); });
      note.dot.style.transform = 'translateY(' + note.pos[phase] + 'px)';
    }
    note.bars[0].style.setProperty('--f', clamp(yc / a.top, 0, 1).toFixed(3));
    note.bars[1].style.setProperty('--f', clamp((yc - a.top) / (b.top - a.top), 0, 1).toFixed(3));
    // 文字・線・印ごとに、その真下の区画の明るさに合わせて色を切り替える
    for (var i = 0; i < note.items.length; i++) {
      var it = note.items[i], c = it.dot ? note.pos[note.phase] + 2.5 : it.c;
      var light = noteTone((sy + vh / 2 + (c - note.h / 2) * k) / k);
      if (light !== it.light) { it.light = light; it.el.classList.toggle('l', light); }
    }
  }
  function byName(n) { var l = secs[S.mode]; for (var i = 0; i < l.length; i++) if (l[i].name === n) return l[i]; return null; }

  /* ---------- 毎フレームの更新 ---------- */
  var ticking = false, last = 0;
  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame(t) {
    ticking = false;
    var dt = clamp((t - last) / 1000 || .016, .001, .05); last = t;
    var sy = W.pageYOffset || root.scrollTop || 0, k = S.k, vh = S.vh, moving = false;
    var tr = trails[S.mode];
    if (tr) {
      var yT = trailOn ? Math.max((sy + vh * .78) / k + 60, S.mode === 'pc' ? 700 : 560) : -1;
      moving = tr.update(yT, dt);
    }
    if (S.mode === 'pc') {
      updateNote((sy + vh * .5) / k, sy, vh, k);
      if (anim) {
        for (var i = 0; i < plx.length; i++) {
          var p = plx[i], top = p.top * k - sy, h = p.h * k;
          if (top > vh + 300 || top + h < -300) continue;
          var v = p.fv ? Math.max(0, sy / k) * p.f : -clamp((top + h / 2 - vh / 2) / vh, -1, 1) * p.f;
          p.el.style.transform = 'translate3d(0,' + v.toFixed(2) + 'px,0)' + (p.sc ? ' scale(' + p.sc + ')' : '');
        }
        for (var m = 0; m < motes.length; m++) {
          var mo = motes[m], vy = mo.y * k - sy, on = vy > -120 && vy < vh + 160 && mo.line.curY >= mo.y;
          if (on !== mo.on) { mo.on = on; mo.el.classList.toggle('on', on); }
        }
      }
    }
    if (moving) tick();
  }

  /* ---------- 05 見出しを1文字ずつに分ける ---------- */
  function splitChars(el, base, step) {
    var n = 0, label = el.textContent.replace(/\s+/g, '');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = d.createDocumentFragment();
          c.nodeValue.split('').forEach(function (chr) {
            if (/\s/.test(chr)) { frag.appendChild(d.createTextNode(chr)); return; }
            var s = d.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true'); s.textContent = chr;
            s.style.setProperty('--cd', (base + n * step).toFixed(2) + 's'); n++; frag.appendChild(s);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    })(el);
    el.setAttribute('aria-label', label);
    return n;
  }

  /* ---------- 03・05 画面に入ったら現れる（PCのみ） ---------- */
  function setupReveal() {
    var groups = [], used = [];
    function mark(el) { used.push(el); }
    function isUsed(el) { return used.indexOf(el) > -1; }
    function setD(el, v) { el.style.setProperty('--d', v.toFixed(2) + 's'); }
    function bloom(img, delay) { if (!img || isUsed(img)) return null; mark(img); img.classList.add('bl-i'); setD(img, delay || 0); return img; }
    function rv(el, delay) { if (!el || isUsed(el)) return null; mark(el); el.classList.add('rv'); setD(el, delay || 0); return el; }
    function group(trigger, items) { items = items.filter(Boolean); if (items.length) groups.push({ t: trigger, items: items }); }

    // 見出しのある文章のまとまり：ラベル → 見出し（1文字ずつ） → 本文（まとめて）
    q(pc, '.sec:not([data-sec="fv"]) h2').forEach(function (h) {
      var par = h.parentNode, items = [], t = 0;
      Array.prototype.slice.call(par.children).forEach(function (el) {
        if (el === h) { var n = splitChars(h, .25, .12); h.classList.add('chars'); mark(h); items.push(h); t = .7 + Math.min(.9, n * .05); }
        else if (el.classList.contains('head')) { el.classList.add('hd-row'); mark(el); setD(el, 0); items.push(el); }
        else { items.push(rv(el, t)); t += .14; }
      });
      group(par, items);
    });
    // 見出しのないラベル行
    q(pc, '.sec:not([data-sec="fv"]) .head').forEach(function (el) { if (isUsed(el)) return; el.classList.add('hd-row'); mark(el); group(el, [el]); });
    // 斜めに切った写真3枚とその札
    q(pc, '.cut').forEach(function (c, i) { group(c, [bloom(c.querySelector('img'), i * .16)]); });
    q(pc, '.cap').forEach(function (c) { group(c, [rv(c, .5)]); });
    // 自社製品のカード
    q(pc, '[data-sec="products"] article').forEach(function (a, i) {
      group(a, [rv(a, i * .14), bloom(a.querySelector('.ph'), i * .14 + .1), rv(a.querySelector('img:not(.ph)'), i * .14 + .7)]);
    });
    // 香料ラインナップ・技術・社長コラムのカード
    q(pc, '[data-sec="lineup"] > a, [data-sec="technology"] > a, [data-sec="news"] > a').forEach(function (a) {
      var sibs = q(a.parentNode, ':scope > a'), i = sibs.indexOf(a);
      group(a, [rv(a, i * .1), bloom(a.querySelector('.ph'), i * .1 + .1)]);
    });
    // 大きな写真
    q(pc, '[data-sec="technology"] > div > img.ph, [data-sec="sustainability"] > div > img.ph, [data-sec="recruit"] .plx > img, [data-sec="contact"] .plx > img').forEach(function (img) {
      group(secOf(img), [bloom(img, .1)]);
    });
    // お知らせの行
    var news = pc.querySelector('[data-sec="news"] .news-list');
    if (news) group(news, Array.prototype.slice.call(news.children).map(function (el, i) { return rv(el, .1 + i * .1); }));
    // 残りの本文・ボタン・注記
    q(pc, '.sec:not([data-sec="fv"]) .lead, .sec:not([data-sec="fv"]) .more, [data-sec="products"] > p, [data-sec="technology"] > .en').forEach(function (el) {
      if (isUsed(el) || el.closest('.rv')) return; group(el, [rv(el, .45)]);
    });
    // フッター
    var foot = pc.querySelector('footer');
    if (foot) group(foot, Array.prototype.slice.call(foot.children).map(function (el, i) { return rv(el, i * .12); }));

    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        (en.target.__g || []).forEach(function (g) {
          g.items.forEach(function (el) {
            el.classList.add('is-in');
            if (el.classList.contains('bl-i')) setTimeout(function () { el.classList.add('done'); }, 2600 + parseFloat(el.style.getPropertyValue('--d') || 0) * 1000);
          });
        });
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    groups.forEach(function (g) { (g.t.__g = g.t.__g || []).push(g); io.observe(g.t); });
  }

  /* ---------- 02 霞：見えている区画だけ動かす ---------- */
  function setupSections() {
    q(d, '.haze').forEach(function (h, i) { if (i % 2) h.classList.add('hz-b'); h.style.setProperty('--hd', (10 + (i * 7) % 6) + 's'); });
    if (!('IntersectionObserver' in W)) { q(d, '.sec').forEach(function (s) { s.classList.add('seen'); }); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { en.target.classList.toggle('in-view', en.isIntersecting); if (en.isIntersecting) en.target.classList.add('seen'); });
    }, { rootMargin: '12% 0px 12% 0px', threshold: 0 });
    q(d, '.sec').forEach(function (s) { io.observe(s); });
  }

  /* ---------- ページ内の移動 ---------- */
  var GO = { '私たちについて': 'about', '香料製品': 'lineup', '自社製品': 'products', '研究開発': 'technology', 'サステナビリティ': 'sustainability', '採用情報': 'recruit', 'お知らせ': 'news', '社長コラム': 'news', 'お問い合わせ': 'contact' };
  function go(name) {
    var top = 0;
    if (name !== 'top') { var s = byName(name); if (!s) return; top = Math.round(s.top * S.k); }
    W.scrollTo({ top: top, behavior: anim ? 'smooth' : 'auto' });
  }
  function setupLinks() {
    q(d, '.yp header a, .yp footer nav a, .sp footer nav a, .spmenu a').forEach(function (a) {
      var key = (a.getAttribute('data-go') || a.textContent).replace(/\s+/g, '').replace(/^\d+/, ''), name = GO[key];
      if (name) a.setAttribute('data-go', name);
    });
    q(d, '.yp footer a.en, .sp footer a.en, .yp header > a:first-child, .sp header > a:first-child').forEach(function (a) { a.setAttribute('data-go', 'top'); });
    d.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var name = a.getAttribute('data-go');
      if (name) { e.preventDefault(); closeMenu(); go(name); }
      else if (a.getAttribute('href') === '#') e.preventDefault();
    });
  }

  /* ---------- スマホ：メニューと横スワイプ ---------- */
  var menu = d.getElementById('spmenu'), menuBtn = d.querySelector('[data-menu-open]');
  function openMenu() { if (!menu) return; menu.classList.add('open'); menu.setAttribute('aria-hidden', 'false'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true'); root.style.overflow = 'hidden'; }
  function closeMenu() { if (!menu || !menu.classList.contains('open')) return; menu.classList.remove('open'); menu.setAttribute('aria-hidden', 'true'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); root.style.overflow = ''; }
  function setupSP() {
    if (menuBtn) menuBtn.addEventListener('click', openMenu);
    var c = d.querySelector('.spmenu-close'); if (c) c.addEventListener('click', closeMenu);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    var sw = sp.querySelector('.swipe'), num = sp.querySelector('.swipe-n'), bar = sp.querySelector('.swipe-bar');
    if (sw && num && bar) {
      var n = sw.children.length, raf = 0;
      sw.addEventListener('scroll', function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var max = sw.scrollWidth - sw.clientWidth, p = max > 0 ? clamp(sw.scrollLeft / max, 0, 1) : 0;
          var stepW = sw.children[1] ? sw.children[1].offsetLeft - sw.children[0].offsetLeft : 164;
          var idx = sw.scrollLeft >= max - 4 ? n - 1 : clamp(Math.round(sw.scrollLeft / stepW), 0, n - 1);
          num.textContent = '0' + (idx + 1) + ' / 0' + n;
          bar.style.transform = 'translateX(' + (p * (n - 1) * 100).toFixed(1) + '%)';
        });
      }, { passive: true });
    }
  }

  /* ---------- はじまり ---------- */
  q(d, '[data-plx]').forEach(function (el) {
    plx.push({ el: el, f: parseFloat(el.getAttribute('data-plx')), fv: el.hasAttribute('data-plx-fv'), sc: el.getAttribute('data-plx-scale') || '', top: 0, h: 0 });
    if (anim && el.getAttribute('data-plx-scale')) el.style.transform = 'scale(' + el.getAttribute('data-plx-scale') + ')';
  });
  q(d, '[data-d]').forEach(function (el) { el.style.setProperty('--d', el.getAttribute('data-d') + 's'); });
  if (anim) {
    var h1 = pc.querySelector('h1[data-op="chars"]'); if (h1) splitChars(h1, parseFloat(h1.getAttribute('data-d') || .9), .12);
    if ('IntersectionObserver' in W) setupReveal();
  }
  setupSections(); setupLinks(); setupSP();
  layout();

  var started = false;
  function start() {
    if (started) return; started = true;
    root.classList.add('is-ready');
    layout();
    setTimeout(function () { trailOn = true; tick(); }, anim ? (S.mode === 'pc' ? 1700 : 500) : 0);
  }
  var hero = (mq.matches ? pc : sp).querySelector('img');
  var waits = [];
  if (hero && !hero.complete) waits.push(new Promise(function (r) { hero.addEventListener('load', r); hero.addEventListener('error', r); }));
  if (d.fonts && d.fonts.ready) waits.push(d.fonts.ready);
  Promise.all(waits).then(function () { requestAnimationFrame(start); });
  setTimeout(start, 2600);

  W.addEventListener('scroll', tick, { passive: true });
  W.addEventListener('resize', layout);
  if (mq.addEventListener) mq.addEventListener('change', layout);
  W.addEventListener('load', layout);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(layout);
  if ('ResizeObserver' in W) new ResizeObserver(function () { if (S.mode === 'sp') { var h = sp.offsetHeight; if (h) root.style.setProperty('--sph', h); } }).observe(sp);
})();
