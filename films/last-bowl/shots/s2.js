// S2（3.0–6.0 s）特写 · 正俯：面粉从画外落进灯圈，像雪；手影先到，大手入画，5.25 三指压出面窝，5.5 起手指从面窝里抬起（TREATMENT §4 / §5，CONTINUITY S1→S2、S2→S3）
// 粗剪第 2 轮：灯圈带着 S1 吊灯摆的余晃（头 1.5 s 左右晃两下、衰减到停）；手型自己摆（backHand：手背朝镜头，四指各自的角度和可见长度），不再借 press 拳头。
// 灯在师傅这一侧（画面下偏左的上方）→ 影子往右上投；手从画面右下角入画（师傅站在近侧），手影先进画。缓推 100% → 104%（锚点 = 面窝中心）。
// 图层：台面（底板 → 晃动的灯圈 → 木纹粉点）→ 面堆投影 → 面堆 → 落定的粉点 → 面窝 → 手影 → 远处的落粉 → 手 + 指尖压进去的粉边 + 粉雾 → 近处的落粉
import { cel, path, rgba, mix, rng, hash, airbrush, canvas, TAU, W, H } from '../lib/cel.js';
import { C } from '../pal.js';
import { digit, part, backOfHand, FW, FWK } from '../hands.js';

const f24 = t => Math.floor(t * 24 + 1e-6) / 24;
const f12 = t => Math.floor(t * 12 + 1e-6) / 12;
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const M = [960, 470];                 // 面堆 / 面窝中心（屏幕），也是推镜锚点
const LD = [-.35, .94];               // 屏幕上朝灯的方向
const DOUGH = C('dough'), FLOUR = C('flour');
const WOOD = { base: '#7A4A2A', halo: '#A86E3C', hot: '#C08048', dark: '#4A3550', grain: '#3A2418' };
const SHADOW = '#4A3550';

