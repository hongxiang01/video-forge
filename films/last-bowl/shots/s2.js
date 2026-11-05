// S2（3.0–6.0 s）特写 · 正俯偏斜 · 三渲二（TREATMENT §4 / §4.4 / §5，CONTINUITY S1→S2、S2→S3）。2D 版原样备份在 s2_2d.js。
// 透视相机从师傅这一侧斜俯 56°、往右偏 12°，缓推 100% → 104%（ease-in-out，锚在面窝）。案板 = 贴二维木纹 + 灯圈的平面（灯圈带 S1 吊灯的余晃，
// 每帧重画进 CanvasTexture）+ 只收投影的平面；面粉堆 = 极坐标网格的三维鼓堆（几个鼓包 → 明暗交界线跟着弯），三指压下去时网格里挖出面窝、窝边隆起、三个指坑。
// 一盏白色方向光（吊灯在左上、偏师傅这一侧 → 投影往右上，手影先到），硬边投影，不加环境光。落粉 = 三维小粉粒（卡通材质、不描边），落定后留在台面 / 面堆上。
// 世界坐标（米）：X 向右，Y 向上，Z 朝镜头（师傅这一侧）；面堆中心在原点，台面 y = 0。手按 12 fps 换张，镜头、灯、落粉每帧动。
import * as THREE from 'three';
import { line, mix, rgba, rng, hash, canvas, airbrush, TAU, W, H } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { toon, sun, draw3d, renderer } from '../lib3d.js';
import { makeHand } from '../hand3d.js';

const f24 = t => Math.floor(t * 24 + 1e-6) / 24;
const f12 = t => Math.floor(t * 12 + 1e-6) / 12;
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const D2R = Math.PI / 180, B = BG.warm, DOUGH = C('dough'), FLOUR = C('flour');
const MR = 0.125, MH = 0.08;                                         // 面粉堆半径、高（米）
const LIGHT = [-0.75, 0.85, 0.35];                                    // 光从哪来：左、上（仰角约 46°）、偏师傅这一侧

