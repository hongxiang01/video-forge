// hand3d.js —— 三维的手（WebXR generic-hand，MIT，带骨骼的 SkinnedMesh）：按关节角度摆手型 + 前臂、袖子、袖口。
// 模型的 25 个关节是 Armature 下平铺的兄弟节点（没有父子层级，打印核对过）：这里自己做正向运动学，从腕往指尖一节节算出位置和朝向，直接写进骨骼。
// 关节局部轴（打印核对过）：-Z 沿骨头指向指尖，+Y 指向手背，X = Y × Z。弯曲（往掌心）= 绕局部 X 转负角；张开 = 绕局部 Y 转。
// 「手框」：原点 = 掌心偏上（压在杖上的那一点），+Y = 手背朝上，-Z = 四指朝前；右手拇指在 -X，左手拇指在 +X。
// 第 2 版：每次 makeHand 都克隆一份模型（同一边可以有好几只手）；手背细节画在皮肤材质里（按绑定姿势的顶点坐标算，跟着蒙皮走）：
//   指节褶（PIP 三道、DIP 两道，描边色细线）、指甲（末节手背一侧的圆角片，浅一档 + 一道小高光 + 细描边）、
//   老师傅：老人斑三块、青筋两条、指节略鼓；老主顾（who: 'customer'）：手瘦、指节更鼓、第二三指节冻红、藏青棉袄袖。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { toon, rgb, sun, draw3d } from './lib3d.js';
import { C } from './pal.js';
import { mix, canvas } from './lib/cel.js';

