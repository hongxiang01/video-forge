// S9 插入（24.0–27.0 s）—— 三渲二版（2D 版原样备份在 s9_2d.js）。斜俯特写柜台上的红沿白瓷碗，面已在碗里。
// 24.0–24.75 焦点转移：前景热气层 σ 0 → 8 px、不透明度 → 0.6，碗层（三维渲染 + 台面）σ 6 → 0（§9 附 2，ease-in-out）；热气层里的吊灯高光换成 4 个硬边圆形光斑。
// 24.75 师傅右手握勺从左上入画浇一勺汤；25.5 左手从左上入画撒一撮葱，25.875 停半拍，26.25 再一撮；26.25–27.0 红碗沿上一道高光滑过；26.75 起右手从左边伸过来要推碗（切 S10）。
// 三维：碗 = 车削（圈足 → 外壁 → 圆唇 → 内壁，红沿单独一块）；汤面 = 贴二维汤画（汤下的面、油星、吊灯倒影）的圆片；露出汤面的面条 = 压扁的管子；
// 台面 = 贴木纹喷枪背景的平面 + 只收投影的平面。一盏白色方向光（吊灯在左上、仰角约 60°：碗内壁左侧背光、外壁左前受光，碗影往右落），硬边投影，不加环境光。
// 葱花 = 三维小圈 / 小段（55 个，落定后浮在汤面上）；拇指位置由 fitThumb 在四指摆好后自动搜出（握勺：压在食指外侧那段柄上；捻葱：顶在食指、中指末节指肚下）。
// 世界坐标（米）：X 向右，Y 向上，Z 朝镜头；碗心在原点，台面 y = 0。手、勺按 12 fps 换张，镜头和光每帧动。
import * as THREE from 'three';
import { W, H, TAU, line, airbrush, mix, rgba, rng, hash, canvas } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { steam } from '../fx.js';
import { toon, sun, draw3d, renderer } from '../lib3d.js';
import { makeHand } from '../hand3d.js';

const BOWL = C('bowl'), RIMC = C('rim'), POT = C('pot');
const NOOD = { f: '#F2D99F', s: '#9C7066', l: '#8C6440', h: mix('#F2D99F', '#FFE6B8', .45) };
const SOUP = { f: '#C8944F', d: '#6C3E2C', h: '#FFE6B8', oil: '#F8C863', u: mix('#C8944F', '#6C3E2C', .38) };
const clamp = v => Math.max(0, Math.min(1, v)), ease = v => v * v * (3 - 2 * v);
const D2R = Math.PI / 180;

// —— 碗：口径 0.17 m、高 0.07 m（TREATMENT §4.1，和 S10 / S13 同一只）；LV = 汤面高度，RS = 汤面半径 ——
const BR = 0.085, BH = 0.07, TH = 0.0042, LV = 0.05;
const yB = u => 0.0085 + u * (BH - 0.0085 - TH / 2), rB = u => 0.039 + 0.046 * (1 - Math.pow(1 - u, 2.2));
const RS = rB((LV - 0.0085) / (BH - 0.0085 - TH / 2)) - TH + 0.0004;
function bowlMesh() {
  const P = [[1e-4, 0.003, 0], [0.030, 0.003, 0], [0.032, 0, 0], [0.0365, 0, 0], [0.0378, 0.005, 0]];   // [r, y, 红?]
  for (let i = 0; i <= 24; i++) { const u = i / 24; P.push([rB(u), yB(u), yB(u) > BH - 0.009 ? 1 : 0]); }
  for (let i = 1; i < 8; i++) { const a = i / 8 * Math.PI; P.push([BR - TH / 2 + Math.cos(a) * TH / 2, yB(1) + Math.sin(a) * TH / 2, 1]); }
  for (let i = 24; i >= 2; i--) { const u = i / 24; P.push([rB(u) - TH, yB(u), yB(u) > BH - 0.006 ? 1 : 0]); }
  P.push([1e-4, 0.012, 0]);
  const g = new THREE.Group(), mats = [toon(BOWL, { t: -.12, hi: .95 }), toon(RIMC, { t: -.12, hi: .93 })];
  let cur = null, seg = [];
  const flush = () => { if (seg.length < 2) return; const m = new THREE.Mesh(new THREE.LatheGeometry(seg.map(p => new THREE.Vector2(p[0], p[1])), 160), mats[cur]); m.castShadow = m.receiveShadow = true; g.add(m); };
  for (let i = 0; i + 1 < P.length; i++) {                         // 红沿单独一块（外壁上沿 9 mm + 圆唇 + 内壁上沿 6 mm），交界是硬边
    const tg = P[i][2] && P[i + 1][2] ? 1 : 0;
    if (tg !== cur) { flush(); seg = [P[i]]; cur = tg; }
    seg.push(P[i + 1]);
  }
  flush();
  return g;
}

