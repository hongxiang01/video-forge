// S4 —— 擀面 · 正俯，近景 → 中景（TREATMENT §4 镜头表 S4、§4.4 面片、§5 9.00–12.00）
// 9.0–10.5 杖每拍一来一回，面片 0.30 → 0.45 m，镜头同步从 150% 拉到 100%（ease-out），面片在画里一直约 620 px；
// 10.5–11.25 双手搭在杖上歇一拍（镜头停，只有空中的面粉在飘）；11.25 手腕先压，再擀最后一下，杖停在面片近边。
// 世界坐标（米，台面平面）：X 向右，Y 向远（画面上方）；面片中心 (0, 0) 钉在画面 (CX, CY)。手和杖按 12 fps 换张，镜头每帧动。
import { cel, path, line, mix, rgba, rng, hash, canvas, airbrush, TAU } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { hand, digit, part, backOfHand, FW, FWK } from '../hands.js';

// —— 手型：手掌平按在杖上（右手定义，左手镜像；本地 掌宽 = 1，前臂从 +y 来；锚点 = 掌下的杖轴，杖横在掌心偏上 y = 0）——
// 正俯看手背。每根手指在干什么：四指放松、搭过杖伸到面片上方（不扣、不握、不使劲）。在掌指关节处往外张开，角度各不相同 ——
// 中指最正、食指往虎口偏、无名指挨着中指、小指离得最开；每个关节都微微弯（往掌心弯 → 正俯里中节缩得最多），
// 越往指尖越往中指那边收一点 → 指缝是长短不一的 V 形，不是平行等距的耙齿；指尖略翘 → 末节比中节缩得少。
// 拇指从掌根虎口一侧斜着出来（和食指分开约 55°），指腹搭在杖的近侧上沿、指尖朝里，第二节往食指那边勾一点。
// 手腕：前臂从画外偏外侧斜着进来（本地 78°），手在腕上往里拐 —— 腕上有个角度，不是一根直管。
// w：0 = 推（掌平压、四指最舒展）→ 1 = 歇（四指松下来、往回收、末节缩得更多，指缝并拢一些但仍然错开）
const SEG = { i: [.279, .186, .155], m: [.306, .204, .170], r: [.284, .189, .158], l: [.225, .150, .125] };   // 各指三节标准长（= hands.js FL × PH）
const FINGERS = [   // 画的顺序：小指在下、食指在上。[指, 根点, 推时三节角度°, 歇时三节角度°, 推时三节缩短, 歇时三节缩短]
  ['l', [.33, -.33], [-62, -69, -78], [-67, -74, -82], [.95, .86, .91], [.91, .78, .80]],
  ['r', [.13, -.43], [-81, -85, -90], [-84, -87, -91], [.96, .88, .93], [.93, .81, .83]],
  ['m', [-.10, -.46], [-92, -89, -87], [-90, -88, -87], [.98, .90, .95], [.95, .83, .85]],
  ['i', [-.34, -.38], [-106, -100, -95], [-102, -97, -92], [.97, .91, .95], [.95, .84, .86]],
];
// 袖子：前臂从画外偏外侧斜着进来、带一点弧（中线越往肘越往外弯），里侧（拇指一侧）前臂中段鼓出一点、外侧较直；三道从袖边起的硬边斜褶。
// hand() 自带的是直筒袖：draw 里只留它袖口那一截（arm: .04），这条弯袖接在袖口下面、画在手掌下面（袖口最后画，盖住接缝）
function sleeve(W0, a) {
  const d = [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)], n = [-d[1], d[0]];   // +n = 里侧（拇指一侧）
  const P = (t, x, k) => { const b = -.05 * Math.max(0, t - .6) ** 2, q = [W0[0] + d[0] * t + n[0] * (x + b), W0[1] + d[1] * t + n[1] * (x + b)]; return k ? [...q, 1] : q; };
  const hw = (t, sg) => .47 + .16 * Math.min(1, Math.max(0, t - .56) / 2.4) + (sg > 0 ? .05 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - .9) / 2.4))) : 0);
  const fold = (t0, sg, t1, x1, wd) => {   // 一道硬边褶：从袖边起的楔形，弯着往袖子中间收成尖（同 hands.js 袖褶的画法）
    const m2 = P(t0 + wd + (t1 - t0 - wd) * .5, sg * (x1 + (hw(t0, sg) - x1) * .5) - sg * .015), tip = P(t1, sg * x1, 1);
    return [[P(t0, sg * (hw(t0, sg) + .1), 1), P(t0 + (t1 - t0) * .45, sg * (x1 + (hw(t0, sg) - x1) * .58) + sg * .02), tip, m2, P(t0 + wd, sg * (hw(t0 + wd, sg) + .1), 1)], [m2, tip]];
  };
  const F = [fold(.66, -1, 1.22, .05, .16), fold(1.3, 1, 2.0, .07, .2), fold(2.25, -1, 2.95, .1, .18)], T = [.9, 1.4, 2.0, 2.7, 3.5];
  return part('sleeve', [P(.56, -.47, 1), P(.56, .47, 1), ...T.map(t => P(t, hw(t, 1))), P(4.6, hw(4.6, 1), 1), P(4.6, -hw(4.6, -1), 1), ...T.slice().reverse().map(t => P(t, -hw(t, -1)))], {
    sh: F.map(f => f[0]), ln: F.map(f => f[1]) });
}
function palmOnPin(w = 0) {
  const L = (a, b) => a.map((v, j) => v + (b[j] - v) * w);
  return () => {
    const palm = part('skin', ['W', [-.48, -.31], [-.33, -.44], [-.12, -.50], [.10, -.47], [.30, -.39], [.46, -.26], [.53, .01], [.50, .30], [.46, .50], [.42, .61, 1], [-.31, .64, 1], [-.44, .47], [-.53, .26], [-.57, .06], [-.56, -.14]], {
      cal: [[[-.62, -.20], [-.60, .02], [-.54, -.02], [-.55, -.12], [-.52, -.19]]] });   // 虎口老茧：从手背只看到边上一条
    backOfHand(palm, [[.34, -.33], [.13, -.42], [-.10, -.46], [-.33, -.40]], [.03, .58], 21);
    const fing = FINGERS.flatMap(([f, b, a0, a1, k0, k1], i) =>
      digit(b, L(a0, a1), L(k0, k1).map((k, j) => SEG[f][j] * k), { w: FW * FWK[f], back: true, cal: f === 'i' ? -1 : 0, id: 12 + i }));
    const thumb = digit([-.47, .30], [-160 + 4 * w, -148 + 6 * w], [.31, .27 - .02 * w], { w: .28, nail: true, back: true, id: 19 });
    // ww .84：前臂斜进来时腕外侧（小指一侧）只收一道浅弯，不在掌根角上掐出尖
    return { arm: { w: [.03, .61], a: 78, ww: .84 }, parts: [sleeve([.03, .61], 78), ...thumb, palm, ...fing] };
  };
}
const PUSH = palmOnPin(0), MID = palmOnPin(.45), REST = palmOnPin(1);

