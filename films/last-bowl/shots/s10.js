// S10 —— 柜台侧前方机位 · 三渲二（TREATMENT §4 S10、§4.2、§5 27.0–30.0、§9）。2D 版原样备份在 s10_2d.js。
// 师傅在左双手托碗把碗推过柜台（近手 = 右手在碗左前、远手 = 左手在碗左后），老主顾的左手从右边进来托住碗右前：手掌贴碗腹、四指顺碗腹往下包到碗底、拇指翻上碗沿。
// 28.5 起定成 harmony 静帧（同一份三维渲染，只在物件上盖喷枪渐变），只有热气在动；静帧上匀速横摇 16 px（画面往左走，到 30.0）。
// 世界坐标（米）：X 向右，Y 向上，Z 朝镜头；台面 y = 0，碗停住时碗心在原点。一盏白色方向光（吊灯在左上、偏镜头这边），硬边投影，不加环境光。
// 手：hand3d 每边只载一份模型、多个镜头共用 → 这里用 makeHand 摆型，再把骨骼姿势抄进自己的骨骼克隆（SkeletonUtils），抄完把原件摆回静止，别的镜头不受影响。
// 老主顾的手 = 左手的克隆：换老主顾皮肤色、第二三指节冻红（顶点色）、藏青棉袄袖（自己车削）。S11 复用这里的构图：sceneS10() / frameS10()。
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { canvas, airbrush, mix, rgba, rng, hash, W, H, TAU } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { toon, sun, draw3d, rgb, renderer } from '../lib3d.js';
import { makeHand } from '../hand3d.js';
import { steam } from '../fx.js';
import { q12, easeOut } from './s10_2d.js';
// 2D 版的导出（s11.js 还在用）原样转出去；S11 换成三维后可以删
export { L, toScreen, q12, easeOut, backdrop, bowlBody, drawBowl, cradle, masterHand, guestHand, scene, POSE10 } from './s10_2d.js';

const D2R = Math.PI / 180;
// 机位：碗心偏上一点为目标，方位角（从 +Z 往 +X 转）、俯角、距离；横摇在 frameS10 里用 setViewOffset 做
export const CAM = { fov: 30, az: 9, el: 17, d: 0.66, tg: [0.0, 0.05, 0.0] };
const LAMP = [-0.5, 0.85, 0.72];                 // 光从哪来：左上、偏镜头这一侧（碗正面吃光、右侧落影）
const TOP = { x0: -1.1, x1: 1.1, z0: -0.42, z1: 0.17 };   // 台面范围；z1 = 台沿

// —— 碗：车削剖面（米），外壁 → 红沿（外壁顶一圈 + 唇 + 内壁顶一窄条）→ 内壁 ——
const PROF = [[1e-4, .003], [.030, .003], [.031, 0], [.036, 0], [.037, .002], [.037, .010], [.040, .012], [.050, .016], [.060, .021], [.069, .028], [.077, .037], [.084, .048], [.089, .059],
  [.092, .067], [.0935, .074], [.0938, .0778], [.0926, .0794], [.0906, .0786], [.0896, .0758], [.0884, .0716],
  [.0866, .066], [.082, .054], [.075, .043], [.066, .033], [.055, .025], [.042, .019], [.028, .016], [1e-4, .015]];
const lathe = (a, b) => new THREE.LatheGeometry(PROF.slice(a, b + 1).map(([r, y]) => new THREE.Vector2(r, y)), 128);
export const SOUP_Y = .063, SOUP_R = .0858, RIM = { r: .0935, y: .0778 };
// 外壁半径（按高度插值），手掌贴碗腹用
export function wallR(y) {
  for (let i = 6; i < 15; i++) { const [r0, y0] = PROF[i], [r1, y1] = PROF[i + 1]; if (y <= y1) return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0)); }
  return RIM.r;
}

