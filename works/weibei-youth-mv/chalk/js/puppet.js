// 粉笔狐狸。全身同一种画法：粉笔涂色（不透明、背光暗一档、顺着形体排线、受光边粉笔高光），
// 轮廓 = 露出黑板的细缝（黑板色线），和"粉笔化"的头像（design/*_c*.png）一致。
// 坐标：角色本地，原点在两脚中间的地面，y 向下，+x = 角色面朝的方向（头像都朝右）。
import { clamp, lerp } from '/core/lib.js';
import { n1 } from './chalk.js';
import { RIG, loadRig, glBegin, glEnd, quad, chain, screenMap, Skin } from './rig.js';

export const PAL = {
  kid: { fur: '#ef8f45', furD: '#c86a30', white: '#f1ece0', jacket: '#4d86d4', jacketD: '#33629f', stripe: '#f3efe4', pants: '#4479c6', pantsD: '#2f5993', shoe: '#f1ece0', shoeD: '#b9b6ab', pack: '#d9503f', packD: '#a5392c', paw: '#8a5338', pawD: '#5f3826' },
  adult: { fur: '#b8b9b2', furD: '#8e908a', white: '#ebeae3', jacket: '#a9aba4', jacketD: '#7f817b', stripe: '#e3e3dc', pants: '#8f918b', pantsD: '#6c6e69', shoe: '#c9c9c2', shoeD: '#97978f', pack: '#a9aba4', packD: '#7f817b', paw: '#80827c', pawD: '#5d5f5a', tie: '#6f716b', shirt: '#ebeae3', case: '#b3b5ae', caseD: '#8a8c86' },
};
export const GAP = 'rgba(17,31,24,0.96)';     // 黑板色：轮廓缝、手指缝
export const BODY = {
  kid: { hip: 146, sh: 282, neck: 268, headH: 300, headDX: 6, headDY: 14, shW: 52, hipW: 46, thigh: 70, shin: 60, upper: 80, fore: 72, armW: 20, legW: 25, shoe: 36, tail: 150 },
  adult: { hip: 318, sh: 545, neck: 536, headH: 270, headDX: -8, headDY: 18, shW: 60, hipW: 48, thigh: 148, shin: 138, upper: 150, fore: 138, armW: 21, legW: 25, shoe: 46, tail: 190 },
};
export const HEADS = { kid: [], adult: [] };      // [0..5] 表情，[6] = h0 的闭眼版
export const TEX = { kid: null, adult: null };    // 从头像毛发取的笔触纹理（灰度，叠加用）
const PATS = new WeakMap();
function pat(ctx, img, sc) { let m = PATS.get(ctx); if (!m) PATS.set(ctx, (m = new Map())); let p = m.get(img); if (!p) { p = ctx.createPattern(img, 'repeat'); m.set(img, p); } p.setTransform(new DOMMatrix([sc, 0, 0, sc, 0, 0])); return p; }
export const EXPR = { kid: { calm: 0, laugh: 1, proud: 2, sad: 3, wow: 4, closed: 5, blink: 6 }, adult: { calm: 0, smile: 1, sad: 2, closed: 3, wow: 4, call: 5, blink: 6 } };

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export function ik2(ax, ay, tx, ty, L1, L2, bend) {
  const dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
  const dc = clamp(d, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  const a = Math.atan2(dy, dx), cosA = clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1);
  const t1 = a + bend * Math.acos(cosA), jx = ax + L1 * Math.cos(t1), jy = ay + L1 * Math.sin(t1), t2 = Math.atan2(ty - jy, tx - jx);
  return { j: [jx, jy], e: [jx + L2 * Math.cos(t2), jy + L2 * Math.sin(t2)], reach: Math.max(0, d - (L1 + L2)) };
}
function smooth(pts, sub = 6, closed = false) {
  const n = pts.length, o = [], P = (i) => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < sub; k++) { const t = k / sub, t2 = t * t, t3 = t2 * t; o.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  if (!closed) o.push(pts[n - 1]);
  return o;
}
function tube(pts, w0, w1, J, wf = null) {
  const P = smooth(pts, 8), n = P.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, f = i / (n - 1);
    const w = (wf ? w0 * wf(f) : lerp(w0, w1, f)) * (1 + 0.04 * Math.sin(f * 7.3));
    L.push(J(P[i][0] - ty / tl * w, P[i][1] + tx / tl * w)); R.push(J(P[i][0] + ty / tl * w, P[i][1] - tx / tl * w));
  }
  const cap = (c, a0, w) => Array.from({ length: 6 }, (_, k) => { const a = a0 + Math.PI * (k + 1) / 7; return J(c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w); });
  const e = P[n - 1], pe = P[n - 2], ae = Math.atan2(e[1] - pe[1], e[0] - pe[0]) - Math.PI / 2;
  const s = P[0], ps = P[1], as = Math.atan2(s[1] - ps[1], s[0] - ps[0]) - Math.PI / 2;
  const we = wf ? w0 * wf(1) : w1, ws = wf ? w0 * wf(0) : w0;
  return { poly: L.concat(cap(e, ae, we), R.reverse(), cap(s, as, ws)), spine: P, left: L };
}
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
export const gapLine = (Ln, pts, w = 2.6) => { Ln.save(); Ln.strokeStyle = GAP; Ln.lineWidth = w; Ln.lineCap = 'round'; Ln.lineJoin = 'round'; Ln.beginPath(); pts.forEach(([x, y], i) => (i ? Ln.lineTo(x, y) : Ln.moveTo(x, y))); Ln.stroke(); Ln.restore(); };
export const chalkLine = (Ln, pts, col, w) => { Ln.save(); Ln.strokeStyle = col; Ln.lineWidth = w; Ln.lineCap = 'round'; Ln.lineJoin = 'round'; Ln.beginPath(); pts.forEach(([x, y], i) => (i ? Ln.lineTo(x, y) : Ln.moveTo(x, y))); Ln.stroke(); Ln.restore(); };

