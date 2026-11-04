// S4 —— 擀面 · 三渲二试点（TREATMENT §4 镜头表 S4、§4.4 面片、§5 9.00–12.00）。2D 版原样备份在 s4_2d.js。
// 透视相机从师傅这一侧斜俯 50°，随面片长大往后拉（9.0–10.5，ease-out，面片在画里约一样大），10.5 起不动。
// 案板 = 贴木纹背景板的平面 + 只收投影的平面；面片 = 有厚度、边缘圆润的饼，越擀越大越薄，杖下压出浅槽；擀面杖压在面片上滚
// （杖底贴面片顶面，转角 = 走过的距离 / 半径）；双手按在杖上跟着走。一盏白色方向光（吊灯在左上），硬边投影，不加环境光。
// 世界坐标（米）：X 向右，Y 向上，Z 朝镜头（师傅这一侧）；面片中心在原点，台面 y = 0。手和杖按 12 fps 换张，镜头每帧动。
import * as THREE from 'three';
import { path, line, mix, rgba, rng, hash, canvas, airbrush, TAU } from '../lib/cel.js';
import { C, BG } from '../pal.js';
import { toon, sun, draw3d, rgb, renderer } from '../lib3d.js';
import { makeHand } from '../hand3d.js';

const ease = u => 1 - (1 - u) * (1 - u);
const zoomAt = lt => lt < 1.5 ? 1.5 - 0.5 * ease(lt / 1.5) : 1;
const PIN = { r: 0.0225, L: 0.62 }, HANDX = 0.165, EDGE = '#F2E4C8';

// —— 背景板：台面（横向木板 + 木纹 + 结疤 + 暖灯光圈在左上 + 散落面粉），沿用 2D 版画法，范围放大到透视里看得到的整块台面 ——
const KP = 1500, PX0 = -1.0, PY1 = 1.0, PWm = 2.0, PHm = 1.7;            // 2D 世界：X 向右、Y 向远；3D 里 z = -Y
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
    const a = R() * TAU, d = 0.24 + Math.pow(R(), 2.2) * 0.3, [px, py] = toP(Math.cos(a) * d * 1.15, Math.sin(a) * d * .9);
    const rr = (d < .3 && R() < .5 ? 10 + 18 * R() : 2 + 5 * R()), n = 7, pts = [];
    for (let k = 0; k < n; k++) { const b = k / n * TAU; pts.push([px + Math.cos(b) * rr * (.6 + .6 * R()), py + Math.sin(b) * rr * (.5 + .5 * R())]); }
    x.fillStyle = rr > 12 ? rgba(fl, .78) : fl; x.fill(path(pts));
  }
  for (let i = 0; i < 900; i++) {
    const a = R() * TAU, d = 0.2 + Math.pow(R(), 2) * 0.45, [px, py] = toP(Math.cos(a) * d * 1.2, Math.sin(a) * d * .85);
    x.fillStyle = rgba(fl, .5 + .5 * R()); x.beginPath(); x.arc(px, py, 1.5 + 3 * R(), 0, TAU); x.fill();
  }
  return c;
}

// —— 面片：车削出的圆饼（底平、边缘半圆、顶平），外圈 1.3 cm 薄边用 EDGE 色（顶点色 = EDGE / 面团亮色）；杖下压一道浅槽，推的方向前沿略鼓 ——
const ED = rgb(EDGE), DF = rgb(C('dough').f), EK = ED.map((v, i) => v / DF[i]);
function doughGeo(Rr, h, zp, press, push) {
  const re = h / 2, rb = Rr - 0.013, N = 28, pts = [[1e-4, 0], [Rr - re, 0]], col = [1, 1];
  for (let i = 1; i < 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI; pts.push([Rr - re + Math.cos(a) * re, re + Math.sin(a) * re]); col.push(1); }
  pts.push([Rr - re, h], [(Rr - re + rb) / 2, h], [rb, h]); col.push(1, 1, 1);
  for (let i = 0; i <= N; i++) { pts.push([Math.max(1e-4, rb * (1 - i / N)), h]); col.push(0); }   // 先重复一次 rb：薄边和面心的颜色在这里硬切
  const geo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 180), P = geo.attributes.position, n = pts.length;
  const cs = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const j = i % n, k = col[j] ? EK : [1, 1, 1]; cs.set(k, i * 3);
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const bul = 1 + push * 0.025 * Math.max(0, -z / Rr) ** 2;                                    // 推的时候远侧前沿略鼓
    x *= bul; z *= bul;
    if (y > h * .7) y += -press * Math.exp(-(((z - zp) / 0.024) ** 2)) + 0.45 * press * Math.exp(-(((z - zp + 0.034) / 0.014) ** 2));   // 杖下的浅槽 + 杖前推起的一道棱
    P.setXYZ(i, x, y, z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
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

// —— 手型（度）：[张开（正 = 往拇指那边）, 掌指关节弯, 中节弯, 末节弯]；拇指 [指根张开, 指根弯, 第二节弯, 末节弯] ——
const POSE = {
  push: { thumb: [0, 12, 8, 4], index: [6, 18, 14, 6], middle: [0, 20, 15, 7], ring: [-5, 21, 16, 7], pinky: [-11, 23, 16, 6] },
  mid: { thumb: [0, 14, 10, 6], index: [5, 26, 22, 10], middle: [0, 28, 24, 12], ring: [-4, 29, 24, 12], pinky: [-9, 31, 22, 10] },
  rest: { thumb: [0, 16, 12, 8], index: [3, 38, 32, 16], middle: [0, 40, 34, 18], ring: [-2, 40, 34, 18], pinky: [-6, 42, 32, 16] },
};
const PITCH = { push: 12, mid: 6, rest: 3 };

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
  for (const k of ['L', 'R']) scene.add(hands[k].root, hands[k].arm);
  sun(scene, [-0.55, 1.0, -0.6], 0.7, [0, 0, 0.05]);
  return (S = { scene, cam, dough, pin, hands, specks });
}