const SEGS = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
const CH = { thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'] };
for (const f of ['index', 'middle', 'ring', 'pinky']) CH[f] = SEGS.map(s => `${f}-finger-${s}`);
const loader = new GLTFLoader();
const GLB = {};
for (const s of ['left', 'right']) GLB[s] = await loader.loadAsync(new URL(`./assets/hands/${s}.glb`, import.meta.url).href);   // 顶层 await：film.js 载入镜头模块时就等它载完

const D2R = Math.PI / 180, AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
// 两套手：SC = 整体缩放；THICK = 骨骼局部 X（宽）、Y（厚）再放大；knuckle = 指节往外鼓（米，沿法线）；nail = 指甲在末节上的起止（占末节长）
const WHO = {
  master: { SC: 1.06, THICK: { wrist: [1.12, 1.14], meta: [1.1, 1.12], f: [1.2, 1.14], thumb: [1.16, 1.12] }, knuckle: .0011, nail: [.34, .84], skin: 'skin', sleeve: 'sleeve', cuff: 'cuff', old: true },
  customer: { SC: 1.0, THICK: { wrist: [.98, 1.0], meta: [.93, .98], f: [.9, .95], thumb: [.94, .97] }, knuckle: .0021, nail: [.32, .92], skin: 'guestSkin', sleeve: 'coat', cuff: 'coat', frost: true },
};
// 模型 → 手框：右手 模型 (x, y, z) → (z, x, y)；左手（模型是右手的 X 镜像）→ (-z, -x, y)
const M4 = { R: [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], L: [0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1] };
const CONTACT = { R: [.012, -.012, .010], L: [-.012, -.012, .010] };   // 模型坐标里掌心偏上的掌面点（量过网格：掌面 x ≈ .012）

// —— 皮肤材质里的细节（片元着色器，坐标 = 绑定姿势下的模型坐标 vBind，再变到各关节的局部系：a = 沿指向指尖、x = 横、y = 指背高）——
const PARS = /* glsl */`
varying vec3 vBind, vBindN;
uniform mat4 uF[9]; uniform vec4 uP[9];
uniform vec3 uNail, uNailHi, uSpot, uVein, uFrost, uLine; uniform vec2 uNailAB;
uniform mat4 uS[4]; uniform vec4 uSP[4]; uniform mat4 uVF; uniform vec4 uV[4]; uniform vec2 uVW;
uniform mat4 uK[5]; uniform vec4 uKN[5], uKP[5]; uniform vec3 uKal;
float sdRB(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float ln(float s, float w) { return step(abs(s) / max(fwidth(s), 1e-7), w); }   // 屏幕上约 2w px 宽的硬边线
`;
const BODY = /* glsl */`
float hLine = 0.;
#ifdef HAND_OLD
for (int i = 0; i < 4; i++) {                                   // 老人斑：手背上的不规则圆斑（硬边，淡）
  vec3 q = (uS[i] * vec4(vBind, 1.)).xyz; vec4 S = uSP[i]; float th = atan(q.z, q.x);
  float rr = S.x * (1. + .2 * sin(3. * th + S.y) + .1 * sin(5. * th + 2. * S.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, uSpot, S.z * step(length(q.xz), rr) * step(-.006, q.y));
}
{ vec3 q = (uVF * vec4(vBind, 1.)).xyz; float d = 1.;              // 青筋：中指掌骨系里的两条折线
  for (int i = 0; i < 4; i++) d = min(d, segD(q.xz, uV[i].xy, uV[i].zw));
  diffuseColor.rgb = mix(diffuseColor.rgb, uVein, step(d, uVW.x) * step(uVW.y, q.y)); }
for (int i = 0; i < 5; i++) {                                   // 老茧：掌面一侧的不规则圆块（callus 色：比亮面略黄、略浅，硬边）+ 外圈一道淡的描边色细线
  vec3 q = (uK[i] * vec4(vBind, 1.)).xyz, n = uKN[i].xyz; float h = dot(q, n);
  vec3 p = q - n * h, t1 = normalize(vec3(0., 0., 1.) - n * n.z), t2 = cross(n, t1);
  float th = atan(dot(p, t2), dot(p, t1)), ph = uKP[i].x;
  float dd = length(p) - uKN[i].w * (1. + .16 * sin(3. * th + ph) + .08 * sin(5. * th + 2. * ph));
  float on = step(-.0035, h) * step(.35, dot(normalize(mat3(uK[i]) * vBindN), n));   // 只画朝掌面的那一面（指蹼处掌面和手背只隔几毫米、拇指末节的指甲那面都排除）
  diffuseColor.rgb = mix(diffuseColor.rgb, uKal, uKP[i].y * step(dd, 0.) * on);
  hLine = max(hLine, .35 * ln(dd, .5) * on);
}
#endif
for (int i = 0; i < 9; i++) {
  vec3 q = (uF[i] * vec4(vBind, 1.)).xyz; vec4 P = uP[i];
  float a = -q.z, x = q.x, y = q.y, L = P.x, r = P.y, top = P.z, k2 = x * x / max(r, 1e-4);
  float back = step(top * .45, y), cr = 0.;
  if (P.w < .5) {                                                 // PIP：三道褶
    cr = max(cr, ln(a + .0027 - .3 * k2, .5) * step(abs(x), r * .40));
    cr = max(cr, ln(a - .3 * k2, .6) * step(abs(x), r * .62));
    cr = max(cr, ln(a - .0027 - .3 * k2, .5) * step(abs(x), r * .36));
  } else {                                                        // DIP / 拇指 IP：两道短褶 + 指甲
    cr = max(cr, ln(a + .0012 - .25 * k2, .5) * step(abs(x), r * .40));
    cr = max(cr, ln(a - .0012 - .25 * k2, .45) * step(abs(x), r * .28));
    vec2 c = vec2(0., L * (uNailAB.x + uNailAB.y) * .5), hs = vec2(r * .58, L * (uNailAB.y - uNailAB.x) * .5);
    float sd = sdRB(vec2(x, a) - c, hs, min(hs.x, hs.y) * .85), bk = step(top * .25, y);
    float nail = step(sd, 0.) * bk, nh = step(sdRB(vec2(x + hs.x * .4, a - c.y), vec2(hs.x * .14, hs.y * .5), hs.x * .13), 0.) * nail;
    diffuseColor.rgb = mix(diffuseColor.rgb, uNail, nail);
    diffuseColor.rgb = mix(diffuseColor.rgb, uNailHi, nh);
    hLine = max(hLine, ln(sd, .5) * bk);
    cr *= 1. - nail;
  }
#ifdef HAND_FROST
  float fr = pow(x / (r * .55), 2.) + pow((a + .0003) / (r * .62), 2.);   // 冻红：第二、三指节背上一块硬边红（长 0.6 × 指宽）
  diffuseColor.rgb = mix(diffuseColor.rgb, uFrost, step(fr, 1.) * step(top * .35, y) * (i == 4 ? 0. : 1.));   // 拇指不冻
#endif
  hLine = max(hLine, cr * back);
}
`;

// side = 'L' | 'R'；light = 'warm' | 'in' | 'out'；opt = { who: 'master' | 'customer' }
// 返回 { root, pose(P), arm, aimArm(dir, elbow°), reachArm(shoulder, opt), B, mesh, who }：root 放到世界里（位置 = 掌心压杖点，转动 = 手框朝向）
//   reachArm 见 sleeve() 里的说明：先摆好 root 和 pose，再调 reachArm（它从腕的世界位置解 IK）
export function makeHand(side, light = 'warm', opt = {}) {
  const R = side === 'R', who = WHO[opt.who] ? opt.who : 'master', V = WHO[who], g = skClone(GLB[R ? 'right' : 'left'].scene);
  let mesh = null; const B = {};
  g.traverse(o => { if (o.isSkinnedMesh) mesh = o; if (o.isBone) B[o.name] = o; });
  const geo = mesh.geometry = mesh.geometry.clone(), P = geo.attributes.position, N = geo.attributes.normal, sk = mesh.skeleton, idx = {};
  sk.bones.forEach((b, i) => { idx[b.name] = i; });
  const Fm = n => new THREE.Matrix4().multiplyMatrices(sk.boneInverses[idx[n]], mesh.bindMatrix);   // 绑定姿势的模型坐标 → 该关节局部系
  const org = n => new THREE.Vector3().applyMatrix4(Fm(n).invert());
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, dom = new Int16Array(P.count), q = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { let b = -1, w = -1; for (let k = 0; k < 4; k++) { const ww = SW.getComponent(i, k); if (ww > w) { w = ww; b = SI.getComponent(i, k); } } dom[i] = b; }
  const meas = (n, next) => { const M = Fm(n); let r = 0, top = 0; for (let i = 0; i < P.count; i++) if (dom[i] === idx[n]) { q.fromBufferAttribute(P, i).applyMatrix4(M); r = Math.max(r, Math.abs(q.x)); top = Math.max(top, q.y); } return { M, L: org(n).distanceTo(org(next)), r, top }; };
  // 指节往外鼓：MCP（手背一侧更鼓）、PIP、DIP 附近的顶点沿法线外推（只推本指的顶点）
  for (const [f, names] of Object.entries(CH)) {
    const chain = new Set(names.map(n => idx[n]));
    for (const j of (f === 'thumb' ? [1, 2] : [1, 2, 3])) {
      const M = Fm(names[j]), amp = V.knuckle * (f !== 'thumb' && j === 1 ? 1.3 : 1);
      for (let i = 0; i < P.count; i++) {
        if (!chain.has(dom[i])) continue;
        q.fromBufferAttribute(P, i).applyMatrix4(M);
        const w = Math.exp(-((q.z / .0062) ** 2)) * (j === 1 && q.y < 0 ? .25 : 1);
        if (w < .02) continue;
        nv.fromBufferAttribute(N, i); P.setXYZ(i, P.getX(i) + nv.x * amp * w, P.getY(i) + nv.y * amp * w, P.getZ(i) + nv.z * amp * w);
      }
    }
  }
  P.needsUpdate = true; geo.computeBoundingSphere();
  // 细节用到的 9 个关节系：四指 PIP（中节起点）+ 五指末节（DIP / 拇指 IP）
  const DJ = [...['index', 'middle', 'ring', 'pinky'].map(f => [`${f}-finger-phalanx-intermediate`, `${f}-finger-phalanx-distal`, 0]),
    ['thumb-phalanx-distal', 'thumb-tip', 1], ...['index', 'middle', 'ring', 'pinky'].map(f => [`${f}-finger-phalanx-distal`, `${f}-finger-tip`, 1])];
  const mj = DJ.map(([n, nx, k]) => ({ ...meas(n, nx), k }));
  const sc = C(V.skin, light), col = h => new THREE.Color(h);
  const U = {
    uF: { value: mj.map(m => m.M) }, uP: { value: mj.map(m => new THREE.Vector4(m.L, m.r, m.top, m.k)) },
    uNail: { value: col(mix(sc.f, '#F6E4D0', .42)) }, uNailHi: { value: col(mix(sc.f, '#FFF6E6', .78)) }, uSpot: { value: col(mix(sc.f, '#9A5E40', .4)) },
    uVein: { value: col(mix(sc.f, '#7E6E92', .26)) }, uFrost: { value: col(who === 'customer' ? C('frostbite').f : sc.f) }, uLine: { value: col(sc.l) }, uNailAB: { value: new THREE.Vector2(...V.nail) },
    uS: { value: [] }, uSP: { value: [] }, uVF: { value: new THREE.Matrix4() }, uV: { value: [] }, uVW: { value: new THREE.Vector2(.0006, 0) },
  };
  // 老人斑：[掌骨, 横 x, 沿 a, 半径, 相位, 浓度]（米，绑定姿势）；青筋：中指掌骨系里的两条折线 (x, z = -a)
  const meta = n => meas(`${n}-finger-metacarpal`, `${n}-finger-phalanx-proximal`);
  for (const [n, x, a, r, ph, k] of [['middle', .006, .038, .0040, 0, .7], ['ring', -.002, .026, .0028, 2, .6], ['index', -.004, .05, .0022, 4, .5], ['ring', .005, .052, .0015, 1, .45]]) {
    const m = meta(n); U.uS.value.push(new THREE.Matrix4().makeTranslation(-x, -m.top, a).multiply(m.M)); U.uSP.value.push(new THREE.Vector4(r, ph, k, 0));
  }
  const mm = meta('middle'); U.uVF.value = mm.M; U.uVW.value.y = mm.top - .0075;
  for (const s of [[-.003, -.004, -.007, -.02], [-.007, -.02, -.012, -.036], [-.007, -.02, .003, -.033], [.003, -.033, .008, -.047]]) U.uV.value.push(new THREE.Vector4(...s));
  // 老茧（只画老师傅，着色器里在 HAND_OLD 下）：掌面一侧五块 —— 食指、中指、无名指根部的肉垫，食指中节靠拇指一侧（握刀磨的），拇指末节指腹。
  // 中心 = 该关节系里、沿骨头 a0 附近（掌面那几块还限横向 |x| < 1.5 mm，压在指骨轴线上）、往 dv 方向最突出的那个顶点（绑定姿势）；dv = -Y 是掌面，侧面那块往拇指那侧偏掌面
  // a0：aa < 0 → 就是 aa 米（近节指骨系里关节往掌心退 3 mm，压在指骨轴线上 → 正好在掌指关节下面的肉垫上）；0 < aa ≤ 1 → 骨长的这一比例
  const ts = Math.sign(org('thumb-phalanx-proximal').applyMatrix4(Fm('index-finger-phalanx-intermediate')).x) || 1, dK = new THREE.Vector3();
  Object.assign(U, { uK: { value: [] }, uKN: { value: [] }, uKP: { value: [] }, uKal: { value: col(C('callus', light).f) } });
  for (const [n, nx, f, aa, dv, rad, ph] of [
    ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index', -.003, [0, -1, 0], .0042, 0],
    ['middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle', -.003, [0, -1, 0], .0046, 2],
    ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring', -.003, [0, -1, 0], .0035, 4],
    ['index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index', .5, [ts * .8, -.6, 0], .0032, 1],
    ['thumb-phalanx-distal', 'thumb-tip', 'thumb', .5, [0, -1, 0], .0036, 3]]) {
    const m = meas(n, nx), set = new Set(CH[f].map(b => idx[b])), a0 = aa < 0 ? aa : m.L * aa, c = new THREE.Vector3(); let best = -Infinity;
    dK.set(...dv).normalize();
    for (const xw of [.0015, .003, .006]) {                       // 轴线上找不到顶点就放宽横向窗口
      for (let i = 0; i < P.count; i++) {
        if (!set.has(dom[i])) continue;
        q.fromBufferAttribute(P, i).applyMatrix4(m.M);
        if (Math.abs(-q.z - a0) > .003 || (!dv[0] && Math.abs(q.x) > xw)) continue;
        const s = q.dot(dK); if (s > best) { best = s; c.copy(q); }
      }
      if (best > -Infinity) break;
    }
    U.uK.value.push(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z).multiply(m.M)); U.uKN.value.push(new THREE.Vector4(dK.x, dK.y, dK.z, rad)); U.uKP.value.push(new THREE.Vector4(ph, .9, 0, 0));
  }
  const mat = toon(sc, { t: .1, hi: .92 }), base = mat.onBeforeCompile, DEF = (V.old ? '#define HAND_OLD\n' : '') + (V.frost ? '#define HAND_FROST\n' : '');
  mat.onBeforeCompile = sh => {
    base(sh); Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind, vBindN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position; vBindN = normal;');
    sh.fragmentShader = DEF + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PARS).replace('#include <color_fragment>', '#include <color_fragment>\n' + BODY)
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, uLine, hLine);\n#include <opaque_fragment>');
  };
  const ck = mat.customProgramCacheKey(); mat.customProgramCacheKey = () => `${ck}_hand_${who}`;
  mesh.material = mat; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const rest = {}; for (const [k, b] of Object.entries(B)) rest[k] = { p: b.position.clone(), q: b.quaternion.clone() };
  for (const [k, b] of Object.entries(B)) {
    const t = k === 'wrist' ? V.THICK.wrist : k.startsWith('thumb') ? V.THICK.thumb : k.endsWith('metacarpal') ? V.THICK.meta : V.THICK.f;
    b.scale.set(t[0], t[1], 1);
  }
  const m4 = new THREE.Matrix4().set(...M4[side]), orient = new THREE.Group(), root = new THREE.Group();
  orient.quaternion.setFromRotationMatrix(m4); orient.scale.setScalar(V.SC);
  orient.position.copy(new THREE.Vector3(...CONTACT[side]).applyMatrix4(m4).multiplyScalar(-V.SC));
  orient.add(g); root.add(orient);

  // 正向运动学：bends[i] = 第 i 个关节自己的转动（局部系四元数），null = 不转
  function fk(names, bends) {
    let Pp = rest.wrist.p, Pq = rest.wrist.q, Np = rest.wrist.p.clone(), Nq = rest.wrist.q.clone();   // P = 父关节静止，N = 父关节摆好
    names.forEach((n, i) => {
      const r = rest[n], iq = Pq.clone().invert(), lp = r.p.clone().sub(Pp).applyQuaternion(iq), lq = iq.multiply(r.q);
      const p = Np.clone().add(lp.applyQuaternion(Nq)), qq = Nq.clone().multiply(lq);
      if (bends[i]) qq.multiply(bends[i]);
      B[n].position.copy(p); B[n].quaternion.copy(qq);
      Pp = r.p; Pq = r.q; Np = p; Nq = qq;
    });
  }
  const rx = a => new THREE.Quaternion().setFromAxisAngle(AX, -a * D2R);                  // 往掌心弯 a°
  const ry = a => new THREE.Quaternion().setFromAxisAngle(AY, (R ? a : -a) * D2R);        // 往拇指那边张 a°
  // P = { thumb: [指根张开°, 指根弯°, 第二节弯°, 末节弯°], index / middle / ring / pinky: [张开°（正 = 往拇指那边）, 掌指关节弯°, 中节弯°, 末节弯°] }
  function pose(Pz) {
    for (const [f, names] of Object.entries(CH)) {
      const [s, a, b, c] = Pz[f] || [0, 0, 0, 0];
      fk(names, f === 'thumb' ? [ry(s).multiply(rx(a)), rx(b), rx(c), null] : [null, ry(s).multiply(rx(a)), rx(b), rx(c), null]);
    }
  }
  pose({});
  const { arm, aimArm, reachArm } = sleeve(root, B, who, light, V.SC, R);
  return { root, pose, arm, aimArm, reachArm, B, mesh, who };
}
// 一对手：loadHands({ who: 'customer', light: 'warm' }) → { L, R }
export const loadHands = (opt = {}) => ({ L: makeHand('L', opt.light || 'warm', opt), R: makeHand('R', opt.light || 'warm', opt) });

