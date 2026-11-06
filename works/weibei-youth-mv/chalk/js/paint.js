// 粉笔涂色：从第 6 版的 puppet.js 原样摘出来的两个画笔函数（人物已改成姿势原画，代码画身子的部分已删）。
// paint：不透明打底 + 顺着方向的笔触 + 内边 + 黑板色细缝；chalkLine：一条粉笔线。板擦、镜片里的星星、车铃、撞线闪光还在用。
import { n1 } from './chalk.js';

export const GAP = 'rgba(17,31,24,0.96)';     // 黑板色：轮廓缝
export const TEX = { kid: null, adult: null };    // 笔触纹理（灰度，叠加用），film.js 启动时加载
const PATS = new WeakMap();
function pat(ctx, img, sc) { let m = PATS.get(ctx); if (!m) PATS.set(ctx, (m = new Map())); let p = m.get(img); if (!p) { p = ctx.createPattern(img, 'repeat'); m.set(img, p); } p.setTransform(new DOMMatrix([sc, 0, 0, sc, 0, 0])); return p; }

const path = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
const lighten = (hex, k) => { const v = parseInt(hex.slice(1), 16), r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255; return `rgb(${Math.min(255, r + (255 - r) * k) | 0},${Math.min(255, g + (255 - g) * k) | 0},${Math.min(255, b + (255 - b) * k) | 0})`; };

