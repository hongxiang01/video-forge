// S4 —— 擀面 · 三渲二（TREATMENT §4 镜头表 S4、§4.4 面片、§5 9.00–12.00）。2D 版原样备份在 s4_2d.js，三渲二试点备份在 s4_pilot3d.js。
// 透视相机从师傅这一侧斜俯 50°，随面片长大往后拉（9.0–10.5，ease-out，面片在画里一直约 690 px 宽），10.5 起不动。
// 案板 = 贴木纹背景板的平面 + 只收投影的平面；面片 = 有厚度、边缘圆润的饼，越擀越大越薄：杖下压出浅槽、两边鼓出去，杖走过的那一侧更薄；
// 擀面杖压在面片上滚（杖底贴面片顶面，转角 = 走过的距离 / 半径）；双手按在杖上跟着走，前臂朝肩膀、肘部带弯（推得越远身子越往前探）。
// 一盏白色方向光（吊灯在左上），硬边投影，不加环境光。结尾杖停在面片近边，双手顺杖滑到两头握成拳（接 S5 开头）。
// 世界坐标（米）：X 向右，Y 向上，Z 朝镜头（师傅这一侧）；面片中心在原点，台面 y = 0。手和杖按 12 fps 换张，镜头每帧动。
import * as THREE from 'three';
import { path, line, mix, rgba, rng, hash, canvas, airbrush, TAU } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { toon, sun, draw3d, rgb, renderer } from '../lib3d.js';
import { makeHand, POSES3D } from '../hand3d.js';

const ease = u => 1 - (1 - u) * (1 - u);
const clamp01 = u => Math.min(1, Math.max(0, u));
const sig = x => 1 / (1 + Math.exp(-x));
const zoomAt = lt => lt < 1.5 ? 1.5 - 0.5 * ease(lt / 1.5) : 1;
const PIN = { r: 0.0225, L: 0.62 }, HANDX = 0.135, HX_END = 0.245, EDGE = '#FAF1DC', CAMD = 1.03;

// —— 背景板：台面（横向木板 + 木纹 + 结疤 + 暖灯光圈在左上 + 散落面粉），沿用 2D 版画法，范围放大到透视里看得到的整块台面 ——
const KP = 1500, PX0 = -1.1, PY1 = 1.1, PWm = 2.2, PHm = 1.9;            // 2D 世界：X 向右、Y 向远；3D 里 z = -Y
function plate() {
  const [c, x] = canvas(Math.round(PWm * KP), Math.round(PHm * KP)), w = c.width, h = c.height, B = BG.warm, R = rng(404);
  const toP = (X, Y) => [(X - PX0) * KP, (PY1 - Y) * KP];
  x.fillStyle = B.wood; x.fillRect(0, 0, w, h);
  const pw = 0.135 * KP;
  for (let i = 0, y0 = -0.05 * KP; y0 < h; i++, y0 += pw) {
    x.fillStyle = mix(B.wood, i % 2 ? '#6A3C20' : '#8A5634', .45); x.fillRect(0, y0, w, pw);
    const gc = mix(B.wood, B.grain, .55);
    for (let j = 0; j < 9; j++) {
      const yy = y0 + pw * (.08 + .84 * R()), pts = [];
      for (let xx = -40; xx < w + 80; xx += 160) pts.push([xx, yy + Math.sin(xx / (300 + 200 * R()) + j) * (4 + 6 * R())]);
      line(x, pts, gc, 1.4 + R() * 1.6);
    }
    const kx = w * R(), ky = y0 + pw * (.3 + .4 * R());
    for (let r = 3; r > 0; r--) { x.strokeStyle = gc; x.lineWidth = 2; x.beginPath(); x.ellipse(kx, ky, 18 * r + 6, 6 * r + 3, 0, 0, TAU); x.stroke(); }
    x.fillStyle = B.grain; x.beginPath(); x.ellipse(kx, ky, 9, 4, 0, 0, TAU); x.fill();
    x.fillStyle = B.grain; x.fillRect(0, y0 - 3, w, 6);
    x.fillStyle = mix(B.wood, '#C08A55', .45); x.fillRect(0, y0 + 3, w, 3);
  }
  const [hx, hy] = toP(-0.12, 0.06);
  airbrush(x, hx, hy, 0.78 * KP, 0.58 * KP, B.woodHalo, .8, .95);
  const gr = x.createRadialGradient(hx, hy, 0.3 * KP, hx, hy, 1.0 * KP);
  gr.addColorStop(0, rgba(B.woodDark, 0)); gr.addColorStop(1, rgba(B.woodDark, .85)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  const fl = C('flour').f;
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU, d = 0.26 + Math.pow(R(), 2.2) * 0.3, [px, py] = toP(Math.cos(a) * d * 1.15, Math.sin(a) * d * .9);
    const rr = (d < .32 && R() < .5 ? 10 + 18 * R() : 2 + 5 * R()), n = 7, pts = [];
    for (let k = 0; k < n; k++) { const b = k / n * TAU; pts.push([px + Math.cos(b) * rr * (.6 + .6 * R()), py + Math.sin(b) * rr * (.5 + .5 * R())]); }
    x.fillStyle = rr > 12 ? rgba(fl, .78) : fl; x.fill(path(pts));
  }
  for (let i = 0; i < 900; i++) {
    const a = R() * TAU, d = 0.22 + Math.pow(R(), 2) * 0.45, [px, py] = toP(Math.cos(a) * d * 1.2, Math.sin(a) * d * .85);
    x.fillStyle = rgba(fl, .5 + .5 * R()); x.beginPath(); x.arc(px, py, 1.5 + 3 * R(), 0, TAU); x.fill();
  }
  return c;
}

