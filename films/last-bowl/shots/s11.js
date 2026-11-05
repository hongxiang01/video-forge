// S11 —— 同 S10 构图（接横摇终点 16 px）· 三渲二（TREATMENT §4 S11、§4.2、§5 30.0–33.0）。2D 版原样备份在 s11_2d.js。
// 回到平涂（不盖 harmony）：空碗（不放汤面，露白瓷内壁），一双筷子横搁在碗口（细头朝左、只探出碗沿一点，师傅的拇指从这边压上来；粗头往老主顾那边伸），
// 老主顾那侧（右）台面三枚分币，没有热气（锅已关火）。30.0–32.25 一动不动（30.0–30.75 全片第一次真静默）。
// 32.25 师傅右手从左入画（12 fps 3 张，从稍高处弧线落下，手指边走边收），32.50 停在碗边 9 个输出帧：四指虚靠碗壁、拇指悬在碗沿上方（犹豫这一下）；
// 32.875 拇指压上碗沿（连筷子一起压住）、四指托紧，碗从右脚边斜着离台（左边先起），往左上端走，33.0 在动作中切走（接 S12）。碗离台露出一圈淡淡的碗底水印。
// 场景复用 s10.js：sceneS10()（柜台、后墙、碗、灯）+ poseS10({ empty, master: false })（空碗、不放 S10 的手）+ frameS10()（机位、横摇、渲染）。
// S11 自己的东西（筷子、分币、水印、师傅右手和袖子）放在一个组里加进 S10 的场景，平时藏着；渲完把 S10 物件的可见性和碗的位置原样还回去（先渲 S11 再渲 S10 也不串）。
import * as THREE from 'three';
import { canvas } from '../lib/cel.js';
import { C } from '../pal.js';
import { toon } from '../lib3d.js';
import { makeHand } from '../hand3d.js';
import { sceneS10, poseS10, frameS10, onBowl } from './s10.js';

const D2R = Math.PI / 180, PAN = 16, LIP = .0794;                     // LIP = 碗唇最高点（s10 的车削剖面）
const lerpPose = (A, B, k) => Object.fromEntries(Object.keys(A).map(f => [f, A[f].map((v, i) => v + (B[f][i] - v) * k)]));
const mesh = (geo, c, o) => { const m = new THREE.Mesh(geo, toon(c, o)); m.castShadow = m.receiveShadow = true; return m; };

// 分币面：白底（乘材质色）+ 一圈压印边 + 一段内圈弧 + 中间一个十字形的面值压印（都是比币面暗一档的硬边线）
function coinTex() {
  const N = 128, [c, x] = canvas(N, N);
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, N, N);
  x.lineWidth = 5; x.strokeStyle = '#C9C3D6'; x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 3; x.strokeStyle = '#B4AEC6'; x.beginPath(); x.arc(64, 64, 40, .2, Math.PI * 1.1); x.stroke();
  x.fillStyle = '#BDB7CC'; x.fillRect(52, 50, 24, 5); x.fillRect(61, 42, 6, 40);
  return c;
}

