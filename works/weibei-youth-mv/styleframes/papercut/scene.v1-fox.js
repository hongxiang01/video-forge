// 风格帧 A：2.5D 动态剪纸 —— 傍晚学校自行车棚，Q 版少年单脚跳过粉笔格子（5 秒）
// 纸层真实摆在三维空间里（ExtrudeGeometry 0.012 厚 + 纸纹 bump），定向光投出层间阴影；人物是关节剪纸人偶，动作一拍二（12 次/秒）。
// window.renderAt(秒) 逐帧确定渲染；不用 Math.random / Date。
import * as THREE from 'three';

const W = 1920, H = 1080;
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---------- 确定性随机 ----------
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---------- 纸纹 ----------
function paperCanvas(seed, size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = '#f4efe6'; g.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < 2600; i++) { // 纤维
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 4 + r() * 22;
    g.strokeStyle = `rgba(${r() < .5 ? '90,70,50' : '255,255,255'},${0.05 + r() * 0.08})`; g.lineWidth = 0.6 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 260; i++) { // 斑
    const x = r() * size, y = r() * size, rad = 10 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(120,95,70,${0.025 + r() * 0.03})`); gr.addColorStop(1, 'rgba(120,95,70,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}
const PAPER = new THREE.CanvasTexture(paperCanvas(7)); PAPER.wrapS = PAPER.wrapT = THREE.RepeatWrapping; PAPER.repeat.set(1.2, 1.2); PAPER.colorSpace = THREE.SRGBColorSpace;
const BUMP = new THREE.CanvasTexture(paperCanvas(11)); BUMP.wrapS = BUMP.wrapT = THREE.RepeatWrapping; BUMP.repeat.set(1.6, 1.6);

const matCache = {};
function paperMat(color, opt = {}) {
  const k = color + JSON.stringify(opt);
  if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({color, map: PAPER, bumpMap: BUMP, bumpScale: 2.2, roughness: 0.93, metalness: 0, ...opt});
  return matCache[k];
}

// ---------- 剪纸形状 ----------
// 手剪的轮廓：沿边加一点抖动
function jag(pts, amp, seed) { return pts.map((p, i) => new THREE.Vector2(p.x + (hash(seed + i * 1.7) - .5) * amp, p.y + (hash(seed + i * 2.3 + 9) - .5) * amp)); }
function shapeFrom(pts, amp = 0.006, seed = 1) { return new THREE.Shape(jag(pts.map(p => new THREE.Vector2(p[0] ?? p.x, p[1] ?? p.y)), amp, seed)); }
function ellipsePts(cx, cy, rx, ry, n = 40, a0 = 0, a1 = Math.PI * 2) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; }
function rrPts(x, y, w, h, r, n = 6) { // 左下角 x,y
  const o = []; const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a] of c) for (let i = 0; i <= n; i++) { const t = a + (Math.PI / 2) * i / n; o.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
  return o;
}
function holePath(pts, amp = 0.004, seed = 3) { return new THREE.Path(jag(pts.map(p => new THREE.Vector2(p[0], p[1])), amp, seed)); }
let SEED = 100;
function piece(shape, color, {z = 0, depth = 0.012, cast = true, recv = true, mat} = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 24});
  const m = new THREE.Mesh(geo, mat || paperMat(color)); m.position.z = z; m.castShadow = cast; m.receiveShadow = recv; return m;
}
const P = (pts, color, o = {}) => piece(shapeFrom(pts, o.amp ?? 0.006, SEED++), color, o);
// 两端圆头的肢体（从 0,0 往下长 len），用于关节
function limbPts(len, w1, w2) { return [...ellipsePts(0, 0, w1 / 2, w1 / 2, 12, 0, Math.PI), ...ellipsePts(0, -len, w2 / 2, w2 / 2, 12, Math.PI, Math.PI * 2)]; }

// ---------- 场景 ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
scene.add(camera);

// 天空：纸板渐变
{
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#4d4f86'); gr.addColorStop(0.42, '#a07aa0'); gr.addColorStop(0.68, '#f0a46a'); gr.addColorStop(0.86, '#f8cf8e'); gr.addColorStop(1, '#f8dfae');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshBasicMaterial({map: t}));
  sky.position.set(0, 4.2, -10); scene.add(sky);
  // 纸太阳：半沉在远楼后
  const sun = P(ellipsePts(0, 0, 0.9, 0.9, 48), '#ffd9a0', {z: 0, cast: false, mat: new THREE.MeshBasicMaterial({color: '#ffe2b0'})});
  sun.position.set(-3.6, 2.4, -9.5); scene.add(sun);
}

// 暖光板：放在有窗洞的纸层后面，灯光从洞里透出来
function glowBoard(x, y, z, w, h, color = '#ffc56e') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color, toneMapped: false})); m.position.set(x, y, z); scene.add(m); return m;
}

// 远处小城剪影（带小窗洞）
{
  const r = rng(21); const pts = [[-14, -0.5]]; let x = -14;
  while (x < 14) { const w = 0.6 + r() * 1.3, h = 0.9 + r() * 1.6; pts.push([x, h], [x + w, h]); if (r() < .25) pts.push([x + w, h + 0.5], [x + w + 0.12, h + 0.5], [x + w + 0.12, h]); x += w; }
  pts.push([14, -0.5]);
  const s = shapeFrom(pts, 0.01, 5);
  for (let i = 0; i < 70; i++) { const wx = -13 + r() * 26, wy = 0.2 + r() * 1.1; if (r() < .55) s.holes.push(holePath(rrPts(wx, wy, 0.12, 0.16, 0.02, 2), 0.004, i)); }
  const m = piece(s, '#7d6a8c'); m.position.set(0, 0.4, -7.5); scene.add(m);
  glowBoard(0, 1.4, -7.62, 30, 2.6, '#ffbe6a');
}

// 电线杆和电线
function pole(x, z, h) {
  const g = new THREE.Group();
  g.add(P(rrPts(-0.06, 0, 0.12, h, 0.03, 2), '#4a4058', {z: 0}));
  g.add(P(rrPts(-0.5, h - 0.35, 1.0, 0.07, 0.02, 2), '#4a4058', {z: 0.013}));
  g.add(P(rrPts(-0.35, h - 0.62, 0.7, 0.06, 0.02, 2), '#4a4058', {z: 0.013}));
  g.position.set(x, 0, z); scene.add(g); return g;
}
const poles = [pole(-5.2, -5.8, 4.6), pole(1.8, -5.8, 4.4), pole(8.5, -5.8, 4.6)];
function wire(x0, y0, x1, y1, sag, z) {
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * Math.sin(Math.PI * t), z)); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.012, 5), paperMat('#3e3549')); m.castShadow = true; scene.add(m);
}
for (const [a, b] of [[-5.2, 1.8], [1.8, 8.5], [-12, -5.2]]) { wire(a - 0.45, 4.27, b - 0.45, 4.07 + (b === 8.5 ? 0.2 : 0), 0.35, -5.75); wire(a + 0.45, 4.27, b + 0.45, 4.07 + (b === 8.5 ? 0.2 : 0), 0.3, -5.75); }

// 教学楼：米色墙 + 绿墙裙，窗洞透暖光
{
  const s = shapeFrom([[-7.5, 0], [-7.5, 2.3], [-7.2, 2.45], [6.5, 2.45], [6.8, 2.3], [6.8, 0]], 0.008, 31);
  let k = 0;
  for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 11; i++) {
    const wx = -7 + i * 1.24, wy = 0.45 + fl * 1.0; k++;
    if (hash(k * 3.1) < 0.72) s.holes.push(holePath(rrPts(wx, wy, 0.62, 0.58, 0.03, 2), 0.004, k));
  }
  const wall = piece(s, '#dcc29a'); wall.position.set(0, 0, -4.2); scene.add(wall);
  const band = P([[-7.5, 0], [-7.5, 0.32], [6.8, 0.32], [6.8, 0]], '#5d8a6d', {z: 0.013}); band.position.set(0, 0, -4.2); scene.add(band);
  for (let fl = 1; fl < 2; fl++) { const ln = P(rrPts(-7.5, fl * 1.0 + 0.3, 14.3, 0.07, 0.02, 2), '#c9b58f', {z: 0.013}); ln.position.set(0, 0, -4.2); scene.add(ln); }
  glowBoard(-0.3, 1.2, -4.32, 14.5, 2.3, '#ffb54a');
}

// 车棚：瓦楞铁皮顶 + 立柱 + 横梁
{
  const pts = [[-6.4, 2.95], [6.4, 2.6]]; // 顶边
  const top = (x) => 3.35 - (x + 6.4) / 12.8 * 0.3;
  const bottom = []; for (let i = 0; i <= 64; i++) { const x = 6.4 - i * 0.2; bottom.push([x, top(x) - 0.32 + (i % 2 ? 0.05 : 0)]); }
  const roof = P([[-6.4, top(-6.4)], [6.4, top(6.4)], ...bottom], '#8a7464', {z: 0, amp: 0.004}); roof.position.set(0, 0, -1.75); scene.add(roof);
  for (let i = 0; i < 26; i++) { const x = -6.2 + i * 0.5; const rib = P(rrPts(x, top(x) - 0.3, 0.03, 0.3, 0.01, 1), '#6a594d', {z: 0.013, amp: 0.002}); rib.position.set(0, 0, -1.75); scene.add(rib); }
  const beam = P(rrPts(-6.4, 2.95, 12.8, 0.08, 0.02, 2), '#5f5a5c', {z: 0}); beam.position.set(0, 0, -1.62); beam.rotation.z = -0.0234; scene.add(beam);
  for (const x of [-5.4, -1.6, 2.2, 5.8]) { const p = P(rrPts(x - 0.07, 0, 0.14, top(x) - 0.25, 0.03, 2), '#5f5a5c', {z: 0}); p.position.set(0, 0, -1.6); scene.add(p); }
}

// 纸灯笼（挂在棚下，会晃）
const lanterns = [];
for (const [i, x] of [[0, -3.6], [1, 0.3], [2, 4.1]].map(a => a)) {
  const g = new THREE.Group();
  g.add(P(rrPts(-0.008, -0.38, 0.016, 0.38, 0.004, 1), '#3b3236', {z: 0}));
  const body = P(ellipsePts(0, -0.58, 0.17, 0.21, 32), '#ffb35c', {z: 0, cast: false, mat: new THREE.MeshBasicMaterial({color: '#ffb04a', map: PAPER, toneMapped: false})});
  g.add(body);
  g.add(P(rrPts(-0.1, -0.41, 0.2, 0.05, 0.01, 1), '#7a3a26', {z: 0.013}));
  g.add(P(rrPts(-0.1, -0.8, 0.2, 0.05, 0.01, 1), '#7a3a26', {z: 0.013}));
  const light = new THREE.PointLight('#ffad5c', 4.0, 5, 1.6); light.position.set(0, -0.58, 0.3); g.add(light);
  g.position.set(x, 2.95 - (x + 6.4) / 12.8 * 0.3, -1.45); scene.add(g); lanterns.push({g, ph: i * 1.9});
}

// 二八自行车（剪纸：车轮是挖空的圆环 + 辐条）
function bike(x, z, s = 1, flip = 1) {
  const g = new THREE.Group(); const col = '#2d2a30';
  const wheel = (cx) => {
    const sh = shapeFrom(ellipsePts(cx, 0.36, 0.36, 0.36, 48), 0.004, SEED++);
    sh.holes.push(holePath(ellipsePts(cx, 0.36, 0.31, 0.31, 48).reverse(), 0.003, SEED++));
    g.add(piece(sh, col, {z: 0}));
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 6; const sp = P([[cx - 0.006, 0.36], [cx + 0.006, 0.36], [cx + Math.cos(a) * 0.31, 0.36 + Math.sin(a) * 0.31], [cx - Math.cos(a) * 0.31, 0.36 - Math.sin(a) * 0.31]], col, {z: 0.004, amp: 0.001}); g.add(sp); }
    g.add(P(ellipsePts(cx, 0.36, 0.04, 0.04, 12), '#8f8a8a', {z: 0.013}));
  };
  wheel(-0.55); wheel(0.55);
  const bar = (x0, y0, x1, y1, w = 0.035) => { const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2; g.add(P([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], col, {z: 0.008, amp: 0.002})); };
  bar(-0.55, 0.36, -0.1, 0.36); bar(-0.1, 0.36, -0.22, 0.86); bar(-0.1, 0.36, 0.42, 0.82); bar(-0.22, 0.82, 0.42, 0.82); bar(-0.55, 0.36, -0.22, 0.82); bar(0.55, 0.36, 0.42, 0.98);
  bar(0.42, 0.98, 0.3, 1.02); bar(0.42, 0.98, 0.58, 1.06);
  g.add(P(rrPts(-0.36, 0.86, 0.26, 0.06, 0.03, 3), '#4a3a32', {z: 0.012}));
  g.position.set(x, 0, z); g.scale.set(s * flip, s, 1); scene.add(g); return g;
}
for (let i = 0; i < 9; i++) bike(-5.6 + i * 1.32, -1.25 - (i % 2) * 0.12, 0.95, 1);

// 地面 + 粉笔跳房子（贴在地面纸上的纹理）
const CELL = 0.78, CX0 = -3.1, CZ = 0.35; // 格子沿 x 方向排开
{
  const c = document.createElement('canvas'); c.width = 2800; c.height = 1040; const g = c.getContext('2d');
  g.drawImage(paperCanvas(17, 1024), 0, 0, 2800, 1040);
  g.fillStyle = 'rgba(170,140,105,0.55)'; g.fillRect(0, 0, 2800, 1040);
  // 地面世界：x ∈ [-7,7] → 0..2800（200px/单位），z ∈ [-2.2, 3] → 0..1040
  const X = (x) => (x + 7) * 200, Z = (z) => (z + 2.2) * 200;
  const r = rng(77);
  const chalk = (x0, z0, x1, z1) => { for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(252,249,240,${0.3 + r() * 0.3})`; g.lineWidth = 3 + r() * 5; g.beginPath(); g.moveTo(X(x0) + (r() - .5) * 6, Z(z0) + (r() - .5) * 6); g.lineTo(X(x1) + (r() - .5) * 6, Z(z1) + (r() - .5) * 6); g.stroke(); } };
  const zA = CZ - 0.36, zB = CZ + 0.36;
  for (let i = 0; i <= 8; i++) chalk(CX0 + i * CELL, zA, CX0 + i * CELL, zB);
  chalk(CX0, zA, CX0 + 8 * CELL, zA); chalk(CX0, zB, CX0 + 8 * CELL, zB);
  g.font = 'bold 70px "PingFang SC", sans-serif'; g.fillStyle = 'rgba(252,249,240,0.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) { g.save(); g.translate(X(CX0 + (i + .5) * CELL), Z(CZ + 0.18)); g.scale(1, 0.9); g.fillText(String(i + 1), 0, 0); g.restore(); }
  // 一点落叶和裂缝
  for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(90,70,55,0.25)'; g.lineWidth = 2; g.beginPath(); let x = r() * 2800, y = r() * 1040; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - .5) * 60; y += (r() - .5) * 30; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 5.2), new THREE.MeshStandardMaterial({map: t, bumpMap: BUMP, bumpScale: 0.6, roughness: 0.96, color: '#d8c4a0'}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.4); floor.receiveShadow = true; scene.add(floor);
  const near = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({map: PAPER, bumpMap: BUMP, bumpScale: 0.6, roughness: 0.96, color: '#c6ad86'}));
  near.rotation.x = -Math.PI / 2; near.position.set(0, -0.002, 5); near.receiveShadow = true; scene.add(near);
}