// —— 动作（tc = 按 12 fps 取整的镜头内秒数），同 2D 版的节拍：z = 杖在面片上的前后位置（+ = 近）——
function act(tc) {
  if (tc < 1.5) { const R = 0.225 / zoomAt(tc), p = (tc / 0.75) % 1; return { R, z: 0.5 * R * Math.cos(TAU * p), pose: p < .5 ? 'push' : 'mid', push: Math.sin(Math.PI * Math.min(1, p * 2)) * (p < .5) }; }
  const R = 0.225, A = 0.5 * R;
  if (tc < 1.59) return { R, z: A, pose: 'mid' };
  if (tc < 2.25) return { R, z: A, pose: 'rest' };
  if (tc < 2.42) return { R, z: A, pose: 'push', press: 1 };                      // 手腕先压（预备）
  const u = Math.min(1, (tc - 2.42) / 0.42), zf = -0.42 * R, ze = 0.9 * R;        // 最后一下：推出去、拉回到面片近边停住
  const z = u < .5 ? A + (zf - A) * ease(u / .5) : zf + (ze - zf) * ease((u - .5) / .5);
  const out = Math.min(1, Math.max(0, (tc - 2.84) / .16));                        // 杖停住后双手顺着杖往两头滑（接 S5 握在杖两端）
  return { R: R + 0.01 * u, z, pose: u < .5 ? 'push' : u < 1 ? 'mid' : 'rest', push: u < .5 ? Math.sin(Math.PI * u * 2) : 0, hx: HANDX + 0.095 * ease(out) };
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
  const s = setup(), tc = Math.floor(lt * 12 + 1e-6) / 12, P = act(tc);
  const h = 0.013 * (0.15 / P.R) ** 2, press = h * (P.press ? .45 : .2 + .2 * (P.push || 0));
  s.dough.geometry.dispose(); s.dough.geometry = doughGeo(P.R, h, P.z, press, P.push || 0);
  const py = h - press + PIN.r, mo = new THREE.Object3D();
  s.specks.userData.uv.forEach(([u, v, r], i) => {
    const z = v * P.R; mo.position.set(u * P.R, h + 0.0004 - press * Math.exp(-(((z - P.z) / 0.024) ** 2)), z); mo.rotation.set(-Math.PI / 2, 0, 0); mo.scale.setScalar(r * P.R / 0.15);
    mo.updateMatrix(); s.specks.setMatrixAt(i, mo.matrix);
  });
  s.specks.instanceMatrix.needsUpdate = true;
  s.pin.position.set(0, py, P.z); s.pin.rotation.x = P.z / PIN.r;                  // 滚动不打滑：转角 = 位移 / 半径
  for (const [k, sd] of [['L', -1], ['R', 1]]) {
    const H = s.hands[k], pz = PITCH[P.pose] + (P.press ? 6 : 0);
    H.pose(POSE[P.pose]);
    H.root.position.set(sd * (P.hx ?? HANDX), py + PIN.r + 0.001, P.z);
    H.root.rotation.set(pz * Math.PI / 180, sd * 12 * Math.PI / 180, 0, 'YXZ');
    H.aimArm([sd * 0.42, 0.3, 0.86]);
  }
  const d = 1.05 / zoomAt(lt), el = 50 * Math.PI / 180, tg = [0, 0.02, 0.02];
  s.cam.position.set(tg[0], tg[1] + d * Math.sin(el), tg[2] + d * Math.cos(el)); s.cam.lookAt(...tg);
  draw3d(g, e, s.scene, s.cam);
  motes(g, lt);
  return {};
}