// —— 台面背景板：和 S10 柜台同一块木头（光圈外 #7A4A2A、光圈内 #A86E3C），吊灯光圈偏左上，木纹顺 X ——
const KP = 1800, X0 = -0.7, Z0 = -0.55, PW = 1.4, PH = 1.05;
function plate() {
  const [c, x] = canvas(Math.round(PW * KP), Math.round(PH * KP)), B = BG.warm, R = rng(909);
  const toP = (X, Z) => [(X - X0) * KP, (Z - Z0) * KP];
  x.fillStyle = B.wood; x.fillRect(0, 0, c.width, c.height);
  airbrush(x, ...toP(-0.05, -0.04), 0.42 * KP, 0.34 * KP, B.woodHalo, .85, .8);   // 吊灯光圈
  airbrush(x, ...toP(0.5, 0.32), 0.5 * KP, 0.3 * KP, B.woodDark, .6, .9);
  for (let i = 0; i < 26; i++) {                                    // 木纹
    const z = Z0 + 0.02 + i * 0.04 + 0.008 * Math.sin(i * 1.7), pts = [];
    for (let X = X0 - 0.05; X < X0 + PW + 0.1; X += 0.12) pts.push(toP(X, z + 0.004 * Math.sin(X * 9 + i * 1.3) * (0.6 + R())));
    line(x, pts, rgba(B.grain, .55), 2.4 + R() * 1.4);
  }
  return c;
}

// —— 汤面：二维画在贴图里（远侧 = 贴图上方）。汤下的面（汤的暗部色，不描边）、油星（按一拍两格微微漂）、吊灯倒影（硬边）——
const TN = 1024, tp = (x, z) => [(x / RS * .5 + .5) * TN, (z / RS * .5 + .5) * TN], TK = TN / (2 * RS);
const ARCS = Array.from({ length: 7 }, (_, i) => {
  const a = i / 7 * TAU + hash(i + 9) * .5;
  return { c: [-0.002 + Math.cos(a) * 0.012 * hash(i + 2), 0.003 + Math.sin(a) * 0.012 * hash(i + 3)], r: 0.024 + 0.02 * hash(i + 4), a0: a + 2.2, span: 1.3 + .8 * hash(i + 5) };
});
const arcPt = (q, a) => [q.c[0] + Math.cos(a) * q.r, q.c[1] + Math.sin(a) * q.r];
const REFL = [[-0.038, -0.03, 0.011], [-0.024, -0.04, 0.005], [-0.047, -0.019, 0.0036]];   // 吊灯倒影 [x, z, 半宽]
function paintSoup(x, lt) {
  x.fillStyle = SOUP.f; x.fillRect(0, 0, TN, TN);
  x.lineCap = 'round'; x.strokeStyle = SOUP.u; x.lineWidth = 0.0045 * TK;
  for (const q of ARCS) { x.beginPath(); for (let j = 0; j <= 40; j++) { const p = tp(...arcPt(q, q.a0 + q.span - .2 + (TAU - q.span + .4) * j / 40)); j ? x.lineTo(...p) : x.moveTo(...p); } x.stroke(); }
  const R = rng(919), d = Math.floor(lt * 12) * .6;
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * .9 * RS, [px, py] = tp(Math.cos(a) * r, Math.sin(a) * r);
    x.fillStyle = SOUP.oil; x.beginPath(); x.ellipse(px + Math.sin(d * .3 + i) * 3, py, 3 + R() * 2.5, 2.6 + R() * 1.6, 0, 0, TAU); x.fill();
  }
  x.fillStyle = SOUP.h;
  for (const [X, Z, w] of REFL) { x.beginPath(); x.ellipse(...tp(X, Z), w * TK, w * TK * .45, -.5, 0, TAU); x.fill(); }
}
// 露出汤面的面：沿弧走的管子，压扁成 4 mm 宽、2 mm 厚的扁条，两头没进汤里
function noodleMesh(q, mat) {
  const pts = Array.from({ length: 21 }, (_, j) => { const u = j / 20, [x, z] = arcPt(q, q.a0 + q.span * u); return new THREE.Vector3(x, -0.003 + 0.0046 * Math.sin(Math.PI * u), z); });
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.002, 10), mat);
  m.position.y = LV; m.scale.y = .5; m.castShadow = m.receiveShadow = true; return m;
}