export function drawFox(G, who, P) {
  if (RIG[who]) return drawFoxRig(G, who, P);
  const B = BODY[who], C = PAL[who], s = P.scale ?? 1, boil = P.boil ?? 0, ja = P.jit ?? 0.8;
  const J = (x, y, amp = ja) => [x + (n1(x * 0.031 + y * 0.017 + boil * 7.3, 3) - 0.5) * 2 * amp, y + (n1(y * 0.029 - x * 0.013 + boil * 5.1, 9) - 0.5) * 2 * amp];
  const crouch = P.crouch ?? 0, lean = P.lean ?? 0;
  const hip = [P.hipX ?? 0, -B.hip * (1 - 0.2 * crouch) + (P.bob ?? 0) - (P.lift ?? 0)];
  const torsoLen = (B.sh - B.hip) * (1 - (P.squash ?? 0) * 0.08);
  const up = (d) => [hip[0] + Math.sin(lean) * d, hip[1] - Math.cos(lean) * d];
  const sh = up(torsoLen), neck = up(torsoLen + (B.neck - B.sh));
  const shN = [sh[0] + B.shW * 0.72, sh[1] + 14], shF = [sh[0] - B.shW * 0.62, sh[1] + 6];
  const hipN = [hip[0] + B.hipW * 0.3, hip[1] - 2], hipF = [hip[0] - B.hipW * 0.38, hip[1] - 4];
  const ft = P.feet || { n: [B.hipW * 0.45, 0], f: [-B.hipW * 0.5, 0] }, fl = P.footLift || { n: 0, f: 0 };
  const leg = (h, f, l) => ik2(h[0], h[1], f[0], f[1] - B.shoe * 0.5 - l, B.thigh, B.shin, -1);
  const LN = leg(hipN, ft.n, fl.n), LF = leg(hipF, ft.f, fl.f);
  const armDef = (shp, sw) => [shp[0] + Math.sin(sw) * (B.upper + B.fore) * 0.86, shp[1] + Math.cos(sw) * (B.upper + B.fore) * 0.86];
  const ht = P.hands || {};
  const AN = ik2(shN[0], shN[1], ...(ht.n || armDef(shN, P.swingN ?? 0.08)), B.upper, B.fore, P.elbowN ?? 1);
  const AF = ik2(shF[0], shF[1], ...(ht.f || armDef(shF, P.swingF ?? -0.06)), B.upper, B.fore, P.elbowF ?? 1);
  P._out = { hip, sh, neck, LN, LF, AN, AF, shN, shF };
  if (G.probe) return;

  const L = G.back;
  const texImg = TEX[who], texS = B.headH / (who === 'kid' ? 413 : 471);
  const _paint = paint; const paintT = (Lr, pts, col, colD, o = {}) => _paint(Lr, pts, col, colD, { tex: texImg, texS, chalk: who === 'adult', ...o });
  const begin = () => { for (const c of [L.fill, L.line]) { c.save(); c.translate(P.x, P.y ?? 0); c.scale(s * (P.face ?? 1) * (P.sx ?? 1), s); c.globalAlpha = P.ink ?? 1; } };
  const end = () => { L.fill.restore(); L.line.restore(); G.flush(); };
  const limb = (a, b, c, w0, w1, col, colD, sd) => { const T = tube([a, b, c], w0, w1, J, (f) => lerp(1, w1 / w0, f) * (1 + 0.12 * Math.sin(f * Math.PI) + 0.1 * Math.exp(-Math.pow((f - 0.85) / 0.08, 2)))); paintT(L, T.poly, col, colD, { seed: sd, dir: Math.atan2(c[1] - a[1], c[0] - a[0]) }); return T; };
  const shoe = (ank, tilt, sd) => { const pts = smooth([[-0.5, -0.5], [0.45, -0.55], [1.05, -0.15], [1.08, 0.35], [-0.55, 0.35]].map(([x, y]) => { const [rx, ry] = rot(x * B.shoe, y * B.shoe * 0.7, tilt); return [ank[0] + rx, ank[1] + B.shoe * 0.42 + ry]; }), 4, true).map(([x, y]) => J(x, y)); paintT(L, pts, C.shoe, C.shoeD, { seed: sd, shade: 3 }); if (who === 'kid') gapLine(L.line, [J(ank[0] - B.shoe * 0.1, ank[1] + B.shoe * 0.42), J(ank[0] + B.shoe * 0.6, ank[1] + B.shoe * 0.38)], 1.8); };
  const paw = (end, from, sd, grip) => {   // 手套形的手：拇指 + 掌 + 末端三道指缝（握东西时手指收短）
    const a = Math.atan2(end[1] - from[1], end[0] - from[0]), w = B.armW, len = grip ? 1.05 : 1.35;
    const th = smooth(Array.from({ length: 6 }, (_, k) => { const t = k / 6 * Math.PI * 2; const [x, y] = rot(Math.cos(t) * w * 0.5 + w * 0.55, Math.sin(t) * w * 0.3 - w * 0.78, a + 0.55); return [end[0] + x, end[1] + y]; }), 3, true).map(([x, y]) => J(x, y));
    paintT(L, th, C.paw, C.pawD, { seed: sd + 1, dir: a + 0.55, base: 0.55 });
    const palm = smooth(Array.from({ length: 10 }, (_, k) => { const t = k / 10 * Math.PI * 2, ca = Math.cos(t); const [x, y] = rot(ca * w * len * (ca > 0 ? 1 : 0.8) + w * 0.55, Math.sin(t) * w * 0.88 * (ca > 0 ? 1 - 0.18 * ca : 1), a); return [end[0] + x, end[1] + y]; }), 3, true).map(([x, y]) => J(x, y));
    paintT(L, palm, C.paw, C.pawD, { seed: sd, dir: a, base: 0.55 });
    for (let k = -1; k <= 1; k++) { const yy = k * w * 0.36, [x0, y0] = rot(w * (0.55 + len * 0.42), yy, a), [x1, y1] = rot(w * (0.55 + len * 0.98) - Math.abs(k) * w * 0.12, yy * 1.05, a); gapLine(L.line, [J(end[0] + x0, end[1] + y0), J(end[0] + x1, end[1] + y1)], 1.7); }
  };

  begin();
  {
    const ph = P.tailPh ?? 0, amp = P.tailAmp ?? 0.25, Lt = B.tail, upT = P.tailUp ?? 0, base = [hip[0] - B.hipW * 0.5, hip[1] + 2];
    const ctl = [[0, 0], [-0.42, 0.12], [-0.82, 0.02 - upT * 0.3], [-1.05, -0.3 - upT * 0.4], [-1.08, -0.62 - upT * 0.3]];
    const pts = ctl.map(([u, v], i) => { const f = i / 4, sw = amp * Math.sin(ph - f * 1.9) * f; const [rx, ry] = rot(u * Lt, v * Lt, sw); return [base[0] + rx, base[1] + ry]; });
    const wf = (f) => 0.45 + 1.6 * Math.sin(Math.min(1, f * 1.05) * Math.PI * 0.92) * (1 - f * 0.15);
    const T = tube(pts, B.legW * 0.6, 0, J, wf); paintT(L, T.poly, C.fur, C.furD, { seed: 11, dir: -2.6 });
    const sp = T.spine, k0 = Math.floor(sp.length * 0.72), tp = sp.slice(k0);
    const TT = tube([tp[0], tp[Math.floor(tp.length / 2)], tp[tp.length - 1]], B.legW * 0.6 * wf(0.72), 0, J, (f) => (1 - f) * 0.95 + 0.05);
    paintT(L, TT.poly, C.white, '#c9c5b8', { seed: 12, dir: -2.6, shade: 2 });
  }
  end();
  const drawCase = (hand) => {
    const sw = P.caseSwing ?? 0, cw = 116, ch = 84;
    const box = [[-cw / 2 + 5, 26], [cw / 2 - 5, 26], [cw / 2, 31], [cw / 2, 26 + ch], [-cw / 2, 26 + ch], [-cw / 2, 31]].map(([x, y]) => { const [rx, ry] = rot(x, y, sw); return J(hand[0] + rx, hand[1] + ry); });   // 方盒子（和地上那只一样），不再抹成六边形
    paintT(L, box, C.case, C.caseD, { seed: 61, dir: 0 });
    const hd = [[-18, 27], [-15, 8], [15, 8], [18, 27]].map(([x, y]) => { const [rx, ry] = rot(x, y, sw); return J(hand[0] + rx, hand[1] + ry); });
    chalkLine(L.line, hd, C.caseD, 5); gapLine(L.line, hd.map(([x, y]) => [x, y + 2]), 1.4);
  };
  begin(); if (who === 'adult' && P.briefcase !== false && P.caseHand === 'f') drawCase(AF.e); limb(shF, AF.j, AF.e, B.armW, B.armW * 0.82, C.jacketD, C.jacketD, 21); paw(AF.e, AF.j, 22, !!(P.gripF ?? (P.caseHand === 'f' && P.briefcase !== false))); end();
  begin();
  limb(hipF, LF.j, LF.e, B.legW, B.legW * 0.86, C.pantsD, C.pantsD, 31); shoe(LF.e, P.footTilt?.f ?? 0, 32);
  limb(hipN, LN.j, LN.e, B.legW, B.legW * 0.86, C.pants, C.pantsD, 33); shoe(LN.e, P.footTilt?.n ?? 0, 34);
  if (who === 'kid') chalkLine(L.line, smooth([hipN, LN.j, LN.e], 5).map(([x, y]) => J(x + B.legW * 0.5, y)), C.stripe, 3.4);
  { const pel = smooth([[hipF[0] - B.legW * 0.9, hipF[1] - 6], [hipN[0] + B.legW * 0.95, hipN[1] - 8], [hipN[0] + B.legW * 0.8, hipN[1] + B.legW * 0.9], [hip[0], hip[1] + B.legW * 1.15], [hipF[0] - B.legW * 0.8, hipF[1] + B.legW * 0.8]], 4, true).map(([x, y]) => J(x, y)); paintT(L, pel, C.pants, C.pantsD, { seed: 35, hl: false }); }
  end();
  if (who === 'kid') {   // 书包跟着躯干转（弯腰时还在背上）
    begin(); const Hh = torsoLen, cl = Math.cos(lean), sl = Math.sin(lean), TB = (u, v) => [hip[0] + u * cl + v * sl, hip[1] + u * sl - v * cl];
    const bag = smooth([[-B.shW * 1.35, Hh * 0.95], [-B.shW * 0.45, Hh * 1.02], [-B.shW * 0.4, Hh * 0.18], [-B.shW * 1.3, Hh * 0.1]], 4, true).map(([u, v]) => J(...TB(u, v)));
    paintT(L, bag, C.pack, C.packD, { seed: 41 }); end();
  }
  begin();
  {
    const w0 = B.shW, w1 = B.hipW, Hh = torsoLen, cl = Math.cos(lean), sl = Math.sin(lean);
    const T = (u, v) => J(hip[0] + u * cl + v * sl, hip[1] + u * sl - v * cl);
    const body = smooth([[-w1 * 1.02, -18], [-w1 * 0.1, -24], [w1 * 0.98, -18], [w0 * 0.98, Hh * 0.5], [w0 * 0.8, Hh + 2], [w0 * 0.2, Hh + 12], [-w0 * 0.6, Hh + 8], [-w0 * 1.02, Hh * 0.55]], 5, true).map(([u, v]) => T(u, v));
    paintT(L, body, C.jacket, C.jacketD, { seed: 51, dir: Math.PI / 2 + lean, shade: 7 });
    if (who === 'kid') {
      const chest = smooth([[-w0 * 0.5, Hh + 6], [w0 * 0.5, Hh + 6], [w0 * 0.25, Hh * 0.55], [-w0 * 0.3, Hh * 0.55]], 3, true).map(([u, v]) => T(u, v));
      paintT(L, chest, C.white, '#c9c5b8', { seed: 52, shade: 3, hl: false });
      chalkLine(L.line, [[-w0 * 1.0, Hh * 0.42], [0, Hh * 0.2], [w0 * 0.95, Hh * 0.45]].map(([u, v]) => T(u, v)), C.stripe, 7);
      gapLine(L.line, [[w0 * 0.05, Hh + 6], [w0 * 0.08, -12]].map(([u, v]) => T(u, v)), 2);
      chalkLine(L.line, [[-w0 * 0.7, Hh + 4], [-w0 * 0.84, Hh * 0.35]].map(([u, v]) => T(u, v)), C.pack, 8);
      chalkLine(L.line, [[w0 * 0.52, Hh + 4], [w0 * 0.7, Hh * 0.4]].map(([u, v]) => T(u, v)), C.pack, 8);
      gapLine(L.line, [[-w1 * 0.95, -6], [w1 * 0.9, -6]].map(([u, v]) => T(u, v)), 2.4);
    } else {
      paintT(L, [[-w0 * 0.3, Hh + 8], [w0 * 0.32, Hh + 8], [w0 * 0.1, Hh * 0.22], [-w0 * 0.12, Hh * 0.22]].map(([u, v]) => T(u, v)), C.shirt, '#c9c8c0', { seed: 53, shade: 2, hl: false });
      paintT(L, [[-0.07 * w0, Hh + 2], [0.1 * w0, Hh + 2], [0.13 * w0, Hh * 0.3], [0.01 * w0, Hh * 0.2], [-0.1 * w0, Hh * 0.3]].map(([u, v]) => T(u, v)), C.tie, '#55574f', { seed: 54, shade: 1.5, hl: false });
      gapLine(L.line, [[-w0 * 0.32, Hh + 8], [-w0 * 0.05, Hh * 0.45], [-w0 * 0.15, Hh * 0.05]].map(([u, v]) => T(u, v)), 2.8);
      gapLine(L.line, [[w0 * 0.34, Hh + 8], [w0 * 0.12, Hh * 0.45], [w0 * 0.2, Hh * 0.05]].map(([u, v]) => T(u, v)), 2.8);
      gapLine(L.line, [[-w1 * 1.0, 4], [w1 * 0.95, 4]].map(([u, v]) => T(u, v)), 2.2);
    }
  }
  end();
  {
    const img = HEADS[who][P.eyes === 2 && (P.expr ?? 0) === 0 ? 6 : (P.expr ?? 0)];
    if (img) {
      G.flush(); const R = G.raster, hs = B.headH / img.height, ht2 = (P.headTilt ?? 0) + lean * 0.6;
      R.save(); R.translate(P.x, P.y ?? 0); R.scale(s * (P.face ?? 1) * (P.sx ?? 1), s); R.globalAlpha = P.ink ?? 1;
      R.translate(neck[0] + B.headDX + (P.headX ?? 0), neck[1] + B.headDY + (P.headY ?? 0)); R.rotate(ht2);
      R.scale(hs * (1 + (P.headSquash ?? 0) * 0.04), hs * (1 - (P.headSquash ?? 0) * 0.05));
      R.drawImage(img, -img.width * 0.5, -img.height); R.restore();
      G.flush();
    }
  }
  begin();
  if (who === 'adult' && P.briefcase !== false && P.caseHand !== 'f') drawCase(AN.e);
  if (P.hold) P.hold(L, AN.e, AF.e, J, P._out);
  end();
  begin(); limb(shN, AN.j, AN.e, B.armW, B.armW * 0.82, C.jacket, C.jacketD, 71);
  if (who === 'kid') chalkLine(L.line, smooth([shN, AN.j, AN.e], 5).map(([x, y]) => J(x + B.armW * 0.45, y)), C.stripe, 3);
  paw(AN.e, AN.j, 72, !!(P.gripN ?? (who === 'adult' && P.briefcase !== false && P.caseHand !== 'f')));
  if (P.holdFront) P.holdFront(L, AN.e, AF.e, J, P._out);
  end();
}

