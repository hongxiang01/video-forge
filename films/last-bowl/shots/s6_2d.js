// S6 —— 切面 · 一镜三段（TREATMENT §4 镜头表 S6、§4.4 生面条、§5 15.00–18.00）
// 15.0–16.5 横摇跟刀：每八分一刀（9 帧按 3-2-2-2：落刀那张多停一帧），刀每刀左移 30 px，镜头匀速摇 120 px；
// 16.5–17.25 推到刀刃（100% → 150%，ease-in，锚点刀刃），同速 2 刀；17.25–18.0 快速拉回（150% → 100%，ease-out），
// 双手从中间抓起面条一抖：抓起 → 抖开成扇形 → 落定（3 张），干粉按 24 帧落下。
// 场景坐标 = 100% 时的屏幕 px；机位：台面高度略俯、从左前方看，面块沿 X 横放，进深方向在画面上朝右上（DEP）。
import { cel, path, poly, line, mix, rgba, rng, hash, canvas, airbrush, vgrad, ribbon, flutter, TAU } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { hand, digit, part, FW, FWK } from '../hands.js';

// —— 这个镜头自己的手型（本地 掌宽 = 1；切面段直接按画面朝向摆，rot = 0、side 'R' 不镜像）——
// 师傅站在近侧（镜头这边）：两条前臂都从画面下方 / 左下带弧度伸进来，右臂（握刀）离镜头更近、压在左臂前面。
// 弯袖（同 S4 的做法）：hand() 自带的直筒袖只留袖口一截（arm: .04），这条袖子接在袖口下面、画在手掌下面（袖口最后画，盖住接缝）。
// 从腕点 W0 沿本地方向 a（度）出去，中线越往肘越往 bend 一侧弯（二次曲线：+ = 往 n = [−d.y, d.x] 一侧）；越往外越粗（离镜头近）；三道从袖边起的硬边斜褶
const DG = Math.PI / 180;
function sleeve(W0, a, bend, grow = .12) {
  const d = [Math.cos(a * DG), Math.sin(a * DG)], n = [-d[1], d[0]];
  const P = (t, x, k) => { const b = bend * Math.max(0, t - .6) ** 2, q = [W0[0] + d[0] * t + n[0] * (x + b), W0[1] + d[1] * t + n[1] * (x + b)]; return k ? [...q, 1] : q; };
  const hw = (t, sg) => .47 + grow * Math.min(1, Math.max(0, t - .56) / 2.6) + (sg > 0 ? .05 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - .9) / 2.4))) : 0);
  const fold = (t0, sg, t1, x1, wd) => {   // 一道硬边褶：从袖边起的楔形，弯着往袖子中间收成尖
    const m2 = P(t0 + wd + (t1 - t0 - wd) * .5, sg * (x1 + (hw(t0, sg) - x1) * .5) - sg * .015), tip = P(t1, sg * x1, 1);
    return [[P(t0, sg * (hw(t0, sg) + .1), 1), P(t0 + (t1 - t0) * .45, sg * (x1 + (hw(t0, sg) - x1) * .58) + sg * .02), tip, m2, P(t0 + wd, sg * (hw(t0 + wd, sg) + .1), 1)], [m2, tip]];
  };
  const F = [fold(.66, -1, 1.22, .05, .16), fold(1.3, 1, 2.0, .07, .2), fold(2.25, -1, 2.95, .1, .18)], T = [.9, 1.4, 2.0, 2.7, 3.5, 4.4], E = 5.4;
  return part('sleeve', [P(.56, -.47, 1), P(.56, .47, 1), ...T.map(t => P(t, hw(t, 1))), P(E, hw(E, 1), 1), P(E, -hw(E, -1), 1), ...T.slice().reverse().map(t => P(t, -hw(t, -1)))], {
    sh: F.map(f => f[0]), ln: F.map(f => f[1]) });
}
const at = (p, k) => k ? [...p, 1] : p;

