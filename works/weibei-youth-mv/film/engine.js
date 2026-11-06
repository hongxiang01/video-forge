// 《违背的青春》整片引擎：渲染器、场景（拆层背景 + 地面）、纸偶（蒙皮 + 反向求解）、动作库。
// 全部确定性：window.renderAt(t) 只依赖 t。
import * as THREE from 'three';
export { THREE };
export const W = 1920, H = 1080;
export const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
export const scene = new THREE.Scene();
export const FOV = 30, CAM = new THREE.Vector3(0, 1.5, 6.6), SHIFT = 0.11;
export const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 300);
camera.setViewOffset(W, H, 0, Math.round(SHIFT * H), W, H);
export const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// ---------- 工具 ----------
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, u) => a + (b - a) * u;
export const ramp = (t, a, b) => ss((t - a) / (b - a));
const loader = new THREE.TextureLoader();
const texCache = {};
export const loadTex = (url) => texCache[url] || (texCache[url] = new Promise((ok, bad) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; ok(t); }, undefined, () => bad(new Error('tex ' + url)))));
export function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), c); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

// ---------- 灯光（每个场景改颜色和强度） ----------
export const amb = new THREE.AmbientLight(0xfff1e2, 1.55); scene.add(amb);
export const sun = new THREE.DirectionalLight(0xffd7a8, 1.1);
sun.position.set(-2.2, 9, 3.5); sun.target.position.set(0, 0, 0.5);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 5, bottom: -2, near: 1, far: 30 });
sun.shadow.bias = -0.0004; sun.shadow.radius = 6; scene.add(sun, sun.target);

