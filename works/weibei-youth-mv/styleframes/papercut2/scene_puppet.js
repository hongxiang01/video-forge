// ---------- 纸偶 v2：每个部件是一张可弯曲的网格（蒙皮），关节处平滑过渡，不再是硬纸片拼接 ----------
// rig2_out.json：骨骼（父、原图像素坐标）+ 网格（贴图、层序、权重链）。脚用两段反向求解钉在地上。
const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function pointInPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }

// 沿骨骼链投影，按弧长在关节附近平滑混合两根骨骼
function chainWeights(px, py, chain, blend) {
  const n = chain.length - 1, S = [0];
  for (let i = 0; i < n; i++) S.push(S[i] + Math.hypot(chain[i + 1][1] - chain[i][1], chain[i + 1][2] - chain[i][2]));
  let best = 1e9, arc = 0;
  for (let i = 0; i < n; i++) {
    const [, x0, y0] = chain[i], [, x1, y1] = chain[i + 1], dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    let t = ((px - x0) * dx + (py - y0) * dy) / L2; const tc = Math.min(1, Math.max(0, t));
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
  for (const e of M.brows || []) {
    const [x0, y0, x1, y1] = e.box, d = Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));
    ex.push([e.bone, 1 - ss(d / e.r)]);
  }
  if (M.fringe && pointInPoly(px, py, M.fringe.poly)) ex.push([M.fringe.bone, ss(Math.hypot(px - M.fringe.attach[0], py - M.fringe.attach[1]) / M.fringe.len) * 0.9]);
  let sum = ex.reduce((s, e) => s + e[1], 0); const sc = sum > 1 ? 1 / sum : 1;
  const base = Object.keys(w)[0]; const out = {}; out[base] = 1 - Math.min(sum, 1);
  for (const [b, v] of ex) out[b] = (out[b] || 0) + v * sc;
  return out;
}

