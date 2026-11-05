// S6 —— 切面 · 三渲二（TREATMENT §4 镜头表 S6、§4.4 生面条、§5 15.00–18.00）。2D 版原样备份在 s6_2d.js。
// 世界坐标（米）：X 向右，Y 向上，Z 朝师傅（近侧）；台面 y = 0。叠好的面片沿 X 横放（5 层折叠，每层一条圆边薄片），刀刃沿 Z。
// 机位从左前方斜俯：15.0–16.5 跟刀匀速横移；16.5–17.25 以刀刃入面处为锚点推近到 150%（ease-in）；17.25–18.0 拉回（ease-out）到抖面。
// 刀和手按 3-2-2-2 帧换张（八分 9 帧 4 张，落刀那张多停一帧，落在拍上），抖面按 12 fps，镜头每帧动。一盏方向光（吊灯在左上），硬边投影。
import * as THREE from 'three';
import { line, mix, rgba, rng, hash, canvas, airbrush, vgrad, TAU } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { toon, sun, draw3d, renderer } from '../lib3d.js';
import { makeHand } from '../hand3d.js';

const D2R = Math.PI / 180, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = u => 1 - (1 - u) * (1 - u);
const NW = 0.010, LAY = 5, LT = 0.0048, DD = 0.104, TOP = LAY * LT * .96;   // 面条宽、层数、每层厚、面块进深、面块顶高
const BX0 = -0.30, BX1 = 0.27, KX0 = 0.07;                                 // 面块左端、右端、第一刀
const KB = { L: 0.27, H: 0.085, T: 0.0026, z: -0.012 };                    // 刀身：长（沿 Z）、高、厚、中心 z
const HA = 15 * D2R, HL = 0.12, HW = V3(0, Math.sin(HA), Math.cos(HA));    // 木柄：从刀背后端往师傅那边上翘 15°
const HI = '#FFF4DC', GLOW = new THREE.MeshBasicMaterial({ color: '#8A7458' });

