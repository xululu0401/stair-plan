/* 排楼梯 · 核心测试
 * 跑法：node --test tests/core.test.cjs
 * 纪律：
 *  - 锚点来自 ../evidence/手算锚点.py（Fraction 精确有理数、逐个整毫米踏面穷举、净空用二分量，不读 core.js）；
 *  - ok=false 时断言错误码，不断言 0；
 *  - 改法里带的数字一律按它改输入重算一遍当断言，并检查「少 1 mm 就不够」（最小性）；
 *  - 最后一组「人工注入错误」：每个注入都必须让至少一个锚点变红。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_PATH = path.join(__dirname, '..', 'core.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const C = require(SRC_PATH);

function loadFromSource(src) {
  const ctx = { console: console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.AppCore;
}
function near(a, b, eps, msg) {
  assert.ok(typeof a === 'number' && isFinite(a), (msg || '') + ' —— 期望有限数字，实际 ' + a);
  assert.ok(Math.abs(a - b) <= (eps == null ? 1e-6 : eps), (msg || '') + ' —— 期望 ' + b + '，实际 ' + a);
}
function S(mut) { const s = C.defaultState(); if (mut) mut(s); return s; }
function D(mut) { return C.compute(S(mut)); }
function codes(o) { return o.errors.map((e) => e.code); }

/* 锚点指纹：注入错误组用同一套断言判红 */
function anchors(A) {
  const r = [];
  const chk = (name, cond) => r.push([name, !!cond]);
  const n = (a, b, e) => typeof a === 'number' && Math.abs(a - b) <= (e || 1e-6);
  const st = (mut) => { const s = A.defaultState(); if (mut) mut(s); return A.compute(s); };
  const o = st();
  chk('ok', o.ok);
  if (!o.ok) return r;
  chk('B1 试 17/18/19 三种级数', o.plans.map((p) => p.n).join() === '17,18,19');
  chk('B1 只有 17 级能做', o.plans.map((p) => p.ok).join() === 'true,false,false' && o.rec === 17);
  const c = o.chosen;
  chk('B2 17 级：R 170.588235 / T 279 / 2R+T 620.176471', c && n(c.R, 170.588235, 1e-6) && c.T === 279 && n(c.step, 620.176471, 1e-6));
  chk('B2 水平长 4464 / 洞口 3467.296552 / 坡度 31.442757°', c && c.run === 4464 && n(c.opening, 3467.296552, 1e-5) && n(c.angle, 31.442757, 1e-5));
  chk('B2 17 级 T 可选 259..281', c && c.Tl === 259 && c.Th === 281);
  /* 尖锚点：让步距上限成为唯一卡住的上界（踏面放宽到 400、长度与洞口放开） → 17 级 T 上界 floor(640 − 341.18) = 298 */
  const rb = st((s) => { s.tMax = '400'; s.L = '9000'; s.open = ''; });
  chk('B2 步距上限卡住时 17 级 T 可选 259..298', rb.plans[0].Tl === 259 && rb.plans[0].Th === 298);
  const p18 = o.plans[1], p19 = o.plans[2];
  chk('B3 18 级卡在长度+洞口，要 4726 / 3659', p18.blocks.join() === 'length,open' && p18.needL === 4726 && p18.needOpen === 3659);
  chk('B3 19 级要 5310 / 4098', p19.needL === 5310 && p19.needOpen === 4098);
  chk('B3 两条改法 18、19，按代价排序', o.actions.map((a) => a.n).join() === '18,19' && o.actions.every((a) => a.check === true));
  const cp = st((s) => { s.mode = 'compact'; });
  chk('B4 省地方：T 259 / 水平长 4144 / 洞口 3218.744828', cp.chosen && cp.chosen.T === 259 && cp.chosen.run === 4144 && n(cp.chosen.opening, 3218.744828, 1e-5));
  const f = st((s) => { s.L = '4726'; s.open = '3659'; });
  chk('B5 长度 4726 洞口 3659 → 18 级 T 278 洞口 3658.096552', f.chosen && f.chosen.n === 18 && f.chosen.T === 278 && n(f.chosen.opening, 3658.096552, 1e-5));
  chk('B5 少 1 mm 长度就回到 17 级', st((s) => { s.L = '4725'; s.open = '3659'; }).chosen.n === 17);
  chk('B5 少 1 mm 洞口就回到 17 级', st((s) => { s.L = '4726'; s.open = '3658'; }).chosen.n === 17);
  chk('B6 放线表顶面 171,341,…,2900', o.rows.map((x) => x.top).join() === '171,341,512,682,853,1024,1194,1365,1535,1706,1876,2047,2218,2388,2559,2729,2900');
  chk('B6 放线表前沿 x = (j−1)·T', o.rows[16].x === 16 * 279 && o.rows[0].x === 0);
  const lf = A.compute(A.stateFromPreset('loft'));
  chk('B7 阁楼：四种都做不了，12 级只差洞口 2200', lf.ok && lf.chosen === null && lf.plans[0].blocks.join() === 'open' && lf.plans[0].needOpen === 2200);
  const lf2 = A.compute(Object.assign(A.stateFromPreset('loft'), { open: '2200' }));
  chk('B7 阁楼洞口 2200：12 级 T 220 水平长 2420 洞口 2200', lf2.chosen && lf2.chosen.n === 12 && lf2.chosen.T === 220 && lf2.chosen.run === 2420 && n(lf2.chosen.opening, 2200, 1e-9));
  const tl = A.compute(A.stateFromPreset('tall'));
  chk('B8 挑高：20 级 T 260 水平长 4940 洞口 3250 坡度 34.695154', tl.chosen && tl.chosen.n === 20 && tl.chosen.T === 260 && tl.chosen.run === 4940 && n(tl.chosen.opening, 3250, 1e-9) && n(tl.chosen.angle, 34.695154, 1e-5));
  chk('B8 挑高 21 级只差长度 5160', tl.plans[1].blocks.join() === 'length' && tl.plans[1].needL === 5160);
  /* 尖锚点：好走模式平局取宽的。sMin+sMax 奇数 → 目标落在半毫米上 */
  const tie = st((s) => { s.sMax = '641'; });
  /* 目标 620.5 − 341.176 = 279.32 → 279；再找一个真平局：H 3000 n 20 R 150 → 目标 320.5−300=… */
  const tie2 = A.planFor(20, { H: 3000, slab: 0, head: 1800, rMin: 150, rMax: 150, tMin: 300, tMax: 330, sMin: 600, sMax: 641, L: 1e9, open: Infinity, width: 800, mode: 'comfort' });
  chk('B9 平局（目标 320.5）取宽的 321', tie.ok && tie2.ok && tie2.T === 321);
  /* 净空整段要开：H 2200、楼板 200、净空 1900 → (s+h)/R = 2100/R > n−1 */
  const full = A.planFor(12, { H: 2200, slab: 200, head: 1900, rMin: 150, rMax: 200, tMin: 220, tMax: 300, sMin: 580, sMax: 660, L: 1e9, open: Infinity, width: 800, mode: 'compact' });
  chk('B10 层高不够 → 洞口 = 水平长', full.ok && n(full.k, 11, 1e-12) && n(full.opening, full.run, 1e-9));
  return r;
}

