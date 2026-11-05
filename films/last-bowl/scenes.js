// scenes.js —— 合成（CONTRACT「合成」）：按 frame 合成 a / a2 / s5 三张风格帧，只调用各模块导出的函数。
// a  = 主构图 A，2.0 s：暖灯刚拉亮还在摆，光圈随灯横扫（plates.drawWarmA），窗里落雪（玻璃暖反光已画进背景板，这里不再整格叠暖色）
// a2 = 主构图 A'，37.8 s：灯灭；光斑 = spot(shutterH(t))，斑外 darkOut 板 / 斑内 darkIn 板；cel 用 'dark' 两遍色指定；雪影滑过光斑（碗周围 120 px 不放）
// s5 = 招牌镜头，13.8 s：近景仰拍，杖横在最上方两头露出，面片像帘子挂在杖上透光（三块硬边色区 + 灯罩口暗环）；两只剪影拳握在面片外侧；
//      背景是喷枪暗暖墙（光从面片上沿和两侧漏出，下方压暗），灯绳从下摆后面垂出；面粉在下沿和溢光带里，星芒只 1 个在灯芯上
import { cel, poly, mix, hex, hash, airbrush, canvas, rgba, TAU, W, H } from './lib/cel.js';
import { w2s, scale, HALO, SHADE, TABLE, OBJ, CORD, WIN, LAMP_STREET, shutterH, spot } from './layout.js';
import { C, BG, SIL } from './pal.js';
import { drawTitle, titleLevel } from './title.js';
import { hand, digit, part, FW } from './hands.js';
import * as THREE from 'three';
import { rgb, draw3d } from './lib3d.js';
import { makeHand } from './hand3d.js';

// —— CRT：从 lib/post.js 默认值起调，克制。暗角统一在 frames.js 的 POST 里压到 ≤ 25%；每张帧只覆盖少数几项 ——
const CRT = {
  // a：第 4 轮（评委：灯泡的晕泛粉紫、中心一片纯白）——颜色板不再进 bloom（thr 1：只有发光板发光），白色 bloom 收低，
  //    最宽一圈交给偏红橙的 halation；荧光余辉 glow 收小，灯芯不冲成一大片白
  a:  { bloom: .55, halo: .28, glow: .08, thr: 1 },
  a2: {},
  // s5 透过光：面片外缘 / 杖两头 / 上沿的外溢靠 halation（偏红橙，halo .45）；bloom 收低 —— 浅金的 R 已近 1，bloom 一多就推成柠檬黄；
  // 荧光余辉 glow 几乎关掉，灯芯（#FFE6A0 满强度进发光板）留住硬边、不冲成一团白
  // 第 5 轮：thr 1 —— 颜色板不进 bloom（只有发光板发光），灯芯在成片里留奶黄、留硬边
  s5: { bloom: .08, halo: .45, glow: .05, expo: 1, thr: 1 },
};

// 暖灯光圈随灯摆横移：灯绕罩顶上方 14 cm 摆（props.js PIV），光轴打到台面的位移经 w2s 换成屏幕 px
const PIV_Y = SHADE.c[1] + 0.14;
function haloDx(swingDeg) {
  const k = (PIV_Y - TABLE.y) * Math.tan(swingDeg * Math.PI / 180);
  return w2s(HALO.c[0] + k, TABLE.y, HALO.c[2])[0] - w2s(...HALO.c)[0];
}
// S1 开灯后的摆（粗剪第 2 轮，CONTINUITY S1→S2「出点灯还在摆，光圈来回扫」）：0.75 起一拍一摆，真正的左右摆（+4° → −3° → +2.2°），
// 衰减放慢，最后半拍光圈还看得出在台面上扫；3.0 正好回到中间、往左走 → S2 的灯圈余晃（sway 先往左）接着走
const SWING_A = [4, 3, 2.2];
function swingS1(t) {
  if (t < .75 || t >= 3) return 0;
  const u = t - .75;
  return SWING_A[Math.min(2, Math.floor(u / .75))] * Math.sin(u / .75 * Math.PI);
}

// —— 边缘物件「作弊」（赛璐璐做法）：f = 1125 时画面左缘的面盆竖向斜约 −29°（侧壁往左倒）、椭圆斜约 −26°，像翻倒 ——
// 第 3 轮：垂直物体的竖向收缩只保留约 3 成（和 props.bowl 的碗摞同一个做法）：落点中心钉在 OBJ.basin.c 的屏幕点不动，整件 cel 绕它转回 7 成，
// 侧壁只剩约 9° 的斜、椭圆约 8°。光斑、影子仍按 world→screen 算：灯灭时把光斑遮罩先反转同一角度再交给 basin，转回来正好落在原位
const KEEP = .3, BASIN = (() => {
  const b = w2s(...OBJ.basin.c), t = w2s(OBJ.basin.c[0], OBJ.basin.c[1] + 0.13, OBJ.basin.c[2]);
  return { pivot: b, rot: -(1 - KEEP) * Math.atan2(t[0] - b[0], b[1] - t[1]), topH: 0.13 };   // topH：props 面盆高，光斑遮罩按盆顶高度算
})();
// 第 4 轮（画风评委：口径 A 约 343 px、A' 约 327 px，§4.1 是宽 264 px）：广角把画面左缘的盆拉宽了 → 整件等比缩到屏幕宽约 270 px，
// 碗底中心仍钉在 w2s(OBJ.basin.c) = (363, 786)。k 由屏幕宽度反算（口沿那圈转回 7 成后的左右跨度 + 口沿描边）
const BASIN_W = 270;
function basinK(flip) {
  const c = OBJ.basin.c, [px, py] = BASIN.pivot, cs = Math.cos(BASIN.rot), sn = Math.sin(BASIN.rot);
  const width = k => {
    const R = OBJ.basin.d / 2 * k + .012, y = flip ? c[1] + .006 : c[1] + BASIN.topH * k; let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * TAU, [x, yy] = w2s(c[0] + R * Math.cos(a), y, c[2] + R * Math.sin(a)), rx = px + (x - px) * cs - (yy - py) * sn;
      lo = Math.min(lo, rx); hi = Math.max(hi, rx);
    }
    return hi - lo + 6.5;
  };
  let k = 1; for (let i = 0; i < 3; i++) k *= BASIN_W / width(k);
  return k;
}
function basinCheat(g, e, P, o) {
  const [px, py] = BASIN.pivot, deg = BASIN.rot * 180 / Math.PI, k = basinK(!!o.flip), oo = { ...o, k, rot: BASIN.rot };
  if (o.light === 'dark') {
    // 第 5 轮（导演：盆内外一色像玻璃罩）：遮罩改用台面那张（o.spot，和杖、围裙同一张），光斑边在盆上和台面上接成一条线
    const m = o.spot !== undefined ? o.spot : P.spotMask(o.shutter ?? 1.85, TABLE.y), inv = new Path2D();
    if (m) inv.addPath(m, new DOMMatrix().translate(px, py).rotate(-deg).translate(-px, -py));
    oo.spot = m ? inv : null;
  }
  for (const c of [g, e]) { c.save(); c.translate(px, py); c.rotate(BASIN.rot); c.translate(-px, -py); }
  P.basin(g, e, oo);
  g.restore(); e.restore();
}