// 画法开关：chalk = 粉笔素描式（和头像、衣领一致：中间调打底 + 顺着形体的粉笔长笔触 + 白粉笔内边 + 黑板色细缝）；false = 旧的涂色式
export const STYLE = { chalk: false };   // 默认旧画法；大人（头是白粉笔素描）在 drawFox 里单独开 chalk，少年（头是彩铅）保留旧画法
const mixRGB = (hex, k) => { const v = parseInt(hex.slice(1), 16), r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255; return `rgb(${(17 + (r - 17) * k) | 0},${(31 + (g - 31) * k) | 0},${(24 + (b - 24) * k) | 0})`; };
export function paint(L, pts, col, colD, o = {}) {
  if (!(o.chalk ?? STYLE.chalk)) return paintOld(L, pts, col, colD, o);
  const F = L.fill, Ln = L.line, seed = o.seed ?? 1, dir = o.dir ?? -0.5, ink = F.globalAlpha, c = Math.cos(dir), s = Math.sin(dir);
  // 1 打底：黑板色和本色之间的中间调（不透明，挡住后面的格子线）
  F.save(); path(F, pts); F.fillStyle = mixRGB(col, o.base ?? 0.7); F.fill(); F.clip();
  // 2 笔触撒在部件自己的方向坐标里（u 顺着 dir，v 横着）：部件转，笔触跟着转，不在身上游动
  let cx = 0, cy = 0; for (const [x, y] of pts) { cx += x; cy += y; } cx /= pts.length; cy /= pts.length;
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const [x, y] of pts) { const u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const area = (u1 - u0) * (v1 - v0), N = Math.min(360, Math.max(14, area / 50)), lk = Math.min(1, Math.max(0.45, (u1 - u0) / 90));
  F.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const ru = n1(i * 1.73 + seed * 3.1, seed), rv = n1(i * 2.31 + seed * 5.7, seed + 4), rl = n1(i * 0.7, seed + 9), rt = n1(i * 1.19, seed + 13);
    const u = u0 + ru * (u1 - u0), v = v0 + rv * (v1 - v0), l = (16 + 36 * rl * rl) * lk * (o.len ?? 1), bend = (rt - 0.5) * 0.6, side = (v - v0) / (v1 - v0 + 1e-6);
    const light = n1(i * 3.7, seed + 21) > 0.05 + 0.3 * side;          // 背光一侧（v 大）亮笔触少、暗笔触多
    F.strokeStyle = light ? (i % 3 ? lighten(col, 0.4) : col) : colD; F.globalAlpha = ink * (light ? 0.35 + 0.35 * rt : 0.26); F.lineWidth = 1.1 + 1.6 * rl;
    const ja = (n1(i * 5.3, seed + 31) - 0.5) * 0.45, cj = Math.cos(dir + ja), sj = Math.sin(dir + ja);   // 每笔方向带一点随机，不像下雨
    const x = cx + u * c - v * s, y = cy + u * s + v * c, dx = (cj * l) / 2, dy = (sj * l) / 2, bx = -sj * bend * l * 0.35, by = cj * bend * l * 0.35;
    F.beginPath(); F.moveTo(x - dx, y - dy); F.quadraticCurveTo(x + bx, y + by, x + dx, y + dy); F.stroke();
  }
  // 3 白粉笔内边（只露在形体里面那一半）
  if (o.rim !== false) { F.globalAlpha = ink * 0.62; F.strokeStyle = lighten(col, 0.55); F.lineWidth = 5; F.lineJoin = 'round'; path(F, pts); F.stroke(); }
  F.restore();
  // 4 黑板色细缝：把前后部件分开（和头像的深色线一致）
  Ln.save(); Ln.strokeStyle = GAP; Ln.lineWidth = o.gap ?? 2.4; Ln.lineJoin = 'round'; path(Ln, pts); Ln.stroke(); Ln.restore();
}
// 旧画法：底色 → 背光暗边 → 顺着 dir 的排线 → 黑板色轮廓缝 → 受光边高光
function paintOld(L, pts, col, colD, o = {}) {
  const F = L.fill, Ln = L.line, seed = o.seed ?? 1, dir = o.dir ?? -0.5;
  F.save(); path(F, pts); F.fillStyle = colD; F.fill(); F.clip();
  F.save(); F.translate(-(o.shade ?? 5), -(o.shade ?? 5) * 0.7); path(F, pts); F.fillStyle = col; F.fill(); F.restore();
  if (o.tex) { F.save(); F.globalCompositeOperation = 'overlay'; F.fillStyle = pat(F, o.tex, o.texS ?? 0.7); path(F, pts); F.fill(); F.globalCompositeOperation = 'soft-light'; F.fill(); F.restore(); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const area = (x1 - x0) * (y1 - y0), N = Math.min(320, Math.max(14, area / 110)), cx = Math.cos(dir), cy = Math.sin(dir);
  F.lineCap = 'round'; const ink = F.globalAlpha;   // 排线透明度要乘上整体的淡出（ink），不然人淡出后排线会留下残影
  for (let i = 0; i < N; i++) {
    const u = n1(i * 1.73 + seed * 3.1, seed), v = n1(i * 2.31 + seed * 5.7, seed + 4), x = x0 + u * (x1 - x0), y = y0 + v * (y1 - y0), l = 7 + 12 * n1(i * 0.7, seed + 9);
    F.strokeStyle = i % 3 ? lighten(col, 0.25) : colD; F.globalAlpha = ink * (o.tex ? 0.26 : 0.35); F.lineWidth = 1.3;
    F.beginPath(); F.moveTo(x - cx * l, y - cy * l); F.lineTo(x + cx * l, y + cy * l); F.stroke();
  }
  F.globalAlpha = 1; F.restore();
  Ln.save(); Ln.strokeStyle = GAP; Ln.lineWidth = o.gap ?? 3.2; Ln.lineJoin = 'round'; path(Ln, pts); Ln.stroke(); Ln.translate(1.6, 1.4); Ln.lineWidth = (o.gap ?? 3.2) * 0.8; path(Ln, pts); Ln.stroke(); Ln.restore();
  if (o.rim !== false) { Ln.save(); Ln.strokeStyle = 'rgba(246,243,233,0.42)'; Ln.lineWidth = 1.7; Ln.lineJoin = 'round'; Ln.translate(-0.8, -0.8); path(Ln, pts); Ln.stroke(); Ln.restore(); }
  if (o.hl !== false) {
    const hl = pts.filter(([x, y]) => x - x0 < (x1 - x0) * 0.45 || y - y0 < (y1 - y0) * 0.25);
    if (hl.length > 3) { Ln.save(); Ln.strokeStyle = 'rgba(250,247,238,0.55)'; Ln.lineWidth = 2; Ln.lineCap = 'round'; Ln.beginPath(); const k0 = Math.floor(hl.length * 0.2), k1 = Math.floor(hl.length * 0.7); for (let k = k0; k < k1; k++) { const [x, y] = hl[k]; k > k0 ? Ln.lineTo(x + 3, y + 3) : Ln.moveTo(x + 3, y + 3); } Ln.stroke(); Ln.restore(); }
  }
}
export const chalkLine = (Ln, pts, col, w) => { Ln.save(); Ln.strokeStyle = col; Ln.lineWidth = w; Ln.lineCap = 'round'; Ln.lineJoin = 'round'; Ln.beginPath(); pts.forEach(([x, y], i) => (i ? Ln.lineTo(x, y) : Ln.moveTo(x, y))); Ln.stroke(); Ln.restore(); };