// —— 台面贴图（2D 版的画法搬到世界坐标）：X ∈ [−.5, .5]，Z ∈ [−.45, .35]；木板横铺，宽 13.5 cm（同 S4）——
const KP = 3000, X0 = -0.5, Z0 = -0.45, PW = 1.0, PD = 0.8;
const toP = (x, z) => [(x - X0) * KP, (z - Z0) * KP];
const edgeR = a => MR * (1 + .05 * Math.sin(3 * a + 1) + .03 * Math.sin(5 * a + 2) + .015 * Math.sin(11 * a + 4));
let PL = null;
function plates() {
  if (PL) return PL;
  const w = Math.round(PW * KP), h = Math.round(PD * KP), R = rng(2024);
  const [c0, g0] = canvas(w, h), [c1, g1] = canvas(w, h), [cv, gv] = canvas(w, h), pw = 0.135 * KP;
  g0.fillStyle = B.wood; g0.fillRect(0, 0, w, h);
  const seams = []; for (let z = -0.435; z < 0.36; z += 0.135) seams.push(toP(0, z)[1]);
  seams.forEach((y0, i) => { g0.fillStyle = rgba(i % 2 ? '#5E3620' : '#8A5530', .3 + hash(i + 3) * .25); g0.fillRect(0, y0, w, pw); });
  g1.lineCap = 'round'; g1.lineJoin = 'round';
  for (const y0 of seams) {
    for (let k = 0; k < 9; k++) {
      const yb = y0 + (k + .5) / 9 * pw, A = 6 + R() * 16, f = .001 + R() * .002, ph = R() * TAU;
      g1.strokeStyle = rgba(B.grain, .16 + R() * .2); g1.lineWidth = 1.6 + R() * 2.2; g1.beginPath();
      for (let x = -40; x <= w + 40; x += 40) { const y = yb + A * Math.sin(x * f + ph) + 8 * Math.sin(x * .0055 + ph * 2); x < 0 ? g1.moveTo(x, y) : g1.lineTo(x, y); }
      g1.stroke();
    }
    g1.strokeStyle = rgba('#24120C', .7); g1.lineWidth = 6; g1.beginPath(); g1.moveTo(0, y0); g1.lineTo(w, y0 + 10); g1.stroke();
    g1.strokeStyle = rgba('#D09050', .22); g1.lineWidth = 3; g1.beginPath(); g1.moveTo(0, y0 + 6); g1.lineTo(w, y0 + 16); g1.stroke();
  }
  for (const [X, Z, r] of [[-0.33, -0.21, 40], [0.36, 0.12, 34], [0.27, -0.34, 28]]) {
    const [x, y] = toP(X, Z);
    for (let k = 3; k >= 0; k--) { g1.strokeStyle = rgba(B.grain, .3); g1.lineWidth = 3; g1.beginPath(); g1.ellipse(x, y, r * (1 + k * .7), r * (.42 + k * .3), 0, 0, TAU); g1.stroke(); }
    g1.fillStyle = rgba(B.grain, .55); g1.beginPath(); g1.ellipse(x, y, r, r * .42, 0, 0, TAU); g1.fill();
  }
  const [mx, my] = toP(0, 0);
  airbrush(g1, mx, my, 0.2 * KP, 0.18 * KP, FLOUR.f, .2, .85);         // 面堆四周的薄粉 + 硬边粉点，离面堆越远越稀越小
  for (let i = 0; i < 1400; i++) {
    const a = R() * TAU, d = 0.115 + Math.pow(R(), 1.7) * 0.25, [x, y] = toP(Math.cos(a) * d * 1.1, Math.sin(a) * d * .95);
    const r = (1.6 + R() * 3.6) * (1 - Math.min(1, (d - 0.115) / 0.25) * .55);
    g1.fillStyle = rgba(FLOUR.f, .5 + R() * .5); g1.beginPath(); g1.ellipse(x, y, r * (1 + R() * .8), r, R() * TAU, 0, TAU); g1.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = renderer().r.capabilities.getMaxAnisotropy();
  return (PL = { base: c0, top: c1, gv, w, h, tex });
}
// 吊灯余晃：S1 的摆在 3.0 刚回到中间，这里接着再晃两个半摆（±1.4 → ±0.7 cm），1.5 s 停
const sway = lt => lt >= 1.5 ? 0 : (lt < .75 ? -0.014 : -0.007) * Math.sin(Math.PI * lt / .75);
function boardFrame(dx, gr) {   // 每帧：木板底 → 灯圈（圈心在面堆左前方）→ 木纹 / 粉点 → 面堆脚的一圈轮廓线
  const { base, top, gv, w, h, tex } = plates(), [cx, cy] = toP(-0.03 + dx, 0.065);
  gv.drawImage(base, 0, 0);
  const hg = gv.createRadialGradient(cx, cy, 0.011 * KP, cx, cy, 0.25 * KP);
  hg.addColorStop(0, rgba('#C08048', .9)); hg.addColorStop(.5, rgba(B.woodHalo, .85)); hg.addColorStop(.86, rgba(B.woodHalo, .6)); hg.addColorStop(.93, rgba(B.woodHalo, .12)); hg.addColorStop(1, rgba(B.woodHalo, 0));
  gv.fillStyle = hg; gv.fillRect(0, 0, w, h);
  const v = gv.createRadialGradient(cx, cy, 0.23 * KP, cx, cy, 0.38 * KP);
  v.addColorStop(0, rgba(B.woodDark, 0)); v.addColorStop(.12, rgba(B.woodDark, .4)); v.addColorStop(1, rgba(B.woodDark, .9));
  gv.fillStyle = v; gv.fillRect(0, 0, w, h);
  gv.drawImage(top, 0, 0);
  gv.strokeStyle = DOUGH.l; gv.lineWidth = 2.4; gv.beginPath();
  for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, r = edgeR(a) * gr * .985, [x, y] = toP(Math.cos(a) * r, Math.sin(a) * r); i ? gv.lineTo(x, y) : gv.moveTo(x, y); }
  gv.stroke();
  tex.needsUpdate = true;
}