async function makePuppet2(R) {
  const legs = Object.values(R.meshes).filter((m) => m.sole);
  const soleRef = Math.min(...legs.map((m) => m.sole));
  const k = R.height / (soleRef - R.top);
  const px0 = R.bones.pelvis[1];
  const toU = (x, y) => [(x - px0) * k, (soleRef - y) * k];
  const root = new THREE.Group(); scene.add(root);
  const B = {};
  for (const [n, [p, x, y]] of Object.entries(R.bones)) { B[n] = new THREE.Bone(); B[n].name = n; }
  for (const [n, [p, x, y]] of Object.entries(R.bones)) {
    const [ux, uy] = toU(x, y);
    if (p) { const [qx, qy] = toU(R.bones[p][1], R.bones[p][2]); B[n].position.set(ux - qx, uy - qy, 0); B[p].add(B[n]); }
    else { B[n].position.set(ux, uy, 0); root.add(B[n]); }
    B[n].userData.rest = B[n].position.clone();
  }
  root.updateMatrixWorld(true);
  const meshes = {};
  for (const [name, M] of Object.entries(R.meshes)) {
    const files = M.files || { main: M.file };
    const texs = {}; for (const [key, f] of Object.entries(files)) texs[key] = await loadTex('puppets/' + f);
    const [w, h] = M.size, g = M.grid || 12;
    const geo = new THREE.PlaneGeometry(w * k, h * k, Math.max(2, Math.round(w / g)), Math.max(2, Math.round(h / g)));
    const [cx, cy] = toU(M.origin[0] + w / 2, M.origin[1] + h / 2);
    geo.translate(cx, cy, M.z * 0.006);
    const pos = geo.attributes.position, nv = pos.count;
    const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    const used = [...new Set(M.chain.map((c) => c[0]).filter(Boolean).concat((M.ears || []).map((e) => e.bone), (M.brows || []).map((e) => e.bone), M.fringe ? [M.fringe.bone] : []))];
    for (let i = 0; i < nv; i++) {
      const px = pos.getX(i) / k + px0, py = soleRef - pos.getY(i) / k;
      let wt = chainWeights(px, py, M.chain, M.blend);
      if (M.rigid_below) { const [rb, ry, rw] = M.rigid_below, f = ss((py - ry) / rw + 0.5); for (const b in wt) wt[b] *= 1 - f; wt[rb] = (wt[rb] || 0) + f; }
      if (name === 'head') wt = headExtras(px, py, M, wt);
      const ent = Object.entries(wt).sort((a, b) => b[1] - a[1]).slice(0, 4); const tot = ent.reduce((s, e) => s + e[1], 0);
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
  // 两段反向求解要用的静止长度与方向（根空间）
  const P = (n) => toU(R.bones[n][1], R.bones[n][2]);
  const legInfo = {};
  for (const s of ['n', 'f']) {
    const hp = P('hip_' + s), kn = P('kn_' + s), an = P('an_' + s), leg = R.meshes['leg_' + s];
    legInfo[s] = { L1: Math.hypot(kn[0] - hp[0], kn[1] - hp[1]), L2: Math.hypot(an[0] - kn[0], an[1] - kn[1]),
      r1: Math.atan2(kn[1] - hp[1], kn[0] - hp[0]), r2: Math.atan2(an[1] - kn[1], an[0] - kn[0]),
      ankleH: (leg.sole - R.bones['an_' + s][2]) * k, restX: an[0] };
  }
  return { root, B, meshes, k, toU, legInfo, pelvisH: B.pelvis.position.y };
}

const _v = new THREE.Vector3();
function worldAngle(b) { let a = 0; for (let o = b; o && o.isBone; o = o.parent) a += o.rotation.z; return a; }
// 把踝关节放到世界坐标 (tx, ty)，膝盖朝前（朝左），鞋底保持水平
function legIK(P, s, tx, ty, footTilt = 0) {
  const L = P.legInfo[s], hip = P.B['hip_' + s], knee = P.B['kn_' + s], ank = P.B['an_' + s];
  hip.rotation.z = 0; knee.rotation.z = 0; P.root.updateMatrixWorld(true);
  hip.getWorldPosition(_v); const hx = _v.x, hy = _v.y;
  let dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy);
  const dc = Math.min(Math.max(d, Math.abs(L.L1 - L.L2) + 1e-4), (L.L1 + L.L2) * 0.9995);
  const a = Math.atan2(dy, dx), cosA = (L.L1 * L.L1 + dc * dc - L.L2 * L.L2) / (2 * L.L1 * dc);
  const th1 = a - Math.acos(Math.min(1, Math.max(-1, cosA)));
  const kx = hx + L.L1 * Math.cos(th1), ky = hy + L.L1 * Math.sin(th1);
  const th2 = Math.atan2(ty - ky, tx - kx);
  const pa = worldAngle(hip.parent);
  hip.rotation.z = th1 - L.r1 - pa;
  knee.rotation.z = th2 - L.r2 - pa - hip.rotation.z;
  ank.rotation.z = footTilt - (pa + hip.rotation.z + knee.rotation.z);
}
function setFace(P, key) { const m = P.meshes.head; const t = m.userData.texs[key]; if (t && m.material.map !== t) { m.material.map = t; m.customDepthMaterial.map = t; } }
function resetPose(P) { for (const b of Object.values(P.B)) { b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1); b.position.copy(b.userData.rest); } }
const blinkAt = (t, times) => { for (const b of times) { const u = t - b; if (u >= 0 && u < 0.05) return 1; if (u >= 0.05 && u < 0.12) return 2; if (u >= 0.12 && u < 0.17) return 1; } return 0; };