// —— 台面：底板（横铺木板）和面上的木纹 / 木节 / 粉点分两张缓存，中间每帧画灯圈（跟着吊灯余晃移）——
let PL = null;
function plate() {
  if (PL) return PL;
  const [c0, g0] = canvas(W, H), [c, g] = canvas(W, H), R = rng(2024);
  g0.fillStyle = WOOD.base; g0.fillRect(0, 0, W, H);
  const seams = [-60, 190, 455, 735, 1000, 1240];
  for (let i = 0; i < seams.length - 1; i++) { g0.fillStyle = rgba(i % 2 ? '#5E3620' : '#8A5530', .3 + hash(i + 3) * .25); g0.fillRect(0, seams[i], W, seams[i + 1] - seams[i]); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < seams.length - 1; i++) {
    const y0 = seams[i], y1 = seams[i + 1];
    for (let k = 0; k < 8; k++) {
      const yb = y0 + (k + .5) / 8 * (y1 - y0), A = 3 + R() * 9, f = .002 + R() * .004, ph = R() * TAU;
      g.strokeStyle = rgba(WOOD.grain, .16 + R() * .2); g.lineWidth = 1.2 + R() * 1.8; g.beginPath();
      for (let x = -24; x <= W + 24; x += 24) { const y = yb + A * Math.sin(x * f + ph) + 5 * Math.sin(x * .011 + ph * 2); x < 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = rgba('#24120C', .7); g.lineWidth = 4; g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0 + 8); g.stroke();
    g.strokeStyle = rgba('#D09050', .22); g.lineWidth = 2; g.beginPath(); g.moveTo(0, y0 + 4); g.lineTo(W, y0 + 12); g.stroke();
  }
  for (const [x, y, r] of [[250, 300, 30], [1650, 860, 26], [1500, 110, 20]]) {
    for (let k = 3; k >= 0; k--) { g.strokeStyle = rgba(WOOD.grain, .3); g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, r * (1 + k * .7), r * (.42 + k * .3), 0, 0, TAU); g.stroke(); }
    g.fillStyle = rgba(WOOD.grain, .55); g.beginPath(); g.ellipse(x, y, r, r * .42, 0, 0, TAU); g.fill();
  }
  airbrush(g, M[0], M[1] + 10, 640, 580, FLOUR.f, .2, .85);   // 面堆四周的薄粉 + 硬边粉点，离面堆越远越稀越小
  for (let i = 0; i < 1100; i++) {
    const a = R() * TAU, d = 400 + Math.pow(R(), 1.7) * 760, x = M[0] + Math.cos(a) * d * 1.1, y = M[1] + Math.sin(a) * d * .95;
    const r = (1.1 + R() * 2.6) * (1 - Math.min(1, (d - 400) / 760) * .55);
    g.fillStyle = rgba(FLOUR.f, .5 + R() * .5); g.beginPath(); g.ellipse(x, y, r * (1 + R() * .8), r, R() * TAU, 0, TAU); g.fill();
  }
  PL = { base: c0, top: c }; return PL;
}
// 吊灯余晃：S1 的摆在 3.0 刚回到中间，这里接着再晃两个半摆（±46 → ±22 px），1.5 s 停
const sway = lt => lt >= 1.5 ? 0 : (lt < .75 ? -46 : -22) * Math.sin(Math.PI * lt / .75);
function pool(g, dx) {   // 灯圈：圈心在画面下偏左，圈边在上面两角看得见；圈外压暗
  const cx = 860 + dx, cy = 700;
  const h = g.createRadialGradient(cx, cy, 40, cx, cy, 900);
  h.addColorStop(0, rgba(WOOD.hot, .9)); h.addColorStop(.5, rgba(WOOD.halo, .85)); h.addColorStop(.86, rgba(WOOD.halo, .6)); h.addColorStop(.93, rgba(WOOD.halo, .12)); h.addColorStop(1, rgba(WOOD.halo, 0));
  g.fillStyle = h; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(cx, cy, 830, cx, cy, 1350);
  v.addColorStop(0, rgba(WOOD.dark, 0)); v.addColorStop(.12, rgba(WOOD.dark, .4)); v.addColorStop(1, rgba(WOOD.dark, .9));
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

// 不规则的圆团（面堆、面窝、粉雾）
function blob(cx, cy, rx, ry, n, seed, amp) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + amp * (hash(seed + i * 1.73) * 2 - 1); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return pts;
}
const lens = (x, y, a, b, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return [[x - c * a, y - s * a], [x - s * b, y + c * b], [x + c * a, y + s * a], [x + s * b, y - c * b]]; };

// —— 面堆：gr = 长大的比例（落粉堆上去）——
function mound(g, gr) {
  const rx = 450 * gr, ry = 410 * gr, P = blob(M[0], M[1], rx, ry, 24, 7, .045);
  g.fillStyle = rgba(SHADOW, .5); g.fill(path(P.map(([x, y]) => [x + 20 * gr, y - 46 * gr])));   // 投影往右上
  const sh = [], hi = [];
  for (let k = 0; k < 10; k++) {   // 粉堆的鼓包：背光半边是硬边小影，朝灯半边是硬边亮块
    const a = hash(k + 40) * TAU, d = .25 + hash(k + 60) * .6, x = M[0] + Math.cos(a) * rx * d, y = M[1] + Math.sin(a) * ry * d;
    const lit = Math.cos(a) * LD[0] + Math.sin(a) * LD[1] > 0;
    (lit ? hi : sh).push(lens(x, y, (26 + hash(k + 80) * 34) * gr, 7 * gr, a + Math.PI / 2 + (hash(k + 90) - .5)));
  }
  hi.push(blob(M[0] - 80 * gr, M[1] + 335 * gr, 240 * gr, 46 * gr, 14, 31, .1));   // 朝灯的那面坡
  cel(g, P, { f: DOUGH.f, s: DOUGH.s, so: [LD[0] * 78 * gr, LD[1] * 78 * gr], sh, h: FLOUR.f, hi, l: DOUGH.l, lw: 1.6 });
}

