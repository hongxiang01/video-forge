// S7 锅口（18.0–21.0 s）—— 正俯锅口特写：接 S6 抖面——师傅的右手从画面下沿（他站的那侧）攥着一把面，头 6 帧一拍两格 3 张松手（攥 → 半张 → 张开，手往右下沿退出画，最后一张只剩手指在下沿一闪；三渲二的手，见 masterHand），
// 面梢先落水，接触那 2 帧出 6 片硬边水花，之后一拍两格 3 张散成水下一圈松螺旋；
// 18.35 起锅壁边冒几小团热气（不挡面），19.5 起 cel 热气一团团不规则地翻滚着涌上来扑向镜头，20.833 起 4 帧白闪（发光板增益 ×1.5 / ×2.5 / ×4，最后一帧全白），21.0 硬切 S8。
// 镜头：缩放 100% → 108%（ease-in，锚点锅心）。光：吊灯在左上；锅底灶火只在锅沿外露出火舌（进发光板）。灶台在案板左边：画右沿露一条同一块案板。
// 色值：TREATMENT §4.3 锅 · 铝、§4.4 落锅 / 生面条、§9 附 1 热气。非主构图镜头，屏幕坐标直接布局。
import * as THREE from 'three';
import { W, H, TAU, cel, path, ribbon, line, airbrush, mix, rng, hash, canvas } from '../lib/cel.js';
import { C } from '../pal.js';
import { STEAM } from '../fx.js';
import { sun, draw3d } from '../lib3d.js';
import { makeHand } from '../hand3d.js';

const POT = C('pot'), DOUGH = C('dough'), FLOUR = '#F4EBD8';
const WATER = { f: '#B8B8A9', s: '#564F65' }, FOAM = { f: '#FFF4DC', l: '#7E707B', s: '#D9CDBE' };
const UNDER = { f: mix(DOUGH.f, WATER.f, .22), s: mix(DOUGH.s, WATER.s, .3) };   // 水下的面：不描边，用水的颜色压一层
const O = [960, 500], KY = .93;                    // 锅心；锅口椭圆纵横比（略斜的正俯）
const RIM = 650, LIP = 42;                         // 锅沿外半径、沿宽
const WC = [960, 532], WR = [548, 490];            // 水面（比锅沿低，中心往下挪：远侧锅壁多露一些）
const DROP = [966, 560];                           // 面落水点
const NS = 15, NP = 18;                            // 面条根数、每根采样点
const LDS = [-4, -5];                              // cel 自动阴影的位移（朝灯：左上）

const E = (c, rx, ry) => { const p = new Path2D(); p.ellipse(c[0], c[1], rx, ry, 0, 0, TAU); return p; };

