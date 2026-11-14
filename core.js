/* 排楼梯 · 核心（core.js）
 * 纯函数，不碰 DOM、不读当前时间、不用随机：同样的输入永远给同样的输出。
 *
 * 一部直跑楼梯（中间不带平台），从下层地面走到上层地面：
 *   层高 H（地面到地面）、踏步高的可接受区间 [rMin, rMax]、踏面宽区间 [tMin, tMax]、
 *   步距规则 sMin ≤ 2R + T ≤ sMax、楼下能给楼梯的水平长度 L、上层楼板厚 s、头顶净空 h、楼板洞口最长能开多长 O
 *   → 级数 n（踢面个数）逐个试：n 从 ceil(H/rMax) 到 floor(H/rMin)，每级高 R = H/n
 *   → 踏面个数 n−1（最上一级就是上层地面），水平总长 run = (n−1)·T
 *   → 头顶净空：按踏步前沿连线竖直量。前沿连线高 y(x) = R + x·R/T（x 从第一级踢面量起）
 *       楼板底高 H − s，要求 (H − s) − y(x) ≥ h → 楼板最多伸到 x0 = (H − s − h − R)·T/R
 *       洞口长 = run − x0 = T·(s + h)/R；x0 ≤ 0 时整段都要开：洞口长 = run
 *       合起来：洞口长 = T · k，k = min(n − 1, (s + h)/R)
 *   → 对每个 n，T 必须同时满足：
 *       下界 lo = max(tMin, sMin − 2R)
 *       上界 hi = min(tMax, sMax − 2R, L/(n−1), O/k)
 *     T 取整毫米：[ceil(lo), floor(hi)]；空区间 → 这个级数做不了，并说清是哪条卡住
 *   → 「好走」：T 取离 (sMin+sMax)/2 − 2R 最近的整毫米（一样近取宽的），推荐能做的里级数最多（每级最矮）的一种
 *     「省地方」：T 取最窄的 ceil(lo)，推荐能做的里水平总长最短的一种
 *   → 做不了的级数：如果只是长度/洞口不够，给出「长度放到多少、洞口开到多少」就能做（按它改完重算一遍确认）
 *
 * 模型是几何估算（设计选择），不是规范审查；默认数据是虚构示例。
 * 做不到的情形一律返回 ok=false 和错误清单，绝不返回 0 冒充结果。
 */