// —— 面片：车削出的圆饼（底平、边缘半圆、顶平），外圈 1.3 cm 薄边用 EDGE 色（顶点色 = EDGE / 面团亮色，比面团亮一档）。
//    杖下：压一道浅槽、杖前推起一道棱、轮廓往两边鼓；杖走过的那一侧（bs 指向）整体薄 k。位移后重算法线（槽和棱才有明暗）——
const ED = rgb(EDGE), DF = rgb(C('dough').f), EK = ED.map((v, i) => v / DF[i]);
function doughGeo(Rr, h, zp, press, push, bs, k) {
  const re = h / 2, rb = Rr - 0.013, N = 36, pts = [[1e-4, 0], [Rr - re, 0]], col = [1, 1];
  for (let i = 1; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI; pts.push([Rr - re + Math.cos(a) * re, re + Math.sin(a) * re]); col.push(1); }
  pts.push([Rr - re, h], [(Rr - re + rb) / 2, h], [rb, h]); col.push(1, 1, 1);
  for (let i = 0; i <= N; i++) { pts.push([Math.max(1e-4, rb * (1 - i / N)), h]); col.push(0); }   // 先重复一次 rb：薄边和面心的颜色在这里硬切
  const geo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 200), P = geo.attributes.position, n = pts.length;
  const cs = new Float32Array(P.count * 3), bulge = 0.13 + 0.07 * push;               // 鼓出的量要超过手掌外缘，才看得见
  for (let i = 0; i < P.count; i++) {
    const j = i % n; cs.set(col[j] ? EK : [1, 1, 1], i * 3);
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const fr = 1 + push * 0.03 * Math.max(0, -z / Rr) ** 2;                                     // 推的时候远侧前沿略鼓
    const under = Math.exp(-(((z - zp) / 0.058) ** 2)), back = bs ? sig((z - zp) * bs / 0.01) : 0;
    x *= fr * (1 + bulge * under + 0.04 * back * Math.exp(-(((z - zp) / 0.14) ** 2)));      // 杖下的面片被压得往两边鼓，刚走过的一侧摊开略宽
    z *= fr;
    y *= 1 - k * back;                                                                         // 杖走过的一侧更薄
    if (y > h * .5) y += -press * Math.exp(-(((z - zp) / 0.026) ** 2)) + 0.6 * press * Math.exp(-(((z - zp + (bs || 1) * 0.036) / 0.016) ** 2));
    P.setXYZ(i, x, y, z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
  geo.computeVertexNormals();
  return geo;
}

// —— 擀面杖：车削（两头圆角），沿杖身三道木纹 + 一个小结疤 → 滚起来看得出在转；受光面顶上一条硬边高光 ——
function pinTex() {
  const [c, x] = canvas(512, 8), cp = C('pin'), F = rgb(cp.f), G = rgb(mix(cp.f, cp.l, .62)), K = G.map((v, i) => Math.round(255 * v / F[i]));
  x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 8);
  x.fillStyle = `rgb(${K.join(',')})`;
  for (const [u, w] of [[40, 16], [70, 6], [230, 20], [380, 10], [400, 6]]) x.fillRect(u, 0, w, 8);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}