// —— 背景板：台面（同一块案板：横向木板 + 木纹 + 结疤 + 左上吊灯的光圈 + 撒粉）+ 墙（喷枪渐变），沿用 2D 版的画法 ——
const KP = 1100, PX0 = -1.2, PZ0 = -0.55, PWm = 2.4, PDm = 1.5;
function boardTex() {
  const [c, x] = canvas(Math.round(PWm * KP), Math.round(PDm * KP)), w = c.width, h = c.height, B = BG.warm, R = rng(606);
  const toP = (X, Z) => [(X - PX0) * KP, (Z - PZ0) * KP];
  x.fillStyle = B.wood; x.fillRect(0, 0, w, h);
  const pw = 0.135 * KP;
  for (let i = 0, y0 = 0.03 * KP; y0 < h; i++, y0 += pw) {
    x.fillStyle = mix(B.wood, i % 2 ? '#6A3C20' : '#8A5634', .45); x.fillRect(0, y0, w, pw);
    const gc = mix(B.wood, B.grain, .55);
    for (let j = 0; j < 9; j++) {
      const yy = y0 + pw * (.08 + .84 * R()), pts = [];
      for (let xx = -40; xx < w + 80; xx += 160) pts.push([xx, yy + Math.sin(xx / (300 + 200 * R()) + j) * (4 + 6 * R())]);
      line(x, pts, gc, 1.4 + R() * 1.6);
    }
    const kx = w * R(), ky = y0 + pw * (.3 + .4 * R());
    for (let r = 3; r > 0; r--) { x.strokeStyle = gc; x.lineWidth = 2; x.beginPath(); x.ellipse(kx, ky, 18 * r + 6, 6 * r + 3, 0, 0, TAU); x.stroke(); }
    x.fillStyle = B.grain; x.fillRect(0, y0 - 3, w, 6);
    x.fillStyle = mix(B.wood, '#C08A55', .45); x.fillRect(0, y0 + 3, w, 3);
  }
  const [hx, hy] = toP(-0.08, -0.06);
  airbrush(x, hx, hy, 0.75 * KP, 0.5 * KP, B.woodHalo, .8, .95);
  const gr = x.createRadialGradient(hx, hy, 0.3 * KP, hx, hy, 1.0 * KP);
  gr.addColorStop(0, rgba(B.woodDark, 0)); gr.addColorStop(1, rgba(B.woodDark, .85)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  const fl = C('flour').f;
  for (let i = 0; i < 1100; i++) {
    const [px, py] = toP(-0.42 + R() * 0.84, -0.12 + Math.pow(R(), 1.3) * 0.3);
    x.fillStyle = rgba(fl, .45 + .55 * R()); x.beginPath(); x.arc(px, py, 1.2 + 2.6 * R(), 0, TAU); x.fill();
  }
  return c;
}
function wallTex() {
  const [c, x] = canvas(1200, 450), B = BG.warm;
  vgrad(x, 0, 0, 1200, 450, [[0, B.wallFar], [1, mix(B.wallNear, B.wallFar, .35)]]);
  airbrush(x, 420, 330, 600, 240, B.wallNear, .5, .9);
  x.fillStyle = B.woodDark; x.fillRect(0, 442, 1200, 8);
  return c;
}

// —— 面：一层 = 圆头长条截面（进深 DD、厚 LT）沿 X 挤出 len；叠 5 层，奇偶层前后错开一点（折叠的折口）——
function slabGeo(len) {
  const r = LT / 2, a = DD / 2 - r, s = new THREE.Shape();
  s.moveTo(-a, -r); s.lineTo(a, -r); s.absarc(a, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-a, r); s.absarc(-a, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: true, bevelThickness: .0008, bevelSize: .0005, bevelSegments: 2, curveSegments: 6 });
  g.rotateY(Math.PI / 2);                                    // 挤出方向 → +X
  return g;
}
function stack(geo, mat) {
  const gr = new THREE.Group();
  for (let j = 0; j < LAY; j++) { const m = new THREE.Mesh(geo, mat); m.position.set(0, LT / 2 + j * LT * .96, (j % 2 ? 1 : -1) * .0022); m.castShadow = m.receiveShadow = true; gr.add(m); }
  return gr;
}

// —— 切面刀：长方形薄刃（刃沿 Z），截面带 V 形刃口；刀背后端（近侧）一截铁颈 + 铁箍 + 木柄往师傅那边上翘。原点 = 刃口中点 ——
function knifeMesh() {
  const ck = C('knife'), g = new THREE.Group(), T = KB.T, s = new THREE.Shape();
  s.moveTo(-T / 2, .009); s.lineTo(0, 0); s.lineTo(T / 2, .009); s.lineTo(T / 2, KB.H); s.lineTo(-T / 2, KB.H); s.closePath();
  const bg = new THREE.ExtrudeGeometry(s, { depth: KB.L, bevelEnabled: false }); bg.translate(0, 0, -KB.L / 2);
  const blade = new THREE.Mesh(bg, toon(ck, { t: .05, hi: .7 })); blade.castShadow = blade.receiveShadow = true; g.add(blade);
  const deco = (pts, col) => {                              // 贴在刀面（-X 面）上的硬边色块
    const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col }));
    m.rotation.y = -Math.PI / 2; m.position.x = -T / 2 - .0004; m.material.userData.outlineParameters = { visible: false }; g.add(m); return m;
  };
  const Lh = KB.L / 2;
  g.userData.edge = deco([[-Lh + .004, .0035], [Lh - .004, .0035], [Lh - .004, .0085], [-Lh + .004, .0085]], HI);            // 刃口一道硬高光
  deco([[-.03, .07], [.035, .02], [.075, .02], [.01, .07]], mix(ck.f, HI, .55));                                              // 刀面一道斜的硬高光
  const wood = toon(C('pin'), { t: .05, hi: .9 }), iron = toon(ck, { t: .05 });
  // 铁颈接在刀身后端、顶面和刀背齐平，铁箍 + 木柄从这里往师傅那边上翘：整条刀背空出来给食指压（第 5 版：原来铁颈、铁箍骑在刀背上，食指放不平）
  const neck = new THREE.Mesh(new THREE.BoxGeometry(T * 2.2, .02, .024), iron); neck.position.set(0, KB.H - .011, Lh + .004); g.add(neck);
  const base = V3(0, KB.H - .012, Lh + .012), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), HW);
  const fe = new THREE.Mesh(new THREE.CylinderGeometry(.0145, .0145, .018, 24), iron); fe.position.copy(base).addScaledVector(HW, .009); fe.quaternion.copy(q); g.add(fe);
  const hd = new THREE.Mesh(new THREE.CylinderGeometry(.0125, .0135, HL, 24), wood); hd.position.copy(base).addScaledVector(HW, .018 + HL / 2); hd.quaternion.copy(q); g.add(hd);
  for (const m of [neck, fe, hd]) m.castShadow = m.receiveShadow = true;
  g.userData.base = base;
  return g;
}