// ---------- 少年：跳房子 ----------
const T0 = 0.8, HT = 0.66;
const HOPS = [{ i: 1, two: false }, { i: 2, two: false }, { i: 3, two: true }, { i: 4, two: false }, { i: 5, two: true }];
const T_END = T0 + HOPS.length * HT;
function kidPlan(t) {
  // 返回身体 x、下蹲 c、腾空高度 h、腾空进度 a、两脚目标、手臂相位
  const nearPos = (x, two) => x - (two ? 0.065 : 0.025);
  const farGround = (x) => x + 0.085;
  const farRaised = (x, tt) => [x + 0.27, 0.15 + 0.02 * Math.sin(tt * 5)];
  if (t < T0) {
    const x = cellX(0), lift = ss((t - 0.3) / 0.3), antic = ss((t - (T0 - 0.22)) / 0.22);
    const fr = farRaised(x, t), fg = farGround(x);
    return { x: x + 0.03 * lift, c: antic * 0.9 + 0.15 * (1 - lift) * ss(t / 0.3), h: 0, air: 0, antic, land: 0,
      fn: [nearPos(x, lift < 0.5), 0], ff: [fg + (fr[0] - fg) * lift, fr[1] * lift], two: lift < 0.5 };
  }
  const n = Math.floor((t - T0) / HT);
  if (n >= HOPS.length) {
    const x = cellX(HOPS[HOPS.length - 1].i), u = t - T_END;
    return { x, c: Math.max(0, Math.sin(Math.min(u / 0.25, 1) * Math.PI)) * 0.8, h: 0, air: 0, antic: 0, land: Math.max(0, 1 - u / 0.3), fn: [nearPos(x, true), 0], ff: [farGround(x), 0], two: true, done: u };
  }
  const u = ((t - T0) % HT) / HT;
  const from = n === 0 ? 0 : HOPS[n - 1].i, to = HOPS[n].i, twoF = n === 0 ? false : HOPS[n - 1].two, twoT = HOPS[n].two;
  const xf = cellX(from), xt = cellX(to);
  const footN = (x, two) => [nearPos(x, two), 0];
  const footF = (x, two, tt) => two ? [farGround(x), 0] : farRaised(x, tt);
  if (u < 0.24) { const antic = n === 0 ? 1 : ss(u / 0.24); return { x: xf, c: antic * 0.9, h: 0, air: 0, antic, land: 0, fn: footN(xf, twoF), ff: footF(xf, twoF, t), two: twoF }; }
  if (u < 0.62) {
    const a = (u - 0.24) / 0.38, e = ss(a), x = xf + (xt - xf) * e;
    const n0 = footN(xf, twoF), n1 = footN(xt, twoT), f0 = footF(xf, twoF, t), f1 = footF(xt, twoT, t);
    const tuck = Math.sin(a * Math.PI);
    return { x, c: 0.15 * (1 - tuck), h: 4 * a * (1 - a) * 0.15, air: tuck, antic: 0, land: 0, a,
      fn: [n0[0] + (n1[0] - n0[0]) * e, n0[1] + (n1[1] - n0[1]) * e + tuck * 0.2], ff: [f0[0] + (f1[0] - f0[0]) * e, f0[1] + (f1[1] - f0[1]) * e + tuck * 0.12], two: twoT };
  }
  const b = (u - 0.62) / 0.38;
  return { x: xt, c: Math.sin(Math.min(b / 0.6, 1) * Math.PI * 0.5 + (b > 0.6 ? 0 : 0)) * (1 - ss((b - 0.35) / 0.65)) * 1.0, h: 0, air: 0, antic: 0, land: 1 - b, fn: footN(xt, twoT), ff: footF(xt, twoT, t), two: twoT };
}
const kidY = (P, t) => { const s = kidPlan(Math.max(0, t)); return s.h - s.c * 0.075; };
function poseKid(P, t) {
  resetPose(P);
  const s = kidPlan(t), B = P.B;
  const vy = (kidY(P, t - 0.05) - kidY(P, t - 0.1)) / 0.05;          // 稍滞后的竖直速度，驱动耳朵、尾巴、刘海
  const vyL = (kidY(P, t - 0.1) - kidY(P, t - 0.15)) / 0.05;
  P.root.position.set(s.x, 0, HOP_Z + 0.05);
  B.pelvis.position.y = P.pelvisH * 0.985 + s.h - s.c * 0.075;
  const lean = 0.2 * s.antic * (1 - s.air) - 0.08 * s.air + 0.14 * s.land * s.c + (s.done !== undefined ? -0.05 * ss(s.done / 0.4) : 0);
  B.pelvis.rotation.z = lean * 0.4;
  B.chest.rotation.z = lean * 0.6;
  B.chest.scale.set(1 + 0.035 * s.c, 1 - 0.06 * s.c + 0.04 * s.air, 1);
  // 脚：钉在地上
  P.root.updateMatrixWorld(true);
  const ln = P.legInfo.n, lf = P.legInfo.f;
  legIK(P, 'n', s.fn[0], ln.ankleH + s.fn[1], s.fn[1] > 0.02 ? -0.25 * Math.min(1, s.fn[1] / 0.1) : 0);
  legIK(P, 'f', s.ff[0], lf.ankleH + s.ff[1], s.ff[1] > 0.02 ? 0.5 * Math.min(1, s.ff[1] / 0.15) : 0);
  // 手臂：蓄力往后摆、起跳往前上甩，跟身体差一点时间
  const sl = kidPlan(Math.max(0, t - 0.06));
  const celebrate = s.done !== undefined ? ss((s.done - 0.15) / 0.35) : 0;
  const arm = 0.5 * sl.antic - 0.95 * sl.air + 0.15 * sl.land;
  B.sh_n.rotation.z = arm * (1 - celebrate) - 2.45 * celebrate + 0.06;
  B.el_n.rotation.z = (-0.25 - 0.4 * sl.air) * (1 - celebrate) - 0.35 * celebrate;
  B.wr_n.rotation.z = -0.15 * sl.air;
  B.sh_f.rotation.z = arm * 0.85 * (1 - celebrate) + 2.45 * celebrate - 0.05;
  B.el_f.rotation.z = (-0.2 - 0.35 * sl.air) * (1 - celebrate) + 0.35 * celebrate;
  // 头：开跳前低头看格子，落地后头晚半拍点一下
  const look = 0.1 * ss(t / 0.4) * (1 - celebrate);
  B.neck.rotation.z = -lean * 0.5 + look - 0.12 * vy * 0.25 - 0.08 * celebrate + 0.02 * Math.sin(t * 9) * celebrate;
  // 耳朵、刘海、尾巴：跟随
  B.ear_l.rotation.z = Math.max(-0.35, Math.min(0.35, 0.28 * vyL)) + 0.12 * celebrate;
  B.ear_r.rotation.z = -Math.max(-0.35, Math.min(0.35, 0.28 * vyL)) - 0.12 * celebrate;
  B.fringe.rotation.z = 0.18 * vy;
  B.tl0.rotation.z = 0.12 * Math.sin(t * 4.2) - 0.35 * vyL;
  B.tl1.rotation.z = 0.15 * Math.sin(t * 4.2 - 0.8) - 0.3 * vyL;
  B.tl2.rotation.z = 0.2 * Math.sin(t * 4.2 - 1.6) - 0.25 * vyL;
  // 眉毛：专注时压低，庆祝时扬起
  const bk = P.k;
  const browY = (-3 * (1 - celebrate) * ss(t / 0.5) + 12 * celebrate) * bk;
  B.brow_l.position.y += browY; B.brow_r.position.y += browY;
  B.brow_l.rotation.z = -0.08 * celebrate; B.brow_r.rotation.z = 0.08 * celebrate;
  // 脸：眨眼；庆祝时眯眼大笑
  const e = celebrate > 0.3 ? 2 : blinkAt(t, [0.35, 2.05]);
  setFace(P, `e${e}_m${celebrate > 0.3 ? 1 : 0}`);
  return s;
}