// —— 勺：压扁的半球勺头（口在勺本地 y = 0）+ 从勺口左沿斜着往上的长柄（柄 16° 仰角）。勺本地：柄朝 −X ——
const HAN = 16 * D2R, RC = 0.032, HD = new THREE.Vector3(-Math.cos(HAN), Math.sin(HAN), 0), HA = new THREE.Vector3(-RC + 0.001, 0.002, 0), GRIP = 0.10;
const SOUPC = { f: SOUP.f, s: SOUP.d, l: SOUP.d, h: SOUP.h };
function ladleMesh() {
  const g = new THREE.Group(), mat = toon(POT, { t: .1, hi: .86, w: .0026 }), pts = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i / 12 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * RC), Math.sin(a) * RC * .8)); }
  pts.push(new THREE.Vector2(RC - 0.0008, 0.0009));
  for (let i = 12; i >= 0; i--) { const a = -Math.PI / 2 + i / 12 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * (RC - 0.0016)), Math.sin(a) * (RC * .8 - 0.0016))); }
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), mat);
  const LH = 0.25, hdl = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, LH, 6, 16), mat);
  hdl.position.copy(HA).addScaledVector(HD, LH / 2); hdl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), HD); hdl.scale.set(1, 1, .75);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(RC - 0.0035, 48), toon(SOUPC, { t: .05, line: false }));
  fill.rotation.x = -Math.PI / 2; fill.position.y = -0.005;
  for (const m of [cup, hdl, fill]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  g.userData.fill = fill; return g;
}
// 握点：勺本地里，柄上离勺口 GRIP 处；x = 顺柄朝勺头，y = 柄的「上面」（拇指压在这一侧）
const GRIP_L = new THREE.Matrix4().makeBasis(HD.clone().negate(), new THREE.Vector3(Math.sin(HAN), Math.cos(HAN), 0), new THREE.Vector3(0, 0, 1)).setPosition(HA.clone().addScaledVector(HD, GRIP));
// 手框里的握点（摆好手型后量）：原点 = 食指、小指两个指圈中心的中点，x = 小指 → 食指（朝勺头；往指尖方向斜 27°：柄斜穿掌心，从掌根小指侧到虎口），y = 朝拇指
function gripFrame(Hd) {
  Hd.root.position.set(0, 0, 0); Hd.root.quaternion.identity(); Hd.root.updateMatrixWorld(true);
  const wp = n => Hd.B[n].getWorldPosition(new THREE.Vector3());
  const loop = f => ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'].map(s => wp(`${f}-finger-${s}`)).reduce((a, b) => a.add(b)).multiplyScalar(.25);
  const ci = loop('index'), cp = loop('pinky'), o = ci.clone().add(cp).multiplyScalar(.5);
  const x = ci.clone().sub(cp).normalize().add(new THREE.Vector3(0, 0, -.5)).normalize(), y = new THREE.Vector3(0, 1, 0).addScaledVector(x, -x.y).normalize();
  return new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)).setPosition(o);
}
// 握勺手型：四指扣住柄（食指最紧、小指最松，各节角度错开），拇指伸直一点、顺着柄压在上面
const P_LADLE = { thumb: [10, 18, 12, 8], index: [4, 62, 92, 52], middle: [0, 68, 96, 54], ring: [-4, 72, 96, 50], pinky: [-8, 76, 92, 48] };
// 勺的关键张（12 fps，24.75 起 9 张：入 3 → 浇 4 → 回 2）：[勺头中心 x, y, z, 倾角（勺头右沿往下点）]
const LKEY = [[-0.29, 0.16, 0.01, 0], [-0.16, 0.13, 0.01, .04], [-0.07, 0.115, 0.01, .14], [-0.035, 0.11, 0.012, .36], [-0.029, 0.108, 0.012, .58],
  [-0.029, 0.108, 0.012, .62], [-0.032, 0.11, 0.012, .5], [-0.15, 0.13, 0.01, .06], [-0.31, 0.17, 0.01, 0]];