// —— 生面条一把：8 根有宽有厚的扁条（宽 7 mm、厚 2 mm），从捏点出来按扇形张开、往下垂，边垂边扭（宽面转过去时明暗跟着换）——
function bundleGeo(P, fan, amp, ph, seed, yMin) {
  const R = rng(seed), pos = [], idx = [], N = 22;
  for (let i = 0; i < 8; i++) {
    const a = (i - 3.5) / 3.5 * fan + (R() - .5) * .08, L = .14 + R() * .05, p0 = R() * TAU, zj = (R() - .5) * .25, tw = (R() - .5) * 2.4;
    const C0 = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N, sx = Math.sin(a) * L * .55 * (1 - Math.exp(-3 * u)) + amp * u * Math.sin(u * 7 + p0 + ph);
      C0.push(V3(P.x + sx + (i - 3.5) * .002, Math.max(yMin, P.y - L * u * Math.cos(a * .6)), P.z + zj * L * u * .4 + amp * .5 * u * Math.cos(u * 5 + p0 + ph)));
    }
    for (let k = 0; k <= N; k++) {
      const T = C0[Math.min(N, k + 1)].clone().sub(C0[Math.max(0, k - 1)]).normalize(), th = tw * k / N + (i % 2) * .5;
      let B = new THREE.Vector3().crossVectors(T, V3(0, 0, 1)).normalize(); const Nn = new THREE.Vector3().crossVectors(B, T);
      B = B.clone().multiplyScalar(Math.cos(th)).addScaledVector(Nn, Math.sin(th)); const Nm = new THREE.Vector3().crossVectors(B, T);
      const w = .0035 * (k === 0 ? .6 : 1), t = .001, c = C0[k];
      const cs = [[w, t], [-w, t], [-w, -t], [w, -t]].map(([u, v]) => c.clone().addScaledVector(B, u).addScaledVector(Nm, v));
      for (let f = 0; f < 4; f++) { const a0 = cs[f], b0 = cs[(f + 1) % 4]; pos.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z); }
    }
    const base = i * (N + 1) * 8;
    for (let k = 0; k < N; k++) for (let f = 0; f < 4; f++) {
      const a0 = base + k * 8 + f * 2, b0 = a0 + 8;
      idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// —— 手框朝向：Y = 手背朝向、Z = 往手腕的方向（世界坐标），X = Y × Z（hand3d 的手框约定）——
function orient(o, Y, Z) {
  const z = Z.clone().normalize(), y = Y.clone().addScaledVector(z, -Y.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const wp = (H, n) => { const v = new THREE.Vector3(); H.root.updateMatrixWorld(true); H.B[n].getWorldPosition(v); return v; };
// 两向对齐：把手框里的方向 d（主）、n（副）转到世界里的 D、N
function align(o, d, n, D, N) {
  const B = (a, b) => { const x = a.clone().normalize(), z = new THREE.Vector3().crossVectors(x, b).normalize(); return new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z); };
  o.quaternion.setFromRotationMatrix(B(D, N).multiply(B(d, n).transpose()));
}
// 右手握刀（食指压刀背）：在刀的局部系里摆——食指方向 → 刀身 -Z 略往下压、手背朝右上；食指末节关节压在刀背顶上（刀背 y = KB.H）。
//   中指、无名指、小指包住木柄，拇指捏在刀面左侧（-X）。刀怎么转，手跟着转（放刀时用）
function gripKnife(H, K) {
  H.pose(POSE.grip); H.root.position.set(0, 0, 0); H.root.quaternion.identity();
  const i0 = wp(H, 'index-finger-phalanx-proximal'), i1 = wp(H, 'index-finger-tip');
  align(H.root, i1.sub(i0), V3(0, 1, 0), V3(-.03, -.05, -1), V3(.68, .73, 0));
  K.updateMatrixWorld(true); H.root.quaternion.premultiply(K.quaternion);
  const dip = wp(H, 'index-finger-phalanx-distal');
  H.root.position.copy(V3(.001, KB.H + .0085, .07).applyMatrix4(K.matrixWorld)).sub(dip);
}
// 放刀：三张（lt 2.25 / 2.333 / 2.417，两拍一张）[x（null = 接最后一刀的位置往右）, y, z, 绕 Y, 绕 Z]：抬着往右移 → 侧过来 → 平放在右边台面（左面朝下）
const PUT = [[null, .09, -.004, .04, .45], [.24, .05, .012, .14, 1.05], [BX1 + .12, .0022, .03, .25, Math.PI / 2 - .1]];
const TR = 2.5, TP = 2.5 + 1 / 6;                            // 右手松手、捏起第二把面

// —— 师傅的两个肩（reachArm 用，世界坐标）：两肩相距 0.40，按 [lt, 两肩中点 x, y, z, 两肩连线绕 Y 转的角（°，正 = 右肩往后）] 分段线性插值。
//    机位差不多就在师傅头的位置往下看，所以切的时候两肩连线和机位的「右」方向平行（转 24°），肩高 0.35、压在画框下沿两角之外，
//    胳膊从下方两角进来；切的时候身体跟着刀往左挪 4 cm；放刀、捏面时直起一点、往右挪到两把面中间，转正到 10°。手离肩 0.40–0.54 m（够得着 0.594），肘一直有弯
const BODY = [[0, -.159, .35, .495, 24], [1.5, -.199, .35, .495, 24], [2.25, -.199, .35, .495, 24], [2.75, .08, .38, .56, 10], [3, .08, .38, .56, 10]];
function shoulders(lt) {
  let i = 0; while (i < BODY.length - 2 && lt >= BODY[i + 1][0]) i++;
  const [t0, ...a] = BODY[i], [t1, ...b] = BODY[i + 1], u = Math.min(1, Math.max(0, (lt - t0) / (t1 - t0)));
  const [x, y, z, yaw] = a.map((v, k) => v + (b[k] - v) * u), c = V3(x, y, z), r = V3(Math.cos(yaw * D2R), 0, Math.sin(yaw * D2R)).multiplyScalar(.2);
  return { L: c.clone().sub(r).toArray(), R: c.clone().add(r).toArray() };
}

// 手型（度）：[张开, 掌指关节弯, 中节弯, 末节弯]；拇指 [指根张开, 指根弯, 第二节弯, 末节弯]
const POSE = {
  grip: { thumb: [-24, 30, 30, 20], index: [-8, -22, 3, 2], middle: [-30, 80, 85, 40], ring: [-40, 78, 80, 36], pinky: [-50, 85, 90, 45] },   // 三指包柄（往小指侧张 30–50°：弯过去的中节、末节斜着绕到木柄下面、从机位那侧露出来）、食指压刀背、拇指收短贴在刀面后端
  claw: { thumb: [-26, 36, 26, 16], index: [20, 34, 88, 52], middle: [4, 20, 72, 36], ring: [-14, 12, 72, 36], pinky: [-28, 6, 78, 40] },   // 猫爪护手：掌指关节弯 + 中节弯 ≈ 90°（中节竖直），指尖收在下面，指间分开；拇指收在后面。第 6 版：四指张得更开；无名指、小指掌指关节少弯（指节往前够到刀面附近），食指多收（手横滚后指尖不扎进面）
  open: { thumb: [4, 8, 8, 6], index: [4, 16, 20, 10], middle: [1, 17, 22, 12], ring: [-4, 20, 26, 13], pinky: [-9, 24, 30, 14] },   // 松手：放下刀，五指自然微弯（接近 POSES3D.relaxed，食指不翘）
  pinch: { thumb: [28, 30, 22, 14], index: [10, 46, 34, 14], middle: [2, 52, 38, 16], ring: [-6, 74, 80, 42], pinky: [-12, 78, 78, 42] },   // 拇指和食指、中指捏住
};

let S = null;
function setup() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.03, 20), an = renderer().r.capabilities.getMaxAnisotropy();
  const bt = new THREE.CanvasTexture(boardTex()); bt.anisotropy = an;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(PWm, PDm), new THREE.MeshBasicMaterial({ map: bt }));
  board.rotation.x = -Math.PI / 2; board.position.set(PX0 + PWm / 2, 0, PZ0 + PDm / 2);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(PWm, PDm), new THREE.ShadowMaterial({ color: new THREE.Color(BG.warm.woodDark), opacity: .55 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(board.position.x, 0.0004, board.position.z); shade.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(PWm, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(wallTex()) }));
  wall.position.set(board.position.x, 0.45, PZ0);
  for (const m of [board, shade, wall]) { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; scene.add(m); }
  const dm = toon(C('dough'), { t: .1 }), nm = toon(C('dough'), { t: -.12 }), gS = slabGeo(NW - .0018);
  const slices = Array.from({ length: 30 }, () => { const s = stack(gS, dm); scene.add(s); return s; });
  const block = new THREE.Group(); scene.add(block);
  const knife = knifeMesh(); scene.add(knife);
  const hands = { L: makeHand('L'), R: makeHand('R') };
  for (const k of ['L', 'R']) scene.add(hands[k].root, hands[k].arm);
  const bun = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), nm); m.castShadow = m.receiveShadow = true; scene.add(m); return m; });
  sun(scene, [-0.65, 1.0, 0.05], 0.6, [0.03, 0.05, 0]);
  return (S = { scene, cam, dm, slices, block, bcache: {}, knife, hands, bun });
}
function setBlock(s, x0, x1) {                               // 没切的那一截：x0 → x1
  const key = (x1 - x0).toFixed(4);
  if (s.block.userData.key !== key) {
    s.block.clear(); s.bcache[key] ??= slabGeo(x1 - x0);
    s.block.add(stack(s.bcache[key], s.dm)); s.block.userData.key = key;
  }
  s.block.position.set(x0, 0, 0);
}

