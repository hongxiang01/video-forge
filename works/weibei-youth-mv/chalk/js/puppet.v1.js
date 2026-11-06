// 粉笔狐狸：头 = 豆包画的粉笔头像（6 个表情，换头即换表情）；身子、胳膊、腿、尾巴 = 每帧按姿势画的粉笔（关节不断）。
// 坐标：角色本地，原点在两脚中间的地面，y 向下，+x = 角色面朝的方向（3/4 侧向，头像都朝右）。
import { clamp, lerp } from '/core/lib.js';
import { n1 } from './chalk.js';

export const PAL = {
  kid: { fur: '#ee8a3e', white: '#f2eee2', jacket: '#3f7fd0', stripe: '#f4f0e6', pants: '#3a74c4', shoe: '#f2eee2', pack: '#d8483a', line: '#f6f1e4', paw: '#7d4a30' },
  adult: { fur: '#b9bab2', white: '#ecebe4', jacket: '#a6a8a1', stripe: '#e0e0d8', pants: '#8f918a', shoe: '#cfcfc8', pack: '#9a9c95', line: '#f2f1ea', paw: '#7a7c76', tie: '#6d6f69', shirt: '#ecebe4', case: '#b0b2ab' },
};
// 身材（px，角色本地）。headH = 头像在画面里的高度；neck = 头像下沿落点
export const BODY = {
  kid: { hip: 150, sh: 284, neck: 268, headH: 300, headDX: 6, shW: 50, hipW: 44, thigh: 74, shin: 62, upper: 84, fore: 76, armW: 16, legW: 21, shoe: 34, tail: 150 },
  adult: { hip: 318, sh: 545, neck: 536, headH: 270, headDX: -8, shW: 58, hipW: 46, thigh: 148, shin: 138, upper: 150, fore: 138, armW: 18, legW: 22, shoe: 44, tail: 190 },
};
export const HEADS = { kid: [], adult: [] };   // Image[]，main 里加载
export const EXPR = { kid: { calm: 0, laugh: 1, proud: 2, sad: 3, wow: 4, closed: 5 }, adult: { calm: 0, smile: 1, sad: 2, closed: 3, wow: 4, call: 5 } };

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export function ik2(ax, ay, tx, ty, L1, L2, bend) {
  const dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy);
  const dc = clamp(d, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.999);
  const a = Math.atan2(dy, dx), cosA = clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1);
  const t1 = a + bend * Math.acos(cosA), jx = ax + L1 * Math.cos(t1), jy = ay + L1 * Math.sin(t1), t2 = Math.atan2(ty - jy, tx - jx);
  return { j: [jx, jy], e: [jx + L2 * Math.cos(t2), jy + L2 * Math.sin(t2)], reach: Math.max(0, d - (L1 + L2)) };
}
// Catmull 平滑
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
    const w = (wf ? w0 * wf(f) : lerp(w0, w1, f)) * (1 + 0.05 * Math.sin(f * 7.3));
    L.push(J(P[i][0] - ty / tl * w, P[i][1] + tx / tl * w)); R.push(J(P[i][0] + ty / tl * w, P[i][1] - tx / tl * w));
  }
  // 两端圆头
  const cap = (c, a0, w) => Array.from({ length: 6 }, (_, k) => { const a = a0 + Math.PI * (k + 1) / 7; return J(c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w); });
  const e = P[n - 1], pe = P[n - 2], ae = Math.atan2(e[1] - pe[1], e[0] - pe[0]) - Math.PI / 2;
  const s = P[0], ps = P[1], as = Math.atan2(s[1] - ps[1], s[0] - ps[0]) - Math.PI / 2;
  const we = wf ? w0 * wf(1) : w1, ws = wf ? w0 * wf(0) : w0;
  return { poly: L.concat(cap(e, ae, we), R.reverse(), cap(s, as, ws)), spine: P };
}