// 左手护手（爪形）：从拇指一侧、略高处看。四指各干各的：近节从掌指骨节斜向下伸到刀面（食指最平、小指最陡，角度一根比一根大），
// 第二指节（PIP）贴着刀面、沿刀面往右上一根比一根远（间距不等）；中节往回折、末节收在指节后面按住面块（折得一根比一根深）；
// 拇指在近侧、比指尖再靠后，指腹按住面块。锚点 = 食指第二指节；腕往左下，前臂从左下角带弧度出画（压在右臂后面）。
function claw() {
  // [掌指骨节, 三节角度°, 三节长, 粗细]（小 → 食）
  const D = [[[.144, -.401], [47, 141, 176], [.20, .13, .10], FWK.l], [[-.002, -.344], [40, 129, 162], [.27, .17, .13], FWK.r],
    [[-.146, -.262], [35, 120, 151], [.30, .19, .14], FWK.m], [[-.245, -.136], [29, 111, 139], [.28, .18, .14], FWK.i]];
  const F = D.map(([b, an, ls, k], i) => digit(b, an, ls, { w: FW * k, back: true, id: 40 + i }));
  const palm = part('skin', ['W', [-.30, -.05], [-.22, -.19], [-.12, -.29], [.00, -.37], [.13, -.44], [.05, -.51], [-.16, -.54], [-.42, -.52], [-.64, -.44, 1], [-.53, .17, 1], [-.43, .12], [-.36, .03]], {
    sh: [[[-.58, -.22], [-.32, -.30], [-.08, -.40], [-.12, -.34], [-.34, -.24]]],   // 掌背上一道骨节下的硬边影（手背往下折到指根）
    cal: [[[-.42, .09], [-.32, .01], [-.28, .06], [-.36, .12]]] });                   // 虎口老茧露出一角
  const thumb = digit([-.50, .07], [26, 6], [.24, .18], { w: .28, back: true, nail: true, id: 45 });
  const W = [-.60, -.14];
  return { arm: { w: W, a: 165, ww: .72 }, parts: [sleeve(W, 165, -.035), ...F[0], ...F[1], ...F[2], palm, ...F[3], ...thumb] };
}
// 右手握刀柄：掌心朝镜头，前臂从左下角进来。刀柄斜穿过拳心（右下是刀身、左上是柄尾）；四指从柄的远侧绕过来扣在近侧：
// 每根只露中节 + 末节（指背 + 短指甲），PIP 骨节在拳的外缘（右上）排成一道弧 —— 中指最外、小指最里；中节横过刀柄往掌根走，
// 末节往刀身一侧勾、指尖收进掌里；四根粗细、长短、角度都不一样，相邻的互相压一点边。拇指从刀身一侧的大鱼际出来，
// 斜着压过食指、中指的末节（拇指尖顶到中指）。锚点 = 拳心里的刀柄轴。H(a, b)：a 沿柄往刀身，b 往拳的外缘（右上）
const H = (a, b, k) => at([a * .5 + b * .866, a * .866 - b * .5], k);
function knifeGrip() {
  const F = [[-.34, .14, [162, 128], [.13, .10], FWK.l], [-.15, .21, [154, 117], [.17, .12], FWK.r],
    [.06, .245, [147, 108], [.185, .13], FWK.m], [.265, .19, [141, 100], [.165, .12], FWK.i]]
    .flatMap(([a, b, an, ls, k], i) => digit(H(a, b), an, ls, { w: FW * k, back: true, nail: true, id: 50 + i }));
  const palm = part('skin', ['W', H(-.30, .26), H(-.47, .16), H(-.52, -.04), H(-.47, -.27), H(-.33, -.50, 1), H(.28, -.55, 1), H(.47, -.38), H(.56, -.14), H(.53, .10), H(.40, .24), H(.06, .30)], {
    ln: [[H(-.36, -.30), H(-.08, -.22), H(.22, -.30)]],                       // 掌根一道横纹
    cal: [[H(.36, -.06), H(.50, -.04), H(.50, -.20), H(.40, -.18)]] });        // 大鱼际上一块老茧（握刀磨出来的）
  const thumb = digit(H(.44, -.22), [-74, -104], [.25, .21], { w: .27, nail: true, back: true, id: 55 });
  const W = H(-.03, -.53);
  return { arm: { w: W, a: 115, ww: .8 }, parts: [sleeve(W, 115, -.03), palm, ...F, ...thumb] };
}
// 捏面：从拇指一侧看，拇指和食指、中指三个指尖捏在一起（锚点 = 捏点），无名指、小指松松地蜷进掌里（各蜷各的）；
// open > 0 = 将要捏上（指尖张开一点）。手在捏点下方，前臂往下、往外带弧度出画（师傅在近侧）
function pinch(open = 0) {
  return () => {
    const lit = digit([.21, .58], [4, 96, 172], [.12, .09, .07], { w: FW * FWK.l, back: true, id: 64 });
    const ring = digit([.25, .43], [-12, 82, 164], [.15, .11, .08], { w: FW * FWK.r, back: true, id: 65 });
    const palm = part('skin', ['W', [-.44, .26], [-.30, .22], [-.08, .30], [.14, .42], [.24, .66], [.25, 1.0, 1], [-.36, 1.02, 1], [-.48, .66]], {
      cal: [[[-.15, .25], [.09, .36], [.07, .47], [-.05, .43], [-.17, .35]]] });
    const middle = digit([-.20, .33], [-78 + 6 * open, -36 + 10 * open, 18 + 8 * open], [.30, .20, .16], { w: FW * FWK.m, back: true, id: 61 });
    const index = digit([-.34, .30], [-88 + 4 * open, -50 + 12 * open, 4 + 14 * open], [.28, .19, .16], { back: true, cal: 1, id: 62 });
    const thumb = digit([.10, .80], [-78, -100 - 10 * open, -122 - 14 * open], [.27, .22, .19], { w: .27, nail: true, id: 63 });
    const W = [-.06, 1.0];
    return { off: [-.06, .02], arm: { w: W, a: 96 }, parts: [sleeve(W, 96, .03), ...lit, ...ring, palm, ...middle, ...index, ...thumb] };
  };
}
const CLAW = claw, KGRIP = knifeGrip, PINCH = [pinch(.8), pinch(0), pinch(0)];

