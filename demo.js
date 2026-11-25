/* 山本香料 トップページ デモ ／ 動きの制御
   01 香りの流れ（書から書まで、斜めに行き来しながら続く線。いつもゆっくり波打つ） 02 香りの霞 03 香り立ち（写真）
   04 香りの粒 05 見出しの現れ方 06 香りのノート表示 ／ ヘッダーは画面上に固定
   スマホは 01・02・04 だけを動かす（演出ガイドの決めごと）。 */
(function () {
  'use strict';
  var d = document, root = d.documentElement, W = window;
  var anim = root.classList.contains('js');           // 動きを減らす設定の人は false
  var mq = W.matchMedia('(min-width:768px)');
  var pc = d.querySelector('.yp'), sp = d.querySelector('.sp');
  var noteEl = d.querySelector('.note');
  var S = { k: 1, mode: '', vh: W.innerHeight, w: 0, fvh: 0 };
  var secs = { pc: [], sp: [] };
  var plx = [];
  var ghd = { pc: d.querySelector('.ghd-pc'), sp: d.querySelector('.ghd-sp'), solid: null, light: null };

  function q(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- 画面幅に合わせた倍率 ---------- */
  function layout() {
    var w = root.clientWidth || W.innerWidth, isPC = mq.matches;
    S.mode = isPC ? 'pc' : 'sp';
    S.k = isPC ? Math.min(w, 1920) / 1440 : w / 390;
    // スマホはアドレスバーの出入りで高さが変わるので、高さは幅が変わったときだけ読み直す
    if (isPC || w !== S.w || !S.vh) S.vh = W.innerHeight;
    S.w = w;
    root.style.setProperty('--k', S.k.toFixed(5));
    if (isPC) {
      // 最初の画面＝画面の高さ（ヘッダーは上に重なる）。極端な縦長・横長では 720〜960 に収める
      var fvh = Math.round(clamp(S.vh / S.k, 720, 960));
      if (fvh !== S.fvh) { S.fvh = fvh; root.style.setProperty('--fvh', fvh); }
      root.style.setProperty('--pch', pc.offsetHeight);
    } else { var h = sp.offsetHeight; if (h) root.style.setProperty('--sph', h); }
    var el = isPC ? pc : sp;
    secs[S.mode] = q(el, '.sec').map(function (s) {
      return { el: s, name: s.getAttribute('data-sec'), tone: s.getAttribute('data-tone'), top: s.offsetTop, h: s.offsetHeight };
    });
    if (isPC) { plx.forEach(function (p) { var s = secOf(p.el); p.top = s.offsetTop; p.h = s.offsetHeight; }); placeNote(); }
    ghd.solid = ghd.light = null;
    tick();
  }
  function secOf(el) { while (el && !(el.classList && el.classList.contains('sec'))) el = el.parentNode; return el; }

  /* ---------- 04 香りの粒（共通）：SVGの丸を、なめらかに動かせる小さな光（HTML）に置き換える ---------- */
  function makeMotes(svg, box, seed, spread) {
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, list = [];
    q(svg, '.mo').forEach(function (c) {
      var x = +c.getAttribute('cx'), y = +c.getAttribute('cy'), r = +c.getAttribute('r'), sz = (r * 2.3).toFixed(1);
      var i = d.createElement('i'); i.className = 'mote';
      i.style.cssText = 'left:' + (x - r) + 'px;top:' + (y - r) + 'px;width:' + sz + 'px;height:' + sz + 'px;color:' + c.getAttribute('fill') +
        ';--mx:' + ((rnd() * 2 - 1) * spread).toFixed(0) + 'px;--my:' + (-50 - rnd() * 80).toFixed(0) + 'px;--mt:' + (8 + rnd() * 5).toFixed(1) + 's;--md:' + (-rnd() * 12).toFixed(1) + 's;--mo:' + Math.min(.85, +c.getAttribute('opacity') + .1).toFixed(2);
      box.appendChild(i); c.parentNode.removeChild(c);
      list.push({ el: i, y: y, on: false });
    });
    return list;
  }

  /* ---------- 最初の画面：書のまわりから立ちのぼる粒 ---------- */
  var sparks = { pc: [], sp: [] }, flowsOn = !anim;
  function setupSparks() {
    [['pc', pc], ['sp', sp]].forEach(function (m) {
      q(m[1], '.fv-sparks').forEach(function (el) { if (anim) sparks[m[0]] = sparks[m[0]].concat(makeMotes(el.querySelector('svg'), el, m[0] === 'pc' ? 7 : 101, 30)); });
    });
  }

  /* ---------- 01 香りの流れ ----------
     最初の画面の書から、お問い合わせの書まで、3本の細い線が斜めに行き来しながら続く。
     線はいつも、風に揺れる煙のようにゆっくり波打つ（波は線に沿って流れる。先端を走らせて描くことはしない）。
     スクロールしている間は波が少し速くなり、止めると静かにもとの速さに戻る。
     形を作り直すのは画面に見えている部分だけ（線を600pxずつに分けておく）。 */
  var TR = { pc: null, sp: null }, CH = 30, STEP = 20;
  function setupTrail() {
    var data = W.YP_TRAIL; if (!anim || !data) return;
    [['pc', pc], ['sp', sp]].forEach(function (m) {
      var svg = m[1].querySelector('svg.trail'), D = data[m[0]];
      if (!svg || !D) return;
      var tr = { svg: svg, chunks: [], motes: [], t: 0 };
      D.strands.forEach(function (st, si) {
        var P = st.p, n = P.length / 2, nx = new Float32Array(n), ny = new Float32Array(n);
        for (var i = 0; i < n; i++) {
          var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = P[2 * b] - P[2 * a], dy = P[2 * b + 1] - P[2 * a + 1], L = Math.sqrt(dx * dx + dy * dy) || 1;
          nx[i] = -dy / L; ny[i] = dx / L;
        }
        var S2 = { P: P, n: n, nx: nx, ny: ny, w1: st.w1, w2: st.w2, L: st.L };
        var orig = svg.querySelector('path[data-strand="' + si + '"]');
        for (var a2 = 0; a2 < n - 1; a2 += CH) {
          var b2 = Math.min(n - 1, a2 + CH), el = orig.cloneNode(false), y0 = 1e9, y1 = -1e9;
          for (var j = a2; j <= b2; j++) { y0 = Math.min(y0, P[2 * j + 1]); y1 = Math.max(y1, P[2 * j + 1]); }
          orig.parentNode.insertBefore(el, orig);
          tr.chunks.push({ el: el, S: S2, a: a2, b: b2, y0: y0 - 50, y1: y1 + 50 });
        }
        orig.parentNode.removeChild(orig);
      });
      var box = d.createElement('div'); box.className = 'tmotes'; box.setAttribute('aria-hidden', 'true');
      svg.parentNode.insertBefore(box, svg.nextSibling);
      tr.motes = makeMotes(svg, box, m[0] === 'pc' ? 13 : 113, 26);
      TR[m[0]] = tr;
    });
    if (TR.pc || TR.sp) requestAnimationFrame(loop);
  }
  var TAU = Math.PI * 2, qx = new Float32Array(CH + 3), qy = new Float32Array(CH + 3);
  function chunkPath(c, t) {
    var S2 = c.S, P = S2.P, w1 = S2.w1, w2 = S2.w2, L = S2.L, a = Math.max(0, c.a - 1), b = Math.min(S2.n - 1, c.b + 1), m = 0;
    for (var i = a; i <= b; i++, m++) {
      var s = i * STEP, env = Math.min(1, s / 300, (L - s) / 300);
      var o = env * (w1[0] * Math.sin(TAU * (s - w1[2] * t) / w1[1] + w1[3]) + w2[0] * Math.sin(TAU * (s - w2[2] * t) / w2[1] + w2[3]));
      qx[m] = P[2 * i] + S2.nx[i] * o; qy[m] = P[2 * i + 1] + S2.ny[i] * o;
    }
    var f = c.a - a, last = m - 1 - (b - c.b), dd = 'M' + qx[f].toFixed(1) + ',' + qy[f].toFixed(1);
    for (var k2 = f; k2 < last; k2++) {
      var p0 = k2 > 0 ? k2 - 1 : k2, p3 = k2 + 2 <= m - 1 ? k2 + 2 : k2 + 1;
      dd += 'C' + (qx[k2] + (qx[k2 + 1] - qx[p0]) / 6).toFixed(1) + ',' + (qy[k2] + (qy[k2 + 1] - qy[p0]) / 6).toFixed(1) + ' ' +
        (qx[k2 + 1] - (qx[p3] - qx[k2]) / 6).toFixed(1) + ',' + (qy[k2 + 1] - (qy[p3] - qy[k2]) / 6).toFixed(1) + ' ' + qx[k2 + 1].toFixed(1) + ',' + qy[k2 + 1].toFixed(1);
    }
    return dd;
  }
  var lastNow = 0, lastSy = -1, boost = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = clamp((now - lastNow) / 1000 || .016, .001, .05); lastNow = now;
    var tr = TR[S.mode]; if (!tr || d.hidden) return;
    var sy = W.pageYOffset || root.scrollTop || 0, v = lastSy < 0 ? 0 : Math.abs(sy - lastSy) / dt; lastSy = sy;
    // スクロールの速さに合わせて、波を最大3倍まで速める（ゆっくり戻す）
    boost += (Math.min(2, v / 900) - boost) * (1 - Math.exp(-dt * (v > 0 ? 4 : 1.6)));
    tr.t += dt * (1 + boost);
    var k = S.k, off = S.mode === 'pc' ? S.fvh - 800 : 0, y0 = sy / k - off - 120, y1 = (sy + S.vh) / k - off + 120;
    for (var i = 0; i < tr.chunks.length; i++) { var c = tr.chunks[i]; if (c.y1 < y0 || c.y0 > y1) continue; c.el.setAttribute('d', chunkPath(c, tr.t)); }
    for (var j = 0; j < tr.motes.length; j++) {
      var mo = tr.motes[j], on = flowsOn && mo.y > y0 - 60 && mo.y < y1 + 60;
      if (on !== mo.on) { mo.on = on; mo.el.classList.toggle('on', on); }
    }
    if (flowsOn) for (var n2 = 0; n2 < sparks[S.mode].length; n2++) { var sp2 = sparks[S.mode][n2]; if (!sp2.on) { sp2.on = true; sp2.el.classList.add('on'); } }
  }

  /* ---------- ヘッダー：画面上に固定。下の区画の明るさに合わせて背景を切り替える ---------- */
  function updateHeader(sy, k) {
    var g = ghd[S.mode]; if (!g) return;
    var solid = sy > 24, hh = S.mode === 'pc' ? (solid ? 76 : 104) : (solid ? 58 : 68), light = false;
    var y = (sy + hh * k * .5) / k, list = secs[S.mode];
    for (var i = 0; i < list.length; i++) if (y < list[i].top + list[i].h) { light = list[i].tone === 'light'; break; }
    if (solid !== ghd.solid) { ghd.solid = solid; ghd.pc.classList.toggle('is-solid', solid); ghd.sp.classList.toggle('is-solid', solid); }
    if (light !== ghd.light) { ghd.light = light; ghd.pc.classList.toggle('is-light', light); ghd.sp.classList.toggle('is-light', light); }
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
    updateHeader(sy, k);
    if (S.mode === 'pc') {
      updateNote((sy + vh * .5) / k, sy, vh, k);
      if (anim) {
        for (var i = 0; i < plx.length; i++) {
          var p = plx[i], top = p.top * k - sy, h = p.h * k;
          if (top > vh + 300 || top + h < -300) continue;
          var v = p.fv ? Math.max(0, sy / k) * p.f : -clamp((top + h / 2 - vh / 2) / vh, -1, 1) * p.f;
          p.el.style.transform = 'translate3d(0,' + v.toFixed(2) + 'px,0)' + (p.sc ? ' scale(' + p.sc + ')' : '');
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
    // About の縦長写真3枚とその札
    q(pc, '.mu').forEach(function (c, i) { group(c, [bloom(c.querySelector('img'), i * .18)]); });
    q(pc, '.mu-cap').forEach(function (c, i) { group(c, [rv(c, .6 + i * .18)]); });
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
    q(pc, '[data-sec="technology"] > div > img.ph, [data-sec="sustainability"] > div > img.ph, [data-sec="recruit"] .plx > img, [data-sec="contact"] .ink > img').forEach(function (img) {
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
  setupSparks(); setupTrail(); setupSections(); setupLinks(); setupSP();
  layout();

  var started = false;
  function start() {
    if (started) return; started = true;
    root.classList.add('is-ready');
    layout();
    setTimeout(function () { flowsOn = true; tick(); }, anim ? (S.mode === 'pc' ? 1400 : 500) : 0);
  }
  var hero = (mq.matches ? pc : sp).querySelector('.ink img');
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