// 前景：草丛剪纸
function tuft(x, z, s, col) { const pts = [[-0.5, 0]]; const r = rng(Math.floor(x * 100 + 500)); for (let i = 0; i < 9; i++) { const bx = -0.5 + i * 0.12; pts.push([bx + 0.06, 0.25 + r() * 0.45], [bx + 0.12, 0.02]); } pts.push([0.6, 0]); const m = P(pts, col, {z: 0, amp: 0.004}); m.position.set(x, 0, z); m.scale.setScalar(s); scene.add(m); }
tuft(-4.6, 1.7, 1.1, '#5f7a45'); tuft(-4.0, 1.9, 0.8, '#738f52'); tuft(4.7, 1.6, 1.2, '#5f7a45'); tuft(4.2, 1.85, 0.7, '#738f52'); tuft(-5.8, -1.0, 0.8, '#6c8650');

// ---------- 主角：Q 版少年剪纸人偶（侧身朝右，头身约 1:2.5） ----------
const C = {skin: '#f3d3b4', hair: '#1f1b1e', jacket: '#2f56a6', white: '#f4f1ea', pants: '#2b4e98', bag: '#c8352c', shoe: '#eeeae2', brad: '#c9a24a', glass: '#151214'};
const hero = new THREE.Group(); scene.add(hero);
const pelvis = new THREE.Group(); hero.add(pelvis); // 髋
function joint(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function brad(g, y = 0) { g.add(P(ellipsePts(0, y, 0.018, 0.018, 10), C.brad, {z: 0.03, amp: 0.001})); }
// 腿：远腿在后，近腿在前
function leg(z, near) {
  const hip = joint(pelvis, 0, 0, z);
  hip.add(P(limbPts(0.24, 0.135, 0.115), C.pants, {z: 0}));
  if (near) hip.add(P([[0.035, -0.02], [0.055, -0.02], [0.05, -0.23], [0.032, -0.23]], C.white, {z: 0.013, amp: 0.002}));
  const knee = joint(hip, 0, -0.24, 0.002);
  knee.add(P(limbPts(0.2, 0.115, 0.1), C.pants, {z: 0}));
  if (near) knee.add(P([[0.03, 0], [0.05, 0], [0.045, -0.19], [0.028, -0.19]], C.white, {z: 0.013, amp: 0.002}));
  const ankle = joint(knee, 0, -0.2, 0.003);
  ankle.add(P(rrPts(-0.06, -0.06, 0.17, 0.075, 0.035, 4), C.shoe, {z: 0}));
  ankle.add(P(rrPts(-0.06, -0.068, 0.17, 0.02, 0.008, 2), '#9a948c', {z: 0.012}));
  if (near) { brad(hip); brad(knee); }
  return {hip, knee, ankle};
}
const legFar = leg(-0.05, false), legNear = leg(0.05, true);
// 躯干 + 书包
const torso = joint(pelvis, 0, 0, 0);
torso.add(P([[-0.15, -0.04], [0.15, -0.04], [0.16, 0.32], [0.11, 0.39], [-0.11, 0.39], [-0.16, 0.32]], C.jacket, {z: 0}));
torso.add(P([[0.02, 0.38], [0.08, 0.38], [0.15, 0.2], [0.15, 0.12]], C.white, {z: 0.013, amp: 0.002})); // 校服白拼色
torso.add(P(rrPts(-0.155, -0.05, 0.31, 0.06, 0.02, 2), C.white, {z: 0.013})); // 下摆罗纹
const bag = joint(torso, -0.14, 0.32, -0.04);
bag.add(P(rrPts(-0.17, -0.34, 0.2, 0.36, 0.06, 4), C.bag, {z: 0}));
bag.add(P(rrPts(-0.16, -0.3, 0.12, 0.12, 0.03, 3), '#a8281f', {z: 0.013}));
torso.add(P([[0.0, 0.37], [0.04, 0.37], [-0.02, 0.06], [-0.06, 0.06]], '#8f231b', {z: 0.03, amp: 0.002})); // 书包带
// 头：Q 版狐狸（大头、尖嘴、竖耳），保留黑框眼镜 + 一撮斜刘海（认人点）
const F = {fur: '#df7a32', dark: '#b4561f', cream: '#f7ecd8', paw: '#3a2824', nose: '#1c1414'};
const neck = joint(torso, 0.01, 0.39, 0.01);
neck.add(P(rrPts(-0.05, -0.02, 0.1, 0.07, 0.02, 2), F.cream, {z: 0}));
const head = joint(neck, 0.02, 0.03, 0.006);
// 耳朵：各自一个关节（跳起来会甩、落地会弹）
function ear(x, z, near) {
  const e = joint(head, x, 0.4, z);
  e.add(P([[-0.09, -0.02], [0.08, -0.02], [0.02, 0.26], [-0.01, 0.27]], near ? F.fur : F.dark, {z: 0}));
  if (near) { e.add(P([[-0.045, 0.01], [0.04, 0.01], [0.01, 0.18]], '#4a2c22', {z: 0.013})); }
  else e.add(P([[-0.03, 0.17], [0.02, 0.26], [-0.01, 0.27]], '#2a1c18', {z: 0.013}));
  return e;
}
const earFar = ear(-0.1, -0.02, false), earNear = ear(0.0, 0.03, true);
// 头型：圆脑袋 + 向前的尖嘴
head.add(P([...ellipsePts(-0.02, 0.24, 0.24, 0.23, 36, -Math.PI * 0.15, Math.PI * 1.25), [-0.12, 0.05], [0.1, 0.06], [0.37, 0.15], [0.38, 0.2], [0.2, 0.27]], F.fur, {z: 0}));
head.add(P([[-0.1, 0.06], [0.1, 0.07], [0.37, 0.15], [0.36, 0.18], [0.16, 0.17], [0.05, 0.13], [-0.06, 0.13]], F.cream, {z: 0.013})); // 白腮和下巴
head.add(P(ellipsePts(0.375, 0.185, 0.035, 0.03, 12), F.nose, {z: 0.026, amp: 0.001})); // 鼻头
head.add(P([[0.26, 0.135], [0.3, 0.14], [0.3, 0.148], [0.26, 0.145]], '#5a2e22', {z: 0.026, amp: 0.001})); // 嘴
head.add(P(ellipsePts(0.07, 0.15, 0.04, 0.024, 10), '#f39a86', {z: 0.026, amp: 0.001})); // 腮红
// 斜刘海：一撮深色毛从头顶斜扫到额前
head.add(P([[-0.18, 0.42], [-0.05, 0.47], [0.1, 0.44], [0.2, 0.36], [0.24, 0.3], [0.16, 0.33], [0.18, 0.27], [0.08, 0.33], [0.06, 0.28], [-0.02, 0.36], [-0.12, 0.37]], F.dark, {z: 0.022, amp: 0.006}));
{ // 黑框眼镜：近侧镜片 + 远侧一小截 + 镜腿
  const lens = shapeFrom(rrPts(0.1, 0.2, 0.15, 0.11, 0.03, 3), 0.002, SEED++); lens.holes.push(holePath(rrPts(0.115, 0.213, 0.12, 0.084, 0.022, 3).reverse(), 0.001, SEED++));
  head.add(piece(lens, C.glass, {z: 0.04}));
  head.add(P(rrPts(0.245, 0.24, 0.04, 0.022, 0.008, 1), C.glass, {z: 0.04, amp: 0.001}));
  head.add(P(rrPts(-0.06, 0.25, 0.17, 0.02, 0.008, 1), C.glass, {z: 0.04, amp: 0.001}));
  head.add(P(ellipsePts(0.185, 0.255, 0.02, 0.026, 10), '#1f1512', {z: 0.03, amp: 0.001})); // 眼睛
  head.add(P(ellipsePts(0.19, 0.265, 0.006, 0.007, 6), '#ffffff', {z: 0.034, amp: 0}));       // 眼睛高光
}
brad(neck);
// 大尾巴：三节，末梢白；接在髋后面，跟随动作
const tail = [];
{
  let parent = pelvis, x = -0.13, y = 0.02;
  const seg = [[0.2, 0.11, F.fur], [0.2, 0.13, F.fur], [0.16, 0.11, F.cream]];
  seg.forEach(([len, w, col], i) => {
    const j = joint(parent, x, y, -0.09 + i * 0.002);
    j.add(P([...ellipsePts(-len / 2, 0, len / 2 + 0.03, w, 20, Math.PI * 0.5, Math.PI * 1.5), ...ellipsePts(-len / 2, 0, len / 2 + 0.03, w, 20, -Math.PI * 0.5, Math.PI * 0.5)].map(([a, b]) => [a, b]), col, {z: 0}));
    tail.push(j); parent = j; x = -len; y = 0;
  });
}
// 手臂
function arm(z, near) {
  const sh = joint(torso, 0.02, 0.33, z);
  sh.add(P(limbPts(0.18, 0.1, 0.085), C.jacket, {z: 0}));
  if (near) sh.add(P([[0.02, -0.02], [0.038, -0.02], [0.034, -0.17], [0.018, -0.17]], C.white, {z: 0.013, amp: 0.002}));
  const el = joint(sh, 0, -0.18, 0.002);
  el.add(P(limbPts(0.15, 0.085, 0.07), C.jacket, {z: 0}));
  el.add(P(ellipsePts(0, -0.17, 0.048, 0.052, 14), '#3a2824', {z: 0.004})); // 爪子
  if (near) { brad(sh); brad(el); }
  return {sh, el};
}
const armFar = arm(-0.07, false), armNear = arm(0.08, true);
hero.position.z = CZ; hero.scale.setScalar(1.5);

// ---------- 光 ----------
scene.add(new THREE.HemisphereLight('#a7a3d6', '#c79a6a', 0.55));
const sunL = new THREE.DirectionalLight('#ffc48a', 3.0); sunL.position.set(-9, 5.5, 6); sunL.target.position.set(0, 0.5, -2);
sunL.castShadow = true; sunL.shadow.mapSize.set(4096, 4096); Object.assign(sunL.shadow.camera, {left: -10, right: 10, top: 8, bottom: -4, near: 1, far: 30}); sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.01;
scene.add(sunL, sunL.target);
const rim = new THREE.DirectionalLight('#ff9e5e', 0.9); rim.position.set(6, 3, -6); scene.add(rim);

// 跟着镜头走的撕纸边框
{
  const r = rng(91); const outer = [[-3, -2], [3, -2], [3, 2], [-3, 2]]; const s = shapeFrom(outer, 0, 1);
  const hole = []; const n = 160;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const cx = Math.cos(a), cy = Math.sin(a); const sx = Math.sign(cx) * Math.pow(Math.abs(cx), 0.28), sy = Math.sign(cy) * Math.pow(Math.abs(cy), 0.28); const w = 0.012 * (r() - .5) + 0.008 * Math.sin(i * 1.3); hole.push([sx * (0.93 + w) * 0.5 * 2 * 0.98, sy * (0.9 + w) * 0.5 * 2 * 0.98]); }
  // 相机前 2.0 处可视半宽 = 2*tan(15°)*16/9 ≈ 0.953，半高 ≈ 0.536
  s.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x * 0.953, y * 0.536)).reverse()));
  const frame = piece(s, '#efe3cc', {cast: false, recv: false, mat: new THREE.MeshBasicMaterial({color: '#e9dcc2', map: PAPER})});
  frame.position.set(0, 0, -2.0); camera.add(frame);
}