// 画一个角色。layers = { back: {fill,line}, front: {fill,line}, flush(), raster }，见 main.js 的 drawCharacter
export function drawFox(G, who, P) {
  const B = BODY[who], C = PAL[who], s = P.scale ?? 1, boil = P.boil ?? 0;
  const J = (x, y, amp = 1.3) => [x + (n1(x * 0.031 + y * 0.017 + boil * 7.3, 3) - 0.5) * 2 * amp, y + (n1(y * 0.029 - x * 0.013 + boil * 5.1, 9) - 0.5) * 2 * amp];
  const crouch = P.crouch ?? 0, lean = P.lean ?? 0;
  const hip = [P.hipX ?? 0, -B.hip * (1 - 0.2 * crouch) + (P.bob ?? 0) - (P.lift ?? 0)];
  const torsoLen = (B.sh - B.hip) * (1 - (P.squash ?? 0) * 0.08);
  const up = (d, a = lean) => [hip[0] + Math.sin(a) * d, hip[1] - Math.cos(a) * d];
  const sh = up(torsoLen), neck = up(torsoLen + (B.neck - B.sh));
  const shN = [sh[0] + B.shW * 0.5, sh[1] + 8], shF = [sh[0] - B.shW * 0.72, sh[1] + 4];
  const hipN = [hip[0] + B.hipW * 0.32, hip[1] - 4], hipF = [hip[0] - B.hipW * 0.42, hip[1] - 6];
  const ft = P.feet || { n: [B.hipW * 0.45, 0], f: [-B.hipW * 0.5, 0] }, fl = P.footLift || { n: 0, f: 0 };
  const leg = (h, f, l) => ik2(h[0], h[1], f[0], f[1] - B.shoe * 0.5 - l, B.thigh, B.shin, -1);
  const LN = leg(hipN, ft.n, fl.n), LF = leg(hipF, ft.f, fl.f);
  const armDef = (shp, sw) => [shp[0] + Math.sin(sw) * (B.upper + B.fore) * 0.93, shp[1] + Math.cos(sw) * (B.upper + B.fore) * 0.93];
  const ht = P.hands || {};
  const AN = ik2(shN[0], shN[1], ...(ht.n || armDef(shN, P.swingN ?? 0.06)), B.upper, B.fore, P.elbowN ?? 1);
  const AF = ik2(shF[0], shF[1], ...(ht.f || armDef(shF, P.swingF ?? -0.06)), B.upper, B.fore, P.elbowF ?? 1);
  P._out = { hip, sh, neck, LN, LF, AN, AF, shN, shF };

  const tf = (c) => { c.save(); c.translate(P.x, P.y ?? 0); c.scale(s * (P.face ?? 1) * (P.sx ?? 1), s); c.globalAlpha = P.ink ?? 1; };
  const poly = (c, pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
  const line = (c, pts, col, w, close = true) => { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); c.stroke(); };
  const limb = (L, a, b, c, w0, w1, col, dark) => { const T = tube([a, b, c], w0, w1, J); poly(L.fill, T.poly, dark ? shade(col) : col); line(L.line, T.poly, C.line, 3.4); return T; };
  const shoe = (L, ank, tilt, dark) => { const pts = smooth([[-0.5, -0.5], [0.5, -0.55], [1.05, -0.15], [1.05, 0.35], [-0.55, 0.35]].map(([x, y]) => { const [rx, ry] = rot(x * B.shoe, y * B.shoe * 0.7, tilt); return [ank[0] + rx, ank[1] + B.shoe * 0.42 + ry]; }), 4, true).map(([x, y]) => J(x, y)); poly(L.fill, pts, dark ? shade(C.shoe) : C.shoe); line(L.line, pts, C.line, 3.2); };
  const paw = (L, end, from, dark) => { const a = Math.atan2(end[1] - from[1], end[0] - from[0]) - Math.PI / 2; const pts = smooth(Array.from({ length: 7 }, (_, k) => { const t = k / 7 * Math.PI * 2; const [x, y] = rot(Math.cos(t) * B.armW * 1.05, Math.sin(t) * B.armW * 1.25 + B.armW * 0.5, a); return [end[0] + x, end[1] + y]; }), 4, true).map(([x, y]) => J(x, y)); poly(L.fill, pts, dark ? shade(C.paw) : C.paw); line(L.line, pts, C.line, 2.6); };

  // ----- 后层：尾巴、远侧腿、书包、远侧胳膊、身子
  const K = G.back; tf(K.fill); tf(K.line);
  {
    // 尾巴：从屁股后面向后、再向上翘的弧，末端随 tailPh 摆
    const ph = P.tailPh ?? 0, amp = P.tailAmp ?? 0.25, Lt = B.tail, up = P.tailUp ?? 0;
    const base = [hip[0] - B.hipW * 0.55, hip[1] + 4];
    const ctl = [[0, 0], [-0.42, 0.12], [-0.82, 0.02 - up * 0.3], [-1.05, -0.3 - up * 0.4], [-1.08, -0.62 - up * 0.3]];
    const pts = ctl.map(([u, v], i) => { const f = i / 4, sw = amp * Math.sin(ph - f * 1.9) * f; const [rx, ry] = rot(u * Lt, v * Lt, sw); return [base[0] + rx, base[1] + ry]; });
    const wf = (f) => 0.45 + 1.55 * Math.sin(Math.min(1, f * 1.05) * Math.PI * 0.92) * (1 - f * 0.15);
    const T = tube(pts, B.legW * 0.55, 0, J, wf); poly(K.fill, T.poly, C.fur);
    // 白尾尖：最后 28% 的那段
    const sp = T.spine, k0 = Math.floor(sp.length * 0.72), tipPts = sp.slice(k0);
    const TT = tube([tipPts[0], tipPts[Math.floor(tipPts.length / 2)], tipPts[tipPts.length - 1]], B.legW * 0.55 * wf(0.72), 0, J, (f) => (1 - f) * 0.95 + 0.05);
    poly(K.fill, TT.poly, C.white); line(K.line, T.poly, C.line, 3.2);
    G.flush();
  }
  limb(K, hipF, LF.j, LF.e, B.legW, B.legW * 0.88, C.pants, true); shoe(K, LF.e, P.footTilt?.f ?? 0, true); G.flush();
  if (who === 'kid') { const bx = sh[0] - B.shW * 0.95, by = sh[1] + 12; const bag = smooth([[bx - 16, by + 4], [bx + 38, by - 8], [bx + 48, by + 112], [bx - 12, by + 120]], 4, true).map(([x, y]) => J(x, y)); poly(K.fill, bag, C.pack); line(K.line, bag, C.line, 3.2); G.flush(); }
  limb(K, shF, AF.j, AF.e, B.armW, B.armW * 0.85, C.jacket, true); paw(K, AF.e, AF.j, true); G.flush();
  {
    const w0 = B.shW, w1 = B.hipW, Hh = torsoLen, cl = Math.cos(lean), sl = Math.sin(lean);
    const T = (u, v) => J(hip[0] + u * cl + v * sl, hip[1] + u * sl - v * cl);
    const body = smooth([[-w1 * 1.0, -16], [-w1 * 0.1, -20], [w1 * 0.95, -16], [w0 * 0.95, Hh * 0.5], [w0 * 0.8, Hh + 2], [w0 * 0.2, Hh + 12], [-w0 * 0.6, Hh + 8], [-w0 * 1.02, Hh * 0.55]], 5, true).map(([u, v]) => T(u, v));
    poly(K.fill, body, C.jacket);
    if (who === 'kid') {
      poly(K.fill, smooth([[-w0 * 0.55, Hh + 8], [w0 * 0.55, Hh + 8], [w0 * 0.25, Hh * 0.55], [-w0 * 0.3, Hh * 0.55]], 3, true).map(([u, v]) => T(u, v)), C.stripe);
      line(K.line, [[-w0 * 1.0, Hh * 0.42], [0, Hh * 0.2], [w0 * 0.95, Hh * 0.45]].map(([u, v]) => T(u, v)), C.stripe, 8, false);
      line(K.line, [[w0 * 0.05, Hh + 6], [w0 * 0.08, -8]].map(([u, v]) => T(u, v)), '#c9d4e2', 2.2, false);
      line(K.line, [[-w0 * 0.72, Hh + 4], [-w0 * 0.86, Hh * 0.35]].map(([u, v]) => T(u, v)), C.pack, 9, false);
      line(K.line, [[w0 * 0.55, Hh + 4], [w0 * 0.72, Hh * 0.4]].map(([u, v]) => T(u, v)), C.pack, 9, false);
    } else {
      poly(K.fill, [[-w0 * 0.3, Hh + 8], [w0 * 0.32, Hh + 8], [w0 * 0.1, Hh * 0.22], [-w0 * 0.12, Hh * 0.22]].map(([u, v]) => T(u, v)), C.shirt);
      const tie = [[-0.07, Hh + 2], [0.1, Hh + 2], [0.13, Hh * 0.3], [0.01, Hh * 0.2], [-0.1, Hh * 0.3]].map(([u, v]) => T(u * (u > 1 ? 1 : w0), v));
      poly(K.fill, tie, C.tie);
      line(K.line, [[-w0 * 0.32, Hh + 8], [-w0 * 0.05, Hh * 0.45], [-w0 * 0.15, Hh * 0.05]].map(([u, v]) => T(u, v)), C.line, 3, false);
      line(K.line, [[w0 * 0.34, Hh + 8], [w0 * 0.12, Hh * 0.45], [w0 * 0.2, Hh * 0.05]].map(([u, v]) => T(u, v)), C.line, 3, false);
      line(K.line, [[-w1 * 1.0, 4], [w1 * 0.95, 4]].map(([u, v]) => T(u, v)), C.line, 2.4, false);
    }
    line(K.line, body, C.line, 3.8);
  }
  K.fill.restore(); K.line.restore();
  G.flush();
  // ----- 头像（不加颗粒，本身就是粉笔画）
  {
    const img = HEADS[who][P.expr ?? 0];
    if (img) {
      const R = G.raster, hs = B.headH / img.height, ht2 = (P.headTilt ?? 0) + lean * 0.6;
      R.save(); R.translate(P.x, P.y ?? 0); R.scale(s * (P.face ?? 1) * (P.sx ?? 1), s); R.globalAlpha = P.ink ?? 1;
      R.translate(neck[0] + B.headDX + (P.headX ?? 0), neck[1] + 14 + (P.headY ?? 0)); R.rotate(ht2); R.scale(hs * (1 + (P.headSquash ?? 0) * 0.04), hs * (1 - (P.headSquash ?? 0) * 0.05));
      R.drawImage(img, -img.width * 0.5, -img.height); R.restore();
    }
  }
  // ----- 前层：近侧腿、近侧胳膊、手里的东西
  const Fr = G.front; tf(Fr.fill); tf(Fr.line);
  limb(Fr, hipN, LN.j, LN.e, B.legW, B.legW * 0.88, C.pants, false); shoe(Fr, LN.e, P.footTilt?.n ?? 0, false);
  if (who === 'kid') line(Fr.line, smooth([hipN, LN.j, LN.e], 5).map(([x, y]) => J(x + B.legW * 0.5, y)), C.stripe, 3.5, false);
  G.flush();
  if (who === 'adult' && P.briefcase !== false) {
    const hand = P.caseHand === 'f' ? AF.e : AN.e, sw = P.caseSwing ?? 0, cw = 116, ch = 84;
    const box = smooth([[-cw / 2, 20], [cw / 2, 20], [cw / 2, 20 + ch], [-cw / 2, 20 + ch]].map(([x, y]) => { const [rx, ry] = rot(x, y, sw); return [hand[0] + rx, hand[1] + ry]; }), 2, true).map(([x, y]) => J(x, y));
    poly(Fr.fill, box, C.case); line(Fr.line, box, C.line, 3.2);
    line(Fr.line, [[-18, 20], [-14, 6], [14, 6], [18, 20]].map(([x, y]) => { const [rx, ry] = rot(x, y, sw); return J(hand[0] + rx, hand[1] + ry); }), C.line, 3, false);
    G.flush();
  }
  limb(Fr, shN, AN.j, AN.e, B.armW, B.armW * 0.85, C.jacket, false); paw(Fr, AN.e, AN.j, false);
  if (who === 'kid') line(Fr.line, smooth([shN, AN.j, AN.e], 5).map(([x, y]) => J(x + B.armW * 0.45, y)), C.stripe, 3, false);
  if (P.hold) P.hold(Fr, AN.e, AF.e, J);
  Fr.fill.restore(); Fr.line.restore();
  G.flush();
}
function shade(hex) { const v = parseInt(hex.slice(1), 16), k = 0.78; return `rgb(${((v >> 16) & 255) * k | 0},${((v >> 8) & 255) * k | 0},${(v & 255) * k | 0})`; }