(function (root) {
  'use strict';

  var EPS = 1e-9;
  var LONG_RUN = 18;

  var FIELDS = {
    H:    { label: '层高（下层地面到上层地面）', unit: 'mm', min: 1500, max: 6000 },
    slab: { label: '上层楼板厚', unit: 'mm', min: 0, max: 400 },
    head: { label: '头顶净空', unit: 'mm', min: 1800, max: 2600 },
    rMin: { label: '每级最矮', unit: 'mm', min: 120, max: 220 },
    rMax: { label: '每级最高', unit: 'mm', min: 120, max: 250 },
    tMin: { label: '踏面最窄', unit: 'mm', min: 180, max: 350 },
    tMax: { label: '踏面最宽', unit: 'mm', min: 200, max: 400 },
    sMin: { label: '步距 2R+T 下限', unit: 'mm', min: 500, max: 700 },
    sMax: { label: '步距 2R+T 上限', unit: 'mm', min: 520, max: 720 },
    L:    { label: '楼下能给楼梯的长度', unit: 'mm', min: 500, max: 15000 },
    open: { label: '楼板洞口最长能开', unit: 'mm', min: 300, max: 15000 },
    width:{ label: '梯宽', unit: 'mm', min: 500, max: 2000 }
  };
  var SCALARS = ['H', 'slab', 'head', 'rMin', 'rMax', 'tMin', 'tMax', 'sMin', 'sMax', 'L', 'open', 'width'];
  var OPTIONAL = { open: true };

  var BASE = {
    H: '2900', slab: '120', head: '2000', rMin: '150', rMax: '180', tMin: '240', tMax: '300',
    sMin: '600', sMax: '640', L: '4500', open: '3600', width: '850', mode: 'comfort', pick: ''
  };
  var PRESETS = [
    { key: 'default', name: '复式加一部直跑梯（默认）', note: '虚构示例：层高 2900，楼板 120 厚，楼下能让出 4.5 米长，楼板洞口最多开 3.6 米。', state: BASE },
    { key: 'loft', name: '阁楼小梯', note: '虚构示例：层高 2400，楼板 100 厚，只让出 2.6 米，洞口最多 2 米；踏步高放宽到 200。',
      state: { H: '2400', slab: '100', head: '1900', rMin: '160', rMax: '200', tMin: '220', tMax: '280', sMin: '580', sMax: '640', L: '2600', open: '2000', width: '700', mode: 'compact', pick: '' } },
    { key: 'tall', name: '挑高客厅', note: '虚构示例：层高 3600，楼板 150 厚，楼下能让 5 米，洞口不限。',
      state: { H: '3600', slab: '150', head: '2100', rMin: '150', rMax: '180', tMin: '250', tMax: '300', sMin: '600', sMax: '640', L: '5000', open: '', width: '1000', mode: 'comfort', pick: '' } }
  ];

  function cloneState(s) { return JSON.parse(JSON.stringify(s)); }
  function defaultState() { return cloneState(BASE); }
  function stateFromPreset(key) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) return cloneState(PRESETS[i].state);
    return defaultState();
  }
  function presetKey(state) {
    var t = JSON.stringify(state);
    for (var i = 0; i < PRESETS.length; i++) if (JSON.stringify(PRESETS[i].state) === t) return PRESETS[i].key;
    return null;
  }

  function fmtV(x, d) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var t = (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, '');
    if (t === '-0') t = '0';
    return t;
  }

  function parseNum(raw, spec) {
    var t = String(raw == null ? '' : raw).trim();
    if (t === '') return { bad: 'empty' };
    if (!/^-?\d+(\.\d+)?$/.test(t)) return { bad: 'nan' };
    var v = Number(t);
    if (!isFinite(v)) return { bad: 'nan' };
    if (v < spec.min - EPS || v > spec.max + EPS) return { bad: 'range' };
    return { v: v };
  }

  function validate(s) {
    var errors = [], v = {};
    SCALARS.forEach(function (k) {
      var f = FIELDS[k];
      if (OPTIONAL[k] && String(s[k] == null ? '' : s[k]).trim() === '') { v[k] = Infinity; return; }
      var r = parseNum(s[k], f);
      if (r.bad) errors.push({ field: k, code: r.bad, message: f.label + (r.bad === 'empty' ? '没填' : r.bad === 'nan' ? '不是数字' : '要在 ' + f.min + '–' + f.max + ' ' + f.unit + ' 之间') });
      else v[k] = r.v;
    });
    if (v.rMin != null && v.rMax != null && v.rMax <= v.rMin) errors.push({ field: 'rMax', code: 'order', message: '每级最高要比每级最矮大' });
    if (v.tMin != null && v.tMax != null && v.tMax < v.tMin) errors.push({ field: 'tMax', code: 'order', message: '踏面最宽不能比最窄小' });
    if (v.sMin != null && v.sMax != null && v.sMax <= v.sMin) errors.push({ field: 'sMax', code: 'order', message: '步距上限要比下限大' });
    if (v.H != null && v.slab != null && v.head != null && v.H - v.slab < v.head - EPS) errors.push({ field: 'head', code: 'head', message: '层高减去楼板厚只有 ' + fmtV(v.H - v.slab, 0) + ' mm，站在楼下地面都不够 ' + fmtV(v.head, 0) + ' mm 净空' });
    v.mode = s.mode === 'compact' ? 'compact' : 'comfort';
    var pk = String(s.pick == null ? '' : s.pick).trim();
    v.pick = /^\d+$/.test(pk) ? +pk : null;
    if (!errors.length) {
      var n0 = Math.ceil(v.H / v.rMax - EPS), n1 = Math.floor(v.H / v.rMin + EPS);
      if (n0 > n1) errors.push({ field: 'rMax', code: 'nolevel', message: '层高 ' + fmtV(v.H, 0) + ' 在每级 ' + fmtV(v.rMin, 0) + '–' + fmtV(v.rMax, 0) + ' mm 之间凑不出整数级（' + (n0 - 1) + ' 级每级 ' + fmtV(v.H / (n0 - 1), 1) + '，' + n0 + ' 级每级 ' + fmtV(v.H / n0, 1) + '）' });
      v.n0 = n0; v.n1 = n1;
    }
    return { errors: errors, v: v };
  }

  /* 洞口系数：洞口长 = T × k */
  function openK(n, R, v) { return Math.min(n - 1, (v.slab + v.head) / R); }

  function planFor(n, v) {
    var R = v.H / n, k = openK(n, R, v), mid = (v.sMin + v.sMax) / 2;
    var lo = Math.max(v.tMin, v.sMin - 2 * R);
    var his = [
      { key: 'tMax', val: v.tMax }, { key: 'rule', val: v.sMax - 2 * R },
      { key: 'length', val: v.L / (n - 1) }, { key: 'open', val: v.open / k }
    ];
    var hi = Infinity; his.forEach(function (b) { if (b.val < hi) hi = b.val; });
    var Tl = Math.ceil(lo - EPS), Th = Math.floor(hi + EPS);
    var p = { n: n, R: R, k: k, lo: lo, hi: hi, Tl: Tl, Th: Th, ok: Tl <= Th, blocks: [] };
    his.forEach(function (b) { if (Math.floor(b.val + EPS) < Tl) p.blocks.push(b.key); });
    /* 只是长度 / 洞口不够 → 可以补：长度放到 (n−1)·Tl，洞口开到 ceil(Tl·k) */
    p.fixable = !p.ok && p.blocks.every(function (b) { return b === 'length' || b === 'open'; });
    p.needL = (n - 1) * Tl;
    p.needOpen = Math.ceil(Tl * k - EPS);
    if (p.ok) {
      var T;
      if (v.mode === 'compact') T = Tl;
      else {
        var tg = mid - 2 * R, best = null;
        /* 整毫米里离目标最近的，一样近取宽的 */
        var c1 = Math.floor(tg), c2 = Math.ceil(tg);
        [c1, c2, Tl, Th].forEach(function (c) {
          if (c < Tl || c > Th) return;
          var d = Math.abs(c - tg);
          if (best == null || d < best.d - EPS || (Math.abs(d - best.d) <= EPS && c > best.T)) best = { T: c, d: d };
        });
        T = best.T;
      }
      p.T = T;
      p.step = 2 * R + T;
      p.run = (n - 1) * T;
      p.opening = T * k;
      p.slabReach = p.run - p.opening;
      p.angle = Math.atan(R / T) * 180 / Math.PI;
      p.area = p.run * v.width / 1e6;
    }
    return p;
  }

  /* 放线表：第 j 级（j = 1..n）顶面累计高度取整毫米，每级高差只差 0/1 mm，累计不漂 */
  function layout(p, v) {
    var rows = [], prev = 0;
    for (var j = 1; j <= p.n; j++) {
      var hgt = Math.round(j * v.H / p.n);
      rows.push({ j: j, top: hgt, rise: hgt - prev, x: (j - 1) * p.T, top_floor: j === p.n });
      prev = hgt;
    }
    return rows;
  }

  function applyAction(state, a) {
    var s = cloneState(state);
    if (a.L != null) s.L = String(a.L);
    if (a.open != null) s.open = String(a.open);
    if (a.n != null) s.pick = String(a.n);
    return s;
  }

  function fixFor(p, v) {
    if (!p.fixable) return null;
    var a = { key: 'fix' + p.n, n: p.n, L: null, open: null, parts: [] };
    if (p.needL > v.L + EPS) { a.L = p.needL; a.parts.push('楼下长度放到 ' + p.needL + ' mm（多 ' + fmtV(p.needL - v.L, 0) + '）'); }
    if (isFinite(v.open) && p.needOpen > v.open + EPS) { a.open = p.needOpen; a.parts.push('洞口开到 ' + p.needOpen + ' mm（多 ' + fmtV(p.needOpen - v.open, 0) + '）'); }
    a.cost = (a.L != null ? a.L - v.L : 0) + (a.open != null ? a.open - v.open : 0);
    a.text = p.n + ' 级（每级 ' + fmtV(p.R, 1) + ' mm）：' + a.parts.join('，');
    return a;
  }

  function compute(state, noCheck) {
    var val = validate(state || {});
    if (val.errors.length) return { ok: false, errors: val.errors };
    var v = val.v, plans = [];
    for (var n = v.n0; n <= v.n1; n++) plans.push(planFor(n, v));
    var good = plans.filter(function (p) { return p.ok; });
    var rec = null;
    good.forEach(function (p) {
      if (!rec) { rec = p; return; }
      if (v.mode === 'compact') { if (p.run < rec.run - EPS || (Math.abs(p.run - rec.run) <= EPS && p.n > rec.n)) rec = p; }
      else if (p.n > rec.n) rec = p;
    });
    var chosen = rec, pickNote = '';
    if (v.pick != null) {
      var hit = plans.filter(function (p) { return p.n === v.pick; })[0];
      if (hit && hit.ok) chosen = hit;
      else pickNote = '你点选的 ' + v.pick + ' 级' + (hit ? '在现在的条件下做不了' : '不在这次能试的级数里') + '，先显示推荐的那种。';
    }
    var actions = [];
    plans.forEach(function (p) {
      var a = fixFor(p, v);
      if (!a || !a.parts.length) return;
      if (!noCheck) {
        var r = compute(applyAction(state, a), true);
        var back = r.ok ? r.plans.filter(function (q) { return q.n === p.n; })[0] : null;
        a.check = !!(back && back.ok && r.chosen && r.chosen.n === p.n);
        if (!a.check) return;
      }
      actions.push(a);
    });
    actions.sort(function (a, b) { return a.cost - b.cost || b.n - a.n; });
    var warnings = [];
    if (chosen && chosen.n > LONG_RUN) warnings.push({ code: 'long', message: '一跑 ' + chosen.n + ' 级，走起来比较长；常见做法是中间加一个平台（这里只算直跑，不算平台）。' });
    if (chosen && chosen.k >= chosen.n - 1 - EPS) warnings.push({ code: 'fullopen', message: '层高不够楼板往前伸：整部楼梯头顶都要开洞（洞口长 = 楼梯水平长）。' });
    if (!isFinite(v.open)) warnings.push({ code: 'noopen', message: '洞口长度没填，按不限算。' });
    var out = {
      ok: true, errors: [], warnings: warnings, v: v, plans: plans, goodCount: good.length,
      rec: rec ? rec.n : null, chosen: chosen, pickNote: pickNote, actions: actions,
      rows: chosen ? layout(chosen, v) : []
    };
    return out;
  }

  /* ── 导出 ── */
  function reasonTx(p, v) {
    if (p.ok) return '能做';
    var m = { tMax: '踏面要比最宽 ' + fmtV(v.tMax, 0) + ' 还宽', rule: '步距规则卡住（每级太高）', length: '长度不够，要 ' + p.needL + ' mm', open: '洞口不够，要开 ' + p.needOpen + ' mm' };
    return p.blocks.map(function (b) { return m[b]; }).join('；');
  }
  function csvCell(x) { var t = String(x == null ? '' : x); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
  function toCSV(out, stamp) {
    var R = [['排楼梯'], ['导出时间', stamp]];
    if (!out.ok) { R.push(['还算不出来']); out.errors.forEach(function (e) { R.push(['错误', e.message]); }); return R.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n'; }
    var v = out.v, c = out.chosen;
    R.push(['层高 mm', v.H], ['楼板厚 mm', v.slab], ['头顶净空 mm', v.head], ['楼下长度 mm', v.L], ['洞口最长 mm', isFinite(v.open) ? v.open : '不限'], ['偏好', v.mode === 'compact' ? '省地方' : '好走']);
    R.push([]); R.push(['级数', '每级高 mm', '踏面宽 mm', '2R+T mm', '水平长 mm', '洞口长 mm', '坡度 °', '能不能做']);
    out.plans.forEach(function (p) {
      R.push([p.n, fmtV(p.R, 1), p.ok ? p.T : '', p.ok ? fmtV(p.step, 1) : '', p.ok ? p.run : '', p.ok ? fmtV(p.opening, 0) : '', p.ok ? fmtV(p.angle, 1) : '', reasonTx(p, v) + (c && c.n === p.n ? '（选用）' : '')]);
    });
    if (c) {
      R.push([]); R.push(['放线表', c.n + ' 级']); R.push(['第几级', '顶面高 mm', '这一级高 mm', '前沿离起步 mm']);
      out.rows.forEach(function (r) { R.push([r.top_floor ? r.j + '（上层地面）' : r.j, r.top, r.rise, r.x]); });
    }
    if (out.actions.length) { R.push([]); out.actions.forEach(function (a) { R.push(['改法', a.text]); }); }
    R.push([]); R.push(['说明', '直跑、不带平台的几何估算，不是规范审查；默认场景为虚构示例']);
    return R.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n';
  }
  function toMD(out, stamp) {
    var L = ['# 排楼梯', '', '导出时间 ' + stamp, ''];
    if (!out.ok) { L.push('还算不出来：', ''); out.errors.forEach(function (e) { L.push('- ' + e.message); }); return L.join('\n') + '\n'; }
    var v = out.v, c = out.chosen;
    L.push('层高 ' + fmtV(v.H, 0) + ' mm，楼板 ' + fmtV(v.slab, 0) + ' mm，净空 ' + fmtV(v.head, 0) + ' mm，楼下能让 ' + fmtV(v.L, 0) + ' mm，洞口最长 ' + (isFinite(v.open) ? fmtV(v.open, 0) + ' mm' : '不限') + '，偏好' + (v.mode === 'compact' ? '省地方' : '好走') + '。', '');
    L.push(c ? '**选用 ' + c.n + ' 级**：每级 ' + fmtV(c.R, 1) + ' mm 高、踏面 ' + c.T + ' mm，2R+T = ' + fmtV(c.step, 1) + ' mm，水平长 ' + c.run + ' mm，洞口 ' + fmtV(c.opening, 0) + ' mm，坡度 ' + fmtV(c.angle, 1) + '°。' : '**这几种级数在现在的条件下都做不了。**', '');
    L.push('## 几种级数并排', '', '| 级数 | 每级高 | 踏面 | 2R+T | 水平长 | 洞口 | 坡度 | 能不能做 |', '|---|---|---|---|---|---|---|---|');
    out.plans.forEach(function (p) {
      L.push('| ' + p.n + (c && c.n === p.n ? '（选用）' : '') + ' | ' + fmtV(p.R, 1) + ' | ' + (p.ok ? p.T : '—') + ' | ' + (p.ok ? fmtV(p.step, 1) : '—') + ' | ' + (p.ok ? p.run : '—') + ' | ' + (p.ok ? fmtV(p.opening, 0) : '—') + ' | ' + (p.ok ? fmtV(p.angle, 1) + '°' : '—') + ' | ' + reasonTx(p, v) + ' |');
    });
    if (c) {
      L.push('', '## 放线表（' + c.n + ' 级）', '', '| 第几级 | 顶面高 | 这一级高 | 前沿离起步 |', '|---|---|---|---|');
      out.rows.forEach(function (r) { L.push('| ' + r.j + (r.top_floor ? '（上层地面）' : '') + ' | ' + r.top + ' | ' + r.rise + ' | ' + r.x + ' |'); });
    }
    if (out.actions.length) { L.push('', '## 想换一种级数（每条都重算确认过）', ''); out.actions.forEach(function (a) { L.push('- ' + a.text); }); }
    if (out.warnings.length) { L.push('', '## 提示', ''); out.warnings.forEach(function (w) { L.push('- ' + w.message); }); }
    L.push('', '> 直跑、不带平台的几何估算，不是规范审查。默认场景为虚构示例。');
    return L.join('\n') + '\n';
  }

  var API = {
    FIELDS: FIELDS, SCALARS: SCALARS, PRESETS: PRESETS, LONG_RUN: LONG_RUN,
    defaultState: defaultState, stateFromPreset: stateFromPreset, presetKey: presetKey, cloneState: cloneState,
    compute: compute, applyAction: applyAction, planFor: planFor, openK: openK, layout: layout,
    fmtV: fmtV, reasonTx: reasonTx, toCSV: toCSV, toMD: toMD
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  root.AppCore = API;
})(typeof window !== 'undefined' ? window : this);