// —— 灶台 + 炉架 + 锅沿外露出的火舌 ——
function stove(g, e, lt) {
  g.fillStyle = '#2A2130'; g.fillRect(-200, -200, W + 400, H + 400);
  airbrush(g, O[0], O[1], 1080, 900, '#6A3E36', .55, .7);              // 灶膛火光映在灶台上（背景喷枪）
  const BX = 1700;                                                     // 灶台右边就是案板（S2–S6 那一块）：木板横铺，光圈外的木色，靠灯一侧一团光圈色
  g.fillStyle = '#4A2C1E'; g.fillRect(BX - 16, -200, 16, H + 400);    // 案板厚度的侧面
  g.fillStyle = '#7A4A2A'; g.fillRect(BX, -200, W + 200 - BX, H + 400);
  g.save(); g.beginPath(); g.rect(BX, -200, W + 200 - BX, H + 400); g.clip();
  airbrush(g, BX - 120, 120, 420, 520, '#A86E3C', .9, .75);
  for (let i = 0; i < 9; i++) { const y = -60 + i * 150 + 20 * hash(i + 3); line(g, [[BX, y], [BX + 140, y + 6 * Math.sin(i)], [W + 60, y - 4]], '#5E3820', 2); }
  g.fillStyle = '#F4EBD8'; for (let i = 0; i < 26; i++) { const x = BX + 14 + hash(i * 3.1) * 200, y = 80 + hash(i * 7.7) * 900, r = 1.5 + 3 * hash(i * 1.3); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }   // 散的干粉
  g.restore();
  g.strokeStyle = '#2E1A12'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(BX, -200); g.lineTo(BX, H + 200); g.stroke();
  g.save(); g.beginPath(); g.rect(-200, -200, BX - 16 + 200, H + 400); g.clip();
  for (let i = 0; i < 8; i++) {                                        // 炉架：8 根铁条从锅底放射出去（不压到案板上）
    const a = (i + .5) / 8 * TAU, c = Math.cos(a), s = Math.sin(a), w0 = 20, w1 = 30;
    const P = [[O[0] + c * 520 - s * w0, O[1] + s * 520 + c * w0, 1], [O[0] + c * 1400 - s * w1, O[1] + s * 1400 + c * w1, 1],
      [O[0] + c * 1400 + s * w1, O[1] + s * 1400 - c * w1, 1], [O[0] + c * 520 + s * w0, O[1] + s * 520 - c * w0, 1]];
    cel(g, P, { f: '#4A3A40', s: '#1C1520', so: [7, 9], l: '#140E14', lw: 2.5 });
  }
  g.restore();
  const k = Math.floor(lt * 12), pt = (a, r) => [O[0] + Math.cos(a) * r, O[1] + Math.sin(a) * r * KY];
  for (let i = 0; i < 30; i++) {                                       // 火舌按一拍两格换张；只零星几簇从锅底边露个尖
    if (hash(i * 5.3 + k * 1.7) < .55) continue;
    const a = i / 30 * TAU, hw = TAU / 30 * .3, L = 22 + 30 * hash(i * 13 + k * 7), r0 = RIM - 16, ln = (hash(i + k * 3) - .5) * .05;
    const out = path([[...pt(a - hw, r0)], [...pt(a + ln, r0 + L), 1], [...pt(a + hw, r0)]]);
    const core = path([[...pt(a - hw * .45, r0)], [...pt(a + ln, r0 + L * .5), 1], [...pt(a + hw * .45, r0)]]);
    g.fillStyle = '#D9702E'; g.fill(out); g.fillStyle = '#FFD27A'; g.fill(core);
    e.fillStyle = '#A8501E'; e.fill(out); e.fillStyle = '#E8A860'; e.fill(core);
  }
}

// —— 铝锅：锅沿（卷边）+ 内壁 ——
function pot(g, e) {
  const outer = E(O, RIM, RIM * KY), ri = RIM - LIP, inner = E(O, ri, ri * KY);
  e.fillStyle = '#000'; e.fill(outer);                                 // 锅身挡住灶火 → 发光层印黑
  g.save(); g.clip(inner);                                             // 内壁：整片暗面，右下一弯朝灯受光
  g.fillStyle = mix(POT.f, POT.s, .3); g.fill(inner);
  g.fillStyle = POT.s; g.fill(E([O[0] - 110, O[1] - 60], ri, ri * KY));
  g.restore();
  const ring = new Path2D(); ring.addPath(outer); ring.addPath(inner);
  g.save(); g.clip(ring, 'evenodd');
  g.fillStyle = POT.s; g.fill(outer);
  g.fillStyle = POT.f; g.fill(E([O[0] - 12, O[1] - 15], RIM, RIM * KY));   // 卷边外缘右下留一弯背光
  g.fillStyle = POT.s; g.fill(E([O[0] + 10, O[1] + 12], ri + 4, (ri + 4) * KY)); g.fillStyle = POT.f; g.fill(E([O[0] + 3, O[1] + 4], ri + 2, (ri + 2) * KY));
  g.strokeStyle = POT.h; g.lineCap = 'butt';                           // 左上硬边高光两段
  for (const [w, a0, a1] of [[10, 3.5, 4.35], [6, 4.48, 4.72], [6, .3, .62]]) {
    g.lineWidth = w; g.beginPath(); g.ellipse(O[0], O[1], RIM - LIP * .5, (RIM - LIP * .5) * KY, 0, a0, a1); g.stroke();
  }
  g.restore();
  g.strokeStyle = POT.l; g.lineWidth = 3; g.stroke(outer); g.lineWidth = 2.5; g.stroke(inner);
}