// —— 袖子的硬边褶影带：贴图（逐通道 = 影色 / 亮色，≤ 1），u = 绕一圈、v = 从袖口往肘（不翻转）——
function foldTex(c, cu, ve) {
  const [cv, x] = canvas(512, 1024), F = rgb(c.f), S = rgb(c.s), K = S.map((v, i) => Math.round(255 * Math.min(1, v / Math.max(F[i], 1e-3))));
  x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 1024); x.fillStyle = `rgb(${K.join(',')})`;
  const wedge = (u0, v0, u1, v1, w) => {   // 两头尖的斜带（像素）
    const dx = u1 - u0, dy = v1 - v0, l = Math.hypot(dx, dy), nx = -dy / l * w, ny = dx / l * w;
    x.beginPath(); x.moveTo(u0, v0); x.quadraticCurveTo((u0 + u1) / 2 + nx, (v0 + v1) / 2 + ny, u1, v1); x.quadraticCurveTo((u0 + u1) / 2 - nx * .2, (v0 + v1) / 2 - ny * .2, u0, v0); x.fill();
    for (const o of [-512, 512]) { x.save(); x.translate(o, 0); x.beginPath(); x.moveTo(u0, v0); x.quadraticCurveTo((u0 + u1) / 2 + nx, (v0 + v1) / 2 + ny, u1, v1); x.quadraticCurveTo((u0 + u1) / 2 - nx * .2, (v0 + v1) / 2 - ny * .2, u0, v0); x.fill(); x.restore(); }
  };
  if (!cu) {
    for (let k = 0; k < 4; k++) { const u = k * 128 + 30; wedge(u, 36 + (k % 2) * 18, u + 150, 66 + (k % 2) * 14, 24); wedge(u + 70, 112 + (k % 2) * 14, u + 180, 146 + (k % 2) * 10, 16); }   // 袖口上方两道折痕（布堆在腕上）
    for (let k = 0; k < 3; k++) { const u = k * 171 + 60; wedge(u, 200 + k * 30, u + 90, 420 + k * 40, 28); }                                                                            // 前臂上顺着拉开的长褶（宽、少）
  } else for (let k = 0; k < 8; k++) { const u = k * 64 + 10; wedge(u, 40 + (k % 3) * 20, u + 50, 150 + (k % 2) * 30, 8); }                                    // 棉袄：短而鼓的褶
  // ve（只有 reachArm 的袖子给）= 肘在 v 上的位置：肘窝在 u = 0（车削的 +Z，reachArm 把它转到弯的里侧），几道布堆出来的硬边褶从肘窝往两边散开
  if (ve != null) {
    const V = ve * 1024, s = cu ? 1.25 : 1;
    for (const [u0, v0, u1, v1, w] of [[-96, -40, 4, -12, 18], [92, -30, -6, -4, 16], [-84, 14, 6, 2, 16], [88, 38, -4, 16, 14], [-60, 54, 2, 30, 10], [56, -64, 0, -34, 10]])
      wedge(512 + u0 * s, V + v0 * s, 512 + u1 * s, V + v1 * s, w * s);
  }
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}

