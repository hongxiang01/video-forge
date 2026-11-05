// S5 —— 招牌镜头的三维部分（三渲二）：擀面杖 + 两只逆光剪影拳 + 前臂袖子（hand3d）。面皮、灯、灯绳木珠、背景墙仍是 2D
// （scenes.js frameS5、props.doughBacklit），这里只出三维层。film.js 不直接载入本文件（S5 走 scenes.js），由 frameS5 调用：
//   rig({ x, y, t }) 每帧先摆好杖和手 → doughBacklit(..., { r, pin }) 在面皮之后、卷边之前调 pin(g, e) 渲杖 → 最后 fists(g, e) 渲手。
// 机位固定（用户 2026-11-05：灯在画面上不动）：0.9 m 外的长焦（垂直视角 23.8°），从杖前下方仰 36° 看 → 杖在画面最上方，看得到杖底和拳头底面（仰拍）。
// 世界坐标（米）：X 向右、Y 向上、Z 朝镜头；杖轴平行 X、落在 z = 0 平面上；杖心 = 2D 面皮的杖轴屏幕点反投影到 z = 0 → 举起 / 晃动和 2D 面皮同步。
// 尺寸：杖直径 4.5 cm、两头圆（长 66 cm，见 PIN）；面皮 1250 px ≈ 0.44 m（S4 擀到直径 0.47 m）→ 杖投影半径约 64 px（2D 是 42 px，交给 doughBacklit 的 r 对齐卷边和压痕）。
// 色：剪影套 SIL.s5；卡通两阶 = 面皮后面的灯泡（一盏点光、不衰减、硬边投影，不加环境光）：镜头看到的背光大面 = 剪影色，朝灯（面皮中心）一侧亮一档；
// 暖金轮廓光 2–3 px 在屏幕上做：剪影往背光方向错开 2–3 px，露出来的那一圈涂 SIL.s5.rim（拳朝面皮中心和上方、杖朝上）。手和杖在发光层 e 上印黑。
// 两遍渲：pin() 只渲杖；fists() 渲手，杖换成只写深度的材质 → 绕到杖后面的手指被杖挡住。手按 12 fps 换张。
import * as THREE from 'three';
import { canvas, mix, W, H } from '../lib/cel.js';
import { C, SIL } from '../pal.js';
import { toon, draw3d } from '../lib3d.js';
import { makeHand, POSES3D } from '../hand3d.js';

const D2R = Math.PI / 180;
// 杖长 66 cm（比 S4 的 62 cm 长 4 cm：拳在面皮外侧时杖头还能露出圆头，隔着机位变化看不出来）；握点离杖心 ±24.5 cm，面皮半宽约 22 cm
const PIN = { r: 0.0225, L: 0.66 }, GX = 0.245;
const CAM = { fov: 23.8, pos: [0, -0.529, 0.728], pitch: 27.5 };   // 0.9 m 外的长焦（近处的拳和前臂不鼓胀），仰 36° 看杖（拳顶不出画框上沿）
const LAMP = [-0.02, 0.0, -0.6];                                 // 灯泡：面皮正后方 60 cm（点光，不衰减）→ 拳和袖朝面皮中心那一侧受光
const K = SIL.s5, PCW = C('pin', 'warm'), PF = mix(PCW.s, K.line, .3);
const COL = {
  skin: { f: mix(K.skin, K.rim, .2), s: K.skin, l: K.line },                          // 背光面（镜头看到的大面）= 剪影色；朝灯一侧亮一档
  sleeve: { f: K.sleeve, s: mix(K.sleeve, K.line, .5), l: K.line },                   // 袖子压暗
  pin: { f: mix(PF, PCW.f, .4), s: PF, l: K.line },
};
// 握法：手框 +Y（手背）绕杖轴转到 TH°（0 = 朝镜头，正 = 往下），掌面贴杖；GO = [掌面离杖面, 沿手框 Z 往腕挪]（米）
const TH = -15, GO = [0.003, 0.042];
const ARM = { L: [-0.55, -0.75, 0.3], R: [0.55, -0.75, 0.3] };   // 腕 → 肘：往外、往下、略朝镜头 → 袖子从两侧出画，只占边角

function pinMesh() {   // 车削：两头圆角（同 S4）
  const { r, L } = PIN, rc = r * .55, pts = [new THREE.Vector2(1e-4, -L / 2)];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, -L / 2 + rc + Math.sin(a) * rc)); }
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, L / 2 - rc + Math.sin(a) * rc)); }
  pts.push(new THREE.Vector2(1e-4, L / 2));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), toon(COL.pin, { t: .05 }));
  m.rotation.z = -Math.PI / 2; m.castShadow = m.receiveShadow = true;
  return m;
}

