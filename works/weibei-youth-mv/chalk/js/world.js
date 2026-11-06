// 黑板上的静态粉笔（lemo 烘焙笔画）：书写（t0→t1 按笔顺显出）、擦除（板擦扫过的带子）。
// 所有笔画放进 WORLD 列表，按时间和视野画。坐标 = 世界单位（相机 s=1 时 1 单位 = 1 像素）。
import { clamp, lerp } from '/core/lib.js';
import { Stroke, line, curve, arc, bake, drawStroke, rng } from './chalk.js';

export const WORLD = [];
export const COL = { white: [.95, .94, .90], grey: [.68, .70, .66], orange: [1.0, .56, .26], blue: [.42, .7, .98], red: [.96, .38, .32], yellow: [.99, .86, .42], green: [.55, .85, .52], pink: [.98, .62, .70], gold: [1.0, .78, .32] };
// 加一组笔画：在 [t0,t1] 之间按顺序写出来；erase 列表里的板擦经过时被擦掉
export function add(strokes, t0, t1, o = {}) {
  const n = strokes.length, tot = strokes.reduce((a, s) => a + s.len + 40, 0); let acc = 0;
  for (const s of strokes) {
    s.t0 = t0 + (t1 - t0) * acc / tot; acc += s.len + 40; s.t1 = t0 + (t1 - t0) * (acc - 40) / tot;
    if (o.instant) { s.t0 = t0 - 1; s.t1 = t0 - 0.5; }
    s.group = o.group || ''; s.hide = o.hide ?? 1e9; s.dim = o.dim || null;
    WORLD.push(s);
  }
  return strokes;
}
const o_ = (color, w = 6, extra = {}) => ({ color: COL[color] || color, w, ...extra });
// ----- 形状
export function grid(x0, y0, cols, rows, cell, color = 'white', w = 4) {
  const S = [];
  for (let r = 0; r <= rows; r++) S.push(line(x0, y0 + r * cell, x0 + cols * cell, y0 + r * cell, o_(color, w)));
  for (let c = 0; c <= cols; c++) S.push(line(x0 + c * cell, y0, x0 + c * cell, y0 + rows * cell, o_(color, w)));
  return S;
}
// 有透视的地面格子：地平线以下，竖线汇聚到灭点
export function floorGrid(x0, x1, y0, depth, cell, vp, color = 'white', w = 4) {
  const S = [], rows = 4;
  for (let r = 0; r <= rows; r++) { const f = Math.pow(r / rows, 1.6), y = y0 + depth * f; const k = (y - vp[1]) / (y0 + depth - vp[1]); S.push(line(lerp(vp[0], x0, k), y, lerp(vp[0], x1, k), y, o_(color, w * (0.7 + 0.5 * f)))); }
  for (let x = x0; x <= x1 + 1; x += cell) { const k0 = (y0 - vp[1]) / (y0 + depth - vp[1]); S.push(line(lerp(vp[0], x, k0), y0, x, y0 + depth, o_(color, w))); }
  return S;
}
export function bike(x, y, sc = 1, color = 'white', w = 5) {   // y = 地面；车头朝左
  const R = 62 * sc, fw = [x - 105 * sc, y - R], rw = [x + 105 * sc, y - R], cr = [x + 10 * sc, y - R], seat = [x + 55 * sc, y - R - 95 * sc], head = [x - 80 * sc, y - R - 100 * sc];
  const S = [arc(fw[0], fw[1], R, 0, Math.PI * 2, o_(color, w)), arc(rw[0], rw[1], R, 0, Math.PI * 2, o_(color, w))];
  for (const c of [fw, rw]) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; S.push(line(c[0], c[1], c[0] + Math.cos(a) * R * 0.92, c[1] + Math.sin(a) * R * 0.92, o_(color, w * 0.35))); }
  S.push(line(rw[0], rw[1], cr[0], cr[1], o_(color, w)), line(cr[0], cr[1], seat[0] - 8 * sc, seat[1] + 12 * sc, o_(color, w)), line(cr[0], cr[1], head[0] + 6 * sc, head[1] + 22 * sc, o_(color, w)),
    line(seat[0] - 8 * sc, seat[1] + 18 * sc, head[0] + 6 * sc, head[1] + 18 * sc, o_(color, w)), line(head[0], head[1], fw[0], fw[1], o_(color, w)), line(seat[0], seat[1] + 14 * sc, rw[0], rw[1], o_(color, w * 0.8)),
    line(seat[0] - 22 * sc, seat[1], seat[0] + 26 * sc, seat[1] - 4 * sc, o_(color, w * 1.6)), curve([[head[0] - 10 * sc, head[1] - 4 * sc], [head[0] + 10 * sc, head[1] - 14 * sc], [head[0] + 34 * sc, head[1] - 8 * sc]], o_(color, w)),
    arc(cr[0], cr[1], 14 * sc, 0, Math.PI * 2, o_(color, w * 0.8)));
  return S;
}
export function star(x, y, r, color = 'yellow', w = 5) { const p = []; for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return [new Stroke(p, o_(color, w, { wob: 0.4 }))]; }
export function door(x, y, w, h, color = 'orange', lw = 7) { return [new Stroke([[x, y], [x, y - h], [x + w, y - h], [x + w, y]], o_(color, lw)), arc(x + w * 0.8, y - h * 0.48, 7, 0, 6.28, o_(color, lw * 0.7))]; }
export function waves(x0, x1, y, amp, n, colors, w = 10) {
  const S = [];
  colors.forEach((c, i) => { const p = []; for (let x = x0; x <= x1; x += 24) p.push([x, y + i * 26 + Math.sin(x / 70 + i * 1.3) * amp]); S.push(new Stroke(p, o_(c, w, { kind: 'side', wob: 1 }))); });
  return S;
}
// 简单的数字笔画（粉笔写）
const DIG = { 1: [[[0.4, 0.15], [0.55, 0], [0.55, 1]]], 2: [[[0.15, 0.25], [0.35, 0], [0.7, 0.05], [0.8, 0.3], [0.15, 1], [0.85, 1]]], 3: [[[0.15, 0.1], [0.75, 0.05], [0.4, 0.45], [0.8, 0.65], [0.65, 0.98], [0.15, 0.9]]], 4: [[[0.65, 1], [0.65, 0], [0.1, 0.7], [0.9, 0.7]]], 5: [[[0.8, 0], [0.25, 0], [0.2, 0.42], [0.7, 0.45], [0.8, 0.8], [0.45, 1], [0.15, 0.9]]], 6: [[[0.75, 0.05], [0.3, 0.3], [0.2, 0.75], [0.5, 1], [0.8, 0.75], [0.55, 0.5], [0.22, 0.65]]], 7: [[[0.15, 0], [0.85, 0], [0.4, 1]]], 8: [[[0.5, 0.5], [0.2, 0.25], [0.5, 0], [0.8, 0.25], [0.5, 0.5], [0.15, 0.78], [0.5, 1], [0.85, 0.78], [0.5, 0.5]]] };
export function digit(d, x, y, h, color = 'white', w = 6) { return DIG[d].map((p) => new Stroke(p.map(([u, v]) => [x + u * h * 0.6, y + v * h]), o_(color, w, { wob: 0.5 }))); }
// 彩色跳房子（地面上，平视略带透视）：1 2 3 单格，4/5 双格，6，7/8
export function hopscotch(x0, y0, cell, colors = ['orange', 'blue', 'yellow', 'red', 'green', 'pink'], w = 6) {
  const S = [], cells = [[1, 0, 0], [2, 1, 0], [3, 2, 0], [4, 3, -0.5], [5, 3, 0.5], [6, 4, 0], [7, 5, -0.5], [8, 5, 0.5]];
  for (const [n, i, dz] of cells) {
    const cx = x0 + i * cell, cy = y0 + dz * cell * 0.45, hw = cell * 0.48, hh = cell * 0.22 * (dz ? 1 : 1.5), c = colors[(n - 1) % colors.length];
    S.push(new Stroke([[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh], [cx - hw, cy - hh]], o_(c, w, { wob: 0.6 })));
    for (let k = 0; k < 3; k++) S.push(new Stroke([[cx - hw * 0.8, cy - hh * 0.5 + k * hh * 0.5], [cx + hw * 0.8, cy - hh * 0.55 + k * hh * 0.5]], o_(c, w * 2.6, { kind: 'side', wob: 1, press: 0.45 })));
    S.push(...digit(n, cx - hh * 0.35, cy - hh * 0.65, hh * 1.3, 'white', 4));
  }
  return S;
}
// 一群嘲笑的白粉笔人影
export function crowd(x, y, n, sc = 1, color = 'white') {
  const S = [], R = rng(17);
  for (let i = 0; i < n; i++) {
    const cx = x + i * 120 * sc + (R() - 0.5) * 30, h = (150 + R() * 40) * sc, hy = y - h;
    S.push(arc(cx, hy, 22 * sc, 0, 6.28, o_(color, 4)), line(cx, hy + 24 * sc, cx, y - 50 * sc, o_(color, 4)), line(cx, y - 50 * sc, cx - 20 * sc, y, o_(color, 4)), line(cx, y - 50 * sc, cx + 18 * sc, y, o_(color, 4)),
      line(cx, hy + 50 * sc, cx + 55 * sc, hy + 30 * sc + R() * 20, o_(color, 4)), line(cx, hy + 50 * sc, cx - 30 * sc, hy + 80 * sc, o_(color, 4)),
      arc(cx + 6 * sc, hy + 6 * sc, 9 * sc, 0.2, Math.PI - 0.2, o_(color, 3)));   // 张开的笑嘴
  }
  return S;
}
export function desk(x, y, w, h, color = 'white', lw = 5) { return [line(x - w / 2, y - h, x + w / 2, y - h, o_(color, lw * 1.3)), line(x - w / 2 + 10, y - h, x - w / 2 + 14, y, o_(color, lw)), line(x + w / 2 - 10, y - h, x + w / 2 - 14, y, o_(color, lw)), line(x - w / 2 + 10, y - h * 0.55, x + w / 2 - 10, y - h * 0.55, o_(color, lw * 0.7))]; }
export function chair(x, y, s, color = 'white', lw = 5) { return [line(x, y, x, y - 70 * s, o_(color, lw)), line(x + 48 * s, y, x + 48 * s, y - 70 * s, o_(color, lw)), line(x - 4, y - 70 * s, x + 52 * s, y - 70 * s, o_(color, lw * 1.2)), line(x + 48 * s, y - 70 * s, x + 50 * s, y - 150 * s, o_(color, lw))]; }