const BY0 = 600, BY1 = 690, DEP = [55, -46];          // 面块正面上沿 / 下沿；面块进深在画面上的位移
const LX = 150, RX = 1780, KX0 = 1100, NW = 30;        // 面块左端（叠口）/ 右端；第一刀位置；每根面宽
const EDGE = '#F2E4C8', HI = '#FFF4DC';
const P0 = [-240, -40], PW = 2400, PH = 1160, PK = 1.5;  // 背景板（按 150% 分辨率画一次）
const E = [965, 600], PAN = 120;                        // 推镜锚点（刀刃落在面块上的位置）

// 镜头：screen = Z·(p − F) + Fs
function cam(lt) {
  if (lt < 1.5) return { Z: 1, tx: PAN * lt / 1.5, ty: 0 };
  const u = lt < 2.25 ? (lt - 1.5) / .75 : (lt - 2.25) / .75;
  const Z = lt < 2.25 ? 1 + .5 * u * u : 1.5 - .5 * (1 - (1 - u) * (1 - u));
  return { Z, tx: E[0] + PAN - Z * E[0], ty: E[1] - Z * E[1] };
}

let PLATE = null;
function plate() {
  if (PLATE) return PLATE;
  const [c, x] = canvas(PW * PK, PH * PK), B = BG.warm, R = rng(606);
  x.scale(PK, PK); x.translate(-P0[0], -P0[1]);
  vgrad(x, P0[0], P0[1], PW, 380, [[0, B.wallFar], [1, mix(B.wallNear, B.wallFar, .35)]]);   // 墙：喷枪渐变
  airbrush(x, 300, 120, 900, 380, B.wallNear, .55, .9);
  x.fillStyle = B.wood; x.fillRect(P0[0], 330, PW, PH);
  let y = 330, sp = 34, i = 0;                                     // 台面：横向木板，越近越宽
  while (y < P0[1] + PH) {
    x.fillStyle = mix(B.wood, i % 2 ? '#6A3C20' : '#8A5634', .4); x.fillRect(P0[0], y, PW, sp);
    const gc = mix(B.wood, B.grain, .5);
    for (let j = 0; j < 4; j++) { const yy = y + sp * (.15 + .7 * R()), pts = []; for (let xx = P0[0]; xx < P0[0] + PW + 100; xx += 120) pts.push([xx, yy + Math.sin(xx / 260 + j * 2) * sp * .06]); line(x, pts, gc, 1 + sp / 80); }
    x.fillStyle = B.grain; x.fillRect(P0[0], y - 1.5, PW, 3);
    y += sp; sp *= 1.32; i++;
  }
  x.fillStyle = B.woodDark; x.fillRect(P0[0], 326, PW, 6);         // 台面后沿与墙的交线
  airbrush(x, 820, 640, 1100, 380, B.woodHalo, .75, .95);          // 吊灯光圈
  const gr = x.createRadialGradient(820, 600, 300, 820, 600, 1500);
  gr.addColorStop(0, rgba(B.woodDark, 0)); gr.addColorStop(1, rgba(B.woodDark, .8)); x.fillStyle = gr; x.fillRect(P0[0], P0[1], PW, PH);
  const fl = C('flour').f;                                           // 撒粉
  for (let k = 0; k < 700; k++) { x.fillStyle = rgba(fl, .4 + .6 * R()); x.beginPath(); x.arc(200 + R() * 1700, 560 + Math.pow(R(), 1.5) * 260, 1 + 2.5 * R(), 0, TAU); x.fill(); }
  return (PLATE = c);
}