// ---------- 场景：参考图拆的纸层按屏幕位置放到不同深度 ----------
// 参考图 2048x1152、左右各补 PAD；参考图 floorY 那一行落在 y=0 的地面上（基准相机 CAM）
const IMG_W = 2048, IMG_H = 1152, PAD = 60, VOFF = 67;
export const floorDist = (floorY) => (CAM.y / (((floorY - VOFF) / IMG_H) - 0.5)) / (2 * TAN);
export async function makeScene(def) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const Df = floorDist(def.floorY);
  const layers = [];
  for (const L of def.layers) {
    const d = L.d * Df, tex = await loadTex(L.file);
    const Hd = 2 * d * TAN, Wd = Hd * W / H;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !L.opaque, alphaTest: 0.02, toneMapped: false, depthWrite: !!L.opaque });
    // 夜景：暗部压成冷色，亮部（窗、灯）保留暖光；uGlow 控制灯光，uDim 整体亮度
    const U = { uNight: { value: 0 }, uGlow: { value: 1 }, uDim: { value: 1 } };
    mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
      sh.fragmentShader = 'uniform float uNight; uniform float uGlow; uniform float uDim;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 night = c * vec3(0.20, 0.24, 0.42) + smoothstep(0.42, 0.7, l) * c * vec3(1.1, 0.85, 0.55) * uGlow;
          diffuseColor.rgb = mix(c, night, uNight) * uDim; }`); };
    const key = 'bd' + Math.random().toString(36).slice(2); mat.customProgramCacheKey = () => key;   // 每层独立程序，各吃各的参数
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Wd * (IMG_W + 2 * PAD) / IMG_W, Hd), mat);
    m.userData.u = U;
    m.position.set(0, CAM.y - ((IMG_H / 2 - VOFF) / IMG_H - 0.5) * Hd, CAM.z - d);
    m.renderOrder = -d; m.userData.base = m.position.clone(); m.userData.d = d;
    g.add(m); layers.push(m);
  }
  const zFloor = CAM.z - Df;
  let ground;
  if (def.ground === 'paper') {
    ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshLambertMaterial({ map: def.groundTex }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, zFloor + 8); ground.receiveShadow = true; g.add(ground);
  } else {
    ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.ShadowMaterial({ opacity: 0.32 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.001, zFloor + 8); ground.receiveShadow = true; g.add(ground);
  }
  const S = { name: def.name, group: g, layers, zFloor, Df, def, ground };
  // 屏幕位置 → 某深度的世界坐标（基准相机下），用来把道具放到参考图里的某个位置
  S.imgToWorld = (px, py, d) => { const Hd = 2 * d * TAN, Wd = Hd * W / H; return new THREE.Vector3((px / IMG_W - 0.5) * Wd, CAM.y - ((py - VOFF) / IMG_H - 0.5) * Hd, CAM.z - d); };
  S.floorX = (px) => S.imgToWorld(px, def.floorY, Df).x;
  if (def.build) await def.build(S);
  return S;
}

// ---------- 纸偶 ----------
const pointInPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
function chainWeights(px, py, chain, blend) {
  const n = chain.length - 1, S = [0];
  for (let i = 0; i < n; i++) S.push(S[i] + Math.hypot(chain[i + 1][1] - chain[i][1], chain[i + 1][2] - chain[i][2]));
  let best = 1e9, arc = 0;
  for (let i = 0; i < n; i++) {
    const [, x0, y0] = chain[i], [, x1, y1] = chain[i + 1], dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    const t = ((px - x0) * dx + (py - y0) * dy) / L2, tc = clamp(t);
    const d = Math.hypot(px - (x0 + dx * tc), py - (y0 + dy * tc));
    if (d < best - 1e-6) { best = d; arc = S[i] + (i === 0 ? Math.min(t, 1) : i === n - 1 ? Math.max(t, 0) : tc) * Math.sqrt(L2); }
  }
  let idx = 0; while (idx < n - 1 && arc >= S[idx + 1]) idx++;
  const w = {}; const add = (b, v) => { w[b] = (w[b] || 0) + v; };
  const b = chain[idx][0];
  if (idx > 0 && arc - S[idx] < blend) { const v = 0.5 + 0.5 * ss((arc - S[idx]) / blend); add(b, v); add(chain[idx - 1][0], 1 - v); }
  else if (idx < n - 1 && S[idx + 1] - arc < blend) { const v = 0.5 + 0.5 * ss((S[idx + 1] - arc) / blend); add(b, v); add(chain[idx + 1][0], 1 - v); }
  else add(b, 1);
  return w;
}
function headExtras(px, py, M, w) {
  const ex = [];
  for (const e of M.ears || []) if (pointInPoly(px, py, e.poly)) {
    const [bx, by] = e.base, [tx, ty] = e.tip, dx = tx - bx, dy = ty - by;
    ex.push([e.bone, ss((((px - bx) * dx + (py - by) * dy) / (dx * dx + dy * dy) - 0.1) / 0.55)]);
  }
  for (const e of M.brows || []) { const [x0, y0, x1, y1] = e.box, d = Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1)); ex.push([e.bone, 1 - ss(d / e.r)]); }
  if (M.fringe && pointInPoly(px, py, M.fringe.poly)) ex.push([M.fringe.bone, ss(Math.hypot(px - M.fringe.attach[0], py - M.fringe.attach[1]) / M.fringe.len) * 0.9]);
  const sum = ex.reduce((s, e) => s + e[1], 0), sc = sum > 1 ? 1 / sum : 1;
  const out = {}; out[Object.keys(w)[0]] = 1 - Math.min(sum, 1);
  for (const [b, v] of ex) out[b] = (out[b] || 0) + v * sc;
  return out;
}
export async function makePuppet(R) {
  const legs = Object.values(R.meshes).filter((m) => m.sole);
  const soleRef = Math.min(...legs.map((m) => m.sole));
  const k = R.height / (soleRef - R.top), px0 = R.bones.pelvis[1];
  const toU = (x, y) => [(x - px0) * k, (soleRef - y) * k];
  const root = new THREE.Group(); scene.add(root);
  const B = {};
  for (const n of Object.keys(R.bones)) { B[n] = new THREE.Bone(); B[n].name = n; }
  for (const [n, [p, x, y]] of Object.entries(R.bones)) {
    const [ux, uy] = toU(x, y);
    if (p) { const [qx, qy] = toU(R.bones[p][1], R.bones[p][2]); B[n].position.set(ux - qx, uy - qy, 0); B[p].add(B[n]); }
    else { B[n].position.set(ux, uy, 0); root.add(B[n]); }
    B[n].userData.rest = B[n].position.clone();
  }
  root.updateMatrixWorld(true);
  const meshes = {};
  for (const [name, M] of Object.entries(R.meshes)) {
    const files = M.files || { main: M.file }, texs = {};
    for (const [key, f] of Object.entries(files)) texs[key] = await loadTex('puppets/' + f);
    const [w, h] = M.size, gs = M.grid || 12;
    const geo = new THREE.PlaneGeometry(w * k, h * k, Math.max(2, Math.round(w / gs)), Math.max(2, Math.round(h / gs)));
    const [cx, cy] = toU(M.origin[0] + w / 2, M.origin[1] + h / 2); geo.translate(cx, cy, M.z * 0.006);
    const pos = geo.attributes.position, nv = pos.count, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    const used = [...new Set(M.chain.map((c) => c[0]).filter(Boolean).concat((M.ears || []).map((e) => e.bone), (M.brows || []).map((e) => e.bone), M.fringe ? [M.fringe.bone] : []))];
    for (let i = 0; i < nv; i++) {
      const px = pos.getX(i) / k + px0, py = soleRef - pos.getY(i) / k;
      let wt = chainWeights(px, py, M.chain, M.blend);
      if (M.rigid_below) { const [rb, ry, rw] = M.rigid_below, f = ss((py - ry) / rw + 0.5); for (const b in wt) wt[b] *= 1 - f; wt[rb] = (wt[rb] || 0) + f; }
      if (name === 'head') wt = headExtras(px, py, M, wt);
      const ent = Object.entries(wt).sort((a, b) => b[1] - a[1]).slice(0, 4), tot = ent.reduce((s, e) => s + e[1], 0);
      ent.forEach(([b, v], j) => { si[i * 4 + j] = used.indexOf(b); sw[i * 4 + j] = v / tot; });
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const first = Object.values(texs)[0];
    const mat = new THREE.MeshLambertMaterial({ map: first, alphaTest: 0.45, side: THREE.DoubleSide });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: first, alphaTest: 0.45 });
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
    root.add(mesh); mesh.bind(new THREE.Skeleton(used.map((b) => B[b])));
    mesh.userData.texs = texs; meshes[name] = mesh;
  }
  const P0 = (n) => toU(R.bones[n][1], R.bones[n][2]);
  const lim = {};
  for (const [s, a, b, c] of [['leg_n', 'hip_n', 'kn_n', 'an_n'], ['leg_f', 'hip_f', 'kn_f', 'an_f'], ['arm_n', 'sh_n', 'el_n', 'wr_n'], ['arm_f', 'sh_f', 'el_f', 'wr_f']]) {
    const A = P0(a), Bp = P0(b), C = P0(c);
    lim[s] = { a, b, c, L1: Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), L2: Math.hypot(C[0] - Bp[0], C[1] - Bp[1]), r1: Math.atan2(Bp[1] - A[1], Bp[0] - A[0]), r2: Math.atan2(C[1] - Bp[1], C[0] - Bp[0]), rest: C };
    if (s.startsWith('leg')) lim[s].ankleH = (R.meshes[s].sole - R.bones[c][2]) * k;
  }
  const P = { root, B, meshes, k, toU, lim, pelvisH: B.pelvis.position.y, props: {} };
  return P;
}
export function resetPose(P) { P.groundY = 0; P.reach = {}; for (const b of Object.values(P.B)) { b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1); b.position.copy(b.userData.rest); } P.root.scale.set(1, 1, 1); P.root.rotation.set(0, 0, 0); }
export function setFace(P, e, m = 0) { const mesh = P.meshes.head; const t = mesh.userData.texs[`e${e}_m${m}`] || mesh.userData.texs[`e${e}_m0`]; if (t && mesh.material.map !== t) { mesh.material.map = t; mesh.customDepthMaterial.map = t; } }
export const blinkAt = (t, times) => { for (const b of times) { const u = t - b; if (u >= 0 && u < 0.05) return 1; if (u >= 0.05 && u < 0.12) return 2; if (u >= 0.12 && u < 0.17) return 1; } return 0; };
const _v = new THREE.Vector3();
function localAngle(b) { let a = 0; for (let o = b; o && o.isBone; o = o.parent) a += o.rotation.z; return a; }
// 两段反向求解（在纸偶自身坐标里算，镜像也对）：把链末端放到世界坐标 (tx, ty)；bend=-1 关节朝前（膝），+1 朝后（肘）
export function ik(P, limb, tx, ty, bend = -1, endAngle = null) {
  const L = P.lim[limb], A = P.B[L.a], Bb = P.B[L.b], C = P.B[L.c];
  A.rotation.z = 0; Bb.rotation.z = 0; P.root.updateMatrixWorld(true);
  A.getWorldPosition(_v); P.root.worldToLocal(_v); const hx = _v.x, hy = _v.y;
  _v.set(tx, ty, P.root.position.z); P.root.worldToLocal(_v); const lx = _v.x, ly = _v.y;
  const dx = lx - hx, dy = ly - hy, d = Math.hypot(dx, dy);
  const dc = clamp(d, Math.abs(L.L1 - L.L2) + 1e-4, (L.L1 + L.L2) * 0.9995);
  const a = Math.atan2(dy, dx), cosA = clamp((L.L1 * L.L1 + dc * dc - L.L2 * L.L2) / (2 * L.L1 * dc), -1, 1);
  const th1 = a + bend * Math.acos(cosA);
  const kx = hx + L.L1 * Math.cos(th1), ky = hy + L.L1 * Math.sin(th1);
  const th2 = Math.atan2(ly - ky, lx - kx), pa = localAngle(A.parent);
  A.rotation.z = th1 - L.r1 - pa;
  Bb.rotation.z = th2 - L.r2 - pa - A.rotation.z;
  if (endAngle !== null) C.rotation.z = endAngle - (pa + A.rotation.z + Bb.rotation.z);
  const over = Math.max(0, d - (L.L1 + L.L2)); P.reach = P.reach || {}; P.reach[limb] = Math.max(P.reach[limb] || 0, over); return over;   // 够不着的距离（检查用）
}
// 脚：踝放到 (x, 抬高 lift)，鞋底平（tilt 让脚尖上下）
export function foot(P, s, x, lift = 0, tilt = 0) { const L = P.lim['leg_' + s]; return ik(P, 'leg_' + s, x, (P.groundY || 0) + L.ankleH + lift, -1, tilt); }
export const facing = (P) => P.root.scale.x;   // +1 朝左（设计稿方向），-1 朝右
// 静止时踝相对身体的水平偏移（世界坐标，考虑朝向）
export const ankleRestX = (P, s) => P.lim['leg_' + s].rest[0] * P.root.scale.x;

// ---------- 动作库 ----------
// 站：两脚钉住，呼吸
export function stand(P, x, z, opt = {}) {
  const { face = 1, t = 0, breathe = 1, crouch = 0, feet = null } = opt;
  P.root.position.set(x, 0, z); P.root.scale.x = face;
  const br = Math.sin(t * 2 * Math.PI / 3.4) * breathe;
  P.B.pelvis.position.y = (P.groundY || 0) + P.pelvisH * 0.985 - crouch * 0.08 * P.pelvisH / 0.35 + 0.004 * br;
  P.B.chest.scale.set(1 + 0.006 * br, 1 + 0.012 * br, 1);
  P.root.updateMatrixWorld(true);
  const fn = feet ? feet[0] : x + ankleRestX(P, 'n'), ff = feet ? feet[1] : x + ankleRestX(P, 'f');
  foot(P, 'n', fn); foot(P, 'f', ff);
  return br;
}
// 走 / 跑：s = 走过的距离（米），dir = 行进方向（-1 往左，+1 往右）
export function gait(P, x0, z, s, opt = {}) {
  const { dir = -1, stride = 0.42, stance = 0.6, lift = 0.07, bob = 0.012, lean = 0.04, run = false, arms = 0.45, t = 0 } = opt;
  P.root.position.set(x0 + dir * s, 0, z); P.root.scale.x = -dir;
  const q = s / stride;
  // 身体起伏：每步一次
  const ph = (q % 0.5) / 0.5;
  P.B.pelvis.position.y = (P.groundY || 0) + P.pelvisH * (run ? 0.92 : 0.975) + (run ? 0.028 * Math.sin(ph * Math.PI) : bob * Math.cos(ph * 2 * Math.PI));
  P.B.pelvis.rotation.z = lean * 0.4; P.B.chest.rotation.z = lean * 0.6;
  P.root.updateMatrixWorld(true);
  const rel = {};
  for (const [s_, off] of [['n', 0], ['f', 0.5]]) {
    const qq = q + off, c = Math.floor(qq), f = qq - c;
    const plant = (cc) => x0 + dir * ((cc - off + 0.32) * stride) + ankleRestX(P, s_) * 0.4;
    let fx, fy, tilt = 0;
    if (f < stance) { fx = plant(c); fy = 0; tilt = 0; }
    else { const u = (f - stance) / (1 - stance), e = ss(u); fx = lerp(plant(c), plant(c + 1), e); fy = Math.sin(u * Math.PI) * lift; tilt = -0.35 * Math.sin(u * Math.PI); }
    foot(P, s_, fx, fy, tilt);
    rel[s_] = (fx - P.root.position.x) * -dir;   // >0 表示脚在身前
  }
  // 手臂与同侧腿反向摆
  const A = arms * (run ? 1.6 : 1);
  P.B.sh_n.rotation.z = clamp(rel.n / stride, -1, 1) * A; P.B.el_n.rotation.z = run ? -1.1 : -0.15 - 0.1 * Math.max(0, -rel.n / stride);
  P.B.sh_f.rotation.z = clamp(rel.f / stride, -1, 1) * A; P.B.el_f.rotation.z = run ? -1.0 : -0.12;
  P.B.neck.rotation.z = -lean * 0.4 + 0.02 * Math.sin(q * 2 * Math.PI);
  return { q, rel };
}
// 跟随：耳朵、刘海、尾巴按给定的速度信号摆（vy：身体竖直速度，vx：水平速度）
export function secondary(P, t, vy = 0, vx = 0, amp = 1) {
  const B = P.B;
  B.ear_l.rotation.z += clamp(0.28 * vy, -0.35, 0.35) * amp + 0.03 * Math.sin(t * 2.1);
  B.ear_r.rotation.z += -clamp(0.28 * vy, -0.35, 0.35) * amp - 0.03 * Math.sin(t * 2.1 + 1);
  B.fringe.rotation.z += 0.18 * vy * amp + 0.05 * Math.abs(vx);
  const sway = Math.abs(vx) > 0.2 ? 0.25 : 0.1;
  B.tl0.rotation.z += sway * Math.sin(t * 4.2) - 0.35 * vy + 0.15 * Math.abs(vx);
  B.tl1.rotation.z += sway * 1.2 * Math.sin(t * 4.2 - 0.8) - 0.3 * vy;
  B.tl2.rotation.z += sway * 1.5 * Math.sin(t * 4.2 - 1.6) - 0.25 * vy;
}
export function brows(P, dyPx, rot = 0) { P.B.brow_l.position.y += dyPx * P.k; P.B.brow_r.position.y += dyPx * P.k; P.B.brow_l.rotation.z = -rot; P.B.brow_r.rotation.z = rot; }

// ---------- 接触阴影 ----------
const blobTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, 'rgba(35,18,6,0.75)'); r.addColorStop(1, 'rgba(35,18,6,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
export function makeBlobs(n) {
  return Array.from({ length: n }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; scene.add(m); return m; });
}
export function footBlobs(P, blobs, groundY = 0) {
  ['n', 'f'].forEach((s, j) => {
    P.B['an_' + s].getWorldPosition(_v); const hgt = Math.max(0, _v.y - groundY - P.lim['leg_' + s].ankleH);
    const b = blobs[j]; b.visible = P.root.visible; b.position.set(_v.x - 0.03 * P.root.scale.x, groundY + 0.006, P.root.position.z);
    b.scale.set(0.3 * (1 + hgt) * P.k / 0.00088, 0.22 * (1 + hgt) * P.k / 0.00088, 1); b.material.opacity = Math.max(0, 1 - hgt * 4);
  });
}