// —— 前臂 + 袖子：沿局部 +Y 从腕往肘。皮肤短圆柱接住手腕截口，袖口一圈，袖身车削（半径起伏 → 明暗交界线跟着弯）+ 硬边褶影带。
//    aimArm(dir, elbow = 0)：dir = 世界里腕 → 肘的方向；elbow = 肘弯角（°，离腕 30 cm 处往世界上方弯；0 = 直，和第 1 版一样）
function sleeve(root, B, who, light, SC = 1, R = true) {
  const arm = new THREE.Group(), cu = who === 'customer';
  const cyl = (r0, r1, y0, y1, c, o, open = false) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 40, 1, open), toon(c, o)); m.position.y = (y0 + y1) / 2; m.castShadow = m.receiveShadow = true; arm.add(m); return m; };
  cyl(cu ? .021 : .025, cu ? .024 : .028, -.02, .07, C(cu ? 'guestSkin' : 'skin', light), { t: .1 });
  const cs = C(cu ? 'coat' : 'sleeve', light);
  if (cu) cyl(.05, .053, .03, .075, C('coat', light), { t: .05 }); else cyl(.041, .042, .04, .072, C('cuff', light), { t: .05 });
  // 袖口上沿的斜面（只在 reachArm 时显示）：袖口平顶只露出袖身外 1.8 mm 的一圈，胳膊横着看时这圈侧对镜头、不到 1 px，
  //   内线那一遍只在零星像素上碰到它 → 接缝成了点状虚线。换成往肘那边斜 60° 的一圈锥面：横着看也有几 px 宽，两条折边各出一条整齐的内线；里口收进袖身
  const [cR, cY] = cu ? [.053, .075] : [.042, .072];
  const bev = cyl(cR, cR - .0025, cY, cY + .0025 / Math.tan(60 * D2R), C(cu ? 'coat' : 'cuff', light), { t: .05 }, true); bev.visible = false;
  const prof = cu ? u => .051 + .018 * Math.min(1, u * 1.5) + .0055 * Math.sqrt(Math.abs(Math.sin(u * 26))) * Math.min(1, u * 8)   // 棉袄：一节节鼓起来
    : u => .040 + .024 * Math.min(1, u * 1.6) + (.0035 * Math.sin(u * 23 + 1) + .0025 * Math.sin(u * 70) * (1 - u)) * Math.min(1, u * 6);
  const sp = []; for (let i = 0; i <= 72; i++) { const u = i / 72; sp.push(new THREE.Vector2(prof(u), (cu ? .072 : .07) + u * .73)); }
  const sl = new THREE.Mesh(new THREE.LatheGeometry(sp, 48), toon(cs, { t: .05, map: foldTex(cs, cu) })); sl.castShadow = sl.receiveShadow = true; arm.add(sl);
  const P0 = sl.geometry.attributes.position.array.slice(), N0 = sl.geometry.attributes.normal.array.slice();
  const wp = new THREE.Vector3(), up = new THREE.Vector3(), ax = new THREE.Vector3(), qv = new THREE.Quaternion(), v = new THREE.Vector3(), YE = .30;
  let last = 0, RA = null, reach = false;
  function aimArm(dir, elbow = 0) {   // dir = 世界坐标里腕 → 肘的方向
    if (reach) { sl.geometry = RA.geo0; sl.material = RA.mat0; bev.visible = false; reach = false; }   // 从 reachArm 切回来：换回原来那条袖身（它没被 reachArm 动过）
    root.updateMatrixWorld(true); B.wrist.getWorldPosition(wp);
    arm.position.copy(wp); arm.quaternion.setFromUnitVectors(AY, new THREE.Vector3(...dir).normalize());
    if (!elbow && !last) return;
    last = elbow;
    up.set(0, 1, 0).applyQuaternion(arm.quaternion.clone().invert()); up.y = 0;
    if (up.lengthSq() < 1e-6) up.set(0, 0, 1);
    ax.crossVectors(AY, up.normalize()).normalize();
    const Pa = sl.geometry.attributes.position, Na = sl.geometry.attributes.normal;
    for (let i = 0; i < Pa.count; i++) {
      const y = P0[i * 3 + 1], k = Math.min(1, Math.max(0, (y - YE + .04) / .08)), th = elbow * D2R * k;
      qv.setFromAxisAngle(ax, th);
      v.set(P0[i * 3], y - YE, P0[i * 3 + 2]).applyQuaternion(qv); Pa.setXYZ(i, v.x, v.y + YE, v.z);
      v.set(N0[i * 3], N0[i * 3 + 1], N0[i * 3 + 2]).applyQuaternion(qv); Na.setXYZ(i, v.x, v.y, v.z);
    }
    Pa.needsUpdate = Na.needsUpdate = true; sl.geometry.computeBoundingSphere();
  }

  // —— reachArm（第 3 版）：两段 IK 解出肘，袖子在肘处按真正的弯曲轴弯过去，上臂一直接到肩 ——
  // 只在第一次调用时建：同一条袖身轮廓的加密版（绕 64 段、轴向 292 段）+ 带肘窝褶的贴图；aimArm 用的那条袖身和贴图一点不动。
  const LF = .26 * SC, LU = .30 * SC, Y0 = cu ? .072 : .07, YL = .73;
  function kit() {
    if (RA) return RA;
    const n = 292, sp2 = []; for (let i = 0; i <= n; i++) { const u = i / n; sp2.push(new THREE.Vector2(prof(u), Y0 + u * YL)); }
    const geo = new THREE.LatheGeometry(sp2, 64);
    let rm = 0; for (const p of sp2) if (Math.abs(p.y - LF) < .12) rm = Math.max(rm, p.x);
    return (RA = { geo, n, P: geo.attributes.position.array.slice(), mat: toon(cs, { t: .05, map: foldTex(cs, cu, (LF - Y0) / YL) }), geo0: sl.geometry, mat0: sl.material, rm });
  }
  const Wv = new THREE.Vector3(), Sv = new THREE.Vector3(), Ev = new THREE.Vector3(), fu = new THREE.Vector3(), uu = new THREE.Vector3(), bb = new THREE.Vector3(), pl = new THREE.Vector3(), xx = new THREE.Vector3(), MB = new THREE.Matrix4();
  // shoulder = 世界里肩关节 [x, y, z]；opt.pole = 肘尖朝向（世界方向），默认 [±.4, -1, 0]：往下、略往外（右手 +X、左手 -X）
  // 返回 { elbow: [x, y, z]（世界）, straight }：straight = 够不着肩 → 胳膊拉直指向肩，袖子沿这条直线拉长接到肩
  function reachArm(shoulder, opt = {}) {
    const K = kit();
    root.updateMatrixWorld(true); B.wrist.getWorldPosition(Wv); Sv.set(...shoulder);
    const d = Sv.distanceTo(Wv); uu.subVectors(Sv, Wv).normalize();
    pl.set(...(opt.pole || [R ? .4 : -.4, -1, 0])); pl.addScaledVector(uu, -pl.dot(uu));
    if (pl.lengthSq() < 1e-8) pl.set(1, 0, 0).addScaledVector(uu, -uu.x);
    pl.normalize();
    const straight = d >= LF + LU - 1e-4, dd = Math.max(d, Math.abs(LU - LF) + .01);
    const a = straight ? LF : (LF * LF - LU * LU + dd * dd) / (2 * dd), h = straight ? 0 : Math.sqrt(Math.max(0, LF * LF - a * a));
    Ev.copy(Wv).addScaledVector(uu, a).addScaledVector(pl, h);
    fu.subVectors(Ev, Wv).normalize();                                   // 前臂：腕 → 肘
    const lu = Sv.distanceTo(Ev); uu.subVectors(Sv, Ev).normalize();     // 上臂：肘 → 肩
    const th = Math.acos(Math.min(1, Math.max(-1, fu.dot(uu))));
    bb.copy(uu).addScaledVector(fu, -uu.dot(fu));                        // 弯的里侧（肘窝）
    if (bb.lengthSq() < 1e-8) bb.copy(pl).negate();
    bb.normalize(); xx.crossVectors(fu, bb);                             // 弯曲轴 = 前臂 × 上臂
    MB.makeBasis(xx, fu, bb); arm.position.copy(Wv); arm.quaternion.setFromRotationMatrix(MB);   // 袖子局部：+Y = 前臂，+Z = 肘窝（贴图 u = 0），+X = 弯曲轴
    // 肘处是一段圆弧（倒圆角，半径 Rb ≥ 袖子最粗处 → 里侧不翻折）；圆弧太长吃掉袖口时才缩小 Rb
    const tq = Math.tan(th / 2); let Rb = K.rm * 1.04;
    const tm = Math.min(.62 * (LF - Y0), .6 * lu); if (Rb * tq > tm) Rb = tm / tq;
    const t = Rb * tq, y0 = LF - t, y1 = y0 + Rb * th, Lup = lu - t, yE = Y0 + YL, ks = Math.max(1, Lup / (yE - y1));
    const ct = Math.cos(th), st = Math.sin(th), bend = Math.min(1, th / (Math.PI / 2));
    const Pa = K.geo.attributes.position, P = K.P;
    for (let i = 0; i < Pa.count; i++) {
      let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const r = Math.hypot(x, z), ca = r > 1e-6 ? z / r : 0, g = Math.exp(-(((y - LF) / .04) ** 2)) * bend;
      // 肘尖一侧（-Z）往外顶一点 → 轮廓圆；肘窝一侧（+Z）布往里收、堆起两道小棱
      const dr = .006 * SC * g * Math.max(0, -ca) ** 1.5 + .0035 * SC * bend * Math.max(0, ca) ** 2 * (Math.max(0, Math.cos((y - LF) / .011 * Math.PI)) ** 3 * Math.exp(-(((y - LF) / .03) ** 2)) - .4 * Math.exp(-(((y - LF) / .02) ** 2)));
      if (r > 1e-6) { x *= 1 + dr / r; z *= 1 + dr / r; }
      if (y > y0 && y <= y1) {                                           // 圆弧段：绕弯曲轴（局部 X）转 φ
        const ph = (y - y0) / Rb, rho = Math.max(Rb - z, .08 * Rb);
        Pa.setXYZ(i, x, y0 + rho * Math.sin(ph), Rb - rho * Math.cos(ph));
      } else if (y > y1) {                                               // 上臂：直的，接到肩；多出来的袖身收在肩上，够不着时拉长
        const s = Math.min((y - y1) * ks, Lup);
        Pa.setXYZ(i, x, y0 + Rb * st + s * ct - z * st, Rb - Rb * ct + s * st + z * ct);
      } else Pa.setXYZ(i, x, y, z);
    }
    K.geo.computeVertexNormals();
    const Na = K.geo.attributes.normal, nn = K.n + 1, sg = 64 * nn;   // 车削的接缝（u = 0 和 u = 1 两列顶点）法线取平均，免得接缝处明暗断开
    for (let j = 0; j < nn; j++) { v.set(Na.getX(j) + Na.getX(sg + j), Na.getY(j) + Na.getY(sg + j), Na.getZ(j) + Na.getZ(sg + j)).normalize(); Na.setXYZ(j, v.x, v.y, v.z); Na.setXYZ(sg + j, v.x, v.y, v.z); }
    Pa.needsUpdate = Na.needsUpdate = true; K.geo.computeBoundingSphere();
    if (!reach) { sl.geometry = K.geo; sl.material = K.mat; bev.visible = true; reach = true; }
    return { elbow: Ev.toArray(), straight };
  }
  return { arm, aimArm, reachArm };
}