test('A1 锚点：与 Python 精确有理数穷举逐位一致', () => {
  const r = anchors(C);
  const bad = r.filter((x) => !x[1]).map((x) => x[0]);
  assert.deepStrictEqual(bad, [], '失败的锚点：' + bad.join('；'));
  assert.ok(r.length >= 20);
});

test('A2 几何：净空在洞口边缘正好等于要求，往里 1 mm 不够', () => {
  for (const key of ['default', 'tall']) {
    const o = C.compute(C.stateFromPreset(key)), p = o.chosen, v = o.v;
    const y = (x) => p.R + x * p.R / p.T;
    const x0 = p.run - p.opening;
    near((v.H - v.slab) - y(x0), v.head, 1e-6, key + ' 洞口边缘净空');
    assert.ok((v.H - v.slab) - y(x0 + 1) < v.head, key + ' 楼板再往前伸 1 mm 就碰头');
    near(p.step, 2 * p.R + p.T, 1e-12);
    near(p.R * p.n, v.H, 1e-9, '级高 × 级数 = 层高');
    assert.ok(p.R >= v.rMin && p.R <= v.rMax && p.T >= v.tMin && p.T <= v.tMax && p.step >= v.sMin - 1e-9 && p.step <= v.sMax + 1e-9 && p.run <= v.L);
  }
});