const K1 = 1378, CX = 960, CY = 430;                                     // 100% 时 px/m（0.45 m ≈ 620 px）；面片中心
const KP = K1 * 1.5, PX0 = -0.78, PY1 = 0.36, PWm = 1.56, PHm = 0.92;    // 背景板：按 150% 的分辨率画一次，之后只缩放
const PIN = { half: 0.31, r: 0.024 }, HANDX = 0.165, PALM = 0.145;        // 掌宽 0.145 m → 150% 时 300 px，100% 时 200 px
const ease = u => 1 - (1 - u) * (1 - u);
const zoomAt = lt => lt < 1.5 ? 1.5 - 0.5 * ease(lt / 1.5) : 1;
const EDGE = '#F2E4C8';                                                   // 面片边缘薄处（§4.4）

// —— 背景板：正俯的台面（横向木板 + 木纹 + 结疤 + 暖灯光圈 + 散落面粉）——
let PLATE = null;
function plate() {
  if (PLATE) return PLATE;
  const [c, x] = canvas(Math.round(PWm * KP), Math.round(PHm * KP)), w = c.width, h = c.height, B = BG.warm, R = rng(404);
  const toP = (X, Y) => [(X - PX0) * KP, (PY1 - Y) * KP];
  x.fillStyle = B.wood; x.fillRect(0, 0, w, h);
  const pw = 0.135 * KP;
  for (let i = 0, y0 = -0.05 * KP; y0 < h; i++, y0 += pw) {
    x.fillStyle = mix(B.wood, i % 2 ? '#6A3C20' : '#8A5634', .45); x.fillRect(0, y0, w, pw);
    const gc = mix(B.wood, B.grain, .55);
    for (let j = 0; j < 9; j++) {                                          // 木纹：沿板长的波线
      const yy = y0 + pw * (.08 + .84 * R()), pts = [];
      for (let xx = -40; xx < w + 80; xx += 160) pts.push([xx, yy + Math.sin(xx / (300 + 200 * R()) + j) * (4 + 6 * R())]);
      line(x, pts, gc, 1.4 + R() * 1.6);
    }
    const kx = w * R(), ky = y0 + pw * (.3 + .4 * R());                    // 一个结疤
    for (let r = 3; r > 0; r--) { x.strokeStyle = gc; x.lineWidth = 2; x.beginPath(); x.ellipse(kx, ky, 18 * r + 6, 6 * r + 3, 0, 0, TAU); x.stroke(); }
    x.fillStyle = B.grain; x.beginPath(); x.ellipse(kx, ky, 9, 4, 0, 0, TAU); x.fill();
    x.fillStyle = B.grain; x.fillRect(0, y0 - 3, w, 6);                    // 板缝 + 下沿一道亮边
    x.fillStyle = mix(B.wood, '#C08A55', .45); x.fillRect(0, y0 + 3, w, 3);
  }
  const [hx, hy] = toP(-0.12, 0.06);
  airbrush(x, hx, hy, 0.78 * KP, 0.58 * KP, B.woodHalo, .8, .95);         // 吊灯在左上方：光圈偏左偏远
  const gr = x.createRadialGradient(hx, hy, 0.3 * KP, hx, hy, 1.0 * KP);
  gr.addColorStop(0, rgba(B.woodDark, 0)); gr.addColorStop(1, rgba(B.woodDark, .85)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  // 面粉：面片外一圈的撒粉（硬边小块 + 细点），越远越稀
  const fl = C('flour').f;
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, d = 0.24 + Math.pow(R(), 2.2) * 0.3, [px, py] = toP(Math.cos(a) * d * 1.15, Math.sin(a) * d * .9);
    const rr = (d < .3 && R() < .5 ? 10 + 18 * R() : 2 + 5 * R()), n = 7, pts = [];
    for (let k = 0; k < n; k++) { const b = k / n * TAU; pts.push([px + Math.cos(b) * rr * (.6 + .6 * R()), py + Math.sin(b) * rr * (.5 + .5 * R())]); }
    x.fillStyle = rr > 12 ? rgba(fl, .78) : fl; x.fill(path(pts));
  }
  for (let i = 0; i < 900; i++) {
    const a = R() * TAU, d = 0.2 + Math.pow(R(), 2) * 0.45, [px, py] = toP(Math.cos(a) * d * 1.2, Math.sin(a) * d * .85);
    x.fillStyle = rgba(fl, .5 + .5 * R()); x.beginPath(); x.arc(px, py, 1.5 + 3 * R(), 0, TAU); x.fill();
  }
  return (PLATE = c);
}