const YAW = 35 * D2R;   // 柄往左、朝镜头斜：握勺的手在画面左上看得见

let S = null;
function setup() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 10);
  const tex = new THREE.CanvasTexture(plate()); tex.anisotropy = renderer().r.capabilities.getMaxAnisotropy();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex }));
  board.rotation.x = -Math.PI / 2; board.position.set(X0 + PW / 2, 0, Z0 + PH / 2);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.ShadowMaterial({ color: new THREE.Color(BG.warm.woodDark), opacity: .6 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(board.position.x, 0.0003, board.position.z); shade.receiveShadow = true;
  for (const m of [board, shade]) { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; }
  const [sc, sx] = canvas(TN, TN), stex = new THREE.CanvasTexture(sc);
  const soup = new THREE.Mesh(new THREE.CircleGeometry(RS, 128), toon({ f: '#FFFFFF', s: '#8A6B8E', l: SOUP.d }, { t: .05, map: stex, line: false }));
  soup.rotation.x = -Math.PI / 2; soup.position.y = LV; soup.receiveShadow = true;
  const nmat = toon(NOOD, { t: .1, hi: .9, w: .0024 });
  const bowl = bowlMesh();
  scene.add(board, shade, bowl, soup, ...ARCS.map(q => noodleMesh(q, nmat)));
  const sweep = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE6B8') }));
  sweep.material.userData.outlineParameters = { visible: false }; scene.add(sweep);
  const ladle = ladleMesh(), smat = toon(SOUPC, { t: .1, hi: .8, w: .002 });
  const stream = new THREE.Mesh(new THREE.BufferGeometry(), smat); stream.castShadow = true;
  const drops = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), smat); m.castShadow = true; return m; });
  const hands = { L: makeHand('L'), R: makeHand('R') };
  hands.R.pose(P_LADLE); const G = gripFrame(hands.R), G_INV = G.clone().invert();
  const gx = new THREE.Vector3(), gy = new THREE.Vector3(), gz = new THREE.Vector3(), go = new THREE.Vector3().setFromMatrixPosition(G); G.extractBasis(gx, gy, gz);
  P_LADLE.thumb = fitThumb(hands.R, P_LADLE, go.clone().addScaledVector(gx, 0.034).addScaledVector(gy, 0.0105));   // 拇指尖压在食指外侧那段柄的上面
  for (const ph of [0, .3, .5, 1]) {                                 // 捻葱：拇指尖顶在食指、中指末节指肚下面，ph 越大越往指尖
    const P = FINGERS_PINCH(ph); hands.L.root.position.set(0, 0, 0); hands.L.root.quaternion.identity(); hands.L.pose(P); hands.L.root.updateMatrixWorld(true);
    const pad = f => hands.L.B[`${f}-finger-phalanx-distal`].getWorldPosition(new THREE.Vector3()).lerp(hands.L.B[`${f}-finger-tip`].getWorldPosition(new THREE.Vector3()), .3 + .45 * ph);
    const dn = new THREE.Vector3(0, -1, 0).applyQuaternion(hands.L.B['index-finger-phalanx-distal'].getWorldQuaternion(new THREE.Quaternion()));
    P_FIT[ph] = { ...P, thumb: fitThumb(hands.L, P, pad('index').add(pad('middle')).multiplyScalar(.5).addScaledVector(dn, 0.012)) };
  }
  const ring = new THREE.TorusGeometry(0.0016, 0.00065, 8, 16).rotateX(Math.PI / 2), stick = new THREE.CapsuleGeometry(0.0009, 0.0032, 4, 8).rotateZ(Math.PI / 2);
  const gm = toon(SCAL, { t: .05, w: .0016 }), wm = toon({ f: SCAL.w, s: mix(SCAL.w, SCAL.s, .5), l: SCAL.l }, { t: .05, w: .0016 });
  const bits = Array.from({ length: 55 }, (_, j) => { const ty = hash(j * 3.3), m = new THREE.Mesh(ty < .85 ? ring : stick, ty < .62 || ty >= .85 ? gm : wm); m.castShadow = true; return m; });
  scene.add(ladle, stream, ...drops, ...bits);
  for (const k of ['L', 'R']) scene.add(hands[k].root, hands[k].arm);
  const L = sun(scene, [-0.55, 1.0, 0.12], 0.42, [-0.05, 0.05, 0]);
  return (S = { scene, cam, L, sx, stex, sweep, ladle, stream, drops, hands, G_INV, bits });
}