// 汤面贴图：和 S9 同一份——汤色、远侧一弯暗、面条 7 道弧、两撮葱花的落点（S9 汤面椭圆归一化后搬进圆里）、油星、吊灯倒影
const S9 = { SC: [860, 590], SR: [478, 214], LAND: [[770, 612], [1000, 628]] };
const NOOD = { f: '#F2D99F', s: '#C9A877', l: '#8C6440' }, SCAL = { f: '#86B151', w: '#EEEABE', l: '#2E4A26' }, SOUP = { f: '#C8944F', d: '#6C3E2C', oil: '#F8C863', u: '#A86F43' };
function soupTex() {
  const N = 1024, [c, x] = canvas(N, N), P = (nx, ny) => [N / 2 + nx * N / 2, N / 2 + ny * N / 2];
  x.fillStyle = SOUP.d; x.fillRect(0, 0, N, N);
  x.fillStyle = SOUP.f; x.beginPath(); x.ellipse(N / 2 + 10, N / 2 + 60, N * .5, N * .47, 0, 0, TAU); x.fill();
  x.lineCap = 'round';
  for (let i = 0; i < 7; i++) {                                    // 汤下的面（暗）+ 露出汤面的弧（亮、描边）
    const a = i / 7 * TAU + hash(i + 9) * .5, cx = -.02 + Math.cos(a) * .27 * hash(i + 2), cy = -.04 + Math.sin(a) * .28 * hash(i + 3), r = .31 + .23 * hash(i + 4), a0 = a + 2.2, sp = 1.3 + .8 * hash(i + 5);
    const arc = (b0, b1, col, w) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); for (let j = 0; j <= 24; j++) { const b = b0 + (b1 - b0) * j / 24, [px, py] = P(cx + Math.cos(b) * r, cy + Math.sin(b) * r); j ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); };
    arc(a0 + sp - .2, a0 + TAU + .2, SOUP.u, 38);
    arc(a0, a0 + sp, NOOD.l, 44); arc(a0, a0 + sp, NOOD.f, 36); arc(a0 + .1, a0 + sp - .15, '#FBE8BC', 9);
  }
  const R = rng(919);
  for (let i = 0; i < 26; i++) { const a = R() * TAU, r = Math.sqrt(R()) * .9, [px, py] = P(Math.cos(a) * r, Math.sin(a) * r); x.fillStyle = SOUP.oil; x.beginPath(); x.ellipse(px, py, 7 + R() * 5, 6 + R() * 3, 0, 0, TAU); x.fill(); }
  for (let p = 0; p < 2; p++) for (let j = 0; j < 24; j++) {      // 葱花：S9 两撮落定的位置、同一套随机种子
    const Rr = rng(4100 + p * 97 + j), a = Rr() * TAU, u = Math.sqrt(Rr()), sz = 13 + Rr() * 5, id = j + p * 24, ty = hash(id * 3.3);
    const nx = (S9.LAND[p][0] + Math.cos(a) * 120 * u - S9.SC[0]) / S9.SR[0], ny = (S9.LAND[p][1] + Math.sin(a) * 60 * u - S9.SC[1]) / S9.SR[1];
    const [px, py] = P(nx * .92, ny * .92), r = sz * .9;
    x.fillStyle = ty < .62 ? SCAL.f : ty < .85 ? SCAL.w : SCAL.f; x.strokeStyle = SCAL.l; x.lineWidth = 2.5;
    x.beginPath(); x.ellipse(px, py, ty >= .85 ? r * 1.4 : r, ty >= .85 ? r * .5 : r * .82, hash(id) * TAU, 0, TAU); x.fill(); x.stroke();
    if (ty < .62) { x.fillStyle = SCAL.w; x.beginPath(); x.ellipse(px, py, r * .42, r * .34, 0, 0, TAU); x.fill(); }
  }
  return c;
}