// —— 常用手型（度）。grip(r) 按圆柱半径算：每节弯角 ≈ 这一节在「圆柱半径 + 半个指厚」的圆上对应的圆心角 ——
// 圆柱沿手框 X（横过掌面），贴着四指根部那一截；拳 = grip(杖) + 拇指压在食指中指上。
const gripF = (r = .0225) => {
  const Rr = r + .0095, ch = l => 2 * Math.asin(Math.min(.99, l / (2 * Rr))) / D2R, p = ch(.046), i = ch(.027), d = ch(.023);
  const f = (s, k) => [s, Math.min(90, (p * .55 + 6) * k), Math.min(100, (p + i) / 2 * k), Math.min(80, (i + d) / 2 * k)];
  return { index: f(5, .96), middle: f(0, 1), ring: f(-4, 1.04), pinky: f(-9, 1.08) };
};
export const POSES3D = {
  relaxed: { thumb: [0, 10, 10, 8], index: [6, 14, 18, 10], middle: [1, 17, 22, 12], ring: [-4, 20, 26, 13], pinky: [-9, 24, 30, 14] },
  flat: { thumb: [-6, 4, 0, -4], index: [5, 2, 2, 0], middle: [0, 2, 2, 0], ring: [-4, 2, 2, 0], pinky: [-8, 3, 2, 0] },
  press: { thumb: [0, 22, 16, 10], index: [5, 28, 34, 12], middle: [0, 28, 34, 12], ring: [-3, 30, 36, 12], pinky: [-6, 55, 70, 40] },
  grip: (r = .0225) => ({ thumb: [-12, 32, 26, 18], ...gripF(r) }),
  pinch: { thumb: [-10, 30, 18, 16], index: [8, 36, 40, 22], middle: [2, 34, 40, 24], ring: [-3, 55, 70, 40], pinky: [-7, 60, 75, 42] },
  claw: { thumb: [-14, 30, 22, 12], index: [3, 18, 78, 38], middle: [0, 18, 82, 38], ring: [-2, 22, 82, 38], pinky: [-5, 26, 82, 38] },
  cup: { thumb: [18, 6, 4, 0], index: [5, 16, 16, 8], middle: [0, 16, 16, 8], ring: [-3, 17, 16, 8], pinky: [-7, 20, 18, 8] },
  fist: { thumb: [-18, 44, 40, 30], ...gripF(.0225) },
  thumbOnRim: { thumb: [12, 2, -4, -6], ...gripF(.07) },
  release: { thumb: [14, -2, -6, -6], index: [11, -6, 0, 0], middle: [2, -6, 0, 0], ring: [-7, -5, 0, 0], pinky: [-15, -4, 0, 0] },
};