// 面块的一段（xa → xb）：顶面平行四边形 + 正面 + 叠层线；left = 左端画叠口圆头
function block(g, xa, xb, lw, left) {
  const cd = C('dough'), top = poly([[xa, BY0], [xb, BY0], [xb + DEP[0], BY0 + DEP[1]], [xa + DEP[0], BY0 + DEP[1]]]);
  const front = poly([[xa, BY0], [xb, BY0], [xb, BY1], [xa, BY1]]);
  g.fillStyle = rgba(BG.warm.woodDark, .55); g.fillRect(xa + 6, BY1 - 4, xb - xa, 12);          // 贴台面的影
  cel(g, top, { f: EDGE, l: cd.l, lw });
  cel(g, front, { f: cd.f, s: cd.s, sh: [[[xa, BY1 - 16, 1], [xb, BY1 - 16, 1], [xb, BY1, 1], [xa, BY1, 1]]], l: cd.l, lw });
  for (const yy of [BY0 + 23, BY0 + 46, BY0 + 68]) line(g, [[xa + 4, yy], [xb, yy]], cd.s, 2 * lw / 2);
  if (left) {
    const cap = path([[xa + 6, BY0 + DEP[1], 1], [xa - 26, BY0 + DEP[1] * .4], [xa - 30, (BY0 + BY1) / 2], [xa - 20, BY1 - 6], [xa + 6, BY1, 1]], true);
    cel(g, cap, { f: cd.f, s: cd.s, so: [10, -10], l: cd.l, lw });
  }
}
function cuts(g, xa, xb, lw) {                                         // 切口：一条硬边阴影线（正面竖线 + 顶面沿进深的斜线）
  const cd = C('dough');
  for (let x = xa; x < xb - 4; x += NW) {
    g.fillStyle = cd.s; g.fill(poly([[x, BY0 + DEP[1]], [x, BY1], [x + 3, BY1], [x + 3, BY0], [x + 3 + DEP[0], BY0 + DEP[1]]].map(p => p)));
    g.fillStyle = HI; g.fillRect(x + 4, BY0 + 2, 2, BY1 - BY0 - 20);
  }
}