function pinMesh() {
  const { r, L } = PIN, rc = r * .55, pts = [new THREE.Vector2(1e-4, -L / 2)];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, -L / 2 + rc + Math.sin(a) * rc)); }
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, L / 2 - rc + Math.sin(a) * rc)); }
  pts.push(new THREE.Vector2(1e-4, L / 2));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), toon(C('pin'), { t: .05, hi: .9, map: pinTex() }));
  m.rotation.z = -Math.PI / 2; m.castShadow = m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}

// —— 手型（度）：推 = 四指放松几乎伸直搭过杖；拉回 mid 略弯；歇 rest 四指松下来往回收；结尾 fist = 握住杖头（hand3d 的 grip 按杖半径算 + 拇指扣上来）——
// 第 6 版（防穿模，量过蒙皮后的网格顶点离杖轴的距离）：手整体往近侧挪 DZ，杖压在四指根部下面，大鱼际落在杖的近侧；
//   拇指往食指那边收、抬平，搭在杖顶近侧（原来拇指沉在掌面下 2 cm，整根穿进杖里）。LIFT = 各手型掌面离杖顶的微调（米）
const POSE = {
  push: { thumb: [-26, 6, -4, 8], index: [8, 10, 9, 4], middle: [1, 11, 10, 5], ring: [-6, 12, 11, 5], pinky: [-14, 14, 12, 5] },
  mid: { thumb: [-26, 6, -4, 8], index: [6, 16, 15, 8], middle: [0, 17, 16, 8], ring: [-5, 18, 17, 8], pinky: [-11, 20, 17, 8] },
  rest: { thumb: [-26, 6, -4, 8], index: [4, 24, 24, 14], middle: [0, 25, 25, 14], ring: [-3, 22, 25, 14], pinky: [-8, 16, 24, 13] },
  fist: { ...POSES3D.grip(PIN.r), thumb: [-16, 40, 34, 24] },
};
const PITCH = { push: 8, mid: 4, rest: 2, fist: 16 }, DZ = 0.02, LIFT = { push: [0.0004, 0], mid: [0.0026, 0.0003], rest: [0.003, 0.0003] };   // [左, 右]：左手模型的拇指和小指比右手低 2–3 mm