// —— 撒葱：师傅左手掌心朝下、手腕往下折 25°，拇指一侧朝镜头；食指、中指并着微弯，拇指从下面顶在两指指肚上，捻（ph 0 → 1）= 拇指顺指肚往指尖推、两指略张，葱从指缝漏下去 ——
const SCAL = { f: '#86B151', s: '#5A6A43', w: '#EEEABE', l: '#2E4A26' };
const FINGERS_PINCH = ph => ({ index: [3 + 2 * ph, 44, 50 - 8 * ph, 22 - 6 * ph], middle: [-1 - 2 * ph, 46, 50 - 8 * ph, 22 - 6 * ph], ring: [-4, 58, 72, 36], pinky: [-9, 64, 70, 34] });
const P_FIT = {}, P_PINCH = ph => P_FIT[ph] || P_FIT[0];
// 拇指自动摆：四指摆好后，在拇指四个角度里网格搜一遍 + 两轮细调，让拇指尖落到目标点（手框里）上
function fitThumb(Hd, base, T) {
  const tip = Hd.B['thumb-tip'], v = new THREE.Vector3(); let best = null;
  Hd.root.position.set(0, 0, 0); Hd.root.quaternion.identity();
  const tryP = th => { Hd.pose({ ...base, thumb: th }); Hd.root.updateMatrixWorld(true); const d = tip.getWorldPosition(v).distanceTo(T); if (!best || d < best.d) best = { d, th }; };
  for (let s = -60; s <= 60; s += 10) for (let a = -10; a <= 90; a += 10) for (let b = 0; b <= 70; b += 10) for (const c of [5, 20, 35]) tryP([s, a, b, c]);
  for (const st of [5, 2.5]) for (let it = 0; it < 3; it++) { const b0 = best.th; for (let i = 0; i < 4; i++) for (const dd of [-st, st]) { const th = b0.slice(); th[i] += dd; tryP(th); } }
  return best.th;
}
const PIN = [new THREE.Vector3(-0.03, LV + 0.06, 0.006), new THREE.Vector3(0.02, LV + 0.06, 0.018)], LAND = [new THREE.Vector3(-0.022, LV, 0.01), new THREE.Vector3(0.026, LV, 0.02)];
const FA = new THREE.Vector3(-1, 0.6, -0.12).normalize(), Q_PINCH = new THREE.Quaternion().setFromEuler(new THREE.Euler(-10 * D2R, -90 * D2R, 30 * D2R, 'YXZ'));   // 掌心朝下、往镜头侧斜 30°：看得见拇指顶在两指指肚下
// 手的时间表（一拍两格）：入画 2 张（顺前臂方向滑进来）→ 25.5 捻（ph .5 → 1 → 1 → .3）→ 停半拍、手腕回收 → 2 张挪到第二撮 → 26.25 再捻 → 26.583 起 3 张顺前臂退出
function pinchAt(lt) {
  if (lt < 1.25 || lt >= 2.833) return null;
  const f = Math.floor((lt - 1.25) * 12 + 1e-6), P0 = PIN[0], P1 = PIN[1], PH = [.5, 1, 1, .3];
  const at = (P, d, ph = 0) => ({ p: P.clone().addScaledVector(FA, d), ph });
  if (f < 1) return null;                                            // 勺先退出去，左手再进
  if (f < 3) return at(P0, [0, 0.2, 0.06][f]);
  if (f < 7) return at(P0, 0, PH[f - 3]);
  if (f < 9) return at(P0, 0.006);                                   // 停半拍：手腕往回收一点
  if (f < 11) { const u = f === 9 ? .45 : .88; return { p: P0.clone().lerp(P1, u).add(new THREE.Vector3(0, 0.008 * Math.sin(u * Math.PI), 0)), ph: 0 }; }
  if (f < 12) return at(P1, 0);
  if (f < 16) return at(P1, 0, PH[f - 12]);
  return at(P1, [0.04, 0.12, 0.24][Math.min(2, f - 16)]);
}
function pinchHand(lt) {
  const s = pinchAt(lt), Hd = S.hands.L; if (!s) return false;
  Hd.root.position.set(0, 0, 0); Hd.root.quaternion.identity(); Hd.pose(P_PINCH(s.ph)); Hd.root.updateMatrixWorld(true);
  const wp = n => Hd.B[n].getWorldPosition(new THREE.Vector3());
  const pc = wp('thumb-tip').add(wp('index-finger-tip')).add(wp('middle-finger-tip')).multiplyScalar(1 / 3);   // 拇指和两指指肚相碰处 → 锚点
  Hd.root.quaternion.copy(Q_PINCH); Hd.root.position.copy(s.p).sub(pc.applyQuaternion(Q_PINCH));
  Hd.aimArm(FA.toArray());
  if (lt < 2.25 && s.ph < .4) for (let j = 0; j < 7; j++) {         // 还捏着的葱：指肚之间露出几粒
    const R = rng(4900 + j), a = R() * TAU, m = S.bits[48 + j];
    m.visible = true; m.position.set(s.p.x + 0.002 + Math.cos(a) * 0.004, s.p.y - 0.004 - R() * 0.003, s.p.z + Math.sin(a) * 0.004); m.rotation.set(R() * 3, R() * 3, R() * 3);
  }
  return true;
}
// —— 切到 S10 前：师傅右手从左边伸过来要托碗（切在动作上，S10 头一张手已经托在碗上、接着压腕推）——
// 手背朝上、斜对镜头，四指放松朝碗伸、越往小指越弯（等着从碗腹外侧托住），拇指张开（等着翻上碗沿）
const P_REACH = { thumb: [24, -6, 6, 8], index: [6, 20, 24, 12], middle: [2, 24, 28, 14], ring: [-2, 28, 32, 16], pinky: [-6, 32, 36, 18] };
const Q_REACH = (() => {
  const y = new THREE.Vector3(-0.25, 0.85, 0.45).normalize(), f0 = new THREE.Vector3(0.9, -0.3, 0.1), f = f0.addScaledVector(y, -f0.dot(y)).normalize();
  const z = f.clone().negate(), x = y.clone().cross(z);   // 手框：+Y = 手背（朝上、略朝镜头），−Z = 四指（朝碗）
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
})();
function reachHand(lt) {
  const f = Math.floor((lt - 2.75) * 12 + 1e-6), Hd = S.hands.R; if (f < 0) return false;
  Hd.pose(P_REACH); Hd.root.quaternion.copy(Q_REACH);
  Hd.root.position.set(...[[-0.30, 0.075, 0.035], [-0.20, 0.068, 0.035], [-0.15, 0.064, 0.035]][Math.min(2, f)]);
  Hd.aimArm(new THREE.Vector3(0, 0, 1).applyQuaternion(Q_REACH).add(new THREE.Vector3(-0.6, 0.2, 0)).normalize().toArray());
  return true;
}
function scallions(lt) {
  for (let p = 0; p < 2; p++) {
    const t0 = [1.5, 2.25][p]; if (lt < t0) continue;
    const d = Math.floor((lt - t0) * 12 + 1e-6), P = PIN[p], Lp = LAND[p];
    for (let j = 0; j < 24; j++) {
      const R = rng(4100 + p * 97 + j), a = R() * TAU, u = Math.sqrt(R()), m = S.bits[p * 24 + j];
      m.visible = true;
      if (d === 0) m.position.set(P.x + 0.004 + Math.cos(a) * 0.007 * u, P.y - 0.012 - R() * 0.008, P.z + Math.sin(a) * 0.006 * u);   // 指缝松开
      else if (d === 1) m.position.set((P.x + Lp.x) / 2 + Math.cos(a) * 0.016 * u, (P.y + LV) / 2 - 0.01 + (R() - .5) * 0.02, (P.z + Lp.z) / 2 + Math.sin(a) * 0.014 * u);   // 落
      else m.position.set(Lp.x + Math.cos(a) * 0.026 * u, LV + 0.0005, Lp.z + Math.sin(a) * 0.026 * u * .8);   // 落定，浮在汤面上
      m.rotation.set(d >= 2 ? 0 : R() * 3, R() * 6, d >= 2 ? 0 : R() * 3);
    }
  }
}