// ----- 烘焙与绘制
export function bakeAll(onProgress) { WORLD.forEach((s, i) => { bake(s, s.o.R ?? 1.2); if (onProgress && i % 50 === 0) onProgress(i, WORLD.length); }); }
// 擦除：板擦带 {t0, t1, path:[[x,y]..], w, haze}，到 t 时擦到的部分不再显示
export const WIPES = [];
export function drawWorld(ctx, t, view, layer, applyCam, front = false) {
  const [vx0, vy0, vx1, vy1] = view;
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0); layer.ctx.clearRect(0, 0, layer.w, layer.h); applyCam(layer.ctx);
  for (const s of WORLD) {
    if (t <= s.t0 || t >= s.hide) continue;
    const sp = s.sprite; if (!sp) continue;
    if (sp.x0 > vx1 || sp.y0 > vy1 || sp.x0 + sp.W / sp.R < vx0 || sp.y0 + sp.H / sp.R < vy0) continue;
    if (s.dim) { const a = s.dim(t); if (a <= 0.01) continue; layer.ctx.globalAlpha = a; } else layer.ctx.globalAlpha = 1;
    drawStroke(layer.ctx, s, t);
  }
  layer.ctx.globalAlpha = 1;
  // 板擦
  for (const wp of WIPES) {
    if (t <= wp.t0 || wp.noErase) continue;
    const f = clamp((t - wp.t0) / (wp.t1 - wp.t0)), P = wp.path, n = Math.max(2, Math.ceil(f * (P.length - 1)) + 1);
    const c = layer.ctx; c.save(); c.globalCompositeOperation = 'destination-out'; c.filter = `blur(${(wp.soft ?? 14) * Math.max(0.3, layer.s)}px)`;
    c.lineWidth = wp.w; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#000'; c.beginPath();
    for (let i = 0; i < n; i++) { const k = Math.min(P.length - 1, i), [x, y] = i === n - 1 ? lerpPt(P, f) : P[k]; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke(); c.restore();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer.cv, 0, 0); ctx.restore();
  // 擦过后留下的一层粉笔灰：横向条纹（板擦的纹路），不是平涂
  if (!front) for (const wp of WIPES) {
    if (t <= wp.t0 || !wp.haze) continue;
    const hz = typeof wp.haze === 'function' ? wp.haze(t) : wp.haze; if (hz <= 0.005) continue;
    const f = clamp((t - wp.t0) / (wp.t1 - wp.t0)), P = wp.path, n = Math.max(2, Math.ceil(f * (P.length - 1)) + 1);
    if (!STREAK) STREAK = makeStreak();
    const pt = ctx.createPattern(STREAK, 'repeat');
    ctx.save(); applyCam(ctx); ctx.globalAlpha = hz; ctx.strokeStyle = pt; ctx.lineWidth = wp.w * 0.92; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i < n; i++) { const k = Math.min(P.length - 1, i), [x, y] = i === n - 1 ? lerpPt(P, f) : P[k]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  }
}
let STREAK = null;
export function makeStreak() {
  const c = new OffscreenCanvas(512, 128), g = c.getContext('2d'), R = rng(77);
  for (let i = 0; i < 260; i++) { const y = R() * 128, x = R() * 512, l = 60 + R() * 260, a = 0.05 + R() * 0.14; g.strokeStyle = `rgba(205,214,205,${a})`; g.lineWidth = 2 + R() * 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (R() - 0.5) * 5); g.stroke(); g.beginPath(); g.moveTo(x - 512, y); g.lineTo(x - 512 + l, y + (R() - 0.5) * 5); g.stroke(); }
  return c;
}
function lerpPt(P, f) { const u = f * (P.length - 1), i = Math.min(P.length - 2, Math.floor(u)), r = u - i; return [lerp(P[i][0], P[i + 1][0], r), lerp(P[i][1], P[i + 1][1], r)]; }