// —— 拉灯的手（S1 / S13，TREATMENT §4.2 末段）：三渲二 —— 三维手（hand3d.js）+ 卡通材质两阶硬边 + 彩色描边，叠在二维的 A / A' 上 ——
// 手按 12 fps 换张（一拍两格），锚点 = 木珠。灯绳、木珠仍是二维（props.shade 先画）；三维里放一个只写深度的球挡住木珠后面的指头 → 前后关系对。
// 相机和 layout.w2s 完全对齐：机位 (0, 2.30, 0)、俯 40°、f = 1125 px、主点 (960, 540)。layout 的 z 朝里（左手系），three 是右手系 →
// layout (x, y, z) → three (x, y, −z)；相机绕 X 转 −40°，竖直视角 2·atan(540 / 1125)。
// 机位在师傅身后上方：看到右手手背，拇指在左；手掌微微朝左转（拇指一侧抬起、离镜头近）；拇指、食指指肚隔着木珠对捏，
// 中、无名、小指一只松拳（中指最松、小指最紧）。手臂伸直：肩在画框下沿外（SHOULDER），袖子从腕往肩一路变粗，从下沿 x ≈ 760 伸进来。
// 光：暖灯 = 灯泡处一盏不衰减的点光（跟灯摆），手和袖子的硬边投影落在台面（只收投影的平面，裁在台面范围）；
// 灯灭 = 路灯从窗那边来的方向光，光斑外那组色（lit #4E323A / sh #341B23 / line #221113），朝窗一侧的高光阶换成雪青灰 #8C93B8 当轮廓光；手不进光斑，台面不收投影。
const EPS = 1e-6, step12 = (t, t0) => Math.floor((t - t0) * 12 + EPS);
const DG = Math.PI / 180, lerp = (a, b, u) => a + (b - a) * u, lerpA = (A, B, u) => A.map((a, i) => lerp(a, B[i], u));
const L2T = ([x, y, z]) => new THREE.Vector3(x, y, -z);
const SHOULDER = [-0.105, 1.40, 0.38];                         // 右肩（layout，米）：投到画框下沿外，袖子从下沿 x ≈ 760 伸进来
const BULB = [SHADE.c[0], SHADE.c[1] - 0.03, SHADE.c[2]];     // 灯泡中心：暖灯点光的位置（跟灯摆绕罩顶上方 14 cm 转）
// 手型（度，hand3d.pose 的格式）：pinch 捏珠（食指弯成钩、指肚朝下压住木珠，三指收进掌心）、open 伸手时的 C 形、relax 松手后的自然半握。
// pinch / open 的拇指由 solveThumb 解
const HP = {
  pinch: { index: [0, 26, 40, 20], middle: [2, 60, 78, 38], ring: [-3, 68, 84, 40], pinky: [-9, 74, 86, 40] },
  open:  { index: [8, 16, 22, 10], middle: [2, 26, 34, 16], ring: [-4, 32, 40, 18], pinky: [-10, 38, 44, 18] },
  relax: { thumb: [0, 20, 16, 10], index: [6, 30, 40, 20], middle: [2, 36, 46, 22], ring: [-3, 42, 50, 24], pinky: [-8, 48, 52, 24] },
};
const GAP = { pinch: 0.036, open: 0.075 };          // 拇指尖到食指尖、沿食指指肚朝向的距离（米）：捏住 = 隔一颗木珠
const ORI = { pitch: 18, yaw: 0, roll: -50, off: [0.006, 0, 0] };   // 手相对「顺着手臂、手背朝上」的转动（度）：pitch 腕往上翘，roll 负 = 拇指一侧抬起；off：捏点在木珠右边多少米
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
// 解拇指：食指摆好后，在 [张开, 指根弯, 第二节弯] 网格里找拇指尖最接近「食指尖 + 指肚朝向 × gap」的一组（手框在原点、不转）
function solveThumb(Hn, P, gap) {
  const B = Hn.B; let best = [1e9, 0, 0, 0];
  for (let s = -60; s <= 60; s += 4) for (let a = -20; a <= 100; a += 4) for (const b of [0, 20, 40]) {
    Hn.pose({ ...P, thumb: [s, a, b, 15] }); Hn.root.updateMatrixWorld(true);
    const n = new THREE.Vector3(0, -1, 0).applyQuaternion(B['index-finger-phalanx-distal'].getWorldQuaternion(_q));
    const d = B['thumb-tip'].getWorldPosition(_w).distanceTo(B['index-finger-tip'].getWorldPosition(_v).addScaledVector(n, gap));
    if (d < best[0]) best = [d, s, a, b];
  }
  return [best[1], best[2], best[3], 15];
}
// 两只右手：暖灯一只、灯灭一只（hand3d 每次 makeHand 各克隆一副骨架，皮肤 / 袖子按光照上色），每帧只显示当前那只。
// 灯灭那只：皮肤高光阶（toon 渐变贴图第 3 格 = 高光 / 亮色）改成雪青灰 #8C93B8 → 朝窗一侧一道冷轮廓光
let H3 = null;
function setup3() {
  if (H3) return H3;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(2 * Math.atan(540 / 1125) / DG, W / H, 0.05, 20);
  cam.position.set(0, 2.30, 0); cam.rotation.set(-40 * DG, 0, 0);
  const tb = new THREE.Mesh(new THREE.PlaneGeometry(3.4, TABLE.z1 - TABLE.z0), new THREE.ShadowMaterial({ color: new THREE.Color(BG.warm.woodDark), opacity: .6 }));
  tb.rotation.x = -Math.PI / 2; tb.position.set(0, TABLE.y + 0.0004, -(TABLE.z0 + TABLE.z1) / 2); tb.receiveShadow = true;
  const bead = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ colorWrite: false })); bead.renderOrder = -1;
  for (const m of [tb, bead]) { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; }
  const pl = new THREE.PointLight(0xffffff, 1, 0, 0); pl.castShadow = true; pl.shadow.mapSize.set(2048, 2048);
  Object.assign(pl.shadow.camera, { near: 0.05, far: 4 }); pl.shadow.bias = -0.0005; pl.shadow.normalBias = 0.002;
  const b0 = CORD.top.slice(), dl = new THREE.DirectionalLight(0xffffff, 1); b0[1] = CORD.bottomY;
  const v = L2T(LAMP_STREET.map((q, i) => q - b0[i])).normalize(), at = L2T(b0);
  dl.position.copy(at).addScaledVector(v, 3); dl.target.position.copy(at); dl.castShadow = true; dl.shadow.mapSize.set(2048, 2048);
  Object.assign(dl.shadow.camera, { left: -.5, right: .5, top: .5, bottom: -.5, near: .5, far: 6 }); dl.shadow.bias = -0.0004; dl.shadow.normalBias = 0.002;
  scene.add(tb, bead, pl, dl, dl.target);
  const HW = makeHand('R', 'warm'), HO = makeHand('R', 'out'), gm = HO.mesh.material.gradientMap, F = rgb(C('skin', 'out').f), K = rgb(BG.night.snowGrey);
  gm.image.data.set(K.map((v, i) => v / F[i]), 8); gm.needsUpdate = true;
  HP.pinch.thumb = solveThumb(HW, HP.pinch, GAP.pinch); HP.open.thumb = solveThumb(HW, HP.open, GAP.open);
  scene.add(HW.root, HW.arm, HO.root, HO.arm);
  return (H3 = { scene, cam, tb, bead, pl, dl, HW, HO });
}
// 顺着手臂（往肩）走多少米，屏幕上才挪 px（伸进来 / 退出去都走这条线）
function alongM(bw, px) {
  if (!px) return 0;
  const a = SHOULDER.map((q, i) => q - bw[i]), L = Math.hypot(...a), s0 = w2s(...bw); let lo = 0, hi = L;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2, p = w2s(...bw.map((q, j) => q + a[j] / L * m)); if (Math.hypot(p[0] - s0[0], p[1] - s0[1]) < px) lo = m; else hi = m; }
  return lo;
}
const swingPt = (q, deg) => { const a = deg * DG, dx = q[0] - SHADE.c[0], dy = q[1] - PIV_Y; return [SHADE.c[0] + dx * Math.cos(a) - dy * Math.sin(a), PIV_Y + dx * Math.sin(a) + dy * Math.cos(a), q[2]]; };
const PULL = [0.02, 0.045, 0.06];   // 木珠下拉（米）：两张 + 到底「咔」
const SINK = 12 / scale(CORD.top[0], CORD.bottomY, CORD.top[2]);   // S13「咔」后手再沉 12 px（换成米）
// S1：0.583 起下拉 2 张，0.75 到底「咔」，手不停直接松开 → 木珠弹回
function pullS1(t) {
  if (t < 7 / 12 - EPS) return 0;
  if (t < .75 - EPS) return PULL[step12(t, 7 / 12)];
  return t < .75 + 1 / 24 - EPS ? PULL[2] : t < .75 + 3 / 24 - EPS ? PULL[2] * .35 : 0;
}
// S13：握住停到 36.583，下拉 2 张，36.75 到底「咔」；36.75–36.875 手再沉 12 px（3 帧，木珠跟着），36.875 松手 → 木珠弹回
function pullS13(t) {
  if (t < 36 + 7 / 12 - EPS) return 0;
  if (t < 36.75 - EPS) return PULL[step12(t, 36 + 7 / 12)];
  if (t < 36.875 - EPS) return PULL[2] + SINK * [0, .6, 1][Math.min(2, Math.floor((t - 36.75) * 24 + EPS))];
  return t < 36.875 + 2 / 24 - EPS ? PULL[2] * .35 : 0;
}
// 手的一张：{ b: 锚定的木珠（世界，layout）, d: 顺着手臂往外挪的屏幕 px, k: 捏合（1 捏住，0 张开）, relax: 松手后放开, rot: 指尖往拇指那边偏（弧度，负 = 往左） }
// 松手：t0 那张是中间张（指尖刚离开木珠，木珠弹回），然后张开、手腕沉一点；t1 起 3 张顺着手臂从下沿退出，手指拖在后面
function release(t, t0, t1, b) {
  if (t < t0 + 1 / 12 - EPS) return { b, k: .45 };
  if (t < t1 - EPS) return { b, d: 5, k: 0, relax: .5 };
  const i = Math.min(2, step12(t, t1));
  return { b, d: [80, 240, 420][i], k: 0, relax: [.7, .9, 1][i], rot: [-.03, -.07, -.11][i] };   // 三维里手在台面上方 30 cm，退得慢了像按在台面上 → 比二维版退得快
}
function handS1(t, P) {
  if (t < .25 - EPS || t >= 1.25 - EPS) return null;
  if (t < .5 - EPS) {   // 0.25 从下沿 x ≈ 760 入画，3 张伸到木珠：指尖领先，拇指、食指边走边合成 C 形对准木珠
    const i = step12(t, .25);
    return { b: P.beadPos().w, d: [330, 150, 40][i], k: [.2, .5, .8][i], rot: [-.10, -.05, -.02][i] };
  }
  if (t < .75 - EPS) return { b: P.beadPos({ pull: pullS1(t) }).w, k: 1 };
  return release(t, .75, 1, P.beadPos({ pull: PULL[2] }).w);   // 0.75「咔」手不停直接松开；1.0–1.25 退出
}
function handS13(t, P) {
  if (t >= 37.25 - EPS) return null;
  // 入点接 S12「手抬起」：头 2 帧手刚抬到木珠下、指头还没合上，36.083 捏住，停到 36.583（告别的那一拍）
  if (t < 36 + 1 / 12 - EPS) return { b: P.beadPos().w, d: 14, k: .78 };
  if (t < 36.875 - EPS) return { b: P.beadPos({ pull: pullS13(t) }).w, k: 1 };
  return release(t, 36.875, 37, P.beadPos({ pull: PULL[2] + SINK }).w);   // 36.875 松手；37.0–37.25 退出，37.25 完全出画
}
// 画一张：cur = 此刻二维木珠的世界位置（挡板跟它走），swing = 灯摆角（暖灯点光跟着摆）
function drawHand(g, e, k, light, cur, swing = 0) {
  if (!k) return;
  const S = setup3(), wm = light === 'warm', Hn = wm ? S.HW : S.HO, R = Hn.root, B = Hn.B;
  S.HW.root.visible = S.HW.arm.visible = wm; S.HO.root.visible = S.HO.arm.visible = !wm;
  const kk = k.k ?? 1, rl = k.relax ?? 0, P = {};
  for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) P[f] = lerpA(lerpA(HP.open[f], HP.pinch[f], kk), HP.relax[f], rl);
  Hn.pose(P);
  // 手框：Z = 顺着手臂往肩（指尖朝 −Z），Y = 手背（世界上方投到垂直于臂的平面），X = Y × Z；再按 ORI 转（rot 加到 yaw 上）
  const A = L2T(SHOULDER).sub(L2T(k.b)).normalize(), Y = new THREE.Vector3(0, 1, 0).addScaledVector(A, -A.y).normalize(), X = new THREE.Vector3().crossVectors(Y, A);
  R.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, A))
    .multiply(_q.setFromEuler(new THREE.Euler((ORI.pitch + 12 * rl) * DG, ORI.yaw * DG - (k.rot ?? 0), ORI.roll * DG, 'YXZ')));   // 松手后手腕领着往回撤，手指拖在后面（往上翘，不朝台面）
  // 位置：拇指尖、食指尖的中点 = 木珠右边 off（再顺着手臂往外挪 d px）
  R.position.set(0, 0, 0); R.updateMatrixWorld(true);
  const M = B['thumb-tip'].getWorldPosition(_v).add(B['index-finger-tip'].getWorldPosition(_w)).multiplyScalar(.5);
  R.position.copy(L2T(k.b.map((q, i) => q + ORI.off[i]))).addScaledVector(A, alongM(k.b, k.d || 0)).sub(M); R.updateMatrixWorld(true);
  Hn.aimArm(A.toArray());   // 前臂 + 袖子：从腕顺着「木珠 → 肩」那条线伸直（退出时腕会走过肩的投影点，不能再拿腕 → 肩当方向）
  const r = Math.max(0.0125, 12 / scale(...cur));   // 挡板 = props 画的木珠（半径至少 12 px，竖向 1.08）
  S.bead.position.copy(L2T(cur)); S.bead.scale.set(r, r * 1.08, r);
  if (wm) S.pl.position.copy(L2T(swingPt(BULB, swing)));
  S.pl.visible = S.tb.visible = wm; S.dl.visible = !wm;
  draw3d(g, e, S.scene, S.cam);
}