// ---------- 大人：站着看 ----------
function poseAdult(P, t, kidS) {
  resetPose(P);
  const B = P.B;
  P.root.position.set(1.62 + 0.012 * Math.sin(t * 1.1), 0, 1.3);
  const br = Math.sin(t * 2 * Math.PI / 3.4);
  B.pelvis.position.y = P.pelvisH * 0.99 + 0.004 * br;
  B.chest.scale.set(1 + 0.006 * br, 1 + 0.012 * br, 1);
  P.root.updateMatrixWorld(true);
  const ln = P.legInfo.n, lf = P.legInfo.f;
  legIK(P, 'n', ln.restX + 1.62, ln.ankleH); legIK(P, 'f', lf.restX + 1.62, lf.ankleH);
  // 视线跟着少年，慢 0.4 秒
  const kx = kidPlan(Math.max(0, t - 0.4)).x, end = kidS.done !== undefined ? ss((kidS.done - 0.4) / 0.6) : 0;
  B.neck.rotation.z = 0.04 + 0.05 * (cellX(0) - kx) / (CELL * 5) + 0.01 * br + 0.05 * end;
  B.chest.rotation.z = 0.012 * br;
  B.sh_n.rotation.z = -0.015 * br; B.el_n.rotation.z = -0.02;
  B.sh_f.rotation.z = 0.015 * br;
  B.case.rotation.z = -(worldAngle(B.wr_f) - B.case.rotation.z) + 0.035 * Math.sin(t * 2.3);
  B.ear_r.rotation.z = t > 2.6 && t < 2.85 ? -0.12 * Math.sin((t - 2.6) / 0.25 * Math.PI) : 0;
  B.tl0.rotation.z = 0.05 * Math.sin(t * 1.6); B.tl1.rotation.z = 0.06 * Math.sin(t * 1.6 - 0.7); B.tl2.rotation.z = 0.08 * Math.sin(t * 1.6 - 1.4);
  B.fringe.rotation.z = 0.02 * Math.sin(t * 1.3);
  // 少年跳完：大人眉毛松开往上，眯眼，像想起了什么
  const bk = P.k; B.brow_l.position.y += 6 * end * bk; B.brow_r.position.y += 6 * end * bk;
  B.brow_l.rotation.z = -0.05 * end; B.brow_r.rotation.z = 0.06 * end;
  const e = end > 0.5 ? 1 : blinkAt(t, [1.45, 3.15]);
  setFace(P, `e${e}_m0`);
}

