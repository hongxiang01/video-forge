// S9 插入（24.0–27.0 s）—— 斜俯特写一只红沿白瓷碗，面已在碗里。
// 24.0–24.75 焦点转移：前景热气层 σ 0 → 8 px、不透明度 → 0.6，碗层 σ 6 → 0（§9 附 2，ease-in-out）；热气层里的吊灯高光换成 4 个硬边圆形光斑。
// 24.75 师傅右手握勺从左边入画浇一勺汤（3 张硬边水柱 + 4 片小水花）；25.5 左手从左上入画撒一撮葱，25.875 停半拍，26.25 再一撮（各 3 张：指缝松开 → 落 → 落定）；
// 26.25–27.0 红碗沿上一道高光滑过。色值：TREATMENT §4.3 碗、§4.4 熟面条 / 汤 / 葱花。非主构图镜头，屏幕坐标直接布局；光从左上来。
// 连贯（CONTINUITY.md）：柜台上师傅在左、老主顾在右 → 两只手都从左 / 左上进；两撮葱落在碗心偏左、偏右，和 S10 碗里的摆法一样。
import { W, H, TAU, cel, path, ribbon, line, airbrush, mix, rgba, rng, hash, canvas } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { steam } from '../fx.js';
import { hand, digit, part, backOfHand, FW, FWK } from '../hands.js';

const BOWL = C('bowl'), RIMC = C('rim'), POT = C('pot');
const NOOD = { f: '#F2D99F', s: '#9C7066', l: '#8C6440', h: mix('#F2D99F', '#FFE6B8', .45) };
const SOUP = { f: '#C8944F', d: '#6C3E2C', h: '#FFE6B8', oil: '#F8C863', u: mix('#C8944F', '#6C3E2C', .38) };
const SCAL = { f: '#86B151', s: '#5A6A43', w: '#EEEABE', l: '#2E4A26' };
const BC = [860, 560], BR = [520, 250], IR = [494, 233], SC = [860, 590], SR = [478, 214];   // 碗口、碗口内沿、汤面
const PIN = [[742, 420], [968, 432]], LAND = [[770, 612], [1000, 628]];   // 两撮葱：捏合处、落点（碗心偏左、偏右）
const SPILL = [790, 600];                                            // 汤柱落点
const E = (c, rx, ry, r = 0) => { const p = new Path2D(); p.ellipse(c[0], c[1], rx, ry, r, 0, TAU); return p; };
const clamp = v => Math.max(0, Math.min(1, v)), ease = v => v * v * (3 - 2 * v);

function table(g) {
  g.fillStyle = BG.warm.wood; g.fillRect(0, 0, W, H);               // 和 S10 柜台同一块木头：光圈外 #7A4A2A、光圈内 #A86E3C
  airbrush(g, 880, 540, 1180, 640, BG.warm.woodHalo, .85, .8);       // 吊灯光圈（背景喷枪）
  airbrush(g, 1750, 1000, 700, 420, BG.warm.woodDark, .6, .9);
  for (let i = 0; i < 15; i++) {                                     // 木纹
    const y = -30 + i * 78 + 14 * Math.sin(i * 1.7);
    line(g, [[-20, y], [600, y + 9 * Math.sin(i * 1.3)], [1300, y - 7], [1940, y + 5 * Math.cos(i)]], rgba(BG.warm.grain, .55), 2.2);
  }
  g.fillStyle = rgba('#3A2430', .78); g.fill(E([BC[0] + 80, BC[1] + 330], 430, 95));   // 碗投在台面上的硬边影（往右下）
}