// —— 面粉堆高度：圆鼓的堆 + 鼓包；Wl = { p 面窝压下去的程度 0..1, pits: [[x, z, 深]] 三个指坑 } ——
const BUMPS = Array.from({ length: 14 }, (_, k) => { const a = hash(k + 40) * TAU, d = .2 + hash(k + 60) * .65; return [Math.cos(a) * d * MR, Math.sin(a) * d * MR, (hash(k + 80) - .35) * 0.012, 0.012 + hash(k + 90) * 0.016]; });
function hgt(x, z, gr, Wl) {
  const u = Math.hypot(x, z) / (edgeR(Math.atan2(z, x)) * gr);
  if (u >= 1) return -0.003;
  const fall = 1 - u * u;
  let y = MH * gr * Math.pow(1 - u, 1.3) * (1 + 1.3 * u);   // 堆尖圆、腰陡、脚往外摊
  for (const [bx, bz, bh, bs] of BUMPS) y += bh * gr * fall * Math.exp(-((x - bx * gr) ** 2 + (z - bz * gr) ** 2) / (bs * bs));
  if (Wl && Wl.p > 0) {
    const d = Math.hypot(x, z);
    y += Wl.p * (-0.04 * Math.exp(-((d / 0.04) ** 2)) + 0.012 * Math.exp(-(((d - 0.062) / 0.016) ** 2)));   // 面窝 + 窝边隆起的一圈
  }
  if (Wl) for (const [tx, tz, td] of Wl.pits) y -= td * Math.exp(-((x - tx) ** 2 + (z - tz) ** 2) / (0.0085 ** 2));
  return y;
}
const NR = 72, NS = 180;
function moundGeo(gr, Wl) {
  const pos = new Float32Array((NR + 1) * NS * 3), idx = [];
  for (let i = 0; i <= NR; i++) for (let j = 0; j < NS; j++) {
    const a = j / NS * TAU, r = (i / NR) * edgeR(a) * gr * 1.03, x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.set([x, hgt(x, z, gr, Wl), z], (i * NS + j) * 3);
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = i * NS + j, b = i * NS + (j + 1) % NS; idx.push(a, b, a + NS, b, b + NS, a + NS); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// —— 手型（度，同 hand3d.pose）：[张开（正 = 往拇指那边）, 掌指关节弯, 中节弯, 末节弯] ——
// 机位在师傅身后斜上方：手若顺着视线往前扎，手指正对镜头、缩成一个拳头。所以前臂从右下角斜进来、手指朝左上扎进面窝 → 三根指头侧着压下去，整根看得见
// app 落下来：四指放松、略弯、张开不等；press 食 / 中 / 无名三指并拢斜扎（食指、无名指往中指靠，指尖聚到一处），小指蜷在旁边；
// lift 三指从窝里拔出来：指节回直一些、略散开
const POSE = {
  app:   { thumb: [-8, 8, 8, 4], index: [6, 8, 10, 6], middle: [0, 8, 10, 6], ring: [-6, 10, 12, 6], pinky: [-12, 18, 20, 10] },
  press: { thumb: [-14, 6, 8, 4], index: [-3, 10, 16, 12], middle: [0, 10, 16, 12], ring: [3, 12, 18, 12], pinky: [6, 42, 52, 30] },
  lift:  { thumb: [-12, 6, 8, 4], index: [-1, 8, 12, 8], middle: [0, 8, 12, 8], ring: [1, 10, 14, 8], pinky: [4, 38, 46, 26] },
};
const mixP = (a, b, w) => Object.fromEntries(Object.keys(a).map(k => [k, a[k].map((v, i) => v + (b[k][i] - v) * w)]));
// [lt, 手型 a, b, 权重, 三指尖中心 x, y（null = 按面窝深度）, z, 俯仰°（负 = 指尖朝下）, 偏航°, 面窝 p, 往上拔的高度]
const KEYS = [
  [1.667, 'app', 'app', 0, 0.190, 0.27, 0.250, -12, 50, 0],
  [1.750, 'app', 'app', 0, 0.130, 0.20, 0.170, -15, 51, 0],
  [1.833, 'app', 'app', 0, 0.070, 0.15, 0.090, -19, 52, 0],
  [1.917, 'app', 'press', .4, 0.020, 0.122, 0.024, -24, 52, 0],
  [2.000, 'press', 'press', 0, 0.005, null, 0.005, -30, 52, .2],
  [2.083, 'press', 'press', 0, 0.002, null, 0.002, -31, 52, .5],
  [2.167, 'press', 'press', 0, 0, null, 0, -32, 52, .8],
  [2.250, 'press', 'press', 0, 0, null, 0, -32, 52, 1],
  [2.333, 'press', 'press', 0, 0, null, 0, -32, 52, 1],
  [2.417, 'press', 'press', 0, 0, null, 0, -32, 52, 1],
  [2.500, 'press', 'lift', .5, 0.002, null, 0.002, -31, 52, 1, 0.006],
  [2.583, 'lift', 'lift', 0, 0.005, null, 0.004, -29, 52, 1, 0.016],
  [2.667, 'lift', 'lift', 0, 0.008, null, 0.007, -28, 52, 1, 0.028],
  [2.750, 'lift', 'lift', 0, 0.011, null, 0.010, -27, 52, 1, 0.040],
  [2.833, 'lift', 'lift', 0, 0.014, null, 0.013, -26, 52, 1, 0.050],
  [2.917, 'lift', 'lift', 0, 0.017, null, 0.016, -25, 52, 1, 0.058],
];
const keyAt = tc => { let k = null; for (const K of KEYS) if (K[0] <= tc + 1e-3) k = K; return k; };   // 容差 1e-3：key 时间写成三位小数（1.667 > 20/12），1e-6 会让六张 key 永远轮不到
// 右肩（世界坐标，米）：师傅站在案板近侧（台边 z = .35），身体中线在 x ≈ .10（面堆右边一点 → 右手往左前方扎），肩在画框外的下方。
// 落手时人还直一些（肩高 .46、离台边 .25），三指压下去时身子往前探、往下沉（肩高 .41、离台边 .20）。
// 肘尖往下、往外（右手 +X）：往外多给一点，前臂才和朝左上扎的手对得上（手腕侧弯 ≤ 15°、屈 ≤ 34°；肘尖只往下时侧弯 33°）
const SH0 = [0.30, 0.46, 0.60], SH1 = [0.30, 0.41, 0.55], POLE = [1.2, -1, 0], TIPS = ['index', 'middle', 'ring'];
const shoulder = k => { const u = ease((k[0] - 1.667) / 0.333); return SH0.map((a, i) => a + (SH1[i] - a) * u); };
const V = () => new THREE.Vector3();

// —— 落粉：从左上（远侧、偏左）高处斜着飘下来，落定后留成扁粉点（台面上 / 面堆上）——
const NF = 320, FALL = (() => {
  const R = rng(303), A = [];
  for (let i = 0; i < NF; i++) {
    const ts = -2.4 + R() * 4.4, D = 1.4 + R() * 1.1, a = R() * TAU, rho = 0.21 * Math.sqrt(R()), L = [Math.cos(a) * rho * 1.15, Math.sin(a) * rho * .9];
    A.push({ ts, D, L, S: [L[0] - 0.05 - R() * 0.06, 0.30 + R() * 0.16, L[1] - 0.04 - R() * 0.05], r: 0.0007 + R() * 0.0007, sw: 0.004 + R() * 0.008, fq: .5 + R() * .7, ph: R() * TAU });
  }
  return A;
})();

let S = null;
function setup() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 16 / 9, 0.03, 10), pl = plates();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshBasicMaterial({ map: pl.tex }));
  board.rotation.x = -Math.PI / 2; board.position.set(X0 + PW / 2, 0, Z0 + PD / 2);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.ShadowMaterial({ color: new THREE.Color(B.woodDark), opacity: .55 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(board.position.x, 0.0004, board.position.z); shade.receiveShadow = true;
  for (const m of [board, shade]) { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; }
  const mound = new THREE.Mesh(new THREE.BufferGeometry(), toon({ ...DOUGH, h: FLOUR.f }, { t: .3, hi: .86 }));
  mound.castShadow = mound.receiveShadow = true;
  const flakes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon(FLOUR, { t: .1, line: false }), NF);
  flakes.receiveShadow = true;
  const hand = makeHand('R'), orient = hand.root.children[0], glb = orient.children[0];
  const capGeo = new THREE.IcosahedronGeometry(1, 2), cp = capGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) { const k = 1 + .14 * (hash(i * 1.37 + 5) - .5); cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k, cp.getZ(i) * k); }
  capGeo.computeVertexNormals();
  const caps = TIPS.map(() => { const m = new THREE.Mesh(capGeo, toon(FLOUR, { t: .1 })); m.castShadow = true; scene.add(m); return m; });
  scene.add(board, shade, mound, flakes, hand.root, hand.arm);
  const L = sun(scene, LIGHT, 0.45, [0, 0.02, 0]);
  return (S = { scene, cam, mound, flakes, hand, orient, glb, caps, L, BT: null });
}