// —— 设定图：?test=hand3d&raw=1。t = 0 → 全图（上两排老师傅十个手型，下排老主顾三只 + 老师傅带袖子两只）；t = k（1–15）→ 放大看第 k 格 ——
const CELLS = [
  ['relaxed', 'R'], ['flat', 'L'], ['press', 'R'], ['grip', 'L'], ['pinch', 'R'],
  ['claw', 'L'], ['cup', 'R'], ['fist', 'L'], ['thumbOnRim', 'R'], ['release', 'L'],
  ['relaxed', 'R', 'customer'], ['cup', 'L', 'customer'], ['thumbOnRim', 'R', 'customer'], ['relaxed', 'R', 'master', 1], ['press', 'L', 'master', 1],
  // 第 4 排（全图里在画框外，只放大看：t = 16、17）：reachArm 带肘弯，肩在手的后上方、往外
  ['press', 'R', 'master', 'reach'], ['grip', 'L', 'customer', 'reach'],
  // 同一排中间（t = 18、19）：老师傅手心朝上，看掌面的老茧
  ['flat', 'R', 'master', 0, 'palm'], ['relaxed', 'L', 'master', 0, 'palm'],
];
let TS = null;
export function test(g, e, t) {
  const EL = 58 * D2R, HW = .64, HH = .36;
  if (!TS) {
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-HW, HW, HH, -HH, .05, 20);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ color: new THREE.Color('#4A3550'), opacity: .4 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.045; floor.receiveShadow = true; floor.userData.bg = true; floor.material.userData.outlineParameters = { visible: false };
    scene.add(floor);
    const hands = CELLS.map(([p, s, who, arm, palm], i) => {
      const h = makeHand(s, 'warm', { who }), c = i % 5, r = Math.floor(i / 5);
      h.at = [(c - 2) * .256, 0, (r - 1) * .24 / Math.sin(EL) + .03];
      h.root.position.set(...h.at); h.root.rotation.set(p === 'cup' ? 0 : 0, (s === 'R' ? 1 : -1) * 10 * D2R, p === 'cup' ? Math.PI * (s === 'R' ? -.8 : .8) : 0, 'YXZ');
      if (palm) { h.at = [s === 'R' ? -.2 : .2, .01, .95]; h.root.position.set(...h.at); h.root.rotation.set(0, (s === 'R' ? -1 : 1) * 10 * D2R, Math.PI, 'YXZ'); }   // 绕手框 Z 翻 180°：手心朝上
      const P = POSES3D[p]; h.pose(typeof P === 'function' ? P() : P);
      scene.add(h.root);
      if (arm === 'reach') {   // 两格各放一边（离开前三排），肩在外侧偏后上方；肘尖朝近侧（+Z）、略往下 → 从上往下看能看出弯
        const sd = s === 'R' ? 1 : -1; h.at = [-sd * .78, 0, .95]; h.root.position.set(...h.at);
        scene.add(h.arm); const res = h.reachArm([h.at[0] + sd * .36, h.at[1] + .16, h.at[2] + .26], { pole: [sd * .3, -.45, 1] });
        h.zc = new THREE.Vector3(...res.elbow).lerp(new THREE.Vector3(...h.at), .5); h.zf = 1.5;
      } else if (arm) { scene.add(h.arm); h.aimArm([s === 'R' ? .2 : -.2, .3, 1], p === 'relaxed' ? 28 : 0); }
      return h;
    });
    sun(scene, [-0.55, 1.0, -0.6], 1.1, [0, 0, 0]);
    TS = { scene, cam, hands };
  }
  const { scene, cam, hands } = TS, k = Math.round(t), hk = k >= 1 && k <= hands.length ? hands[k - 1] : null, z = hk ? hk.zf || 2.6 : 1;
  const ctr = hk ? (hk.zc ? hk.zc.clone() : new THREE.Vector3(...hk.at).add(new THREE.Vector3(0, .02, -.03))) : new THREE.Vector3(0, 0, 0);
  Object.assign(cam, { left: -HW / z, right: HW / z, top: HH / z, bottom: -HH / z }); cam.updateProjectionMatrix();
  cam.position.set(ctr.x, ctr.y + 3 * Math.sin(EL), ctr.z + 3 * Math.cos(EL)); cam.lookAt(ctr);
  g.fillStyle = '#E9DCC4'; g.fillRect(0, 0, 1920, 1080);
  g.strokeStyle = 'rgba(120,90,70,.18)'; g.lineWidth = 1; for (let x = 0; x <= 1920; x += 384) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1080); g.stroke(); } for (let y = 0; y <= 1080; y += 360) { g.beginPath(); g.moveTo(0, y); g.lineTo(1920, y); g.stroke(); }
  draw3d(g, e, scene, cam);
  g.font = '600 22px "PingFang SC", sans-serif'; g.fillStyle = '#3A2418'; g.textAlign = 'left';
  CELLS.forEach(([p, s, who, arm, palm], i) => {
    if (z > 1 && i !== k - 1) return;
    const v = new THREE.Vector3(...hands[i].at).project(cam), x = (v.x + 1) / 2 * 1920, y = (1 - v.y) / 2 * 1080;
    g.fillText(`${i + 1} ${p} · ${s}${who ? ' · ' + who : ''}${arm === 'reach' ? ' · 袖 · reachArm 肘弯' : arm ? ' · 袖' : ''}${palm ? ' · 手心朝上（老茧）' : ''}`, z > 1 ? 40 : x - 180, z > 1 ? 50 : y - 150);
  });
  return { scan: 0, glow: 0 };
}