let S = null;
function setup() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 20);
  const tex = new THREE.CanvasTexture(plate()); tex.anisotropy = renderer().r.capabilities.getMaxAnisotropy();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(PWm, PHm), new THREE.MeshBasicMaterial({ map: tex }));
  board.rotation.x = -Math.PI / 2; board.position.set(PX0 + PWm / 2, 0, -(PY1 - PHm / 2));
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(PWm, PHm), new THREE.ShadowMaterial({ color: new THREE.Color(BG.warm.woodDark), opacity: .55 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(board.position.x, 0.0004, board.position.z); shade.receiveShadow = true;
  for (const m of [board, shade]) { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; }
  const dmat = toon(C('dough'), { t: .1 }); dmat.vertexColors = true;
  const dough = new THREE.Mesh(new THREE.BufferGeometry(), dmat); dough.castShadow = dough.receiveShadow = true;
  const pin = pinMesh();
  const fr = rng(77), specks = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 7), toon(C('flour'), { line: false }), 46);
  specks.userData.uv = Array.from({ length: 46 }, () => { const a = fr() * TAU, d = Math.sqrt(fr()) * .86; return [Math.cos(a) * d, Math.sin(a) * d, (1.2 + fr() * 2.6) * 0.0011]; });
  specks.receiveShadow = true; scene.add(specks);
  const hands = { L: makeHand('L'), R: makeHand('R') };
  scene.add(board, shade, dough, pin);
  // 投影替身：手腕截口、细的腕部皮肤圆柱、袖口、袖子各自平头，斜着投到面片上叠成锯齿台阶 → 袖子各段不投影，
  // 改由两节顺滑的胶囊（前臂、上臂，跟 aimArm 的肘弯同一个折点）只在投影里出现：不画颜色、不写深度、不描边、不进剪影
  const pmat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); pmat.userData.outlineParameters = { visible: false };
  for (const k of ['L', 'R']) {
    scene.add(hands[k].root, hands[k].arm);
    hands[k].arm.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const fore = new THREE.LatheGeometry([[1e-4, -0.014], [0.02, -0.008], [0.027, 0.004], [0.034, 0.03], [0.042, 0.055], [0.046, 0.12], [0.049, 0.25], [0.05, 0.3], [0.03, 0.34], [1e-4, 0.35]].map(p => new THREE.Vector2(...p)), 40);   // 腕 → 肘 30 cm，腕部细、袖口起变粗
    hands[k].px = [fore, new THREE.CapsuleGeometry(0.052, 0.5, 8, 32)].map(gm => { const m = new THREE.Mesh(gm, pmat); m.castShadow = true; m.userData.bg = true; scene.add(m); return m; });
  }
  const L = sun(scene, [-0.55, 1.0, -0.6], 0.7, [0, 0, 0.05]);
  return (S = { scene, cam, dough, pin, hands, specks, L });
}

// —— 动作（tc = 按 12 fps 取整的镜头内秒数），同 2D 版的节拍：z = 杖在面片上的前后位置（+ = 近）；bs = 杖走过的一侧（+1 = 近侧）——
function act(tc) {
  if (tc < 1.5) {
    const R = 0.225 / zoomAt(tc), p = (tc / 0.75) % 1;
    return { R, z: 0.5 * R * Math.cos(TAU * p), pose: p < .5 ? 'push' : 'mid', push: Math.sin(Math.PI * Math.min(1, p * 2)) * (p < .5), bs: p < .5 ? 1 : -1, reach: (1 - Math.cos(TAU * p)) / 2 };
  }
  const R = 0.225, A = 0.5 * R;
  if (tc < 1.59) return { R, z: A, pose: 'mid', bs: -1 };
  if (tc < 2.25) return { R, z: A, pose: 'rest', bs: -1 };
  if (tc < 2.41) return { R, z: A, pose: 'push', press: 1, bs: -1 };                // 手腕先压（预备），两张
  const u = clamp01((tc - 2.4167) / 0.4167), zf = -0.42 * R, ze = 0.9 * R;          // 最后一下：推出去、拉回到面片近边停住（5 张）
  const z = u < .5 ? A + (zf - A) * ease(u / .5) : zf + (ze - zf) * ease((u - .5) / .5);
  const out = clamp01((tc - 2.75) / 0.1667);                                          // 杖快停时双手顺着杖往两头滑，最后一张握成拳（接 S5 拳头握在杖两端）
  const pose = out >= 1 ? 'fist' : u < .5 ? 'push' : u < 1 ? 'mid' : 'rest';
  return { R: R + 0.01 * u, z, pose, push: u < .5 ? Math.sin(Math.PI * u * 2) : 0, hx: HANDX + (HX_END - HANDX) * ease(out), out, bs: u < .5 ? 1 : -1, reach: clamp01((A - z) / (A - zf)) };
}