// —— 滚水：暗纹 + 吊灯倒影（碎成几块）+ 锅壁一圈白沫；每 4 帧换一组 ——
function water(g, e, fi) {
  const Wp = E(WC, WR[0], WR[1]), b = Math.floor(fi / 4);
  g.fillStyle = WATER.f; g.fill(Wp);
  g.save(); g.clip(Wp); e.save(); e.clip(Wp);
  const R = rng(9100 + b);
  for (let i = 0; i < 13; i++) {                                       // 波峰：暗色团再被朝灯挪开的亮色团盖住，只留右下一弯硬边暗纹
    const a = R() * TAU, r = Math.pow(R(), .9) * .85, cx = WC[0] + Math.cos(a) * WR[0] * r, cy = WC[1] + Math.sin(a) * WR[1] * r, rr = 28 + R() * 55, pts = [];
    for (let j = 0; j < 7; j++) { const q = j / 7 * TAU, d = rr * (.7 + .5 * R()); pts.push([cx + Math.cos(q) * d, cy + Math.sin(q) * d * .7]); }
    const P = path(pts); g.fillStyle = WATER.s; g.fill(P);
    g.save(); g.translate(-10, -13); g.fillStyle = WATER.f; g.fill(P); g.restore();
  }
  const R2 = rng(5300 + b);
  for (let j = 0; j < 4; j++) {                                        // 吊灯倒影
    const cx = 690 + (R2() - .5) * 70 + j * 30, cy = 255 + (R2() - .5) * 40 + j * 16, rx = 66 - j * 13 + R2() * 12, pts = [];
    for (let q = 0; q < 8; q++) { const t = q / 8 * TAU, d = .75 + .4 * R2(); pts.push([cx + Math.cos(t) * rx * d, cy + Math.sin(t) * rx * .42 * d, q % 2]); }
    const P = path(pts); g.fillStyle = FOAM.f; g.fill(P); e.fillStyle = '#FFE6B8'; e.fill(P);
  }
  g.restore(); e.restore();
  g.strokeStyle = FOAM.f; g.lineWidth = 7; g.lineCap = 'round';      // 锅壁水线白沫，断断续续
  for (let k = 0; k < 44; k++) {
    if (hash(k * 3.1 + b * .7) < .35) continue;
    const a0 = k / 44 * TAU; g.beginPath(); g.ellipse(WC[0], WC[1], WR[0] - 2, WR[1] - 2, 0, a0, a0 + .09); g.stroke();
  }
}

// —— 面条几何：一把面从画面下沿（师傅那侧）进来。j = 0 是面梢（朝锅心、先落水），j = NP-1 是攥在手里的一头（朝下沿）——
// tip / top：面梢中心、手里那头中心；wt / wh：面梢散开的宽、手里那头的宽（正俯有透视：离镜头近的手里那头在下沿，往锅心收）
function bunch(i, tip, top, wt, wh) {
  const v = i / (NS - 1) - .5, x0 = tip[0] + v * wt + (hash(i + 7) - .5) * 8, y0 = tip[1] + (hash(i + 3) - .5) * 26, x1 = top[0] + v * wh, y1 = top[1] + (hash(i + 11) - .5) * 34, pts = [];   // 手里那头也长短不齐
  for (let j = 0; j < NP; j++) { const u = j / (NP - 1); pts.push([x0 + (x1 - x0) * u + Math.sin(u * 4.2 + i * 1.7) * 10 * (1 - u), y0 + (y1 - y0) * u]); }   // 缎带正弦 10 px：刚抖过，面梢还在晃
  return pts;
}
// 头 6 帧（一拍两格 3 张）：攥在拳里（手里那头藏在四指底下，面梢抖开、垂向锅心）→ 松手往下落（手里那头从半张的指尖下滑出去）→ 碰水
// 每项 [面梢, 手里那头, 面梢宽, 手里宽]；手的位置见 HK（三维的手）
// 第 1 张的手里那头收窄、压到三维手的捏点底下（拇指和食指之间），看得出是捏着的
const FALL = [[[978, 598], [1020, 892], 230, 56], [[968, 575], [1010, 800], 240, 130], [[966, 548], [992, 700], 250, 170]];
function spiral(i, rot) {                                              // 水下松松的一圈螺旋
  // 每根绕的圈心各偏一点、绕的角度和松紧都不一样 → 一团乱一点的面，不是规整的风车
  const a0 = i / NS * TAU * .86 + hash(i) * .6 + rot, span = 1.5 + hash(i + 40) * 1.6, r0 = 24 + hash(i + 80) * 60, gr = 120 + 170 * hash(i + 120), pts = [];
  const cx = DROP[0] + (hash(i + 160) - .5) * 110, cy = DROP[1] + (hash(i + 170) - .5) * 80, ky = .78 + .24 * hash(i + 180);
  for (let j = 0; j < NP; j++) { const u = j / (NP - 1), th = a0 + span * u, r = r0 + gr * u + 22 * Math.sin(u * 5 + i * 1.3); pts.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r * ky]); }
  return pts;
}
const lerp = (A, B, u) => A.map((p, j) => [p[0] + (B[j][0] - p[0]) * u, p[1] + (B[j][1] - p[1]) * u]);
const wid = u => 17 * Math.min(1, (1 - u) * 10 + .25, u * 10 + .25);
const widP = u => (14 + 6 * u) * Math.min(1, (1 - u) * 25 + .6, u * 25 + .6);    // 还在水上的一把：手里那头离镜头近、宽，面梢远、窄；两头是刀切的钝头，不削尖