// 摆手：手型 → 转向 → 让三个指尖的中心落在目标点 → 前臂接到腕上；返回三个指尖的世界坐标
function place(s, k, gr) {
  const [, a, b, w, tx, ty0, tz, pitch, yaw, p] = k, Hd = s.hand, v = V();
  Hd.pose(mixP(POSE[a], POSE[b], w));
  Hd.root.rotation.set(pitch * D2R, yaw * D2R, 0, 'YXZ'); Hd.root.position.set(0, 0, 0); Hd.root.updateMatrixWorld(true);
  const tips = TIPS.map(f => Hd.B[`${f}-finger-tip`].getWorldPosition(V())), c = tips.reduce((A, q) => A.add(q), V()).multiplyScalar(1 / 3);
  const ty = (ty0 ?? hgt(0, 0, gr, { p, pits: [] }) - 0.009 * p) + (k[10] || 0);
  v.set(tx, ty, tz).sub(c); Hd.root.position.copy(v); Hd.root.updateMatrixWorld(true);
  Hd.reachArm(shoulder(k), { pole: POLE });   // 前臂 → 肘（在画框下面）→ 上臂接到肩
  return tips.map(q => q.add(v));
}
// 手腕那截皮肤圆柱（hand3d sleeve() 里第一个 cyl：胳膊局部系 y = -.02 → .07，手端伸进手里 2 cm）：1.833、1.917 两张手比 2.083 那张（干净）
// 多往手心屈 7°、5°，圆柱手端的顶边从手背上露出来（一道直线 + 小尖角）。只这两张、只这只手的圆柱：换一份同尺寸、轴向分 12 段的圆柱，按腕弯过去 ——
// 腕（胳膊局部系 y = 0）往手那头整段转 θ，腕 → 袖口下沿（y = .04）转角线性减到 0，袖口里那段不动（整根刚体转会从袖口下沿 / 袖口筒壁戳出来）。
// θ = 「手相对胳膊比 2.083 那张多出来的方向差」× 2.5（1 倍线只短一点；2.5 倍顶边并进手腕轮廓）→ 约 18°、12°。其余的张用原来那份圆柱。
const WFIX = [1.833, 1.917], WREF = 2.083, WF = 2.5, WCUFF = .04;
const handDir = s => { s.hand.arm.updateMatrixWorld(true); return s.hand.arm.worldToLocal(s.hand.B['middle-finger-phalanx-proximal'].getWorldPosition(V())).normalize(); };
function wristFix(s, k) {   // 在 place(s, k) 之后调；s.WR = { g0 原来那份圆柱, y0 圆柱中心在胳膊局部系的 y, d 2.083 那张腕 → 中指根的方向（胳膊局部系）}
  const cy = s.hand.arm.children[0], W = s.WR;
  if (!WFIX.includes(k[0])) { cy.geometry = W.g0; return; }
  if (!W.g) { W.g = new THREE.CylinderGeometry(.028, .025, .09, 40, 12); W.P = W.g.attributes.position.array.slice(); W.N = W.g.attributes.normal.array.slice(); }
  const q = new THREE.Quaternion().setFromUnitVectors(W.d, handDir(s)), ang = 2 * Math.acos(Math.min(1, q.w)) * WF, ax = V().set(q.x, q.y, q.z).normalize(), qv = new THREE.Quaternion(), v = V();
  const Pa = W.g.attributes.position, Na = W.g.attributes.normal;
  for (let i = 0; i < Pa.count; i++) {
    const ya = W.P[i * 3 + 1] + W.y0;
    qv.setFromAxisAngle(ax, ang * Math.min(1, Math.max(0, 1 - ya / WCUFF)));
    v.set(W.P[i * 3], ya, W.P[i * 3 + 2]).applyQuaternion(qv); Pa.setXYZ(i, v.x, v.y - W.y0, v.z);
    v.set(W.N[i * 3], W.N[i * 3 + 1], W.N[i * 3 + 2]).applyQuaternion(qv); Na.setXYZ(i, v.x, v.y, v.z);
  }
  Pa.needsUpdate = Na.needsUpdate = true; W.g.computeBoundingSphere();
  cy.geometry = W.g;
}
// 指尖沾的粉：每个指头末节上一团（中心在末节 6 成处，略偏指肚）
function capsOn(s, show) {
  const Hd = s.hand, q = new THREE.Quaternion();
  TIPS.forEach((f, i) => {
    const m = s.caps[i]; m.visible = show; if (!show) return;
    const d = Hd.B[`${f}-finger-phalanx-distal`].getWorldPosition(V()), t = Hd.B[`${f}-finger-tip`].getWorldPosition(V());
    Hd.B[`${f}-finger-phalanx-distal`].getWorldQuaternion(q);
    const len = d.distanceTo(t), down = V().set(0, -1, 0).applyQuaternion(q).multiplyScalar(0.0018);
    m.position.copy(d.lerp(t, .66)).add(down); m.quaternion.copy(q); m.scale.set(0.0118, 0.011, len * .46);
  });
}