function bowl(g, e) {
  const [cx, cy] = BC, [rx, ry] = BR;
  cel(g, [[cx - 200, cy + 330], [cx - 192, cy + 362, 1], [cx + 192, cy + 362, 1], [cx + 200, cy + 330]], { f: BOWL.s, l: BOWL.l, lw: 2 });   // 圈足
  const body = [[cx - rx, cy, 1], [cx - rx * .9, cy + 150], [cx - rx * .58, cy + 290], [cx - 215, cy + 338, 1], [cx + 215, cy + 338, 1], [cx + rx * .58, cy + 290], [cx + rx * .9, cy + 150], [cx + rx, cy, 1]];
  for (let j = 1; j < 30; j++) { const a = j / 30 * Math.PI; body.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  cel(g, body, { f: BOWL.f, s: BOWL.s, so: [-70, -10], h: BOWL.h, ho: [16, 2], l: BOWL.l, lw: 2 });
  e.fillStyle = '#000'; e.fill(path(body));
  const I = E(BC, IR[0], IR[1]);                                     // 内壁：左侧背光
  g.save(); g.clip(I); g.fillStyle = BOWL.s; g.fill(I); g.fillStyle = BOWL.f; g.fill(E([cx + 64, cy + 8], IR[0], IR[1])); g.restore();
}

function rimRing(g, e, lt) {
  const [cx, cy] = BC, outer = E(BC, BR[0], BR[1]), inner = E(BC, IR[0], IR[1]), ring = new Path2D();
  ring.addPath(outer); ring.addPath(inner);
  g.save(); g.clip(ring, 'evenodd');
  g.fillStyle = RIMC.s; g.fill(outer); g.fillStyle = RIMC.f; g.fill(E([cx - 8, cy - 7], BR[0], BR[1]));
  const rm = [(BR[0] + IR[0]) / 2, (BR[1] + IR[1]) / 2];
  g.strokeStyle = RIMC.h; g.lineCap = 'butt'; g.lineWidth = 9;      // 左上一段固定高光
  g.beginPath(); g.ellipse(cx, cy, rm[0], rm[1], 0, 3.45, 4.2); g.stroke();
  if (lt >= 2.25) {                                                  // 一道高光从左经前沿滑到右（每帧都动）
    const a = Math.PI - clamp((lt - 2.25) / .75) * Math.PI;
    g.lineWidth = 14; g.strokeStyle = RIMC.h; g.beginPath(); g.ellipse(cx, cy, rm[0], rm[1], 0, a - .05, a + .26); g.stroke();
    g.lineWidth = 6; g.strokeStyle = '#FFE6B8'; g.beginPath(); g.ellipse(cx, cy, rm[0], rm[1], 0, a + .02, a + .17); g.stroke();
    e.strokeStyle = '#FFD8B0'; e.lineWidth = 8; e.beginPath(); e.ellipse(cx, cy, rm[0], rm[1], 0, a, a + .2); e.stroke();
  }
  g.restore();
  g.strokeStyle = RIMC.l; g.lineWidth = 2.4; g.stroke(outer); g.lineWidth = 2; g.stroke(inner);
}

// 熟面条：汤面上露 7 个弧，其余藏在汤下（汤的暗部色画外形，不描边）
const ARCS = Array.from({ length: 7 }, (_, i) => {
  const a = i / 7 * TAU + hash(i + 9) * .5;
  return { c: [SC[0] - 10 + Math.cos(a) * 130 * hash(i + 2), SC[1] - 10 + Math.sin(a) * 60 * hash(i + 3)], r: 150 + 110 * hash(i + 4), a0: a + 2.2, span: 1.3 + .8 * hash(i + 5) };
});
const arcPts = (q, a0, span) => Array.from({ length: 16 }, (_, j) => { const a = a0 + span * j / 15; return [q.c[0] + Math.cos(a) * q.r, q.c[1] + Math.sin(a) * q.r * .5]; });

function soup(g, e, lt) {
  const S = E(SC, SR[0], SR[1]), I = E(BC, IR[0], IR[1]);
  g.save(); g.clip(I); e.save(); e.clip(I);
  g.fillStyle = SOUP.d; g.fill(S); g.fillStyle = SOUP.f; g.fill(E([SC[0] + 14, SC[1] + 34], SR[0], SR[1]));   // 远侧一弯碗壁投下的深色
  g.save(); g.clip(S);
  for (const q of ARCS) { g.fillStyle = SOUP.u; g.fill(path(ribbon(arcPts(q, q.a0 + q.span - .2, TAU - q.span + .4), () => 20), true)); }   // 汤下的面
  const R = rng(919);
  for (let i = 0; i < 26; i++) {                                     // 油星，按一拍两格微微漂
    const a = R() * TAU, r = Math.sqrt(R()) * .92, d = Math.floor(lt * 12) * .6, x = SC[0] + Math.cos(a) * SR[0] * r + Math.sin(d * .3 + i) * 3, y = SC[1] + Math.sin(a) * SR[1] * r;
    const P = E([x, y], 3 + R() * 2.5, 2.4 + R() * 1.5); g.fillStyle = SOUP.oil; g.fill(P); e.fillStyle = rgba(SOUP.oil, .45); e.fill(P);
  }
  for (const [x, y, w] of [[600, 470, 86], [690, 452, 40], [560, 492, 30]]) {   // 吊灯倒影：硬边
    const P = E([x, y], w, w * .3, -.08); g.fillStyle = SOUP.h; g.fill(P); e.fillStyle = '#FFE6B8'; e.fill(P);
  }
  g.restore();
  for (const q of ARCS) {                                            // 露出汤面的弧
    const P = path(ribbon(arcPts(q, q.a0, q.span), u => 22 * (.82 + .18 * Math.sin(u * Math.PI))), true);
    cel(g, P, { f: NOOD.f, s: NOOD.s, so: [-4, -6], h: NOOD.h, ho: [3, 4], l: NOOD.l, lw: 1.8 });
    e.fillStyle = '#000'; e.fill(P);
  }
  g.restore(); e.restore();
}

// —— 握勺的手（师傅右手，手背朝镜头；hands.js 右手本地坐标：指尖朝 −y，拇指在 −x）——
// 勺柄斜穿掌心：从小鱼际（掌根小指侧）进，从食指根和拇指之间的虎口出来，往勺头去（本地 214°）。
// 四指从柄上扣过去、指尖收在柄下：只看见近节往远处缩短和一排指节；食指离柄最近扣得最紧（最短），小指最松（最长），四指角度错开。
// 拇指伸直、平压在柄上面，指尖朝勺头（拇指盖住柄，柄从拇指尖前面露出来）。锚点 = 拇指近节下面那一点柄轴
const LADLE_DIR = 214;
// 粗剪第 3 轮：四指不再用 four() 一个角度排开，每根各自摆（指长 × 节比、粗细同 hands.js）：[指根, 三节方向°, 三节透视缩短]，小 → 食
const FLEN = { l: .50, r: .63, m: .68, i: .62 }, PHL = [.45, .30, .25], FO = ['l', 'r', 'm', 'i'];
const fingers = (set, id) => set.map(([b, angs, k], j) => digit(b, angs, PHL.map((p, q) => FLEN[FO[j]] * p * k[q]).filter(v => v > .005),
  { w: FW * FWK[FO[j]], back: true, cal: FO[j] === 'i' ? -1 : 0, id: id + j })).flat();
function ladlePose() {
  const palm = part('skin', ['W', [-.47, -.06], [-.25, -.13], [-.02, -.16], [.20, -.14], [.40, -.08], [.50, .06], [.52, .40], [.42, .84, 1], [-.30, .86, 1], [-.44, .62], [-.55, .30], [-.57, .08]]);
  backOfHand(palm, [[.34, -.07], [.13, -.13], [-.10, -.14], [-.33, -.09]], [.06, .80], 11);
  // 四指包住斜穿掌心的柄：近节往远处缩短，中节顺着柄的斜向往拇指一侧收（指尖往虎口聚），末节藏在柄底下；越靠虎口扣得越紧、露得越短，四根角度错开
  const fing = fingers([[[.32, -.03], [-72, -92, -97], [.46, .34, 0]], [[.13, -.12], [-83, -99, -101], [.56, .34, 0]],
    [[-.095, -.13], [-93, -106, -107], [.54, .32, 0]], [[-.33, -.08], [-103, -118, -117], [.38, .27, 0]]], 60);   // 小指缩在无名指底下一点
  // 拇指：掌骨沿掌边上去，近节斜搭上柄，末节顺柄压住、往柄一侧回弯一点（关节读得出来，不是一根直棍）
  const thumb = digit([-.45, .52], [-104, -152, -143], [.42, .26, .22], { w: .27, nail: true, back: true, id: 37 });
  return { off: [.75, .04], arm: { w: [.06, .85], a: 101 }, parts: [...thumb, palm, ...fing] };   // 手腕往小指一侧折一点（倒汤时腕是斜的）
}

// —— 勺：24.75 从左边入画，一拍两格 9 张：入 3 → 浇 4 → 回 2 ——
// 关键形 [勺头中心 x, y, 倾角]：倾角顺时针（勺头右沿往下点、柄往上抬），整把勺连手一起转；柄朝左，手在柄尾、前臂从左上出画
const LKEY = [[-90, 370, 0], [250, 402, .03], [500, 432, .12], [636, 444, .30], [648, 445, .36], [648, 445, .36], [646, 444, .32], [280, 410, .04], [-160, 380, 0]];   // 回 2 张就出画，给左手让路
const LG = 390;                                                      // 勺头中心 → 握点
function ladle(g, e, lt) {
  const k = Math.floor((lt - .75) * 12 + 1e-6); if (k < 0 || k > 8) return;
  const [x, y, tl] = LKEY[k], L = new DOMMatrix().translate(x, y).rotate(tl * 57.3);
  const tp = (px, py) => { const p = L.transformPoint({ x: px, y: py }); return [p.x, p.y]; };
  const hdl = ribbon([tp(-104, -8), tp(-260, -12), tp(-LG - 70, -14)], u => 24 - 6 * u);
  cel(g, hdl, { f: POT.f, s: POT.s, so: [-5, -6], h: POT.h, ho: [3, 3], l: POT.l, lw: 2 });
  const gp = tp(-LG, -13);
  hand(g, e, { pose: ladlePose, x: gp[0], y: gp[1], s: 250, rot: tl - LADLE_DIR * Math.PI / 180, side: 'R', light: 'warm', arm: 3.2 });
  const body = [[-118, 0, 1], [-104, 52], [-56, 92], [0, 102], [56, 92], [104, 52], [118, 0, 1], [80, -36], [0, -48], [-80, -36]].map(([a, b, s]) => [...tp(a, b), s || 0]);
  const B = cel(g, body, { f: POT.f, s: POT.s, so: [-14, -8], h: POT.h, ho: [8, 4], l: POT.l, lw: 2.2 });
  const mouth = [[-108, -2], [-60, -34], [0, -42], [60, -34], [108, -2], [60, 24], [0, 30], [-60, 24]].map(([a, b]) => tp(a, b));
  const full = k < 4;
  cel(g, mouth, full ? { f: SOUP.f, s: SOUP.d, so: [10, 8], l: POT.l, lw: 1.8 } : { f: POT.s, l: POT.l, lw: 1.8 });
  e.fillStyle = '#000'; e.fill(hdl instanceof Path2D ? hdl : path(hdl)); e.fill(B);
  if (k >= 3 && k <= 6) {                                            // 汤柱：3 张循环；落点 4 片小水花
    const v = k % 3, lip = tp(112, 4), m = [(lip[0] + SPILL[0]) / 2 + 14 + v * 5, (lip[1] + SPILL[1]) / 2 - 10];   // 从勺头右沿（往下点的那边）出汤
    const spine = [lip, [lip[0] + 20, lip[1] + 40], m, [SPILL[0] + (v - 1) * 4, SPILL[1]]];
    const P = path(ribbon(spine, u => 30 - 12 * u + (v === 1 ? 4 * Math.sin(u * 9) : 0)), true);
    cel(g, P, { f: SOUP.f, s: SOUP.d, so: [8, 0], l: SOUP.d, lw: 2 });
    line(g, spine.map(([a, b]) => [a - 5, b]), SOUP.h, 4); e.fillStyle = rgba('#FFE6B8', .5); e.fill(P);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI + .5 + i / 3 * 2.1 + v * .15, Lp = 34 + 18 * hash(i + v * 4), c = Math.cos(a), s = Math.sin(a), b0 = [SPILL[0] + c * 12, SPILL[1] + s * 6];
      cel(g, [[b0[0] - s * 7, b0[1] + c * 4], [b0[0] + c * Lp, b0[1] + s * Lp * .6, 1], [b0[0] + s * 7, b0[1] - c * 4]], { f: SOUP.f, h: SOUP.h, ho: [2, 2], l: SOUP.d, lw: 1.6 });
    }
  }
}