// —— 面窝：压下去的那一刻出现，直径约 520 px ——
function well(g) {
  const c = [M[0] + 4, M[1] + 12], away = [-LD[0], -LD[1]];
  const ring = blob(c[0], c[1], 318, 292, 20, 53, .05);   // 窝边隆起的一圈
  cel(g, ring, { f: FLOUR.f, s: DOUGH.s, so: [LD[0] * 22, LD[1] * 22], l: DOUGH.l, lw: 1.6 });
  const P = blob(c[0], c[1], 262, 238, 20, 51, .045);
  const floor = blob(c[0] + away[0] * 26, c[1] + away[1] * 26, 170, 150, 14, 57, .08);
  cel(g, P, { f: mix(DOUGH.f, DOUGH.s, .2), s: DOUGH.s, so: [away[0] * 54, away[1] * 54], h: FLOUR.f, hi: [floor], l: DOUGH.l, lw: 1.6 });
  const R = rng(77); g.fillStyle = FLOUR.f;   // 窝底撒的干粉
  for (let i = 0; i < 70; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 200; g.beginPath(); g.arc(c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * .9, 1.4 + R() * 2.4, 0, TAU); g.fill(); }
}

// —— 手型：右手手背朝镜头（本地：掌宽 = 1，y 向下，前臂从 +y 来，指尖朝 −y）——
// 粗剪第 3 轮（第 2 版的手像机器：四指平行等距像耙子、每节直、拇指像插在掌边的木栓、手腕前臂一根直管）：
// 四指（小 → 食，同 hands.js FING 的画序）各给 [根节角°, 中节再弯°, 末节再弯°（都相对根节）, 三节各自的可见比例]：
//   每个关节都弯一点（5–20°），弯向中指一侧（屈指时指尖往一处聚）；四根张开的角度、间隔、透视缩短都各不相同；
//   指根骨节排成一道弧、间距不等（食—中宽、无名—小窄，小指根最低）
// 拇指根落在掌的桡侧边上（掌外形在这里鼓出第一掌骨，虎口一道软弧接到食指根），斜着往前伸，和食指之间留开一个 V，不贴着四指
// wa = 前臂方向（本地°）：比 90 小 = 腕往小指一侧折一点（尺偏），前臂斜着从右下角进来，手和前臂不是一根直管
const DG = Math.PI / 180, FN = ['l', 'r', 'm', 'i'], FL = { l: .50, r: .63, m: .68, i: .62 }, PH = [.45, .30, .25];
const MCP = [[.34, -.37], [.14, -.47], [-.09, -.51], [-.33, -.45]];
const PALM = [[-.46, -.43], [-.28, -.51], [-.08, -.55], [.13, -.52], [.33, -.45], [.48, -.33], [.53, -.04], [.48, .28], [.37, .54, 1], [-.31, .56, 1], [-.46, .34], [-.60, .14], [-.66, -.02], [-.62, -.16], [-.55, -.30]];
const WEB = [[-.66, -.20], [-.65, -.02], [-.58, -.04], [-.58, -.14], [-.56, -.22]];
function backHand(q) {   // q = { fy 掌的纵向透视（腕抬起来多少）, wa 前臂方向°, f: 四指, th: [x, y, 角1, 角2, 长1, 长2] 拇指, seed }
  const Y = p => p.length > 2 ? [p[0], p[1] * q.fy, p[2]] : [p[0], p[1] * q.fy];
  const palm = part('skin', ['W', ...PALM.map(Y)], { cal: [WEB.map(Y)] }), mcp = MCP.map(Y);
  backOfHand(palm, mcp, [.02, .50 * q.fy], q.seed);
  const fing = [], tips = [];
  FN.forEach((f, i) => {
    const [a, b1, b2, ...k] = q.f[i], angs = [a, a + b1, a + b2], ls = PH.map((p, j) => FL[f] * p * k[j]), n = ls.filter(l => l > .012).length;
    fing.push(...digit(mcp[i], angs.slice(0, n), ls.slice(0, n), { w: FW * FWK[f], back: true, nail: q.nail, id: i + q.seed * 4, cal: f === 'i' ? -1 : 0 }));
    let p = mcp[i]; for (let j = 0; j < n; j++) p = [p[0] + Math.cos(angs[j] * DG) * ls[j], p[1] + Math.sin(angs[j] * DG) * ls[j]]; tips.push(p);
  });
  const [tx, ty, t1, t2, l1, l2] = q.th, thumb = digit([tx, ty * q.fy], [t1, t2], [l1, l2], { w: .28, nail: true, back: true, id: 9 + q.seed });
  return { arm: { w: [.03, .53 * q.fy], a: q.wa }, parts: [...thumb, palm, ...fing], tips };
}
const mixQ = (a, b, w) => Array.isArray(a) ? a.map((v, i) => mixQ(v, b[i], w)) : typeof a === 'number' ? a + (b - a) * w : a;
// app 落下来：四指放松、各自微弯、张开不等（食指往外、小指张得最开最弯），拇指斜伸在外；
// press 食 / 中 / 无名三指收拢往下扎：食指、无名指往中指那边靠（指尖聚到一处），中节、末节几乎竖直只露一点；小指松着蜷在旁边、尖往里勾；
//   拇指斜着搭在一侧、不贴食指；lift 三指从窝里拔出来：指节回直一些、略散开，指尖沾着粉
const Q = {
  app:   { fy: .80, wa: 77, seed: 5, f: [[-66, -9, -20, .84, .60, .42], [-82, -4, -10, .90, .68, .50], [-91, 3, 7, .95, .74, .56], [-103, 6, 13, .92, .72, .55]], th: [-.57, .04, -130, -116, .31, .25] },
  press: { fy: .86, wa: 76, seed: 5, f: [[-74, -14, -30, .66, .34, .14], [-97, -5, -11, .78, .40, .18], [-91, 2, 4, .86, .42, .20], [-84, 6, 12, .80, .44, .22]], th: [-.57, .04, -124, -108, .30, .24] },
  lift:  { fy: .84, wa: 77, seed: 5, f: [[-63, -12, -27, .76, .46, .24], [-83, -5, -11, .86, .56, .36], [-91, 3, 7, .90, .60, .40], [-100, 7, 15, .86, .58, .38]], th: [-.57, .04, -127, -112, .31, .25] },
};
// 一只手的一张：手型 + 让食 / 中 / 无名三个指尖的中心落在锚点上
function handDef(q) {
  const d = backHand(q), c = [0, 1, 2].map(j => d.tips[j + 1]).reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3], [0, 0]);
  d.off = [-c[0], -c[1]]; return d;
}
const tipsOn = (q, x, y, s, rot) => { const d = handDef(q), cr = Math.cos(rot), sr = Math.sin(rot);   // 三个指尖的屏幕坐标
  return d.tips.slice(1).map(([a, b]) => { const u = (a + d.off[0]) * s, v = (b + d.off[1]) * s; return [x + u * cr - v * sr, y + u * sr + v * cr]; }); };