// 空中飘的面粉（2D 叠在最上面）：每帧都动（歇的那一拍画面里只有它在动）
function motes(g, lt) {
  const fl = C('flour').f;
  for (let i = 0; i < 16; i++) {
    const sp = 14 + 26 * hash(i + 9), x = (hash(i * 3.1) * 2100 + lt * sp * (.5 + hash(i * 7.7))) % 2100 - 90;
    const y = (hash(i * 7.7 + 1) * 1000 + lt * sp * 1.2) % 1000 - 40 + Math.sin(lt * 1.3 + i) * 6;
    g.fillStyle = rgba(fl, .9); g.beginPath(); g.arc(x, y, 1.5 + 2.5 * hash(i * 1.9), 0, TAU); g.fill();
  }
}

export function draw(g, e, lt, A, t) {
  const s = setup();
  const tc = Math.floor(lt * 12 + 1e-6) / 12, P = act(tc);
  const h = 0.018 * (0.15 / P.R) ** 2, press = h * (P.press ? .4 : .18 + .18 * (P.push || 0)), k = 0.4;
  s.dough.geometry.dispose(); s.dough.geometry = doughGeo(P.R, h, P.z, press, P.push || 0, P.bs || 0, k);
  const py = h * (1 - k / 2) - press + PIN.r, mo = new THREE.Object3D();
  s.specks.userData.uv.forEach(([u, v, r], i) => {
    const z = v * P.R, th = 1 - k * (P.bs ? sig((z - P.z) * P.bs / 0.01) : 0);
    mo.position.set(u * P.R, h * th + 0.0004 - press * Math.exp(-(((z - P.z) / 0.026) ** 2)), z); mo.rotation.set(-Math.PI / 2, 0, 0); mo.scale.setScalar(r * P.R / 0.15);
    mo.updateMatrix(); s.specks.setMatrixAt(i, mo.matrix);
  });
  s.specks.instanceMatrix.needsUpdate = true;
  s.pin.position.set(0, py, P.z); s.pin.rotation.x = P.z / PIN.r;                  // 滚动不打滑：转角 = 位移 / 半径
  const rc = P.reach ?? 0, ot = P.out ?? 0;
  for (const [kk, sd] of [['L', -1], ['R', 1]]) {
    const H = s.hands[kk], pz = PITCH[P.pose] + (P.press ? 6 : 0);
    H.pose(POSE[P.pose]);
    H.root.position.set(sd * (P.hx ?? HANDX), py + PIN.r + 0.001 + (LIFT[P.pose] || [0, 0])[sd < 0 ? 0 : 1], P.z + DZ);
    H.root.rotation.set(pz * Math.PI / 180, sd * (12 - 6 * ot) * Math.PI / 180, 0, 'YXZ');
    // 前臂从画面下角进；肘部（离腕 30 cm）往上弯，推得越远身子越往前探、肘弯越大 → 上臂朝镜头抬起、很快出画，不再是一整根长管子
    const dir = new THREE.Vector3(sd * (0.40 - 0.12 * rc + 0.22 * ot), 0.30, 0.86).normalize(), elb = 22 + 4 * rc, Y = new THREE.Vector3(0, 1, 0);   // 推远时两臂收拢、更朝身前 → 上臂仍从下角出画
    H.aimArm(dir.toArray(), elb);
    const W = H.arm.position, up = Y.clone().addScaledVector(dir, -dir.y).normalize();
    const u2 = dir.clone().multiplyScalar(Math.cos(elb * Math.PI / 180)).addScaledVector(up, Math.sin(elb * Math.PI / 180));
    const E = W.clone().addScaledVector(dir, 0.30);
    H.px[0].position.copy(W); H.px[0].quaternion.setFromUnitVectors(Y, dir);                       // 前臂替身：从腕往肘
    H.px[1].position.copy(E).addScaledVector(u2, 0.25); H.px[1].quaternion.setFromUnitVectors(Y, u2);   // 上臂替身：肘往肩，半球头盖住肘弯
  }
  const d = CAMD / zoomAt(lt), el = 50 * Math.PI / 180, tg = [0, 0.02, 0.03];
  s.cam.position.set(tg[0], tg[1] + d * Math.sin(el), tg[2] + d * Math.cos(el)); s.cam.lookAt(...tg);
  draw3d(g, e, s.scene, s.cam);
  motes(g, lt);
  return {};
}