// —— 切：第 n 刀在 lt = n·0.375 落到台面（拍上）；k = 这一刀里的第几张（3-2-2-2）——
const KHT = [0, .042, .03, .012];
function cutState(lt) {
  const n = Math.min(5, Math.floor(lt / .375 + 1e-6)), f = Math.floor((lt - n * .375) * 24 + 1e-6), k = f < 3 ? 0 : f < 5 ? 1 : f < 7 ? 2 : 3;
  const cx = KX0 - NW * n, last = n === 5 && k > 0;
  return { n, k, cx, kx: k === 0 || last ? cx : cx - NW, h: last ? .045 + .02 * k : KHT[k] };
}

function camera(s, lt) {
  const az = -24 * D2R, el = 38 * D2R, d = 0.8, dir = V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const px = KX0 - 0.015 - NW * Math.min(lt, 2.25) / .375;
  let tg = V3(px, 0.035, 0.01), cp = tg.clone().addScaledVector(dir, d);
  if (lt >= 1.5) {
    const u = Math.min(1, (lt - 1.5) / .75), Z = lt < 2.25 ? 1 + .5 * u * u : 1.5 - .5 * ease((lt - 2.25) / .75);
    const A = V3(cutState(Math.min(lt, 2.2)).kx - .004, .012, .045);
    if (lt >= 2.25) {                                          // 拉回：取景从刀刃移到两把面条
      const v = ease((lt - 2.25) / .75), aN = -4 * D2R, eN = 44 * D2R, dN = V3(Math.sin(aN) * Math.cos(eN), Math.sin(eN), Math.cos(aN) * Math.cos(eN));
      const tN = V3(KX0 - 5 * NW + .095, .14, .03), cN = tN.clone().addScaledVector(dN, .8);
      tg.lerp(tN, v); cp.lerp(cN, v);
    }
    cp = A.clone().add(cp.clone().sub(A).divideScalar(Z)); tg = A.clone().add(tg.clone().sub(A).divideScalar(Z));
  }
  s.cam.position.copy(cp); s.cam.lookAt(tg);
}