// 灯灭的底：斑外整张 + 斑内裁进 spot(h)（c、e 两层都裁）+ 窗里的雪（裁在底杠以下的窗格里）
function darkBase(g, e, A, t, h) {
  const { fx: F } = A.mods, pa = A.plateA, sp = spot(h);
  g.drawImage(pa.darkOut.c, 0, 0); e.drawImage(pa.darkOut.e, 0, 0);
  if (sp) {
    const m = poly(sp.poly);
    for (const [ctx, src] of [[g, pa.darkIn.c], [e, pa.darkIn.e]]) { ctx.save(); ctx.clip(m); ctx.drawImage(src, 0, 0); ctx.restore(); }
  }
  F.snow(g, e, t, { layers: ['far', 'mid'], clip: F.winPanes(h), lamp: F.LAMP_WIN, grains3d: true });
}

// S1 0–0.75：A 的道具（面粉、正放的面盆、斜放的杖、五只碗摞）在灯灭光照下；路灯光斑铺满台面（卷帘全开），雪影滑过
function darkA(t, g, e, A, pull) {
  const { props: P, fx: F } = A.mods, h = WIN.y1, o = { light: 'dark', shutter: h, spot: P.spotMask(h, TABLE.y) };
  darkBase(g, e, A, t, h);
  P.flourScatter(g, e, o);
  F.snowShadows(g, t, { shutter: h });
  basinCheat(g, e, P, o);
  P.pin(g, e, { ...o, at: 'A' });
  P.bowl(g, e, { ...o, at: 'A', H: OBJ.bowlA2.h + (OBJ.stackA.h - OBJ.bowlA2.h) / 2 });
  P.shade(g, e, { light: 'dark', pull });
}