// 切面刀：长方形薄刃（刃沿进深方向，刀面朝机位），木柄从刀背后端（近侧）斜着翘起来、伸向师傅；h = 抬起高度
// 返回 [握点（拳心里的刀柄轴）, 刀柄方向]：右手握在这里
const KH = [-.5, -.866];                                                  // 刀柄在画面上的方向：往左上翘（近侧 + 抬高）
function knife(g, e, x, h, lw) {
  const ck = C('knife'), cp = C('pin'), y0 = 692 - h, BH = 210, u = [.767, -.641], L = 360;
  const Ef = [x, y0], Eb = [x + u[0] * L, y0 + u[1] * L], Sb = [Eb[0], Eb[1] - BH], Sf = [x, y0 - BH];
  const r0 = [Sf[0] + 4, Sf[1] + 14], r1 = [r0[0] + KH[0] * 235, r0[1] + KH[1] * 235];
  g.lineCap = 'round'; g.strokeStyle = cp.l; g.lineWidth = 40; g.beginPath(); g.moveTo(...r0); g.lineTo(...r1); g.stroke();   // 木柄
  g.strokeStyle = cp.f; g.lineWidth = 40 - 2 * lw; g.stroke();
  g.strokeStyle = cp.s; g.lineWidth = 9; g.beginPath(); g.moveTo(r0[0] + 9, r0[1] + 2); g.lineTo(r1[0] + 9, r1[1] + 2); g.stroke();
  g.strokeStyle = cp.h; g.lineWidth = 5; g.beginPath(); g.moveTo(r0[0] - 8, r0[1] - 6); g.lineTo(r1[0] - 6, r1[1] + 4); g.stroke();
  const face = poly([Ef, Eb, Sb, Sf]);
  cel(g, face, { f: ck.f, s: ck.s, sh: [[[Sf[0], Sf[1], 1], [Sb[0], Sb[1], 1], [Sb[0], Sb[1] + 46, 1], [Sf[0], Sf[1] + 32, 1]]], l: ck.l, lw });
  const glint = poly([[Ef[0], Ef[1] - 4], [Eb[0], Eb[1] - 4], [Eb[0], Eb[1] - 16], [Ef[0], Ef[1] - 16]]);   // 刃口硬高光
  g.fillStyle = HI; g.fill(glint);
  g.fillStyle = mix(ck.f, HI, .55); g.fill(poly([[x + 70, Sf[1] + 70], [x + 112, Sf[1] + 36], [x + 220, Sf[1] - 40], [x + 178, Sf[1] - 6]]));
  g.fillStyle = mix(ck.f, '#FFFFFF', .25); g.fill(poly([Sf, Sb, [Sb[0] + 7, Sb[1] - 6], [Sf[0] + 7, Sf[1] - 6]]));   // 刀背顶面
  cel(g, poly([[r0[0] - 16, r0[1] + 8], [r0[0] + 16, r0[1] - 6], [r0[0] + 16 + KH[0] * 26, r0[1] - 6 + KH[1] * 26], [r0[0] - 16 + KH[0] * 26, r0[1] + 8 + KH[1] * 26]]), { f: ck.s, l: ck.l, lw });   // 铁箍
  e.fillStyle = '#8A7458'; e.fill(glint);                                                          // 刃口高光进发光板（推近时一道亮线）
  return [r0[0] + KH[0] * 166, r0[1] + KH[1] * 166];
}

// 生面条一把：从拳里垂下（§4.4：每根 18 px，垂长 380–520，扇形张角按张数变）
function bundle(g, x, y, fan, amp, seed, lw, lt) {
  const cd = C('dough'), R = rng(seed), list = [];
  for (let i = 0; i < 8; i++) list.push({ a: Math.PI / 2 + (i - 3.5) / 3.5 * fan + (R() - .5) * .06, L: 380 + R() * 140, ph: R() * TAU, back: i % 2 });
  for (const q of list.sort((a, b) => b.back - a.back)) {
    const sp = flutter(x + (q.a - Math.PI / 2) * 40, y, q.a, q.L, 14, amp, 1.6, q.ph + lt * 0);
    const rib = ribbon(sp, k => 18 * (1 - .15 * k));
    cel(g, rib, { f: q.back ? mix(cd.f, cd.s, .45) : cd.f, l: cd.l, lw: lw * .8 });
    line(g, sp.slice(1, -1).map(p => [p[0] - 5, p[1]]), C('flour').f, 2);
  }
}