// ================= 骨骼贴图版（身子 = 豆包全身设定图切出的部件，见 rig.js） =================
const OLDW = { kid: BODY.kid.hipW, adult: BODY.adult.hipW };                 // 旧骨架的脚位默认值（镜头里写的脚位是相对它的）
const ARM = 1.3;                                                            // 设定图手臂偏短（手垂到髋）；参考图里拎包的手垂到大腿根，拉长 30%
const rotP = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export async function useRig(who) {
  const R = await loadRig(who), k = R.k, A = R.pts, B = BODY[who], gy = (p) => (R.ground - p[1]) * k;
  Object.assign(B, {
    hip: gy(A.hip), sh: (gy(A.shN) + gy(A.shF)) / 2, neck: gy(A.neck),
    upper: dist(A.shN, A.elN) * k * ARM, fore: dist(A.elN, A.wrN) * k * ARM, thigh: dist(A.hpN, A.knN) * k, shin: dist(A.knN, A.anN) * k,
    shW: Math.abs(A.shF[0] - A.shN[0]) * k / 2,
  });
  // 头：表情头像和设定图里的头按轮廓对齐（design/rig/head_fit.json）；脖子以下那截淡出，露出衣领
  const F = (await (await fetch('design/rig/head_fit.json')).json())[who], img0 = HEADS[who][0];
  B.headH = F.imgH * F.sA * k; B.headDX = F.dxA * k; B.headDY = F.dyA * k;
  HEADS[who] = HEADS[who].map((img) => {
    const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'), y0 = (F.neckInHead - 16) * img.height / F.imgH, y1 = (F.neckInHead + 10) * img.height / F.imgH;
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'destination-out';
    const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = g; x.fillRect(0, y0, img.width, img.height - y0);
    return c;
  });
  return R;
}
function drawFoxRig(G, who, P) {
  const R = RIG[who], k = R.k, A = R.pts, B = BODY[who], C = PAL[who], s = P.scale ?? 1, boil = P.boil ?? 0, ja = P.jit ?? 0.8;
  const J = (x, y, amp = ja) => [x + (n1(x * 0.031 + y * 0.017 + boil * 7.3, 3) - 0.5) * 2 * amp, y + (n1(y * 0.029 - x * 0.013 + boil * 5.1, 9) - 0.5) * 2 * amp];
  const loc = (p) => [(p[0] - R.ox) * k, (p[1] - R.ground) * k];
  const crouch = P.crouch ?? 0, lean = P.lean ?? 0, hip0 = loc(A.hip), sq = 1 - (P.squash ?? 0) * 0.08;
  const hip = [P.hipX ?? 0, hip0[1] * (1 - 0.2 * crouch) + (P.bob ?? 0) - (P.lift ?? 0)];
  // 躯干：脊柱两节（髋 → 腰 → 脖子），弯腰时下节转 35%、上节转满，在腰部弯成弧（不是整块绕髋硬转）
  const wA = [A.hip[0] + (A.neck[0] - A.hip[0]) * 0.42, A.hip[1] + (A.neck[1] - A.hip[1]) * 0.42], lw = loc(wA), ln = loc(A.neck);
  const r1 = rotP([(lw[0] - hip0[0]), (lw[1] - hip0[1]) * sq], lean * 0.35), waist = [hip[0] + r1[0], hip[1] + r1[1]];
  const r2 = rotP([(ln[0] - lw[0]), (ln[1] - lw[1]) * sq], lean), neckP = [waist[0] + r2[0], waist[1] + r2[1]];
  const SK = new Skin([A.hip, wA, A.neck], [hip, waist, neckP], k), Tt = (p) => SK.map(p);
  const Tp = (p) => { const q = loc(p), r = rotP([q[0] - hip0[0], q[1] - hip0[1]], lean * 0.25); return [hip[0] + r[0], hip[1] + r[1]]; };
  // 3/4 侧面朝右：原图近侧（N，离镜头近）的手脚在背后那一边，远侧（F）的在前面。
  // 镜头编排里的 n = 前手、前脚（主动做事的那只），f = 后手、后脚 —— 所以 n 驱动原图的 F，f 驱动原图的 N。
  const neck = Tt(A.neck), shFr = Tt(A.shF), shBk = Tt(A.shN), sh = [(shFr[0] + shBk[0]) / 2, (shFr[1] + shBk[1]) / 2], hpFr = Tp(A.hpF), hpBk = Tp(A.hpN);
  const OLD = { n: OLDW[who] * 0.45, f: -OLDW[who] * 0.5 }, ft = P.feet || { n: [OLD.n, 0], f: [OLD.f, 0] }, fl = P.footLift || { n: 0, f: 0 };
  const sp = R.parts, side = { n: 'F', f: 'N' };
  const ankR = (sd) => loc(A['an' + side[sd]]), shoeP = (sd) => sp['shoe' + side[sd]];
  const ankH = (sd) => (shoeP(sd).off[1] + shoeP(sd).h - 4 - A['an' + side[sd]][1]) * k;
  const LEN = (sd) => { const S = side[sd]; return [dist(A['hp' + S], A['kn' + S]) * k, dist(A['kn' + S], A['an' + S]) * k]; };
  const leg = (h, sd) => { const Ln = LEN(sd); return ik2(h[0], h[1], ankR(sd)[0] + (ft[sd][0] - OLD[sd]), ft[sd][1] - ankH(sd) - fl[sd], Ln[0], Ln[1], -1); };
  const LN = leg(hpFr, 'n'), LF = leg(hpBk, 'f');
  const AL = (S) => [dist(A['sh' + S], A['el' + S]) * k * ARM, dist(A['el' + S], A['wr' + S]) * k * ARM];
  const armDef = (shp, sw, L) => [shp[0] + Math.sin(sw) * (L[0] + L[1]) * 0.97, shp[1] + Math.cos(sw) * (L[0] + L[1]) * 0.97];   // 垂手接近伸直，肘不往后折
  const ht = P.hands || {}, aF = AL('F'), aN = AL('N');
  const AN = ik2(shFr[0], shFr[1], ...(ht.n || armDef(shFr, (P.swingN ?? 0) + 0.1, aF)), aF[0], aF[1], P.elbowN ?? 1);   // 前手
  const AF = ik2(shBk[0], shBk[1], ...(ht.f || armDef(shBk, (P.swingF ?? 0) - 0.14, aN)), aN[0], aN[1], P.elbowF ?? 1);   // 后手
  P._out = { hip, sh, neck, LN, LF, AN, AF, shN: shFr, shF: shBk };
  if (G.probe) return;

  const M = screenMap(P), ink = P.ink ?? 1, board = () => G.raster;
  const L = G.back;
  const texImg = TEX[who], texS = B.headH / (who === 'kid' ? 413 : 471);
  const paintT = (Lr, pts, col, colD, o = {}) => paint(Lr, pts, col, colD, { tex: texImg, texS, chalk: who === 'adult', ...o });
  const begin = () => { for (const c of [L.fill, L.line]) { c.save(); c.translate(P.x, P.y ?? 0); c.scale(s * (P.face ?? 1) * (P.sx ?? 1), s); c.globalAlpha = ink; } };
  const end = () => { L.fill.restore(); L.line.restore(); G.flush(); };
  const drawCase = (hand) => {
    const sw = P.caseSwing ?? 0, cw = 116 * k / 0.9, ch = 84 * k / 0.9;
    const box = [[-cw / 2 + 5, 26], [cw / 2 - 5, 26], [cw / 2, 31], [cw / 2, 26 + ch], [-cw / 2, 26 + ch], [-cw / 2, 31]].map(([x, y]) => { const [rx, ry] = rotP([x, y], sw); return J(hand[0] + rx, hand[1] + ry); });
    paintT(L, box, C.case, C.caseD, { seed: 61, dir: 0 });
    const hd = [[-18, 27], [-15, 8], [15, 8], [18, 27]].map(([x, y]) => { const [rx, ry] = rotP([x, y], sw); return J(hand[0] + rx, hand[1] + ry); });
    chalkLine(L.line, hd, C.caseD, 5); gapLine(L.line, hd.map(([x, y]) => [x, y + 2]), 1.4);
  };
  const paw = (part, e, j, wrA, elA, dim) => { const th = Math.atan2(e[1] - j[1], e[0] - j[0]) - Math.atan2(wrA[1] - elA[1], wrA[0] - elA[0]), w0 = loc(wrA); quad(part, (p) => { const q = loc(p), r = rotP([q[0] - w0[0], q[1] - w0[1]], th); return [e[0] + r[0], e[1] + r[1]]; }, M, ink, dim); };
  const shoe = (part, e, anA, tilt, dim) => { const a0 = loc(anA); quad(part, (p) => { const q = loc(p), r = rotP([q[0] - a0[0], q[1] - a0[1]], tilt); return [e[0] + r[0], e[1] + r[1]]; }, M, ink, dim); };
  const tailPts = () => {
    const ph = P.tailPh ?? 0, amp = P.tailAmp ?? 0.25, upT = P.tailUp ?? 0, base = Tp(A.tail[0]), b0 = loc(A.tail[0]);
    return A.tail.map((p, i) => { const f = i / (A.tail.length - 1), q = loc(p), sw = amp * Math.sin(ph - f * 1.9) * f - upT * 0.6 * f, r = rotP([q[0] - b0[0], q[1] - b0[1]], sw); return [base[0] + r[0], base[1] + r[1]]; });
  };
  const frontArm = (dim) => { chain(sp.armF, [shFr, AN.j, AN.e], k, M, ink, dim); paw(sp.pawF, AN.e, AN.j, A.wrF, A.elF, dim); };
  const caseFront = who === 'adult' && P.briefcase !== false && P.caseHand !== 'f', caseBack = who === 'adult' && P.briefcase !== false && P.caseHand === 'f';
  // 1 尾巴、前手（原图远侧，在身子后面；armOver 时改到身子前面画，比如捧在胸前）
  glBegin(); chain(sp.tail, tailPts(), k, M, ink, 1); if (!P.armOver) frontArm(0.85); glEnd(board());
  if (caseFront && !P.armOver) { begin(); drawCase(AN.e); end(); }
  // 2 腿（前脚 = 原图远侧在后面画，后脚 = 原图近侧盖在上面）、骨盆、躯干
  glBegin();
  chain(sp.legF, [hpFr, LN.j, LN.e], k, M, ink, 0.88); shoe(sp.shoeF, LN.e, A.anF, P.footTilt?.n ?? 0, 0.88);
  quad(sp.pelvis, Tp, M, ink, 1);
  chain(sp.legN, [hpBk, LF.j, LF.e], k, M, ink, 1); shoe(sp.shoeN, LF.e, A.anN, P.footTilt?.f ?? 0, 1);
  SK.draw(sp.torso, M, ink, 1);
  glEnd(board());
  // 3 头（表情头像）
  {
    const img = HEADS[who][P.eyes === 2 && (P.expr ?? 0) === 0 ? 6 : (P.expr ?? 0)];
    if (img) {
      const Rr = G.raster, hs = B.headH / img.height, ht2 = (P.headTilt ?? 0) + lean * 0.6;
      Rr.save(); Rr.translate(P.x, P.y ?? 0); Rr.scale(s * (P.face ?? 1) * (P.sx ?? 1), s); Rr.globalAlpha = ink;
      Rr.translate(neck[0] + B.headDX + (P.headX ?? 0), neck[1] + B.headDY + (P.headY ?? 0)); Rr.rotate(ht2);
      Rr.scale(hs * (1 + (P.headSquash ?? 0) * 0.04), hs * (1 - (P.headSquash ?? 0) * 0.05));
      Rr.drawImage(img, -img.width * 0.5, -img.height); Rr.restore();
    }
  }
  // 4 手里的东西、后手（原图近侧，盖在身子前面）
  if (P.armOver) { glBegin(); frontArm(1); glEnd(board()); if (caseFront) { begin(); drawCase(AN.e); end(); } }
  begin(); if (P.hold) P.hold(L, AN.e, AF.e, J, P._out); end();
  glBegin(); chain(sp.armN, [shBk, AF.j, AF.e], k, M, ink, 1); paw(sp.pawN, AF.e, AF.j, A.wrN, A.elN, 1); glEnd(board());
  if (caseBack) { begin(); drawCase(AF.e); end(); }
  if (P.holdFront) { begin(); P.holdFront(L, AN.e, AF.e, J, P._out); end(); }
}