test('A3 穷举对拍：随机 400 组，闭式区间 = 逐毫米检查的可行集', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let feasible = 0;
  for (let t = 0; t < 400; t++) {
    const v = { H: ri(2200, 4200), slab: ri(0, 300), head: ri(1800, 2200), rMin: 150, rMax: ri(165, 210), tMin: ri(200, 260), tMax: ri(270, 340), sMin: ri(560, 610), sMax: ri(620, 680), L: ri(2000, 6000), open: rnd() < 0.2 ? Infinity : ri(1500, 5000), width: 900, mode: rnd() < 0.5 ? 'compact' : 'comfort' };
    if (v.H - v.slab < v.head) continue;
    for (let n = Math.ceil(v.H / v.rMax); n <= Math.floor(v.H / v.rMin); n++) {
      const p = C.planFor(n, v), R = v.H / n, okT = [];
      for (let T = v.tMin; T <= v.tMax; T++) {
        const step = 2 * R + T, run = (n - 1) * T;
        let x0 = (v.H - v.slab - v.head - R) * T / R; x0 = Math.max(0, Math.min(run, x0));
        const opening = run - x0;
        if (step >= v.sMin - 1e-9 && step <= v.sMax + 1e-9 && run <= v.L + 1e-9 && opening <= v.open + 1e-9) okT.push(T);
      }
      const want = okT.length ? okT[0] + '..' + okT[okT.length - 1] : 'none';
      const got = p.ok ? p.Tl + '..' + p.Th : 'none';
      assert.strictEqual(got, want, JSON.stringify(v) + ' n=' + n);
      if (okT.length) { feasible++; assert.strictEqual(okT.length, p.Th - p.Tl + 1, '可行集连续'); }
    }
  }
  assert.ok(feasible > 100, '样本里可行的级数太少：' + feasible);
});

test('A4 改法：每条回填重算选中目标级数，且少 1 mm 就不够（最小性）', () => {
  for (const key of ['default', 'loft', 'tall']) {
    const s0 = C.stateFromPreset(key), o = C.compute(s0);
    assert.ok(o.actions.length > 0, key);
    for (const a of o.actions) {
      const s = C.applyAction(s0, a), r = C.compute(s);
      assert.ok(r.ok && r.chosen && r.chosen.n === a.n, key + ' ' + a.text);
      if (a.L != null) { const s2 = C.cloneState(s); s2.L = String(a.L - 1); const q = C.compute(s2).plans.find((x) => x.n === a.n); assert.ok(!q.ok, key + ' 长度少 1 还能做：' + a.text); }
      if (a.open != null) { const s2 = C.cloneState(s); s2.open = String(a.open - 1); const q = C.compute(s2).plans.find((x) => x.n === a.n); assert.ok(!q.ok, key + ' 洞口少 1 还能做：' + a.text); }
    }
  }
  /* 步距规则卡住的级数不给改法（不是改长度能解决的） */
  const o = D((s) => { s.rMax = '200'; });
  o.plans.filter((p) => p.blocks.indexOf('rule') >= 0 || p.blocks.indexOf('tMax') >= 0).forEach((p) => assert.ok(!o.actions.some((a) => a.n === p.n), p.n + ' 级不该有改法'));
});

test('A5 点选级数：pick 生效；pick 做不了时回退推荐并说明', () => {
  const s = C.applyAction(S(), C.compute(S()).actions[0]);
  assert.strictEqual(s.pick, '18');
  const o = C.compute(Object.assign(S(), { pick: '18' }));
  assert.strictEqual(o.chosen.n, 17); assert.ok(o.pickNote.indexOf('18 级') >= 0);
  const o2 = C.compute(Object.assign(S(), { pick: '40' }));
  assert.strictEqual(o2.chosen.n, 17); assert.ok(o2.pickNote.indexOf('不在') >= 0);
  const o3 = C.compute(Object.assign(S(), { pick: 'x' }));
  assert.strictEqual(o3.chosen.n, 17); assert.strictEqual(o3.pickNote, '');
});