// —— 浇汤：右手握勺（手框 = 勺的世界变换 × 握点 × 手框里握点的逆），勺口右沿往下点，汤柱 3 张循环 + 落点 4 片小水花 ——
const _s = new THREE.Vector3(), _q = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1);
function ladle(lt) {
  const k = Math.floor((lt - .75) * 12 + 1e-6), on = k >= 0 && k <= 8, Hd = S.hands.R;
  S.ladle.visible = S.stream.visible = on; S.drops.forEach(m => (m.visible = false));
  if (!on) return false;
  const [x, y, z, tl] = LKEY[k];
  _q.setFromEuler(new THREE.Euler(0, YAW, -tl, 'YXZ'));
  const Lw = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, ONE);
  S.ladle.position.set(x, y, z); S.ladle.quaternion.copy(_q); S.ladle.userData.fill.visible = k < 5;
  Hd.pose(P_LADLE);
  Lw.clone().multiply(GRIP_L).multiply(S.G_INV).decompose(Hd.root.position, Hd.root.quaternion, _s);
  Hd.aimArm(new THREE.Vector3(0, 0, 1).applyQuaternion(Hd.root.quaternion).add(new THREE.Vector3(-0.2, 0.25, 0)).normalize().toArray());   // 前臂顺着手往左上出画
  S.stream.visible = k >= 3 && k <= 6;
  if (S.stream.visible) {
    const v = k % 3, lip = new THREE.Vector3(RC * .97, 0.0006, 0).applyMatrix4(Lw), sp = new THREE.Vector3(lip.x + 0.03 + v * 0.002, LV - 0.002, lip.z + 0.012);
    const pts = Array.from({ length: 12 }, (_, j) => { const u = j / 11; return new THREE.Vector3(lip.x + (sp.x - lip.x) * Math.sqrt(u) + (v === 1 ? 0.0015 * Math.sin(u * 9) : 0), lip.y + (sp.y - lip.y) * u * u, lip.z + (sp.z - lip.z) * u); });
    S.stream.geometry.dispose(); S.stream.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.0034 - 0.0004 * v, 10);
    S.drops.forEach((m, i) => {
      const a = Math.PI + .5 + i / 3 * 2.1 + v * .15, r = 0.006 + 0.002 * hash(i + v * 4), h = 0.006 + 0.004 * hash(i * 3 + v);
      m.visible = true; m.position.set(sp.x + Math.cos(a) * r, LV + h * .5, sp.z - Math.sin(a) * r * .7);
      m.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .7); m.scale.set(0.0016, h * .5, 0.0016);
    });
  }
  return true;
}