export function draw(g, e, lt, A, t) {
  const s = setup(), { L: HLh, R: HRh } = s.hands, cutting = lt < 2.25;
  const cs = cutState(Math.min(lt, 2.2499)), nk = Math.min(2, Math.floor((lt - 2.25) / .25 + 1e-6));
  const cx = cs.cx, SH = shoulders(lt);
  setBlock(s, BX0, cx);
  const nS = Math.round((BX1 - cx) / NW);
  s.slices.forEach((sl, i) => {
    sl.visible = i < nS && (cutting || i >= 20 || (i >= 10 && lt < TP));   // 第二把面等右手放完刀再捏起
    const fresh = i === 0 && cs.k === 0 && cutting;
    sl.position.set(cx + i * NW + .0009 + (fresh ? KB.T * .6 : 0), 0, (hash(i * 3.7) - .5) * .003);
    sl.rotation.set(0, (hash(i * 1.3) - .5) * .03, fresh ? -.07 : (hash(i * 5.1) - .5) * .05);
  });
  const K = s.knife;
  if (cutting) {
    K.position.set(cs.kx - KB.T / 2, cs.h, KB.z); K.rotation.set(0, 0, 0);
    K.updateMatrixWorld(true);
    gripKnife(HRh, K); HRh.reachArm(SH.R);
    // 左手护手：指尖收进去按在面块顶上，第二指节贴着刀面（-X 面）；拇指在近侧；随刀往左退
    // 第 6 版：手背往机位那边横滚（拇指侧低、小指侧高）、手腕往外偏一点（小指侧靠近刀），指节一排斜着对镜头、错开成台阶，四根手指都分得清
    HLh.pose(POSE.claw); orient(HLh.root, V3(0.2, 1, 0.45), V3(-0.95, 0.12, -0.07));
    HLh.root.position.set(0, .05, .0);
    const pip = ['index', 'middle', 'ring'].map(f => wp(HLh, `${f}-finger-phalanx-intermediate`)), tip = wp(HLh, 'middle-finger-tip');
    const mx = Math.max(...pip.map(p => p.x));
    HLh.root.position.set(cs.kx - KB.T - .009 - mx, .05 + (TOP + .006 - tip.y), -.004 - pip[1].z * 0);
    HLh.reachArm(SH.L);
    for (const b of s.bun) b.visible = false;
  } else {
    // 左手先捏起第一把面抖开；右手握着刀往右放平（三张，两拍一张），2.5 松手，2.667 捏起第二把面跟上
    const ph = Math.floor(lt * 12) / 12 * 9, xs = [cx + .035, cx + .155];
    const pinchAt = (H, sd, i, k) => {                       // k = 第几张：0 捏住（低）、1 提起抖开、2 抖完
      const yk = [.12, .245, .225][k], fan = [.06, .36, .2][k], amp = [.012, .01, .004][k];
      const tc = Math.floor(lt * 12 + 1e-6) / 12, jig = [0, .008, .003][k] * Math.sin(tc * 6 * Math.PI + i * 1.7);   // 抖：12 fps 一张，左右小幅晃
      const P = V3(xs[i] + jig, yk + jig * .4, .05);
      H.pose(POSE.pinch); orient(H.root, V3(sd * .75, .6, .25), V3(sd * .4, .25, .88));
      H.root.position.set(0, 0, 0);
      const pm = wp(H, 'thumb-tip').add(wp(H, 'index-finger-tip')).multiplyScalar(.5);
      H.root.position.copy(P).add(V3(0, .006, 0)).sub(pm);
      H.reachArm(sd < 0 ? SH.L : SH.R);
      s.bun[i].visible = true; s.bun[i].geometry.dispose(); s.bun[i].geometry = bundleGeo(P, fan, amp, ph + i * 2, 11 + i * 12, .002);
    };
    pinchAt(HLh, -1, 0, nk);
    const d = Math.min(2, Math.floor((lt - 2.25) * 12 + 1e-6)), [px, py, pz, ry, rz] = PUT[d];
    K.position.set(px === null ? cx + .08 : px, py, pz); K.rotation.set(0, ry, rz);
    if (lt < TR) { gripKnife(HRh, K); if (d === 2) { HRh.pose(POSE.open); HRh.root.position.y += .012; } HRh.reachArm(SH.R); s.bun[1].visible = false; }
    else if (lt < TP) {                                       // 松开的手从刀上方挪到第二把面上方（两张）
      gripKnife(HRh, K); HRh.pose(POSE.open); HRh.root.position.y += .012;
      const a = HRh.root.position.clone(), qa = HRh.root.quaternion.clone();
      pinchAt(HRh, 1, 1, 0); HRh.pose(POSE.open); s.bun[1].visible = false;
      const u = lt < TR + 1 / 12 ? .4 : .75;
      HRh.root.position.lerpVectors(a, HRh.root.position.clone().add(V3(0, .03, 0)), u); HRh.root.quaternion.slerpQuaternions(qa, HRh.root.quaternion.clone(), u);
      HRh.reachArm(SH.R);
    } else pinchAt(HRh, 1, 1, lt < TP + 1 / 6 ? 0 : 1);
  }
  camera(s, lt);
  draw3d(g, e, s.scene, s.cam);
  if (cutting && e) {                                         // 刃口高光进发光板（推近时一道亮线）：借剪影那一遍留下的深度，只画没被手、面块挡住的那段
    const { r, c } = renderer(), ac = r.autoClear;
    K.userData.edge.layers.enable(1); s.cam.layers.set(1); s.scene.overrideMaterial = GLOW; r.autoClear = false;
    r.clearColor(); r.render(s.scene, s.cam);
    r.autoClear = ac; s.scene.overrideMaterial = null; s.cam.layers.set(0);
    e.drawImage(c, 0, 0);
  }
  if (!cutting) {                                             // 干粉按 24 帧落下（三维点投到屏幕上画）
    const fl = C('flour').f, dt = lt - 2.25;
    for (let i = 0; i < 36; i++) {
      const y = .2 - hash(i * 5.1) * .08 - dt * (.25 + .2 * hash(i));
      if (y < 0 || (i % 2 && lt < TP)) continue;
      const v = V3(cx + (i % 2 ? .155 : .035) + (hash(i * 2.3) - .5) * .08, y, .05 + (hash(i * 7.1) - .5) * .04).project(s.cam);
      g.fillStyle = rgba(fl, .9); g.beginPath(); g.arc((v.x + 1) * 960 + Math.sin(dt * 6 + i) * 4, (1 - v.y) * 540, 1 + 2 * hash(i * 9.7), 0, TAU); g.fill();
    }
  }
  return {};
}