let S = null;
function setup() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(CAM.fov, W / H, 0.05, 20), p = CAM.pitch * D2R;
  cam.position.set(...CAM.pos); cam.lookAt(CAM.pos[0], CAM.pos[1] + Math.sin(p), CAM.pos[2] - Math.cos(p));
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  const pin = pinMesh(), depth = new THREE.MeshBasicMaterial({ colorWrite: false });
  depth.userData.outlineParameters = { visible: false };
  scene.add(pin);
  const skin = toon(COL.skin, { t: .1 }), slv = toon(COL.sleeve, { t: .05 }), skinHex = new THREE.Color(C('skin', 'warm').f).getHex(), hands = {};
  for (const k of ['L', 'R']) {
    const h = makeHand(k, 'warm');
    h.mesh.material = skin;
    h.arm.traverse(o => { if (o.isMesh) o.material = o.material.color?.getHex() === skinHex ? skin : slv; });
    scene.add(h.root, h.arm); hands[k] = h;
  }
  const pl = new THREE.PointLight(0xffffff, 1, 0, 0); pl.position.set(...LAMP); pl.castShadow = true; pl.shadow.mapSize.set(1024, 1024); pl.shadow.bias = -0.0004; scene.add(pl);
  scene.userData.innerOpt = { dz: .0022, dzk: .004, dn: .8 };   // 剪影里靠内部线读出指缝和指节：阈值比默认收紧一点
  const [tc, tg] = canvas(W, H), [rc, rg] = canvas(W, H);
  return (S = { scene, cam, pin, tone: pin.material, depth, hands, tc, tg, rc, rg, mid: W / 2 });
}

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
function onPlane(cam, x, y) {   // 屏幕点 → z = 0 平面上的世界点
  _v.set(x / W * 2 - 1, 1 - y / H * 2, 0.5).unproject(cam).sub(cam.position).normalize();
  return cam.position.clone().addScaledVector(_v, -cam.position.z / _v.z);
}
const toScreen = (cam, p) => { _a.copy(p).project(cam); return [(_a.x + 1) / 2 * W, (1 - _a.y) / 2 * H]; };

// 拳：hand3d 的 grip（按杖半径算每节弯角）；开镜头两张（12 fps）四指还没扣紧 → 接 S4 结尾搭在杖上的手，第三张起握死
function gripPose(close) {
  const P = POSES3D.grip(PIN.r), o = {};
  for (const [f, v] of Object.entries(P)) o[f] = f === 'thumb' ? v.map((a, i) => i ? a * (.7 + .3 * close) : a) : [v[0], v[1] * (.75 + .25 * close), v[2] * (.6 + .4 * close), v[3] * (.6 + .4 * close)];
  return o;
}

// o = { x, y: 杖轴中点的屏幕坐标（和 doughBacklit 的 cx + dx、top + dy 同一点）, t: 全片秒 } → { r: 杖投影半径 px }
export function rig(o) {
  const s = setup(), tq = Math.floor(o.t * 12 + 1e-6) / 12, lt = tq - 12, c = onPlane(s.cam, o.x, o.y);
  s.mid = o.x;
  s.pin.position.copy(c);
  const close = Math.min(1, Math.max(0, lt / .17));
  const lift = Math.min(1, Math.max(0, (lt - .1) / 1.3));          // 举起时腕往里扣一点、举定后放松
  const w = Math.min(1, Math.max(0, tq - 12.6)), ph = 2 * Math.PI * (tq - 12.6) / 2.4;   // 举着轻晃（同 scenes.js S5LIFT 的相位）：两腕跟着晃一点
  for (const [k, sd] of [['L', -1], ['R', 1]]) {
    const h = s.hands[k], th = (TH - 6 * Math.sin(Math.PI * lift) + 3 * w * Math.sin(ph + sd * .6)) * D2R;
    const X = new THREE.Vector3(1, 0, 0), Yh = new THREE.Vector3(0, -Math.sin(th), Math.cos(th)), Zh = new THREE.Vector3(0, -Math.cos(th), -Math.sin(th));
    h.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Yh, Zh));
    h.root.position.copy(c).add(_b.set(sd * GX, 0, 0)).addScaledVector(Yh, PIN.r + GO[0]).addScaledVector(Zh, GO[1]);
    h.pose(gripPose(close));
    h.aimArm([ARM[k][0] + .06 * w * Math.sin(ph), ARM[k][1], ARM[k][2]]);
  }
  const [, y0] = toScreen(s.cam, c), [, y1] = toScreen(s.cam, _b.copy(c).add(new THREE.Vector3(0, PIN.r, 0)));
  return { r: Math.abs(y1 - y0) };
}

// 渲一遍三维层到临时画布 → 屏幕上的轮廓光（rims = [[x0, x1, [dx, dy]]…]：这一竖条里剪影往 d 错开，露出的边涂暖金）→ 贴进颜色层 g；e 上印黑由 draw3d 做
function layer(g, e, s, rims) {
  const { tc, tg, rc, rg } = s;
  tg.clearRect(0, 0, W, H);
  draw3d(tg, e, s.scene, s.cam);
  for (const [x0, x1, d] of rims) {
    rg.globalCompositeOperation = 'source-over'; rg.clearRect(0, 0, W, H); rg.drawImage(tc, 0, 0);
    rg.globalCompositeOperation = 'source-in'; rg.fillStyle = K.rim; rg.fillRect(0, 0, W, H);
    rg.globalCompositeOperation = 'destination-out'; rg.drawImage(tc, d[0], d[1]);
    rg.globalCompositeOperation = 'source-over';
    tg.save(); tg.beginPath(); tg.rect(x0, 0, x1 - x0, H); tg.clip(); tg.globalCompositeOperation = 'source-atop'; tg.drawImage(rc, 0, 0); tg.restore();
  }
  g.drawImage(tc, 0, 0);
}

// 杖（doughBacklit 的 o.pin 回调：面皮之后、卷边之前）：只渲杖，上沿 3 px 暖金
export function pin(g, e) {
  const s = setup();
  for (const h of Object.values(s.hands)) h.root.visible = h.arm.visible = false;
  s.pin.material = s.tone;
  layer(g, e, s, [[0, W, [0, 3]]]);
  for (const h of Object.values(s.hands)) h.root.visible = h.arm.visible = true;
}

// 两只拳 + 前臂袖子（最后画，在面粉之上）：杖只写深度；左拳的轮廓光朝右上、右拳朝左上（朝面皮中心和上方）
export function fists(g, e) {
  const s = setup();
  s.pin.material = s.depth;
  layer(g, e, s, [[0, s.mid, [-2, 2.4]], [s.mid, W, [2, 2.4]]]);
  s.pin.material = s.tone;
}