function flakesAt(s, lt, gr, Wl) {
  const mo = new THREE.Object3D();
  FALL.forEach((p, i) => {
    const u = (lt - p.ts) / p.D;
    if (u < 0) { mo.scale.setScalar(0); }
    else if (u >= 1) {   // 落定：台面上 / 面堆上的扁粉点
      const y = Math.max(0.0004, hgt(p.L[0], p.L[1], gr, Wl) + 0.0002);
      mo.position.set(p.L[0], y, p.L[1]); mo.scale.set(p.r * 1.3, p.r * .35, p.r * 1.2); mo.rotation.set(0, hash(i) * TAU, 0);
    } else {
      const y1 = Math.max(0, hgt(p.L[0], p.L[1], gr, Wl)), sw = Math.sin(TAU * p.fq * lt + p.ph) * p.sw * (1 - u), e = u * u * (3 - 2 * u) * .3 + u * .7;
      mo.position.set(p.S[0] + (p.L[0] - p.S[0]) * e + sw, p.S[1] + (y1 - p.S[1]) * e, p.S[2] + (p.L[1] - p.S[2]) * e - sw * .4);
      mo.scale.setScalar(p.r); mo.rotation.set(p.ph, lt * 2 + p.ph, 0);
    }
    mo.updateMatrix(); s.flakes.setMatrixAt(i, mo.matrix);
  });
  s.flakes.instanceMatrix.needsUpdate = true;
}