// —— 柜台：台面木纹（横向木板、灯圈在碗左上、四周压暗）、台沿圆角、台边竖面（暗紫 + 几道横缝）；后墙 = 原来的二维喷枪画进贴图、贴在台面后沿的竖面上 ——
const KP = 900;
function topTex() {
  const w = Math.round((TOP.x1 - TOP.x0) * KP), h = Math.round((TOP.z1 - TOP.z0) * KP), [c, x] = canvas(w, h), B = BG.warm, R = rng(1010);
  const toP = (X, Z) => [(X - TOP.x0) * KP, (Z - TOP.z0) * KP];
  x.fillStyle = B.wood; x.fillRect(0, 0, w, h);
  const pw = .11 * KP;
  for (let i = 0, y0 = 0; y0 < h; i++, y0 += pw) {
    x.fillStyle = mix(B.wood, i % 2 ? '#6A3C20' : '#8A5634', .35); x.fillRect(0, y0, w, pw);
    for (let j = 0; j < 6; j++) {
      const yy = y0 + pw * (.1 + .8 * R()); x.strokeStyle = mix(B.wood, B.grain, .55); x.lineWidth = 1.2 + R() * 1.4; x.beginPath();
      for (let xx = -40; xx < w + 80; xx += 120) x.lineTo(xx, yy + Math.sin(xx / (260 + 160 * R()) + j) * (3 + 4 * R()));
      x.stroke();
    }
    x.fillStyle = B.grain; x.fillRect(0, y0 - 2, w, 4);
  }
  const [hx, hy] = toP(-.16, -.06);
  airbrush(x, hx, hy, .62 * KP, .42 * KP, B.woodHalo, .85, .95);
  const gr = x.createRadialGradient(hx, hy, .25 * KP, hx, hy, .95 * KP);
  gr.addColorStop(0, rgba(B.woodDark, 0)); gr.addColorStop(1, rgba(B.woodDark, .8)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  return c;
}
function faceTex() {
  const [c, x] = canvas(512, 256); x.fillStyle = '#4A3550'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#3E2C46'; for (let i = 0; i < 5; i++) x.fillRect(0, 30 + i * 46, 512, 4);
  return c;
}
function wallTex() {   // 后墙贴图（x −1.1…1.1、y 0…0.5 米）：吊灯在左上（画外）一大团暖光、右远角压暗、碗后一团暖光、墙根墙裙
  const KW = 900, w = 2.2 * KW, h = .5 * KW, [c, x] = canvas(w, h), P = (X, Y) => [(X + 1.1) * KW, (.5 - Y) * KW];
  x.fillStyle = '#6A5060'; x.fillRect(0, 0, w, h);
  airbrush(x, ...P(-.36, .34), .62 * KW, .36 * KW, '#CBB08A', .95, .85);
  airbrush(x, ...P(.52, .36), .4 * KW, .3 * KW, '#5A4458', .75, .9);
  airbrush(x, ...P(-.04, .1), .26 * KW, .12 * KW, '#E6C79A', .35, 1);
  x.fillStyle = '#5E4656'; x.fillRect(0, P(0, .045)[1], w, .045 * KW);
  x.fillStyle = '#4A3550'; x.fillRect(0, P(0, .045)[1] - 5, w, 7);
  return c;
}

// —— 手：makeHand 摆型 → 抄进自己的骨骼克隆（模块载入时就建好：这时候谁都还没摆过手，静止姿势是干净的）——
const bones = root => { const B = {}; root.traverse(o => { if (o.isBone) B[o.name] = o; }); return B; };
const SRC = { R: makeHand('R'), L: makeHand('L') };
for (const k in SRC) SRC[k].SB = SRC[k].B || bones(SRC[k].root);
const cloneHand = k => { const root = skClone(SRC[k].root); return { root, B: bones(root), k }; };
const HM = { R: cloneHand('R'), L: cloneHand('L') }, HG = cloneHand('L');
// 摆型：P 同 hand3d 的 pose()；抄完把原件摆回静止（别的镜头之后再 makeHand 时取到的静止姿势不被弄脏）
export function poseHand(h, P) {
  const s = SRC[h.k]; s.pose(P);
  for (const n in h.B) { const a = s.SB[n]; if (a) { h.B[n].position.copy(a.position); h.B[n].quaternion.copy(a.quaternion); } }
  s.pose({});
}
const lerpPose = (A, B, k) => Object.fromEntries(Object.keys(A).map(f => [f, A[f].map((v, i) => v + (B[f][i] - v) * k)]));
// 托碗：拇指张开翻上碗沿、末两节扣住；四指顺碗腹往下包，越往小指弯得越多（收到碗底下）。open = 入画时张着的手
export const POSE = {
  cradle: { thumb: [30, 8, 28, 22], index: [6, 22, 24, 12], middle: [0, 28, 28, 14], ring: [-5, 40, 40, 20], pinky: [-11, 48, 42, 20] },
  far: { thumb: [30, 8, 28, 22], index: [6, 6, 8, 6], middle: [0, 8, 8, 6], ring: [-5, 10, 8, 6], pinky: [-11, 12, 8, 6] },   // 远手藏在碗后：四指少弯，别从碗壁里穿进碗口
  open: { thumb: [42, 0, 6, 4], index: [10, 6, 6, 4], middle: [2, 6, 6, 4], ring: [-7, 8, 8, 4], pinky: [-15, 10, 8, 4] },
};
// 老主顾：皮肤换色、第二三指节背侧冻红（顶点色 = 冻红 / 皮肤 lit，暗部跟着乘出来）、手整体瘦一圈
(function guestLook() {
  let mesh = null; HG.root.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
  const geo = mesh.geometry = mesh.geometry.clone(), P = geo.attributes.position, col = new Float32Array(P.count * 3).fill(1);
  const F = rgb(C('frostbite').f), G = rgb(C('guestSkin').f), K = F.map((v, i) => v / G[i]), sk = mesh.skeleton, J = [];
  for (const f of ['index', 'middle', 'ring', 'pinky']) for (const [seg, r] of [['phalanx-intermediate', .0105], ['phalanx-distal', .0085]]) {
    const i = sk.bones.findIndex(b => b.name === `${f}-finger-${seg}`); if (i < 0) continue;
    const m = sk.boneInverses[i].clone().invert().premultiply(mesh.bindMatrixInverse);
    J.push({ p: new THREE.Vector3().setFromMatrixPosition(m), y: new THREE.Vector3().setFromMatrixColumn(m, 1).normalize(), r });
  }
  const v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    for (const j of J) { d.subVectors(v, j.p); const l = d.length(); if (l < j.r && d.dot(j.y) > 0) { col.set(K, i * 3); break; } }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // 冻红要硬边：顶点色在三角形里是渐变的 → 片元里按「离冻红多近」取阈值，切成两块平涂（受光 / 背光照样由卡通光照分）
  const gm = toon(C('guestSkin'), { t: .1, hi: .92 }), ob = gm.onBeforeCompile, kk = K.map(q => q.toFixed(4)).join(', ');
  gm.vertexColors = true;
  gm.onBeforeCompile = sh => { ob(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `diffuseColor.rgb *= mix(vec3(1.), vec3(${kk}), step(.5, (1. - vColor.g) / ${(1 - K[1]).toFixed(4)}));`); };
  gm.customProgramCacheKey = () => 'toon_guest_frost';
  mesh.material = gm;
  HG.root.scale.setScalar(.9);
  for (const b of Object.values(HG.B)) { b.scale.x *= .88; b.scale.y *= .9; }
})();
// 老主顾的袖子：腕上一小段皮肤 → 厚袖口一圈 → 鼓起来的棉袄袖（一道道绗线），藏青；袖口挂雪 → 湿点 → 水痕（frameS10 前按 cuff 切换）
function guestArm() {
  const arm = new THREE.Group(), coat = { ...C('coat'), h: '#676774' };
  const add = (geo, c, o, y = 0) => { const m = new THREE.Mesh(geo, toon(c, o)); m.position.y = y; m.castShadow = m.receiveShadow = true; arm.add(m); return m; };
  add(new THREE.CylinderGeometry(.022, .02, .06, 32), C('guestSkin'), { t: .1 }, .012);
  const cp = [], sp = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; cp.push(new THREE.Vector2(.036 + .006 * Math.sin(u * Math.PI), .03 + u * .04)); }
  add(new THREE.LatheGeometry(cp, 40), { ...coat, f: mix(coat.f, '#4A5374', .35) }, { t: .05, hi: .93 });
  for (let i = 0; i <= 72; i++) { const u = i / 72; sp.push(new THREE.Vector2(.042 + .016 * Math.min(1, u * 1.8) - .004 * Math.pow(Math.abs(Math.cos(u * 22)), 8), .066 + u * .75)); }
  add(new THREE.LatheGeometry(sp, 40), coat, { t: .05, hi: .93 });
  const R = rng(5150), dots = [];
  for (let i = 0; i < 6; i++) {                                   // 袖口上 6 个点：朝上、朝镜头的半圈
    const a = (-.35 + i * .2 + (R() - .5) * .08) * Math.PI, y = .038 + R() * .025, r = .0015 + R() * .0007;
    const snow = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), toon({ f: '#E8E5DA', s: '#8C93B8', l: '#8C93B8' }, { t: .1, w: .0016 }));
    const wet = new THREE.Mesh(new THREE.CircleGeometry(r * 1.4, 10), toon({ f: '#1B1C3C', s: '#141626', l: '#141626' }, { line: false }));
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(.0009, .009), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE6B8'), side: THREE.DoubleSide }));
    streak.material.userData.outlineParameters = { visible: false };
    for (const m of [snow, wet, streak]) { m.position.set(Math.cos(a) * .0425, y, Math.sin(a) * .0425); m.lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2); arm.add(m); }
    dots.push({ snow, wet, streak });
  }
  arm.userData.cuff = k => { for (const d of dots) { d.snow.visible = k === 'snow'; d.wet.visible = k === 'wet'; d.streak.visible = k === 'streak'; } };
  return arm;
}
const AY = new THREE.Vector3(0, 1, 0), wp = new THREE.Vector3();
function aim(arm, h, dir) { h.root.updateMatrixWorld(true); h.B.wrist.getWorldPosition(wp); arm.position.copy(wp); arm.quaternion.setFromUnitVectors(AY, new THREE.Vector3(...dir).normalize()); }
// 手贴碗腹：phi = 碗周角度（0 = +X 右、90 = 朝镜头），y = 掌心贴点高度，s = 四指顺碗周往哪边包（±1），dn = 四指往下的分量，out = 掌离碗壁，roll = 绕四指方向再转（°）
export function onBowl(h, bx, phi, y, s, dn = .66, out = .006, roll = 0) {
  const a = phi * D2R, c = Math.cos(a), sn = Math.sin(a), r = wallR(y) + out;
  const n = new THREE.Vector3(c * .9, -.42, sn * .9).normalize();
  const f = new THREE.Vector3(-sn * s, 0, c * s).multiplyScalar(.75).add(new THREE.Vector3(-c * .7, -.7, -sn * .7).multiplyScalar(dn)).normalize(), Z = f.negate();
  const Y = n.sub(Z.clone().multiplyScalar(n.dot(Z))).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  h.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  if (roll) h.root.rotateZ(roll * D2R);
  h.root.position.set(bx + c * r, y, sn * r);
}