export function draw(g, e, lt, A, t) {
  const { Z, tx, ty } = cam(lt), lw = 2 / Z, tc = Math.floor(lt * 12 + 1e-6) / 12;
  for (const x of [g, e]) x.setTransform(Z, 0, 0, Z, tx, ty);
  g.drawImage(plate(), P0[0], P0[1], PW, PH);
  if (lt < 2.25) {
    const f = Math.floor((lt % .375) * 24 + 1e-6), n = Math.min(5, Math.floor(lt / .375)), cx = KX0 - NW * n;
    const last = n === 5 && f >= 3, kx = f < 3 ? cx : cx - NW, kh = last ? 180 + (f - 3) * 40 : [0, 0, 0, 110, 110, 70, 70, 25, 25][f];
    block(g, cx, RX, lw, false); cuts(g, cx, RX, lw);
    const hb = knife(g, e, kx, kh, lw);
    block(g, LX, cx, lw, true);
    const lh = f < 3 ? 0 : -5;                                                                       // 护手：第二指节贴着刀面，随刀退一根面宽
    hand(g, null, { x: kx + 14, y: 556 + lh, s: 230, rot: 0, side: 'R', pose: CLAW, light: 'warm', arm: .04, lw });   // 左臂在后
    hand(g, null, { x: hb[0], y: hb[1], s: 220, rot: 0, side: 'R', pose: KGRIP, light: 'warm', arm: .04, lw });         // 右手握柄，右臂离镜头近、压在前面
  } else {
    // 刀已放下（右侧台面平放）；面块剩左边一截；双手从中间抓起面条一抖
    const k = Math.min(2, Math.floor((lt - 2.25) / .25)), fan = [.06, .32, .17][k], amp = [10, 7, 4][k], lift = [0, -24, -10][k];
    block(g, LX, KX0 - NW * 6, lw, true);
    const ck = C('knife');
    const cp = C('pin');                                                                              // 放下的切面刀：同一把（长方形薄刃 + 刀背后端的木柄）
    g.lineCap = 'round'; g.strokeStyle = cp.l; g.lineWidth = 34; g.beginPath(); g.moveTo(1520, 884); g.lineTo(1370, 912); g.stroke();
    g.strokeStyle = cp.f; g.lineWidth = 34 - 2 * lw; g.stroke();
    cel(g, poly([[1510, 846], [1860, 800], [1874, 852], [1524, 900]]), { f: ck.f, s: ck.s, so: [0, -10], l: ck.l, lw });
    for (const [bx, sd, seed] of [[800, -1, 11], [1160, 1, 23]]) {
      bundle(g, bx, 330 + lift, fan, amp, seed, lw, lt);
      hand(g, null, { x: bx, y: 330 + lift, s: 220, rot: -sd * .7, side: sd < 0 ? 'L' : 'R', pose: PINCH[k], light: 'warm', arm: .04, lw });   // 指尖捏住面把，前臂从下方往外斜着出画
    }
    const fl = C('flour').f, dt = lt - 2.25;                                                        // 干粉点按 24 帧落下
    for (let i = 0; i < 40; i++) {
      const x0 = (i % 2 ? 1160 : 800) + (hash(i * 2.3) - .5) * 260, y = 420 + hash(i * 5.1) * 300 + dt * (420 + 300 * hash(i));
      g.fillStyle = rgba(fl, .9); g.beginPath(); g.arc(x0 + Math.sin(dt * 6 + i) * 6, y, 1 + 2 * hash(i * 9.7), 0, TAU); g.fill();
    }
  }
  for (const x of [g, e]) x.setTransform(1, 0, 0, 1, 0, 0);
  return {};
}