export function draw(g, e, lt, A, t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  g.fillStyle = B.woodDark; g.fillRect(0, 0, W, H);
  const s = setup(), lq = f24(lt), tc = f12(lt), gr = .9 + .1 * ease(tc / 1.5), sw = sway(lq);
  if (s.glb.parent !== s.orient) s.orient.add(s.glb);   // hand3d 的模型每只手只有一份：别的镜头建手时会把它挪走，这里挪回来
  boardFrame(sw, gr);
  const v = new THREE.Vector3(LIGHT[0] + sw * 4, LIGHT[1], LIGHT[2]).normalize();
  s.L.position.set(v.x * 3, 0.02 + v.y * 3, v.z * 3);
  const k = keyAt(tc), Wl = { p: 0, pits: [] };
  s.hand.root.visible = s.hand.arm.visible = !!k;
  if (k) {
    const pit = (q, p, G) => [q.x, q.z, Math.max(0, Math.min(0.03, hgt(q.x, q.z, G, { p, pits: [] }) - q.y + 0.0015))];
    if (!s.BT) s.BT = place(s, KEYS[7], 1).map(q => pit(q, 1, 1));   // 压到底那张的三个指坑：拔出来以后留在窝里
    if (!s.WR) { const cy = s.hand.arm.children[0]; place(s, KEYS.find(K => K[0] === WREF), 1); s.WR = { g0: cy.geometry, y0: cy.position.y, d: handDir(s) }; }
    const tips = place(s, k, gr), p = k[9];
    wristFix(s, k);
    Wl.p = p;
    Wl.pits = k[0] >= 2.5 - 1e-6 ? s.BT : p > 0 ? tips.map(q => pit(q, p, gr)) : [];
    capsOn(s, k[0] >= 2.0 - 1e-6);
  } else capsOn(s, false);
  s.mound.geometry.dispose(); s.mound.geometry = moundGeo(gr, Wl);
  flakesAt(s, lq, gr, Wl);
  const zq = 1 + .04 * ease(lq / 3), d = 0.72 / zq, el = 56 * D2R, az = 12 * D2R, tg = [0.004, 0.035, 0.03];
  s.cam.position.set(tg[0] + d * Math.cos(el) * Math.sin(az), tg[1] + d * Math.sin(el), tg[2] + d * Math.cos(el) * Math.cos(az)); s.cam.lookAt(...tg);
  draw3d(g, null, s.scene, s.cam);
  s.hand.pose({});   // 骨骼回到静止姿势：别的镜头之后再建手时量到的是真正的静止姿势
  return {};
}