// —— 场景（S11 复用）：柜台、后墙、碗（汤面贴图）、三只手和袖子、一盏灯。返回的物件都能直接改：bowl / soup / hands.{R,L,G} / arms.{R,L,G} ——
let S = null;
export function sceneS10() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(CAM.fov, W / H, .05, 20), an = renderer().r.capabilities.getMaxAnisotropy();
  const tex = c => { const t = new THREE.CanvasTexture(c); t.anisotropy = an; return t; };
  const bgm = m => { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; scene.add(m); return m; };
  const TW = TOP.x1 - TOP.x0, TD = TOP.z1 - TOP.z0, TX = (TOP.x0 + TOP.x1) / 2, TZ = (TOP.z0 + TOP.z1) / 2;
  const top = bgm(new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), new THREE.MeshBasicMaterial({ map: tex(topTex()) })));
  top.rotation.x = -Math.PI / 2; top.position.set(TX, 0, TZ);
  const shade = bgm(new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), new THREE.ShadowMaterial({ color: new THREE.Color(BG.warm.woodDark), opacity: .55 })));
  shade.rotation.x = -Math.PI / 2; shade.position.set(TX, .0004, TZ); shade.receiveShadow = true;
  const nose = bgm(new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, TW, 24), toon({ f: '#C08A52', s: '#5E3A40', l: '#3A2418' }, { t: .35 })));
  nose.rotation.z = Math.PI / 2; nose.position.set(TX, -.012, TOP.z1); nose.receiveShadow = true;
  const face = bgm(new THREE.Mesh(new THREE.PlaneGeometry(TW, .6), new THREE.MeshBasicMaterial({ map: tex(faceTex()) })));
  face.position.set(TX, -.312, TOP.z1 + .012);
  const wall = bgm(new THREE.Mesh(new THREE.PlaneGeometry(2.2, .5), new THREE.MeshBasicMaterial({ map: tex(wallTex()) })));
  wall.position.set(0, .25, TOP.z0);
  // 碗：外壁白瓷 → 红沿 → 内壁（内壁不描边，碗口的线交给红沿）；汤面 = 贴图圆片（受光 = 贴图原色，背光 / 落影 = 乘汤的暗色比）
  const bowl = new THREE.Group(), mk = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; bowl.add(o); return o; };
  mk(lathe(0, 13), toon(C('bowl'), { t: .1, hi: .9 })); mk(lathe(13, 19), toon(C('rim'), { t: .1, hi: .88 })); mk(lathe(19, 27), toon(C('bowl'), { t: .1, hi: .9, line: false }));
  const soup = mk(new THREE.CircleGeometry(SOUP_R, 96), toon({ f: '#FFFFFF', s: '#8A6B8F', l: SOUP.d }, { t: .1, line: false, map: tex(soupTex()) }));
  soup.rotation.x = -Math.PI / 2; soup.position.y = SOUP_Y; soup.castShadow = false;
  const glint = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(C('rim').h) }));
  glint.material.userData.outlineParameters = { visible: false }; bowl.add(glint);
  scene.add(bowl);
  const arms = { R: SRC.R.arm.clone(), L: SRC.L.arm.clone(), G: guestArm() };
  scene.add(HM.R.root, HM.L.root, HG.root, arms.R, arms.L, arms.G);
  sun(scene, LAMP, .5, [0, 0, 0]);
  return (S = { scene, cam, bowl, soup, glint, hands: { R: HM.R, L: HM.L, G: HG }, arms });
}