// ---------- 动作：单脚跳房子（一拍二：姿态每 1/12 秒更新一次） ----------
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const HOP0 = 0.5, HOP = 0.56, NH = 6;
function state(tq) {
  let x = CX0 + 0.5 * CELL, y = 0, crouch = 0, air = 0, armUp = 0, lean = 0.06, bagLag = 0, look = 0;
  if (tq < HOP0) { crouch = ease(Math.max(0, tq) / HOP0) * 0.6; }
  else if (tq < HOP0 + HOP * NH) {
    const k = Math.floor((tq - HOP0) / HOP), p = ((tq - HOP0) % HOP) / HOP;
    const x0 = CX0 + (k + 0.5) * CELL, x1 = x0 + CELL;
    if (p < 0.18) { crouch = 0.6 + p / 0.18 * 0.4; x = x0; }
    else if (p < 0.78) { const q = (p - 0.18) / 0.6; x = lerp(x0, x1, ease(q)); air = Math.sin(Math.PI * q); y = 0.3 * air; crouch = 0.15 * (1 - air); armUp = air; lean = 0.16 * (1 - q) - 0.04; bagLag = Math.cos(Math.PI * q) * 0.25; }
    else { const q = (p - 0.78) / 0.22; x = x1; crouch = (1 - q) * 0.9 + q * 0.6; bagLag = -0.18 * (1 - q); lean = 0.1 * (1 - q); }
  } else {
    const q = Math.min(1, (tq - HOP0 - HOP * NH) / 0.4);
    x = CX0 + (NH + 0.5) * CELL; crouch = 0.8 * (1 - q); lean = 0; look = ease(Math.min(1, Math.max(0, (tq - HOP0 - HOP * NH - 0.5) / 0.5)));
  }
  return {x, y, crouch, air, armUp, lean, bagLag, look, both: tq >= HOP0 + HOP * NH, h: y - crouch * 0.07};
}
function pose(t) {
  const tq = Math.floor(t * 12) / 12; // 一拍二
  const s = state(tq), {x, y, crouch, air, armUp, lean, bagLag, look, both} = s;
  // 次级动作：耳朵、尾巴跟着身体高度的变化滞后一两拍（上升时向后压，落地时向前甩再回弹）
  const v1 = s.h - state(tq - 1 / 12).h, v2 = state(tq - 1 / 12).h - state(tq - 2 / 12).h;
  const lag = v1 * 0.6 + v2 * 0.4, idle = Math.sin(tq * 3.1);
  hero.position.x = x; hero.position.y = y;
  pelvis.position.y = 0.46 - crouch * 0.07; pelvis.rotation.z = -lean;
  legNear.hip.rotation.z = crouch * 0.55 - air * 0.15; legNear.knee.rotation.z = -crouch * 1.0 + air * 0.2; legNear.ankle.rotation.z = crouch * 0.45 - air * 0.3;
  if (both) { legFar.hip.rotation.z = crouch * 0.55 + 0.08; legFar.knee.rotation.z = -crouch * 1.0; legFar.ankle.rotation.z = crouch * 0.45; }
  else { legFar.hip.rotation.z = -0.35 + air * 0.1; legFar.knee.rotation.z = 1.5 - air * 0.3; legFar.ankle.rotation.z = -0.3; }
  armNear.sh.rotation.z = 0.25 + armUp * 1.3 - crouch * 0.5; armNear.el.rotation.z = 0.5 + armUp * 0.3;
  armFar.sh.rotation.z = -0.35 + armUp * 1.1 - crouch * 0.3; armFar.el.rotation.z = 0.6;
  torso.rotation.z = lean * 0.4; bag.rotation.z = bagLag;
  head.rotation.z = -0.05 + armUp * 0.08 - look * 0.12; neck.rotation.z = -lean * 0.4;
  earNear.rotation.z = 0.15 + lag * 6 + idle * 0.03; earFar.rotation.z = 0.25 + lag * 7.5 + idle * 0.04;
  tail[0].rotation.z = 0.55 - lag * 4 + idle * 0.06; tail[1].rotation.z = -0.25 - lag * 5 + idle * 0.08; tail[2].rotation.z = -0.3 - lag * 6 + idle * 0.1;
  hero.scale.x = 1.5 * (look > 0.5 ? -1 : 1);
}

// ---------- 渲染 ----------
const DUR = 5;
window.renderAt = (t) => {
  const u = ease(Math.min(1, t / DUR));
  camera.position.set(lerp(-1.4, 0.7, u), lerp(1.45, 1.25, u), lerp(10.2, 8.2, u));
  camera.lookAt(lerp(-0.8, 0.7, u), lerp(1.55, 1.35, u), 0);
  for (const {g, ph} of lanterns) g.rotation.z = 0.07 * Math.sin(t * 2.6 + ph);
  pose(t);
  renderer.render(scene, camera);
  return true;
};
window.renderAt(0);
window.READY = true;