// —— 葱花 ——
function piece(g, x, y, j, sz) {
  const ty = hash(j * 3.3), r = sz / 2;
  if (ty < .62) { cel(g, E([x, y], r, r * .82), { f: SCAL.f, s: SCAL.s, so: [-1.5, -2], l: SCAL.l, lw: 1.2 }); g.fillStyle = SCAL.w; g.fill(E([x, y], r * .42, r * .34)); }
  else if (ty < .85) { cel(g, E([x, y], r, r * .82), { f: SCAL.w, l: SCAL.l, lw: 1.2 }); g.fillStyle = mix(SCAL.w, SCAL.f, .55); g.fill(E([x, y], r * .38, r * .3)); }
  else cel(g, E([x, y], 9, 4, hash(j) * TAU), { f: SCAL.f, s: SCAL.s, so: [-1, -2], l: SCAL.l, lw: 1.2 });
}
// —— 捻葱的手（师傅左手，拇指一侧朝镜头；按 hands.js 右手本地坐标摆：指尖朝 −y、手背朝 −x、掌心朝 +x）——
// 食指、中指并着、微弯，指肚朝下；拇指从下往上顶在两指指肚上。捻：ph 0 → 1 拇指顺指肚往指尖滑、食中两指略张开，葱从指缝漏下去；
// 无名指、小指松松蜷在掌里（从食指和拇指圈出的空里露一点）；手腕往掌心一侧折 25°（前臂本地 65°）。锚点 = 拇指和食指指肚相碰处
// 画面上 rot 135°：指尖朝右下、掌心朝左下（朝碗）、手背朝右上吃灯光，前臂往左上 200° 出画
const PROT = Math.PI * .75, FA = [Math.cos(200 * Math.PI / 180), Math.sin(200 * Math.PI / 180)];
function pinchPose(ph) {
  const op = 4 * ph;
  const little = digit([-.40, .34], [-12, 58, 112], [.21, .14, .11], { w: FW * FWK.l, back: true, id: 31 });
  const ring = digit([-.43, .22], [-34, 34, 96], [.25, .17, .13], { w: FW * FWK.r, back: true, id: 32 });
  // 中指在食指后面，比食指长、指尖越过食指尖一点露出来，指肚也压在拇指上；弯法和食指不一样（近节更斜、末节弯得少）
  const middle = digit([-.47, .09], [-54 - op, -14 - op * 1.2, 8 - op * 1.4], [.306, .204, .17], { w: FW * FWK.m, back: true, id: 33 });
  const palm = part('skin', ['W', [-.42, .08], [-.58, .05], [-.66, .30], [-.64, .62], [-.53, 1.10, 1], [.13, .80, 1], [.20, .60], [.12, .40], [-.08, .26], [-.30, .14]], {
    cal: [[[-.30, .16], [-.12, .24], [-.13, .31], [-.24, .28], [-.32, .22]]],   // 虎口老茧
    sp: [[[-.52, .55], [-.46, .51, 1], [-.42, .56], [-.47, .61, 1]]] });       // 手背侧一块老人斑
  const index = digit([-.49, .15], [-50 - op, -8 - op * 1.3, 14 - op * 1.6], [.279, .186, .155], { back: true, cal: 1, id: 34 });
  // 拇指不再是一根立着的木栓：根在大鱼际（掌心一侧、腕上方），掌骨往掌心一侧斜出去，近节、末节一节比一节往回弯，指肚扣到食指末节指肚上
  //   → 拇指和食指之间圈出一个水滴形的空（无名指从空里露一点）；捻的时候拇指顺指肚往指尖推、慢慢伸直一点
  const thumb = digit([.12, .58], [-72 + 3 * ph, -102 + 5 * ph, -132 + 8 * ph], [.25, .23, .22 + .02 * ph], { w: .27, nail: true, id: 35 });   // 指尖压在食指末节指肚上（在前面挡住食指尖）
  return { off: [-.02, .05], arm: { w: [-.20, .95], a: 65 }, parts: [...little, ...ring, ...middle, palm, ...index, ...thumb] };   // off：拇指和食指指肚相碰处落在锚点上
}
// 手的时间表（一拍两格）：入画 3 张（顺前臂方向滑进来，最后一张过半格再回）→ 1.5 捻（ph .5 → 1 → 1 → .3 → 0）→ 停半拍、手腕回收 →
// 2.0 起 2 张挪到第二撮的位置 → 2.25 再捻 → 2.583 起 3 张顺前臂退出画面
function pinchAt(lt) {
  if (lt < 1.25 || lt >= 2.833) return null;
  const f = Math.floor((lt - 1.25) * 12 + 1e-6), P0 = PIN[0], P1 = PIN[1];
  const at = (P, d, ph = 0) => ({ x: P[0] + FA[0] * d, y: P[1] + FA[1] * d, ph });
  const PH = [.5, 1, 1, .3];
  if (f < 1) return null;                                            // 勺先退出去，左手再进
  if (f < 3) return at(P0, [0, 560, 150][f]);
  if (f < 7) return at(P0, 0, PH[f - 3]);
  if (f < 9) return at(P0, 16);                                      // 停半拍：手腕往回收一点
  if (f < 11) { const u = f === 9 ? .45 : .88; return { x: P0[0] + (P1[0] - P0[0]) * u, y: P0[1] + (P1[1] - P0[1]) * u - 18 * Math.sin(u * Math.PI), ph: 0 }; }
  if (f < 12) return at(P1, 0);
  if (f < 16) return at(P1, 0, PH[f - 12]);
  return at(P1, [120, 360, 680][Math.min(2, f - 16)]);
}
function scallions(g, lt, p) {
  const t0 = [1.5, 2.25][p], d = Math.floor((lt - t0) * 12 + 1e-6), P = PIN[p];
  for (let j = 0; j < 24; j++) {
    const R = rng(4100 + p * 97 + j), a = R() * TAU, u = Math.sqrt(R()), sz = 13 + R() * 5, id = j + p * 24;
    let x, y;
    if (d === 0) { x = P[0] + 10 + Math.cos(a) * 30 * u; y = P[1] + 36 + Math.sin(a) * 22 * u; }                  // 指缝松开
    else if (d === 1) { x = (P[0] + LAND[p][0]) / 2 + Math.cos(a) * 80 * u; y = (P[1] + LAND[p][1]) / 2 + 30 + Math.sin(a) * 64 * u; }   // 落
    else { x = LAND[p][0] + Math.cos(a) * 120 * u; y = LAND[p][1] + Math.sin(a) * 120 * u * .5; }                  // 落定（汤面上压扁成椭圆分布）
    piece(g, x, y, id, sz);
  }
}
// —— 切到 S10 前：师傅右手从左边伸过来要推碗（切在动作上，S10 头一张手已经搭在碗上、接着压腕推）——
// 手背朝镜头，四指并拢微弯往前伸（等着从碗壁外侧托住，越往小指越弯）、拇指张开朝上（等着搭到碗沿上）；rot 90°：指尖朝右、拇指朝上、前臂往左出画
function reachPose() {
  const palm = part('skin', ['W', [-.47, -.42], [-.28, -.50], [-.08, -.54], [.13, -.52], [.34, -.46], [.49, -.34], [.53, -.04], [.47, .30], [.37, .54, 1], [-.31, .56, 1], [-.44, .36], [-.57, .10], [-.61, -.08], [-.56, -.27]]);
  backOfHand(palm, [[.36, -.40], [.13, -.48], [-.10, -.50], [-.33, -.44]], [.02, .50], 13);
  const thumb = digit([-.50, .12], [-150, -133], [.30, .24], { w: .28, nail: true, back: true, id: 41 });   // 拇指张开朝上，末节往四指一侧微弯（等着勾到碗沿上）
  // 四指放松往前伸：每个关节都带一点弯（越往小指越蜷 = 透视越短），各自往中指一侧偏几度；张开的角度、间距都不一样，不是一排平行的耙齿
  const fing = fingers([[[.36, -.36], [-62, -70, -80], [.80, .52, .36]], [[.13, -.465], [-82, -86, -91], [.92, .70, .50]],
    [[-.10, -.50], [-92, -91, -88], [1, .80, .60]], [[-.345, -.43], [-110, -103, -96], [.98, .86, .68]]], 80);   // 中指、无名指挨着，食指、小指各自撇开
  return { arm: { w: [.03, .53], a: 100 }, parts: [...thumb, palm, ...fing] };   // 手腕往上折一点：前臂从左上斜着进来
}
function reachHand(g, e, lt) {
  const f = Math.floor((lt - 2.75) * 12 + 1e-6); if (f < 0) return;
  hand(g, e, { pose: reachPose, x: [-230, -40, 92][Math.min(2, f)], y: 650, s: 270, rot: Math.PI / 2, side: 'R', light: 'warm', arm: 2.6 });
}
function scallionHand(g, e, lt) {
  for (let p = 0; p < 2; p++) if (lt >= [1.5, 2.25][p]) scallions(g, lt, p);   // 已经落下 / 正在落的
  const s = pinchAt(lt); if (!s) return;
  hand(g, e, { pose: () => pinchPose(s.ph), x: s.x, y: s.y, s: 300, rot: PROT, side: 'R', light: 'warm', arm: 3.4 });
  if (lt < 2.25 && s.ph < .4) for (let j = 0; j < 7; j++) {         // 还捏着的葱：指肚之间露出几粒
    const R = rng(4900 + j), a = R() * TAU, u = Math.sqrt(R());
    piece(g, s.x + 8 + Math.cos(a) * 16 * u, s.y + 12 + Math.sin(a) * 9 * u, 60 + j, 12 + R() * 4);
  }
}

