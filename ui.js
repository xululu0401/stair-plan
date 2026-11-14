/* 排楼梯 · 界面（ui.js）
 * 把输入读成 state → 交给 AppCore.compute → 把同一次输出画出来。页面不自己算数。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'stair-plan:v1';
  var TOP = A.SCALARS.slice();
  var $ = function (id) { return document.getElementById(id); };
  var state = load() || A.defaultState();
  var out = null;

  function str(v) { return String(v == null ? '' : v); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), any = false;
    TOP.concat(['mode', 'pick']).forEach(function (k) { if (s[k] != null) { d[k] = str(s[k]); any = true; } });
    return any ? d : null;
  }
  function load() {
    try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state })); $('saveTag').textContent = '· 已存到本机'; }
    catch (e) { $('saveTag').textContent = '· 没能存到本机'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var f0 = function (x) { return A.fmtV(x, 0); }, f1 = function (x) { return A.fmtV(x, 1); };

  function renderPresets() {
    var k = A.presetKey(state);
    $('presets').innerHTML = A.PRESETS.map(function (p) {
      return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (k === p.key) + '">' + esc(p.name) + '</button>';
    }).join('');
    var cur = A.PRESETS.filter(function (p) { return p.key === k; })[0];
    $('presetNote').textContent = cur ? cur.note : '已按你的输入计算（不是预设）。';
  }
  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    state = A.stateFromPreset(b.getAttribute('data-p')); fillAll(); update();
  });
  $('modeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-m]'); if (!b) return;
    state.mode = b.getAttribute('data-m'); state.pick = ''; update();
  });
  TOP.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = $(k).value; update(); }); });
  function fillAll() { TOP.forEach(function (k) { $(k).value = state[k]; }); }

  /* ── 剖面：横轴是水平距离，纵轴是高度，等比例（viewBox 等比缩放，不拉伸） ── */
  function section() {
    var v = out.v, c = out.chosen, W = 960, Hh = 360, padL = 20, padR = 20, padT = 22, padB = 30;
    var run = c ? c.run : 0, span = Math.max(v.L, run) + 900;
    var sc = Math.min((W - padL - padR) / span, (Hh - padT - padB) / (v.H + 250));
    var x0 = (W - span * sc) / 2 + 450 * sc, X = function (x) { return (x0 + x * sc).toFixed(1); }, Y = function (y) { return (Hh - padB - y * sc).toFixed(1); };
    var s = '', xmin = -450, xmax = span - 450;
    s += '<line x1="' + X(xmin) + '" y1="' + Y(0) + '" x2="' + X(xmax) + '" y2="' + Y(0) + '" stroke="#5a544a" stroke-width="2"/>';
    /* 楼下能给的长度 */
    s += '<line x1="' + X(0) + '" y1="' + (+Y(0) + 14) + '" x2="' + X(v.L) + '" y2="' + (+Y(0) + 14) + '" stroke="#8a8378" stroke-width="1.5" stroke-dasharray="5 4"/>';
    s += '<text x="' + X(v.L / 2) + '" y="' + (+Y(0) + 27) + '" font-size="12" fill="#8a8378" text-anchor="middle">楼下能给 ' + f0(v.L) + '</text>';
    if (!c) {
      s += '<rect x="' + X(xmin) + '" y="' + Y(v.H) + '" width="' + ((xmax - xmin) * sc).toFixed(1) + '" height="' + (v.slab * sc).toFixed(1) + '" fill="#c9c2b6"/>';
      s += '<text x="' + X(v.L / 2) + '" y="' + Y(v.H / 2) + '" font-size="16" fill="#a33a2c" text-anchor="middle">现在的条件下排不出楼梯</text>';
      return s;
    }
    var reach = c.slabReach;
    /* 楼板：起步那头伸到 reach，到达那头从 run 开始 */
    if (reach > 0) s += '<rect x="' + X(xmin) + '" y="' + Y(v.H) + '" width="' + ((reach - xmin) * sc).toFixed(1) + '" height="' + (v.slab * sc).toFixed(1) + '" fill="#c9c2b6"/>';
    else s += '<rect x="' + X(xmin) + '" y="' + Y(v.H) + '" width="' + ((Math.max(0, reach) - xmin) * sc).toFixed(1) + '" height="' + (v.slab * sc).toFixed(1) + '" fill="#c9c2b6"/>';
    s += '<rect x="' + X(run) + '" y="' + Y(v.H) + '" width="' + ((xmax - run) * sc).toFixed(1) + '" height="' + (v.slab * sc).toFixed(1) + '" fill="#c9c2b6"/>';
    var oa = Math.max(0, reach);
    s += '<rect x="' + X(oa) + '" y="' + Y(v.H) + '" width="' + ((run - oa) * sc).toFixed(1) + '" height="' + (v.slab * sc).toFixed(1) + '" fill="#e2eef4" stroke="#2c5e7a" stroke-width="1"/>';
    s += '<text x="' + X((oa + run) / 2) + '" y="' + (+Y(v.H) - 6) + '" font-size="12" fill="#2c5e7a" text-anchor="middle">洞口 ' + f0(c.opening) + '</text>';
    /* 踏步 */
    var d = 'M' + X(0) + ' ' + Y(0);
    for (var j = 1; j <= c.n; j++) {
      d += ' L' + X((j - 1) * c.T) + ' ' + Y(j * c.R);
      if (j < c.n) d += ' L' + X(j * c.T) + ' ' + Y(j * c.R);
    }
    d += ' L' + X(run) + ' ' + Y(0) + ' Z';
    s += '<path d="' + d + '" fill="#e9dccb" stroke="#9a6b3a" stroke-width="2" stroke-linejoin="miter"/>';
    /* 净空线：前沿连线往上 head */
    /* 只画到碰楼板底那一点（= 洞口边缘）；整段开洞时画到净空线升到楼板底或楼梯尽头 */
    var xe = reach > 0 ? reach : Math.min(run, Math.max(0, (v.H - v.slab - v.head - c.R) * c.T / c.R));
    if (reach <= 0) xe = run;
    var ye = Math.min(v.H - v.slab, c.R + xe * c.R / c.T + v.head);
    s += '<line x1="' + X(0) + '" y1="' + Y(Math.min(v.H - v.slab, c.R + v.head)) + '" x2="' + X(xe) + '" y2="' + Y(ye) + '" stroke="#a33a2c" stroke-width="1.5" stroke-dasharray="6 4"/>';
    if (reach > 0) s += '<circle cx="' + X(reach) + '" cy="' + Y(v.H - v.slab) + '" r="4" fill="#a33a2c"/>';
    if (run > v.L) s += '<line x1="' + X(v.L) + '" y1="' + Y(0) + '" x2="' + X(v.L) + '" y2="' + Y(v.H) + '" stroke="#a33a2c" stroke-width="1" stroke-dasharray="3 3"/>';
    s += '<text x="' + X(run / 2) + '" y="' + (+Y(0) - 6) + '" font-size="12" fill="#5a544a" text-anchor="middle">水平长 ' + f0(run) + '</text>';
    return s;
  }

  function markErrors() {
    document.querySelectorAll('.f.bad').forEach(function (f) { f.classList.remove('bad'); });
    (out.errors || []).forEach(function (e) { if ($('f_' + e.field)) $('f_' + e.field).classList.add('bad'); });
  }
  function render() {
    var bad = !out.ok;
    $('errBox').classList.toggle('hide', !bad);
    $('okBody').classList.toggle('hide', bad);
    $('cmpCard').classList.toggle('hide', bad);
    $('layCard').classList.toggle('hide', bad || !out.chosen);
    if (bad) {
      $('errBox').innerHTML = '<b>还算不出来</b>，先把这些改对（原文都保留着）：<ul>' + out.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>';
      return;
    }
    var v = out.v, c = out.chosen;
    ['comfort', 'compact'].forEach(function (m) { $('m_' + m).setAttribute('aria-pressed', String(v.mode === m)); });
    $('lgHead').textContent = f0(v.head);
    $('verdict').className = 'verdict ' + (c ? 'good' : 'bad');
    if (c) {
      $('vBig').textContent = c.n + ' 级，每级 ' + f1(c.R) + ' mm，踏面 ' + c.T + ' mm';
      $('vTx').innerHTML = '楼下占 <b>' + c.run + ' mm</b>（能给 ' + f0(v.L) + '），楼板洞口开 <b>' + f0(c.opening) + ' mm</b>' + (isFinite(v.open) ? '（最多 ' + f0(v.open) + '）' : '') + '，步距 2R+T = ' + f1(c.step) + ' mm，坡度 ' + f1(c.angle) + '°。' +
        (out.chosen.n === out.rec ? ' 这是' + (v.mode === 'compact' ? '能做的里最省地方' : '能做的里级数最多、每级最矮') + '的一种。' : ' 这是你点选的级数，推荐的是 ' + out.rec + ' 级。') +
        (out.goodCount > 1 ? ' 一共 ' + out.goodCount + ' 种级数能做。' : '') + (out.pickNote ? ' ' + esc(out.pickNote) : '');
    } else {
      $('vBig').textContent = '这几种级数都排不下';
      $('vTx').innerHTML = '试了 ' + out.plans[0].n + '–' + out.plans[out.plans.length - 1].n + ' 级，每一种都有条件卡住，原因写在下面表里。' + (out.actions.length ? ' 下面有 ' + out.actions.length + ' 种放宽长度或洞口就能做的办法。' : ' 只放宽长度和洞口也不够，要改踏步尺寸区间。');
    }
    $('sect').innerHTML = section();

    /* 对照表：每种级数一列 */
    var P = out.plans, sel = c ? c.n : null;
    var cls = function (p) { return p.n === sel ? ' class="sel"' : !p.ok ? ' class="no"' : ''; };
    var row = function (label, fn) { return '<tr><td>' + label + '</td>' + P.map(function (p) { return '<td' + cls(p) + '>' + (p.ok ? fn(p) : '—') + '</td>'; }).join('') + '</tr>'; };
    $('cmp').innerHTML = '<thead><tr><th>级数</th>' + P.map(function (p) {
      return '<th' + cls(p) + '><button type="button" class="colbtn" id="col_' + p.n + '" data-n="' + p.n + '" aria-pressed="' + (p.n === sel) + '"' + (p.ok ? '' : ' disabled') + '>' + p.n + ' 级</button></th>';
    }).join('') + '</tr></thead><tbody>' +
      '<tr><td>每级高 mm</td>' + P.map(function (p) { return '<td' + cls(p) + '>' + f1(p.R) + '</td>'; }).join('') + '</tr>' +
      row('踏面 mm', function (p) { return p.T; }) +
      '<tr><td>踏面可选 mm</td>' + P.map(function (p) { return '<td' + cls(p) + '>' + (p.ok ? p.Tl + '–' + p.Th : '—') + '</td>'; }).join('') + '</tr>' +
      row('步距 2R+T', function (p) { return f1(p.step); }) +
      row('水平长 mm', function (p) { return p.run; }) +
      row('洞口 mm', function (p) { return f0(p.opening); }) +
      row('坡度', function (p) { return f1(p.angle) + '°'; }) +
      row('占地 m²', function (p) { return A.fmtV(p.area, 2); }) +
      '<tr><td>能不能做</td>' + P.map(function (p) { return '<td class="why' + (p.n === sel ? ' sel' : !p.ok ? ' no' : '') + '">' + esc(A.reasonTx(p, v)) + '</td>'; }).join('') + '</tr></tbody>';

    $('actsBlock').classList.toggle('hide', !out.actions.length);
    $('acts').innerHTML = out.actions.map(function (a, i) { return '<button type="button" class="act" id="act_' + a.n + '" data-a="' + i + '">→ ' + esc(a.text) + '</button>'; }).join('');

    $('warnBox').classList.toggle('hide', !out.warnings.length);
    $('warnBox').innerHTML = '<ul>' + out.warnings.map(function (w) { return '<li>' + esc(w.message) + '</li>'; }).join('') + '</ul>';

    if (c) {
      $('laySub').textContent = c.n + ' 级 · 从楼下地面量，前沿离起步是从第一级踢面量的水平距离';
      $('lay').innerHTML = '<tr><th>第几级</th><th>顶面高 mm</th><th>这一级高 mm</th><th>前沿离起步 mm</th></tr>' +
        out.rows.map(function (r) { return '<tr' + (r.top_floor ? ' class="top"' : '') + '><td>' + r.j + (r.top_floor ? ' 上层地面' : '') + '</td><td>' + r.top + '</td><td>' + r.rise + '</td><td>' + r.x + '</td></tr>'; }).join('');
    }
  }
  $('cmp').addEventListener('click', function (e) {
    var b = e.target.closest('[data-n]'); if (!b || b.disabled) return;
    var n = +b.getAttribute('data-n');
    state.pick = n === out.rec ? '' : String(n); update();
  });
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    state = A.applyAction(state, out.actions[+b.getAttribute('data-a')]); fillAll(); update();
  });

  function update() { out = A.compute(state); markErrors(); render(); renderPresets(); save(); }

  /* ── 导出 ── */
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  $('dlCsv').addEventListener('click', function () { download('排楼梯.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { download('排楼梯.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () {
    download('排楼梯-备份.json', new Blob([JSON.stringify({ app: '排楼梯', slug: 'stair-plan', version: 1, exported_at: stamp(), state: state, out: out }, null, 2)], { type: 'application/json' }));
  });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var r = new FileReader(); r.onload = function () { importText(String(r.result)); }; r.readAsText(f); this.value = '';
  });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fillAll(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fillAll(); update(); });

  /* PNG 方案卡 1080×1350：所有文字取自 out。按「词」折行，数字串不拆。 */
  function wrapText(ctx, text, maxW) {
    var toks = String(text).match(/[0-9A-Za-z.:+\-×%\/°²]+|\s|./g) || [];
    var merged = [];
    toks.forEach(function (tk) { if (merged.length && /^[，。、；：）」%,.;:)]$/.test(tk)) merged[merged.length - 1] += tk; else merged.push(tk); });
    var lines = [], cur = '';
    merged.forEach(function (tk) {
      if (cur && ctx.measureText(cur + tk).width > maxW) { lines.push(cur.replace(/\s+$/, '')); cur = /^\s$/.test(tk) ? '' : tk; }
      else cur += tk;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var F = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', M = 'ui-monospace,Menlo,Consolas,monospace';
    g.fillStyle = '#f3f0ea'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.fillRect(48, 48, W - 96, H - 96);
    g.fillStyle = '#9a6b3a'; g.fillRect(48, 48, W - 96, 10);
    var L = 92, R = W - 92, maxW = R - L, y = 135;
    function para(t, size, color, lh, max, bold) {
      g.font = (bold ? '700 ' : '') + size + 'px ' + F; g.fillStyle = color;
      var ls = wrapText(g, t, maxW); if (max && ls.length > max) { ls = ls.slice(0, max); ls[max - 1] = ls[max - 1].slice(0, -1) + '…'; }
      ls.forEach(function (l) { g.fillText(l, L, y); y += lh; });
    }
    g.font = '700 42px ' + F; g.fillStyle = '#2a2620'; g.fillText('排楼梯 · 方案卡', L, y); y += 44;
    g.font = '22px ' + F; g.fillStyle = '#8a8378'; g.fillText('导出时间 ' + stamp() + ' · 默认场景为虚构示例', L, y); y += 64;
    if (!out.ok) {
      para('还算不出来', 44, '#a33a2c', 60, 1, true);
      out.errors.slice(0, 12).forEach(function (e) { para('· ' + e.message, 26, '#5a544a', 38, 2); });
      return cv;
    }
    var v = out.v, c = out.chosen;
    para('层高 ' + f0(v.H) + ' · 楼板 ' + f0(v.slab) + ' · 净空 ' + f0(v.head) + ' · 楼下能给 ' + f0(v.L) + ' · 洞口最长 ' + (isFinite(v.open) ? f0(v.open) : '不限') + '（mm）', 24, '#5a544a', 34, 2);
    y += 46;
    if (c) {
      para(c.n + ' 级，每级 ' + f1(c.R) + ' mm，踏面 ' + c.T + ' mm', 50, '#9a6b3a', 64, 2, true);
      para('水平长 ' + c.run + ' · 洞口 ' + f0(c.opening) + ' · 步距 ' + f1(c.step) + ' · 坡度 ' + f1(c.angle) + '°', 28, '#2a2620', 40, 2);
    } else {
      para('这几种级数都排不下', 50, '#a33a2c', 64, 1, true);
    }
    y += 16;
    g.strokeStyle = '#e3ddd2'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.setLineDash([]); y += 50;
    var cols = [L, L + 130, L + 290, L + 440, L + 610];
    g.font = '21px ' + F; g.fillStyle = '#8a8378';
    ['级数', '每级高', '踏面', '水平长', '能不能做'].forEach(function (t, i) { g.fillText(t, cols[i], y); }); y += 46;
    var rows = out.plans.slice(0, 10), lh = Math.min(60, Math.floor((H - 300 - y - (out.actions.length ? 60 + Math.min(3, out.actions.length) * 74 : 0)) / rows.length));
    rows.forEach(function (p) {
      var isSel = c && c.n === p.n;
      g.font = (isSel ? '700 ' : '') + '27px ' + M; g.fillStyle = isSel ? '#2c5e7a' : p.ok ? '#2a2620' : '#a33a2c';
      g.fillText(p.n + (isSel ? ' ●' : ''), cols[0], y); g.fillText(f1(p.R), cols[1], y);
      g.fillText(p.ok ? String(p.T) : '—', cols[2], y); g.fillText(p.ok ? String(p.run) : '—', cols[3], y);
      g.font = '22px ' + F;
      var SH = { tMax: '踏面太宽', rule: '步距超限', length: '长度不够', open: '洞口不够' };
      var why = p.ok ? '能做' : p.blocks.map(function (b) { return SH[b]; }).join('、');
      g.fillText(why, cols[4], y);
      y += lh;
    });
    if (out.actions.length) {
      y += 6; g.strokeStyle = '#e3ddd2'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(L, y - 20); g.lineTo(R, y - 20); g.stroke(); g.setLineDash([]); y += 26;
      out.actions.slice(0, 3).forEach(function (a) { if (y < H - 150) { para('→ ' + a.text, 24, '#1f4256', 32, 2); y += 10; } });
    }
    /* 剩下的空白画一张小剖面（同一次 out 的 n / R / T / 洞口） */
    if (c && H - 150 - y > 200) {
      var top = y + 10, bot = H - 140, bh = bot - top, span = Math.max(v.L, c.run) + 600;
      var sc = Math.min((R - L) / span, (bh - 30) / (v.H + 200)), ox = L + 300 * sc, oy = bot - 20;
      var PX = function (x) { return ox + x * sc; }, PY = function (h) { return oy - h * sc; };
      g.fillStyle = '#c9c2b6'; g.fillRect(L, PY(v.H), PX(Math.max(0, c.slabReach)) - L, v.slab * sc); g.fillRect(PX(c.run), PY(v.H), R - PX(c.run), v.slab * sc);
      g.fillStyle = '#e2eef4'; g.fillRect(PX(Math.max(0, c.slabReach)), PY(v.H), (c.run - Math.max(0, c.slabReach)) * sc, v.slab * sc);
      g.beginPath(); g.moveTo(PX(0), PY(0));
      for (var j = 1; j <= c.n; j++) { g.lineTo(PX((j - 1) * c.T), PY(j * c.R)); if (j < c.n) g.lineTo(PX(j * c.T), PY(j * c.R)); }
      g.lineTo(PX(c.run), PY(0)); g.closePath(); g.fillStyle = '#e9dccb'; g.fill(); g.strokeStyle = '#9a6b3a'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#5a544a'; g.beginPath(); g.moveTo(L, oy); g.lineTo(R, oy); g.stroke();
      g.font = '20px ' + F; g.fillStyle = '#2c5e7a'; g.textAlign = 'center';
      g.fillText('洞口 ' + f0(c.opening), PX((Math.max(0, c.slabReach) + c.run) / 2), PY(v.H) - 10);
      g.fillStyle = '#5a544a'; g.fillText('水平长 ' + c.run, PX(c.run / 2), oy + 26); g.textAlign = 'left';
    }
    g.font = '21px ' + F; g.fillStyle = '#8a8378';
    g.fillText('直跑、不带平台的几何估算，不是规范审查；尺寸区间按你自己的要求改', L, H - 92);
    return cv;
  }
  $('dlPng').addEventListener('click', function () {
    drawCard().toBlob(function (b) { if (b) download('排楼梯-1080x1350.png', b); }, 'image/png');
  });

  window.__stairUi = {
    state: function () { return JSON.parse(JSON.stringify(state)); },
    out: function () { return out; },
    importText: importText, drawCard: drawCard, storageKey: KEY
  };

  fillAll(); update();
})();