// —— 手：12 fps 一张，[lt, x, y, 掌宽, rot, 手型 a, 手型 b, 权重]；锚点 = 三个指尖的中心。从右下角入画，先略抬（预备），5.25 压下、多停 2 张，5.5 起往上拔 ——
const KEYS = [
  [1.500, 1340, 1470, 420, -.36, 'app', 'app', 0], [1.583, 1300, 1340, 418, -.36, 'app', 'app', 0], [1.667, 1250, 1190, 415, -.35, 'app', 'app', 0],
  [1.750, 1195, 1030, 410, -.34, 'app', 'app', 0], [1.833, 1125, 860, 405, -.33, 'app', 'app', 0], [1.917, 1055, 700, 400, -.32, 'app', 'app', 0],
  [2.000, 1004, 572, 398, -.31, 'app', 'press', .2], [2.083, 980, 500, 404, -.30, 'app', 'press', .45], [2.167, 970, 464, 410, -.30, 'app', 'press', .65],
  [2.250, 962, 482, 360, -.30, 'press', 'press', 0], [2.333, 961, 486, 356, -.305, 'press', 'press', 0], [2.417, 961, 485, 358, -.31, 'press', 'press', 0],
  [2.500, 962, 490, 364, -.315, 'press', 'lift', .35], [2.583, 964, 500, 372, -.32, 'press', 'lift', .7], [2.667, 966, 510, 380, -.325, 'lift', 'lift', 0],
  [2.750, 968, 518, 386, -.33, 'lift', 'lift', 0], [2.833, 969, 524, 390, -.33, 'lift', 'lift', 0], [2.917, 970, 528, 392, -.335, 'lift', 'lift', 0],
];
function keyAt(lt) { const q = f12(lt) + 1e-6; let k = null; for (const K of KEYS) if (K[0] <= q) k = K; return k; }
const PRESS = 2.25, LIFT = 2.5, PK = KEYS[9];