// —— 一帧的摆放：o = { bx 碗心 x（米）, press 压腕 0–1, master: false = 师傅的手不在画里（S11 自己摆）, guest: null | { dx 离托住位置（米）, op 张开 0–1, cuff: 'snow'|'wet'|'streak' }, glint 0–1 | null, empty } ——
export const GRIP = { R: [166, .046, -1, .42, .009], L: [202, .052, 1, .35, .012], G: [14, .046, 1, .42, .009] };   // 每只手贴碗的 [碗周角°, 高度, 四指包的方向, 四指往下的分量, 掌离碗壁]
export function poseS10(o = {}) {
  const s = sceneS10(), bx = o.bx || 0, pr = o.press || 0, H3 = s.hands;
  s.bowl.position.x = bx;
  s.soup.visible = !o.empty;                                      // 空碗（S11）：不放汤面，露出白瓷内壁
  const M = o.master !== false; H3.R.root.visible = H3.L.root.visible = s.arms.R.visible = s.arms.L.visible = M;
  if (M) {
    poseHand(H3.R, POSE.cradle); onBowl(H3.R, bx, GRIP.R[0], GRIP.R[1] - .004 * pr, GRIP.R[2], GRIP.R[3], GRIP.R[4]);
    poseHand(H3.L, POSE.far); onBowl(H3.L, bx, GRIP.L[0], GRIP.L[1] - .004 * pr, GRIP.L[2], GRIP.L[3], GRIP.L[4]);
    aim(s.arms.R, H3.R, [-.9, .25, .3]); aim(s.arms.L, H3.L, [-.9, .25, -.3]);
  }
  const G = o.guest; H3.G.root.visible = s.arms.G.visible = !!G;
  if (G) {
    poseHand(H3.G, lerpPose(POSE.cradle, POSE.open, G.op || 0)); onBowl(H3.G, bx + (G.dx || 0), GRIP.G[0], GRIP.G[1], GRIP.G[2], GRIP.G[3], GRIP.G[4]);
    aim(s.arms.G, H3.G, [.9, .22, .38]); s.arms.G.userData.cuff(G.cuff || 'snow');
  }
  s.glint.visible = o.glint != null && o.glint < 1;
  if (s.glint.visible) {                                          // 接 S9 出点：红沿上那道高光接着往右滑完（头 6 帧）
    const a0 = (112 - 95 * o.glint) * D2R, pts = [];
    for (let i = 0; i <= 8; i++) { const a = a0 - .22 + .22 * i / 8; pts.push(new THREE.Vector3(Math.cos(a) * (RIM.r + .0009), RIM.y - .0016, Math.sin(a) * (RIM.r + .0009))); }
    s.glint.geometry.dispose(); s.glint.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .0017, 6);
  }
  return s;
}

