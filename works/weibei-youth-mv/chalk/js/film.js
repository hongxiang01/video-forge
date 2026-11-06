// 《违背的青春》MV 第 6 版（v3）：黑板粉笔画。镜头表见 ../SHOTBOOK.md（S01–S28）。window.renderAt(t)。
// v3 按第二轮评委：去掉一帧跳变（姿势一律连续过渡）、道具长在手上、真的跳格、车原地变色、副歌提亮画满、少年在拍点落地亮相。
import { clamp, lerp } from '/core/lib.js';
import { Stroke, line, curve, arc, rng, n1 } from './chalk.js';
import { renderFrame, drawSlate, cam, applyCam, characterLayers, W, H } from './main.js';
import { drawFox, paint, gapLine, chalkLine, TEX, HEADS, BODY, PAL, useRig } from './puppet.js';
import { WORLD, WIPES, COL, add, grid, floorGrid, bike, star, waves, digit, hopscotch, crowd, desk, chair, bakeAll, drawWorld } from './world.js';
import { POSE, loadPoses, drawPose, drawStrip, stripTop, setProbing } from './poses.js';

const SONG = await (await fetch('song.json')).json();
const BEATS = SONG.beats, BT = BEATS[1] - BEATS[0];
const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => ss((t - a) / (b - a));
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
const mixP = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
const load = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = f; });
for (const who of ['kid', 'adult']) { for (let k = 0; k < 6; k++) HEADS[who].push(await load(`design/${who}_c${k}.png`)); HEADS[who].push(await load(`design/${who}_c0b.png`)); TEX[who] = await load(`design/tex_${who}.png`); }
await useRig('kid'); await useRig('adult');   // 身子换成骨骼贴图（豆包全身设定图切的部件，见 js/rig.js）
await loadPoses();   // 第 7 版：大动作改用姿势原画（豆包按同一角色画的连续姿势，按时间换张，见 js/poses.js）
const blink = (t, times) => times.some((b) => t >= b && t < b + 0.14);
// 表情按时间切换：ex(t, 起始表情, 时刻1, 表情1, 时刻2, 表情2, …)。切换点前后各 0.05 秒用闭眼头（眨眼换脸），不让整张脸一帧跳变
// 同时点一下头（nod），头的角度变化藏在点头里
const ex = (t, e0, ...sw) => { let e = e0, nod = 0; for (let i = 0; i < sw.length; i += 2) nod = Math.max(nod, bump(t, sw[i] - 0.13, sw[i] + 0.13)); for (let i = 0; i < sw.length; i += 2) { if (Math.abs(t - sw[i]) < 0.05) return { expr: 0, eyes: 2, nod }; if (t >= sw[i]) e = sw[i + 1]; } return { expr: e, nod }; };
const SB = (x) => BEATS.reduce((b, y) => (Math.abs(y - x) < Math.abs(b - x) ? y : b), BEATS[0]);
// 平滑：对一个随时间变化的量取过去 win 秒的平均（消除一帧跳变）
const smoothed = (fn, t, win = 0.3, n = 8) => { let s = 0; for (let i = 0; i < n; i++) s += fn(t - (win * i) / (n - 1)); return s / n; };

// ================= 世界布局 =================
const A1 = { cell: 230 };
add(grid(-3200, -1500, 49, 9, 130, 'grey', 3.5), 0.6, 9.4, { group: 'cal' });
add(floorGrid(-3200, 3600, 0, 300, A1.cell, [200, -1600], 'white', 4.5), 6.2, 10.6, { group: 'floor' });
// 擦不干净的那块：一格彩色跳房子残迹，里面是愿望纸条（吉他 + 星星），被灰雾盖着
const G0 = { x0: 1560, x1: 1800, y0: -4, y1: 104 };
const ghost = add([...digit(1, 1574, 14, 60, 'orange', 6), new Stroke([[G0.x0, G0.y0], [G0.x1, G0.y0], [G0.x1, G0.y1], [G0.x0, G0.y1], [G0.x0, G0.y0]], { color: COL.orange, w: 6, wob: 0.6 })], 0, 0.1, { instant: true, group: 'ghost' });
ghost.forEach((s) => (s.dim = (t) => 0.3 + 0.7 * ramp(t, 23.8, 24.9) * (1 - 0.55 * ramp(t, 26.6, 28.4))));
const wish = add([
  arc(1640, 70, 24, 0, 6.28, { color: COL.orange, w: 6 }), arc(1662, 44, 18, 0, 6.28, { color: COL.orange, w: 6 }), arc(1648, 60, 6, 0, 6.28, { color: COL.white, w: 4 }),
  line(1670, 36, 1730, -2, { color: COL.orange, w: 7 }), line(1724, -8, 1744, 4, { color: COL.orange, w: 8 }),
  line(1640, 74, 1728, 2, { color: COL.white, w: 2 }), line(1646, 78, 1732, 6, { color: COL.white, w: 2 }),
  ...star(1764, 54, 30, 'yellow', 6)], 0, 0.1, { instant: true, group: 'wish' });