test('A6 非法输入：ok=false，带错误码，不返回 0', () => {
  let o = D((s) => { s.H = 'abc'; });
  assert.strictEqual(o.ok, false); assert.deepStrictEqual(codes(o), ['nan']); assert.ok(!('plans' in o));
  o = D((s) => { s.H = ''; }); assert.deepStrictEqual(codes(o), ['empty']);
  o = D((s) => { s.H = '0'; }); assert.deepStrictEqual(codes(o), ['range']);
  o = D((s) => { s.rMax = '150'; }); assert.deepStrictEqual(codes(o), ['order']);
  o = D((s) => { s.tMax = '230'; }); assert.deepStrictEqual(codes(o), ['order']);
  o = D((s) => { s.sMax = '600'; }); assert.deepStrictEqual(codes(o), ['order']);
  o = D((s) => { s.H = '2100'; s.slab = '200'; }); assert.deepStrictEqual(codes(o), ['head']);
  /* 凑不出整数级：H 1700，150–155 → 11 级 154.5 合法；H 1600 150–155 → 10 级 160 / 11 级 145.45 */
  o = D((s) => { s.H = '1600'; s.head = '1800'; s.slab = '0'; s.rMin = '150'; s.rMax = '155'; }); assert.ok(codes(o).indexOf('head') >= 0 || codes(o).indexOf('nolevel') >= 0);
  /* H 2000、每级 155–165：12 级 166.7 太高、13 级 153.8 太矮 → 凑不出整数级 */
  o = D((s) => { s.H = '2000'; s.slab = '0'; s.head = '1800'; s.rMin = '155'; s.rMax = '165'; }); assert.deepStrictEqual(codes(o), ['nolevel'], JSON.stringify(o.errors));
  o = D((s) => { s.L = '-1'; }); assert.deepStrictEqual(codes(o), ['range'], '负长度按范围挡住');
  o = D((s) => { s.open = ''; }); assert.ok(o.ok && o.warnings.some((w) => w.code === 'noopen'));
});

test('A7 阈值两侧：每级正好等于上限/下限算合规', () => {
  /* H 2880 / 16 = 180 正好等于 rMax */
  const o = D((s) => { s.H = '2880'; });
  assert.strictEqual(o.plans[0].n, 16); near(o.plans[0].R, 180, 1e-12);
  /* H 2850 / 19 = 150 正好等于 rMin */
  const o2 = D((s) => { s.H = '2850'; });
  assert.strictEqual(o2.plans[o2.plans.length - 1].n, 19); near(o2.plans[o2.plans.length - 1].R, 150, 1e-12);
  /* 步距正好 = sMax：H 3600 n 20 R 180 T 280 → 640 */
  const p = C.planFor(20, { H: 3600, slab: 0, head: 1800, rMin: 150, rMax: 180, tMin: 280, tMax: 280, sMin: 600, sMax: 640, L: 1e9, open: Infinity, width: 800, mode: 'compact' });
  assert.ok(p.ok && p.T === 280 && p.step === 640);
  const p2 = C.planFor(20, { H: 3600, slab: 0, head: 1800, rMin: 150, rMax: 180, tMin: 280, tMax: 280, sMin: 600, sMax: 639, L: 1e9, open: Infinity, width: 800, mode: 'compact' });
  assert.ok(!p2.ok && p2.blocks.join() === 'rule');
});

test('A8 提示：超过 18 级、整段开洞、洞口不限', () => {
  assert.ok(C.compute(C.stateFromPreset('tall')).warnings.some((w) => w.code === 'long'));
  assert.ok(!D().warnings.some((w) => w.code === 'long'));
  const o = D((s) => { s.H = '2200'; s.slab = '200'; s.head = '1900'; s.rMax = '200'; s.tMin = '220'; s.sMin = '580'; s.sMax = '660'; s.L = '9000'; s.open = '9000'; });
  assert.ok(o.ok && o.chosen && o.warnings.some((w) => w.code === 'fullopen'), JSON.stringify(o.warnings));
});

test('A9 放线表：每级高差只差 0/1 mm，累计到层高', () => {
  for (let H = 2500; H <= 3500; H += 37) {
    const o = D((s) => { s.H = String(H); s.L = '9000'; s.open = ''; });
    if (!o.ok || !o.chosen) continue;
    const rs = o.rows.map((x) => x.rise);
    assert.strictEqual(o.rows[o.rows.length - 1].top, H);
    assert.ok(Math.max(...rs) - Math.min(...rs) <= 1, H + ': ' + rs.join());
    assert.strictEqual(rs.reduce((a, b) => a + b, 0), H);
  }
});