// —— 渲一帧：三维层（横摇用 setViewOffset）→ harmony（只盖在物件上）→ 发光层剪影 → 热气。o = { bx, harm, steam: 秒 | null, pan: px（画面往左走）} ——
const [TC, tc] = canvas(W, H), [MC, mc] = canvas(W, H), [HC, hc] = canvas(W, H);
const clr = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H); };
export const project = (cam, p) => { const v = new THREE.Vector3(...p).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
export function frameS10(g, e, o = {}) {
  const s = sceneS10(), cam = s.cam, a = CAM.az * D2R, el = CAM.el * D2R, [tx, ty, tz] = CAM.tg, bx = o.bx || 0;
  cam.position.set(tx + CAM.d * Math.sin(a) * Math.cos(el), ty + CAM.d * Math.sin(el), tz + CAM.d * Math.cos(a) * Math.cos(el)); cam.lookAt(tx, ty, tz);
  cam.setViewOffset(W, H, o.pan || 0, 0, W, H); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#6A5060'; g.fillRect(0, 0, W, H); g.restore();
  clr(tc); clr(mc); draw3d(tc, mc, s.scene, cam);
  g.drawImage(TC, 0, 0);
  const [cx, cy] = project(cam, [bx, .05, 0]);
  if (o.harm) {                                                   // harmony：同一份渲染，物件上盖喷枪渐变（左上暖光、右下压紫）
    clr(hc); const gr = hc.createLinearGradient(cx - 650, cy - 330, cx + 520, cy + 400);
    gr.addColorStop(0, rgba('#FFE6B8', .42)); gr.addColorStop(.45, rgba('#FFE6B8', 0)); gr.addColorStop(.62, rgba('#4A3550', 0)); gr.addColorStop(1, rgba('#4A3550', .5));
    hc.fillStyle = gr; hc.fillRect(0, 0, W, H);
    airbrush(hc, cx - 210, cy + 40, 290, 190, '#FFF4DC', .3, 1);
    airbrush(hc, cx + 410, cy + 160, 320, 250, '#2A1A3A', .22, 1);
    hc.globalCompositeOperation = 'destination-in'; hc.drawImage(MC, 0, 0); hc.globalCompositeOperation = 'source-over';
    g.drawImage(HC, 0, 0);
  }
  e.drawImage(MC, 0, 0);
  if (o.steam != null) {                                          // 热气（fx.steam 的 S10 预设，尺寸按碗口在画面上的宽度换算）
    const [sx, sy] = project(cam, [bx - .004, SOUP_Y, 0]), k = (project(cam, [bx + RIM.r, RIM.y, 0])[0] - project(cam, [bx - RIM.r, RIM.y, 0])[0]) / 2 / 250;
    g.save(); e.save(); g.setTransform(k, 0, 0, k, 0, 0); e.setTransform(k, 0, 0, k, 0, 0); e.globalAlpha = .35;
    steam(g, e, o.steam, { x: sx / k, y: sy / k, preset: 'S10', spread: 90, lampSide: -1, seed: 1010, cfg: { n: 4, w: [32, 60], len: [220, 300], amp: 9 } });
    g.restore(); e.restore();
  }
  return { cx, cy };
}

// —— S10 时间线（lt 0–3）：0–0.75 压腕（头 4 张）+ 双手把碗推过来 ease-out 停住；0.75–1.25 老主顾的手右入 6 张（张着进 → 扣住）；
// 1.25 袖口雪粒换湿点；1.5（28.5）起定格：三维状态停在 1.5，换 harmony，袖口水痕，只有热气在动，匀速横摇 16 px ——
const GIN = [[.2, 1], [.13, 1], [.075, .85], [.03, .55], [.008, .25], [0, 0]];
export function draw(g, e, lt, A, t) {
  const harm = lt >= 1.5, tq = harm ? 1.5 : q12(lt);
  const pre = tq < .33 ? Math.sin(tq / .33 * Math.PI) : 0;
  const push = easeOut((tq + 1 / 12) / (.75 + 1 / 12)), bx = -.07 * (1 - push);
  const k = Math.min(5, Math.floor((tq - .75) * 12 + 1e-6));
  poseS10({ bx, press: pre, glint: lt < .25 ? lt / .25 : null, guest: k >= 0 ? { dx: GIN[k][0], op: GIN[k][1], cuff: harm ? 'streak' : tq >= 1.25 ? 'wet' : 'snow' } : null });
  frameS10(g, e, { bx, harm, steam: t, pan: harm ? 16 * Math.min(1, (lt - 1.5) / 1.5) : 0 });
  return {};
}