let LY = null;
const clr = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, H); return x; };
export function draw(g, e, lt, A, t) {
  if (!LY) LY = [canvas(W, H), canvas(W, H), canvas(W, H), canvas(W, H)];
  const [[bc, b], [bec, be], [sc, s], [sec, se]] = LY;
  [b, be, s, se].forEach(clr);
  table(b); bowl(b, be); soup(b, be, lt); rimRing(b, be, lt); ladle(b, be, lt); scallionHand(b, be, lt); reachHand(b, be, lt);   // 碗层
  steam(s, se, t, { preset: 'S9', x: SC[0] - 30, y: SC[1] + 30, spread: 210, lampSide: -1, seed: 909 });   // 前景热气层
  const k = ease(clamp(lt / .75)), sb = 6 * (1 - k), ss = 8 * k, so = 1 - .4 * k;
  for (const [x, lc, sc2] of [[g, bc, sc], [e, bec, sec]]) {
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.filter = sb > .05 ? `blur(${sb}px)` : 'none'; x.drawImage(lc, 0, 0);
    x.filter = ss > .05 ? `blur(${ss}px)` : 'none'; x.globalAlpha = so; x.drawImage(sc2, 0, 0);
    x.restore();
  }
  if (ss > 3) for (const [x, y, d] of [[430, 200, 64], [560, 120, 44], [330, 360, 52], [1500, 150, 40]]) {   // 吊灯高光 → 硬边圆形光斑
    const P = E([x, y], d / 2, d / 2); g.fillStyle = rgba('#FFE6B8', .3); g.fill(P); e.fillStyle = rgba('#FFE6B8', .3); e.fill(P);
  }
  return {};
}