wish.forEach((s) => (s.dim = (t) => 0.1 + 0.9 * ramp(t, 24.0, 25.1) * (1 - 0.6 * ramp(t, 26.6, 28.4))));
const ghostHaze = (t) => 0.9 * (1 - 0.88 * ramp(t, 23.8, 25.1));
// 一样的白自行车 / 闪回时原地变彩色（大号，挡在他前面）
const BS = 1.5, bikesW = [], bikesC = [];
for (let i = 0; i < 14; i++) bikesW.push(add(bike(0, 0, BS, 'white', 6), 0, 0.1, { instant: true, group: 'bikeW' }));
['red', 'blue', 'yellow', 'green', 'orange', 'pink'].forEach((c) => bikesC.push(add(bike(0, 0, BS, c, 7), 0, 0.1, { instant: true, group: 'bikeC' })));
// 大人站的位置（S09 之后）和门（他用粉笔头一笔笔画出来）
// 第 7 版：门高 = 踮脚那张画里粉笔尖的高度；门左框在跪着那张画的粉笔尖上（他不用挪步就能画）
const XA = 2450, DL = 2662, DR = 2892, DH = 1034, KNOBY = 347;
const doorS = [new Stroke([[DL, 0], [DL, -DH * 0.5], [DL, -DH]], { color: COL.orange, w: 8, wob: 0.8 }), new Stroke([[DL, -DH], [(DL + DR) / 2, -DH - 6], [DR, -DH]], { color: COL.orange, w: 8, wob: 0.8 }), new Stroke([[DR, -DH], [DR, -DH * 0.5], [DR, 0]], { color: COL.orange, w: 8, wob: 0.8 }), arc(DR - 30, -KNOBY, 8, 0, 6.28, { color: COL.orange, w: 6 })];
// 门框线跟着姿势原画里的粉笔尖走：换一张画，线在 GROW 秒内跟上一截（定格动画的节奏）。[换张时刻, 第几张门姿势]
const DOORT = { L: [[68.62, 0], [68.79, 1], [68.96, 2], [69.13, 3]], TOP: [69.3, 69.48, 69.66, 69.84], R: [[69.98, 3], [70.14, 2], [70.3, 1], [70.46, 0]], KNOB: [70.64, 70.82], GROW: 0.02 };
const DOORF = ['A_door_v2_0', 'A_door_v2_1', 'A_door_v2_2', 'A_door_v2_3'];
const tipH = (id) => (POSE[id].ay - POSE[id].tip[1]) * POSE[id].k;   // 这张画里粉笔尖离地多高（世界单位）
function growTo(t, times, vals) { let v = 0; for (let i = 0; i < times.length && t >= times[i]; i++) v = lerp(i ? vals[i - 1] : 0, vals[i], clamp((t - times[i]) / DOORT.GROW)); return v; }
const doorProg = [
  (t) => growTo(t, DOORT.L.map((q) => q[0]), DOORT.L.map((q) => tipH(DOORF[q[1]]) / DH)),
  (t) => growTo(t, DOORT.TOP, [0, 1 / 3, 2 / 3, 1]),
  (t) => (t > DOORT.R[3][0] + 0.12 ? 1 : growTo(t, DOORT.R.map((q) => q[0]), DOORT.R.map((q) => 1 - tipH(DOORF[q[1]]) / DH))),
  (t) => clamp((t - DOORT.KNOB[0]) / (DOORT.KNOB[1] - DOORT.KNOB[0])),
];
[68.6, 69.29, 69.97, 70.63].forEach((a, i) => { const s = doorS[i]; s.t0 = a; s.t1 = a + 1; s.prog = doorProg[i]; s.group = 'door'; s.hide = 1e9; WORLD.push(s); });
// S10 想画又收回：在墙上画下的一小道，随后被手蹭掉（留一点灰）
// 第 7 版：S10 那一小道线从半身原画的粉笔尖起笔；身子（原画底边中点）不动，第 2 张的粉笔尖就是线的终点
const HESP = [0, 1, 2, 3].map((i) => POSE[`A_hesitate_v1_${i}`]);
const HESB0 = [(HESP[0].foot[0] - HESP[0].ax) * HESP[0].k, (HESP[0].foot[1] - HESP[0].ay) * HESP[0].k];   // 身子底边中点相对第 1 张粉笔尖
const HES = [[2600, -362], [2600 + HESB0[0] + (HESP[1].ax - HESP[1].foot[0]) * HESP[1].k, -362 + HESB0[1] + (HESP[1].ay - HESP[1].foot[1]) * HESP[1].k + 46]];
const HESB = [[0, 0], null, HESB0, HESB0];
let S10th = 0.2;   // S10 预演时算出的小臂角度
const hesS = add([line(...HES[0], ...HES[1], { color: COL.orange, w: 6 })], 52.9, 53.4, { group: 'hes' });
WIPES.push({ t0: 54.25, t1: 54.8, path: [[2596, -374], [2611, -288]], w: 46, soft: 10, haze: 0.25 });
[73.0, 73.71, 74.43, 75.14].forEach((t0, k) => WIPES.push({ t0, t1: t0 + 0.35, path: [[DL - 60 - k * 230, 60], [DL - 60 - (k + 1) * 230, 160]], w: 260, soft: 18, haze: 0 }));
// 回忆（彩）：x 9000..15000，地面 y = 90。半块黑板画满彩色：彩虹、星星、花、彩色自行车、跳房子
const A2 = { cx: 12000 }, GY = 90;
const REV = { t0: 76.97, span: 0.4, x0: A2.cx - 1250, x1: A2.cx + 800 };   // 板擦 0.4 秒（12 帧）擦过整屏：镜头这时对着少年落点，屏幕宽约 A2.cx-1075..+595
const revX = (t) => lerp(REV.x0, REV.x1, clamp((t - REV.t0) / REV.span));
const past = [];
past.push(...hopscotch(A2.cx - 620, 70, 190));
['red', 'blue', 'yellow', 'green', 'orange'].forEach((c, i) => past.push(...bike(A2.cx - 1750 + i * 300 + (i > 2 ? 2000 : 0), -20, 1.05, c, 6)));
for (let i = 0; i < 24; i++) { const R = rng(i + 3); past.push(...star(A2.cx - 2300 + R() * 4600, -1250 + R() * 700, 24 + R() * 34, ['yellow', 'orange', 'pink', 'blue', 'green'][i % 5], 5)); }
for (let i = 0; i < 6; i++) { const fx = A2.cx - 1400 + i * 520 + (i > 2 ? 400 : 0), fy = 40; for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; past.push(arc(fx + Math.cos(a) * 16, fy - 60 + Math.sin(a) * 16, 12, 0, 6.28, { color: COL[['pink', 'yellow', 'red', 'orange', 'blue', 'pink'][i]], w: 5 })); } past.push(line(fx, fy - 44, fx, fy + 10, { color: COL.green, w: 5 })); }
past.forEach((s) => { const sx = Math.min(...s.pts.map((p) => p[0])); s.t0 = REV.t0 + REV.span * clamp((sx - REV.x0) / (REV.x1 - REV.x0)); s.t1 = s.t0 + 0.12; s.group = 'past'; s.hide = 1e9; WORLD.push(s); });
['red', 'yellow', 'blue'].forEach((c, k) => { const s = arc(A2.cx + 100, 250, 1900 - k * 70, Math.PI + 0.22, 2 * Math.PI - 0.22, { color: COL[c], w: 26, kind: 'side', rwob: 0.01 }); s.t0 = REV.t0 + 0.05; s.t1 = REV.t0 + REV.span + 0.05; s.o.ease = 0; s.group = 'past'; s.hide = 1e9; WORLD.push(s); });
const KX = A2.cx - 620 + 380;
// 第 7 版：星星从挥出去那张画的粉笔尖（KX+236, -336）起笔，闪电在星星右上方
const starFrom = (x, y, r, a0, color, w) => { const p = []; for (let k = 0; k <= 10; k++) { const a = a0 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return [new Stroke(p, { color: COL[color], w, wob: 0.4 })]; };
const STARTIP = [KX + 236, -336];   // 挥出去那张画的粉笔尖（K_star_v1_2 的 tip，scale 1.1）
const bigStar = starFrom(STARTIP[0] + 50, STARTIP[1] - 62, 80, 2.25, 'yellow', 8), bolt = [new Stroke([[STARTIP[0] + 8, STARTIP[1] - 10], [STARTIP[0] + 140, STARTIP[1] - 150], [STARTIP[0] + 95, STARTIP[1] - 150], [STARTIP[0] + 230, STARTIP[1] - 300]], { color: COL.orange, w: 8 })];
bigStar[0].t0 = 83.26; bigStar[0].t1 = 84.5; bolt[0].t0 = 84.9; bolt[0].t1 = 85.55; [...bigStar, ...bolt].forEach((s) => { s.group = 'draw'; s.hide = 1e9; WORLD.push(s); });
// 奔跑时手划出的彩带：和手的位置是同一个函数
const TRAIL = { t0: 87.16, t1: 90.0, x0: A2.cx - 1500, speed: 900 };
// 第 7 版：光带从奔跑原画里伸出去的指尖出来（4 张指尖的平均位置）
const RT = [0, 1, 2, 3].map((i) => { const p = POSE[`K_run_v1_${i}`]; return [(p.tip[0] - p.ax) * p.k * 1.1, (p.tip[1] - p.ay) * p.k * 1.1]; }).reduce((a, b) => [a[0] + b[0] / 4, a[1] + b[1] / 4], [0, 0]);
const trailHand = (t) => [TRAIL.x0 + (t - TRAIL.t0) * TRAIL.speed + RT[0], GY + RT[1] + Math.sin((t - TRAIL.t0) * 7) * 12];
{
  const pts = []; for (let t = TRAIL.t0; t <= TRAIL.t1; t += 0.03) pts.push(trailHand(t));
  ['orange', 'yellow', 'blue'].forEach((c, k) => { const s = new Stroke(pts.map(([x, y]) => [x - k * 4, y + 6 + k * 14]), { color: COL[c], w: 9 - k * 2, wob: 0.8 }); s.t0 = TRAIL.t0 + 0.02 + k * 0.03; s.t1 = TRAIL.t1 + 0.02 + k * 0.03; s.o.ease = 0; s.group = 'trail'; s.hide = 1e9; WORLD.push(s); });
}
const SPIN = { x: A2.cx + 1400 };
['orange', 'pink', 'blue', 'yellow'].forEach((c, k) => add([arc(SPIN.x, GY - 320, 230 + k * 45, k, k + Math.PI * 1.7, { color: COL[c], w: 7, ry: (230 + k * 45) * 0.55 })], 90.3 + k * 0.35, 91.6 + k * 0.35, { group: 'spin' }));
const SEA = { x0: A2.cx + 2200, x1: A2.cx + 5200, y: 120 };
// 第 7 版：河、河岸木桩、嘲笑的人群都换成豆包原画（design/poses/raw/P_river_v1、P_dock_v1、P_crowd_v1）
const DOCK = SEA.x1 - 120;
const RIVER = { id: 'P_river_v1_0', x0: SEA.x0 - 80, x1: SEA.x1 + 300, y: GY + 12, speed: 26 };   // y = 最上面一道浪；整条河以 speed 向右缓慢流动
const riverTop = (t, x) => stripTop(RIVER.id, RIVER.x0, RIVER.y, x, { flow: -t * RIVER.speed });
function drawRiver(api, t, reveal = 1) {
  drawStrip(api, RIVER.id, RIVER.x0, RIVER.x1, RIVER.y, { flow: -t * RIVER.speed, reveal, fadeL: 160, soft: 160, fadeR: 320 });   // 起点、画出来的那条边、终点都渐隐
}
// 少年脚下的草岸（只有草的那段岸，镜像过来）；河的终点在木桩那段岸下面
const drawKidBank = (api, kx) => drawPose(api, 'P_bank_v1_0', { x: kx - 741, y: GY, face: -1, sx: 2.2 });   // 横向拉宽：左端伸出画外，右端到少年脚尖前
const drawDock = (api) => drawPose(api, 'P_dock_v1_0', { x: DOCK, y: RIVER.y + 30 });   // 木桩入水处在河面下一点
const BOAT = ['P_boat_v1_1', 'P_boat_v1_2', 'P_boat_v1_3'];
const BOATREL = SB(94.95);   // S19 松手（拍点）：船从手里落到水面
// 船：贴着浪尖，船身随前后两点的浪高差倾斜；tilt 额外加的晃
function drawPaperBoat(api, t, x, tilt = 0, alpha = 1, hy = null) {
  const yl = riverTop(t, x - 45), yr = riverTop(t, x + 45), a = Math.atan2(yr - yl, 90) * 0.8 + tilt;
  let y = Math.min(yl, yr) + 30;   // 船底压进浪线里，不浮在浪上
  if (hy != null) y = lerp(hy, y, clamp((t - BOATREL) / 0.14) ** 2);
  const id = BOAT[a < -0.06 ? 1 : a > 0.06 ? 2 : 0];
  drawPose(api, id, { x, y, rot: a, alpha });
}
// 课桌两边（失陪）
const A3 = { cx: 25000 };
// 第 7 版：课桌和椅子是姿势原画里画好的（大人坐着那两张自带课桌和椅子，少年那几张自带椅子），不再用代码画
const DESK = { x: A3.cx - 154 };
// S26 跪下放硬币：三张按下半身中心对齐（第 2 张锚在硬币上），dx = 第 1、3 张相对硬币的位置
const PLACE = { dx0: 273, dx2: 173 };
// 公文包平放在地上（豆包画的道具；没有道具图时用代码画的）
const drawCaseFlat = (api, x, y) => (POSE.P_props_v1_0 ? drawPose(api, 'P_props_v1_0', { x, y }) : drawCaseProp(api, x, y));   // 桌面左上角的世界 x（两张大人原画都锚在这里，桌子不动）
// 一分为二的黑板：左彩右白
const SPLIT = { x: 34000 }, KX2 = SPLIT.x - 2300 + 340;
add(hopscotch(SPLIT.x - 2300, 70, 170), 109.9, 110.0, { group: 'splitL', instant: true });
add(floorGrid(SPLIT.x + 260, SPLIT.x + 4400, 0, 280, 230, [SPLIT.x + 2300, -1500], 'white', 4.5), 109.9, 110.0, { group: 'splitR', instant: true });
add(grid(SPLIT.x + 300, -1300, 31, 8, 130, 'grey', 3.5), 109.9, 110.0, { group: 'splitR', instant: true });
add([line(SPLIT.x + 260, -900, SPLIT.x + 260, 280, { color: COL.white, w: 8 })], 118.75, 119.25, { group: 'barrier' });
WIPES.push({ t0: 129.2, t1: 136.8, path: [[SPLIT.x + 4600, -650], [SPLIT.x + 3000, -500], [SPLIT.x + 1500, -300], [SPLIT.x + 330, -200]], w: 1900, soft: 60, haze: 0 });
await new Promise((r) => setTimeout(r, 0));
bakeAll();

// ================= 画东西 =================
let PROBE = false;
function fox(api, who, P) {
  const s = P.scale ?? 1, h = (who === 'kid' ? 640 : 900) * s, Q = { boil: api.boil, ...P };
  if (Q.nod) { Q.headY = (Q.headY ?? 0) + 12 * Q.nod; Q.headTilt = (Q.headTilt ?? 0) + 0.12 * Q.nod; }
  if (PROBE) { drawFox({ probe: true }, who, Q); return Q; }
  const clip = Q.clipX1 != null, b = api.board;   // clipX1：只画世界 x 小于它的部分（被门框挡住）
  if (clip) { b.save(); applyCam(b); b.beginPath(); b.rect(-1e6, -1e6, Q.clipX1 + 1e6, 2e6); b.clip(); }
  const G = characterLayers(api, [P.x - 600 * s, (P.y ?? 0) - h - 100 * s, P.x + 600 * s, (P.y ?? 0) + 130 * s]); drawFox(G, who, Q);
  if (clip) b.restore();
  return Q;
}
const handW = (Q, k = 'AN') => { const e = Q._out[k].e, s = Q.scale ?? 1, f = (Q.face ?? 1) * (Q.sx ?? 1); return [Q.x + f * s * e[0], (Q.y ?? 0) + s * e[1]]; };
// 身体上的点（局部坐标）：沿躯干从髋往上 d、往前 f。蹲下、前倾时手跟着身子走，不会定在半空把胳膊拧过脸
const bodyPt = (who, P, d, f) => { const B = BODY[who], c = P.crouch ?? 0, l = P.lean ?? 0, hy = -B.hip * (1 - 0.2 * c) + (P.bob ?? 0); return [Math.sin(l) * d + Math.cos(l) * f, hy - Math.cos(l) * d + Math.sin(l) * f]; };
// 远侧手的默认垂放位置，用来和指定位置平滑混合
const restHandF = (who, P) => { const Q = { ...P, hands: { n: (P.hands || {}).n } }; drawFox({ probe: true }, who, Q); return Q._out.AF.e; };   // 用骨架本身算（探测一遍不画），和 drawFox 永远一致
const toLocal = (P, w) => [(w[0] - P.x) / ((P.scale ?? 1) * (P.face ?? 1)), (w[1] - (P.y ?? 0)) / (P.scale ?? 1)];
function prop(api, rect, fn) { if (PROBE) return; const G = characterLayers(api, rect); fn(G.back); G.flush(); }
const TXA = (o = {}) => ({ tex: TEX.adult, texS: 0.6, ...o });
function coinShape(L, x, y, r, flip, colored) {
  const sx = Math.max(0.07, Math.abs(Math.cos(flip))), col = colored ?? Math.cos(flip) < 0;
  for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.scale(sx, 1); }
  const circ = Array.from({ length: 28 }, (_, k) => [Math.cos((k / 28) * 6.283) * r, Math.sin((k / 28) * 6.283) * r]);
  paint(L, circ, col ? '#efc55a' : '#d9d8d0', col ? '#d4a644' : '#bdbcb4', TXA({ seed: 3, shade: 0, hl: false }));
  chalkLine(L.line, Array.from({ length: 29 }, (_, k) => [Math.cos((k / 28) * 6.283) * r * 0.8, Math.sin((k / 28) * 6.283) * r * 0.8]), col ? 'rgba(255,241,194,0.8)' : 'rgba(244,243,236,0.8)', Math.max(1.5, r * 0.05));
  if (col) { const img = HEADS.kid[1], k = (r * 1.5) / img.height; L.line.save(); L.line.beginPath(); L.line.arc(0, 0, r * 0.76, 0, 6.29); L.line.clip(); L.line.drawImage(img, (-img.width * k) / 2, -img.height * k * 0.56, img.width * k, img.height * k); L.line.restore(); }
  else for (let i = -1; i <= 1; i++) { chalkLine(L.line, [[-r * 0.52, i * r * 0.27 + r * 0.02], [r * 0.5, i * r * 0.27 - r * 0.02]], 'rgba(120,122,116,0.9)', Math.max(1.4, r * 0.05)); chalkLine(L.line, [[i * r * 0.27 - r * 0.02, -r * 0.5], [i * r * 0.27 + r * 0.02, r * 0.52]], 'rgba(120,122,116,0.9)', Math.max(1.4, r * 0.05)); }
  for (const c of [L.fill, L.line]) c.restore();
}
function drawCoin(api, x, y, r, flip, colored = null) {
  const col = colored ?? Math.cos(flip) < 0, id = col ? 'P_props_v1_3' : 'P_props_v1_2', p = POSE[id];   // 第 7 版：豆包画的硬币（金面是少年的笑脸）
  drawPose(api, id, { x, y, scale: r / (p.r * p.k), sx: Math.max(0.07, Math.abs(Math.cos(flip))) });
}
function boatShape(L, x, y, sc, tilt) {
  for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.rotate(tilt); c.scale(sc, sc); }
  paint(L, [[-72, -8], [72, -8], [46, 28], [-46, 28]], '#f1ece0', '#c4c0b3', TXA({ seed: 7, shade: 3 }));
  paint(L, [[-34, -8], [0, -74], [34, -8]], '#f6f2e8', '#cfcbbf', TXA({ seed: 8, shade: 2 }));
  gapLine(L.line, [[0, -72], [0, -10]], 2); gapLine(L.line, [[-60, 2], [60, 2]], 1.6);
  for (const c of [L.fill, L.line]) c.restore();
}
function drawBoat(api, x, y, sc = 1, tilt = 0) { prop(api, [x - 110 * sc, y - 110 * sc, x + 110 * sc, y + 50 * sc], (L) => boatShape(L, x, y, sc, tilt)); }
const chalkStub = (len = 40, spin = 0) => (L, hn, hf, J, o) => {
  const [jx, jy] = o.AN.j, [ex, ey] = hn; let dx = ex - jx, dy = ey - jy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  const a = Math.atan2(dy, dx) + 0.45 + spin, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, bx = ex + dx * 20, by = ey + dy * 20;
  paint(L, [[bx - nx * 7 - ux * 8, by - ny * 7 - uy * 8], [bx + nx * 7 - ux * 8, by + ny * 7 - uy * 8], [bx + nx * 7 + ux * len, by + ny * 7 + uy * len], [bx - nx * 7 + ux * len, by - ny * 7 + uy * len]], '#f08a3c', '#b85c22', { tex: TEX.kid, texS: 0.5, shade: 2, hl: false });
};
const coinHeld = (r, flip, colored) => (L, hn, hf, J, o) => { const [jx, jy] = o.AN.j, [ex, ey] = hn; const dx = ex - jx, dy = ey - jy, d = Math.hypot(dx, dy) || 1; coinShape(L, ex + (dx / d) * 30, ey + (dy / d) * 30 - 8, r, flip, colored); };
function drawStub(api, x, y, ang) { drawPose(api, 'P_props_v1_1', { x, y, rot: ang }); }   // 第 7 版：豆包画的橙色粉笔头
function drawCaseProp(api, x, yBottom) { prop(api, [x - 80, yBottom - 140, x + 80, yBottom + 20], (L) => { paint(L, [[x - 58, yBottom - 84], [x + 58, yBottom - 84], [x + 58, yBottom], [x - 58, yBottom]], PAL.adult.case, PAL.adult.caseD, { seed: 61, dir: 0, chalk: true }); chalkLine(L.line, [[x - 18, yBottom - 83], [x - 15, yBottom - 102], [x + 15, yBottom - 102], [x + 18, yBottom - 83]], PAL.adult.caseD, 5); }); }
function shadow(api, x, y, rx) { if (PROBE) return; const c = api.board; c.save(); applyCam(c); c.fillStyle = 'rgba(6,14,10,0.45)'; c.filter = `blur(${Math.max(1, 3 * cam.s)}px)`; c.beginPath(); c.ellipse(x, y, rx, rx * 0.28, 0, 0, 6.29); c.fill(); c.restore(); }
// 板擦（侧面）：上面木头、下面毛毡，竖着拿、横着擦；和人物一样用 paint() 画，粉笔手感一致
function eraserBlock(api, x, y, ang = 0, sc = 1) {
  const w = 150 * sc, h = 420 * sc, wood = w * 0.42;
  const R = (px, py) => [x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)];
  const box = (x0, y0, x1, y1) => [R(x0, y0), R(x1, y0), R(x1, y1), R(x0, y1)];
  prop(api, [x - h, y - h, x + h, y + h], (L) => {
    paint(L, box(-w / 2, -h / 2, -w / 2 + wood, h / 2), '#c98a4b', '#8f5a2c', { seed: 71, dir: 1.5, hl: false, chalk: true, base: 0.7 });
    paint(L, box(-w / 2 + wood, -h / 2 + 6, w / 2, h / 2 - 6), '#e2ddd0', '#b3ad9f', { seed: 72, dir: 0.2, chalk: true, base: 0.75 });
  });
}
// 板擦擦过的灰：一层很淡的底雾 + 很多横向的细擦痕（不是一团平滑的模糊）。
// 148 道带模糊的笔触每帧现画太慢（软件渲染一帧要十几秒），所以按 (宽, 高, 种子) 只画一次存成图，之后按位置和透明度贴上去
// （笔触位置只和带子的中心、半宽有关，平移不变，所以同尺寸的带子挪位置也能复用）
const BANDS = new Map();
function eraserBand(api, x0, x1, y0, y1, a = 0.5, seed = 5) {
  if (PROBE || a <= 0.005) return;
  const bw = x1 - x0, bh = y1 - y0, key = `${bw}|${bh}|${seed}`;
  let B = BANDS.get(key);
  if (!B) {
    const r = Math.min(2, 4096 / Math.max(bw, bh)), cv = new OffscreenCanvas(Math.ceil(bw * r), Math.ceil(bh * r)), c = cv.getContext('2d'), R = rng(seed);
    const cx = bw / 2, cy = bh / 2, rx = bw / 2, ry = bh / 2;
    c.setTransform(r, 0, 0, r, 0, 0); c.lineCap = 'round'; c.filter = `blur(${4 * r}px)`;
    for (let i = 0; i < 18; i++) {
      const u = (R() - 0.5) * 2, v = (R() + R() + R() - 1.5) / 1.5, x = cx + u * rx * 0.7, y = cy + v * ry * 0.8, l = rx * (0.4 + R() * 0.55);
      const w = 1 - Math.min(1, Math.abs(v)) ** 2, al = (0.04 + R() * 0.05) * w * (1 - Math.abs(u) * 0.5);
      c.strokeStyle = `rgba(196,207,199,${al})`; c.lineWidth = ry * (0.12 + R() * 0.16);
      c.beginPath(); c.moveTo(x - l / 2, y); c.lineTo(x + l / 2, y + (R() - 0.5) * ry * 0.06); c.stroke();
    }
    c.filter = `blur(${0.6 * r}px)`;
    for (let i = 0; i < 130; i++) {
      const u = (R() - 0.5) * 2, v = (R() + R() - 1) * 1.1, x = cx + u * rx * 0.75, y = cy + v * ry * 0.85, l = rx * (0.25 + R() * 0.7);
      const w = Math.max(0, 1 - Math.abs(v) ** 2), al = (0.06 + R() * 0.16) * w * (1 - Math.abs(u) * 0.45);
      c.strokeStyle = `rgba(206,214,206,${al})`; c.lineWidth = ry * (0.01 + R() * 0.035);
      c.beginPath(); c.moveTo(x - l / 2, y); c.lineTo(x + l / 2, y + (R() - 0.5) * ry * 0.05); c.stroke();
    }
    B = cv; BANDS.set(key, B);
  }
  const c = api.board; c.save(); applyCam(c); c.globalAlpha = Math.min(1, a); c.drawImage(B, x0, y0, bw, bh); c.restore();
}
// 少年的褪色要连贯：S24 褪掉，S25 远景里保持，S27 板擦擦掉大人那边时颜色慢慢回来
const kidFade = (t) => 0.75 * ramp(t, 116.0, 118.4) * (1 - ramp(t, 129.5, 133.5));
function desat(api, cx, cy, r, a) { if (PROBE || a <= 0.005) return; const c = api.board; c.save(); applyCam(c); c.globalCompositeOperation = 'saturation'; const g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(128,128,128,${a})`); g.addColorStop(0.65, `rgba(128,128,128,${a * 0.85})`); g.addColorStop(1, 'rgba(128,128,128,0)'); c.fillStyle = g; c.fillRect(cx - r, cy - r, 2 * r, 2 * r); c.restore(); }
function dust(api, x, y, t, t0, n = 40, spread = 300, col = '230,226,212') {
  if (PROBE) return; const u = t - t0; if (u < 0 || u > 1.6) return; const c = api.board, R = rng(Math.floor(t0 * 100));
  c.save(); applyCam(c);
  for (let i = 0; i < n; i++) { const a = R() * 6.28, sp = (0.3 + R()) * spread, px = x + Math.cos(a) * sp * ss(u / 1.2), py = y + Math.sin(a) * sp * ss(u / 1.2) * 0.6 - u * 40; c.fillStyle = `rgba(${col},${0.5 * (1 - u / 1.6)})`; c.beginPath(); c.arc(px, py, 2 + R() * 4, 0, 6.29); c.fill(); }
  c.restore();
}
function headPoint(who, P, ix, iy) {
  const B = BODY[who], img = HEADS[who][0], hs = B.headH / img.height, s = P.scale ?? 1, f = (P.face ?? 1) * (P.sx ?? 1), neck = P._out.neck;
  const a = (P.headTilt ?? 0) + (P.lean ?? 0) * 0.6, qx = (ix - img.width / 2) * hs, qy = (iy - img.height) * hs;
  const X = neck[0] + B.headDX + (P.headX ?? 0) + qx * Math.cos(a) - qy * Math.sin(a), Y = neck[1] + B.headDY + (P.headY ?? 0) + qx * Math.sin(a) + qy * Math.cos(a);
  return [P.x + f * s * X, (P.y ?? 0) + s * Y];
}
function tip(strokes, t) { let last = strokes[0].pts[0]; for (const s of strokes) { if (t < s.t0) return last; if (t <= s.t1) return s.at(s.prog(t) * s.len); last = s.end; } return last; }

// ================= 动作 =================
function walk(base, x0, s, o = {}) {
  const { dir = 1, stride = 0.5, stance = 0.6, lift = 30, swing = 0.45, bob = 6, sc = 1, lean = 0.04 } = o;
  const x = x0 + dir * s, q = s / stride, feet = {}, fl = {}, tilt = {}, rel = {};
  for (const [k, off] of [['n', 0], ['f', 0.5]]) {
    const qq = q + off, c = Math.floor(qq), f = qq - c, plant = (cc) => x0 + dir * (cc - off + 0.3) * stride;
    let fx, ly = 0, tl = 0;
    if (f < stance) fx = plant(c); else { const u = (f - stance) / (1 - stance); fx = lerp(plant(c), plant(c + 1), ss(u)); ly = Math.sin(u * Math.PI) * lift; tl = -0.3 * Math.sin(u * Math.PI); }
    feet[k] = [((fx - x) * dir) / sc + (k === 'n' ? 10 : -14), 0]; fl[k] = ly / sc; tilt[k] = tl; rel[k] = (fx - x) * dir;
  }
  const ph = (q % 0.5) / 0.5;
  return { ...base, x, face: dir, scale: sc, feet, footLift: fl, footTilt: tilt, bob: -Math.abs(Math.sin(ph * Math.PI)) * bob + bob * 0.5, lean, swingN: -clamp(rel.n / stride, -1, 1) * swing, swingF: -clamp(rel.f / stride, -1, 1) * swing };
}
function hops(t, tStart, n, cell) {
  // 每跳：拍后 0.22 拍离地，0.74 拍落地。落地缓冲和下一跳的预备蹲连成一个弧（两跳之间膝盖不突然伸直）；
  // 第一跳提前 0.6 拍慢慢蹲（不一帧蹲到底），最后一跳落地后用 0.9 拍慢慢站直
  const i0 = BEATS.findIndex((b) => b >= tStart), k = (t - BEATS[i0]) / BT - 0.26;   // 往后挪 0.26 拍：拍后 0.48 拍离地，正好在下一拍落地
  if (k < -0.6) return { x: 0, lift: 0, crouch: 0, air: 0 };
  if (k < 0.22) { const u = (k + 0.6) / 0.82; return { x: 0, lift: 0, crouch: 0.75 * Math.sin(Math.PI * u * u), air: 0 }; }
  const i = Math.min(n - 1, Math.floor(k - 0.22)), f = k - i;
  if (f < 0.74) { const a = (f - 0.22) / 0.52; return { x: (i + ss(a)) * cell, lift: Math.sin(a * Math.PI) * 90, crouch: 0.15 * Math.sin(a * Math.PI), air: Math.sin(a * Math.PI) }; }
  if (i < n - 1) return { x: (i + 1) * cell, lift: 0, crouch: 0.75 * Math.sin(Math.PI * (f - 0.74) / 0.48), air: 0 };
  const u = clamp((f - 0.74) / 0.9);
  return { x: n * cell, lift: 0, crouch: 0.8 * Math.sin(Math.PI * (1 - (1 - u) * (1 - u))), air: 0 };
}
function hopPose(base, x0, h) { return { ...base, x: x0 + h.x, y: -h.lift, face: 1, crouch: h.crouch, feet: { n: [16, 0], f: [-12, 0] }, footLift: { n: h.air * 22, f: h.air * 28 }, footTilt: { n: -0.3 * h.air, f: -0.35 * h.air }, swingN: -0.35 * h.crouch + 0.55 * h.air, swingF: 0.3 * h.crouch - 0.45 * h.air, lean: 0.06 + 0.12 * h.crouch, caseSwing: -0.35 * h.air, headY: 8 * h.crouch }; }
// ---- 第 7 版：姿势原画（整张画按时间换，像黑板定格动画）
// fn(t) → { id, x, y, … }；换张后 1–2 帧留一点上一张的淡影（粉笔擦了重画的残影）
function poseGhost(api, fn, t) {
  if (PROBE) return fn(t);
  const cur = fn(t), p = fn(t - 1 / 30);   // 残影只留 1 帧、很淡、只取亮部；人整体挪得远（跳起、落地）时不画
  if (p.id !== cur.id && Math.hypot((p.x ?? 0) - (cur.x ?? 0), (p.y ?? 0) - (cur.y ?? 0)) < 140) drawPose(api, p.id, { ...p, alpha: 0.16, ghost: true });
  drawPose(api, cur.id, cur);
  return cur;
}
// 跳格子：和 hops() 同一套拍点时间。锚点在髋：落地的几张让鞋底正好踩地，空中的几张让髋走一条连续的抛物线
const HOP = { crouch: 'A_hop_v2_0', up: 'A_hop_v2_1', tuck: 'A_hop_v2_2', stand: 'A_hop_v2_3' };
const hipOnGround = (id) => (POSE[id].fy - POSE[id].ay) * POSE[id].k;
function hopSprite(t, tStart, n, x0, cell = A1.cell, apex = 120) {
  const i0 = BEATS.findIndex((b) => b >= tStart), k = (t - BEATS[i0]) / BT - 0.26;
  const at = (id, x, hip) => ({ id, x: x0 + x, y: -hip });
  if (k < 0.22) return at(HOP.crouch, 0, hipOnGround(HOP.crouch));
  const i = Math.min(n - 1, Math.floor(k - 0.22)), f = k - i;
  if (f < 0.74) { const a = (f - 0.22) / 0.52; return at(a < 0.2 || a > 0.8 ? HOP.up : HOP.tuck, (i + a) * cell, hipOnGround(HOP.up) + apex * Math.sin(a * Math.PI)); }
  const id = i === n - 1 && f > 1.15 ? HOP.stand : HOP.crouch;
  return at(id, (i + 1) * cell, hipOnGround(id));
}
// 走路：接触 → 下沉 → 经过 → 另一只脚接触 → 下沉 → 经过 → …；锚点是支撑脚脚跟，支撑脚踩住不动，换脚时往前挪一步（不打滑）
const WALKC = ['A_walk_v2_0', 'A_walk_v2_1', 'A_walk_v2_2', 'A_walk_v2_3', 'A_walk_v2_1', 'A_walk_v2_2'];
function walkSprite(dt, X0, fd = 0.16) {
  const n = Math.max(0, Math.floor(dt / fd));
  let x = X0;
  for (let j = 1; j <= n; j++) { const p = POSE[WALKC[(j - 1) % 6]]; if (p.front != null) x += (p.front - p.ax) * p.k; }
  return { id: WALKC[n % 6], x, y: 0 };
}
function camTo(x, y, s, r = 0) { cam.x = x; cam.y = y; cam.s = s; cam.r = r; }
const lerpCam = (a, b, u) => camTo(lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), u)), lerp(a[3] ?? 0, b[3] ?? 0, u));
const breathe = (t, k = 1) => ({ bob: Math.sin(t * 2.1) * 2.5 * k, headTilt: 0.02 * Math.sin(t * 1.3) * k });

// ================= 镜头 =================
let NIGHT = 0;
const XS4 = -1800 + 8 * A1.cell, XS5 = XS4 + 6 * A1.cell;
const KNEEL = { crouch: 2.6, lean: 1.1 };
const SHOTS = [
  [0, 5.65, (t, api) => { lerpCam([-3150, -1500, 3.2], [-2650, -1420, 2.6], ramp(t, 0.6, 5.6)); }],
  [5.65, 11.37, (t, api) => {
    lerpCam([-2600, -1400, 2.4], [-150, -520, 0.33], eio((t - 5.65) / 5.72));
    if (t > 7.6) poseGhost(api, (tt) => walkSprite(Math.min(tt, 11.0) - 7.6, -3400, 0.19), t);   // 第 7 版：走路原画循环
  }],
  [11.37, 17.09, (t, api) => {
    poseGhost(api, (tt) => hopSprite(tt, 11.35, 8, -1800), t);   // 第 7 版：蓄力蹲 → 蹬直 → 收腿腾空 → 伸腿 → 落地蹲（豆包原画）
    lerpCam([-1250, -560, 0.55], [-760, -560, 0.55], (t - 11.37) / 5.72);
  }],
  [17.09, 22.81, (t, api) => {
    // 第 7 版：膝盖以下的特写原画（屈膝 → 蹬地 → 收脚腾空 → 落地站稳），和 S03 同一套拍点
    const f = (tt) => { const h = hopSprite(tt, 17.07, 6, XS4), id = h.id === HOP.tuck ? 'A_feet_v1_2' : h.id === HOP.up ? 'A_feet_v1_1' : h.id === HOP.stand ? 'A_feet_v1_3' : 'A_feet_v1_0';
      const air = h.id === HOP.tuck || h.id === HOP.up; return { id, x: h.x, y: air ? -Math.max(0, -h.y - hipOnGround(HOP.up)) * 0.8 : 0 }; };
    const P = poseGhost(api, f, t);
    camTo(P.x + 60 + 200 * ramp(t, 20.6, 22.6), -60, 3.2 + 0.15 * ramp(t, 17.1, 22.8));
  }],
  [22.81, 28.53, (t, api) => {
    // 第 7 版：弯腰看 → 单膝跪地手掌左右擦开灰雾 → 停住出神（豆包原画）
    // 弯腰那张没画公文包：按跪着那张里公文包的位置（切图 440, 364），先放一个在地上
    if (t < 23.5) { const q = POSE.A_wipe_v1_1; drawPose(api, 'P_props_v1_0', { x: XS5 + 40 + (440 - q.ax) * q.k, y: (364 - q.ay) * q.k, scale: 0.66 }); }
    poseGhost(api, (tt) => ({ id: tt < 23.5 ? 'A_wipe_v1_0' : tt < 25.15 ? `A_wipe_v1_${1 + (Math.floor((tt - 23.5) / 0.2) % 2)}` : 'A_wipe_v1_3', x: XS5 + 40, y: 0, breath: tt > 25.15 ? 0.004 * Math.sin(tt * 1.7) : 0 }), t);
    camTo(XS5 + 230, -230, 0.92 + 0.08 * ramp(t, 22.8, 28.5));
    dust(api, 1680, 40, t, 23.9, 30, 120);
  }],
  [28.53, 33.54, (t, api) => {
    // 第 7 版：低头出神的脸部特写原画；彩色星星映在近处那片镜片上，眨眼时熄灭
    const E = [XS5 + 300, -420], blinkT = 31.45, shut = t > blinkT && t < blinkT + 0.16;
    drawPose(api, shut ? 'A_face_v2_1' : 'A_face_v2_0', { x: E[0], y: E[1], breath: 0.004 * Math.sin(t * 1.6) });
    camTo(E[0] + 150, E[1] + 10, 2.9 + 0.25 * ramp(t, 28.5, 33.5));
    const a = 0.9 * ramp(t, 28.7, 29.4) * (1 - ramp(t, blinkT, blinkT + 0.08)), e = E;
    if (a > 0.01) prop(api, [e[0] - 40, e[1] - 40, e[0] + 40, e[1] + 40], (L) => { L.fill.save(); L.fill.globalAlpha = a; paint(L, Array.from({ length: 10 }, (_, k) => { const ang = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 8 : 19; return [e[0] + 2 + Math.cos(ang) * rr, e[1] + 6 + Math.sin(ang) * rr]; }), '#ffd45a', '#e6b445', { tex: TEX.kid, texS: 0.4, shade: 0, hl: false, rim: false }); L.fill.restore(); });
  }],
  [33.54, 39.26, (t, api) => {
    // 第 7 版：跪着抬头 → 提包站起 → 紧张张望 → 抱着包往后缩（豆包原画）
    const R = POSE.A_rise_v2_0 ? 'A_rise_v2_' : 'A_rise_v1_';
    poseGhost(api, (tt) => ({ id: R + (tt < 33.9 ? 0 : tt < 34.35 ? 1 : tt < 36.6 ? 2 : 3), x: XS5 - (tt > 36.6 ? 40 : 0), y: 0, breath: 0.005 * Math.sin(tt * 2.3) }), t);
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2), tx = XS5 + side * (230 + (lane % 4) * 260) + (lane > 3 ? -side * 120 : 0), sx = XS5 + side * (3200 + lane * 300); const p = ramp(t, 33.7 + lane * 0.3, 35.4 + lane * 0.3); const bx = lerp(sx, tx, p), by = 20 + (lane % 3) * 90; B.forEach((s) => { s.move = [bx, by]; s.vis = true; s.front = true; }); });
    lerpCam([XS5 + 40, -400, 0.75], [XS5, -360, 0.45], eio((t - 33.54) / 5.72));
  }],
  [39.26, 44.98, (t, api) => {
    const v = (XA - XS5) / 5.72, bell = SB(42.12), xAt = (tt) => XS5 + (tt - 39.26) * v;
    // 第 7 版：侧身挤着走（两张交替）→ 拍点上伸指按铃 → 愣住看着彩色的车（豆包原画）
    const SQ = POSE.A_squeeze_v2_0 ? 'A_squeeze_v2_' : 'A_squeeze_v1_', q2 = POSE[SQ + 2];
    const fr = (tt) => (tt > bell - 0.12 && tt < bell + 0.45 ? 2 : tt >= bell + 0.45 && tt < bell + BT * 2 ? 3 : 0);
    const step = (tt) => XS5 + Math.floor((tt - 39.26) / 0.36) * 0.36 * v;   // 小步挪：每 0.36 秒往前挪一步
    const P = poseGhost(api, (tt) => { const f = fr(tt); return { id: f === 3 ? 'A_squeeze_v1_3' : SQ + f, x: f === 0 ? step(tt) : xAt(tt), y: 0, breath: f === 0 ? 0.01 * Math.abs(Math.sin((tt - 39.26) / 0.36 * Math.PI)) : 0 }; }, t);
    const bellX = xAt(bell) + (q2.tip ? (q2.tip[0] - q2.ax) * q2.k : 120), bellY = q2.tip ? -(q2.ay - q2.tip[1]) * q2.k : -235;
    const toC = ramp(t, bell, bell + 0.15) * (1 - ramp(t, bell + BT, bell + BT + 0.2));
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2); let bx = XS5 + side * (230 + (lane % 4) * 260) + (lane > 3 ? -side * 120 : 0) - (t - 39.26) * 30 * side, by = 20 + (lane % 3) * 90;
      if (i === 1) { bx = bellX + 88 * BS - (t - bell) * 20; by = 0; }
      const gone = ramp(t, 44.3, 44.6), wA = (i < 6 ? 1 - toC : 1) * (1 - gone);
      B.forEach((st) => { st.move = [bx, by]; st.vis = wA > 0.01; st.front = true; st.dim = () => wA; });
      if (i < 6) bikesC[i].forEach((st) => { st.move = [bx, by]; st.vis = toC > 0.01; st.front = true; st.dim = () => toC; }); });
    if (t > bell - 0.05 && t < bell + 0.5) prop(api, [bellX - 140, bellY - 140, bellX + 140, bellY + 40], (L) => { for (let k = 0; k < 3; k++) { const a = -2.3 + k * 0.6, r0 = 34 + 30 * ramp(t, bell, bell + 0.4); chalkLine(L.line, [[bellX + Math.cos(a) * r0, bellY + Math.sin(a) * r0], [bellX + Math.cos(a) * (r0 + 34), bellY + Math.sin(a) * (r0 + 34)]], `rgba(242,239,228,${1 - ramp(t, bell + 0.25, bell + 0.5)})`, 4); } });
    camTo(P.x + 60, -390, 0.85);
    dust(api, P.x, -260, t, 44.3, 100, 1000);
  }],
  [44.98, 50.70, (t, api) => {
    // 第 7 版：半身近景原画：手伸进内袋 → 捏着粉笔头举到眼前看 → 拍点上在指间转（47.84、49.27）
    const spin = (tt) => (tt > 47.74 && tt < 47.96) || (tt > 49.17 && tt < 49.39);
    poseGhost(api, (tt) => ({ id: tt < 46.2 ? 'A_chalk_v1_0' : spin(tt) ? 'A_chalk_v1_2' : 'A_chalk_v1_1', x: XA + 60, y: -175, breath: 0.004 * Math.sin(tt * 1.8) }), t);
    camTo(XA + 110, -520, 1.62 + 0.1 * ramp(t, 45, 50.7));
  }],
  [50.70, 56.42, (t, api) => {
    // 第 7 版：半身侧面原画：手垂着 → 粉笔凑近墙 → 画下一小道 → 停住低头 → 用手掌蹭掉 → 收手
    const fr = (tt) => (tt < 51.4 ? 2 : tt < 52.9 ? 0 : tt < 53.45 ? 1 : tt < 54.2 ? 2 : tt < 54.85 ? 3 : 2);
    poseGhost(api, (tt) => { const i = fr(tt); return { id: `A_hesitate_v1_${i}`, x: i === 1 ? HES[1][0] : HES[0][0] + HESB[i][0], y: i === 1 ? HES[1][1] : HES[0][1] + HESB[i][1], breath: 0.003 * Math.sin(tt * 1.7) }; }, t);
    camTo(XA + 150, -430, 2.0 - 0.12 * ramp(t, 54.4, 56.4));
  }],
  [56.42, 62.14, (t, api) => {
    // 第 7 版：半身原画：手伸进口袋 → 硬币放在拇指上盯着 → 拍点上一弹 → 仰头看着硬币飞上去
    const flipT = SB(59.28), up = t - flipT, B = [XA + 70, 40], q = POSE.A_flick_v1_0;
    poseGhost(api, (tt) => (tt < 57.2 ? { id: 'A_chalk_v1_0', x: B[0] - 10, y: B[1] - 25 } : { id: tt < flipT ? 'A_flick_v1_0' : tt < flipT + 0.3 ? 'A_flick_v1_1' : 'A_flick_v1_2', x: B[0], y: B[1], breath: 0.004 * Math.sin(tt * 1.8) }), t);
    const hw = [B[0] + (q.coin[0] - q.ax) * q.k, B[1] + (q.coin[1] - q.ay) * q.k];   // 拇指上那枚硬币
    const cy = up > 0 ? hw[1] - 1300 * (1 - Math.pow(1 - clamp(up / 2.4), 2)) : hw[1];
    if (up > 0) drawCoin(api, hw[0], cy, 22, up * 14, false);
    camTo(XA + 120, lerp(-330, cy + 120, ramp(t, flipT, flipT + 1.6)), 1.25);
  }],
  [62.14, 67.14, (t, api) => {
    drawCoin(api, 0, -2400, 320, (t - 62.14) * 1.55 + 1.2, null);
    camTo(0, -2400, 1.0 + 0.08 * ramp(t, 62.1, 67.1), 0.03 * Math.sin(t * 0.8));
    dust(api, 0, -2400, t, 62.2, 30, 600, '255,230,160');
  }],
  [67.14, 72.86, (t, api) => {
    // 第 7 版：整张姿势原画按时间换。接硬币 → 看掌心 → 掏粉笔 → 跪下画左门框、起身、踮脚画到顶 → 踮着脚一步步挪过门顶 → 右门框从上往下 → 门把手 → 走进门
    const C = ['A_coin_v2_0', 'A_coin_v2_1', 'A_coin_v2_2', 'A_coin_v2_3'], catchT = 67.62, WALK0 = 70.9;
    const last = (arr, tt) => arr.filter((q) => tt >= (Array.isArray(q) ? q[0] : q)).length - 1;
    const pose = (tt) => {
      if (tt < catchT) return { id: C[0], x: XA, y: 0 };
      if (tt < 68.33) return { id: C[1], x: XA, y: 0 };
      if (tt < DOORT.L[0][0]) return { id: C[3], x: XA, y: 0 };
      if (tt < DOORT.TOP[0]) return { id: DOORF[DOORT.L[last(DOORT.L, tt)][1]], x: DL, y: 0 };
      if (tt < DOORT.R[0][0]) return { id: DOORF[3], x: DL + ((DR - DL) * last(DOORT.TOP, tt)) / 3, y: 0 };
      if (tt < DOORT.KNOB[0]) return { id: DOORF[DOORT.R[last(DOORT.R, tt)][1]], x: DR, y: 0 };
      if (tt < WALK0) return { id: DOORF[1], x: DR - 30, y: 0 };
      return { ...walkSprite(tt - WALK0, DR - 434), clipX1: DR - 6 };   // 走进门洞：过了右门框的部分被墙挡住
    };
    if (t > WALK0) prop(api, [DL - 10, -DH - 10, DR + 10, 10], (L) => { L.fill.save(); L.fill.globalAlpha = 0.92 * ramp(t, WALK0, WALK0 + 0.5); L.fill.fillStyle = '#07100c'; L.fill.fillRect(DL + 5, -DH + 5, DR - DL - 10, DH - 5); L.fill.restore(); });
    if (pose(t).id === DOORF[0]) drawCaseFlat(api, pose(t).x - 470, 0);   // 跪着那张没画公文包：放在身后地上
    const P = poseGhost(api, pose, t);
    if (!PROBE) {
      const q = POSE[P.id], palm = q.palm && [P.x + (q.palm[0] - q.ax) * q.k, -(q.ay - q.palm[1]) * q.k];
      if (t < catchT) { const u = clamp((t - 67.14) / (catchT - 67.14)); drawCoin(api, palm[0], lerp(-1500, palm[1] - 18, u * u), 22, (t - 67.14) * 5, null); }
      else if (palm) drawCoin(api, palm[0], palm[1] - 10, 15, 0, true);   // 落进掌心，彩面朝上
    }
    camTo(lerp(XA + 120, (DL + DR) / 2 - 60, ramp(t, 67.7, 69.2)), lerp(-430, -520, ramp(t, 67.7, 69.2)), lerp(1.0, 0.85, ramp(t, 67.7, 69.2)));
  }],
  [72.86, 76.97, (t, api) => {
    prop(api, [DL - 10, -DH - 10, DR + 10, 10], (L) => { L.fill.save(); L.fill.globalAlpha = 0.92; L.fill.fillStyle = '#07100c'; L.fill.fillRect(DL + 5, -DH + 5, DR - DL - 10, DH - 5); L.fill.restore(); });
    const u = Math.pow(clamp((t - 73.2) / 3.77), 2.3); lerpCam([(DL + DR) / 2 - 300, -420, 0.7], [(DL + DR) / 2, -DH / 2, 4.5], u);
    NIGHT = 0.3 * ramp(t, 75.5, 76.9);
    // 推进门里：最后 0.6 秒门洞的黑从门框往外扩到整屏（不靠继续放大，粉笔线放大太多会成马赛克）
    const e = Math.pow(ramp(t, 76.35, 76.95), 1.6);
    if (e > 0 && !PROBE) { const c = api.board, p = (x, y) => [W / 2 + (x - cam.x) * cam.s, H / 2 + (y - cam.y) * cam.s], a = p(DL + 5, -DH + 5), b = p(DR - 5, 0);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#07100c'; c.filter = `blur(${Math.round(30 * e)}px)`; c.fillRect(lerp(a[0], -80, e), lerp(a[1], -80, e), lerp(b[0], W + 80, e) - lerp(a[0], -80, e), lerp(b[1], H + 80, e) - lerp(a[1], -80, e)); c.restore(); }
  }],
  [76.97, 81.44, (t, api) => {
    const bx = revX(t), land = SB(77.86), sweeping = t < REV.t0 + REV.span + 0.05;
    lerpCam([KX, -380, 1.15], [A2.cx - 100, -420, 0.55], eio((t - 78.15) / 1.3));   // 先对准落点，落地叉腰后急拉
    eraserBand(api, bx - 460, bx + 40, -1700, 600, 0.8 * (1 - ramp(t, REV.t0 + REV.span, REV.t0 + REV.span + 0.5)), 11);
    if (sweeping && !PROBE) { const c = api.board, sx = W / 2 + (bx + 60 - cam.x) * cam.s; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#07100c'; c.filter = 'blur(10px)'; c.fillRect(sx, -40, W + 80 - sx, H + 80); c.restore(); }
    if (sweeping) eraserBlock(api, bx + 20, -420 + 40 * Math.sin((t - REV.t0) * 9), 0.12 * Math.sin((t - REV.t0) * 7), 1);
    if (bx > KX - 60) {
      // 第 7 版：张开双臂往下落 → 落地屈膝缓冲 → 叉腰抬下巴（豆包原画）
      poseGhost(api, (tt) => { const f2 = clamp((tt - 77.3) / (land - 77.3)); return tt < land ? { id: 'K_land_v1_0', x: KX, y: GY - 300 * (1 - f2 * f2), scale: 1.1 } : { id: tt < land + 0.3 ? 'K_land_v1_1' : 'K_land_v1_2', x: KX, y: GY, scale: 1.1, breath: 0.006 * Math.sin(tt * 2.4) }; }, t);
    }
    dust(api, bx, -600, t, 77.0, 120, 1400);
  }],
  [81.44, 87.16, (t, api) => {
    // 第 7 版：叉腰斜眼得意 → 粉笔往后一抡 → 大笔一挥（星星从粉笔尖甩出来）→ 再抡 → 再挥（闪电）→ 指着天大笑（豆包原画）
    const K = ['K_star_v1_0', 'K_star_v1_1', 'K_star_v1_2', 'K_star_v1_3'], seq = [[81.44, 0], [82.95, 1], [83.22, 2], [85.75, 3]];
    poseGhost(api, (tt) => { const q = seq.filter((s) => tt >= s[0]).pop() || seq[0]; return { id: K[q[1]], x: KX, y: GY, scale: 1.1, breath: 0.006 * Math.sin(tt * 2.4) }; }, t);
    camTo(lerp(KX + 110, KX + 200, ramp(t, 81.4, 87.2)), lerp(-300, -330, ramp(t, 81.4, 87.2)), 1.05 + 0.08 * Math.sin((t - 81.44) * 0.5), 0.02 * Math.sin((t - 81.44) * 0.9));
  }],
  [87.16, 90.02, (t, api) => {
    // 第 7 版：闭着眼、伸着手往前跑（豆包原画 4 张循环），手指划过的地方留下彩色光带
    NIGHT = 0.25; const s = (t - TRAIL.t0) * TRAIL.speed;
    poseGhost(api, (tt) => { const ss2 = (tt - TRAIL.t0) * TRAIL.speed; return { id: `K_run_v1_${((Math.floor(ss2 / 130) % 4) + 4) % 4}`, x: TRAIL.x0 + ss2, y: GY, scale: 1.1 }; }, t);
    camTo(TRAIL.x0 + s + 140, -320, 0.85);
  }],
  [90.02, 92.88, (t, api) => {
    // 第 7 版：张开双臂转圈（正面 → 侧面 → 背面 → 另一侧，一拍转一圈），每拍颠一下（豆包原画）
    NIGHT = 0.25;
    poseGhost(api, (tt) => { const k = (tt - 90.02) / BT, f = k - Math.floor(k), hop = Math.sin(clamp((f - 0.1) / 0.7) * Math.PI) * 40; return { id: `K_spin_v1_${Math.floor(f * 4) % 4}`, x: SPIN.x, y: GY - hop, scale: 1.1 }; }, t);
    camTo(SPIN.x, -340 - 40 * ramp(t, 90, 92.9), 0.9 + 0.12 * ramp(t, 90, 92.9), 0.03 * Math.sin(t * 1.2));
  }],
  [92.88, 95.74, (t, api) => {
    // 第 7 版：掏书包 → 捧着纸船笑 → 蹲下把船放到水边 → 蹲着看（豆包原画）。河从左往右画出来；松手后船落到浪尖上漂走
    NIGHT = 0.25; const x = SEA.x0 - 120, rel = SB(94.95), KB = ['K_boat_v1_0', 'K_boat_v1_1', 'K_boat_v1_2', 'K_boat_v1_3'];
    drawRiver(api, t, ramp(t, 92.9, 94.0)); drawKidBank(api, x);
    poseGhost(api, (tt) => ({ id: KB[tt < 93.45 ? 0 : tt < 94.0 ? 1 : tt < rel ? 2 : 3], x, y: GY, scale: 1.1 }), t);
    if (t >= rel && !PROBE) { const q = POSE[KB[2]], s = q.k * 1.1, bx = x + (q.boat[0] - q.ax) * s + (t - rel) * 40, hy = GY - (q.ay - q.boat[1]) * s; drawPaperBoat(api, t, bx, 0.04 * Math.sin(t * 5), 1, hy); }
    camTo(x + 180, -130, 1.3);
  }],
  [95.74, 98.60, (t, api) => {
    // 第 7 版：远景跟船。上方一群白粉笔人影指着笑（一拍颠两下）；船贴着浪尖漂，拍点上撞到木桩，弹一下、晃两下停住
    NIGHT = 0.25; const u = clamp((t - 95.74) / 2.6), tD = SB(98.3), ua = clamp((t - 95.74) / (tD - 95.74)), B0 = SB(95.74);
    const laugh = Math.sin(((((t - B0) / BT) * 2) % 1 + 1) % 1 * Math.PI);
    for (let i = 0; i < 6; i++) drawPose(api, `P_crowd_v2_${i}`, { x: SEA.x0 + 1250, y: -480 - 14 * laugh, alpha: ramp(t, 95.75, 96.3), rot: 0.008 * Math.sin(t * 9) });   // 6 块拼回整组
    drawRiver(api, t, 1); drawDock(api); drawKidBank(api, SEA.x0 - 120);
    drawPose(api, 'K_boat_v1_3', { x: SEA.x0 - 120, y: GY, scale: 1.1, breath: 0.006 * Math.sin(t * 2.2) });
    const bx = lerp(SEA.x0 + 300, DOCK - 92, 1 - Math.pow(1 - ua, 2.2)) - (t > tD ? 14 * Math.sin(Math.min(1, (t - tD) / 0.35) * Math.PI) : 0);
    drawPaperBoat(api, t, bx, t > tD ? 0.12 * Math.sin((t - tD) * 14) * Math.exp(-(t - tD) * 5) : 0.03 * Math.sin(t * 4));
    dust(api, DOCK - 30, RIVER.y - 20, t, tD, 26, 120);
    camTo(lerp(SEA.x0 + 900, SEA.x1 - 760, eio(u)), -190, 0.6);
  }],
  [98.60, 104.32, (t, api) => {
    // 第 7 版：大人（白）和少年（彩）隔着课桌对坐；拍点上大人站起来，椅子往后一推（豆包原画，两张都锚在桌角，桌子不动）
    NIGHT = 0.15; const u0 = SB(101.46);
    const kid = (tt) => ({ id: tt < u0 + 0.45 ? 'K_sit_v1_0' : tt < 103.6 ? 'K_sit_v1_1' : 'K_sit_v1_2', x: DESK.x + 420, y: GY - 90, face: -1, scale: 1.05, breath: 0.005 * Math.sin(tt * 2.1) });
    poseGhost(api, (tt) => ({ id: tt < u0 ? 'A_sit_v1_0' : 'A_sit_v1_1', x: DESK.x, y: -(POSE.A_sit_v1_0.ground - POSE.A_sit_v1_0.ay) * POSE.A_sit_v1_0.k, breath: 0.004 * Math.sin(tt * 1.9) }), t);
    poseGhost(api, kid, t);
    camTo(A3.cx, -420, 0.75 + 0.05 * ramp(t, 98.6, 104.3));
  }],
  [104.32, 110.04, (t, api) => {
    // 第 7 版：半身近景原画。107.18 前是少年：抬头看他 → 眼睛湿了但没哭；之后反打大人：低头看他 → 别开脸 → 提起公文包
    NIGHT = 0.15; const rev = t >= SB(107.18);
    if (!rev) {
      poseGhost(api, (tt) => ({ id: tt < 105.9 ? 'K_lookup_v1_0' : 'K_lookup_v1_1', x: A3.cx + 330, y: 45, breath: 0.006 * Math.sin(tt * 2.2) }), t);
      camTo(A3.cx + 330, -290, 1.65 + 0.12 * ramp(t, 104.3, 107.2));
    } else {
      poseGhost(api, (tt) => ({ id: tt < 107.45 ? 'A_turn_v1_0' : tt < 108.6 ? 'A_turn_v1_1' : 'A_turn_v1_2', x: A3.cx - 470, y: -10, breath: 0.004 * Math.sin(tt * 1.8) }), t);
      camTo(A3.cx - 470, -420, 1.5 + 0.12 * ramp(t, 107.2, 110));
    }
  }],
  [110.04, 115.76, (t, api) => {
    // 第 7 版：左边少年站着不动（全身设定图那张）；右边大人提着包背对我们越走越远、越走越小（豆包原画 4 张走路循环）
    NIGHT = 0.15;
    drawPose(api, 'K_rest_0', { x: KX2, y: GY, scale: 1.05, breath: 0.005 * Math.sin(t * 2.0) });
    poseGhost(api, (tt) => { const s2 = (tt - 110.04) * 330 + Math.pow(Math.max(0, tt - 112), 2) * 40, sc = lerp(1, 0.55, ramp(tt, 110.5, 115.7)); return { id: `A_away_v1_${((Math.floor(s2 / 150) % 4) + 4) % 4}`, x: SPLIT.x + 500 + s2, y: -60 * (1 - sc), scale: sc }; }, t);
    lerpCam([SPLIT.x - 200, -420, 0.38], [SPLIT.x + 100, -440, 0.3], eio((t - 110.04) / 5.72));
  }],
  [115.76, 118.62, (t, api) => {
    // 第 7 版：少年脸部特写原画（看着他走远，眼睛湿了，没有哭）；颜色被灰雾慢慢盖上
    NIGHT = 0.15;
    const blinkK = t > 117.3 && t < 117.45;
    drawPose(api, blinkK ? 'K_face_v2_1' : 'K_face_v2_0', { x: KX2, y: 0, breath: 0.004 * Math.sin(t * 2) });
    camTo(KX2 + 10, -262, 2.25 + 0.15 * ramp(t, 115.8, 118.6));   // 下沿出画，地上的跳房子也不进画
    desat(api, KX2, -330, 520, kidFade(t));
    eraserBand(api, KX2 - 260, KX2 + 260, -560, -120, 0.5 * ramp(t, 116.2, 118.2), 21);
  }],
  [118.62, 122.91, (t, api) => {
    // 第 7 版：扔下公文包回头 → 朝少年跑 → 撞上白线：双手贴线（像隔着看不见的墙）→ 拍点上再推一次 → 顺着线滑下来跪坐（豆包原画）
    NIGHT = 0.15; const x0 = SPLIT.x + 1400, LX = SPLIT.x + 260, hitT = 119.97, push = SB(120.9);
    drawPose(api, 'K_rest_0', { x: KX2, y: GY, scale: 1.05, breath: 0.005 * Math.sin(t * 2.0) }); desat(api, KX2, -260, 520, kidFade(t));
    if (t > 118.86) drawCaseFlat(api, x0 - 230, 0);
    poseGhost(api, (tt) => {
      if (tt < 118.86) return { id: 'A_runback_v1_0', x: x0, y: 0 };
      if (tt < hitT - 0.12) { const u = (tt - 118.86) / (hitT - 0.12 - 118.86), hx = lerp(x0 - 150, LX + 230, u * (0.35 + 0.65 * u)); return { id: `A_runback_v1_${1 + (Math.floor((x0 - hx) / 190) % 2)}`, x: hx, y: 0 }; }
      if (tt < hitT) return { id: 'A_runback_v1_3', x: LX + 230, y: 0 };
      const pushed = tt > push - 0.12 && tt < push + 0.35, slid = tt > 121.75;
      return { id: slid ? 'A_barrier_v1_2' : pushed ? 'A_barrier_v1_1' : 'A_barrier_v1_0', x: LX + 6, y: 0 };
    }, t);
    const flash = t > hitT ? Math.exp(-(t - hitT) * 6) + 0.8 * Math.exp(-Math.max(0, t - push) * 6) * (t > push ? 1 : 0) : 0;
    if (flash > 0.02) prop(api, [LX - 60, -960, LX + 60, 300], (L) => { chalkLine(L.line, [[LX, -900], [LX, 280]], `rgba(250,248,240,${Math.min(1, flash)})`, 8 + 14 * flash); });
    dust(api, LX, -480, t, hitT, 40, 220); dust(api, LX, -420, t, push, 24, 160);
    lerpCam([SPLIT.x - 450, -440, 0.42], [SPLIT.x - 150, -480, 0.5], eio((t - 118.62) / 4.3));
  }],
  [122.91, 128.63, (t, api) => {
    // 第 7 版：捧着硬币低头 → 单膝跪下把硬币放在白线上（拍点）→ 手收回膝上低头看着（豆包原画）。硬币落地后换成彩面朝上的那枚
    NIGHT = 0.15; const landT = SB(126.2), lineW = [SPLIT.x + 232, 2], P1 = POSE.A_place_v1_1;
    poseGhost(api, (tt) => tt < landT - 0.85 ? { id: 'A_place_v1_0', x: lineW[0] + PLACE.dx0, y: 0, breath: 0.006 * Math.sin(tt * 1.8) } : tt < landT + 0.35 ? { id: 'A_place_v1_1', x: lineW[0], y: 0 } : { id: 'A_place_v1_2', x: lineW[0] + PLACE.dx2, y: 0, breath: 0.004 * Math.sin(tt * 1.8) }, t);
    if (t >= landT + 0.35) { shadow(api, lineW[0], 30, 26); drawCoin(api, lineW[0], 10, 26, Math.PI, true); }
    drawCaseFlat(api, SPLIT.x + 1170, 0);
    lerpCam([lineW[0] + 250, -560, 1.25], [lineW[0] + 200, -360, 0.9], eio((t - 122.91) / 5.7));
  }],
  [128.63, 137.21, (t, api) => {
    NIGHT = 0.15; const lineW = [SPLIT.x + 232, 2], wx = lerp(SPLIT.x + 4600, SPLIT.x + 330, clamp((t - 129.2) / 7.6));
    drawPose(api, 'K_rest_0', { x: KX2, y: GY, scale: 1.05, breath: 0.005 * Math.sin(t * 2.0) }); desat(api, KX2, -260, 520, kidFade(t));
    const ax = lineW[0] + PLACE.dx2; drawPose(api, 'A_place_v1_2', { x: ax, y: 0, alpha: 1 - ramp(wx, ax + 700, ax - 200), breath: 0.004 * Math.sin(t * 1.8) });
    shadow(api, lineW[0], 30, 26); drawCoin(api, lineW[0], 10, 26, Math.PI, true);
    eraserBand(api, wx - 200, wx + 600, -1300, 300, 0.9 * bump(t, 129.0, 137.0), 31);
    lerpCam([SPLIT.x + 600, -420, 0.4], [SPLIT.x - 500, -420, 0.36], eio((t - 128.63) / 8.6));
  }],
  [137.21, 147.03, (t, api) => {
    NIGHT = 0.15 + 0.35 * ramp(t, 140, 146.5);
    shadow(api, SPLIT.x + 232, 30, 26); drawCoin(api, SPLIT.x + 232, 10, 26, Math.PI, true);
    const roll = ramp(t, 139.4, 141.4); shadow(api, SPLIT.x + 300 + roll * 46, 28, 24); drawStub(api, SPLIT.x + 300 + roll * 46, 16, roll * 1.7 + 0.2);
    drawPose(api, 'K_rest_0', { x: KX2, y: GY, scale: 1.05, breath: 0.006 * Math.sin(t * 1.8) });   // 第 7 版
    lerpCam([SPLIT.x + 260, -40, 2.4], [SPLIT.x - 850, -420, 0.3], eio((t - 137.21) / 9.6));
  }],
];

// ================= 合成 =================
const layer = { cv: new OffscreenCanvas(W, H), w: W, h: H, s: 1 }; layer.ctx = layer.cv.getContext('2d');
const dummy = new Proxy({}, { get: () => () => {}, set: () => true });
function drawWorldPass(ctx, t, view, front) {
  const moved = [];
  for (const s of WORLD) {
    const off = s.vis === false || (!!s.front) !== front;
    if (off) { s._hs = s.hide; s.hide = -1; moved.push(s); continue; }
    if (s.move && s.sprite) { s._x0 = s.sprite.x0; s._y0 = s.sprite.y0; s.sprite.x0 += s.move[0]; s.sprite.y0 += s.move[1]; moved.push(s); }
  }
  drawWorld(ctx, t, view, layer, applyCam, front);
  for (const s of moved) { if (s._hs !== undefined) { s.hide = s._hs; delete s._hs; } if (s._x0 !== undefined) { s.sprite.x0 = s._x0; s.sprite.y0 = s._y0; delete s._x0; delete s._y0; } }
}
const bikeDim = () => 1;
window.renderAt = (t) => renderFrame(t, (t, api) => {
  NIGHT = 0;
  for (const s of WORLD) { s.move = null; s.front = false; const b = s.group === 'bikeW' || s.group === 'bikeC'; s.vis = !b; if (b) s.dim = bikeDim; }
  const shot = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  PROBE = true; setProbing(true); shot[2](t, { ...api, board: dummy }); PROBE = false; setProbing(false);
  drawSlate(api.board);
  if (NIGHT > 0) { api.board.save(); api.board.setTransform(1, 0, 0, 1, 0, 0); api.board.fillStyle = `rgba(4,10,22,${0.42 * NIGHT})`; api.board.fillRect(0, 0, W, H); api.board.restore(); }
  layer.s = cam.s;
  const S = 1 / cam.s, view = [cam.x - (W / 2) * S - 200, cam.y - (H / 2) * S - 200, cam.x + (W / 2) * S + 200, cam.y + (H / 2) * S + 200];
  drawWorldPass(api.board, t, view, false);
  if (t < 76.97 && view[0] < G0.x1 + 300 && view[2] > G0.x0 - 300) eraserBand(api, G0.x0 - 30, G0.x1 + 30, G0.y0 - 26, G0.y1 + 26, ghostHaze(t), 7);
  shot[2](t, api);
  if (WORLD.some((s) => s.front && s.vis !== false)) drawWorldPass(api.board, t, view, true);
});
window.SHOTS = SHOTS.map((s) => [s[0], s[1]]);
window.READY = true;