// —— 面片：不规则圆，外圈 18 px 薄边，右下一道硬边厚度影，表面撒粉 ——
const DR = rng(77), SPECK = Array.from({ length: 46 }, () => { const a = DR() * TAU, d = Math.sqrt(DR()) * .86; return [Math.cos(a) * d, Math.sin(a) * d, 1.2 + DR() * 2.6]; });
function ringPts(rpx, inset) {
  const pts = [];
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * TAU, r = rpx * (1 + .022 * Math.sin(3 * a + 1.3) + .015 * Math.sin(5 * a + .4) + .01 * Math.sin(7 * a + 2)) - inset;
    pts.push([CX + Math.cos(a) * r, CY - Math.sin(a) * r * 1.0]);
  }
  return pts;
}
function dough(g, k, R) {
  const cd = C('dough'), rp = R * k, O = path(ringPts(rp, 0)), I = path(ringPts(rp, 18));
  g.save(); g.translate(6, 8); g.fillStyle = rgba(BG.warm.woodDark, .6); g.fill(O); g.restore();   // 贴台面的薄影
  g.fillStyle = EDGE; g.fill(O);
  g.fillStyle = cd.f; g.fill(I);
  g.save(); g.clip(O);
  const Q = new Path2D(); Q.addPath(O); Q.addPath(O, new DOMMatrix().translate(-5, -7)); g.fillStyle = cd.s; g.fill(Q, 'evenodd');
  g.fillStyle = C('flour').f;
  for (const [u, v, r] of SPECK) { g.beginPath(); g.arc(CX + u * rp, CY - v * rp, r * k / K1, 0, TAU); g.fill(); }
  g.restore();
  g.strokeStyle = cd.l; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke(O);
}

