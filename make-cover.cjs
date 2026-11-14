/* 封面 cover.svg（1200×1200），数字全部来自 core.js 默认场景的同一次 compute；再用浏览器截成 cover.png。
 * 字体名用单引号（SVG 是 XML，裸双引号会让整张图变错误页，批次 64 踩过）。 */
const fs = require('node:fs'), path = require('node:path');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok || !o.chosen) throw new Error('默认场景算不出来');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif", M = 'ui-monospace,Menlo,Consolas,monospace';
const v = o.v, c = o.chosen;
const sc = 360 / v.H, ox = 150, oy = 690, PX = (x) => (ox + x * sc).toFixed(1), PY = (h) => (oy - h * sc).toFixed(1);
let d = 'M' + PX(0) + ' ' + PY(0);
for (let j = 1; j <= c.n; j++) { d += ' L' + PX((j - 1) * c.T) + ' ' + PY(j * c.R); if (j < c.n) d += ' L' + PX(j * c.T) + ' ' + PY(j * c.R); }
d += ' L' + PX(c.run) + ' ' + PY(0) + ' Z';
const reach = Math.max(0, c.slabReach);
const rows = o.plans.map((p) => [p.n + ' 级', A.fmtV(p.R, 1), p.ok ? (p.n === c.n ? '选用' : '能做') : p.blocks.map((b) => ({ tMax: '踏面太宽', rule: '步距超限', length: '长度不够', open: '洞口不够' })[b]).join('、'), p.ok]);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f3f0ea"/>
  <rect x="60" y="60" width="1080" height="1080" fill="#ffffff" stroke="#e3ddd2"/>
  <rect x="60" y="60" width="1080" height="12" fill="#9a6b3a"/>
  <text x="120" y="190" font-family="${F}" font-size="104" font-weight="700" fill="#2a2620">排楼梯</text>
  <text x="120" y="252" font-family="${F}" font-size="32" fill="#8a8378">层高定了，做几级、踏面多宽、洞口开多大</text>
  <rect x="${PX(-300)}" y="${PY(v.H)}" width="${(reach + 300) * sc}" height="${v.slab * sc}" fill="#c9c2b6"/>
  <rect x="${PX(reach)}" y="${PY(v.H)}" width="${(c.run - reach) * sc}" height="${v.slab * sc}" fill="#e2eef4" stroke="#2c5e7a"/>
  <rect x="${PX(c.run)}" y="${PY(v.H)}" width="${1080 - +PX(c.run)}" height="${v.slab * sc}" fill="#c9c2b6"/>
  <path d="${d}" fill="#e9dccb" stroke="#9a6b3a" stroke-width="3"/>
  <line x1="${PX(-300)}" y1="${oy}" x2="1080" y2="${oy}" stroke="#5a544a" stroke-width="3"/>
  <text x="${PX((reach + c.run) / 2)}" y="${+PY(v.H) - 14}" text-anchor="middle" font-family="${F}" font-size="26" fill="#2c5e7a">洞口 ${A.fmtV(c.opening, 0)}</text>
  <text x="120" y="790" font-family="${F}" font-size="50" font-weight="700" fill="#9a6b3a">${c.n} 级 · 每级 ${A.fmtV(c.R, 1)} · 踏面 ${c.T}</text>
  ${rows.map((r, i) => `<text x="120" y="${870 + i * 58}" font-family="${M}" font-size="34" fill="${r[3] ? '#2a2620' : '#a33a2c'}">${r[0]}</text>
  <text x="420" y="${870 + i * 58}" font-family="${M}" font-size="34" fill="#5a544a">${r[1]} mm</text>
  <text x="1080" y="${870 + i * 58}" text-anchor="end" font-family="${F}" font-size="32" fill="${r[3] ? '#2c5e7a' : '#a33a2c'}">${r[2]}</text>`).join('\n  ')}
  <text x="120" y="1100" font-family="${F}" font-size="24" fill="#8a8378">默认场景为虚构示例 · 层高 ${v.H} mm · 直跑楼梯几何估算</text>
</svg>`;
fs.writeFileSync(path.join(__dirname, 'cover.svg'), svg);
console.log('cover.svg', fs.statSync(path.join(__dirname, 'cover.svg')).size, 'bytes');