const pv = new THREE.Vector3();
const proj = (x, y, z) => { pv.set(x, y, z).project(S.cam); return [(pv.x + 1) / 2 * W, (1 - pv.y) / 2 * H]; };
// 镜头：斜俯 54° → 51°，方位从左 6° 慢慢绕到右 1°，同时极慢推近（每帧都动）；吊灯微微晃（光每帧都动）
function frame(lt) {
  const u = lt / 3, az = (-5 + 7 * u) * D2R, el = (38 - 3 * u) * D2R, d = 0.42 - 0.02 * ease(clamp(u)), tg = [-0.02, 0.075, 0.004];
  S.cam.position.set(tg[0] + d * Math.cos(el) * Math.sin(az), tg[1] + d * Math.sin(el), tg[2] + d * Math.cos(el) * Math.cos(az));
  S.cam.lookAt(...tg); S.cam.updateMatrixWorld();
  const v = new THREE.Vector3(-0.55 + 0.03 * Math.sin(lt * 1.9), 1.0, 0.12 + 0.02 * Math.cos(lt * 1.3)).normalize();
  S.L.position.set(-0.05 + v.x * 3, 0.05 + v.y * 3, v.z * 3);
}

// 26.25–27.0：一道高光从左经前沿滑到右（圆唇顶上一条弧带，每帧都动）
function rimSweep(e, lt) {
  const m = S.sweep; m.visible = lt >= 2.25; if (!m.visible) return;
  const a = Math.PI - clamp((lt - 2.25) / .75) * Math.PI, len = .32;   // 世界角：π = 左，π/2 = 前，0 = 右
  m.geometry.dispose(); m.geometry = new THREE.RingGeometry(BR - TH * .95, BR - TH * .1, 40, 1, -(a + len / 2), len);
  m.rotation.x = -Math.PI / 2; m.position.y = BH + 0.0002;
  return () => {
    const pts = Array.from({ length: 9 }, (_, j) => { const b = a - len * .35 + len * .7 * j / 8; return proj(Math.cos(b) * (BR - TH / 2), BH, Math.sin(b) * (BR - TH / 2)); });
    line(e, pts, '#FFD8B0', 8);
  };
}

