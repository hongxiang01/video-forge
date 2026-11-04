// hand3d.js —— 三维的手（WebXR generic-hand，MIT，带骨骼的 SkinnedMesh）：按关节角度摆手型 + 前臂、旧白袖子、发黄的袖口。
// 模型的 25 个关节是 Armature 下平铺的兄弟节点（没有父子层级，打印核对过）：这里自己做正向运动学，从腕往指尖一节节算出位置和朝向，直接写进骨骼。
// 关节局部轴（打印核对过）：-Z 沿骨头指向指尖，+Y 指向手背，X = Y × Z。弯曲（往掌心）= 绕局部 X 转负角；张开 = 绕局部 Y 转。
// 「手框」：原点 = 掌心偏上（压在杖上的那一点），+Y = 手背朝上，-Z = 四指朝前；右手拇指在 -X，左手拇指在 +X。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon } from './lib3d.js';
import { C } from './pal.js';

const SEGS = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
const CH = { thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'] };
for (const f of ['index', 'middle', 'ring', 'pinky']) CH[f] = SEGS.map(s => `${f}-finger-${s}`);
const loader = new GLTFLoader();
const GLB = {};
for (const s of ['left', 'right']) GLB[s] = await loader.loadAsync(new URL(`./assets/hands/${s}.glb`, import.meta.url).href);   // 顶层 await：film.js 载入镜头模块时就等它载完

const D2R = Math.PI / 180, AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
const SC = 1.06;                                                   // 老师傅的手：整体比模型大一点
const THICK = { wrist: [1.12, 1.14], meta: [1.1, 1.12], f: [1.2, 1.14], thumb: [1.16, 1.12] };   // 骨骼局部 X（宽）、Y（厚）再放大 → 粗壮，不变长
// 模型 → 手框：右手 模型 (x, y, z) → (z, x, y)；左手（模型是右手的 X 镜像）→ (-z, -x, y)
const M4 = { R: [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], L: [0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1] };
const CONTACT = { R: [.012, -.012, .010], L: [-.012, -.012, .010] };   // 模型坐标里掌心偏上的掌面点（量过网格：掌面 x ≈ .012）

// side = 'L' | 'R'。返回 { root, pose(P), arm, aimArm(dir) }：root 放到世界里（位置 = 掌心压杖点，转动 = 手框朝向）
export function makeHand(side, light = 'warm') {
  const R = side === 'R', g = GLB[R ? 'right' : 'left'].scene;
  let mesh = null; const B = {};
  g.traverse(o => { if (o.isSkinnedMesh) mesh = o; if (o.isBone) B[o.name] = o; });
  mesh.material = toon(C('skin', light), { t: .1, hi: .92 }); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const rest = {}; for (const [k, b] of Object.entries(B)) rest[k] = { p: b.position.clone(), q: b.quaternion.clone() };
  for (const [k, b] of Object.entries(B)) {
    const t = k === 'wrist' ? THICK.wrist : k.startsWith('thumb') ? THICK.thumb : k.endsWith('metacarpal') ? THICK.meta : THICK.f;
    b.scale.set(t[0], t[1], 1);
  }
  const m4 = new THREE.Matrix4().set(...M4[side]), orient = new THREE.Group(), root = new THREE.Group();
  orient.quaternion.setFromRotationMatrix(m4); orient.scale.setScalar(SC);
  orient.position.copy(new THREE.Vector3(...CONTACT[side]).applyMatrix4(m4).multiplyScalar(-SC));
  orient.add(g); root.add(orient);

  // 正向运动学：bends[i] = 第 i 个关节自己的转动（局部系四元数），null = 不转
  function fk(names, bends) {
    let Pp = rest.wrist.p, Pq = rest.wrist.q, Np = rest.wrist.p.clone(), Nq = rest.wrist.q.clone();   // P = 父关节静止，N = 父关节摆好
    names.forEach((n, i) => {
      const r = rest[n], iq = Pq.clone().invert(), lp = r.p.clone().sub(Pp).applyQuaternion(iq), lq = iq.multiply(r.q);
      const p = Np.clone().add(lp.applyQuaternion(Nq)), q = Nq.clone().multiply(lq);
      if (bends[i]) q.multiply(bends[i]);
      B[n].position.copy(p); B[n].quaternion.copy(q);
      Pp = r.p; Pq = r.q; Np = p; Nq = q;
    });
  }
  const rx = a => new THREE.Quaternion().setFromAxisAngle(AX, -a * D2R);                  // 往掌心弯 a°
  const ry = a => new THREE.Quaternion().setFromAxisAngle(AY, (R ? a : -a) * D2R);        // 往拇指那边张 a°
  // P = { thumb: [指根张开°, 指根弯°, 第二节弯°, 末节弯°], index / middle / ring / pinky: [张开°（正 = 往拇指那边）, 掌指关节弯°, 中节弯°, 末节弯°] }
  function pose(P) {
    for (const [f, names] of Object.entries(CH)) {
      const [s, a, b, c] = P[f] || [0, 0, 0, 0];
      fk(names, f === 'thumb' ? [ry(s).multiply(rx(a)), rx(b), rx(c), null] : [null, ry(s).multiply(rx(a)), rx(b), rx(c), null]);
    }
  }
  pose({});

  // 前臂 + 袖子：沿局部 +Y 从腕往肘。皮肤短圆柱接住手腕截口，袖口一圈（发黄），袖身渐粗的圆柱（旧白厨师服）
  const arm = new THREE.Group();
  const cyl = (r0, r1, y0, y1, c, o) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 40, 1), toon(c, o)); m.position.y = (y0 + y1) / 2; m.castShadow = m.receiveShadow = true; arm.add(m); return m; };
  cyl(.025, .028, -.02, .07, C('skin', light), { t: .1 });
  cyl(.041, .042, .04, .072, C('cuff', light), { t: .05 });
  // 袖身：车削出的渐粗圆筒，半径带几道起伏 → 明暗交界线跟着弯，读得出布褶（靠袖口一段褶更密，布在腕上堆着）
  const sp = []; for (let i = 0; i <= 48; i++) { const u = i / 48, y = .07 + u * .73; sp.push(new THREE.Vector2(.040 + .024 * Math.min(1, u * 1.6) + (.0035 * Math.sin(u * 23 + 1) + .0025 * Math.sin(u * 70) * (1 - u)) * Math.min(1, u * 6), y)); }
  const sl = new THREE.Mesh(new THREE.LatheGeometry(sp, 40), toon(C('sleeve', light), { t: .05 })); sl.castShadow = sl.receiveShadow = true; arm.add(sl);
  const wp = new THREE.Vector3();
  function aimArm(dir) {   // dir = 世界坐标里腕 → 肘的方向
    root.updateMatrixWorld(true); B.wrist.getWorldPosition(wp);
    arm.position.copy(wp); arm.quaternion.setFromUnitVectors(AY, new THREE.Vector3(...dir).normalize());
  }
  return { root, pose, arm, aimArm, B };
}