// ---------- 环境：车棚灯下的浮尘、飘落的纸叶子、云慢慢走 ----------
function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,236,190,1)'); r.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const DUST_N = 90, dustR = rng(21), dustSeed = [];
for (let i = 0; i < DUST_N; i++) dustSeed.push([dustR() * 7 - 3.5, dustR() * 1.9 + 0.25, Z_SHED + 0.3 + dustR() * 2.4, dustR() * 6.28, 0.6 + dustR()]);
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(DUST_N * 3), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: softDot(), size: 0.035, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 }));
scene.add(dust);
function leafTex(col) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = col; g.beginPath(); g.moveTo(6, 40); g.quadraticCurveTo(50, -4, 122, 40); g.quadraticCurveTo(50, 84, 6, 40); g.fill();
  g.strokeStyle = 'rgba(90,40,10,0.55)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(10, 40); g.lineTo(118, 40); g.stroke();
  g.strokeStyle = 'rgba(255,240,210,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(6, 40); g.quadraticCurveTo(50, -4, 122, 40); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const LEAVES = [['#d98a2b', -3.2, 0.0, 0.4], ['#c9572a', -1.2, 1.3, 1.6], ['#e0b040', 0.6, 2.4, 0.7]].map(([col, x0, t0, z]) => {
  const tex = leafTex(col);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.07), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide }));
  m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.4 });
  scene.add(m); return { m, x0, t0, z };
});
function poseEnv(t) {
  const p = dustGeo.attributes.position;
  dustSeed.forEach(([x, y, z, ph, sp], i) => p.setXYZ(i, x + 0.08 * Math.sin(t * 0.5 * sp + ph), y + ((0.04 * t * sp + 0.05 * Math.sin(t * 0.7 + ph)) % 0.6), z));
  p.needsUpdate = true;
  for (const L of LEAVES) {
    const u = Math.max(0, t - L.t0), fall = 2.7 - u * 0.62;
    if (fall > 0.004) { L.m.position.set(L.x0 + u * 0.45 + 0.18 * Math.sin(u * 2.4), fall, L.z + 0.1 * Math.sin(u * 1.7));
      L.m.rotation.set(Math.sin(u * 3.1) * 1.2, u * 1.5, Math.sin(u * 2.4) * 0.8); }
    else { L.m.position.set(L.x0 + (2.7 / 0.62) * 0.45 + 0.18 * Math.sin((2.7 / 0.62) * 2.4), 0.004, L.z); L.m.rotation.set(-Math.PI / 2, 0, 0.6); }
  }
  skyMesh.position.x = 0.06 * t - 0.15;
}

// ---------- 脚下的接触阴影：每只脚一块，脚离地越高越淡 ----------
function blob() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, 'rgba(35,18,6,0.75)'); r.addColorStop(1, 'rgba(35,18,6,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2; scene.add(m); return m;
}
const blobs = [blob(), blob(), blob(), blob()];
function footBlobs(P, i0, z) {
  for (const [j, s] of [[0, 'n'], [1, 'f']]) {
    P.B['an_' + s].getWorldPosition(_v); const hgt = Math.max(0, _v.y - P.legInfo[s].ankleH);
    const b = blobs[i0 + j]; b.position.set(_v.x - 0.03, 0.006, z);
    b.scale.set(0.3 * (1 + hgt), 0.22 * (1 + hgt), 1); b.material.opacity = Math.max(0, 1 - hgt * 4);
  }
}

// ---------- 组装 ----------
const RIG = await (await fetch('rig2_out.json')).json();
const skyMesh = await backdrop('sky', 40); await backdrop('town', 16); await backdrop('shed', D_SHED);
const kid = await makePuppet2(RIG.kid);
const adult = await makePuppet2(RIG.adult);

const Q = new URLSearchParams(location.search);
window.renderAt = (t) => {
  const u = ss(t / 5);
  camera.position.set(CAM.x + 0.18 - 0.36 * u, CAM.y, CAM.z - 0.25 * u);
  camera.lookAt(camera.position.x * 0.6, CAM.y, -10);
  const ks = poseKid(kid, t); poseAdult(adult, t, ks); poseEnv(t);
  scene.updateMatrixWorld(true);
  footBlobs(kid, 0, HOP_Z + 0.05); footBlobs(adult, 2, 1.3);
  renderer.render(scene, camera); return true;
};
window.renderAt(Number(Q.get('t') || 0));
window.DBG = { THREE, camera, kid, adult, scene };
window.READY = true;