// —— a：主构图 A（S1：0–0.75 灯灭色，0.75「咔」一帧重画成暖灯，灯摆 ±4° 三次衰减；手 0.25 入画、0.50 握珠、1.25 出画） ——
function frameA(t, g, e, A) {
  const { props: P, fx: F, plates: PL } = A.mods;
  if (t < .75 - EPS) { darkA(t, g, e, A, pullS1(t)); drawHand(g, e, handS1(t, P), 'out', P.beadPos({ pull: pullS1(t) }).w); return CRT.a2; }
  const swing = swingS1(t), o = { light: 'warm', swing };
  const dx = haloDx(swing);
  PL.drawWarmA(g, e, A, dx);
  F.snow(g, e, t, { layers: ['far', 'mid'], clip: F.winPanes(shutterH(t)), lamp: F.LAMP_WIN, grains3d: true });
  // 面粉：不透明平涂，光圈内外用背景板的光圈硬边遮罩二分（随灯摆同一个 dx）
  P.flourScatter(g, e, { ...o, halo: A.plateA.halo && { mask: A.plateA.halo.mask, dx } });
  basinCheat(g, e, P, o);
  P.pin(g, e, { ...o, at: 'A' });
  // 碗摞（第 5 轮导演：套得更紧）：碗沿间距减半 —— 摞高 = 一只碗高 + 原间距总和的一半
  P.bowl(g, e, { ...o, at: 'A', H: OBJ.bowlA2.h + (OBJ.stackA.h - OBJ.bowlA2.h) / 2 });
  P.shade(g, e, { ...o, pull: pullS1(t) });
  drawHand(g, e, handS1(t, P), 'warm', P.beadPos({ ...o, pull: pullS1(t) }).w, swing);
  return CRT.a;
}

// S13 松手（36.875）后灯绳的回弹摆角（§11.8 未定，先用衰减正弦：5° 起，一拍一摆）
function cordSwingS13(t) {
  const u = Math.max(0, t - 36.875);
  return 5 * Math.exp(-0.6 * u) * Math.sin(u / 0.75 * Math.PI);
}
// 雪影的禁区：碗沿椭圆 + 碗身往外 120 px（静帧里碗边的暗点像脏点，和「刚擦净」的台面矛盾，也和红沿抢）
function bowlKeepOut() {
  const B = OBJ.bowlA2, rc = w2s(B.c[0], B.c[1] + B.h, B.c[2]), bc = w2s(...B.c), rp = B.r * scale(...B.c), m = 120;
  const p = new Path2D(); p.rect(0, 0, W, H);
  p.ellipse(rc[0], (rc[1] + bc[1]) / 2, rp + m, rp * .75 + (bc[1] - rc[1]) / 2 + m, 0, 0, TAU, true);   // 反向 → nonzero 下是洞
  return p;
}