// —— 这一镜自己的物件（建一次，加进 S10 的场景，平时藏着）——
let K = null;
function kit() {
  if (K) return K;
  const s = sceneS10(), grp = new THREE.Group(), carry = new THREE.Group();
  // 筷子：两根锥形木棍（细头 r 2.1 mm、粗头 3.4 mm，长 24 cm），搁在碗唇上；细头在左
  for (const [z, ang, x0] of [[-.005, 1.2, -.104], [.008, -2.4, -.097]]) {
    const geo = new THREE.CylinderGeometry(.0021, .0034, .24, 14); geo.rotateZ(Math.PI / 2);
    const m = mesh(geo, C('pin'), { t: .1, hi: .9, w: .0024 });
    m.position.set(x0 + .12, LIP + .0029, z); m.rotation.y = ang * D2R; carry.add(m);
  }
  // 分币：三枚铝分币（半径 10.5–12 mm、厚 1.6 mm），两枚平放，一枚半搭在另一枚上
  const tex = new THREE.CanvasTexture(coinTex()), coin = C('basin');
  for (const [x, z, r, y, tilt, rot] of [[.150, .052, .0105, .0008, 0, 20], [.182, .036, .0118, .0008, 0, -40], [.171, .047, .0112, .0021, 5.5, 70]]) {
    const m = mesh(new THREE.CylinderGeometry(r, r, .0016, 48), coin, { t: .1, hi: .62, w: .0022, map: tex });
    m.position.set(x, y, z); m.rotation.set(0, rot * D2R, tilt * D2R, 'YXZ'); grp.add(m);
  }
  // 碗底水印：圈足那一圈湿木头（有一处断口：碗是斜着端起来的），只在碗离台后露出
  const ring = new THREE.Mesh(new THREE.RingGeometry(.0305, .0372, 72, 1, .7, Math.PI * 2 - .5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#3A2418'), transparent: true, opacity: .24, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .0007; ring.userData.bg = true; ring.material.userData.outlineParameters = { visible: false };
  // 师傅的右手 + 白袖（hand3d 每次 makeHand 都是一份新克隆，和 S10 的手互不影响）
  const H = makeHand('R');
  grp.add(carry, ring, H.root, H.arm);
  grp.visible = false; s.scene.add(grp);
  return (K = { s, grp, carry, ring, H });
}

// —— 手型 ——
// REACH：伸过来时手松着（拇指贴在食指边、四指微弯，不张成「停」的手势）；HOVER：四指虚靠碗壁、拇指弯在碗沿上方约 1 cm 悬着；
// GRIP：拇指压上碗沿（末两节扣住，连筷子一起），四指托紧碗腹往下包，越往小指越弯
const REACH = { thumb: [14, 8, 10, 8], index: [8, 14, 16, 9], middle: [2, 16, 18, 10], ring: [-4, 20, 22, 11], pinky: [-10, 24, 26, 12] };
const HOVER = { thumb: [31, 5, 22, 16], index: [6, 20, 22, 12], middle: [0, 25, 26, 14], ring: [-5, 36, 36, 18], pinky: [-11, 44, 40, 18] };
const GRIP = { thumb: [30, 10, 30, 24], index: [6, 24, 28, 14], middle: [0, 30, 32, 16], ring: [-5, 42, 44, 22], pinky: [-11, 50, 46, 22] };
// 贴碗：[碗周角°, 掌心高度, 四指包的方向, 四指往下的分量, 掌离碗壁]（同 s10 onBowl 的参数）
const AT = { hover: [166, .053, -1, .42, .012], grip: [166, .046, -1, .44, .009] };

// —— 时间线（lt 0–3）——
// 入画 3 张（12 fps，32.25–32.5）+ 停：[相对「虚靠」位置的偏移 x, y, z（米）, 收拢 c（0 = REACH、1 = HOVER）, 指尖上抬°（绕世界 Z 转：伸过来时四指平着往前，落到碗边才顺碗壁往下）]
// 从左边稍高处弧线落到碗边
const KEYS = [[-.17, .045, .012, 0, 28], [-.075, .025, .006, .45, 15], [-.02, .008, .002, .85, 5], [0, 0, 0, 1, 0]];
// 端起（32.875 起，12 fps 两张）：[碗心位移 x, y（米）, 倾角°（负 = 左边先起，绕右脚边转）]
const LIFT = [[0, .0, -3.5], [-.03, .034, -6]];
const PIV = .036;                                                       // 圈足右边沿（绕这里斜着起）

const bm = new THREE.Matrix4(), hm = new THREE.Matrix4(), tmp = new THREE.Matrix4(), ZA = new THREE.Vector3(0, 0, 1);
function bowlMatrix(dx, dy, tilt) {                                      // T(dx, dy) · T(PIV) · Rz · T(−PIV)
  return bm.makeTranslation(dx + PIV, dy, 0).multiply(tmp.makeRotationZ(tilt * D2R)).multiply(new THREE.Matrix4().makeTranslation(-PIV, 0, 0));
}

export function draw(g, e, lt, A, t) {
  lt = Math.round(lt * 24) / 24;                                        // 落到输出帧上（换张的边界不受浮点误差影响）
  const k = kit(), s = k.s, H = k.H;
  // S10 的状态先存起来、藏掉它的手和汤面；渲完原样还回去（S10 的 poseS10 不管这几样的可见性）
  const keep = [s.soup, s.glint, ...Object.values(s.hands || {}).map(h => h && h.root), ...Object.values(s.arms || {})].filter(Boolean).map(o => [o, o.visible]);
  const bp = s.bowl.position.clone(), bq = s.bowl.quaternion.clone();
  try { shoot(k, s, H, lt, g, e, keep); }
  finally {                                                             // 出错也要还原：不能把 S10 的手和汤面留成藏着的
    k.grp.visible = false;
    for (const [o, v] of keep) o.visible = v;
    s.bowl.position.copy(bp); s.bowl.quaternion.copy(bq);
  }
  return {};
}

function shoot(k, s, H, lt, g, e, keep) {
  poseS10({ bx: 0, empty: true, master: false, guest: null, glint: null });   // S10 的摆放接口：空碗、不放 S10 的三只手、没有沿上高光
  for (const [o] of keep) o.visible = false;                                  // 再保险一次：S10 的手、袖、汤面、高光一律藏掉
  let hand = null, lift = null;
  if (lt >= 2.875 - 1e-6) { lift = LIFT[Math.min(1, Math.floor((lt - 2.875) * 12 + 1e-6))]; hand = { off: [0, 0, 0], pose: GRIP, at: AT.grip }; }
  else if (lt >= 2.25 - 1e-6) {
    const [ox, oy, oz, c, rz] = KEYS[Math.min(3, Math.floor((lt - 2.25) * 12 + 1e-6))];
    hand = { off: [ox, oy, oz], pose: lerpPose(REACH, HOVER, c), at: AT.hover, rz };
  }
  const M = bowlMatrix(...(lift || [0, 0, 0]));
  s.bowl.position.set(0, 0, 0); s.bowl.quaternion.identity(); s.bowl.applyMatrix4(M);
  k.carry.position.set(0, 0, 0); k.carry.quaternion.identity(); k.carry.applyMatrix4(M);
  k.ring.visible = !!lift && lift[1] > .001;
  H.root.visible = H.arm.visible = !!hand;
  if (hand) {
    H.pose(hand.pose);
    onBowl(H, 0, ...hand.at);
    hm.compose(H.root.position, H.root.quaternion, H.root.scale).premultiply(M);
    hm.decompose(H.root.position, H.root.quaternion, H.root.scale);
    if (hand.rz) H.root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ZA, hand.rz * D2R));
    H.root.position.add(new THREE.Vector3(...hand.off));
    H.aimArm([-.9, .3 + (lift ? lift[1] * 3 : 0), .3], 10);
  }
  k.grp.visible = true;
  frameS10(g, e, { bx: 0, pan: PAN });
}