let SC = null;
function handShadow(g, hd, o, alpha) {   // 手画进离屏 → 整块换成影子色 → 贴回台面（硬边）
  SC = SC || canvas(W, H); const [c, x] = SC;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
  x.setTransform(g.getTransform()); hd(x, null, o);
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = SHADOW; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha; g.drawImage(c, 0, 0); g.restore();
}

// 指尖扎进面里：每个指尖上盖一小团被顶起来的粉（硬边，比指头略宽）→ 指尖没进粉里
// （第一版是横跨三指的一整道粉边，看着像一根白棍压在指头上）
function sink(g, tips, s) {
  tips.forEach(([x, y], i) => {
    const r = s * (.07 - i * .004);
    cel(g, blob(x, y - r * .25, r * 1.2, r * .78, 10, 760 + i * 7, .12), { f: FLOUR.f, s: mix(FLOUR.f, DOUGH.s, .45), so: [LD[0] * r * .35, LD[1] * r * .35], l: DOUGH.l, lw: 1.4 });
  });
}
// 手指拔出来以后：窝边留下三个指坑；指尖上沾的粉（硬边小团）
function holes(g) {
  for (const [i, [x, y]] of tipsOn(Q.press, PK[1], PK[2], PK[3], PK[4]).entries()) {
    const r = PK[3] * (.075 - i * .004);
    cel(g, blob(x, y, r, r * .8, 9, 700 + i * 7, .1), { f: mix(DOUGH.f, DOUGH.s, .55), s: DOUGH.s, so: [-LD[0] * r * .5, -LD[1] * r * .5], l: DOUGH.l, lw: 1.4 });
  }
}
function dust(g, tips, s) {
  tips.forEach(([x, y], i) => { const r = s * (.05 - i * .004); cel(g, blob(x, y, r, r * .8, 8, 740 + i * 5, .2), { f: FLOUR.f, s: mix(FLOUR.f, DOUGH.s, .45), so: [LD[0] * r * .3, LD[1] * r * .3] }); });
}
// 压下那 3 张：粉雾一圈往外散（硬边团，第三张变淡）
function puff(g, k) {
  const R = rng(500), rad = [70, 120, 160][k], sz = [34, 46, 52][k], al = [1, .85, .5][k];
  g.save(); g.globalAlpha = al;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * .95 + i * .26 + R() * .15, d = rad * (.8 + R() * .5), r = sz * (.7 + R() * .6);
    cel(g, blob(M[0] + Math.cos(a) * d * 1.3, M[1] + 14 + Math.sin(a) * d, r, r * .85, 9, 600 + i * 13, .12), { f: FLOUR.f, s: mix(FLOUR.f, DOUGH.s, .45), so: [LD[0] * r * .35, LD[1] * r * .35] });
  }
  g.restore();
}