// —— S12→S13 接点（CONTINUITY）：S12 结尾那道湿带两边推开的面粉，切到 A' 还在原处 —— 沿 props.wipe 同一条弧（OBJ.wipeA2，拱向机位 .26 m），
// 湿带两边外侧 1–7 cm 撒一圈稀疏的粉粒和几小撮（越往外越稀），台面其余地方仍是擦净的。确定性（hash），暖灯 / 灯灭两套色
function wipeCrumbs(g, light) {
  const { a, b, w } = OBJ.wipeA2, dx = b[0] - a[0], dz = b[2] - a[2], dl = Math.hypot(dx, dz), nx = -dz / dl, nz = dx / dl, bulge = .26;
  const m = [(a[0] + b[0]) / 2 - nx * bulge, (a[2] + b[2]) / 2 - nz * bulge];
  const at = (t, off) => {
    const x = (1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * m[0] + t * t * b[0], z = (1 - t) * (1 - t) * a[2] + 2 * t * (1 - t) * m[1] + t * t * b[2];
    const tx = 2 * (1 - t) * (m[0] - a[0]) + 2 * t * (b[0] - m[0]), tz = 2 * (1 - t) * (m[1] - a[2]) + 2 * t * (b[2] - m[1]), tl = Math.hypot(tx, tz);
    return w2s(x - tz / tl * off, TABLE.y, z + tx / tl * off);
  };
  const FL = C('flour', light === 'warm' ? 'warm' : 'out'), dot = [], lump = [];
  for (let i = 0; i < 150; i++) {
    const sd = i % 2 ? 1 : -1, t = .03 + .88 * hash(i * 7.31 + 1), d = .006 + .06 * hash(i * 3.17 + 5) ** 1.8;
    const [x, y] = at(t, sd * (w / 2 + d)), r = .9 + 2.4 * hash(i * 5.9 + 2) ** 2 * (1 - d / .07);
    (i % 19 === 0 ? lump : dot).push([x, y, i % 19 === 0 ? r + 3.5 : r, i]);
  }
  const blob = ([x, y, r, i]) => { const p = []; for (let j = 0; j < 7; j++) { const an = j / 7 * TAU + hash(i + j * 1.7), f = .65 + .5 * hash(i * 2.3 + j); p.push([x + Math.cos(an) * r * f * 1.4, y + Math.sin(an) * r * f * .8]); } return poly(p); };
  g.save();
  g.fillStyle = FL.s; for (const q of lump) { g.save(); g.translate(1.5, 1.2); g.fill(blob(q)); g.restore(); }
  g.fillStyle = FL.f; for (const q of lump) g.fill(blob(q));
  for (const [x, y, r] of dot) { g.beginPath(); g.ellipse(x, y, r * 1.2, r * .8, 0, 0, TAU); g.fill(); }
  g.restore();
}

// S13 36.0–36.75：A' 的暖灯版（擦净的台面、倒扣的面盆、摆正的杖、叠好的围裙、洗净正放的红沿碗），灯亮着、不摆；手已握着木珠
function warmA2(t, g, e, A, pull) {
  const { props: P, fx: F, plates: PL } = A.mods, o = { light: 'warm' };
  PL.drawWarmA(g, e, A, 0);
  F.snow(g, e, t, { layers: ['far', 'mid'], clip: F.winPanes(WIN.y1), lamp: F.LAMP_WIN, grains3d: true });
  // 刚擦过：湿带比灯灭版再深一档（叠两遍），切过来一眼认得出 S12 那道弧
  P.wipe(g, e, o); P.wipe(g, e, o); wipeCrumbs(g, 'warm');
  basinCheat(g, e, P, { ...o, flip: true });
  P.pin(g, e, { ...o, at: 'A2' });
  P.apron(g, e, o);
  P.bowl(g, e, { ...o, at: 'A2' });
  P.shade(g, e, { ...o, pull });
}

// —— 窗外（38.625–39.75）：铁钩杆勾着底杠中部往下拉（剪影 + 金边，杆从窗台下斜伸上来，拿杆的手看不见）；39.10 杆 3 张撤出，
// 师傅的手同时从窗台下伸上来扣住底杠（3 张，剪影套 s13 + 路灯金边），39.75 随底杠落出窗台。都裁在底杠附近以下的窗格里（人在门外）
const POLE = { x: 0.10, a: 0.42, len: 900 };   // 钩点世界 x；杆往右下斜（偏离竖直的弧度）；杆长 px（下端在窗台下被裁掉）
function hookPole(g, e, x, y, a) {
  const d = [Math.sin(a), Math.cos(a)], n = [Math.cos(a), -Math.sin(a)], b = [x + d[0] * POLE.len, y + d[1] * POLE.len];
  const p = new Path2D(); p.moveTo(...b); p.lineTo(x, y); p.quadraticCurveTo(x - 2, y - 20, x - 14, y - 18); p.lineTo(x - 17, y - 8);   // 杆身 + 顶上的钩
  const S = SIL.s13, rimP = new Path2D(); rimP.moveTo(b[0] + n[0] * 2.6, b[1] + n[1] * 2.6); rimP.lineTo(x + n[0] * 2.6, y + n[1] * 2.6);
  g.save(); g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = S.line; g.lineWidth = 11; g.stroke(p);
  g.strokeStyle = mix(S.skin, S.line, .3); g.lineWidth = 6.5; g.stroke(p);
  g.strokeStyle = S.rim; g.lineWidth = 2; g.stroke(rimP);   // 朝路灯一侧（右上）一线金边
  g.restore();
  e.save(); e.lineCap = e.lineJoin = 'round'; e.strokeStyle = '#000'; e.lineWidth = 11; e.stroke(p); e.restore();
}
// 窗外扣底杠的手（剪影套 s13，掌宽 55）：人在街上、面朝窗，掌心朝屋里，拇指在右。锚点 = 握点处的底杠下沿。
// 粗剪第 2 轮：按物理放在底杠后面 —— 四指伸到底杠后面去扣（被底杠和门板挡住），看得见的是掌根、拇指根和小臂；
// k：0 伸手（四指张开往上够，指头微弯、各指角度不同）→ 1 扣住（四指往前弯过底杠 = 透视缩短，拇指往上顶到底杠下沿后面）
// r2 续（v1 看下来：底杠下只剩一团掌心，读不出是手）：改成从下面勾住底杠下唇 —— 掌心整只落在底杠下沿以下，四指从掌顶往上、
// 朝屋里弯过去勾进下唇（透视缩短，指头尖被底杠挡住），露出来的是四根并排、高低不一的指根段 + 掌心 + 右边往上顶的拇指 + 小臂 → 剪影读得出「手勾着杠」
// 粗剪第 3 轮（v2：四指平行等距像耙子）：指根顺着掌顶一道弧（小指最低、间距不等），长短、方向、弯度各不相同；
// k 0 伸手：手指放松、每节微弯 5–15°，指尖往中指那边聚，小指往外撇、食指往右偏；k 1 勾住：近节往上顶过底杠下沿，中、远节朝屋里折
// （透视缩短，藏在底杠后面），露在底杠下的是四段高低不一、微微往中间收的指根段；拇指从大鱼际往右上，扣住时往上顶，和四指分开
const GRIPF = [   // 小 → 食：[指根, 粗细, 伸手时三节角, 三节长, 勾住时三节角, 三节可见长]
  [[-.30, .37], .82, [-113, -104, -96], [.17, .10, .07], [-100, -92, -84], [.26, .12, .06]],
  [[-.13, .30], .95, [-99, -94, -89], [.23, .14, .10], [-95, -88, -80], [.27, .13, .06]],
  [[.05, .265], 1.05, [-88, -89, -93], [.30, .20, .16], [-90, -84, -77], [.28, .13, .06]],
  [[.24, .29], 1, [-75, -82, -90], [.27, .18, .15], [-82, -88, -94], [.27, .12, .06]],
];   // 指根间距 .17–.19 < 指宽：四指挨着、指根互相压住一点（不是隔开的四根管子）
function barPose(o) {
  const k = o.k ?? 1;
  const palm = part('skin', ['W', [-.45, .42], [-.25, .32], [-.04, .27], [.18, .28], [.38, .34], [.50, .52], [.54, .76], [.45, .98], [.30, 1.12, 1], [-.30, 1.14, 1], [-.46, .94], [-.53, .68], [-.52, .50]]);
  // 各指扣上去不同步：小指、无名指先收（中间那几张四指高低、弯度都错开），食指最后扣实
  const fing = GRIPF.map(([b, wk, A0, L0, A1, L1], i) => { const kf = Math.min(1, k * [1.4, 1.2, 1, 1][i]);
    return digit(b, lerpA(A0, A1, kf), lerpA(L0, L1, kf), { w: FW * wk, palm: true, id: 41 + i }); });
  // 拇指：从大鱼际往右上、再往上顶（k 0 时往右上张开，不横伸）
  const thumb = digit([.40, .70], [lerp(-50, -76, k), lerp(-63, -100, k)], [.30, .22], { w: .27, palm: true, id: 45 });
  return { arm: { w: [0, 1.11], a: 97 }, parts: [...fing.flat(), palm, ...thumb] };
}
// 钩杆和手先画进离屏，玻璃层（反写字、反光）用 source-atop 只盖在它们身上（玻璃在手和杆前面），再裁进底杠下沿以下的窗格贴回去
let OUT = null;
function outside(g, e, A, t, h) {
  const { fx: F } = A.mods;
  if (t < 38.625 - EPS || t >= 39.75 - EPS) return;
  OUT = OUT || [canvas(W, H), canvas(W, H)];
  const [[cc, c], [ec, x]] = OUT;
  for (const q of [c, x]) { q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; q.clearRect(0, 0, W, H); }
  if (t < 39.10 + 3 / 12 - EPS) {   // 钩杆：钩在底杠下唇（钩子在底杠后面）；39.10 起 3 张顺着杆往下撤
    const [px, py] = w2s(POLE.x, h, WIN.z), k = t < 39.10 - EPS ? -1 : step12(t, 39.10), s = k < 0 ? 0 : [60, 170, 320][k];
    hookPole(c, x, px + Math.sin(POLE.a) * s, py - 4 + Math.cos(POLE.a) * s, POLE.a);
  }
  if (t >= 39.10 - EPS) {   // 手：3 张从窗台下伸上来、四指伸到底杠后面扣住，之后随底杠下落
    const [hx, hy] = w2s(-0.12, h, WIN.z), i = step12(t, 39.10), dy = i < 3 ? [100, 45, 12][i] : 0, k = i < 3 ? [0, .45, .8][i] : 1;
    hand(c, x, { pose: barPose, x: hx, y: hy + dy, s: 55, k, light: 's13', side: 'R', arm: 9 });
  }
  const gl = A.plateA.shutter.glass;
  c.globalCompositeOperation = 'source-atop'; c.drawImage(gl.c, 0, 0); c.globalCompositeOperation = 'source-over';
  const clip = F.winPanes(h);   // 底杠下沿以下的窗格：底杠、门板在手和杆前面
  for (const [dst, src] of [[g, cc], [e, ec]]) { dst.save(); dst.clip(clip); dst.drawImage(src, 0, 0); dst.restore(); }
}

// 卷帘门落下时屋里变暗：窗被门挡住的比例 c → 屋里（除了窗格、光斑、碗沿那张光斑）盖一层近黑靛；落定后 40.5 前再压一点 =「屋里全黑」
// 只剩门板冲孔透进来的光点（门板在窗格里，不盖）。灯罩 / 灯绳在窗前，单独画进离屏再整体压暗（不在窗格边上断开）
const DARK = '#07060F';
function roomDark(t, h) {
  const c = Math.min(1, Math.max(0, (WIN.y1 - h) / (WIN.y1 - WIN.y0)));
  return .8 * c * c + .1 * Math.min(1, Math.max(0, (t - 39.75) / .75));
}
function darken(g, k, keep) {
  g.save();
  for (const m of keep) { if (!m) continue; const p = new Path2D(); p.rect(0, 0, W, H); p.addPath(m); g.clip(p, 'evenodd'); }
  g.fillStyle = rgba(DARK, k); g.fillRect(0, 0, W, H);
  g.restore();
}
let TC = null;
function shadeDark(g, e, P, so, k) {
  TC = TC || canvas(W, H); const [c, x] = TC;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H);
  P.shade(x, e, so);
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(DARK, k); x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  g.drawImage(c, 0, 0);
}