let LY = null;
const clr = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, H); return x; };
export function draw(g, e, lt, A, t) {
  setup();
  if (!LY) LY = [canvas(W, H), canvas(W, H), canvas(W, H), canvas(W, H)];
  const [[bc, b], [bec, be], [sc, s], [sec, se]] = LY;
  [b, be, s, se].forEach(clr);
  frame(lt);
  paintSoup(S.sx, lt); S.stex.needsUpdate = true;
  const glow = rimSweep(be, lt), R = ladle(lt);
  S.bits.forEach(m => (m.visible = false)); scallions(lt);
  const Lh = pinchHand(lt), Rr = !R && reachHand(lt);
  S.hands.R.root.visible = S.hands.R.arm.visible = R || Rr;
  S.hands.L.root.visible = S.hands.L.arm.visible = Lh;
  draw3d(b, be, S.scene, S.cam);                                     // 碗层
  for (const [X, Z, w] of REFL) {                                    // 汤面吊灯倒影进发光层
    const [x0, y0] = proj(X, LV, Z), [x1] = proj(X + w, LV, Z), [, y1] = proj(X, LV, Z + w);
    be.fillStyle = '#FFE6B8'; be.beginPath(); be.ellipse(x0, y0, Math.abs(x1 - x0), Math.abs(y1 - y0) * .5 + 1, -.3, 0, TAU); be.fill();
  }
  if (glow) glow();
  const [sx0, sy0] = proj(-0.004, LV, 0.006);
  steam(s, se, t, { preset: 'S9', x: sx0 - 30, y: sy0 + 30, spread: 210, lampSide: -1, seed: 909 });   // 前景热气层
  const k = ease(clamp(lt / .75)), sb = 6 * (1 - k), ss = 8 * k, so = 1 - .4 * k;
  for (const [x, lc, sc2] of [[g, bc, sc], [e, bec, sec]]) {
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.filter = sb > .05 ? `blur(${sb}px)` : 'none'; x.drawImage(lc, 0, 0);
    x.filter = ss > .05 ? `blur(${ss}px)` : 'none'; x.globalAlpha = so; x.drawImage(sc2, 0, 0);
    x.restore();
  }
  if (ss > 3) for (const [x, y, d] of [[430, 200, 64], [560, 120, 44], [330, 360, 52], [1500, 150, 40]]) {   // 吊灯高光 → 硬边圆形光斑
    const P = new Path2D(); P.ellipse(x, y, d / 2, d / 2, 0, 0, TAU); g.fillStyle = rgba('#FFE6B8', .3); g.fill(P); e.fillStyle = rgba('#FFE6B8', .3); e.fill(P);
  }
  return {};
}