function strand(g, e, pts, surf, wf = wid) {
  const P = path(ribbon(pts, wf), true);
  if (surf) {
    cel(g, P, { f: DOUGH.f, s: DOUGH.s, so: LDS, l: DOUGH.l, lw: 2 });
    line(g, pts.slice(2, -2).map(([x, y]) => [x - 2.5, y - 2.5]), FLOUR, 2);   // 每根一条 2 px 干粉高光
  } else cel(g, P, { f: UNDER.f, s: UNDER.s, so: LDS });
  e.fillStyle = '#000'; e.fill(P);
  return P;
}

function noodles(g, e, lt, fi, pass) {
  if (fi < 4) {                                                        // 攥着 2 帧 → 下落 2 帧（一拍两格）
    if (pass !== 'top') return;
    const [tp, hp, wt, wh] = FALL[fi < 2 ? 0 : 1];
    for (let i = 0; i < NS; i++) strand(g, e, bunch(i, tp, hp, wt, wh), true, widP);
    return;
  }
  if (fi < 6) {                                                        // 接触 2 帧：面梢那半截没进水里，手里那头还在水上（朝下沿）
    const cut = DROP[1] + 40, [tp, hp, wt, wh] = FALL[2];
    for (let i = 0; i < NS; i++) {
      const pts = bunch(i, tp, hp, wt, wh);
      g.save(); e.save(); const r = new Path2D(); pass === 'top' ? r.rect(-200, cut, W + 400, H + 400) : r.rect(-200, -400, W + 400, cut + 400); g.clip(r); e.clip(r);
      strand(g, e, pts, pass === 'top', widP); g.restore(); e.restore();
    }
    return;
  }
  const k = fi < 12 ? Math.floor((fi - 6) / 2) : 3, u = [1 / 3, 2 / 3, 1, 1][k];
  const rot = fi < 12 ? 0 : .22 * Math.floor((lt - .5) * 12) / 12;
  for (let i = 0; i < NS; i++) {
    const pts = lerp(bunch(i, [966, 548], [985, 660], 250, 210), spiral(i, rot), u);
    if (pass === 'under') strand(g, e, pts, false);
    else if (u > .5 && i % 4 === 1) strand(g, e, pts.slice(6, 11), true);   // 几段弧露出水面
  }
}