// —— a2：主构图 A'（S13：36.0 暖灯版 → 36.75「咔」灯灭 → 38.625 卷帘门落下 → 39.75 落定，屋里全黑 → 40.5 片名） ——
function frameA2(t, g, e, A) {
  const { props: P, fx: F, plates: PL } = A.mods, h = shutterH(t), pull = pullS13(t);
  if (t < 36.75 - EPS) { warmA2(t, g, e, A, pull); drawHand(g, e, handS13(t, P), 'warm', P.beadPos({ pull }).w); return CRT.a; }
  darkBase(g, e, A, t, h);
  // 卷帘门：画在窗里（窗外的雪之后、窗外的手和台面道具之前；灯罩灯绳在窗前，最后画）；下落时竖向拖影 ≤ 16 px，越落越慢
  const u = (t - 38.625) / 1.125;
  PL.drawShutter(g, e, A, h, u > 0 && u < 1 ? 16 * (1 - u) : 0);
  outside(g, e, A, t, h);
  // 台面上的东西：湿布痕是台面的一部分 → 雪影落在它上面 → 道具盖住雪影
  // 第 5 轮（导演）：所有 cel 走同一张光斑遮罩（props.spotMask：三块光斑，窗棂影是空隙）——台面上的东西用台面那张；
  // 红沿碗碗沿高出台面 7 cm、又在光斑最里端，用同一个函数取碗沿高度那张 → 光斑往窗口退时碗沿最后熄
  const tm = P.spotMask(h, TABLE.y), rim = P.spotMask(h, OBJ.bowlA2.c[1] + OBJ.bowlA2.h), o = { light: 'dark', shutter: h, spot: tm };
  P.wipe(g, e, o); wipeCrumbs(g, 'dark');
  F.snowShadows(g, t, { shutter: h, clip: bowlKeepOut() });
  basinCheat(g, e, P, { ...o, flip: true });
  P.pin(g, e, { ...o, at: 'A2' });
  P.apron(g, e, o);
  P.bowl(g, e, { ...o, at: 'A2', spot: rim });
  const k = roomDark(t, h), so = { light: 'dark', cordSwing: cordSwingS13(t), pull };
  if (k > 0) { darken(g, k, [F.winPanes(WIN.y1), tm, rim]); shadeDark(g, e, P, so, k); }
  else P.shade(g, e, so);
  drawHand(g, e, handS13(t, P), 'out', P.beadPos(so).w);
  if (t >= 40.5 - EPS) {
    // 片名的光微微照亮门板（只在窗格里），再画片名
    if (titleLevel(t)) { g.save(); g.clip(F.winPanes(WIN.y1)); airbrush(g, 960, 320, 560, 210, BG.night.lampGold, .1, 1); g.restore(); }
    drawTitle(g, e, null, t);
  }
  return CRT.a2;
}