// —— 擀面杖（正俯：圆头长条，远侧受光、近侧硬边影，落影偏右下）——
function pin(g, x0, x1, y, r) {
  const cp = C('pin'), body = new Path2D(), sh = new Path2D(), hi = new Path2D();
  body.roundRect(x0, y - r, x1 - x0, 2 * r, r * .75);
  sh.roundRect(x0 + r * .6, y - r * .2, x1 - x0, 2 * r, r * .75);
  g.fillStyle = rgba(BG.warm.woodDark, .5); g.fill(sh);
  hi.roundRect(x0 + r * 1.2, y - r * .66, x1 - x0 - r * 2.4, r * .26, r * .13);
  cel(g, body, { f: cp.f, s: cp.s, so: [0, -r * .9], h: cp.h, hi: [hi] });
  g.save(); g.clip(body); line(g, [[x0 + r * 2, y + r * .4], [(x0 + x1) / 2, y + r * .48], [x1 - r * 2, y + r * .36]], mix(cp.f, cp.l, .35), 1.3); g.restore();
  g.strokeStyle = cp.l; g.lineWidth = 2; g.stroke(body);
}

// —— 动作（tc = 按 12 fps 取整的镜头内秒数）——
function act(tc) {
  if (tc < 1.5) { const R = 0.225 / zoomAt(tc), p = (tc / 0.75) % 1; return { R, Y: -0.5 * R * Math.cos(TAU * p), pose: p < .5 ? PUSH : MID }; }   // 每拍一来一回：推出去掌平压，拉回来四指略松
  const R = 0.225, A = 0.5 * R;
  if (tc < 1.59) return { R, Y: -A, pose: MID };                                 // 中间张：推完松下来
  if (tc < 2.25) return { R, Y: -A, pose: REST };                                // 歇一拍：双手搭在杖上
  if (tc < 2.42) return { R, Y: -A - 0.006, pose: PUSH, press: 1 };              // 手腕先压（预备）
  const u = Math.min(1, (tc - 2.42) / 0.42), Yf = 0.42 * R, Ye = -0.9 * R;       // 最后一下：推出去、拉回到面片近边停住
  const Y = u < .5 ? -A + (Yf + A) * ease(u / .5) : Yf + (Ye - Yf) * ease((u - .5) / .5);
  const out = Math.min(1, Math.max(0, (tc - 2.84) / .16));                       // 杖停在近边后，双手顺着杖往两头滑、搭到面片外（接 S5 握在杖两端）
  return { R: R + 0.01 * u, Y, pose: u < .5 ? PUSH : u < 1 ? MID : REST, hx: HANDX + 0.095 * ease(out) };
}

// 空中飘的面粉：每帧都动（歇的那一拍画面里只有它在动）
function motes(g, lt) {
  const fl = C('flour').f;
  for (let i = 0; i < 16; i++) {
    const sp = 14 + 26 * hash(i + 9), x = (hash(i * 3.1) * 2100 + lt * sp * (.5 + hash(i * 7.7))) % 2100 - 90;
    const y = (hash(i * 7.7 + 1) * 1000 + lt * sp * 1.2) % 1000 - 40 + Math.sin(lt * 1.3 + i) * 6;
    g.fillStyle = rgba(fl, .9); g.beginPath(); g.arc(x, y, 1.5 + 2.5 * hash(i * 1.9), 0, TAU); g.fill();
  }
}

export function draw(g, e, lt, A, t) {
  const z = zoomAt(lt), k = K1 * z, tc = Math.floor(lt * 12 + 1e-6) / 12, P = act(tc);
  const S = (X, Y) => [CX + X * k, CY - Y * k];
  g.drawImage(plate(), CX + PX0 * k, CY - PY1 * k, PWm * k, PHm * k);
  dough(g, k, P.R);
  const [x0, py] = S(-PIN.half, P.Y), [x1] = S(PIN.half, P.Y);
  pin(g, x0, x1, py, PIN.r * k);
  const s = PALM * k;
  for (const sd of [-1, 1]) {
    const [hx, hy] = S(sd * (P.hx ?? HANDX), P.Y);
    const o = { x: hx, y: hy + (P.press ? 0.006 * k : 0), s, rot: -sd * .12, side: sd < 0 ? 'L' : 'R', pose: P.pose, light: 'warm', arm: .04 };   // 直筒袖只留袖口一截，袖子在手型里（sleeve）
    g.fillStyle = rgba(BG.warm.woodDark, .35);                                  // 手落在面片上的硬边影（灯在左上 → 影往右下）
    g.beginPath(); g.ellipse(o.x + .12 * s - sd * .05 * s, o.y - .08 * s, .62 * s, .5 * s, -sd * .3, 0, TAU); g.fill();
    hand(g, e, o);
  }
  motes(g, lt);
  return {};
}