// —— 师傅的右手（三渲二）：三维的手 + 前臂袖子，用和二维锅口对得上的机位渲出来，压在面上（同一个推镜 T）——
// 世界坐标（米）：锅心在原点、锅沿平面 y = 0；X 向右，Y 向上，Z 朝师傅（画面下沿）。机位在师傅这一侧斜俯 22°（锅口椭圆纵横比 ≈ cos 22° ≈ KY），
//   锅沿半径 0.24 m 正好落在二维的 RIM（650 px）上，锅心落在 O。吊灯在左上（同 S4 的光向），硬边投影落在水面上，不加环境光。
// 头 6 帧一拍两格 3 张：捏（接 S6 结尾的捏法：拇指和食指、中指捏住面把上端，无名指小指蜷着）→ 半张（拇指离开、食指中指松开，面从指尖下滑出去，手往后撤）
//   → 张开（五指松开撇开，手往右下沿退出画，只剩手指在下沿一闪）。
const D2R = Math.PI / 180, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const CAM = { D: 1.0, tilt: 22 * D2R, rim: 0.24 }, FPX = RIM * CAM.D / CAM.rim;   // FPX = 焦距（px）
// 手型（度）：四指 [张开, 掌指关节弯, 中节弯, 末节弯]；拇指 [指根张开, 指根弯, 第二节弯, 末节弯]。hold 就是 S6 结尾的 pinch
const HP = {
  hold: { thumb: [28, 30, 22, 14], index: [10, 46, 34, 14], middle: [2, 52, 38, 16], ring: [-6, 74, 80, 42], pinky: [-12, 78, 78, 42] },
  half: { thumb: [28, 18, 8, 2], index: [11, 26, 16, 6], middle: [2, 30, 20, 8], ring: [-6, 56, 58, 30], pinky: [-12, 60, 60, 30] },   // 拇指尖和食指尖分开，捏口张开
  open: { thumb: [48, 4, 2, 0], index: [14, 8, 8, 4], middle: [3, 10, 10, 5], ring: [-9, 14, 12, 6], pinky: [-18, 18, 14, 6] },
};
// 每张 [手型, 手背朝向, 往手腕的方向, 手相对第 1 张的位移（米）]；第 1 张的捏点对准二维面把的上端 PIN0（离镜头 PD 米）
// 朝向接 S6 结尾：手背朝右上，从正俯看到食指一侧——食指勾下来、拇指从底下顶上去，面把夹在两个指尖之间；前臂往右下沿（师傅那侧）出画
const PIN0 = [1018, 878], PD = 0.84, ARM = [.45, -.05, .89];
const HK = [
  ['hold', V3(.8, .55, .15), V3(.38, .2, .9), V3(0, 0, 0)],
  ['half', V3(.8, .55, .15), V3(.38, .18, .9), V3(.02, .025, .055)],
  ['open', V3(.45, .85, .2), V3(.38, .15, .91), V3(.04, .04, .11)],
];
function orient(o, Y, Z) {                                             // 同 S6：Y = 手背朝向、Z = 往手腕的方向（世界），X = Y × Z
  const z = Z.clone().normalize(), y = Y.clone().addScaledVector(z, -Y.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const wp = (hd, n) => { const v = new THREE.Vector3(); hd.root.updateMatrixWorld(true); hd.B[n].getWorldPosition(v); return v; };
let S3 = null;
function setup3d() {
  if (S3) return S3;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(2 * Math.atan(H / 2 / FPX) / D2R, W / H, 0.05, 20);
  cam.position.set(0, CAM.D * Math.cos(CAM.tilt), CAM.D * Math.sin(CAM.tilt)); cam.lookAt(0, 0, 0);
  cam.setViewOffset(W, H, 0, H / 2 - O[1], W, H);                     // 锅心落在 O（比画面中心高 40 px）
  cam.updateMatrixWorld(true);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.ShadowMaterial({ color: new THREE.Color(WATER.s), opacity: .55 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.05; catcher.receiveShadow = true;   // 水面（比锅沿低 5 cm）收手的投影
  catcher.userData.bg = true; catcher.material.userData.outlineParameters = { visible: false };
  const hd = makeHand('R');
  scene.add(catcher, hd.root, hd.arm);
  sun(scene, [-0.55, 1.0, -0.6], 0.6, [0.05, 0, 0.15]);
  const ray = V3(PIN0[0] / W * 2 - 1, 1 - PIN0[1] / H * 2, .5).unproject(cam).sub(cam.position).normalize();
  const P = cam.position.clone().addScaledVector(ray, PD);
  hd.pose(HP.hold); orient(hd.root, HK[0][1], HK[0][2]); hd.root.position.set(0, 0, 0);
  const pm = wp(hd, 'thumb-tip').add(wp(hd, 'index-finger-tip')).multiplyScalar(.5);   // 捏点 = 拇指尖和食指尖的中点
  return (S3 = { scene, cam, hd, root0: P.sub(pm) });
}
function masterHand(g, e, fi) {
  if (fi >= 6) return;
  const s = setup3d(), [p, Y, Z, d] = HK[fi >> 1];
  s.hd.pose(HP[p]); orient(s.hd.root, Y, Z);
  s.hd.root.position.copy(s.root0).add(d);
  s.hd.aimArm(ARM);
  draw3d(g, e, s.scene, s.cam);
}

// —— 接触 2 帧：6 片硬边水花 + 水珠 ——
function splash(g, e, fi) {
  const k = fi - 4, sc = k ? 1.3 : .85;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + .35 + hash(i) * .3, L = (120 + 80 * hash(i + 3)) * sc, w = 36 + 16 * hash(i + 5), c = Math.cos(a), s = Math.sin(a);
    const bx = DROP[0] + c * 46, by = DROP[1] + s * 40;
    const pts = [[bx - s * w * .5, by + c * w * .5], [bx + c * L * .55 - s * w * .62, by + s * L * .55 + c * w * .62], [bx + c * L, by + s * L, 1],
      [bx + c * L * .55 + s * w * .62, by + s * L * .55 - c * w * .62], [bx + s * w * .5, by - c * w * .5]];
    const P = cel(g, pts, { f: FOAM.f, s: FOAM.s, so: [-6, -7], l: FOAM.l, lw: 2.2 });
    e.fillStyle = 'rgba(255,236,200,.5)'; e.fill(P);
    for (let j = 0; j < 2; j++) {
      const d = L * (1.18 + j * .22 + .12 * k), rr = 9 - j * 3, D = E([DROP[0] + c * d, DROP[1] + s * d], rr, rr * .85);
      cel(g, D, { f: FOAM.f, l: FOAM.l, lw: 1.8 });
    }
  }
}

function bubbles(g, e, fi) {
  const R = rng(4200 + Math.floor(fi / 4)), n = fi < 4 ? 34 : fi < 20 ? 14 : 34;   // 面下锅后滚沸短暂压下去
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, r = Math.pow(R(), .8) * .88, rr = 6 + R() * 14, P = E([WC[0] + Math.cos(a) * WR[0] * r, WC[1] + Math.sin(a) * WR[1] * r], rr, rr * .82);
    cel(g, P, { f: FOAM.f, s: FOAM.s, so: [-rr * .25, -rr * .3], l: FOAM.l, lw: 1.8 });
    e.fillStyle = '#000'; e.fill(P);
  }
}

// —— 热气：cel 硬边的不规则气团，按 12 fps 翻滚换张，位移每帧都动 ——
// 前段（18.35–19.5）：贴着左右锅壁冒几小团，往外飘、长大，最后 0.25 s 按 3 张缩小消失，不挡面；
// 19.5 起一团团翻上来扑向镜头（越近越大、往画外散），一直盖到白闪。每团 [起始秒, 方位, 根部离锅心, 前段大小（0 = 大团）, 寿命（0 = 到白闪）]
const PUFFS = [
  ...[0, 1, 2, 3, 4, 5].map(i => [.35 + i * .19, (i % 2 ? .1 : Math.PI - .1) + (hash(i + 900) - .5) * 1.4, 360 + 90 * hash(i + 910), 60 + 45 * hash(i + 920), 1.1]),
  ...Array.from({ length: 16 }, (_, i) => [1.5 + i / 16 * 1.05 + hash(i + 300) * .08, hash(i + 500) * TAU, 60 + hash(i + 600) * 200, 0, 0]),
];
// 一团：团心一块 + 5–8 个大小不一、间距不匀的瓣 + 有时甩出去一小团；瓣绕团心一直往一个方向转（翻滚），每瓣各自鼓缩
function puff(cx, cy, r, i, k12) {
  const P = new Path2D(), add = (x, y, rr) => { P.moveTo(x + rr, y); P.arc(x, y, rr, 0, TAU); };
  const n = 5 + Math.floor(hash(i + 700) * 4), roll = k12 * .16 * (hash(i + 710) < .5 ? -1 : 1);
  add(cx, cy, r * .55);
  for (let j = 0; j < n; j++) {
    const b = (j + (hash(i * 13 + j) - .5) * .7) / n * TAU + roll, q = r * (.36 + .26 * hash(i * 5 + j + 1));
    add(cx + Math.cos(b) * q, cy + Math.sin(b) * q * .85, r * (.22 + .2 * hash(i * 7 + j + 2)) * (1 + .1 * Math.sin(k12 * 1.3 + j * 2.1 + i)));
  }
  if (hash(i + 720) < .6) { const b = hash(i + 730) * TAU + roll * 1.4; add(cx + Math.cos(b) * r * .9, cy + Math.sin(b) * r * .78, r * .14); }
  return P;
}
let PC = null;
function billows(g, e, lt, T, gain) {
  if (!PC) PC = canvas(W, H);
  const [pc, p] = PC, k12 = Math.floor(lt * 12), list = [];
  p.setTransform(1, 0, 0, 1, 0, 0); p.globalCompositeOperation = 'source-over'; p.clearRect(0, 0, W, H); p.setTransform(...T);
  PUFFS.forEach(([ts, ang, d0, R0, life], i) => { const a = lt - ts; if (a >= 0 && (!life || a < life)) list.push([ts, i, a, ang, d0, R0, life]); });
  if (!list.length) return;
  list.sort((x, y) => y[0] - x[0]);                                    // 后升起的（远、小）先画，早升起的（近、大）压在上面
  for (const [, i, a, ang, d0, R0, life] of list) {
    let out, r;
    if (R0) {                                                          // 前段小团：慢慢往外飘、长大；寿命最后 0.25 s 按 3 张缩小
      const sk = a > life - .25 ? [.75, .5, .28][Math.min(2, Math.floor((a - life + .25) / .0834))] : 1;
      out = a * 80; r = R0 * (.55 + .45 * Math.min(1, Math.floor(a * 12) / 4)) * (1 + .5 * a) * sk;
    } else { out = Math.pow(a, 1.6) * 520; r = 60 + 430 * Math.pow(a, 1.35); }
    const cx = WC[0] + Math.cos(ang) * (d0 + out), cy = WC[1] + Math.sin(ang) * (d0 + out) * .8 - a * 60;
    const P = puff(cx, cy, r, i, k12);
    const d = Math.max(3, r * .02), D = r * .32;
    p.fillStyle = STEAM.rim; p.fill(P);                                // 整团先铺暖边色
    p.save(); p.clip(P); p.translate(d, d * 1.3); p.fillStyle = STEAM.lo; p.fill(P);   // 往背光挪：左上留一条暖边
    p.clip(P); p.translate(-d - D * .6, -d * 1.3 - D * .8); p.fillStyle = STEAM.hi; p.fill(P); p.restore();   // 亮阶：右下留 1/3 暗阶
  }
  p.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .88; g.drawImage(pc, 0, 0); g.restore();
  e.save(); e.setTransform(1, 0, 0, 1, 0, 0); e.globalAlpha = Math.min(1, .3 * gain); e.drawImage(pc, 0, 0); e.restore();
}

export function draw(g, e, lt, A, t) {
  const fi = Math.floor(lt * 24 + 1e-6), fl = fi - 68;                // 20.833 = 镜头内第 68 帧
  if (fl >= 3) {                                                       // 白闪最后一帧：全白
    for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H); }
    return { bloom: .85 * 4, halo: .22 * 4 };
  }
  const gain = fl >= 0 ? [1.5, 2.5, 4][fl] : 1;
  const u = Math.min(1, lt / 3), z = 1 + .08 * u * u, T = [z, 0, 0, z, O[0] * (1 - z), O[1] * (1 - z)];
  g.save(); e.save(); g.setTransform(...T); e.setTransform(...T);
  stove(g, e, lt);
  pot(g, e);
  water(g, e, fi);
  noodles(g, e, lt, fi, 'under');
  bubbles(g, e, fi);
  noodles(g, e, lt, fi, 'top');
  if (fi >= 4 && fi < 6) splash(g, e, fi);
  masterHand(g, e, fi);                                                // 离镜头最近：压在最上
  g.restore(); e.restore();
  billows(g, e, lt, T, gain);                                          // 热气全用不规则气团（原来的细缎带像白火苗，粗剪第 2 轮拿掉）
  return fl >= 0 ? { bloom: .85 * gain, halo: .22 * gain } : {};
}