// —— s5：逆光面片（第 3 轮导演裁决重画）——
// 近景仰拍：擀面杖横在最上方（y 62–108）两头露出；面片挂在杖上像一面帘子垂下（宽 1250，最低 y ≈ 760）；隔着面皮透出圆形灯泡热点
// + 墨绿灯罩口暗环（props.doughBacklit）；两只剪影拳握在杖两端、面片外侧（hands.s5Hands：前臂前缩、袖卷占下角）；面粉在面片下沿和溢光带里。
// 布局常量在 props.S5（杖、面片、握点），灯芯中心取 plateS5.lamp。
// 上摇 6°：12.375–13.5 画面整体下移 118 px（ease-in-out），之后定住；背景、面片、手都跟着走
const ease = u => u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
function s5Shift(t, shift) { const u = Math.min(1, Math.max(0, (t - 12.375) / 1.125)); return -shift * (1 - ease(u)); }
// 第 5 轮：面片 / 杖 / 手 / 灯绳整体下移 S5DN px（拳头离开画框上沿，背景墙不动）；灯芯在面片里再往下 S5LAMP px；
// S5ARM：前臂露出长 / 方向（传给 hands.s5Hands），袖卷落到画面下角 y > 800
const S5DN = 72, S5LAMP = 40, S5ARM = { fore: 2.7, armA: 70 };
// 第 6 轮：灯是屋里固定的东西 —— 灯泡、罩口环、灯绳、木珠只跟上摇 dy 走；面片 / 杖 / 手相对屋子自己动，从不动的灯前面滑过：
// 12.00 手腕先沉 dip px（预备，0.25 s），t0–t1 从低 h px 处往上举（ease-out：先快后慢，跑在上摇前面 → 12.375 镜头还没动时面片已在不动的灯前举上来一截，
// 上摇过程中还在举，灯和面片始终不同步），12.6 起举着轻轻晃（横 ±sx、竖 ±sy，周期 T 秒，1 s 淡入）；按 12 fps 一拍（赛璐璐一拍二，上摇照常逐帧）
// low：灯芯落点比第 5 轮再往下 low px（屏幕），举起前罩口环也离杖 30 px 以上
const S5LIFT = { h: 80, t0: 12.1, t1: 13.4, dip: 6, sx: 18, sy: 5, T: 2.4, low: 60 };
function s5Lift(t) {
  const q = Math.floor(t * 12 + 1e-6) / 12, u = Math.min(1, Math.max(0, (q - S5LIFT.t0) / (S5LIFT.t1 - S5LIFT.t0)));
  const dip = q < 12.25 ? S5LIFT.dip * Math.sin(Math.PI * Math.max(0, q - 12) / .25) : 0;
  const w = Math.min(1, Math.max(0, q - 12.6)), ph = TAU * (q - 12.6) / S5LIFT.T;
  return [S5LIFT.sx * w * Math.sin(ph), S5LIFT.h * (1 - u) ** 2 + dip + S5LIFT.sy * w * Math.sin(2 * ph + .9)];
}

// 背景板：plateS5 下半是高窗和反写字，导演定 S5 不要窗、不要字、不露天花板 → 这一帧不用 plateS5，自己画一张暗的暖墙。
// 和 A / A' 同一手法：逐像素喷枪色带（色取 pal BG.warm）+ 低频斑驳 + 确定性抖动，加载时画一次（高 H + 上摇量），之后只平移。
// 灯在面片正后方偏上 → 受光是以灯上方为心的宽椭圆：面片上沿和两侧亮，往下压暗、下角最暗；墙上一块喷枪水渍；
// 灯绳（layout CORD，经 plates.s5 机位投影）从面片下摆后面垂出来，末端木珠，逆光剪影 + 顶上一线暖金。
// 发光板：只放灯从面片四周漏出的一层暖光（面片、杖、手各自印黑），bloom 后成为包着剪影的外溢晕
const S5WALL = [[0, mix(BG.warm.grain, BG.warm.woodDark, .5)], [.35, mix(BG.warm.woodDark, BG.warm.wood, .3)], [.6, mix(BG.warm.wallFar, BG.warm.wood, .45)],
  [.82, mix(BG.warm.woodHalo, BG.warm.wallFar, .35)], [1, mix(BG.warm.wallNear, BG.warm.woodHalo, .45)]];