// —— 落粉：从画面左上外面斜着飘进灯圈，越落越小（离镜头越远），落定后留一个粉点 ——
const FALL = (() => {
  const R = rng(303), A = [];
  for (let i = 0; i < 380; i++) {
    const ts = -2.6 + R() * 4.3, D = 1.5 + R() * 1.1, a = R() * TAU, rho = 640 * Math.sqrt(R());
    const L = [M[0] + Math.cos(a) * rho * 1.15, M[1] + Math.sin(a) * rho * .95];
    const S = [L[0] + (L[0] - M[0]) * .35 - 170 - R() * 170, L[1] + (L[1] - M[1]) * .35 - 300 - R() * 220];
    A.push({ ts, D, L, S, r0: 4.5 + R() * 6, r1: 1.4 + R() * 1.3, sw: 10 + R() * 22, fq: .5 + R() * .7, ph: R() * TAU });
  }
  return A;
})();
function flour(g, lt, pass) {   // pass: 'land' 落定的点；'far' 落到一半以后；'near' 刚进画（离镜头近、大）
  for (const p of FALL) {
    const u = (lt - p.ts) / p.D;
    if (u < 0) continue;
    if (u >= 1) { if (pass === 'land') { g.fillStyle = FLOUR.f; g.beginPath(); g.arc(p.L[0], p.L[1], p.r1, 0, TAU); g.fill(); } continue; }
    if ((pass === 'far') !== (u > .45) || pass === 'land') continue;
    const sw = Math.sin(TAU * p.fq * lt + p.ph) * p.sw * (1 - u);
    const x = p.S[0] + (p.L[0] - p.S[0]) * u + sw * .8, y = p.S[1] + (p.L[1] - p.S[1]) * u - sw * .45, r = p.r0 + (p.r1 - p.r0) * u;
    if (r > 3.2) {   // 大粒：一小条硬边背光影
      g.fillStyle = mix(FLOUR.f, FLOUR.s, .4); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = FLOUR.f; g.beginPath(); g.arc(x + LD[0] * r * .28, y + LD[1] * r * .28, r * .86, 0, TAU); g.fill();
    } else { g.fillStyle = rgba(FLOUR.f, .9); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  }
}

export function draw(g, e, lt, A, t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const lq = f24(lt), z = 1 + .04 * ease(lq / 3), T = [z, 0, 0, z, M[0] * (1 - z), M[1] * (1 - z)];
  g.setTransform(...T); e.setTransform(...T);
  const pl = plate();
  g.drawImage(pl.base, 0, 0); pool(g, sway(lq)); g.drawImage(pl.top, 0, 0);
  mound(g, .9 + .1 * ease(f12(lt) / 1.5));
  flour(g, lq, 'land');
  const k = keyAt(lt), pressed = lt >= PRESS, lifted = lt >= LIFT;
  if (pressed) well(g);
  if (lifted) holes(g);   // 指头拔出来以后只剩三个指坑（第一版压指尖的那道粉边留在窝边，像一根白棍横在窝里）
  const hd = A?.mods?.hands?.hand;
  if (k && hd) {
    const [, x, y, s, rot, a, b, w] = k, q = mixQ(Q[a], Q[b], w), pose = () => handDef(q);
    const hgt = Math.max(0, Math.min(1, (s - 360) / 60));
    handShadow(g, hd, { x: x + 14 + 60 * hgt, y: y - 30 - 380 * hgt, s: s * (1 + .28 * hgt), rot, pose, side: 'R', light: 'warm', ld: LD, arm: 2.4 }, .55 - .13 * hgt);
    flour(g, lq, 'far');
    if (y < 1300) {
      hd(g, e, { x, y, s, rot, pose, side: 'R', light: 'warm', ld: LD, arm: 2.4, lw: 1.6 });
      if (pressed && !lifted) sink(g, tipsOn(q, x, y, s, rot), s);
      if (lifted) dust(g, tipsOn(q, x, y, s, rot), s);
    }
  } else flour(g, lq, 'far');
  if (pressed && lt < PRESS + .25) puff(g, Math.min(2, Math.floor((f12(lt) - PRESS + 1e-6) * 12)));
  flour(g, lq, 'near');
  g.setTransform(1, 0, 0, 1, 0, 0); e.setTransform(1, 0, 0, 1, 0, 0);
  return {};
}