test('A10 导出：CSV/MD 含同一次 out 的数字，非法时只列错误', () => {
  const o = D(), csv = C.toCSV(o, 'X'), md = C.toMD(o, 'X');
  assert.ok(csv.indexOf('17,170.6,279,620.2,4464,3467,31.4,能做（选用）') > 0, csv);
  assert.ok(csv.indexOf('18,161.1,,,,,,长度不够，要 4726 mm；洞口不够，要开 3659 mm') > 0, csv);
  assert.ok(csv.indexOf('17（上层地面）,2900,171,4464') > 0);
  assert.ok(md.indexOf('**选用 17 级**：每级 170.6 mm 高、踏面 279 mm，2R+T = 620.2 mm，水平长 4464 mm，洞口 3467 mm，坡度 31.4°') > 0, md);
  assert.ok(md.indexOf('18 级（每级 161.1 mm）：楼下长度放到 4726 mm（多 226），洞口开到 3659 mm（多 59）') > 0);
  const bad = D((s) => { s.H = 'x'; });
  assert.ok(C.toCSV(bad, 'X').indexOf('还算不出来') > 0 && C.toMD(bad, 'X').indexOf('还算不出来') > 0);
  const lf = C.compute(C.stateFromPreset('loft'));
  assert.ok(C.toMD(lf, 'X').indexOf('都做不了') > 0);
});

test('A11 预设：三个都能算，presetKey 认得出来', () => {
  for (const p of C.PRESETS) { const s = C.stateFromPreset(p.key); assert.ok(C.compute(s).ok, p.key); assert.strictEqual(C.presetKey(s), p.key); }
  assert.strictEqual(C.presetKey(S((s) => { s.H = '2901'; })), null);
  assert.strictEqual(C.fmtV(-0.0001, 1), '0'); assert.strictEqual(C.fmtV(NaN, 1), '—');
});

test('A12 人工注入错误：每个都必须让至少一个锚点变红', () => {
  const MUT = [
    ['踏面个数用 n 而不是 n−1', 'p.run = (n - 1) * T;', 'p.run = n * T;'],
    ['长度上界用 n', "{ key: 'length', val: v.L / (n - 1) }", "{ key: 'length', val: v.L / n }"],
    ['步距用 R+T', "{ key: 'rule', val: v.sMax - 2 * R }", "{ key: 'rule', val: v.sMax - R }"],
    ['步距下界漏掉', 'var lo = Math.max(v.tMin, v.sMin - 2 * R);', 'var lo = v.tMin;'],
    ['净空漏楼板厚', 'return Math.min(n - 1, (v.slab + v.head) / R);', 'return Math.min(n - 1, v.head / R);'],
    ['洞口不封顶', 'return Math.min(n - 1, (v.slab + v.head) / R);', 'return (v.slab + v.head) / R;'],
    ['洞口上界不查', "{ key: 'open', val: v.open / k }", "{ key: 'open', val: Infinity }"],
    ['T 下界不取整', 'var Tl = Math.ceil(lo - EPS)', 'var Tl = Math.round(lo)'],
    ['T 上界 ceil', 'Th = Math.floor(hi + EPS)', 'Th = Math.ceil(hi - EPS)'],
    ['好走目标用下限', 'mid = (v.sMin + v.sMax) / 2', 'mid = v.sMin'],
    ['平局取窄的', '(Math.abs(d - best.d) <= EPS && c > best.T)', '(Math.abs(d - best.d) <= EPS && c < best.T)'],
    ['省地方取最宽', 'if (v.mode === \'compact\') T = Tl;', 'if (v.mode === \'compact\') T = Th;'],
    ['好走推荐级数最少', 'else if (p.n > rec.n) rec = p;', 'else if (p.n < rec.n) rec = p;'],
    ['级数下界 floor', 'var n0 = Math.ceil(v.H / v.rMax - EPS)', 'var n0 = Math.floor(v.H / v.rMax)'],
    ['洞口补到 floor', 'p.needOpen = Math.ceil(Tl * k - EPS);', 'p.needOpen = Math.floor(Tl * k);'],
    ['放线表用截断', 'var hgt = Math.round(j * v.H / p.n);', 'var hgt = Math.floor(j * v.H / p.n);'],
    ['坡度角用 T/R', 'p.angle = Math.atan(R / T)', 'p.angle = Math.atan(T / R)'],
    ['改法不排序', 'actions.sort(function (a, b) { return a.cost - b.cost || b.n - a.n; });', 'actions.reverse();']
  ];
  const survived = [];
  for (const [name, from, to] of MUT) {
    assert.ok(SRC.indexOf(from) >= 0, '注入点没找到：' + name);
    let A; try { A = loadFromSource(SRC.replace(from, to)); } catch (e) { continue; }
    let r; try { r = anchors(A); } catch (e) { continue; }
    if (r.every((x) => x[1])) survived.push(name);
  }
  assert.deepStrictEqual(survived, [], '存活的注入：' + survived.join('；'));
});