const S5STAIN = { c: [520, 22], r: [200, 70] };   // 第 5 轮：水渍挪到杖上方左边的墙顶（从顶上渗下来，呼应 A）；原来左下那块无来由的暗团去掉
const vn = (x, y) => {   // 值噪声（低频斑驳用）
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), h = (p, q) => hash(p * 57.31 + q * 113.7);
  return (h(xi, yi) * (1 - a) + h(xi + 1, yi) * a) * (1 - b) + (h(xi, yi + 1) * (1 - a) + h(xi + 1, yi + 1) * a) * b;
};
const sst = (a, b, v) => { const u = Math.min(1, Math.max(0, (v - a) / (b - a))); return u * u * (3 - 2 * u); };
let S5P = null;
function s5Plate(lamp, shift) {
  if (S5P) return S5P;
  const HT = H + shift, [c, g] = canvas(W, HT), [ec, e] = canvas(W, HT), im = g.createImageData(W, HT), d = im.data;
  // 第 5 轮：受光心挪到面片中部（灯在面片正后方）→ 杖上方那条不再是暖光带，是暗墙色
  const st = S5WALL.map(([t, col]) => [t, hex(col)]), [lx, ly] = [lamp[0], lamp[1] + S5DN + 230], [sx, sy] = S5STAIN.c;
  for (let j = 0; j < HT; j++) for (let i = 0; i < W; i++) {
    const q = ((i - lx) / 820) ** 2 + ((j - ly) / 480) ** 2, n = vn(i / 260, j / 260) * .6 + vn(i / 90 + 5.1, j / 90 + 1.3) * .4;
    let L = (.15 + 1 / (1 + 1.6 * q)) * (1 - .5 * sst(560, 1080, j)) + (n - .5) * .12;
    const sd = Math.hypot((i - sx) / S5STAIN.r[0], (j - sy) / S5STAIN.r[1]) * (1 + .3 * (vn(i / 55, j / 55) - .5));   // 水渍：里面暗一点，边上一圈更暗的水线
    L += .025 * (1 - sst(.8, 1, sd)) - .07 * Math.exp(-(((sd - .97) / .035) ** 2));   // 喷枪水渍：里面泛白一点，边上一圈暗水线
    let m = 0; while (m < st.length - 2 && L > st[m + 1][0]) m++;
    const [t0, A] = st[m], [t1, B] = st[m + 1], u = Math.min(1, Math.max(0, (L - t0) / (t1 - t0))), k = (j * W + i) * 4;
    const dz = (((i * 73856093) ^ (j * 19349663)) >>> 0) % 997 / 997 * 2.4 - 1.2;   // 抖动：防喷枪色带出色阶
    for (let ch = 0; ch < 3; ch++) d[k + ch] = A[ch] + (B[ch] - A[ch]) * u + dz;
    d[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, HT);   // 第 5 轮：杖上方不再放漏光（不进发光板）；面片外溢只由 props.doughBacklit 沿下沿和两侧放
  S5P = { c, e: ec, h: HT };
  return S5P;
}
// 灯绳 + 木珠：从灯罩顶垂到木珠（屋内坐标 CORD），经 S5 机位投影；画在面片之前 → 上段被面片挡住，只在下摆下面露出来
// 第 5 轮：灯绳从灯罩口环下沿（木珠正上方那一点）竖直垂到木珠；返回 [环上那点, 木珠顶]，给 doughBacklit 在面皮里画同一条 2 px 透影
// 第 6 轮：钉在屋里 —— lamp = 灯芯中心（屏幕坐标，已含上摇），dy = 木珠的竖向位移（上摇 + S5DN），都不吃面片的举起和晃
function s5Cord(g, e, PL, dy, lamp, L) {
  const bot = PL.s5(CORD.top[0], CORD.bottomY, CORD.top[2]), r = PL.s5(CORD.top[0] + 0.0125, CORD.bottomY, CORD.top[2])[0] - bot[0];   // 木珠半径 1.25 cm
  const x = bot[0], u = Math.min(.95, Math.abs(x - lamp[0]) / L.ring[0]), top = [x, lamp[1] + L.ring[1] * Math.sqrt(1 - u * u) - 6], by = bot[1] + dy - r;
  const cord = poly([[x - 2.2, top[1]], [x + 2.2, top[1]], [x + 2.2, by], [x - 2.2, by]]);
  g.fillStyle = mix(C('cord', 'warm').s, SIL.s5.line, .55); g.fill(cord);
  g.fillStyle = SIL.s5.rim; g.fill(poly([[x - 2.2, top[1]], [x - .8, top[1]], [x - .8, by], [x - 2.2, by]]));   // 朝面片中心一侧 1.4 px 暖金
  const bead = new Path2D(); bead.arc(x, bot[1] + dy, r, 0, TAU);
  cel(g, bead, { f: mix(C('pin', 'warm').s, SIL.s5.line, .35), rim: { c: SIL.s5.rim, d: [0, 2.5] }, l: SIL.s5.line, lw: 1.6 });
  e.fillStyle = '#000'; e.fill(cord); e.fill(bead);
  return [top, [x, by]];
}

// 三渲二（2026-11-05）：杖和两只拳头 + 前臂袖子换成三维（shots/s5.js；2D 版备份在 shots/s5_2d.js）。面皮、灯、灯绳木珠、背景墙仍是 2D
import * as S5R from './shots/s5.js';
function frameS5(t, g, e, A) {
  // 2026-11-05 用户：举面皮时「灯跟着动」不对 → 取消上摇（原 dy = s5Shift(t, PL.S5C.shift)），固定机位：灯在画面上不动，只有面皮、杖、手从灯前举起
  const { props: P, fx: F, plates: PL } = A.mods, dy = 0, [mx, my] = s5Lift(t), dd = dy + S5DN + my, L = P.S5;
  const lamp = [A.plateS5.lamp[0], A.plateS5.lamp[1] + S5LAMP], B = s5Plate(lamp, PL.S5C.shift);
  const LP = [lamp[0], lamp[1] + S5DN + S5LIFT.low + dy];   // 灯芯中心（屏幕）：钉在屋里，只跟上摇
  // 0) 背景板（下移 dy，不跟 S5DN）+ 灯绳木珠（从罩口环垂下来，同样钉在屋里）
  g.drawImage(B.c, 0, dy); e.drawImage(B.e, 0, dy);
  const cord = s5Cord(g, e, PL, dy + S5DN, LP, L);
  // 1) 面片 + 三维杖（跟着举起 / 晃 mx my）：灯芯、浅金区写进发光板，厚边、灯的透影、杖印黑；灯芯 / 罩口环 / 灯绳透影按 LP 画、裁进面片
  //    S5R.rig 先按杖轴屏幕点摆好三维杖和手，返回杖投影半径 → doughBacklit 的卷边 / 压痕对齐三维杖；杖由 doughBacklit 在卷边之前回调 S5R.pin 渲
  const R5 = S5R.rig({ x: L.cx + mx, y: L.top + dd, t });
  const D = P.doughBacklit(g, e, { t, dx: mx, dy: dd, lamp: LP, ldy: 0, cord, r: R5.r, pin: S5R.pin });
  // 2) 面粉：在屋里飘（扣掉面片自己的位移 → 不粘在面片上），面片挡着的不画，一半进发光板闪；星芒只在发光板、在灯芯上
  F.flourMotes(g, e, t, { edge: D.edge, off: [-mx, -my], n: 26, exclude: D.sheet, glint: D.core });
  // 3) 两只三维拳头 + 前臂袖子（最前）：握点跟杖一起举、一起晃；剪影套 + 2–3 px 暖金轮廓光，剪影印进发光板
  S5R.fists(g, e);
  return CRT.s5;
}

const BY_FRAME = { a: frameA, a2: frameA2, s5: frameS5 };
const byTime = t => t < 12 ? 'a' : t < 15 ? 's5' : 'a2';
export function draw({ t, g, e, ov, A, frame }) {
  const f = BY_FRAME[frame] ? frame : byTime(t);
  return BY_FRAME[f](t, g, e, A) || {};
}
